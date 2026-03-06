import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const createTariffSchema = z.object({
	code: z
		.string()
		.min(2)
		.max(10)
		.regex(/^[A-Z0-9+]{2,10}$/),
	label: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
});

const updateTariffSchema = createTariffSchema.extend({
	version: z.number().int().positive(),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export async function tariffRoutes(app: FastifyInstance) {
	// GET / — List tariffs
	app.get('/', {
		preHandler: [app.authenticate],
		handler: async () => {
			const tariffs = await prisma.tariff.findMany({
				orderBy: { code: 'asc' },
			});
			return { tariffs };
		},
	});

	// POST / — Create tariff
	app.post('/', {
		schema: { body: createTariffSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const body = request.body as z.infer<typeof createTariffSchema>;

			try {
				const tariff = await prisma.$transaction(async (tx) => {
					const created = await tx.tariff.create({
						data: {
							code: body.code,
							label: body.label,
							description: body.description ?? null,
							createdBy: request.user.id,
							updatedBy: request.user.id,
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'TARIFF_CREATED',
							tableName: 'tariffs',
							recordId: created.id,
							ipAddress: request.ip,
							newValues: body as unknown as Prisma.InputJsonValue,
						},
					});

					return created;
				});

				return reply.status(201).send(tariff);
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: 'Tariff code already exists',
					});
				}
				throw error;
			}
		},
	});

	// PUT /:id — Update tariff (optimistic lock)
	app.put('/:id', {
		schema: { params: idParamsSchema, body: updateTariffSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { version, ...data } = request.body as z.infer<typeof updateTariffSchema>;

			const existing = await prisma.tariff.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Tariff ${id} not found`,
				});
			}

			if (existing.version !== version) {
				return reply.status(409).send({
					code: 'OPTIMISTIC_LOCK',
					message: 'Record has been modified by another user',
				});
			}

			try {
				const tariff = await prisma.$transaction(async (tx) => {
					const updated = await tx.tariff.update({
						where: { id },
						data: {
							code: data.code,
							label: data.label,
							description: data.description ?? null,
							updatedBy: request.user.id,
							version: { increment: 1 },
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'TARIFF_UPDATED',
							tableName: 'tariffs',
							recordId: updated.id,
							ipAddress: request.ip,
							oldValues: existing as unknown as Prisma.InputJsonValue,
							newValues: data as unknown as Prisma.InputJsonValue,
						},
					});

					return updated;
				});

				return tariff;
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: 'Tariff code already exists',
					});
				}
				throw error;
			}
		},
	});

	// DELETE /:id — Delete tariff
	app.delete('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const existing = await prisma.tariff.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Tariff ${id} not found`,
				});
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.tariff.delete({ where: { id } });

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'TARIFF_DELETED',
							tableName: 'tariffs',
							recordId: id,
							ipAddress: request.ip,
							oldValues: existing as unknown as Prisma.InputJsonValue,
						},
					});
				});

				return reply.status(204).send();
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
					return reply.status(409).send({
						code: 'REFERENCED_RECORD',
						message: 'Cannot delete: record is referenced by other data',
					});
				}
				throw error;
			}
		},
	});
}
