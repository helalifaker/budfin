// Shared TypeScript types for @budfin/types

export {
	ACADEMIC_PERIODS,
	NATIONALITIES,
	TARIFFS,
	CAPACITY_ALERTS,
	GRADE_CODES,
	STALE_MODULES,
} from './enrollment.js';

export type {
	AcademicPeriod,
	NationalityType,
	TariffType,
	CapacityAlert,
	GradeCode,
	StaleModule,
	HeadcountEntry,
	DetailEntry,
	CapacityResult,
	CapacitySummary,
} from './enrollment.js';

export type {
	CohortParameterEntry,
	NationalityBreakdownEntry,
	CohortProgressionRow,
	EnrollmentKpiData,
	PlanningRules,
	EnrollmentCapacityByGradeSetting,
	EnrollmentSettings,
	EnrollmentSettingsUpdatePayload,
	EnrollmentMasterGridRow,
} from './cohort.js';

export {
	COHORT_GRADE_PROGRESSION,
	calculateCohortGradeResult,
	calculateHistoricalTargetHeadcount,
	calculateHistoricalTrendRetention,
	getPriorGradeLevel,
} from './cohort-calculations.js';

export type {
	CohortCalculationRules,
	CohortGradeCalculationInput,
	CohortGradeCalculationResult,
	HistoricalHeadcountPoint,
} from './cohort-calculations.js';

export { DISTRIBUTION_METHODS, IFRS_CATEGORIES, OTHER_REVENUE_COMPUTE_METHODS } from './revenue.js';

export type {
	DistributionMethod,
	IfrsCategory,
	OtherRevenueComputeMethod,
	FeeGridEntry,
	RevenueViewMode,
	RevenueSettingsTab,
	OtherRevenueItem,
	RevenueSettings,
	MonthlyRevenueEntry,
	MonthlyOtherRevenueEntry,
	RevenueTotals,
	RevenueExecutiveCategory,
	RevenueMatrixRow,
	RevenueCompositionItem,
	RevenueReadinessAreaStatus,
	FeeGridReadiness,
	DiscountReadiness,
	OtherRevenueReadiness,
	RevenueExecutiveSummary,
	RevenueReadinessResponse,
	RevenueResultsResponse,
	FeeEditability,
	FeeScheduleRow,
	FeeScheduleGroup,
	FeeScheduleSection,
} from './revenue.js';

export {
	STAFFING_STALE_MODULES,
	EMPLOYEE_COST_MODES,
	RECORD_TYPES,
	COST_ASSUMPTION_CATEGORIES,
	CALCULATION_MODES,
	COVERAGE_STATUSES,
	LINE_TYPES,
	DRIVER_TYPES,
	BANDS,
	ASSIGNMENT_SOURCES,
} from './staffing.js';

export type {
	StaffingStaleModule,
	EmployeeCostMode,
	RecordType,
	CostAssumptionCategory,
	CalculationMode,
	CoverageStatus,
	LineType,
	DriverType,
	Band,
	AssignmentSource,
	StaffingSettings,
	ServiceObligationProfile,
	ServiceProfileOverride,
	CostAssumption,
	LyceeGroupAssumption,
	DemandOverride,
	TeachingRequirementLine,
	TeachingRequirementTotals,
	CoverageWarning,
	TeachingRequirementsResponse,
	TeachingRequirementSource,
	AssignmentSummary,
	StaffingAssignment,
	Employee,
	AutoSuggestSuggestion,
	AutoSuggestResponse,
	Discipline,
	DisciplineAlias,
} from './staffing.js';

export {
	OPEX_SECTION_TYPES,
	OPEX_COMPUTE_METHODS,
	OPEX_IFRS_CATEGORIES,
	NON_OPERATING_IFRS_CATEGORIES,
} from './opex.js';

export type {
	OpExSectionType,
	OpExComputeMethod,
	OpExIfrsCategory,
	NonOperatingIfrsCategory,
	OpExLineItem,
	MonthlyOpExEntry,
	OpExLineItemsResponse,
	OpExSummary,
	OpExBulkUpdatePayload,
	OpExLineItemUpdate,
	OpExCalculateResponse,
} from './opex.js';

export {
	PNL_FORMATS,
	PNL_SECTION_KEYS,
	SIGN_CONVENTIONS,
	EXPORT_REPORT_TYPES,
	EXPORT_FORMATS,
	EXPORT_JOB_STATUSES,
} from './pnl.js';

export type {
	PnlFormat,
	PnlSectionKey,
	SignConvention,
	PnlLineItem,
	PnlKpis,
	PnlResultsResponse,
	PnlCalculateResponse,
	ExportReportType,
	ExportFormat,
	ExportJobStatus,
	ExportJobRequest,
	ExportJobResponse,
} from './pnl.js';

export { SCENARIO_NAMES } from './scenario.js';

export type {
	ScenarioName,
	ScenarioParameters,
	ScenarioComparisonRow,
	ScenarioComparisonResponse,
} from './scenario.js';

export type { CommentResponse, CommentCountResponse } from './comment.js';
