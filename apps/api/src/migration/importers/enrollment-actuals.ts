import type { PrismaClient } from '@prisma/client';
import type { MigrationLog, GradeCodeMapping } from '../lib/types.js';
import { MigrationLogger } from '../lib/logger.js';
import { loadFixture, loadEnrollmentCsv } from '../lib/fixture-loader.js';

// ── CSV filename to version name mapping ────────────────────────────────────

const YEAR_MAP: Record<string, string> = {
	'2021-22': 'Actual FY2022',
	'2022-23': 'Actual FY2023',
	'2023-24': 'Actual FY2024',
	'2024-25': 'Actual FY2025',
	'2025-26': 'Actual FY2026',
};

const CSV_FILES = [
	'enrollment_2021-22.csv',
	'enrollment_2022-23.csv',
	'enrollment_2023-24.csv',
	'enrollment_2024-25.csv',
	'enrollment_2025-26.csv',
] as const;

// ── Main export ─────────────────────────────────────────────────────────────

export async function importEnrollmentActuals(
	prisma: PrismaClient,
	versions: Map<string, number>,
	userId: number
): Promise<MigrationLog> {
	const logger = new MigrationLogger('enrollment-actuals');

	try {
		// Load grade code mapping for validation
		const gradeMappings = loadFixture<GradeCodeMapping[]>('grade-code-mapping.json');
		const validGrades = new Set(gradeMappings.map((g) => g.appCode));

		let totalCount = 0;

		for (const filename of CSV_FILES) {
			// Extract academic year from filename: "enrollment_2021-22.csv" -> "2021-22"
			const yearKey = filename.replace('enrollment_', '').replace('.csv', '');
			const versionName = YEAR_MAP[yearKey];

			if (!versionName) {
				logger.error({
					code: 'UNKNOWN_YEAR',
					message: `No version mapping for year key: "${yearKey}"`,
					fatal: false,
				});
				continue;
			}

			const versionId = versions.get(versionName);
			if (versionId === undefined) {
				logger.error({
					code: 'VERSION_NOT_FOUND',
					message: `Version "${versionName}" not found in versions map`,
					fatal: false,
				});
				continue;
			}

			const rows = loadEnrollmentCsv(filename);
			let fileCount = 0;

			for (const row of rows) {
				// Validate grade code against mapping
				if (!validGrades.has(row.level_code)) {
					logger.warn({
						code: 'INVALID_GRADE',
						message: `Unknown grade code "${row.level_code}" in ${filename}`,
						field: 'level_code',
						value: row.level_code,
					});
					continue;
				}

				await prisma.enrollmentHeadcount.upsert({
					where: {
						versionId_academicPeriod_gradeLevel: {
							versionId,
							academicPeriod: 'AY1',
							gradeLevel: row.level_code,
						},
					},
					update: {
						headcount: row.student_count,
						updatedBy: userId,
					},
					create: {
						versionId,
						academicPeriod: 'AY1',
						gradeLevel: row.level_code,
						headcount: row.student_count,
						createdBy: userId,
					},
				});
				fileCount++;
			}

			logger.addRowCount(`enrollment_headcount:${yearKey}`, fileCount);
			totalCount += fileCount;
		}

		logger.addRowCount('enrollment_headcount:total', totalCount);
		return logger.complete('SUCCESS');
	} catch (err) {
		logger.error({
			code: 'ENROLLMENT_ACTUALS_FAILED',
			message: err instanceof Error ? err.message : String(err),
			fatal: true,
		});
		return logger.complete('FAILED');
	}
}
