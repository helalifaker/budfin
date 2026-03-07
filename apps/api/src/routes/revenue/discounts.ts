import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const discountEntrySchema = z.object({
	tariff: z.enum(['RP', 'R3+']),
	nationality: z.enum(['Francais', 'Nationaux', 'Autres']).nullable(),
	discountRate: z
		.string()
		.regex(/^\d+(\.\d{1,6})?$/, 'Must be a decimal string with up to 6 decimal places'),
});

const putBodySchema = z.object({
	entries: z.array(discountEntrySchema).min(1),
});

const DISCOUNT_STALE_MODULES = ['REVENUE', 'PNL'] as const;

// ── Routes ────────────────────────────────────────────────────────────────────

export async function discountRoutes(app: FastifyInstance) {
	// GET /discounts
	app.get('/discounts', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const policies = await prisma.discountPolicy.findMany({
				where: { versionId },
				orderBy: [{ tariff: 'asc' }, { nationality: 'asc' }],
			});

			const entries = policies.map((p) => ({
				tariff: p.tariff,
				nationality: p.nationality,
				discountRate: new Decimal(p.discountRate.toString()).toFixed(6),
			}));

			return { entries };
		},
	});

	// PUT /discounts
	app.put('/discounts', {
		schema: {
			params: versionIdParamsSchema,
			body: putBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { entries } = request.body as z.infer<typeof putBodySchema>;

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

			// Validate discount rates are in [0, 1]
			const rateErrors: Array<{ index: number; tariff: string; discountRate: string }> = [];
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i]!;
				const rate = new Decimal(entry.discountRate);
				if (rate.lt(0) || rate.gt(1)) {
					rateErrors.push({
						index: i,
						tariff: entry.tariff,
						discountRate: entry.discountRate,
					});
				}
			}

			if (rateErrors.length > 0) {
				return reply.status(422).send({
					code: 'INVALID_DISCOUNT_RATE',
					message: 'Discount rate must be between 0 and 1',
					errors: rateErrors,
				});
			}

			// Upsert in transaction
			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const entry of entries) {
					await txPrisma.discountPolicy.upsert({
						where: {
							versionId_tariff_nationality: {
								versionId,
								tariff: entry.tariff,
								nationality: entry.nationality ?? '',
							},
						},
						create: {
							versionId,
							tariff: entry.tariff,
							nationality: entry.nationality,
							discountRate: entry.discountRate,
							createdBy: request.user.id,
						},
						update: {
							discountRate: entry.discountRate,
							updatedBy: request.user.id,
						},
					});
				}

				// Mark REVENUE module stale
				const currentStale = new Set(version.staleModules);
				for (const m of DISCOUNT_STALE_MODULES) {
					currentStale.add(m);
				}
				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules: [...currentStale] },
				});

				// Audit log
				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						operation: 'DISCOUNT_POLICY_UPDATED',
						tableName: 'discount_policies',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: { entryCount: entries.length } as unknown as Prisma.InputJsonValue,
					},
				});

				return { updated: entries.length };
			});

			return result;
		},
	});
}
