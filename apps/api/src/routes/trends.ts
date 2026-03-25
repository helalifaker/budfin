import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../lib/prisma.js';

// ── Request Schema ──────────────────────────────────────────────────────────

const trendsQuerySchema = z.object({
	metrics: z.string().optional().default('revenue,staffCost,opex,netProfit,enrollment,fte'),
	years: z.coerce.number().int().min(1).max(20).optional().default(5),
});

// ── Response Schema ─────────────────────────────────────────────────────────

const yearMetricsSchema = z.object({
	totalRevenue: z.string(),
	totalStaffCost: z.string(),
	totalOpEx: z.string(),
	netProfit: z.string(),
	totalEnrollment: z.number(),
	totalFte: z.string(),
});

const yearEntrySchema = z.object({
	fiscalYear: z.string(),
	versionName: z.string(),
	versionId: z.number(),
	metrics: yearMetricsSchema,
});

const growthSchema = z.record(z.string(), z.array(z.string().nullable()));

const trendsResponseSchema = z.object({
	years: z.array(yearEntrySchema),
	growth: growthSchema,
});

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a fiscal year integer (e.g. 2024) into "2024-2025" display format.
 * BudFin fiscal years span two calendar years (Sep-Aug).
 */
function formatFiscalYear(fy: number): string {
	return `${fy}-${fy + 1}`;
}

/**
 * Compute year-over-year growth rate as a decimal string (e.g. "0.08" for 8%).
 * Returns null for the first year or when the previous value is zero.
 */
function yoyGrowth(current: Decimal, previous: Decimal | null): string | null {
	if (!previous || previous.isZero()) return null;
	return current.minus(previous).div(previous).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
}

// ── Route ───────────────────────────────────────────────────────────────────

export async function trendsRoutes(app: FastifyInstance) {
	app.get('/trends', {
		schema: {
			querystring: trendsQuerySchema,
			response: {
				200: trendsResponseSchema,
			},
		},
		preHandler: [app.authenticate, app.requirePermission('data:view')],
		handler: async (request) => {
			const { years } = request.query as z.infer<typeof trendsQuerySchema>;

			// Step 1: Find all fiscal years with at least one Locked or Archived version
			const candidateVersions = await prisma.budgetVersion.findMany({
				where: {
					status: { in: ['Locked', 'Archived'] },
				},
				orderBy: [{ fiscalYear: 'desc' }, { updatedAt: 'desc' }],
				select: {
					id: true,
					fiscalYear: true,
					name: true,
					status: true,
					updatedAt: true,
				},
			});

			// Step 2: Pick canonical version per fiscal year
			// Prefer Locked over Archived, newest updatedAt if multiple
			const canonicalMap = new Map<
				number,
				{
					id: number;
					fiscalYear: number;
					name: string;
					status: string;
					updatedAt: Date;
				}
			>();

			for (const v of candidateVersions) {
				const existing = canonicalMap.get(v.fiscalYear);
				if (!existing) {
					canonicalMap.set(v.fiscalYear, v);
					continue;
				}
				// Prefer Locked over Archived
				if (v.status === 'Locked' && existing.status === 'Archived') {
					canonicalMap.set(v.fiscalYear, v);
					continue;
				}
				// If same status, prefer newer updatedAt
				if (v.status === existing.status && v.updatedAt > existing.updatedAt) {
					canonicalMap.set(v.fiscalYear, v);
				}
			}

			// Sort by fiscal year ascending and limit to requested years
			const canonicalVersions = [...canonicalMap.values()]
				.sort((a, b) => a.fiscalYear - b.fiscalYear)
				.slice(-years);

			if (canonicalVersions.length === 0) {
				return { years: [], growth: {} };
			}

			const versionIds = canonicalVersions.map((v) => v.id);

			// Step 3: Query MonthlyBudgetSummary for all canonical versions
			const summaryRows = await prisma.monthlyBudgetSummary.findMany({
				where: { versionId: { in: versionIds } },
			});

			// Step 4: Query enrollment headcounts (AY1 totals)
			const enrollmentAgg = await prisma.enrollmentHeadcount.groupBy({
				by: ['versionId'],
				where: {
					versionId: { in: versionIds },
					academicPeriod: 'AY1',
				},
				_sum: { headcount: true },
			});
			const enrollmentByVersion = new Map(
				enrollmentAgg.map((e) => [e.versionId, e._sum.headcount ?? 0])
			);

			// Step 5: Query employee counts for FTE (sum of hourlyPercentage)
			const employeeAgg = await prisma.employee.groupBy({
				by: ['versionId'],
				where: {
					versionId: { in: versionIds },
					status: { not: 'Terminated' },
				},
				_sum: { hourlyPercentage: true },
				_count: { id: true },
			});
			const fteByVersion = new Map(
				employeeAgg.map((e) => [
					e.versionId,
					e._sum.hourlyPercentage
						? new Decimal(e._sum.hourlyPercentage.toString())
						: new Decimal(0),
				])
			);

			// Step 6: Aggregate summaries per version
			const summaryByVersion = new Map<
				number,
				{
					totalRevenue: Decimal;
					totalStaffCost: Decimal;
					totalOpEx: Decimal;
					netProfit: Decimal;
				}
			>();

			for (const row of summaryRows) {
				let agg = summaryByVersion.get(row.versionId);
				if (!agg) {
					agg = {
						totalRevenue: new Decimal(0),
						totalStaffCost: new Decimal(0),
						totalOpEx: new Decimal(0),
						netProfit: new Decimal(0),
					};
					summaryByVersion.set(row.versionId, agg);
				}
				agg.totalRevenue = agg.totalRevenue.plus(row.revenueHt.toString());
				agg.totalStaffCost = agg.totalStaffCost.plus(row.staffCosts.toString());
				agg.totalOpEx = agg.totalOpEx.plus(row.opexCosts.toString());
				agg.netProfit = agg.netProfit.plus(row.netProfit.toString());
			}

			// Step 7: Build response
			const yearEntries = canonicalVersions.map((v) => {
				const agg = summaryByVersion.get(v.id) ?? {
					totalRevenue: new Decimal(0),
					totalStaffCost: new Decimal(0),
					totalOpEx: new Decimal(0),
					netProfit: new Decimal(0),
				};
				const enrollment = enrollmentByVersion.get(v.id) ?? 0;
				const fte = fteByVersion.get(v.id) ?? new Decimal(0);

				return {
					fiscalYear: formatFiscalYear(v.fiscalYear),
					versionName: v.name,
					versionId: v.id,
					metrics: {
						totalRevenue: agg.totalRevenue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
						totalStaffCost: agg.totalStaffCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
						totalOpEx: agg.totalOpEx.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
						netProfit: agg.netProfit.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
						totalEnrollment: enrollment,
						totalFte: fte.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1),
					},
				};
			});

			// Step 8: Calculate year-over-year growth rates
			const revenueValues = yearEntries.map((y) => new Decimal(y.metrics.totalRevenue));
			const staffCostValues = yearEntries.map((y) => new Decimal(y.metrics.totalStaffCost));
			const opexValues = yearEntries.map((y) => new Decimal(y.metrics.totalOpEx));
			const netProfitValues = yearEntries.map((y) => new Decimal(y.metrics.netProfit));
			const enrollmentValues = yearEntries.map((y) => new Decimal(y.metrics.totalEnrollment));
			const fteValues = yearEntries.map((y) => new Decimal(y.metrics.totalFte));

			function buildGrowthArray(values: Decimal[]): (string | null)[] {
				return values.map((val, i) => (i === 0 ? null : yoyGrowth(val, values[i - 1]!)));
			}

			const growth: Record<string, (string | null)[]> = {
				revenue: buildGrowthArray(revenueValues),
				staffCost: buildGrowthArray(staffCostValues),
				opex: buildGrowthArray(opexValues),
				netProfit: buildGrowthArray(netProfitValues),
				enrollment: buildGrowthArray(enrollmentValues),
				fte: buildGrowthArray(fteValues),
			};

			return { years: yearEntries, growth };
		},
	});
}
