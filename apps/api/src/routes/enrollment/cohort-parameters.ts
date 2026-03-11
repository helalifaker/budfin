import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { GRADE_PROGRESSION } from '../../services/cohort-engine.js';
import { getHistoricalCohortRecommendations } from '../../services/cohort-recommendations.js';
import { normalizeCohortMutations } from '../../services/enrollment-workspace.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const gradeLevelEnum = z.enum(GRADE_PROGRESSION as unknown as [string, ...string[]]);

const cohortParameterEntrySchema = z.object({
	gradeLevel: gradeLevelEnum,
	retentionRate: z.number().min(0).max(1),
	lateralEntryCount: z.number().int().min(0),
	lateralWeightFr: z.number().min(0).max(1),
	lateralWeightNat: z.number().min(0).max(1),
	lateralWeightAut: z.number().min(0).max(1),
});

const putBodySchema = z.object({
	entries: z.array(cohortParameterEntrySchema).min(1),
});

const COHORT_STALE_MODULES = ['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL'] as const;

const WEIGHT_SUM_TOLERANCE = 0.0001;

// ── Routes ────────────────────────────────────────────────────────────────────

export async function cohortParameterRoutes(app: FastifyInstance) {
	// GET /cohort-parameters — list cohort parameters for a version
	app.get('/cohort-parameters', {
		schema: {
			params: versionIdParamsSchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, fiscalYear: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// Fetch existing parameters
			const params = await prisma.cohortParameter.findMany({
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

			const paramsMap = new Map(params.map((p) => [p.gradeLevel, p]));
			const recommendationMap = new Map(
				(await getHistoricalCohortRecommendations(prisma, version.fiscalYear)).map(
					(recommendation) => [recommendation.gradeLevel, recommendation] as const
				)
			);

			// Build response: one row per grade, with defaults for missing grades
			const entries = GRADE_PROGRESSION.map((grade) => {
				const existing = paramsMap.get(grade);
				const isPs = grade === 'PS';
				const recommendation = recommendationMap.get(grade);

				if (existing) {
					return {
						gradeLevel: existing.gradeLevel,
						retentionRate: Number(existing.retentionRate),
						lateralEntryCount: existing.lateralEntryCount,
						lateralWeightFr: Number(existing.lateralWeightFr),
						lateralWeightNat: Number(existing.lateralWeightNat),
						lateralWeightAut: Number(existing.lateralWeightAut),
						isPersisted: true,
						recommendedRetentionRate: recommendation?.recommendedRetentionRate ?? (isPs ? 0 : 0.97),
						recommendedLateralEntryCount: recommendation?.recommendedLateralEntryCount ?? 0,
						recommendationConfidence: recommendation?.confidence ?? 'low',
						recommendationObservationCount: recommendation?.observationCount ?? 0,
						recommendationSourceFiscalYear: recommendation?.sourceFiscalYear ?? null,
						recommendationRolloverRatio: recommendation?.rolloverRatio ?? null,
						recommendationRule:
							recommendation?.rule ?? (isPs ? 'direct-entry' : 'fallback-default'),
					};
				}

				const defaultRetentionRate = recommendation?.recommendedRetentionRate ?? (isPs ? 0 : 0.97);
				const defaultLateralEntryCount = recommendation?.recommendedLateralEntryCount ?? 0;

				// Defaults: PS has retentionRate=0 (direct entry), others use the latest historical recommendation.
				return {
					gradeLevel: grade,
					retentionRate: defaultRetentionRate,
					lateralEntryCount: defaultLateralEntryCount,
					lateralWeightFr: 0,
					lateralWeightNat: 0,
					lateralWeightAut: 0,
					isPersisted: false,
					recommendedRetentionRate: defaultRetentionRate,
					recommendedLateralEntryCount: defaultLateralEntryCount,
					recommendationConfidence: recommendation?.confidence ?? 'low',
					recommendationObservationCount: recommendation?.observationCount ?? 0,
					recommendationSourceFiscalYear: recommendation?.sourceFiscalYear ?? null,
					recommendationRolloverRatio: recommendation?.rolloverRatio ?? null,
					recommendationRule: recommendation?.rule ?? (isPs ? 'direct-entry' : 'fallback-default'),
				};
			});

			return { entries };
		},
	});

	// PUT /cohort-parameters — bulk upsert cohort parameters
	app.put('/cohort-parameters', {
		schema: {
			params: versionIdParamsSchema,
			body: putBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { entries } = request.body as z.infer<typeof putBodySchema>;
			const normalizedEntries = normalizeCohortMutations(entries);

			// Version lock guard
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

			// Validate: lateral weights must sum to 1.0 when lateralEntryCount > 0
			const weightErrors: Array<{
				gradeLevel: string;
				weightSum: number;
			}> = [];

			for (const entry of normalizedEntries) {
				if (entry.lateralEntryCount > 0) {
					const weightSum = new Decimal(entry.lateralWeightFr)
						.plus(entry.lateralWeightNat)
						.plus(entry.lateralWeightAut)
						.toNumber();

					if (Math.abs(weightSum - 1.0) > WEIGHT_SUM_TOLERANCE) {
						weightErrors.push({
							gradeLevel: entry.gradeLevel,
							weightSum,
						});
					}
				}
			}

			if (weightErrors.length > 0) {
				return reply.status(422).send({
					code: 'LATERAL_WEIGHT_SUM_INVALID',
					message:
						'Lateral weights (Fr + Nat + Aut) must sum to 1.0 for grades with lateral entries',
					errors: weightErrors,
				});
			}

			// Upsert in a transaction
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
							lateralEntryCount: entry.lateralEntryCount,
							lateralWeightFr: entry.lateralWeightFr,
							lateralWeightNat: entry.lateralWeightNat,
							lateralWeightAut: entry.lateralWeightAut,
						},
						update: {
							retentionRate: entry.retentionRate,
							lateralEntryCount: entry.lateralEntryCount,
							lateralWeightFr: entry.lateralWeightFr,
							lateralWeightNat: entry.lateralWeightNat,
							lateralWeightAut: entry.lateralWeightAut,
						},
					});
				}

				// Update stale modules
				const currentStale = new Set(version.staleModules);
				for (const m of COHORT_STALE_MODULES) {
					currentStale.add(m);
				}
				const staleModules = [...currentStale];

				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules },
				});

				// Audit log
				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'COHORT_PARAMETERS_UPDATED',
						tableName: 'cohort_parameters',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: {
							entries: normalizedEntries.map((e) => ({
								gradeLevel: e.gradeLevel,
								retentionRate: e.retentionRate,
								lateralEntryCount: e.lateralEntryCount,
								lateralWeightFr: e.lateralWeightFr,
								lateralWeightNat: e.lateralWeightNat,
								lateralWeightAut: e.lateralWeightAut,
							})),
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return { updated: normalizedEntries.length, staleModules };
			});

			return result;
		},
	});
}
