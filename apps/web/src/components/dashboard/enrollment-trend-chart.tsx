import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartWrapper } from '../shared/chart-wrapper';
import { useHistorical } from '../../hooks/use-enrollment';
import { Skeleton } from '../ui/skeleton';

interface YearTotal {
	year: string;
	total: number;
}

export function EnrollmentTrendChart() {
	const { data, isLoading } = useHistorical(5);

	const chartData = useMemo<YearTotal[]>(() => {
		if (!data?.data?.length) return [];

		const byYear = new Map<number, number>();
		for (const point of data.data) {
			byYear.set(point.academicYear, (byYear.get(point.academicYear) ?? 0) + point.headcount);
		}

		return Array.from(byYear.entries())
			.sort(([a], [b]) => a - b)
			.map(([year, total]) => ({
				year: `${year}-${String(year + 1).slice(2)}`,
				total,
			}));
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
				<p className="text-(--text-sm) text-(--text-muted)">
					No historical enrollment data available.
				</p>
			</div>
		);
	}

	return (
		<div aria-label="Enrollment trend chart">
			<ChartWrapper height={280}>
				<LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--workspace-border)" />
					<XAxis
						dataKey="year"
						tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
						stroke="var(--workspace-border)"
					/>
					<YAxis
						tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
						stroke="var(--workspace-border)"
						allowDecimals={false}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: 'var(--workspace-bg-card)',
							border: '1px solid var(--workspace-border)',
							borderRadius: '6px',
							fontSize: '12px',
						}}
						formatter={(value: number | undefined) => [
							(value ?? 0).toLocaleString('fr-FR'),
							'Students',
						]}
					/>
					<Line
						type="monotone"
						dataKey="total"
						stroke="var(--accent-500)"
						strokeWidth={2}
						dot={{ r: 4, fill: 'var(--accent-500)' }}
						activeDot={{ r: 6 }}
					/>
				</LineChart>
			</ChartWrapper>
		</div>
	);
}
