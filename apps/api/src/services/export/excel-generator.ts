import ExcelJS from 'exceljs';
import type { ReportData } from './report-data-loader.js';

export async function generateExcel(data: ReportData): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'BudFin';
	workbook.created = new Date(data.generatedAt);

	for (const section of data.sections) {
		// Excel worksheet names are limited to 31 characters
		const sheetName = section.title.substring(0, 31);
		const sheet = workbook.addWorksheet(sheetName);

		// Header row with styling
		const headerRow = sheet.addRow(section.headers);
		headerRow.font = { bold: true };
		headerRow.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFE8E8E8' },
		};
		headerRow.border = {
			bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
		};

		// Data rows
		for (const row of section.rows) {
			const dataRow = sheet.addRow(row);

			// Bold the last (total) row if it starts with 'TOTAL'
			if (row[0]?.toUpperCase().startsWith('TOTAL')) {
				dataRow.font = { bold: true };
				dataRow.border = {
					top: { style: 'thin', color: { argb: 'FF333333' } },
				};
			}
		}

		// Auto-fit column widths (estimate based on content)
		sheet.columns.forEach((col, idx) => {
			// First column (labels) gets more width
			if (idx === 0) {
				col.width = 30;
			} else {
				col.width = 15;
			}
		});

		// Freeze header row
		sheet.views = [{ state: 'frozen', ySplit: 1 }];
	}

	// Add a metadata sheet
	const metaSheet = workbook.addWorksheet('Report Info');
	metaSheet.addRow(['Version', data.versionName]);
	metaSheet.addRow(['Fiscal Year', data.fiscalYear]);
	metaSheet.addRow([
		'Generated',
		new Date(data.generatedAt).toLocaleDateString('en-GB', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}),
	]);
	metaSheet.addRow(['Sections', String(data.sections.length)]);
	metaSheet.getColumn(1).width = 15;
	metaSheet.getColumn(1).font = { bold: true };
	metaSheet.getColumn(2).width = 40;

	const buffer = await workbook.xlsx.writeBuffer();
	return Buffer.from(buffer);
}
