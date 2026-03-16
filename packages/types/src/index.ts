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
	DiscountEntry,
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
