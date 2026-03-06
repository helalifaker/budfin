import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const accountTypeEnum = z.enum(['REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY']);
const centerTypeEnum = z.enum(['PROFIT_CENTER', 'COST_CENTER']);
const accountStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

const createAccountSchema = z.object({
	accountCode: z
		.string()
		.min(3)
		.max(10)
		.regex(/^[A-Z0-9]{3,10}$/),
	accountName: z.string().min(1).max(100),
	type: accountTypeEnum,
	ifrsCategory: z.string().min(1).max(100),
	centerType: centerTypeEnum,
	description: z.string().max(500).optional(),
	status: accountStatusEnum.optional(),
});

const updateAccountSchema = createAccountSchema.extend({
	version: z.number().int().positive(),
});

const listQuerySchema = z.object({
	type: accountTypeEnum.optional(),
	centerType: centerTypeEnum.optional(),
	status: accountStatusEnum.optional(),
	search: z.string().optional(),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export async function accountRoutes(app: FastifyInstance) {
	// GET / — List accounts with filters
	app.get('/', {
		schema: { querystring: listQuerySchema },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { type, centerType, status, search } = request.query as z.infer<typeof listQuerySchema>;

			const where: Prisma.ChartOfAccountWhereInput = {};
			if (type) where.type = type;
			if (centerType) where.centerType = centerType;
			if (status) where.status = status;
			if (search) {
				where.OR = [
					{ accountCode: { contains: search, mode: 'insensitive' } },
					{ accountName: { contains: search, mode: 'insensitive' } },
				];
			}

			const accounts = await prisma.chartOfAccount.findMany({
				where,
				orderBy: { accountCode: 'asc' },
			});

			return { accounts };
		},
	});

	// GET /:id — Get single account
	app.get('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const account = await prisma.chartOfAccount.findUnique({
				where: { id },
			});

			if (!account) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Account ${id} not found`,
				});
			}

			return account;
		},
	});

	// POST / — Create account
	app.post('/', {
		schema: { body: createAccountSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const body = request.body as z.infer<typeof createAccountSchema>;

			try {
				const account = await prisma.$transaction(async (tx) => {
					const created = await tx.chartOfAccount.create({
						data: {
							accountCode: body.accountCode,
							accountName: body.accountName,
							type: body.type,
							ifrsCategory: body.ifrsCategory,
							centerType: body.centerType,
							description: body.description ?? null,
							status: body.status ?? 'ACTIVE',
							createdBy: request.user.id,
							updatedBy: request.user.id,
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'ACCOUNT_CREATED',
							tableName: 'chart_of_accounts',
							recordId: created.id,
							ipAddress: request.ip,
							newValues: body as unknown as Prisma.InputJsonValue,
						},
					});

					return created;
				});

				return reply.status(201).send(account);
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: 'Account code already exists',
					});
				}
				throw error;
			}
		},
	});

	// PUT /:id — Update account (optimistic lock)
	app.put('/:id', {
		schema: { params: idParamsSchema, body: updateAccountSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { version, ...data } = request.body as z.infer<typeof updateAccountSchema>;

			const existing = await prisma.chartOfAccount.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Account ${id} not found`,
				});
			}

			try {
				const account = await prisma.$transaction(async (tx) => {
					const result = await tx.chartOfAccount.updateMany({
						where: { id, version },
						data: {
							accountCode: data.accountCode,
							accountName: data.accountName,
							type: data.type,
							ifrsCategory: data.ifrsCategory,
							centerType: data.centerType,
							description: data.description ?? null,
							...(data.status !== undefined ? { status: data.status } : {}),
							updatedBy: request.user.id,
							version: { increment: 1 },
						},
					});

					if (result.count === 0) {
						return null;
					}

					const updated = await tx.chartOfAccount.findUnique({
						where: { id },
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'ACCOUNT_UPDATED',
							tableName: 'chart_of_accounts',
							recordId: id,
							ipAddress: request.ip,
							oldValues: existing as unknown as Prisma.InputJsonValue,
							newValues: data as unknown as Prisma.InputJsonValue,
						},
					});

					return updated;
				});

				if (!account) {
					return reply.status(409).send({
						code: 'OPTIMISTIC_LOCK',
						message: 'Record has been modified by another user',
					});
				}

				return account;
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_CODE',
						message: 'Account code already exists',
					});
				}
				throw error;
			}
		},
	});

	// DELETE /:id — Delete account
	app.delete('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const existing = await prisma.chartOfAccount.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Account ${id} not found`,
				});
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.chartOfAccount.delete({ where: { id } });

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'ACCOUNT_DELETED',
							tableName: 'chart_of_accounts',
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
