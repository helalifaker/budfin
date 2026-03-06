import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const academicPeriodEnum = z.enum(['AY1', 'AY2']);

const gradeLevelEnum = z.enum([
	'PS',
	'MS',
	'GS',
	'CP',
	'CE1',
	'CE2',
	'CM1',
	'CM2',
	'6eme',
	'5eme',
	'4eme',
	'3eme',
	'2nde',
	'1ere',
	'Terminale',
]);

const getQuerySchema = z.object({
	academic_period: z.enum(['AY1', 'AY2', 'both']).optional().default('both'),
});

const putBodySchema = z.object({
	entries: z
		.array(
			z.object({
				gradeLevel: gradeLevelEnum,
				academicPeriod: academicPeriodEnum,
				headcount: z.number().int(),
			})
		)
		.min(1),
});

const HEADCOUNT_STALE_MODULES = ['ENROLLMENT', 'REVENUE', 'DHG', 'STAFFING', 'PNL'] as const;

// ── Routes ────────────────────────────────────────────────────────────────────

export async function headcountRoutes(app: FastifyInstance) {
	// GET /headcount — list enrollment headcounts for a version
	app.get('/headcount', {
		schema: {
			params: versionIdParamsSchema,
			querystring: getQuerySchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { academic_period } = request.query as z.infer<typeof getQuerySchema>;

			// Verify version exists
			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// Build where clause based on academic_period filter
			const where: Prisma.EnrollmentHeadcountWhereInput = { versionId };
			if (academic_period !== 'both') {
				where.academicPeriod = academic_period;
			}

			// Fetch headcounts
			const headcounts = await prisma.enrollmentHeadcount.findMany({ where });

			// Fetch grade levels for display info and sorting
			const gradeLevels = await prisma.gradeLevel.findMany({
				orderBy: { displayOrder: 'asc' },
			});

			const gradeMap = new Map(
				gradeLevels.map((g) => [
					g.gradeCode,
					{ gradeName: g.gradeName, band: g.band, displayOrder: g.displayOrder },
				])
			);

			// Build response entries with grade metadata, sorted by displayOrder
			const entries = headcounts
				.map((h) => {
					const grade = gradeMap.get(h.gradeLevel);
					return {
						gradeLevel: h.gradeLevel,
						academicPeriod: h.academicPeriod,
						headcount: h.headcount,
						gradeName: grade?.gradeName ?? h.gradeLevel,
						band: grade?.band ?? 'MATERNELLE',
						displayOrder: grade?.displayOrder ?? 999,
					};
				})
				.sort((a, b) => a.displayOrder - b.displayOrder);

			return { entries };
		},
	});

	// PUT /headcount — upsert enrollment headcounts for a version
	app.put('/headcount', {
		schema: {
			params: versionIdParamsSchema,
			body: putBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { entries } = request.body as z.infer<typeof putBodySchema>;

			// Check for negative headcounts — AC-04
			const negativeErrors = entries
				.map((e, i) => (e.headcount < 0 ? { index: i, ...e } : null))
				.filter(Boolean);

			if (negativeErrors.length > 0) {
				return reply.status(422).send({
					code: 'NEGATIVE_HEADCOUNT',
					message: 'Headcount values must be non-negative',
					errors: negativeErrors.map((e) => ({
						index: e!.index,
						gradeLevel: e!.gradeLevel,
						academicPeriod: e!.academicPeriod,
						headcount: e!.headcount,
					})),
				});
			}

			// Version lock guard — AC-03
			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
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

			// Upsert headcount entries in a transaction
			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const entry of entries) {
					await txPrisma.enrollmentHeadcount.upsert({
						where: {
							versionId_academicPeriod_gradeLevel: {
								versionId,
								academicPeriod: entry.academicPeriod,
								gradeLevel: entry.gradeLevel,
							},
						},
						create: {
							versionId,
							academicPeriod: entry.academicPeriod,
							gradeLevel: entry.gradeLevel,
							headcount: entry.headcount,
							createdBy: request.user.id,
						},
						update: {
							headcount: entry.headcount,
							updatedBy: request.user.id,
						},
					});
				}

				// Update stale modules
				const currentStale = new Set(version.staleModules);
				for (const m of HEADCOUNT_STALE_MODULES) {
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
						operation: 'HEADCOUNT_UPDATED',
						tableName: 'enrollment_headcount',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: {
							entries: entries.map((e) => ({
								gradeLevel: e.gradeLevel,
								academicPeriod: e.academicPeriod,
								headcount: e.headcount,
							})),
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return { updated: entries.length, staleModules };
			});

			return result;
		},
	});
}
