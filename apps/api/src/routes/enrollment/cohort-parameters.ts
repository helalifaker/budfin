import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import type { GradeCode } from '@budfin/types';
import { calculateCohortGradeResult } from '@budfin/types';
import { prisma } from '../../lib/prisma.js';
import { loadHistoricalAy1Headcounts } from '../../services/cohort-history.js';
import { GRADE_PROGRESSION } from '../../services/cohort-engine.js';
import { normalizeCohortMutations } from '../../services/enrollment-workspace.js';
import {
	buildEnrollmentPlanningRulesUpdateData,
	ENROLLMENT_RULES_STALE_MODULES,
	resolveEnrollmentPlanningRules,
} from '../../services/planning-rules.js';
import { findInvalidLateralWeightEntry } from '../../services/lateral-weight-validation.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const gradeLevelEnum = z.enum(GRADE_PROGRESSION as unknown as [string, ...string[]]);

const cohortParameterEntrySchema = z.object({
	gradeLevel: gradeLevelEnum,
	retentionRate: z.number().min(0).max(1),
	manualAdjustment: z.number().int().optional(),
	lateralEntryCount: z.number().int().optional(),
	lateralWeightFr: z.number().min(0).max(1).optional(),
	lateralWeightNat: z.number().min(0).max(1).optional(),
	lateralWeightAut: z.number().min(0).max(1).optional(),
});

const planningRulesSchema = z.object({
	rolloverThreshold: z.number().min(0.5).max(2),
	retentionRecentWeight: z.number().min(0).max(1),
	historicalTargetRecentWeight: z.number().min(0).max(1),
	cappedRetention: z.number().min(0.5).max(1).optional(),
});

const putBodySchema = z.object({
	entries: z.array(cohortParameterEntrySchema).min(1),
	planningRules: planningRulesSchema.optional(),
});

function getConfidence(observationCount: number) {
	if (observationCount >= 3) {
		return 'high' as const;
	}

	if (observationCount === 2) {
		return 'medium' as const;
	}

	return 'low' as const;
}

function getDefaultConfiguredRetentionRate({
	gradeLevel,
	historicalTrendRetention,
	usesConfiguredRetention,
}: {
	gradeLevel: string;
	historicalTrendRetention: number | null;
	usesConfiguredRetention: boolean;
}) {
	if (gradeLevel === 'PS') {
		return 0;
	}

	if (usesConfiguredRetention) {
		return 1;
	}

	return historicalTrendRetention ?? 1;
}

export async function cohortParameterRoutes(app: FastifyInstance) {
	app.get('/cohort-parameters', {
		schema: {
			params: versionIdParamsSchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: {
					id: true,
					fiscalYear: true,
					rolloverThreshold: true,
					cappedRetention: true,
					retentionRecentWeight: true,
					historicalTargetRecentWeight: true,
				},
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const planningRules = resolveEnrollmentPlanningRules(version);
			const [params, headcounts, historicalHeadcounts] = await Promise.all([
				prisma.cohortParameter.findMany({
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
				prisma.enrollmentHeadcount.findMany({
					where: {
						versionId,
						OR: [{ academicPeriod: 'AY1' }, { academicPeriod: 'AY2', gradeLevel: 'PS' }],
					},
					select: {
						gradeLevel: true,
						academicPeriod: true,
						headcount: true,
					},
				}),
				loadHistoricalAy1Headcounts(prisma, version.fiscalYear),
			]);

			const paramsMap = new Map(params.map((entry) => [entry.gradeLevel, entry]));
			const ay1Headcounts = new Map(
				headcounts
					.filter((entry) => entry.academicPeriod === 'AY1')
					.map((entry) => [entry.gradeLevel, entry.headcount] as const)
			);
			const psAy2Headcount =
				headcounts.find((entry) => entry.academicPeriod === 'AY2' && entry.gradeLevel === 'PS')
					?.headcount ??
				ay1Headcounts.get('PS') ??
				0;

			const entries = GRADE_PROGRESSION.map((gradeLevel, index) => {
				const persisted = paramsMap.get(gradeLevel);
				const priorGrade = index === 0 ? null : (GRADE_PROGRESSION[index - 1] as GradeCode);
				const feederAy1Headcount = priorGrade ? (ay1Headcounts.get(priorGrade) ?? 0) : 0;
				const configuredRetentionRate = persisted
					? Number(persisted.retentionRate)
					: gradeLevel === 'PS'
						? 0
						: 1;
				const manualAdjustment = persisted?.lateralEntryCount ?? 0;

				const calculation = calculateCohortGradeResult({
					gradeLevel: gradeLevel as GradeCode,
					feederAy1Headcount,
					configuredRetentionRate,
					manualAdjustment,
					historicalHeadcounts,
					targetFiscalYear: version.fiscalYear,
					planningRules,
					psAy2Headcount,
				});

				const retentionRate = persisted
					? Number(persisted.retentionRate)
					: getDefaultConfiguredRetentionRate({
							gradeLevel,
							historicalTrendRetention: calculation.historicalTrendRetention,
							usesConfiguredRetention: calculation.usesConfiguredRetention,
						});

				const recommendationRule =
					gradeLevel === 'PS'
						? 'direct-entry'
						: calculation.ratioObservationCount === 0
							? 'fallback-default'
							: calculation.usesConfiguredRetention
								? 'capped-retention-growth'
								: 'historical-rollover';

				return {
					gradeLevel,
					retentionRate,
					manualAdjustment,
					lateralEntryCount: manualAdjustment,
					lateralWeightFr: Number(persisted?.lateralWeightFr ?? 0),
					lateralWeightNat: Number(persisted?.lateralWeightNat ?? 0),
					lateralWeightAut: Number(persisted?.lateralWeightAut ?? 0),
					isPersisted: Boolean(persisted),
					historicalTrendRatio: calculation.historicalTrendRatio,
					historicalTrendRetention: calculation.historicalTrendRetention,
					appliedRetentionRate: calculation.appliedRetentionRate,
					retainedFromPrior: calculation.retainedFromPrior,
					historicalTargetHeadcount: calculation.historicalTargetHeadcount,
					derivedLaterals: calculation.derivedLaterals,
					ay2Headcount: calculation.ay2Headcount,
					usesConfiguredRetention: calculation.usesConfiguredRetention,
					ratioObservationCount: calculation.ratioObservationCount,
					recommendedRetentionRate: retentionRate,
					recommendedLateralEntryCount: calculation.derivedLaterals,
					recommendationConfidence: getConfidence(calculation.ratioObservationCount),
					recommendationObservationCount: calculation.ratioObservationCount,
					recommendationSourceFiscalYear:
						historicalHeadcounts.reduce((maxYear, row) => Math.max(maxYear, row.academicYear), 0) ||
						null,
					recommendationRolloverRatio: calculation.historicalTrendRatio,
					recommendationPriorAy1Headcount: feederAy1Headcount,
					recommendationAy2Headcount: calculation.ay2Headcount,
					recommendationRule,
				};
			});

			return { entries, planningRules };
		},
	});

	app.put('/cohort-parameters', {
		schema: {
			params: versionIdParamsSchema,
			body: putBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { entries, planningRules } = request.body as z.infer<typeof putBodySchema>;
			const normalizedEntries = normalizeCohortMutations(entries);

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, status: true, dataSource: true, staleModules: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: `Version is ${version.status} and cannot be modified`,
				});
			}

			if (version.dataSource === 'IMPORTED') {
				return reply.status(409).send({
					code: 'IMPORTED_VERSION',
					message: 'Cannot modify cohort parameters on imported versions',
				});
			}

			const invalidLateralWeightEntry = findInvalidLateralWeightEntry(normalizedEntries);
			if (invalidLateralWeightEntry) {
				return reply.status(422).send({
					code: 'LATERAL_WEIGHT_SUM_INVALID',
					message: `Lateral weights for ${invalidLateralWeightEntry.gradeLevel} sum to ${invalidLateralWeightEntry.weightSum}, expected 1.0`,
				});
			}

			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const entry of normalizedEntries) {
					await txPrisma.cohortParameter.upsert({
						where: {
							versionId_gradeLevel: {
								versionId,
								gradeLevel: entry.gradeLevel,
							},
						},
						create: {
							versionId,
							gradeLevel: entry.gradeLevel,
							retentionRate: entry.retentionRate,
							lateralEntryCount: entry.manualAdjustment,
							lateralWeightFr: entry.lateralWeightFr,
							lateralWeightNat: entry.lateralWeightNat,
							lateralWeightAut: entry.lateralWeightAut,
						},
						update: {
							retentionRate: entry.retentionRate,
							lateralEntryCount: entry.manualAdjustment,
							lateralWeightFr: entry.lateralWeightFr,
							lateralWeightNat: entry.lateralWeightNat,
							lateralWeightAut: entry.lateralWeightAut,
						},
					});
				}

				const currentStale = new Set(version.staleModules);
				for (const moduleName of ENROLLMENT_RULES_STALE_MODULES) {
					currentStale.add(moduleName);
				}
				const staleModules = [...currentStale];

				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: {
						...(planningRules ? buildEnrollmentPlanningRulesUpdateData(planningRules) : {}),
						staleModules,
					},
				});

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'COHORT_PARAMETERS_UPDATED',
						tableName: 'cohort_parameters',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: {
							entries: normalizedEntries.map((entry) => ({
								gradeLevel: entry.gradeLevel,
								retentionRate: entry.retentionRate,
								manualAdjustment: entry.manualAdjustment,
								lateralWeightFr: entry.lateralWeightFr,
								lateralWeightNat: entry.lateralWeightNat,
								lateralWeightAut: entry.lateralWeightAut,
							})),
							planningRules,
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return { updated: normalizedEntries.length, staleModules };
			});

			return result;
		},
	});
}
