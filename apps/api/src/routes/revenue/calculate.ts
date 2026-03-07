import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import {
	calculateRevenue,
	type EnrollmentDetailInput,
	type FeeGridInput,
	type DiscountPolicyInput,
	type OtherRevenueInput,
} from '../../services/revenue-engine.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export async function revenueCalculateRoutes(app: FastifyInstance) {
	// POST /calculate/revenue — run revenue calculation
	app.post('/revenue', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
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

			if (version.dataSource === 'IMPORTED') {
				return reply.status(409).send({
					code: 'IMPORTED_VERSION',
					message: 'Cannot calculate on imported versions',
				});
			}

			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: 'Version is locked',
				});
			}

			// Fetch all inputs in parallel
			const [enrollmentDetails, feeGrids, discountPolicies, otherRevenueItems] = await Promise.all([
				prisma.enrollmentDetail.findMany({ where: { versionId } }),
				prisma.feeGrid.findMany({ where: { versionId } }),
				prisma.discountPolicy.findMany({ where: { versionId } }),
				prisma.otherRevenueItem.findMany({ where: { versionId } }),
			]);

			// Map to engine input types
			const engineInput = {
				enrollmentDetails: enrollmentDetails.map(
					(d): EnrollmentDetailInput => ({
						academicPeriod: d.academicPeriod as 'AY1' | 'AY2',
						gradeLevel: d.gradeLevel,
						nationality: d.nationality,
						tariff: d.tariff,
						headcount: d.headcount,
					})
				),
				feeGrid: feeGrids.map(
					(f): FeeGridInput => ({
						academicPeriod: f.academicPeriod as 'AY1' | 'AY2',
						gradeLevel: f.gradeLevel,
						nationality: f.nationality,
						tariff: f.tariff,
						tuitionTtc: new Decimal(f.tuitionTtc.toString()).toFixed(4),
						tuitionHt: new Decimal(f.tuitionHt.toString()).toFixed(4),
						dai: new Decimal(f.dai.toString()).toFixed(4),
					})
				),
				discountPolicies: discountPolicies.map(
					(p): DiscountPolicyInput => ({
						tariff: p.tariff,
						nationality: p.nationality,
						discountRate: new Decimal(p.discountRate.toString()).toFixed(6),
					})
				),
				otherRevenueItems: otherRevenueItems.map(
					(o): OtherRevenueInput => ({
						lineItemName: o.lineItemName,
						annualAmount: new Decimal(o.annualAmount.toString()).toFixed(4),
						distributionMethod: o.distributionMethod as OtherRevenueInput['distributionMethod'],
						weightArray: o.weightArray as number[] | null,
						specificMonths: o.specificMonths.length > 0 ? o.specificMonths : null,
						ifrsCategory: o.ifrsCategory,
					})
				),
			};

			// Calculate
			const results = calculateRevenue(engineInput);
			const durationMs = Math.round(performance.now() - startTime);

			// Persist results in a transaction
			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				// Create audit log entry
				await txPrisma.calculationAuditLog.create({
					data: {
						versionId,
						runId,
						module: 'REVENUE',
						status: 'STARTED',
						triggeredBy: request.user.id,
						inputSummary: {
							enrollmentRows: engineInput.enrollmentDetails.length,
							feeGridRows: engineInput.feeGrid.length,
							discountPolicies: engineInput.discountPolicies.length,
							otherRevenueItems: engineInput.otherRevenueItems.length,
						},
					},
				});

				// Delete existing monthly revenue for this version + scenario
				await txPrisma.monthlyRevenue.deleteMany({
					where: { versionId, scenarioName: 'Base' },
				});
				await txPrisma.monthlyOtherRevenue.deleteMany({
					where: { versionId, scenarioName: 'Base' },
				});

				// Insert new monthly tuition rows
				if (results.tuitionRevenue.length > 0) {
					await txPrisma.monthlyRevenue.createMany({
						data: results.tuitionRevenue.map((r) => ({
							versionId,
							scenarioName: 'Base',
							academicPeriod: r.academicPeriod,
							gradeLevel: r.gradeLevel,
							nationality: r.nationality,
							tariff: r.tariff,
							month: r.month,
							grossRevenueHt: r.grossRevenueHt,
							discountAmount: r.discountAmount,
							netRevenueHt: r.netRevenueHt,
							vatAmount: r.vatAmount,
							calculatedBy: request.user.id,
						})),
					});
				}

				// Insert monthly other-revenue rows used by REVENUE_ENGINE / EXECUTIVE_SUMMARY
				if (results.otherRevenue.length > 0) {
					await txPrisma.monthlyOtherRevenue.createMany({
						data: results.otherRevenue.map((r) => ({
							versionId,
							scenarioName: 'Base',
							lineItemName: r.lineItemName,
							ifrsCategory: r.ifrsCategory,
							executiveCategory: r.executiveCategory,
							month: r.month,
							amount: r.amount,
							calculatedBy: request.user.id,
						})),
					});
				}

				// Remove REVENUE from staleModules
				const currentStale = new Set(version.staleModules);
				currentStale.delete('REVENUE');
				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules: [...currentStale] },
				});

				// Update audit log to COMPLETED
				await txPrisma.calculationAuditLog.updateMany({
					where: { runId },
					data: {
						status: 'COMPLETED',
						completedAt: new Date(),
						durationMs,
						outputSummary: {
							tuitionRows: results.tuitionRevenue.length,
							otherRevenueRows: results.otherRevenue.length,
							totals: results.totals,
						},
					},
				});
			});

			return {
				runId,
				durationMs,
				summary: results.totals,
				tuitionRowCount: results.tuitionRevenue.length,
				otherRevenueRowCount: results.otherRevenue.length,
			};
		},
	});
}
