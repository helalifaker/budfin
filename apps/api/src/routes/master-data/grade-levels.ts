import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const updateGradeLevelSchema = z
	.object({
		maxClassSize: z.number().int().min(1).max(50),
		plancherPct: z.number().min(0).max(1),
		ciblePct: z.number().min(0).max(1),
		plafondPct: z.number().min(0).max(1),
		displayOrder: z.number().int().min(1),
		version: z.number().int().positive(),
	})
	.refine((data) => data.plancherPct <= data.ciblePct && data.ciblePct <= data.plafondPct, {
		message: 'Must satisfy: plancher <= cible <= plafond',
	});

function serializeGradeLevel(gl: Record<string, unknown>) {
	return {
		...gl,
		plancherPct: String(gl.plancherPct),
		ciblePct: String(gl.ciblePct),
		plafondPct: String(gl.plafondPct),
	};
}

export async function gradeLevelRoutes(app: FastifyInstance) {
	// GET / — list all grade levels
	app.get('/', {
		preHandler: [app.authenticate],
		handler: async () => {
			const gradeLevels = await prisma.gradeLevel.findMany({
				orderBy: { displayOrder: 'asc' },
			});
			return { gradeLevels: gradeLevels.map(serializeGradeLevel) };
		},
	});

	// PUT /:id — update mutable fields
	app.put<{ Params: { id: string } }>('/:id', {
		schema: { body: updateGradeLevelSchema },
		preHandler: [app.authenticate, app.requirePermission('admin:config')],
		handler: async (request, reply) => {
			const id = Number(request.params.id);
			if (Number.isNaN(id)) {
				return reply.status(400).send({
					code: 'INVALID_ID',
					message: 'Grade level ID must be a number',
				});
			}

			const existing = await prisma.gradeLevel.findUnique({ where: { id } });
			if (!existing) {
				return reply.status(404).send({
					code: 'NOT_FOUND',
					message: `Grade level ${id} not found`,
				});
			}

			const body = request.body as z.infer<typeof updateGradeLevelSchema>;

			if (existing.version !== body.version) {
				return reply.status(409).send({
					code: 'OPTIMISTIC_LOCK',
					message: 'Record has been modified by another user. Please refresh.',
				});
			}

			const oldValues = {
				maxClassSize: existing.maxClassSize,
				plancherPct: String(existing.plancherPct),
				ciblePct: String(existing.ciblePct),
				plafondPct: String(existing.plafondPct),
				displayOrder: existing.displayOrder,
			};

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.gradeLevel.update({
					where: { id },
					data: {
						maxClassSize: body.maxClassSize,
						plancherPct: body.plancherPct,
						ciblePct: body.ciblePct,
						plafondPct: body.plafondPct,
						displayOrder: body.displayOrder,
						version: { increment: 1 },
					},
				});

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						operation: 'GRADE_LEVEL_UPDATED',
						tableName: 'grade_levels',
						ipAddress: request.ip,
						oldValues,
						newValues: {
							maxClassSize: body.maxClassSize,
							plancherPct: String(body.plancherPct),
							ciblePct: String(body.ciblePct),
							plafondPct: String(body.plafondPct),
							displayOrder: body.displayOrder,
						},
					},
				});

				return result;
			});

			return serializeGradeLevel(updated);
		},
	});

	// POST / — 405 Method Not Allowed
	app.post('/', async (_request, reply) => {
		return reply.status(405).send({
			code: 'METHOD_NOT_ALLOWED',
			message: 'Grade levels cannot be created via API. They are seeded.',
		});
	});

	// DELETE /:id — 405 Method Not Allowed
	app.delete('/:id', async (_request, reply) => {
		return reply.status(405).send({
			code: 'METHOD_NOT_ALLOWED',
			message: 'Grade levels cannot be deleted.',
		});
	});
}
