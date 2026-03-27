import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import type {
	TeachingRequirementsResponse,
	EmployeeListResponse,
	StaffingSummaryResponse,
	StaffCostBreakdown,
	StaffCostResponse,
	CategoryCostData,
	StaffingSettingsResponse,
	ServiceProfileOverridesResponse,
	CostAssumptionsResponse,
	LyceeGroupAssumptionsResponse,
	TeachingRequirementSourcesResponse,
} from '../../hooks/use-staffing';
import type { CapacityResult } from '@budfin/types';
import { apiClient, ApiError } from '../../lib/api-client';
import { sanitizeFilename, triggerDownload } from '../../lib/download-utils';
import { BAND_LABELS } from '../../lib/band-styles';
import {
	buildStaffingWorkbook,
	type KpiValues,
	type StaffingWorkbookData,
} from '../../lib/staffing-export-workbook';
import { toast } from '../ui/toast-state';
import { Button } from '../ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../ui/dropdown-menu';

// ── Re-export KpiValues so the page can use the same type ───────────────────

export type { KpiValues };

// ── Props ───────────────────────────────────────────────────────────────────

interface StaffingExportButtonProps {
	versionId: number;
	data: TeachingRequirementsResponse;
	employeesData: EmployeeListResponse;
	summaryData: StaffingSummaryResponse | undefined;
	versionName: string;
	kpiValues: KpiValues;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function downloadWorkbook(
	workbook: import('exceljs').Workbook,
	versionName: string,
	dateStamp: string
) {
	const buffer = await workbook.xlsx.writeBuffer();
	const bytes =
		buffer instanceof ArrayBuffer
			? new Uint8Array(buffer)
			: Uint8Array.from(new Uint8Array(buffer as ArrayBufferLike));
	const filename = `staffing-${sanitizeFilename(versionName)}-${dateStamp}.xlsx`;
	triggerDownload(
		filename,
		new Blob([bytes], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		})
	);
}

// ── Band constants (for single-sheet export) ────────────────────────────────

const BAND_ORDER: Record<string, number> = {
	MATERNELLE: 1,
	ELEMENTAIRE: 2,
	COLLEGE: 3,
	LYCEE: 4,
};

const BAND_COLORS: Record<string, string> = {
	MATERNELLE: 'FF6366F1',
	ELEMENTAIRE: 'FF22C55E',
	COLLEGE: 'FFF59E0B',
	LYCEE: 'FFEF4444',
};

// ── Component ───────────────────────────────────────────────────────────────

export function StaffingExportButton({
	versionId,
	data,
	employeesData,
	summaryData,
	versionName,
	kpiValues,
}: StaffingExportButtonProps) {
	const [isExporting, setIsExporting] = useState(false);

	// ── Single-sheet export (preserved original behavior) ───────────────
	async function handleExportSingleSheet() {
		if (typeof window === 'undefined') return;
		setIsExporting(true);

		try {
			const ExcelJs = await import('exceljs');
			const workbook = new ExcelJs.Workbook();
			const dateStamp = format(new TZDate(Date.now(), 'Asia/Riyadh'), 'yyyy-MM-dd');

			buildSingleSheetExport(workbook, data, versionName, kpiValues, dateStamp);
			await downloadWorkbook(workbook, versionName, dateStamp);
		} catch (err) {
			toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			setIsExporting(false);
		}
	}

	// ── Full workbook export (8 sheets, on-demand fetch) ────────────────
	async function handleExportFullWorkbook() {
		if (typeof window === 'undefined' || !summaryData) return;
		setIsExporting(true);

		try {
			const dateStamp = format(new TZDate(Date.now(), 'Asia/Riyadh'), 'yyyy-MM-dd');

			// Fetch additional data in parallel
			interface CapacityResultsResponse {
				results: CapacityResult[];
			}

			const [
				settingsRes,
				profilesRes,
				costAssumptionsRes,
				lyceeGroupsRes,
				capacityRes,
				demandSourcesRes,
				staffCostsRes,
				categoryCostsRes,
			] = await Promise.all([
				apiClient<StaffingSettingsResponse>(`/versions/${versionId}/staffing-settings`),
				apiClient<ServiceProfileOverridesResponse>(
					`/versions/${versionId}/service-profile-overrides`
				),
				apiClient<CostAssumptionsResponse>(`/versions/${versionId}/cost-assumptions`),
				apiClient<LyceeGroupAssumptionsResponse>(`/versions/${versionId}/lycee-group-assumptions`),
				apiClient<CapacityResultsResponse>(`/versions/${versionId}/enrollment/capacity-results`),
				apiClient<TeachingRequirementSourcesResponse>(
					`/versions/${versionId}/teaching-requirement-sources`
				),
				apiClient<StaffCostResponse>(
					`/versions/${versionId}/staff-costs?group_by=employee&include_breakdown=true`
				),
				apiClient<CategoryCostData>(`/versions/${versionId}/category-costs`),
			]);

			// Filter capacity results to AY2 only
			const ay2Results = capacityRes.results.filter((r) => r.academicPeriod === 'AY2');

			const workbookData: StaffingWorkbookData = {
				versionName,
				exportDate: dateStamp,
				settings: settingsRes.data,
				serviceProfiles: profilesRes.data,
				costAssumptions: costAssumptionsRes.data,
				lyceeGroups: lyceeGroupsRes.data,
				enrollmentResults: ay2Results,
				demandSources: demandSourcesRes.data,
				teachingReqLines: data.lines,
				teachingReqTotals: data.totals,
				employees: employeesData.data,
				costBreakdown: (staffCostsRes.breakdown ?? []) as StaffCostBreakdown[],
				categoryCosts: categoryCostsRes,
				kpiValues,
				summaryData,
			};

			const ExcelJs = await import('exceljs');
			const workbook = new ExcelJs.Workbook();

			await buildStaffingWorkbook(workbook, workbookData);
			await downloadWorkbook(workbook, `${versionName}-full`, dateStamp);
		} catch (err) {
			if (err instanceof ApiError && err.code === 'STALE_DATA') {
				toast.error('Staffing data is stale. Recalculate before exporting.');
			} else {
				toast.error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
			}
		} finally {
			setIsExporting(false);
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="outline" size="sm" disabled={isExporting}>
					{isExporting ? (
						<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
					) : (
						<Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
					)}
					{isExporting ? 'Exporting...' : 'Export'}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem disabled={isExporting} onSelect={() => void handleExportSingleSheet()}>
					Export Teaching Requirements
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={isExporting || !summaryData}
					onSelect={() => void handleExportFullWorkbook()}
				>
					Export Full Workbook
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// ── Single-sheet builder (original export, preserved) ───────────────────────

type ExcelRow = import('exceljs').Row;

const DARK_BG = 'FF1A1A2E';
const LIGHT_GRAY_BG = 'FFF3F4F6';
const WHITE = 'FFFFFFFF';

function buildSingleSheetExport(
	workbook: import('exceljs').Workbook,
	data: TeachingRequirementsResponse,
	versionName: string,
	kpiValues: KpiValues,
	dateStamp: string
) {
	const ws = workbook.addWorksheet('Teaching Requirements');

	ws.columns = [
		{ key: 'A', width: 28 },
		{ key: 'B', width: 14 },
		{ key: 'C', width: 10 },
		{ key: 'D', width: 10 },
		{ key: 'E', width: 10 },
		{ key: 'F', width: 10 },
		{ key: 'G', width: 12 },
		{ key: 'H', width: 12 },
		{ key: 'I', width: 10 },
		{ key: 'J', width: 12 },
		{ key: 'K', width: 10 },
		{ key: 'L', width: 14 },
		{ key: 'M', width: 10 },
		{ key: 'N', width: 16 },
		{ key: 'O', width: 16 },
	];

	// Row 1: Title
	const titleRow = ws.addRow(['BudFin - Teaching Requirements']);
	ws.mergeCells('A1:O1');
	ssTitleRow(titleRow);

	// Row 2: Version + date
	const infoRow = ws.addRow([`Version: ${versionName}`, '', '', `Exported: ${dateStamp}`]);
	ws.mergeCells('A2:C2');
	ws.mergeCells('D2:O2');
	ssInfoRow(infoRow);

	// Row 3: blank
	ws.addRow([]);

	// Row 4-5: KPI ribbon
	const kpiLabels = [
		'Total Headcount',
		'',
		'FTE Gap',
		'',
		'Staff Cost (SAR)',
		'',
		'HSA Budget (SAR)',
		'',
		'H/E Ratio',
		'',
		'Recharge Cost (SAR)',
	];
	const kpiLabelRow = ws.addRow(kpiLabels);
	ws.mergeCells('A4:B4');
	ws.mergeCells('C4:D4');
	ws.mergeCells('E4:F4');
	ws.mergeCells('G4:H4');
	ws.mergeCells('I4:J4');
	ws.mergeCells('K4:O4');
	ssKpiLabelRow(kpiLabelRow);

	const kpiValueRow = ws.addRow([
		kpiValues.totalHeadcount,
		'',
		kpiValues.fteGap,
		'',
		kpiValues.staffCost,
		'',
		kpiValues.hsaBudget,
		'',
		kpiValues.heRatio,
		'',
		kpiValues.rechargeCost,
	]);
	ws.mergeCells('A5:B5');
	ws.mergeCells('C5:D5');
	ws.mergeCells('E5:F5');
	ws.mergeCells('G5:H5');
	ws.mergeCells('I5:J5');
	ws.mergeCells('K5:O5');
	ssKpiValueRow(kpiValueRow);

	// Row 6: blank
	ws.addRow([]);

	// Row 7: Column headers
	const headers = [
		'LINE',
		'PROFILE',
		'UNITS',
		'HRS/W',
		'ORS',
		'EFF.ORS',
		'RAW FTE',
		'PLAN FTE',
		'REC.POS',
		'COVERED',
		'GAP',
		'STATUS',
		'STAFF',
		'DIRECT COST',
		'HSA COST',
	];
	const headerRow = ws.addRow(headers);
	ssHeaderRow(headerRow);

	ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 7, topLeftCell: 'A8' }];

	// Data rows grouped by band
	const lines = data.lines;
	const bandGroups = new Map<string, typeof lines>();
	for (const line of lines) {
		const group = bandGroups.get(line.band);
		if (group) {
			group.push(line);
		} else {
			bandGroups.set(line.band, [line]);
		}
	}

	const sortedBands = [...bandGroups.keys()].sort(
		(a, b) => (BAND_ORDER[a] ?? 99) - (BAND_ORDER[b] ?? 99)
	);

	const subtotalRowNumbers: number[] = [];

	for (const band of sortedBands) {
		const bandLines = bandGroups.get(band)!;
		const bandLabel = BAND_LABELS[band] ?? band;
		const bandColor = BAND_COLORS[band] ?? 'FF888888';

		const bandHeaderRow = ws.addRow([`${bandLabel} (${bandLines.length})`]);
		ws.mergeCells(`A${bandHeaderRow.number}:O${bandHeaderRow.number}`);
		ssBandHeaderRow(bandHeaderRow, bandColor);

		const firstDataRow = ws.rowCount + 1;

		for (const line of bandLines) {
			const r = ws.rowCount + 1;
			const row = ws.addRow([
				line.lineLabel,
				line.serviceProfileCode,
				line.totalDriverUnits,
				parseFloat(line.totalWeeklyHours),
				parseFloat(line.baseOrs),
				parseFloat(line.effectiveOrs),
				{ formula: `D${r}/E${r}`, result: parseFloat(line.requiredFteRaw) },
				{ formula: `D${r}/F${r}`, result: parseFloat(line.requiredFtePlanned) },
				{ formula: `CEILING(G${r},1)`, result: line.recommendedPositions },
				parseFloat(line.coveredFte),
				{ formula: `J${r}-G${r}`, result: parseFloat(line.gapFte) },
				{
					formula: `IF(J${r}=0,"UNCOVERED",IF(K${r}<-0.25,"DEFICIT",IF(K${r}>0.25,"SURPLUS","COVERED")))`,
					result: line.coverageStatus,
				},
				line.assignedStaffCount,
				parseFloat(line.directCostAnnual),
				parseFloat(line.hsaCostAnnual),
			]);
			ssDataRow(row);
		}

		const lastDataRow = ws.rowCount;
		const sr = ws.rowCount + 1;

		const subtotalRow = ws.addRow([
			`${bandLabel} Subtotal`,
			'',
			'',
			'',
			'',
			'',
			{ formula: `SUM(G${firstDataRow}:G${lastDataRow})` },
			'',
			'',
			{ formula: `SUM(J${firstDataRow}:J${lastDataRow})` },
			{ formula: `SUM(K${firstDataRow}:K${lastDataRow})` },
			'',
			'',
			{ formula: `SUM(N${firstDataRow}:N${lastDataRow})` },
			{ formula: `SUM(O${firstDataRow}:O${lastDataRow})` },
		]);
		ssSubtotalRow(subtotalRow);
		subtotalRowNumbers.push(sr);
	}

	// Grand Total
	const subtotalRefs = (col: string) => subtotalRowNumbers.map((r) => `${col}${r}`).join('+');

	const grandTotalRow = ws.addRow([
		'Grand Total',
		'',
		'',
		'',
		'',
		'',
		{ formula: subtotalRefs('G') },
		'',
		'',
		{ formula: subtotalRefs('J') },
		{ formula: subtotalRefs('K') },
		'',
		'',
		{ formula: subtotalRefs('N') },
		{ formula: subtotalRefs('O') },
	]);
	ssGrandTotalRow(grandTotalRow);

	// Number formats
	ws.getColumn('C').numFmt = '0';
	ws.getColumn('D').numFmt = '0.00';
	ws.getColumn('E').numFmt = '0.00';
	ws.getColumn('F').numFmt = '0.00';
	ws.getColumn('G').numFmt = '0.00';
	ws.getColumn('H').numFmt = '0.00';
	ws.getColumn('I').numFmt = '0';
	ws.getColumn('J').numFmt = '0.00';
	ws.getColumn('K').numFmt = '0.00';
	ws.getColumn('M').numFmt = '0';
	ws.getColumn('N').numFmt = '#,##0';
	ws.getColumn('O').numFmt = '#,##0';

	// Conditional formatting: GAP (K)
	const dataStartRow = 8;
	const dataEndRow = ws.rowCount;

	ws.addConditionalFormatting({
		ref: `K${dataStartRow}:K${dataEndRow}`,
		rules: [
			{
				type: 'cellIs',
				operator: 'lessThan',
				priority: 1,
				formulae: ['0'],
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } },
					font: { color: { argb: 'FFDC2626' } },
				},
			},
			{
				type: 'cellIs',
				operator: 'greaterThan' as const,
				priority: 2,
				formulae: ['-0.005'],
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } },
					font: { color: { argb: 'FF16A34A' } },
				},
			},
		],
	});

	// Conditional formatting: STATUS (L)
	ws.addConditionalFormatting({
		ref: `L${dataStartRow}:L${dataEndRow}`,
		rules: [
			{
				type: 'containsText',
				operator: 'containsText',
				text: 'DEFICIT',
				priority: 3,
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFEE2E2' } },
					font: { color: { argb: 'FFDC2626' }, bold: true },
				},
			},
			{
				type: 'containsText',
				operator: 'containsText',
				text: 'UNCOVERED',
				priority: 4,
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF7ED' } },
					font: { color: { argb: 'FFEA580C' }, bold: true },
				},
			},
			{
				type: 'containsText',
				operator: 'containsText',
				text: 'SURPLUS',
				priority: 5,
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFEFF6FF' } },
					font: { color: { argb: 'FF2563EB' }, bold: true },
				},
			},
			{
				type: 'containsText',
				operator: 'containsText',
				text: 'COVERED',
				priority: 6,
				style: {
					fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDCFCE7' } },
					font: { color: { argb: 'FF16A34A' }, bold: true },
				},
			},
		],
	});

	ws.pageSetup = {
		orientation: 'landscape',
		fitToPage: true,
		fitToWidth: 1,
		fitToHeight: 0,
		paperSize: 9,
	};
}

// ── Single-sheet style helpers (prefixed ss to avoid collision) ──────────────

function ssTitleRow(row: ExcelRow) {
	row.height = 28;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 14, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
		cell.alignment = { vertical: 'middle' };
	});
}

function ssInfoRow(row: ExcelRow) {
	row.eachCell((cell) => {
		cell.font = { size: 10, color: { argb: 'FF6B7280' } };
	});
}

function ssKpiLabelRow(row: ExcelRow) {
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 9, color: { argb: 'FF6B7280' } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY_BG } };
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
		cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
	});
}

function ssKpiValueRow(row: ExcelRow) {
	row.height = 22;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 12 };
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
		cell.border = { bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } } };
	});
}

function ssHeaderRow(row: ExcelRow) {
	row.height = 24;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 10, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
		cell.alignment = { horizontal: 'center', vertical: 'middle' };
		cell.border = { bottom: { style: 'thin', color: { argb: 'FF374151' } } };
	});
}

function ssBandHeaderRow(row: ExcelRow, bandColor: string) {
	row.height = 22;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 10 };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY_BG } };
		cell.border = {
			left: { style: 'thick', color: { argb: bandColor } },
			bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
		};
	});
}

function ssDataRow(row: ExcelRow) {
	row.eachCell((cell) => {
		cell.font = { size: 10 };
		cell.alignment = { vertical: 'middle' };
		cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
	});
}

function ssSubtotalRow(row: ExcelRow) {
	row.height = 22;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 10 };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GRAY_BG } };
		cell.alignment = { vertical: 'middle' };
		cell.border = {
			top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
			bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
		};
	});
}

function ssGrandTotalRow(row: ExcelRow) {
	row.height = 26;
	row.eachCell((cell) => {
		cell.font = { bold: true, size: 11, color: { argb: WHITE } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
		cell.alignment = { vertical: 'middle' };
		cell.border = { top: { style: 'medium', color: { argb: 'FF374151' } } };
	});
}
