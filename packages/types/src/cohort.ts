import type { GradeCode, AcademicPeriod, NationalityType } from './enrollment.js';

export interface PlanningRules {
	rolloverThreshold: number;
	retentionRecentWeight: number;
	historicalTargetRecentWeight: number;
	cappedRetention?: number | undefined;
}

export interface EnrollmentCapacityByGradeSetting {
	gradeLevel: GradeCode;
	gradeName: string;
	band: string;
	displayOrder: number;
	defaultAy2Intake: number | null;
	maxClassSize: number;
	plancherPct: number;
	ciblePct: number;
	plafondPct: number;
	templateMaxClassSize: number;
	templatePlancherPct: number;
	templateCiblePct: number;
	templatePlafondPct: number;
}

export interface EnrollmentSettings {
	rules: PlanningRules;
	capacityByGrade: EnrollmentCapacityByGradeSetting[];
}

export interface EnrollmentSettingsUpdatePayload {
	rules: PlanningRules;
	capacityByGrade: Array<
		Pick<
			EnrollmentCapacityByGradeSetting,
			'gradeLevel' | 'maxClassSize' | 'plancherPct' | 'ciblePct' | 'plafondPct'
		>
	>;
}

export interface CohortParameterEntry {
	gradeLevel: GradeCode;
	retentionRate: number;
	manualAdjustment?: number;
	lateralEntryCount?: number;
	lateralWeightFr: number;
	lateralWeightNat: number;
	lateralWeightAut: number;
	isPersisted?: boolean;
	historicalTrendRatio?: number | null;
	historicalTrendRetention?: number | null;
	appliedRetentionRate?: number | null;
	retainedFromPrior?: number | null;
	historicalTargetHeadcount?: number | null;
	derivedLaterals?: number | null;
	ay2Headcount?: number | null;
	usesConfiguredRetention?: boolean;
	ratioObservationCount?: number;
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
	totalDelta?: number;
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
	trendRetentionRate?: number | null;
	retainedFromPrior?: number;
	historicalTargetHeadcount?: number | null;
	manualAdjustment?: number;
	usesConfiguredRetention?: boolean;
	lateralEntry: number;
	ay2Headcount: number;
	delta: number;
	maxClassSize: number;
	sectionsNeeded: number;
	utilization: number;
	plancher: number;
	cible: number;
	plafond: number;
	alert: 'OVER' | 'NEAR_CAP' | 'OK' | 'UNDER' | null;
	recruitmentSlots: number;
	isPersistedResult: boolean;
	hasManualOverride: boolean;
	hasBlockingIssue: boolean;
	issueTags: Array<'over-capacity' | 'near-cap' | 'missing-inputs' | 'manual-override'>;
}
