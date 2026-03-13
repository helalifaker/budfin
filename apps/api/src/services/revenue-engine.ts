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
	grossRevenueHt: string; // workbook "Tuition Fees"
	discountAmount: string; // positive amount, workbook "Discount Impact"
	netRevenueHt: string; // workbook "Net Tuition"
	vatAmount: string;
}

export type ExecutiveRevenueCategory =
	| 'REGISTRATION_FEES'
	| 'ACTIVITIES_SERVICES'
	| 'EXAMINATION_FEES';

export interface OtherRevenueOutput {
	lineItemName: string;
	ifrsCategory: string;
	executiveCategory: ExecutiveRevenueCategory | null;
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
		totalExecutiveOtherRevenue: string;
		totalOperatingRevenue: string;
	};
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VAT_RATE = new Decimal('0.15');
const ZERO = new Decimal(0);
const ONE = new Decimal(1);
const ACADEMIC_MONTH_COUNT = new Decimal(10);

const AY1_MONTHS = [1, 2, 3, 4, 5, 6];
const AY2_MONTHS = [9, 10, 11, 12];
const ACADEMIC_MONTHS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12];

// ── Helper: Last-bucket rounding ──────────────────────────────────────────────

function distributeWithLastBucket(total: Decimal, months: number[]): Map<number, Decimal> {
	const result = new Map<number, Decimal>();

	if (months.length === 0) return result;

	const perMonth = total.div(months.length).toDecimalPlaces(4, Decimal.ROUND_DOWN);
	let allocated = ZERO;

	for (let i = 0; i < months.length; i++) {
		const month = months[i]!;
		if (i === months.length - 1) {
			result.set(month, total.minus(allocated));
		} else {
			result.set(month, perMonth);
			allocated = allocated.plus(perMonth);
		}
	}

	return result;
}

/**
 * The workbook recognises each academic year over 10 academic months.
 * FY2026 only sees the Jan-Jun portion of AY1 and Sep-Dec portion of AY2.
 */
function distributeAcademicYearAcrossFiscalMonths(
	totalAcademicYearAmount: Decimal,
	months: number[]
): Map<number, Decimal> {
	const result = new Map<number, Decimal>();

	if (months.length === 0) return result;

	const visibleTotal = totalAcademicYearAmount
		.mul(months.length)
		.div(ACADEMIC_MONTH_COUNT)
		.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
	const perAcademicMonth = totalAcademicYearAmount
		.div(ACADEMIC_MONTH_COUNT)
		.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

	let allocated = ZERO;
	for (let i = 0; i < months.length; i++) {
		const month = months[i]!;
		if (i === months.length - 1) {
			result.set(month, visibleTotal.minus(allocated));
		} else {
			result.set(month, perAcademicMonth);
			allocated = allocated.plus(perAcademicMonth);
		}
	}

	return result;
}

// ── Helper: Resolve discount rate ─────────────────────────────────────────────

function resolveDiscountRate(tariff: string, policies: DiscountPolicyInput[]): Decimal {
	let maxRate = ZERO;

	for (const policy of policies) {
		if (policy.tariff === tariff) {
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

function makePleinFeeKey(academicPeriod: string, gradeLevel: string, nationality: string): FeeKey {
	return makeFeeKey(academicPeriod, gradeLevel, nationality, 'Plein');
}

function resolveEffectiveTuitionAmounts(
	enrollment: EnrollmentDetailInput,
	fee: FeeGridInput,
	feeMap: Map<FeeKey, FeeGridInput>,
	discountPolicies: DiscountPolicyInput[]
): {
	tuitionFeesPerStudentHt: Decimal;
	discountPerStudentHt: Decimal;
	vatRate: Decimal;
} {
	const referencePleinFee =
		feeMap.get(
			makePleinFeeKey(enrollment.academicPeriod, enrollment.gradeLevel, enrollment.nationality)
		) ?? fee;

	const pleinTuitionHt = new Decimal(referencePleinFee.tuitionHt);
	const selectedTuitionHt = new Decimal(fee.tuitionHt);
	const discountRate = resolveDiscountRate(enrollment.tariff, discountPolicies);

	let tuitionFeesPerStudentHt = selectedTuitionHt;

	// Workbook parity:
	// - If tariff rows already store discounted tuition, use them directly.
	// - If non-Plein rows repeat Plein tuition, derive the effective tuition from the discount policy.
	if (
		enrollment.tariff !== 'Plein' &&
		selectedTuitionHt.eq(pleinTuitionHt) &&
		discountRate.gt(ZERO)
	) {
		tuitionFeesPerStudentHt = pleinTuitionHt.mul(ONE.minus(discountRate));
	}

	let discountPerStudentHt = pleinTuitionHt.minus(tuitionFeesPerStudentHt);
	if (discountPerStudentHt.lt(ZERO)) {
		discountPerStudentHt = ZERO;
	}

	return {
		tuitionFeesPerStudentHt,
		discountPerStudentHt,
		vatRate: enrollment.nationality === 'Nationaux' ? ZERO : VAT_RATE,
	};
}

function resolveExecutiveCategory(item: OtherRevenueInput): ExecutiveRevenueCategory | null {
	if (item.ifrsCategory === 'Registration Fees') {
		return 'REGISTRATION_FEES';
	}

	if (item.ifrsCategory === 'Activities & Services') {
		return item.lineItemName === 'PSG Academy Rental' ? null : 'ACTIVITIES_SERVICES';
	}

	if (item.ifrsCategory === 'Examination Fees') {
		return 'EXAMINATION_FEES';
	}

	return null;
}

function shouldDoubleCountInExecutiveSummary(item: OtherRevenueInput): boolean {
	return item.lineItemName.startsWith('Evaluation');
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

			const totalWeight = weightArray.reduce(
				(sum, weight) => sum.plus(new Decimal(weight ?? 0)),
				ZERO
			);

			if (totalWeight.lte(ZERO)) {
				throw new Error('CUSTOM_WEIGHTS requires a positive total weight');
			}

			const lastWeightedIndex = [...weightArray].reverse().findIndex((weight) => (weight ?? 0) > 0);
			const lastMonthIndex = lastWeightedIndex === -1 ? -1 : 11 - lastWeightedIndex;

			if (lastMonthIndex === -1) {
				throw new Error('CUSTOM_WEIGHTS requires at least one positive weight');
			}

			const result = new Map<number, Decimal>();
			let allocated = ZERO;

			for (let i = 0; i < 12; i++) {
				const month = i + 1;
				const weight = new Decimal(weightArray[i] ?? 0);

				if (weight.lte(ZERO)) {
					result.set(month, ZERO);
					continue;
				}

				if (i === lastMonthIndex) {
					result.set(month, total.minus(allocated));
				} else {
					const normalizedWeight = weight.div(totalWeight);
					const amount = total.mul(normalizedWeight).toDecimalPlaces(4, Decimal.ROUND_DOWN);
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
			throw new Error(`Unknown distribution method: ${method satisfies never}`);
	}
}

// ── Public: Main calculation ──────────────────────────────────────────────────

export function calculateRevenue(input: RevenueEngineInput): RevenueEngineResult {
	const { enrollmentDetails, feeGrid, discountPolicies, otherRevenueItems } = input;

	const feeMap = buildFeeMap(feeGrid);
	const tuitionRevenue: MonthlyRevenueOutput[] = [];

	let totalTuitionFeesHt = ZERO;
	let totalDiscounts = ZERO;
	let totalNetTuitionHt = ZERO;
	let totalVat = ZERO;

	for (const enrollment of enrollmentDetails) {
		if (enrollment.headcount <= 0) continue;

		const feeKey = makeFeeKey(
			enrollment.academicPeriod,
			enrollment.gradeLevel,
			enrollment.nationality,
			enrollment.tariff
		);
		const fee =
			feeMap.get(feeKey) ??
			feeMap.get(
				makePleinFeeKey(enrollment.academicPeriod, enrollment.gradeLevel, enrollment.nationality)
			);

		if (!fee) {
			continue;
		}

		const headcount = new Decimal(enrollment.headcount);
		const months = enrollment.academicPeriod === 'AY1' ? AY1_MONTHS : AY2_MONTHS;
		const { tuitionFeesPerStudentHt, discountPerStudentHt, vatRate } =
			resolveEffectiveTuitionAmounts(enrollment, fee, feeMap, discountPolicies);

		const academicYearTuitionFees = headcount.mul(tuitionFeesPerStudentHt);
		const academicYearDiscounts = headcount.mul(discountPerStudentHt);
		const academicYearNetTuition = academicYearTuitionFees.minus(academicYearDiscounts);
		const academicYearVat = academicYearTuitionFees.mul(vatRate);

		const tuitionFeesPerMonth = distributeAcademicYearAcrossFiscalMonths(
			academicYearTuitionFees,
			months
		);
		const discountPerMonth = distributeAcademicYearAcrossFiscalMonths(
			academicYearDiscounts,
			months
		);
		const netPerMonth = distributeAcademicYearAcrossFiscalMonths(academicYearNetTuition, months);
		const vatPerMonth = distributeAcademicYearAcrossFiscalMonths(academicYearVat, months);

		for (const month of months) {
			const grossM = tuitionFeesPerMonth.get(month) ?? ZERO;
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

			totalTuitionFeesHt = totalTuitionFeesHt.plus(grossM);
			totalDiscounts = totalDiscounts.plus(discountM);
			totalNetTuitionHt = totalNetTuitionHt.plus(netM);
			totalVat = totalVat.plus(vatM);
		}
	}

	const otherRevenue: OtherRevenueOutput[] = [];
	let totalOtherRevenue = ZERO;
	let totalExecutiveOtherRevenue = ZERO;

	for (const item of otherRevenueItems) {
		const annualAmount = new Decimal(item.annualAmount);
		const monthlyDistribution = distributeAcrossMonths(
			annualAmount,
			item.distributionMethod,
			item.weightArray,
			item.specificMonths
		);
		const executiveCategory = resolveExecutiveCategory(item);

		for (const [month, amount] of monthlyDistribution) {
			if (amount.isZero()) {
				continue;
			}

			otherRevenue.push({
				lineItemName: item.lineItemName,
				ifrsCategory: item.ifrsCategory,
				executiveCategory,
				month,
				amount: amount.toFixed(4),
			});

			totalOtherRevenue = totalOtherRevenue.plus(amount);
			if (executiveCategory !== null) {
				totalExecutiveOtherRevenue = totalExecutiveOtherRevenue.plus(amount);
				if (shouldDoubleCountInExecutiveSummary(item)) {
					totalExecutiveOtherRevenue = totalExecutiveOtherRevenue.plus(amount);
				}
			}
		}
	}

	return {
		tuitionRevenue,
		otherRevenue,
		totals: {
			grossRevenueHt: totalTuitionFeesHt.toFixed(4),
			totalDiscounts: totalDiscounts.toFixed(4),
			netRevenueHt: totalNetTuitionHt.toFixed(4),
			totalVat: totalVat.toFixed(4),
			totalOtherRevenue: totalOtherRevenue.toFixed(4),
			totalExecutiveOtherRevenue: totalExecutiveOtherRevenue.toFixed(4),
			totalOperatingRevenue: totalNetTuitionHt.plus(totalExecutiveOtherRevenue).toFixed(4),
		},
	};
}
