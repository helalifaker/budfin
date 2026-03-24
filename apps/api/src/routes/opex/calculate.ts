import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';
import {
	computeOpEx,
	type OpExLineItemInput,
	type MonthlyRevenueInput,
} from '../../services/opex/opex-engine.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

export async function opExCalculateRoutes(app: FastifyInstance) {
	// POST /calculate/opex — recalculate OpEx (revenue-based items like PFC)
	app.post('/opex', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, status: true, staleModules: true },
			});
			if (!version) {
				return reply.status(404).send({ message: 'Version not found' });
			}
			if (version.status === 'Locked' || version.status === 'Archived') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: 'Cannot calculate on a locked or archived version',
				});
			}

			// Fetch all line items with monthly amounts
			const lineItems = await prisma.versionOpExLineItem.findMany({
				where: { versionId },
				include: { monthlyAmounts: { orderBy: { month: 'asc' } } },
				orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
			});

			// Fetch monthly revenue totals for PERCENT_OF_REVENUE computation
			const monthlyRevRows = await prisma.monthlyRevenue.groupBy({
				by: ['month'],
				where: { versionId },
				_sum: { netRevenueHt: true },
			});

			// Also fetch other revenue
			const monthlyOtherRevRows = await prisma.monthlyOtherRevenue.groupBy({
				by: ['month'],
				where: { versionId },
				_sum: { amount: true },
			});

			const revenueByMonth = new Map<number, Decimal>();
			for (const row of monthlyRevRows) {
				const amt = row._sum.netRevenueHt
					? new Decimal(String(row._sum.netRevenueHt))
					: new Decimal(0);
				revenueByMonth.set(row.month, amt);
			}
			for (const row of monthlyOtherRevRows) {
				const amt = row._sum.amount ? new Decimal(String(row._sum.amount)) : new Decimal(0);
				const prev = revenueByMonth.get(row.month) ?? new Decimal(0);
				revenueByMonth.set(row.month, prev.plus(amt));
			}

			const monthlyRevenueInput: MonthlyRevenueInput[] = [];
			for (let m = 1; m <= 12; m++) {
				monthlyRevenueInput.push({
					month: m,
					totalRevenue: (revenueByMonth.get(m) ?? new Decimal(0)).toFixed(4),
				});
			}

			const engineInput: OpExLineItemInput[] = lineItems.map((li) => ({
				id: li.id,
				sectionType: li.sectionType,
				ifrsCategory: li.ifrsCategory,
				lineItemName: li.lineItemName,
				computeMethod: li.computeMethod,
				computeRate: li.computeRate != null ? String(li.computeRate) : null,
				monthlyAmounts: li.monthlyAmounts.map((ma) => ({
					month: ma.month,
					amount: String(ma.amount),
				})),
			}));

			const result = computeOpEx(engineInput, monthlyRevenueInput);

			// Persist computed line items and remove OPEX from stale modules
			let monthlyRecordCount = 0;
			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				// Upsert computed monthly amounts
				for (const ci of result.computedLineItems) {
					await txPrisma.monthlyOpEx.upsert({
						where: {
							versionId_lineItemId_month: {
								versionId,
								lineItemId: ci.lineItemId,
								month: ci.month,
							},
						},
						create: {
							versionId,
							lineItemId: ci.lineItemId,
							month: ci.month,
							amount: ci.amount,
							calculatedBy: request.user.id,
						},
						update: {
							amount: ci.amount,
							calculatedBy: request.user.id,
						},
					});
					monthlyRecordCount++;
				}

				// Remove OPEX from staleModules, add PNL
				const currentStale = new Set(version.staleModules);
				currentStale.delete('OPEX');
				currentStale.add('PNL');
				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: {
						staleModules: [...currentStale],
						lastCalculatedAt: new Date(),
					},
				});
			});

			return reply.send({
				lineItemCount: lineItems.length,
				monthlyRecordCount,
				totalOperating: result.totalOperating,
				totalNonOperating: result.totalNonOperating,
			});
		},
	});
}
