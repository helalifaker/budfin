// Revenue calculation engine — pure functions, no DB dependencies
// Story 2.5: Revenue engine with Decimal.js precision (TC-001, TC-004)

import { Decimal } from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ---------------------------------------------------------------------------
// Input interfaces
// ---------------------------------------------------------------------------

export interface EnrollmentDetailInput {
	gradeLevel: string;
	nationality: string;
	tariff: string;
	academicPeriod: 'AY1' | 'AY2';
	headcount: number;
}

export interface FeeGridInput {
	gradeLevel: string;
	nationality: string;
	tariff: string;
	academicPeriod: 'AY1' | 'AY2';
	tuitionTtc: string;
	tuitionHt: string;
	dai: string;
	registrationFee: string;
	reRegistrationFee: string;
	insuranceFee: string;
}

export interface DiscountPolicyInput {
	tariff: string;
	nationality: string | null; // null = applies to all nationalities
	discountRate: string; // decimal string 0.000000-1.000000
}

export type DistributionMethod =
	| 'ACADEMIC_10'
	| 'YEAR_ROUND_12'
	| 'CUSTOM_WEIGHTS'
	| 'SPECIFIC_PERIOD';

export interface OtherRevenueInput {
	lineItemName: string;
	annualAmount: string; // decimal string (can be negative for Bourses)
	distributionMethod: DistributionMethod;
	weightArray?: number[]; // 12 elements for CUSTOM_WEIGHTS
	specificMonths?: number[]; // month numbers 1-12 for SPECIFIC_PERIOD
	ifrsCategory: string;
}

export interface RevenueEngineInput {
	enrollmentDetail: EnrollmentDetailInput[];
	feeGrid: FeeGridInput[];
	discountPolicies: DiscountPolicyInput[];
	otherRevenue: OtherRevenueInput[];
}

// ---------------------------------------------------------------------------
// Output interfaces
// ---------------------------------------------------------------------------

export interface MonthlyRevenueOutput {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	month: number; // 1-12
	grossRevenueHt: string;
	discountAmount: string;
	netRevenueHt: string;
	vatAmount: string;
}

export interface OtherRevenueOutput {
	lineItemName: string;
	month: number;
	amount: string;
	ifrsCategory: string;
}

export interface RevenueEngineResult {
	tuitionRevenue: MonthlyRevenueOutput[];
	otherRevenue: OtherRevenueOutput[];
	totals: {
		totalRevenueHtAy1: string;
		totalRevenueHtAy2: string;
		totalAnnualRevenueHt: string;
	};
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AY1_MONTHS = [1, 2, 3, 4, 5, 6];
const AY2_MONTHS = [9, 10, 11, 12];
const ACADEMIC_MONTHS = [...AY1_MONTHS, ...AY2_MONTHS];
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const VAT_RATE = new Decimal('0.15');
const ZERO = new Decimal(0);

// ---------------------------------------------------------------------------
// Distribution helpers
// ---------------------------------------------------------------------------

/**
 * Distribute a total across specific months using the "last bucket" technique.
 * The last month receives the remainder so the sum exactly equals the total.
 * All intermediate values kept at full precision; only per-month amounts are
 * rounded to 4 decimal places (TC-004: round only at presentation layer).
 */
function distributeWithLastBucket(total: Decimal, months: number[]): Map<number, Decimal> {
	const result = new Map<number, Decimal>();

	if (months.length === 0) {
		return result;
	}

	const monthlyAmount = total.div(months.length).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
	let distributed = ZERO;

	for (let i = 0; i < months.length; i++) {
		if (i === months.length - 1) {
			// Last bucket gets the remainder to ensure exact sum
			result.set(months[i]!, total.minus(distributed));
		} else {
			result.set(months[i]!, monthlyAmount);
			distributed = distributed.plus(monthlyAmount);
		}
	}

	return result;
}

/**
 * Distribute a total across months using one of the supported methods.
 * Exported for direct use and testing.
 */
export function distributeAcrossMonths(
	total: Decimal,
	method: DistributionMethod,
	weightArray?: number[],
	specificMonths?: number[]
): Map<number, Decimal> {
	switch (method) {
		case 'ACADEMIC_10':
			return distributeWithLastBucket(total, ACADEMIC_MONTHS);

		case 'YEAR_ROUND_12':
			return distributeWithLastBucket(total, ALL_MONTHS);

		case 'CUSTOM_WEIGHTS': {
			if (!weightArray || weightArray.length !== 12) {
				throw new Error('CUSTOM_WEIGHTS requires a weightArray of exactly 12 elements');
			}
			const totalWeight = weightArray.reduce((acc, w) => acc.plus(new Decimal(w)), ZERO);
			if (totalWeight.isZero()) {
				throw new Error('CUSTOM_WEIGHTS: total weight must not be zero');
			}

			// Identify active months (non-zero weight)
			const activeMonths: number[] = [];
			const rawAmounts: Decimal[] = [];
			for (let i = 0; i < 12; i++) {
				const w = new Decimal(weightArray[i]!);
				if (!w.isZero()) {
					activeMonths.push(i + 1);
					rawAmounts.push(total.times(w).div(totalWeight));
				}
			}

			// Apply last-bucket to the weighted amounts so the sum is exact
			const result = new Map<number, Decimal>();
			let distributed = ZERO;
			for (let i = 0; i < activeMonths.length; i++) {
				if (i === activeMonths.length - 1) {
					result.set(activeMonths[i]!, total.minus(distributed));
				} else {
					const rounded = rawAmounts[i]!.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
					result.set(activeMonths[i]!, rounded);
					distributed = distributed.plus(rounded);
				}
			}
			return result;
		}

		case 'SPECIFIC_PERIOD': {
			if (!specificMonths || specificMonths.length === 0) {
				throw new Error('SPECIFIC_PERIOD requires a non-empty specificMonths array');
			}
			return distributeWithLastBucket(total, specificMonths);
		}
	}
}

// ---------------------------------------------------------------------------
// Discount resolution
// ---------------------------------------------------------------------------

/**
 * Find the applicable discount rate for a given (tariff, nationality) pair.
 * If multiple policies match, the HIGHEST discountRate wins.
 * A policy with nationality=null matches all nationalities.
 */
function resolveDiscountRate(
	policies: DiscountPolicyInput[],
	tariff: string,
	nationality: string
): Decimal {
	let highest = ZERO;

	for (const policy of policies) {
		const tariffMatch = policy.tariff === tariff;
		const nationalityMatch = policy.nationality === null || policy.nationality === nationality;

		if (tariffMatch && nationalityMatch) {
			const rate = new Decimal(policy.discountRate);
			if (rate.gt(highest)) {
				highest = rate;
			}
		}
	}

	return highest;
}

// ---------------------------------------------------------------------------
// Fee grid lookup
// ---------------------------------------------------------------------------

function buildFeeKey(
	gradeLevel: string,
	nationality: string,
	tariff: string,
	academicPeriod: string
): string {
	return `${gradeLevel}|${nationality}|${tariff}|${academicPeriod}`;
}

function buildFeeMap(feeGrid: FeeGridInput[]): Map<string, FeeGridInput> {
	const map = new Map<string, FeeGridInput>();
	for (const fee of feeGrid) {
		const key = buildFeeKey(fee.gradeLevel, fee.nationality, fee.tariff, fee.academicPeriod);
		map.set(key, fee);
	}
	return map;
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

/**
 * Calculate revenue from enrollment and fee data.
 * Pure function: all inputs are pre-loaded domain objects, no DB calls.
 *
 * TC-001: All monetary arithmetic uses Decimal.js
 * TC-004: Full-precision accumulation; round only at final output
 */
export function calculateRevenue(input: RevenueEngineInput): RevenueEngineResult {
	const feeMap = buildFeeMap(input.feeGrid);
	const tuitionRevenue: MonthlyRevenueOutput[] = [];

	// Full-precision accumulators for totals (TC-004)
	let totalAy1 = ZERO;
	let totalAy2 = ZERO;

	for (const enrollment of input.enrollmentDetail) {
		const feeKey = buildFeeKey(
			enrollment.gradeLevel,
			enrollment.nationality,
			enrollment.tariff,
			enrollment.academicPeriod
		);
		const fee = feeMap.get(feeKey);
		if (!fee) {
			throw new Error(
				`No fee grid entry for ${enrollment.gradeLevel}/${enrollment.nationality}` +
					`/${enrollment.tariff}/${enrollment.academicPeriod}`
			);
		}

		const headcount = new Decimal(enrollment.headcount);
		const tuitionHt = new Decimal(fee.tuitionHt);

		// Annual gross revenue for this segment
		const annualGrossHt = headcount.times(tuitionHt);

		// Resolve discount
		const discountRate = resolveDiscountRate(
			input.discountPolicies,
			enrollment.tariff,
			enrollment.nationality
		);
		const annualDiscountAmount = annualGrossHt.times(discountRate);
		const annualNetHt = annualGrossHt.minus(annualDiscountAmount);

		// Determine period months
		const periodMonths = enrollment.academicPeriod === 'AY1' ? AY1_MONTHS : AY2_MONTHS;

		// Distribute across months using last-bucket
		const grossDistribution = distributeWithLastBucket(annualGrossHt, periodMonths);
		const discountDistribution = distributeWithLastBucket(annualDiscountAmount, periodMonths);
		const netDistribution = distributeWithLastBucket(annualNetHt, periodMonths);

		// VAT: 0 for Nationaux, 15% for everyone else
		const isNationaux = enrollment.nationality === 'Nationaux';

		for (const month of periodMonths) {
			const grossMonth = grossDistribution.get(month)!;
			const discountMonth = discountDistribution.get(month)!;
			const netMonth = netDistribution.get(month)!;
			const vatMonth = isNationaux ? ZERO : netMonth.times(VAT_RATE);

			tuitionRevenue.push({
				academicPeriod: enrollment.academicPeriod,
				gradeLevel: enrollment.gradeLevel,
				nationality: enrollment.nationality,
				tariff: enrollment.tariff,
				month,
				grossRevenueHt: grossMonth.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				discountAmount: discountMonth.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				netRevenueHt: netMonth.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				vatAmount: vatMonth.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
			});
		}

		// Accumulate totals at full precision (TC-004)
		if (enrollment.academicPeriod === 'AY1') {
			totalAy1 = totalAy1.plus(annualNetHt);
		} else {
			totalAy2 = totalAy2.plus(annualNetHt);
		}
	}

	// Process other revenue
	const otherRevenueOutput: OtherRevenueOutput[] = [];
	for (const item of input.otherRevenue) {
		const annualAmount = new Decimal(item.annualAmount);
		const distribution = distributeAcrossMonths(
			annualAmount,
			item.distributionMethod,
			item.weightArray,
			item.specificMonths
		);

		for (const [month, amount] of distribution) {
			otherRevenueOutput.push({
				lineItemName: item.lineItemName,
				month,
				amount: amount.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				ifrsCategory: item.ifrsCategory,
			});
		}
	}

	const totalAnnual = totalAy1.plus(totalAy2);

	return {
		tuitionRevenue,
		otherRevenue: otherRevenueOutput,
		totals: {
			totalRevenueHtAy1: totalAy1.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
			totalRevenueHtAy2: totalAy2.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
			totalAnnualRevenueHt: totalAnnual.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
		},
	};
}
