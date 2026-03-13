import { useMemo } from 'react';
import type { RevenueViewMode } from '@budfin/types';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueResults } from '../../hooks/use-revenue';
import { cn } from '../../lib/cn';
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
}

export function ForecastGrid({ versionId, viewMode, period }: ForecastGridProps) {
	const { data, isLoading } = useRevenueResults(versionId, viewMode);
	const { data: gradeLevelsData } = useGradeLevels();
	const selection = useRevenueSelectionStore((state) => state.selection);
	const selectRow = useRevenueSelectionStore((state) => state.selectRow);
	const visibleMonths = useMemo(() => getVisibleRevenueMonths(period), [period]);

	const rows = useMemo(
		() =>
			buildRevenueForecastGridRows({
				data,
				viewMode,
				gradeLevels: gradeLevelsData?.gradeLevels,
			}),
		[data, gradeLevelsData?.gradeLevels, viewMode]
	);

	if (isLoading) {
		return (
			<div className="flex h-48 items-center justify-center rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) text-(--text-sm) text-(--text-muted)">
				Loading revenue forecast...
			</div>
		);
	}

	if (rows.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) text-(--text-sm) text-(--text-muted)">
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

						return (
							<tr
								key={row.id}
								aria-selected={isSelected}
								aria-label={row.isTotal ? 'Grand total' : row.label}
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

									selectRow({ label: row.label, viewMode });
								}}
								onKeyDown={(event) => {
									if (!isSelectable) {
										return;
									}

									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										selectRow({ label: row.label, viewMode });
									}
								}}
								tabIndex={isSelectable ? 0 : undefined}
							>
								<td className="sticky left-0 z-10 border-r border-(--workspace-border) bg-inherit px-4 py-3 text-left">
									{row.label}
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
