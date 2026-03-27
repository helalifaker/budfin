import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const listQuerySchema = z.object({
	fiscalYear: z.coerce.number().int().optional(),
});

const actualSchema = z.object({
	fiscalYear: z.number().int().min(2000).max(2100),
	accountCode: z.string().min(3).max(10),
	annualAmount: z.number(),
	q1Amount: z.number().nullable().optional(),
	q2Amount: z.number().nullable().optional(),
	q3Amount: z.number().nullable().optional(),
});

const bulkImportSchema = z.object({
	actuals: z.array(actualSchema).min(1),
});

const updateActualSchema = z.object({
	annualAmount: z.number(),
	q1Amount: z.number().nullable().optional(),
	q2Amount: z.number().nullable().optional(),
	q3Amount: z.number().nullable().optional(),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export async function historicalActualRoutes(app: FastifyInstance) {
	// GET / — List actuals with optional fiscalYear filter
	app.get('/', {
		schema: { querystring: listQuerySchema },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { fiscalYear } = request.query as z.infer<typeof listQuerySchema>;

			const where: Prisma.HistoricalActualWhereInput = {};
			if (fiscalYear !== undefined) where.fiscalYear = fiscalYear;

			const actuals = await prisma.historicalActual.findMany({
				where,
				orderBy: [{ fiscalYear: 'asc' }, { accountCode: 'asc' }],
			});

			return { actuals };
		},
	});

	// POST /bulk — Bulk import via upsert
	app.post('/bulk', {
		schema: { body: bulkImportSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { actuals } = request.body as z.infer<typeof bulkImportSchema>;

			await prisma.$transaction(async (tx) => {
				for (const actual of actuals) {
					await tx.historicalActual.upsert({
						where: {
							fiscalYear_accountCode: {
								fiscalYear: actual.fiscalYear,
								accountCode: actual.accountCode,
							},
						},
						create: {
							fiscalYear: actual.fiscalYear,
							accountCode: actual.accountCode,
							annualAmount: actual.annualAmount,
							q1Amount: actual.q1Amount ?? null,
							q2Amount: actual.q2Amount ?? null,
							q3Amount: actual.q3Amount ?? null,
							source: 'MANUAL',
						},
						update: {
							annualAmount: actual.annualAmount,
							q1Amount: actual.q1Amount ?? null,
							q2Amount: actual.q2Amount ?? null,
							q3Amount: actual.q3Amount ?? null,
						},
					});
				}

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'HISTORICAL_ACTUALS_BULK_IMPORT',
						tableName: 'historical_actuals',
						recordId: 0,
						ipAddress: request.ip,
						newValues: { count: actuals.length } as Prisma.InputJsonValue,
					},
				});
			});

			return reply.status(201).send({ imported: actuals.length });
		},
	});

	// PUT /:id — Update single actual
	app.put('/:id', {
		schema: { params: idParamsSchema, body: updateActualSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const data = request.body as z.infer<typeof updateActualSchema>;

			const existing = await prisma.historicalActual.findUnique({ where: { id } });

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Historical actual ${id} not found`,
				});
			}

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.historicalActual.update({
					where: { id },
					data: {
						annualAmount: data.annualAmount,
						q1Amount: data.q1Amount ?? null,
						q2Amount: data.q2Amount ?? null,
						q3Amount: data.q3Amount ?? null,
					},
				});

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'HISTORICAL_ACTUAL_UPDATED',
						tableName: 'historical_actuals',
						recordId: id,
						ipAddress: request.ip,
						oldValues: existing as unknown as Prisma.InputJsonValue,
						newValues: data as unknown as Prisma.InputJsonValue,
					},
				});

				return result;
			});

			return updated;
		},
	});

	// DELETE /:id — Delete single actual
	app.delete('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const existing = await prisma.historicalActual.findUnique({ where: { id } });

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Historical actual ${id} not found`,
				});
			}

			await prisma.$transaction(async (tx) => {
				await tx.historicalActual.delete({ where: { id } });

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'HISTORICAL_ACTUAL_DELETED',
						tableName: 'historical_actuals',
						recordId: id,
						ipAddress: request.ip,
						oldValues: existing as unknown as Prisma.InputJsonValue,
					},
				});
			});

			return reply.status(204).send();
		},
	});
}
