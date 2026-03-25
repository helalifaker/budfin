import { cn } from '../../lib/cn';
import type { TrendYearEntry, TrendsGrowth } from '../../hooks/use-trends';

interface GrowthRateTableProps {
	years: TrendYearEntry[];
	growth: TrendsGrowth;
}

const METRIC_ROWS = [
	{ key: 'revenue' as const, label: 'Revenue' },
	{ key: 'staffCost' as const, label: 'Staff Cost' },
	{ key: 'opex' as const, label: 'OpEx' },
	{ key: 'netProfit' as const, label: 'Net Profit' },
	{ key: 'enrollment' as const, label: 'Enrollment' },
	{ key: 'fte' as const, label: 'FTE' },
];

function formatGrowth(value: string | null | undefined): string {
	if (value === null || value === undefined) return '--';
	const pct = parseFloat(value) * 100;
	const sign = pct > 0 ? '+' : '';
	return `${sign}${pct.toFixed(1)}%`;
}

function growthColor(value: string | null | undefined, metricKey: string): string {
	if (value === null || value === undefined) return 'text-(--text-muted)';
	const pct = parseFloat(value);
	// For costs (staffCost, opex), growth is typically negative-good. For revenue/profit, positive-good.
	const isPositiveGood = metricKey !== 'staffCost' && metricKey !== 'opex';
	if (pct > 0) return isPositiveGood ? 'text-(--color-success)' : 'text-(--color-error)';
	if (pct < 0) return isPositiveGood ? 'text-(--color-error)' : 'text-(--color-success)';
	return 'text-(--text-muted)';
}

export function GrowthRateTable({ years, growth }: GrowthRateTableProps) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-(--text-sm)">
				<thead>
					<tr className="border-b border-(--workspace-border)">
						<th className="px-3 py-2 text-left font-medium text-(--text-secondary)">Metric</th>
						{years.map((y) => (
							<th
								key={y.versionId}
								className="px-3 py-2 text-right font-medium text-(--text-secondary)"
							>
								{y.fiscalYear}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{METRIC_ROWS.map((metric) => {
						const growthValues = growth[metric.key] ?? [];
						return (
							<tr key={metric.key} className="border-b border-(--workspace-border) last:border-b-0">
								<td className="px-3 py-2 font-medium text-(--text-primary)">{metric.label}</td>
								{years.map((y, i) => (
									<td
										key={y.versionId}
										className={cn(
											'px-3 py-2 text-right font-mono tabular-nums',
											growthColor(growthValues[i], metric.key)
										)}
									>
										{formatGrowth(growthValues[i])}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
