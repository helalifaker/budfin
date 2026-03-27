import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { transformToAccountingPnl } from '../../services/pnl-accounting-service.js';
import type {
	TemplateSectionInput,
	MonthlyPnlLineInput,
	HistoricalActualInput,
} from '../../services/pnl-accounting-service.js';

// ── Schemas ─────────────────────────────────────────────────────────────────

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const accountingQuerySchema = z.object({
	compareYear: z.coerce.number().int().positive().optional(),
	view: z.enum(['annual']).default('annual'),
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
			const { compareYear } = request.query as z.infer<typeof accountingQuerySchema>;

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

			// 2. Load P&L lines for the version
			const pnlRows = await prisma.monthlyPnlLine.findMany({
				where: { versionId },
				orderBy: [{ displayOrder: 'asc' }, { month: 'asc' }],
			});

			// 3. If no P&L lines, return 409 PNL_NOT_CALCULATED
			if (pnlRows.length === 0) {
				return reply.status(409).send({
					code: 'PNL_NOT_CALCULATED',
					message: 'P&L has not been calculated for this version. Run POST /calculate/pnl first.',
				});
			}

			// 4. Load default PnlTemplate with sections and mappings
			const template = await prisma.pnlTemplate.findFirst({
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
			});

			if (!template) {
				return reply.status(404).send({
					code: 'TEMPLATE_NOT_FOUND',
					message: 'No default P&L template found. Seed the database first.',
				});
			}

			// 5. If compareYear provided, load HistoricalActual[] for that year
			let historicalActuals: HistoricalActualInput[] | undefined;
			if (compareYear) {
				const actuals = await prisma.historicalActual.findMany({
					where: { fiscalYear: compareYear },
				});
				historicalActuals = actuals.map((a) => ({
					accountCode: a.accountCode,
					annualAmount: a.annualAmount.toString(),
				}));
			}

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

			// 7. Call transformation service
			const result = transformToAccountingPnl(pnlLines, sections, historicalActuals);

			return result;
		},
	});
}
