// Re-import enrollment actuals with updated CSV data
// Run: pnpm --filter @budfin/api exec tsx src/migration/reimport-enrollment-actuals.ts

import { PrismaClient } from '@prisma/client';
import { importEnrollmentActuals } from './importers/enrollment-actuals.js';
import { ensureMigrationUser } from './lib/migration-user.js';
import { getActualVersionName } from '../lib/enrollment-history.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
	// eslint-disable-next-line no-console
	console.log('=== Re-importing Enrollment Actuals ===\n');

	// Get migration user
	const userId = await ensureMigrationUser(prisma);
	// eslint-disable-next-line no-console
	console.log(`Migration user ID: ${userId}`);

	// Build actual versions map
	const actualVersionIds = new Map<string, number>();
	const fiscalYears = [2022, 2023, 2024, 2025, 2026];

	for (const fy of fiscalYears) {
		const versionName = getActualVersionName(fy);
		const version = await prisma.budgetVersion.findFirst({
			where: { name: versionName, type: 'Actual' },
		});
		if (version) {
			actualVersionIds.set(versionName, version.id);
			// eslint-disable-next-line no-console
			console.log(`Found version: ${versionName} (ID: ${version.id})`);
		} else {
			// eslint-disable-next-line no-console
			console.error(`WARNING: Version ${versionName} not found!`);
		}
	}

	// Delete existing enrollment data for actual versions
	// eslint-disable-next-line no-console
	console.log('\nDeleting existing enrollment data...');

	const versionIds = Array.from(actualVersionIds.values());

	const deletedDetails = await prisma.enrollmentDetail.deleteMany({
		where: { versionId: { in: versionIds } },
	});
	// eslint-disable-next-line no-console
	console.log(`  Deleted ${deletedDetails.count} enrollment_detail records`);

	const deletedHeadcounts = await prisma.enrollmentHeadcount.deleteMany({
		where: { versionId: { in: versionIds } },
	});
	// eslint-disable-next-line no-console
	console.log(`  Deleted ${deletedHeadcounts.count} enrollment_headcount records`);

	// Re-import enrollment actuals
	// eslint-disable-next-line no-console
	console.log('\nRe-importing enrollment actuals from CSVs...');
	const enrollmentLog = await importEnrollmentActuals(prisma, actualVersionIds, userId);

	// eslint-disable-next-line no-console
	console.log('\n=== Import Complete ===');
	// eslint-disable-next-line no-console
	console.log(`Status: ${enrollmentLog.status}`);
	// eslint-disable-next-line no-console
	console.log(`Row counts:`, enrollmentLog.rowCounts);

	if (enrollmentLog.errors.length > 0) {
		// eslint-disable-next-line no-console
		console.error(`\nErrors (${enrollmentLog.errors.length}):`);
		// eslint-disable-next-line no-console
		enrollmentLog.errors.forEach((e) => console.error(`  - ${e.message}`));
	}

	if (enrollmentLog.warnings.length > 0) {
		// eslint-disable-next-line no-console
		console.warn(`\nWarnings (${enrollmentLog.warnings.length}):`);
		// eslint-disable-next-line no-console
		enrollmentLog.warnings.forEach((w) => console.warn(`  - ${w.message}`));
	}

	// Verify the import
	// eslint-disable-next-line no-console
	console.log('\n=== Verification ===');
	const verifyData = await prisma.$queryRaw`
		SELECT 
			bv.fiscal_year,
			eh.academic_period,
			SUM(eh.headcount) as total_headcount
		FROM enrollment_headcount eh
		JOIN budget_versions bv ON eh.version_id = bv.id
		WHERE bv.type = 'Actual'
		GROUP BY bv.fiscal_year, eh.academic_period
		ORDER BY bv.fiscal_year, eh.academic_period
	`;
	// eslint-disable-next-line no-console
	console.log('Fiscal Year enrollment totals:');
	// eslint-disable-next-line no-console
	console.table(verifyData);
}

main()
	.catch((e) => {
		// eslint-disable-next-line no-console
		console.error('Fatal error:', e);
		process.exitCode = 1;
	})
	.finally(() => {
		prisma.$disconnect();
	});
