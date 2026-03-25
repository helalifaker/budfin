import type { PrismaClient } from '@prisma/client/index.js';
import { Decimal } from 'decimal.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReportSection {
	title: string;
	headers: string[];
	rows: string[][];
}

export interface ReportData {
	versionName: string;
	fiscalYear: string;
	generatedAt: string;
	sections: ReportSection[];
}

// ── Month Labels ───────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(value: Decimal | { toString(): string } | string | number): string {
	const d = new Decimal(value.toString());
	return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

// ── PNL Loader ─────────────────────────────────────────────────────────────

async function loadPnlData(prisma: PrismaClient, versionId: number): Promise<ReportSection[]> {
	const rows = await prisma.monthlyPnlLine.findMany({
		where: { versionId },
		orderBy: [{ displayOrder: 'asc' }, { month: 'asc' }],
	});

	if (rows.length === 0) return [];

	// Group by line key
	const lineMap = new Map<
		string,
		{
			displayLabel: string;
			displayOrder: number;
			isSubtotal: boolean;
			isSeparator: boolean;
			amounts: Map<number, Decimal>;
		}
	>();

	for (const row of rows) {
		const key = `${row.sectionKey}|${row.categoryKey}|${row.lineItemKey}`;
		let entry = lineMap.get(key);
		if (!entry) {
			entry = {
				displayLabel: row.displayLabel,
				displayOrder: row.displayOrder,
				isSubtotal: row.isSubtotal,
				isSeparator: row.isSeparator,
				amounts: new Map(),
			};
			lineMap.set(key, entry);
		}
		entry.amounts.set(row.month, new Decimal(row.amount.toString()));
	}

	const sortedLines = [...lineMap.values()].sort((a, b) => a.displayOrder - b.displayOrder);

	const headers = ['Line Item', ...MONTHS, 'Annual Total'];
	const dataRows: string[][] = [];

	for (const line of sortedLines) {
		if (line.isSeparator) continue;
		const monthValues = MONTHS.map((_, i) => fmt(line.amounts.get(i + 1) ?? new Decimal(0)));
		const annual = fmt(
			Array.from({ length: 12 }, (_, i) => line.amounts.get(i + 1) ?? new Decimal(0)).reduce(
				(sum, v) => sum.plus(v),
				new Decimal(0)
			)
		);
		dataRows.push([line.displayLabel, ...monthValues, annual]);
	}

	return [{ title: 'P&L Income Statement', headers, rows: dataRows }];
}

// ── Revenue Loader ─────────────────────────────────────────────────────────

async function loadRevenueData(prisma: PrismaClient, versionId: number): Promise<ReportSection[]> {
	const revenues = await prisma.monthlyRevenue.findMany({
		where: { versionId, scenarioName: 'Base' },
		orderBy: [{ gradeLevel: 'asc' }, { month: 'asc' }],
	});

	if (revenues.length === 0) return [];

	// Aggregate by grade
	const gradeMap = new Map<
		string,
		{ grossByMonth: Map<number, Decimal>; netByMonth: Map<number, Decimal> }
	>();

	for (const rev of revenues) {
		let entry = gradeMap.get(rev.gradeLevel);
		if (!entry) {
			entry = { grossByMonth: new Map(), netByMonth: new Map() };
			gradeMap.set(rev.gradeLevel, entry);
		}
		const gross = entry.grossByMonth.get(rev.month) ?? new Decimal(0);
		entry.grossByMonth.set(rev.month, gross.plus(rev.grossRevenueHt.toString()));
		const net = entry.netByMonth.get(rev.month) ?? new Decimal(0);
		entry.netByMonth.set(rev.month, net.plus(rev.netRevenueHt.toString()));
	}

	const headers = ['Grade', ...MONTHS, 'Annual Total'];
	const grossRows: string[][] = [];
	const netRows: string[][] = [];

	for (const [grade, entry] of gradeMap) {
		const grossMonths = MONTHS.map((_, i) => fmt(entry.grossByMonth.get(i + 1) ?? new Decimal(0)));
		const grossTotal = fmt(
			Array.from({ length: 12 }, (_, i) => entry.grossByMonth.get(i + 1) ?? new Decimal(0)).reduce(
				(s, v) => s.plus(v),
				new Decimal(0)
			)
		);
		grossRows.push([grade, ...grossMonths, grossTotal]);

		const netMonths = MONTHS.map((_, i) => fmt(entry.netByMonth.get(i + 1) ?? new Decimal(0)));
		const netTotal = fmt(
			Array.from({ length: 12 }, (_, i) => entry.netByMonth.get(i + 1) ?? new Decimal(0)).reduce(
				(s, v) => s.plus(v),
				new Decimal(0)
			)
		);
		netRows.push([grade, ...netMonths, netTotal]);
	}

	return [
		{ title: 'Gross Revenue by Grade', headers, rows: grossRows },
		{ title: 'Net Revenue by Grade', headers, rows: netRows },
	];
}

// ── Staffing Loader ────────────────────────────────────────────────────────

async function loadStaffingData(prisma: PrismaClient, versionId: number): Promise<ReportSection[]> {
	const costs = await prisma.monthlyStaffCost.findMany({
		where: { versionId },
		include: { employee: { select: { name: true, department: true, functionRole: true } } },
		orderBy: [{ employeeId: 'asc' }, { month: 'asc' }],
	});

	if (costs.length === 0) return [];

	// Group by employee
	const empMap = new Map<
		number,
		{
			name: string;
			department: string;
			functionRole: string;
			totalByMonth: Map<number, Decimal>;
		}
	>();

	for (const cost of costs) {
		let entry = empMap.get(cost.employeeId);
		if (!entry) {
			entry = {
				name: cost.employee.name,
				department: cost.employee.department,
				functionRole: cost.employee.functionRole,
				totalByMonth: new Map(),
			};
			empMap.set(cost.employeeId, entry);
		}
		const existing = entry.totalByMonth.get(cost.month) ?? new Decimal(0);
		entry.totalByMonth.set(cost.month, existing.plus(cost.totalCost.toString()));
	}

	const headers = ['Employee', 'Department', 'Role', ...MONTHS, 'Annual Total'];
	const dataRows: string[][] = [];

	for (const entry of empMap.values()) {
		const monthValues = MONTHS.map((_, i) => fmt(entry.totalByMonth.get(i + 1) ?? new Decimal(0)));
		const annual = fmt(
			Array.from({ length: 12 }, (_, i) => entry.totalByMonth.get(i + 1) ?? new Decimal(0)).reduce(
				(s, v) => s.plus(v),
				new Decimal(0)
			)
		);
		dataRows.push([entry.name, entry.department, entry.functionRole, ...monthValues, annual]);
	}

	return [{ title: 'Staff Costs by Employee', headers, rows: dataRows }];
}

// ── OpEx Loader ────────────────────────────────────────────────────────────

async function loadOpExData(prisma: PrismaClient, versionId: number): Promise<ReportSection[]> {
	const opex = await prisma.monthlyOpEx.findMany({
		where: { versionId },
		include: {
			lineItem: {
				select: { lineItemName: true, sectionType: true, ifrsCategory: true },
			},
		},
		orderBy: [{ lineItemId: 'asc' }, { month: 'asc' }],
	});

	if (opex.length === 0) return [];

	// Group by line item
	const itemMap = new Map<
		number,
		{
			name: string;
			sectionType: string;
			category: string;
			amountByMonth: Map<number, Decimal>;
		}
	>();

	for (const entry of opex) {
		let item = itemMap.get(entry.lineItemId);
		if (!item) {
			item = {
				name: entry.lineItem.lineItemName,
				sectionType: entry.lineItem.sectionType,
				category: entry.lineItem.ifrsCategory,
				amountByMonth: new Map(),
			};
			itemMap.set(entry.lineItemId, item);
		}
		const existing = item.amountByMonth.get(entry.month) ?? new Decimal(0);
		item.amountByMonth.set(entry.month, existing.plus(entry.amount.toString()));
	}

	const headers = ['Line Item', 'Section', 'IFRS Category', ...MONTHS, 'Annual Total'];
	const dataRows: string[][] = [];

	for (const item of itemMap.values()) {
		const monthValues = MONTHS.map((_, i) => fmt(item.amountByMonth.get(i + 1) ?? new Decimal(0)));
		const annual = fmt(
			Array.from({ length: 12 }, (_, i) => item.amountByMonth.get(i + 1) ?? new Decimal(0)).reduce(
				(s, v) => s.plus(v),
				new Decimal(0)
			)
		);
		dataRows.push([item.name, item.sectionType, item.category, ...monthValues, annual]);
	}

	return [{ title: 'Operating & Non-Operating Expenses', headers, rows: dataRows }];
}

// ── Enrollment Loader ──────────────────────────────────────────────────────

async function loadEnrollmentData(
	prisma: PrismaClient,
	versionId: number
): Promise<ReportSection[]> {
	const headcounts = await prisma.enrollmentHeadcount.findMany({
		where: { versionId },
		orderBy: [{ gradeLevel: 'asc' }, { academicPeriod: 'asc' }],
	});

	if (headcounts.length === 0) return [];

	// Group by grade level, show AY1 and AY2
	const gradeMap = new Map<string, { ay1: number; ay2: number }>();
	for (const hc of headcounts) {
		let entry = gradeMap.get(hc.gradeLevel);
		if (!entry) {
			entry = { ay1: 0, ay2: 0 };
			gradeMap.set(hc.gradeLevel, entry);
		}
		if (hc.academicPeriod === 'AY1') entry.ay1 = hc.headcount;
		if (hc.academicPeriod === 'AY2') entry.ay2 = hc.headcount;
	}

	const headers = ['Grade', 'AY1 Headcount', 'AY2 Headcount', 'Delta'];
	const dataRows: string[][] = [];

	let totalAy1 = 0;
	let totalAy2 = 0;

	for (const [grade, entry] of gradeMap) {
		const delta = entry.ay2 - entry.ay1;
		dataRows.push([grade, String(entry.ay1), String(entry.ay2), String(delta)]);
		totalAy1 += entry.ay1;
		totalAy2 += entry.ay2;
	}

	dataRows.push(['TOTAL', String(totalAy1), String(totalAy2), String(totalAy2 - totalAy1)]);

	return [{ title: 'Enrollment Headcounts', headers, rows: dataRows }];
}

// ── Dashboard Loader ───────────────────────────────────────────────────────

async function loadDashboardData(
	prisma: PrismaClient,
	versionId: number
): Promise<ReportSection[]> {
	const summaryRows = await prisma.monthlyBudgetSummary.findMany({
		where: { versionId },
		orderBy: { month: 'asc' },
	});

	if (summaryRows.length === 0) return [];

	const headers = ['Month', 'Revenue', 'Staff Costs', 'OpEx', 'EBITDA', 'Net Profit'];

	const dataRows: string[][] = [];
	let totRevenue = new Decimal(0);
	let totStaff = new Decimal(0);
	let totOpex = new Decimal(0);
	let totEbitda = new Decimal(0);
	let totNet = new Decimal(0);

	for (const row of summaryRows) {
		const revenue = new Decimal(row.revenueHt.toString());
		const staff = new Decimal(row.staffCosts.toString());
		const opex = new Decimal(row.opexCosts.toString());
		const ebitda = new Decimal(row.ebitda.toString());
		const net = new Decimal(row.netProfit.toString());

		dataRows.push([
			MONTHS[row.month - 1] ?? String(row.month),
			fmt(revenue),
			fmt(staff),
			fmt(opex),
			fmt(ebitda),
			fmt(net),
		]);

		totRevenue = totRevenue.plus(revenue);
		totStaff = totStaff.plus(staff);
		totOpex = totOpex.plus(opex);
		totEbitda = totEbitda.plus(ebitda);
		totNet = totNet.plus(net);
	}

	dataRows.push([
		'TOTAL',
		fmt(totRevenue),
		fmt(totStaff),
		fmt(totOpex),
		fmt(totEbitda),
		fmt(totNet),
	]);

	return [{ title: 'Budget Dashboard Summary', headers, rows: dataRows }];
}

// ── Main Loader ────────────────────────────────────────────────────────────

export async function loadReportData(
	prisma: PrismaClient,
	versionId: number,
	reportType: string,
	_options?: { comparisonVersionId?: number }
): Promise<ReportData> {
	const version = await prisma.budgetVersion.findUnique({
		where: { id: versionId },
	});

	const versionName = version?.name ?? `Version ${versionId}`;
	const fiscalYear = version ? `FY${version.fiscalYear}` : 'Unknown';

	let sections: ReportSection[] = [];

	switch (reportType) {
		case 'PNL':
			sections = await loadPnlData(prisma, versionId);
			break;
		case 'REVENUE':
			sections = await loadRevenueData(prisma, versionId);
			break;
		case 'STAFFING':
			sections = await loadStaffingData(prisma, versionId);
			break;
		case 'OPEX':
			sections = await loadOpExData(prisma, versionId);
			break;
		case 'ENROLLMENT':
			sections = await loadEnrollmentData(prisma, versionId);
			break;
		case 'DASHBOARD':
			sections = await loadDashboardData(prisma, versionId);
			break;
		case 'FULL_BUDGET': {
			const pnl = await loadPnlData(prisma, versionId);
			const revenue = await loadRevenueData(prisma, versionId);
			const staffing = await loadStaffingData(prisma, versionId);
			const opex = await loadOpExData(prisma, versionId);
			const enrollment = await loadEnrollmentData(prisma, versionId);
			const dashboard = await loadDashboardData(prisma, versionId);
			sections = [...dashboard, ...enrollment, ...revenue, ...staffing, ...opex, ...pnl];
			break;
		}
	}

	return {
		versionName,
		fiscalYear,
		generatedAt: new Date().toISOString(),
		sections,
	};
}
