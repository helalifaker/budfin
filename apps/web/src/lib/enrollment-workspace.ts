import Decimal from 'decimal.js';
import type {
	CapacityAlert,
	CohortParameterEntry,
	EnrollmentMasterGridRow,
	GradeCode,
	NationalityBreakdownEntry,
	NationalityType,
	PlanningRules,
} from '@budfin/types';
import type { GradeLevel } from '../hooks/use-grade-levels';
import type { HeadcountRow } from '../hooks/use-enrollment';

export const ENROLLMENT_GRADE_PROGRESSION: GradeCode[] = [
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
];

export type EnrollmentEditability = 'editable' | 'locked' | 'viewer' | 'imported';

export const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

export interface CohortProjectionRow {
	gradeLevel: GradeCode;
	gradeName: string;
	band: GradeLevel['band'];
	displayOrder: number;
	isPS: boolean;
	ay1Headcount: number;
	retainedFromPrior: number;
	retentionRate: number;
	lateralEntry: number;
	ay2Headcount: number;
}

export interface CapacityPreviewRow {
	gradeLevel: string;
	academicPeriod: 'AY1' | 'AY2';
	headcount: number;
	maxClassSize: number;
	sectionsNeeded: number;
	utilization: number;
	alert: CapacityAlert | null;
	recruitmentSlots: number;
}

const DEFAULT_LATERAL_WEIGHTS: Record<NationalityType, number> = {
	Francais: 0.3333,
	Nationaux: 0.3334,
	Autres: 0.3333,
};

export const DEFAULT_PLANNING_RULES: PlanningRules = {
	rolloverThreshold: 1,
	cappedRetention: 0.98,
};

function getPriorGrade(gradeLevel: GradeCode): GradeCode | null {
	const index = ENROLLMENT_GRADE_PROGRESSION.indexOf(gradeLevel);
	if (index <= 0) {
		return null;
	}
	return ENROLLMENT_GRADE_PROGRESSION[index - 1] ?? null;
}

function normalizeLateralWeights(entry: CohortParameterEntry | undefined) {
	if (!entry || entry.lateralEntryCount <= 0) {
		return DEFAULT_LATERAL_WEIGHTS;
	}

	const weightSum = entry.lateralWeightFr + entry.lateralWeightNat + entry.lateralWeightAut;
	if (Math.abs(weightSum) < 0.0001) {
		return DEFAULT_LATERAL_WEIGHTS;
	}

	return {
		Francais: entry.lateralWeightFr,
		Nationaux: entry.lateralWeightNat,
		Autres: entry.lateralWeightAut,
	};
}

function reconcileCountsToTarget(
	counts: Array<{ nationality: NationalityType; headcount: number }>,
	target: number
) {
	if (counts.length === 0) {
		return counts;
	}

	const currentTotal = counts.reduce((sum, row) => sum + row.headcount, 0);
	const diff = target - currentTotal;

	if (diff === 0) {
		return counts;
	}

	let largestIndex = 0;
	for (let index = 1; index < counts.length; index += 1) {
		if (counts[index]!.headcount > counts[largestIndex]!.headcount) {
			largestIndex = index;
		}
	}

	counts[largestIndex] = {
		...counts[largestIndex]!,
		headcount: counts[largestIndex]!.headcount + diff,
	};
	return counts;
}

export function deriveEnrollmentEditability({
	role,
	versionStatus,
	dataSource,
}: {
	role?: string | null;
	versionStatus?: string | null;
	dataSource?: string | null;
}): EnrollmentEditability {
	if (role === 'Viewer') {
		return 'viewer';
	}

	if (versionStatus !== 'Draft') {
		return 'locked';
	}

	if (dataSource === 'IMPORTED') {
		return 'imported';
	}

	return 'editable';
}

export function buildAy1HeadcountMap(
	entries: Array<Pick<HeadcountRow, 'gradeLevel' | 'academicPeriod' | 'headcount'>>
) {
	const ay1Map = new Map<GradeCode, number>();
	for (const entry of entries) {
		if (entry.academicPeriod === 'AY1') {
			ay1Map.set(entry.gradeLevel as GradeCode, entry.headcount);
		}
	}
	return ay1Map;
}

export function getPsAy2Headcount(
	headcountEntries: Array<Pick<HeadcountRow, 'gradeLevel' | 'academicPeriod' | 'headcount'>>,
	ay1HeadcountMap: Map<GradeCode, number>,
	override?: number | null,
	defaultAy2Intake?: number | null
) {
	if (override !== null && override !== undefined) {
		return override;
	}

	const persistedPsAy2 = headcountEntries.find(
		(entry) => entry.gradeLevel === 'PS' && entry.academicPeriod === 'AY2'
	);

	return persistedPsAy2?.headcount ?? defaultAy2Intake ?? ay1HeadcountMap.get('PS') ?? 0;
}

function roundUpToFourDecimals(value: number) {
	const SCALE = new Decimal(10_000);
	return new Decimal(value).times(SCALE).ceil().div(SCALE).toNumber();
}

export function deriveRecommendationFromObservation({
	gradeLevel,
	priorAy1Headcount,
	ay2Headcount,
	planningRules = DEFAULT_PLANNING_RULES,
}: {
	gradeLevel: GradeCode;
	priorAy1Headcount: number | null | undefined;
	ay2Headcount: number | null | undefined;
	planningRules?: PlanningRules;
}) {
	if (gradeLevel === 'PS') {
		return {
			recommendedRetentionRate: 0,
			recommendedLateralEntryCount: 0,
			rolloverRatio: null,
			rule: 'direct-entry' as const,
		};
	}

	if (
		priorAy1Headcount === null ||
		priorAy1Headcount === undefined ||
		priorAy1Headcount <= 0 ||
		ay2Headcount === null ||
		ay2Headcount === undefined ||
		ay2Headcount < 0
	) {
		return {
			recommendedRetentionRate: planningRules.cappedRetention,
			recommendedLateralEntryCount: 0,
			rolloverRatio: null,
			rule: 'fallback-default' as const,
		};
	}

	const rolloverRatioD = new Decimal(ay2Headcount).div(priorAy1Headcount);
	const roundedRolloverRatio = rolloverRatioD.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();

	if (rolloverRatioD.toNumber() > planningRules.rolloverThreshold) {
		const retainedAtCappedRate = new Decimal(priorAy1Headcount)
			.times(planningRules.cappedRetention)
			.floor()
			.toNumber();
		return {
			recommendedRetentionRate: planningRules.cappedRetention,
			recommendedLateralEntryCount: Math.max(0, ay2Headcount - retainedAtCappedRate),
			rolloverRatio: roundedRolloverRatio,
			rule: 'capped-retention-growth' as const,
		};
	}

	const roundedHistoricalRetention = Math.min(roundUpToFourDecimals(rolloverRatioD.toNumber()), 1);
	const retainedFromHistoricalRate = new Decimal(priorAy1Headcount)
		.times(roundedHistoricalRetention)
		.floor()
		.toNumber();

	return {
		recommendedRetentionRate: roundedHistoricalRetention,
		recommendedLateralEntryCount: Math.max(0, ay2Headcount - retainedFromHistoricalRate),
		rolloverRatio: roundedRolloverRatio,
		rule: 'historical-rollover' as const,
	};
}

export function applyPlanningRulesToCohortEntries(
	entries: CohortParameterEntry[],
	planningRules: PlanningRules
) {
	return entries.map((entry) => {
		const recommendation = deriveRecommendationFromObservation({
			gradeLevel: entry.gradeLevel,
			priorAy1Headcount: entry.recommendationPriorAy1Headcount,
			ay2Headcount: entry.recommendationAy2Headcount,
			planningRules,
		});

		return {
			...entry,
			recommendedRetentionRate: recommendation.recommendedRetentionRate,
			recommendedLateralEntryCount: recommendation.recommendedLateralEntryCount,
			recommendationRolloverRatio: recommendation.rolloverRatio,
			recommendationRule: recommendation.rule,
		};
	});
}

export function isCohortEntryOverridden(entry: CohortParameterEntry) {
	const recommendedRetention = entry.recommendedRetentionRate ?? entry.retentionRate;
	const recommendedLaterals = entry.recommendedLateralEntryCount ?? entry.lateralEntryCount;
	return (
		Math.abs(entry.retentionRate - recommendedRetention) > 0.0001 ||
		entry.lateralEntryCount !== recommendedLaterals
	);
}

export function buildCohortProjectionRows({
	gradeLevels,
	ay1HeadcountMap,
	cohortEntries,
	psAy2Headcount,
	planningRules = DEFAULT_PLANNING_RULES,
}: {
	gradeLevels: GradeLevel[];
	ay1HeadcountMap: Map<GradeCode, number>;
	cohortEntries: CohortParameterEntry[];
	psAy2Headcount: number;
	planningRules?: PlanningRules;
}): CohortProjectionRow[] {
	const cohortMap = new Map(cohortEntries.map((entry) => [entry.gradeLevel, entry]));

	return [...gradeLevels]
		.sort((left, right) => left.displayOrder - right.displayOrder)
		.map((gradeLevel) => {
			const gradeCode = gradeLevel.gradeCode as GradeCode;
			const isPS = gradeCode === 'PS';
			const currentAy1 = ay1HeadcountMap.get(gradeCode) ?? 0;
			const cohortEntry = cohortMap.get(gradeCode);
			const retentionRate =
				cohortEntry?.retentionRate ?? (isPS ? 0 : planningRules.cappedRetention);
			const lateralEntry = cohortEntry?.lateralEntryCount ?? 0;
			const priorGrade = getPriorGrade(gradeCode);
			const priorAy1 = priorGrade ? (ay1HeadcountMap.get(priorGrade) ?? 0) : 0;
			const retainedFromPrior = isPS ? 0 : Math.floor(priorAy1 * retentionRate);

			return {
				gradeLevel: gradeCode,
				gradeName: gradeLevel.gradeName,
				band: gradeLevel.band,
				displayOrder: gradeLevel.displayOrder,
				isPS,
				ay1Headcount: currentAy1,
				retainedFromPrior,
				retentionRate,
				lateralEntry: isPS ? 0 : lateralEntry,
				ay2Headcount: isPS ? psAy2Headcount : retainedFromPrior + lateralEntry,
			};
		});
}

export function buildMasterGridRows({
	gradeLevels,
	ay1HeadcountMap,
	cohortEntries,
	psAy2Headcount,
	capacityResults,
	planningRules = DEFAULT_PLANNING_RULES,
}: {
	gradeLevels: GradeLevel[];
	ay1HeadcountMap: Map<GradeCode, number>;
	cohortEntries: CohortParameterEntry[];
	psAy2Headcount: number;
	capacityResults: CapacityPreviewRow[];
	planningRules?: PlanningRules;
}): EnrollmentMasterGridRow[] {
	const projectionRows = buildCohortProjectionRows({
		gradeLevels,
		ay1HeadcountMap,
		cohortEntries,
		psAy2Headcount,
		planningRules,
	});
	const ay2CapacityMap = new Map(
		capacityResults
			.filter((result) => result.academicPeriod === 'AY2')
			.map((result) => [result.gradeLevel, result] as const)
	);

	const cohortMap = new Map(cohortEntries.map((entry) => [entry.gradeLevel, entry]));

	return projectionRows.map((row) => {
		const capacityRow = ay2CapacityMap.get(row.gradeLevel);
		const cohortEntry = cohortMap.get(row.gradeLevel);
		const alert = capacityRow?.alert ?? null;
		const isPersistedResult = cohortEntry?.isPersisted === true;
		const hasManualOverride = cohortEntry ? isCohortEntryOverridden(cohortEntry) : false;
		const hasBlockingIssue = alert === 'OVER' || (row.ay1Headcount === 0 && !row.isPS);

		const issueTags: EnrollmentMasterGridRow['issueTags'] = [];
		if (alert === 'OVER') issueTags.push('over-capacity');
		if (alert === 'NEAR_CAP') issueTags.push('near-cap');
		if (hasManualOverride) issueTags.push('manual-override');
		if (row.ay1Headcount === 0 && !row.isPS) issueTags.push('missing-inputs');

		return {
			gradeLevel: row.gradeLevel,
			gradeName: row.gradeName,
			band: row.band,
			displayOrder: row.displayOrder,
			isPS: row.isPS,
			ay1Headcount: row.ay1Headcount,
			retentionRate: row.retentionRate,
			lateralEntry: row.lateralEntry,
			ay2Headcount: row.ay2Headcount,
			sectionsNeeded: capacityRow?.sectionsNeeded ?? 0,
			utilization: capacityRow?.utilization ?? 0,
			alert,
			recruitmentSlots: capacityRow?.recruitmentSlots ?? 0,
			isPersistedResult,
			hasManualOverride,
			hasBlockingIssue,
			issueTags,
		};
	});
}

export function buildNationalityPreviewRows({
	projectionRows,
	ay1NationalityEntries,
	cohortEntries,
}: {
	projectionRows: CohortProjectionRow[];
	ay1NationalityEntries: NationalityBreakdownEntry[];
	cohortEntries: CohortParameterEntry[];
}) {
	const ay1ByGrade = new Map<GradeCode, NationalityBreakdownEntry[]>();
	for (const entry of ay1NationalityEntries) {
		if (entry.academicPeriod !== 'AY1') {
			continue;
		}

		const entries = ay1ByGrade.get(entry.gradeLevel) ?? [];
		entries.push(entry);
		ay1ByGrade.set(entry.gradeLevel, entries);
	}

	const cohortMap = new Map(cohortEntries.map((entry) => [entry.gradeLevel, entry]));
	const results: NationalityBreakdownEntry[] = [];

	for (const row of projectionRows) {
		if (row.isPS) {
			const psEntries = ay1ByGrade.get(row.gradeLevel) ?? [];
			const psWeights =
				psEntries.length > 0
					? {
							Francais: psEntries.find((entry) => entry.nationality === 'Francais')?.weight ?? 0,
							Nationaux: psEntries.find((entry) => entry.nationality === 'Nationaux')?.weight ?? 0,
							Autres: psEntries.find((entry) => entry.nationality === 'Autres')?.weight ?? 0,
						}
					: DEFAULT_LATERAL_WEIGHTS;

			const counts = reconcileCountsToTarget(
				(Object.keys(psWeights) as NationalityType[]).map((nationality) => ({
					nationality,
					headcount: Math.round(row.ay2Headcount * psWeights[nationality]),
				})),
				row.ay2Headcount
			);

			for (const count of counts) {
				results.push({
					gradeLevel: row.gradeLevel,
					academicPeriod: 'AY2',
					nationality: count.nationality,
					headcount: count.headcount,
					weight:
						row.ay2Headcount > 0 ? Number((count.headcount / row.ay2Headcount).toFixed(4)) : 0,
					isOverridden: false,
				});
			}
			continue;
		}

		const priorGrade = getPriorGrade(row.gradeLevel);
		const priorEntries = priorGrade ? (ay1ByGrade.get(priorGrade) ?? []) : [];
		const cohortEntry = cohortMap.get(row.gradeLevel);
		const lateralWeights = normalizeLateralWeights(cohortEntry);

		const baselineEntries =
			priorEntries.length > 0
				? priorEntries
				: (Object.keys(DEFAULT_LATERAL_WEIGHTS) as NationalityType[]).map((nationality) => ({
						gradeLevel: row.gradeLevel,
						academicPeriod: 'AY1',
						nationality,
						weight: DEFAULT_LATERAL_WEIGHTS[nationality],
						headcount: 0,
						isOverridden: false,
					}));

		const counts = reconcileCountsToTarget(
			baselineEntries.map((entry) => ({
				nationality: entry.nationality,
				headcount:
					Math.floor(entry.headcount * row.retentionRate) +
					Math.round(row.lateralEntry * lateralWeights[entry.nationality]),
			})),
			row.ay2Headcount
		);

		for (const count of counts) {
			results.push({
				gradeLevel: row.gradeLevel,
				academicPeriod: 'AY2',
				nationality: count.nationality,
				headcount: count.headcount,
				weight: row.ay2Headcount > 0 ? Number((count.headcount / row.ay2Headcount).toFixed(4)) : 0,
				isOverridden: false,
			});
		}
	}

	return results;
}

export function buildCapacityPreviewRows({
	gradeLevels,
	ay1HeadcountMap,
	projectionRows,
	capacityOverrides,
}: {
	gradeLevels: GradeLevel[];
	ay1HeadcountMap: Map<GradeCode, number>;
	projectionRows: CohortProjectionRow[];
	capacityOverrides?: Map<string, number> | undefined;
}): CapacityPreviewRow[] {
	const gradeMap = new Map(gradeLevels.map((gradeLevel) => [gradeLevel.gradeCode, gradeLevel]));
	const rows: CapacityPreviewRow[] = [];

	for (const [gradeLevel, ay1Headcount] of ay1HeadcountMap) {
		const metadata = gradeMap.get(gradeLevel);
		if (!metadata) {
			continue;
		}
		const maxClassSize = capacityOverrides?.get(gradeLevel) ?? metadata.maxClassSize;
		rows.push(
			buildCapacityPreviewRow({
				gradeLevel,
				academicPeriod: 'AY1',
				headcount: ay1Headcount,
				maxClassSize,
				plafondPct: Number(metadata.plafondPct),
			})
		);
	}

	for (const row of projectionRows) {
		const metadata = gradeMap.get(row.gradeLevel);
		if (!metadata) {
			continue;
		}
		const maxClassSize = capacityOverrides?.get(row.gradeLevel) ?? metadata.maxClassSize;
		rows.push(
			buildCapacityPreviewRow({
				gradeLevel: row.gradeLevel,
				academicPeriod: 'AY2',
				headcount: row.ay2Headcount,
				maxClassSize,
				plafondPct: Number(metadata.plafondPct),
			})
		);
	}

	return rows;
}

export function buildCapacityPreviewRow({
	gradeLevel,
	academicPeriod,
	headcount,
	maxClassSize,
	plafondPct,
}: {
	gradeLevel: string;
	academicPeriod: 'AY1' | 'AY2';
	headcount: number;
	maxClassSize: number;
	plafondPct: number;
}): CapacityPreviewRow {
	if (headcount === 0 || maxClassSize === 0) {
		return {
			gradeLevel,
			academicPeriod,
			headcount,
			maxClassSize,
			sectionsNeeded: 0,
			utilization: 0,
			alert: null,
			recruitmentSlots: 0,
		};
	}

	const sectionsNeeded = Math.ceil(headcount / maxClassSize);
	const totalCapacity = sectionsNeeded * maxClassSize;
	const utilization = new Decimal(headcount)
		.div(totalCapacity)
		.times(100)
		.toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
		.toNumber();
	let alert: CapacityAlert | null = null;
	if (utilization > 100) {
		alert = 'OVER';
	} else if (utilization > 95) {
		alert = 'NEAR_CAP';
	} else if (utilization >= 70) {
		alert = 'OK';
	} else {
		alert = 'UNDER';
	}

	return {
		gradeLevel,
		academicPeriod,
		headcount,
		maxClassSize,
		sectionsNeeded,
		utilization,
		alert,
		recruitmentSlots: Math.floor(totalCapacity * plafondPct) - headcount,
	};
}

export function buildNationalityOverrideRows({
	gradeLevel,
	weights,
	ay2Headcount,
}: {
	gradeLevel: string;
	weights: Record<NationalityType, number>;
	ay2Headcount: number;
}) {
	const counts = reconcileCountsToTarget(
		(Object.keys(weights) as NationalityType[]).map((nationality) => ({
			nationality,
			headcount: Math.round(ay2Headcount * weights[nationality]),
		})),
		ay2Headcount
	);

	return counts.map((count) => ({
		gradeLevel,
		nationality: count.nationality,
		weight: weights[count.nationality],
		headcount: count.headcount,
	}));
}
