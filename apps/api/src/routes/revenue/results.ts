import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';
import { buildRevenueReportingView } from '../../services/revenue-reporting.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const getQuerySchema = z.object({
	academic_period: z.enum(['AY1', 'AY2', 'both']).optional().default('both'),
	group_by: z.enum(['month', 'grade', 'nationality', 'tariff']).optional().default('month'),
});

type GroupBy = z.infer<typeof getQuerySchema>['group_by'];

// ── Routes ────────────────────────────────────────────────────────────────────

export async function revenueResultsRoutes(app: FastifyInstance) {
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

			const tuitionWhere: {
				versionId: number;
				scenarioName: string;
				academicPeriod?: string;
			} = {
				versionId,
				scenarioName: 'Base',
			};

			if (academic_period !== 'both') {
				tuitionWhere.academicPeriod = academic_period;
			}

			const [tuitionRows, otherRevenueRows] = await Promise.all([
				prisma.monthlyRevenue.findMany({
					where: tuitionWhere,
					orderBy: [
						{ month: 'asc' },
						{ gradeLevel: 'asc' },
						{ nationality: 'asc' },
						{ tariff: 'asc' },
					],
				}),
				prisma.monthlyOtherRevenue.findMany({
					where: { versionId, scenarioName: 'Base' },
					orderBy: [{ month: 'asc' }, { lineItemName: 'asc' }],
				}),
			]);

			const entries = tuitionRows.map((row) => ({
				academicPeriod: row.academicPeriod,
				gradeLevel: row.gradeLevel,
				nationality: row.nationality,
				tariff: row.tariff,
				month: row.month,
				grossRevenueHt: new Decimal(row.grossRevenueHt.toString()).toFixed(4),
				discountAmount: new Decimal(row.discountAmount.toString()).toFixed(4),
				scholarshipDeduction: new Decimal(row.scholarshipDeduction.toString()).toFixed(4),
				netRevenueHt: new Decimal(row.netRevenueHt.toString()).toFixed(4),
				vatAmount: new Decimal(row.vatAmount.toString()).toFixed(4),
			}));

			const otherRevenueEntries = otherRevenueRows.map((row) => ({
				lineItemName: row.lineItemName,
				ifrsCategory: row.ifrsCategory,
				executiveCategory: row.executiveCategory,
				includeInExecutiveSummary: row.executiveCategory !== null,
				month: row.month,
				amount: new Decimal(row.amount.toString()).toFixed(4),
			}));

			const summary = buildGroupedSummary(entries, group_by);
			const reporting = buildRevenueReportingView(
				entries.map((entry) => ({
					academicPeriod: entry.academicPeriod as 'AY1' | 'AY2',
					gradeLevel: entry.gradeLevel,
					month: entry.month,
					grossRevenueHt: entry.grossRevenueHt,
					discountAmount: entry.discountAmount,
					netRevenueHt: entry.netRevenueHt,
					vatAmount: entry.vatAmount,
				})),
				otherRevenueEntries
			);
			const totals = buildTotals(entries, reporting);

			return {
				entries,
				otherRevenueEntries,
				summary,
				totals,
				rowCount: entries.length,
				revenueEngine: reporting.revenueEngine,
				executiveSummary: reporting.executiveSummary,
			};
		},
	});
}

function buildGroupedSummary(
	entries: Array<{
		gradeLevel: string;
		nationality: string;
		tariff: string;
		month: number;
		grossRevenueHt: string;
		discountAmount: string;
		netRevenueHt: string;
		vatAmount: string;
	}>,
	groupBy: GroupBy
) {
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
		let groupKey = '';
		switch (groupBy) {
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
			continue;
		}

		groupMap.set(groupKey, {
			key: groupKey,
			grossRevenueHt: new Decimal(row.grossRevenueHt),
			discountAmount: new Decimal(row.discountAmount),
			netRevenueHt: new Decimal(row.netRevenueHt),
			vatAmount: new Decimal(row.vatAmount),
		});
	}

	return [...groupMap.values()].map((group) => ({
		[groupBy]: group.key,
		grossRevenueHt: group.grossRevenueHt.toFixed(4),
		discountAmount: group.discountAmount.toFixed(4),
		netRevenueHt: group.netRevenueHt.toFixed(4),
		vatAmount: group.vatAmount.toFixed(4),
	}));
}

function buildTotals(
	entries: Array<{
		grossRevenueHt: string;
		discountAmount: string;
		netRevenueHt: string;
		vatAmount: string;
	}>,
	reporting: ReturnType<typeof buildRevenueReportingView>
) {
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

	const compositionByLabel = new Map(
		reporting.executiveSummary.composition.map((item) => [item.label, item.amount] as const)
	);
	const totalOperatingRevenue =
		reporting.executiveSummary.rows[reporting.executiveSummary.rows.length - 1]?.annualTotal ??
		'0.0000';
	const registrationRevenue =
		reporting.executiveSummary.rows.find((row) => row.label === 'Registration Fees')?.annualTotal ??
		'0.0000';
	const activitiesRevenue =
		reporting.executiveSummary.rows.find((row) => row.label === 'Activities & Services')
			?.annualTotal ?? '0.0000';
	const examinationRevenue =
		reporting.executiveSummary.rows.find((row) => row.label === 'Examination Fees')?.annualTotal ??
		'0.0000';

	return {
		grossRevenueHt: totalGross.toFixed(4),
		discountAmount: totalDiscount.toFixed(4),
		netRevenueHt: compositionByLabel.get('Net Tuition') ?? totalNet.toFixed(4),
		vatAmount: totalVat.toFixed(4),
		otherRevenueAmount: new Decimal(registrationRevenue)
			.plus(new Decimal(activitiesRevenue))
			.plus(new Decimal(examinationRevenue))
			.toFixed(4),
		totalOperatingRevenue,
	};
}
