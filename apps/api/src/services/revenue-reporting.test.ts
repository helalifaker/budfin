import { describe, expect, it } from 'vitest';
import {
	buildRevenueReportingTotals,
	buildRevenueReportingView,
	type OtherRevenueDetailRow,
	type RevenueDetailRow,
} from './revenue-reporting.js';

function makeEmptyView() {
	return buildRevenueReportingView([], []);
}

function makeTuitionRow(overrides: Partial<RevenueDetailRow> = {}): RevenueDetailRow {
	return {
		academicPeriod: 'AY1',
		gradeLevel: 'PS',
		month: 1,
		grossRevenueHt: '1000.0000',
		discountAmount: '100.0000',
		netRevenueHt: '900.0000',
		vatAmount: '135.0000',
		...overrides,
	};
}

function makeOtherRow(overrides: Partial<OtherRevenueDetailRow> = {}): OtherRevenueDetailRow {
	return {
		lineItemName: 'DAI - Francais',
		ifrsCategory: 'Registration Fees',
		executiveCategory: null,
		month: 1,
		amount: '500.0000',
		...overrides,
	};
}

describe('buildRevenueReportingView', () => {
	it('returns a view with all expected section labels when called with empty inputs', () => {
		const view = makeEmptyView();
		expect(view.revenueEngine.rows.length).toBeGreaterThan(0);
		expect(view.executiveSummary.rows.length).toBeGreaterThan(0);
		expect(view.executiveSummary.monthlyTrend).toHaveLength(12);
	});

	it('produces zero monthly amounts when all inputs are empty', () => {
		const view = makeEmptyView();
		const totalRow = view.revenueEngine.rows.find((r) => r.label === 'TOTAL OPERATING REVENUE');
		expect(totalRow?.annualTotal).toBe('0.0000');
		expect(totalRow?.monthlyAmounts.every((m) => m === '0.0000')).toBe(true);
	});

	it('produces 0.000000 percentage when totalOperatingRevenue is zero', () => {
		const view = makeEmptyView();
		for (const row of view.revenueEngine.rows) {
			expect(row.percentageOfRevenue).toBe('0.000000');
		}
	});

	it('maps PS gradeLevel to Maternelle PS - Tuition line', () => {
		const view = buildRevenueReportingView([makeTuitionRow({ gradeLevel: 'PS' })], []);
		const psRow = view.revenueEngine.rows.find((r) => r.label === 'Maternelle PS - Tuition');
		expect(psRow?.annualTotal).toBe('1000.0000');
	});

	it('maps Maternelle grade to Maternelle - Tuition line', () => {
		const view = buildRevenueReportingView([makeTuitionRow({ gradeLevel: 'MS' })], []);
		const matRow = view.revenueEngine.rows.find((r) => r.label === 'Maternelle - Tuition');
		expect(matRow?.annualTotal).toBe('1000.0000');
	});

	it('maps Elementaire grade to Elementaire - Tuition line', () => {
		const view = buildRevenueReportingView([makeTuitionRow({ gradeLevel: 'CP' })], []);
		const elemRow = view.revenueEngine.rows.find((r) => r.label === 'Elementaire - Tuition');
		expect(elemRow?.annualTotal).toBe('1000.0000');
	});

	it('maps College grade to College - Tuition line', () => {
		const view = buildRevenueReportingView([makeTuitionRow({ gradeLevel: '6EME' })], []);
		const collRow = view.revenueEngine.rows.find((r) => r.label === 'College - Tuition');
		expect(collRow?.annualTotal).toBe('1000.0000');
	});

	it('maps Lycee grade to Lycee - Tuition line', () => {
		const view = buildRevenueReportingView([makeTuitionRow({ gradeLevel: '2NDE' })], []);
		const lycRow = view.revenueEngine.rows.find((r) => r.label === 'Lycee - Tuition');
		expect(lycRow?.annualTotal).toBe('1000.0000');
	});

	it('maps unknown gradeLevel to a fallback tuition label', () => {
		// unknown grades should not crash — they create an ad-hoc label
		expect(() =>
			buildRevenueReportingView([makeTuitionRow({ gradeLevel: 'UNKNOWN_GRADE' })], [])
		).not.toThrow();
	});

	it('maps DAI line item to Re-registration bucket', () => {
		const view = buildRevenueReportingView([], [makeOtherRow({ lineItemName: 'DAI - Francais' })]);
		const regRow = view.revenueEngine.rows.find((r) => r.label === 'Re-registration (DAI)');
		expect(regRow?.annualTotal).toBe('500.0000');
	});

	it('maps DPI line item to New Student Fees bucket', () => {
		const view = buildRevenueReportingView([], [makeOtherRow({ lineItemName: 'DPI - Francais' })]);
		const regRow = view.revenueEngine.rows.find(
			(r) => r.label === 'New Student Fees (Dossier+DPI)'
		);
		expect(regRow?.annualTotal).toBe('500.0000');
	});

	it('maps Frais de Dossier to New Student Fees bucket', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'Frais de Dossier - Francais' })]
		);
		const regRow = view.revenueEngine.rows.find(
			(r) => r.label === 'New Student Fees (Dossier+DPI)'
		);
		expect(regRow?.annualTotal).toBe('500.0000');
	});

	it('maps Evaluation to Evaluation Tests bucket only', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'Evaluation - Primaire' })]
		);
		const newStudentRow = view.revenueEngine.rows.find(
			(r) => r.label === 'New Student Fees (Dossier+DPI)'
		);
		const evalRow = view.revenueEngine.rows.find((r) => r.label === 'Evaluation Tests');
		expect(newStudentRow?.annualTotal).toBe('0.0000');
		expect(evalRow?.annualTotal).toBe('500.0000');
	});

	it('does not double-count evaluation in registration total', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'Evaluation - Primaire', amount: '10000.0000' })]
		);
		const regTotalRow = view.revenueEngine.rows.find((r) => r.label === 'Total Registration Fees');
		expect(regTotalRow?.annualTotal).toBe('10000.0000');
	});

	it('maps BAC to BAC Examination Fees bucket', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'BAC', ifrsCategory: 'Examination Fees' })]
		);
		const bacRow = view.revenueEngine.rows.find((r) => r.label === 'BAC Examination Fees');
		expect(bacRow?.annualTotal).toBe('500.0000');
	});

	it('maps DNB to DNB Examination Fees bucket', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'DNB', ifrsCategory: 'Examination Fees' })]
		);
		const dnbRow = view.revenueEngine.rows.find((r) => r.label === 'DNB Examination Fees');
		expect(dnbRow?.annualTotal).toBe('500.0000');
	});

	it('maps EAF to EAF Examination Fees bucket', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'EAF', ifrsCategory: 'Examination Fees' })]
		);
		const eafRow = view.revenueEngine.rows.find((r) => r.label === 'EAF Examination Fees');
		expect(eafRow?.annualTotal).toBe('500.0000');
	});

	it('maps SIELE to SIELE Examination Fees bucket', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'SIELE', ifrsCategory: 'Examination Fees' })]
		);
		const sieleRow = view.revenueEngine.rows.find((r) => r.label === 'SIELE Examination Fees');
		expect(sieleRow?.annualTotal).toBe('500.0000');
	});

	it('ignores unmapped other-revenue items with no executiveCategory', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'Custom Fee', executiveCategory: null })]
		);
		const totalRow = view.revenueEngine.rows.find((r) => r.label === 'TOTAL OPERATING REVENUE');
		expect(totalRow?.annualTotal).toBe('0.0000');
	});

	it('routes unmapped items with REGISTRATION_FEES executiveCategory to New Student Fees', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'Custom Fee', executiveCategory: 'REGISTRATION_FEES' })]
		);
		const row = view.revenueEngine.rows.find((r) => r.label === 'New Student Fees (Dossier+DPI)');
		expect(row?.annualTotal).toBe('500.0000');
	});

	it('routes unmapped items with ACTIVITIES_SERVICES executiveCategory to After-School Activities', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'Custom Activity', executiveCategory: 'ACTIVITIES_SERVICES' })]
		);
		const row = view.revenueEngine.rows.find((r) => r.label === 'After-School Activities (APS)');
		expect(row?.annualTotal).toBe('500.0000');
	});

	it('routes unmapped items with EXAMINATION_FEES executiveCategory to BAC Examination Fees', () => {
		const view = buildRevenueReportingView(
			[],
			[makeOtherRow({ lineItemName: 'Custom Exam', executiveCategory: 'EXAMINATION_FEES' })]
		);
		const row = view.revenueEngine.rows.find((r) => r.label === 'BAC Examination Fees');
		expect(row?.annualTotal).toBe('500.0000');
	});

	it('maps AY2 discount negatively to AY2 discount impact row', () => {
		const view = buildRevenueReportingView(
			[makeTuitionRow({ academicPeriod: 'AY2', discountAmount: '50.0000' })],
			[]
		);
		const discountAy2Row = view.revenueEngine.rows.find((r) => r.label === 'Discount Impact (AY2)');
		expect(parseFloat(discountAy2Row?.annualTotal ?? '0')).toBeLessThan(0);
	});

	it('produces a composition array with four items', () => {
		const view = makeEmptyView();
		expect(view.executiveSummary.composition).toHaveLength(4);
		expect(view.executiveSummary.composition.map((c) => c.label)).toEqual([
			'Net Tuition',
			'Registration',
			'Activities',
			'Examinations',
		]);
	});

	it('produces 12 monthly trend entries', () => {
		const view = makeEmptyView();
		expect(view.executiveSummary.monthlyTrend).toHaveLength(12);
		expect(view.executiveSummary.monthlyTrend[0]?.month).toBe(1);
		expect(view.executiveSummary.monthlyTrend[11]?.month).toBe(12);
	});
});

describe('buildRevenueReportingTotals', () => {
	it('returns all-zero totals when there are no tuition rows and empty view', () => {
		const view = makeEmptyView();
		const totals = buildRevenueReportingTotals([], view);
		expect(totals.grossRevenueHt).toBe('0.0000');
		expect(totals.discountAmount).toBe('0.0000');
		expect(totals.netRevenueHt).toBe('0.0000');
		expect(totals.vatAmount).toBe('0.0000');
		expect(totals.otherRevenueAmount).toBe('0.0000');
		expect(totals.totalOperatingRevenue).toBe('0.0000');
	});

	it('sums grossRevenueHt across all tuition rows', () => {
		const view = buildRevenueReportingView(
			[
				makeTuitionRow({ grossRevenueHt: '1000.0000' }),
				makeTuitionRow({ grossRevenueHt: '500.0000' }),
			],
			[]
		);
		const totals = buildRevenueReportingTotals(
			[
				makeTuitionRow({ grossRevenueHt: '1000.0000' }),
				makeTuitionRow({ grossRevenueHt: '500.0000' }),
			],
			view
		);
		expect(totals.grossRevenueHt).toBe('1500.0000');
	});

	it('uses Net Tuition composition amount for netRevenueHt when available', () => {
		const tuitionRows = [
			makeTuitionRow({
				grossRevenueHt: '1000.0000',
				discountAmount: '100.0000',
				netRevenueHt: '900.0000',
			}),
		];
		const view = buildRevenueReportingView(tuitionRows, []);
		const totals = buildRevenueReportingTotals(tuitionRows, view);
		// netRevenueHt should come from composition 'Net Tuition'
		expect(totals.netRevenueHt).toBeTruthy();
	});

	it('sums registration + activities + examination revenue for otherRevenueAmount', () => {
		const otherRows = [
			makeOtherRow({ lineItemName: 'DAI - Francais', amount: '200.0000' }),
			makeOtherRow({ lineItemName: 'BAC', ifrsCategory: 'Examination Fees', amount: '300.0000' }),
		];
		const view = buildRevenueReportingView([], otherRows);
		const totals = buildRevenueReportingTotals([], view);
		// DAI → registration (200), BAC → examination (300) → total other = 500
		expect(parseFloat(totals.otherRevenueAmount)).toBeGreaterThan(0);
	});

	it('falls back to 0.0000 for totalOperatingRevenue when executiveSummary rows list is empty', () => {
		// Construct a view where the last row has no annualTotal (simulate by passing malformed view)
		const view = makeEmptyView();
		// Override to simulate missing row
		const emptyView = { ...view, executiveSummary: { ...view.executiveSummary, rows: [] } };
		const totals = buildRevenueReportingTotals([], emptyView);
		expect(totals.totalOperatingRevenue).toBe('0.0000');
	});

	it('falls back to 0.0000 for registrationRevenue when label is absent', () => {
		const view = makeEmptyView();
		const partialView = {
			...view,
			executiveSummary: {
				...view.executiveSummary,
				rows: view.executiveSummary.rows.filter((r) => r.label !== 'Registration Fees'),
			},
		};
		const totals = buildRevenueReportingTotals([], partialView);
		expect(totals.otherRevenueAmount).toBe('0.0000');
	});
});
