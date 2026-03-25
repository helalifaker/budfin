import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import {
	calculatePnl,
	type RevenueInput,
	type OtherRevenueInput,
	type StaffCostInput,
	type CategoryCostInput,
	type OpExInput,
} from '../../services/pnl-engine.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

// ── Routes ───────────────────────────────────────────────────────────────────

export async function pnlCalculateRoutes(app: FastifyInstance) {
	// POST /calculate/pnl — run P&L consolidation
	app.post('/pnl', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const startDate = new Date();
			const startTime = performance.now();
			const runId = randomUUID();

			// Fetch version
			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			// Block locked/archived versions
			if (version.status === 'Locked' || version.status === 'Archived') {
				return reply.status(403).send({
					code: 'VERSION_LOCKED',
					message: `Cannot calculate on ${version.status.toLowerCase()} version`,
				});
			}

			// Check stale prerequisites: REVENUE, STAFFING, OPEX must NOT be stale
			const staleUpstream = version.staleModules.filter((m) =>
				['REVENUE', 'STAFFING', 'OPEX'].includes(m)
			);
			if (staleUpstream.length > 0) {
				return reply.status(409).send({
					code: 'STALE_PREREQUISITES',
					message: 'Upstream modules must be calculated first',
					staleModules: staleUpstream,
				});
			}

			// ── Fetch all upstream data ──────────────────────────────────────

			const [
				monthlyRevenues,
				monthlyOtherRevenues,
				monthlyStaffCosts,
				categoryMonthlyCosts,
				monthlyOpExRows,
			] = await Promise.all([
				prisma.monthlyRevenue.findMany({
					where: { versionId },
				}),
				prisma.monthlyOtherRevenue.findMany({
					where: { versionId },
				}),
				prisma.monthlyStaffCost.findMany({
					where: { versionId },
					include: { employee: { select: { id: true, status: true } } },
				}),
				prisma.categoryMonthlyCost.findMany({
					where: { versionId },
				}),
				prisma.monthlyOpEx.findMany({
					where: { versionId },
					include: {
						lineItem: {
							select: {
								lineItemName: true,
								sectionType: true,
								ifrsCategory: true,
							},
						},
					},
				}),
			]);

			// ── Map to engine input types ────────────────────────────────────

			const revenueInputs: RevenueInput[] = monthlyRevenues.map((r) => ({
				month: r.month,
				gradeLevel: r.gradeLevel,
				nationality: r.nationality,
				tariff: r.tariff,
				grossRevenueHt: r.grossRevenueHt.toString(),
				discountAmount: r.discountAmount.toString(),
				netRevenueHt: r.netRevenueHt.toString(),
			}));

			const otherRevenueInputs: OtherRevenueInput[] = monthlyOtherRevenues.map((r) => ({
				month: r.month,
				lineItemName: r.lineItemName,
				ifrsCategory: r.ifrsCategory ?? '',
				executiveCategory: r.executiveCategory ?? '',
				amount: r.amount.toString(),
			}));

			const staffCostInputs: StaffCostInput[] = monthlyStaffCosts.map((s) => ({
				month: s.month,
				employeeId: s.employeeId,
				baseGross: s.baseGross.toString(),
				adjustedGross: s.adjustedGross.toString(),
				housingAllowance: s.housingAllowance.toString(),
				transportAllowance: s.transportAllowance.toString(),
				responsibilityPremium: s.responsibilityPremium.toString(),
				hsaAmount: s.hsaAmount.toString(),
				gosiAmount: s.gosiAmount.toString(),
				ajeerAmount: s.ajeerAmount.toString(),
				eosMonthlyAccrual: s.eosMonthlyAccrual.toString(),
				totalCost: s.totalCost.toString(),
				isNew: s.employee.status === 'New',
			}));

			const categoryCostInputs: CategoryCostInput[] = categoryMonthlyCosts.map((c) => ({
				month: c.month,
				category: c.category,
				amount: c.amount.toString(),
			}));

			const opexInputs: OpExInput[] = monthlyOpExRows.map((o) => ({
				month: o.month,
				lineItemName: o.lineItem.lineItemName,
				sectionType: o.lineItem.sectionType,
				ifrsCategory: o.lineItem.ifrsCategory,
				amount: o.amount.toString(),
			}));

			// ── Run P&L engine ───────────────────────────────────────────────

			const result = calculatePnl(
				revenueInputs,
				otherRevenueInputs,
				staffCostInputs,
				categoryCostInputs,
				opexInputs
			);

			// ── Persist in transaction ───────────────────────────────────────

			await prisma.$transaction(async (tx) => {
				// Delete existing P&L lines for this version
				await tx.monthlyPnlLine.deleteMany({ where: { versionId } });

				// Insert new P&L lines
				if (result.lines.length > 0) {
					await tx.monthlyPnlLine.createMany({
						data: result.lines.map((line) => ({
							versionId,
							month: line.month,
							sectionKey: line.sectionKey,
							categoryKey: line.categoryKey,
							lineItemKey: line.lineItemKey,
							displayLabel: line.displayLabel,
							depth: line.depth,
							displayOrder: line.displayOrder,
							amount: line.amount,
							signConvention: line.signConvention,
							isSubtotal: line.isSubtotal,
							isSeparator: line.isSeparator,
						})),
					});
				}

				// Upsert MonthlyBudgetSummary
				for (const summary of result.summaries) {
					await tx.monthlyBudgetSummary.upsert({
						where: {
							versionId_month: { versionId, month: summary.month },
						},
						create: {
							versionId,
							month: summary.month,
							revenueHt: summary.revenueHt,
							staffCosts: summary.staffCosts,
							opexCosts: summary.opexCosts,
							depreciation: summary.depreciation,
							impairment: summary.impairment,
							ebitda: summary.ebitda,
							operatingProfit: summary.operatingProfit,
							financeNet: summary.financeNet,
							profitBeforeZakat: summary.profitBeforeZakat,
							zakatAmount: summary.zakatAmount,
							netProfit: summary.netProfit,
						},
						update: {
							revenueHt: summary.revenueHt,
							staffCosts: summary.staffCosts,
							opexCosts: summary.opexCosts,
							depreciation: summary.depreciation,
							impairment: summary.impairment,
							ebitda: summary.ebitda,
							operatingProfit: summary.operatingProfit,
							financeNet: summary.financeNet,
							profitBeforeZakat: summary.profitBeforeZakat,
							zakatAmount: summary.zakatAmount,
							netProfit: summary.netProfit,
							calculatedAt: new Date(),
						},
					});
				}

				// Remove PNL from staleModules
				const currentStale = new Set(version.staleModules);
				currentStale.delete('PNL');
				await tx.budgetVersion.update({
					where: { id: versionId },
					data: {
						staleModules: [...currentStale],
						lastCalculatedAt: new Date(),
					},
				});

				// Create audit log entry
				await tx.calculationAuditLog.create({
					data: {
						versionId,
						runId,
						module: 'PNL',
						status: 'COMPLETED',
						startedAt: startDate,
						completedAt: new Date(),
						durationMs: Math.round(performance.now() - startTime),
						triggeredBy: (request as { user: { id: number } }).user.id,
						inputSummary: {
							revenueRows: revenueInputs.length,
							otherRevenueRows: otherRevenueInputs.length,
							staffCostRows: staffCostInputs.length,
							categoryCostRows: categoryCostInputs.length,
							opexRows: opexInputs.length,
						},
						outputSummary: {
							pnlLineCount: result.lines.length,
							totalRevenueHt: result.totals.totalRevenueHt,
							totalStaffCosts: result.totals.totalStaffCosts,
							ebitda: result.totals.ebitda,
							netProfit: result.totals.netProfit,
						},
					},
				});
			});

			const durationMs = Math.round(performance.now() - startTime);

			return reply.send({
				runId,
				durationMs,
				totalRevenueHt: result.totals.totalRevenueHt,
				totalStaffCosts: result.totals.totalStaffCosts,
				ebitda: result.totals.ebitda,
				ebitdaMarginPct: result.totals.ebitdaMarginPct,
				netProfit: result.totals.netProfit,
			});
		},
	});
}
