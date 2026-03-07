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

export { DISTRIBUTION_METHODS, IFRS_CATEGORIES } from './revenue.js';

export type {
	DistributionMethod,
	IfrsCategory,
	FeeGridEntry,
	DiscountEntry,
	OtherRevenueItem,
	MonthlyRevenueEntry,
	RevenueTotals,
	RevenueResultsResponse,
} from './revenue.js';
