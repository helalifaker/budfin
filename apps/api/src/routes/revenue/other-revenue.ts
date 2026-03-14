import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
	getCanonicalDynamicOtherRevenueItem,
	validateCanonicalDynamicOtherRevenueItems,
} from '../../services/revenue-config.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const distributionMethodEnum = z.enum([
	'ACADEMIC_10',
	'YEAR_ROUND_12',
	'CUSTOM_WEIGHTS',
	'SPECIFIC_PERIOD',
]);

const ifrsCategoryEnum = z.enum([
	'Registration Fees',
	'Activities & Services',
	'Examination Fees',
	'Other Revenue',
]);

const decimalString = z
	.string()
	.regex(/^-?\d+(\.\d{1,4})?$/, 'Must be a decimal string with up to 4 decimal places');

const computeMethodEnum = z
	.enum([
		'DAI',
		'DPI',
		'FRAIS_DOSSIER',
		'EXAM_BAC',
		'EXAM_DNB',
		'EXAM_EAF',
		'EVAL_PRIMAIRE',
		'EVAL_SECONDAIRE',
	])
	.nullable()
	.default(null);

const otherRevenueItemSchema = z
	.object({
		lineItemName: z.string().min(1).max(200),
		annualAmount: decimalString,
		distributionMethod: distributionMethodEnum,
		weightArray: z.array(z.number()).length(12).nullable().optional(),
		specificMonths: z.array(z.number().int().min(1).max(12)).min(1).nullable().optional(),
		ifrsCategory: ifrsCategoryEnum,
		computeMethod: computeMethodEnum,
	})
	.refine(
		(data) => {
			if (data.distributionMethod === 'CUSTOM_WEIGHTS') {
				return data.weightArray != null && data.weightArray.length === 12;
			}
			return true;
		},
		{ message: 'CUSTOM_WEIGHTS requires a weight_array of exactly 12 values' }
	)
	.refine(
		(data) => {
			if (data.distributionMethod === 'SPECIFIC_PERIOD') {
				return data.specificMonths != null && data.specificMonths.length >= 1;
			}
			return true;
		},
		{ message: 'SPECIFIC_PERIOD requires a non-empty specific_months array' }
	);

const putBodySchema = z.object({
	items: z.array(otherRevenueItemSchema).min(1),
});

const OTHER_REVENUE_STALE_MODULES = ['REVENUE', 'PNL'] as const;

// ── Routes ────────────────────────────────────────────────────────────────────

export async function otherRevenueRoutes(app: FastifyInstance) {
	// GET /other-revenue
	app.get('/other-revenue', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const items = await prisma.otherRevenueItem.findMany({
				where: { versionId },
				orderBy: { lineItemName: 'asc' },
			});

			const result = items.map((item) => ({
				id: item.id,
				lineItemName: item.lineItemName,
				annualAmount: new Decimal(item.annualAmount.toString()).toFixed(4),
				distributionMethod: item.distributionMethod,
				weightArray: item.weightArray,
				specificMonths: item.specificMonths,
				ifrsCategory: item.ifrsCategory,
				computeMethod: item.computeMethod,
			}));

			return { items: result };
		},
	});

	// PUT /other-revenue
	app.put('/other-revenue', {
		schema: {
			params: versionIdParamsSchema,
			body: putBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { items } = request.body as z.infer<typeof putBodySchema>;

			// Version lock guard
			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_LOCKED',
					message: `Version is ${version.status} and cannot be modified`,
				});
			}

			// Workbook parity: custom month rows use relative weights (e.g. 1,1 for a 50/50 split)
			// rather than normalized percentages, so we only require a positive total weight.
			const weightErrors: Array<{
				index: number;
				lineItemName: string;
				weightSum: string;
			}> = [];

			for (let i = 0; i < items.length; i++) {
				const item = items[i]!;
				if (item.distributionMethod === 'CUSTOM_WEIGHTS' && item.weightArray) {
					const sum = item.weightArray.reduce((acc, w) => acc.plus(new Decimal(w)), new Decimal(0));
					if (sum.lte(0)) {
						weightErrors.push({
							index: i,
							lineItemName: item.lineItemName,
							weightSum: sum.toFixed(6),
						});
					}
				}
			}

			if (weightErrors.length > 0) {
				return reply.status(422).send({
					code: 'INVALID_WEIGHT_ARRAY',
					message: 'Custom weights must have a positive total weight',
					errors: weightErrors,
				});
			}

			const duplicateLineItems = new Set<string>();
			const seenLineItems = new Set<string>();
			for (const item of items) {
				if (seenLineItems.has(item.lineItemName)) {
					duplicateLineItems.add(item.lineItemName);
				}
				seenLineItems.add(item.lineItemName);
			}

			if (duplicateLineItems.size > 0) {
				return reply.status(422).send({
					code: 'DUPLICATE_LINE_ITEM',
					message: 'Other revenue line items must be unique within a version.',
					errors: [...duplicateLineItems],
				});
			}

			const dynamicItems = items.filter((item) => item.computeMethod != null);
			const dynamicValidation = validateCanonicalDynamicOtherRevenueItems(
				dynamicItems.map((item) => ({
					lineItemName: item.lineItemName,
					computeMethod: item.computeMethod ?? null,
					distributionMethod: item.distributionMethod,
					weightArray: item.weightArray ?? null,
					specificMonths: item.specificMonths ?? [],
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
					message:
						'Dynamic other-revenue rows are server-controlled and must match the canonical configuration.',
				});
			}

			const existingDynamicItems = await prisma.otherRevenueItem.findMany({
				where: {
					versionId,
					computeMethod: { not: null },
				},
				select: {
					lineItemName: true,
					annualAmount: true,
				},
			});
			const existingDynamicAmounts = new Map(
				existingDynamicItems.map((item) => [item.lineItemName, item.annualAmount] as const)
			);

			// Upsert in transaction
			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const item of items) {
					const canonicalDynamic =
						item.computeMethod == null
							? undefined
							: getCanonicalDynamicOtherRevenueItem(item.lineItemName);
					const annualAmount =
						canonicalDynamic === undefined
							? item.annualAmount
							: new Decimal(
									String(existingDynamicAmounts.get(item.lineItemName) ?? item.annualAmount)
								).toFixed(4);

					await txPrisma.otherRevenueItem.upsert({
						where: {
							versionId_lineItemName: {
								versionId,
								lineItemName: item.lineItemName,
							},
						},
						create: {
							versionId,
							lineItemName: canonicalDynamic?.lineItemName ?? item.lineItemName,
							annualAmount,
							distributionMethod: canonicalDynamic?.distributionMethod ?? item.distributionMethod,
							weightArray:
								canonicalDynamic === undefined
									? ((item.weightArray as Prisma.InputJsonValue) ?? Prisma.JsonNull)
									: Prisma.JsonNull,
							specificMonths: canonicalDynamic?.specificMonths ?? item.specificMonths ?? [],
							ifrsCategory: canonicalDynamic?.ifrsCategory ?? item.ifrsCategory,
							computeMethod: canonicalDynamic?.computeMethod ?? item.computeMethod ?? null,
							createdBy: request.user.id,
						},
						update: {
							annualAmount,
							distributionMethod: canonicalDynamic?.distributionMethod ?? item.distributionMethod,
							weightArray:
								canonicalDynamic === undefined
									? ((item.weightArray as Prisma.InputJsonValue) ?? Prisma.JsonNull)
									: Prisma.JsonNull,
							specificMonths: canonicalDynamic?.specificMonths ?? item.specificMonths ?? [],
							ifrsCategory: canonicalDynamic?.ifrsCategory ?? item.ifrsCategory,
							computeMethod: canonicalDynamic?.computeMethod ?? item.computeMethod ?? null,
							updatedBy: request.user.id,
						},
					});
				}

				// Mark REVENUE module stale
				const currentStale = new Set(version.staleModules);
				for (const m of OTHER_REVENUE_STALE_MODULES) {
					currentStale.add(m);
				}
				await txPrisma.budgetVersion.update({
					where: { id: versionId },
					data: { staleModules: [...currentStale] },
				});

				// Audit log
				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'OTHER_REVENUE_UPDATED',
						tableName: 'other_revenue_items',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: { itemCount: items.length } as unknown as Prisma.InputJsonValue,
					},
				});

				return { updated: items.length };
			});

			return result;
		},
	});
}
