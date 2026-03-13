import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { calculateAndPersistEnrollmentWorkspace } from '../../services/enrollment-workspace.js';
import { resolveEnrollmentPlanningRules } from '../../services/planning-rules.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

export async function calculateRoutes(app: FastifyInstance) {
	app.post('/enrollment', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: {
					id: true,
					fiscalYear: true,
					dataSource: true,
					status: true,
					staleModules: true,
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

			if (version.dataSource === 'IMPORTED') {
				return reply.status(409).send({
					code: 'IMPORTED_VERSION',
					message: 'Cannot calculate on imported versions',
				});
			}

			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: 'Version is locked',
				});
			}

			const result = await prisma.$transaction((tx) =>
				calculateAndPersistEnrollmentWorkspace({
					tx,
					versionId,
					version: {
						id: version.id,
						fiscalYear: version.fiscalYear,
						staleModules: version.staleModules,
						...resolveEnrollmentPlanningRules(version),
					},
					actor: {
						userId: request.user.id,
						userEmail: request.user.email,
						ipAddress: request.ip,
					},
				})
			);

			await prisma.budgetVersion.update({
				where: { id: versionId },
				data: { lastCalculatedAt: new Date() },
			});

			return result;
		},
	});
}
