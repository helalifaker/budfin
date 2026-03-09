import type { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import type {
	MigrationLog,
	DhgStructureFixture,
	DhgMaternelleEntry,
	DhgCollegeEntry,
	DhgLyceeEntry,
} from '../lib/types.js';
import { MigrationLogger } from '../lib/logger.js';
import { loadFixture } from '../lib/fixture-loader.js';

// ── Subjects to filter out (summary rows, not curriculum) ───────────────────

const EXCLUDED_SUBJECTS = new Set(['Total Student Hours / Week', 'Récréations']);

// ── Grade keys for each section ─────────────────────────────────────────────

const MATERNELLE_GRADES = ['PS', 'MS', 'GS'] as const;
const ELEMENTAIRE_GRADES = ['CP', 'CE1', 'CE2', 'CM1', 'CM2'] as const;

// ── Flattening helpers ──────────────────────────────────────────────────────

interface FlatRow {
	gradeLevel: string;
	subject: string;
	hoursPerWeekPerSection: Decimal;
}

function flattenMatElem(entries: DhgMaternelleEntry[], grades: readonly string[]): FlatRow[] {
	const rows: FlatRow[] = [];
	for (const entry of entries) {
		if (EXCLUDED_SUBJECTS.has(entry.subject)) continue;
		for (const grade of grades) {
			const hours = entry.hoursPerWeek[grade];
			if (hours === undefined || hours === null) continue;
			rows.push({
				gradeLevel: grade,
				subject: entry.subject,
				hoursPerWeekPerSection: new Decimal(hours),
			});
		}
	}
	return rows;
}

function flattenCollege(entries: DhgCollegeEntry[]): FlatRow[] {
	const rows: FlatRow[] = [];
	for (const entry of entries) {
		if (EXCLUDED_SUBJECTS.has(entry.discipline)) continue;
		rows.push({
			gradeLevel: entry.level,
			subject: entry.discipline,
			hoursPerWeekPerSection: new Decimal(entry.hoursPerWeekPerStudent),
		});
	}
	return rows;
}

function flattenLycee(entries: DhgLyceeEntry[]): FlatRow[] {
	const rows: FlatRow[] = [];
	for (const entry of entries) {
		if (EXCLUDED_SUBJECTS.has(entry.discipline)) continue;
		rows.push({
			gradeLevel: entry.level,
			subject: entry.discipline,
			hoursPerWeekPerSection: new Decimal(entry.hoursPerWeekPerStudent),
		});
	}
	return rows;
}

// ── Main export ─────────────────────────────────────────────────────────────

export async function importDhgGrille(
	prisma: PrismaClient,
	_userId: number
): Promise<MigrationLog> {
	const logger = new MigrationLogger('dhg-grille');

	try {
		const fixture = loadFixture<DhgStructureFixture>('fy2026-dhg-structure.json');

		// Flatten all 4 nesting patterns into a single array
		const allRows: FlatRow[] = [
			...flattenMatElem(fixture.maternelleHours, MATERNELLE_GRADES),
			...flattenMatElem(fixture.elementaireHours, ELEMENTAIRE_GRADES),
			...flattenCollege(fixture.collegeDHG),
			...flattenLycee(fixture.lyceeDHG.seconde),
			...flattenLycee(fixture.lyceeDHG.premiere),
			...flattenLycee(fixture.lyceeDHG.terminale),
		];

		const effectiveFromYear = 2026;
		let count = 0;

		for (const row of allRows) {
			await prisma.dhgGrilleConfig.upsert({
				where: {
					gradeLevel_subject_effectiveFromYear: {
						gradeLevel: row.gradeLevel,
						subject: row.subject,
						effectiveFromYear,
					},
				},
				update: {
					hoursPerWeekPerSection: row.hoursPerWeekPerSection.toNumber(),
					dhgType: 'Structural',
				},
				create: {
					gradeLevel: row.gradeLevel,
					subject: row.subject,
					dhgType: 'Structural',
					hoursPerWeekPerSection: row.hoursPerWeekPerSection.toNumber(),
					effectiveFromYear,
				},
			});
			count++;
		}

		logger.addRowCount('dhg_grille_config', count);
		return logger.complete('SUCCESS');
	} catch (err) {
		logger.error({
			code: 'DHG_GRILLE_FAILED',
			message: err instanceof Error ? err.message : String(err),
			fatal: true,
		});
		return logger.complete('FAILED');
	}
}
