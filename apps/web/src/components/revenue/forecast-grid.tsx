import { useCallback, useMemo } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { RevenueViewMode } from '@budfin/types';
import type { GradeBand } from '../../hooks/use-grade-levels';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueResults } from '../../hooks/use-revenue';
import {
	buildRevenueForecastGridRows,
	formatRevenueGridAmount,
	formatRevenueGridPercent,
	getVisibleRevenueMonths,
	REVENUE_MONTH_LABELS,
	type RevenueForecastGridRow,
	type RevenueForecastPeriod,
} from '../../lib/revenue-workspace';
import { BAND_STYLES, BAND_LABELS } from '../../lib/band-styles';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { PlanningGrid } from '../data-grid/planning-grid';
import { cn } from '../../lib/cn';

interface ForecastGridProps {
	versionId: number;
	viewMode: RevenueViewMode;
	period: RevenueForecastPeriod;
	bandFilter?: GradeBand | 'ALL';
}

const columnHelper = createColumnHelper<RevenueForecastGridRow>();

function buildMonthColumn(monthIndex: number) {
	return columnHelper.accessor((row) => row.monthlyAmounts[monthIndex] ?? '0', {
		id: `month-${monthIndex}`,
		header: REVENUE_MONTH_LABELS[monthIndex] ?? `M${monthIndex + 1}`,
		cell: (info) => {
			const value = info.getValue() as string;
			const amount = formatRevenueGridAmount(value, monthIndex);
			return (
				<span
					className={cn(
						amount.isNegative && 'text-(--color-error)',
						amount.isMuted && 'text-(--text-muted)'
					)}
				>
					{amount.text}
				</span>
			);
		},
	});
}

export function ForecastGrid({
	versionId,
	viewMode,
	period,
	bandFilter = 'ALL',
}: ForecastGridProps) {
	const { data, isLoading } = useRevenueResults(versionId, viewMode);
	const { data: gradeLevelsData } = useGradeLevels();
	const selection = useRevenueSelectionStore((state) => state.selection);
	const selectRow = useRevenueSelectionStore((state) => state.selectRow);
	const visibleMonths = useMemo(() => getVisibleRevenueMonths(period), [period]);
	const isFiltered = bandFilter !== 'ALL';
	const gradeLevels = gradeLevelsData?.gradeLevels;

	const rows = useMemo(() => {
		const allRows = buildRevenueForecastGridRows({
			data,
			viewMode,
			gradeLevels,
		});

		// Filter out subtotal and total rows for banded views -- PlanningGrid handles those
		const dataRows = allRows.filter((row) => row.rowType === 'data');

		// Filter rows when bandFilter is active in grade view
		if (viewMode !== 'grade' || !isFiltered || !gradeLevels) {
			return dataRows;
		}

		return dataRows.filter((row) => {
			const gradeLevel = gradeLevels.find((gl) => gl.gradeCode === row.label);
			return gradeLevel?.band === bandFilter;
		});
	}, [bandFilter, data, gradeLevels, isFiltered, viewMode]);

	const monthColumns = useMemo(
		() => visibleMonths.map((monthIndex) => buildMonthColumn(monthIndex)),
		[visibleMonths]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('label', {
				id: 'label',
				header: viewMode === 'category' ? 'Revenue Category' : 'Label',
				cell: ({ getValue, row }) => {
					const label = getValue();
					const totalLabel = isFiltered
						? `Filtered Total (${BAND_LABELS[bandFilter] ?? bandFilter})`
						: 'Grand Total';
					return row.original.isTotal ? totalLabel : label;
				},
			}),
			...monthColumns,
			columnHelper.accessor('annualTotal', {
				id: 'annual',
				header: 'Annual',
				cell: ({ getValue }) => {
					const amount = formatRevenueGridAmount(getValue());
					return (
						<span className={cn(amount.isNegative && 'text-(--color-error)')}>{amount.text}</span>
					);
				},
			}),
			columnHelper.accessor('percentageOfRevenue', {
				id: 'pctRev',
				header: '% Rev',
				cell: ({ getValue, row }) =>
					row.original.isTotal ? '' : formatRevenueGridPercent(getValue()),
			}),
		],
		[bandFilter, isFiltered, monthColumns, viewMode]
	);

	const numericColumnIds = useMemo(
		() => [...visibleMonths.map((i) => `month-${i}`), 'annual', 'pctRev'],
		[visibleMonths]
	);

	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const bandGrouping = useMemo(() => {
		if (viewMode === 'grade') {
			return {
				getBand: (row: RevenueForecastGridRow) => row.band ?? 'UNKNOWN',
				bandLabels: BAND_LABELS,
				bandStyles: BAND_STYLES,
				collapsible: false as const,
			};
		}
		return undefined;
	}, [viewMode]);

	const footerRows = useMemo(() => {
		if (rows.length === 0) return [];

		const allRows = buildRevenueForecastGridRows({
			data,
			viewMode,
			gradeLevels,
		});
		const totalRow = allRows.find((r) => r.isTotal);
		if (!totalRow) return [];

		const totalLabel = isFiltered
			? `Filtered Total (${BAND_LABELS[bandFilter] ?? bandFilter})`
			: 'Grand Total';

		const values: Record<string, React.ReactNode> = {
			label: totalLabel,
		};
		for (const monthIndex of visibleMonths) {
			const amount = formatRevenueGridAmount(
				totalRow.monthlyAmounts[monthIndex] ?? '0',
				monthIndex
			);
			values[`month-${monthIndex}`] = (
				<span className={cn(amount.isNegative && 'text-(--color-error)')}>{amount.text}</span>
			);
		}
		const annualAmount = formatRevenueGridAmount(totalRow.annualTotal);
		values['annual'] = (
			<span className={cn(annualAmount.isNegative && 'text-(--color-error)')}>
				{annualAmount.text}
			</span>
		);
		values['pctRev'] = '';

		return [
			{
				label: totalLabel,
				type: 'grandtotal' as const,
				values,
			},
		];
	}, [bandFilter, data, gradeLevels, isFiltered, rows.length, viewMode, visibleMonths]);

	const handleRowSelect = useCallback(
		(row: RevenueForecastGridRow) => {
			selectRow(row);
		},
		[selectRow]
	);

	const selectedRowPredicate = useCallback(
		(row: RevenueForecastGridRow) =>
			selection?.label === row.label && selection.viewMode === viewMode,
		[selection, viewMode]
	);

	return (
		<PlanningGrid
			table={table}
			isLoading={isLoading}
			ariaLabel="Revenue forecast grid"
			forceGridRole={true}
			pinnedColumns={['label']}
			numericColumns={numericColumnIds}
			{...(bandGrouping ? { bandGrouping } : {})}
			footerRows={footerRows}
			onRowSelect={handleRowSelect}
			selectedRowPredicate={selectedRowPredicate}
		/>
	);
}
