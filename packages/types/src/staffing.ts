// Shared staffing types for @budfin/types
// Single source of truth for API response shapes

// ── Stale Module Constants ─────────────────────────────────────────────────

export const STAFFING_STALE_MODULES = ['STAFFING'] as const;
export type StaffingStaleModule = (typeof STAFFING_STALE_MODULES)[number];

// ── Cost Modes ─────────────────────────────────────────────────────────────

export const EMPLOYEE_COST_MODES = ['LOCAL_PAYROLL', 'AEFE_RECHARGE', 'NO_LOCAL_COST'] as const;
export type EmployeeCostMode = (typeof EMPLOYEE_COST_MODES)[number];

export const RECORD_TYPES = ['EMPLOYEE', 'VACANCY'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const COST_ASSUMPTION_CATEGORIES = [
	'REMPLACEMENTS',
	'FORMATION',
	'RESIDENT_SALAIRES',
	'RESIDENT_LOGEMENT',
	'RESIDENT_PENSION',
] as const;
export type CostAssumptionCategory = (typeof COST_ASSUMPTION_CATEGORIES)[number];

export const CALCULATION_MODES = ['FLAT_ANNUAL', 'PERCENT_OF_PAYROLL', 'AMOUNT_PER_FTE'] as const;
export type CalculationMode = (typeof CALCULATION_MODES)[number];

export const COVERAGE_STATUSES = ['COVERED', 'DEFICIT', 'SURPLUS', 'UNCOVERED'] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const LINE_TYPES = ['STRUCTURAL', 'HOST_COUNTRY', 'AUTONOMY', 'SPECIALTY'] as const;
export type LineType = (typeof LINE_TYPES)[number];

export const DRIVER_TYPES = ['HOURS', 'GROUPS'] as const;
export type DriverType = (typeof DRIVER_TYPES)[number];

export const BANDS = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;
export type Band = (typeof BANDS)[number];

export const ASSIGNMENT_SOURCES = ['MANUAL', 'AUTO_SUGGESTED', 'IMPORTED'] as const;
export type AssignmentSource = (typeof ASSIGNMENT_SOURCES)[number];

// ── Response Types ─────────────────────────────────────────────────────────

export interface StaffingSettings {
	id: number;
	versionId: number;
	hsaTargetHours: string;
	hsaFirstHourRate: string;
	hsaAdditionalHourRate: string;
	hsaMonths: number;
	academicWeeks: number;
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
	reconciliationBaseline: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
}

export interface ServiceObligationProfile {
	id: number;
	code: string;
	name: string;
	weeklyServiceHours: string;
	hsaEligible: boolean;
	defaultCostMode: string;
	sortOrder: number;
}

export interface ServiceProfileOverride {
	id: number;
	versionId: number;
	serviceProfileId: number;
	weeklyServiceHours: string | null;
	hsaEligible: boolean | null;
}

export interface CostAssumption {
	id: number;
	versionId: number;
	category: CostAssumptionCategory;
	calculationMode: CalculationMode;
	value: string;
}

export interface LyceeGroupAssumption {
	id: number;
	versionId: number;
	gradeLevel: string;
	disciplineId: number;
	groupCount: number;
	hoursPerGroup: string;
}

export interface DemandOverride {
	id: number;
	versionId: number;
	band: Band;
	disciplineId: number;
	lineType: LineType;
	overrideFte: string;
	reasonCode: string;
	note: string | null;
}

export interface TeachingRequirementLine {
	id: number;
	versionId: number;
	band: string;
	disciplineCode: string;
	lineLabel: string;
	lineType: string;
	driverType: string;
	serviceProfileCode: string;
	totalDriverUnits: number;
	totalWeeklyHours: string;
	baseOrs: string;
	effectiveOrs: string;
	requiredFteRaw: string;
	requiredFteCalculated: string | null;
	requiredFtePlanned: string;
	recommendedPositions: number;
	coveredFte: string;
	gapFte: string;
	coverageStatus: CoverageStatus;
	assignedStaffCount: number;
	vacancyCount: number;
	directCostAnnual: string;
	hsaCostAnnual: string;
	calculatedAt: string;
	assignedEmployees?: AssignmentSummary[];
}

export interface TeachingRequirementTotals {
	totalFteRaw: string;
	totalFteCovered: string;
	totalFteGap: string;
	totalDirectCost: string;
	totalHsaCost: string;
	lineCount: number;
}

export interface CoverageWarning {
	band: string;
	disciplineCode: string;
	lineType: string;
	coverageStatus: CoverageStatus;
	gapFte: string;
	requiredFtePlanned: string;
	coveredFte: string;
}

export interface TeachingRequirementsResponse {
	lines: TeachingRequirementLine[];
	totals: TeachingRequirementTotals;
	warnings: CoverageWarning[];
}

export interface TeachingRequirementSource {
	id: number;
	versionId: number;
	gradeLevel: string;
	disciplineId: number;
	lineType: string;
	driverType: string;
	headcount: number;
	maxClassSize: number;
	driverUnits: number;
	hoursPerUnit: string;
	totalWeeklyHours: string;
	calculatedAt: string;
}

export interface AssignmentSummary {
	id: number;
	employeeName: string;
	employeeCode: string;
	hoursPerWeek: string;
	fteShare: string;
}

export interface StaffingAssignment {
	id: number;
	versionId: number;
	employeeId: number;
	band: string;
	disciplineId: number;
	hoursPerWeek: string;
	fteShare: string;
	source: AssignmentSource;
	note: string | null;
	employeeName: string;
	employeeCode: string;
	costMode: string;
	disciplineCode: string;
	disciplineName: string;
	updatedAt: string;
}

export interface Employee {
	id: number;
	employeeCode: string;
	name: string;
	functionRole: string;
	department: string;
	status: string;
	joiningDate: string;
	paymentMethod: string;
	isSaudi: boolean;
	isAjeer: boolean;
	isTeaching: boolean;
	hourlyPercentage: string;
	baseSalary: string | null;
	housingAllowance: string | null;
	transportAllowance: string | null;
	responsibilityPremium: string | null;
	hsaAmount: string | null;
	augmentation: string | null;
	augmentationEffectiveDate: string | null;
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
	recordType: RecordType;
	costMode: EmployeeCostMode;
	disciplineId: number | null;
	serviceProfileId: number | null;
	homeBand: string | null;
	contractEndDate: string | null;
	disciplineName: string | null;
	serviceProfileName: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: number;
	updatedBy: number | null;
}

export interface AutoSuggestSuggestion {
	employeeId: number;
	employeeName: string;
	employeeCode: string;
	band: string;
	disciplineId: number;
	disciplineCode: string;
	hoursPerWeek: string;
	fteShare: string;
	confidence: 'High' | 'Medium';
	reason: string;
}

export interface AutoSuggestResponse {
	suggestions: AutoSuggestSuggestion[];
	summary: {
		totalSuggestions: number;
		highConfidence: number;
		mediumConfidence: number;
		unassignedRemaining: number;
	};
}

export interface Discipline {
	id: number;
	code: string;
	name: string;
	category: string;
	sortOrder: number;
}

export interface DisciplineAlias {
	id: number;
	alias: string;
	disciplineId: number;
}
