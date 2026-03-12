import { Download } from 'lucide-react';
import type { EnrollmentMasterGridRow } from '@budfin/types';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

function buildCsv(
	rows: EnrollmentMasterGridRow[],
	{
		versionName,
		activeFilters,
		isFiltered,
	}: {
		versionName: string;
		activeFilters: string[];
		isFiltered: boolean;
	}
): string {
	const timestamp = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Asia/Riyadh',
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date());

	const filterLabel = activeFilters.length > 0 ? activeFilters.join(', ') : 'None';
	const metadataRow = `Version: ${versionName} | Exported: ${timestamp} | Filters: ${filterLabel}`;

	const header = ['Grade', 'Band', 'AY1', 'Ret%', 'Laterals', 'AY2', 'Sections', 'Util%', 'Status'];

	const dataRows = rows.map((row) =>
		[
			row.gradeName,
			row.band,
			row.ay1Headcount,
			row.gradeLevel === 'PS' ? '--' : `${Math.round(row.retentionRate * 100)}%`,
			row.gradeLevel === 'PS' ? '--' : row.lateralEntry,
			row.ay2Headcount,
			row.sectionsNeeded,
			`${row.utilization.toFixed(1)}%`,
			row.alert ?? 'OK',
		].join(',')
	);

	const totalAy1 = rows.reduce((sum, r) => sum + r.ay1Headcount, 0);
	const totalAy2 = rows.reduce((sum, r) => sum + r.ay2Headcount, 0);
	const totalSections = rows.reduce((sum, r) => sum + r.sectionsNeeded, 0);
	const avgUtil =
		rows.length > 0 ? rows.reduce((sum, r) => sum + r.utilization, 0) / rows.length : 0;
	const totalLabel = isFiltered ? 'Filtered Total' : 'Total';
	const footerRow = [
		totalLabel,
		'',
		totalAy1,
		'',
		'',
		totalAy2,
		totalSections,
		`${avgUtil.toFixed(1)}%`,
		'',
	].join(',');

	return [metadataRow, header.join(','), ...dataRows, footerRow].join('\n');
}

function formatDateForFilename(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function ExportButton({
	rows,
	versionName,
	activeFilters,
	isFiltered,
	dirtyCount,
}: {
	rows: EnrollmentMasterGridRow[];
	versionName: string;
	activeFilters: string[];
	isFiltered: boolean;
	dirtyCount: number;
}) {
	const isDisabled = dirtyCount > 0;

	function handleExport() {
		if (typeof window === 'undefined' || isDisabled) {
			return;
		}

		const csv = buildCsv(rows, { versionName, activeFilters, isFiltered });
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = window.URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		const safeName = versionName.replace(/\s+/g, '-').toLowerCase();
		anchor.href = url;
		anchor.download = `enrollment-${safeName}-${formatDateForFilename()}.csv`;
		anchor.click();
		window.URL.revokeObjectURL(url);
	}

	const button = (
		<Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={isDisabled}>
			<Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
			Export CSV
		</Button>
	);

	if (!isDisabled) {
		return button;
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{button}</TooltipTrigger>
				<TooltipContent>Recalculate before exporting</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
