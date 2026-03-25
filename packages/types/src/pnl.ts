// P&L Reporting types for @budfin/types

// ── P&L Format Modes ────────────────────────────────────────────────────────

export const PNL_FORMATS = ['summary', 'detailed', 'ifrs'] as const;
export type PnlFormat = (typeof PNL_FORMATS)[number];

// ── P&L Section Keys ────────────────────────────────────────────────────────

export const PNL_SECTION_KEYS = [
	'REVENUE_CONTRACTS',
	'RENTAL_INCOME',
	'TOTAL_REVENUE',
	'STAFF_COSTS',
	'OTHER_OPEX',
	'DEPRECIATION',
	'IMPAIRMENT',
	'TOTAL_OPEX',
	'OPERATING_PROFIT',
	'FINANCE_INCOME',
	'FINANCE_COSTS',
	'NET_FINANCE',
	'PROFIT_BEFORE_ZAKAT',
	'ZAKAT',
	'NET_PROFIT',
] as const;

export type PnlSectionKey = (typeof PNL_SECTION_KEYS)[number];

// ── P&L Sign Convention ─────────────────────────────────────────────────────

export const SIGN_CONVENTIONS = ['POSITIVE', 'NEGATIVE'] as const;
export type SignConvention = (typeof SIGN_CONVENTIONS)[number];

// ── P&L Line Item (API response shape) ──────────────────────────────────────

export interface PnlLineItem {
	sectionKey: string;
	categoryKey: string;
	lineItemKey: string;
	displayLabel: string;
	depth: 1 | 2 | 3;
	displayOrder: number;
	isSubtotal: boolean;
	isSeparator: boolean;
	monthlyAmounts: string[];
	annualTotal: string;
	// Comparison fields (present only when comparison_version_id is provided)
	comparisonMonthlyAmounts?: string[];
	comparisonAnnualTotal?: string;
	varianceMonthlyAmounts?: string[];
	varianceAnnualTotal?: string;
	varianceMonthlyPercents?: string[];
	varianceAnnualPercent?: string;
}

// ── P&L KPIs ────────────────────────────────────────────────────────────────

export interface PnlKpis {
	totalRevenueHt: string;
	ebitda: string;
	ebitdaMarginPct: string;
	netProfit: string;
}

// ── P&L Results Response ────────────────────────────────────────────────────

export interface PnlResultsResponse {
	lines: PnlLineItem[];
	kpis: PnlKpis;
	format: PnlFormat;
	calculatedAt: string;
}

// ── P&L Calculate Response ──────────────────────────────────────────────────

export interface PnlCalculateResponse {
	runId: string;
	durationMs: number;
	totalRevenueHt: string;
	totalStaffCosts: string;
	ebitda: string;
	ebitdaMarginPct: string;
	netProfit: string;
}

// ── Export Job Types ────────────────────────────────────────────────────────

export const EXPORT_REPORT_TYPES = [
	'PNL',
	'REVENUE',
	'STAFFING',
	'OPEX',
	'ENROLLMENT',
	'DASHBOARD',
	'FULL_BUDGET',
] as const;
export type ExportReportType = (typeof EXPORT_REPORT_TYPES)[number];

export const EXPORT_FORMATS = ['PDF', 'EXCEL'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_JOB_STATUSES = ['PENDING', 'PROCESSING', 'DONE', 'FAILED'] as const;
export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];

export interface ExportJobRequest {
	versionId: number;
	reportType: ExportReportType;
	format: ExportFormat;
	comparisonVersionId?: number;
}

export interface ExportJobResponse {
	id: number;
	status: ExportJobStatus;
	progress: number;
	downloadUrl?: string;
	errorMessage?: string;
	createdAt: string;
	completedAt?: string;
}
