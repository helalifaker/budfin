import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import type { RevenueViewMode } from '@budfin/types';
import { Button } from '../ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
	getVisibleRevenueMonths,
	REVENUE_MONTH_LABELS,
	type RevenueForecastGridRow,
	type RevenueForecastPeriod,
} from '../../lib/revenue-workspace';

function sanitizeFilename(value: string) {
	return value.replace(/\s+/g, '-').toLowerCase();
}

function buildFilenameBase({
	versionName,
	viewMode,
	period,
	bandFilter,
}: {
	versionName: string;
	viewMode: RevenueViewMode;
	period: RevenueForecastPeriod;
	bandFilter: string;
}) {
	const parts = ['revenue', sanitizeFilename(versionName), viewMode];

	if (period !== 'both') {
		parts.push(period);
	}

	if (bandFilter !== 'ALL') {
		parts.push(sanitizeFilename(bandFilter));
	}

	const dateStamp = format(new TZDate(Date.now(), 'Asia/Riyadh'), 'yyyy-MM-dd');
	parts.push(dateStamp);

	return parts.join('-');
}

function buildExportRows({
	rows,
	period,
}: {
	rows: RevenueForecastGridRow[];
	period: RevenueForecastPeriod;
}) {
	const visibleMonths = getVisibleRevenueMonths(period);
	return rows.map((row) => [
		row.label,
		...visibleMonths.map((monthIndex) => row.monthlyAmounts[monthIndex] ?? '0.0000'),
		row.annualTotal,
		row.percentageOfRevenue,
	]);
}

function triggerDownload(filename: string, blob: Blob) {
	const url = window.URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	window.URL.revokeObjectURL(url);
}

export function RevenueExportButton({
	rows,
	viewMode,
	period,
	versionName,
	bandFilter = 'ALL',
}: {
	rows: RevenueForecastGridRow[];
	viewMode: RevenueViewMode;
	period: RevenueForecastPeriod;
	versionName: string;
	bandFilter?: string;
}) {
	const visibleMonths = getVisibleRevenueMonths(period);
	const headers = [
		'Label',
		...visibleMonths.map((monthIndex) => REVENUE_MONTH_LABELS[monthIndex]),
		'Annual',
		'% Rev',
	];

	async function handleExportCsv() {
		if (typeof window === 'undefined') {
			return;
		}

		const dataRows = buildExportRows({ rows, period });
		const csv = [headers.join(','), ...dataRows.map((row) => row.join(','))].join('\n');
		const basename = buildFilenameBase({ versionName, viewMode, period, bandFilter });
		triggerDownload(`${basename}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
	}

	async function handleExportXlsx() {
		if (typeof window === 'undefined') {
			return;
		}

		const ExcelJs = await import('exceljs');
		const workbook = new ExcelJs.Workbook();
		const worksheet = workbook.addWorksheet('Revenue');
		worksheet.addRow(headers);
		for (const row of buildExportRows({ rows, period })) {
			worksheet.addRow(row);
		}
		const buffer = await workbook.xlsx.writeBuffer();
		const bytes =
			buffer instanceof ArrayBuffer
				? new Uint8Array(buffer)
				: Uint8Array.from(new Uint8Array(buffer as ArrayBufferLike));
		const basename = buildFilenameBase({ versionName, viewMode, period, bandFilter });
		triggerDownload(
			`${basename}.xlsx`,
			new Blob([bytes], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			})
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="outline" size="sm">
					<Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
					Export
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem onSelect={() => void handleExportCsv()}>Export CSV</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => void handleExportXlsx()}>Export XLSX</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
