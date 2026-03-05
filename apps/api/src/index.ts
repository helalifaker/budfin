import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
	serializerCompiler,
	validatorCompiler,
} from 'fastify-type-provider-zod';
import { logging } from './plugins/logging.js';
import { metrics } from './plugins/metrics.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';

export async function buildApp() {
	const app = Fastify({
		logger: false,
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	await app.register(logging);
	await app.register(metrics);
	await app.register(cors);
	await app.register(healthRoutes, { prefix: '/api/v1' });
	await app.register(metricsRoutes);

	return app;
}

async function startServer() {
	const app = await buildApp();
	const port = Number(process.env.PORT) || 3001;

	await app.listen({ port, host: '0.0.0.0' });
}

if (!process.env.VITEST) {
	startServer();
}
