import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { calculateCapacity, type GradeConfig } from './capacity-engine.js';
import {
	calculateCohortProgression,
	GRADE_PROGRESSION,
	type CohortParams,
} from './cohort-engine.js';
import { getHistoricalCohortRecommendations } from './cohort-recommendations.js';
import {
	calculateNationalityDistribution,
	computeWeightsFromHeadcounts,
	type NationalityInput,
} from './nationality-engine.js';

const DEFAULT_LATERAL_WEIGHTS = {
	Francais: '0.3333',
	Nationaux: '0.3334',
	Autres: '0.3333',
} as const;

const COHORT_WEIGHT_SUM_TOLERANCE = 0.0001;

export const ENROLLMENT_STALE_MODULES = [
	'ENROLLMENT',
	'REVENUE',
	'DHG',
	'STAFFING',
	'PNL',
] as const;

export type EnrollmentTransaction = Prisma.TransactionClient;

export interface EditableEnrollmentVersion {
	id: number;
	fiscalYear: number;
	staleModules: string[];
}

export interface EnrollmentCalculationActor {
	userId: number;
	userEmail: string;
	ipAddress: string;
}

export interface EnrollmentCalculationResponse {
	runId: string;
	durationMs: number;
	summary: {
		totalStudentsAy1: number;
		totalStudentsAy2: number;
		overCapacityGrades: string[];
	};
	results: Array<{
		gradeLevel: string;
		academicPeriod: string;
		headcount: number;
		maxClassSize: number;
		sectionsNeeded: number;
		utilization: number;
		alert: string | null;
		recruitmentSlots: number;
	}>;
}

interface CohortParameterWeights {
	lateralWeightFr: number;
	lateralWeightNat: number;
	lateralWeightAut: number;
}

interface CohortParameterMutation extends CohortParameterWeights {
	gradeLevel: string;
	retentionRate: number;
	lateralEntryCount: number;
}

function normalizeCohortWeights(entry: CohortParameterMutation): CohortParameterMutation {
	if (entry.lateralEntryCount <= 0) {
		return entry;
	}

	const weightSum = entry.lateralWeightFr + entry.lateralWeightNat + entry.lateralWeightAut;

	if (Math.abs(weightSum) <= COHORT_WEIGHT_SUM_TOLERANCE) {
		return {
			...entry,
			lateralWeightFr: Number(DEFAULT_LATERAL_WEIGHTS.Francais),
			lateralWeightNat: Number(DEFAULT_LATERAL_WEIGHTS.Nationaux),
			lateralWeightAut: Number(DEFAULT_LATERAL_WEIGHTS.Autres),
		};
	}

	return entry;
}

export function normalizeCohortMutations<T extends CohortParameterMutation>(entries: T[]): T[] {
	return entries.map((entry) => normalizeCohortWeights(entry) as T);
}

function buildLateralWeightMap(
	entry: CohortParameterWeights | null | undefined,
	lateralEntryCount: number
): Map<string, string> {
	if (lateralEntryCount <= 0) {
		return new Map([
			['Francais', '0.0000'],
			['Nationaux', '0.0000'],
			['Autres', '0.0000'],
		]);
	}

	const normalized = entry
		? normalizeCohortWeights({
				gradeLevel: 'TMP',
				retentionRate: 0,
				lateralEntryCount,
				lateralWeightFr: entry.lateralWeightFr,
				lateralWeightNat: entry.lateralWeightNat,
				lateralWeightAut: entry.lateralWeightAut,
			})
		: {
				gradeLevel: 'TMP',
				retentionRate: 0,
				lateralEntryCount,
				lateralWeightFr: Number(DEFAULT_LATERAL_WEIGHTS.Francais),
				lateralWeightNat: Number(DEFAULT_LATERAL_WEIGHTS.Nationaux),
				lateralWeightAut: Number(DEFAULT_LATERAL_WEIGHTS.Autres),
			};

	return new Map([
		['Francais', String(normalized.lateralWeightFr)],
		['Nationaux', String(normalized.lateralWeightNat)],
		['Autres', String(normalized.lateralWeightAut)],
	]);
}

function buildVersionStaleModules(staleModules: string[]) {
	return [...new Set([...staleModules, ...ENROLLMENT_STALE_MODULES])];
}

export async function markEnrollmentInputsStale(
	tx: EnrollmentTransaction,
	versionId: number,
	staleModules: string[]
) {
	const nextModules = buildVersionStaleModules(staleModules);
	await tx.budgetVersion.update({
		where: { id: versionId },
		data: { staleModules: nextModules },
	});
	return nextModules;
}

export async function calculateAndPersistEnrollmentWorkspace({
	tx,
	versionId,
	version,
	actor,
}: {
	tx: EnrollmentTransaction;
	versionId: number;
	version: EditableEnrollmentVersion;
	actor: EnrollmentCalculationActor;
}): Promise<EnrollmentCalculationResponse> {
	const startTime = performance.now();
	const runId = randomUUID();

	const cohortParamRows = await tx.cohortParameter.findMany({
		where: { versionId },
		select: {
			gradeLevel: true,
			retentionRate: true,
			lateralEntryCount: true,
			lateralWeightFr: true,
			lateralWeightNat: true,
			lateralWeightAut: true,
		},
	});
	const recommendationMap = new Map(
		(await getHistoricalCohortRecommendations(tx, version.fiscalYear)).map(
			(recommendation) => [recommendation.gradeLevel, recommendation] as const
		)
	);

	const cohortParams = new Map<string, CohortParams>();
	const cohortWeightMap = new Map<
		string,
		{
			lateralWeightFr: number;
			lateralWeightNat: number;
			lateralWeightAut: number;
			lateralEntryCount: number;
		}
	>();

	for (const row of cohortParamRows) {
		cohortParams.set(row.gradeLevel, {
			retentionRate: String(row.retentionRate),
			lateralEntryCount: row.lateralEntryCount,
		});
		cohortWeightMap.set(row.gradeLevel, {
			lateralWeightFr: Number(row.lateralWeightFr),
			lateralWeightNat: Number(row.lateralWeightNat),
			lateralWeightAut: Number(row.lateralWeightAut),
			lateralEntryCount: row.lateralEntryCount,
		});
	}

	for (const gradeLevel of GRADE_PROGRESSION) {
		if (cohortParams.has(gradeLevel)) {
			continue;
		}

		const recommendation = recommendationMap.get(gradeLevel);
		cohortParams.set(gradeLevel, {
			retentionRate: String(
				recommendation?.recommendedRetentionRate ?? (gradeLevel === 'PS' ? 0 : 0.97)
			),
			lateralEntryCount: recommendation?.recommendedLateralEntryCount ?? 0,
		});
		cohortWeightMap.set(gradeLevel, {
			lateralWeightFr: 0,
			lateralWeightNat: 0,
			lateralWeightAut: 0,
			lateralEntryCount: recommendation?.recommendedLateralEntryCount ?? 0,
		});
	}

	const allHeadcounts = await tx.enrollmentHeadcount.findMany({
		where: { versionId },
	});

	const ay1Headcounts = new Map<string, number>();
	let existingAy2PsHeadcount: number | null = null;

	for (const row of allHeadcounts) {
		if (row.academicPeriod === 'AY1') {
			ay1Headcounts.set(row.gradeLevel, row.headcount);
		}
		if (row.academicPeriod === 'AY2' && row.gradeLevel === 'PS') {
			existingAy2PsHeadcount = row.headcount;
		}
	}

	const psAy2Headcount = existingAy2PsHeadcount ?? ay1Headcounts.get('PS') ?? 0;
	const cohortResults = calculateCohortProgression({
		ay1Headcounts,
		cohortParams,
		psAy2Headcount,
	});

	const ay2HeadcountMap = new Map<string, number>();
	for (const row of cohortResults) {
		ay2HeadcountMap.set(row.gradeLevel, row.ay2Headcount);
	}

	const existingAy1Nationality = await tx.nationalityBreakdown.findMany({
		where: { versionId, academicPeriod: 'AY1' },
		select: { gradeLevel: true, nationality: true, headcount: true, weight: true },
	});
	const ay1NationalityByGrade = new Map<string, typeof existingAy1Nationality>();
	for (const row of existingAy1Nationality) {
		const entries = ay1NationalityByGrade.get(row.gradeLevel) ?? [];
		entries.push(row);
		ay1NationalityByGrade.set(row.gradeLevel, entries);
	}

	const existingAy2Nationality = await tx.nationalityBreakdown.findMany({
		where: { versionId, academicPeriod: 'AY2' },
		select: { gradeLevel: true, isOverridden: true },
	});
	const overriddenGrades = new Set<string>();
	for (const row of existingAy2Nationality) {
		if (row.isOverridden) {
			overriddenGrades.add(row.gradeLevel);
		}
	}

	const nationalityInputs: NationalityInput[] = [];

	for (let index = 0; index < GRADE_PROGRESSION.length; index += 1) {
		const grade = GRADE_PROGRESSION[index]!;
		if (overriddenGrades.has(grade)) {
			continue;
		}

		const ay2Headcount = ay2HeadcountMap.get(grade) ?? 0;
		if (index === 0) {
			const psNationality = ay1NationalityByGrade.get(grade) ?? [];
			const psWeights =
				psNationality.length > 0
					? computeWeightsFromHeadcounts(
							psNationality.map((entry) => ({
								nationality: entry.nationality,
								headcount: entry.headcount,
							}))
						)
					: new Map([
							['Francais', DEFAULT_LATERAL_WEIGHTS.Francais],
							['Nationaux', DEFAULT_LATERAL_WEIGHTS.Nationaux],
							['Autres', DEFAULT_LATERAL_WEIGHTS.Autres],
						]);

			nationalityInputs.push({
				gradeLevel: grade,
				ay2Headcount,
				isPs: true,
				psWeights,
			});
			continue;
		}

		const priorGrade = GRADE_PROGRESSION[index - 1]!;
		const priorNationality = ay1NationalityByGrade.get(priorGrade) ?? [];
		const cohortParam = cohortParams.get(grade);
		const cohortWeights = cohortWeightMap.get(grade);

		nationalityInputs.push({
			gradeLevel: grade,
			ay2Headcount,
			isPs: false,
			priorGradeNationality: priorNationality.map((entry) => ({
				nationality: entry.nationality,
				weight: String(entry.weight),
				headcount: entry.headcount,
			})),
			retentionRate: cohortParam?.retentionRate ?? '0.97',
			lateralCount: cohortParam?.lateralEntryCount ?? 0,
			lateralWeights: buildLateralWeightMap(cohortWeights, cohortParam?.lateralEntryCount ?? 0),
		});
	}

	const nationalityResults = calculateNationalityDistribution(nationalityInputs);

	const gradeLevels = await tx.gradeLevel.findMany({
		select: { gradeCode: true, maxClassSize: true, plafondPct: true },
	});

	const gradeConfigs = new Map<string, GradeConfig>();
	for (const gradeLevel of gradeLevels) {
		gradeConfigs.set(gradeLevel.gradeCode, {
			gradeCode: gradeLevel.gradeCode,
			maxClassSize: gradeLevel.maxClassSize,
			plafondPct: Number(gradeLevel.plafondPct),
		});
	}

	const capacityInputs: Array<{
		gradeLevel: string;
		academicPeriod: string;
		headcount: number;
	}> = [];

	for (const [grade, headcount] of ay1Headcounts) {
		capacityInputs.push({
			gradeLevel: grade,
			academicPeriod: 'AY1',
			headcount,
		});
	}

	for (const row of cohortResults) {
		capacityInputs.push({
			gradeLevel: row.gradeLevel,
			academicPeriod: 'AY2',
			headcount: row.ay2Headcount,
		});
	}

	const capacityResults = calculateCapacity(capacityInputs, gradeConfigs);

	let totalStudentsAy1 = 0;
	let totalStudentsAy2 = 0;
	const overCapacityGradeSet = new Set<string>();
	for (const result of capacityResults) {
		if (result.academicPeriod === 'AY1') totalStudentsAy1 += result.headcount;
		else totalStudentsAy2 += result.headcount;
		if (result.alert === 'OVER') overCapacityGradeSet.add(result.gradeLevel);
	}
	const overCapacityGrades = [...overCapacityGradeSet];
	const durationMs = Math.round(performance.now() - startTime);

	await tx.calculationAuditLog.create({
		data: {
			versionId,
			runId,
			module: 'ENROLLMENT',
			status: 'STARTED',
			triggeredBy: actor.userId,
			inputSummary: {
				headcountRows: capacityInputs.length,
				totalStudentsAy1,
				totalStudentsAy2,
				cohortParamCount: cohortParamRows.length,
				psAy2Headcount,
			},
		},
	});

	await Promise.all([
		...cohortResults.map((row) =>
			tx.enrollmentHeadcount.upsert({
				where: {
					versionId_academicPeriod_gradeLevel: {
						versionId,
						academicPeriod: 'AY2',
						gradeLevel: row.gradeLevel,
					},
				},
				create: {
					versionId,
					academicPeriod: 'AY2',
					gradeLevel: row.gradeLevel,
					headcount: row.ay2Headcount,
					createdBy: actor.userId,
				},
				update: {
					headcount: row.ay2Headcount,
					updatedBy: actor.userId,
				},
			})
		),
		...nationalityResults.map((row) =>
			tx.nationalityBreakdown.upsert({
				where: {
					versionId_academicPeriod_gradeLevel_nationality: {
						versionId,
						academicPeriod: 'AY2',
						gradeLevel: row.gradeLevel,
						nationality: row.nationality,
					},
				},
				create: {
					versionId,
					academicPeriod: 'AY2',
					gradeLevel: row.gradeLevel,
					nationality: row.nationality,
					weight: row.weight,
					headcount: row.headcount,
					isOverridden: row.isOverridden,
				},
				update: {
					weight: row.weight,
					headcount: row.headcount,
					isOverridden: row.isOverridden,
				},
			})
		),
		...capacityResults.map((result) =>
			tx.dhgRequirement.upsert({
				where: {
					versionId_academicPeriod_gradeLevel: {
						versionId,
						academicPeriod: result.academicPeriod,
						gradeLevel: result.gradeLevel,
					},
				},
				create: {
					versionId,
					academicPeriod: result.academicPeriod,
					gradeLevel: result.gradeLevel,
					headcount: result.headcount,
					maxClassSize: result.maxClassSize,
					sectionsNeeded: result.sectionsNeeded,
					utilization: result.utilization,
					alert: result.alert ?? null,
					recruitmentSlots: result.recruitmentSlots,
				},
				update: {
					headcount: result.headcount,
					maxClassSize: result.maxClassSize,
					sectionsNeeded: result.sectionsNeeded,
					utilization: result.utilization,
					alert: result.alert ?? null,
					recruitmentSlots: result.recruitmentSlots,
				},
			})
		),
	]);

	const currentStale = new Set(version.staleModules);
	currentStale.delete('ENROLLMENT');
	await tx.budgetVersion.update({
		where: { id: versionId },
		data: { staleModules: [...currentStale] },
	});

	await tx.calculationAuditLog.updateMany({
		where: { runId },
		data: {
			status: 'COMPLETED',
			completedAt: new Date(),
			durationMs,
			outputSummary: {
				resultRows: capacityResults.length,
				overCapacityGrades,
				cohortGradesComputed: cohortResults.length,
				nationalityRowsComputed: nationalityResults.length,
			},
		},
	});

	return {
		runId,
		durationMs,
		summary: {
			totalStudentsAy1,
			totalStudentsAy2,
			overCapacityGrades,
		},
		results: capacityResults.map((result) => ({
			gradeLevel: result.gradeLevel,
			academicPeriod: result.academicPeriod,
			headcount: result.headcount,
			maxClassSize: result.maxClassSize,
			sectionsNeeded: result.sectionsNeeded,
			utilization: result.utilization,
			alert: result.alert,
			recruitmentSlots: result.recruitmentSlots,
		})),
	};
}
