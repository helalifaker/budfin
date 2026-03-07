import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	calculateRevenue,
	distributeAcrossMonths,
	type EnrollmentDetailInput,
	type FeeGridInput,
	type RevenueEngineInput,
	type MonthlyRevenueOutput,
} from './revenue-engine.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFee(overrides: Partial<FeeGridInput> = {}): FeeGridInput {
	return {
		academicPeriod: 'AY1',
		gradeLevel: 'CP',
		nationality: 'Francais',
		tariff: 'Plein',
		tuitionTtc: '60000.0000',
		tuitionHt: '52173.9130',
		dai: '5000.0000',
		...overrides,
	};
}

function makeEnrollment(overrides: Partial<EnrollmentDetailInput> = {}): EnrollmentDetailInput {
	return {
		academicPeriod: 'AY1',
		gradeLevel: 'CP',
		nationality: 'Francais',
		tariff: 'Plein',
		headcount: 20,
		...overrides,
	};
}

function makeInput(overrides: Partial<RevenueEngineInput> = {}): RevenueEngineInput {
	return {
		enrollmentDetails: [makeEnrollment()],
		feeGrid: [makeFee()],
		discountPolicies: [],
		otherRevenueItems: [],
		...overrides,
	};
}

function sumField(rows: MonthlyRevenueOutput[], field: keyof MonthlyRevenueOutput): Decimal {
	return rows.reduce((sum, row) => sum.plus(new Decimal(row[field] as string)), new Decimal(0));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Revenue Engine', () => {
	describe('Basic Tuition Calculation', () => {
		it('should calculate FY-recognized tuition for AY1 over 6 visible fiscal months', () => {
			const result = calculateRevenue(makeInput());

			// 20 students * 52173.9130 HT = 1,043,478.2600 academic-year tuition.
			// The workbook recognises AY1 over 10 academic months, of which FY2026 only sees Jan-Jun.
			expect(result.tuitionRevenue).toHaveLength(6);
			expect(result.tuitionRevenue.every((r) => r.academicPeriod === 'AY1')).toBe(true);
			expect(result.tuitionRevenue.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6]);

			const totalGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			expect(totalGross.toFixed(4)).toBe('626086.9560');
		});

		it('should calculate monthly tuition for AY2 (4 months)', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ academicPeriod: 'AY2' })],
					feeGrid: [makeFee({ academicPeriod: 'AY2' })],
				})
			);

			expect(result.tuitionRevenue).toHaveLength(4);
			expect(result.tuitionRevenue.map((r) => r.month)).toEqual([9, 10, 11, 12]);
		});

		it('should produce zero revenue for summer months (7-8)', () => {
			const result = calculateRevenue(makeInput());
			const summerMonths = result.tuitionRevenue.filter((r) => r.month === 7 || r.month === 8);
			expect(summerMonths).toHaveLength(0);
		});
	});

	describe('VAT Treatment', () => {
		it('should apply 0% VAT for Nationaux students', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ nationality: 'Nationaux' })],
					feeGrid: [
						makeFee({
							nationality: 'Nationaux',
							tuitionTtc: '50000.0000',
							tuitionHt: '50000.0000',
						}),
					],
				})
			);

			const totalVat = sumField(result.tuitionRevenue, 'vatAmount');
			expect(totalVat.toFixed(4)).toBe('0.0000');
		});

		it('should apply 15% VAT for Francais students', () => {
			const result = calculateRevenue(makeInput());
			const totalNet = sumField(result.tuitionRevenue, 'netRevenueHt');
			const totalVat = sumField(result.tuitionRevenue, 'vatAmount');

			// VAT = netHT * 0.15
			const expectedVat = totalNet.mul(new Decimal('0.15'));
			expect(totalVat.toFixed(4)).toBe(expectedVat.toFixed(4));
		});

		it('should apply 15% VAT for Autres students', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ nationality: 'Autres' })],
					feeGrid: [makeFee({ nationality: 'Autres' })],
				})
			);

			const totalNet = sumField(result.tuitionRevenue, 'netRevenueHt');
			const totalVat = sumField(result.tuitionRevenue, 'vatAmount');
			const expectedVat = totalNet.mul(new Decimal('0.15'));
			expect(totalVat.toFixed(4)).toBe(expectedVat.toFixed(4));
		});
	});

	describe('Discount Application', () => {
		it('should apply discount rate to gross revenue', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ tariff: 'RP' })],
					feeGrid: [makeFee({ tariff: 'RP' })],
					discountPolicies: [{ tariff: 'RP', nationality: 'Francais', discountRate: '0.250000' }],
				})
			);

			const totalGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			const totalDiscount = sumField(result.tuitionRevenue, 'discountAmount');
			const potentialRevenue = totalGross.plus(totalDiscount);
			const expectedDiscount = potentialRevenue.mul(new Decimal('0.25'));
			expect(totalDiscount.toFixed(4)).toBe(expectedDiscount.toFixed(4));
		});

		it('should apply highest discount when multiple policies match (SA-006)', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ tariff: 'RP' })],
					feeGrid: [makeFee({ tariff: 'RP' })],
					discountPolicies: [
						// Exact match: RP + Francais = 20%
						{ tariff: 'RP', nationality: 'Francais', discountRate: '0.200000' },
						// Wildcard match: RP + null = 30% — should win
						{ tariff: 'RP', nationality: null, discountRate: '0.300000' },
					],
				})
			);

			const totalGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			const totalDiscount = sumField(result.tuitionRevenue, 'discountAmount');
			const potentialRevenue = totalGross.plus(totalDiscount);
			const expectedDiscount = potentialRevenue.mul(new Decimal('0.30'));
			expect(totalDiscount.toFixed(4)).toBe(expectedDiscount.toFixed(4));
		});

		it('should apply no discount for Plein tariff', () => {
			const result = calculateRevenue(
				makeInput({
					discountPolicies: [{ tariff: 'RP', nationality: null, discountRate: '0.300000' }],
				})
			);

			const totalDiscount = sumField(result.tuitionRevenue, 'discountAmount');
			expect(totalDiscount.toFixed(4)).toBe('0.0000');
		});
	});

	describe('Last-Bucket Rounding', () => {
		it('should ensure FY-recognized amounts sum exactly to the AY1 fiscal-year share', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ headcount: 7 })],
				})
			);

			// 7 * 52173.9130 = 365217.3910 academic-year tuition HT.
			// FY2026 recognises 6/10 of that amount.
			const totalGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			expect(totalGross.toFixed(4)).toBe('219130.4346');
		});

		it('should ensure FY-recognized amounts sum exactly to the AY2 fiscal-year share', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ academicPeriod: 'AY2', headcount: 7 })],
					feeGrid: [makeFee({ academicPeriod: 'AY2' })],
				})
			);

			const totalGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			expect(totalGross.toFixed(4)).toBe('146086.9564');
		});
	});

	describe('Other Revenue Distribution', () => {
		it('should distribute ACADEMIC_10 across 10 academic months', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [],
					feeGrid: [],
					otherRevenueItems: [
						{
							lineItemName: 'Cantine',
							annualAmount: '100000.0000',
							distributionMethod: 'ACADEMIC_10',
							ifrsCategory: 'OTHER_OPERATING_INCOME',
						},
					],
				})
			);

			expect(result.otherRevenue).toHaveLength(10);
			// No Jul (7) or Aug (8)
			expect(result.otherRevenue.every((r) => r.month !== 7 && r.month !== 8)).toBe(true);

			const total = result.otherRevenue.reduce(
				(sum, r) => sum.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('100000.0000');
		});

		it('should distribute YEAR_ROUND_12 across all 12 months', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [],
					feeGrid: [],
					otherRevenueItems: [
						{
							lineItemName: 'Rent Income',
							annualAmount: '120000.0000',
							distributionMethod: 'YEAR_ROUND_12',
							ifrsCategory: 'OTHER_OPERATING_INCOME',
						},
					],
				})
			);

			expect(result.otherRevenue).toHaveLength(12);
			const total = result.otherRevenue.reduce(
				(sum, r) => sum.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('120000.0000');
		});

		it('should distribute CUSTOM_WEIGHTS using provided weights', () => {
			// 50% in month 1, 50% in month 9, rest 0
			const weights = [0.5, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0];
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [],
					feeGrid: [],
					otherRevenueItems: [
						{
							lineItemName: 'DAI Revenue',
							annualAmount: '200000.0000',
							distributionMethod: 'CUSTOM_WEIGHTS',
							weightArray: weights,
							ifrsCategory: 'REVENUE_FROM_CONTRACTS',
						},
					],
				})
			);

			// Only non-zero months should appear
			const nonZero = result.otherRevenue.filter((r) => !new Decimal(r.amount).isZero());
			expect(nonZero).toHaveLength(2);
			expect(nonZero[0]!.month).toBe(1);
			expect(nonZero[0]!.amount).toBe('100000.0000');
			// Month 9 gets the last-bucket remainder
			expect(nonZero[1]!.month).toBe(9);
		});

		it('should distribute SPECIFIC_PERIOD to specified months only', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [],
					feeGrid: [],
					otherRevenueItems: [
						{
							lineItemName: 'AEFE Subvention',
							annualAmount: '90000.0000',
							distributionMethod: 'SPECIFIC_PERIOD',
							specificMonths: [3, 6, 9],
							ifrsCategory: 'OTHER_OPERATING_INCOME',
						},
					],
				})
			);

			expect(result.otherRevenue).toHaveLength(3);
			expect(result.otherRevenue.map((r) => r.month)).toEqual([3, 6, 9]);

			const total = result.otherRevenue.reduce(
				(sum, r) => sum.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('90000.0000');
		});

		it('should handle negative amounts (Social Aid / Bourses)', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [],
					feeGrid: [],
					otherRevenueItems: [
						{
							lineItemName: 'Bourses AEFE',
							annualAmount: '-50000.0000',
							distributionMethod: 'ACADEMIC_10',
							ifrsCategory: 'REVENUE_FROM_CONTRACTS',
						},
					],
				})
			);

			const total = result.otherRevenue.reduce(
				(sum, r) => sum.plus(new Decimal(r.amount)),
				new Decimal(0)
			);
			expect(total.toFixed(4)).toBe('-50000.0000');
		});
	});

	describe('Empty / Edge Cases', () => {
		it('should return empty results for empty inputs', () => {
			const result = calculateRevenue({
				enrollmentDetails: [],
				feeGrid: [],
				discountPolicies: [],
				otherRevenueItems: [],
			});

			expect(result.tuitionRevenue).toHaveLength(0);
			expect(result.otherRevenue).toHaveLength(0);
			expect(result.totals.grossRevenueHt).toBe('0.0000');
		});

		it('should skip enrollment rows with headcount=0', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ headcount: 0 })],
				})
			);

			expect(result.tuitionRevenue).toHaveLength(0);
		});

		it('should skip enrollment rows with no matching fee grid entry (SA-010)', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [makeEnrollment({ gradeLevel: 'PS' })],
					// Fee grid only has CP, not PS
					feeGrid: [makeFee({ gradeLevel: 'CP' })],
				})
			);

			expect(result.tuitionRevenue).toHaveLength(0);
		});

		it('should handle multiple enrollment segments and produce separate rows', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [
						makeEnrollment({ gradeLevel: 'CP', nationality: 'Francais', headcount: 10 }),
						makeEnrollment({ gradeLevel: 'CP', nationality: 'Nationaux', headcount: 5 }),
					],
					feeGrid: [
						makeFee({ nationality: 'Francais' }),
						makeFee({
							nationality: 'Nationaux',
							tuitionTtc: '50000.0000',
							tuitionHt: '50000.0000',
						}),
					],
				})
			);

			// 6 months * 2 segments = 12 rows
			expect(result.tuitionRevenue).toHaveLength(12);

			// Nationaux should have 0 VAT
			const nationauxRows = result.tuitionRevenue.filter((r) => r.nationality === 'Nationaux');
			const nationauxVat = nationauxRows.reduce(
				(sum, r) => sum.plus(new Decimal(r.vatAmount)),
				new Decimal(0)
			);
			expect(nationauxVat.toFixed(4)).toBe('0.0000');
		});
	});

	describe('Totals', () => {
		it('should compute correct totals across all segments', () => {
			const result = calculateRevenue(
				makeInput({
					enrollmentDetails: [
						makeEnrollment({ headcount: 10 }),
						makeEnrollment({ academicPeriod: 'AY2', headcount: 10 }),
					],
					feeGrid: [makeFee(), makeFee({ academicPeriod: 'AY2' })],
					otherRevenueItems: [
						{
							lineItemName: 'Cantine',
							annualAmount: '100000.0000',
							distributionMethod: 'YEAR_ROUND_12',
							ifrsCategory: 'OTHER_OPERATING_INCOME',
						},
					],
				})
			);

			// Verify totals match row sums
			const rowGross = sumField(result.tuitionRevenue, 'grossRevenueHt');
			expect(result.totals.grossRevenueHt).toBe(rowGross.toFixed(4));

			const rowDiscount = sumField(result.tuitionRevenue, 'discountAmount');
			expect(result.totals.totalDiscounts).toBe(rowDiscount.toFixed(4));

			const rowNet = sumField(result.tuitionRevenue, 'netRevenueHt');
			expect(result.totals.netRevenueHt).toBe(rowNet.toFixed(4));

			const rowVat = sumField(result.tuitionRevenue, 'vatAmount');
			expect(result.totals.totalVat).toBe(rowVat.toFixed(4));

			expect(result.totals.totalOtherRevenue).toBe('100000.0000');
		});
	});

	describe('distributeAcrossMonths', () => {
		it('should throw for CUSTOM_WEIGHTS with invalid weight array', () => {
			expect(() => distributeAcrossMonths(new Decimal(1000), 'CUSTOM_WEIGHTS', [0.5, 0.5])).toThrow(
				'CUSTOM_WEIGHTS requires a weight_array of exactly 12 values'
			);
		});

		it('should throw for SPECIFIC_PERIOD with empty months', () => {
			expect(() => distributeAcrossMonths(new Decimal(1000), 'SPECIFIC_PERIOD', null, [])).toThrow(
				'SPECIFIC_PERIOD requires a non-empty specific_months array'
			);
		});

		it('should distribute YEAR_ROUND_12 with last-bucket ensuring exact sum', () => {
			// 1000 / 12 = 83.3333... — not perfectly divisible
			const result = distributeAcrossMonths(new Decimal('1000'), 'YEAR_ROUND_12');
			let sum = new Decimal(0);
			for (const [, amount] of result) {
				sum = sum.plus(amount);
			}
			expect(sum.toFixed(4)).toBe('1000.0000');
			expect(result.size).toBe(12);
		});
	});
});
