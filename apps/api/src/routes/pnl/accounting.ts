import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { transformToAccountingPnl } from '../../services/pnl-accounting-service.js';
import type {
	TemplateSectionInput,
	MonthlyPnlLineInput,
	HistoricalActualInput,
	ProfitCenterFilter,
} from '../../services/pnl-accounting-service.js';

// ── Schemas ─────────────────────────────────────────────────────────────────

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const accountingQuerySchema = z.object({
	compareYear: z.coerce.number().int().positive().optional(),
	profitCenter: z.enum(['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE']).optional(),
});

// ── Route ───────────────────────────────────────────────────────────────────

export async function pnlAccountingRoutes(app: FastifyInstance) {
	// GET /pnl/accounting — IFRS-structured accounting P&L
	app.get('/pnl/accounting', {
		schema: {
			params: versionIdParams,
			querystring: accountingQuerySchema,
		},
		preHandler: [app.authenticate, app.requirePermission('data:view')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { compareYear, profitCenter } = request.query as z.infer<typeof accountingQuerySchema>;

			// 1. Validate version exists
			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// 2. Load P&L lines, template, and historical actuals in parallel
			const [pnlRows, template, rawActuals] = await Promise.all([
				prisma.monthlyPnlLine.findMany({
					where: { versionId },
					orderBy: [{ displayOrder: 'asc' }, { month: 'asc' }],
				}),
				prisma.pnlTemplate.findFirst({
					where: { isDefault: true },
					include: {
						sections: {
							orderBy: { displayOrder: 'asc' },
							include: {
								mappings: {
									orderBy: { displayOrder: 'asc' },
								},
							},
						},
					},
				}),
				compareYear
					? prisma.historicalActual.findMany({ where: { fiscalYear: compareYear } })
					: Promise.resolve([]),
			]);

			// 3. If no P&L lines, return 409 PNL_NOT_CALCULATED
			if (pnlRows.length === 0) {
				return reply.status(409).send({
					code: 'PNL_NOT_CALCULATED',
					message: 'P&L has not been calculated for this version. Run POST /calculate/pnl first.',
				});
			}

			if (!template) {
				return reply.status(404).send({
					code: 'TEMPLATE_NOT_FOUND',
					message: 'No default P&L template found. Seed the database first.',
				});
			}

			const historicalActuals: HistoricalActualInput[] | undefined =
				rawActuals.length > 0
					? rawActuals.map((a) => ({
							accountCode: a.accountCode,
							annualAmount: a.annualAmount.toString(),
						}))
					: undefined;

			// 6. Map DB rows to service input types
			const pnlLines: MonthlyPnlLineInput[] = pnlRows.map((row) => ({
				month: row.month,
				sectionKey: row.sectionKey,
				categoryKey: row.categoryKey,
				lineItemKey: row.lineItemKey,
				displayLabel: row.displayLabel,
				depth: row.depth,
				amount: row.amount.toString(),
				isSubtotal: row.isSubtotal,
				isSeparator: row.isSeparator,
			}));

			const sections: TemplateSectionInput[] = template.sections.map((s) => ({
				sectionKey: s.sectionKey,
				displayLabel: s.displayLabel,
				displayOrder: s.displayOrder,
				isSubtotal: s.isSubtotal,
				subtotalFormula: s.subtotalFormula,
				signConvention: s.signConvention,
				mappings: s.mappings.map((m) => ({
					analyticalKey: m.analyticalKey,
					analyticalKeyType: m.analyticalKeyType,
					accountCode: m.accountCode,
					monthFilter: m.monthFilter,
					displayLabel: m.displayLabel,
					visibility: m.visibility,
					displayOrder: m.displayOrder,
				})),
			}));

			// 7. Build profit center filter if requested
			let pcFilter: ProfitCenterFilter | undefined;
			if (profitCenter) {
				// Load enrollment headcounts for AY1, grouped by grade level
				const enrollmentRows = await prisma.enrollmentHeadcount.findMany({
					where: { versionId, academicPeriod: 'AY1' },
					select: { gradeLevel: true, headcount: true },
				});

				// Resolve grade band for each grade code via GradeLevel
				const gradeCodes = [...new Set(enrollmentRows.map((r) => r.gradeLevel))];
				const gradeLevels = await prisma.gradeLevel.findMany({
					where: { gradeCode: { in: gradeCodes } },
					select: { gradeCode: true, band: true },
				});
				const bandByCode = new Map(gradeLevels.map((gl) => [gl.gradeCode, gl.band]));

				let bandHeadcount = 0;
				let totalHeadcount = 0;
				for (const row of enrollmentRows) {
					totalHeadcount += row.headcount;
					const band = bandByCode.get(row.gradeLevel);
					if (band === profitCenter) {
						bandHeadcount += row.headcount;
					}
				}

				if (totalHeadcount > 0) {
					pcFilter = { band: profitCenter, bandHeadcount, totalHeadcount };
				}
			}

			// 8. Call transformation service
			const result = transformToAccountingPnl(pnlLines, sections, historicalActuals, pcFilter);

			return result;
		},
	});
}
