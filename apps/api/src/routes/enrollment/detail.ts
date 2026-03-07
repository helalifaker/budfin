import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { VALID_GRADE_CODES } from '../../lib/enrollment-constants.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const academicPeriodEnum = z.enum(['AY1', 'AY2']);

const gradeLevelEnum = z.enum(VALID_GRADE_CODES as [string, ...string[]]);

const nationalityEnum = z.enum(['Francais', 'Nationaux', 'Autres']);
const tariffEnum = z.enum(['RP', 'R3+', 'Plein']);

const getDetailQuerySchema = z.object({
	academic_period: z.enum(['AY1', 'AY2', 'both']).optional().default('both'),
});

const detailEntrySchema = z.object({
	gradeLevel: gradeLevelEnum,
	academicPeriod: academicPeriodEnum,
	nationality: nationalityEnum,
	tariff: tariffEnum,
	headcount: z.number().int().min(0),
});

const putDetailBodySchema = z.object({
	entries: z.array(detailEntrySchema).min(1),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function detailRoutes(app: FastifyInstance) {
	// GET /detail — list enrollment detail entries for a version (AC-08)
	app.get('/detail', {
		schema: {
			params: versionIdParamsSchema,
			querystring: getDetailQuerySchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { academic_period } = request.query as z.infer<typeof getDetailQuerySchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const where: Prisma.EnrollmentDetailWhereInput = { versionId };
			if (academic_period !== 'both') {
				where.academicPeriod = academic_period;
			}

			const details = await prisma.enrollmentDetail.findMany({ where });

			const entries = details.map((d) => ({
				gradeLevel: d.gradeLevel,
				academicPeriod: d.academicPeriod,
				nationality: d.nationality,
				tariff: d.tariff,
				headcount: d.headcount,
			}));

			return { entries };
		},
	});

	// PUT /detail — upsert enrollment detail entries with sum validation (AC-06, AC-07)
	app.put('/detail', {
		schema: {
			params: versionIdParamsSchema,
			body: putDetailBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { entries } = request.body as z.infer<typeof putDetailBodySchema>;

			// Version lock guard
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

			// Sum validation — AC-07
			const headcountRows = await prisma.enrollmentHeadcount.findMany({
				where: { versionId },
			});

			const headcountMap = new Map<string, number>();
			for (const h of headcountRows) {
				headcountMap.set(`${h.gradeLevel}:${h.academicPeriod}`, h.headcount);
			}

			const detailSums = new Map<string, number>();
			for (const entry of entries) {
				const key = `${entry.gradeLevel}:${entry.academicPeriod}`;
				detailSums.set(key, (detailSums.get(key) ?? 0) + entry.headcount);
			}

			const mismatches: Array<{
				gradeLevel: string;
				academicPeriod: string;
				expected: number;
				actual: number;
			}> = [];

			for (const [key, detailTotal] of detailSums) {
				const headcountTotal = headcountMap.get(key) ?? 0;
				if (detailTotal !== headcountTotal) {
					const parts = key.split(':');
					mismatches.push({
						gradeLevel: parts[0]!,
						academicPeriod: parts[1]!,
						expected: headcountTotal,
						actual: detailTotal,
					});
				}
			}

			if (mismatches.length > 0) {
				return reply.status(422).send({
					code: 'STAGE2_TOTAL_MISMATCH',
					message: 'Detail headcount sums do not match Stage 1 totals',
					mismatches,
				});
			}

			// Upsert detail entries in a transaction — AC-06
			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const entry of entries) {
					await txPrisma.enrollmentDetail.upsert({
						where: {
							versionId_academicPeriod_gradeLevel_nationality_tariff: {
								versionId,
								academicPeriod: entry.academicPeriod,
								gradeLevel: entry.gradeLevel,
								nationality: entry.nationality,
								tariff: entry.tariff,
							},
						},
						create: {
							versionId,
							academicPeriod: entry.academicPeriod,
							gradeLevel: entry.gradeLevel,
							nationality: entry.nationality,
							tariff: entry.tariff,
							headcount: entry.headcount,
							createdBy: request.user.id,
						},
						update: {
							headcount: entry.headcount,
							updatedBy: request.user.id,
						},
					});
				}

				// Audit log
				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						operation: 'DETAIL_UPDATED',
						tableName: 'enrollment_detail',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: {
							entries: entries.map((e) => ({
								gradeLevel: e.gradeLevel,
								academicPeriod: e.academicPeriod,
								nationality: e.nationality,
								tariff: e.tariff,
								headcount: e.headcount,
							})),
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return { updated: entries.length };
			});

			return result;
		},
	});
}
