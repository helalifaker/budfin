import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';

// -- Schemas ----------------------------------------------------------------

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const pnlQuerySchema = z.object({
	format: z.enum(['summary', 'detailed', 'ifrs']).default('ifrs'),
	comparison_version_id: z.coerce.number().int().positive().optional(),
});

// -- Helpers ----------------------------------------------------------------

/** Maximum depth per format mode */
function maxDepthForFormat(format: 'summary' | 'detailed' | 'ifrs'): number {
	switch (format) {
		case 'summary':
			return 1;
		case 'detailed':
			return 2;
		case 'ifrs':
			return 3;
	}
}

interface PnlLineRow {
	sectionKey: string;
	categoryKey: string;
	lineItemKey: string;
	displayLabel: string;
	depth: number;
	displayOrder: number;
	isSubtotal: boolean;
	isSeparator: boolean;
	month: number;
	amount: Decimal | { toString(): string };
}

/**
 * Group flat MonthlyPnlLine rows into structured lines with monthlyAmounts[12].
 */
function groupIntoLines(rows: PnlLineRow[]) {
	const lineMap = new Map<
		string,
		{
			sectionKey: string;
			categoryKey: string;
			lineItemKey: string;
			displayLabel: string;
			depth: number;
			displayOrder: number;
			isSubtotal: boolean;
			isSeparator: boolean;
			monthlyAmounts: Decimal[];
		}
	>();

	for (const row of rows) {
		const key = `${row.sectionKey}|${row.categoryKey}|${row.lineItemKey}`;
		let line = lineMap.get(key);

		if (!line) {
			line = {
				sectionKey: row.sectionKey,
				categoryKey: row.categoryKey,
				lineItemKey: row.lineItemKey,
				displayLabel: row.displayLabel,
				depth: row.depth,
				displayOrder: row.displayOrder,
				isSubtotal: row.isSubtotal,
				isSeparator: row.isSeparator,
				monthlyAmounts: Array.from({ length: 12 }, () => new Decimal(0)),
			};
			lineMap.set(key, line);
		}

		const idx = row.month - 1;
		if (idx >= 0 && idx < 12) {
			line.monthlyAmounts[idx] = new Decimal(row.amount.toString());
		}
	}

	return [...lineMap.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

function sumMonthly(amounts: Decimal[]): Decimal {
	return amounts.reduce((sum, v) => sum.plus(v), new Decimal(0));
}

/**
 * Compute variance = primary - comparison for each month, plus annual.
 * Percent = variance / abs(comparison) * 100, or "0.00" when comparison is zero.
 */
function computeVariance(
	primaryAmounts: Decimal[],
	comparisonAmounts: Decimal[]
): {
	varianceMonthlyAmounts: string[];
	varianceMonthlyPercents: string[];
	varianceAnnualTotal: string;
	varianceAnnualPercent: string;
} {
	const varianceAmounts: Decimal[] = [];
	const variancePercents: string[] = [];

	for (let i = 0; i < 12; i++) {
		const primary = primaryAmounts[i] ?? new Decimal(0);
		const comparison = comparisonAmounts[i] ?? new Decimal(0);
		const variance = primary.minus(comparison);
		varianceAmounts.push(variance);

		const absComp = comparison.abs();
		if (absComp.isZero()) {
			variancePercents.push('0.00');
		} else {
			variancePercents.push(
				variance.dividedBy(absComp).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
			);
		}
	}

	const annualVariance = sumMonthly(varianceAmounts);
	const annualComparison = sumMonthly(comparisonAmounts).abs();
	const annualPercent = annualComparison.isZero()
		? '0.00'
		: annualVariance
				.dividedBy(annualComparison)
				.times(100)
				.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
				.toFixed(2);

	return {
		varianceMonthlyAmounts: varianceAmounts.map((v) =>
			v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)
		),
		varianceMonthlyPercents: variancePercents,
		varianceAnnualTotal: annualVariance.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
		varianceAnnualPercent: annualPercent,
	};
}

// -- Routes -----------------------------------------------------------------

export async function pnlResultsRoutes(app: FastifyInstance) {
	// GET /pnl — P&L results with format filtering and optional comparison
	app.get('/pnl', {
		schema: {
			params: versionIdParams,
			querystring: pnlQuerySchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParams>;
			const { format, comparison_version_id } = request.query as z.infer<typeof pnlQuerySchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// Check if P&L data exists
			const rowCount = await prisma.monthlyPnlLine.count({
				where: { versionId },
			});

			if (rowCount === 0) {
				return reply.status(404).send({
					code: 'PNL_NOT_CALCULATED',
					message: 'P&L has not been calculated for this version. Run POST /calculate/pnl first.',
				});
			}

			const maxDepth = maxDepthForFormat(format);

			// Load primary version P&L lines
			const primaryRows = await prisma.monthlyPnlLine.findMany({
				where: { versionId, depth: { lte: maxDepth } },
				orderBy: [{ displayOrder: 'asc' }, { month: 'asc' }],
			});

			const primaryLines = groupIntoLines(primaryRows);

			// Load KPIs from MonthlyBudgetSummary
			const summaryRows = await prisma.monthlyBudgetSummary.findMany({
				where: { versionId },
				orderBy: { month: 'asc' },
			});

			let totalRevenueHt = new Decimal(0);
			let totalEbitda = new Decimal(0);
			let totalNetProfit = new Decimal(0);
			let calculatedAt: Date | null = null;

			for (const row of summaryRows) {
				totalRevenueHt = totalRevenueHt.plus(row.revenueHt.toString());
				totalEbitda = totalEbitda.plus(row.ebitda.toString());
				totalNetProfit = totalNetProfit.plus(row.netProfit.toString());
				if (!calculatedAt || row.calculatedAt > calculatedAt) {
					calculatedAt = row.calculatedAt;
				}
			}

			const ebitdaMarginPct = totalRevenueHt.isZero()
				? '0.00'
				: totalEbitda
						.dividedBy(totalRevenueHt)
						.times(100)
						.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
						.toFixed(2);

			// Build comparison data if requested
			let comparisonLineMap: Map<
				string,
				{ monthlyAmounts: Decimal[]; annualTotal: string }
			> | null = null;

			if (comparison_version_id) {
				const comparisonRows = await prisma.monthlyPnlLine.findMany({
					where: {
						versionId: comparison_version_id,
						depth: { lte: maxDepth },
					},
					orderBy: [{ displayOrder: 'asc' }, { month: 'asc' }],
				});

				const comparisonLines = groupIntoLines(comparisonRows);
				comparisonLineMap = new Map();

				for (const line of comparisonLines) {
					const key = `${line.sectionKey}|${line.categoryKey}|${line.lineItemKey}`;
					comparisonLineMap.set(key, {
						monthlyAmounts: line.monthlyAmounts,
						annualTotal: sumMonthly(line.monthlyAmounts)
							.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
							.toFixed(4),
					});
				}
			}

			// Assemble response lines
			const lines = primaryLines.map((line) => {
				const annualTotal = sumMonthly(line.monthlyAmounts)
					.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
					.toFixed(4);

				const result: Record<string, unknown> = {
					sectionKey: line.sectionKey,
					categoryKey: line.categoryKey,
					lineItemKey: line.lineItemKey,
					displayLabel: line.displayLabel,
					depth: line.depth,
					displayOrder: line.displayOrder,
					isSubtotal: line.isSubtotal,
					isSeparator: line.isSeparator,
					monthlyAmounts: line.monthlyAmounts.map((v) =>
						v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)
					),
					annualTotal,
				};

				if (comparisonLineMap) {
					const key = `${line.sectionKey}|${line.categoryKey}|${line.lineItemKey}`;
					const comp = comparisonLineMap.get(key);
					const compAmounts =
						comp?.monthlyAmounts ?? Array.from({ length: 12 }, () => new Decimal(0));
					const compAnnual = comp?.annualTotal ?? '0.0000';

					result.comparisonMonthlyAmounts = compAmounts.map((v) =>
						v.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)
					);
					result.comparisonAnnualTotal = compAnnual;

					const variance = computeVariance(line.monthlyAmounts, compAmounts);
					result.varianceMonthlyAmounts = variance.varianceMonthlyAmounts;
					result.varianceMonthlyPercents = variance.varianceMonthlyPercents;
					result.varianceAnnualTotal = variance.varianceAnnualTotal;
					result.varianceAnnualPercent = variance.varianceAnnualPercent;
				}

				return result;
			});

			return {
				lines,
				kpis: {
					totalRevenueHt: totalRevenueHt.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					ebitda: totalEbitda.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					ebitdaMarginPct,
					netProfit: totalNetProfit.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				},
				format,
				calculatedAt: calculatedAt?.toISOString() ?? null,
			};
		},
	});

	// GET /pnl/kpis — KPI summary
	app.get('/pnl/kpis', {
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

			const summaryRows = await prisma.monthlyBudgetSummary.findMany({
				where: { versionId },
				orderBy: { month: 'asc' },
			});

			if (summaryRows.length === 0) {
				return reply.status(404).send({
					code: 'PNL_NOT_CALCULATED',
					message: 'P&L has not been calculated for this version. Run POST /calculate/pnl first.',
				});
			}

			let totalRevenueHt = new Decimal(0);
			let totalEbitda = new Decimal(0);
			let totalNetProfit = new Decimal(0);

			for (const row of summaryRows) {
				totalRevenueHt = totalRevenueHt.plus(row.revenueHt.toString());
				totalEbitda = totalEbitda.plus(row.ebitda.toString());
				totalNetProfit = totalNetProfit.plus(row.netProfit.toString());
			}

			const ebitdaMarginPct = totalRevenueHt.isZero()
				? '0.00'
				: totalEbitda
						.dividedBy(totalRevenueHt)
						.times(100)
						.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
						.toFixed(2);

			return {
				totalRevenueHt: totalRevenueHt.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				ebitda: totalEbitda.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				ebitdaMarginPct,
				netProfit: totalNetProfit.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
			};
		},
	});
}
