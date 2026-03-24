import type { FastifyInstance } from 'fastify';
import { pnlResultsRoutes } from './results.js';

export async function pnlRoutes(fastify: FastifyInstance) {
	await fastify.register(pnlResultsRoutes);
}
