import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionTypeEnum = z.enum(['Budget', 'Forecast', 'Actual']);
const versionStatusEnum = z.enum(['Draft', 'Published', 'Locked', 'Archived']);

const patchStatusSchema = z.object({
	new_status: versionStatusEnum,
	audit_note: z.string().optional(),
});

const cloneVersionSchema = z.object({
	name: z.string().min(1).max(100),
	fiscalYear: z.number().int().min(2000).max(2100).optional(),
});

const compareQuerySchema = z.object({
	primary: z.coerce.number().int().positive(),
	comparison: z.coerce.number().int().positive(),
});

// ── State machine ─────────────────────────────────────────────────────────────

interface TransitionDef {
	roles: string[];
	isReverse: boolean;
	timestampField?: string;
	clearFields?: string[];
	operation: string;
}

const TRANSITIONS: Record<string, Record<string, TransitionDef>> = {
	Draft: {
		Published: {
			roles: ['Admin', 'BudgetOwner'],
			isReverse: false,
			timestampField: 'publishedAt',
			operation: 'VERSION_PUBLISHED',
		},
	},
	Published: {
		Locked: {
			roles: ['Admin', 'BudgetOwner'],
			isReverse: false,
			timestampField: 'lockedAt',
			operation: 'VERSION_LOCKED',
		},
		Draft: {
			roles: ['Admin'],
			isReverse: true,
			clearFields: ['publishedAt'],
			operation: 'VERSION_REVERTED',
		},
	},
	Locked: {
		Archived: {
			roles: ['Admin', 'BudgetOwner'],
			isReverse: false,
			timestampField: 'archivedAt',
			operation: 'VERSION_ARCHIVED',
		},
		Draft: {
			roles: ['Admin'],
			isReverse: true,
			clearFields: ['publishedAt', 'lockedAt'],
			operation: 'VERSION_REVERTED',
		},
	},
};

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

	// GET /compare — Version comparison (AC-13, TC-001)
	app.get('/compare', {
		schema: { querystring: compareQuerySchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { primary, comparison } = request.query as z.infer<typeof compareQuerySchema>;

			const [primaryVersion, compVersion] = await Promise.all([
				prisma.budgetVersion.findUnique({ where: { id: primary } }),
				prisma.budgetVersion.findUnique({ where: { id: comparison } }),
			]);

			if (!primaryVersion) {
				return reply.status(404).send({ code: 'NOT_FOUND', message: `Version ${primary} not found` });
			}
			if (!compVersion) {
				return reply.status(404).send({ code: 'NOT_FOUND', message: `Version ${comparison} not found` });
			}

			const [primarySummaries, compSummaries] = await Promise.all([
				prisma.monthlyBudgetSummary.findMany({ where: { versionId: primary } }),
				prisma.monthlyBudgetSummary.findMany({ where: { versionId: comparison } }),
			]);

			type SummaryRow = { month: number; revenueHt: unknown; staffCosts: unknown; netProfit: unknown };
			const primaryByMonth = new Map<number, SummaryRow>(
				(primarySummaries as SummaryRow[]).map((s) => [s.month, s]),
			);
			const compByMonth = new Map<number, SummaryRow>(
				(compSummaries as SummaryRow[]).map((s) => [s.month, s]),
			);

			const allMonths = new Set([...primaryByMonth.keys(), ...compByMonth.keys()]);

			if (allMonths.size === 0) {
				return [];
			}

			function variance(pVal: unknown, cVal: unknown) {
				const p = new Decimal(String(pVal ?? 0));
				const c = new Decimal(String(cVal ?? 0));
				const abs = p.minus(c);
				const pct = c.isZero() ? null : abs.div(c.abs()).times(100);
				return { abs: abs.toString(), pct: pct ? pct.toString() : null };
			}

			return Array.from(allMonths)
				.sort((a, b) => a - b)
				.map((month) => {
					const p = primaryByMonth.get(month);
					const c = compByMonth.get(month);
					const rev = variance(p?.revenueHt, c?.revenueHt);
					const staff = variance(p?.staffCosts, c?.staffCosts);
					const net = variance(p?.netProfit, c?.netProfit);
					return {
						month,
						revenue_abs: rev.abs,
						revenue_pct: rev.pct,
						staff_costs_abs: staff.abs,
						staff_costs_pct: staff.pct,
						net_profit_abs: net.abs,
						net_profit_pct: net.pct,
					};
				});
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

	// POST /:id/clone — Clone a version (AC-11, AC-12, AC-19)
	app.post('/:id/clone', {
		schema: { params: idParamsSchema, body: cloneVersionSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const body = request.body as z.infer<typeof cloneVersionSchema>;

			const source = await prisma.budgetVersion.findUnique({
				where: { id },
				include: { createdBy: { select: { email: true } } },
			});

			if (!source) {
				return reply.status(404).send({ code: 'NOT_FOUND', message: `Version ${id} not found` });
			}

			// AC-12: Actual versions cannot be cloned
			if (source.type === 'Actual') {
				return reply.status(409).send({
					code: 'ACTUAL_VERSION_CLONE_PROHIBITED',
					message: 'Actual versions cannot be cloned',
				});
			}

			// Fetch existing monthly summaries to deep-copy
			const summaries = await prisma.monthlyBudgetSummary.findMany({
				where: { versionId: id },
			});

			try {
				const cloned = await prisma.$transaction(async (tx) => {
					const newVersion = await (tx as typeof prisma).budgetVersion.create({
						data: {
							name: body.name,
							type: source.type,
							fiscalYear: body.fiscalYear ?? source.fiscalYear,
							description: source.description,
							sourceVersionId: id,
							createdById: request.user.id,
							modificationCount: 0,
							staleModules: [],
							status: 'Draft',
							dataSource: source.dataSource,
						},
						include: { createdBy: { select: { email: true } } },
					});

					if (summaries.length > 0) {
						await (tx as typeof prisma).monthlyBudgetSummary.createMany({
							data: summaries.map((s) => ({
								versionId: newVersion.id,
								month: s.month,
								revenueHt: s.revenueHt,
								staffCosts: s.staffCosts,
								netProfit: s.netProfit,
								calculatedAt: s.calculatedAt,
							})),
						});
					}

					await (tx as typeof prisma).auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'VERSION_CLONED',
							tableName: 'budget_versions',
							recordId: newVersion.id,
							ipAddress: request.ip,
							newValues: { sourceVersionId: id, name: body.name } as Prisma.InputJsonValue,
						},
					});

					return newVersion;
				});

				return reply.status(201).send(formatVersion(cloned as Parameters<typeof formatVersion>[0]));
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

	// PATCH /:id/status — Lifecycle state machine (AC-04 to AC-08, AC-19)
	app.patch('/:id/status', {
		schema: { params: idParamsSchema, body: patchStatusSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { new_status, audit_note } = request.body as z.infer<typeof patchStatusSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id },
				include: { createdBy: { select: { email: true } } },
			});

			if (!version) {
				return reply.status(404).send({ code: 'NOT_FOUND', message: `Version ${id} not found` });
			}

			const currentStatus = version.status;
			const fromTransitions = TRANSITIONS[currentStatus];
			const transition = fromTransitions?.[new_status];

			if (!transition) {
				return reply.status(409).send({
					code: 'INVALID_TRANSITION',
					message: `Cannot transition from ${currentStatus} to ${new_status}`,
				});
			}

			// RBAC: only allowed roles for this specific transition
			if (!transition.roles.includes(request.user.role)) {
				return reply.status(403).send({ error: 'FORBIDDEN', message: 'Insufficient role' });
			}

			// AC-07/AC-08: reverse transitions require audit_note ≥ 10 chars
			if (transition.isReverse) {
				if (!audit_note || audit_note.length < 10) {
					return reply.status(400).send({
						code: 'AUDIT_NOTE_REQUIRED',
						message: 'Reverse transitions require an audit note of at least 10 characters',
					});
				}
			}

			const now = new Date();
			const updateData: Record<string, unknown> = { status: new_status };

			if (transition.timestampField) {
				updateData[transition.timestampField] = now;
			}

			if (transition.clearFields) {
				for (const field of transition.clearFields) {
					updateData[field] = null;
				}
			}

			if (transition.isReverse) {
				updateData.modificationCount = version.modificationCount + 1;
			}

			const updated = await prisma.$transaction(async (tx) => {
				const result = await (tx as typeof prisma).budgetVersion.update({
					where: { id },
					data: updateData as Prisma.BudgetVersionUpdateInput,
					include: { createdBy: { select: { email: true } } },
				});

				await (tx as typeof prisma).auditEntry.create({
					data: {
						userId: request.user.id,
						operation: transition.operation,
						tableName: 'budget_versions',
						recordId: id,
						ipAddress: request.ip,
						oldValues: { status: currentStatus } as Prisma.InputJsonValue,
						newValues: {
							status: new_status,
							...(audit_note ? { audit_note } : {}),
						} as Prisma.InputJsonValue,
					},
				});

				return result;
			});

			return formatVersion(updated as Parameters<typeof formatVersion>[0]);
		},
	});
}
