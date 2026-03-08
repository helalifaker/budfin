import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { calculateCapacity, type GradeConfig } from '../../services/capacity-engine.js';
import {
	calculateCohortProgression,
	GRADE_PROGRESSION,
	type CohortParams,
} from '../../services/cohort-engine.js';
import {
	calculateNationalityDistribution,
	computeWeightsFromHeadcounts,
	type NationalityInput,
} from '../../services/nationality-engine.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

export async function calculateRoutes(app: FastifyInstance) {
	app.post('/enrollment', {
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

			// AC-14: IMPORTED version -> 409
			if (version.dataSource === 'IMPORTED') {
				return reply.status(409).send({
					code: 'IMPORTED_VERSION',
					message: 'Cannot calculate on imported versions',
				});
			}

			// Version lock guard
			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: 'Version is locked',
				});
			}

			// ── Step 1: Fetch CohortParameter rows ──────────────────────────────
			const cohortParamRows = await prisma.cohortParameter.findMany({
				where: { versionId },
			});
			const cohortParams = new Map<string, CohortParams>();
			for (const cp of cohortParamRows) {
				cohortParams.set(cp.gradeLevel, {
					retentionRate: String(cp.retentionRate),
					lateralEntryCount: cp.lateralEntryCount,
				});
			}

			// ── Step 2: Fetch AY1 headcount rows ────────────────────────────────
			const allHeadcounts = await prisma.enrollmentHeadcount.findMany({
				where: { versionId },
			});
			const ay1Headcounts = new Map<string, number>();
			let existingAy2PsHeadcount: number | null = null;

			for (const h of allHeadcounts) {
				if (h.academicPeriod === 'AY1') {
					ay1Headcounts.set(h.gradeLevel, h.headcount);
				}
				if (h.academicPeriod === 'AY2' && h.gradeLevel === 'PS') {
					existingAy2PsHeadcount = h.headcount;
				}
			}

			// ── Step 3: PS AY2 headcount ────────────────────────────────────────
			const psAy2Headcount = existingAy2PsHeadcount ?? ay1Headcounts.get('PS') ?? 0;

			// ── Step 4: Run cohort progression ──────────────────────────────────
			const cohortResults = calculateCohortProgression({
				ay1Headcounts,
				cohortParams,
				psAy2Headcount,
			});

			// ── Step 5: Upsert AY2 headcount rows ──────────────────────────────
			// Build combined headcount inputs for capacity calculation
			const ay2HeadcountMap = new Map<string, number>();
			for (const row of cohortResults) {
				ay2HeadcountMap.set(row.gradeLevel, row.ay2Headcount);
			}

			// ── Step 6: Fetch AY1 nationality breakdown ─────────────────────────
			const existingNatBreakdown = await prisma.nationalityBreakdown.findMany({
				where: { versionId, academicPeriod: 'AY1' },
			});
			const ay1NatByGrade = new Map<string, typeof existingNatBreakdown>();
			for (const nb of existingNatBreakdown) {
				const existing = ay1NatByGrade.get(nb.gradeLevel) ?? [];
				existing.push(nb);
				ay1NatByGrade.set(nb.gradeLevel, existing);
			}

			// Fetch existing AY2 overrides to preserve them
			const existingAy2Nat = await prisma.nationalityBreakdown.findMany({
				where: { versionId, academicPeriod: 'AY2' },
			});
			const ay2OverriddenGrades = new Set<string>();
			for (const nb of existingAy2Nat) {
				if (nb.isOverridden) {
					ay2OverriddenGrades.add(nb.gradeLevel);
				}
			}

			// ── Step 7: Calculate nationality distribution for non-overridden ───
			const natInputs: NationalityInput[] = [];

			for (let i = 0; i < GRADE_PROGRESSION.length; i++) {
				const grade = GRADE_PROGRESSION[i]!;

				// Skip grades with user overrides
				if (ay2OverriddenGrades.has(grade)) continue;

				const ay2Headcount = ay2HeadcountMap.get(grade) ?? 0;
				const isPs = i === 0;

				if (isPs) {
					// For PS: use AY1 weights or equal split
					const ay1PsNat = ay1NatByGrade.get(grade) ?? [];
					const psWeights =
						ay1PsNat.length > 0
							? computeWeightsFromHeadcounts(
									ay1PsNat.map((n) => ({
										nationality: n.nationality,
										headcount: n.headcount,
									}))
								)
							: new Map([
									['Francais', '0.3333'],
									['Nationaux', '0.3334'],
									['Autres', '0.3333'],
								]);

					natInputs.push({
						gradeLevel: grade,
						ay2Headcount,
						isPs: true,
						psWeights,
					});
				} else {
					// For non-PS: use prior grade AY1 nationality data
					const priorGrade = GRADE_PROGRESSION[i - 1]!;
					const priorNat = ay1NatByGrade.get(priorGrade) ?? [];
					const params = cohortParams.get(grade);

					const lateralWeights = new Map<string, string>();
					if (params) {
						// Build lateral weight map from cohort parameters
						const cp = cohortParamRows.find((c) => c.gradeLevel === grade);
						if (cp) {
							lateralWeights.set('Francais', String(cp.lateralWeightFr));
							lateralWeights.set('Nationaux', String(cp.lateralWeightNat));
							lateralWeights.set('Autres', String(cp.lateralWeightAut));
						}
					}

					natInputs.push({
						gradeLevel: grade,
						ay2Headcount,
						isPs: false,
						priorGradeNationality: priorNat.map((n) => ({
							nationality: n.nationality,
							weight: String(n.weight),
							headcount: n.headcount,
						})),
						retentionRate: params?.retentionRate ?? '0.97',
						lateralCount: params?.lateralEntryCount ?? 0,
						lateralWeights,
					});
				}
			}

			const natResults = calculateNationalityDistribution(natInputs);

			// Fetch grade level configs for capacity calculation
			const gradeLevels = await prisma.gradeLevel.findMany();
			const gradeConfigs = new Map<string, GradeConfig>();
			for (const gl of gradeLevels) {
				gradeConfigs.set(gl.gradeCode, {
					gradeCode: gl.gradeCode,
					maxClassSize: gl.maxClassSize,
					plafondPct: Number(gl.plafondPct),
				});
			}

			// ── Step 9: Run capacity calculation with AY1+AY2 ──────────────────
			const capacityInputs: Array<{
				gradeLevel: string;
				academicPeriod: string;
				headcount: number;
			}> = [];

			// AY1 headcounts
			for (const [grade, headcount] of ay1Headcounts) {
				capacityInputs.push({
					gradeLevel: grade,
					academicPeriod: 'AY1',
					headcount,
				});
			}

			// AY2 headcounts from cohort progression
			for (const row of cohortResults) {
				capacityInputs.push({
					gradeLevel: row.gradeLevel,
					academicPeriod: 'AY2',
					headcount: row.ay2Headcount,
				});
			}

			const capacityResults = calculateCapacity(capacityInputs, gradeConfigs);

			// AC-13: Summary
			const totalStudentsAy1 = capacityResults
				.filter((r) => r.academicPeriod === 'AY1')
				.reduce((sum, r) => sum + r.headcount, 0);
			const totalStudentsAy2 = capacityResults
				.filter((r) => r.academicPeriod === 'AY2')
				.reduce((sum, r) => sum + r.headcount, 0);
			const overCapacityGrades = [
				...new Set(capacityResults.filter((r) => r.alert === 'OVER').map((r) => r.gradeLevel)),
			];

			const durationMs = Math.round(performance.now() - startTime);

			// Persist results in a transaction
			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				// Create audit log entry
				await txPrisma.calculationAuditLog.create({
					data: {
						versionId,
						runId,
						module: 'ENROLLMENT',
						status: 'STARTED',
						triggeredBy: request.user.id,
						inputSummary: {
							headcountRows: capacityInputs.length,
							totalStudentsAy1,
							totalStudentsAy2,
							cohortParamCount: cohortParamRows.length,
							psAy2Headcount,
						},
					},
				});

				// ── Step 5 (persist): Upsert AY2 headcount rows ────────────────
				for (const row of cohortResults) {
					await txPrisma.enrollmentHeadcount.upsert({
						where: {
							versionId_academicPeriod_gradeLevel: {
								versionId,
								academicPeriod: 'AY2',
								gradeLevel: row.gradeLevel,
							},
						},
						create: {
							versionId,
							academicPeriod: 'AY2',
							gradeLevel: row.gradeLevel,
							headcount: row.ay2Headcount,
							createdBy: request.user.id,
						},
						update: {
							headcount: row.ay2Headcount,
							updatedBy: request.user.id,
						},
					});
				}

				// ── Step 8 (persist): Upsert AY2 nationality breakdown ──────────
				for (const nr of natResults) {
					await txPrisma.nationalityBreakdown.upsert({
						where: {
							versionId_academicPeriod_gradeLevel_nationality: {
								versionId,
								academicPeriod: 'AY2',
								gradeLevel: nr.gradeLevel,
								nationality: nr.nationality,
							},
						},
						create: {
							versionId,
							academicPeriod: 'AY2',
							gradeLevel: nr.gradeLevel,
							nationality: nr.nationality,
							weight: nr.weight,
							headcount: nr.headcount,
							isOverridden: nr.isOverridden,
						},
						update: {
							weight: nr.weight,
							headcount: nr.headcount,
							// Preserve isOverridden=false for computed rows only
							isOverridden: nr.isOverridden,
						},
					});
				}

				// ── Step 10: Upsert DHG requirements ────────────────────────────
				for (const r of capacityResults) {
					await txPrisma.dhgRequirement.upsert({
						where: {
							versionId_academicPeriod_gradeLevel: {
								versionId,
								academicPeriod: r.academicPeriod,
								gradeLevel: r.gradeLevel,
							},
						},
						create: {
							versionId,
							academicPeriod: r.academicPeriod,
							gradeLevel: r.gradeLevel,
							headcount: r.headcount,
							maxClassSize: r.maxClassSize,
							sectionsNeeded: r.sectionsNeeded,
							utilization: r.utilization,
							alert: r.alert ?? null,
							recruitmentSlots: r.recruitmentSlots,
						},
						update: {
							headcount: r.headcount,
							maxClassSize: r.maxClassSize,
							sectionsNeeded: r.sectionsNeeded,
							utilization: r.utilization,
							alert: r.alert ?? null,
							recruitmentSlots: r.recruitmentSlots,
						},
					});
				}

				// ── Step 11: Remove ENROLLMENT from staleModules ────────────────
				const currentStale = new Set(version.staleModules);
				currentStale.delete('ENROLLMENT');
				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules: [...currentStale] },
				});

				// ── Step 12: Update audit log to COMPLETED ──────────────────────
				await txPrisma.calculationAuditLog.updateMany({
					where: { runId },
					data: {
						status: 'COMPLETED',
						completedAt: new Date(),
						durationMs,
						outputSummary: {
							resultRows: capacityResults.length,
							overCapacityGrades,
							cohortGradesComputed: cohortResults.length,
							nationalityRowsComputed: natResults.length,
						},
					},
				});
			});

			return {
				runId,
				durationMs,
				summary: {
					totalStudentsAy1,
					totalStudentsAy2,
					overCapacityGrades,
				},
				results: capacityResults,
			};
		},
	});
}
