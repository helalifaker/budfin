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
	tuitionFees: new Decimal('58972253.7283'),
	discountImpact: new Decimal('2333712.7065'),
	netTuition: new Decimal('56638541.0217'),
	totalOperatingRevenue: new Decimal('68156191.0217'),
};
const WORKBOOK_MONTHLY_NET_TUITION: Record<number, Decimal> = {
	1: new Decimal('5602363.7543'),
	2: new Decimal('5602363.7543'),
	3: new Decimal('5602363.7543'),
	4: new Decimal('5602363.7543'),
	5: new Decimal('5602363.7543'),
	6: new Decimal('5602363.7543'),
	9: new Decimal('5756089.6239'),
	10: new Decimal('5756089.6239'),
	11: new Decimal('5756089.6239'),
	12: new Decimal('5756089.6239'),
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
	nationality: string | null;
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
			nationality: d.nationality,
			discountRate: d.discountRate,
		}));

		const engineEnrollment: EnrollmentDetailInput[] = enrollmentDetail.map((e) => ({
			academicPeriod: e.academicPeriod,
			gradeLevel: e.gradeLevel,
			nationality: e.nationality,
			tariff: e.tariff,
			headcount: e.headcount,
		}));

		const engineOtherRevenue: OtherRevenueInput[] = otherRevenue.map((o) => ({
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
			expect(discounts.map((d) => d.tariff).sort()).toEqual([
				'Plein',
				'Reduit 3+',
				'Reduit Personnel',
			]);
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
			const expectedTotal = new Decimal('34952375.6283');
			expect(monthlyAY1.minus(expectedTotal).abs().lte(PARITY_TOLERANCE)).toBe(true);
		});
	});

	describe('Discount Validation', () => {
		it('should apply 25% discount for Reduit Personnel tariff', () => {
			const rpRows = result.tuitionRevenue.filter((r) => r.tariff === 'Reduit Personnel');
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

		it('should apply 25% discount for Reduit 3+ tariff', () => {
			const r3Rows = result.tuitionRevenue.filter((r) => r.tariff === 'Reduit 3+');
			if (r3Rows.length === 0) return;

			const r3Gross = r3Rows.reduce(
				(sum, r) => sum.plus(new Decimal(r.grossRevenueHt)),
				new Decimal(0)
			);
			const r3Discount = r3Rows.reduce(
				(sum, r) => sum.plus(new Decimal(r.discountAmount)),
				new Decimal(0)
			);

			const expectedDiscount = r3Gross.plus(r3Discount).mul(new Decimal('0.25'));
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
			const apsRows = result.otherRevenue.filter(
				(r) => r.lineItemName === 'After-School Activities (APS)'
			);
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
			const dossierRows = result.otherRevenue.filter(
				(r) => r.lineItemName === 'Frais de Dossier - Francais'
			);
			// Distribution: May-Jun (months 5, 6)
			expect(dossierRows).toHaveLength(2);
			expect(dossierRows.map((r) => r.month).sort((a, b) => a - b)).toEqual([5, 6]);
			const total = dossierRows.reduce((sum, r) => sum.plus(new Decimal(r.amount)), new Decimal(0));
			expect(total.toFixed(4)).toBe('106000.0000');
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

		it('should match workbook annual operating revenue', () => {
			const totalOperating = new Decimal(result.totals.totalOperatingRevenue);
			expect(
				totalOperating.minus(WORKBOOK_TOTALS.totalOperatingRevenue).abs().lte(PARITY_TOLERANCE)
			).toBe(true);
		});
	});
});
