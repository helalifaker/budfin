import type { FastifyInstance } from 'fastify';
import { opExLineItemRoutes } from './line-items.js';

export async function opExRoutes(app: FastifyInstance) {
	await app.register(opExLineItemRoutes);
}

export { opExCalculateRoutes } from './calculate.js';
