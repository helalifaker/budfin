import type { FastifyInstance } from 'fastify';
import { scenarioParameterRoutes } from './parameters.js';

export async function scenarioRoutes(fastify: FastifyInstance) {
	await fastify.register(scenarioParameterRoutes);
}
