import type { FastifyInstance } from 'fastify';
import { getPermissionsForRole } from '../lib/rbac.js';
import { prisma } from '../lib/prisma.js';

export async function contextRoutes(app: FastifyInstance) {
	app.get('/context', {
		preHandler: [app.authenticate],
		handler: async (request) => {
			const schoolYearConfig = await prisma.systemConfig.findUnique({
				where: { key: 'schoolYear' },
			});

			return {
				user: {
					id: request.user.id,
					email: request.user.email,
					role: request.user.role,
				},
				schoolYear: schoolYearConfig?.value ?? null,
				permissions: getPermissionsForRole(request.user.role),
			};
		},
	});
}
