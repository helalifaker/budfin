import type { FastifyInstance } from 'fastify';
import { pnlResultsRoutes } from './results.js';
import { pnlAccountingRoutes } from './accounting.js';

export async function pnlRoutes(fastify: FastifyInstance) {
	await fastify.register(pnlResultsRoutes);
	await fastify.register(pnlAccountingRoutes);
}
