import type { FastifyInstance } from 'fastify';
import { headcountRoutes } from './headcount.js';
import { detailRoutes } from './detail.js';
import { calculateRoutes } from './calculate.js';
import { historicalRoutes } from './historical.js';
import { cohortParameterRoutes } from './cohort-parameters.js';
import { planningRulesRoutes } from './planning-rules.js';
import { enrollmentSettingsRoutes } from './settings.js';
import { nationalityBreakdownRoutes } from './nationality-breakdown.js';
import { enrollmentSetupRoutes } from './setup.js';
import { enrollmentCapacityResultsRoutes } from './capacity-results.js';

export async function enrollmentRoutes(app: FastifyInstance) {
	await app.register(headcountRoutes);
	await app.register(detailRoutes);
	await app.register(cohortParameterRoutes);
	await app.register(planningRulesRoutes);
	await app.register(enrollmentSettingsRoutes);
	await app.register(nationalityBreakdownRoutes);
	await app.register(enrollmentSetupRoutes);
	await app.register(enrollmentCapacityResultsRoutes);
}

export { calculateRoutes };

export async function enrollmentHistoricalRoutes(app: FastifyInstance) {
	await app.register(historicalRoutes);
}
