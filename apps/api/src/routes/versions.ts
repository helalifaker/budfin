import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionTypeEnum = z.enum(['Budget', 'Forecast', 'Actual']);
const versionStatusEnum = z.enum(['Draft', 'Published', 'Locked', 'Archived']);

const createVersionSchema = z.object({
	name: z.string().min(1).max(100),
	type: versionTypeEnum,
	fiscalYear: z.number().int().min(2000).max(2100),
	description: z.string().max(500).optional(),
	sourceVersionId: z.number().int().positive().optional(),
});

const listQuerySchema = z.object({
	fiscalYear: z.coerce.number().int().optional(),
	status: versionStatusEnum.optional(),
	cursor: z.coerce.number().int().optional(),
	limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatVersion(v: {
	id: number;
	fiscalYear: number;
	name: string;
	type: string;
	status: string;
	description: string | null;
	dataSource: string;
	sourceVersionId: number | null;
	modificationCount: number;
	staleModules: string[];
	createdById: number;
	publishedAt: Date | null;
	lockedAt: Date | null;
	archivedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	createdBy?: { email: string };
}) {
	return {
		id: v.id,
		fiscalYear: v.fiscalYear,
		name: v.name,
		type: v.type,
		status: v.status,
		description: v.description,
		dataSource: v.dataSource,
		sourceVersionId: v.sourceVersionId,
		modificationCount: v.modificationCount,
		staleModules: v.staleModules,
		createdById: v.createdById,
		createdByEmail: v.createdBy?.email ?? null,
		publishedAt: v.publishedAt,
		lockedAt: v.lockedAt,
		archivedAt: v.archivedAt,
		createdAt: v.createdAt,
		updatedAt: v.updatedAt,
	};
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function versionRoutes(app: FastifyInstance) {
	// GET / — List versions with filters + cursor pagination
	app.get('/', {
		schema: { querystring: listQuerySchema },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { fiscalYear, status, cursor, limit } = request.query as z.infer<
				typeof listQuerySchema
			>;

			const where: Prisma.BudgetVersionWhereInput = {};
			if (fiscalYear) where.fiscalYear = fiscalYear;
			if (status) where.status = status;
			if (cursor) where.id = { gt: cursor };

			const [data, total] = await Promise.all([
				prisma.budgetVersion.findMany({
					where,
					orderBy: { createdAt: 'desc' },
					take: limit,
					include: { createdBy: { select: { email: true } } },
				}),
				prisma.budgetVersion.count({ where }),
			]);

			const nextCursor = data.length === limit ? data[data.length - 1]?.id : null;

			return {
				data: data.map(formatVersion),
				total,
				nextCursor,
			};
		},
	});

	// GET /:id — Get single version with all metadata (AC-18)
	app.get('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id },
				include: { createdBy: { select: { email: true } } },
			});

			if (!version) {
				return reply.status(404).send({ code: 'NOT_FOUND', message: `Version ${id} not found` });
			}

			return formatVersion(version);
		},
	});

	// POST / — Create version (Admin, BudgetOwner only — AC-01, AC-02, AC-19)
	app.post('/', {
		schema: { body: createVersionSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const body = request.body as z.infer<typeof createVersionSchema>;

			// AC-02: Actual versions cannot be created manually
			if (body.type === 'Actual') {
				return reply.status(400).send({
					code: 'ACTUAL_VERSION_MANUAL_CREATE_PROHIBITED',
					message: 'Actual versions cannot be created manually',
				});
			}

			try {
				const version = await prisma.$transaction(async (tx) => {
					const created = await (tx as typeof prisma).budgetVersion.create({
						data: {
							name: body.name,
							type: body.type,
							fiscalYear: body.fiscalYear,
							description: body.description ?? null,
							sourceVersionId: body.sourceVersionId ?? null,
							createdById: request.user.id,
							modificationCount: 0,
							staleModules: [],
							status: 'Draft',
							dataSource: 'CALCULATED',
						},
						include: { createdBy: { select: { email: true } } },
					});

					await (tx as typeof prisma).auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'VERSION_CREATED',
							tableName: 'budget_versions',
							recordId: created.id,
							ipAddress: request.ip,
							newValues: body as unknown as Prisma.InputJsonValue,
						},
					});

					return created;
				});

				return reply.status(201).send(formatVersion(version as Parameters<typeof formatVersion>[0]));
			} catch (error) {
				if (
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === 'P2002'
				) {
					return reply.status(409).send({
						code: 'DUPLICATE_VERSION_NAME',
						message: 'A version with this name already exists for this fiscal year',
					});
				}
				throw error;
			}
		},
	});

	// DELETE /:id — Delete Draft version only (AC-09, AC-10, AC-19)
	app.delete('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({ where: { id } });

			if (!version) {
				return reply.status(404).send({ code: 'NOT_FOUND', message: `Version ${id} not found` });
			}

			// AC-10: only Draft versions can be deleted
			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_NOT_DRAFT',
					message: 'Only Draft versions can be deleted',
				});
			}

			await prisma.$transaction(async (tx) => {
				await (tx as typeof prisma).budgetVersion.delete({ where: { id } });

				await (tx as typeof prisma).auditEntry.create({
					data: {
						userId: request.user.id,
						operation: 'VERSION_DELETED',
						tableName: 'budget_versions',
						recordId: id,
						ipAddress: request.ip,
						oldValues: version as unknown as Prisma.InputJsonValue,
					},
				});
			});

			return reply.status(204).send();
		},
	});
}
