import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { generateExcel } from './excel-generator.js';
import type { ReportData } from './report-data-loader.js';

async function loadWorkbook(buf: Awaited<ReturnType<typeof generateExcel>>) {
	const wb = new ExcelJS.Workbook();
	// ExcelJS types expect Node Buffer but we get Buffer<ArrayBufferLike>
	await wb.xlsx.load(buf as never);
	return wb;
}

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
	return {
		versionName: 'Budget FY2026',
		fiscalYear: 'FY2026',
		generatedAt: '2026-03-15T10:00:00.000Z',
		sections: [],
		...overrides,
	};
}

describe('generateExcel', () => {
	it('generates a valid Excel buffer with metadata sheet', async () => {
		const data = makeReportData();
		const buffer = await generateExcel(data);

		expect(buffer).toBeInstanceOf(Buffer);
		expect(buffer.length).toBeGreaterThan(0);

		// Parse the generated workbook to verify structure
		const wb = await loadWorkbook(buffer);

		// Should have at least the metadata sheet
		const metaSheet = wb.getWorksheet('Report Info');
		expect(metaSheet).toBeTruthy();

		// Check metadata content
		const versionRow = metaSheet!.getRow(1);
		expect(versionRow.getCell(1).value).toBe('Version');
		expect(versionRow.getCell(2).value).toBe('Budget FY2026');

		const fyRow = metaSheet!.getRow(2);
		expect(fyRow.getCell(1).value).toBe('Fiscal Year');
		expect(fyRow.getCell(2).value).toBe('FY2026');
	});

	it('creates worksheets for each section', async () => {
		const data = makeReportData({
			sections: [
				{
					title: 'Revenue Summary',
					headers: ['Grade', 'Jan', 'Feb'],
					rows: [
						['PS', '10000.00', '10500.00'],
						['MS', '8000.00', '8200.00'],
					],
				},
				{
					title: 'Staff Costs',
					headers: ['Employee', 'Jan', 'Feb'],
					rows: [['Alice', '5000.00', '5000.00']],
				},
			],
		});

		const buffer = await generateExcel(data);
		const wb = await loadWorkbook(buffer);

		// Should have 2 data sheets + 1 metadata sheet
		expect(wb.worksheets.length).toBe(3);

		const revenueSheet = wb.getWorksheet('Revenue Summary');
		expect(revenueSheet).toBeTruthy();
		// Header row + 2 data rows = 3 rows
		expect(revenueSheet!.rowCount).toBe(3);

		const staffSheet = wb.getWorksheet('Staff Costs');
		expect(staffSheet).toBeTruthy();
		expect(staffSheet!.rowCount).toBe(2); // header + 1 data row
	});

	it('truncates sheet names to 31 characters', async () => {
		const data = makeReportData({
			sections: [
				{
					title: 'This Is A Very Long Section Title That Exceeds Thirty One Characters',
					headers: ['Col'],
					rows: [['Value']],
				},
			],
		});

		const buffer = await generateExcel(data);
		const wb = await loadWorkbook(buffer);

		// ExcelJS limit is 31 chars for sheet names
		const sheets = wb.worksheets.map((s) => s.name);
		const dataSheet = sheets.find((s) => s !== 'Report Info');
		expect(dataSheet).toBeTruthy();
		expect(dataSheet!.length).toBeLessThanOrEqual(31);
	});

	it('bolds TOTAL rows in data sections', async () => {
		const data = makeReportData({
			sections: [
				{
					title: 'Test Section',
					headers: ['Item', 'Amount'],
					rows: [
						['Item A', '100.00'],
						['TOTAL', '100.00'],
					],
				},
			],
		});

		const buffer = await generateExcel(data);
		const wb = await loadWorkbook(buffer);

		const sheet = wb.getWorksheet('Test Section');
		expect(sheet).toBeTruthy();

		// Row 1 = header, Row 2 = Item A, Row 3 = TOTAL
		const totalRow = sheet!.getRow(3);
		expect(totalRow.font?.bold).toBe(true);
	});

	it('handles empty sections array', async () => {
		const data = makeReportData({ sections: [] });

		const buffer = await generateExcel(data);
		const wb = await loadWorkbook(buffer);

		// Only metadata sheet
		expect(wb.worksheets.length).toBe(1);
		expect(wb.worksheets[0]!.name).toBe('Report Info');
	});
});
