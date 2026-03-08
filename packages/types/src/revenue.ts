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
	nationality: 'Francais' | 'Nationaux' | 'Autres' | null;
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

export interface RevenueExecutiveSummary {
	rows: RevenueMatrixRow[];
	composition: RevenueCompositionItem[];
	monthlyTrend: Array<{
		month: number;
		amount: string;
	}>;
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
