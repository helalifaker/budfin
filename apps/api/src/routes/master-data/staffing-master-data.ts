import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

const disciplineListQuery = z.object({
	category: z.string().optional(),
});

const dhgRuleListQuery = z.object({
	year: z.coerce.number().int().positive().optional(),
});

// ── Routes ───────────────────────────────────────────────────────────────────

export async function staffingMasterDataRoutes(app: FastifyInstance) {
	// GET /service-profiles — List all ServiceObligationProfile ordered by sortOrder
	app.get('/service-profiles', {
		preHandler: [app.authenticate],
		handler: async () => {
			const profiles = await prisma.serviceObligationProfile.findMany({
				orderBy: { sortOrder: 'asc' },
			});

			return {
				profiles: profiles.map((p) => ({
					id: p.id,
					code: p.code,
					name: p.name,
					weeklyServiceHours: p.weeklyServiceHours.toString(),
					hsaEligible: p.hsaEligible,
					defaultCostMode: p.defaultCostMode,
					sortOrder: p.sortOrder,
				})),
			};
		},
	});

	// GET /disciplines — List all Discipline with aliases, optional ?category filter
	app.get('/disciplines', {
		schema: { querystring: disciplineListQuery },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { category } = request.query as z.infer<typeof disciplineListQuery>;

			const where = category ? { category } : {};

			const disciplines = await prisma.discipline.findMany({
				where,
				include: { aliases: true },
				orderBy: { sortOrder: 'asc' },
			});

			return {
				disciplines: disciplines.map((d) => ({
					id: d.id,
					code: d.code,
					name: d.name,
					category: d.category,
					sortOrder: d.sortOrder,
					aliases: d.aliases.map((a) => ({
						id: a.id,
						alias: a.alias,
					})),
				})),
			};
		},
	});

	// GET /dhg-rules — List DhgRule with discipline/profile joins, optional ?year filter
	app.get('/dhg-rules', {
		schema: { querystring: dhgRuleListQuery },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { year } = request.query as z.infer<typeof dhgRuleListQuery>;

			const where = year
				? {
						effectiveFromYear: { lte: year },
						OR: [{ effectiveToYear: null }, { effectiveToYear: { gte: year } }],
					}
				: {};

			const rules = await prisma.dhgRule.findMany({
				where,
				include: {
					discipline: true,
					serviceProfile: true,
				},
				orderBy: [{ gradeLevel: 'asc' }, { disciplineId: 'asc' }],
			});

			return {
				rules: rules.map((r) => ({
					id: r.id,
					gradeLevel: r.gradeLevel,
					disciplineId: r.disciplineId,
					disciplineCode: r.discipline.code,
					disciplineName: r.discipline.name,
					lineType: r.lineType,
					driverType: r.driverType,
					hoursPerUnit: r.hoursPerUnit.toString(),
					serviceProfileId: r.serviceProfileId,
					serviceProfileCode: r.serviceProfile.code,
					serviceProfileName: r.serviceProfile.name,
					languageCode: r.languageCode,
					groupingKey: r.groupingKey,
					effectiveFromYear: r.effectiveFromYear,
					effectiveToYear: r.effectiveToYear,
				})),
			};
		},
	});
}
