import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const createNationalitySchema = z.object({
	code: z
		.string()
		.min(2)
		.max(5)
		.regex(/^[A-Z]{2,5}$/),
	label: z.string().min(1).max(100),
	vatExempt: z.boolean().optional(),
});

const updateNationalitySchema = createNationalitySchema.extend({
	version: z.number().int().positive(),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export async function nationalityRoutes(app: FastifyInstance) {
	// GET / — List nationalities
	app.get('/', {
		preHandler: [app.authenticate],
		handler: async () => {
			const nationalities = await prisma.nationality.findMany({
				orderBy: { code: 'asc' },
			});
			return { nationalities };
		},
	});

	// POST / — Create nationality
	app.post('/', {
		schema: { body: createNationalitySchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const body = request.body as z.infer<typeof createNationalitySchema>;

			try {
				const nationality = await prisma.$transaction(async (tx) => {
					const created = await tx.nationality.create({
						data: {
							code: body.code,
							label: body.label,
							...(body.vatExempt !== undefined ? { vatExempt: body.vatExempt } : {}),
							createdBy: request.user.id,
							updatedBy: request.user.id,
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'NATIONALITY_CREATED',
							tableName: 'nationalities',
							recordId: created.id,
							ipAddress: request.ip,
							newValues: body as unknown as Prisma.InputJsonValue,
						},
					});

					return created;
				});

				return reply.status(201).send(nationality);
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: 'Nationality code already exists',
					});
				}
				throw error;
			}
		},
	});

	// PUT /:id — Update nationality (optimistic lock)
	app.put('/:id', {
		schema: { params: idParamsSchema, body: updateNationalitySchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { version, ...data } = request.body as z.infer<typeof updateNationalitySchema>;

			const existing = await prisma.nationality.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Nationality ${id} not found`,
				});
			}

			try {
				const nationality = await prisma.$transaction(async (tx) => {
					const result = await tx.nationality.updateMany({
						where: { id, version },
						data: {
							code: data.code,
							label: data.label,
							...(data.vatExempt !== undefined ? { vatExempt: data.vatExempt } : {}),
							updatedBy: request.user.id,
							version: { increment: 1 },
						},
					});

					if (result.count === 0) {
						return null;
					}

					const updated = await tx.nationality.findUnique({
						where: { id },
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'NATIONALITY_UPDATED',
							tableName: 'nationalities',
							recordId: id,
							ipAddress: request.ip,
							oldValues: existing as unknown as Prisma.InputJsonValue,
							newValues: data as unknown as Prisma.InputJsonValue,
						},
					});

					return updated;
				});

				if (!nationality) {
					return reply.status(409).send({
						code: 'OPTIMISTIC_LOCK',
						message: 'Record has been modified by another user',
					});
				}

				return nationality;
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: 'Nationality code already exists',
					});
				}
				throw error;
			}
		},
	});

	// DELETE /:id — Delete nationality
	app.delete('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const existing = await prisma.nationality.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Nationality ${id} not found`,
				});
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.nationality.delete({ where: { id } });

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'NATIONALITY_DELETED',
							tableName: 'nationalities',
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
