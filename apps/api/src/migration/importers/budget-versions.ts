import type { PrismaClient } from '@prisma/client';
import type { MigrationLog } from '../lib/types.js';
import { MigrationLogger } from '../lib/logger.js';

// ── Version definitions ─────────────────────────────────────────────────────

interface VersionDef {
	name: string;
	fiscalYear: number;
	type: string;
	status: string;
	dataSource: string;
}

const BUDGET_VERSION: VersionDef = {
	name: 'Migration FY2026',
	fiscalYear: 2026,
	type: 'Budget',
	status: 'Draft',
	dataSource: 'MANUAL',
};

const ACTUAL_VERSIONS: VersionDef[] = [
	{
		name: 'Actual FY2022',
		fiscalYear: 2022,
		type: 'Actual',
		status: 'Locked',
		dataSource: 'IMPORTED',
	},
	{
		name: 'Actual FY2023',
		fiscalYear: 2023,
		type: 'Actual',
		status: 'Locked',
		dataSource: 'IMPORTED',
	},
	{
		name: 'Actual FY2024',
		fiscalYear: 2024,
		type: 'Actual',
		status: 'Locked',
		dataSource: 'IMPORTED',
	},
	{
		name: 'Actual FY2025',
		fiscalYear: 2025,
		type: 'Actual',
		status: 'Locked',
		dataSource: 'IMPORTED',
	},
	{
		name: 'Actual FY2026',
		fiscalYear: 2026,
		type: 'Actual',
		status: 'Locked',
		dataSource: 'IMPORTED',
	},
];

const ALL_VERSIONS = [BUDGET_VERSION, ...ACTUAL_VERSIONS];

// ── Main export ─────────────────────────────────────────────────────────────

export async function createBudgetVersions(
	prisma: PrismaClient,
	userId: number
): Promise<{ log: MigrationLog; versions: Map<string, number> }> {
	const logger = new MigrationLogger('budget-versions');
	const versions = new Map<string, number>();

	try {
		// Delete-and-recreate in a transaction for atomicity.
		// WARNING: Cascade-deletes all child data under these versions.
		// This is intentional for a one-time migration — not safe for production data.
		await prisma.$transaction(async (tx) => {
			for (const def of ALL_VERSIONS) {
				const existing = await tx.budgetVersion.findFirst({
					where: { name: def.name, fiscalYear: def.fiscalYear },
					select: { id: true },
				});
				if (existing) {
					logger.warn({
						code: 'VERSION_EXISTS',
						message: `Deleting existing version: "${def.name}" (id=${existing.id})`,
					});
					await tx.budgetVersion.delete({ where: { id: existing.id } });
				}
			}

			for (const def of ALL_VERSIONS) {
				const lockedAt = def.status === 'Locked' ? new Date() : null;

				const version = await tx.budgetVersion.create({
					data: {
						fiscalYear: def.fiscalYear,
						name: def.name,
						type: def.type,
						status: def.status,
						dataSource: def.dataSource,
						createdById: userId,
						modificationCount: 0,
						staleModules: [],
						lockedAt,
					},
				});

				versions.set(def.name, version.id);
			}
		});

		logger.addRowCount('budget_versions', ALL_VERSIONS.length);
		return { log: logger.complete('SUCCESS'), versions };
	} catch (err) {
		logger.error({
			code: 'BUDGET_VERSIONS_FAILED',
			message: err instanceof Error ? err.message : String(err),
			fatal: true,
		});
		return { log: logger.complete('FAILED'), versions };
	}
}
