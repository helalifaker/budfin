export const OTHER_REVENUE_COMPUTE_METHODS = [
	'DAI',
	'DPI',
	'FRAIS_DOSSIER',
	'EXAM_BAC',
	'EXAM_DNB',
	'EXAM_EAF',
	'EVAL_PRIMAIRE',
	'EVAL_SECONDAIRE',
] as const;
export type OtherRevenueComputeMethod = (typeof OTHER_REVENUE_COMPUTE_METHODS)[number];

export const DISTRIBUTION_METHODS = [
	'ACADEMIC_10',
	'YEAR_ROUND_12',
	'CUSTOM_WEIGHTS',
	'SPECIFIC_PERIOD',
] as const;
export type DistributionMethod = (typeof DISTRIBUTION_METHODS)[number];

export const IFRS_CATEGORIES = [
	'Registration Fees',
	'Activities & Services',
	'Examination Fees',
	'Other Revenue',
] as const;
export type IfrsCategory = (typeof IFRS_CATEGORIES)[number];

export type RevenueExecutiveCategory =
	| 'REGISTRATION_FEES'
	| 'ACTIVITIES_SERVICES'
	| 'EXAMINATION_FEES';

export type RevenueViewMode = 'category' | 'grade' | 'nationality' | 'tariff';

export type RevenueSettingsTab = 'feeGrid' | 'discounts' | 'otherRevenue';

export interface FeeGridEntry {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: 'Francais' | 'Nationaux' | 'Autres';
	tariff: 'RP' | 'R3+' | 'Plein';
	dai: string;
	tuitionTtc: string;
	tuitionHt: string;
	term1Amount: string;
	term2Amount: string;
	term3Amount: string;
}

export interface DiscountEntry {
	tariff: 'RP' | 'R3+';
	discountRate: string;
}

export interface OtherRevenueItem {
	id?: number;
	lineItemName: string;
	annualAmount: string;
	distributionMethod: DistributionMethod;
	weightArray: number[] | null;
	specificMonths: number[] | null;
	ifrsCategory: IfrsCategory;
	computeMethod: OtherRevenueComputeMethod | null;
}

export interface RevenueSettings {
	dpiPerStudentHt: string;
	dossierPerStudentHt: string;
	examBacPerStudent: string;
	examDnbPerStudent: string;
	examEafPerStudent: string;
	evalPrimairePerStudent: string;
	evalSecondairePerStudent: string;
	flatDiscountPct: string;
}

export interface MonthlyRevenueEntry {
	academicPeriod: string;
	gradeLevel: string;
	nationality: string;
	tariff: string;
	month: number;
	grossRevenueHt: string;
	discountAmount: string;
	scholarshipDeduction: string;
	netRevenueHt: string;
	vatAmount: string;
}

export interface MonthlyOtherRevenueEntry {
	lineItemName: string;
	ifrsCategory: IfrsCategory | string;
	executiveCategory: RevenueExecutiveCategory | null;
	includeInExecutiveSummary: boolean;
	month: number;
	amount: string;
}

export interface RevenueTotals {
	grossRevenueHt: string;
	discountAmount: string;
	netRevenueHt: string;
	vatAmount: string;
	otherRevenueAmount: string;
	totalOperatingRevenue: string;
}

export interface RevenueMatrixRow {
	section: string;
	label: string;
	monthlyAmounts: string[];
	annualTotal: string;
	percentageOfRevenue: string;
	isTotal: boolean;
}

export interface RevenueCompositionItem {
	label: string;
	amount: string;
	percentageOfRevenue: string;
}

export interface RevenueReadinessAreaStatus {
	ready: boolean;
}

export interface FeeGridReadiness extends RevenueReadinessAreaStatus {
	total: number;
	complete: number;
	settingsExist: boolean;
}

export interface DiscountReadiness extends RevenueReadinessAreaStatus {
	flatRate: string | null;
}

export interface OtherRevenueReadiness extends RevenueReadinessAreaStatus {
	total: number;
	configured: number;
}

export interface RevenueExecutiveSummary {
	rows: RevenueMatrixRow[];
	composition: RevenueCompositionItem[];
	monthlyTrend: Array<{
		month: number;
		amount: string;
	}>;
}

export interface RevenueReadinessResponse {
	feeGrid: FeeGridReadiness;
	discounts: DiscountReadiness;
	otherRevenue: OtherRevenueReadiness;
	overallReady: boolean;
	readyCount: number;
	totalCount: 3;
}

export interface RevenueResultsResponse {
	entries: MonthlyRevenueEntry[];
	otherRevenueEntries: MonthlyOtherRevenueEntry[];
	summary: Array<Record<string, string>>;
	totals: RevenueTotals;
	rowCount: number;
	revenueEngine: {
		rows: RevenueMatrixRow[];
	};
	executiveSummary: RevenueExecutiveSummary;
}

// ── Fee Schedule (EFIR 3-section layout) ────────────────────────────────────

export type FeeEditability = 'editable-source' | 'editable-fanout' | 'summary-only';

export interface FeeScheduleRow {
	id: string;
	label: string;
	editability: FeeEditability;
	dai?: string;
	tuitionTtc?: string;
	priorYearTtc?: string;
	increasePct?: string;
	tuitionHt?: string;
	term1?: string;
	term2?: string;
	term3?: string;
	totalTtc?: string;
	pleinHt?: string;
	rpHt?: string;
	r3Ht?: string;
	rpDiscount?: string;
	r3Discount?: string;
	francaisAmount?: string;
	nationauxAmount?: string;
	autresAmount?: string;
	underlyingGradeCount?: number;
	hasHeterogeneousValues?: boolean;
	sourceGrades?: string[];
	sourceNationality?: 'Francais' | 'Nationaux' | 'Autres';
	settingsField?: keyof RevenueSettings;
	childRows?: FeeScheduleRow[];
	note?: string;
	/** Dynamic per-nationality fields (e.g. dai_Francais, dai_Nationaux, dai_Autres) */
	[key: string]: string | number | boolean | string[] | FeeScheduleRow[] | undefined;
}

export interface FeeScheduleGroup {
	nationality: string;
	nationalityLabel: string;
	rows: FeeScheduleRow[];
}

export interface FeeScheduleSection {
	id: string;
	title: string;
	groups?: FeeScheduleGroup[];
	rows?: FeeScheduleRow[];
}
