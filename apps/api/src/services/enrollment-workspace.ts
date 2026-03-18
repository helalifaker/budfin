import { randomUUID } from 'node:crypto';
import type { GradeCode, CohortCalculationRules } from '@budfin/types';
import { calculateCohortGradeResult, calculateHistoricalTrendRetention } from '@budfin/types';
import type { Prisma } from '@prisma/client';
import { calculateCapacity, type GradeConfig } from './capacity-engine.js';
import { loadHistoricalAy1Headcounts } from './cohort-history.js';
import { GRADE_PROGRESSION } from './cohort-engine.js';
import {
	calculateNationalityDistribution,
	computeWeightsFromHeadcounts,
	type NationalityInput,
} from './nationality-engine.js';

// Real EFIR distribution: ~34% Francais, ~2% Nationaux, ~64% Autres
const DEFAULT_NATIONALITY_WEIGHTS = {
	Francais: '0.3366',
	Nationaux: '0.0234',
	Autres: '0.6400',
} as const;

export const ENROLLMENT_STALE_MODULES = ['ENROLLMENT', 'REVENUE', 'STAFFING', 'PNL'] as const;

export type EnrollmentTransaction = Prisma.TransactionClient;

export interface EditableEnrollmentVersion extends CohortCalculationRules {
	id: number;
	fiscalYear: number;
	staleModules: string[];
	cappedRetention?: number | undefined;
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

interface CohortParameterMutation {
	gradeLevel: string;
	retentionRate: number;
	manualAdjustment?: number | undefined;
	lateralEntryCount?: number | undefined;
	lateralWeightFr?: number | undefined;
	lateralWeightNat?: number | undefined;
	lateralWeightAut?: number | undefined;
}

function normalizeWholeNumber(value: number | undefined) {
	if (value === undefined) {
		return 0;
	}

	if (!Number.isFinite(value)) {
		throw new TypeError(`Expected a finite whole number, received ${String(value)}`);
	}

	return Math.round(value);
}

function resolveManualAdjustment(entry: CohortParameterMutation) {
	if (entry.manualAdjustment !== undefined) {
		return normalizeWholeNumber(entry.manualAdjustment);
	}

	return normalizeWholeNumber(entry.lateralEntryCount);
}

export function normalizeCohortMutations(entries: CohortParameterMutation[]) {
	return entries.map((entry) => {
		const manualAdjustment = resolveManualAdjustment(entry);

		return {
			gradeLevel: entry.gradeLevel,
			retentionRate: entry.retentionRate,
			manualAdjustment,
			lateralEntryCount: manualAdjustment,
			lateralWeightFr: entry.lateralWeightFr ?? 0,
			lateralWeightNat: entry.lateralWeightNat ?? 0,
			lateralWeightAut: entry.lateralWeightAut ?? 0,
		};
	});
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

function buildFallbackPsWeights() {
	return new Map([
		['Francais', DEFAULT_NATIONALITY_WEIGHTS.Francais],
		['Nationaux', DEFAULT_NATIONALITY_WEIGHTS.Nationaux],
		['Autres', DEFAULT_NATIONALITY_WEIGHTS.Autres],
	]);
}

function buildDefaultRetentionRate({
	gradeLevel,
	historicalTrendRatio,
	historicalTrendRetention,
	rolloverThreshold,
}: {
	gradeLevel: GradeCode;
	historicalTrendRatio: number | null;
	historicalTrendRetention: number | null;
	rolloverThreshold: number;
}) {
	if (gradeLevel === 'PS') {
		return 0;
	}

	if (historicalTrendRatio !== null && historicalTrendRatio > rolloverThreshold) {
		return 1;
	}

	return historicalTrendRetention ?? 1;
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

	const [
		cohortParamRows,
		allHeadcounts,
		gradeLevels,
		versionCapacityConfigs,
		historicalHeadcounts,
	] = await Promise.all([
		tx.cohortParameter.findMany({
			where: { versionId },
			select: {
				gradeLevel: true,
				retentionRate: true,
				lateralEntryCount: true,
				lateralWeightFr: true,
				lateralWeightNat: true,
				lateralWeightAut: true,
			},
		}),
		tx.enrollmentHeadcount.findMany({
			where: { versionId },
		}),
		tx.gradeLevel.findMany({
			select: {
				gradeCode: true,
				maxClassSize: true,
				plancherPct: true,
				ciblePct: true,
				plafondPct: true,
				defaultAy2Intake: true,
			},
		}),
		tx.versionCapacityConfig.findMany({
			where: { versionId },
			select: {
				gradeLevel: true,
				maxClassSize: true,
				plancherPct: true,
				ciblePct: true,
				plafondPct: true,
			},
		}),
		loadHistoricalAy1Headcounts(tx, version.fiscalYear),
	]);

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

	const psDefaultAy2Headcount =
		gradeLevels.find((gradeLevel) => gradeLevel.gradeCode === 'PS')?.defaultAy2Intake ?? null;
	const psAy2Headcount =
		existingAy2PsHeadcount ?? psDefaultAy2Headcount ?? ay1Headcounts.get('PS') ?? 0;

	const planningRules: CohortCalculationRules = {
		rolloverThreshold: version.rolloverThreshold,
		retentionRecentWeight: version.retentionRecentWeight,
		historicalTargetRecentWeight: version.historicalTargetRecentWeight,
	};

	const persistedEntries = new Map(
		cohortParamRows.map((row) => [
			row.gradeLevel,
			{
				gradeLevel: row.gradeLevel as GradeCode,
				retentionRate: Number(row.retentionRate),
				manualAdjustment: row.lateralEntryCount,
				lateralWeightFr: row.lateralWeightFr,
				lateralWeightNat: row.lateralWeightNat,
				lateralWeightAut: row.lateralWeightAut,
			},
		])
	);

	const cohortResults = GRADE_PROGRESSION.map((gradeLevel, index) => {
		const gradeCode = gradeLevel as GradeCode;
		const persistedEntry = persistedEntries.get(gradeLevel);
		const priorGrade = index === 0 ? null : (GRADE_PROGRESSION[index - 1] as GradeCode);
		const feederAy1Headcount = priorGrade ? (ay1Headcounts.get(priorGrade) ?? 0) : 0;
		const defaultTrendResult =
			persistedEntry?.retentionRate === undefined && gradeLevel !== 'PS'
				? calculateHistoricalTrendRetention({
						gradeLevel: gradeCode,
						historicalHeadcounts,
						targetFiscalYear: version.fiscalYear,
						recentWeight: planningRules.retentionRecentWeight,
					})
				: null;

		const resolvedRetentionRate =
			persistedEntry?.retentionRate ??
			buildDefaultRetentionRate({
				gradeLevel: gradeCode,
				historicalTrendRatio: defaultTrendResult?.historicalTrendRatio ?? null,
				historicalTrendRetention: defaultTrendResult?.historicalTrendRetention ?? null,
				rolloverThreshold: planningRules.rolloverThreshold,
			});

		const finalResult = calculateCohortGradeResult({
			gradeLevel: gradeCode,
			feederAy1Headcount,
			configuredRetentionRate: resolvedRetentionRate,
			manualAdjustment: persistedEntry?.manualAdjustment ?? 0,
			historicalHeadcounts,
			targetFiscalYear: version.fiscalYear,
			planningRules,
			psAy2Headcount,
		});

		return {
			...finalResult,
			ay1Headcount: ay1Headcounts.get(gradeLevel) ?? 0,
			retentionRate: resolvedRetentionRate,
		};
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
					: buildFallbackPsWeights();

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

		nationalityInputs.push({
			gradeLevel: grade,
			ay2Headcount,
			isPs: false,
			priorGradeNationality: priorNationality.map((entry) => ({
				nationality: entry.nationality,
				weight: String(entry.weight),
				headcount: entry.headcount,
			})),
		});
	}

	const nationalityResults = calculateNationalityDistribution(nationalityInputs);

	const versionCapacityByGrade = new Map(
		versionCapacityConfigs.map((config) => [config.gradeLevel, config] as const)
	);

	const gradeConfigs = new Map<string, GradeConfig>();
	for (const gradeLevel of gradeLevels) {
		const capacityConfig = versionCapacityByGrade.get(gradeLevel.gradeCode);
		gradeConfigs.set(gradeLevel.gradeCode, {
			gradeCode: gradeLevel.gradeCode,
			maxClassSize: capacityConfig?.maxClassSize ?? gradeLevel.maxClassSize,
			plafondPct: Number(capacityConfig?.plafondPct ?? gradeLevel.plafondPct),
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
		if (result.academicPeriod === 'AY1') {
			totalStudentsAy1 += result.headcount;
		} else {
			totalStudentsAy2 += result.headcount;
		}

		if (result.alert === 'OVER') {
			overCapacityGradeSet.add(result.gradeLevel);
		}
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
				historicalObservationCount: historicalHeadcounts.length,
			},
		},
	});

	await Promise.all([
		...cohortResults.map((row) =>
			tx.cohortParameter.upsert({
				where: {
					versionId_gradeLevel: {
						versionId,
						gradeLevel: row.gradeLevel,
					},
				},
				create: {
					versionId,
					gradeLevel: row.gradeLevel,
					retentionRate: row.retentionRate,
					lateralEntryCount: persistedEntries.get(row.gradeLevel)?.manualAdjustment ?? 0,
					lateralWeightFr: persistedEntries.get(row.gradeLevel)?.lateralWeightFr ?? 0,
					lateralWeightNat: persistedEntries.get(row.gradeLevel)?.lateralWeightNat ?? 0,
					lateralWeightAut: persistedEntries.get(row.gradeLevel)?.lateralWeightAut ?? 0,
					appliedRetentionRate: row.appliedRetentionRate,
					retainedFromPrior: row.retainedFromPrior,
					historicalTargetHeadcount: row.historicalTargetHeadcount,
					derivedLaterals: row.derivedLaterals,
					usesConfiguredRetention: row.usesConfiguredRetention,
				},
				update: {
					appliedRetentionRate: row.appliedRetentionRate,
					retainedFromPrior: row.retainedFromPrior,
					historicalTargetHeadcount: row.historicalTargetHeadcount,
					derivedLaterals: row.derivedLaterals,
					usesConfiguredRetention: row.usesConfiguredRetention,
				},
			})
		),
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
