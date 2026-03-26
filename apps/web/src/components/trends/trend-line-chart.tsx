import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from '../shared/chart-wrapper';
import { formatMoney } from '../../lib/format-money';
import {
	CHART_TOOLTIP_CONTENT_STYLE,
	CHART_AXIS_TICK,
	CHART_AXIS_TICK_LG,
	CHART_LEGEND_STYLE,
} from '../../lib/chart-utils';
import { useChartColors } from '../../hooks/use-chart-colors';
import type { TrendYearEntry } from '../../hooks/use-trends';

interface TrendLineChartProps {
	years: TrendYearEntry[];
}

export function TrendLineChart({ years }: TrendLineChartProps) {
	const chartColors = useChartColors();

	const metricConfig = useMemo(
		() => [
			{ key: 'totalRevenue', label: 'Revenue', color: chartColors.revenue },
			{ key: 'totalStaffCost', label: 'Staff Cost', color: chartColors.staffCost },
			{ key: 'totalOpEx', label: 'OpEx', color: chartColors.opex },
			{ key: 'netProfit', label: 'Net Profit', color: chartColors.netProfit },
		],
		[chartColors]
	);

	const chartData = useMemo(() => {
		return years.map((y) => ({
			fiscalYear: y.fiscalYear,
			totalRevenue: parseFloat(y.metrics.totalRevenue),
			totalStaffCost: parseFloat(y.metrics.totalStaffCost),
			totalOpEx: parseFloat(y.metrics.totalOpEx),
			netProfit: parseFloat(y.metrics.netProfit),
		}));
	}, [years]);

	return (
		<div aria-label="Historical financial trend chart">
			<ChartWrapper height={320}>
				<LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--workspace-border)" />
					<XAxis dataKey="fiscalYear" tick={CHART_AXIS_TICK_LG} stroke="var(--workspace-border)" />
					<YAxis
						tick={CHART_AXIS_TICK}
						stroke="var(--workspace-border)"
						tickFormatter={(v: number) => formatMoney(v, { compact: true })}
					/>
					<Tooltip
						contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
						formatter={(value: number | undefined, name: string | undefined) => {
							const config = metricConfig.find((m) => m.key === name);
							return [formatMoney(value ?? 0, { showCurrency: true }), config?.label ?? name];
						}}
					/>
					<Legend
						wrapperStyle={CHART_LEGEND_STYLE}
						formatter={(value: string) => {
							const config = metricConfig.find((m) => m.key === value);
							return config?.label ?? value;
						}}
					/>
					{metricConfig.map((metric) => (
						<Line
							key={metric.key}
							type="monotone"
							dataKey={metric.key}
							stroke={metric.color}
							strokeWidth={2}
							dot={{ r: 4, fill: metric.color }}
							activeDot={{ r: 6 }}
						/>
					))}
				</LineChart>
			</ChartWrapper>
		</div>
	);
}
