import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from '../shared/chart-wrapper';
import { formatMoney } from '../../lib/format-money';
import {
	CHART_TOOLTIP_CONTENT_STYLE,
	CHART_AXIS_TICK,
	CHART_AXIS_TICK_LG,
	CHART_LEGEND_STYLE,
} from '../../lib/chart-utils';
import { useChartColors } from '../../hooks/use-chart-colors';
import type { MonthlyTrendItem } from '../../hooks/use-dashboard';
import { Skeleton } from '../ui/skeleton';

const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

// Academic year order: Sep-Aug
const ACADEMIC_MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];

export type RevenueBreakdownChartProps = {
	monthlyTrend: MonthlyTrendItem[];
	isLoading: boolean;
};

export function RevenueBreakdownChart({ monthlyTrend, isLoading }: RevenueBreakdownChartProps) {
	const chartColors = useChartColors();
	const chartData = useMemo(() => {
		if (!monthlyTrend.length) return [];

		return ACADEMIC_MONTH_ORDER.map((month) => {
			const row = monthlyTrend.find((r) => r.month === month);
			const revenue = row ? parseFloat(row.revenue) : 0;
			const staffCosts = row ? parseFloat(row.staffCosts) : 0;
			const opex = row ? parseFloat(row.opex) : 0;

			return {
				month: MONTH_LABELS[month - 1],
				revenue,
				staffCosts,
				opex,
			};
		});
	}, [monthlyTrend]);

	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-6 w-full" />
				))}
			</div>
		);
	}

	if (chartData.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-md bg-(--workspace-bg-subtle)">
				<p className="text-(--text-sm) text-(--text-muted)">No revenue data available.</p>
			</div>
		);
	}

	return (
		<div aria-label="Revenue breakdown chart">
			<ChartWrapper height={280}>
				<BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--workspace-border)" />
					<XAxis dataKey="month" tick={CHART_AXIS_TICK_LG} stroke="var(--workspace-border)" />
					<YAxis
						tick={CHART_AXIS_TICK}
						stroke="var(--workspace-border)"
						tickFormatter={(v: number) => formatMoney(v, { compact: true })}
					/>
					<Tooltip
						contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
						formatter={(value: number | undefined, name: string | undefined) => [
							formatMoney(value ?? 0),
							name === 'revenue' ? 'Revenue' : name === 'staffCosts' ? 'Staff Costs' : 'OpEx',
						]}
					/>
					<Legend
						wrapperStyle={CHART_LEGEND_STYLE}
						formatter={(value: string) =>
							value === 'revenue' ? 'Revenue' : value === 'staffCosts' ? 'Staff Costs' : 'OpEx'
						}
					/>
					<Bar dataKey="revenue" stackId="a" fill={chartColors.revenue} radius={[0, 0, 0, 0]} />
					<Bar
						dataKey="staffCosts"
						stackId="a"
						fill={chartColors.staffCost}
						radius={[0, 0, 0, 0]}
					/>
					<Bar dataKey="opex" stackId="a" fill={chartColors.opex} radius={[2, 2, 0, 0]} />
				</BarChart>
			</ChartWrapper>
		</div>
	);
}
