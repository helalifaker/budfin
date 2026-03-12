import type { FastifyInstance } from 'fastify';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const updateGradeLevelSchema = z
	.object({
		maxClassSize: z.number().int().min(1).max(50),
		defaultAy2Intake: z.number().int().min(0).max(200).nullable().optional(),
		plancherPct: z.number().min(0).max(1),
		ciblePct: z.number().min(0).max(1),
		plafondPct: z.number().min(0).max(1),
		displayOrder: z.number().int().min(1),
		version: z.number().int().positive(),
	})
	.refine(
		(data) =>
			new Decimal(data.plancherPct).lte(new Decimal(data.ciblePct)) &&
			new Decimal(data.ciblePct).lte(new Decimal(data.plafondPct)),
		{
			message: 'Must satisfy: plancher <= cible <= plafond',
		}
	);

function serializeGradeLevel(gl: Record<string, unknown>) {
	return {
		...gl,
		plancherPct: new Decimal(String(gl.plancherPct)).toFixed(4),
		ciblePct: new Decimal(String(gl.ciblePct)).toFixed(4),
		plafondPct: new Decimal(String(gl.plafondPct)).toFixed(4),
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

			const oldValues = {
				maxClassSize: existing.maxClassSize,
				defaultAy2Intake: existing.defaultAy2Intake,
				plancherPct: String(existing.plancherPct),
				ciblePct: String(existing.ciblePct),
				plafondPct: String(existing.plafondPct),
				displayOrder: existing.displayOrder,
			};

			const updated = await prisma.$transaction(async (tx) => {
				const result = await tx.gradeLevel.updateMany({
					where: { id, version: body.version },
					data: {
						maxClassSize: body.maxClassSize,
						defaultAy2Intake: body.defaultAy2Intake ?? null,
						plancherPct: new Decimal(body.plancherPct)
							.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
							.toFixed(4),
						ciblePct: new Decimal(body.ciblePct)
							.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
							.toFixed(4),
						plafondPct: new Decimal(body.plafondPct)
							.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
							.toFixed(4),
						displayOrder: body.displayOrder,
						version: { increment: 1 },
					},
				});

				if (result.count === 0) {
					return null;
				}

				const refetched = await tx.gradeLevel.findUnique({
					where: { id },
				});

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'GRADE_LEVEL_UPDATED',
						tableName: 'grade_levels',
						recordId: id,
						ipAddress: request.ip,
						oldValues,
						newValues: {
							maxClassSize: body.maxClassSize,
							defaultAy2Intake: body.defaultAy2Intake ?? null,
							plancherPct: String(body.plancherPct),
							ciblePct: String(body.ciblePct),
							plafondPct: String(body.plafondPct),
							displayOrder: body.displayOrder,
						},
					},
				});

				return refetched;
			});

			if (!updated) {
				return reply.status(409).send({
					code: 'OPTIMISTIC_LOCK',
					message: 'Record has been modified by another user. Please refresh.',
				});
			}

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
