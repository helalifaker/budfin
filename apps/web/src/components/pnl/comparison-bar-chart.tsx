import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import Decimal from 'decimal.js';
import { ChartWrapper } from '../shared/chart-wrapper';
import { formatMoney } from '../../lib/format-money';
import type { PnlLineItem } from '@budfin/types';

interface ComparisonBarChartProps {
	lines: PnlLineItem[];
	primaryLabel: string;
	comparisonLabel: string;
}

interface ChartDatum {
	label: string;
	primary: number;
	comparison: number;
}

/**
 * Extracts the annual total for a given section subtotal row.
 * Looks for a subtotal row whose sectionKey matches the target.
 */
function findSubtotalAnnual(
	lines: PnlLineItem[],
	sectionKey: string,
	field: 'annualTotal' | 'comparisonAnnualTotal'
): number {
	const row = lines.find(
		(line) => line.sectionKey === sectionKey && line.isSubtotal && line.depth === 1
	);
	if (!row) return 0;
	const value = field === 'annualTotal' ? row.annualTotal : row.comparisonAnnualTotal;
	if (!value) return 0;
	return new Decimal(value).toNumber();
}

export function ComparisonBarChart({
	lines,
	primaryLabel,
	comparisonLabel,
}: ComparisonBarChartProps) {
	const chartData = useMemo<ChartDatum[]>(() => {
		const metrics = [
			{ label: 'Revenue', key: 'TOTAL_REVENUE' },
			{ label: 'Staff Costs', key: 'STAFF_COSTS' },
			{ label: 'OpEx', key: 'OTHER_OPEX' },
			{ label: 'Net Profit', key: 'NET_PROFIT' },
		];

		return metrics.map(({ label, key }) => ({
			label,
			primary: Math.abs(findSubtotalAnnual(lines, key, 'annualTotal')),
			comparison: Math.abs(findSubtotalAnnual(lines, key, 'comparisonAnnualTotal')),
		}));
	}, [lines]);

	const hasData = chartData.some((d) => d.primary !== 0 || d.comparison !== 0);
	if (!hasData) return null;

	return (
		<div aria-label="Version comparison bar chart">
			<h3 className="mb-2 text-(--text-sm) font-semibold text-(--text-primary)">
				Version Comparison
			</h3>
			<ChartWrapper height={260}>
				<BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--workspace-border)" />
					<XAxis
						dataKey="label"
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
						formatter={(value: number | undefined) => [formatMoney(value ?? 0)]}
					/>
					<Legend wrapperStyle={{ fontSize: '12px' }} />
					<Bar
						dataKey="primary"
						name={primaryLabel}
						fill="var(--accent-500)"
						radius={[2, 2, 0, 0]}
					/>
					<Bar
						dataKey="comparison"
						name={comparisonLabel}
						fill="var(--chart-series-5, #7c3aed)"
						radius={[2, 2, 0, 0]}
					/>
				</BarChart>
			</ChartWrapper>
		</div>
	);
}
