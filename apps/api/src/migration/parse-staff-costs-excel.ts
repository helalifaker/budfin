// Staff Costs Excel Parser — extracts FY2026 staff master data from source-of-truth Excel
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
const EXCEL_PATH = resolve(ROOT, 'data', 'budgets', 'EFIR_Staff_Costs_Budget_FY2026_V3.xlsx');

mkdirSync(FIXTURES_DIR, { recursive: true });

// ── Constants ────────────────────────────────────────────────────────────────

const STAFF_SHEET_NAME = 'Staff Master Data';
const AJEER_SHEET_NAME = 'Ajeer Costs';
const HEADER_ROW = 4;
const DATA_START_ROW = 5;

const VALID_DEPARTMENTS = new Set([
	'Teaching',
	'Administration',
	'Support',
	'Management',
	'Maintenance',
]);

/** Maps Excel department names to canonical VALID_DEPARTMENTS values */
const DEPARTMENT_MAP: Record<string, string> = {
	élémentaire: 'Teaching',
	elementaire: 'Teaching',
	'collège / lycée': 'Teaching',
	'college / lycee': 'Teaching',
	maternelle: 'Teaching',
	administration: 'Administration',
	'vie scolaire & support': 'Support',
	'vie scolaire': 'Support',
	support: 'Support',
	management: 'Management',
	maintenance: 'Maintenance',
};

/** Roles that indicate a teaching position */
const TEACHING_ROLE_PATTERNS = ['professeur', 'enseignant', 'eps', 'documentaliste'];

const FORMULA_ERROR_PATTERNS = ['#REF!', '#DIV/0!', '#N/A', '#VALUE!', '#NAME?', '#NULL!'];

// ── Excel Column Indices (1-based) ───────────────────────────────────────────

const COL = {
	NUM: 1,
	LAST_NAME: 2,
	FIRST_NAME: 3,
	FUNCTION_ROLE: 4,
	DEPARTMENT: 5,
	STATUS: 6,
	JOINING_DATE: 7,
	YOS: 8,
	BASE_SALARY: 9,
	HOUSING: 10,
	TRANSPORT: 11,
	RESP_PREMIUM: 12,
	HSA: 13,
	MONTHLY_GROSS: 14,
	HOURLY_PCT: 15,
	SAUDI_AJEER: 16,
	PAYMENT: 17,
	AUGMENTATION: 18,
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
 * Map an Excel department name to a canonical VALID_DEPARTMENTS value.
 * Uses normalized lowercase matching against DEPARTMENT_MAP.
 */
function mapDepartment(
	excelDept: string,
	rowNum: number,
	warnings: MigrationWarning[]
): string | null {
	const normalized = excelDept.trim().toLowerCase();
	const mapped = DEPARTMENT_MAP[normalized];
	if (mapped) return mapped;

	// Try partial matching as a fallback
	for (const [key, value] of Object.entries(DEPARTMENT_MAP)) {
		if (normalized.includes(key) || key.includes(normalized)) {
			warnings.push({
				code: 'DEPARTMENT_FUZZY_MATCH',
				message: `Department "${excelDept}" fuzzy-matched to "${value}" via key "${key}"`,
				row: rowNum,
				field: 'department',
				value: excelDept,
			});
			return value;
		}
	}

	// Check if already a valid department
	if (VALID_DEPARTMENTS.has(excelDept.trim())) return excelDept.trim();

	return null;
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
 * Parse the augmentation column. Can be:
 * - A number (e.g., 200, 400)
 * - Text with embedded number like "-3250 (nouveau contrat retraite)"
 * - Text like "New Position", "Nouveau Contrat" — treated as 0
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

	// Known non-numeric values
	if (lower === 'new position' || lower === 'nouveau contrat' || lower === '-' || lower === 'n/a') {
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
 * Map Excel "Saudi/Ajeer" column to isSaudi and isAjeer booleans.
 * - "Saudi" => isSaudi: true, isAjeer: false
 * - "Ajeer" => isSaudi: false, isAjeer: true
 * - Other   => both false, with warning
 */
function parseSaudiAjeer(
	value: string,
	rowNum: number,
	warnings: MigrationWarning[]
): { isSaudi: boolean; isAjeer: boolean } {
	const trimmed = value.trim();
	const lower = trimmed.toLowerCase();

	if (lower === 'saudi') return { isSaudi: true, isAjeer: false };
	if (lower === 'ajeer') return { isSaudi: false, isAjeer: true };

	if (trimmed) {
		warnings.push({
			code: 'UNKNOWN_SAUDI_AJEER',
			message: `Unrecognized Saudi/Ajeer value "${trimmed}", defaulting to non-Saudi Ajeer`,
			row: rowNum,
			field: 'saudi_ajeer',
			value: trimmed,
		});
	}
	return { isSaudi: false, isAjeer: true };
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
function mapStatus(value: string): string {
	const trimmed = value.trim();
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

// ── Ajeer Costs Lookup ───────────────────────────────────────────────────────

interface AjeerCosts {
	annualLevy: Decimal;
	monthlyFee: Decimal;
}

/**
 * Build a lookup of ajeer costs by row index (employee number).
 * The Ajeer Costs sheet has the same employee ordering as Staff Master Data.
 * Row 8 = header, row 9+ = data matching employee #1, #2, etc.
 * Col 7 = Annual Levy, Col 8 = Annual Platform Fee.
 * Monthly fee = Annual Platform Fee / months (col 6).
 */
function buildAjeerLookup(
	workbook: ExcelJS.Workbook,
	warnings: MigrationWarning[]
): Map<number, AjeerCosts> {
	const sheet = workbook.getWorksheet(AJEER_SHEET_NAME);
	const lookup = new Map<number, AjeerCosts>();

	if (!sheet) {
		warnings.push({
			code: 'MISSING_SHEET',
			message: `Sheet "${AJEER_SHEET_NAME}" not found — ajeer costs will default to 0`,
		});
		return lookup;
	}

	// Read global rates from rows 4-5
	let globalAnnualLevy = new Decimal('0');
	let globalMonthlyFee = new Decimal('0');
	for (let r = 4; r <= 6; r++) {
		const row = sheet.getRow(r);
		const label = cellVal(row.getCell(1)).toLowerCase();
		const valCell = row.getCell(3);
		if (label.includes('levy') && label.includes('year')) {
			globalAnnualLevy = cellMoney(valCell, r, 'ajeer_annual_levy', warnings);
		}
		if (label.includes('platform') && label.includes('month')) {
			globalMonthlyFee = cellMoney(valCell, r, 'ajeer_monthly_fee', warnings);
		}
	}

	// Data rows start at row 9 (row 8 is header)
	const dataStart = 9;
	for (let r = dataStart; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const empNum = row.getCell(1).value;
		if (empNum === null || empNum === undefined) continue;
		const num = typeof empNum === 'number' ? empNum : parseInt(String(empNum), 10);
		if (isNaN(num)) continue;

		const saudiAjeer = cellVal(row.getCell(5)).trim().toLowerCase();

		// Saudi employees have 0 ajeer costs
		if (saudiAjeer === 'saudi') {
			lookup.set(num, {
				annualLevy: new Decimal('0'),
				monthlyFee: new Decimal('0'),
			});
			continue;
		}

		// For Ajeer employees, use global rates (levy and monthly platform fee)
		const annualLevy = cellMoney(row.getCell(7), r, 'ajeer_annual_levy', warnings);
		const annualPlatform = cellMoney(row.getCell(8), r, 'ajeer_annual_platform', warnings);
		const months = cellMoney(row.getCell(6), r, 'ajeer_months', warnings);

		const monthlyFee = months.isZero() ? globalMonthlyFee : annualPlatform.div(months);

		lookup.set(num, {
			annualLevy: annualLevy.isZero() ? globalAnnualLevy : annualLevy,
			monthlyFee,
		});
	}

	return lookup;
}

// ── Main Parser ──────────────────────────────────────────────────────────────

async function main() {
	// eslint-disable-next-line no-console
	console.log('=== Staff Costs Excel Parser ===');
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

	// ── 2. Get Staff Master Data sheet ───────────────────────────────────────

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
		{ col: COL.FUNCTION_ROLE, expected: 'Function / Role' },
		{ col: COL.DEPARTMENT, expected: 'Department' },
		{ col: COL.STATUS, expected: 'Status' },
		{ col: COL.JOINING_DATE, expected: 'Joining Date' },
		{ col: COL.BASE_SALARY, expected: 'Base Salary' },
		{ col: COL.HOUSING, expected: 'Housing (IL)' },
		{ col: COL.TRANSPORT, expected: 'Transport (IT)' },
	];

	const headerRow = sheet.getRow(HEADER_ROW);
	for (const { col, expected } of expectedHeaders) {
		const actual = cellVal(headerRow.getCell(col)).trim();
		if (!actual.includes(expected.split(' ')[0]!)) {
			warnings.push({
				code: 'HEADER_MISMATCH',
				message: `Column ${col} header expected "${expected}", got "${actual}"`,
				field: expected,
			});
		}
	}

	// ── 3. Build Ajeer costs lookup ──────────────────────────────────────────

	const ajeerLookup = buildAjeerLookup(workbook, warnings);
	// eslint-disable-next-line no-console
	console.log(`\nAjeer lookup: ${ajeerLookup.size} entries`);

	// ── 4. Parse employee rows ───────────────────────────────────────────────

	const fixtures: StaffCostsFixture[] = [];
	const seenCodes = new Set<string>();

	for (let r = DATA_START_ROW; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);

		// Skip the TOTAL row at the bottom
		const numCell = cellVal(row.getCell(COL.NUM)).trim();
		if (numCell.toUpperCase() === 'TOTAL' || numCell === '') continue;

		const empNum = parseInt(numCell, 10);
		if (isNaN(empNum)) continue;

		const lastName = cellVal(row.getCell(COL.LAST_NAME)).trim();
		const firstName = cellVal(row.getCell(COL.FIRST_NAME)).trim();
		const functionRole = cellVal(row.getCell(COL.FUNCTION_ROLE)).trim();
		const excelDept = cellVal(row.getCell(COL.DEPARTMENT)).trim();
		const statusRaw = cellVal(row.getCell(COL.STATUS)).trim();

		// ── Required field validation ────────────────────────────────────

		const rowErrors: string[] = [];

		if (!lastName && !firstName) {
			rowErrors.push('name is empty');
		}
		if (!functionRole) {
			rowErrors.push('function_role is empty');
		}
		if (!excelDept) {
			rowErrors.push('department is empty');
		}

		// Map department
		const department = excelDept ? mapDepartment(excelDept, r, warnings) : null;
		if (excelDept && !department) {
			errors.push({
				code: 'INVALID_DEPARTMENT',
				message: `Row ${r}: Unknown department "${excelDept}" — cannot map to valid department`,
				row: r,
				field: 'department',
				fatal: false,
			});
			rowErrors.push(`invalid department "${excelDept}"`);
		}

		// Joining date
		const joiningDate = parseDateCell(row.getCell(COL.JOINING_DATE));
		if (!joiningDate) {
			rowErrors.push('joining_date is missing or invalid');
		}

		// Base salary (required, must be numeric)
		const baseSalary = cellMoney(row.getCell(COL.BASE_SALARY), r, 'base_salary', warnings);

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
		// Excel uses sequential numbers; generate a code like "EFIR-001"
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

		// ── Name construction ────────────────────────────────────────────
		const name = firstName && firstName !== '-' ? `${lastName} ${firstName}` : lastName;

		// ── Optional fields ──────────────────────────────────────────────

		const status = mapStatus(statusRaw);

		const housingAllowance = cellMoney(row.getCell(COL.HOUSING), r, 'housing_allowance', warnings);
		const transportAllowance = cellMoney(
			row.getCell(COL.TRANSPORT),
			r,
			'transport_allowance',
			warnings
		);
		const responsibilityPremium = cellMoney(
			row.getCell(COL.RESP_PREMIUM),
			r,
			'responsibility_premium',
			warnings
		);
		const hsaAmount = cellMoney(row.getCell(COL.HSA), r, 'hsa_amount', warnings);

		// Hourly percentage: 1 = full-time, < 1 = part-time fraction
		const hourlyPctRaw = cellMoney(row.getCell(COL.HOURLY_PCT), r, 'hourly_percentage', warnings);
		const hourlyPercentage = hourlyPctRaw.isZero() ? new Decimal('1') : hourlyPctRaw;

		// Saudi/Ajeer
		const saudiAjeerRaw = cellVal(row.getCell(COL.SAUDI_AJEER)).trim();
		const { isSaudi, isAjeer } = parseSaudiAjeer(saudiAjeerRaw, r, warnings);

		// Teaching flag
		const isTeaching = isTeachingRole(functionRole);

		// Payment method
		const paymentRaw = cellVal(row.getCell(COL.PAYMENT)).trim();
		const paymentMethod = mapPaymentMethod(paymentRaw);

		// Augmentation
		const { amount: augmentation, effectiveDate: augmentationEffectiveDate } = parseAugmentation(
			row.getCell(COL.AUGMENTATION),
			r,
			warnings
		);

		// Ajeer costs from lookup
		const ajeerCosts = ajeerLookup.get(empNum);
		const ajeerAnnualLevy = ajeerCosts?.annualLevy ?? new Decimal('0');
		const ajeerMonthlyFee = ajeerCosts?.monthlyFee ?? new Decimal('0');

		// ── Build fixture entry ──────────────────────────────────────────

		fixtures.push({
			employeeCode,
			name,
			functionRole,
			department: department!,
			status,
			joiningDate: joiningDate!,
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
			ajeerAnnualLevy: dec4(ajeerAnnualLevy),
			ajeerMonthlyFee: dec4(ajeerMonthlyFee),
		});
	}

	// ── 5. Report ────────────────────────────────────────────────────────────

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

	// ── 6. Write fixture ─────────────────────────────────────────────────────

	// eslint-disable-next-line no-console
	console.log('\n=== Writing Fixture ===');
	writeFixture('fy2026-staff-costs.json', fixtures);

	// ── 7. Summary statistics ────────────────────────────────────────────────

	const byDept: Record<string, number> = {};
	const byStatus: Record<string, number> = {};
	let saudiCount = 0;
	let ajeerCount = 0;
	let teachingCount = 0;

	for (const f of fixtures) {
		byDept[f.department] = (byDept[f.department] ?? 0) + 1;
		byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
		if (f.isSaudi) saudiCount++;
		if (f.isAjeer) ajeerCount++;
		if (f.isTeaching) teachingCount++;
	}

	// eslint-disable-next-line no-console
	console.log('\n=== Summary ===');
	// eslint-disable-next-line no-console
	console.log(`By department: ${JSON.stringify(byDept)}`);
	// eslint-disable-next-line no-console
	console.log(`By status: ${JSON.stringify(byStatus)}`);
	// eslint-disable-next-line no-console
	console.log(`Saudi: ${saudiCount}, Ajeer: ${ajeerCount}, Teaching: ${teachingCount}`);
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error('Fatal error:', err);
	process.exit(1);
});
