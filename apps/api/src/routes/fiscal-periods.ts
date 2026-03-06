import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const fiscalYearParams = z.object({
	fiscalYear: z.coerce.number().int().min(2000).max(2100),
});

const monthParams = z.object({
	fiscalYear: z.coerce.number().int().min(2000).max(2100),
	month: z.coerce.number().int().min(1).max(12),
});

const lockBodySchema = z.object({
	actual_version_id: z.number().int().positive(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPeriod(p: {
	id: number;
	fiscalYear: number;
	month: number;
	status: string;
	actualVersionId: number | null;
	lockedAt: Date | null;
	lockedById: number | null;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: p.id,
		fiscalYear: p.fiscalYear,
		month: p.month,
		status: p.status,
		actualVersionId: p.actualVersionId,
		lockedAt: p.lockedAt,
		lockedById: p.lockedById,
		createdAt: p.createdAt,
		updatedAt: p.updatedAt,
	};
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function fiscalPeriodRoutes(app: FastifyInstance) {
	// GET /:fiscalYear — list 12 periods, auto-seed if new year (AC-14)
	app.get('/:fiscalYear', {
		schema: { params: fiscalYearParams },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { fiscalYear } = request.params as z.infer<typeof fiscalYearParams>;

			let periods = await prisma.fiscalPeriod.findMany({
				where: { fiscalYear },
				orderBy: { month: 'asc' },
			});

			// Auto-seed 12 rows on first GET for a new fiscal year
			if (periods.length === 0) {
				await prisma.fiscalPeriod.createMany({
					data: Array.from({ length: 12 }, (_, i) => ({
						fiscalYear,
						month: i + 1,
						status: 'Draft',
					})),
					skipDuplicates: true,
				});

				periods = await prisma.fiscalPeriod.findMany({
					where: { fiscalYear },
					orderBy: { month: 'asc' },
				});
			}

			return (periods as Parameters<typeof formatPeriod>[0][]).map(formatPeriod);
		},
	});

	// PATCH /:fiscalYear/:month/lock — lock a fiscal period (AC-15)
	app.patch('/:fiscalYear/:month/lock', {
		schema: { params: monthParams, body: lockBodySchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const { fiscalYear, month } = request.params as z.infer<typeof monthParams>;
			const { actual_version_id } = request.body as z.infer<typeof lockBodySchema>;

			// Validate the referenced version exists and is a Locked Actual
			const version = await prisma.budgetVersion.findUnique({ where: { id: actual_version_id } });

			if (!version) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Version ${actual_version_id} not found`,
				});
			}

			if (version.type !== 'Actual' || version.status !== 'Locked') {
				return reply.status(422).send({
					code: 'ACTUAL_VERSION_REQUIRED',
					message: 'actual_version_id must reference a version with type=Actual and status=Locked',
				});
			}

			const updated = await prisma.$transaction(async (tx) => {
				const result = await (tx as typeof prisma).fiscalPeriod.update({
					where: {
						fiscalYear_month: { fiscalYear, month },
					},
					data: {
						status: 'Locked',
						actualVersionId: actual_version_id,
						lockedAt: new Date(),
						lockedById: request.user.id,
					},
				});

				await (tx as typeof prisma).auditEntry.create({
					data: {
						userId: request.user.id,
						operation: 'FISCAL_PERIOD_LOCKED',
						tableName: 'fiscal_periods',
						recordId: result.id,
						ipAddress: request.ip,
						newValues: {
							fiscalYear,
							month,
							actualVersionId: actual_version_id,
						} as Prisma.InputJsonValue,
					},
				});

				return result;
			});

			return formatPeriod(updated as Parameters<typeof formatPeriod>[0]);
		},
	});
}
