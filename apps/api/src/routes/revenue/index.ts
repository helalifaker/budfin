import type { FastifyInstance } from 'fastify';
import { feeGridRoutes } from './fee-grid.js';
import { otherRevenueRoutes } from './other-revenue.js';
import { revenueReadinessRoutes } from './readiness.js';
import { revenueResultsRoutes } from './results.js';
import { revenueSettingsRoutes } from './settings.js';

export async function revenueRoutes(app: FastifyInstance) {
	await app.register(revenueSettingsRoutes);
	await app.register(feeGridRoutes);
	await app.register(otherRevenueRoutes);
	await app.register(revenueReadinessRoutes);
	await app.register(revenueResultsRoutes);
}

export { revenueCalculateRoutes } from './calculate.js';
