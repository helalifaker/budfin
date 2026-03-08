import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const departmentBandEnum = z.enum([
	'MATERNELLE',
	'ELEMENTAIRE',
	'COLLEGE',
	'LYCEE',
	'NON_ACADEMIC',
]);

const createDepartmentSchema = z.object({
	code: z
		.string()
		.min(2)
		.max(20)
		.regex(/^[A-Z_]{2,20}$/),
	label: z.string().min(1).max(100),
	bandMapping: departmentBandEnum,
});

const updateDepartmentSchema = createDepartmentSchema.extend({
	version: z.number().int().positive(),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export async function departmentRoutes(app: FastifyInstance) {
	// GET / — List departments
	app.get('/', {
		preHandler: [app.authenticate],
		handler: async () => {
			const departments = await prisma.department.findMany({
				orderBy: { code: 'asc' },
			});
			return { departments };
		},
	});

	// POST / — Create department
	app.post('/', {
		schema: { body: createDepartmentSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const body = request.body as z.infer<typeof createDepartmentSchema>;

			try {
				const department = await prisma.$transaction(async (tx) => {
					const created = await tx.department.create({
						data: {
							...body,
							createdBy: request.user.id,
							updatedBy: request.user.id,
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'DEPARTMENT_CREATED',
							tableName: 'departments',
							recordId: created.id,
							ipAddress: request.ip,
							newValues: body as unknown as Prisma.InputJsonValue,
						},
					});

					return created;
				});

				return reply.status(201).send(department);
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: 'Department code already exists',
					});
				}
				throw error;
			}
		},
	});

	// PUT /:id — Update department (optimistic lock)
	app.put('/:id', {
		schema: { params: idParamsSchema, body: updateDepartmentSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { version, ...data } = request.body as z.infer<typeof updateDepartmentSchema>;

			const existing = await prisma.department.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Department ${id} not found`,
				});
			}

			try {
				const department = await prisma.$transaction(async (tx) => {
					const result = await tx.department.updateMany({
						where: { id, version },
						data: {
							...data,
							updatedBy: request.user.id,
							version: { increment: 1 },
						},
					});

					if (result.count === 0) {
						return null;
					}

					const updated = await tx.department.findUnique({
						where: { id },
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'DEPARTMENT_UPDATED',
							tableName: 'departments',
							recordId: id,
							ipAddress: request.ip,
							oldValues: existing as unknown as Prisma.InputJsonValue,
							newValues: data as unknown as Prisma.InputJsonValue,
						},
					});

					return updated;
				});

				if (!department) {
					return reply.status(409).send({
						code: 'OPTIMISTIC_LOCK',
						message: 'Record has been modified by another user',
					});
				}

				return department;
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: 'Department code already exists',
					});
				}
				throw error;
			}
		},
	});

	// DELETE /:id — Delete department
	app.delete('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const existing = await prisma.department.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Department ${id} not found`,
				});
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.department.delete({ where: { id } });

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'DEPARTMENT_DELETED',
							tableName: 'departments',
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
