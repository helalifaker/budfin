import type { GradeCode, AcademicPeriod, NationalityType } from './enrollment.js';

export interface PlanningRules {
	rolloverThreshold: number;
	cappedRetention: number;
}

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
	recommendationPriorAy1Headcount?: number | null;
	recommendationAy2Headcount?: number | null;
	recommendationRule?:
		| 'direct-entry'
		| 'capped-retention-growth'
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

export interface EnrollmentMasterGridRow {
	gradeLevel: GradeCode;
	gradeName: string;
	band: string;
	displayOrder: number;
	isPS: boolean;
	ay1Headcount: number;
	retentionRate: number;
	lateralEntry: number;
	ay2Headcount: number;
	sectionsNeeded: number;
	utilization: number;
	alert: 'OVER' | 'NEAR_CAP' | 'OK' | 'UNDER' | null;
	recruitmentSlots: number;
	isPersistedResult: boolean;
	hasManualOverride: boolean;
	hasBlockingIssue: boolean;
	issueTags: Array<'over-capacity' | 'near-cap' | 'missing-inputs' | 'manual-override'>;
}
