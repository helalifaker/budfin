import type { FastifyInstance } from 'fastify';
import { accountRoutes } from './accounts.js';
import { academicYearRoutes } from './academic-years.js';
import { gradeLevelRoutes } from './grade-levels.js';
import { nationalityRoutes } from './nationalities.js';
import { tariffRoutes } from './tariffs.js';
import { departmentRoutes } from './departments.js';
import { assumptionRoutes } from './assumptions.js';
import { staffingMasterDataRoutes } from './staffing-master-data.js';
import { pnlTemplateRoutes } from './pnl-templates.js';

export async function masterDataRoutes(app: FastifyInstance) {
	await app.register(accountRoutes, { prefix: '/accounts' });
	await app.register(academicYearRoutes, { prefix: '/academic-years' });
	await app.register(gradeLevelRoutes, { prefix: '/grade-levels' });
	await app.register(nationalityRoutes, { prefix: '/nationalities' });
	await app.register(tariffRoutes, { prefix: '/tariffs' });
	await app.register(departmentRoutes, { prefix: '/departments' });
	await app.register(assumptionRoutes, { prefix: '/assumptions' });
	await app.register(staffingMasterDataRoutes);
	await app.register(pnlTemplateRoutes, { prefix: '/pnl-templates' });
}
