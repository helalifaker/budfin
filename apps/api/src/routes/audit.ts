import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const querySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	page_size: z.coerce.number().int().min(1).max(200).default(50),
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
	user_id: z.coerce.number().int().optional(),
	operation: z.string().optional(),
	table_name: z.string().optional(),
});

function formatEntry(entry: {
	id: number;
	userId: number | null;
	operation: string;
	tableName: string | null;
	recordId: number | null;
	oldValues: unknown;
	newValues: unknown;
	ipAddress: string | null;
	createdAt: Date;
}) {
	return {
		id: entry.id,
		user_id: entry.userId,
		operation: entry.operation,
		table_name: entry.tableName,
		record_id: entry.recordId,
		old_values: entry.oldValues,
		new_values: entry.newValues,
		ip_address: entry.ipAddress,
		created_at: entry.createdAt.toISOString(),
	};
}

export async function auditRoutes(app: FastifyInstance) {
	app.get('/', {
		schema: { querystring: querySchema },
		preHandler: [app.authenticate, app.requireRole('Admin')],
		handler: async (request) => {
			const query = request.query as z.infer<typeof querySchema>;
			const { page, page_size } = query;

			const where: Record<string, unknown> = {};

			if (query.from || query.to) {
				const createdAt: Record<string, Date> = {};
				if (query.from) createdAt.gte = new Date(query.from);
				if (query.to) createdAt.lte = new Date(query.to);
				where.createdAt = createdAt;
			}
			if (query.user_id !== undefined) {
				where.userId = query.user_id;
			}
			if (query.operation) {
				where.operation = query.operation;
			}
			if (query.table_name) {
				where.tableName = query.table_name;
			}

			const [entries, total] = await Promise.all([
				prisma.auditEntry.findMany({
					where,
					orderBy: { createdAt: 'desc' },
					skip: (page - 1) * page_size,
					take: page_size,
				}),
				prisma.auditEntry.count({ where }),
			]);

			return {
				entries: entries.map(formatEntry),
				total,
				page,
				page_size,
			};
		},
	});
}
