import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

export async function enrollmentCapacityResultsRoutes(app: FastifyInstance) {
	app.get('/capacity-results', {
		schema: {
			params: versionIdParamsSchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const results = await prisma.dhgRequirement.findMany({
				where: { versionId },
				select: {
					gradeLevel: true,
					academicPeriod: true,
					headcount: true,
					maxClassSize: true,
					sectionsNeeded: true,
					utilization: true,
					alert: true,
					recruitmentSlots: true,
				},
				orderBy: [{ academicPeriod: 'asc' }, { gradeLevel: 'asc' }],
			});

			const normalizedResults = results.map((result) => ({
				gradeLevel: result.gradeLevel,
				academicPeriod: result.academicPeriod,
				headcount: result.headcount,
				maxClassSize: result.maxClassSize,
				sectionsNeeded: result.sectionsNeeded,
				utilization: Number(result.utilization),
				alert: result.alert,
				recruitmentSlots: result.recruitmentSlots,
			}));

			return {
				summary: {
					totalStudentsAy1: normalizedResults
						.filter((result) => result.academicPeriod === 'AY1')
						.reduce((sum, result) => sum + result.headcount, 0),
					totalStudentsAy2: normalizedResults
						.filter((result) => result.academicPeriod === 'AY2')
						.reduce((sum, result) => sum + result.headcount, 0),
					overCapacityGrades: [
						...new Set(
							normalizedResults
								.filter((result) => result.alert === 'OVER')
								.map((result) => result.gradeLevel)
						),
					],
				},
				results: normalizedResults,
			};
		},
	});
}
