import type { FastifyInstance } from 'fastify';
import { employeeRoutes } from './employees.js';
import { employeeImportRoutes } from './import.js';
import { staffingResultRoutes } from './results.js';
import { staffingSettingsRoutes } from './settings.js';
import { staffingAssignmentRoutes } from './assignments.js';

export async function staffingRoutes(app: FastifyInstance) {
	await app.register(employeeRoutes);
	await app.register(employeeImportRoutes);
	await app.register(staffingResultRoutes);
	await app.register(staffingSettingsRoutes);
	await app.register(staffingAssignmentRoutes);
}

export { staffingCalculateRoutes } from './calculate.js';
