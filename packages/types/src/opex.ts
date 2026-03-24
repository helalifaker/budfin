// ── Operating Expenses & Non-Operating Items Types ───────────────────────────

export const OPEX_SECTION_TYPES = ['OPERATING', 'NON_OPERATING'] as const;
export type OpExSectionType = (typeof OPEX_SECTION_TYPES)[number];

export const OPEX_COMPUTE_METHODS = ['MANUAL', 'PERCENT_OF_REVENUE'] as const;
export type OpExComputeMethod = (typeof OPEX_COMPUTE_METHODS)[number];

export const OPEX_IFRS_CATEGORIES = [
	'Rent & Utilities',
	'Building Services',
	'Office & Supplies',
	'Insurance',
	'Professional Services',
	'IT & Telecom',
	'Other General',
	'School Materials',
	'Pedagogical',
	'Library & Subscriptions',
	'Evaluation & Testing',
	'Activities & Projects',
] as const;
export type OpExIfrsCategory = (typeof OPEX_IFRS_CATEGORIES)[number];

export const NON_OPERATING_IFRS_CATEGORIES = [
	'Depreciation',
	'Impairment',
	'Finance Income',
	'Finance Costs',
] as const;
export type NonOperatingIfrsCategory = (typeof NON_OPERATING_IFRS_CATEGORIES)[number];

export interface OpExLineItem {
	id: number;
	versionId: number;
	sectionType: OpExSectionType;
	ifrsCategory: string;
	lineItemName: string;
	displayOrder: number;
	computeMethod: OpExComputeMethod;
	computeRate: string | null;
	budgetV6Total: string | null;
	fy2025Actual: string | null;
	fy2024Actual: string | null;
	comment: string | null;
	monthlyAmounts: MonthlyOpExEntry[];
}

export interface MonthlyOpExEntry {
	month: number;
	amount: string;
}

export interface OpExLineItemsResponse {
	data: OpExLineItem[];
	summary: OpExSummary;
}

export interface OpExSummary {
	totalOperating: string;
	totalNonOperating: string;
	totalDepreciation: string;
	totalImpairment: string;
	totalFinanceIncome: string;
	totalFinanceCosts: string;
	operatingByCategory: Record<string, string>;
	monthlyOperatingTotals: string[];
	monthlyNonOperatingTotals: string[];
}

export interface OpExBulkUpdatePayload {
	lineItems: OpExLineItemUpdate[];
}

export interface OpExLineItemUpdate {
	id?: number;
	sectionType: OpExSectionType;
	ifrsCategory: string;
	lineItemName: string;
	displayOrder?: number;
	computeMethod?: OpExComputeMethod;
	computeRate?: string | null;
	budgetV6Total?: string | null;
	fy2025Actual?: string | null;
	fy2024Actual?: string | null;
	comment?: string | null;
	monthlyAmounts: MonthlyOpExEntry[];
}

export interface OpExCalculateResponse {
	lineItemCount: number;
	monthlyRecordCount: number;
	totalOperating: string;
	totalNonOperating: string;
}
