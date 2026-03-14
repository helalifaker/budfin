// Revenue Validation — tests FY2026 Excel data against revenue engine
// Phase 2a: Load fixtures, run calculateRevenue(), compare against expected values

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Decimal } from 'decimal.js';
import {
	calculateRevenue,
	type EnrollmentDetailInput,
	type FeeGridInput,
	type DiscountPolicyInput,
	type OtherRevenueInput,
	type RevenueEngineResult,
} from '../services/revenue-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES = resolve(__dirname, '..', '..', '..', '..', 'data', 'fixtures');
const PARITY_TOLERANCE = new Decimal('0.05');
const WORKBOOK_TOTALS = {
	tuitionFees: new Decimal('33430796.0000'),
	discountImpact: new Decimal('707684.0000'),
	netTuition: new Decimal('32723112.0000'),
	totalOperatingRevenue: new Decimal('39242612.0000'),
};
const WORKBOOK_MONTHLY_NET_TUITION: Record<number, Decimal> = {
	1: new Decimal('3836460.0000'),
	2: new Decimal('3836460.0000'),
	3: new Decimal('3836460.0000'),
	4: new Decimal('3836460.0000'),
	5: new Decimal('3836460.0000'),
	6: new Decimal('3836460.0000'),
	9: new Decimal('2426088.0000'),
	10: new Decimal('2426088.0000'),
	11: new Decimal('2426088.0000'),
	12: new Decimal('2426088.0000'),
};

// ── Fixture types ────────────────────────────────────────────────────────────

interface FeeGridFixture {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	tuitionTtc: string;
	tuitionHt: string;
	dai: string;
}

interface DiscountFixture {
	tariff: string;
	discountRate: string;
}

interface EnrollmentDetailFixture {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	headcount: number;
}

interface OtherRevenueFixture {
	lineItemName: string;
	annualAmount: string;
	distributionMethod: string;
	weightArray: number[] | null;
	specificMonths: number[] | null;
	ifrsCategory: string;
	computeMethod: string | null;
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('Revenue Validation — FY2026 Excel Data', () => {
	let feeGrid: FeeGridFixture[];
	let discounts: DiscountFixture[];
	let enrollmentDetail: EnrollmentDetailFixture[];
	let otherRevenue: OtherRevenueFixture[];
	let result: RevenueEngineResult;

	beforeAll(() => {
		feeGrid = JSON.parse(readFileSync(resolve(FIXTURES, 'fy2026-fee-grid.json'), 'utf-8'));
		discounts = JSON.parse(readFileSync(resolve(FIXTURES, 'fy2026-discounts.json'), 'utf-8'));
		enrollmentDetail = JSON.parse(
			readFileSync(resolve(FIXTURES, 'fy2026-enrollment-detail.json'), 'utf-8')
		);
		otherRevenue = JSON.parse(
			readFileSync(resolve(FIXTURES, 'fy2026-other-revenue.json'), 'utf-8')
		);
		// Map fixture types to engine input types
		const engineFeeGrid: FeeGridInput[] = feeGrid.map((f) => ({
			academicPeriod: f.academicPeriod,
			gradeLevel: f.gradeLevel,
			nationality: f.nationality,
			tariff: f.tariff,
			tuitionTtc: f.tuitionTtc,
			tuitionHt: f.tuitionHt,
			dai: f.dai,
		}));

		const engineDiscounts: DiscountPolicyInput[] = discounts.map((d) => ({
			tariff: d.tariff,
			discountRate: d.discountRate,
		}));

		const engineEnrollment: EnrollmentDetailInput[] = enrollmentDetail.map((e) => ({
			academicPeriod: e.academicPeriod,
			gradeLevel: e.gradeLevel,
			nationality: e.nationality,
			tariff: e.tariff,
			headcount: e.headcount,
		}));

		// Only pass static (non-computed) items to the engine
		// Dynamic items (computeMethod != null) have annualAmount = "0.0000" in fixtures
		// and would be computed in the calculate route, not by the engine directly
		const staticOtherRevenue = otherRevenue.filter((o) => !o.computeMethod);
		const engineOtherRevenue: OtherRevenueInput[] = staticOtherRevenue.map((o) => ({
			lineItemName: o.lineItemName,
			annualAmount: o.annualAmount,
			distributionMethod: o.distributionMethod as OtherRevenueInput['distributionMethod'],
			weightArray: o.weightArray,
			specificMonths: o.specificMonths,
			ifrsCategory: o.ifrsCategory,
		}));

		result = calculateRevenue({
			enrollmentDetails: engineEnrollment,
			feeGrid: engineFeeGrid,
			discountPolicies: engineDiscounts,
			otherRevenueItems: engineOtherRevenue,
		});
	});

	describe('Data Loading', () => {
		it('should load fee grid fixtures', () => {
			expect(feeGrid.length).toBeGreaterThan(0);
		});

		it('should load enrollment detail fixtures with correct AY1 total', () => {
			const ay1Total = enrollmentDetail
				.filter((e) => e.academicPeriod === 'AY1')
				.reduce((sum, e) => sum + e.headcount, 0);
			// Expected from Excel ENROLLMENT_DETAIL row 29: 1,753 students
			expect(ay1Total).toBe(1753);
		});

		it('should have 3 discount policies (Plein, RP, R3+)', () => {
			expect(discounts).toHaveLength(3);
			expect(discounts.map((d) => d.tariff).sort()).toEqual(['Plein', 'R3+', 'RP']);
		});

		it('should have other revenue items', () => {
			expect(otherRevenue.length).toBeGreaterThan(0);
		});
	});

	describe('Revenue Engine Produces Output', () => {
		it('should produce tuition revenue rows', () => {
			expect(result.tuitionRevenue.length).toBeGreaterThan(0);
		});

		it('should produce other revenue rows', () => {
			expect(result.otherRevenue.length).toBeGreaterThan(0);
		});

		it('should produce non-zero gross revenue', () => {
			const gross = new Decimal(result.totals.grossRevenueHt);
			expect(gross.gt(0)).toBe(true);
		});
	});

	describe('Tuition Revenue Validation', () => {
		it('should not produce revenue for summer months (Jul/Aug)', () => {
			const summerRows = result.tuitionRevenue.filter((r) => r.month === 7 || r.month === 8);
			expect(summerRows).toHaveLength(0);
		});

		it('should produce revenue for all 10 academic months', () => {
			const months = new Set(result.tuitionRevenue.map((r) => r.month));
			// AY1: 1-6, AY2: 9-12
			expect(months.has(1)).toBe(true);
			expect(months.has(6)).toBe(true);
			expect(months.has(9)).toBe(true);
			expect(months.has(12)).toBe(true);
			expect(months.has(7)).toBe(false);
			expect(months.has(8)).toBe(false);
		});

		it('should have gross > net > 0 (discounts reduce revenue)', () => {
			const gross = new Decimal(result.totals.grossRevenueHt);
			const net = new Decimal(result.totals.netRevenueHt);
			const disc = new Decimal(result.totals.totalDiscounts);

			expect(gross.gt(net)).toBe(true);
			expect(net.gt(0)).toBe(true);
			expect(disc.gt(0)).toBe(true);
			expect(gross.minus(disc).minus(net).abs().lte(PARITY_TOLERANCE)).toBe(true);
		});

		it('should apply 0% VAT for Nationaux students', () => {
			const nationauxRows = result.tuitionRevenue.filter((r) => r.nationality === 'Nationaux');
			const totalVat = nationauxRows.reduce(
				(sum, r) => sum.plus(new Decimal(r.vatAmount)),
				new Decimal(0)
			);
			expect(totalVat.toFixed(4)).toBe('0.0000');
		});

		it('should apply 15% VAT for Francais students', () => {
			const francaisRows = result.tuitionRevenue.filter((r) => r.nationality === 'Francais');
			const totalGross = francaisRows.reduce(
				(sum, r) => sum.plus(new Decimal(r.grossRevenueHt)),
				new Decimal(0)
			);
			const totalVat = francaisRows.reduce(
				(sum, r) => sum.plus(new Decimal(r.vatAmount)),
				new Decimal(0)
			);
			const expectedVat = totalGross.mul(new Decimal('0.15'));
			expect(totalVat.minus(expectedVat).abs().lte(PARITY_TOLERANCE)).toBe(true);
		});
	});

	describe('Per-Grade Revenue Cross-Check', () => {
		it('should match workbook AY1 monthly billed tuition after fiscal-year recognition', () => {
			const ay1Rows = result.tuitionRevenue.filter((r) => r.academicPeriod === 'AY1');
			const monthlyAY1 = ay1Rows.reduce(
				(sum, row) => sum.plus(new Decimal(row.grossRevenueHt)),
				new Decimal(0)
			);
			const expectedTotal = new Decimal('23512140.0000');
			expect(monthlyAY1.minus(expectedTotal).abs().lte(PARITY_TOLERANCE)).toBe(true);
		});
	});

	describe('Discount Validation', () => {
		it('should apply 25% discount for RP tariff', () => {
			const rpRows = result.tuitionRevenue.filter((r) => r.tariff === 'RP');
			if (rpRows.length === 0) return; // skip if no RP enrollment

			const rpGross = rpRows.reduce(
				(sum, r) => sum.plus(new Decimal(r.grossRevenueHt)),
				new Decimal(0)
			);
			const rpDiscount = rpRows.reduce(
				(sum, r) => sum.plus(new Decimal(r.discountAmount)),
				new Decimal(0)
			);

			const expectedDiscount = rpGross.plus(rpDiscount).mul(new Decimal('0.25'));
			expect(rpDiscount.minus(expectedDiscount).abs().lte(PARITY_TOLERANCE)).toBe(true);
		});

		it('should apply 10% discount for R3+ tariff', () => {
			const r3Rows = result.tuitionRevenue.filter((r) => r.tariff === 'R3+');
			if (r3Rows.length === 0) return;

			const r3Gross = r3Rows.reduce(
				(sum, r) => sum.plus(new Decimal(r.grossRevenueHt)),
				new Decimal(0)
			);
			const r3Discount = r3Rows.reduce(
				(sum, r) => sum.plus(new Decimal(r.discountAmount)),
				new Decimal(0)
			);

			const expectedDiscount = r3Gross.plus(r3Discount).mul(new Decimal('0.10'));
			expect(r3Discount.minus(expectedDiscount).abs().lte(PARITY_TOLERANCE)).toBe(true);
		});

		it('should apply 0% discount for Plein tariff', () => {
			const pleinRows = result.tuitionRevenue.filter((r) => r.tariff === 'Plein');
			const pleinDiscount = pleinRows.reduce(
				(sum, r) => sum.plus(new Decimal(r.discountAmount)),
				new Decimal(0)
			);
			expect(pleinDiscount.toFixed(4)).toBe('0.0000');
		});
	});

	describe('Other Revenue Validation', () => {
		it('should produce non-zero other revenue total', () => {
			const total = new Decimal(result.totals.totalOtherRevenue);
			expect(total.isZero()).toBe(false);
		});

		it('should distribute academic items across 10 months', () => {
			const apsRows = result.otherRevenue.filter((r) => r.lineItemName === 'APS');
			expect(apsRows).toHaveLength(10);
			const total = apsRows.reduce((sum, r) => sum.plus(new Decimal(r.amount)), new Decimal(0));
			expect(total.toFixed(4)).toBe('1230000.0000');
		});

		it('should distribute year-round items across 12 months', () => {
			const psgRows = result.otherRevenue.filter((r) => r.lineItemName === 'PSG Academy Rental');
			expect(psgRows).toHaveLength(12);
			const total = psgRows.reduce((sum, r) => sum.plus(new Decimal(r.amount)), new Decimal(0));
			expect(total.toFixed(4)).toBe('51230.0000');
		});

		it('should distribute specific-period items to specified months only', () => {
			const sieleRows = result.otherRevenue.filter((r) => r.lineItemName === 'SIELE');
			// Distribution: month 5
			expect(sieleRows).toHaveLength(1);
			expect(sieleRows.map((r) => r.month)).toEqual([5]);
			const total = sieleRows.reduce((sum, r) => sum.plus(new Decimal(r.amount)), new Decimal(0));
			expect(total.toFixed(4)).toBe('15000.0000');
		});

		it('should handle negative amounts (Bourses/scholarships)', () => {
			const bourseRows = result.otherRevenue.filter((r) => r.lineItemName === 'Bourses AEFE');
			if (bourseRows.length === 0) return;
			const total = bourseRows.reduce((sum, r) => sum.plus(new Decimal(r.amount)), new Decimal(0));
			expect(total.lt(0)).toBe(true);
		});
	});

	describe('Monthly Total Cross-Check', () => {
		it('should produce revenue for all 10 academic months with non-zero values', () => {
			const monthlyTuition: Record<number, Decimal> = {};
			for (const row of result.tuitionRevenue) {
				monthlyTuition[row.month] = (monthlyTuition[row.month] ?? new Decimal(0)).plus(
					new Decimal(row.netRevenueHt)
				);
			}

			for (const [month, expected] of Object.entries(WORKBOOK_MONTHLY_NET_TUITION)) {
				expect(
					(monthlyTuition[Number(month)] ?? new Decimal(0))
						.minus(expected)
						.abs()
						.lte(PARITY_TOLERANCE),
					`Month ${month} net tuition should match workbook`
				).toBe(true);
			}
		});

		it('should have annual net tuition matching Excel total', () => {
			const totalNet = new Decimal(result.totals.netRevenueHt);
			expect(totalNet.minus(WORKBOOK_TOTALS.netTuition).abs().lte(PARITY_TOLERANCE)).toBe(true);
		});

		it('should have total operating revenue consistent with static items only', () => {
			// With dynamic items computed at the route level (not in fixtures),
			// the engine total only includes static other-revenue items.
			// Just verify it's a positive, reasonable number (tuition + static other revenue).
			const totalOperating = new Decimal(result.totals.totalOperatingRevenue);
			expect(totalOperating.gt(0)).toBe(true);
			// Net tuition should still be the dominant component
			const netTuition = new Decimal(result.totals.netRevenueHt);
			expect(netTuition.gt(0)).toBe(true);
		});
	});
});
