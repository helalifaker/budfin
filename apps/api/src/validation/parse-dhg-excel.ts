// DHG Structure Parser — extracts sheet structure from DHG Excel
// Outputs JSON fixture to data/fixtures/ for validation tests
// Run: pnpm --filter @budfin/api exec tsx src/validation/parse-dhg-excel.ts

import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', '..', '..');
const FIXTURES_DIR = resolve(ROOT, 'data', 'fixtures');
const EXCEL_PATH = resolve(ROOT, 'data', 'budgets', '02_EFIR_DHG_FY2026_v1.xlsx');

mkdirSync(FIXTURES_DIR, { recursive: true });

// ── Types ────────────────────────────────────────────────────────────────────

interface SheetSummary {
	name: string;
	rowCount: number;
	columnCount: number;
	headers: string[];
}

interface ParameterEntry {
	category: string;
	label: string;
	value: string | number;
	notes: string;
}

interface EnrollmentEntry {
	grade: string;
	band: string;
	enrollment: number;
	maxClassSize: number;
	sectionsNeeded: number;
	utilizationPct: number;
	alert: string;
}

interface SubjectHoursEntry {
	subject: string;
	hoursPerWeek: Record<string, number>;
}

interface DHGEntry {
	level: string;
	discipline: string;
	hoursPerWeekPerStudent: number;
	totalHoursPerWeek: number;
	sections: number;
}

interface StaffingSummary {
	level: string;
	sections: number;
	frenchTeachers: number;
	asemAssistants: number;
	arabicHours: number;
	islamicHours: number;
}

interface DHGStructure {
	sheets: SheetSummary[];
	parameters: {
		schoolInfo: ParameterEntry[];
		classSizeParams: ParameterEntry[];
		teacherServiceObligations: ParameterEntry[];
		hsaOptimization: ParameterEntry[];
	};
	enrollment: {
		grades: EnrollmentEntry[];
		totalStudents: number;
		totalSections: number;
	};
	maternelleHours: SubjectHoursEntry[];
	elementaireHours: SubjectHoursEntry[];
	collegeDHG: DHGEntry[];
	lyceeDHG: {
		seconde: DHGEntry[];
		premiere: DHGEntry[];
		terminale: DHGEntry[];
	};
	staffingSummary: StaffingSummary[];
	subjectList: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellVal(cell: ExcelJS.Cell): string {
	if (cell.value === null || cell.value === undefined) return '';
	if (typeof cell.value === 'object' && 'result' in cell.value) {
		return String(cell.value.result ?? '');
	}
	return String(cell.value);
}

function cellNum(cell: ExcelJS.Cell): number {
	const raw = cell.value;
	if (raw === null || raw === undefined) return 0;
	if (typeof raw === 'number') return raw;
	if (typeof raw === 'object' && 'result' in raw) {
		const r = raw.result;
		if (typeof r === 'number') return r;
		if (typeof r === 'string') {
			const n = parseFloat(r);
			return isNaN(n) ? 0 : n;
		}
		return 0;
	}
	const n = parseFloat(String(raw));
	return isNaN(n) ? 0 : n;
}

function writeFixture(name: string, data: unknown): void {
	const path = resolve(FIXTURES_DIR, name);
	writeFileSync(path, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
	// eslint-disable-next-line no-console
	console.log(`  Written: ${path}`);
}

function getHeaders(sheet: ExcelJS.Worksheet, row: number): string[] {
	const headers: string[] = [];
	const r = sheet.getRow(row);
	for (let c = 1; c <= sheet.columnCount; c++) {
		const val = cellVal(r.getCell(c)).trim();
		if (val) headers.push(val);
	}
	return headers;
}

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseParameters(sheet: ExcelJS.Worksheet): DHGStructure['parameters'] {
	const schoolInfo: ParameterEntry[] = [];
	const classSizeParams: ParameterEntry[] = [];
	const teacherServiceObligations: ParameterEntry[] = [];
	const hsaOptimization: ParameterEntry[] = [];

	let currentSection = '';

	for (let r = 1; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const c1 = cellVal(row.getCell(1)).trim();
		const c2 = cellVal(row.getCell(2)).trim();
		const c3 = cellVal(row.getCell(3)).trim();
		const c4 = cellVal(row.getCell(4)).trim();

		// Detect section headers
		if (c1 === 'School Information') {
			currentSection = 'school';
			continue;
		}
		if (c1 === 'Class Size Parameters') {
			currentSection = 'classSize';
			continue;
		}
		if (c1.includes('Teacher Service Obligations')) {
			currentSection = 'service';
			continue;
		}
		if (c1.includes('HSA Optimization')) {
			currentSection = 'hsa';
			continue;
		}

		// Skip sub-headers
		if (c1 === 'Level' || c1 === 'Staff Category' || c1 === 'Parameter') continue;
		if (!c1 || c1.startsWith('EFIR')) continue;
		if (c1 === 'Legal Basis' || c1 === 'AEFE Network Average') continue;

		const entry: ParameterEntry = {
			category: currentSection,
			label: c1,
			value: c2 || 0,
			notes: c3 || c4 || '',
		};

		// Try to parse numeric values
		const numVal = parseFloat(c2);
		if (!isNaN(numVal) && c2 !== '') {
			entry.value = numVal;
		}

		switch (currentSection) {
			case 'school':
				schoolInfo.push(entry);
				break;
			case 'classSize':
				classSizeParams.push(entry);
				break;
			case 'service':
				teacherServiceObligations.push(entry);
				break;
			case 'hsa':
				hsaOptimization.push(entry);
				break;
		}
	}

	return { schoolInfo, classSizeParams, teacherServiceObligations, hsaOptimization };
}

function parseEnrollment(sheet: ExcelJS.Worksheet): DHGStructure['enrollment'] {
	const grades: EnrollmentEntry[] = [];
	let totalStudents = 0;
	let totalSections = 0;

	// Data starts at row 4, header at row 3
	for (let r = 4; r <= 18; r++) {
		const row = sheet.getRow(r);
		const grade = cellVal(row.getCell(1)).trim();
		const band = cellVal(row.getCell(2)).trim();
		const enrollment = cellNum(row.getCell(3));
		const maxClassSize = cellNum(row.getCell(4));
		const sections = cellNum(row.getCell(5));
		const utilization = cellNum(row.getCell(9));
		const alert = cellVal(row.getCell(10)).trim();

		if (!grade || enrollment === 0) continue;

		grades.push({
			grade,
			band,
			enrollment: Math.round(enrollment),
			maxClassSize: Math.round(maxClassSize),
			sectionsNeeded: Math.round(sections),
			utilizationPct: Math.round(utilization * 10000) / 10000,
			alert: alert || 'OK',
		});

		totalStudents += Math.round(enrollment);
		totalSections += Math.round(sections);
	}

	return { grades, totalStudents, totalSections };
}

function parseMaternelleHours(sheet: ExcelJS.Worksheet): SubjectHoursEntry[] {
	const entries: SubjectHoursEntry[] = [];
	// Main curriculum: rows 5-11, cols: 1=Domain, 2=PS, 3=MS, 4=GS
	for (let r = 5; r <= 12; r++) {
		const row = sheet.getRow(r);
		const subject = cellVal(row.getCell(1)).trim();
		if (!subject) continue;

		entries.push({
			subject,
			hoursPerWeek: {
				PS: cellNum(row.getCell(2)),
				MS: cellNum(row.getCell(3)),
				GS: cellNum(row.getCell(4)),
			},
		});
	}

	// Host-country: rows 16-17
	for (let r = 16; r <= 17; r++) {
		const row = sheet.getRow(r);
		const subject = cellVal(row.getCell(1)).trim();
		if (!subject) continue;

		entries.push({
			subject: `[Host-Country] ${subject}`,
			hoursPerWeek: {
				PS: cellNum(row.getCell(2)),
				MS: cellNum(row.getCell(3)),
				GS: cellNum(row.getCell(4)),
			},
		});
	}

	return entries;
}

function parseElementaireHours(sheet: ExcelJS.Worksheet): SubjectHoursEntry[] {
	const entries: SubjectHoursEntry[] = [];
	// Main curriculum: rows 5-14, cols: 1=Discipline, 2=CP, 3=CE1, 4=CE2, 5=CM1, 6=CM2
	for (let r = 5; r <= 14; r++) {
		const row = sheet.getRow(r);
		const subject = cellVal(row.getCell(1)).trim();
		if (!subject) continue;

		entries.push({
			subject,
			hoursPerWeek: {
				CP: cellNum(row.getCell(2)),
				CE1: cellNum(row.getCell(3)),
				CE2: cellNum(row.getCell(4)),
				CM1: cellNum(row.getCell(5)),
				CM2: cellNum(row.getCell(6)),
			},
		});
	}

	// Host-country: rows 18-19
	for (let r = 18; r <= 19; r++) {
		const row = sheet.getRow(r);
		const subject = cellVal(row.getCell(1)).trim();
		if (!subject) continue;

		entries.push({
			subject: `[Host-Country] ${subject}`,
			hoursPerWeek: {
				CP: cellNum(row.getCell(2)),
				CE1: cellNum(row.getCell(3)),
				CE2: cellNum(row.getCell(4)),
				CM1: cellNum(row.getCell(5)),
				CM2: cellNum(row.getCell(6)),
			},
		});
	}

	return entries;
}

function parseCollegeDHG(sheet: ExcelJS.Worksheet): DHGEntry[] {
	const entries: DHGEntry[] = [];
	const levels = ['6EME', '5EME', '4EME', '3EME'];
	// Row 5: SECTIONS row — extract section counts
	const sectionsRow = sheet.getRow(5);
	const sections = [
		cellNum(sectionsRow.getCell(2)),
		cellNum(sectionsRow.getCell(3)),
		cellNum(sectionsRow.getCell(4)),
		cellNum(sectionsRow.getCell(5)),
	];

	// Rows 6-17: discipline rows
	// Col 1: discipline, cols 2-5: h/wk per student, cols 6-9: total h/wk
	for (let r = 6; r <= 17; r++) {
		const row = sheet.getRow(r);
		const discipline = cellVal(row.getCell(1)).trim();
		if (!discipline) continue;
		if (discipline.includes('TOTAL')) continue;

		for (let li = 0; li < 4; li++) {
			const hPerStudent = cellNum(row.getCell(2 + li));
			const totalH = cellNum(row.getCell(6 + li));

			if (hPerStudent === 0 && totalH === 0) continue;

			entries.push({
				level: levels[li]!,
				discipline,
				hoursPerWeekPerStudent: hPerStudent,
				totalHoursPerWeek: totalH,
				sections: Math.round(sections[li]!),
			});
		}
	}

	// Host-country rows 22-23
	for (let r = 22; r <= 23; r++) {
		const row = sheet.getRow(r);
		const discipline = cellVal(row.getCell(1)).trim();
		if (!discipline) continue;

		for (let li = 0; li < 4; li++) {
			const hPerStudent = cellNum(row.getCell(2 + li));
			const totalH = cellNum(row.getCell(6 + li));

			if (hPerStudent === 0 && totalH === 0) continue;

			entries.push({
				level: levels[li]!,
				discipline: `[Host-Country] ${discipline}`,
				hoursPerWeekPerStudent: hPerStudent,
				totalHoursPerWeek: totalH,
				sections: Math.round(sections[li]!),
			});
		}
	}

	return entries;
}

function parseLyceeDHG(sheet: ExcelJS.Worksheet): DHGStructure['lyceeDHG'] {
	const seconde: DHGEntry[] = [];
	const premiere: DHGEntry[] = [];
	const terminale: DHGEntry[] = [];

	// -- SECONDE (rows 6-18) --
	const sec2nde = Math.round(cellNum(sheet.getRow(6).getCell(3)));
	for (let r = 7; r <= 18; r++) {
		const row = sheet.getRow(r);
		const discipline = cellVal(row.getCell(1)).trim();
		if (!discipline || discipline.includes('TOTAL')) continue;

		const hPerStudent = cellNum(row.getCell(2));
		const totalH = cellNum(row.getCell(4));

		if (hPerStudent === 0 && totalH === 0) continue;

		seconde.push({
			level: '2NDE',
			discipline,
			hoursPerWeekPerStudent: hPerStudent,
			totalHoursPerWeek: totalH,
			sections: sec2nde,
		});
	}

	// -- PREMIERE Tronc Commun (rows 23-30) --
	const sec1ere = Math.round(cellNum(sheet.getRow(23).getCell(3)));
	for (let r = 24; r <= 30; r++) {
		const row = sheet.getRow(r);
		const discipline = cellVal(row.getCell(1)).trim();
		if (!discipline || discipline.includes('TOTAL')) continue;

		const hPerStudent = cellNum(row.getCell(2));
		const totalH = cellNum(row.getCell(4));

		if (hPerStudent === 0 && totalH === 0) continue;

		premiere.push({
			level: '1ERE',
			discipline: `[Tronc Commun] ${discipline}`,
			hoursPerWeekPerStudent: hPerStudent,
			totalHoursPerWeek: totalH,
			sections: sec1ere,
		});
	}

	// -- PREMIERE Specialites (rows 34-41) --
	for (let r = 34; r <= 41; r++) {
		const row = sheet.getRow(r);
		const discipline = cellVal(row.getCell(1)).trim();
		if (!discipline || discipline.includes('TOTAL')) continue;

		const hPerStudent = cellNum(row.getCell(2));
		const groups = cellNum(row.getCell(3));
		const totalH = cellNum(row.getCell(4));

		if (totalH === 0) continue;

		premiere.push({
			level: '1ERE',
			discipline: `[Specialite] ${discipline}`,
			hoursPerWeekPerStudent: hPerStudent,
			totalHoursPerWeek: totalH,
			sections: Math.round(groups) || sec1ere,
		});
	}

	// -- TERMINALE Tronc Commun (rows 46-53) --
	const secTerm = Math.round(cellNum(sheet.getRow(46).getCell(3)));
	for (let r = 47; r <= 53; r++) {
		const row = sheet.getRow(r);
		const discipline = cellVal(row.getCell(1)).trim();
		if (!discipline || discipline.includes('TOTAL')) continue;

		const hPerStudent = cellNum(row.getCell(2));
		const totalH = cellNum(row.getCell(4));

		if (hPerStudent === 0 && totalH === 0) continue;

		terminale.push({
			level: 'TERM',
			discipline: `[Tronc Commun] ${discipline}`,
			hoursPerWeekPerStudent: hPerStudent,
			totalHoursPerWeek: totalH,
			sections: secTerm,
		});
	}

	// -- TERMINALE Specialites (rows 57-65) --
	for (let r = 57; r <= 71; r++) {
		const row = sheet.getRow(r);
		const discipline = cellVal(row.getCell(1)).trim();
		if (!discipline || discipline.includes('TOTAL') || discipline.includes('TERMINALE')) continue;

		const hPerStudent = cellNum(row.getCell(2));
		const groups = cellNum(row.getCell(3));
		const totalH = cellNum(row.getCell(4));

		if (totalH === 0) continue;

		terminale.push({
			level: 'TERM',
			discipline: `[Specialite] ${discipline}`,
			hoursPerWeekPerStudent: hPerStudent,
			totalHoursPerWeek: totalH,
			sections: Math.round(groups) || secTerm,
		});
	}

	return { seconde, premiere, terminale };
}

function parseStaffingSummary(sheet: ExcelJS.Worksheet): StaffingSummary[] {
	const entries: StaffingSummary[] = [];

	// Rows 6-20: level data
	for (let r = 6; r <= 20; r++) {
		const row = sheet.getRow(r);
		const level = cellVal(row.getCell(1)).trim();
		if (!level) continue;

		const sections = cellNum(row.getCell(2));
		if (sections === 0) continue;

		entries.push({
			level,
			sections: Math.round(sections),
			frenchTeachers: Math.round(cellNum(row.getCell(3)) * 100) / 100,
			asemAssistants: Math.round(cellNum(row.getCell(4))),
			arabicHours: Math.round(cellNum(row.getCell(5))),
			islamicHours: Math.round(cellNum(row.getCell(6))),
		});
	}

	return entries;
}

function collectSubjectList(
	maternelle: SubjectHoursEntry[],
	elementaire: SubjectHoursEntry[],
	college: DHGEntry[],
	lycee: DHGStructure['lyceeDHG']
): string[] {
	const subjects = new Set<string>();

	for (const e of maternelle) subjects.add(e.subject);
	for (const e of elementaire) subjects.add(e.subject);
	for (const e of college) subjects.add(e.discipline);
	for (const e of lycee.seconde) subjects.add(e.discipline);
	for (const e of lycee.premiere) subjects.add(e.discipline);
	for (const e of lycee.terminale) subjects.add(e.discipline);

	return Array.from(subjects).sort();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	// eslint-disable-next-line no-console
	console.log('=== DHG Structure Parser ===');
	// eslint-disable-next-line no-console
	console.log(`Reading: ${EXCEL_PATH}\n`);

	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(EXCEL_PATH);

	// 1. Catalog all sheets
	const sheets: SheetSummary[] = [];
	workbook.eachSheet((sheet) => {
		const headers = getHeaders(sheet, sheet.name === 'Enrollment' ? 3 : 4);
		sheets.push({
			name: sheet.name,
			rowCount: sheet.rowCount,
			columnCount: sheet.columnCount,
			headers,
		});
		// eslint-disable-next-line no-console
		console.log(`  Sheet: "${sheet.name}" — ${sheet.rowCount} rows, ${sheet.columnCount} cols`);
	});

	// 2. Parse Parameters
	const parametersSheet = workbook.getWorksheet('Parameters');
	const parameters = parametersSheet
		? parseParameters(parametersSheet)
		: { schoolInfo: [], classSizeParams: [], teacherServiceObligations: [], hsaOptimization: [] };
	// eslint-disable-next-line no-console
	console.log(
		`\n  Parameters: ${parameters.classSizeParams.length} class size entries, ${parameters.teacherServiceObligations.length} service obligation entries`
	);

	// 3. Parse Enrollment
	const enrollmentSheet = workbook.getWorksheet('Enrollment');
	const enrollment = enrollmentSheet
		? parseEnrollment(enrollmentSheet)
		: { grades: [], totalStudents: 0, totalSections: 0 };
	// eslint-disable-next-line no-console
	console.log(
		`  Enrollment: ${enrollment.grades.length} grades, ${enrollment.totalStudents} students, ${enrollment.totalSections} sections`
	);

	// 4. Parse Maternelle hours
	const matSheet = workbook.getWorksheet('Grille_Maternelle');
	const maternelleHours = matSheet ? parseMaternelleHours(matSheet) : [];
	// eslint-disable-next-line no-console
	console.log(`  Maternelle hours: ${maternelleHours.length} subject rows`);

	// 5. Parse Elementaire hours
	const elemSheet = workbook.getWorksheet('Grille_Elementaire');
	const elementaireHours = elemSheet ? parseElementaireHours(elemSheet) : [];
	// eslint-disable-next-line no-console
	console.log(`  Elementaire hours: ${elementaireHours.length} subject rows`);

	// 6. Parse College DHG
	const collegeSheet = workbook.getWorksheet('DHG_College');
	const collegeDHG = collegeSheet ? parseCollegeDHG(collegeSheet) : [];
	// eslint-disable-next-line no-console
	console.log(`  College DHG: ${collegeDHG.length} entries`);

	// 7. Parse Lycee DHG
	const lyceeSheet = workbook.getWorksheet('DHG_Lycee');
	const lyceeDHG = lyceeSheet
		? parseLyceeDHG(lyceeSheet)
		: { seconde: [], premiere: [], terminale: [] };
	const lyceeTotal = lyceeDHG.seconde.length + lyceeDHG.premiere.length + lyceeDHG.terminale.length;
	// eslint-disable-next-line no-console
	console.log(
		`  Lycee DHG: ${lyceeTotal} entries (2nde: ${lyceeDHG.seconde.length}, 1ere: ${lyceeDHG.premiere.length}, Term: ${lyceeDHG.terminale.length})`
	);

	// 8. Parse Staff Summary
	const staffSheet = workbook.getWorksheet('Staff_Summary');
	const staffingSummary = staffSheet ? parseStaffingSummary(staffSheet) : [];
	// eslint-disable-next-line no-console
	console.log(`  Staffing summary: ${staffingSummary.length} level entries`);

	// 9. Collect unique subject list
	const subjectList = collectSubjectList(maternelleHours, elementaireHours, collegeDHG, lyceeDHG);
	// eslint-disable-next-line no-console
	console.log(`  Unique subjects: ${subjectList.length}`);

	// 10. Assemble and write
	const structure: DHGStructure = {
		sheets,
		parameters,
		enrollment,
		maternelleHours,
		elementaireHours,
		collegeDHG,
		lyceeDHG,
		staffingSummary,
		subjectList,
	};

	// eslint-disable-next-line no-console
	console.log('\n=== Writing Fixture ===');
	writeFixture('fy2026-dhg-structure.json', structure);

	// eslint-disable-next-line no-console
	console.log('\n=== DHG Summary ===');
	// eslint-disable-next-line no-console
	console.log(`Sheets: ${sheets.map((s) => s.name).join(', ')}`);
	// eslint-disable-next-line no-console
	console.log(`Total students: ${enrollment.totalStudents}`);
	// eslint-disable-next-line no-console
	console.log(`Total sections: ${enrollment.totalSections}`);
	// eslint-disable-next-line no-console
	console.log(`Subject count: ${subjectList.length}`);
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error('Fatal error:', err);
	process.exit(1);
});
