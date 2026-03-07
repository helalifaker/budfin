import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const getQuerySchema = z.object({
	academic_period: z.enum(['AY1', 'AY2', 'both']).optional().default('both'),
	group_by: z.enum(['month', 'grade', 'nationality', 'tariff']).optional().default('month'),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function revenueResultsRoutes(app: FastifyInstance) {
	// GET /revenue-results
	app.get('/revenue-results', {
		schema: {
			params: versionIdParamsSchema,
			querystring: getQuerySchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { academic_period, group_by } = request.query as z.infer<typeof getQuerySchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// Build where clause
			const where: { versionId: number; scenarioName: string; academicPeriod?: string } = {
				versionId,
				scenarioName: 'Base',
			};
			if (academic_period !== 'both') {
				where.academicPeriod = academic_period;
			}

			const rows = await prisma.monthlyRevenue.findMany({
				where,
				orderBy: [{ month: 'asc' }, { gradeLevel: 'asc' }],
			});

			// Return detailed rows
			const entries = rows.map((r) => ({
				academicPeriod: r.academicPeriod,
				gradeLevel: r.gradeLevel,
				nationality: r.nationality,
				tariff: r.tariff,
				month: r.month,
				grossRevenueHt: new Decimal(r.grossRevenueHt.toString()).toFixed(4),
				discountAmount: new Decimal(r.discountAmount.toString()).toFixed(4),
				scholarshipDeduction: new Decimal(r.scholarshipDeduction.toString()).toFixed(4),
				netRevenueHt: new Decimal(r.netRevenueHt.toString()).toFixed(4),
				vatAmount: new Decimal(r.vatAmount.toString()).toFixed(4),
			}));

			// Compute grouped summary based on group_by
			const groupMap = new Map<
				string,
				{
					key: string;
					grossRevenueHt: Decimal;
					discountAmount: Decimal;
					netRevenueHt: Decimal;
					vatAmount: Decimal;
				}
			>();

			for (const row of entries) {
				let groupKey: string;
				switch (group_by) {
					case 'month':
						groupKey = String(row.month);
						break;
					case 'grade':
						groupKey = row.gradeLevel;
						break;
					case 'nationality':
						groupKey = row.nationality;
						break;
					case 'tariff':
						groupKey = row.tariff;
						break;
				}

				const existing = groupMap.get(groupKey);
				if (existing) {
					existing.grossRevenueHt = existing.grossRevenueHt.plus(new Decimal(row.grossRevenueHt));
					existing.discountAmount = existing.discountAmount.plus(new Decimal(row.discountAmount));
					existing.netRevenueHt = existing.netRevenueHt.plus(new Decimal(row.netRevenueHt));
					existing.vatAmount = existing.vatAmount.plus(new Decimal(row.vatAmount));
				} else {
					groupMap.set(groupKey, {
						key: groupKey,
						grossRevenueHt: new Decimal(row.grossRevenueHt),
						discountAmount: new Decimal(row.discountAmount),
						netRevenueHt: new Decimal(row.netRevenueHt),
						vatAmount: new Decimal(row.vatAmount),
					});
				}
			}

			const summary = [...groupMap.values()].map((g) => ({
				[group_by]: g.key,
				grossRevenueHt: g.grossRevenueHt.toFixed(4),
				discountAmount: g.discountAmount.toFixed(4),
				netRevenueHt: g.netRevenueHt.toFixed(4),
				vatAmount: g.vatAmount.toFixed(4),
			}));

			// Grand totals
			let totalGross = new Decimal(0);
			let totalDiscount = new Decimal(0);
			let totalNet = new Decimal(0);
			let totalVat = new Decimal(0);

			for (const row of entries) {
				totalGross = totalGross.plus(new Decimal(row.grossRevenueHt));
				totalDiscount = totalDiscount.plus(new Decimal(row.discountAmount));
				totalNet = totalNet.plus(new Decimal(row.netRevenueHt));
				totalVat = totalVat.plus(new Decimal(row.vatAmount));
			}

			return {
				entries,
				summary,
				totals: {
					grossRevenueHt: totalGross.toFixed(4),
					discountAmount: totalDiscount.toFixed(4),
					netRevenueHt: totalNet.toFixed(4),
					vatAmount: totalVat.toFixed(4),
				},
				rowCount: entries.length,
			};
		},
	});
}
