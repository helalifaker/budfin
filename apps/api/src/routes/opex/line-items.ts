import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { prisma } from '../../lib/prisma.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const monthlyAmountSchema = z.object({
	month: z.number().int().min(1).max(12),
	amount: z.string(),
});

const lineItemCreateSchema = z.object({
	sectionType: z.enum(['OPERATING', 'NON_OPERATING']),
	ifrsCategory: z.string().min(1).max(50),
	lineItemName: z.string().min(1).max(200),
	displayOrder: z.number().int().optional().default(0),
	computeMethod: z.enum(['MANUAL', 'PERCENT_OF_REVENUE']).optional().default('MANUAL'),
	computeRate: z.string().nullable().optional(),
	budgetV6Total: z.string().nullable().optional(),
	fy2025Actual: z.string().nullable().optional(),
	fy2024Actual: z.string().nullable().optional(),
	comment: z.string().nullable().optional(),
	monthlyAmounts: z.array(monthlyAmountSchema).optional().default([]),
});

const bulkUpdateSchema = z.object({
	lineItems: z.array(
		z.object({
			id: z.number().int().positive().optional(),
			sectionType: z.enum(['OPERATING', 'NON_OPERATING']),
			ifrsCategory: z.string().min(1).max(50),
			lineItemName: z.string().min(1).max(200),
			displayOrder: z.number().int().optional().default(0),
			computeMethod: z.enum(['MANUAL', 'PERCENT_OF_REVENUE']).optional().default('MANUAL'),
			computeRate: z.string().nullable().optional(),
			budgetV6Total: z.string().nullable().optional(),
			fy2025Actual: z.string().nullable().optional(),
			fy2024Actual: z.string().nullable().optional(),
			comment: z.string().nullable().optional(),
			monthlyAmounts: z.array(monthlyAmountSchema),
		})
	),
});

const monthlyUpdateSchema = z.object({
	updates: z.array(
		z.object({
			lineItemId: z.number().int().positive(),
			month: z.number().int().min(1).max(12),
			amount: z.string(),
		})
	),
});

const OPEX_STALE_MODULES = ['OPEX', 'PNL'] as const;

async function markOpExStale(tx: typeof prisma, versionId: number, currentStale: string[]) {
	const staleSet = new Set(currentStale);
	for (const mod of OPEX_STALE_MODULES) {
		staleSet.add(mod);
	}
	await tx.budgetVersion.update({
		where: { id: versionId },
		data: { staleModules: [...staleSet] },
	});
}

function formatLineItem(li: {
	id: number;
	versionId: number;
	sectionType: string;
	ifrsCategory: string;
	lineItemName: string;
	displayOrder: number;
	computeMethod: string;
	computeRate: unknown;
	budgetV6Total: unknown;
	fy2025Actual: unknown;
	fy2024Actual: unknown;
	comment: string | null;
	monthlyAmounts: { month: number; amount: unknown }[];
}) {
	return {
		id: li.id,
		versionId: li.versionId,
		sectionType: li.sectionType,
		ifrsCategory: li.ifrsCategory,
		lineItemName: li.lineItemName,
		displayOrder: li.displayOrder,
		computeMethod: li.computeMethod,
		computeRate: li.computeRate != null ? String(li.computeRate) : null,
		budgetV6Total: li.budgetV6Total != null ? String(li.budgetV6Total) : null,
		fy2025Actual: li.fy2025Actual != null ? String(li.fy2025Actual) : null,
		fy2024Actual: li.fy2024Actual != null ? String(li.fy2024Actual) : null,
		comment: li.comment,
		monthlyAmounts: li.monthlyAmounts.map((ma) => ({
			month: ma.month,
			amount: String(ma.amount),
		})),
	};
}

function computeSummary(lineItems: ReturnType<typeof formatLineItem>[]): Record<string, unknown> {
	let totalOperating = new Decimal(0);
	let totalNonOperating = new Decimal(0);
	const operatingByCategory: Record<string, Decimal> = {};
	const monthlyOperating = new Array(12).fill(null).map(() => new Decimal(0));
	const monthlyNonOperating = new Array(12).fill(null).map(() => new Decimal(0));

	// Non-operating breakdown
	let totalDepreciation = new Decimal(0);
	let totalImpairment = new Decimal(0);
	let totalFinanceIncome = new Decimal(0);
	let totalFinanceCosts = new Decimal(0);

	for (const li of lineItems) {
		let annual = new Decimal(0);
		for (const ma of li.monthlyAmounts) {
			const amt = new Decimal(ma.amount);
			annual = annual.plus(amt);
			if (li.sectionType === 'OPERATING') {
				monthlyOperating[ma.month - 1] = monthlyOperating[ma.month - 1]!.plus(amt);
			} else {
				monthlyNonOperating[ma.month - 1] = monthlyNonOperating[ma.month - 1]!.plus(amt);
			}
		}

		if (li.sectionType === 'OPERATING') {
			totalOperating = totalOperating.plus(annual);
			const prev = operatingByCategory[li.ifrsCategory] ?? new Decimal(0);
			operatingByCategory[li.ifrsCategory] = prev.plus(annual);
		} else {
			totalNonOperating = totalNonOperating.plus(annual);
			if (li.ifrsCategory === 'Depreciation') {
				totalDepreciation = totalDepreciation.plus(annual);
			} else if (li.ifrsCategory === 'Impairment') {
				totalImpairment = totalImpairment.plus(annual);
			} else if (li.ifrsCategory === 'Finance Income') {
				totalFinanceIncome = totalFinanceIncome.plus(annual);
			} else if (li.ifrsCategory === 'Finance Costs') {
				totalFinanceCosts = totalFinanceCosts.plus(annual);
			}
		}
	}

	const categoryStrings: Record<string, string> = {};
	for (const [cat, val] of Object.entries(operatingByCategory)) {
		categoryStrings[cat] = val.toFixed(4);
	}

	return {
		totalOperating: totalOperating.toFixed(4),
		totalNonOperating: totalNonOperating.toFixed(4),
		totalDepreciation: totalDepreciation.toFixed(4),
		totalImpairment: totalImpairment.toFixed(4),
		totalFinanceIncome: totalFinanceIncome.toFixed(4),
		totalFinanceCosts: totalFinanceCosts.toFixed(4),
		operatingByCategory: categoryStrings,
		monthlyOperatingTotals: monthlyOperating.map((d) => d.toFixed(4)),
		monthlyNonOperatingTotals: monthlyNonOperating.map((d) => d.toFixed(4)),
	};
}

export async function opExLineItemRoutes(app: FastifyInstance) {
	// GET /opex/line-items — list all OpEx line items with monthly amounts
	app.get('/opex/line-items', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate, app.requirePermission('data:view')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const lineItems = await prisma.versionOpExLineItem.findMany({
				where: { versionId },
				include: { monthlyAmounts: { orderBy: { month: 'asc' } } },
				orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
			});

			const formatted = lineItems.map(formatLineItem);
			const summary = computeSummary(formatted);

			return reply.send({ data: formatted, summary });
		},
	});

	// POST /opex/line-items — create a single line item
	app.post('/opex/line-items', {
		schema: { params: versionIdParamsSchema, body: lineItemCreateSchema },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const body = request.body as z.infer<typeof lineItemCreateSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, status: true, staleModules: true },
			});
			if (!version || version.status === 'Locked' || version.status === 'Archived') {
				return reply.status(404).send({ message: 'Version not found or locked' });
			}

			const lineItem = await prisma.$transaction(async (tx) => {
				const created = await (tx as typeof prisma).versionOpExLineItem.create({
					data: {
						versionId,
						sectionType: body.sectionType,
						ifrsCategory: body.ifrsCategory,
						lineItemName: body.lineItemName,
						displayOrder: body.displayOrder,
						computeMethod: body.computeMethod,
						computeRate: body.computeRate ?? null,
						budgetV6Total: body.budgetV6Total ?? null,
						fy2025Actual: body.fy2025Actual ?? null,
						fy2024Actual: body.fy2024Actual ?? null,
						comment: body.comment ?? null,
						createdBy: request.user.id,
					},
					include: { monthlyAmounts: true },
				});

				if (body.monthlyAmounts.length > 0) {
					await (tx as typeof prisma).monthlyOpEx.createMany({
						data: body.monthlyAmounts.map((ma) => ({
							versionId,
							lineItemId: created.id,
							month: ma.month,
							amount: ma.amount,
							calculatedBy: request.user.id,
						})),
					});
				}

				await markOpExStale(tx as typeof prisma, versionId, version.staleModules);

				return (tx as typeof prisma).versionOpExLineItem.findUniqueOrThrow({
					where: { id: created.id },
					include: { monthlyAmounts: { orderBy: { month: 'asc' } } },
				});
			});

			return reply.status(201).send(formatLineItem(lineItem));
		},
	});

	// PUT /opex/line-items/bulk — bulk upsert line items with monthly amounts
	app.put('/opex/line-items/bulk', {
		schema: { params: versionIdParamsSchema, body: bulkUpdateSchema },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const body = request.body as z.infer<typeof bulkUpdateSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, status: true, staleModules: true },
			});
			if (!version || version.status === 'Locked' || version.status === 'Archived') {
				return reply.status(404).send({ message: 'Version not found or locked' });
			}

			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const item of body.lineItems) {
					let lineItemId: number;

					if (item.id) {
						// Update existing
						await txPrisma.versionOpExLineItem.update({
							where: { id: item.id },
							data: {
								ifrsCategory: item.ifrsCategory,
								lineItemName: item.lineItemName,
								displayOrder: item.displayOrder,
								computeMethod: item.computeMethod,
								computeRate: item.computeRate ?? null,
								budgetV6Total: item.budgetV6Total ?? null,
								fy2025Actual: item.fy2025Actual ?? null,
								fy2024Actual: item.fy2024Actual ?? null,
								comment: item.comment ?? null,
								updatedBy: request.user.id,
							},
						});
						lineItemId = item.id;
					} else {
						// Create new
						const created = await txPrisma.versionOpExLineItem.create({
							data: {
								versionId,
								sectionType: item.sectionType,
								ifrsCategory: item.ifrsCategory,
								lineItemName: item.lineItemName,
								displayOrder: item.displayOrder,
								computeMethod: item.computeMethod,
								computeRate: item.computeRate ?? null,
								budgetV6Total: item.budgetV6Total ?? null,
								fy2025Actual: item.fy2025Actual ?? null,
								fy2024Actual: item.fy2024Actual ?? null,
								comment: item.comment ?? null,
								createdBy: request.user.id,
							},
						});
						lineItemId = created.id;
					}

					// Upsert monthly amounts
					for (const ma of item.monthlyAmounts) {
						await txPrisma.monthlyOpEx.upsert({
							where: {
								versionId_lineItemId_month: {
									versionId,
									lineItemId,
									month: ma.month,
								},
							},
							create: {
								versionId,
								lineItemId,
								month: ma.month,
								amount: ma.amount,
								calculatedBy: request.user.id,
							},
							update: {
								amount: ma.amount,
								calculatedBy: request.user.id,
							},
						});
					}
				}

				await markOpExStale(txPrisma, versionId, version.staleModules);

				return txPrisma.versionOpExLineItem.findMany({
					where: { versionId },
					include: { monthlyAmounts: { orderBy: { month: 'asc' } } },
					orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
				});
			});

			const formatted = result.map(formatLineItem);
			return reply.send({ data: formatted, summary: computeSummary(formatted) });
		},
	});

	// PUT /opex/monthly — update individual monthly amounts
	app.put('/opex/monthly', {
		schema: { params: versionIdParamsSchema, body: monthlyUpdateSchema },
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const body = request.body as z.infer<typeof monthlyUpdateSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, status: true, staleModules: true },
			});
			if (!version || version.status === 'Locked' || version.status === 'Archived') {
				return reply.status(404).send({ message: 'Version not found or locked' });
			}

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const update of body.updates) {
					await txPrisma.monthlyOpEx.upsert({
						where: {
							versionId_lineItemId_month: {
								versionId,
								lineItemId: update.lineItemId,
								month: update.month,
							},
						},
						create: {
							versionId,
							lineItemId: update.lineItemId,
							month: update.month,
							amount: update.amount,
							calculatedBy: request.user.id,
						},
						update: {
							amount: update.amount,
							calculatedBy: request.user.id,
						},
					});
				}

				await markOpExStale(txPrisma, versionId, version.staleModules);
			});

			return reply.send({ updated: body.updates.length });
		},
	});

	// DELETE /opex/line-items/:lineItemId — delete a line item
	app.delete('/opex/line-items/:lineItemId', {
		schema: {
			params: versionIdParamsSchema.extend({
				lineItemId: z.coerce.number().int().positive(),
			}),
		},
		preHandler: [app.authenticate, app.requirePermission('data:edit')],
		handler: async (request, reply) => {
			const params = request.params as z.infer<typeof versionIdParamsSchema> & {
				lineItemId: number;
			};

			const version = await prisma.budgetVersion.findUnique({
				where: { id: params.versionId },
				select: { id: true, status: true, staleModules: true },
			});
			if (!version || version.status === 'Locked' || version.status === 'Archived') {
				return reply.status(404).send({ message: 'Version not found or locked' });
			}

			await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;
				await txPrisma.versionOpExLineItem.delete({
					where: { id: params.lineItemId },
				});
				await markOpExStale(txPrisma, params.versionId, version.staleModules);
			});

			return reply.status(204).send();
		},
	});
}
