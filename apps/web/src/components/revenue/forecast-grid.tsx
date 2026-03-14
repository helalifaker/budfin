import { useMemo } from 'react';
import type { RevenueViewMode } from '@budfin/types';
import type { GradeBand } from '../../hooks/use-grade-levels';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueResults } from '../../hooks/use-revenue';
import { cn } from '../../lib/cn';
import { BAND_LABELS } from '../../lib/enrollment-workspace';
import {
	buildRevenueForecastGridRows,
	formatRevenueGridAmount,
	formatRevenueGridPercent,
	getVisibleRevenueMonths,
	REVENUE_MONTH_LABELS,
	type RevenueForecastPeriod,
} from '../../lib/revenue-workspace';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';

interface ForecastGridProps {
	versionId: number;
	viewMode: RevenueViewMode;
	period: RevenueForecastPeriod;
	bandFilter?: GradeBand | 'ALL';
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

		// Filter rows when bandFilter is active in grade view
		if (viewMode !== 'grade' || !isFiltered || !gradeLevels) {
			return allRows;
		}

		// Keep only rows whose grade belongs to the selected band,
		// the matching band subtotal, and the grand total
		return allRows.filter((row) => {
			if (row.isTotal) {
				return true;
			}

			if (row.isSubtotal) {
				// Subtotal rows use the band label as their label
				return row.label === (BAND_LABELS[bandFilter] ?? bandFilter);
			}

			// Data rows: check if the grade code belongs to the selected band
			const gradeLevel = gradeLevels.find((gl) => gl.gradeCode === row.label);
			return gradeLevel?.band === bandFilter;
		});
	}, [bandFilter, data, gradeLevels, isFiltered, viewMode]);

	if (isLoading) {
		return (
			<div className="flex h-48 items-center justify-center rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) text-(--text-sm) text-(--text-muted)">
				Loading revenue forecast...
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) text-token-sm text-(--text-muted)">
				Run the revenue calculation to populate the forecast grid.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) shadow-(--shadow-xs)">
			<table
				role="grid"
				aria-label="Revenue forecast grid"
				className="min-w-[1120px] w-full text-(--text-sm)"
			>
				<thead className="border-b border-(--workspace-border) bg-(--workspace-bg-muted)">
					<tr>
						<th className="sticky left-0 z-10 min-w-[220px] border-r border-(--workspace-border) bg-(--workspace-bg-muted) px-4 py-3 text-left text-(--text-xs) font-medium uppercase tracking-wide text-(--text-secondary)">
							{viewMode === 'category' ? 'Revenue Category' : 'Label'}
						</th>
						{visibleMonths.map((monthIndex) => (
							<th
								key={REVENUE_MONTH_LABELS[monthIndex]}
								className="px-3 py-3 text-right text-(--text-xs) font-medium uppercase tracking-wide text-(--text-secondary)"
							>
								{REVENUE_MONTH_LABELS[monthIndex]}
							</th>
						))}
						<th className="px-3 py-3 text-right text-(--text-xs) font-medium uppercase tracking-wide text-(--text-secondary)">
							Annual
						</th>
						<th className="px-3 py-3 text-right text-(--text-xs) font-medium uppercase tracking-wide text-(--text-secondary)">
							% Rev
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const isSelectable = !row.isTotal && !row.isSubtotal;
						const isSelected =
							isSelectable && selection?.label === row.label && selection.viewMode === viewMode;
						const totalLabel = isFiltered
							? `Filtered Total (${BAND_LABELS[bandFilter] ?? bandFilter})`
							: 'Grand Total';
						const displayLabel = row.isTotal ? totalLabel : row.label;

						return (
							<tr
								key={row.id}
								aria-selected={isSelected}
								aria-label={row.isTotal ? totalLabel.toLowerCase() : row.label}
								className={cn(
									'border-b border-(--workspace-border) last:border-0',
									row.isTotal && 'sticky bottom-0 bg-(--workspace-bg-muted) font-semibold',
									row.isSubtotal && 'bg-(--workspace-bg-subtle) font-medium',
									isSelectable && 'cursor-pointer hover:bg-(--accent-50)',
									isSelected && 'bg-(--accent-50)'
								)}
								onClick={() => {
									if (!isSelectable) {
										return;
									}

									selectRow(row);
								}}
								onKeyDown={(event) => {
									if (!isSelectable) {
										return;
									}

									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										selectRow(row);
									}
								}}
								tabIndex={isSelectable ? 0 : undefined}
							>
								<td className="sticky left-0 z-10 border-r border-(--workspace-border) bg-inherit px-4 py-3 text-left">
									{displayLabel}
								</td>
								{visibleMonths.map((monthIndex) => {
									const amount = formatRevenueGridAmount(
										row.monthlyAmounts[monthIndex] ?? '0',
										monthIndex
									);
									return (
										<td
											key={`${row.id}-${monthIndex}`}
											className={cn(
												'px-3 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums',
												amount.isNegative && 'text-(--color-error)',
												amount.isMuted && 'text-(--text-muted)'
											)}
										>
											{amount.text}
										</td>
									);
								})}
								<td
									className={cn(
										'px-3 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums',
										formatRevenueGridAmount(row.annualTotal).isNegative && 'text-(--color-error)'
									)}
								>
									{formatRevenueGridAmount(row.annualTotal).text}
								</td>
								<td className="px-3 py-3 text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-muted)">
									{row.isTotal ? '' : formatRevenueGridPercent(row.percentageOfRevenue)}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
