import type { PrismaClient } from '@prisma/client';
import type { MigrationLog, GradeCodeMapping } from '../lib/types.js';
import { MigrationLogger } from '../lib/logger.js';
import { hasEnrollmentCsv, loadFixture, loadEnrollmentCsv } from '../lib/fixture-loader.js';
import {
	getActualVersionName,
	getHistoricalEnrollmentSourcesForFiscalYear,
	HISTORICAL_ENROLLMENT_FISCAL_YEARS,
} from '../../lib/enrollment-history.js';

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
		const csvCache = new Map<string, Array<{ level_code: string; student_count: number }>>();

		let totalCount = 0;

		for (const fiscalYear of HISTORICAL_ENROLLMENT_FISCAL_YEARS) {
			const versionName = getActualVersionName(fiscalYear);
			const versionId = versions.get(versionName);
			if (versionId === undefined) {
				logger.error({
					code: 'VERSION_NOT_FOUND',
					message: `Version "${versionName}" not found in versions map`,
					fatal: false,
				});
				continue;
			}

			const periodSources = getHistoricalEnrollmentSourcesForFiscalYear(fiscalYear);

			for (const source of periodSources) {
				if (!hasEnrollmentCsv(source.filename)) {
					logger.warn({
						code: 'MISSING_PERIOD_SOURCE',
						message: `Skipping ${versionName} ${source.academicPeriod}: source file "${source.filename}" not found`,
						field: 'academic_period',
						value: source.academicPeriod,
					});
					continue;
				}

				const rows = csvCache.get(source.filename) ?? loadEnrollmentCsv(source.filename);
				csvCache.set(source.filename, rows);

				let periodCount = 0;

				for (const row of rows) {
					if (!validGrades.has(row.level_code)) {
						logger.warn({
							code: 'INVALID_GRADE',
							message: `Unknown grade code "${row.level_code}" in ${source.filename}`,
							field: 'level_code',
							value: row.level_code,
						});
						continue;
					}

					await prisma.enrollmentHeadcount.upsert({
						where: {
							versionId_academicPeriod_gradeLevel: {
								versionId,
								academicPeriod: source.academicPeriod,
								gradeLevel: row.level_code,
							},
						},
						update: {
							headcount: row.student_count,
							updatedBy: userId,
						},
						create: {
							versionId,
							academicPeriod: source.academicPeriod,
							gradeLevel: row.level_code,
							headcount: row.student_count,
							createdBy: userId,
						},
					});
					periodCount++;
				}

				logger.addRowCount(
					`enrollment_headcount:FY${fiscalYear}:${source.academicPeriod}`,
					periodCount
				);
				totalCount += periodCount;
			}
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
