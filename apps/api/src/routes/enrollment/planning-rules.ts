import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
	buildEnrollmentPlanningRulesUpdateData,
	ENROLLMENT_RULES_STALE_MODULES,
	resolveEnrollmentPlanningRules,
} from '../../services/planning-rules.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const planningRulesSchema = z.object({
	rolloverThreshold: z.number().min(0.5).max(2),
	retentionRecentWeight: z.number().min(0).max(1),
	historicalTargetRecentWeight: z.number().min(0).max(1),
	cappedRetention: z.number().min(0.5).max(1).optional(),
});

export async function planningRulesRoutes(app: FastifyInstance) {
	app.get('/planning-rules', {
		schema: {
			params: versionIdParamsSchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: {
					id: true,
					rolloverThreshold: true,
					cappedRetention: true,
					retentionRecentWeight: true,
					historicalTargetRecentWeight: true,
				},
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			return resolveEnrollmentPlanningRules(version);
		},
	});

	app.put('/planning-rules', {
		schema: {
			params: versionIdParamsSchema,
			body: planningRulesSchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const planningRules = request.body as z.infer<typeof planningRulesSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, status: true, dataSource: true, staleModules: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: `Version is ${version.status} and cannot be modified`,
				});
			}

			if (version.dataSource === 'IMPORTED') {
				return reply.status(409).send({
					code: 'IMPORTED_VERSION',
					message: 'Cannot modify planning rules on imported versions',
				});
			}

			const currentStale = new Set(version.staleModules);
			for (const staleModule of ENROLLMENT_RULES_STALE_MODULES) {
				currentStale.add(staleModule);
			}
			const staleModules = [...currentStale];

			const updated = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				const result = await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: {
						...buildEnrollmentPlanningRulesUpdateData(planningRules),
						staleModules,
					},
					select: {
						rolloverThreshold: true,
						cappedRetention: true,
						retentionRecentWeight: true,
						historicalTargetRecentWeight: true,
					},
				});

				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'ENROLLMENT_PLANNING_RULES_UPDATED',
						tableName: 'budget_versions',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: planningRules as unknown as Prisma.InputJsonValue,
					},
				});

				return result;
			});

			return {
				...resolveEnrollmentPlanningRules(updated),
				staleModules,
			};
		},
	});
}
