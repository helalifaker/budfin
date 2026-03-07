import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	calculateRevenue,
	distributeAcrossMonths,
	type EnrollmentDetailInput,
	type FeeGridInput,
	type DiscountPolicyInput,
	type RevenueEngineInput,
} from './revenue-engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFee(overrides: Partial<FeeGridInput> = {}): FeeGridInput {
	return {
		gradeLevel: 'PS',
		nationality: 'Francais',
		tariff: 'Plein',
		academicPeriod: 'AY1',
		tuitionTtc: '46000.0000',
		tuitionHt: '40000.0000',
		dai: '5000.0000',
		registrationFee: '3000.0000',
		reRegistrationFee: '2000.0000',
		insuranceFee: '500.0000',
		...overrides,
	};
}

function makeEnrollment(overrides: Partial<EnrollmentDetailInput> = {}): EnrollmentDetailInput {
	return {
		gradeLevel: 'PS',
		nationality: 'Francais',
		tariff: 'Plein',
		academicPeriod: 'AY1',
		headcount: 10,
		...overrides,
	};
}

function makeInput(overrides: Partial<RevenueEngineInput> = {}): RevenueEngineInput {
	return {
		enrollmentDetail: [makeEnrollment()],
		feeGrid: [makeFee()],
		discountPolicies: [],
		otherRevenue: [],
		...overrides,
	};
}

/**
 * Sum all monthly values for a given field from revenue rows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumField(rows: any[], field: string): Decimal {
	return rows.reduce(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(acc: Decimal, row: any) => acc.plus(new Decimal(row[field] as string)),
		new Decimal(0)
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('calculateRevenue', () => {
	describe('basic tuition revenue — single grade, single period, no discounts', () => {
		it('distributes tuition across AY1 months 1-6 with last-bucket rounding', () => {
			const input = makeInput();
			const result = calculateRevenue(input);

			// 10 students * 40000 HT = 400000 annual gross
			// No discount → net = 400000
			// Distributed over 6 months: 400000 / 6 = 66666.6667 per month
			// Last month gets remainder: 400000 - 5 * 66666.6667 = 66666.6665
			expect(result.tuitionRevenue).toHaveLength(6);

			const months = result.tuitionRevenue.map((r) => r.month);
			expect(months).toEqual([1, 2, 3, 4, 5, 6]);

			// First 5 months: 66666.6667
			for (let i = 0; i < 5; i++) {
				expect(result.tuitionRevenue[i]!.grossRevenueHt).toBe('66666.6667');
				expect(result.tuitionRevenue[i]!.netRevenueHt).toBe('66666.6667');
				expect(result.tuitionRevenue[i]!.discountAmount).toBe('0.0000');
			}

			// Last month (6): remainder = 400000 - 5 * 66666.6667 = 66666.6665
			expect(result.tuitionRevenue[5]!.grossRevenueHt).toBe('66666.6665');
			expect(result.tuitionRevenue[5]!.netRevenueHt).toBe('66666.6665');

			// Total must exactly equal 400000
			const totalGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			expect(totalGross.toFixed(4)).toBe('400000.0000');
		});
	});

	describe('VAT treatment', () => {
		it('charges zero VAT for Nationaux nationality', () => {
			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ nationality: 'Nationaux' })],
				feeGrid: [makeFee({ nationality: 'Nationaux' })],
			});
			const result = calculateRevenue(input);

			for (const row of result.tuitionRevenue) {
				expect(row.vatAmount).toBe('0.0000');
			}
		});

		it('charges 15% VAT for Francais nationality', () => {
			const input = makeInput();
			const result = calculateRevenue(input);

			// Net per month (first 5) = 66666.6667, VAT = 66666.6667 * 0.15 = 10000.0000
			for (let i = 0; i < 5; i++) {
				const row = result.tuitionRevenue[i]!;
				const expectedVat = new Decimal(row.netRevenueHt)
					.times('0.15')
					.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
				expect(row.vatAmount).toBe(expectedVat.toFixed(4));
			}
		});

		it('charges 15% VAT for Autres nationality', () => {
			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ nationality: 'Autres' })],
				feeGrid: [makeFee({ nationality: 'Autres' })],
			});
			const result = calculateRevenue(input);

			for (const row of result.tuitionRevenue) {
				const expectedVat = new Decimal(row.netRevenueHt)
					.times('0.15')
					.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
				expect(row.vatAmount).toBe(expectedVat.toFixed(4));
			}
		});
	});

	describe('discount application', () => {
		it('applies 25% discount correctly', () => {
			const discountPolicies: DiscountPolicyInput[] = [
				{ tariff: 'RP', nationality: null, discountRate: '0.25' },
			];

			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ tariff: 'RP', headcount: 10 })],
				feeGrid: [makeFee({ tariff: 'RP' })],
				discountPolicies,
			});
			const result = calculateRevenue(input);

			// Gross = 10 * 40000 = 400000
			// Discount = 400000 * 0.25 = 100000
			// Net = 300000
			const totalGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			const totalDiscount = sumField(result.tuitionRevenue, 'discountAmount');
			const totalNet = sumField(result.tuitionRevenue, 'netRevenueHt');

			expect(totalGross.toFixed(4)).toBe('400000.0000');
			expect(totalDiscount.toFixed(4)).toBe('100000.0000');
			expect(totalNet.toFixed(4)).toBe('300000.0000');
		});
	});

	describe('highest discount wins', () => {
		it('applies the higher of two matching discount rates', () => {
			const discountPolicies: DiscountPolicyInput[] = [
				{ tariff: 'RP', nationality: 'Francais', discountRate: '0.10' },
				{ tariff: 'RP', nationality: null, discountRate: '0.25' },
			];

			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ tariff: 'RP' })],
				feeGrid: [makeFee({ tariff: 'RP' })],
				discountPolicies,
			});
			const result = calculateRevenue(input);

			// Should use 25% (higher), not 10%
			// Gross = 400000, Discount = 100000, Net = 300000
			const totalDiscount = sumField(result.tuitionRevenue, 'discountAmount');
			expect(totalDiscount.toFixed(4)).toBe('100000.0000');
		});

		it('does not apply discount for non-matching tariff', () => {
			const discountPolicies: DiscountPolicyInput[] = [
				{ tariff: 'RP', nationality: null, discountRate: '0.25' },
			];

			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ tariff: 'Plein' })],
				feeGrid: [makeFee({ tariff: 'Plein' })],
				discountPolicies,
			});
			const result = calculateRevenue(input);

			const totalDiscount = sumField(result.tuitionRevenue, 'discountAmount');
			expect(totalDiscount.toFixed(4)).toBe('0.0000');
		});
	});

	describe('summer months zero', () => {
		it('produces no revenue rows for months 7-8', () => {
			// Test both AY1 and AY2
			const input = makeInput({
				enrollmentDetail: [
					makeEnrollment({ academicPeriod: 'AY1' }),
					makeEnrollment({ academicPeriod: 'AY2' }),
				],
				feeGrid: [makeFee({ academicPeriod: 'AY1' }), makeFee({ academicPeriod: 'AY2' })],
			});
			const result = calculateRevenue(input);

			const summerRows = result.tuitionRevenue.filter((r) => r.month === 7 || r.month === 8);
			expect(summerRows).toHaveLength(0);
		});
	});

	describe('AY2 distribution', () => {
		it('distributes tuition across months 9-12 only', () => {
			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ academicPeriod: 'AY2' })],
				feeGrid: [makeFee({ academicPeriod: 'AY2' })],
			});
			const result = calculateRevenue(input);

			expect(result.tuitionRevenue).toHaveLength(4);
			const months = result.tuitionRevenue.map((r) => r.month);
			expect(months).toEqual([9, 10, 11, 12]);

			// 400000 / 4 = 100000 exactly — no rounding needed
			for (const row of result.tuitionRevenue) {
				expect(row.grossRevenueHt).toBe('100000.0000');
			}
		});
	});

	describe('last bucket rounding correctness', () => {
		it('ensures sum of monthly gross equals annual gross exactly', () => {
			// Use a headcount that creates non-trivial rounding
			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ headcount: 7 })],
			});
			const result = calculateRevenue(input);

			// 7 * 40000 = 280000
			const totalGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			expect(totalGross.toFixed(4)).toBe('280000.0000');

			const totalNet = sumField(result.tuitionRevenue, 'netRevenueHt');
			expect(totalNet.toFixed(4)).toBe('280000.0000');
		});

		it('last bucket absorbs rounding difference for odd divisions', () => {
			// 100000 / 6 = 16666.6667 * 5 = 83333.3335, last = 16666.6665
			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ headcount: 1 })],
				feeGrid: [makeFee({ tuitionHt: '100000.0000' })],
			});
			const result = calculateRevenue(input);

			// First 5 months
			for (let i = 0; i < 5; i++) {
				expect(result.tuitionRevenue[i]!.grossRevenueHt).toBe('16666.6667');
			}
			// Last month
			expect(result.tuitionRevenue[5]!.grossRevenueHt).toBe('16666.6665');

			const total = sumField(result.tuitionRevenue, 'grossRevenueHt');
			expect(total.toFixed(4)).toBe('100000.0000');
		});
	});

	describe('other revenue — ACADEMIC_10', () => {
		it('distributes across 10 academic months, zero for Jul-Aug', () => {
			const input = makeInput({
				enrollmentDetail: [],
				feeGrid: [],
				otherRevenue: [
					{
						lineItemName: 'Cantine',
						annualAmount: '100000.0000',
						distributionMethod: 'ACADEMIC_10',
						ifrsCategory: 'Services',
					},
				],
			});
			const result = calculateRevenue(input);

			// Should have 10 months (1-6, 9-12)
			expect(result.otherRevenue).toHaveLength(10);

			const months = result.otherRevenue.map((r) => r.month).sort((a, b) => a - b);
			expect(months).toEqual([1, 2, 3, 4, 5, 6, 9, 10, 11, 12]);

			// No July or August
			const summerRows = result.otherRevenue.filter((r) => r.month === 7 || r.month === 8);
			expect(summerRows).toHaveLength(0);

			// Sum must equal annual amount
			const total = result.otherRevenue.reduce(
				(acc, r) => acc.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('100000.0000');

			// First 9 months: 100000/10 = 10000.0000 exactly
			for (let i = 0; i < 9; i++) {
				expect(result.otherRevenue[i]!.amount).toBe('10000.0000');
			}
		});
	});

	describe('other revenue — CUSTOM_WEIGHTS', () => {
		it('distributes according to custom weight array', () => {
			// Only allocate to Q1 with weights [3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
			const input = makeInput({
				enrollmentDetail: [],
				feeGrid: [],
				otherRevenue: [
					{
						lineItemName: 'Project Revenue',
						annualAmount: '60000.0000',
						distributionMethod: 'CUSTOM_WEIGHTS',
						weightArray: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
						ifrsCategory: 'Project',
					},
				],
			});
			const result = calculateRevenue(input);

			// Only 3 months active (Jan, Feb, Mar)
			expect(result.otherRevenue).toHaveLength(3);

			// Weight total = 6
			// Jan: 60000 * 3/6 = 30000
			// Feb: 60000 * 2/6 = 20000
			// Mar: remainder = 60000 - 30000 - 20000 = 10000
			const jan = result.otherRevenue.find((r) => r.month === 1);
			const feb = result.otherRevenue.find((r) => r.month === 2);
			const mar = result.otherRevenue.find((r) => r.month === 3);

			expect(jan!.amount).toBe('30000.0000');
			expect(feb!.amount).toBe('20000.0000');
			expect(mar!.amount).toBe('10000.0000');

			const total = result.otherRevenue.reduce(
				(acc, r) => acc.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('60000.0000');
		});

		it('throws if weightArray has wrong length', () => {
			expect(() =>
				distributeAcrossMonths(
					new Decimal(1000),
					'CUSTOM_WEIGHTS',
					[1, 2, 3] // only 3 elements
				)
			).toThrow('CUSTOM_WEIGHTS requires a weightArray of exactly 12 elements');
		});
	});

	describe('other revenue — SPECIFIC_PERIOD', () => {
		it('distributes only to specified months', () => {
			const input = makeInput({
				enrollmentDetail: [],
				feeGrid: [],
				otherRevenue: [
					{
						lineItemName: 'Annual Event',
						annualAmount: '30000.0000',
						distributionMethod: 'SPECIFIC_PERIOD',
						specificMonths: [3, 9],
						ifrsCategory: 'Events',
					},
				],
			});
			const result = calculateRevenue(input);

			expect(result.otherRevenue).toHaveLength(2);
			const months = result.otherRevenue.map((r) => r.month).sort((a, b) => a - b);
			expect(months).toEqual([3, 9]);

			// 30000 / 2 = 15000 each
			for (const row of result.otherRevenue) {
				expect(row.amount).toBe('15000.0000');
			}
		});
	});

	describe('other revenue — YEAR_ROUND_12', () => {
		it('distributes equally across all 12 months', () => {
			const input = makeInput({
				enrollmentDetail: [],
				feeGrid: [],
				otherRevenue: [
					{
						lineItemName: 'Rent Income',
						annualAmount: '120000.0000',
						distributionMethod: 'YEAR_ROUND_12',
						ifrsCategory: 'Rental',
					},
				],
			});
			const result = calculateRevenue(input);

			expect(result.otherRevenue).toHaveLength(12);

			// 120000 / 12 = 10000 exactly
			for (const row of result.otherRevenue) {
				expect(row.amount).toBe('10000.0000');
			}

			const total = result.otherRevenue.reduce(
				(acc, r) => acc.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('120000.0000');
		});

		it('handles non-divisible amounts with last-bucket', () => {
			const input = makeInput({
				enrollmentDetail: [],
				feeGrid: [],
				otherRevenue: [
					{
						lineItemName: 'Misc',
						annualAmount: '100000.0000',
						distributionMethod: 'YEAR_ROUND_12',
						ifrsCategory: 'Other',
					},
				],
			});
			const result = calculateRevenue(input);

			// 100000 / 12 = 8333.3333 (rounded)
			// First 11: 8333.3333 * 11 = 91666.6663
			// Last: 100000 - 91666.6663 = 8333.3337
			expect(result.otherRevenue[0]!.amount).toBe('8333.3333');
			expect(result.otherRevenue[11]!.amount).toBe('8333.3337');

			const total = result.otherRevenue.reduce(
				(acc, r) => acc.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('100000.0000');
		});
	});

	describe('empty inputs', () => {
		it('returns empty result when no enrollment detail', () => {
			const input = makeInput({
				enrollmentDetail: [],
				feeGrid: [],
				otherRevenue: [],
			});
			const result = calculateRevenue(input);

			expect(result.tuitionRevenue).toHaveLength(0);
			expect(result.otherRevenue).toHaveLength(0);
			expect(result.totals.totalRevenueHtAy1).toBe('0.0000');
			expect(result.totals.totalRevenueHtAy2).toBe('0.0000');
			expect(result.totals.totalAnnualRevenueHt).toBe('0.0000');
		});
	});

	describe('negative other revenue (Bourses)', () => {
		it('distributes negative amounts correctly', () => {
			const input = makeInput({
				enrollmentDetail: [],
				feeGrid: [],
				otherRevenue: [
					{
						lineItemName: 'Bourses AEFE',
						annualAmount: '-50000.0000',
						distributionMethod: 'ACADEMIC_10',
						ifrsCategory: 'Scholarships',
					},
				],
			});
			const result = calculateRevenue(input);

			expect(result.otherRevenue).toHaveLength(10);

			// -50000 / 10 = -5000 each
			for (const row of result.otherRevenue) {
				expect(row.amount).toBe('-5000.0000');
			}

			const total = result.otherRevenue.reduce(
				(acc, r) => acc.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('-50000.0000');
		});
	});

	describe('totals', () => {
		it('correctly separates AY1 and AY2 totals', () => {
			const input = makeInput({
				enrollmentDetail: [
					makeEnrollment({ academicPeriod: 'AY1', headcount: 10 }),
					makeEnrollment({ academicPeriod: 'AY2', headcount: 5 }),
				],
				feeGrid: [makeFee({ academicPeriod: 'AY1' }), makeFee({ academicPeriod: 'AY2' })],
			});
			const result = calculateRevenue(input);

			// AY1: 10 * 40000 = 400000
			// AY2: 5 * 40000 = 200000
			expect(result.totals.totalRevenueHtAy1).toBe('400000.0000');
			expect(result.totals.totalRevenueHtAy2).toBe('200000.0000');
			expect(result.totals.totalAnnualRevenueHt).toBe('600000.0000');
		});
	});

	describe('fee grid lookup error', () => {
		it('throws when fee grid entry is missing', () => {
			const input = makeInput({
				enrollmentDetail: [makeEnrollment({ gradeLevel: 'CM2' })],
				feeGrid: [makeFee({ gradeLevel: 'PS' })], // mismatch
			});

			expect(() => calculateRevenue(input)).toThrow('No fee grid entry for CM2');
		});
	});
});

describe('distributeAcrossMonths', () => {
	it('SPECIFIC_PERIOD throws on empty months array', () => {
		expect(() =>
			distributeAcrossMonths(new Decimal(1000), 'SPECIFIC_PERIOD', undefined, [])
		).toThrow('SPECIFIC_PERIOD requires a non-empty specificMonths array');
	});

	it('CUSTOM_WEIGHTS throws on zero total weight', () => {
		expect(() =>
			distributeAcrossMonths(
				new Decimal(1000),
				'CUSTOM_WEIGHTS',
				[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
			)
		).toThrow('CUSTOM_WEIGHTS: total weight must not be zero');
	});
});
