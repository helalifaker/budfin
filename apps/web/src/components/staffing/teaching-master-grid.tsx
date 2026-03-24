import type React from 'react';
import { useMemo, useCallback } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import type { TeachingRequirementsResponse } from '../../hooks/use-staffing';
import {
	buildTeachingGridRows,
	filterTeachingRows,
	type BandFilter,
	type CoverageFilter,
	type TeachingGridRow,
	type ViewPreset,
} from '../../lib/staffing-workspace';
import { formatMoney } from '../../lib/format-money';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';
import { PlanningGrid } from '../data-grid/planning-grid';
import { BAND_LABELS, BAND_STYLES } from '../../lib/band-styles';
import { cn } from '../../lib/cn';
import { CoverageBadge, getGapTintClass } from './coverage-badges';

const COLUMN_VISIBILITY: Record<ViewPreset, Set<string>> = {
	Need: new Set([
		'lineLabel',
		'serviceProfileCode',
		'totalDriverUnits',
		'totalWeeklyHours',
		'baseOrs',
		'effectiveOrs',
		'requiredFteRaw',
		'requiredFtePlanned',
		'recommendedPositions',
	]),
	Coverage: new Set([
		'lineLabel',
		'serviceProfileCode',
		'totalDriverUnits',
		'totalWeeklyHours',
		'requiredFteRaw',
		'coveredFte',
		'gapFte',
		'coverageStatus',
		'assignedStaffCount',
	]),
	Cost: new Set(['lineLabel', 'directCostAnnual', 'hsaCostAnnual']),
	'Full View': new Set([
		'lineLabel',
		'serviceProfileCode',
		'totalDriverUnits',
		'totalWeeklyHours',
		'baseOrs',
		'effectiveOrs',
		'requiredFteRaw',
		'requiredFtePlanned',
		'recommendedPositions',
		'coveredFte',
		'gapFte',
		'coverageStatus',
		'assignedStaffCount',
		'directCostAnnual',
		'hsaCostAnnual',
	]),
};

export interface TeachingMasterGridProps {
	data: TeachingRequirementsResponse;
	viewPreset: ViewPreset;
	bandFilter: BandFilter;
	coverageFilter: CoverageFilter;
	selectedLineId: number | null;
}

const columnHelper = createColumnHelper<TeachingGridRow>();

export function TeachingMasterGrid({
	data,
	viewPreset,
	bandFilter,
	coverageFilter,
	selectedLineId,
}: TeachingMasterGridProps) {
	const selectRequirementLine = useStaffingSelectionStore((s) => s.selectRequirementLine);
	const allGridRows = useMemo(() => buildTeachingGridRows(data.lines), [data.lines]);
	const requirementRows = useMemo(
		() =>
			filterTeachingRows(
				allGridRows.filter((r) => r.rowType === 'requirement'),
				bandFilter,
				coverageFilter
			),
		[allGridRows, bandFilter, coverageFilter]
	);
	const visibleCols = COLUMN_VISIBILITY[viewPreset];

	const columns = useMemo(() => {
		const allColumns: ColumnDef<TeachingGridRow, unknown>[] = [
			columnHelper.accessor('lineLabel', {
				id: 'lineLabel',
				header: 'Line',
				size: 220,
				cell: ({ getValue }) => (
					<span className="font-medium text-(--text-primary)">{String(getValue())}</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('serviceProfileCode', {
				id: 'serviceProfileCode',
				header: 'Profile',
				size: 80,
				cell: ({ getValue }) => (
					<span className="text-center font-[family-name:var(--font-mono)] text-(--text-secondary)">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('totalDriverUnits', {
				id: 'totalDriverUnits',
				header: 'Units',
				size: 60,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('totalWeeklyHours', {
				id: 'totalWeeklyHours',
				header: 'Hrs/w',
				size: 70,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('baseOrs', {
				id: 'baseOrs',
				header: () => (
					<span title="Obligation Reglementaire de Service — base weekly teaching hours">ORS</span>
				),
				size: 55,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-muted)">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('effectiveOrs', {
				id: 'effectiveOrs',
				header: () => <span title="Effective ORS — base + HSA hours">Eff.ORS</span>,
				size: 65,
				cell: ({ row, getValue }) => {
					const isBold = String(getValue()) !== row.original.baseOrs;
					return (
						<span
							className={cn(
								'font-[family-name:var(--font-mono)] tabular-nums',
								isBold ? 'font-bold text-(--text-primary)' : 'text-(--text-muted)'
							)}
						>
							{String(getValue())}
						</span>
					);
				},
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('requiredFteRaw', {
				id: 'requiredFteRaw',
				header: () => <span title="Required FTE = total hours / base ORS">Raw FTE</span>,
				size: 75,
				cell: ({ getValue }) => (
					<span className="font-bold font-[family-name:var(--font-mono)] tabular-nums">
						{parseFloat(String(getValue())).toFixed(2)}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('requiredFtePlanned', {
				id: 'requiredFtePlanned',
				header: () => (
					<span title="Planned FTE = total hours / effective ORS (with HSA)">Plan FTE</span>
				),
				size: 75,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-muted)">
						{parseFloat(String(getValue())).toFixed(2)}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('recommendedPositions', {
				id: 'recommendedPositions',
				header: () => <span title="Recommended positions (Raw FTE rounded up)">Rec.Pos</span>,
				size: 65,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-muted)">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('coveredFte', {
				id: 'coveredFte',
				header: 'Covered',
				size: 75,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{parseFloat(String(getValue())).toFixed(2)}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('gapFte', {
				id: 'gapFte',
				header: 'Gap',
				size: 75,
				cell: ({ getValue }) => {
					const value = String(getValue());
					const num = parseFloat(value);
					return (
						<span
							data-column="gapFte"
							className={cn(
								'inline-block w-full rounded px-1 font-[family-name:var(--font-mono)] tabular-nums',
								getGapTintClass(value),
								num < 0 && 'text-(--delta-negative)',
								num > 0 && 'text-(--delta-positive)',
								num === 0 && 'text-(--delta-zero)'
							)}
							aria-label={`Gap: ${value} FTE`}
						>
							{num > 0 ? `+${num.toFixed(2)}` : num.toFixed(2)}
						</span>
					);
				},
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('coverageStatus', {
				id: 'coverageStatus',
				header: 'Status',
				size: 110,
				cell: ({ row }) => {
					if (row.original.rowType !== 'requirement') return null;
					return <CoverageBadge status={row.original.coverageStatus} gap={row.original.gapFte} />;
				},
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('assignedStaffCount', {
				id: 'assignedStaffCount',
				header: 'Staff',
				size: 55,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{String(getValue())}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('directCostAnnual', {
				id: 'directCostAnnual',
				header: 'Direct Cost',
				size: 110,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{formatMoney(String(getValue()), { compact: true, showCurrency: true })}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
			columnHelper.accessor('hsaCostAnnual', {
				id: 'hsaCostAnnual',
				header: 'HSA Cost',
				size: 100,
				cell: ({ getValue }) => (
					<span className="font-[family-name:var(--font-mono)] tabular-nums">
						{formatMoney(String(getValue()), { compact: true, showCurrency: true })}
					</span>
				),
			}) as ColumnDef<TeachingGridRow, unknown>,
		];
		return allColumns.filter((col) => {
			const colId = (col as { id?: string }).id;
			return colId ? visibleCols.has(colId) : true;
		});
	}, [visibleCols]);

	const table = useReactTable({
		data: requirementRows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const bandFooterBuilder = useCallback(
		(bandRows: TeachingGridRow[], band: string) => {
			let sumRaw = 0;
			let sumCovered = 0;
			let sumGap = 0;
			for (const row of bandRows) {
				sumRaw += parseFloat(row.requiredFteRaw);
				sumCovered += parseFloat(row.coveredFte);
				sumGap += parseFloat(row.gapFte);
			}
			const values: Record<string, React.ReactNode> = {};
			if (visibleCols.has('requiredFteRaw')) values.requiredFteRaw = sumRaw.toFixed(2);
			if (visibleCols.has('coveredFte')) values.coveredFte = sumCovered.toFixed(2);
			if (visibleCols.has('gapFte')) values.gapFte = sumGap.toFixed(2);
			return {
				label: `${BAND_LABELS[band] ?? band} Subtotal (${String(bandRows.length)} lines)`,
				type: 'subtotal' as const,
				values,
			};
		},
		[visibleCols]
	);

	const grandTotalRow = useMemo(() => {
		const values: Record<string, React.ReactNode> = {};
		if (visibleCols.has('requiredFteRaw')) values.requiredFteRaw = data.totals.totalFteRaw;
		if (visibleCols.has('coveredFte')) values.coveredFte = data.totals.totalFteCovered;
		if (visibleCols.has('gapFte')) values.gapFte = data.totals.totalFteGap;
		return [
			{
				label: bandFilter !== 'ALL' || coverageFilter !== 'ALL' ? 'Filtered Total' : 'Total',
				type: 'grandtotal' as const,
				values,
			},
		];
	}, [data.totals, visibleCols, bandFilter, coverageFilter]);

	const numericColumns = [
		'totalDriverUnits',
		'totalWeeklyHours',
		'baseOrs',
		'effectiveOrs',
		'requiredFteRaw',
		'requiredFtePlanned',
		'recommendedPositions',
		'coveredFte',
		'gapFte',
		'assignedStaffCount',
		'directCostAnnual',
		'hsaCostAnnual',
	];

	const handleRowSelect = useCallback(
		(row: TeachingGridRow) => {
			if (row.rowType === 'requirement') {
				selectRequirementLine(row.id, row.band, row.disciplineCode);
			}
		},
		[selectRequirementLine]
	);

	return (
		<PlanningGrid
			table={table}
			variant="compact"
			ariaLabel="Teaching master grid"
			pinnedColumns={['lineLabel']}
			numericColumns={numericColumns}
			bandGrouping={{
				getBand: (row) => row.band,
				bandLabels: BAND_LABELS,
				bandStyles: BAND_STYLES,
				collapsible: true,
				footerBuilder: bandFooterBuilder,
			}}
			footerRows={grandTotalRow}
			onRowSelect={handleRowSelect}
			selectedRowPredicate={(row) => row.id === selectedLineId}
		/>
	);
}
