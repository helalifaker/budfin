import { Decimal } from 'decimal.js';
import { GRADE_PROGRESSION, type ProgressionGrade } from './cohort-engine.js';
import { type EnrollmentPlanningRules, resolveEnrollmentPlanningRules } from './planning-rules.js';

const ONE_DECIMAL = new Decimal(1);
const FOUR_DECIMAL_SCALE = new Decimal(10_000);

export type CohortRecommendationConfidence = 'high' | 'medium' | 'low';

export type CohortRecommendationRule =
	| 'direct-entry'
	| 'capped-retention-growth'
	| 'historical-rollover'
	| 'fallback-default';

export interface HistoricalCohortObservation {
	gradeLevel: ProgressionGrade;
	fiscalYear: number;
	priorAy1Headcount: number;
	ay2Headcount: number;
	rolloverRatio: number;
	recommendedRetentionRate: number;
	recommendedLateralEntryCount: number;
	rule: Exclude<CohortRecommendationRule, 'direct-entry' | 'fallback-default'>;
}

export interface CohortRecommendation {
	gradeLevel: ProgressionGrade;
	recommendedRetentionRate: number;
	recommendedLateralEntryCount: number;
	confidence: CohortRecommendationConfidence;
	observationCount: number;
	sourceFiscalYear: number | null;
	rolloverRatio: number | null;
	recommendationPriorAy1Headcount: number | null;
	recommendationAy2Headcount: number | null;
	rule: CohortRecommendationRule;
}

export interface ActualVersionCandidate {
	id: number;
	fiscalYear: number;
	status: string;
	updatedAt: Date;
}

export interface HistoricalHeadcountRow {
	versionId: number;
	academicPeriod: string;
	gradeLevel: string;
	headcount: number;
}

interface CohortRecommendationDbClient {
	budgetVersion: {
		findMany(args: {
			where: {
				type: 'Actual';
				fiscalYear: { lt: number };
			};
			select: {
				id: true;
				fiscalYear: true;
				status: true;
				updatedAt: true;
			};
			orderBy: Array<{ fiscalYear: 'desc' } | { updatedAt: 'desc' }>;
		}): Promise<ActualVersionCandidate[]>;
	};
	enrollmentHeadcount: {
		findMany(args: {
			where: {
				versionId: { in: number[] };
				academicPeriod: { in: ['AY1', 'AY2'] };
			};
			select: {
				versionId: true;
				academicPeriod: true;
				gradeLevel: true;
				headcount: true;
			};
		}): Promise<HistoricalHeadcountRow[]>;
	};
}

function roundUpToFourDecimals(value: Decimal) {
	return value.times(FOUR_DECIMAL_SCALE).ceil().div(FOUR_DECIMAL_SCALE);
}

function getPriorGrade(gradeLevel: ProgressionGrade): ProgressionGrade | null {
	const index = GRADE_PROGRESSION.indexOf(gradeLevel);
	if (index <= 0) {
		return null;
	}

	return GRADE_PROGRESSION[index - 1] ?? null;
}

export function pickCanonicalActualVersions(
	versions: ActualVersionCandidate[]
): ActualVersionCandidate[] {
	const byFiscalYear = new Map<number, ActualVersionCandidate[]>();

	for (const version of versions) {
		const entries = byFiscalYear.get(version.fiscalYear) ?? [];
		entries.push(version);
		byFiscalYear.set(version.fiscalYear, entries);
	}

	return [...byFiscalYear.entries()]
		.sort(([leftYear], [rightYear]) => rightYear - leftYear)
		.map(
			([, candidates]) =>
				[...candidates].sort((left, right) => {
					const leftRank = left.status === 'Locked' ? 0 : 1;
					const rightRank = right.status === 'Locked' ? 0 : 1;

					if (leftRank !== rightRank) {
						return leftRank - rightRank;
					}

					return right.updatedAt.getTime() - left.updatedAt.getTime();
				})[0]!
		);
}

export function buildHistoricalCohortObservations({
	headcounts,
	versionFiscalYears,
	planningRules,
}: {
	headcounts: HistoricalHeadcountRow[];
	versionFiscalYears: Map<number, number>;
	planningRules: EnrollmentPlanningRules;
}): HistoricalCohortObservation[] {
	const cappedRetentionDecimal = new Decimal(planningRules.cappedRetention);
	const rolloverThresholdDecimal = new Decimal(planningRules.rolloverThreshold);
	const rowsByVersion = new Map<number, Map<string, number>>();

	for (const row of headcounts) {
		const periodKey = `${row.academicPeriod}:${row.gradeLevel}`;
		const entries = rowsByVersion.get(row.versionId) ?? new Map<string, number>();
		entries.set(periodKey, row.headcount);
		rowsByVersion.set(row.versionId, entries);
	}

	const observations: HistoricalCohortObservation[] = [];

	for (const [versionId, versionRows] of rowsByVersion) {
		const fiscalYear = versionFiscalYears.get(versionId);
		if (!fiscalYear) {
			continue;
		}

		for (const gradeLevel of GRADE_PROGRESSION) {
			if (gradeLevel === 'PS') {
				continue;
			}

			const priorGrade = getPriorGrade(gradeLevel);
			if (!priorGrade) {
				continue;
			}

			const priorAy1Headcount = versionRows.get(`AY1:${priorGrade}`);
			const ay2Headcount = versionRows.get(`AY2:${gradeLevel}`);

			if (
				priorAy1Headcount === undefined ||
				ay2Headcount === undefined ||
				priorAy1Headcount <= 0 ||
				ay2Headcount < 0
			) {
				continue;
			}

			const rolloverRatio = new Decimal(ay2Headcount).div(priorAy1Headcount);

			if (rolloverRatio.greaterThan(rolloverThresholdDecimal)) {
				const retainedAtFixedRate = new Decimal(priorAy1Headcount)
					.times(cappedRetentionDecimal)
					.floor()
					.toNumber();

				observations.push({
					gradeLevel,
					fiscalYear,
					priorAy1Headcount,
					ay2Headcount,
					rolloverRatio: Number(rolloverRatio.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString()),
					recommendedRetentionRate: planningRules.cappedRetention,
					recommendedLateralEntryCount: Math.max(0, ay2Headcount - retainedAtFixedRate),
					rule: 'capped-retention-growth',
				});
				continue;
			}

			const roundedHistoricalRetention = Decimal.min(
				roundUpToFourDecimals(rolloverRatio),
				ONE_DECIMAL
			);
			const retainedFromHistoricalRate = new Decimal(priorAy1Headcount)
				.times(roundedHistoricalRetention)
				.floor()
				.toNumber();

			observations.push({
				gradeLevel,
				fiscalYear,
				priorAy1Headcount,
				ay2Headcount,
				rolloverRatio: Number(rolloverRatio.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString()),
				recommendedRetentionRate: Number(
					roundedHistoricalRetention.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString()
				),
				recommendedLateralEntryCount: Math.max(0, ay2Headcount - retainedFromHistoricalRate),
				rule: 'historical-rollover',
			});
		}
	}

	return observations.sort((left, right) => right.fiscalYear - left.fiscalYear);
}

export function buildCohortRecommendations(
	observations: HistoricalCohortObservation[],
	planningRules: EnrollmentPlanningRules = resolveEnrollmentPlanningRules()
): CohortRecommendation[] {
	const observationsByGrade = new Map<ProgressionGrade, HistoricalCohortObservation[]>();

	for (const observation of observations) {
		const entries = observationsByGrade.get(observation.gradeLevel) ?? [];
		entries.push(observation);
		observationsByGrade.set(observation.gradeLevel, entries);
	}

	return GRADE_PROGRESSION.map((gradeLevel) => {
		if (gradeLevel === 'PS') {
			return {
				gradeLevel,
				recommendedRetentionRate: 0,
				recommendedLateralEntryCount: 0,
				confidence: 'low' as const,
				observationCount: 0,
				sourceFiscalYear: null,
				rolloverRatio: null,
				recommendationPriorAy1Headcount: null,
				recommendationAy2Headcount: null,
				rule: 'direct-entry' as const,
			};
		}

		const gradeObservations = [...(observationsByGrade.get(gradeLevel) ?? [])].sort(
			(left, right) => right.fiscalYear - left.fiscalYear
		);
		const latestObservation = gradeObservations[0];
		const observationCount = gradeObservations.length;

		if (!latestObservation) {
			return {
				gradeLevel,
				recommendedRetentionRate: planningRules.cappedRetention,
				recommendedLateralEntryCount: 0,
				confidence: 'low' as const,
				observationCount,
				sourceFiscalYear: null,
				rolloverRatio: null,
				recommendationPriorAy1Headcount: null,
				recommendationAy2Headcount: null,
				rule: 'fallback-default' as const,
			};
		}

		const confidence: CohortRecommendationConfidence =
			observationCount >= 3 ? 'high' : observationCount === 2 ? 'medium' : 'low';

		return {
			gradeLevel,
			recommendedRetentionRate: latestObservation.recommendedRetentionRate,
			recommendedLateralEntryCount: latestObservation.recommendedLateralEntryCount,
			confidence,
			observationCount,
			sourceFiscalYear: latestObservation.fiscalYear,
			rolloverRatio: latestObservation.rolloverRatio,
			recommendationPriorAy1Headcount: latestObservation.priorAy1Headcount,
			recommendationAy2Headcount: latestObservation.ay2Headcount,
			rule: latestObservation.rule,
		};
	});
}

export async function getHistoricalCohortRecommendations(
	client: CohortRecommendationDbClient,
	targetFiscalYear: number,
	planningRules: EnrollmentPlanningRules = resolveEnrollmentPlanningRules()
): Promise<CohortRecommendation[]> {
	const versionCandidates = await client.budgetVersion.findMany({
		where: {
			type: 'Actual',
			fiscalYear: { lt: targetFiscalYear },
		},
		select: {
			id: true,
			fiscalYear: true,
			status: true,
			updatedAt: true,
		},
		orderBy: [{ fiscalYear: 'desc' }, { updatedAt: 'desc' }],
	});

	const actualVersions = pickCanonicalActualVersions(versionCandidates);
	if (actualVersions.length === 0) {
		return buildCohortRecommendations([], planningRules);
	}

	const headcounts = await client.enrollmentHeadcount.findMany({
		where: {
			versionId: { in: actualVersions.map((version) => version.id) },
			academicPeriod: { in: ['AY1', 'AY2'] },
		},
		select: {
			versionId: true,
			academicPeriod: true,
			gradeLevel: true,
			headcount: true,
		},
	});

	const versionFiscalYears = new Map(
		actualVersions.map((version) => [version.id, version.fiscalYear])
	);

	return buildCohortRecommendations(
		buildHistoricalCohortObservations({
			headcounts,
			versionFiscalYears,
			planningRules,
		}),
		planningRules
	);
}
