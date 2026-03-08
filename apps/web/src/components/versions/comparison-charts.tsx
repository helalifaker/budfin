import { useMemo } from 'react';
import {
	BarChart,
	Bar,
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from 'recharts';
import type { MultiCompareResponse } from '../../hooks/use-versions';
import type { MetricKey } from './comparison-view';

export type ComparisonChartsProps = {
	data: MultiCompareResponse;
	metric: MetricKey;
};

const MONTH_NAMES = [
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

// Colors match CSS tokens: --version-budget, --version-forecast, --version-actual
// Recharts SVG stroke/fill cannot use CSS var() directly, so values are kept in sync here.
const VERSION_TYPE_COLORS: Record<string, string> = {
	Budget: '#2563eb',
	Forecast: '#ea580c',
	Actual: '#16a34a',
};

function getVersionColor(type: string): string {
	return VERSION_TYPE_COLORS[type] ?? '#6b7280';
}

function formatAxisValue(value: number): string {
	if (value === 0) return '0';
	const k = value / 1000;
	return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(k)}K`;
}

function formatTooltipValue(value: number | string | undefined): string {
	if (value == null) return '-';
	return new Intl.NumberFormat('en-US').format(Number(value));
}

export function ComparisonCharts({ data, metric }: ComparisonChartsProps) {
	const barData = useMemo(() => {
		return data.annualTotals.map((total) => {
			const version = data.versions.find((v) => v.id === total.versionId);
			return {
				name: version?.name ?? `V${total.versionId}`,
				value: Number(total[metric]),
				fill: getVersionColor(version?.type ?? 'Budget'),
			};
		});
	}, [data, metric]);

	const lineData = useMemo(() => {
		return MONTH_NAMES.map((monthName, idx) => {
			const monthEntry = data.monthly.find((m) => m.month === idx + 1);
			const row: Record<string, string | number> = { month: monthName };
			if (monthEntry) {
				for (const val of monthEntry.values) {
					const version = data.versions.find((v) => v.id === val.versionId);
					const key = version?.name ?? `V${val.versionId}`;
					row[key] = Number(val[metric]);
				}
			}
			return row;
		});
	}, [data, metric]);

	return (
		<div
			className="mt-4 flex flex-col gap-4 md:flex-row"
			role="group"
			aria-label="Comparison charts"
		>
			<div className="min-w-0 flex-1">
				<h3 className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--text-secondary)]">
					Annual Totals
				</h3>
				<ResponsiveContainer width="100%" height={280}>
					<BarChart data={barData}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="name" tick={{ fontSize: 12 }} />
						<YAxis tickFormatter={formatAxisValue} tick={{ fontSize: 12 }} />
						<Tooltip formatter={(value) => [formatTooltipValue(value as number), 'Value']} />
						<Bar dataKey="value" name="Total" radius={[2, 2, 0, 0]} />
					</BarChart>
				</ResponsiveContainer>
			</div>

			<div className="min-w-0 flex-1">
				<h3 className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--text-secondary)]">
					Monthly Trend
				</h3>
				<ResponsiveContainer width="100%" height={280}>
					<LineChart data={lineData}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="month" tick={{ fontSize: 12 }} />
						<YAxis tickFormatter={formatAxisValue} tick={{ fontSize: 12 }} />
						<Tooltip formatter={(value, name) => [formatTooltipValue(value as number), name]} />
						<Legend />
						{data.versions.map((version) => (
							<Line
								key={version.id}
								type="monotone"
								dataKey={version.name}
								stroke={getVersionColor(version.type)}
								strokeWidth={2}
								dot={{ r: 3 }}
								activeDot={{ r: 5 }}
							/>
						))}
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
