import type { FastifyInstance } from 'fastify';
import { getPermissionsForRole } from '../lib/rbac.js';

export async function contextRoutes(app: FastifyInstance) {
	app.get('/context', {
		preHandler: [app.authenticate],
		handler: async (request) => ({
			user: {
				id: request.user.id,
				email: request.user.email,
				role: request.user.role,
			},
			permissions: getPermissionsForRole(request.user.role),
		}),
	});
}
