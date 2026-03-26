// Fix Saudi Flags — One-shot migration to set isSaudi=true for EFIR-011 and EFIR-013
// Run: pnpm --filter @budfin/api exec tsx src/migration/scripts/fix-saudi-flags.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAUDI_EMPLOYEE_CODES = ['EFIR-011', 'EFIR-013'];
const TARGET_VERSION_ID = 1;

async function main() {
	console.log('Fixing Saudi flags for:', SAUDI_EMPLOYEE_CODES.join(', '));

	const result = await prisma.$transaction(async (tx) => {
		const updated = await tx.employee.updateMany({
			where: {
				versionId: TARGET_VERSION_ID,
				employeeCode: { in: SAUDI_EMPLOYEE_CODES },
			},
			data: { isSaudi: true },
		});

		// Mark STAFFING as stale so costs are recalculated
		const version = await tx.budgetVersion.findUniqueOrThrow({
			where: { id: TARGET_VERSION_ID },
			select: { staleModules: true },
		});

		const staleSet = new Set(version.staleModules);
		staleSet.add('STAFFING');
		staleSet.add('PNL');

		await tx.budgetVersion.update({
			where: { id: TARGET_VERSION_ID },
			data: { staleModules: Array.from(staleSet) },
		});

		return updated.count;
	});

	console.log(`Updated ${result} employee(s). STAFFING + PNL marked stale.`);
}

main()
	.catch((e) => {
		console.error('Fatal error:', e);
		process.exitCode = 1;
	})
	.finally(() => {
		prisma.$disconnect();
	});
