import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
	app.get('/health', async (_request, _reply) => {
		return { status: 'healthy', version: '0.0.1' };
	});
}
