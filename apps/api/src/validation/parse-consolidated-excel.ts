// Consolidated Budget Parser — extracts monthly P&L from consolidated Excel
// Outputs JSON fixture to data/fixtures/ for validation tests
// Run: pnpm --filter @budfin/api exec tsx src/validation/parse-consolidated-excel.ts

import ExcelJS from 'exceljs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..', '..', '..');
const FIXTURES_DIR = resolve(ROOT, 'data', 'fixtures');
const EXCEL_PATH = resolve(ROOT, 'data', 'budgets', 'EFIR_Consolidated_Monthly_Budget_FY2026.xlsx');

mkdirSync(FIXTURES_DIR, { recursive: true });

// ── Types ────────────────────────────────────────────────────────────────────

interface MonthlyPL {
	month: number;
	monthName: string;
	tuitionFees: string;
	registrationFees: string;
	activitiesServices: string;
	examinationFees: string;
	revenueFromContracts: string;
	rentalIncome: string;
	totalRevenue: string;
	staffCosts: string;
	otherOperatingExpenses: string;
	depreciationAmortization: string;
	impairmentLosses: string;
	totalOperatingExpenses: string;
	operatingProfit: string;
	financeIncome: string;
	financeCosts: string;
	netFinance: string;
	profitBeforeZakat: string;
	estimatedZakat: string;
	netProfit: string;
}

interface ConsolidatedBudget {
	sheets: Array<{ name: string; rowCount: number; columnCount: number }>;
	ifrsMapping: {
		totalRevenueLines: number;
		totalStaffCostLines: number;
		totalOpexLines: number;
	};
	monthlyPL: MonthlyPL[];
	annualTotals: {
		totalRevenue: string;
		totalStaffCosts: string;
		totalOperatingExpenses: string;
		operatingProfit: string;
		netProfit: string;
	};
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function cellVal(cell: ExcelJS.Cell): string {
	if (cell.value === null || cell.value === undefined) return '';
	if (typeof cell.value === 'object' && 'result' in cell.value) {
		return String(cell.value.result ?? '');
	}
	return String(cell.value);
}

function dec(n: number, places: number = 2): string {
	return n.toFixed(places);
}

function writeFixture(name: string, data: unknown): void {
	const path = resolve(FIXTURES_DIR, name);
	writeFileSync(path, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
	// eslint-disable-next-line no-console
	console.log(`  Written: ${path}`);
}

const MONTH_NAMES = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

// ── Parsers ──────────────────────────────────────────────────────────────────

function countIFRSMappingLines(sheet: ExcelJS.Worksheet): {
	totalRevenueLines: number;
	totalStaffCostLines: number;
	totalOpexLines: number;
} {
	let revenueLines = 0;
	let staffLines = 0;
	let opexLines = 0;
	let currentSection = '';

	for (let r = 5; r <= sheet.rowCount; r++) {
		const row = sheet.getRow(r);
		const c1 = cellVal(row.getCell(1)).trim();
		const c2 = cellVal(row.getCell(2)).trim();

		// Section detection
		if (c1.includes('REVENUE FROM CONTRACTS')) {
			currentSection = 'revenue';
			continue;
		}
		if (c1.includes('RENTAL INCOME')) {
			currentSection = 'rental';
			continue;
		}
		if (c1.includes('STAFF COSTS')) {
			currentSection = 'staff';
			continue;
		}
		if (c1.includes('OTHER OPERATING EXPENSES')) {
			currentSection = 'opex';
			continue;
		}

		// Skip total/subtotal rows
		if (c2.toLowerCase().includes('total') || c2.toLowerCase().includes('subtotal')) continue;
		if (!c2) continue;

		switch (currentSection) {
			case 'revenue':
			case 'rental':
				revenueLines++;
				break;
			case 'staff':
				staffLines++;
				break;
			case 'opex':
				opexLines++;
				break;
		}
	}

	return {
		totalRevenueLines: revenueLines,
		totalStaffCostLines: staffLines,
		totalOpexLines: opexLines,
	};
}

function parseIncomeStatement(sheet: ExcelJS.Worksheet): MonthlyPL[] {
	// IFRS Income Statement layout:
	// Row 4: header — col 1 empty, cols 2-13 = Jan-Dec, col 14 = FY2026 Total
	// Row 6:  Tuition fees
	// Row 7:  Registration & re-registration fees
	// Row 8:  Activities & services
	// Row 9:  Examination fees
	// Row 10: Revenue from contracts with customers
	// Row 11: Rental income
	// Row 12: Total Revenue
	// Row 15: Staff costs (negative)
	// Row 16: Other operating expenses (negative)
	// Row 17: Depreciation & amortization (negative)
	// Row 18: Impairment losses (negative)
	// Row 19: Total Operating Expenses (negative)
	// Row 21: OPERATING PROFIT / (LOSS)
	// Row 24: Finance income
	// Row 25: Finance costs
	// Row 26: Net Finance Income / (Cost)
	// Row 28: PROFIT / (LOSS) BEFORE ZAKAT
	// Row 29: Estimated Zakat (2.5%)
	// Row 31: NET PROFIT / (LOSS) FOR THE PERIOD

	// Build a row-label-to-row-number map by scanning data rows only (1-31).
	// Notes start at row 33 and contain keywords like "Impairment", "Finance Costs"
	// that would produce false matches if scanned.
	const rowMap: Record<string, number> = {};
	const MAX_DATA_ROW = 31;
	for (let r = 1; r <= Math.min(sheet.rowCount, MAX_DATA_ROW); r++) {
		const row = sheet.getRow(r);
		const label = cellVal(row.getCell(1)).trim().toLowerCase();
		if (!label) continue;

		// Match in specificity order — more specific patterns first
		if (label.includes('tuition fees')) rowMap['tuition'] = r;
		else if (label.includes('registration') && label.includes('fees')) rowMap['registration'] = r;
		else if (label.includes('activities') && label.includes('services')) rowMap['activities'] = r;
		else if (label.includes('examination fees')) rowMap['examination'] = r;
		else if (label.includes('revenue from contracts')) rowMap['revenueContracts'] = r;
		else if (label.includes('rental income')) rowMap['rental'] = r;
		else if (label.includes('total revenue')) rowMap['totalRevenue'] = r;
		else if (label.includes('staff costs')) rowMap['staffCosts'] = r;
		else if (label.includes('other operating expenses')) rowMap['otherOpex'] = r;
		else if (label.includes('depreciation')) rowMap['depreciation'] = r;
		else if (label.includes('impairment')) rowMap['impairment'] = r;
		else if (label.includes('total operating expenses')) rowMap['totalOpex'] = r;
		else if (label.includes('operating profit') || label.includes('operating loss'))
			rowMap['operatingProfit'] = r;
		else if (label.includes('finance income') && !label.includes('net'))
			rowMap['financeIncome'] = r;
		else if (label.includes('finance costs')) rowMap['financeCosts'] = r;
		else if (label.includes('net finance')) rowMap['netFinance'] = r;
		else if (label.includes('profit') && label.includes('before zakat'))
			rowMap['profitBeforeZakat'] = r;
		else if (label.includes('zakat')) rowMap['zakat'] = r;
		else if (label.includes('net profit') || label.includes('net loss')) rowMap['netProfit'] = r;
	}

	// eslint-disable-next-line no-console
	console.log('  Row map:', JSON.stringify(rowMap));

	const results: MonthlyPL[] = [];

	// Cols 2-13 = Jan-Dec (months 1-12)
	for (let m = 1; m <= 12; m++) {
		const col = m + 1; // col 2 = Jan

		const getVal = (key: string): number => {
			const r = rowMap[key];
			if (!r) return 0;
			return cellNum(sheet.getRow(r).getCell(col));
		};

		results.push({
			month: m,
			monthName: MONTH_NAMES[m - 1]!,
			tuitionFees: dec(getVal('tuition')),
			registrationFees: dec(getVal('registration')),
			activitiesServices: dec(getVal('activities')),
			examinationFees: dec(getVal('examination')),
			revenueFromContracts: dec(getVal('revenueContracts')),
			rentalIncome: dec(getVal('rental')),
			totalRevenue: dec(getVal('totalRevenue')),
			staffCosts: dec(getVal('staffCosts')),
			otherOperatingExpenses: dec(getVal('otherOpex')),
			depreciationAmortization: dec(getVal('depreciation')),
			impairmentLosses: dec(getVal('impairment')),
			totalOperatingExpenses: dec(getVal('totalOpex')),
			operatingProfit: dec(getVal('operatingProfit')),
			financeIncome: dec(getVal('financeIncome')),
			financeCosts: dec(getVal('financeCosts')),
			netFinance: dec(getVal('netFinance')),
			profitBeforeZakat: dec(getVal('profitBeforeZakat')),
			estimatedZakat: dec(getVal('zakat')),
			netProfit: dec(getVal('netProfit')),
		});
	}

	return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	// eslint-disable-next-line no-console
	console.log('=== Consolidated Budget Parser ===');
	// eslint-disable-next-line no-console
	console.log(`Reading: ${EXCEL_PATH}\n`);

	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(EXCEL_PATH);

	// 1. Catalog sheets
	const sheetList: Array<{ name: string; rowCount: number; columnCount: number }> = [];
	workbook.eachSheet((sheet) => {
		sheetList.push({
			name: sheet.name,
			rowCount: sheet.rowCount,
			columnCount: sheet.columnCount,
		});
		// eslint-disable-next-line no-console
		console.log(`  Sheet: "${sheet.name}" — ${sheet.rowCount} rows, ${sheet.columnCount} cols`);
	});

	// 2. Count IFRS Mapping line items
	const mappingSheet = workbook.getWorksheet('IFRS Mapping');
	const ifrsMapping = mappingSheet
		? countIFRSMappingLines(mappingSheet)
		: { totalRevenueLines: 0, totalStaffCostLines: 0, totalOpexLines: 0 };
	// eslint-disable-next-line no-console
	console.log(
		`\n  IFRS Mapping: ${ifrsMapping.totalRevenueLines} revenue lines, ${ifrsMapping.totalStaffCostLines} staff cost lines, ${ifrsMapping.totalOpexLines} opex lines`
	);

	// 3. Parse IFRS Income Statement
	const isSheet = workbook.getWorksheet('IFRS Income Statement');
	const monthlyPL = isSheet ? parseIncomeStatement(isSheet) : [];
	// eslint-disable-next-line no-console
	console.log(`  Income Statement: ${monthlyPL.length} months parsed`);

	// 4. Compute annual totals from column 14 (FY2026 Total)
	let annualTotals = {
		totalRevenue: '0.00',
		totalStaffCosts: '0.00',
		totalOperatingExpenses: '0.00',
		operatingProfit: '0.00',
		netProfit: '0.00',
	};

	if (isSheet) {
		// Read FY2026 total column (col 14)
		const getAnnual = (label: string): number => {
			for (let r = 1; r <= isSheet.rowCount; r++) {
				const row = isSheet.getRow(r);
				const c1 = cellVal(row.getCell(1)).trim().toLowerCase();
				if (c1.includes(label)) {
					return cellNum(row.getCell(14));
				}
			}
			return 0;
		};

		annualTotals = {
			totalRevenue: dec(getAnnual('total revenue')),
			totalStaffCosts: dec(getAnnual('staff costs')),
			totalOperatingExpenses: dec(getAnnual('total operating expenses')),
			operatingProfit: dec(getAnnual('operating profit')),
			netProfit: dec(getAnnual('net profit')),
		};
	}

	// 5. Assemble and write
	const consolidated: ConsolidatedBudget = {
		sheets: sheetList,
		ifrsMapping,
		monthlyPL,
		annualTotals,
	};

	// eslint-disable-next-line no-console
	console.log('\n=== Writing Fixture ===');
	writeFixture('fy2026-expected-consolidated.json', consolidated);

	// 6. Summary
	// eslint-disable-next-line no-console
	console.log('\n=== Budget P&L Summary ===');
	// eslint-disable-next-line no-console
	console.log(`Annual Total Revenue: ${annualTotals.totalRevenue} SAR`);
	// eslint-disable-next-line no-console
	console.log(`Annual Staff Costs: ${annualTotals.totalStaffCosts} SAR`);
	// eslint-disable-next-line no-console
	console.log(`Annual Total OpEx: ${annualTotals.totalOperatingExpenses} SAR`);
	// eslint-disable-next-line no-console
	console.log(`Annual Operating Profit: ${annualTotals.operatingProfit} SAR`);
	// eslint-disable-next-line no-console
	console.log(`Annual Net Profit: ${annualTotals.netProfit} SAR`);

	// Monthly detail
	// eslint-disable-next-line no-console
	console.log('\n=== Monthly Breakdown ===');
	for (const m of monthlyPL) {
		// eslint-disable-next-line no-console
		console.log(
			`  ${m.monthName}: Revenue=${m.totalRevenue} | Staff=${m.staffCosts} | OpEx=${m.totalOperatingExpenses} | Profit=${m.operatingProfit}`
		);
	}
}

main().catch((err) => {
	// eslint-disable-next-line no-console
	console.error('Fatal error:', err);
	process.exit(1);
});
