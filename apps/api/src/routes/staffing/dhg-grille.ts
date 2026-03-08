import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

export async function dhgGrilleRoutes(app: FastifyInstance) {
	// GET /dhg-grilles — return DHG grille configuration
	app.get('/dhg-grilles', {
		schema: {
			params: versionIdParams,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});
			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// Get grille config for the fiscal year
			const grilles = await prisma.dhgGrilleConfig.findMany({
				where: {
					effectiveFromYear: { lte: version.fiscalYear },
				},
				orderBy: [{ gradeLevel: 'asc' }, { subject: 'asc' }],
			});

			// Also get computed DHG requirements if available
			const requirements = await prisma.dhgRequirement.findMany({
				where: { versionId },
				orderBy: { gradeLevel: 'asc' },
			});

			return {
				grilles: grilles.map((g) => ({
					id: g.id,
					grade_level: g.gradeLevel,
					subject: g.subject,
					dhg_type: g.dhgType,
					hours_per_week_per_section: g.hoursPerWeekPerSection.toString(),
					effective_from_year: g.effectiveFromYear,
				})),
				requirements: requirements.map((r) => ({
					grade_level: r.gradeLevel,
					academic_period: r.academicPeriod,
					headcount: r.headcount,
					max_class_size: r.maxClassSize,
					sections_needed: r.sectionsNeeded,
					total_weekly_hours: r.totalWeeklyHours.toString(),
					total_annual_hours: r.totalAnnualHours.toString(),
					fte: r.fte.toString(),
					utilization: r.utilization.toString(),
				})),
			};
		},
	});
}
