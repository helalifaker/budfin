// Revenue calculation engine — pure functions, no DB dependencies
// Epic 2, Story #102 (2.5): Revenue Engine

import { Decimal } from 'decimal.js';

// ── Input Interfaces ──────────────────────────────────────────────────────────

export interface EnrollmentDetailInput {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	headcount: number;
}

export interface FeeGridInput {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	tuitionTtc: string; // decimal string
	tuitionHt: string; // decimal string
	dai: string; // decimal string
}

export interface DiscountPolicyInput {
	tariff: string;
	nationality: string | null;
	discountRate: string; // decimal string 0–1
}

export type DistributionMethod =
	| 'ACADEMIC_10'
	| 'YEAR_ROUND_12'
	| 'CUSTOM_WEIGHTS'
	| 'SPECIFIC_PERIOD';

export interface OtherRevenueInput {
	lineItemName: string;
	annualAmount: string; // decimal string
	distributionMethod: DistributionMethod;
	weightArray?: number[] | null;
	specificMonths?: number[] | null;
	ifrsCategory: string;
}

export interface RevenueEngineInput {
	enrollmentDetails: EnrollmentDetailInput[];
	feeGrid: FeeGridInput[];
	discountPolicies: DiscountPolicyInput[];
	otherRevenueItems: OtherRevenueInput[];
}

// ── Output Interfaces ─────────────────────────────────────────────────────────

export interface MonthlyRevenueOutput {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	month: number;
	grossRevenueHt: string; // decimal string
	discountAmount: string;
	netRevenueHt: string;
	vatAmount: string;
}

export interface OtherRevenueOutput {
	lineItemName: string;
	ifrsCategory: string;
	month: number;
	amount: string; // decimal string
}

export interface RevenueEngineResult {
	tuitionRevenue: MonthlyRevenueOutput[];
	otherRevenue: OtherRevenueOutput[];
	totals: {
		grossRevenueHt: string;
		totalDiscounts: string;
		netRevenueHt: string;
		totalVat: string;
		totalOtherRevenue: string;
	};
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VAT_RATE = new Decimal('0.15');
const ZERO = new Decimal(0);

// AY1: months 1-6 (Jan-Jun), AY2: months 9-12 (Sep-Dec)
const AY1_MONTHS = [1, 2, 3, 4, 5, 6];
const AY2_MONTHS = [9, 10, 11, 12];

// Academic months (exclude Jul-Aug summer)
const ACADEMIC_MONTHS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12];

// ── Helper: Last-bucket rounding ──────────────────────────────────────────────

/**
 * Distribute a total across N months using last-bucket rounding.
 * Each month gets floor(total / N, 4) except the last month which gets the remainder.
 * This ensures the sum of all months equals the total exactly.
 */
function distributeWithLastBucket(total: Decimal, months: number[]): Map<number, Decimal> {
	const result = new Map<number, Decimal>();

	if (months.length === 0) return result;

	const perMonth = total.div(months.length).toDecimalPlaces(4, Decimal.ROUND_DOWN);
	let allocated = ZERO;

	for (let i = 0; i < months.length; i++) {
		const month = months[i]!;
		if (i === months.length - 1) {
			// Last bucket gets the remainder
			result.set(month, total.minus(allocated));
		} else {
			result.set(month, perMonth);
			allocated = allocated.plus(perMonth);
		}
	}

	return result;
}

// ── Helper: Resolve discount rate ─────────────────────────────────────────────

/**
 * Find the highest applicable discount rate for a given tariff/nationality.
 * Matching rules:
 * 1. Exact match on (tariff, nationality)
 * 2. Wildcard match on (tariff, null) — applies to all nationalities
 * 3. If multiple match, highest rate wins (SA-006)
 */
function resolveDiscountRate(
	tariff: string,
	nationality: string,
	policies: DiscountPolicyInput[]
): Decimal {
	let maxRate = ZERO;

	for (const policy of policies) {
		const tariffMatch = policy.tariff === tariff;
		const nationalityMatch = policy.nationality === null || policy.nationality === nationality;

		if (tariffMatch && nationalityMatch) {
			const rate = new Decimal(policy.discountRate);
			if (rate.gt(maxRate)) {
				maxRate = rate;
			}
		}
	}

	return maxRate;
}

// ── Helper: Build fee lookup map ──────────────────────────────────────────────

type FeeKey = string;

function makeFeeKey(
	academicPeriod: string,
	gradeLevel: string,
	nationality: string,
	tariff: string
): FeeKey {
	return `${academicPeriod}|${gradeLevel}|${nationality}|${tariff}`;
}

function buildFeeMap(feeGrid: FeeGridInput[]): Map<FeeKey, FeeGridInput> {
	const map = new Map<FeeKey, FeeGridInput>();
	for (const fee of feeGrid) {
		const key = makeFeeKey(fee.academicPeriod, fee.gradeLevel, fee.nationality, fee.tariff);
		map.set(key, fee);
	}
	return map;
}

// ── Public: Distribute across months ──────────────────────────────────────────

export function distributeAcrossMonths(
	total: Decimal,
	method: DistributionMethod,
	weightArray?: number[] | null,
	specificMonths?: number[] | null
): Map<number, Decimal> {
	switch (method) {
		case 'ACADEMIC_10':
			return distributeWithLastBucket(total, ACADEMIC_MONTHS);

		case 'YEAR_ROUND_12':
			return distributeWithLastBucket(total, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

		case 'CUSTOM_WEIGHTS': {
			if (!weightArray || weightArray.length !== 12) {
				throw new Error('CUSTOM_WEIGHTS requires a weight_array of exactly 12 values');
			}
			const result = new Map<number, Decimal>();
			let allocated = ZERO;
			for (let i = 0; i < 12; i++) {
				const month = i + 1;
				if (i === 11) {
					// Last bucket
					result.set(month, total.minus(allocated));
				} else {
					const weight = weightArray[i] ?? 0;
					const amount = total.mul(new Decimal(weight)).toDecimalPlaces(4, Decimal.ROUND_DOWN);
					result.set(month, amount);
					allocated = allocated.plus(amount);
				}
			}
			return result;
		}

		case 'SPECIFIC_PERIOD': {
			if (!specificMonths || specificMonths.length === 0) {
				throw new Error('SPECIFIC_PERIOD requires a non-empty specific_months array');
			}
			return distributeWithLastBucket(total, specificMonths);
		}

		default:
			throw new Error(`Unknown distribution method: ${method}`);
	}
}

// ── Public: Main calculation ──────────────────────────────────────────────────

export function calculateRevenue(input: RevenueEngineInput): RevenueEngineResult {
	const { enrollmentDetails, feeGrid, discountPolicies, otherRevenueItems } = input;

	const feeMap = buildFeeMap(feeGrid);
	const tuitionRevenue: MonthlyRevenueOutput[] = [];

	let totalGrossHt = ZERO;
	let totalDiscounts = ZERO;
	let totalNetHt = ZERO;
	let totalVat = ZERO;

	// Process each enrollment detail row
	for (const enrollment of enrollmentDetails) {
		if (enrollment.headcount <= 0) continue;

		const feeKey = makeFeeKey(
			enrollment.academicPeriod,
			enrollment.gradeLevel,
			enrollment.nationality,
			enrollment.tariff
		);
		const fee = feeMap.get(feeKey);

		if (!fee) {
			// No fee grid entry for this combination — skip (SA-010)
			continue;
		}

		const headcount = new Decimal(enrollment.headcount);
		const tuitionHt = new Decimal(fee.tuitionHt);

		// Determine months for this academic period
		const months = enrollment.academicPeriod === 'AY1' ? AY1_MONTHS : AY2_MONTHS;

		// Annual tuition revenue HT for this segment
		const annualGrossHt = headcount.mul(tuitionHt);

		// Resolve discount
		const discountRate = resolveDiscountRate(
			enrollment.tariff,
			enrollment.nationality,
			discountPolicies
		);
		const annualDiscountAmount = annualGrossHt.mul(discountRate);
		const annualNetHt = annualGrossHt.minus(annualDiscountAmount);

		// VAT: Nationaux are exempt (0%), others 15%
		const vatRate = enrollment.nationality === 'Nationaux' ? ZERO : VAT_RATE;
		const annualVat = annualNetHt.mul(vatRate);

		// Distribute across months using last-bucket rounding
		const grossPerMonth = distributeWithLastBucket(annualGrossHt, months);
		const discountPerMonth = distributeWithLastBucket(annualDiscountAmount, months);
		const netPerMonth = distributeWithLastBucket(annualNetHt, months);
		const vatPerMonth = distributeWithLastBucket(annualVat, months);

		// Emit one row per month
		for (const month of months) {
			const grossM = grossPerMonth.get(month) ?? ZERO;
			const discountM = discountPerMonth.get(month) ?? ZERO;
			const netM = netPerMonth.get(month) ?? ZERO;
			const vatM = vatPerMonth.get(month) ?? ZERO;

			tuitionRevenue.push({
				academicPeriod: enrollment.academicPeriod,
				gradeLevel: enrollment.gradeLevel,
				nationality: enrollment.nationality,
				tariff: enrollment.tariff,
				month,
				grossRevenueHt: grossM.toFixed(4),
				discountAmount: discountM.toFixed(4),
				netRevenueHt: netM.toFixed(4),
				vatAmount: vatM.toFixed(4),
			});

			totalGrossHt = totalGrossHt.plus(grossM);
			totalDiscounts = totalDiscounts.plus(discountM);
			totalNetHt = totalNetHt.plus(netM);
			totalVat = totalVat.plus(vatM);
		}
	}

	// Process other revenue items
	const otherRevenue: OtherRevenueOutput[] = [];
	let totalOtherRevenue = ZERO;

	for (const item of otherRevenueItems) {
		const annualAmount = new Decimal(item.annualAmount);
		const monthlyDistribution = distributeAcrossMonths(
			annualAmount,
			item.distributionMethod,
			item.weightArray,
			item.specificMonths
		);

		for (const [month, amount] of monthlyDistribution) {
			if (!amount.isZero()) {
				otherRevenue.push({
					lineItemName: item.lineItemName,
					ifrsCategory: item.ifrsCategory,
					month,
					amount: amount.toFixed(4),
				});
				totalOtherRevenue = totalOtherRevenue.plus(amount);
			}
		}
	}

	return {
		tuitionRevenue,
		otherRevenue,
		totals: {
			grossRevenueHt: totalGrossHt.toFixed(4),
			totalDiscounts: totalDiscounts.toFixed(4),
			netRevenueHt: totalNetHt.toFixed(4),
			totalVat: totalVat.toFixed(4),
			totalOtherRevenue: totalOtherRevenue.toFixed(4),
		},
	};
}
