export const DISTRIBUTION_METHODS = [
	'ACADEMIC_10',
	'YEAR_ROUND_12',
	'CUSTOM_WEIGHTS',
	'SPECIFIC_PERIOD',
] as const;
export type DistributionMethod = (typeof DISTRIBUTION_METHODS)[number];

export const IFRS_CATEGORIES = [
	'REVENUE_FROM_CONTRACTS',
	'OTHER_OPERATING_INCOME',
	'EMPLOYEE_BENEFITS_EXPENSE',
	'DEPRECIATION_AMORTIZATION',
	'OPERATING_EXPENSES',
	'FINANCE_INCOME',
	'FINANCE_COSTS',
	'ZAKAT',
] as const;
export type IfrsCategory = (typeof IFRS_CATEGORIES)[number];

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

export interface RevenueTotals {
	grossRevenueHt: string;
	discountAmount: string;
	netRevenueHt: string;
	vatAmount: string;
}

export interface RevenueResultsResponse {
	entries: MonthlyRevenueEntry[];
	summary: Array<Record<string, string>>;
	totals: RevenueTotals;
	rowCount: number;
}
