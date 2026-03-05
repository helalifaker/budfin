import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
	serializerCompiler,
	validatorCompiler,
} from 'fastify-type-provider-zod';
import { healthRoutes } from './routes/health.js';

export async function buildApp() {
	const app = Fastify({
		logger: true,
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	await app.register(cors);
	await app.register(healthRoutes, { prefix: '/api/v1' });

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
