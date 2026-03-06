import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createLogger } from '../lib/logger.js';

declare module 'fastify' {
	interface FastifyRequest {
		logContext?: { requestId: string; userId: number | null };
	}
}

async function loggingPlugin(app: FastifyInstance) {
	const log = createLogger('HTTP');

	app.addHook('onRequest', async (request) => {
		request.logContext = {
			requestId: request.id,
			userId: request.user?.id ?? null,
		};
		log.info({
			...request.logContext,
			message: `${request.method} ${request.url}`,
		});
	});

	app.addHook('onResponse', async (request, reply) => {
		log.info({
			...request.logContext,
			message: `${request.method} ${request.url} ${reply.statusCode}`,
		});
	});
}

export const logging = fp(loggingPlugin, { name: 'logging' });
