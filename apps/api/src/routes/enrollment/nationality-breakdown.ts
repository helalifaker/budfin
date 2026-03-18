import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { VALID_GRADE_CODES } from '../../lib/enrollment-constants.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const versionIdGradeParamsSchema = versionIdParamsSchema.extend({
	gradeLevel: z.enum(VALID_GRADE_CODES as [string, ...string[]]),
});

const nationalityEnum = z.enum(['Francais', 'Nationaux', 'Autres']);

const getQuerySchema = z.object({
	academic_period: z.enum(['AY1', 'AY2', 'both']).optional().default('both'),
});

const overrideEntrySchema = z.object({
	gradeLevel: z.enum(VALID_GRADE_CODES as [string, ...string[]]),
	nationality: nationalityEnum,
	weight: z.number().min(0).max(1),
	headcount: z.number().int().min(0),
});

const putBodySchema = z.object({
	overrides: z.array(overrideEntrySchema).min(1),
});

const NATIONALITY_STALE_MODULES = ['ENROLLMENT', 'REVENUE', 'STAFFING', 'PNL'] as const;

const WEIGHT_SUM_TOLERANCE = 0.0001;

const NATIONALITIES = ['Francais', 'Nationaux', 'Autres'] as const;

// ── Routes ────────────────────────────────────────────────────────────────────

export async function nationalityBreakdownRoutes(app: FastifyInstance) {
	// GET /nationality-breakdown — list nationality breakdown for a version
	app.get('/nationality-breakdown', {
		schema: {
			params: versionIdParamsSchema,
			querystring: getQuerySchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { academic_period } = request.query as z.infer<typeof getQuerySchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const where: Prisma.NationalityBreakdownWhereInput = { versionId };
			if (academic_period !== 'both') {
				where.academicPeriod = academic_period;
			}

			const rows = await prisma.nationalityBreakdown.findMany({
				where,
				select: {
					gradeLevel: true,
					academicPeriod: true,
					nationality: true,
					weight: true,
					headcount: true,
					isOverridden: true,
				},
			});

			const entries = rows.map((r) => ({
				gradeLevel: r.gradeLevel,
				academicPeriod: r.academicPeriod,
				nationality: r.nationality,
				weight: Number(r.weight),
				headcount: r.headcount,
				isOverridden: r.isOverridden,
			}));

			return { entries };
		},
	});

	// PUT /nationality-breakdown — override nationality breakdown
	app.put('/nationality-breakdown', {
		schema: {
			params: versionIdParamsSchema,
			body: putBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { overrides } = request.body as z.infer<typeof putBodySchema>;

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
					message: 'Cannot modify nationality breakdown on imported versions',
				});
			}

			// Group overrides by grade to validate weight sums and headcount sums
			const byGrade = new Map<string, typeof overrides>();
			for (const o of overrides) {
				const existing = byGrade.get(o.gradeLevel) ?? [];
				existing.push(o);
				byGrade.set(o.gradeLevel, existing);
			}

			// Fetch headcount rows for headcount sum validation
			const headcountRows = await prisma.enrollmentHeadcount.findMany({
				where: { versionId },
			});
			const headcountMap = new Map<string, number>();
			for (const h of headcountRows) {
				headcountMap.set(`${h.gradeLevel}:${h.academicPeriod}`, h.headcount);
			}

			const trioErrors: Array<{ gradeLevel: string; nationalities: string[] }> = [];
			const weightErrors: Array<{ gradeLevel: string; weightSum: number }> = [];
			const headcountErrors: Array<{
				gradeLevel: string;
				expected: number;
				actual: number;
			}> = [];

			for (const [gradeLevel, gradeOverrides] of byGrade) {
				const nationalitySet = new Set(gradeOverrides.map((override) => override.nationality));
				if (
					gradeOverrides.length !== NATIONALITIES.length ||
					nationalitySet.size !== NATIONALITIES.length
				) {
					trioErrors.push({
						gradeLevel,
						nationalities: [...nationalitySet].sort(),
					});
					continue;
				}

				const weightSum = gradeOverrides.reduce(
					(sum, o) => new Decimal(sum).plus(o.weight).toNumber(),
					0
				);
				if (Math.abs(weightSum - 1.0) > WEIGHT_SUM_TOLERANCE) {
					weightErrors.push({ gradeLevel, weightSum });
				}

				// Look up in AY2 first, then AY1 as fallback.
				const expectedHeadcount =
					headcountMap.get(`${gradeLevel}:AY2`) ?? headcountMap.get(`${gradeLevel}:AY1`) ?? 0;

				const actualSum = gradeOverrides.reduce((sum, o) => sum + o.headcount, 0);
				if (actualSum !== expectedHeadcount) {
					headcountErrors.push({
						gradeLevel,
						expected: expectedHeadcount,
						actual: actualSum,
					});
				}
			}

			if (trioErrors.length > 0) {
				return reply.status(422).send({
					code: 'NATIONALITY_TRIO_REQUIRED',
					message: 'Each nationality override must submit Francais, Nationaux, and Autres rows',
					errors: trioErrors,
				});
			}

			if (weightErrors.length > 0) {
				return reply.status(422).send({
					code: 'NATIONALITY_WEIGHT_SUM_INVALID',
					message: 'Nationality weights must sum to 1.0 per grade',
					errors: weightErrors,
				});
			}

			if (headcountErrors.length > 0) {
				return reply.status(422).send({
					code: 'NATIONALITY_HEADCOUNT_MISMATCH',
					message: 'Nationality headcounts must sum to the grade total headcount',
					errors: headcountErrors,
				});
			}

			// Upsert overrides in a transaction
			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const o of overrides) {
					// Overrides apply to AY2 (computed period)
					await txPrisma.nationalityBreakdown.upsert({
						where: {
							versionId_academicPeriod_gradeLevel_nationality: {
								versionId,
								academicPeriod: 'AY2',
								gradeLevel: o.gradeLevel,
								nationality: o.nationality,
							},
						},
						create: {
							versionId,
							academicPeriod: 'AY2',
							gradeLevel: o.gradeLevel,
							nationality: o.nationality,
							weight: o.weight,
							headcount: o.headcount,
							isOverridden: true,
						},
						update: {
							weight: o.weight,
							headcount: o.headcount,
							isOverridden: true,
						},
					});
				}

				// Update stale modules
				const currentStale = new Set(version.staleModules);
				for (const m of NATIONALITY_STALE_MODULES) {
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
						operation: 'NATIONALITY_BREAKDOWN_UPDATED',
						tableName: 'nationality_breakdown',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: {
							overrides: overrides.map((o) => ({
								gradeLevel: o.gradeLevel,
								nationality: o.nationality,
								weight: o.weight,
								headcount: o.headcount,
							})),
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return { updated: overrides.length, staleModules };
			});

			return result;
		},
	});

	app.delete('/nationality-breakdown/:gradeLevel', {
		schema: {
			params: versionIdGradeParamsSchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId, gradeLevel } = request.params as z.infer<
				typeof versionIdGradeParamsSchema
			>;

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
					message: 'Cannot modify nationality breakdown on imported versions',
				});
			}

			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				const deleted = await txPrisma.nationalityBreakdown.deleteMany({
					where: {
						versionId,
						academicPeriod: 'AY2',
						gradeLevel,
						isOverridden: true,
					},
				});

				const currentStale = new Set(version.staleModules);
				for (const moduleName of NATIONALITY_STALE_MODULES) {
					currentStale.add(moduleName);
				}
				const staleModules = [...currentStale];

				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules },
				});

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'NATIONALITY_BREAKDOWN_RESET',
						tableName: 'nationality_breakdown',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: {
							gradeLevel,
							deletedRows: deleted.count,
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return { deleted: deleted.count, staleModules };
			});

			return reply.send(result);
		},
	});
}
