import type { FastifyInstance } from 'fastify';
import { headcountRoutes } from './headcount.js';
import { detailRoutes } from './detail.js';
import { calculateRoutes } from './calculate.js';
import { historicalRoutes } from './historical.js';
import { cohortParameterRoutes } from './cohort-parameters.js';
import { nationalityBreakdownRoutes } from './nationality-breakdown.js';

export async function enrollmentRoutes(app: FastifyInstance) {
	await app.register(headcountRoutes);
	await app.register(detailRoutes);
	await app.register(cohortParameterRoutes);
	await app.register(nationalityBreakdownRoutes);
}

export { calculateRoutes };

export async function enrollmentHistoricalRoutes(app: FastifyInstance) {
	await app.register(historicalRoutes);
}
