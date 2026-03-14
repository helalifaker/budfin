import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import type { RevenueViewMode } from '@budfin/types';
import {
	createColumnHelper,
	getCoreRowModel,
	useReactTable,
	type ColumnDef,
} from '@tanstack/react-table';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueResults } from '../../hooks/use-revenue';
import { cn } from '../../lib/cn';
import { BAND_STYLES, NATIONALITY_STYLES, TARIFF_STYLES } from '../../lib/band-styles';
import { BAND_LABELS } from '../../lib/enrollment-workspace';
import {
	buildRevenueForecastGridRows,
	formatRevenueGridAmount,
	formatRevenueGridPercent,
	getVisibleRevenueMonths,
	REVENUE_MONTH_LABELS,
	type RevenueGridRowIdentity,
	type RevenueForecastGridRow,
	type RevenueForecastPeriod,
} from '../../lib/revenue-workspace';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { PlanningGrid } from '../data-grid/planning-grid';

interface ForecastGridProps {
	versionId: number;
	viewMode: RevenueViewMode;
	period: RevenueForecastPeriod;
}

const NATIONALITY_LABELS: Record<string, string> = {
	Francais: 'Francais',
	Nationaux: 'Nationaux',
	Autres: 'Autres',
};

const TARIFF_LABELS: Record<string, string> = {
	Plein: 'Plein Tarif',
	RP: 'Reduit Personnel',
	'R3+': 'Reduit 3+ Enfants',
};

const columnHelper = createColumnHelper<RevenueForecastGridRow>();

function buildMonthColumns(visibleMonths: number[]): ColumnDef<RevenueForecastGridRow, string>[] {
	return visibleMonths.map(
		(monthIndex) =>
			columnHelper.accessor(
				(row: RevenueForecastGridRow) => row.monthlyAmounts[monthIndex] ?? '0',
				{
					id: `month-${monthIndex}`,
					header: String(REVENUE_MONTH_LABELS[monthIndex] ?? ''),
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
				}
			) as ColumnDef<RevenueForecastGridRow, string>
	);
}

export function ForecastGrid({ versionId, viewMode, period }: ForecastGridProps) {
	const { data, isLoading } = useRevenueResults(versionId, viewMode);
	const { data: gradeLevelsData } = useGradeLevels();
	const selection = useRevenueSelectionStore((state) => state.selection);
	const selectRow = useRevenueSelectionStore((state) => state.selectRow);
	const visibleMonths = useMemo(() => getVisibleRevenueMonths(period), [period]);

	const allRows = useMemo(
		() =>
			buildRevenueForecastGridRows({
				data,
				viewMode,
				gradeLevels: gradeLevelsData?.gradeLevels,
			}),
		[data, gradeLevelsData?.gradeLevels, viewMode]
	);

	// Separate data rows from subtotal/total rows for PlanningGrid
	const dataRows = useMemo(() => allRows.filter((row) => row.rowType === 'data'), [allRows]);

	const columns = useMemo(
		() => [
			columnHelper.accessor('label', {
				id: 'label',
				header: viewMode === 'category' ? 'Revenue Category' : 'Label',
				cell: (info) => {
					const rowLabel = info.row.original.label;
					const isDiscountRow = rowLabel === 'Discount Impact';
					return (
						<span
							className={cn(
								'font-medium text-(--text-primary)',
								isDiscountRow && 'border-l-2 border-l-(--color-error) pl-2'
							)}
						>
							{rowLabel}
						</span>
					);
				},
			}),
			...buildMonthColumns(visibleMonths),
			columnHelper.accessor('annualTotal', {
				id: 'annual',
				header: 'Annual',
				cell: (info) => {
					const amount = formatRevenueGridAmount(info.getValue());
					return (
						<span className={cn(amount.isNegative && 'text-(--color-error)')}>{amount.text}</span>
					);
				},
			}),
			columnHelper.accessor('percentageOfRevenue', {
				id: 'pctRev',
				header: '% Rev',
				cell: (info) => (
					<span className="text-(--text-muted)">{formatRevenueGridPercent(info.getValue())}</span>
				),
			}),
		],
		[viewMode, visibleMonths]
	);

	const table = useReactTable({
		data: dataRows,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const numericColumnIds = useMemo(
		() => [...visibleMonths.map((monthIndex) => `month-${monthIndex}`), 'annual', 'pctRev'],
		[visibleMonths]
	);

	// Build subtotal/total footer values from allRows entries
	const buildSummaryValues = useCallback(
		(row: RevenueForecastGridRow): Record<string, ReactNode> => {
			const values: Record<string, ReactNode> = {};
			for (const monthIndex of visibleMonths) {
				const amount = formatRevenueGridAmount(row.monthlyAmounts[monthIndex] ?? '0', monthIndex);
				values[`month-${monthIndex}`] = (
					<span
						className={cn(
							amount.isNegative && 'text-(--color-error)',
							amount.isMuted && 'text-(--text-muted)'
						)}
					>
						{amount.text}
					</span>
				);
			}
			const annualAmount = formatRevenueGridAmount(row.annualTotal);
			values['annual'] = (
				<span className={cn(annualAmount.isNegative && 'text-(--color-error)')}>
					{annualAmount.text}
				</span>
			);
			values['pctRev'] = (
				<span className="text-(--text-muted)">
					{row.isTotal ? '' : formatRevenueGridPercent(row.percentageOfRevenue)}
				</span>
			);
			return values;
		},
		[visibleMonths]
	);

	// Band grouping configuration for grade view
	const bandGrouping = useMemo(() => {
		if (viewMode !== 'grade') return undefined;

		const subtotalRows = allRows.filter(
			(row: RevenueForecastGridRow) => row.rowType === 'subtotal'
		);
		const subtotalByBand = new Map(
			subtotalRows.map((row: RevenueForecastGridRow) => [row.band, row])
		);

		return {
			getBand: (row: RevenueForecastGridRow) => row.band ?? '',
			bandLabels: BAND_LABELS,
			bandStyles: BAND_STYLES,
			collapsible: false,
			footerBuilder: (_rows: RevenueForecastGridRow[], band: string) => {
				const subtotalRow = subtotalByBand.get(band);
				if (!subtotalRow) return null;
				return {
					label: subtotalRow.label,
					type: 'subtotal' as const,
					values: buildSummaryValues(subtotalRow),
				};
			},
		};
	}, [viewMode, allRows, buildSummaryValues]);

	// Nationality grouping configuration
	const nationalityGrouping = useMemo(() => {
		if (viewMode !== 'nationality') return undefined;

		return {
			getBand: (row: RevenueForecastGridRow) => row.band ?? '',
			bandLabels: NATIONALITY_LABELS,
			bandStyles: NATIONALITY_STYLES,
			collapsible: false,
		};
	}, [viewMode]);

	// Tariff grouping configuration
	const tariffGrouping = useMemo(() => {
		if (viewMode !== 'tariff') return undefined;

		return {
			getBand: (row: RevenueForecastGridRow) => row.band ?? '',
			bandLabels: TARIFF_LABELS,
			bandStyles: TARIFF_STYLES,
			collapsible: false,
		};
	}, [viewMode]);

	// Grand total footer row
	const footerRows = useMemo(() => {
		const totalRow = allRows.find((row: RevenueForecastGridRow) => row.rowType === 'total');
		if (!totalRow) return [];

		return [
			{
				label: totalRow.label,
				type: 'grandtotal' as const,
				values: buildSummaryValues(totalRow),
			},
		];
	}, [allRows, buildSummaryValues]);

	// Pick the active grouping based on viewMode
	const activeGrouping = bandGrouping ?? nationalityGrouping ?? tariffGrouping;

	const handleRowSelect = useCallback(
		(row: RevenueForecastGridRow) => {
			const identity: RevenueGridRowIdentity = {
				id: row.id,
				code: row.code,
				label: row.label,
				viewMode: row.viewMode,
				rowType: row.rowType,
				...(row.band !== undefined && { band: row.band }),
				...(row.groupKey !== undefined && { groupKey: row.groupKey }),
				...(row.settingsTarget !== undefined && { settingsTarget: row.settingsTarget }),
			};
			selectRow(identity);
		},
		[selectRow]
	);

	const selectedRowPredicate = useCallback(
		(row: RevenueForecastGridRow) => {
			if (!selection) return false;
			return selection.label === row.label && selection.viewMode === viewMode;
		},
		[selection, viewMode]
	);

	if (isLoading) {
		return (
			<PlanningGrid
				table={table}
				isLoading
				forceGridRole
				ariaLabel="Revenue forecast grid"
				pinnedColumns={['label']}
				numericColumns={numericColumnIds}
			/>
		);
	}

	if (allRows.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) text-(--text-sm) text-(--text-muted)">
				Run the revenue calculation to populate the forecast grid.
			</div>
		);
	}

	const sharedProps = {
		table,
		ariaLabel: 'Revenue forecast grid' as const,
		forceGridRole: true as const,
		pinnedColumns: ['label'],
		numericColumns: numericColumnIds,
		footerRows,
		onRowSelect: handleRowSelect,
		selectedRowPredicate,
	};

	if (activeGrouping) {
		return <PlanningGrid {...sharedProps} bandGrouping={activeGrouping} />;
	}

	return <PlanningGrid {...sharedProps} />;
}
