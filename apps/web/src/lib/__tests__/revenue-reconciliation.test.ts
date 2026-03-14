import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import type { RevenueResultsResponse } from '@budfin/types';
import type { GradeLevel } from '../../hooks/use-grade-levels';
import { buildRevenueForecastGridRows } from '../revenue-workspace';

/**
 * QA-09 / ID-05: Cross-view reconciliation.
 *
 * Verifies that the Grade, Nationality, and Tariff view grand totals
 * are identical to the Category view "Tuition Fees" annual total.
 *
 * All comparisons use Decimal.eq() -- never JavaScript === on strings.
 */

function makeSampleResults(): RevenueResultsResponse {
	// Build entries across multiple grades, nationalities, and tariffs
	// to ensure aggregation paths are properly exercised.
	const entries: RevenueResultsResponse['entries'] = [
		{
			academicPeriod: 'AY1',
			gradeLevel: 'PS',
			nationality: 'Francais',
			tariff: 'Plein',
			month: 1,
			grossRevenueHt: '10000.0000',
			discountAmount: '0.0000',
			scholarshipDeduction: '0.0000',
			netRevenueHt: '10000.0000',
			vatAmount: '1500.0000',
		},
		{
			academicPeriod: 'AY1',
			gradeLevel: 'PS',
			nationality: 'Nationaux',
			tariff: 'RP',
			month: 2,
			grossRevenueHt: '7500.0000',
			discountAmount: '1875.0000',
			scholarshipDeduction: '0.0000',
			netRevenueHt: '5625.0000',
			vatAmount: '1125.0000',
		},
		{
			academicPeriod: 'AY1',
			gradeLevel: 'MS',
			nationality: 'Autres',
			tariff: 'R3+',
			month: 3,
			grossRevenueHt: '5000.0000',
			discountAmount: '500.0000',
			scholarshipDeduction: '0.0000',
			netRevenueHt: '4500.0000',
			vatAmount: '750.0000',
		},
		{
			academicPeriod: 'AY1',
			gradeLevel: 'CP',
			nationality: 'Francais',
			tariff: 'Plein',
			month: 4,
			grossRevenueHt: '12000.0000',
			discountAmount: '0.0000',
			scholarshipDeduction: '0.0000',
			netRevenueHt: '12000.0000',
			vatAmount: '1800.0000',
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: 'GS',
			nationality: 'Nationaux',
			tariff: 'Plein',
			month: 9,
			grossRevenueHt: '8500.0000',
			discountAmount: '0.0000',
			scholarshipDeduction: '0.0000',
			netRevenueHt: '8500.0000',
			vatAmount: '1275.0000',
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: '6EME',
			nationality: 'Autres',
			tariff: 'RP',
			month: 10,
			grossRevenueHt: '9000.0000',
			discountAmount: '2250.0000',
			scholarshipDeduction: '0.0000',
			netRevenueHt: '6750.0000',
			vatAmount: '1350.0000',
		},
		{
			academicPeriod: 'AY2',
			gradeLevel: '2NDE',
			nationality: 'Francais',
			tariff: 'R3+',
			month: 11,
			grossRevenueHt: '11000.0000',
			discountAmount: '1100.0000',
			scholarshipDeduction: '0.0000',
			netRevenueHt: '9900.0000',
			vatAmount: '1650.0000',
		},
	];

	// Compute totals from entries
	const grossTotal = entries.reduce(
		(sum, e) => sum.plus(new Decimal(e.grossRevenueHt)),
		new Decimal(0)
	);
	const discountTotal = entries.reduce(
		(sum, e) => sum.plus(new Decimal(e.discountAmount)),
		new Decimal(0)
	);
	const netTotal = grossTotal.minus(discountTotal);

	// Build executive summary where "Tuition Fees" annual total = gross total
	const monthlyBuckets = Array.from({ length: 12 }, () => new Decimal(0));
	for (const entry of entries) {
		const idx = entry.month - 1;
		monthlyBuckets[idx] = monthlyBuckets[idx]!.plus(new Decimal(entry.grossRevenueHt));
	}

	return {
		entries,
		otherRevenueEntries: [],
		summary: [],
		totals: {
			grossRevenueHt: grossTotal.toFixed(4),
			discountAmount: discountTotal.toFixed(4),
			netRevenueHt: netTotal.toFixed(4),
			vatAmount: '9450.0000',
			otherRevenueAmount: '0.0000',
			totalOperatingRevenue: netTotal.toFixed(4),
		},
		rowCount: entries.length,
		revenueEngine: { rows: [] },
		executiveSummary: {
			rows: [
				{
					section: 'Executive Summary',
					label: 'Tuition Fees',
					monthlyAmounts: monthlyBuckets.map((v) => v.toFixed(4)),
					annualTotal: grossTotal.toFixed(4),
					percentageOfRevenue: '1.000000',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'Discount Impact',
					monthlyAmounts: Array.from({ length: 12 }, () => '0.0000'),
					annualTotal: discountTotal.negated().toFixed(4),
					percentageOfRevenue: '-0.090000',
					isTotal: false,
				},
				{
					section: 'Executive Summary',
					label: 'TOTAL OPERATING REV',
					monthlyAmounts: Array.from({ length: 12 }, () => '0.0000'),
					annualTotal: netTotal.toFixed(4),
					percentageOfRevenue: '1.000000',
					isTotal: true,
				},
			],
			composition: [],
			monthlyTrend: [],
		},
	};
}

const GRADE_LEVELS: GradeLevel[] = [
	{
		id: 1,
		gradeCode: 'PS',
		gradeName: 'Petite Section',
		band: 'MATERNELLE',
		maxClassSize: 25,
		defaultAy2Intake: 60,
		plancherPct: '0.70',
		ciblePct: '0.85',
		plafondPct: '1.00',
		displayOrder: 1,
		version: 1,
	},
	{
		id: 2,
		gradeCode: 'MS',
		gradeName: 'Moyenne Section',
		band: 'MATERNELLE',
		maxClassSize: 25,
		defaultAy2Intake: null,
		plancherPct: '0.70',
		ciblePct: '0.85',
		plafondPct: '1.00',
		displayOrder: 2,
		version: 1,
	},
	{
		id: 3,
		gradeCode: 'GS',
		gradeName: 'Grande Section',
		band: 'MATERNELLE',
		maxClassSize: 25,
		defaultAy2Intake: null,
		plancherPct: '0.70',
		ciblePct: '0.85',
		plafondPct: '1.00',
		displayOrder: 3,
		version: 1,
	},
	{
		id: 4,
		gradeCode: 'CP',
		gradeName: 'CP',
		band: 'ELEMENTAIRE',
		maxClassSize: 28,
		defaultAy2Intake: null,
		plancherPct: '0.70',
		ciblePct: '0.85',
		plafondPct: '1.00',
		displayOrder: 4,
		version: 1,
	},
	{
		id: 9,
		gradeCode: '6EME',
		gradeName: '6eme',
		band: 'COLLEGE',
		maxClassSize: 30,
		defaultAy2Intake: null,
		plancherPct: '0.70',
		ciblePct: '0.85',
		plafondPct: '1.00',
		displayOrder: 9,
		version: 1,
	},
	{
		id: 13,
		gradeCode: '2NDE',
		gradeName: '2nde',
		band: 'LYCEE',
		maxClassSize: 35,
		defaultAy2Intake: null,
		plancherPct: '0.70',
		ciblePct: '0.85',
		plafondPct: '1.00',
		displayOrder: 13,
		version: 1,
	},
];

describe('Cross-view reconciliation (QA-09, ID-05)', () => {
	const data = makeSampleResults();
	const tuitionFeesRow = data.executiveSummary.rows.find((row) => row.label === 'Tuition Fees');
	const expectedTuitionTotal = new Decimal(tuitionFeesRow!.annualTotal);

	it('grade view grand total equals Category Tuition Fees annual total (Decimal.eq)', () => {
		const gradeRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'grade',
			gradeLevels: GRADE_LEVELS,
		});

		const grandTotalRow = gradeRows.find((row) => row.isTotal);
		expect(grandTotalRow).toBeDefined();

		const grandTotal = new Decimal(grandTotalRow!.annualTotal);
		expect(grandTotal.eq(expectedTuitionTotal)).toBe(true);
	});

	it('nationality view grand total equals Category Tuition Fees annual total (Decimal.eq)', () => {
		const nationalityRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'nationality',
		});

		const grandTotalRow = nationalityRows.find((row) => row.isTotal);
		expect(grandTotalRow).toBeDefined();

		const grandTotal = new Decimal(grandTotalRow!.annualTotal);
		expect(grandTotal.eq(expectedTuitionTotal)).toBe(true);
	});

	it('tariff view grand total equals Category Tuition Fees annual total (Decimal.eq)', () => {
		const tariffRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'tariff',
		});

		const grandTotalRow = tariffRows.find((row) => row.isTotal);
		expect(grandTotalRow).toBeDefined();

		const grandTotal = new Decimal(grandTotalRow!.annualTotal);
		expect(grandTotal.eq(expectedTuitionTotal)).toBe(true);
	});

	it('all three pivot views produce the same grand total as each other', () => {
		const gradeRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'grade',
			gradeLevels: GRADE_LEVELS,
		});
		const nationalityRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'nationality',
		});
		const tariffRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'tariff',
		});

		const gradeTotal = new Decimal(gradeRows.find((r) => r.isTotal)!.annualTotal);
		const nationalityTotal = new Decimal(nationalityRows.find((r) => r.isTotal)!.annualTotal);
		const tariffTotal = new Decimal(tariffRows.find((r) => r.isTotal)!.annualTotal);

		expect(gradeTotal.eq(nationalityTotal)).toBe(true);
		expect(nationalityTotal.eq(tariffTotal)).toBe(true);
	});

	it('monthly totals also reconcile across views (Decimal.eq per month)', () => {
		const gradeRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'grade',
			gradeLevels: GRADE_LEVELS,
		});
		const nationalityRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'nationality',
		});
		const tariffRows = buildRevenueForecastGridRows({
			data,
			viewMode: 'tariff',
		});

		const gradeGrandTotal = gradeRows.find((r) => r.isTotal)!;
		const nationalityGrandTotal = nationalityRows.find((r) => r.isTotal)!;
		const tariffGrandTotal = tariffRows.find((r) => r.isTotal)!;

		for (let month = 0; month < 12; month += 1) {
			const gradeMonth = new Decimal(gradeGrandTotal.monthlyAmounts[month]!);
			const nationalityMonth = new Decimal(nationalityGrandTotal.monthlyAmounts[month]!);
			const tariffMonth = new Decimal(tariffGrandTotal.monthlyAmounts[month]!);

			expect(gradeMonth.eq(nationalityMonth)).toBe(true);
			expect(nationalityMonth.eq(tariffMonth)).toBe(true);
		}
	});
});
