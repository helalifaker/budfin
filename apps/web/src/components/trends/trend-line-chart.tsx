import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from '../shared/chart-wrapper';
import { formatMoney } from '../../lib/format-money';
import type { TrendYearEntry } from '../../hooks/use-trends';

interface TrendLineChartProps {
	years: TrendYearEntry[];
}

const METRIC_CONFIG = [
	{ key: 'totalRevenue', label: 'Revenue', color: '#2563EB' },
	{ key: 'totalStaffCost', label: 'Staff Cost', color: '#7C3AED' },
	{ key: 'totalOpEx', label: 'OpEx', color: '#0891B2' },
	{ key: 'netProfit', label: 'Net Profit', color: '#059669' },
] as const;

export function TrendLineChart({ years }: TrendLineChartProps) {
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
					<XAxis
						dataKey="fiscalYear"
						tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
						stroke="var(--workspace-border)"
					/>
					<YAxis
						tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
						stroke="var(--workspace-border)"
						tickFormatter={(v: number) => formatMoney(v, { compact: true })}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: 'var(--workspace-bg-card)',
							border: '1px solid var(--workspace-border)',
							borderRadius: '6px',
							fontSize: '12px',
						}}
						formatter={(value: number | undefined, name: string | undefined) => {
							const config = METRIC_CONFIG.find((m) => m.key === name);
							return [formatMoney(value ?? 0, { showCurrency: true }), config?.label ?? name];
						}}
					/>
					<Legend
						wrapperStyle={{ fontSize: '12px' }}
						formatter={(value: string) => {
							const config = METRIC_CONFIG.find((m) => m.key === value);
							return config?.label ?? value;
						}}
					/>
					{METRIC_CONFIG.map((metric) => (
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
