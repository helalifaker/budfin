// Import Final QA Staff — One-shot migration to import 192 employees from fy2026-staff-costs.json
// Run: pnpm --filter @budfin/api exec tsx src/migration/scripts/import-final-qa-staff.ts
//
// Steps:
// 1. Re-seed discipline master data (picks up FLE discipline + new aliases)
// 2. Clear existing staffing assignments, calculation results, and employees for the target version
// 3. Import 192 employees via importEmployees()
// 4. Resolve disciplineId, serviceProfileId, homeBand, costMode for each employee
// 5. Mark STAFFING as stale on the target version

import { PrismaClient } from '@prisma/client';
import { importEmployees } from '../importers/employees.js';
import { ensureMigrationUser } from '../lib/migration-user.js';
import { loadFixture } from '../lib/fixture-loader.js';
import type { StaffCostsFixture } from '../lib/types.js';

const prisma = new PrismaClient();

// ── Subject → Discipline resolution helpers ─────────────────────────────────

/**
 * Strip coordinator suffixes like "(coordinatrice)", "(coordinateur)" from a subject string.
 * Also handles compound forms like "Sciences eco. (SES) (coordinateur)" by removing only
 * the coordinator parenthetical.
 */
function stripCoordinatorSuffix(subject: string): string {
	return subject.replace(/\s*\(coordinat(?:eur|rice)\)\s*$/, '').trim();
}

/**
 * Normalize subject strings into lookup keys that can match discipline aliases.
 * Handles compound subjects like "Technologie / SNT" → tries "Technologie" first,
 * "Sciences economiques (SES)" → tries "Sciences economiques", etc.
 */
function getSubjectLookupCandidates(subject: string): string[] {
	const stripped = stripCoordinatorSuffix(subject);
	const candidates: string[] = [stripped];

	// "Documentation / CDI" → try "Documentation" and "CDI"
	if (stripped.includes('/')) {
		const parts = stripped.split('/').map((p) => p.trim());
		candidates.push(...parts);
	}

	// "Sciences economiques (SES)" → try "Sciences economiques"
	const parenMatch = stripped.match(/^(.+?)\s*\([^)]+\)\s*$/);
	if (parenMatch?.[1]) {
		candidates.push(parenMatch[1].trim());
	}

	// "Histoire-Géographie / Bibliothèque" → try base without accents won't help,
	// but "Histoire-Geographie" is an alias. Add a dash-normalized version.
	// Also add the subject itself (before stripping) for direct alias matches.
	return candidates;
}

// ── Service profile resolution ──────────────────────────────────────────────

/**
 * Resolve service profile code from subject, functionRole, isTeaching, and level.
 * Uses the new subject-based logic from the task spec rather than the old
 * department-based heuristics.
 *
 * Priority:
 * 1. Subject contains "ASEM" → ASEM
 * 2. Subject contains "Arabe" or "Islamique" → ARABIC_ISLAMIC
 * 3. Subject = "EPS" → EPS
 * 4. Subject contains "Documentation" or "CDI" → DOCUMENTALISTE
 * 5. functionRole contains "Agrege"/"Agrégé" → AGREGE
 * 6. isTeaching AND level is Maternelle/Élémentaire/Primaire → PE
 * 7. isTeaching (secondary) → CERTIFIE
 * 8. Non-teaching → null
 */
function resolveServiceProfileCodeFromSubject(
	subject: string,
	functionRole: string,
	isTeaching: boolean,
	level: string
): string | null {
	const subjectLower = subject.toLowerCase();
	const roleLower = functionRole.toLowerCase();
	const levelLower = level.toLowerCase();

	// 1. ASEM
	if (subjectLower.includes('asem')) {
		return 'ASEM';
	}

	// 2. Arabe / Islamique
	if (subjectLower.includes('arabe') || subjectLower.includes('islamique')) {
		return 'ARABIC_ISLAMIC';
	}

	// 3. EPS
	if (subjectLower === 'eps') {
		return 'EPS';
	}

	// 4. Documentation / CDI
	if (subjectLower.includes('documentation') || subjectLower.includes('cdi')) {
		return 'DOCUMENTALISTE';
	}

	// 5. Agrege / Agrégé
	if (roleLower.includes('agrege') || roleLower.includes('agrégé')) {
		return 'AGREGE';
	}

	// 6. Teaching + primary level → PE
	if (
		isTeaching &&
		(levelLower === 'maternelle' ||
			levelLower === 'elementaire' ||
			levelLower === 'élémentaire' ||
			levelLower === 'primaire')
	) {
		return 'PE';
	}

	// 7. Teaching (secondary) → CERTIFIE
	if (isTeaching) {
		return 'CERTIFIE';
	}

	// 8. Non-teaching
	return null;
}

// ── Discipline resolution ───────────────────────────────────────────────────

/**
 * Resolve disciplineId for an employee from their subject string.
 * Uses DisciplineAlias table for case-insensitive matching, with fallback
 * to stripping coordinator suffixes and trying component parts.
 */
function resolveDisciplineId(
	subject: string,
	aliasMap: Map<string, number>,
	nameMap: Map<string, number>
): number | null {
	const candidates = getSubjectLookupCandidates(subject);

	for (const candidate of candidates) {
		const lower = candidate.toLowerCase();

		// Try alias table first
		const aliasMatch = aliasMap.get(lower);
		if (aliasMatch !== undefined) {
			return aliasMatch;
		}

		// Fall back to direct discipline name match
		const nameMatch = nameMap.get(lower);
		if (nameMatch !== undefined) {
			return nameMatch;
		}
	}

	return null;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	console.log('=== Import Final QA Staff ===\n');

	// Step 0: Find the first Draft version

	console.log('[0/5] Finding Draft version...');
	const draftVersion = await prisma.budgetVersion.findFirst({
		where: { status: 'Draft' },
		orderBy: { id: 'desc' },
		select: { id: true, name: true, fiscalYear: true },
	});

	if (!draftVersion) {
		console.error('ERROR: No Draft version found in budget_versions. Aborting.');
		process.exitCode = 1;
		return;
	}

	const versionId = draftVersion.id;

	console.log(
		`  Found version: id=${versionId}, name="${draftVersion.name}", fy=${draftVersion.fiscalYear}`
	);

	// Step 0b: Ensure migration user
	const userId = await ensureMigrationUser(prisma);

	console.log(`  Migration user ID: ${userId}`);

	// Step 1: Re-seed discipline master data
	// Seed file is outside src/ (prisma/seeds/), so we use a wrapper script

	console.log('\n[1/5] Re-seeding discipline master data...');
	const { execSync } = await import('node:child_process');
	const { dirname, resolve } = await import('node:path');
	const { fileURLToPath } = await import('node:url');
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const apiRoot = resolve(__dirname, '..', '..', '..');
	execSync('tsx prisma/seeds/run-staffing-seed.ts', {
		cwd: apiRoot,
		stdio: 'inherit',
	});

	console.log('  Done.');

	// Step 2: Clear existing staffing data for this version

	console.log('\n[2/5] Clearing existing staffing data for version...');

	const deletedAssignments = await prisma.staffingAssignment.deleteMany({
		where: { versionId },
	});

	console.log(`  Deleted ${deletedAssignments.count} staffing assignments`);

	const deletedMonthlyCosts = await prisma.monthlyStaffCost.deleteMany({
		where: { versionId },
	});

	console.log(`  Deleted ${deletedMonthlyCosts.count} monthly staff costs`);

	const deletedReqSources = await prisma.teachingRequirementSource.deleteMany({
		where: { versionId },
	});

	console.log(`  Deleted ${deletedReqSources.count} teaching requirement sources`);

	const deletedReqLines = await prisma.teachingRequirementLine.deleteMany({
		where: { versionId },
	});

	console.log(`  Deleted ${deletedReqLines.count} teaching requirement lines`);

	const deletedCategoryCosts = await prisma.categoryMonthlyCost.deleteMany({
		where: { versionId },
	});

	console.log(`  Deleted ${deletedCategoryCosts.count} category monthly costs`);

	const deletedEmployees = await prisma.employee.deleteMany({
		where: { versionId },
	});

	console.log(`  Deleted ${deletedEmployees.count} existing employees`);

	// Step 3: Import employees from fixture

	console.log('\n[3/5] Importing employees from fy2026-staff-costs.json...');
	const importLog = await importEmployees(prisma, versionId, userId);

	if (importLog.status === 'FAILED') {
		console.error('  Employee import FAILED:');
		for (const err of importLog.errors) {
			console.error(`    ${err.code}: ${err.message}`);
		}
		process.exitCode = 1;
		return;
	}

	const importedCount = Object.values(importLog.rowCounts).reduce(
		(a: number, b: number) => a + b,
		0
	);

	console.log(`  Imported ${importedCount} employees (${importLog.warnings.length} warnings)`);

	if (importLog.warnings.length > 0) {
		for (const w of importLog.warnings) {
			console.log(`    WARN: ${w.code} — ${w.message}`);
		}
	}

	// Step 4: Resolve employee fields (disciplineId, serviceProfileId, homeBand, costMode)

	console.log('\n[4/5] Resolving employee fields (discipline, profile, band, costMode)...');

	// Load lookup tables
	const disciplineAliases = await prisma.disciplineAlias.findMany({
		select: { alias: true, disciplineId: true },
	});
	const aliasMap = new Map<string, number>();
	for (const da of disciplineAliases) {
		aliasMap.set(da.alias.toLowerCase(), da.disciplineId);
	}

	const allDisciplines = await prisma.discipline.findMany({
		select: { id: true, name: true, code: true },
	});
	const nameMap = new Map<string, number>();
	for (const d of allDisciplines) {
		nameMap.set(d.name.toLowerCase(), d.id);
		// Also index by code (lowercase) for direct code matches
		nameMap.set(d.code.toLowerCase(), d.id);
	}

	const serviceProfiles = await prisma.serviceObligationProfile.findMany({
		select: { id: true, code: true },
	});
	const profileCodeToId = new Map<string, number>();
	for (const sp of serviceProfiles) {
		profileCodeToId.set(sp.code, sp.id);
	}

	// Load fixture to get the per-employee subject, level, homeBand, costMode
	const fixtureData = loadFixture<StaffCostsFixture[]>('fy2026-staff-costs.json');
	const fixtureByCode = new Map<string, StaffCostsFixture>();
	for (const rec of fixtureData) {
		fixtureByCode.set(rec.employeeCode, rec);
	}

	// Load all employees for this version
	const employees = await prisma.employee.findMany({
		where: { versionId },
		select: {
			id: true,
			employeeCode: true,
			name: true,
			functionRole: true,
			isTeaching: true,
		},
	});

	let disciplinesResolved = 0;
	let profilesAssigned = 0;
	let bandsResolved = 0;
	let costModesSet = 0;
	const exceptions: Array<{ code: string; name: string; field: string; reason: string }> = [];

	for (const emp of employees) {
		const fixture = fixtureByCode.get(emp.employeeCode);
		if (!fixture) {
			exceptions.push({
				code: emp.employeeCode,
				name: emp.name,
				field: 'fixture',
				reason: 'Employee not found in fixture data',
			});
			continue;
		}

		const updateData: Record<string, unknown> = {};

		// costMode — always set from fixture
		updateData.costMode = fixture.costMode;
		costModesSet++;

		// homeBand — from fixture (already resolved in parsing step)
		if (fixture.homeBand) {
			updateData.homeBand = fixture.homeBand;
			bandsResolved++;
		}

		// disciplineId — resolve from subject via alias/name lookup
		const disciplineId = resolveDisciplineId(fixture.subject, aliasMap, nameMap);
		if (disciplineId !== null) {
			updateData.disciplineId = disciplineId;
			disciplinesResolved++;
		} else if (emp.isTeaching) {
			exceptions.push({
				code: emp.employeeCode,
				name: emp.name,
				field: 'disciplineId',
				reason: `No discipline match for subject "${fixture.subject}"`,
			});
		}

		// serviceProfileId — resolve from subject/role/level
		const profileCode = resolveServiceProfileCodeFromSubject(
			fixture.subject,
			emp.functionRole,
			emp.isTeaching,
			fixture.level
		);
		if (profileCode) {
			const profileId = profileCodeToId.get(profileCode);
			if (profileId) {
				updateData.serviceProfileId = profileId;
				profilesAssigned++;
			} else {
				exceptions.push({
					code: emp.employeeCode,
					name: emp.name,
					field: 'serviceProfileId',
					reason: `Profile code "${profileCode}" not found in service_obligation_profiles`,
				});
			}
		}

		// Apply update
		await prisma.employee.update({
			where: { id: emp.id },
			data: updateData,
		});
	}

	console.log(`  Employees processed: ${employees.length}`);

	console.log(`  Disciplines resolved: ${disciplinesResolved}`);

	console.log(`  Service profiles assigned: ${profilesAssigned}`);

	console.log(`  Home bands set: ${bandsResolved}`);

	console.log(`  Cost modes set: ${costModesSet}`);

	if (exceptions.length > 0) {
		console.log(`\n  Exceptions (${exceptions.length}):`);
		for (const exc of exceptions) {
			console.log(`    [${exc.code}] ${exc.name}: ${exc.field} — ${exc.reason}`);
		}
	}

	// Step 5: Mark STAFFING as stale

	console.log('\n[5/5] Marking STAFFING as stale...');

	const version = await prisma.budgetVersion.findUniqueOrThrow({
		where: { id: versionId },
		select: { staleModules: true },
	});

	const staleSet = new Set(version.staleModules);
	staleSet.add('STAFFING');
	staleSet.add('PNL');

	await prisma.budgetVersion.update({
		where: { id: versionId },
		data: { staleModules: Array.from(staleSet) },
	});

	console.log(`  staleModules = [${Array.from(staleSet).join(', ')}]`);

	// Final summary

	console.log('\n=== Migration Complete ===');

	console.log(
		JSON.stringify(
			{
				versionId,
				versionName: draftVersion.name,
				employeesImported: importedCount,
				disciplinesResolved,
				profilesAssigned,
				bandsResolved,
				costModesSet,
				exceptions: exceptions.length,
			},
			null,
			2
		)
	);
}

main()
	.catch((e) => {
		console.error('Fatal error:', e);
		process.exitCode = 1;
	})
	.finally(() => {
		prisma.$disconnect();
	});
