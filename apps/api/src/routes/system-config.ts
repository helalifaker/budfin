import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const updateBodySchema = z.object({
	updates: z.array(
		z.object({
			key: z.string(),
			value: z.string(),
		})
	),
});

export async function systemConfigRoutes(app: FastifyInstance) {
	// GET / — list all config
	app.get('/', {
		preHandler: [app.authenticate, app.requireRole('Admin')],
		handler: async () => {
			const configs = await prisma.systemConfig.findMany({
				orderBy: { key: 'asc' },
			});
			return {
				config: configs.map((c) => ({
					key: c.key,
					value: c.value,
					description: c.description,
					data_type: c.dataType,
				})),
			};
		},
	});

	// PUT / — bulk update config values
	app.put('/', {
		schema: { body: updateBodySchema },
		preHandler: [app.authenticate, app.requireRole('Admin')],
		handler: async (request) => {
			const { updates } = request.body as z.infer<typeof updateBodySchema>;
			let updated = 0;

			for (const { key, value } of updates) {
				const existing = await prisma.systemConfig.findUnique({
					where: { key },
				});
				if (!existing) continue;

				const oldValue = existing.value;
				await prisma.systemConfig.update({
					where: { key },
					data: {
						value,
						updatedBy: request.user.id,
					},
				});

				await prisma.auditEntry.create({
					data: {
						userId: request.user.id,
						operation: 'CONFIG_UPDATED',
						tableName: 'system_config',
						ipAddress: request.ip,
						oldValues: { key, value: oldValue },
						newValues: { key, value },
					},
				});

				updated++;
			}

			return { updated };
		},
	});
}
