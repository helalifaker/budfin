// Staff Costs Excel Parser — extracts FY2026 staff master data from FINAL QA Excel
// Outputs JSON fixture to data/fixtures/fy2026-staff-costs.json
// Run: pnpm --filter @budfin/api exec tsx src/migration/parse-staff-costs-excel.ts

import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Decimal } from 'decimal.js';
import type { StaffCostsFixture, MigrationWarning, MigrationError } from './lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', '..', '..');
const FIXTURES_DIR = resolve(ROOT, 'data', 'fixtures');
const EXCEL_PATH = resolve(
	ROOT,
	'data',
	'School staff force master data',
	'Staff force master data efir - FINAL (QA).xlsx'
);

mkdirSync(FIXTURES_DIR, { recursive: true });

// ── Constants ────────────────────────────────────────────────────────────────

const STAFF_SHEET_NAME = 'Master Data';
const HEADER_ROW = 5;
const DATA_START_ROW = 6;

/** Maximum data row — skip summary/legend rows after AEFE staff */
const MAX_DATA_ROW = 203;

/** Roles that indicate a teaching position */
const TEACHING_ROLE_PATTERNS = ['professeur', 'enseignant', 'eps', 'documentaliste'];

/** Subjects that are NOT teaching positions — admin, support, direction, etc. */
const NON_TEACHING_SUBJECTS = new Set([
	'',
	'tbd',
	'n/a',
	'-',
	'securite',
	'sécurité',
	'ressources humaines',
	'comptabilite',
	'comptabilité',
	'frais de scolarite',
	'frais de scolarité',
	'moyens generaux',
	'moyens généraux',
	'relations publiques',
	'secretariat',
	'secrétariat',
	'informatique',
	'transport',
	'inscriptions',
	'vie scolaire',
	'surveillance piscine',
	'activites periscolaires',
	'activités périscolaires',
	'laboratoire',
	'direction generale',
	'direction générale',
	'direction pedagogique',
	'direction pédagogique',
	'direction financiere',
	'direction financière',
	'programme noor',
	'psychologie scolaire',
]);

const FORMULA_ERROR_PATTERNS = ['#REF!', '#DIV/0!', '#N/A', '#VALUE!', '#NAME?', '#NULL!'];

// ── Excel Column Indices (1-based) — 22-column FINAL QA layout ──────────────

const COL = {
	NUM: 1, // A: #
	LAST_NAME: 2, // B: Last Name
	FIRST_NAME: 3, // C: First Name
	CONTRACT_TYPE: 4, // D: Contract Type
	FUNCTION_ROLE: 5, // E: Function / Role
	DEPARTMENT: 6, // F: Department
	SUBJECT: 7, // G: Subject / Discipline
	ALLOCATION: 8, // H: Allocation (Band)
	LEVEL: 9, // I: Level
	STATUS: 10, // J: Status
	JOINING_DATE: 11, // K: Joining Date
	YOS: 12, // L: YoS (SKIP)
	BASE_SALARY: 13, // M: Base Salary (SAR)
	HOUSING: 14, // N: Housing (IL)
	TRANSPORT: 15, // O: Transport (IT)
	RESP_PREMIUM: 16, // P: Resp. Premium
	HSA: 17, // Q: HSA (10m)
	MONTHLY_GROSS: 18, // R: Monthly Gross (SKIP)
	HOURLY_PCT: 19, // S: Hourly %
	PAYMENT: 20, // T: Payment Method
	AUGMENTATION: 21, // U: Aug. 2026-27
	NOTES: 22, // V: Notes (QA) (SKIP)
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellVal(cell: ExcelJS.Cell): string {
	if (cell.value === null || cell.value === undefined) return '';
	if (typeof cell.value === 'object' && 'error' in cell.value) {
		return String(cell.value.error ?? '');
	}
	if (typeof cell.value === 'object' && 'result' in cell.value) {
		const result = cell.value.result;
		if (result !== null && typeof result === 'object' && 'error' in result) {
			return String(result.error ?? '');
		}
		return String(result ?? '');
	}
	return String(cell.value);
}

/**
 * Checks if a cell value is a formula error (e.g., #REF!, #DIV/0!, #N/A).
 * Returns the error string if found, null otherwise.
 */
function detectFormulaError(cell: ExcelJS.Cell): string | null {
	const raw = cell.value;
	if (raw !== null && typeof raw === 'object' && 'error' in raw) {
		return String(raw.error);
	}
	if (raw !== null && typeof raw === 'object' && 'result' in raw) {
		const result = raw.result;
		if (result !== null && typeof result === 'object' && 'error' in result) {
			return String(result.error);
		}
	}
	const strVal = cellVal(cell).trim();
	for (const pattern of FORMULA_ERROR_PATTERNS) {
		if (strVal === pattern) return pattern;
	}
	return null;
}

/**
 * Read a monetary cell value using Decimal.js — never parseFloat() for money.
 * Returns a Decimal with 4 decimal places. Formula errors are replaced with "0.0000".
 */
function cellMoney(
	cell: ExcelJS.Cell,
	rowNum: number,
	fieldName: string,
	warnings: MigrationWarning[]
): Decimal {
	const errorStr = detectFormulaError(cell);
	if (errorStr) {
		warnings.push({
			code: 'FORMULA_ERROR',
			message: `Formula error "${errorStr}" replaced with 0.0000`,
			row: rowNum,
			field: fieldName,
			value: errorStr,
		});
		return new Decimal('0');
	}

	const raw = cell.value;
	if (raw === null || raw === undefined || raw === '') return new Decimal('0');

	if (typeof raw === 'number') return new Decimal(raw);

	if (typeof raw === 'object' && 'result' in raw) {
		const result = raw.result;
		if (typeof result === 'number') return new Decimal(result);
		if (typeof result === 'string') {
			const trimmed = result.trim();
			if (trimmed === '') return new Decimal('0');
			try {
				return new Decimal(trimmed);
			} catch {
				warnings.push({
					code: 'COERCION_FAILED',
					message: `Could not parse monetary value "${trimmed}", using 0.0000`,
					row: rowNum,
					field: fieldName,
					value: trimmed,
				});
				return new Decimal('0');
			}
		}
		return new Decimal('0');
	}

	const strVal = String(raw).trim();
	if (strVal === '') return new Decimal('0');

	try {
		return new Decimal(strVal);
	} catch {
		warnings.push({
			code: 'COERCION_FAILED',
			message: `Could not parse monetary value "${strVal}", using 0.0000`,
			row: rowNum,
			field: fieldName,
			value: strVal,
		});
		return new Decimal('0');
	}
}

/** Format Decimal as 4-decimal-place string */
function dec4(d: Decimal): string {
	return d.toFixed(4);
}

/** Parse a date cell, returning an ISO date string (YYYY-MM-DD) or null */
function parseDateCell(cell: ExcelJS.Cell): string | null {
	const raw = cell.value;
	if (raw instanceof Date) return formatDate(raw);
	if (typeof raw === 'object' && raw !== null && 'result' in raw) {
		const result = (raw as { result: unknown }).result;
		if (result instanceof Date) return formatDate(result);
	}
	const str = cellVal(cell).trim();
	if (!str) return null;
	const d = new Date(str);
	return isNaN(d.getTime()) ? null : formatDate(d);
}

function formatDate(d: Date): string {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normalize French department names — fix accent inconsistencies.
 * The new Excel uses French names as the standard. We only correct
 * missing accents to ensure consistent lookups.
 */
function normalizeDepartment(excelDept: string): string {
	const trimmed = excelDept.trim();
	const lower = trimmed.toLowerCase();

	// Fix missing accents on common department names
	if (lower === 'college / lycee' || lower === 'collège / lycee' || lower === 'college / lycée') {
		return 'Collège / Lycée';
	}
	if (lower === 'elementaire' || lower === 'élémentaire') {
		return 'Élémentaire';
	}
	if (lower === 'maternelle') {
		return 'Maternelle';
	}
	if (lower === 'administration') {
		return 'Administration';
	}
	if (lower === 'vie scolaire' || lower === 'vie scolaire & support') {
		return 'Vie Scolaire';
	}
	if (lower === 'direction') {
		return 'Direction';
	}
	if (lower === 'maintenance') {
		return 'Maintenance';
	}

	// Return as-is if it already has proper casing/accents
	return trimmed;
}

/**
 * Resolve homeBand from the Allocation (Band) and Level columns.
 * Returns MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE, or null for non-teaching.
 */
function resolveHomeBand(
	allocation: string,
	level: string,
	department: string,
	rowNum: number,
	warnings: MigrationWarning[]
): string | null {
	const alloc = allocation.trim();

	// Parse allocation (class code prefixes)
	if (alloc) {
		const upper = alloc.toUpperCase();
		const lower = alloc.toLowerCase();

		// Maternelle class codes: PS-*, MS-*, GS-*
		if (/^(PS|MS|GS)[-\s]/.test(upper) || upper === 'PS' || upper === 'MS' || upper === 'GS') {
			return 'MATERNELLE';
		}
		// Élémentaire class codes: CP-*, CE1-*, CE2-*, CM1-*, CM2-*
		if (/^(CP|CE1|CE2|CM1|CM2)[-\s]/.test(upper) || /^(CP|CE1|CE2|CM1|CM2)$/.test(upper)) {
			return 'ELEMENTAIRE';
		}
		// Élémentaire / Primaire as full allocation value
		if (lower === 'elementaire' || lower === 'élémentaire' || lower === 'primaire') {
			return 'ELEMENTAIRE';
		}
		// Collège class codes: 6ème-*, 5ème-*, 4ème-*, 3ème-*
		// Also handles PP (Professeur Principal) prefixed: "PP 6eme B", "PP 3eme C"
		if (/[3456]\s*(ÈME|EME|ème|eme)/i.test(alloc)) {
			return 'COLLEGE';
		}
		// Lycée class codes: 2nde-*, 1ère-*, Term-*, Tle-*
		// Also handles PP prefixed: "PP 2nde A", "PP 1ere D", "PP Tle B"
		if (/2\s*NDE/i.test(alloc) || /1\s*(ÈRE|ERE|ère|ere)/i.test(alloc)) {
			return 'LYCEE';
		}
		if (/TERM/i.test(alloc) || /\bTLE\b/i.test(alloc)) {
			return 'LYCEE';
		}
		// Multi-level: "College & Lycee" → COLLEGE (covers both, default to lower)
		if (lower.includes('college') || lower.includes('collège')) {
			return 'COLLEGE';
		}
		// Explicit "Secondaire (TBD)" placeholder
		if (lower.includes('secondaire')) {
			return 'COLLEGE';
		}
	}

	// Fallback to Level column
	const lvl = level.trim().toLowerCase();
	if (lvl.includes('maternelle')) return 'MATERNELLE';
	if (lvl.includes('elementaire') || lvl.includes('élémentaire') || lvl === 'primaire') {
		return 'ELEMENTAIRE';
	}
	if (lvl.includes('secondaire')) return 'COLLEGE';
	if (
		lvl.includes('collège') ||
		lvl.includes('college') ||
		lvl.includes('lycée') ||
		lvl.includes('lycee')
	) {
		return 'COLLEGE';
	}

	// Non-teaching departments get null homeBand
	const deptLower = department.toLowerCase();
	if (
		deptLower.includes('admin') ||
		deptLower.includes('vie scolaire') ||
		deptLower.includes('direction') ||
		deptLower.includes('maintenance')
	) {
		return null;
	}

	// If we have a level or allocation but could not resolve, warn
	if (alloc || lvl) {
		warnings.push({
			code: 'HOMEBAND_UNRESOLVED',
			message: `Could not resolve homeBand from allocation="${alloc}", level="${level}"`,
			row: rowNum,
			field: 'homeBand',
			value: alloc || level,
		});
	}

	return null;
}

/**
 * Map Excel contract type to costMode.
 * - "Contrat Local" → "LOCAL_PAYROLL"
 * - "Titulaire EN"  → "AEFE_RECHARGE"
 */
function mapCostMode(contractType: string, rowNum: number, warnings: MigrationWarning[]): string {
	const lower = contractType.trim().toLowerCase();
	if (lower === 'contrat local') return 'LOCAL_PAYROLL';
	if (lower === 'titulaire en') return 'AEFE_RECHARGE';

	warnings.push({
		code: 'UNKNOWN_CONTRACT_TYPE',
		message: `Unknown contract type "${contractType}", defaulting to LOCAL_PAYROLL`,
		row: rowNum,
		field: 'contractType',
		value: contractType,
	});
	return 'LOCAL_PAYROLL';
}

/**
 * Determine if a role is a teaching position based on known patterns.
 * French role names like "Professeur", "Enseignant", "EPS" indicate teaching.
 */
function isTeachingRole(functionRole: string): boolean {
	const lower = functionRole.toLowerCase();
	return TEACHING_ROLE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Check if a subject indicates a teaching position.
 * Non-blank, non-TBD, non-admin subjects imply teaching.
 */
function isTeachingSubject(subject: string): boolean {
	const lower = subject.trim().toLowerCase();
	return !NON_TEACHING_SUBJECTS.has(lower);
}

/**
 * Parse the augmentation column. Can be:
 * - A number (e.g., 200, 400)
 * - Text with embedded number like "-3250 (nouveau contrat retraite)"
 * - Text like "New Position", "Nouveau Contrat", "changement de poste" — treated as 0
 */
function parseAugmentation(
	cell: ExcelJS.Cell,
	rowNum: number,
	warnings: MigrationWarning[]
): { amount: Decimal; effectiveDate: string | null } {
	const errorStr = detectFormulaError(cell);
	if (errorStr) {
		warnings.push({
			code: 'FORMULA_ERROR',
			message: `Augmentation formula error "${errorStr}" replaced with 0.0000`,
			row: rowNum,
			field: 'augmentation',
			value: errorStr,
		});
		return { amount: new Decimal('0'), effectiveDate: null };
	}

	const raw = cell.value;
	if (raw === null || raw === undefined || raw === '') {
		return { amount: new Decimal('0'), effectiveDate: null };
	}

	// Numeric cell — straightforward augmentation amount
	if (typeof raw === 'number') {
		// Non-zero augmentation implies effective date of next academic year (Sep 2026)
		const effectiveDate = raw !== 0 ? '2026-09-01' : null;
		return { amount: new Decimal(raw), effectiveDate };
	}

	// Formula result
	if (typeof raw === 'object' && 'result' in raw) {
		const result = raw.result;
		if (typeof result === 'number') {
			const effectiveDate = result !== 0 ? '2026-09-01' : null;
			return { amount: new Decimal(result), effectiveDate };
		}
	}

	// String value — extract numeric portion
	const strVal = String(typeof raw === 'object' && 'result' in raw ? raw.result : raw).trim();
	const lower = strVal.toLowerCase();

	// Known non-numeric values → 0
	if (
		lower === 'new position' ||
		lower === 'nouveau contrat' ||
		lower === 'changement de poste' ||
		lower === '-' ||
		lower === 'n/a'
	) {
		return { amount: new Decimal('0'), effectiveDate: null };
	}

	// Try to extract a number from the string (e.g., "-3250 (nouveau contrat retraite)")
	const numMatch = strVal.match(/^(-?\d+(?:\.\d+)?)/);
	if (numMatch) {
		warnings.push({
			code: 'AUGMENTATION_TEXT_PARSED',
			message: `Augmentation text "${strVal}" — extracted numeric value ${numMatch[1]}`,
			row: rowNum,
			field: 'augmentation',
			value: strVal,
		});
		const amount = new Decimal(numMatch[1]!);
		const effectiveDate = !amount.isZero() ? '2026-09-01' : null;
		return { amount, effectiveDate };
	}

	warnings.push({
		code: 'AUGMENTATION_UNPARSEABLE',
		message: `Could not extract numeric augmentation from "${strVal}", using 0.0000`,
		row: rowNum,
		field: 'augmentation',
		value: strVal,
	});
	return { amount: new Decimal('0'), effectiveDate: null };
}

/**
 * Map Excel "Payment" column to a normalized payment method string.
 * - "Virement" => "Bank Transfer"
 * - "Liquide"  => "Cash"
 * - "Mudad"    => "Mudad"
 * - "TBD"      => "TBD"
 */
function mapPaymentMethod(value: string): string {
	const lower = value.trim().toLowerCase();
	if (lower === 'virement') return 'Bank Transfer';
	if (lower === 'liquide') return 'Cash';
	if (lower === 'mudad') return 'Mudad';
	if (lower === 'tbd') return 'TBD';
	return value.trim() || 'Bank Transfer';
}

/** Map Excel status to canonical status */
function mapStatus(value: string, contractType: string): string {
	const trimmed = value.trim();

	// AEFE (Titulaire EN) staff are always "Existing"
	if (contractType.trim().toLowerCase() === 'titulaire en') {
		return 'Existing';
	}

	if (trimmed === 'Existing') return 'Existing';
	if (trimmed === 'NEW (Sep)' || trimmed.toLowerCase().includes('new')) return 'New';
	if (trimmed.toLowerCase().includes('depart')) return 'Departed';
	return trimmed || 'Existing';
}

function writeFixture(name: string, data: unknown): void {
	const path = resolve(FIXTURES_DIR, name);
	writeFileSync(path, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
	// eslint-disable-next-line no-console
	console.log(`  Written: ${path}`);
}

/**
 * Detect if a row is the AEFE section header (merged cell containing "AEFE").
 * Returns true if the row should be treated as a section divider.
 */
function isAefeSectionHeader(row: ExcelJS.Row): boolean {
	// Check first few cells for "AEFE" text (merged cells may appear in col A or B)
	for (let c = 1; c <= 5; c++) {
		const val = cellVal(row.getCell(c)).trim();
		if (val.toUpperCase().includes('AEFE')) return true;
	}
	return false;
}

// ── Main Parser ──────────────────────────────────────────────────────────────

async function main() {
	// eslint-disable-next-line no-console
	console.log('=== Staff Costs Excel Parser (FINAL QA) ===');
	// eslint-disable-next-line no-console
	console.log(`Reading: ${EXCEL_PATH}\n`);

	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(EXCEL_PATH);

	const warnings: MigrationWarning[] = [];
	const errors: MigrationError[] = [];

	// ── 1. Discover sheet structure ──────────────────────────────────────────

	// eslint-disable-next-line no-console
	console.log('=== Sheet Discovery ===');
	workbook.eachSheet((sheet) => {
		const headerRow = sheet.getRow(HEADER_ROW);
		const headers: string[] = [];
		for (let c = 1; c <= sheet.columnCount; c++) {
			const val = cellVal(headerRow.getCell(c)).trim();
			if (val) headers.push(val);
		}
		// eslint-disable-next-line no-console
		console.log(`  Sheet: "${sheet.name}" — ${sheet.rowCount} rows, ${sheet.columnCount} cols`);
		// eslint-disable-next-line no-console
		console.log(`    Headers: ${headers.join(' | ')}`);
	});

	// ── 2. Get Master Data sheet ─────────────────────────────────────────────

	const sheet = workbook.getWorksheet(STAFF_SHEET_NAME);
	if (!sheet) {
		const err: MigrationError = {
			code: 'MISSING_SHEET',
			message: `Required sheet "${STAFF_SHEET_NAME}" not found in workbook`,
			fatal: true,
		};
		errors.push(err);
		// eslint-disable-next-line no-console
		console.error(JSON.stringify({ level: 'ERROR', ...err }));
		process.exit(1);
	}

	// Verify header row
	const expectedHeaders = [
		{ col: COL.LAST_NAME, expected: 'Last Name' },
		{ col: COL.FIRST_NAME, expected: 'First Name' },
		{ col: COL.CONTRACT_TYPE, expected: 'Contract' },
		{ col: COL.FUNCTION_ROLE, expected: 'Function' },
		{ col: COL.DEPARTMENT, expected: 'Department' },
		{ col: COL.SUBJECT, expected: 'Subject' },
		{ col: COL.STATUS, expected: 'Status' },
		{ col: COL.JOINING_DATE, expected: 'Joining' },
		{ col: COL.BASE_SALARY, expected: 'Base Salary' },
		{ col: COL.HOUSING, expected: 'Housing' },
		{ col: COL.TRANSPORT, expected: 'Transport' },
	];

	const headerRow = sheet.getRow(HEADER_ROW);
	for (const { col, expected } of expectedHeaders) {
		const actual = cellVal(headerRow.getCell(col)).trim();
		if (!actual.toLowerCase().includes(expected.toLowerCase())) {
			warnings.push({
				code: 'HEADER_MISMATCH',
				message: `Column ${col} header expected to contain "${expected}", got "${actual}"`,
				field: expected,
			});
		}
	}

	// ── 3. Parse employee rows ───────────────────────────────────────────────

	const fixtures: StaffCostsFixture[] = [];
	const seenCodes = new Set<string>();

	for (let r = DATA_START_ROW; r <= Math.min(sheet.rowCount, MAX_DATA_ROW); r++) {
		const row = sheet.getRow(r);

		// Detect AEFE section header (merged row) — skip it but continue parsing
		if (isAefeSectionHeader(row)) {
			// eslint-disable-next-line no-console
			console.log(`  Row ${r}: AEFE section header detected — skipping`);
			continue;
		}

		// Skip rows where col A (#) is empty, "TOTAL", or non-numeric
		const numCell = cellVal(row.getCell(COL.NUM)).trim();
		if (numCell === '' || numCell.toUpperCase() === 'TOTAL') continue;

		const empNum = parseInt(numCell, 10);
		if (isNaN(empNum)) continue;

		const lastName = cellVal(row.getCell(COL.LAST_NAME)).trim();
		const firstName = cellVal(row.getCell(COL.FIRST_NAME)).trim();
		const contractType = cellVal(row.getCell(COL.CONTRACT_TYPE)).trim();
		const functionRole = cellVal(row.getCell(COL.FUNCTION_ROLE)).trim();
		const excelDept = cellVal(row.getCell(COL.DEPARTMENT)).trim();
		const subjectRaw = cellVal(row.getCell(COL.SUBJECT)).trim();
		const allocationRaw = cellVal(row.getCell(COL.ALLOCATION)).trim();
		const levelRaw = cellVal(row.getCell(COL.LEVEL)).trim();
		const statusRaw = cellVal(row.getCell(COL.STATUS)).trim();

		// ── Required field validation ────────────────────────────────────

		const rowErrors: string[] = [];

		if (!lastName && !firstName) {
			rowErrors.push('name is empty');
		}
		if (!functionRole) {
			rowErrors.push('function_role is empty');
		}

		// Department — normalize French names
		const department = excelDept ? normalizeDepartment(excelDept) : '';
		if (!excelDept) {
			rowErrors.push('department is empty');
		}

		// Joining date — default to 2025-09-01 if missing
		let joiningDate = parseDateCell(row.getCell(COL.JOINING_DATE));
		if (!joiningDate) {
			joiningDate = '2025-09-01';
			warnings.push({
				code: 'MISSING_JOINING_DATE',
				message: `Row ${r} (${lastName} ${firstName}): Missing joining date, defaulting to 2025-09-01`,
				row: r,
				field: 'joiningDate',
			});
		}

		if (rowErrors.length > 0) {
			errors.push({
				code: 'MISSING_MANDATORY_FIELD',
				message: `Row ${r} (${lastName} ${firstName}): ${rowErrors.join('; ')}`,
				row: r,
				fatal: true,
			});
			continue;
		}

		// ── Employee code generation ─────────────────────────────────────
		const employeeCode = `EFIR-${String(empNum).padStart(3, '0')}`;

		if (seenCodes.has(employeeCode)) {
			errors.push({
				code: 'DUPLICATE_EMPLOYEE_CODE',
				message: `Row ${r}: Duplicate employee code "${employeeCode}"`,
				row: r,
				field: 'employee_code',
				fatal: true,
			});
			continue;
		}
		seenCodes.add(employeeCode);

		// ── Name construction (lastName firstName — French convention) ───
		const name = firstName && firstName !== '-' ? `${lastName} ${firstName}` : lastName;

		// ── Contract type → costMode ─────────────────────────────────────
		const costMode = mapCostMode(contractType, r, warnings);
		const isAefeStaff = costMode === 'AEFE_RECHARGE';

		// ── Status ───────────────────────────────────────────────────────
		const status = mapStatus(statusRaw, contractType);

		// ── Subject ──────────────────────────────────────────────────────
		const subject = subjectRaw || '';

		// ── HomeBand resolution ──────────────────────────────────────────
		const homeBand = resolveHomeBand(allocationRaw, levelRaw, department, r, warnings);

		// ── Level ────────────────────────────────────────────────────────
		const level = levelRaw;

		// ── Salary fields ────────────────────────────────────────────────
		// AEFE (Titulaire EN) staff: all salary fields are 0 (paid by France)
		let baseSalary: Decimal;
		let housingAllowance: Decimal;
		let transportAllowance: Decimal;
		let responsibilityPremium: Decimal;
		let hsaAmount: Decimal;

		if (isAefeStaff) {
			baseSalary = new Decimal('0');
			housingAllowance = new Decimal('0');
			transportAllowance = new Decimal('0');
			responsibilityPremium = new Decimal('0');
			hsaAmount = new Decimal('0');
		} else {
			baseSalary = cellMoney(row.getCell(COL.BASE_SALARY), r, 'base_salary', warnings);
			housingAllowance = cellMoney(row.getCell(COL.HOUSING), r, 'housing_allowance', warnings);
			transportAllowance = cellMoney(
				row.getCell(COL.TRANSPORT),
				r,
				'transport_allowance',
				warnings
			);
			responsibilityPremium = cellMoney(
				row.getCell(COL.RESP_PREMIUM),
				r,
				'responsibility_premium',
				warnings
			);
			hsaAmount = cellMoney(row.getCell(COL.HSA), r, 'hsa_amount', warnings);
		}

		// Hourly percentage: 1 = full-time, < 1 = part-time fraction
		const hourlyPctRaw = cellMoney(row.getCell(COL.HOURLY_PCT), r, 'hourly_percentage', warnings);
		const hourlyPercentage = hourlyPctRaw.isZero() ? new Decimal('1') : hourlyPctRaw;

		// Teaching flag — check both role patterns and subject column
		const isTeaching = isTeachingRole(functionRole) || isTeachingSubject(subject);

		// Payment method
		const paymentRaw = cellVal(row.getCell(COL.PAYMENT)).trim();
		const paymentMethod = mapPaymentMethod(paymentRaw);

		// Augmentation — Excel has FLAT SAR amounts (e.g., 250, 400).
		// Cost engine expects a PERCENTAGE FACTOR (e.g., 0.03 for 3%).
		// Convert: augPct = flatAmount / (base + housing + transport + resp)
		let augmentation: Decimal;
		let augmentationEffectiveDate: string | null;

		if (isAefeStaff) {
			augmentation = new Decimal('0');
			augmentationEffectiveDate = null;
		} else {
			const aug = parseAugmentation(row.getCell(COL.AUGMENTATION), r, warnings);
			const nonHsaTotal = baseSalary
				.plus(housingAllowance)
				.plus(transportAllowance)
				.plus(responsibilityPremium);
			if (!aug.amount.isZero() && !nonHsaTotal.isZero()) {
				augmentation = aug.amount.div(nonHsaTotal);
			} else {
				augmentation = new Decimal('0');
			}
			augmentationEffectiveDate = aug.effectiveDate;
		}

		// Saudi/Ajeer — no column in new format, default all to false
		const isSaudi = false;
		const isAjeer = false;

		// ── Build fixture entry ──────────────────────────────────────────

		fixtures.push({
			employeeCode,
			name,
			functionRole,
			department,
			costMode,
			subject,
			homeBand,
			level,
			status,
			joiningDate,
			paymentMethod,
			isSaudi,
			isAjeer,
			isTeaching,
			hourlyPercentage: dec4(hourlyPercentage),
			baseSalary: dec4(baseSalary),
			housingAllowance: dec4(housingAllowance),
			transportAllowance: dec4(transportAllowance),
			responsibilityPremium: dec4(responsibilityPremium),
			hsaAmount: dec4(hsaAmount),
			augmentation: dec4(augmentation),
			augmentationEffectiveDate,
		});
	}

	// ── 4. Report ────────────────────────────────────────────────────────────

	// eslint-disable-next-line no-console
	console.log('\n=== Parse Results ===');
	// eslint-disable-next-line no-console
	console.log(`Total employees parsed: ${fixtures.length}`);
	// eslint-disable-next-line no-console
	console.log(`Warnings: ${warnings.length}`);
	// eslint-disable-next-line no-console
	console.log(`Errors: ${errors.length}`);

	// Log warnings as structured JSON to stdout
	if (warnings.length > 0) {
		// eslint-disable-next-line no-console
		console.log('\n=== Warnings ===');
		for (const w of warnings) {
			// eslint-disable-next-line no-console
			console.log(JSON.stringify({ level: 'WARN', ...w }));
		}
	}

	// Log errors as structured JSON to stdout
	if (errors.length > 0) {
		// eslint-disable-next-line no-console
		console.log('\n=== Errors ===');
		for (const e of errors) {
			// eslint-disable-next-line no-console
			console.log(JSON.stringify({ level: 'ERROR', ...e }));
		}
	}

	// Fatal errors block fixture output
	const fatalErrors = errors.filter((e) => e.fatal);
	if (fatalErrors.length > 0) {
		// eslint-disable-next-line no-console
		console.error(`\nABORTED: ${fatalErrors.length} fatal error(s) found — fixture not written.`);
		process.exit(1);
	}

	// ── 5. Write fixture ─────────────────────────────────────────────────────

	// eslint-disable-next-line no-console
	console.log('\n=== Writing Fixture ===');
	writeFixture('fy2026-staff-costs.json', fixtures);

	// ── 6. Summary statistics ────────────────────────────────────────────────

	const byDept: Record<string, number> = {};
	const byStatus: Record<string, number> = {};
	const byCostMode: Record<string, number> = {};
	let teachingCount = 0;

	for (const f of fixtures) {
		byDept[f.department] = (byDept[f.department] ?? 0) + 1;
		byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
		byCostMode[f.costMode] = (byCostMode[f.costMode] ?? 0) + 1;
		if (f.isTeaching) teachingCount++;
	}

	// eslint-disable-next-line no-console
	console.log('\n=== Summary ===');
	// eslint-disable-next-line no-console
	console.log(`By department: ${JSON.stringify(byDept)}`);
	// eslint-disable-next-line no-console
	console.log(`By status: ${JSON.stringify(byStatus)}`);
	// eslint-disable-next-line no-console
	console.log(`By cost mode: ${JSON.stringify(byCostMode)}`);
	// eslint-disable-next-line no-console
	console.log(`Teaching: ${teachingCount}`);
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error('Fatal error:', err);
	process.exit(1);
});
