import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { VALID_GRADE_CODES } from '../../lib/enrollment-constants.js';
import {
	calculateAndPersistEnrollmentWorkspace,
	markEnrollmentInputsStale,
	normalizeCohortMutations,
} from '../../services/enrollment-workspace.js';
import { GRADE_PROGRESSION } from '../../services/cohort-engine.js';
import {
	buildEnrollmentPlanningRulesUpdateData,
	resolveEnrollmentPlanningRules,
} from '../../services/planning-rules.js';

const versionIdParamsSchema = z.object({
	versionId: z.coerce.number().int().positive(),
});

const gradeLevelEnum = z.enum(VALID_GRADE_CODES as [string, ...string[]]);
const cohortGradeEnum = z.enum(GRADE_PROGRESSION as unknown as [string, ...string[]]);

const setupAy1EntrySchema = z.object({
	gradeLevel: gradeLevelEnum,
	headcount: z.number().int().min(0),
});

const setupCohortEntrySchema = z.object({
	gradeLevel: cohortGradeEnum,
	retentionRate: z.number().min(0).max(1),
	lateralEntryCount: z.number().int().min(0),
	lateralWeightFr: z.number().min(0).max(1),
	lateralWeightNat: z.number().min(0).max(1),
	lateralWeightAut: z.number().min(0).max(1),
});

const planningRulesSchema = z.object({
	rolloverThreshold: z.number().min(0.5).max(2),
	cappedRetention: z.number().min(0.5).max(1),
});

const setupApplyBodySchema = z.object({
	ay1Entries: z.array(setupAy1EntrySchema).min(1),
	cohortEntries: z.array(setupCohortEntrySchema).min(1),
	psAy2Headcount: z.number().int().min(0).optional(),
	planningRules: planningRulesSchema.optional(),
});

const gradeHeaderAliases = new Set(['grade', 'gradelevel', 'levelcode']);
const headcountHeaderAliases = new Set(['headcount', 'studentcount', 'ay1headcount']);
const WEIGHT_SUM_TOLERANCE = 0.0001;

function normalizeHeaderName(header: string) {
	return header
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, '');
}

function resolveImportColumns(headers: string[]) {
	let gradeColumn: string | null = null;
	let headcountColumn: string | null = null;

	for (const header of headers) {
		const normalized = normalizeHeaderName(header);
		if (!gradeColumn && gradeHeaderAliases.has(normalized)) {
			gradeColumn = header;
		}
		if (!headcountColumn && headcountHeaderAliases.has(normalized)) {
			headcountColumn = header;
		}
	}

	if (!gradeColumn || !headcountColumn) {
		return null;
	}

	return { gradeColumn, headcountColumn };
}

async function parseImportWorkbook(
	buffer: Buffer,
	filename: string
): Promise<Array<Record<string, string>>> {
	if (filename.toLowerCase().endsWith('.csv')) {
		const parsed = Papa.parse<Record<string, string>>(buffer.toString('utf-8'), {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header) => header.trim(),
		});
		return parsed.data;
	}

	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
	const worksheet = workbook.worksheets[0];
	if (!worksheet) {
		return [];
	}

	const toRowValues = (row: ExcelJS.Row) => {
		const rawValues = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
		return rawValues.map((value) => String(value ?? '').trim());
	};

	const headerRow = worksheet.getRow(1);
	const headers = toRowValues(headerRow).filter(Boolean);

	const rows: Array<Record<string, string>> = [];
	for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
		const row = worksheet.getRow(rowNumber);
		const values = toRowValues(row);
		if (values.every((value) => value.length === 0)) {
			continue;
		}

		const record: Record<string, string> = {};
		headers.forEach((header, index) => {
			record[header] = values[index] ?? '';
		});
		rows.push(record);
	}

	return rows;
}

function sumBandTotals<T extends { band: string }>(rows: T[], getValue: (row: T) => number) {
	const bandTotals = new Map<string, number>();
	for (const row of rows) {
		bandTotals.set(row.band, (bandTotals.get(row.band) ?? 0) + getValue(row));
	}
	return [...bandTotals.entries()].map(([band, total]) => ({ band, total }));
}

export async function enrollmentSetupRoutes(app: FastifyInstance) {
	await app.register(multipart, {
		limits: { fileSize: 5_242_880 },
	});

	app.get('/setup-baseline', {
		schema: {
			params: versionIdParamsSchema,
		},
		preHandler: [app.authenticate],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: { id: true, fiscalYear: true },
			});

			if (!version) {
				return reply.status(404).send({
					code: 'VERSION_NOT_FOUND',
					message: `Version ${versionId} not found`,
				});
			}

			const gradeLevels = await prisma.gradeLevel.findMany({
				orderBy: { displayOrder: 'asc' },
				select: {
					gradeCode: true,
					gradeName: true,
					band: true,
					displayOrder: true,
				},
			});

			const sourceCandidates = await prisma.budgetVersion.findMany({
				where: {
					type: 'Actual',
					fiscalYear: version.fiscalYear - 1,
				},
				select: {
					id: true,
					name: true,
					fiscalYear: true,
					status: true,
					updatedAt: true,
				},
			});

			const sourceVersion =
				[...sourceCandidates].sort((left, right) => {
					const leftRank = left.status === 'Locked' ? 0 : 1;
					const rightRank = right.status === 'Locked' ? 0 : 1;
					if (leftRank !== rightRank) {
						return leftRank - rightRank;
					}
					return right.updatedAt.getTime() - left.updatedAt.getTime();
				})[0] ?? null;

			const baselineRows = sourceVersion
				? await prisma.enrollmentHeadcount.findMany({
						where: {
							versionId: sourceVersion.id,
							academicPeriod: 'AY2',
						},
						select: {
							gradeLevel: true,
							headcount: true,
						},
					})
				: [];

			const baselineMap = new Map(baselineRows.map((row) => [row.gradeLevel, row.headcount]));
			const entries = gradeLevels.map((gradeLevel) => ({
				gradeLevel: gradeLevel.gradeCode,
				gradeName: gradeLevel.gradeName,
				band: gradeLevel.band,
				displayOrder: gradeLevel.displayOrder,
				baselineHeadcount: baselineMap.get(gradeLevel.gradeCode) ?? 0,
			}));

			return {
				available: sourceVersion !== null,
				sourceVersion,
				entries,
				totals: {
					grandTotal: entries.reduce((sum, entry) => sum + entry.baselineHeadcount, 0),
					bands: sumBandTotals(entries, (entry) => entry.baselineHeadcount),
				},
			};
		},
	});

	app.post('/setup-import/validate', {
		schema: {
			params: versionIdParamsSchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
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

			const file = await request.file();
			if (!file) {
				return reply.status(400).send({
					code: 'FILE_REQUIRED',
					message: 'An xlsx or csv file is required',
				});
			}

			const rows = await parseImportWorkbook(await file.toBuffer(), file.filename);
			const headers = Object.keys(rows[0] ?? {});
			const columns = resolveImportColumns(headers);

			if (!columns) {
				return reply.status(400).send({
					code: 'INVALID_IMPORT_HEADERS',
					message:
						'Import file must include a grade column and a headcount column using supported aliases',
				});
			}

			const baselineField = file.fields['baseline'];
			let baselineEntries: Array<{ gradeLevel: string; headcount: number }> = [];
			if (baselineField && 'value' in baselineField && typeof baselineField.value === 'string') {
				const baselineSchema = z.array(z.object({ gradeLevel: z.string(), headcount: z.number() }));
				try {
					const parsed: unknown = JSON.parse(baselineField.value);
					const result = baselineSchema.safeParse(parsed);
					if (!result.success) {
						return reply.status(400).send({
							code: 'INVALID_BASELINE',
							message: 'baseline field must be a JSON array of {gradeLevel, headcount} entries',
						});
					}
					baselineEntries = result.data;
				} catch {
					return reply.status(400).send({
						code: 'INVALID_BASELINE',
						message: 'baseline field must be valid JSON',
					});
				}
			}

			const baselineMap = new Map(
				baselineEntries.map((entry) => [entry.gradeLevel, entry.headcount])
			);
			const gradeLevels = await prisma.gradeLevel.findMany({
				orderBy: { displayOrder: 'asc' },
				select: {
					gradeCode: true,
					gradeName: true,
					band: true,
					displayOrder: true,
				},
			});

			const errors: Array<{ row: number; field: string; message: string }> = [];
			const importMap = new Map<string, number>();

			rows.forEach((row, index) => {
				const rowNumber = index + 2;
				const gradeLevel = String(row[columns.gradeColumn] ?? '').trim();
				const rawHeadcount = String(row[columns.headcountColumn] ?? '').trim();
				if (!(VALID_GRADE_CODES as readonly string[]).includes(gradeLevel)) {
					errors.push({
						row: rowNumber,
						field: columns.gradeColumn,
						message: `Unknown grade value "${gradeLevel}"`,
					});
					return;
				}

				const headcount = Number.parseInt(rawHeadcount, 10);
				if (!Number.isFinite(headcount) || headcount < 0) {
					errors.push({
						row: rowNumber,
						field: columns.headcountColumn,
						message: `Invalid headcount "${rawHeadcount}"`,
					});
					return;
				}

				if (importMap.has(gradeLevel)) {
					errors.push({
						row: rowNumber,
						field: columns.gradeColumn,
						message: `Duplicate grade "${gradeLevel}"`,
					});
					return;
				}

				importMap.set(gradeLevel, headcount);
			});

			const preview = gradeLevels.map((gradeLevel) => {
				const baselineHeadcount = baselineMap.get(gradeLevel.gradeCode) ?? 0;
				const importedHeadcount = importMap.get(gradeLevel.gradeCode) ?? null;
				const delta = importedHeadcount === null ? null : importedHeadcount - baselineHeadcount;
				const variancePct =
					importedHeadcount === null || baselineHeadcount === 0
						? null
						: new Decimal(importedHeadcount - baselineHeadcount)
								.div(baselineHeadcount)
								.times(100)
								.toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
								.toNumber();

				return {
					gradeLevel: gradeLevel.gradeCode,
					gradeName: gradeLevel.gradeName,
					band: gradeLevel.band,
					displayOrder: gradeLevel.displayOrder,
					baselineHeadcount,
					importedHeadcount,
					delta,
					variancePct,
					hasLargeVariance: variancePct !== null && Math.abs(variancePct) >= 10,
				};
			});

			return {
				totalRows: rows.length,
				validRows: importMap.size,
				errors,
				preview,
				summary: {
					baselineTotal: preview.reduce((sum, row) => sum + row.baselineHeadcount, 0),
					importTotal: preview.reduce((sum, row) => sum + (row.importedHeadcount ?? 0), 0),
				},
			};
		},
	});

	app.post('/setup/apply', {
		schema: {
			params: versionIdParamsSchema,
			body: setupApplyBodySchema,
		},
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const { versionId } = request.params as z.infer<typeof versionIdParamsSchema>;
			const body = request.body as z.infer<typeof setupApplyBodySchema>;

			const version = await prisma.budgetVersion.findUnique({
				where: { id: versionId },
				select: {
					id: true,
					fiscalYear: true,
					status: true,
					dataSource: true,
					staleModules: true,
					rolloverThreshold: true,
					cappedRetention: true,
				},
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

			if (version.dataSource === 'IMPORTED') {
				return reply.status(409).send({
					code: 'IMPORTED_VERSION',
					message: 'Cannot run enrollment setup on imported versions',
				});
			}

			const gradeLevels = await prisma.gradeLevel.findMany({
				orderBy: { displayOrder: 'asc' },
				select: { gradeCode: true },
			});
			const expectedGrades = gradeLevels.map((gradeLevel) => gradeLevel.gradeCode);
			const ay1GradeSet = new Set(body.ay1Entries.map((entry) => entry.gradeLevel));
			const cohortGradeSet = new Set(body.cohortEntries.map((entry) => entry.gradeLevel));

			const missingAy1Grades = expectedGrades.filter((gradeLevel) => !ay1GradeSet.has(gradeLevel));
			const missingCohortGrades = GRADE_PROGRESSION.filter(
				(gradeLevel) => !cohortGradeSet.has(gradeLevel)
			);

			if (missingAy1Grades.length > 0 || missingCohortGrades.length > 0) {
				return reply.status(422).send({
					code: 'SETUP_DATA_INCOMPLETE',
					message: 'Enrollment setup requires all grades to be reviewed before apply',
					errors: {
						missingAy1Grades,
						missingCohortGrades,
					},
				});
			}

			const normalizedCohortEntries = normalizeCohortMutations(body.cohortEntries);
			const weightErrors: Array<{
				gradeLevel: string;
				weightSum: number;
			}> = [];

			for (const entry of normalizedCohortEntries) {
				if (entry.lateralEntryCount > 0) {
					const weightSum = new Decimal(entry.lateralWeightFr)
						.plus(entry.lateralWeightNat)
						.plus(entry.lateralWeightAut)
						.toNumber();

					if (Math.abs(weightSum - 1.0) > WEIGHT_SUM_TOLERANCE) {
						weightErrors.push({
							gradeLevel: entry.gradeLevel,
							weightSum,
						});
					}
				}
			}

			if (weightErrors.length > 0) {
				return reply.status(422).send({
					code: 'LATERAL_WEIGHT_SUM_INVALID',
					message:
						'Lateral weights (Fr + Nat + Aut) must sum to 1.0 for grades with lateral entries',
					errors: weightErrors,
				});
			}

			const ay1EntriesByGrade = new Map(
				body.ay1Entries.map((entry) => [entry.gradeLevel, entry.headcount])
			);
			const psAy2Headcount = body.psAy2Headcount ?? ay1EntriesByGrade.get('PS') ?? 0;

			const result = await prisma.$transaction(async (tx) => {
				for (const entry of body.ay1Entries) {
					await tx.enrollmentHeadcount.upsert({
						where: {
							versionId_academicPeriod_gradeLevel: {
								versionId,
								academicPeriod: 'AY1',
								gradeLevel: entry.gradeLevel,
							},
						},
						create: {
							versionId,
							academicPeriod: 'AY1',
							gradeLevel: entry.gradeLevel,
							headcount: entry.headcount,
							createdBy: request.user.id,
						},
						update: {
							headcount: entry.headcount,
							updatedBy: request.user.id,
						},
					});
				}

				await tx.enrollmentHeadcount.upsert({
					where: {
						versionId_academicPeriod_gradeLevel: {
							versionId,
							academicPeriod: 'AY2',
							gradeLevel: 'PS',
						},
					},
					create: {
						versionId,
						academicPeriod: 'AY2',
						gradeLevel: 'PS',
						headcount: psAy2Headcount,
						createdBy: request.user.id,
					},
					update: {
						headcount: psAy2Headcount,
						updatedBy: request.user.id,
					},
				});

				if (body.planningRules) {
					await tx.budgetVersion.update({
						where: { id: versionId },
						data: buildEnrollmentPlanningRulesUpdateData(body.planningRules),
					});
				}

				for (const entry of normalizedCohortEntries) {
					await tx.cohortParameter.upsert({
						where: {
							versionId_gradeLevel: {
								versionId,
								gradeLevel: entry.gradeLevel,
							},
						},
						create: {
							versionId,
							gradeLevel: entry.gradeLevel,
							retentionRate: entry.retentionRate,
							lateralEntryCount: entry.lateralEntryCount,
							lateralWeightFr: entry.lateralWeightFr,
							lateralWeightNat: entry.lateralWeightNat,
							lateralWeightAut: entry.lateralWeightAut,
						},
						update: {
							retentionRate: entry.retentionRate,
							lateralEntryCount: entry.lateralEntryCount,
							lateralWeightFr: entry.lateralWeightFr,
							lateralWeightNat: entry.lateralWeightNat,
							lateralWeightAut: entry.lateralWeightAut,
						},
					});
				}

				const staleModules = await markEnrollmentInputsStale(tx, versionId, version.staleModules);

				await tx.auditEntry.create({
					data: {
						userId: request.user.id,
						userEmail: request.user.email,
						operation: 'ENROLLMENT_SETUP_APPLIED',
						tableName: 'budget_versions',
						recordId: versionId,
						ipAddress: request.ip,
						newValues: {
							ay1Entries: body.ay1Entries.length,
							cohortEntries: normalizedCohortEntries.length,
							psAy2Headcount,
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return calculateAndPersistEnrollmentWorkspace({
					tx,
					versionId,
					version: {
						id: version.id,
						fiscalYear: version.fiscalYear,
						staleModules,
						...resolveEnrollmentPlanningRules(
							body.planningRules
								? buildEnrollmentPlanningRulesUpdateData(body.planningRules)
								: version
						),
					},
					actor: {
						userId: request.user.id,
						userEmail: request.user.email,
						ipAddress: request.ip,
					},
				});
			});

			await prisma.budgetVersion.update({
				where: { id: versionId },
				data: { lastCalculatedAt: new Date() },
			});

			return reply.send(result);
		},
	});
}
