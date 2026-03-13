import { Decimal } from 'decimal.js';
import { GRADE_CODES, type GradeCode } from './enrollment.js';

export interface HistoricalHeadcountPoint {
	academicYear: number;
	gradeLevel: string;
	headcount: number;
}

/**
 * Rules that govern cohort-based enrollment calculations.
 *
 * Note: `cappedRetention` is intentionally absent here. It is applied at the
 * recommendation layer (`cohort-recommendations.ts`), which writes the capped
 * rate into `retentionRate` on the cohort parameter before the calculator runs.
 */
export interface CohortCalculationRules {
	rolloverThreshold: number;
	retentionRecentWeight: number;
	historicalTargetRecentWeight: number;
}

export interface CohortGradeCalculationInput {
	gradeLevel: GradeCode;
	feederAy1Headcount: number;
	configuredRetentionRate: number;
	manualAdjustment: number;
	historicalHeadcounts: HistoricalHeadcountPoint[];
	targetFiscalYear: number;
	planningRules: CohortCalculationRules;
	psAy2Headcount?: number;
}

export interface CohortGradeCalculationResult {
	gradeLevel: GradeCode;
	historicalTrendRatio: number | null;
	/** Clamped to [0, 1]. For the raw ratio (which can exceed 1 in growth cohorts), use historicalTrendRatio. */
	historicalTrendRetention: number | null;
	appliedRetentionRate: number;
	retainedFromPrior: number;
	historicalTargetHeadcount: number | null;
	derivedLaterals: number;
	manualAdjustment: number;
	ay2Headcount: number;
	usesConfiguredRetention: boolean;
	ratioObservationCount: number;
}

export const COHORT_GRADE_PROGRESSION = GRADE_CODES;

export function getPriorGradeLevel(gradeLevel: GradeCode): GradeCode | null {
	const index = COHORT_GRADE_PROGRESSION.indexOf(gradeLevel);
	if (index <= 0) {
		return null;
	}

	return COHORT_GRADE_PROGRESSION[index - 1] ?? null;
}

function roundToFourDecimals(value: number) {
	return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

function roundWholeStudent(value: number) {
	return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

function clampRate(rate: number) {
	return Math.max(0, Math.min(1, roundToFourDecimals(rate)));
}

function buildHeadcountIndex(points: HistoricalHeadcountPoint[]) {
	const index = new Map<number, Map<GradeCode, number>>();

	for (const point of points) {
		if (!COHORT_GRADE_PROGRESSION.includes(point.gradeLevel as GradeCode)) {
			continue;
		}

		const yearPoints = index.get(point.academicYear) ?? new Map<GradeCode, number>();
		yearPoints.set(point.gradeLevel as GradeCode, point.headcount);
		index.set(point.academicYear, yearPoints);
	}

	return index;
}

function getAvailableHistoricalYears(
	headcountIndex: Map<number, Map<GradeCode, number>>,
	targetFiscalYear: number
) {
	return [...headcountIndex.keys()]
		.filter((year) => year < targetFiscalYear)
		.sort((left, right) => right - left);
}

function getRetentionSmoothingWeights(observationCount: number, recentWeight: number) {
	if (observationCount <= 1) {
		return [1];
	}

	if (observationCount === 2) {
		return [recentWeight, 1 - recentWeight];
	}

	return [recentWeight, (1 - recentWeight) * (2 / 3), (1 - recentWeight) * (1 / 3)];
}

export function calculateHistoricalTrendRetention({
	gradeLevel,
	historicalHeadcounts,
	targetFiscalYear,
	recentWeight,
}: {
	gradeLevel: GradeCode;
	historicalHeadcounts: HistoricalHeadcountPoint[];
	targetFiscalYear: number;
	recentWeight: number;
}) {
	if (gradeLevel === 'PS') {
		return {
			historicalTrendRatio: null,
			historicalTrendRetention: null,
			ratioObservationCount: 0,
			ratios: [] as number[],
		};
	}

	const priorGrade = getPriorGradeLevel(gradeLevel);
	if (!priorGrade) {
		return {
			historicalTrendRatio: null,
			historicalTrendRetention: null,
			ratioObservationCount: 0,
			ratios: [] as number[],
		};
	}

	const headcountIndex = buildHeadcountIndex(historicalHeadcounts);
	const availableYears = getAvailableHistoricalYears(headcountIndex, targetFiscalYear);
	const ratios: number[] = [];

	for (const year of availableYears) {
		const currentGradeCount = headcountIndex.get(year)?.get(gradeLevel);
		const priorGradeCount = headcountIndex.get(year - 1)?.get(priorGrade);

		if (currentGradeCount === undefined || priorGradeCount === undefined || priorGradeCount <= 0) {
			continue;
		}

		ratios.push(currentGradeCount / priorGradeCount);
		if (ratios.length === 3) {
			break;
		}
	}

	if (ratios.length === 0) {
		return {
			historicalTrendRatio: null,
			historicalTrendRetention: null,
			ratioObservationCount: 0,
			ratios,
		};
	}

	const weights = getRetentionSmoothingWeights(ratios.length, recentWeight);
	const weightedRatio = ratios.reduce(
		(sum, ratio, index) => sum + ratio * (weights[index] ?? 0),
		0
	);
	const roundedRatio = roundToFourDecimals(weightedRatio);

	return {
		historicalTrendRatio: roundedRatio,
		historicalTrendRetention: clampRate(weightedRatio),
		ratioObservationCount: ratios.length,
		ratios,
	};
}

export function calculateHistoricalTargetHeadcount({
	gradeLevel,
	historicalHeadcounts,
	targetFiscalYear,
	recentWeight,
}: {
	gradeLevel: GradeCode;
	historicalHeadcounts: HistoricalHeadcountPoint[];
	targetFiscalYear: number;
	recentWeight: number;
}) {
	const headcountIndex = buildHeadcountIndex(historicalHeadcounts);
	const availableYears = getAvailableHistoricalYears(headcountIndex, targetFiscalYear);
	const latestYear = availableYears[0];
	const previousYear = availableYears[1];
	const latest =
		latestYear === undefined ? undefined : headcountIndex.get(latestYear)?.get(gradeLevel);
	const previous =
		previousYear === undefined ? undefined : headcountIndex.get(previousYear)?.get(gradeLevel);

	if (latest === undefined && previous === undefined) {
		return null;
	}

	if (latest !== undefined && previous === undefined) {
		return latest;
	}

	if (latest === undefined && previous !== undefined) {
		return previous;
	}

	return roundWholeStudent((latest ?? 0) * recentWeight + (previous ?? 0) * (1 - recentWeight));
}

export function calculateCohortGradeResult(
	input: CohortGradeCalculationInput
): CohortGradeCalculationResult {
	const {
		gradeLevel,
		feederAy1Headcount,
		configuredRetentionRate,
		manualAdjustment,
		historicalHeadcounts,
		targetFiscalYear,
		planningRules,
		psAy2Headcount = 0,
	} = input;

	if (gradeLevel === 'PS') {
		return {
			gradeLevel,
			historicalTrendRatio: null,
			historicalTrendRetention: null,
			appliedRetentionRate: 0,
			retainedFromPrior: 0,
			historicalTargetHeadcount: null,
			derivedLaterals: 0,
			manualAdjustment,
			ay2Headcount: psAy2Headcount,
			usesConfiguredRetention: false,
			ratioObservationCount: 0,
		};
	}

	const trendResult = calculateHistoricalTrendRetention({
		gradeLevel,
		historicalHeadcounts,
		targetFiscalYear,
		recentWeight: planningRules.retentionRecentWeight,
	});
	const historicalTargetHeadcount = calculateHistoricalTargetHeadcount({
		gradeLevel,
		historicalHeadcounts,
		targetFiscalYear,
		recentWeight: planningRules.historicalTargetRecentWeight,
	});

	const usesConfiguredRetention =
		trendResult.historicalTrendRatio !== null &&
		trendResult.historicalTrendRatio > planningRules.rolloverThreshold;
	const appliedRetentionRate = usesConfiguredRetention
		? clampRate(configuredRetentionRate)
		: (trendResult.historicalTrendRetention ?? clampRate(configuredRetentionRate));

	const retainedFromPrior = roundWholeStudent(feederAy1Headcount * appliedRetentionRate);
	const derivedLaterals =
		historicalTargetHeadcount === null
			? 0
			: Math.max(0, historicalTargetHeadcount - retainedFromPrior);
	const ay2Headcount = Math.max(0, retainedFromPrior + derivedLaterals + manualAdjustment);

	return {
		gradeLevel,
		historicalTrendRatio: trendResult.historicalTrendRatio,
		historicalTrendRetention: trendResult.historicalTrendRetention,
		appliedRetentionRate,
		retainedFromPrior,
		historicalTargetHeadcount,
		derivedLaterals,
		manualAdjustment,
		ay2Headcount,
		usesConfiguredRetention,
		ratioObservationCount: trendResult.ratioObservationCount,
	};
}
