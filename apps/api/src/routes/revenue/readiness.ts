import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

function makeTariffAssignmentKey(academicPeriod: string, gradeLevel: string, nationality: string) {
	return `${academicPeriod}|${gradeLevel}|${nationality}`;
}

function computeTariffAssignmentReadiness(
	details: Array<{
		academicPeriod: string;
		gradeLevel: string;
		nationality: string;
		headcount: number;
	}>,
	nationalityBreakdown: Array<{
		academicPeriod: string;
		gradeLevel: string;
		nationality: string;
		headcount: number;
	}>
) {
	if (details.length === 0 || nationalityBreakdown.length === 0) {
		return { reconciled: false, ready: false };
	}

	const detailMap = new Map<string, number>();
	for (const entry of details) {
		const key = makeTariffAssignmentKey(entry.academicPeriod, entry.gradeLevel, entry.nationality);
		detailMap.set(key, (detailMap.get(key) ?? 0) + entry.headcount);
	}

	const breakdownMap = new Map<string, number>();
	for (const entry of nationalityBreakdown) {
		const key = makeTariffAssignmentKey(entry.academicPeriod, entry.gradeLevel, entry.nationality);
		breakdownMap.set(key, entry.headcount);
	}

	const breakdownKeys = [...breakdownMap.keys()];
	const detailKeys = [...detailMap.keys()];
	const reconciled =
		breakdownKeys.length > 0 &&
		breakdownKeys.every((key) => detailMap.get(key) === breakdownMap.get(key)) &&
		detailKeys.every((key) => breakdownMap.has(key));

	return { reconciled, ready: reconciled };
}

export async function revenueReadinessRoutes(app: FastifyInstance) {
	app.get('/revenue/readiness', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const [
				feeGridTotal,
				otherRevenueTotal,
				otherRevenueConfigured,
				discountPolicies,
				enrollmentDetails,
				nationalityBreakdown,
			] = await Promise.all([
				prisma.feeGrid.count({ where: { versionId } }),
				prisma.otherRevenueItem.count({ where: { versionId } }),
				prisma.otherRevenueItem.count({
					where: {
						versionId,
						annualAmount: { gt: new Prisma.Decimal(0) },
					},
				}),
				prisma.discountPolicy.findMany({
					where: {
						versionId,
						tariff: { in: ['RP', 'R3+'] },
					},
					select: {
						tariff: true,
						discountRate: true,
					},
					orderBy: { tariff: 'asc' },
				}),
				prisma.enrollmentDetail.findMany({
					where: { versionId },
					select: {
						academicPeriod: true,
						gradeLevel: true,
						nationality: true,
						headcount: true,
					},
				}),
				prisma.nationalityBreakdown.findMany({
					where: { versionId },
					select: {
						academicPeriod: true,
						gradeLevel: true,
						nationality: true,
						headcount: true,
					},
				}),
			]);

			const feeGrid = {
				total: feeGridTotal,
				complete: feeGridTotal,
				ready: feeGridTotal > 0,
			};

			const tariffAssignment = computeTariffAssignmentReadiness(
				enrollmentDetails,
				nationalityBreakdown
			);

			const rpPolicy = discountPolicies.find((policy) => policy.tariff === 'RP');
			const r3Policy = discountPolicies.find((policy) => policy.tariff === 'R3+');
			const rpRate = rpPolicy ? new Decimal(rpPolicy.discountRate.toString()).toFixed(6) : null;
			const r3Rate = r3Policy ? new Decimal(r3Policy.discountRate.toString()).toFixed(6) : null;
			const discounts = {
				rpRate,
				r3Rate,
				ready:
					rpRate !== null &&
					r3Rate !== null &&
					new Decimal(rpRate).gt(0) &&
					new Decimal(r3Rate).gt(0),
			};

			const otherRevenue = {
				total: otherRevenueTotal,
				configured: otherRevenueConfigured,
				ready: otherRevenueTotal > 0 && otherRevenueConfigured === otherRevenueTotal,
			};

			const readyCount = [
				feeGrid.ready,
				tariffAssignment.ready,
				discounts.ready,
				otherRevenue.ready,
			].filter(Boolean).length;

			return {
				feeGrid,
				tariffAssignment,
				discounts,
				otherRevenue,
				overallReady: readyCount === 4,
				readyCount,
				totalCount: 4 as const,
			};
		},
	});
}
