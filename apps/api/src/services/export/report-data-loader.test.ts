import { describe, it, expect, vi } from 'vitest';
import { Decimal } from 'decimal.js';
import { loadReportData } from './report-data-loader.js';

// ── Mock Prisma Client ─────────────────────────────────────────────────────

function makeMockPrisma(overrides: Record<string, unknown> = {}) {
	return {
		budgetVersion: {
			findUnique: vi.fn().mockResolvedValue({
				id: 1,
				name: 'Budget FY2026',
				fiscalYear: 2026,
			}),
		},
		monthlyPnlLine: { findMany: vi.fn().mockResolvedValue([]) },
		monthlyRevenue: { findMany: vi.fn().mockResolvedValue([]) },
		monthlyStaffCost: { findMany: vi.fn().mockResolvedValue([]) },
		monthlyOpEx: { findMany: vi.fn().mockResolvedValue([]) },
		enrollmentHeadcount: { findMany: vi.fn().mockResolvedValue([]) },
		monthlyBudgetSummary: { findMany: vi.fn().mockResolvedValue([]) },
		...overrides,
	} as never;
}

describe('loadReportData', () => {
	it('returns basic metadata from version', async () => {
		const prisma = makeMockPrisma();
		const result = await loadReportData(prisma, 1, 'PNL');

		expect(result.versionName).toBe('Budget FY2026');
		expect(result.fiscalYear).toBe('FY2026');
		expect(result.generatedAt).toBeTruthy();
	});

	it('returns fallback metadata when version not found', async () => {
		const prisma = makeMockPrisma({
			budgetVersion: {
				findUnique: vi.fn().mockResolvedValue(null),
			},
		});

		const result = await loadReportData(prisma, 999, 'PNL');

		expect(result.versionName).toBe('Version 999');
		expect(result.fiscalYear).toBe('Unknown');
	});

	// ── PNL ─────────────────────────────────────────────────────────────

	it('loads PNL data with monthly lines', async () => {
		const prisma = makeMockPrisma({
			monthlyPnlLine: {
				findMany: vi.fn().mockResolvedValue([
					{
						sectionKey: 'revenue',
						categoryKey: 'tuition',
						lineItemKey: 'tuition_fees',
						displayLabel: 'Tuition Fees',
						displayOrder: 1,
						isSubtotal: false,
						isSeparator: false,
						month: 1,
						amount: new Decimal('100000'),
					},
					{
						sectionKey: 'revenue',
						categoryKey: 'tuition',
						lineItemKey: 'tuition_fees',
						displayLabel: 'Tuition Fees',
						displayOrder: 1,
						isSubtotal: false,
						isSeparator: false,
						month: 2,
						amount: new Decimal('110000'),
					},
				]),
			},
		});

		const result = await loadReportData(prisma, 1, 'PNL');
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0]!.title).toBe('P&L Income Statement');
		expect(result.sections[0]!.headers[0]).toBe('Line Item');
		expect(result.sections[0]!.rows).toHaveLength(1);
		// First column is the label
		expect(result.sections[0]!.rows[0]![0]).toBe('Tuition Fees');
		// Jan = 100000, Feb = 110000
		expect(result.sections[0]!.rows[0]![1]).toBe('100000.00');
		expect(result.sections[0]!.rows[0]![2]).toBe('110000.00');
		// Annual total
		const lastCol = result.sections[0]!.rows[0]!.length - 1;
		expect(result.sections[0]!.rows[0]![lastCol]).toBe('210000.00');
	});

	it('skips separator lines in PNL', async () => {
		const prisma = makeMockPrisma({
			monthlyPnlLine: {
				findMany: vi.fn().mockResolvedValue([
					{
						sectionKey: 'sep',
						categoryKey: 'sep',
						lineItemKey: 'sep_1',
						displayLabel: '---',
						displayOrder: 5,
						isSubtotal: false,
						isSeparator: true,
						month: 1,
						amount: new Decimal('0'),
					},
				]),
			},
		});

		const result = await loadReportData(prisma, 1, 'PNL');
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0]!.rows).toHaveLength(0);
	});

	it('returns empty sections when no PNL data', async () => {
		const prisma = makeMockPrisma();
		const result = await loadReportData(prisma, 1, 'PNL');
		expect(result.sections).toEqual([]);
	});

	// ── Revenue ─────────────────────────────────────────────────────────

	it('loads revenue data grouped by grade', async () => {
		const prisma = makeMockPrisma({
			monthlyRevenue: {
				findMany: vi.fn().mockResolvedValue([
					{
						gradeLevel: 'PS',
						scenarioName: 'Base',
						month: 1,
						grossRevenueHt: new Decimal('50000'),
						netRevenueHt: new Decimal('48000'),
					},
					{
						gradeLevel: 'PS',
						scenarioName: 'Base',
						month: 2,
						grossRevenueHt: new Decimal('50000'),
						netRevenueHt: new Decimal('48000'),
					},
				]),
			},
		});

		const result = await loadReportData(prisma, 1, 'REVENUE');
		expect(result.sections).toHaveLength(2); // gross + net
		expect(result.sections[0]!.title).toBe('Gross Revenue by Grade');
		expect(result.sections[1]!.title).toBe('Net Revenue by Grade');
		expect(result.sections[0]!.rows[0]![0]).toBe('PS');
	});

	it('returns empty sections when no revenue data', async () => {
		const prisma = makeMockPrisma();
		const result = await loadReportData(prisma, 1, 'REVENUE');
		expect(result.sections).toEqual([]);
	});

	// ── Staffing ────────────────────────────────────────────────────────

	it('loads staffing data grouped by employee', async () => {
		const prisma = makeMockPrisma({
			monthlyStaffCost: {
				findMany: vi.fn().mockResolvedValue([
					{
						employeeId: 1,
						month: 1,
						totalCost: new Decimal('15000'),
						employee: {
							name: 'Alice',
							department: 'Teaching',
							functionRole: 'Teacher',
						},
					},
					{
						employeeId: 1,
						month: 2,
						totalCost: new Decimal('15000'),
						employee: {
							name: 'Alice',
							department: 'Teaching',
							functionRole: 'Teacher',
						},
					},
				]),
			},
		});

		const result = await loadReportData(prisma, 1, 'STAFFING');
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0]!.title).toBe('Staff Costs by Employee');
		expect(result.sections[0]!.rows).toHaveLength(1);
		expect(result.sections[0]!.rows[0]![0]).toBe('Alice');
		expect(result.sections[0]!.rows[0]![1]).toBe('Teaching');
		expect(result.sections[0]!.rows[0]![2]).toBe('Teacher');
	});

	it('returns empty sections when no staffing data', async () => {
		const prisma = makeMockPrisma();
		const result = await loadReportData(prisma, 1, 'STAFFING');
		expect(result.sections).toEqual([]);
	});

	// ── OpEx ────────────────────────────────────────────────────────────

	it('loads OpEx data grouped by line item', async () => {
		const prisma = makeMockPrisma({
			monthlyOpEx: {
				findMany: vi.fn().mockResolvedValue([
					{
						lineItemId: 10,
						month: 1,
						amount: new Decimal('5000'),
						lineItem: {
							lineItemName: 'Office Supplies',
							sectionType: 'Operating',
							ifrsCategory: 'Admin',
						},
					},
				]),
			},
		});

		const result = await loadReportData(prisma, 1, 'OPEX');
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0]!.title).toBe('Operating & Non-Operating Expenses');
		expect(result.sections[0]!.rows[0]![0]).toBe('Office Supplies');
		expect(result.sections[0]!.rows[0]![1]).toBe('Operating');
		expect(result.sections[0]!.rows[0]![2]).toBe('Admin');
	});

	it('returns empty sections when no OpEx data', async () => {
		const prisma = makeMockPrisma();
		const result = await loadReportData(prisma, 1, 'OPEX');
		expect(result.sections).toEqual([]);
	});

	// ── Enrollment ──────────────────────────────────────────────────────

	it('loads enrollment data grouped by grade', async () => {
		const prisma = makeMockPrisma({
			enrollmentHeadcount: {
				findMany: vi.fn().mockResolvedValue([
					{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 25 },
					{ gradeLevel: 'PS', academicPeriod: 'AY2', headcount: 28 },
					{ gradeLevel: 'MS', academicPeriod: 'AY1', headcount: 30 },
					{ gradeLevel: 'MS', academicPeriod: 'AY2', headcount: 32 },
				]),
			},
		});

		const result = await loadReportData(prisma, 1, 'ENROLLMENT');
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0]!.title).toBe('Enrollment Headcounts');
		expect(result.sections[0]!.headers).toEqual([
			'Grade',
			'AY1 Headcount',
			'AY2 Headcount',
			'Delta',
		]);
		// PS row
		expect(result.sections[0]!.rows[0]).toEqual(['PS', '25', '28', '3']);
		// MS row
		expect(result.sections[0]!.rows[1]).toEqual(['MS', '30', '32', '2']);
		// TOTAL row (last)
		const lastRow = result.sections[0]!.rows[result.sections[0]!.rows.length - 1];
		expect(lastRow).toEqual(['TOTAL', '55', '60', '5']);
	});

	it('returns empty sections when no enrollment data', async () => {
		const prisma = makeMockPrisma();
		const result = await loadReportData(prisma, 1, 'ENROLLMENT');
		expect(result.sections).toEqual([]);
	});

	// ── Dashboard ───────────────────────────────────────────────────────

	it('loads dashboard summary data', async () => {
		const prisma = makeMockPrisma({
			monthlyBudgetSummary: {
				findMany: vi.fn().mockResolvedValue([
					{
						month: 1,
						revenueHt: new Decimal('100000'),
						staffCosts: new Decimal('60000'),
						opexCosts: new Decimal('10000'),
						ebitda: new Decimal('30000'),
						netProfit: new Decimal('30000'),
					},
				]),
			},
		});

		const result = await loadReportData(prisma, 1, 'DASHBOARD');
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0]!.title).toBe('Budget Dashboard Summary');
		expect(result.sections[0]!.headers).toEqual([
			'Month',
			'Revenue',
			'Staff Costs',
			'OpEx',
			'EBITDA',
			'Net Profit',
		]);
		// Data row + TOTAL row = 2 rows
		expect(result.sections[0]!.rows).toHaveLength(2);
		expect(result.sections[0]!.rows[0]![0]).toBe('Jan');
		expect(result.sections[0]!.rows[1]![0]).toBe('TOTAL');
	});

	it('returns empty sections when no dashboard data', async () => {
		const prisma = makeMockPrisma();
		const result = await loadReportData(prisma, 1, 'DASHBOARD');
		expect(result.sections).toEqual([]);
	});

	// ── FULL_BUDGET ─────────────────────────────────────────────────────

	it('combines all report types for FULL_BUDGET', async () => {
		const prisma = makeMockPrisma({
			monthlyPnlLine: {
				findMany: vi.fn().mockResolvedValue([
					{
						sectionKey: 'revenue',
						categoryKey: 'total',
						lineItemKey: 'total_revenue',
						displayLabel: 'Total Revenue',
						displayOrder: 1,
						isSubtotal: true,
						isSeparator: false,
						month: 1,
						amount: new Decimal('100000'),
					},
				]),
			},
			monthlyRevenue: {
				findMany: vi.fn().mockResolvedValue([
					{
						gradeLevel: 'PS',
						scenarioName: 'Base',
						month: 1,
						grossRevenueHt: new Decimal('50000'),
						netRevenueHt: new Decimal('48000'),
					},
				]),
			},
			monthlyStaffCost: {
				findMany: vi.fn().mockResolvedValue([
					{
						employeeId: 1,
						month: 1,
						totalCost: new Decimal('15000'),
						employee: { name: 'Alice', department: 'Teaching', functionRole: 'Teacher' },
					},
				]),
			},
			monthlyOpEx: {
				findMany: vi.fn().mockResolvedValue([
					{
						lineItemId: 10,
						month: 1,
						amount: new Decimal('5000'),
						lineItem: {
							lineItemName: 'Supplies',
							sectionType: 'Operating',
							ifrsCategory: 'Admin',
						},
					},
				]),
			},
			enrollmentHeadcount: {
				findMany: vi
					.fn()
					.mockResolvedValue([{ gradeLevel: 'PS', academicPeriod: 'AY1', headcount: 25 }]),
			},
			monthlyBudgetSummary: {
				findMany: vi.fn().mockResolvedValue([
					{
						month: 1,
						revenueHt: new Decimal('100000'),
						staffCosts: new Decimal('60000'),
						opexCosts: new Decimal('5000'),
						ebitda: new Decimal('35000'),
						netProfit: new Decimal('35000'),
					},
				]),
			},
		});

		const result = await loadReportData(prisma, 1, 'FULL_BUDGET');

		// FULL_BUDGET = dashboard + enrollment + revenue(gross+net) + staffing + opex + pnl
		// = 1 + 1 + 2 + 1 + 1 + 1 = 7 sections
		expect(result.sections.length).toBeGreaterThanOrEqual(7);
	});

	// ── Unknown report type ─────────────────────────────────────────────

	it('returns empty sections for unknown report type', async () => {
		const prisma = makeMockPrisma();
		const result = await loadReportData(prisma, 1, 'UNKNOWN_TYPE');
		expect(result.sections).toEqual([]);
	});
});
