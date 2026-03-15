import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { VALID_GRADE_CODES } from '../../lib/enrollment-constants.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const getQuerySchema = z.object({
	academic_period: z.enum(['AY1', 'AY2', 'both']).optional().default('both'),
});

const gradeLevelEnum = z.enum(VALID_GRADE_CODES as [string, ...string[]]);
const academicPeriodEnum = z.enum(['AY1', 'AY2']);
const nationalityEnum = z.enum(['Francais', 'Nationaux', 'Autres']);
const tariffEnum = z.enum(['RP', 'R3+', 'Plein']);

const decimalString = z
	.string()
	.regex(/^-?\d+(\.\d{1,4})?$/, 'Must be a decimal string with up to 4 decimal places');

const feeGridEntrySchema = z.object({
	academicPeriod: academicPeriodEnum,
	gradeLevel: gradeLevelEnum,
	nationality: nationalityEnum,
	tariff: tariffEnum,
	dai: decimalString,
	tuitionTtc: decimalString,
	tuitionHt: decimalString,
	term1Amount: decimalString,
	term2Amount: decimalString,
	term3Amount: decimalString,
});

const putBodySchema = z.object({
	entries: z.array(feeGridEntrySchema).min(1),
});

const VAT_RATE = new Decimal('0.15');
const VAT_TOLERANCE = new Decimal('0.01');
const FEE_GRID_STALE_MODULES = ['REVENUE', 'PNL'] as const;

function validateAy2DaiConsistency(entries: Array<z.infer<typeof feeGridEntrySchema>>) {
	const grouped = new Map<string, Set<string>>();

	for (const entry of entries) {
		if (entry.academicPeriod !== 'AY2') {
			continue;
		}

		const key = `${entry.gradeLevel}|${entry.nationality}`;
		const values = grouped.get(key) ?? new Set<string>();
		values.add(new Decimal(entry.dai).toFixed(4));
		grouped.set(key, values);
	}

	return [...grouped.entries()]
		.filter(([, values]) => values.size > 1)
		.map(([key, values]) => ({
			key,
			values: [...values],
		}));
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function feeGridRoutes(app: FastifyInstance) {
	// GET /fee-grid/prior-year — fetch fee grid from the prior fiscal year's actual version
	app.get('/fee-grid/prior-year', {
		schema: { params: versionIdParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { fiscalYear: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const priorYear = version.fiscalYear - 1;

			// Find a fiscal period from the prior year that has an actual version linked
			const priorPeriod = await prisma.fiscalPeriod.findFirst({
				where: {
					fiscalYear: priorYear,
					actualVersionId: { not: null },
				},
				select: { actualVersionId: true },
			});

			if (!priorPeriod || priorPeriod.actualVersionId === null) {
				return { entries: [], priorFiscalYear: null };
			}

			const priorFeeGrids = await prisma.feeGrid.findMany({
				where: { versionId: priorPeriod.actualVersionId },
				orderBy: [{ academicPeriod: 'asc' }, { gradeLevel: 'asc' }, { nationality: 'asc' }],
			});

			const entries = priorFeeGrids.map((f) => ({
				academicPeriod: f.academicPeriod,
				gradeLevel: f.gradeLevel,
				nationality: f.nationality,
				tariff: f.tariff,
				dai: new Decimal(f.dai.toString()).toFixed(4),
				tuitionTtc: new Decimal(f.tuitionTtc.toString()).toFixed(4),
				tuitionHt: new Decimal(f.tuitionHt.toString()).toFixed(4),
				term1Amount: new Decimal(f.term1Amount.toString()).toFixed(4),
				term2Amount: new Decimal(f.term2Amount.toString()).toFixed(4),
				term3Amount: new Decimal(f.term3Amount.toString()).toFixed(4),
			}));

			return { entries, priorFiscalYear: priorYear };
		},
	});

	// GET /fee-grid
	app.get('/fee-grid', {
		schema: {
			params: versionIdParamsSchema,
			querystring: getQuerySchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { academic_period } = request.query as z.infer<typeof getQuerySchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const where: Prisma.FeeGridWhereInput = { versionId };
			if (academic_period !== 'both') {
				where.academicPeriod = academic_period;
			}

			const feeGrids = await prisma.feeGrid.findMany({
				where,
				orderBy: [{ academicPeriod: 'asc' }, { gradeLevel: 'asc' }, { nationality: 'asc' }],
			});

			const entries = feeGrids.map((f) => ({
				academicPeriod: f.academicPeriod,
				gradeLevel: f.gradeLevel,
				nationality: f.nationality,
				tariff: f.tariff,
				dai: new Decimal(f.dai.toString()).toFixed(4),
				tuitionTtc: new Decimal(f.tuitionTtc.toString()).toFixed(4),
				tuitionHt: new Decimal(f.tuitionHt.toString()).toFixed(4),
				term1Amount: new Decimal(f.term1Amount.toString()).toFixed(4),
				term2Amount: new Decimal(f.term2Amount.toString()).toFixed(4),
				term3Amount: new Decimal(f.term3Amount.toString()).toFixed(4),
			}));

			return { entries };
		},
	});

	// PUT /fee-grid
	app.put('/fee-grid', {
		schema: {
			params: versionIdParamsSchema,
			body: putBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const { entries } = request.body as z.infer<typeof putBodySchema>;

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

			// VAT validation — tuitionHt must match tuitionTtc / (1 + vatRate)
			const vatErrors: Array<{
				index: number;
				gradeLevel: string;
				nationality: string;
				expectedHt: string;
				actualHt: string;
			}> = [];

			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i]!;
				const ttc = new Decimal(entry.tuitionTtc);
				const htProvided = new Decimal(entry.tuitionHt);
				const vatRate = entry.nationality === 'Nationaux' ? new Decimal(0) : VAT_RATE;
				const expectedHt = ttc
					.div(new Decimal(1).plus(vatRate))
					.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
				const diff = htProvided.minus(expectedHt).abs();

				if (diff.gt(VAT_TOLERANCE)) {
					vatErrors.push({
						index: i,
						gradeLevel: entry.gradeLevel,
						nationality: entry.nationality,
						expectedHt: expectedHt.toFixed(4),
						actualHt: entry.tuitionHt,
					});
				}
			}

			if (vatErrors.length > 0) {
				return reply.status(422).send({
					code: 'VAT_MISMATCH',
					message: 'tuition_ht does not match tuition_ttc / (1 + VAT_rate)',
					errors: vatErrors,
				});
			}

			const daiErrors = validateAy2DaiConsistency(entries);
			if (daiErrors.length > 0) {
				return reply.status(422).send({
					code: 'DAI_MISMATCH',
					message: 'AY2 DAI must be identical across tariffs for the same grade and nationality.',
					errors: daiErrors,
				});
			}

			// Upsert in transaction
			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				for (const entry of entries) {
					await txPrisma.feeGrid.upsert({
						where: {
							versionId_academicPeriod_gradeLevel_nationality_tariff: {
								versionId,
								academicPeriod: entry.academicPeriod,
								gradeLevel: entry.gradeLevel,
								nationality: entry.nationality,
								tariff: entry.tariff,
							},
						},
						create: {
							versionId,
							academicPeriod: entry.academicPeriod,
							gradeLevel: entry.gradeLevel,
							nationality: entry.nationality,
							tariff: entry.tariff,
							dai: entry.dai,
							tuitionTtc: entry.tuitionTtc,
							tuitionHt: entry.tuitionHt,
							term1Amount: entry.term1Amount,
							term2Amount: entry.term2Amount,
							term3Amount: entry.term3Amount,
							createdBy: request.user.id,
						},
						update: {
							dai: entry.dai,
							tuitionTtc: entry.tuitionTtc,
							tuitionHt: entry.tuitionHt,
							term1Amount: entry.term1Amount,
							term2Amount: entry.term2Amount,
							term3Amount: entry.term3Amount,
							updatedBy: request.user.id,
						},
					});
				}

				// Mark REVENUE module stale
				const currentStale = new Set(version.staleModules);
				for (const m of FEE_GRID_STALE_MODULES) {
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
						operation: 'FEE_GRID_UPDATED',
						tableName: 'fee_grids',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: { entryCount: entries.length } as unknown as Prisma.InputJsonValue,
					},
				});

				return { updated: entries.length };
			});

			return result;
		},
	});
}
