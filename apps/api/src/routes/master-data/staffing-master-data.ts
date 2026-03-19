import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

const disciplineListQuery = z.object({
	category: z.string().optional(),
});

const dhgRuleListQuery = z.object({
	year: z.coerce.number().int().positive().optional(),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

const createDhgRuleSchema = z.object({
	gradeLevel: z.string().min(1).max(10),
	disciplineId: z.coerce.number().int().positive(),
	lineType: z.enum(['STRUCTURAL', 'HOST_COUNTRY', 'AUTONOMY', 'SPECIALTY']),
	driverType: z.enum(['HOURS', 'GROUPS']),
	hoursPerUnit: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal with up to 2 places'),
	serviceProfileId: z.coerce.number().int().positive(),
	languageCode: z.string().max(5).nullable().optional(),
	groupingKey: z.string().max(50).nullable().optional(),
	effectiveFromYear: z.coerce.number().int().positive(),
	effectiveToYear: z.coerce.number().int().positive().nullable().optional(),
});

const updateDhgRuleSchema = createDhgRuleSchema.extend({
	updatedAt: z.string().datetime(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapRuleToResponse(r: {
	id: number;
	gradeLevel: string;
	disciplineId: number;
	discipline: { code: string; name: string };
	lineType: string;
	driverType: string;
	hoursPerUnit: Prisma.Decimal;
	serviceProfileId: number;
	serviceProfile: { code: string; name: string };
	languageCode: string | null;
	groupingKey: string | null;
	effectiveFromYear: number;
	effectiveToYear: number | null;
	updatedAt: Date;
}) {
	return {
		id: r.id,
		gradeLevel: r.gradeLevel,
		disciplineId: r.disciplineId,
		disciplineCode: r.discipline.code,
		disciplineName: r.discipline.name,
		lineType: r.lineType,
		driverType: r.driverType,
		hoursPerUnit: r.hoursPerUnit.toString(),
		serviceProfileId: r.serviceProfileId,
		serviceProfileCode: r.serviceProfile.code,
		serviceProfileName: r.serviceProfile.name,
		languageCode: r.languageCode,
		groupingKey: r.groupingKey,
		effectiveFromYear: r.effectiveFromYear,
		effectiveToYear: r.effectiveToYear,
		updatedAt: r.updatedAt.toISOString(),
	};
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function staffingMasterDataRoutes(app: FastifyInstance) {
	// GET /service-profiles — List all ServiceObligationProfile ordered by sortOrder
	app.get('/service-profiles', {
		preHandler: [app.authenticate],
		handler: async () => {
			const profiles = await prisma.serviceObligationProfile.findMany({
				orderBy: { sortOrder: 'asc' },
			});

			return {
				profiles: profiles.map((p) => ({
					id: p.id,
					code: p.code,
					name: p.name,
					weeklyServiceHours: p.weeklyServiceHours.toString(),
					hsaEligible: p.hsaEligible,
					defaultCostMode: p.defaultCostMode,
					sortOrder: p.sortOrder,
				})),
			};
		},
	});

	// GET /disciplines — List all Discipline with aliases, optional ?category filter
	app.get('/disciplines', {
		schema: { querystring: disciplineListQuery },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { category } = request.query as z.infer<typeof disciplineListQuery>;

			const where = category ? { category } : {};

			const disciplines = await prisma.discipline.findMany({
				where,
				include: { aliases: true },
				orderBy: { sortOrder: 'asc' },
			});

			return {
				disciplines: disciplines.map((d) => ({
					id: d.id,
					code: d.code,
					name: d.name,
					category: d.category,
					sortOrder: d.sortOrder,
					aliases: d.aliases.map((a) => ({
						id: a.id,
						alias: a.alias,
					})),
				})),
			};
		},
	});

	// GET /dhg-rules — List DhgRule with discipline/profile joins, optional ?year filter
	app.get('/dhg-rules', {
		schema: { querystring: dhgRuleListQuery },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { year } = request.query as z.infer<typeof dhgRuleListQuery>;

			const where = year
				? {
						effectiveFromYear: { lte: year },
						OR: [{ effectiveToYear: null }, { effectiveToYear: { gte: year } }],
					}
				: {};

			const rules = await prisma.dhgRule.findMany({
				where,
				include: {
					discipline: true,
					serviceProfile: true,
				},
				orderBy: [{ gradeLevel: 'asc' }, { disciplineId: 'asc' }],
			});

			return { rules: rules.map(mapRuleToResponse) };
		},
	});

	// POST /dhg-rules — Create a new DHG rule
	app.post('/dhg-rules', {
		schema: { body: createDhgRuleSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const body = request.body as z.infer<typeof createDhgRuleSchema>;

			try {
				const rule = await prisma.$transaction(async (tx) => {
					const created = await tx.dhgRule.create({
						data: {
							gradeLevel: body.gradeLevel,
							disciplineId: body.disciplineId,
							lineType: body.lineType,
							driverType: body.driverType,
							hoursPerUnit: body.hoursPerUnit,
							serviceProfileId: body.serviceProfileId,
							languageCode: body.languageCode ?? null,
							groupingKey: body.groupingKey ?? null,
							effectiveFromYear: body.effectiveFromYear,
							effectiveToYear: body.effectiveToYear ?? null,
						},
						include: {
							discipline: true,
							serviceProfile: true,
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'DHG_RULE_CREATED',
							tableName: 'dhg_rules',
							recordId: created.id,
							ipAddress: request.ip,
							newValues: body as unknown as Prisma.InputJsonValue,
						},
					});

					return created;
				});

				return reply.status(201).send(mapRuleToResponse(rule));
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_RULE',
						message: 'A DHG rule with the same key already exists',
					});
				}
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
					return reply.status(400).send({
						code: 'INVALID_REFERENCE',
						message: 'Referenced discipline or service profile does not exist',
					});
				}
				throw error;
			}
		},
	});

	// PUT /dhg-rules/:id — Update a DHG rule (optimistic lock via updatedAt)
	app.put('/dhg-rules/:id', {
		schema: { params: idParamsSchema, body: updateDhgRuleSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { updatedAt, ...data } = request.body as z.infer<typeof updateDhgRuleSchema>;

			const existing = await prisma.dhgRule.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `DHG rule ${id} not found`,
				});
			}

			if (existing.updatedAt.toISOString() !== updatedAt) {
				return reply.status(409).send({
					code: 'OPTIMISTIC_LOCK',
					message: 'Record has been modified by another user',
				});
			}

			try {
				const rule = await prisma.$transaction(async (tx) => {
					const updated = await tx.dhgRule.update({
						where: { id },
						data: {
							gradeLevel: data.gradeLevel,
							disciplineId: data.disciplineId,
							lineType: data.lineType,
							driverType: data.driverType,
							hoursPerUnit: data.hoursPerUnit,
							serviceProfileId: data.serviceProfileId,
							languageCode: data.languageCode ?? null,
							groupingKey: data.groupingKey ?? null,
							effectiveFromYear: data.effectiveFromYear,
							effectiveToYear: data.effectiveToYear ?? null,
						},
						include: {
							discipline: true,
							serviceProfile: true,
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'DHG_RULE_UPDATED',
							tableName: 'dhg_rules',
							recordId: id,
							ipAddress: request.ip,
							oldValues: existing as unknown as Prisma.InputJsonValue,
							newValues: data as unknown as Prisma.InputJsonValue,
						},
					});

					return updated;
				});

				return mapRuleToResponse(rule);
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_RULE',
						message: 'A DHG rule with the same key already exists',
					});
				}
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
					return reply.status(400).send({
						code: 'INVALID_REFERENCE',
						message: 'Referenced discipline or service profile does not exist',
					});
				}
				throw error;
			}
		},
	});

	// DELETE /dhg-rules/:id — Delete a DHG rule
	app.delete('/dhg-rules/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const existing = await prisma.dhgRule.findUnique({
				where: { id },
			});

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `DHG rule ${id} not found`,
				});
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.dhgRule.delete({ where: { id } });

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'DHG_RULE_DELETED',
							tableName: 'dhg_rules',
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
						message: 'Cannot delete: rule is referenced by other data',
					});
				}
				throw error;
			}
		},
	});
}
