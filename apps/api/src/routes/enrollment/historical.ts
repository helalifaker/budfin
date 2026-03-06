import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import multipart from '@fastify/multipart';
import Papa from 'papaparse';
import { prisma } from '../../lib/prisma.js';

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_GRADES = [
	'PS',
	'MS',
	'GS',
	'CP',
	'CE1',
	'CE2',
	'CM1',
	'CM2',
	'6eme',
	'5eme',
	'4eme',
	'3eme',
	'2nde',
	'1ere',
	'Terminale',
] as const;

const VALID_GRADE_SET = new Set<string>(VALID_GRADES);

const BAND_MAP: Record<string, string> = {
	PS: 'MATERNELLE',
	MS: 'MATERNELLE',
	GS: 'MATERNELLE',
	CP: 'ELEMENTAIRE',
	CE1: 'ELEMENTAIRE',
	CE2: 'ELEMENTAIRE',
	CM1: 'ELEMENTAIRE',
	CM2: 'ELEMENTAIRE',
	'6eme': 'COLLEGE',
	'5eme': 'COLLEGE',
	'4eme': 'COLLEGE',
	'3eme': 'COLLEGE',
	'2nde': 'LYCEE',
	'1ere': 'LYCEE',
	Terminale: 'LYCEE',
};

// ── Schemas ──────────────────────────────────────────────────────────────────

const getQuerySchema = z.object({
	years: z.coerce.number().int().min(1).max(20).optional().default(5),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcCagr(start: number, end: number, years: number): string {
	if (start <= 0 || years <= 0) return '0';
	const d = new Decimal(end).div(start).pow(new Decimal(1).div(years)).minus(1).times(100);
	return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function calcMovingAvg(values: number[], window: number): string {
	if (values.length === 0) return '0';
	const slice = values.slice(-window);
	const sum = slice.reduce((a, b) => a + b, 0);
	return new Decimal(sum).div(slice.length).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function historicalRoutes(app: FastifyInstance) {
	await app.register(multipart, { limits: { fileSize: 1_048_576 } });

	// GET /historical — AC-16
	app.get('/historical', {
		schema: { querystring: getQuerySchema },
		preHandler: [app.authenticate],
		handler: async (request) => {
			const { years } = request.query as z.infer<typeof getQuerySchema>;

			// Fetch all Actual versions ordered by fiscal year desc
			const actualVersions = await prisma.budgetVersion.findMany({
				where: { type: 'Actual' },
				orderBy: { fiscalYear: 'desc' },
				take: years,
				select: { id: true, fiscalYear: true },
			});

			if (actualVersions.length === 0) {
				return { data: [], cagrByBand: {}, movingAvgByBand: {} };
			}

			const versionIds = actualVersions.map((v) => v.id);
			const versionYearMap = new Map(actualVersions.map((v) => [v.id, v.fiscalYear]));

			// Fetch all headcounts for those versions
			const headcounts = await prisma.enrollmentHeadcount.findMany({
				where: { versionId: { in: versionIds } },
			});

			// Build per-year per-grade data
			const data: Array<{
				academicYear: number;
				gradeLevel: string;
				headcount: number;
			}> = [];

			for (const h of headcounts) {
				const fiscalYear = versionYearMap.get(h.versionId);
				if (fiscalYear === undefined) continue;
				data.push({
					academicYear: fiscalYear,
					gradeLevel: h.gradeLevel,
					headcount: h.headcount,
				});
			}

			// Sort by year asc, then grade
			data.sort((a, b) =>
				a.academicYear !== b.academicYear
					? a.academicYear - b.academicYear
					: a.gradeLevel.localeCompare(b.gradeLevel)
			);

			// Compute band totals per year for CAGR and moving avg
			const bands = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'];
			const yearSet = [...new Set(data.map((d) => d.academicYear))].sort((a, b) => a - b);

			const bandYearTotals: Record<string, Map<number, number>> = {};
			for (const band of bands) {
				bandYearTotals[band] = new Map();
			}

			for (const row of data) {
				const band = BAND_MAP[row.gradeLevel];
				if (!band) continue;
				const map = bandYearTotals[band]!;
				map.set(row.academicYear, (map.get(row.academicYear) ?? 0) + row.headcount);
			}

			const cagrByBand: Record<string, string> = {};
			const movingAvgByBand: Record<string, string> = {};

			for (const band of bands) {
				const map = bandYearTotals[band]!;
				const yearValues = yearSet.map((y) => map.get(y) ?? 0);

				if (yearValues.length >= 2) {
					const startVal = yearValues[0]!;
					const endVal = yearValues[yearValues.length - 1]!;
					cagrByBand[band] = calcCagr(startVal, endVal, yearValues.length - 1);
				} else {
					cagrByBand[band] = '0';
				}

				movingAvgByBand[band] = calcMovingAvg(yearValues, 3);
			}

			return { data, cagrByBand, movingAvgByBand };
		},
	});

	// POST /historical/import — AC-17, AC-18, AC-19, AC-20
	app.post('/historical/import', {
		preHandler: [app.authenticate, app.requireRole('Admin', 'BudgetOwner', 'Editor')],
		handler: async (request, reply) => {
			const data = await request.file();

			if (!data) {
				return reply.status(400).send({
					code: 'FILE_REQUIRED',
					message: 'A CSV file is required',
				});
			}

			const buffer = await data.toBuffer();
			const csvText = buffer.toString('utf-8');

			// Extract fields from multipart
			const fields = data.fields as Record<string, { value: string } | undefined>;
			const mode = fields['mode']?.value;
			const academicYear = fields['academicYear']?.value;

			if (!mode || !['validate', 'commit'].includes(mode)) {
				return reply.status(400).send({
					code: 'INVALID_MODE',
					message: 'mode must be "validate" or "commit"',
				});
			}

			if (!academicYear || !/^\d{4}$/.test(academicYear)) {
				return reply.status(400).send({
					code: 'INVALID_ACADEMIC_YEAR',
					message: 'academicYear must be a 4-digit year string',
				});
			}

			// Parse CSV
			const parsed = Papa.parse<Record<string, string>>(csvText, {
				header: true,
				skipEmptyLines: true,
				transformHeader: (h: string) => h.trim(),
			});

			const errors: Array<{
				row: number;
				field: string;
				message: string;
			}> = [];
			const validRows: Array<{
				gradeLevel: string;
				headcount: number;
			}> = [];

			for (let i = 0; i < parsed.data.length; i++) {
				const row = parsed.data[i]!;
				const rowNum = i + 2; // 1-based, header is row 1
				const gradeLevel = (row['grade_level'] ?? '').trim();
				const countStr = (row['student_count'] ?? row['headcount'] ?? '').trim();

				// AC-20: validate grade level
				if (!VALID_GRADE_SET.has(gradeLevel)) {
					errors.push({
						row: rowNum,
						field: 'grade_level',
						message: `Unknown grade_level: "${gradeLevel}"`,
					});
					continue;
				}

				const headcount = parseInt(countStr, 10);
				if (isNaN(headcount) || headcount < 0) {
					errors.push({
						row: rowNum,
						field: 'student_count',
						message: `Invalid headcount: "${countStr}"`,
					});
					continue;
				}

				validRows.push({ gradeLevel, headcount });
			}

			// AC-17: validate mode — return preview without persisting
			if (mode === 'validate') {
				return {
					totalRows: parsed.data.length,
					validRows: validRows.length,
					errors,
					preview: validRows,
				};
			}

			// mode === 'commit'
			const fiscalYear = parseInt(academicYear, 10);

			// AC-19: check for existing Actual version for this year
			const existingActual = await prisma.budgetVersion.findFirst({
				where: { fiscalYear, type: 'Actual' },
			});

			if (existingActual) {
				// Check if headcounts already exist for this version
				const existingHeadcounts = await prisma.enrollmentHeadcount.count({
					where: { versionId: existingActual.id },
				});

				if (existingHeadcounts > 0) {
					return reply.status(409).send({
						code: 'DUPLICATE_YEAR',
						message: `Historical enrollment data already exists for year ${academicYear}`,
					});
				}
			}

			// AC-18: persist data
			const result = await prisma.$transaction(async (tx) => {
				const txPrisma = tx as typeof prisma;

				// Find or create Actual version
				let actualVersion = existingActual;
				if (!actualVersion) {
					actualVersion = await txPrisma.budgetVersion.create({
						data: {
							name: `Actual ${academicYear}`,
							type: 'Actual',
							fiscalYear,
							status: 'Draft',
							dataSource: 'IMPORTED',
							createdById: request.user.id,
							modificationCount: 0,
							staleModules: [],
						},
					});
				}

				// Insert headcount rows (skip invalid grades — AC-20)
				for (const row of validRows) {
					await txPrisma.enrollmentHeadcount.create({
						data: {
							versionId: actualVersion.id,
							academicPeriod: 'AY1',
							gradeLevel: row.gradeLevel,
							headcount: row.headcount,
							createdBy: request.user.id,
						},
					});
				}

				// Audit log
				await txPrisma.auditEntry.create({
					data: {
						userId: request.user.id,
						operation: 'HISTORICAL_ENROLLMENT_IMPORTED',
						tableName: 'enrollment_headcount',
						recordId: actualVersion.id,
						ipAddress: request.ip,
						newValues: {
							academicYear,
							rowsImported: validRows.length,
							errorsSkipped: errors.length,
						} as unknown as Prisma.InputJsonValue,
					},
				});

				return {
					versionId: actualVersion.id,
					rowsImported: validRows.length,
					errors,
				};
			});

			return reply.status(201).send(result);
		},
	});
}
