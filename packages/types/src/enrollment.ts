export const ACADEMIC_PERIODS = ['AY1', 'AY2'] as const;
export type AcademicPeriod = (typeof ACADEMIC_PERIODS)[number];

export const NATIONALITIES = ['Francais', 'Nationaux', 'Autres'] as const;
export type NationalityType = (typeof NATIONALITIES)[number];

export const TARIFFS = ['RP', 'R3+', 'Plein'] as const;
export type TariffType = (typeof TARIFFS)[number];

export const CAPACITY_ALERTS = ['OVER', 'NEAR_CAP', 'OK', 'UNDER'] as const;
export type CapacityAlert = (typeof CAPACITY_ALERTS)[number];

export const GRADE_CODES = [
	'PS',
	'MS',
	'GS',
	'CP',
	'CE1',
	'CE2',
	'CM1',
	'CM2',
	'6EME',
	'5EME',
	'4EME',
	'3EME',
	'2NDE',
	'1ERE',
	'TERM',
] as const;
export type GradeCode = (typeof GRADE_CODES)[number];

export const STALE_MODULES = ['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL'] as const;
export type StaleModule = (typeof STALE_MODULES)[number];

export interface HeadcountEntry {
	gradeLevel: GradeCode;
	academicPeriod: AcademicPeriod;
	headcount: number;
}

export interface DetailEntry {
	gradeLevel: GradeCode;
	academicPeriod: AcademicPeriod;
	nationality: NationalityType;
	tariff: TariffType;
	headcount: number;
}

export interface CapacityResult {
	gradeLevel: GradeCode;
	academicPeriod: AcademicPeriod;
	headcount: number;
	maxClassSize: number;
	sectionsNeeded: number;
	utilization: number;
	alert: CapacityAlert | null;
	recruitmentSlots: number;
}

export interface CapacitySummary {
	runId: string;
	durationMs: number;
	totalStudentsAy1: number;
	totalStudentsAy2: number;
	overCapacityGrades: string[];
	results: CapacityResult[];
}
