import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';

const patchAssumptionsSchema = z.object({
	updates: z.array(
		z.object({
			key: z.string(),
			value: z.string(),
			version: z.number().int().positive(),
		})
	),
});

const GOSI_KEYS = ['gosiPension', 'gosiSaned', 'gosiOhi'];

function validateAssumptionValue(value: string, valueType: string): string | null {
	switch (valueType) {
		case 'PERCENTAGE': {
			const num = Number(value);
			if (isNaN(num) || num < 0 || num > 100) return 'Must be a number between 0 and 100';
			return null;
		}
		case 'CURRENCY': {
			const num = Number(value);
			if (isNaN(num) || num < 0) return 'Must be a non-negative number';
			return null;
		}
		case 'INTEGER': {
			const num = Number(value);
			if (isNaN(num) || !Number.isInteger(num)) return 'Must be a whole number';
			return null;
		}
		case 'DECIMAL': {
			if (isNaN(Number(value))) return 'Must be a valid number';
			return null;
		}
		default:
			return null;
	}
}

function computeGosiTotal(assumptions: Array<{ key: string; value: string }>): string {
	const gosiAssumptions = assumptions.filter((a) => GOSI_KEYS.includes(a.key));
	const total = gosiAssumptions.reduce((sum, a) => sum.plus(new Decimal(a.value)), new Decimal(0));
	return total.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

export async function assumptionRoutes(app: FastifyInstance) {
	// GET / — List all assumptions with computed GOSI total
	app.get('/', {
		preHandler: [app.authenticate],
		handler: async () => {
			const assumptions = await prisma.assumption.findMany({
				orderBy: { section: 'asc' },
			});

			return {
				assumptions,
				computed: {
					gosiRateTotal: computeGosiTotal(assumptions),
				},
			};
		},
	});

	// PATCH / — Bulk update assumptions by key
	app.patch('/', {
		schema: { body: patchAssumptionsSchema },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { updates } = request.body as z.infer<typeof patchAssumptionsSchema>;
			const fieldErrors: Array<{ field: string; message: string }> = [];

			// Batch fetch all existing assumptions to avoid N+1
			const existingAssumptions = await prisma.assumption.findMany({
				where: { key: { in: updates.map((u) => u.key) } },
			});
			const existingMap = new Map(existingAssumptions.map((a) => [a.key, a]));

			for (const update of updates) {
				const existing = existingMap.get(update.key);
				if (!existing) continue;

				if (existing.version !== update.version) {
					return reply.status(409).send({
						code: 'OPTIMISTIC_LOCK',
						message: `Assumption "${update.key}" has been modified by another user`,
					});
				}

				const validationError = validateAssumptionValue(update.value, existing.valueType);
				if (validationError) {
					fieldErrors.push({ field: update.key, message: validationError });
				}
			}

			if (fieldErrors.length > 0) {
				return reply.status(422).send({
					code: 'VALIDATION_ERROR',
					message: 'One or more values failed validation',
					field_errors: fieldErrors,
				});
			}

			// Wrap all writes + final read in a single transaction
			const assumptions = await prisma.$transaction(async (tx) => {
				for (const update of updates) {
					const existing = existingMap.get(update.key);
					if (!existing) continue;

					await tx.assumption.update({
						where: { key: update.key },
						data: {
							value: update.value,
							updatedBy: request.user.id,
							version: { increment: 1 },
						},
					});

					await tx.auditEntry.create({
						data: {
							userId: request.user.id,
							operation: 'ASSUMPTION_UPDATED',
							tableName: 'assumptions',
							recordId: existing.id,
							ipAddress: request.ip,
							oldValues: {
								key: existing.key,
								value: existing.value,
							} as unknown as Prisma.InputJsonValue,
							newValues: {
								key: update.key,
								value: update.value,
							} as unknown as Prisma.InputJsonValue,
						},
					});
				}

				// Return refreshed list within the transaction
				return tx.assumption.findMany({
					orderBy: { section: 'asc' },
				});
			});

			return {
				assumptions,
				computed: {
					gosiRateTotal: computeGosiTotal(assumptions),
				},
			};
		},
	});
}
