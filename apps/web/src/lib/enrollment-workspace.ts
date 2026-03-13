import type {
	CapacityAlert,
	CohortParameterEntry,
	EnrollmentCapacityByGradeSetting,
	EnrollmentMasterGridRow,
	GradeCode,
	HistoricalHeadcountPoint,
	NationalityBreakdownEntry,
	NationalityType,
	PlanningRules,
} from '@budfin/types';
import { calculateCohortGradeResult } from '@budfin/types';
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
	band: EnrollmentGradeLevel['band'];
	displayOrder: number;
	isPS: boolean;
	ay1Headcount: number;
	retentionRate: number;
	trendRetentionRate: number | null;
	appliedRetentionRate: number;
	retainedFromPrior: number;
	historicalTargetHeadcount: number | null;
	manualAdjustment: number;
	lateralEntry: number;
	ay2Headcount: number;
	usesConfiguredRetention: boolean;
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

export interface EnrollmentGradeLevel {
	gradeCode: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	maxClassSize: number;
	defaultAy2Intake: number | null;
	plancherPct: number | string;
	ciblePct: number | string;
	plafondPct: number | string;
}

// Real EFIR distribution: ~34% Francais, ~2% Nationaux, ~64% Autres
const DEFAULT_NATIONALITY_WEIGHTS: Record<NationalityType, number> = {
	Francais: 0.3366,
	Nationaux: 0.0234,
	Autres: 0.64,
};

const CAPACITY_OK_UTILIZATION_THRESHOLD = 70;
const CAPACITY_NEAR_UTILIZATION_THRESHOLD = 95;

export const DEFAULT_PLANNING_RULES: PlanningRules = {
	rolloverThreshold: 1,
	retentionRecentWeight: 0.6,
	historicalTargetRecentWeight: 0.8,
	cappedRetention: 0.98,
};

export function resolveEnrollmentGradeLevels({
	gradeLevels,
	capacityByGrade,
}: {
	gradeLevels: EnrollmentGradeLevel[];
	capacityByGrade?: EnrollmentCapacityByGradeSetting[] | undefined;
}): EnrollmentGradeLevel[] {
	if (!capacityByGrade || capacityByGrade.length === 0) {
		return gradeLevels;
	}

	return [...capacityByGrade]
		.sort((left, right) => left.displayOrder - right.displayOrder)
		.map((row) => ({
			gradeCode: row.gradeLevel,
			gradeName: row.gradeName,
			band: row.band,
			displayOrder: row.displayOrder,
			maxClassSize: row.maxClassSize,
			defaultAy2Intake: row.defaultAy2Intake,
			plancherPct: row.plancherPct,
			ciblePct: row.ciblePct,
			plafondPct: row.plafondPct,
		}));
}

function getPriorGrade(gradeLevel: GradeCode): GradeCode | null {
	const index = ENROLLMENT_GRADE_PROGRESSION.indexOf(gradeLevel);
	if (index <= 0) {
		return null;
	}

	return ENROLLMENT_GRADE_PROGRESSION[index - 1] ?? null;
}

function normalizeWholeNumber(value: number | undefined | null) {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.round(value ?? 0);
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

function toHistoricalHeadcountPoints(historicalEntries: HistoricalHeadcountPoint[] | undefined) {
	return (historicalEntries ?? []).map((entry) => ({
		academicYear: entry.academicYear,
		gradeLevel: entry.gradeLevel,
		headcount: entry.headcount,
	}));
}

export function getCapacityAlertForUtilization(utilization: number): CapacityAlert | null {
	if (utilization <= 0) {
		return null;
	}

	if (utilization > 100) {
		return 'OVER';
	}

	if (utilization > CAPACITY_NEAR_UTILIZATION_THRESHOLD) {
		return 'NEAR_CAP';
	}

	if (utilization >= CAPACITY_OK_UTILIZATION_THRESHOLD) {
		return 'OK';
	}

	return 'UNDER';
}

function getCapacityAlert({
	headcount,
	utilization,
	plafond,
}: {
	headcount: number;
	utilization: number;
	plafond: number;
}): CapacityAlert | null {
	if (headcount <= 0) {
		return null;
	}

	if (headcount > plafond) {
		return 'OVER';
	}

	return getCapacityAlertForUtilization(utilization);
}

function getDefaultConfiguredRetentionRate(entry: CohortParameterEntry | undefined) {
	if (!entry) {
		return 1;
	}

	if (entry.gradeLevel === 'PS') {
		return 0;
	}

	if (entry.usesConfiguredRetention) {
		return entry.retentionRate;
	}

	return entry.historicalTrendRetention ?? entry.retentionRate;
}

function getDerivedCalculation({
	gradeLevel,
	cohortEntry,
	ay1HeadcountMap,
	psAy2Headcount,
	planningRules,
	historicalEntries,
	targetFiscalYear,
}: {
	gradeLevel: GradeCode;
	cohortEntry: CohortParameterEntry | undefined;
	ay1HeadcountMap: Map<GradeCode, number>;
	psAy2Headcount: number;
	planningRules: PlanningRules;
	historicalEntries?: HistoricalHeadcountPoint[] | undefined;
	targetFiscalYear?: number | undefined;
}) {
	const priorGrade = getPriorGrade(gradeLevel);
	const feederAy1Headcount = priorGrade ? (ay1HeadcountMap.get(priorGrade) ?? 0) : 0;
	const manualAdjustment = normalizeWholeNumber(
		cohortEntry?.manualAdjustment ?? cohortEntry?.lateralEntryCount ?? 0
	);

	if (historicalEntries && historicalEntries.length > 0) {
		const resolvedTargetFiscalYear =
			targetFiscalYear ?? Math.max(...historicalEntries.map((entry) => entry.academicYear)) + 1;

		return calculateCohortGradeResult({
			gradeLevel,
			feederAy1Headcount,
			configuredRetentionRate: getDefaultConfiguredRetentionRate(cohortEntry),
			manualAdjustment,
			historicalHeadcounts: toHistoricalHeadcountPoints(historicalEntries),
			targetFiscalYear: resolvedTargetFiscalYear,
			planningRules,
			psAy2Headcount,
		});
	}

	return {
		gradeLevel,
		historicalTrendRatio: cohortEntry?.historicalTrendRatio ?? null,
		historicalTrendRetention: cohortEntry?.historicalTrendRetention ?? null,
		appliedRetentionRate: cohortEntry?.appliedRetentionRate ?? cohortEntry?.retentionRate ?? 0,
		retainedFromPrior:
			cohortEntry?.retainedFromPrior ??
			Math.round(
				feederAy1Headcount * (cohortEntry?.appliedRetentionRate ?? cohortEntry?.retentionRate ?? 0)
			),
		historicalTargetHeadcount: cohortEntry?.historicalTargetHeadcount ?? null,
		derivedLaterals: cohortEntry?.derivedLaterals ?? 0,
		manualAdjustment,
		ay2Headcount:
			cohortEntry?.ay2Headcount ??
			Math.max(
				0,
				(cohortEntry?.retainedFromPrior ??
					Math.round(
						feederAy1Headcount *
							(cohortEntry?.appliedRetentionRate ?? cohortEntry?.retentionRate ?? 0)
					)) +
					(cohortEntry?.derivedLaterals ?? 0) +
					manualAdjustment
			),
		usesConfiguredRetention: cohortEntry?.usesConfiguredRetention ?? false,
		ratioObservationCount: cohortEntry?.ratioObservationCount ?? 0,
	};
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

export function applyPlanningRulesToCohortEntries({
	entries,
	planningRules,
	ay1HeadcountMap,
	historicalEntries,
	psAy2Headcount,
	targetFiscalYear,
}: {
	entries: CohortParameterEntry[];
	planningRules: PlanningRules;
	ay1HeadcountMap: Map<GradeCode, number>;
	historicalEntries: HistoricalHeadcountPoint[];
	psAy2Headcount: number;
	targetFiscalYear?: number | undefined;
}) {
	return entries.map((entry) => {
		const calculation = getDerivedCalculation({
			gradeLevel: entry.gradeLevel,
			cohortEntry: entry,
			ay1HeadcountMap,
			psAy2Headcount,
			planningRules,
			historicalEntries,
			targetFiscalYear,
		});

		return {
			...entry,
			historicalTrendRatio: calculation.historicalTrendRatio,
			historicalTrendRetention: calculation.historicalTrendRetention,
			appliedRetentionRate: calculation.appliedRetentionRate,
			retainedFromPrior: calculation.retainedFromPrior,
			historicalTargetHeadcount: calculation.historicalTargetHeadcount,
			derivedLaterals: calculation.derivedLaterals,
			manualAdjustment: calculation.manualAdjustment,
			lateralEntryCount: calculation.manualAdjustment,
			ay2Headcount: calculation.ay2Headcount,
			usesConfiguredRetention: calculation.usesConfiguredRetention,
			ratioObservationCount: calculation.ratioObservationCount,
			recommendedRetentionRate:
				entry.gradeLevel === 'PS'
					? 0
					: calculation.usesConfiguredRetention
						? entry.retentionRate
						: (calculation.historicalTrendRetention ?? entry.retentionRate),
			recommendedLateralEntryCount: calculation.derivedLaterals,
			recommendationConfidence:
				calculation.ratioObservationCount >= 3
					? 'high'
					: calculation.ratioObservationCount === 2
						? 'medium'
						: 'low',
			recommendationObservationCount: calculation.ratioObservationCount,
			recommendationSourceFiscalYear:
				historicalEntries.length > 0
					? Math.max(...historicalEntries.map((historicalEntry) => historicalEntry.academicYear))
					: null,
			recommendationRolloverRatio: calculation.historicalTrendRatio,
			recommendationPriorAy1Headcount:
				entry.gradeLevel === 'PS'
					? null
					: (ay1HeadcountMap.get(getPriorGrade(entry.gradeLevel) ?? entry.gradeLevel) ?? 0),
			recommendationAy2Headcount: calculation.ay2Headcount,
			recommendationRule:
				entry.gradeLevel === 'PS'
					? 'direct-entry'
					: calculation.ratioObservationCount === 0
						? 'fallback-default'
						: calculation.usesConfiguredRetention
							? 'capped-retention-growth'
							: 'historical-rollover',
		} satisfies CohortParameterEntry;
	});
}

export function isCohortEntryOverridden(entry: CohortParameterEntry) {
	const recommendedRetention =
		entry.gradeLevel === 'PS'
			? 0
			: entry.usesConfiguredRetention
				? (entry.recommendedRetentionRate ?? entry.retentionRate)
				: (entry.historicalTrendRetention ?? entry.recommendedRetentionRate ?? entry.retentionRate);
	const manualAdjustment = normalizeWholeNumber(entry.manualAdjustment ?? entry.lateralEntryCount);

	return Math.abs(entry.retentionRate - recommendedRetention) > 0.0001 || manualAdjustment !== 0;
}

export function buildCohortProjectionRows({
	gradeLevels,
	ay1HeadcountMap,
	cohortEntries,
	psAy2Headcount,
	planningRules = DEFAULT_PLANNING_RULES,
	historicalEntries,
	targetFiscalYear,
}: {
	gradeLevels: EnrollmentGradeLevel[];
	ay1HeadcountMap: Map<GradeCode, number>;
	cohortEntries: CohortParameterEntry[];
	psAy2Headcount: number;
	planningRules?: PlanningRules;
	historicalEntries?: HistoricalHeadcountPoint[] | undefined;
	targetFiscalYear?: number | undefined;
}): CohortProjectionRow[] {
	const cohortMap = new Map(cohortEntries.map((entry) => [entry.gradeLevel, entry]));

	return [...gradeLevels]
		.sort((left, right) => left.displayOrder - right.displayOrder)
		.map((gradeLevel) => {
			const gradeCode = gradeLevel.gradeCode as GradeCode;
			const isPS = gradeCode === 'PS';
			const cohortEntry = cohortMap.get(gradeCode);
			const calculation = getDerivedCalculation({
				gradeLevel: gradeCode,
				cohortEntry,
				ay1HeadcountMap,
				psAy2Headcount,
				planningRules,
				historicalEntries,
				targetFiscalYear,
			});

			return {
				gradeLevel: gradeCode,
				gradeName: gradeLevel.gradeName,
				band: gradeLevel.band,
				displayOrder: gradeLevel.displayOrder,
				isPS,
				ay1Headcount: ay1HeadcountMap.get(gradeCode) ?? 0,
				retentionRate: cohortEntry?.retentionRate ?? getDefaultConfiguredRetentionRate(cohortEntry),
				trendRetentionRate: calculation.historicalTrendRetention,
				appliedRetentionRate: calculation.appliedRetentionRate,
				retainedFromPrior: calculation.retainedFromPrior,
				historicalTargetHeadcount: calculation.historicalTargetHeadcount,
				manualAdjustment: calculation.manualAdjustment,
				lateralEntry: calculation.derivedLaterals,
				ay2Headcount: isPS ? psAy2Headcount : calculation.ay2Headcount,
				usesConfiguredRetention: calculation.usesConfiguredRetention,
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
	historicalEntries,
	targetFiscalYear,
}: {
	gradeLevels: EnrollmentGradeLevel[];
	ay1HeadcountMap: Map<GradeCode, number>;
	cohortEntries: CohortParameterEntry[];
	psAy2Headcount: number;
	capacityResults: CapacityPreviewRow[];
	planningRules?: PlanningRules;
	historicalEntries?: HistoricalHeadcountPoint[] | undefined;
	targetFiscalYear?: number | undefined;
}): EnrollmentMasterGridRow[] {
	const projectionRows = buildCohortProjectionRows({
		gradeLevels,
		ay1HeadcountMap,
		cohortEntries,
		psAy2Headcount,
		planningRules,
		historicalEntries,
		targetFiscalYear,
	});
	const ay2CapacityMap = new Map(
		capacityResults
			.filter((result) => result.academicPeriod === 'AY2')
			.map((result) => [result.gradeLevel, result] as const)
	);
	const gradeMap = new Map(gradeLevels.map((gradeLevel) => [gradeLevel.gradeCode, gradeLevel]));

	const cohortMap = new Map(cohortEntries.map((entry) => [entry.gradeLevel, entry]));

	return projectionRows.map((row) => {
		const capacityRow = ay2CapacityMap.get(row.gradeLevel);
		const cohortEntry = cohortMap.get(row.gradeLevel);
		const alert = capacityRow?.alert ?? null;
		const isPersistedResult = cohortEntry?.isPersisted === true;
		const hasManualOverride = cohortEntry
			? isCohortEntryOverridden(cohortEntry)
			: row.manualAdjustment !== 0;
		const hasBlockingIssue = alert === 'OVER' || (row.ay1Headcount === 0 && !row.isPS);

		const issueTags: EnrollmentMasterGridRow['issueTags'] = [];
		if (alert === 'OVER') issueTags.push('over-capacity');
		if (alert === 'NEAR_CAP') issueTags.push('near-cap');
		if (hasManualOverride) issueTags.push('manual-override');
		if (row.ay1Headcount === 0 && !row.isPS) issueTags.push('missing-inputs');

		const maxClassSize = capacityRow?.maxClassSize ?? 0;
		const sectionsNeeded = capacityRow?.sectionsNeeded ?? 0;
		const gradeConfig = gradeMap.get(row.gradeLevel);
		const plancherPct = Number(gradeConfig?.plancherPct ?? 0);
		const ciblePct = Number(gradeConfig?.ciblePct ?? 0);
		const plafondPct = Number(gradeConfig?.plafondPct ?? 0);

		return {
			gradeLevel: row.gradeLevel,
			gradeName: row.gradeName,
			band: row.band,
			displayOrder: row.displayOrder,
			isPS: row.isPS,
			ay1Headcount: row.ay1Headcount,
			retentionRate: row.retentionRate,
			trendRetentionRate: row.trendRetentionRate,
			retainedFromPrior: row.retainedFromPrior,
			historicalTargetHeadcount: row.historicalTargetHeadcount,
			manualAdjustment: row.manualAdjustment,
			lateralEntry: row.lateralEntry,
			ay2Headcount: row.ay2Headcount,
			delta: row.ay2Headcount - row.ay1Headcount,
			maxClassSize,
			sectionsNeeded,
			utilization: capacityRow?.utilization ?? 0,
			plancher: Math.floor(sectionsNeeded * maxClassSize * plancherPct),
			cible: Math.floor(sectionsNeeded * maxClassSize * ciblePct),
			plafond: Math.floor(sectionsNeeded * maxClassSize * plafondPct),
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
}: {
	projectionRows: CohortProjectionRow[];
	ay1NationalityEntries: NationalityBreakdownEntry[];
	cohortEntries?: CohortParameterEntry[];
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
					: DEFAULT_NATIONALITY_WEIGHTS;

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
		const baselineEntries =
			priorEntries.length > 0
				? priorEntries
				: (Object.keys(DEFAULT_NATIONALITY_WEIGHTS) as NationalityType[]).map((nationality) => ({
						gradeLevel: row.gradeLevel,
						academicPeriod: 'AY1',
						nationality,
						weight: DEFAULT_NATIONALITY_WEIGHTS[nationality],
						headcount: 0,
						isOverridden: false,
					}));

		const totalPriorHeadcount = baselineEntries.reduce((sum, entry) => sum + entry.headcount, 0);
		const counts = reconcileCountsToTarget(
			baselineEntries.map((entry) => {
				const sourceWeight =
					totalPriorHeadcount > 0 ? entry.headcount / totalPriorHeadcount : entry.weight;

				return {
					nationality: entry.nationality,
					headcount: Math.round(row.ay2Headcount * sourceWeight),
				};
			}),
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
	gradeLevels: EnrollmentGradeLevel[];
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
		const sectionsNeeded = maxClassSize > 0 ? Math.ceil(ay1Headcount / maxClassSize) : 0;
		const utilization =
			sectionsNeeded > 0 ? (ay1Headcount / (sectionsNeeded * maxClassSize)) * 100 : 0;
		const plafond = sectionsNeeded * maxClassSize * Number(metadata.plafondPct);

		rows.push({
			gradeLevel,
			academicPeriod: 'AY1',
			headcount: ay1Headcount,
			maxClassSize,
			sectionsNeeded,
			utilization: Number(utilization.toFixed(1)),
			alert: getCapacityAlert({ headcount: ay1Headcount, utilization, plafond }),
			recruitmentSlots: Math.max(0, sectionsNeeded * maxClassSize - ay1Headcount),
		});
	}

	for (const row of projectionRows) {
		const metadata = gradeMap.get(row.gradeLevel);
		if (!metadata) {
			continue;
		}

		const maxClassSize = capacityOverrides?.get(row.gradeLevel) ?? metadata.maxClassSize;
		const sectionsNeeded = maxClassSize > 0 ? Math.ceil(row.ay2Headcount / maxClassSize) : 0;
		const utilization =
			sectionsNeeded > 0 ? (row.ay2Headcount / (sectionsNeeded * maxClassSize)) * 100 : 0;
		const plafond = sectionsNeeded * maxClassSize * Number(metadata.plafondPct);

		rows.push({
			gradeLevel: row.gradeLevel,
			academicPeriod: 'AY2',
			headcount: row.ay2Headcount,
			maxClassSize,
			sectionsNeeded,
			utilization: Number(utilization.toFixed(1)),
			alert: getCapacityAlert({ headcount: row.ay2Headcount, utilization, plafond }),
			recruitmentSlots: Math.max(0, sectionsNeeded * maxClassSize - row.ay2Headcount),
		});
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
	const sectionsNeeded = maxClassSize > 0 ? Math.ceil(headcount / maxClassSize) : 0;
	const utilization = sectionsNeeded > 0 ? (headcount / (sectionsNeeded * maxClassSize)) * 100 : 0;
	const plafond = sectionsNeeded * maxClassSize * plafondPct;

	return {
		gradeLevel,
		academicPeriod,
		headcount,
		maxClassSize,
		sectionsNeeded,
		utilization: Number(utilization.toFixed(1)),
		alert: getCapacityAlert({ headcount, utilization, plafond }),
		recruitmentSlots: Math.max(0, sectionsNeeded * maxClassSize - headcount),
	};
}

export interface BandNationalitySummary {
	band: string;
	label: string;
	francaisPct: number;
	nationauxPct: number;
	autresPct: number;
	total: number;
}

const BAND_ORDER = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'];

export function buildBandNationalitySummary(
	nationalityEntries: NationalityBreakdownEntry[],
	gradeLevels: EnrollmentGradeLevel[]
): BandNationalitySummary[] {
	const gradeToBand = new Map(gradeLevels.map((gl) => [gl.gradeCode, gl.band]));
	const bandTotals = new Map<string, { francais: number; nationaux: number; autres: number }>();

	for (const entry of nationalityEntries) {
		const band = gradeToBand.get(entry.gradeLevel);
		if (!band) continue;

		let totals = bandTotals.get(band);
		if (!totals) {
			totals = { francais: 0, nationaux: 0, autres: 0 };
			bandTotals.set(band, totals);
		}

		if (entry.nationality === 'Francais') totals.francais += entry.headcount;
		else if (entry.nationality === 'Nationaux') totals.nationaux += entry.headcount;
		else if (entry.nationality === 'Autres') totals.autres += entry.headcount;
	}

	return BAND_ORDER.map((band) => {
		const totals = bandTotals.get(band) ?? { francais: 0, nationaux: 0, autres: 0 };
		const total = totals.francais + totals.nationaux + totals.autres;
		return {
			band,
			label: BAND_LABELS[band] ?? band,
			francaisPct: total > 0 ? (totals.francais / total) * 100 : 0,
			nationauxPct: total > 0 ? (totals.nationaux / total) * 100 : 0,
			autresPct: total > 0 ? (totals.autres / total) * 100 : 0,
			total,
		};
	});
}

export function buildNationalityOverrideRows({
	gradeLevel,
	weights,
	ay2Headcount,
}: {
	gradeLevel: string;
	weights: Record<NationalityType, number>;
	ay2Headcount: number;
}): NationalityBreakdownEntry[] {
	const counts = reconcileCountsToTarget(
		(Object.keys(weights) as NationalityType[]).map((nationality) => ({
			nationality,
			headcount: Math.round(ay2Headcount * (weights[nationality] ?? 0)),
		})),
		ay2Headcount
	);

	return counts.map((count) => ({
		gradeLevel: gradeLevel as GradeCode,
		academicPeriod: 'AY2',
		nationality: count.nationality,
		headcount: count.headcount,
		weight: ay2Headcount > 0 ? Number((count.headcount / ay2Headcount).toFixed(4)) : 0,
		isOverridden: true,
	}));
}
