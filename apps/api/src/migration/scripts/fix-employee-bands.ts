// Fix Employee Band Mappings — One-shot migration
// Run: pnpm --filter @budfin/api exec tsx src/migration/scripts/fix-employee-bands.ts
//
// Applies the fixture corrections from fy2026-staff-costs.json to DB employees:
// - Moves Arabic teachers from MATERNELLE to ELEMENTAIRE (5)
// - Moves Arabic teachers from COLLEGE to LYCEE (2)
// - Moves Physics teachers from COLLEGE to LYCEE (3)
// - Moves SVT teachers from COLLEGE to LYCEE (3)
// - Moves SES teachers from COLLEGE to LYCEE (2)
// - Fixes isTeaching=false for nurses + librarian (3)
// - Deletes stale AUTO assignments so next Calculate recreates them correctly

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BandChange {
	name: string;
	newBand: string;
}

interface TeachingFix {
	name: string;
	isTeaching: boolean;
}

const BAND_CHANGES: BandChange[] = [
	// Arabic MAT → ELEM
	{ name: 'BADR Chantal', newBand: 'ELEMENTAIRE' },
	{ name: 'HUSSEIN Waad', newBand: 'ELEMENTAIRE' },
	{ name: 'SABRA Dollat', newBand: 'ELEMENTAIRE' },
	{ name: 'SALIBA Fadia', newBand: 'ELEMENTAIRE' },
	{ name: 'ZOUBIANE Sarah', newBand: 'ELEMENTAIRE' },
	// Arabic COL → LYC
	{ name: 'NAGHAM Mariama', newBand: 'LYCEE' },
	{ name: 'YAKHLEF Sabrina', newBand: 'LYCEE' },
	// Physics COL → LYC
	{ name: 'CHAIEB Iheb', newBand: 'LYCEE' },
	{ name: 'MESSAOUDI Amel', newBand: 'LYCEE' },
	{ name: 'TEDJANI Hajar', newBand: 'LYCEE' },
	// SVT COL → LYC
	{ name: 'MASSIN Anais', newBand: 'LYCEE' },
	{ name: 'SAAB Maya', newBand: 'LYCEE' },
	{ name: 'SALHI Faten', newBand: 'LYCEE' },
	// SES COL → LYC
	{ name: 'BEN OTHMAN Noelle', newBand: 'LYCEE' },
	{ name: 'MEKNI Mehdi', newBand: 'LYCEE' },
];

const TEACHING_FIXES: TeachingFix[] = [
	{ name: 'EL BOUFRAHI NAJLAA', isTeaching: false },
	{ name: 'NASSAR Maya', isTeaching: false },
	{ name: 'GRATEAU Michele', isTeaching: false },
];

async function main(): Promise<void> {
	// eslint-disable-next-line no-console
	console.log('=== Fix Employee Band Mappings ===\n');

	// Find the draft version
	const draftVersion = await prisma.budgetVersion.findFirst({
		where: { status: 'Draft' },
		orderBy: { id: 'desc' },
		select: { id: true },
	});

	if (!draftVersion) {
		// eslint-disable-next-line no-console
		console.error('No Draft version found');
		process.exitCode = 1;
		return;
	}

	const versionId = draftVersion.id;
	// eslint-disable-next-line no-console
	console.log(`Version: ${versionId}\n`);

	// Apply band changes
	let bandUpdated = 0;
	for (const change of BAND_CHANGES) {
		const emp = await prisma.employee.findFirst({
			where: { versionId, name: change.name },
			select: { id: true, homeBand: true },
		});

		if (!emp) {
			// eslint-disable-next-line no-console
			console.log(`  NOT FOUND: ${change.name}`);
			continue;
		}

		await prisma.employee.update({
			where: { id: emp.id },
			data: { homeBand: change.newBand },
		});

		// eslint-disable-next-line no-console
		console.log(`  BAND: ${change.name} ${emp.homeBand} → ${change.newBand}`);
		bandUpdated++;
	}

	// Apply isTeaching fixes
	let teachingFixed = 0;
	for (const fix of TEACHING_FIXES) {
		const emp = await prisma.employee.findFirst({
			where: { versionId, name: fix.name },
			select: { id: true, isTeaching: true },
		});

		if (!emp) {
			// eslint-disable-next-line no-console
			console.log(`  NOT FOUND: ${fix.name}`);
			continue;
		}

		await prisma.employee.update({
			where: { id: emp.id },
			data: { isTeaching: fix.isTeaching },
		});

		// eslint-disable-next-line no-console
		console.log(`  TEACHING: ${fix.name} → ${fix.isTeaching}`);
		teachingFixed++;
	}

	// Delete ALL auto-generated assignments so Calculate recreates them with correct bands
	const deleted = await prisma.staffingAssignment.deleteMany({
		where: { versionId, source: 'AUTO' },
	});

	// eslint-disable-next-line no-console
	console.log(`\n  Deleted ${deleted.count} AUTO assignments (will be recreated on Calculate)`);

	// Mark STAFFING as stale
	const version = await prisma.budgetVersion.findUniqueOrThrow({
		where: { id: versionId },
		select: { staleModules: true },
	});
	const staleSet = new Set(version.staleModules);
	staleSet.add('STAFFING');
	await prisma.budgetVersion.update({
		where: { id: versionId },
		data: { staleModules: Array.from(staleSet) },
	});

	// eslint-disable-next-line no-console
	console.log(`\n=== Done: ${bandUpdated} band changes, ${teachingFixed} teaching fixes ===`);
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
