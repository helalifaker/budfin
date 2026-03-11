import { PrismaClient } from '@prisma/client';
import {
	getActualVersionName,
	HISTORICAL_ENROLLMENT_FISCAL_YEARS,
} from '../lib/enrollment-history.js';
import { ensureMigrationUser } from './lib/migration-user.js';
import { importEnrollmentActuals } from './importers/enrollment-actuals.js';

const prisma = new PrismaClient();

async function ensureHistoricalVersions(userId: number) {
	const versions = new Map<string, number>();

	for (const fiscalYear of HISTORICAL_ENROLLMENT_FISCAL_YEARS) {
		const versionName = getActualVersionName(fiscalYear);
		const existing = await prisma.budgetVersion.findFirst({
			where: {
				fiscalYear,
				name: versionName,
			},
			select: { id: true },
		});

		if (existing) {
			versions.set(versionName, existing.id);
			continue;
		}

		const created = await prisma.budgetVersion.create({
			data: {
				fiscalYear,
				name: versionName,
				type: 'Actual',
				status: 'Locked',
				dataSource: 'IMPORTED',
				createdById: userId,
				modificationCount: 0,
				staleModules: [],
				lockedAt: new Date(),
			},
			select: { id: true },
		});

		versions.set(versionName, created.id);
	}

	return versions;
}

async function main() {
	const userId = await ensureMigrationUser(prisma);
	const versions = await ensureHistoricalVersions(userId);
	const log = await importEnrollmentActuals(prisma, versions, userId);

	// eslint-disable-next-line no-console
	console.log(
		JSON.stringify(
			{
				status: log.status,
				rowCounts: log.rowCounts,
				warnings: log.warnings,
				errors: log.errors,
			},
			null,
			2
		)
	);
}

main()
	.catch((error) => {
		// eslint-disable-next-line no-console
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
