import type { GradeCode, AcademicPeriod, NationalityType } from './enrollment.js';

export interface CohortParameterEntry {
	gradeLevel: GradeCode;
	retentionRate: number;
	lateralEntryCount: number;
	lateralWeightFr: number;
	lateralWeightNat: number;
	lateralWeightAut: number;
	isPersisted?: boolean;
	recommendedRetentionRate?: number;
	recommendedLateralEntryCount?: number;
	recommendationConfidence?: 'high' | 'medium' | 'low';
	recommendationObservationCount?: number;
	recommendationSourceFiscalYear?: number | null;
	recommendationRolloverRatio?: number | null;
	recommendationRule?:
		| 'direct-entry'
		| 'fixed-97-growth'
		| 'historical-rollover'
		| 'fallback-default';
}

export interface NationalityBreakdownEntry {
	gradeLevel: GradeCode;
	academicPeriod: AcademicPeriod;
	nationality: NationalityType;
	weight: number;
	headcount: number;
	isOverridden: boolean;
}

export interface CohortProgressionRow {
	gradeLevel: GradeCode;
	band: string;
	ay1Headcount: number;
	retainedFromPrior: number;
	lateralEntry: number;
	ay2Headcount: number;
}

export interface EnrollmentKpiData {
	totalAy1: number;
	totalAy2: number;
	utilizationPct: number;
	alertCount: number;
	isStale: boolean;
}
