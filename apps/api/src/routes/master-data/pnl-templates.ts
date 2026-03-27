import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const createTemplateSchema = z.object({
	name: z.string().min(1).max(100),
	isDefault: z.boolean().optional().default(false),
});

const updateTemplateSchema = z.object({
	name: z.string().min(1).max(100),
	isDefault: z.boolean().optional(),
	version: z.number().int().positive(),
});

const mappingSchema = z.object({
	analyticalKey: z.string().min(1).max(80),
	analyticalKeyType: z.enum(['CATEGORY', 'LINE_ITEM']),
	accountCode: z.string().max(10).nullable().optional(),
	monthFilter: z.array(z.number().int().min(1).max(12)).optional().default([]),
	displayLabel: z.string().max(120).nullable().optional(),
	visibility: z.enum(['SHOW', 'GROUP', 'EXCLUDE']).optional().default('SHOW'),
	displayOrder: z.number().int(),
	profitCenterAllocation: z.enum(['DIRECT', 'HEADCOUNT', 'MANUAL']).optional().default('HEADCOUNT'),
	manualAllocation: z.record(z.string(), z.number()).nullable().optional(),
});

const sectionSchema = z.object({
	sectionKey: z.string().min(1).max(40),
	displayLabel: z.string().min(1).max(100),
	displayOrder: z.number().int(),
	isSubtotal: z.boolean().optional().default(false),
	subtotalFormula: z.string().max(200).nullable().optional(),
	signConvention: z.enum(['POSITIVE', 'NEGATIVE']).optional().default('POSITIVE'),
	mappings: z.array(mappingSchema).optional().default([]),
});

const bulkMappingsSchema = z.object({
	sections: z.array(sectionSchema),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export async function pnlTemplateRoutes(app: FastifyInstance) {
	// GET / — List all templates with section count
	app.get('/', {
		preHandler: [app.authenticate],
		handler: async () => {
			const templates = await prisma.pnlTemplate.findMany({
				include: {
					_count: { select: { sections: true } },
				},
				orderBy: { name: 'asc' },
			});

			return { templates };
		},
	});

	// POST / — Create template
	app.post('/', {
		schema: { body: createTemplateSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const body = request.body as z.infer<typeof createTemplateSchema>;

			try {
				const template = await prisma.$transaction(async (tx) => {
					const created = await tx.pnlTemplate.create({
						data: {
							name: body.name,
							isDefault: body.isDefault ?? false,
							createdBy: request.user.id,
							updatedBy: request.user.id,
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'PNL_TEMPLATE_CREATED',
							tableName: 'pnl_templates',
							recordId: created.id,
							ipAddress: request.ip,
							newValues: body as unknown as Prisma.InputJsonValue,
						},
					});

					return created;
				});

				return reply.status(201).send(template);
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_NAME',
						message: 'Template name already exists',
					});
				}
				throw error;
			}
		},
	});

	// PUT /:id — Update template (optimistic lock)
	app.put('/:id', {
		schema: { params: idParamsSchema, body: updateTemplateSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { version, ...data } = request.body as z.infer<typeof updateTemplateSchema>;

			const existing = await prisma.pnlTemplate.findUnique({ where: { id } });

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Template ${id} not found`,
				});
			}

			try {
				const template = await prisma.$transaction(async (tx) => {
					const result = await tx.pnlTemplate.updateMany({
						where: { id, version },
						data: {
							name: data.name,
							...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
							updatedBy: request.user.id,
							version: { increment: 1 },
						},
					});

					if (result.count === 0) {
						return null;
					}

					const updated = await tx.pnlTemplate.findUnique({ where: { id } });

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'PNL_TEMPLATE_UPDATED',
							tableName: 'pnl_templates',
							recordId: id,
							ipAddress: request.ip,
							oldValues: existing as unknown as Prisma.InputJsonValue,
							newValues: data as unknown as Prisma.InputJsonValue,
						},
					});

					return updated;
				});

				if (!template) {
					return reply.status(409).send({
						code: 'OPTIMISTIC_LOCK',
						message: 'Record has been modified by another user',
					});
				}

				return template;
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_NAME',
						message: 'Template name already exists',
					});
				}
				throw error;
			}
		},
	});

	// DELETE /:id — Delete template (system templates protected)
	app.delete('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const existing = await prisma.pnlTemplate.findUnique({ where: { id } });

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Template ${id} not found`,
				});
			}

			if (existing.isSystem) {
				return reply.status(403).send({
					code: 'SYSTEM_TEMPLATE',
					message: 'Cannot delete system templates',
				});
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.pnlTemplate.delete({ where: { id } });

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'PNL_TEMPLATE_DELETED',
							tableName: 'pnl_templates',
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

	// GET /:id/mappings — Get template with full nested structure
	app.get('/:id/mappings', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const template = await prisma.pnlTemplate.findUnique({
				where: { id },
				include: {
					sections: {
						include: {
							mappings: {
								orderBy: { displayOrder: 'asc' },
							},
						},
						orderBy: { displayOrder: 'asc' },
					},
				},
			});

			if (!template) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Template ${id} not found`,
				});
			}

			return template;
		},
	});

	// PUT /:id/mappings — Bulk save sections and mappings
	app.put('/:id/mappings', {
		schema: { params: idParamsSchema, body: bulkMappingsSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { sections } = request.body as z.infer<typeof bulkMappingsSchema>;

			const existing = await prisma.pnlTemplate.findUnique({ where: { id } });

			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Template ${id} not found`,
				});
			}

			const template = await prisma.$transaction(async (tx) => {
				// Delete all existing sections (cascades to mappings)
				await tx.pnlTemplateSection.deleteMany({ where: { templateId: id } });

				// Recreate sections and mappings
				for (const section of sections) {
					const createdSection = await tx.pnlTemplateSection.create({
						data: {
							templateId: id,
							sectionKey: section.sectionKey,
							displayLabel: section.displayLabel,
							displayOrder: section.displayOrder,
							isSubtotal: section.isSubtotal ?? false,
							subtotalFormula: section.subtotalFormula ?? null,
							signConvention: section.signConvention ?? 'POSITIVE',
						},
					});

					if (section.mappings && section.mappings.length > 0) {
						await tx.pnlAccountMapping.createMany({
							data: section.mappings.map((m) => ({
								sectionId: createdSection.id,
								analyticalKey: m.analyticalKey,
								analyticalKeyType: m.analyticalKeyType,
								accountCode: m.accountCode ?? null,
								monthFilter: m.monthFilter ?? [],
								displayLabel: m.displayLabel ?? null,
								visibility: m.visibility ?? 'SHOW',
								displayOrder: m.displayOrder,
								profitCenterAllocation: m.profitCenterAllocation ?? 'HEADCOUNT',
								manualAllocation: (m.manualAllocation as Prisma.InputJsonValue) ?? null,
							})),
						});
					}
				}

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'PNL_TEMPLATE_MAPPINGS_UPDATED',
						tableName: 'pnl_template_sections',
						recordId: id,
						ipAddress: request.ip,
						newValues: { sectionCount: sections.length } as Prisma.InputJsonValue,
					},
				});

				return tx.pnlTemplate.findUnique({
					where: { id },
					include: {
						sections: {
							include: {
								mappings: { orderBy: { displayOrder: 'asc' } },
							},
							orderBy: { displayOrder: 'asc' },
						},
					},
				});
			});

			return template;
		},
	});
}
