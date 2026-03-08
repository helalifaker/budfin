import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const versionTypeEnum = z.enum(['Budget', 'Forecast', 'Actual']);
const versionStatusEnum = z.enum(['Draft', 'Published', 'Locked', 'Archived']);

const patchStatusSchema = z.object({
	new_status: versionStatusEnum,
	audit_note: z.string().optional(),
});

const cloneVersionSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	fiscalYear: z.number().int().min(2000).max(2100).optional(),
	includeEnrollment: z.boolean().optional().default(true),
	includeSummaries: z.boolean().optional().default(true),
});

const compareQuerySchema = z.object({
	primary: z.coerce.number().int().positive(),
	comparison: z.coerce.number().int().positive(),
	month: z.coerce.number().int().min(1).max(12).optional(),
});

const compareMultiQuerySchema = z.object({
	ids: z.string().regex(/^\d+(,\d+)*$/, 'Comma-separated numeric IDs required'),
});

// ── State machine ─────────────────────────────────────────────────────────────

interface TransitionDef {
	roles: string[];
	isReverse: boolean;
	timestampField?: string;
	clearFields?: string[];
	operation: string;
}

const TRANSITIONS: Record<string, Record<string, TransitionDef>> = {
	Draft: {
		Published: {
			roles: ['Admin', 'BudgetOwner'],
			isReverse: false,
			timestampField: 'publishedAt',
			operation: 'VERSION_PUBLISHED',
		},
	},
	Published: {
		Locked: {
			roles: ['Admin'],
			isReverse: false,
			timestampField: 'lockedAt',
			operation: 'VERSION_LOCKED',
		},
		Draft: {
			roles: ['Admin'],
			isReverse: true,
			clearFields: ['publishedAt'],
			operation: 'VERSION_REVERTED',
		},
	},
	Locked: {
		Archived: {
			roles: ['Admin'],
			isReverse: false,
			timestampField: 'archivedAt',
			operation: 'VERSION_ARCHIVED',
		},
		Draft: {
			roles: ['Admin'],
			isReverse: true,
			clearFields: ['publishedAt', 'lockedAt'],
			operation: 'VERSION_REVERTED',
		},
	},
};

const createVersionSchema = z.object({
	name: z.string().min(1).max(100),
	type: versionTypeEnum,
	fiscalYear: z.number().int().min(2000).max(2100),
	description: z.string().max(500).optional(),
	sourceVersionId: z.number().int().positive().optional(),
});

const listQuerySchema = z.object({
	fiscalYear: z.coerce.number().int().optional(),
	status: versionStatusEnum.optional(),
	type: versionTypeEnum.optional(),
	cursor: z.coerce.number().int().optional(),
	limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const idParamsSchema = z.object({
	id: z.coerce.number().int().positive(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatVersion(v: {
	id: number;
	fiscalYear: number;
	name: string;
	type: string;
	status: string;
	description: string | null;
	dataSource: string;
	sourceVersionId: number | null;
	modificationCount: number;
	staleModules: string[];
	createdById: number;
	publishedAt: Date | null;
	lockedAt: Date | null;
	archivedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	createdBy?: { email: string };
}) {
	return {
		id: v.id,
		fiscalYear: v.fiscalYear,
		name: v.name,
		type: v.type,
		status: v.status,
		description: v.description,
		dataSource: v.dataSource,
		sourceVersionId: v.sourceVersionId,
		modificationCount: v.modificationCount,
		staleModules: v.staleModules,
		createdById: v.createdById,
		createdByEmail: v.createdBy?.email ?? null,
		publishedAt: v.publishedAt,
		lockedAt: v.lockedAt,
		archivedAt: v.archivedAt,
		createdAt: v.createdAt,
		updatedAt: v.updatedAt,
	};
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function versionRoutes(app: FastifyInstance) {
	// GET / — List versions with filters + cursor pagination
	app.get('/', {
		schema: { querystring: listQuerySchema },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { fiscalYear, status, type, cursor, limit } = request.query as z.infer<
				typeof listQuerySchema
			>;

			const countWhere: Prisma.BudgetVersionWhereInput = {};
			if (fiscalYear) countWhere.fiscalYear = fiscalYear;
			if (status) countWhere.status = status;
			if (type) countWhere.type = type;

			const where: Prisma.BudgetVersionWhereInput = { ...countWhere };
			if (cursor) where.id = { lt: cursor };

			const [data, total] = await Promise.all([
				prisma.budgetVersion.findMany({
					where,
					orderBy: { createdAt: 'desc' },
					take: limit,
					include: { createdBy: { select: { email: true } } },
				}),
				prisma.budgetVersion.count({ where: countWhere }),
			]);

			const nextCursor = data.length === limit ? data[data.length - 1]?.id : null;

			return {
				data: data.map(formatVersion),
				total,
				nextCursor,
			};
		},
	});

	// GET /compare — Version comparison (AC-13, TC-001)
	app.get('/compare', {
		schema: { querystring: compareQuerySchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { primary, comparison, month } = request.query as z.infer<typeof compareQuerySchema>;

			const [primaryVersion, compVersion] = await Promise.all([
				prisma.budgetVersion.findUnique({
					where: { id: primary },
					select: { id: true, name: true },
				}),
				prisma.budgetVersion.findUnique({
					where: { id: comparison },
					select: { id: true, name: true },
				}),
			]);

			if (!primaryVersion) {
				return reply
					.status(404)
					.send({ code: 'VERSION_NOT_FOUND', message: `Version ${primary} not found` });
			}
			if (!compVersion) {
				return reply
					.status(404)
					.send({ code: 'VERSION_NOT_FOUND', message: `Version ${comparison} not found` });
			}

			const [primarySummaries, compSummaries] = await Promise.all([
				prisma.monthlyBudgetSummary.findMany({ where: { versionId: primary } }),
				prisma.monthlyBudgetSummary.findMany({ where: { versionId: comparison } }),
			]);

			type SummaryRow = {
				month: number;
				revenueHt: unknown;
				staffCosts: unknown;
				netProfit: unknown;
			};
			const primaryByMonth = new Map<number, SummaryRow>(
				(primarySummaries as SummaryRow[]).map((s) => [s.month, s])
			);
			const compByMonth = new Map<number, SummaryRow>(
				(compSummaries as SummaryRow[]).map((s) => [s.month, s])
			);

			function toDecStr(val: unknown): string {
				return new Decimal(String(val ?? 0)).toFixed(4);
			}

			function calcVariance(pVal: unknown, cVal: unknown) {
				const p = new Decimal(String(pVal ?? 0));
				const c = new Decimal(String(cVal ?? 0));
				const abs = p.minus(c);
				const pct = c.isZero() ? null : abs.div(c.abs()).times(100).toFixed(4);
				return { abs: abs.toFixed(4), pct };
			}

			function buildMetrics(row: SummaryRow | undefined) {
				return {
					totalRevenueHt: toDecStr(row?.revenueHt),
					totalStaffCosts: toDecStr(row?.staffCosts),
					netProfit: toDecStr(row?.netProfit),
				};
			}

			// Always return exactly 12 months (AC-13)
			let monthlyComparison = Array.from({ length: 12 }, (_, i) => {
				const m = i + 1;
				const p = primaryByMonth.get(m);
				const c = compByMonth.get(m);
				const revVar = calcVariance(p?.revenueHt, c?.revenueHt);
				const staffVar = calcVariance(p?.staffCosts, c?.staffCosts);
				const netVar = calcVariance(p?.netProfit, c?.netProfit);
				return {
					month: m,
					primary: buildMetrics(p),
					comparison: buildMetrics(c),
					varianceAbsolute: {
						totalRevenueHt: revVar.abs,
						totalStaffCosts: staffVar.abs,
						netProfit: netVar.abs,
					},
					variancePct: {
						totalRevenueHt: revVar.pct,
						totalStaffCosts: staffVar.pct,
						netProfit: netVar.pct,
					},
				};
			});

			// B8: optional month filter
			if (month !== undefined) {
				monthlyComparison = monthlyComparison.filter((entry) => entry.month === month);
			}

			// Annual totals — sum across all 12 months
			function sumField(
				byMonth: Map<number, SummaryRow>,
				field: keyof Pick<SummaryRow, 'revenueHt' | 'staffCosts' | 'netProfit'>
			): Decimal {
				let total = new Decimal(0);
				for (let m = 1; m <= 12; m++) {
					total = total.plus(new Decimal(String(byMonth.get(m)?.[field] ?? 0)));
				}
				return total;
			}

			const pRevTotal = sumField(primaryByMonth, 'revenueHt');
			const pStaffTotal = sumField(primaryByMonth, 'staffCosts');
			const pNetTotal = sumField(primaryByMonth, 'netProfit');
			const cRevTotal = sumField(compByMonth, 'revenueHt');
			const cStaffTotal = sumField(compByMonth, 'staffCosts');
			const cNetTotal = sumField(compByMonth, 'netProfit');

			function annualVariance(p: Decimal, c: Decimal) {
				const abs = p.minus(c);
				const pct = c.isZero() ? null : abs.div(c.abs()).times(100).toFixed(4);
				return { abs: abs.toFixed(4), pct };
			}

			const revAnnual = annualVariance(pRevTotal, cRevTotal);
			const staffAnnual = annualVariance(pStaffTotal, cStaffTotal);
			const netAnnual = annualVariance(pNetTotal, cNetTotal);

			return {
				primaryVersion: {
					id: primaryVersion.id,
					name: primaryVersion.name,
				},
				comparisonVersion: {
					id: compVersion.id,
					name: compVersion.name,
				},
				monthlyComparison,
				annualTotals: {
					primary: {
						totalRevenueHt: pRevTotal.toFixed(4),
						totalStaffCosts: pStaffTotal.toFixed(4),
						netProfit: pNetTotal.toFixed(4),
					},
					comparison: {
						totalRevenueHt: cRevTotal.toFixed(4),
						totalStaffCosts: cStaffTotal.toFixed(4),
						netProfit: cNetTotal.toFixed(4),
					},
					varianceAbsolute: {
						totalRevenueHt: revAnnual.abs,
						totalStaffCosts: staffAnnual.abs,
						netProfit: netAnnual.abs,
					},
					variancePct: {
						totalRevenueHt: revAnnual.pct,
						totalStaffCosts: staffAnnual.pct,
						netProfit: netAnnual.pct,
					},
				},
			};
		},
	});

	// GET /compare-multi — Multi-version comparison (2-3 versions)
	app.get('/compare-multi', {
		schema: { querystring: compareMultiQuerySchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { ids } = request.query as z.infer<typeof compareMultiQuerySchema>;
			const versionIds = ids.split(',').map(Number);

			if (versionIds.length < 2 || versionIds.length > 3) {
				return reply.status(400).send({
					code: 'INVALID_VERSION_COUNT',
					message: 'Provide 2 or 3 version IDs for comparison',
				});
			}

			const versions = await prisma.budgetVersion.findMany({
				where: { id: { in: versionIds } },
				select: { id: true, name: true, type: true, fiscalYear: true, status: true },
			});

			if (versions.length !== versionIds.length) {
				const found = new Set(versions.map((v) => v.id));
				const missing = versionIds.filter((vid) => !found.has(vid));
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version(s) ${missing.join(', ')} not found`,
				});
			}

			// Preserve requested order
			const orderedVersions = versionIds.map((vid) => versions.find((v) => v.id === vid)!);

			const allSummaries = await prisma.monthlyBudgetSummary.findMany({
				where: { versionId: { in: versionIds } },
			});

			type SummaryRow = {
				versionId: number;
				month: number;
				revenueHt: unknown;
				staffCosts: unknown;
				netProfit: unknown;
			};

			const summaryMap = new Map<string, SummaryRow>();
			for (const s of allSummaries as SummaryRow[]) {
				summaryMap.set(`${s.versionId}:${s.month}`, s);
			}

			function toDecStr(val: unknown): string {
				return new Decimal(String(val ?? 0)).toFixed(4);
			}

			function calcVariance(pVal: unknown, baseVal: unknown) {
				const p = new Decimal(String(pVal ?? 0));
				const b = new Decimal(String(baseVal ?? 0));
				const abs = p.minus(b);
				const pct = b.isZero()
					? null
					: abs.div(b.abs()).times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4);
				return { abs: abs.toFixed(4), pct };
			}

			// Build monthly comparison — 12 months, each version's metrics + variance
			const baseVersionId = versionIds[0];
			const monthly = Array.from({ length: 12 }, (_, i) => {
				const m = i + 1;
				const values = orderedVersions.map((v) => {
					const row = summaryMap.get(`${v.id}:${m}`);
					const metrics = {
						versionId: v.id,
						totalRevenueHt: toDecStr(row?.revenueHt),
						totalStaffCosts: toDecStr(row?.staffCosts),
						netProfit: toDecStr(row?.netProfit),
					};

					if (v.id === baseVersionId) {
						return { ...metrics, variance: null };
					}

					const baseRow = summaryMap.get(`${baseVersionId}:${m}`);
					const revVar = calcVariance(row?.revenueHt, baseRow?.revenueHt);
					const staffVar = calcVariance(row?.staffCosts, baseRow?.staffCosts);
					const netVar = calcVariance(row?.netProfit, baseRow?.netProfit);

					return {
						...metrics,
						variance: {
							totalRevenueHt: { abs: revVar.abs, pct: revVar.pct },
							totalStaffCosts: { abs: staffVar.abs, pct: staffVar.pct },
							netProfit: { abs: netVar.abs, pct: netVar.pct },
						},
					};
				});

				return { month: m, values };
			});

			// Annual totals per version
			const annualTotals = orderedVersions.map((v) => {
				let revTotal = new Decimal(0);
				let staffTotal = new Decimal(0);
				let netTotal = new Decimal(0);

				for (let m = 1; m <= 12; m++) {
					const row = summaryMap.get(`${v.id}:${m}`);
					revTotal = revTotal.plus(new Decimal(String(row?.revenueHt ?? 0)));
					staffTotal = staffTotal.plus(new Decimal(String(row?.staffCosts ?? 0)));
					netTotal = netTotal.plus(new Decimal(String(row?.netProfit ?? 0)));
				}

				const totals = {
					versionId: v.id,
					totalRevenueHt: revTotal.toFixed(4),
					totalStaffCosts: staffTotal.toFixed(4),
					netProfit: netTotal.toFixed(4),
				};

				if (v.id === baseVersionId) {
					return { ...totals, variance: null };
				}

				// Base version annual totals for variance
				let baseRevTotal = new Decimal(0);
				let baseStaffTotal = new Decimal(0);
				let baseNetTotal = new Decimal(0);
				for (let m = 1; m <= 12; m++) {
					const baseRow = summaryMap.get(`${baseVersionId}:${m}`);
					baseRevTotal = baseRevTotal.plus(new Decimal(String(baseRow?.revenueHt ?? 0)));
					baseStaffTotal = baseStaffTotal.plus(new Decimal(String(baseRow?.staffCosts ?? 0)));
					baseNetTotal = baseNetTotal.plus(new Decimal(String(baseRow?.netProfit ?? 0)));
				}

				const revVar = calcVariance(revTotal, baseRevTotal);
				const staffVar = calcVariance(staffTotal, baseStaffTotal);
				const netVar = calcVariance(netTotal, baseNetTotal);

				return {
					...totals,
					variance: {
						totalRevenueHt: { abs: revVar.abs, pct: revVar.pct },
						totalStaffCosts: { abs: staffVar.abs, pct: staffVar.pct },
						netProfit: { abs: netVar.abs, pct: netVar.pct },
					},
				};
			});

			return {
				versions: orderedVersions,
				monthly,
				annualTotals,
			};
		},
	});

	// GET /:id — Get single version with all metadata (AC-18)
	app.get('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id },
				include: { createdBy: { select: { email: true } } },
			});

			if (!version) {
				return reply
					.status(404)
					.send({ code: 'VERSION_NOT_FOUND', message: `Version ${id} not found` });
			}

			return formatVersion(version);
		},
	});

	// GET /:id/import-logs — Import log history for a version
	app.get('/:id/import-logs', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({ where: { id } });
			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${id} not found`,
				});
			}

			const logs = await prisma.actualsImportLog.findMany({
				where: { versionId: id },
				orderBy: { importedAt: 'desc' },
				include: { importedBy: { select: { email: true } } },
			});

			return logs.map((l) => ({
				id: l.id,
				module: l.module,
				sourceFile: l.sourceFile,
				validationStatus: l.validationStatus,
				rowsImported: l.rowsImported,
				importedByEmail: l.importedBy.email,
				importedAt: l.importedAt,
			}));
		},
	});

	// GET /:id/latest-estimate — Blended actual + forecast view (AC-16)
	app.get('/:id/latest-estimate', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({ where: { id } });

			if (!version) {
				return reply
					.status(404)
					.send({ code: 'VERSION_NOT_FOUND', message: `Version ${id} not found` });
			}

			// Fetch fiscal periods for this version's fiscal year
			const periods = await prisma.fiscalPeriod.findMany({
				where: { fiscalYear: version.fiscalYear },
				orderBy: { month: 'asc' },
			});

			// Build month → actualVersionId map for locked periods
			const lockedMap = new Map<number, number>();
			for (const period of periods as Array<{
				month: number;
				status: string;
				actualVersionId: number | null;
			}>) {
				if (period.status === 'Locked' && period.actualVersionId !== null) {
					lockedMap.set(period.month, period.actualVersionId);
				}
			}

			const actualVersionIds = [...new Set(lockedMap.values())];

			// Always fetch both — actual summaries (may be empty) then forecast summaries
			const actualSummaries = await prisma.monthlyBudgetSummary.findMany({
				where:
					actualVersionIds.length > 0 ? { versionId: { in: actualVersionIds } } : { versionId: -1 }, // returns empty, avoids conditional
			});

			const forecastSummaries = await prisma.monthlyBudgetSummary.findMany({
				where: { versionId: id },
			});

			type SummaryRow = {
				versionId: number;
				month: number;
				revenueHt: unknown;
				staffCosts: unknown;
				netProfit: unknown;
			};
			const actualByKey = new Map<string, SummaryRow>();
			for (const s of actualSummaries as SummaryRow[]) {
				actualByKey.set(`${s.versionId}:${s.month}`, s);
			}

			const forecastByMonth = new Map<number, SummaryRow>();
			for (const s of forecastSummaries as SummaryRow[]) {
				forecastByMonth.set(s.month, s);
			}

			const months = Array.from({ length: 12 }, (_, i) => {
				const month = i + 1;
				const lockedActualVersionId = lockedMap.get(month);
				const isActual = lockedActualVersionId !== undefined;

				const summary = isActual
					? actualByKey.get(`${lockedActualVersionId}:${month}`)
					: forecastByMonth.get(month);

				return {
					month,
					source: isActual ? 'ACTUAL' : 'FORECAST',
					revenueHt: String(summary?.revenueHt ?? '0'),
					staffCosts: String(summary?.staffCosts ?? '0'),
					netProfit: String(summary?.netProfit ?? '0'),
				};
			});

			return { months };
		},
	});

	// POST / — Create version (Admin, BudgetOwner only — AC-01, AC-02, AC-19)
	app.post('/', {
		schema: { body: createVersionSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const body = request.body as z.infer<typeof createVersionSchema>;

			// AC-02: Actual versions cannot be created manually
			if (body.type === 'Actual') {
				return reply.status(400).send({
					code: 'ACTUAL_VERSION_MANUAL_CREATE_PROHIBITED',
					message: 'Actual versions cannot be created manually',
				});
			}

			try {
				const version = await prisma.$transaction(async (tx) => {
					const created = await (tx as typeof prisma).budgetVersion.create({
						data: {
							name: body.name,
							type: body.type,
							fiscalYear: body.fiscalYear,
							description: body.description ?? null,
							sourceVersionId: body.sourceVersionId ?? null,
							createdById: request.user.id,
							modificationCount: 0,
							staleModules: [],
							status: 'Draft',
							dataSource: 'CALCULATED',
						},
						include: { createdBy: { select: { email: true } } },
					});

					// Clone data from source version if specified
					if (body.sourceVersionId) {
						const source = await (tx as typeof prisma).budgetVersion.findUnique({
							where: { id: body.sourceVersionId },
						});

						if (!source) {
							throw Object.assign(new Error('Source version not found'), {
								statusCode: 404,
								code: 'SOURCE_NOT_FOUND',
							});
						}

						if (source.type === 'Actual') {
							throw Object.assign(new Error('Cannot copy from Actual version'), {
								statusCode: 409,
								code: 'ACTUAL_COPY_PROHIBITED',
							});
						}

						const summaries = await (tx as typeof prisma).monthlyBudgetSummary.findMany({
							where: { versionId: body.sourceVersionId },
						});

						if (summaries.length > 0) {
							await (tx as typeof prisma).monthlyBudgetSummary.createMany({
								data: summaries.map((s) => ({
									versionId: created.id,
									month: s.month,
									revenueHt: s.revenueHt,
									staffCosts: s.staffCosts,
									netProfit: s.netProfit,
									calculatedAt: s.calculatedAt,
								})),
							});
						}
					}

					await (tx as typeof prisma).auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'VERSION_CREATED',
							tableName: 'budget_versions',
							recordId: created.id,
							ipAddress: request.ip,
							newValues: body as unknown as Prisma.InputJsonValue,
						},
					});

					return created;
				});

				return reply
					.status(201)
					.send(formatVersion(version as Parameters<typeof formatVersion>[0]));
			} catch (error) {
				if (error instanceof Error && 'statusCode' in error && 'code' in error) {
					const err = error as Error & { statusCode: number; code: string };
					return reply.status(err.statusCode).send({
						code: err.code,
						message: err.message,
					});
				}
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_VERSION_NAME',
						message: 'A version with this name already exists for this fiscal year',
					});
				}
				throw error;
			}
		},
	});

	// DELETE /:id — Delete Draft version only (AC-09, AC-10, AC-19)
	app.delete('/:id', {
		schema: { params: idParamsSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({ where: { id } });

			if (!version) {
				return reply
					.status(404)
					.send({ code: 'VERSION_NOT_FOUND', message: `Version ${id} not found` });
			}

			// AC-10: only Draft versions can be deleted
			if (version.status !== 'Draft') {
				return reply.status(409).send({
					code: 'VERSION_NOT_DRAFT',
					message: 'Only Draft versions can be deleted',
				});
			}

			await prisma.$transaction(async (tx) => {
				await (tx as typeof prisma).budgetVersion.delete({ where: { id } });

				await (tx as typeof prisma).auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'VERSION_DELETED',
						tableName: 'budget_versions',
						recordId: id,
						ipAddress: request.ip,
						oldValues: version as unknown as Prisma.InputJsonValue,
					},
				});
			});

			return reply.status(204).send();
		},
	});

	// POST /:id/clone — Clone a version (AC-11, AC-12, AC-19)
	app.post('/:id/clone', {
		schema: { params: idParamsSchema, body: cloneVersionSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const body = request.body as z.infer<typeof cloneVersionSchema>;

			const source = await prisma.budgetVersion.findUnique({
				where: { id },
				include: { createdBy: { select: { email: true } } },
			});

			if (!source) {
				return reply
					.status(404)
					.send({ code: 'VERSION_NOT_FOUND', message: `Version ${id} not found` });
			}

			// AC-12: Actual versions cannot be cloned
			if (source.type === 'Actual') {
				return reply.status(409).send({
					code: 'ACTUAL_VERSION_CLONE_PROHIBITED',
					message: 'Actual versions cannot be cloned',
				});
			}

			try {
				const cloned = await prisma.$transaction(async (tx) => {
					const newVersion = await (tx as typeof prisma).budgetVersion.create({
						data: {
							name: body.name,
							type: source.type,
							fiscalYear: body.fiscalYear ?? source.fiscalYear,
							description: body.description ?? source.description,
							sourceVersionId: id,
							createdById: request.user.id,
							modificationCount: 0,
							staleModules: ['ENROLLMENT'],
							status: 'Draft',
							dataSource: source.dataSource,
						},
						include: { createdBy: { select: { email: true } } },
					});

					// Copy enrollment headcount rows
					if (body.includeEnrollment !== false) {
						const headcounts = await (tx as typeof prisma).enrollmentHeadcount.findMany({
							where: { versionId: id },
						});
						if (headcounts.length > 0) {
							await (tx as typeof prisma).enrollmentHeadcount.createMany({
								data: headcounts.map((h) => ({
									versionId: newVersion.id,
									academicPeriod: h.academicPeriod,
									gradeLevel: h.gradeLevel,
									headcount: h.headcount,
									createdBy: request.user.id,
								})),
							});
						}

						// Copy enrollment detail rows
						const details = await (tx as typeof prisma).enrollmentDetail.findMany({
							where: { versionId: id },
						});
						if (details.length > 0) {
							await (tx as typeof prisma).enrollmentDetail.createMany({
								data: details.map((d) => ({
									versionId: newVersion.id,
									academicPeriod: d.academicPeriod,
									gradeLevel: d.gradeLevel,
									nationality: d.nationality,
									tariff: d.tariff,
									headcount: d.headcount,
									createdBy: request.user.id,
								})),
							});
						}
					}

					// Copy monthly budget summaries
					if (body.includeSummaries !== false) {
						const summaries = await (tx as typeof prisma).monthlyBudgetSummary.findMany({
							where: { versionId: id },
						});
						if (summaries.length > 0) {
							await (tx as typeof prisma).monthlyBudgetSummary.createMany({
								data: summaries.map((s) => ({
									versionId: newVersion.id,
									month: s.month,
									revenueHt: s.revenueHt,
									staffCosts: s.staffCosts,
									netProfit: s.netProfit,
									calculatedAt: s.calculatedAt,
								})),
							});
						}
					}

					await (tx as typeof prisma).auditEntry.create({
						data: {
							userId: request.user.id,
							userEmail: request.user.email,
							operation: 'VERSION_CLONED',
							tableName: 'budget_versions',
							recordId: newVersion.id,
							ipAddress: request.ip,
							newValues: { sourceVersionId: id, name: body.name } as Prisma.InputJsonValue,
						},
					});

					return newVersion;
				});

				return reply.status(201).send(formatVersion(cloned as Parameters<typeof formatVersion>[0]));
			} catch (error) {
				if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
					return reply.status(409).send({
						code: 'DUPLICATE_VERSION_NAME',
						message: 'A version with this name already exists for this fiscal year',
					});
				}
				throw error;
			}
		},
	});

	// PATCH /:id/status — Lifecycle state machine (AC-04 to AC-08, AC-19)
	app.patch('/:id/status', {
		schema: { params: idParamsSchema, body: patchStatusSchema },
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner')],
		handler: async (request, reply) => {
			const { id } = request.params as z.infer<typeof idParamsSchema>;
			const { new_status, audit_note } = request.body as z.infer<typeof patchStatusSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id },
				include: { createdBy: { select: { email: true } } },
			});

			if (!version) {
				return reply
					.status(404)
					.send({ code: 'VERSION_NOT_FOUND', message: `Version ${id} not found` });
			}

			const currentStatus = version.status;
			const fromTransitions = TRANSITIONS[currentStatus];
			const transition = fromTransitions?.[new_status];

			if (!transition) {
				return reply.status(409).send({
					code: 'INVALID_TRANSITION',
					message: `Cannot transition from ${currentStatus} to ${new_status}`,
				});
			}

			// RBAC: only allowed roles for this specific transition
			if (!transition.roles.includes(request.user.role)) {
				return reply.status(403).send({ code: 'FORBIDDEN', message: 'Insufficient role' });
			}

			// AC-07/AC-08: reverse transitions require audit_note ≥ 10 chars
			if (transition.isReverse) {
				if (!audit_note || audit_note.length < 10) {
					return reply.status(400).send({
						code: 'AUDIT_NOTE_REQUIRED',
						message: 'Reverse transitions require an audit note of at least 10 characters',
					});
				}
			}

			const now = new Date();
			const updateData: Record<string, unknown> = {
				status: new_status,
				updatedById: request.user.id,
			};

			if (transition.timestampField) {
				updateData[transition.timestampField] = now;
			}

			if (transition.clearFields) {
				for (const field of transition.clearFields) {
					updateData[field] = null;
				}
			}

			if (transition.isReverse) {
				updateData.modificationCount = { increment: 1 };
			}

			const updated = await prisma.$transaction(async (tx) => {
				const result = await (tx as typeof prisma).budgetVersion.update({
					where: { id },
					data: updateData as Prisma.BudgetVersionUpdateInput,
					include: { createdBy: { select: { email: true } } },
				});

				await (tx as typeof prisma).auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: transition.operation,
						tableName: 'budget_versions',
						recordId: id,
						ipAddress: request.ip,
						oldValues: { status: currentStatus } as Prisma.InputJsonValue,
						newValues: {
							status: new_status,
							...(audit_note ? { audit_note } : {}),
						} as Prisma.InputJsonValue,
						auditNote: audit_note ?? null,
					},
				});

				return result;
			});

			return formatVersion(updated as Parameters<typeof formatVersion>[0]);
		},
	});
}
