import type { FastifyInstance } from 'fastify';
import { employeeRoutes } from './employees.js';
import { employeeImportRoutes } from './import.js';
import { dhgGrilleRoutes } from './dhg-grille.js';
import { staffingResultRoutes } from './results.js';
import { staffingSettingsRoutes } from './settings.js';

export async function staffingRoutes(app: FastifyInstance) {
	await app.register(employeeRoutes);
	await app.register(employeeImportRoutes);
	await app.register(dhgGrilleRoutes);
	await app.register(staffingResultRoutes);
	await app.register(staffingSettingsRoutes);
}

export { staffingCalculateRoutes } from './calculate.js';
