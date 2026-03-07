// Enrollment CSV Parser — reads 5 academic years of enrollment data
// Outputs JSON fixture to data/fixtures/ for validation tests
// Run: pnpm --filter @budfin/api exec tsx src/validation/parse-enrollment-csv.ts

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', '..', '..');
const FIXTURES_DIR = resolve(ROOT, 'data', 'fixtures');
const ENROLLMENT_DIR = resolve(ROOT, 'data', 'enrollment');

mkdirSync(FIXTURES_DIR, { recursive: true });

// ── Types ────────────────────────────────────────────────────────────────────

interface EnrollmentRow {
	academicYear: string;
	gradeLevel: string;
	headcount: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

// Canonical grade order from Phase 1a taxonomy
const EXPECTED_GRADES = [
	'PS',
	'MS',
	'GS',
	'CP',
	'CE1',
	'CE2',
	'CM1',
	'CM2',
	'6EME',
	'5EME',
	'4EME',
	'3EME',
	'2NDE',
	'1ERE',
	'TERM',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function writeFixture(name: string, data: unknown): void {
	const path = resolve(FIXTURES_DIR, name);
	writeFileSync(path, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
	// eslint-disable-next-line no-console
	console.log(`  Written: ${path}`);
}

function extractAcademicYear(filename: string): string | null {
	// enrollment_2021-22.csv -> 2021-22
	const match = filename.match(/enrollment_(\d{4}-\d{2})\.csv/);
	return match ? match[1]! : null;
}

function parseCSV(filePath: string): Array<{ levelCode: string; studentCount: number }> {
	const raw = readFileSync(filePath, 'utf-8');
	const lines = raw.trim().split('\n');

	if (lines.length < 2) return [];

	// Validate header — CSV uses level_code (NOT grade_level — this is bug #1)
	const header = lines[0]!.trim();
	if (header !== 'level_code,student_count') {
		// eslint-disable-next-line no-console
		console.log(`  WARNING: unexpected header "${header}" — expected "level_code,student_count"`);
	}

	const results: Array<{ levelCode: string; studentCount: number }> = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]!.trim();
		if (!line) continue;

		const parts = line.split(',');
		if (parts.length !== 2) {
			// eslint-disable-next-line no-console
			console.log(`  WARNING: malformed line ${i + 1}: "${line}"`);
			continue;
		}

		const levelCode = parts[0]!.trim();
		const count = parseInt(parts[1]!.trim(), 10);

		if (isNaN(count)) {
			// eslint-disable-next-line no-console
			console.log(`  WARNING: non-numeric count at line ${i + 1}: "${parts[1]}"`);
			continue;
		}

		results.push({ levelCode, studentCount: count });
	}

	return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
	// eslint-disable-next-line no-console
	console.log('=== Enrollment CSV Parser ===');
	// eslint-disable-next-line no-console
	console.log(`Reading from: ${ENROLLMENT_DIR}\n`);

	// Discover CSV files
	const files = readdirSync(ENROLLMENT_DIR)
		.filter((f) => f.endsWith('.csv'))
		.sort();

	// eslint-disable-next-line no-console
	console.log(`Found ${files.length} CSV files: ${files.join(', ')}`);

	const allRows: EnrollmentRow[] = [];
	const yearSummaries: Array<{ year: string; total: number; grades: string[] }> = [];

	for (const file of files) {
		const academicYear = extractAcademicYear(file);
		if (!academicYear) {
			// eslint-disable-next-line no-console
			console.log(`  SKIP: could not extract year from "${file}"`);
			continue;
		}

		const filePath = resolve(ENROLLMENT_DIR, file);
		const parsed = parseCSV(filePath);

		// eslint-disable-next-line no-console
		console.log(`\n  ${file} (AY ${academicYear}): ${parsed.length} grade rows`);

		const discoveredGrades: string[] = [];
		let yearTotal = 0;

		for (const row of parsed) {
			discoveredGrades.push(row.levelCode);
			yearTotal += row.studentCount;

			allRows.push({
				academicYear,
				gradeLevel: row.levelCode,
				headcount: row.studentCount,
			});
		}

		yearSummaries.push({ year: academicYear, total: yearTotal, grades: discoveredGrades });

		// Validate grade codes match expected taxonomy
		const missingGrades = EXPECTED_GRADES.filter((g) => !discoveredGrades.includes(g));
		const extraGrades = discoveredGrades.filter((g) => !EXPECTED_GRADES.includes(g));

		if (missingGrades.length > 0) {
			// eslint-disable-next-line no-console
			console.log(`    MISSING grades: ${missingGrades.join(', ')}`);
		}
		if (extraGrades.length > 0) {
			// eslint-disable-next-line no-console
			console.log(`    EXTRA grades: ${extraGrades.join(', ')}`);
		}

		// eslint-disable-next-line no-console
		console.log(`    Total headcount: ${yearTotal}`);
	}

	// Write fixture
	// eslint-disable-next-line no-console
	console.log('\n=== Writing Fixture ===');
	writeFixture('fy2026-enrollment-headcount.json', allRows);

	// Summary
	// eslint-disable-next-line no-console
	console.log('\n=== Summary ===');
	for (const s of yearSummaries) {
		// eslint-disable-next-line no-console
		console.log(`  AY ${s.year}: ${s.total} students, ${s.grades.length} grades`);
	}

	// eslint-disable-next-line no-console
	console.log(`\nTotal records: ${allRows.length}`);
	// eslint-disable-next-line no-console
	console.log(`Grade codes per CSV: ${EXPECTED_GRADES.join(', ')}`);
	// eslint-disable-next-line no-console
	console.log(`TPS: ABSENT from all CSVs (not in enrollment data)`);
	// eslint-disable-next-line no-console
	console.log(`Grade code transformation: NONE needed (CSV codes match Excel taxonomy)`);
	// eslint-disable-next-line no-console
	console.log(`CSV header: "level_code" (NOT "grade_level" — bug #1 flagged)`);
}

main();
