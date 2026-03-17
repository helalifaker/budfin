import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';
import { validateCanonicalDynamicOtherRevenueItems } from '../../services/revenue-config.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

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

			const [feeGridTotal, otherRevenueItems, revenueSettings, enrollmentDetails, feeGridEntries] =
				await Promise.all([
					prisma.feeGrid.count({ where: { versionId } }),
					prisma.otherRevenueItem.findMany({
						where: { versionId },
						select: {
							lineItemName: true,
							annualAmount: true,
							distributionMethod: true,
							weightArray: true,
							specificMonths: true,
							ifrsCategory: true,
							computeMethod: true,
						},
					}),
					prisma.versionRevenueSettings.findUnique({
						where: { versionId },
						select: { id: true, flatDiscountPct: true },
					}),
					prisma.enrollmentDetail.findMany({
						where: { versionId },
						select: {
							academicPeriod: true,
							gradeLevel: true,
							nationality: true,
							tariff: true,
							headcount: true,
						},
					}),
					prisma.feeGrid.findMany({
						where: { versionId },
						select: {
							academicPeriod: true,
							gradeLevel: true,
							nationality: true,
							tariff: true,
						},
					}),
				]);

			const settingsExist = revenueSettings !== null;

			const feeGrid = {
				total: feeGridTotal,
				complete: feeGridTotal,
				settingsExist,
				ready: feeGridTotal > 0 && settingsExist,
			};

			// Discounts: read flatDiscountPct from settings. Always ready when settings exist
			// (0% flat discount is a valid configuration).
			const flatRate = revenueSettings
				? new Decimal(revenueSettings.flatDiscountPct.toString()).toFixed(6)
				: null;
			const discounts = {
				flatRate,
				ready: settingsExist,
			};

			const staticOtherRevenueItems = otherRevenueItems.filter(
				(item) => item.computeMethod === null
			);
			const dynamicOtherRevenueItems = otherRevenueItems.filter(
				(item) => item.computeMethod !== null
			);
			const dynamicValidation = validateCanonicalDynamicOtherRevenueItems(
				dynamicOtherRevenueItems.map((item) => ({
					lineItemName: item.lineItemName,
					computeMethod: item.computeMethod,
					distributionMethod: item.distributionMethod,
					weightArray: item.weightArray,
					specificMonths: item.specificMonths,
					ifrsCategory: item.ifrsCategory,
				}))
			);
			const invalidDynamicRows = new Set(dynamicValidation.invalid.map((row) => row.lineItemName));
			const staticConfigured = staticOtherRevenueItems.filter(
				(item) => !new Decimal(item.annualAmount.toString()).isZero()
			).length;
			const dynamicConfigured = dynamicOtherRevenueItems.filter(
				(item) =>
					!dynamicValidation.unexpected.includes(item.lineItemName) &&
					!invalidDynamicRows.has(item.lineItemName)
			).length;
			const otherRevenueConfigured = staticConfigured + dynamicConfigured;
			const otherRevenue = {
				total: otherRevenueItems.length,
				configured: otherRevenueConfigured,
				ready:
					otherRevenueItems.length > 0 &&
					otherRevenueConfigured === otherRevenueItems.length &&
					dynamicValidation.missing.length === 0 &&
					dynamicValidation.unexpected.length === 0 &&
					dynamicValidation.invalid.length === 0,
			};

			// Cross-validate enrollment segments against fee grid entries
			const feeGridKeys = new Set(
				feeGridEntries.map(
					(f) => `${f.academicPeriod}|${f.gradeLevel}|${f.nationality}|${f.tariff}`
				)
			);
			const unmatchedSegments = enrollmentDetails
				.filter((e) => {
					const key = `${e.academicPeriod}|${e.gradeLevel}|${e.nationality}|${e.tariff}`;
					return !feeGridKeys.has(key) && e.headcount > 0;
				})
				.map((e) => ({
					academicPeriod: e.academicPeriod,
					gradeLevel: e.gradeLevel,
					nationality: e.nationality,
					tariff: e.tariff,
					headcount: e.headcount,
				}));

			const enrollmentFeeGridAlignment = {
				totalSegments: enrollmentDetails.filter((e) => e.headcount > 0).length,
				matchedSegments:
					enrollmentDetails.filter((e) => e.headcount > 0).length - unmatchedSegments.length,
				unmatchedSegments,
			};

			const readyCount = [feeGrid.ready, otherRevenue.ready].filter(Boolean).length;

			return {
				feeGrid,
				discounts,
				otherRevenue,
				overallReady: readyCount === 2,
				readyCount,
				totalCount: 2 as const,
				enrollmentFeeGridAlignment,
			};
		},
	});
}
