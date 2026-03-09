// Migration Runner — Single entry point for BudFin data migration
// Run: pnpm --filter @budfin/api exec tsx src/migration/index.ts
//
// Prerequisites:
// - DATABASE_URL environment variable set
// - SALARY_ENCRYPTION_KEY environment variable set
// - PostgreSQL database with all migrations applied
// - pg_dump available on PATH (for backup)

import { PrismaClient } from '@prisma/client';
import { createBackup } from './lib/backup.js';
import { ensureMigrationUser } from './lib/migration-user.js';
import { MigrationLogger } from './lib/logger.js';
import type { MigrationLog } from './lib/types.js';
import { seedMasterData } from './importers/master-data.js';
import { createBudgetVersions } from './importers/budget-versions.js';
import { importRevenue } from './importers/revenue.js';
import { importOtherRevenue } from './importers/other-revenue.js';
import { importDhgGrille } from './importers/dhg-grille.js';
import { importEnrollmentActuals } from './importers/enrollment-actuals.js';
import { importEmployees } from './importers/employees.js';
import { runValidationSuite } from './validation/suite.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
	const runnerLogger = new MigrationLogger('migration-runner');
	const allLogs: MigrationLog[] = [];

	// eslint-disable-next-line no-console
	console.log('=== BudFin Data Migration ===\n');

	// Phase 1: Backup
	// eslint-disable-next-line no-console
	console.log('[1/10] Creating pre-migration backup...');
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL environment variable not set');
	}
	try {
		const backupPath = createBackup(databaseUrl);
		// eslint-disable-next-line no-console
		console.log(`  Backup created: ${backupPath}`);
	} catch (err) {
		// eslint-disable-next-line no-console
		console.warn(
			`  Backup skipped (pg_dump may not be available): ${err instanceof Error ? err.message : String(err)}`
		);
	}

	// Phase 2: System user
	// eslint-disable-next-line no-console
	console.log('[2/10] Ensuring migration system user...');
	const userId = await ensureMigrationUser(prisma);
	// eslint-disable-next-line no-console
	console.log(`  Migration user ID: ${userId}`);

	// Phase 3: Master data
	// eslint-disable-next-line no-console
	console.log('[3/10] Seeding master data...');
	const masterDataLog = await seedMasterData(prisma, userId);
	allLogs.push(masterDataLog);
	printLogSummary(masterDataLog);

	// Phase 4: Budget versions
	// eslint-disable-next-line no-console
	console.log('[4/10] Creating budget versions...');
	const { log: versionsLog, versions } = await createBudgetVersions(prisma, userId);
	allLogs.push(versionsLog);
	printLogSummary(versionsLog);

	const budgetVersionId = versions.get('Migration FY2026');
	if (!budgetVersionId) {
		throw new Error('Migration FY2026 budget version not created');
	}

	const actualVersionIds = new Map<string, number>();
	for (const [name, id] of versions) {
		if (name.startsWith('Actual')) {
			actualVersionIds.set(name, id);
		}
	}

	// Phase 5: Revenue import
	// eslint-disable-next-line no-console
	console.log('[5/10] Importing revenue data...');
	const revenueLog = await importRevenue(prisma, budgetVersionId, userId);
	allLogs.push(revenueLog);
	printLogSummary(revenueLog);

	// Phase 6: Other revenue import
	// eslint-disable-next-line no-console
	console.log('[6/10] Importing other revenue...');
	const otherRevLog = await importOtherRevenue(prisma, budgetVersionId, userId);
	allLogs.push(otherRevLog);
	printLogSummary(otherRevLog);

	// Phase 7: DHG grille import
	// eslint-disable-next-line no-console
	console.log('[7/10] Importing DHG grille configuration...');
	const dhgLog = await importDhgGrille(prisma, userId);
	allLogs.push(dhgLog);
	printLogSummary(dhgLog);

	// Phase 8: Historical enrollment
	// eslint-disable-next-line no-console
	console.log('[8/10] Importing historical enrollment CSVs...');
	const enrollmentLog = await importEnrollmentActuals(prisma, actualVersionIds, userId);
	allLogs.push(enrollmentLog);
	printLogSummary(enrollmentLog);

	// Phase 9: Staff costs
	// eslint-disable-next-line no-console
	console.log('[9/10] Importing staff costs...');
	const staffLog = await importEmployees(prisma, budgetVersionId, userId);
	allLogs.push(staffLog);
	printLogSummary(staffLog);

	// Phase 10: Validation
	// eslint-disable-next-line no-console
	console.log('[10/10] Running 6-step validation suite...');
	const { log: validationLog, results } = await runValidationSuite(
		prisma,
		budgetVersionId,
		actualVersionIds
	);
	allLogs.push(validationLog);

	// eslint-disable-next-line no-console
	console.log('\n=== Validation Results ===');
	for (const r of results) {
		// eslint-disable-next-line no-console
		console.log(`  Step ${r.step}: ${r.name} — ${r.status}`);
		if (r.status !== 'PASS') {
			// eslint-disable-next-line no-console
			console.log(`    ${r.details}`);
		}
	}

	// Write audit trail
	// eslint-disable-next-line no-console
	console.log('\nWriting audit trail...');
	for (const log of allLogs) {
		if (log.module === 'validation-suite' || log.module === 'migration-runner') continue;

		const versionId =
			log.module === 'dhg-grille' || log.module === 'master-data'
				? budgetVersionId
				: log.module === 'enrollment-actuals'
					? (actualVersionIds.values().next().value ?? budgetVersionId)
					: budgetVersionId;

		await prisma.actualsImportLog.create({
			data: {
				versionId,
				module: log.module.slice(0, 12),
				sourceFile: log.module,
				validationStatus: log.status === 'SUCCESS' ? 'PASS' : 'FAIL',
				rowsImported: Object.values(log.rowCounts).reduce((a, b) => a + b, 0),
				importedById: userId,
			},
		});
	}

	const totalRows = allLogs.reduce(
		(sum, l) => sum + Object.values(l.rowCounts).reduce((a, b) => a + b, 0),
		0
	);
	const totalWarnings = allLogs.reduce((sum, l) => sum + l.warnings.length, 0);
	const totalErrors = allLogs.reduce((sum, l) => sum + l.errors.length, 0);

	runnerLogger.addRowCount('total', totalRows);
	const runnerLog = runnerLogger.complete(
		results.every((r) => r.status !== 'FAIL') ? 'SUCCESS' : 'FAILED'
	);

	// eslint-disable-next-line no-console
	console.log('\n=== Migration Summary ===');
	// eslint-disable-next-line no-console
	console.log(
		JSON.stringify(
			{
				status: runnerLog.status,
				totalRows,
				totalWarnings,
				totalErrors,
				modules: allLogs.map((l) => ({
					module: l.module,
					status: l.status,
					rows: Object.values(l.rowCounts).reduce((a, b) => a + b, 0),
					warnings: l.warnings.length,
					durationMs: l.durationMs,
				})),
				validation: results.map((r) => ({
					step: r.step,
					name: r.name,
					status: r.status,
				})),
			},
			null,
			2
		)
	);

	if (runnerLog.status === 'FAILED') {
		process.exitCode = 1;
	}
}

function printLogSummary(log: MigrationLog): void {
	const rows = Object.values(log.rowCounts).reduce((a, b) => a + b, 0);
	const warns = log.warnings.length;
	// eslint-disable-next-line no-console
	console.log(
		`  ${log.module}: ${log.status} — ${rows} rows, ${warns} warnings, ${log.durationMs ?? 0}ms`
	);
}

main()
	.catch((e) => {
		// eslint-disable-next-line no-console
		console.error('Fatal migration error:', e);
		process.exitCode = 1;
	})
	.finally(() => {
		prisma.$disconnect();
	});
