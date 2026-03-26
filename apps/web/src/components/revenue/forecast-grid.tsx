import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import Decimal from 'decimal.js';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { RevenueViewMode } from '@budfin/types';
import {
	formatRevenueGridAmount,
	formatRevenueGridPercent,
	getVisibleRevenueMonths,
	REVENUE_MONTH_LABELS,
	type RevenueForecastGridRow,
	type RevenueForecastPeriod,
} from '../../lib/revenue-workspace';
import {
	BAND_STYLES,
	NATIONALITY_LABELS,
	NATIONALITY_STYLES,
	TARIFF_LABELS,
	TARIFF_STYLES,
} from '../../lib/band-styles';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { PlanningGrid } from '../data-grid/planning-grid';
import { cn } from '../../lib/cn';

interface ForecastGridProps {
	rows: RevenueForecastGridRow[];
	viewMode: RevenueViewMode;
	period: RevenueForecastPeriod;
	isLoading?: boolean;
	totalLabel: string;
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
	rows,
	viewMode,
	period,
	isLoading = false,
	totalLabel,
}: ForecastGridProps) {
	const selection = useRevenueSelectionStore((state) => state.selection);
	const selectRow = useRevenueSelectionStore((state) => state.selectRow);
	const visibleMonths = useMemo(() => getVisibleRevenueMonths(period), [period]);

	const monthColumns = useMemo(
		() => visibleMonths.map((monthIndex) => buildMonthColumn(monthIndex)),
		[visibleMonths]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('label', {
				id: 'label',
				header: viewMode === 'category' ? 'Revenue Category' : 'Label',
				cell: ({ getValue }) => getValue(),
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
		[monthColumns, viewMode]
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
				bandLabels: {
					MATERNELLE: 'Maternelle',
					ELEMENTAIRE: 'Elementaire',
					COLLEGE: 'College',
					LYCEE: 'Lycee',
				},
				bandStyles: BAND_STYLES,
				collapsible: false as const,
				footerBuilder: (groupRows: RevenueForecastGridRow[], band: string) =>
					buildSubtotalRow({
						rows: groupRows,
						label: `${
							{
								MATERNELLE: 'Maternelle',
								ELEMENTAIRE: 'Elementaire',
								COLLEGE: 'College',
								LYCEE: 'Lycee',
							}[band] ?? band
						} Subtotal`,
						visibleMonths,
					}),
			};
		}
		if (viewMode === 'nationality') {
			return {
				getBand: (row: RevenueForecastGridRow) => row.code,
				bandLabels: NATIONALITY_LABELS,
				bandStyles: NATIONALITY_STYLES,
				collapsible: false as const,
			};
		}
		if (viewMode === 'tariff') {
			return {
				getBand: (row: RevenueForecastGridRow) => row.code,
				bandLabels: TARIFF_LABELS,
				bandStyles: TARIFF_STYLES,
				collapsible: false as const,
			};
		}
		return undefined;
	}, [viewMode, visibleMonths]);

	const footerRows = useMemo(() => {
		if (rows.length === 0) return [];
		const values = buildSummaryValues(rows, visibleMonths, totalLabel);
		return [{ label: totalLabel, type: 'grandtotal' as const, values }];
	}, [rows, totalLabel, visibleMonths]);

	const handleRowSelect = useCallback(
		(row: RevenueForecastGridRow) => {
			selectRow(row);
		},
		[selectRow]
	);

	const selectedRowPredicate = useCallback(
		(row: RevenueForecastGridRow) => selection?.id === row.id && selection.viewMode === viewMode,
		[selection, viewMode]
	);

	return (
		<PlanningGrid
			table={table}
			isLoading={isLoading}
			ariaLabel="Revenue forecast grid"
			rangeSelection
			clipboardEnabled
			forceGridRole={true}
			pinnedColumns={['label']}
			numericColumns={numericColumnIds}
			{...(bandGrouping ? { bandGrouping } : {})}
			footerRows={footerRows}
			onRowSelect={handleRowSelect}
			selectedRowPredicate={selectedRowPredicate}
			getRowClassName={(row) =>
				viewMode === 'category' && row.code === 'discount-impact'
					? 'text-(--color-error)'
					: undefined
			}
		/>
	);
}

function buildSummaryValues(
	rows: RevenueForecastGridRow[],
	visibleMonths: number[],
	label: string
): Record<string, ReactNode> {
	const monthTotals = new Map<number, Decimal>();
	let annualTotal = new Decimal(0);

	for (const row of rows) {
		for (const monthIndex of visibleMonths) {
			const amount = new Decimal(row.monthlyAmounts[monthIndex] ?? '0');
			monthTotals.set(monthIndex, (monthTotals.get(monthIndex) ?? new Decimal(0)).plus(amount));
		}
		annualTotal = annualTotal.plus(new Decimal(row.annualTotal));
	}

	const values: Record<string, ReactNode> = { label };
	for (const monthIndex of visibleMonths) {
		const amount = formatRevenueGridAmount(
			(monthTotals.get(monthIndex) ?? new Decimal(0)).toFixed(4),
			monthIndex
		);
		values[`month-${monthIndex}`] = (
			<span className={cn(amount.isNegative && 'text-(--color-error)')}>{amount.text}</span>
		);
	}
	const annualAmount = formatRevenueGridAmount(annualTotal.toFixed(4));
	values['annual'] = (
		<span className={cn(annualAmount.isNegative && 'text-(--color-error)')}>
			{annualAmount.text}
		</span>
	);
	values['pctRev'] = '';
	return values;
}

function buildSubtotalRow({
	rows,
	label,
	visibleMonths,
}: {
	rows: RevenueForecastGridRow[];
	label: string;
	visibleMonths: number[];
}) {
	return {
		label,
		type: 'subtotal' as const,
		values: buildSummaryValues(rows, visibleMonths, label),
	};
}
