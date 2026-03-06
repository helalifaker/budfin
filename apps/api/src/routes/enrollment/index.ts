import type { FastifyInstance } from 'fastify';
import { headcountRoutes } from './headcount.js';
import { detailRoutes } from './detail.js';
import { calculateRoutes } from './calculate.js';
import { historicalRoutes } from './historical.js';

export async function enrollmentRoutes(app: FastifyInstance) {
	await app.register(headcountRoutes);
	await app.register(detailRoutes);
	await app.register(calculateRoutes);
}

export async function enrollmentHistoricalRoutes(app: FastifyInstance) {
	await app.register(historicalRoutes);
}
