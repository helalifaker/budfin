import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../lib/prisma.js';

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

export async function dashboardRoutes(app: FastifyInstance) {
	app.get('/dashboard', {
		schema: {
			params: versionIdParams,
		},
		preHandler: [app.authenticate, app.requirePermission('data:view')],
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

			// Fetch MonthlyBudgetSummary (12 rows)
			const summaryRows = await prisma.monthlyBudgetSummary.findMany({
				where: { versionId },
				orderBy: { month: 'asc' },
			});

			// Fetch enrollment headcount for AY1
			const enrollmentAgg = await prisma.enrollmentHeadcount.aggregate({
				where: {
					versionId,
					academicPeriod: 'AY1',
				},
				_sum: {
					headcount: true,
				},
			});

			const enrollmentCount = enrollmentAgg._sum.headcount ?? 0;

			// Compute KPIs from summary rows
			let totalRevenue = new Decimal(0);
			let totalStaffCosts = new Decimal(0);
			let totalOpex = new Decimal(0);
			let totalEbitda = new Decimal(0);
			let totalNetProfit = new Decimal(0);
			let lastCalculatedAt: Date | null = null;

			for (const row of summaryRows) {
				totalRevenue = totalRevenue.plus(row.revenueHt.toString());
				totalStaffCosts = totalStaffCosts.plus(row.staffCosts.toString());
				totalOpex = totalOpex.plus(row.opexCosts.toString());
				totalEbitda = totalEbitda.plus(row.ebitda.toString());
				totalNetProfit = totalNetProfit.plus(row.netProfit.toString());
				if (!lastCalculatedAt || row.calculatedAt > lastCalculatedAt) {
					lastCalculatedAt = row.calculatedAt;
				}
			}

			const costPerStudent =
				enrollmentCount > 0
					? totalStaffCosts
							.dividedBy(enrollmentCount)
							.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
							.toFixed(4)
					: '0.0000';

			const ebitdaMarginPct = totalRevenue.isZero()
				? '0.00'
				: totalEbitda
						.dividedBy(totalRevenue)
						.times(100)
						.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
						.toFixed(2);

			// Build monthly trend array (12 items)
			const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
				const month = i + 1;
				const row = summaryRows.find((r) => r.month === month);
				return {
					month,
					revenue: row
						? new Decimal(row.revenueHt.toString())
								.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
								.toFixed(4)
						: '0.0000',
					staffCosts: row
						? new Decimal(row.staffCosts.toString())
								.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
								.toFixed(4)
						: '0.0000',
					opex: row
						? new Decimal(row.opexCosts.toString())
								.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
								.toFixed(4)
						: '0.0000',
					netProfit: row
						? new Decimal(row.netProfit.toString())
								.toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
								.toFixed(4)
						: '0.0000',
				};
			});

			return {
				kpis: {
					totalRevenue: totalRevenue.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					totalStaffCosts: totalStaffCosts.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					enrollmentCount,
					costPerStudent,
					ebitda: totalEbitda.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
					ebitdaMarginPct,
					netProfit: totalNetProfit.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				},
				monthlyTrend,
				staleModules: version.staleModules,
				lastCalculatedAt: lastCalculatedAt?.toISOString() ?? null,
			};
		},
	});
}
