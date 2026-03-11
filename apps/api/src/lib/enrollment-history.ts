export const HISTORICAL_ENROLLMENT_FISCAL_YEARS = [2022, 2023, 2024, 2025, 2026] as const;

export type HistoricalEnrollmentPeriod = 'AY1' | 'AY2';

export interface HistoricalEnrollmentPeriodSource {
	academicPeriod: HistoricalEnrollmentPeriod;
	filename: string;
	schoolYearKey: string;
}

function formatSchoolYear(startYear: number) {
	return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export function getActualVersionName(fiscalYear: number) {
	return `Actual FY${fiscalYear}`;
}

export function getAy1SchoolYearKey(fiscalYear: number) {
	return formatSchoolYear(fiscalYear - 1);
}

export function getAy2SchoolYearKey(fiscalYear: number) {
	return formatSchoolYear(fiscalYear);
}

export function getHistoricalEnrollmentFilename(schoolYearKey: string) {
	return `enrollment_${schoolYearKey}.csv`;
}

export function getHistoricalEnrollmentSourcesForFiscalYear(
	fiscalYear: number
): HistoricalEnrollmentPeriodSource[] {
	const ay1SchoolYearKey = getAy1SchoolYearKey(fiscalYear);
	const ay2SchoolYearKey = getAy2SchoolYearKey(fiscalYear);

	return [
		{
			academicPeriod: 'AY1',
			schoolYearKey: ay1SchoolYearKey,
			filename: getHistoricalEnrollmentFilename(ay1SchoolYearKey),
		},
		{
			academicPeriod: 'AY2',
			schoolYearKey: ay2SchoolYearKey,
			filename: getHistoricalEnrollmentFilename(ay2SchoolYearKey),
		},
	];
}
