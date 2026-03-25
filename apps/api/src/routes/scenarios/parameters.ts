import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';

// ── Schemas ────────────────────────────────────────────────────────────────

const versionIdParams = z.object({
	versionId: z.coerce.number().int().positive(),
});

const scenarioNameParams = z.object({
	versionId: z.coerce.number().int().positive(),
	scenarioName: z.enum(['Base', 'Optimistic', 'Pessimistic']),
});

const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal number');

const updateScenarioBody = z.object({
	newEnrollmentFactor: decimalString.optional(),
	retentionAdjustment: decimalString.optional(),
	feeCollectionRate: decimalString.optional(),
	scholarshipAllocation: decimalString.optional(),
	attritionRate: decimalString.optional(),
	orsHours: decimalString.optional(),
});

// ── Constants ──────────────────────────────────────────────────────────────

const SCENARIO_NAMES = ['Base', 'Optimistic', 'Pessimistic'] as const;
const SCENARIO_STALE_MODULES = ['REVENUE', 'STAFFING', 'OPEX', 'PNL'] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function formatParams(row: {
	id: number;
	versionId: number;
	scenarioName: string;
	newEnrollmentFactor: unknown;
	retentionAdjustment: unknown;
	feeCollectionRate: unknown;
	scholarshipAllocation: unknown;
	attritionRate: unknown;
	orsHours: unknown;
}) {
	return {
		id: row.id,
		versionId: row.versionId,
		scenarioName: row.scenarioName,
		newEnrollmentFactor: String(row.newEnrollmentFactor),
		retentionAdjustment: String(row.retentionAdjustment),
		feeCollectionRate: String(row.feeCollectionRate),
		scholarshipAllocation: String(row.scholarshipAllocation),
		attritionRate: String(row.attritionRate),
		orsHours: String(row.orsHours),
	};
}

// ── Routes ─────────────────────────────────────────────────────────────────

export async function scenarioParameterRoutes(app: FastifyInstance) {
	// GET /scenarios/parameters — fetch all 3 scenario parameter sets
	app.get('/scenarios/parameters', {
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

			let rows = await prisma.scenarioParameters.findMany({
				where: { versionId },
				orderBy: { scenarioName: 'asc' },
			});

			// Auto-create defaults if none exist
			if (rows.length === 0) {
				await prisma.scenarioParameters.createMany({
					data: SCENARIO_NAMES.map((name) => ({
						versionId,
						scenarioName: name,
					})),
				});

				rows = await prisma.scenarioParameters.findMany({
					where: { versionId },
					orderBy: { scenarioName: 'asc' },
				});
			}

			return { data: rows.map(formatParams) };
		},
	});

	// PATCH /scenarios/parameters/:scenarioName — update scenario parameters
	app.patch('/scenarios/parameters/:scenarioName', {
		schema: {
			params: scenarioNameParams,
			body: updateScenarioBody,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId, scenarioName } = request.params as z.infer<typeof scenarioNameParams>;
			const body = request.body as z.infer<typeof updateScenarioBody>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// Build update data — only include provided fields
			const updateData: Record<string, unknown> = {};
			if (body.newEnrollmentFactor !== undefined) {
				updateData.newEnrollmentFactor = new Decimal(body.newEnrollmentFactor);
			}
			if (body.retentionAdjustment !== undefined) {
				updateData.retentionAdjustment = new Decimal(body.retentionAdjustment);
			}
			if (body.feeCollectionRate !== undefined) {
				updateData.feeCollectionRate = new Decimal(body.feeCollectionRate);
			}
			if (body.scholarshipAllocation !== undefined) {
				updateData.scholarshipAllocation = new Decimal(body.scholarshipAllocation);
			}
			if (body.attritionRate !== undefined) {
				updateData.attritionRate = new Decimal(body.attritionRate);
			}
			if (body.orsHours !== undefined) {
				updateData.orsHours = new Decimal(body.orsHours);
			}

			const updated = await prisma.$transaction(async (tx) => {
				const row = await tx.scenarioParameters.upsert({
					where: {
						versionId_scenarioName: { versionId, scenarioName },
					},
					update: updateData,
					create: {
						versionId,
						scenarioName,
						...updateData,
					},
				});

				// Mark downstream modules stale
				const staleSet = new Set(version.staleModules);
				for (const mod of SCENARIO_STALE_MODULES) {
					staleSet.add(mod);
				}
				await tx.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules: [...staleSet] },
				});

				return row;
			});

			return formatParams(updated);
		},
	});

	// GET /scenarios/comparison — compare P&L metrics across scenarios
	app.get('/scenarios/comparison', {
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

			// Read MonthlyBudgetSummary for this version (Base scenario data)
			const summaryRows = await prisma.monthlyBudgetSummary.findMany({
				where: { versionId },
				orderBy: { month: 'asc' },
			});

			// Aggregate totals from the summary
			let totalRevenueHt = new Decimal(0);
			let totalStaffCosts = new Decimal(0);
			let totalEbitda = new Decimal(0);
			let totalNetProfit = new Decimal(0);

			for (const row of summaryRows) {
				totalRevenueHt = totalRevenueHt.plus(row.revenueHt.toString());
				totalStaffCosts = totalStaffCosts.plus(row.staffCosts.toString());
				totalEbitda = totalEbitda.plus(row.ebitda.toString());
				totalNetProfit = totalNetProfit.plus(row.netProfit.toString());
			}

			const fmt = (d: Decimal) => d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
			const pctDelta = (base: Decimal, scenario: Decimal) => {
				if (base.isZero()) return '0.00';
				return scenario
					.minus(base)
					.dividedBy(base.abs())
					.times(100)
					.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
					.toFixed(2);
			};

			// Currently only Base scenario has calculated data.
			// Optimistic/Pessimistic will show '0.0000' until calculated.
			const zero = '0.0000';

			const metrics = [
				{ metric: 'Total Revenue (HT)', value: fmt(totalRevenueHt) },
				{ metric: 'Total Staff Costs', value: fmt(totalStaffCosts) },
				{ metric: 'EBITDA', value: fmt(totalEbitda) },
				{ metric: 'Net Profit', value: fmt(totalNetProfit) },
			];

			const rows = metrics.map(({ metric, value }) => ({
				metric,
				base: value,
				optimistic: zero,
				pessimistic: zero,
				optimisticDeltaPct: pctDelta(new Decimal(value), new Decimal(0)),
				pessimisticDeltaPct: pctDelta(new Decimal(value), new Decimal(0)),
			}));

			return { rows };
		},
	});
}
