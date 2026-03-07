import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { calculateCapacity, type GradeConfig } from '../../services/capacity-engine.js';

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

			// AC-14: IMPORTED version → 409
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

			// Fetch headcount entries
			const headcounts = await prisma.enrollmentHeadcount.findMany({
				where: { versionId },
			});

			// Fetch grade level configs
			const gradeLevels = await prisma.gradeLevel.findMany();
			const gradeConfigs = new Map<string, GradeConfig>();
			for (const gl of gradeLevels) {
				gradeConfigs.set(gl.gradeCode, {
					gradeCode: gl.gradeCode,
					maxClassSize: gl.maxClassSize,
					plafondPct: Number(gl.plafondPct),
				});
			}

			// Calculate
			const inputs = headcounts.map((h) => ({
				gradeLevel: h.gradeLevel,
				academicPeriod: h.academicPeriod,
				headcount: h.headcount,
			}));

			const results = calculateCapacity(inputs, gradeConfigs);

			// AC-13: Summary
			const totalStudentsAy1 = results
				.filter((r) => r.academicPeriod === 'AY1')
				.reduce((sum, r) => sum + r.headcount, 0);
			const totalStudentsAy2 = results
				.filter((r) => r.academicPeriod === 'AY2')
				.reduce((sum, r) => sum + r.headcount, 0);
			const overCapacityGrades = [
				...new Set(results.filter((r) => r.alert === 'OVER').map((r) => r.gradeLevel)),
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
							headcountRows: inputs.length,
							totalStudentsAy1,
							totalStudentsAy2,
						},
					},
				});

				// Upsert DHG requirements
				for (const r of results) {
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

				// AC-23: Remove ENROLLMENT from staleModules
				const currentStale = new Set(version.staleModules);
				currentStale.delete('ENROLLMENT');
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
							resultRows: results.length,
							overCapacityGrades,
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
				results,
			};
		},
	});
}
