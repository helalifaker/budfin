import type { FastifyInstance } from 'fastify';
import { feeGridRoutes } from './fee-grid.js';
import { discountRoutes } from './discounts.js';
import { otherRevenueRoutes } from './other-revenue.js';
import { revenueResultsRoutes } from './results.js';

export async function revenueRoutes(app: FastifyInstance) {
	await app.register(feeGridRoutes);
	await app.register(discountRoutes);
	await app.register(otherRevenueRoutes);
	await app.register(revenueResultsRoutes);
}

export { revenueCalculateRoutes } from './calculate.js';
