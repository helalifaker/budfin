// Revenue Excel Parser — extracts FY2026 data from the source-of-truth Excel
// Outputs JSON fixtures to data/fixtures/ for validation tests
// Run: pnpm --filter @budfin/api exec tsx src/validation/parse-revenue-excel.ts

import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Decimal } from 'decimal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', '..', '..');
const FIXTURES_DIR = resolve(ROOT, 'data', 'fixtures');
const EXCEL_PATH = resolve(ROOT, 'data', 'budgets', '01_EFIR_Revenue_FY2026_v3.xlsx');

mkdirSync(FIXTURES_DIR, { recursive: true });

// ── Types ────────────────────────────────────────────────────────────────────

interface FeeGridEntry {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	tuitionTtc: string;
	tuitionHt: string;
	dai: string;
}

interface OtherRevenueEntry {
	lineItemName: string;
	annualAmount: string;
	distributionMethod: string;
	weightArray: number[] | null;
	specificMonths: number[] | null;
	ifrsCategory: string;
}

interface EnrollmentDetailEntry {
	academicPeriod: 'AY1' | 'AY2';
	gradeLevel: string;
	nationality: string;
	tariff: string;
	headcount: number;
}

interface ExpectedRevenueEntry {
	month: number;
	tuitionFees: string;
	discountImpact: string;
	registrationFees: string;
	activitiesServices: string;
	examinationFees: string;
	totalOperatingRevenue: string;
}

interface GradeCodeMapping {
	excelCode: string;
	appCode: string;
	gradeName: string;
	band: string;
	feeBand: string;
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

function dec(n: number, places: number = 4): string {
	return new Decimal(n).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}

function writeFixture(name: string, data: unknown): void {
	const path = resolve(FIXTURES_DIR, name);
	writeFileSync(path, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
	// eslint-disable-next-line no-console
	console.log(`  Written: ${path}`);
}

// Fee band → grade code mapping
// Excel uses fee bands, not individual grade codes in FEE_GRID
const FEE_BAND_TO_GRADES: Record<string, string[]> = {
	'Maternelle PS': ['PS'],
	Maternelle: ['MS', 'GS'],
	Elementaire: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
	College: ['6EME', '5EME', '4EME', '3EME'],
	Lycee: ['2NDE', '1ERE', 'TERM'],
};

// Grade info for taxonomy
const GRADE_INFO: Record<string, { name: string; band: string; feeBand: string }> = {
	PS: { name: 'Petite Section', band: 'MATERNELLE', feeBand: 'Maternelle PS' },
	MS: { name: 'Moyenne Section', band: 'MATERNELLE', feeBand: 'Maternelle' },
	GS: { name: 'Grande Section', band: 'MATERNELLE', feeBand: 'Maternelle' },
	CP: { name: 'Cours Preparatoire', band: 'ELEMENTAIRE', feeBand: 'Elementaire' },
	CE1: { name: 'Cours Elementaire 1', band: 'ELEMENTAIRE', feeBand: 'Elementaire' },
	CE2: { name: 'Cours Elementaire 2', band: 'ELEMENTAIRE', feeBand: 'Elementaire' },
	CM1: { name: 'Cours Moyen 1', band: 'ELEMENTAIRE', feeBand: 'Elementaire' },
	CM2: { name: 'Cours Moyen 2', band: 'ELEMENTAIRE', feeBand: 'Elementaire' },
	'6EME': { name: 'Sixieme', band: 'COLLEGE', feeBand: 'College' },
	'5EME': { name: 'Cinquieme', band: 'COLLEGE', feeBand: 'College' },
	'4EME': { name: 'Quatrieme', band: 'COLLEGE', feeBand: 'College' },
	'3EME': { name: 'Troisieme', band: 'COLLEGE', feeBand: 'College' },
	'2NDE': { name: 'Seconde', band: 'LYCEE', feeBand: 'Lycee' },
	'1ERE': { name: 'Premiere', band: 'LYCEE', feeBand: 'Lycee' },
	TERM: { name: 'TERM', band: 'LYCEE', feeBand: 'Lycee' },
};

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	// eslint-disable-next-line no-console
	console.log('=== Revenue Excel Parser ===');
	// eslint-disable-next-line no-console
	console.log(`Reading: ${EXCEL_PATH}\n`);

	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(EXCEL_PATH);

	// 1. Parse FEE_GRID (band-level fees, 3 nationality sections, 2 academic periods)
	const feeGrid = parseFeeGrid(workbook);
	// eslint-disable-next-line no-console
	console.log(`Fee grid: ${feeGrid.length} entries`);

	// 2. Parse ENROLLMENT_DETAIL (matrix: grade × nationality × tariff)
	const enrollmentDetail = parseEnrollmentDetail(workbook);
	// eslint-disable-next-line no-console
	console.log(`Enrollment detail: ${enrollmentDetail.length} entries`);

	// 3. Parse OTHER_REVENUES (line items with monthly distribution)
	const otherRevenue = parseOtherRevenues(workbook);
	// eslint-disable-next-line no-console
	console.log(`Other revenue: ${otherRevenue.length} items`);

	// 4. Parse EXECUTIVE_SUMMARY for expected monthly totals
	const expectedRevenue = parseExpectedRevenue(workbook);
	// eslint-disable-next-line no-console
	console.log(`Expected revenue: ${expectedRevenue.length} months`);

	// 5. Build grade code mapping
	const gradeCodeMapping = buildGradeCodeMapping(enrollmentDetail);

	// 6. Write fixtures
	// eslint-disable-next-line no-console
	console.log('\n=== Writing Fixtures ===');
	writeFixture('fy2026-fee-grid.json', feeGrid);
	writeFixture('fy2026-other-revenue.json', otherRevenue);
	writeFixture('fy2026-enrollment-detail.json', enrollmentDetail);
	writeFixture('fy2026-expected-revenue.json', expectedRevenue);
	writeFixture('grade-code-mapping.json', gradeCodeMapping);

	// 7. Summary
	// eslint-disable-next-line no-console
	console.log('\n=== Taxonomy Summary ===');
	// eslint-disable-next-line no-console
	console.log(`Grade codes: ${gradeCodeMapping.map((g) => g.excelCode).join(', ')}`);
	// eslint-disable-next-line no-console
	console.log(`TPS: ABSENT (not in any Excel data)`);
	// eslint-disable-next-line no-console
	console.log(`1ERE/TERM: SEPARATE grades (1ERE and TERM are distinct)`);
	// eslint-disable-next-line no-console
	console.log(`Fee bands: ${Object.keys(FEE_BAND_TO_GRADES).join(', ')}`);
	// eslint-disable-next-line no-console
	console.log(`Nationalities: Francais, Nationaux, Autres`);
	// eslint-disable-next-line no-console
	console.log(`Tariffs: Plein, Reduit Personnel (RP), Reduit 3+ (R3+)`);

	// Total enrollment cross-check
	const totalStudents = enrollmentDetail.reduce((sum, e) => sum + e.headcount, 0);
	// eslint-disable-next-line no-console
	console.log(`\nTotal AY1 students: ${totalStudents}`);
	// eslint-disable-next-line no-console
	console.log(`Expected (from ENROLLMENT_DETAIL row 29): 1,753`);
}

// ── FEE_GRID Parser ──────────────────────────────────────────────────────────
// Structure: Multiple sections by nationality, each with:
//   Row: Level | DAI (TTC) | Tuition TTC | Tuition HT | T1 TTC | T2 TTC | T3 TTC | VAT Status
// Fee bands: Maternelle PS, Maternelle, Elementaire, College, Lycee
// Sections: "Francais" (rows 4-10), "Nationaux (KSA)" (rows 12-18), "Autres" (rows 20-26)
// Then repeats for AY2 (rows 29+)

function parseFeeGrid(workbook: ExcelJS.Workbook): FeeGridEntry[] {
	const sheet = workbook.getWorksheet('FEE_GRID');
	if (!sheet) return [];

	const results: FeeGridEntry[] = [];
	const feeBands = ['Maternelle PS', 'Maternelle', 'Elementaire', 'College', 'Lycee'];

	// Scan for nationality section headers and fee grid periods
	let currentNationality = '';
	let currentPeriod: 'AY1' | 'AY2' = 'AY1';

	for (let r = 1; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const c1 = cellVal(row.getCell(1)).trim();
		const c1Lower = c1.toLowerCase();

		// Detect period headers
		if (c1Lower.includes('ay2026-2027') || c1Lower.includes('2026-2027')) {
			currentPeriod = 'AY2';
			continue;
		}
		if (c1Lower.includes('ay2025-2026') || c1Lower.includes('2025-2026')) {
			currentPeriod = 'AY1';
			continue;
		}
		if (c1Lower.includes('year-over-year') || c1Lower.includes('year over year')) {
			currentNationality = '';
			continue;
		}

		// Detect nationality sections
		if (c1Lower === 'francais' || c1Lower === 'français') {
			currentNationality = 'Francais';
			continue;
		}
		if (c1Lower.includes('nationaux')) {
			currentNationality = 'Nationaux';
			continue;
		}
		if (c1Lower.includes('autres')) {
			currentNationality = 'Autres';
			continue;
		}

		// Skip header rows
		if (c1Lower === 'level' || c1Lower === 'niveau') continue;

		// Try to match fee band
		const matchedBand = feeBands.find(
			(b) => c1.toLowerCase() === b.toLowerCase() || c1.toLowerCase().startsWith(b.toLowerCase())
		);
		if (!matchedBand || !currentNationality) continue;

		// Read fee data: col 2 = DAI, col 3 = TTC, col 4 = HT
		const dai = cellNum(row.getCell(2));
		const ttc = cellNum(row.getCell(3));
		const ht = cellNum(row.getCell(4));

		if (ttc === 0 && ht === 0) continue;

		// Expand fee band to individual grades
		const grades = FEE_BAND_TO_GRADES[matchedBand];
		if (!grades) continue;

		// Emit fee grid entries for ALL tariffs (Plein price is the base;
		// discounts are applied separately by the revenue engine)
		const tariffs = ['Plein', 'Reduit Personnel', 'Reduit 3+'];
		for (const gradeCode of grades) {
			for (const tariff of tariffs) {
				results.push({
					academicPeriod: currentPeriod,
					gradeLevel: gradeCode,
					nationality: currentNationality,
					tariff,
					tuitionTtc: dec(ttc),
					tuitionHt: dec(ht),
					dai: dec(dai),
				});
			}
		}
	}

	return results;
}

// ── ENROLLMENT_DETAIL Parser ─────────────────────────────────────────────────
// Matrix layout (row 6 header):
//   Grade | Band | [Francais: RP R3+ Plein Total] | [Nationaux: RP R3+ Plein Total] | [Autres: RP R3+ Plein Total] | Grand Total | Revenue HT
// Data rows 7-21: PS through TERM
// Grade codes match CSV: PS, MS, GS, CP, CE1, CE2, CM1, CM2, 6EME, 5EME, 4EME, 3EME, 2NDE, 1ERE, TERM

function parseEnrollmentDetail(workbook: ExcelJS.Workbook): EnrollmentDetailEntry[] {
	const sheet = workbook.getWorksheet('ENROLLMENT_DETAIL');
	if (!sheet) return [];

	const results: EnrollmentDetailEntry[] = [];

	// Find the header row (looking for "Grade" and "Band")
	let headerRow = -1;
	for (let r = 1; r <= 10; r++) {
		const row = sheet.getRow(r);
		const c1 = cellVal(row.getCell(1)).toLowerCase().trim();
		if (c1 === 'grade') {
			headerRow = r;
			break;
		}
	}

	if (headerRow === -1) {
		// eslint-disable-next-line no-console
		console.log('  ENROLLMENT_DETAIL: no header found');
		return results;
	}

	// Column layout from dump (row 6):
	// 1: Grade, 2: Band
	// Francais: 3=RP, 4=R3+, 5=Plein, 6=Total
	// Nationaux: 7=RP, 8=R3+, 9=Plein, 10=Total
	// Autres: 11=RP, 12=R3+, 13=Plein, 14=Total
	// 15: Grand Total, 16: Revenue HT
	const nationCols = [
		{ nationality: 'Francais', rpCol: 3, r3Col: 4, pleinCol: 5 },
		{ nationality: 'Nationaux', rpCol: 7, r3Col: 8, pleinCol: 9 },
		{ nationality: 'Autres', rpCol: 11, r3Col: 12, pleinCol: 13 },
	];

	// Detect which section we're in (AY1 or AY2)
	// Section A header at row 4 says "AY1 Detail"
	let currentPeriod: 'AY1' | 'AY2' = 'AY1';

	// Look for section markers before the header
	for (let r = 1; r < headerRow; r++) {
		const row = sheet.getRow(r);
		const c1 = cellVal(row.getCell(1)).toLowerCase();
		if (c1.includes('ay1') || c1.includes('section a') || c1.includes('2025-2026')) {
			currentPeriod = 'AY1';
		}
		if (c1.includes('ay2') || c1.includes('section b') || c1.includes('2026-2027')) {
			currentPeriod = 'AY2';
		}
	}

	// Parse data rows (after header until we hit BAND SUBTOTALS or empty)
	for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const grade = cellVal(row.getCell(1)).trim().toUpperCase();

		// Check if we hit section markers
		const rawC1 = cellVal(row.getCell(1)).trim();
		if (rawC1.toLowerCase().includes('subtotal') || rawC1.toLowerCase().includes('total')) {
			break;
		}

		// Check for AY2 section
		if (rawC1.toLowerCase().includes('section b') || rawC1.toLowerCase().includes('ay2')) {
			currentPeriod = 'AY2';
			// Re-scan for next header
			for (let r2 = r + 1; r2 <= Math.min(r + 5, sheet.rowCount); r2++) {
				const row2 = sheet.getRow(r2);
				if (cellVal(row2.getCell(1)).toLowerCase().trim() === 'grade') {
					r = r2; // skip to new header
					break;
				}
			}
			continue;
		}

		if (!GRADE_INFO[grade]) continue;

		for (const nc of nationCols) {
			const rp = Math.round(cellNum(row.getCell(nc.rpCol)));
			const r3 = Math.round(cellNum(row.getCell(nc.r3Col)));
			const plein = Math.round(cellNum(row.getCell(nc.pleinCol)));

			if (rp > 0) {
				results.push({
					academicPeriod: currentPeriod,
					gradeLevel: grade,
					nationality: nc.nationality,
					tariff: 'Reduit Personnel',
					headcount: rp,
				});
			}
			if (r3 > 0) {
				results.push({
					academicPeriod: currentPeriod,
					gradeLevel: grade,
					nationality: nc.nationality,
					tariff: 'Reduit 3+',
					headcount: r3,
				});
			}
			if (plein > 0) {
				results.push({
					academicPeriod: currentPeriod,
					gradeLevel: grade,
					nationality: nc.nationality,
					tariff: 'Plein',
					headcount: plein,
				});
			}
		}
	}

	// Check if there's a Section B for AY2
	for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const c1 = cellVal(row.getCell(1)).toLowerCase();
		if (c1.includes('section b') || c1.includes('ay2')) {
			// Parse AY2 section similarly
			parseEnrollmentSection(sheet, r, 'AY2', nationCols, results);
			break;
		}
	}

	return results;
}

function parseEnrollmentSection(
	sheet: ExcelJS.Worksheet,
	startRow: number,
	period: 'AY1' | 'AY2',
	nationCols: Array<{ nationality: string; rpCol: number; r3Col: number; pleinCol: number }>,
	results: EnrollmentDetailEntry[]
): void {
	// Find header row after section marker
	let headerRow = -1;
	for (let r = startRow; r <= Math.min(startRow + 5, sheet.rowCount); r++) {
		const row = sheet.getRow(r);
		if (cellVal(row.getCell(1)).toLowerCase().trim() === 'grade') {
			headerRow = r;
			break;
		}
	}
	if (headerRow === -1) return;

	for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const grade = cellVal(row.getCell(1)).trim().toUpperCase();
		const rawC1 = cellVal(row.getCell(1)).trim();
		if (rawC1.toLowerCase().includes('subtotal') || rawC1.toLowerCase().includes('total')) break;
		if (!GRADE_INFO[grade]) continue;

		for (const nc of nationCols) {
			const rp = Math.round(cellNum(row.getCell(nc.rpCol)));
			const r3 = Math.round(cellNum(row.getCell(nc.r3Col)));
			const plein = Math.round(cellNum(row.getCell(nc.pleinCol)));

			if (rp > 0) {
				results.push({
					academicPeriod: period,
					gradeLevel: grade,
					nationality: nc.nationality,
					tariff: 'Reduit Personnel',
					headcount: rp,
				});
			}
			if (r3 > 0) {
				results.push({
					academicPeriod: period,
					gradeLevel: grade,
					nationality: nc.nationality,
					tariff: 'Reduit 3+',
					headcount: r3,
				});
			}
			if (plein > 0) {
				results.push({
					academicPeriod: period,
					gradeLevel: grade,
					nationality: nc.nationality,
					tariff: 'Plein',
					headcount: plein,
				});
			}
		}
	}
}

// ── OTHER_REVENUES Parser ────────────────────────────────────────────────────
// Row 4 header: Line Item | Annual Driver (SAR) | Distribution | Jan..Dec | FY2026 Total | Check
// Distribution types: May-Jun, Custom months, Academic /10, Year-round /12

function parseOtherRevenues(workbook: ExcelJS.Workbook): OtherRevenueEntry[] {
	const sheet = workbook.getWorksheet('OTHER_REVENUES');
	if (!sheet) return [];

	const results: OtherRevenueEntry[] = [];

	// Header at row 4
	const headerRow = 4;
	// Verify
	const h1 = cellVal(sheet.getRow(headerRow).getCell(1)).toLowerCase();
	if (!h1.includes('line') && !h1.includes('item')) {
		// eslint-disable-next-line no-console
		console.log(`  OTHER_REVENUES: unexpected header at row 4: "${h1}"`);
	}

	// Col 1: name, Col 2: annual amount, Col 3: distribution method
	// Cols 4-15: Jan-Dec values
	// Weight rows start with "  ↳ Weights"
	let pendingWeights: number[] | null = null;
	let lastItem: OtherRevenueEntry | null = null;

	for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const name = cellVal(row.getCell(1)).trim();

		if (!name) continue;

		// Check for weight annotation row
		if (name.startsWith('↳') || name.includes('Weights')) {
			// Read weights from cols 4-15 (Jan-Dec)
			pendingWeights = [];
			for (let c = 4; c <= 15; c++) {
				pendingWeights.push(cellNum(row.getCell(c)));
			}
			// Apply to last item
			if (lastItem && pendingWeights) {
				lastItem.weightArray = pendingWeights;
				lastItem.distributionMethod = 'CUSTOM_WEIGHTS';
			}
			continue;
		}

		// Skip section headers and totals
		if (name.toLowerCase().includes('section') || name.toLowerCase().includes('total')) {
			continue;
		}

		const amount = cellNum(row.getCell(2));
		if (amount === 0) continue;

		const methodRaw = cellVal(row.getCell(3)).trim();

		// Map distribution method
		let distributionMethod = 'ACADEMIC_10';
		let specificMonths: number[] | null = null;
		const ml = methodRaw.toLowerCase();

		if (ml.includes('/12') || ml.includes('year-round') || ml.includes('year round')) {
			distributionMethod = 'YEAR_ROUND_12';
		} else if (ml.includes('/10') || ml.includes('academic')) {
			distributionMethod = 'ACADEMIC_10';
		} else if (ml.includes('custom') || ml.includes('weight')) {
			distributionMethod = 'CUSTOM_WEIGHTS';
		} else if (ml.includes('may-jun') || ml.includes('mai-juin')) {
			distributionMethod = 'SPECIFIC_PERIOD';
			specificMonths = [5, 6];
		} else if (ml.includes('sep-oct') || ml.includes('sept-oct')) {
			distributionMethod = 'SPECIFIC_PERIOD';
			specificMonths = [9, 10];
		} else if (ml.includes('apr-may') || ml.includes('avr-mai')) {
			distributionMethod = 'SPECIFIC_PERIOD';
			specificMonths = [4, 5];
		} else if (ml.includes('specific') || ml.includes('period')) {
			distributionMethod = 'SPECIFIC_PERIOD';
		}

		// Determine IFRS category from section context
		let ifrsCategory = 'Other Revenue';
		if (
			name.toLowerCase().includes('dossier') ||
			name.toLowerCase().includes('dpi') ||
			name.toLowerCase().includes('dai')
		) {
			ifrsCategory = 'Registration Fees';
		} else if (name.toLowerCase().includes('evaluat') || name.toLowerCase().includes('test')) {
			ifrsCategory = 'Registration Fees';
		} else if (
			name.toLowerCase().includes('aps') ||
			name.toLowerCase().includes('activit') ||
			name.toLowerCase().includes('garderie') ||
			name.toLowerCase().includes('daycare') ||
			name.toLowerCase().includes('photo') ||
			name.toLowerCase().includes('rental') ||
			name.toLowerCase().includes('psg') ||
			name.toLowerCase().includes('cafe') ||
			name.toLowerCase().includes('parking')
		) {
			ifrsCategory = 'Activities & Services';
		} else if (
			name.toLowerCase().includes('exam') ||
			name.toLowerCase().includes('brevet') ||
			name.toLowerCase().includes('bac') ||
			name.toLowerCase().includes('cambridge') ||
			name.toLowerCase().includes('delf')
		) {
			ifrsCategory = 'Examination Fees';
		}

		const entry: OtherRevenueEntry = {
			lineItemName: name,
			annualAmount: dec(amount),
			distributionMethod,
			weightArray: null,
			specificMonths,
			ifrsCategory,
		};

		results.push(entry);
		lastItem = entry;
	}

	return results;
}

// ── EXECUTIVE_SUMMARY Parser ─────────────────────────────────────────────────
// Row 10: Category | Jan | Feb | ... | Dec | FY2026
// Row 11: Tuition Fees | values...
// Row 12: Discount Impact | values...
// Row 13: Registration Fees | values...
// Row 14: Activities & Services | values...
// Row 15: Examination Fees | values...
// Row 17: TOTAL OPERATING REVENUE | values...

function parseExpectedRevenue(workbook: ExcelJS.Workbook): ExpectedRevenueEntry[] {
	const sheet = workbook.getWorksheet('EXECUTIVE_SUMMARY');
	if (!sheet) return [];

	const results: ExpectedRevenueEntry[] = [];

	// Find the P&L header row (Row 10: Category | Jan | Feb | ...)
	let headerRow = -1;
	for (let r = 1; r <= 15; r++) {
		const row = sheet.getRow(r);
		const c1 = cellVal(row.getCell(1)).toLowerCase().trim();
		if (c1 === 'category') {
			headerRow = r;
			break;
		}
	}

	if (headerRow === -1) {
		// eslint-disable-next-line no-console
		console.log('  EXECUTIVE_SUMMARY: no Category header found');
		return results;
	}

	// Cols 2-13 are Jan-Dec (months 1-12), col 14 is FY2026 total
	// Initialize results for each month
	for (let m = 1; m <= 12; m++) {
		results.push({
			month: m,
			tuitionFees: '0.0000',
			discountImpact: '0.0000',
			registrationFees: '0.0000',
			activitiesServices: '0.0000',
			examinationFees: '0.0000',
			totalOperatingRevenue: '0.0000',
		});
	}

	// Parse labeled rows after header
	for (let r = headerRow + 1; r <= Math.min(headerRow + 15, sheet.rowCount); r++) {
		const row = sheet.getRow(r);
		const label = cellVal(row.getCell(1)).toLowerCase().trim();
		if (!label) continue;

		let field: keyof ExpectedRevenueEntry | null = null;
		if (label.includes('tuition')) field = 'tuitionFees';
		else if (label.includes('discount')) field = 'discountImpact';
		else if (label.includes('registration')) field = 'registrationFees';
		else if (label.includes('activities') || label.includes('services'))
			field = 'activitiesServices';
		else if (label.includes('examination') || label.includes('exam')) field = 'examinationFees';
		else if (label.includes('total operating') || label.includes('total revenue'))
			field = 'totalOperatingRevenue';

		if (!field) continue;

		for (let m = 1; m <= 12; m++) {
			const val = cellNum(row.getCell(m + 1)); // col 2 = Jan (month 1)
			results[m - 1]![field] = dec(val);
		}
	}

	// Filter out months with all zeros (Jul/Aug)
	return results;
}

// ── Grade Code Mapping Builder ───────────────────────────────────────────────

function buildGradeCodeMapping(enrollmentDetail: EnrollmentDetailEntry[]): GradeCodeMapping[] {
	const discoveredCodes = new Set<string>();
	for (const e of enrollmentDetail) discoveredCodes.add(e.gradeLevel);

	const bandOrder = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'];
	const gradeOrder = [
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

	const mapping: GradeCodeMapping[] = [];

	for (const code of gradeOrder) {
		if (!discoveredCodes.has(code)) continue;
		const info = GRADE_INFO[code];
		if (!info) continue;

		mapping.push({
			excelCode: code,
			appCode: code,
			gradeName: info.name,
			band: info.band,
			feeBand: info.feeBand,
		});
	}

	mapping.sort((a, b) => {
		const bi = bandOrder.indexOf(a.band) - bandOrder.indexOf(b.band);
		if (bi !== 0) return bi;
		return gradeOrder.indexOf(a.excelCode) - gradeOrder.indexOf(b.excelCode);
	});

	return mapping;
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error('Fatal error:', err);
	process.exit(1);
});
