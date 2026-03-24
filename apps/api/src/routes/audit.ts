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

const calculationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	page_size: z.coerce.number().int().min(1).max(100).default(20),
	version_id: z.coerce.number().int().optional(),
	module: z.string().optional(),
	from: z.string().datetime().optional(),
	to: z.string().datetime().optional(),
});

export async function auditRoutes(app: FastifyInstance) {
	// GET / — general audit log
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

	// GET /calculation — calculation history
	app.get('/calculation', {
		schema: { querystring: calculationQuerySchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request) => {
			const query = request.query as z.infer<typeof calculationQuerySchema>;

			const where: Record<string, unknown> = {};
			if (query.version_id) where.versionId = query.version_id;
			if (query.module) where.module = query.module;
			if (query.from || query.to) {
				const startedAt: Record<string, Date> = {};
				if (query.from) startedAt.gte = new Date(query.from);
				if (query.to) startedAt.lte = new Date(query.to);
				where.startedAt = startedAt;
			}

			const [entries, total] = await Promise.all([
				prisma.calculationAuditLog.findMany({
					where,
					orderBy: { startedAt: 'desc' },
					skip: (query.page - 1) * query.page_size,
					take: query.page_size,
					include: {
						version: { select: { name: true, fiscalYear: true } },
						triggerer: { select: { email: true } },
					},
				}),
				prisma.calculationAuditLog.count({ where }),
			]);

			return {
				entries: entries.map((e) => ({
					id: e.id,
					run_id: e.runId,
					version_id: e.versionId,
					version_name: e.version?.name ?? null,
					fiscal_year: e.version?.fiscalYear ?? null,
					module: e.module,
					status: e.status,
					started_at: e.startedAt.toISOString(),
					completed_at: e.completedAt?.toISOString() ?? null,
					duration_ms: e.durationMs,
					triggered_by: e.triggerer?.email ?? null,
					input_summary: e.inputSummary,
					output_summary: e.outputSummary,
				})),
				total,
				page: query.page,
				page_size: query.page_size,
			};
		},
	});
}
