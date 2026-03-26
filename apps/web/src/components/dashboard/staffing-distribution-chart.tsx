import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartWrapper } from '../shared/chart-wrapper';
import { useStaffingSummary } from '../../hooks/use-staffing';
import { Skeleton } from '../ui/skeleton';
import { formatMoney } from '../../lib/format-money';
import { CHART_TOOLTIP_CONTENT_STYLE, CHART_AXIS_TICK } from '../../lib/chart-utils';
import { useChartColors } from '../../hooks/use-chart-colors';

export type StaffingDistributionChartProps = {
	versionId: number | null;
};

export function StaffingDistributionChart({ versionId }: StaffingDistributionChartProps) {
	const chartColors = useChartColors();
	const { data, isLoading } = useStaffingSummary(versionId);

	const chartData = useMemo(() => {
		if (!data?.byDepartment?.length) return [];

		return [...data.byDepartment]
			.map((d) => ({
				department: d.department.length > 20 ? `${d.department.slice(0, 20)}...` : d.department,
				cost: parseFloat(d.total_cost),
			}))
			.sort((a, b) => b.cost - a.cost);
	}, [data]);

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
				<p className="text-(--text-sm) text-(--text-muted)">No staffing data available.</p>
			</div>
		);
	}

	const chartHeight = Math.max(280, chartData.length * 40);

	return (
		<div aria-label="Staffing distribution chart">
			<ChartWrapper height={chartHeight}>
				<BarChart
					data={chartData}
					layout="vertical"
					margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
				>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--workspace-border)" />
					<XAxis
						type="number"
						tick={CHART_AXIS_TICK}
						stroke="var(--workspace-border)"
						allowDecimals={false}
					/>
					<YAxis
						type="category"
						dataKey="department"
						tick={CHART_AXIS_TICK}
						stroke="var(--workspace-border)"
						width={90}
					/>
					<Tooltip
						contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
						formatter={(value: number | undefined) => [
							formatMoney(value ?? 0, { showCurrency: true }),
							'Staff Cost',
						]}
					/>
					<Bar dataKey="cost" fill={chartColors.staffCost} radius={[0, 4, 4, 0]} />
				</BarChart>
			</ChartWrapper>
		</div>
	);
}
