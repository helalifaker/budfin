import { describe, it, expect } from 'vitest';
import {
	transformToAccountingPnl,
	type MonthlyPnlLineInput,
	type TemplateSectionInput,
	type HistoricalActualInput,
} from './pnl-accounting-service.js';

// ── Test helpers ────────────────────────────────────────────────────────────

/**
 * Create a detail PnlLine (depth=3, not subtotal, not separator).
 * These are the only lines consumed by the transformation.
 */
function makeDetailLine(overrides: Partial<MonthlyPnlLineInput> = {}): MonthlyPnlLineInput {
	return {
		month: overrides.month ?? 1,
		sectionKey: overrides.sectionKey ?? 'REVENUE_CONTRACTS',
		categoryKey: overrides.categoryKey ?? 'TUITION_FEES',
		lineItemKey: overrides.lineItemKey ?? 'TUITION_GRADE_A',
		displayLabel: overrides.displayLabel ?? 'Grade A',
		depth: 3,
		amount: overrides.amount ?? '10000.0000',
		isSubtotal: false,
		isSeparator: false,
	};
}

/** Generate detail lines for all 12 months with the same amount */
function makeMonthlyDetailLines(
	overrides: Partial<MonthlyPnlLineInput> = {}
): MonthlyPnlLineInput[] {
	return Array.from({ length: 12 }, (_, i) => makeDetailLine({ ...overrides, month: i + 1 }));
}

/** A minimal template with revenue, cost-of-service, and gross profit sections */
function makeSimpleTemplate(): TemplateSectionInput[] {
	return [
		{
			sectionKey: 'REVENUE',
			displayLabel: 'Revenue',
			displayOrder: 10,
			isSubtotal: false,
			subtotalFormula: null,
			signConvention: 'POSITIVE',
			mappings: [
				{
					analyticalKey: 'TUITION_FEES',
					analyticalKeyType: 'CATEGORY',
					accountCode: '701100',
					monthFilter: [9, 10, 11, 12],
					displayLabel: 'Tuition T1',
					visibility: 'SHOW',
					displayOrder: 10,
				},
				{
					analyticalKey: 'TUITION_FEES',
					analyticalKeyType: 'CATEGORY',
					accountCode: '701200',
					monthFilter: [1, 2, 3],
					displayLabel: 'Tuition T2',
					visibility: 'SHOW',
					displayOrder: 20,
				},
				{
					analyticalKey: 'TUITION_FEES',
					analyticalKeyType: 'CATEGORY',
					accountCode: '701300',
					monthFilter: [4, 5, 6],
					displayLabel: 'Tuition T3',
					visibility: 'SHOW',
					displayOrder: 30,
				},
			],
		},
		{
			sectionKey: 'COST_OF_SERVICE',
			displayLabel: 'Cost of Service',
			displayOrder: 20,
			isSubtotal: false,
			subtotalFormula: null,
			signConvention: 'NEGATIVE',
			mappings: [
				{
					analyticalKey: 'OPEX_AEFE',
					analyticalKeyType: 'LINE_ITEM',
					accountCode: '648000',
					monthFilter: [],
					displayLabel: 'AEFE Fees',
					visibility: 'SHOW',
					displayOrder: 10,
				},
			],
		},
		{
			sectionKey: 'GROSS_PROFIT',
			displayLabel: 'Gross Profit',
			displayOrder: 30,
			isSubtotal: true,
			subtotalFormula: 'REVENUE - COST_OF_SERVICE',
			signConvention: 'POSITIVE',
			mappings: [],
		},
	];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('transformToAccountingPnl', () => {
	it('maps tuition revenue with month filter (trimester aggregation)', () => {
		// 12 months of tuition data at 10000/month
		const lines = makeMonthlyDetailLines({
			categoryKey: 'TUITION_FEES',
			lineItemKey: 'TUITION_GRADE_A',
			amount: '10000.0000',
		});

		const template = makeSimpleTemplate();

		const result = transformToAccountingPnl(lines, template);

		// Revenue section should exist
		const revenueSection = result.sections.find((s) => s.sectionKey === 'REVENUE')!;
		expect(revenueSection).toBeDefined();
		expect(revenueSection.lines).toHaveLength(3);

		const t1 = revenueSection.lines[0]!;
		const t2 = revenueSection.lines[1]!;
		const t3 = revenueSection.lines[2]!;

		// T1: months 9-12 = 4 * 10000 = 40000
		expect(t1.displayLabel).toBe('Tuition T1');
		expect(t1.budgetAmount).toBe('40000.0000');

		// T2: months 1-3 = 3 * 10000 = 30000
		expect(t2.displayLabel).toBe('Tuition T2');
		expect(t2.budgetAmount).toBe('30000.0000');

		// T3: months 4-6 = 3 * 10000 = 30000
		expect(t3.displayLabel).toBe('Tuition T3');
		expect(t3.budgetAmount).toBe('30000.0000');

		// Section total: only months covered by filters = 40000 + 30000 + 30000
		expect(revenueSection.budgetSubtotal).toBe('100000.0000');
	});

	it('groups GROUP-visibility lines into Others', () => {
		const lines = [
			...makeMonthlyDetailLines({
				categoryKey: 'ACTIVITIES_SERVICES',
				lineItemKey: 'ACT_GARDERIE',
				amount: '5000.0000',
			}),
			...makeMonthlyDetailLines({
				categoryKey: 'ACTIVITIES_SERVICES',
				lineItemKey: 'ACT_CANTINE',
				amount: '3000.0000',
			}),
		];

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'REVENUE',
				displayLabel: 'Revenue',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'POSITIVE',
				mappings: [
					{
						analyticalKey: 'ACT_GARDERIE',
						analyticalKeyType: 'LINE_ITEM',
						accountCode: '701500',
						monthFilter: [],
						displayLabel: 'Daycare',
						visibility: 'SHOW',
						displayOrder: 10,
					},
					{
						analyticalKey: 'ACTIVITIES_SERVICES',
						analyticalKeyType: 'CATEGORY',
						accountCode: null,
						monthFilter: [],
						displayLabel: 'Activities',
						visibility: 'GROUP',
						displayOrder: 20,
					},
				],
			},
		];

		const result = transformToAccountingPnl(lines, template);

		const revenueSection = result.sections.find((s) => s.sectionKey === 'REVENUE')!;
		expect(revenueSection).toBeDefined();

		// SHOW line: Daycare (Garderie) = 12 * 5000 = 60000
		expect(revenueSection.lines).toHaveLength(1);
		const daycareL = revenueSection.lines[0]!;
		expect(daycareL.displayLabel).toBe('Daycare');
		expect(daycareL.budgetAmount).toBe('60000.0000');

		// GROUP line: Cantine = 12 * 3000 = 36000 (Garderie already consumed by LINE_ITEM)
		expect(revenueSection.othersAmount).toBe('36000.0000');
	});

	it('excludes EXCLUDE-visibility lines', () => {
		const lines = makeMonthlyDetailLines({
			categoryKey: 'EXCLUDED_CAT',
			lineItemKey: 'EXCLUDED_LINE',
			amount: '999.0000',
		});

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'REVENUE',
				displayLabel: 'Revenue',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'POSITIVE',
				mappings: [
					{
						analyticalKey: 'EXCLUDED_CAT',
						analyticalKeyType: 'CATEGORY',
						accountCode: null,
						monthFilter: [],
						displayLabel: 'Excluded',
						visibility: 'EXCLUDE',
						displayOrder: 10,
					},
				],
			},
		];

		const result = transformToAccountingPnl(lines, template);

		const revenueSection = result.sections.find((s) => s.sectionKey === 'REVENUE')!;
		expect(revenueSection).toBeDefined();
		expect(revenueSection.lines).toHaveLength(0);
		expect(revenueSection.othersAmount).toBeUndefined();
		expect(revenueSection.budgetSubtotal).toBe('0.0000');
	});

	it('LINE_ITEM mappings take priority over CATEGORY mappings', () => {
		// EOS_PROVISION is a LINE_ITEM within the EMPLOYER_CHARGES category.
		// The LINE_ITEM mapping should claim it first, preventing double-counting.
		const lines = [
			// EOS line items
			...makeMonthlyDetailLines({
				categoryKey: 'EMPLOYER_CHARGES',
				lineItemKey: 'EOS_PROVISION',
				amount: '2000.0000',
			}),
			// GOSI line items (also in EMPLOYER_CHARGES)
			...makeMonthlyDetailLines({
				categoryKey: 'EMPLOYER_CHARGES',
				lineItemKey: 'GOSI_SAUDI',
				amount: '1500.0000',
			}),
		];

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'PROVISIONS',
				displayLabel: 'Provisions',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'NEGATIVE',
				mappings: [
					{
						analyticalKey: 'EOS_PROVISION',
						analyticalKeyType: 'LINE_ITEM',
						accountCode: '681750',
						monthFilter: [],
						displayLabel: 'EOS Provision',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
			{
				sectionKey: 'STAFF_COSTS',
				displayLabel: 'Staff Costs',
				displayOrder: 20,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'NEGATIVE',
				mappings: [
					{
						analyticalKey: 'EMPLOYER_CHARGES',
						analyticalKeyType: 'CATEGORY',
						accountCode: '648030',
						monthFilter: [],
						displayLabel: 'Employer Charges',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
		];

		const result = transformToAccountingPnl(lines, template);

		// PROVISIONS section should have EOS at 12 * 2000 = 24000
		const provisions = result.sections.find((s) => s.sectionKey === 'PROVISIONS')!;
		expect(provisions.lines[0]!.budgetAmount).toBe('24000.0000');

		// STAFF_COSTS should only have GOSI (EOS already consumed): 12 * 1500 = 18000
		const staffCosts = result.sections.find((s) => s.sectionKey === 'STAFF_COSTS')!;
		expect(staffCosts.lines[0]!.budgetAmount).toBe('18000.0000');
	});

	it('computes subtotals via formula evaluation', () => {
		const lines = [
			...makeMonthlyDetailLines({
				categoryKey: 'TUITION_FEES',
				lineItemKey: 'TUITION_GRADE_A',
				amount: '10000.0000',
			}),
			...makeMonthlyDetailLines({
				categoryKey: 'OPEX_CAT',
				lineItemKey: 'OPEX_AEFE',
				amount: '2000.0000',
			}),
		];

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'REVENUE',
				displayLabel: 'Revenue',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'POSITIVE',
				mappings: [
					{
						analyticalKey: 'TUITION_FEES',
						analyticalKeyType: 'CATEGORY',
						accountCode: '701100',
						monthFilter: [],
						displayLabel: 'Tuition',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
			{
				sectionKey: 'COST_OF_SERVICE',
				displayLabel: 'Cost of Service',
				displayOrder: 20,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'NEGATIVE',
				mappings: [
					{
						analyticalKey: 'OPEX_AEFE',
						analyticalKeyType: 'LINE_ITEM',
						accountCode: '648000',
						monthFilter: [],
						displayLabel: 'AEFE Fees',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
			{
				sectionKey: 'GROSS_PROFIT',
				displayLabel: 'Gross Profit',
				displayOrder: 30,
				isSubtotal: true,
				subtotalFormula: 'REVENUE - COST_OF_SERVICE',
				signConvention: 'POSITIVE',
				mappings: [],
			},
		];

		const result = transformToAccountingPnl(lines, template);

		const gp = result.sections.find((s) => s.sectionKey === 'GROSS_PROFIT')!;
		expect(gp).toBeDefined();
		expect(gp.isSubtotal).toBe(true);
		// Revenue = 12 * 10000 = 120000, COS = 12 * 2000 = 24000, GP = 96000
		expect(gp.budgetSubtotal).toBe('96000.0000');
	});

	it('computes variance when actuals are provided', () => {
		const lines = makeMonthlyDetailLines({
			categoryKey: 'TUITION_FEES',
			lineItemKey: 'TUITION_GRADE_A',
			amount: '10000.0000',
		});

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'REVENUE',
				displayLabel: 'Revenue',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'POSITIVE',
				mappings: [
					{
						analyticalKey: 'TUITION_FEES',
						analyticalKeyType: 'CATEGORY',
						accountCode: '701100',
						monthFilter: [],
						displayLabel: 'Tuition',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
		];

		const actuals: HistoricalActualInput[] = [
			{ accountCode: '701100', annualAmount: '100000.0000' },
		];

		const result = transformToAccountingPnl(lines, template, actuals);

		const rev = result.sections.find((s) => s.sectionKey === 'REVENUE')!;
		expect(rev).toBeDefined();

		// Budget = 120000, Actual = 100000
		const line = rev.lines[0]!;
		expect(line.budgetAmount).toBe('120000.0000');
		expect(line.actualAmount).toBe('100000.0000');
		// Variance = 120000 - 100000 = 20000
		expect(line.variance).toBe('20000.0000');
		// Variance pct = 20000 / |100000| * 100 = 20.00
		expect(line.variancePct).toBe('20.00');

		// Section-level variance
		expect(rev.actualSubtotal).toBe('100000.0000');
		expect(rev.varianceSubtotal).toBe('20000.0000');
		expect(rev.variancePctSubtotal).toBe('20.00');
	});

	it('handles empty actuals gracefully', () => {
		const lines = makeMonthlyDetailLines({
			categoryKey: 'TUITION_FEES',
			lineItemKey: 'TUITION_GRADE_A',
			amount: '10000.0000',
		});

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'REVENUE',
				displayLabel: 'Revenue',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'POSITIVE',
				mappings: [
					{
						analyticalKey: 'TUITION_FEES',
						analyticalKeyType: 'CATEGORY',
						accountCode: '701100',
						monthFilter: [],
						displayLabel: 'Tuition',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
		];

		// No actuals provided
		const result = transformToAccountingPnl(lines, template);

		const rev = result.sections.find((s) => s.sectionKey === 'REVENUE')!;
		expect(rev.lines[0]!.actualAmount).toBeUndefined();
		expect(rev.lines[0]!.variance).toBeUndefined();
		expect(rev.actualSubtotal).toBeUndefined();
		expect(rev.varianceSubtotal).toBeUndefined();
	});

	it('computes KPIs correctly', () => {
		const lines = [
			...makeMonthlyDetailLines({
				categoryKey: 'TUITION_FEES',
				lineItemKey: 'TUITION_GRADE_A',
				amount: '10000.0000',
			}),
			...makeMonthlyDetailLines({
				categoryKey: 'OPEX_CAT',
				lineItemKey: 'OPEX_AEFE',
				amount: '2000.0000',
			}),
		];

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'REVENUE',
				displayLabel: 'Revenue',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'POSITIVE',
				mappings: [
					{
						analyticalKey: 'TUITION_FEES',
						analyticalKeyType: 'CATEGORY',
						accountCode: '701100',
						monthFilter: [],
						displayLabel: 'Tuition',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
			{
				sectionKey: 'COST_OF_SERVICE',
				displayLabel: 'Cost of Service',
				displayOrder: 20,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'NEGATIVE',
				mappings: [
					{
						analyticalKey: 'OPEX_AEFE',
						analyticalKeyType: 'LINE_ITEM',
						accountCode: '648000',
						monthFilter: [],
						displayLabel: 'AEFE',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
			{
				sectionKey: 'GROSS_PROFIT',
				displayLabel: 'Gross Profit',
				displayOrder: 30,
				isSubtotal: true,
				subtotalFormula: 'REVENUE - COST_OF_SERVICE',
				signConvention: 'POSITIVE',
				mappings: [],
			},
			{
				sectionKey: 'EBITDA',
				displayLabel: 'EBITDA',
				displayOrder: 40,
				isSubtotal: true,
				subtotalFormula: 'GROSS_PROFIT',
				signConvention: 'POSITIVE',
				mappings: [],
			},
			{
				sectionKey: 'NET_PROFIT',
				displayLabel: 'Net Profit',
				displayOrder: 50,
				isSubtotal: true,
				subtotalFormula: 'EBITDA',
				signConvention: 'POSITIVE',
				mappings: [],
			},
		];

		const result = transformToAccountingPnl(lines, template);

		// Revenue = 120000, COS = 24000, GP = 96000
		expect(result.kpis.revenue).toBe('120000.0000');
		expect(result.kpis.grossProfit).toBe('96000.0000');
		// GP margin = 96000 / 120000 * 100 = 80.00
		expect(result.kpis.gpMargin).toBe('80.00');
		expect(result.kpis.ebitda).toBe('96000.0000');
		// EBITDA margin = 96000 / 120000 * 100 = 80.00
		expect(result.kpis.ebitdaMargin).toBe('80.00');
		expect(result.kpis.netProfit).toBe('96000.0000');
	});

	it('LINE_ITEM prefix matching catches safeKey-derived keys', () => {
		// The template maps "OPEX_AGENCE" but the engine produces
		// "OPEX_AGENCE_ENSEIGNEMENT_FRANCAIS" via safeKey(). Prefix matching
		// should catch this.
		const lines = makeMonthlyDetailLines({
			sectionKey: 'OTHER_OPEX',
			categoryKey: 'OPEX_OTHER_GENERAL',
			lineItemKey: 'OPEX_AGENCE_ENSEIGNEMENT_FRANCAIS',
			amount: '1000.0000',
		});

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'COST_OF_SERVICE',
				displayLabel: 'Cost of Service',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'NEGATIVE',
				mappings: [
					{
						analyticalKey: 'OPEX_AGENCE',
						analyticalKeyType: 'LINE_ITEM',
						accountCode: '648000',
						monthFilter: [],
						displayLabel: 'AEFE Fees',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
		];

		const result = transformToAccountingPnl(lines, template);
		const cos = result.sections.find((s) => s.sectionKey === 'COST_OF_SERVICE')!;

		// 12 * 1000 = 12000
		expect(cos.lines[0]!.budgetAmount).toBe('12000.0000');
		expect(cos.lines[0]!.displayLabel).toBe('AEFE Fees');
	});

	it('cross-section LINE_ITEM claims before CATEGORY in later section', () => {
		// EOS_PROVISION and GOSI_SAUDI are both under EMPLOYER_CHARGES category.
		// PROVISIONS section (order 10) has a LINE_ITEM mapping for EOS_PROVISION.
		// STAFF_COSTS section (order 20) has a CATEGORY mapping for EMPLOYER_CHARGES.
		// Even though PROVISIONS comes first, the global LINE_ITEM pass ensures
		// EOS_PROVISION is claimed before EMPLOYER_CHARGES can consume it.
		const lines = [
			...makeMonthlyDetailLines({
				categoryKey: 'EMPLOYER_CHARGES',
				lineItemKey: 'EOS_PROVISION',
				amount: '2000.0000',
			}),
			...makeMonthlyDetailLines({
				categoryKey: 'EMPLOYER_CHARGES',
				lineItemKey: 'GOSI_SAUDI',
				amount: '1500.0000',
			}),
		];

		const template: TemplateSectionInput[] = [
			// Staff costs first by display order
			{
				sectionKey: 'STAFF_COSTS',
				displayLabel: 'Staff Costs',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'NEGATIVE',
				mappings: [
					{
						analyticalKey: 'GOSI_SAUDI',
						analyticalKeyType: 'LINE_ITEM',
						accountCode: '645100',
						monthFilter: [],
						displayLabel: 'GOSI',
						visibility: 'SHOW',
						displayOrder: 10,
					},
					{
						analyticalKey: 'EMPLOYER_CHARGES',
						analyticalKeyType: 'CATEGORY',
						accountCode: '648030',
						monthFilter: [],
						displayLabel: 'Other Charges',
						visibility: 'SHOW',
						displayOrder: 20,
					},
				],
			},
			// Provisions second — its LINE_ITEM mapping should still claim EOS
			{
				sectionKey: 'PROVISIONS',
				displayLabel: 'Provisions',
				displayOrder: 20,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'NEGATIVE',
				mappings: [
					{
						analyticalKey: 'EOS_PROVISION',
						analyticalKeyType: 'LINE_ITEM',
						accountCode: '681750',
						monthFilter: [],
						displayLabel: 'EOS Provision',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
		];

		const result = transformToAccountingPnl(lines, template);

		// EOS claimed by PROVISIONS LINE_ITEM pass: 12 * 2000 = 24000
		const prov = result.sections.find((s) => s.sectionKey === 'PROVISIONS')!;
		expect(prov.lines[0]!.budgetAmount).toBe('24000.0000');

		// GOSI claimed by STAFF_COSTS LINE_ITEM: 12 * 1500 = 18000
		const staff = result.sections.find((s) => s.sectionKey === 'STAFF_COSTS')!;
		const gosiLine = staff.lines.find((l) => l.displayLabel === 'GOSI')!;
		expect(gosiLine.budgetAmount).toBe('18000.0000');

		// EMPLOYER_CHARGES CATEGORY gets zero (both lines already consumed)
		const otherLine = staff.lines.find((l) => l.displayLabel === 'Other Charges')!;
		expect(otherLine.budgetAmount).toBe('0.0000');
	});

	it('filters out non-detail rows (depth!=3, subtotals, separators)', () => {
		const lines: MonthlyPnlLineInput[] = [
			// Depth 1 header — should be filtered out
			{
				month: 1,
				sectionKey: 'REVENUE_CONTRACTS',
				categoryKey: 'REVENUE_CONTRACTS',
				lineItemKey: 'REVENUE_CONTRACTS_HEADER',
				displayLabel: 'Revenue from Contracts',
				depth: 1,
				amount: '0.0000',
				isSubtotal: false,
				isSeparator: false,
			},
			// Depth 2 category header — should be filtered out
			{
				month: 1,
				sectionKey: 'REVENUE_CONTRACTS',
				categoryKey: 'TUITION_FEES',
				lineItemKey: 'TUITION_FEES_HEADER',
				displayLabel: 'Tuition Fees',
				depth: 2,
				amount: '0.0000',
				isSubtotal: false,
				isSeparator: false,
			},
			// Subtotal — should be filtered out
			{
				month: 1,
				sectionKey: 'REVENUE_CONTRACTS',
				categoryKey: 'REVENUE_CONTRACTS',
				lineItemKey: 'REVENUE_CONTRACTS_SUBTOTAL',
				displayLabel: 'Revenue Subtotal',
				depth: 1,
				amount: '50000.0000',
				isSubtotal: true,
				isSeparator: false,
			},
			// Separator — should be filtered out
			{
				month: 1,
				sectionKey: 'SEPARATOR',
				categoryKey: 'SEPARATOR',
				lineItemKey: 'SEP_301',
				displayLabel: '',
				depth: 1,
				amount: '0.0000',
				isSubtotal: false,
				isSeparator: true,
			},
			// Depth 3 detail — should be included
			makeDetailLine({ month: 1, amount: '5000.0000' }),
		];

		const template: TemplateSectionInput[] = [
			{
				sectionKey: 'REVENUE',
				displayLabel: 'Revenue',
				displayOrder: 10,
				isSubtotal: false,
				subtotalFormula: null,
				signConvention: 'POSITIVE',
				mappings: [
					{
						analyticalKey: 'TUITION_FEES',
						analyticalKeyType: 'CATEGORY',
						accountCode: '701100',
						monthFilter: [],
						displayLabel: 'Tuition',
						visibility: 'SHOW',
						displayOrder: 10,
					},
				],
			},
		];

		const result = transformToAccountingPnl(lines, template);
		const rev = result.sections.find((s) => s.sectionKey === 'REVENUE')!;
		// Only the one depth-3 line should contribute
		expect(rev.lines[0]!.budgetAmount).toBe('5000.0000');
	});
});
