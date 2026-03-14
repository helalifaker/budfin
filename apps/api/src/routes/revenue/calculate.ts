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
import {
	computeAllDerivedRevenue,
	DerivedRevenueConfigurationError,
} from '../../services/derived-revenue.js';
import {
	formatRevenueSettingsRecord,
	validateCanonicalDynamicOtherRevenueItems,
} from '../../services/revenue-config.js';
import {
	buildRevenueReportingTotals,
	buildRevenueReportingView,
} from '../../services/revenue-reporting.js';

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

			if (version.staleModules.includes('ENROLLMENT')) {
				return reply.status(409).send({
					code: 'ENROLLMENT_STALE',
					message: 'Recalculate enrollment before running revenue.',
				});
			}

			// Fetch all inputs in parallel
			const [
				enrollmentDetails,
				feeGrids,
				discountPolicies,
				otherRevenueItems,
				enrollmentHeadcounts,
				cohortParameters,
				revenueSettings,
			] = await Promise.all([
				prisma.enrollmentDetail.findMany({ where: { versionId } }),
				prisma.feeGrid.findMany({ where: { versionId } }),
				prisma.discountPolicy.findMany({ where: { versionId } }),
				prisma.otherRevenueItem.findMany({ where: { versionId } }),
				prisma.enrollmentHeadcount.findMany({ where: { versionId } }),
				prisma.cohortParameter.findMany({ where: { versionId } }),
				prisma.versionRevenueSettings.findUnique({ where: { versionId } }),
			]);

			// Separate static vs dynamic other revenue items
			const staticItems = otherRevenueItems.filter((o) => !o.computeMethod);
			const dynamicItems = otherRevenueItems.filter((o) => o.computeMethod);

			if (!revenueSettings) {
				return reply.status(422).send({
					code: 'REVENUE_SETTINGS_MISSING',
					message: 'Version-scoped revenue settings are required before calculation.',
				});
			}

			const dynamicValidation = validateCanonicalDynamicOtherRevenueItems(
				dynamicItems.map((item) => ({
					lineItemName: item.lineItemName,
					computeMethod: item.computeMethod,
					distributionMethod: item.distributionMethod,
					weightArray: item.weightArray,
					specificMonths: item.specificMonths,
					ifrsCategory: item.ifrsCategory,
				}))
			);
			if (
				dynamicValidation.missing.length > 0 ||
				dynamicValidation.unexpected.length > 0 ||
				dynamicValidation.invalid.length > 0
			) {
				return reply.status(422).send({
					code: 'DYNAMIC_OTHER_REVENUE_INVALID',
					message: 'Dynamic other-revenue rows must match the canonical configuration.',
				});
			}

			const settings = formatRevenueSettingsRecord({
				dpiPerStudentHt: revenueSettings.dpiPerStudentHt,
				dossierPerStudentHt: revenueSettings.dossierPerStudentHt,
				examBacPerStudent: revenueSettings.examBacPerStudent,
				examDnbPerStudent: revenueSettings.examDnbPerStudent,
				examEafPerStudent: revenueSettings.examEafPerStudent,
				evalPrimairePerStudent: revenueSettings.evalPrimairePerStudent,
				evalSecondairePerStudent: revenueSettings.evalSecondairePerStudent,
			});

			// Compute derived revenue items
			const mappedDetails = enrollmentDetails.map((d) => ({
				academicPeriod: d.academicPeriod as 'AY1' | 'AY2',
				gradeLevel: d.gradeLevel,
				nationality: d.nationality,
				tariff: d.tariff,
				headcount: d.headcount,
			}));

			let derivedItems;
			try {
				derivedItems = computeAllDerivedRevenue({
					enrollmentDetails: mappedDetails,
					feeGrids: feeGrids.map((f) => ({
						academicPeriod: f.academicPeriod as 'AY1' | 'AY2',
						gradeLevel: f.gradeLevel,
						nationality: f.nationality,
						tariff: f.tariff,
						dai: new Decimal(f.dai.toString()).toFixed(4),
					})),
					headcounts: enrollmentHeadcounts.map((h) => ({
						academicPeriod: h.academicPeriod as 'AY1' | 'AY2',
						gradeLevel: h.gradeLevel,
						headcount: h.headcount,
					})),
					cohortParams: cohortParameters.map((cp) => ({
						gradeLevel: cp.gradeLevel,
						appliedRetentionRate:
							cp.appliedRetentionRate === null
								? null
								: new Decimal(cp.appliedRetentionRate.toString()).toFixed(4),
						retainedFromPrior: cp.retainedFromPrior,
						historicalTargetHeadcount: cp.historicalTargetHeadcount,
						derivedLaterals: cp.derivedLaterals,
						usesConfiguredRetention: cp.usesConfiguredRetention,
					})),
					settings,
				});
			} catch (error) {
				if (error instanceof DerivedRevenueConfigurationError) {
					// Only expose details for codes with UI-actionable data (key/value pairs).
					// Internal reconciliation details (headcount arrays) are stripped.
					const safeDetailCodes = new Set(['DAI_MISMATCH', 'DAI_RATE_MISSING']);
					return reply.status(422).send({
						code: error.code,
						message: error.message,
						...(safeDetailCodes.has(error.code) ? { details: error.details } : {}),
					});
				}
				throw error;
			}

			// Merge: derived computed items + static manual items
			const mergedOtherRevenue: OtherRevenueInput[] = [
				...derivedItems,
				...staticItems.map(
					(o): OtherRevenueInput => ({
						lineItemName: o.lineItemName,
						annualAmount: new Decimal(o.annualAmount.toString()).toFixed(4),
						distributionMethod: o.distributionMethod as OtherRevenueInput['distributionMethod'],
						weightArray: o.weightArray as number[] | null,
						specificMonths: o.specificMonths.length > 0 ? o.specificMonths : null,
						ifrsCategory: o.ifrsCategory,
					})
				),
			];

			// Map to engine input types
			const engineInput = {
				enrollmentDetails: mappedDetails.map(
					(d): EnrollmentDetailInput => ({
						academicPeriod: d.academicPeriod,
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
						discountRate: new Decimal(p.discountRate.toString()).toFixed(6),
					})
				),
				otherRevenueItems: mergedOtherRevenue,
			};

			// Calculate
			const results = calculateRevenue(engineInput);
			const reporting = buildRevenueReportingView(
				results.tuitionRevenue.map((row) => ({
					academicPeriod: row.academicPeriod,
					gradeLevel: row.gradeLevel,
					month: row.month,
					grossRevenueHt: row.grossRevenueHt,
					discountAmount: row.discountAmount,
					netRevenueHt: row.netRevenueHt,
					vatAmount: row.vatAmount,
				})),
				results.otherRevenue.map((row) => ({
					lineItemName: row.lineItemName,
					ifrsCategory: row.ifrsCategory,
					executiveCategory: row.executiveCategory,
					month: row.month,
					amount: row.amount,
				}))
			);
			const reportingTotals = buildRevenueReportingTotals(
				results.tuitionRevenue.map((row) => ({
					academicPeriod: row.academicPeriod,
					gradeLevel: row.gradeLevel,
					month: row.month,
					grossRevenueHt: row.grossRevenueHt,
					discountAmount: row.discountAmount,
					netRevenueHt: row.netRevenueHt,
					vatAmount: row.vatAmount,
				})),
				reporting
			);
			const summary = {
				grossRevenueHt: reportingTotals.grossRevenueHt,
				totalDiscounts: reportingTotals.discountAmount,
				netRevenueHt: reportingTotals.netRevenueHt,
				totalVat: reportingTotals.vatAmount,
				totalOtherRevenue: results.totals.totalOtherRevenue,
				totalExecutiveOtherRevenue: reportingTotals.otherRevenueAmount,
				totalOperatingRevenue: reportingTotals.totalOperatingRevenue,
			};
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

				// Update dynamic OtherRevenueItem annualAmount with computed values (parallel batch)
				await Promise.all(
					derivedItems.map(async (derived) => {
						const match = dynamicItems.find((d) => d.lineItemName === derived.lineItemName);
						if (match) {
							await txPrisma.otherRevenueItem.update({
								where: { id: match.id },
								data: { annualAmount: derived.annualAmount },
							});
						}
					})
				);

				// Remove REVENUE from staleModules
				const currentStale = new Set(version.staleModules);
				currentStale.delete('REVENUE');
				currentStale.add('STAFFING');
				currentStale.add('PNL');
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
							totals: summary,
						},
					},
				});
			});

			return {
				runId,
				durationMs,
				summary,
				tuitionRowCount: results.tuitionRevenue.length,
				otherRevenueRowCount: results.otherRevenue.length,
			};
		},
	});
}
