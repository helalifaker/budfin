import type { FastifyInstance } from 'fastify';
import { employeeRoutes } from './employees.js';
import { dhgGrilleRoutes } from './dhg-grille.js';
import { staffingResultRoutes } from './results.js';

export async function staffingRoutes(app: FastifyInstance) {
	await app.register(employeeRoutes);
	await app.register(dhgGrilleRoutes);
	await app.register(staffingResultRoutes);
}

export { staffingCalculateRoutes } from './calculate.js';
