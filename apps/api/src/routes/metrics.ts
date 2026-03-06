import type { FastifyInstance } from 'fastify';
import client from 'prom-client';

export async function metricsRoutes(app: FastifyInstance) {
	app.get('/metrics', async (_request, reply) => {
		const metricsOutput = await client.register.metrics();
		return reply.header('Content-Type', client.register.contentType).send(metricsOutput);
	});
}
