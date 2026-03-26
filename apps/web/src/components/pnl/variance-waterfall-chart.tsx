import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';
import Decimal from 'decimal.js';
import { ChartWrapper } from '../shared/chart-wrapper';
import { formatMoney } from '../../lib/format-money';
import {
	CHART_TOOLTIP_CONTENT_STYLE,
	CHART_AXIS_TICK,
	CHART_AXIS_TICK_LG,
} from '../../lib/chart-utils';
import type { PnlLineItem } from '@budfin/types';

interface VarianceWaterfallChartProps {
	lines: PnlLineItem[];
}

interface WaterfallDatum {
	label: string;
	variance: number;
	fill: string;
}

/**
 * Finds the variance annual total for a given section subtotal.
 */
function findVarianceAnnual(lines: PnlLineItem[], sectionKey: string): number {
	const row = lines.find(
		(line) => line.sectionKey === sectionKey && line.isSubtotal && line.depth === 1
	);
	if (!row?.varianceAnnualTotal) return 0;
	return new Decimal(row.varianceAnnualTotal).toNumber();
}

export function VarianceWaterfallChart({ lines }: VarianceWaterfallChartProps) {
	const chartData = useMemo<WaterfallDatum[]>(() => {
		const drivers = [
			{ label: 'Revenue', key: 'TOTAL_REVENUE' },
			{ label: 'Staff Costs', key: 'STAFF_COSTS' },
			{ label: 'OpEx', key: 'OTHER_OPEX' },
			{ label: 'Net Profit', key: 'NET_PROFIT' },
		];

		return drivers.map(({ label, key }) => {
			const variance = findVarianceAnnual(lines, key);
			return {
				label,
				variance,
				fill: variance >= 0 ? 'var(--color-success)' : 'var(--color-error)',
			};
		});
	}, [lines]);

	const hasData = chartData.some((d) => d.variance !== 0);
	if (!hasData) return null;

	return (
		<div aria-label="Variance waterfall chart">
			<h3 className="mb-2 text-(--text-sm) font-semibold text-(--text-primary)">
				Variance Drivers (Primary vs Comparison)
			</h3>
			<ChartWrapper height={260}>
				<BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
					<CartesianGrid strokeDasharray="3 3" stroke="var(--workspace-border)" />
					<XAxis dataKey="label" tick={CHART_AXIS_TICK_LG} stroke="var(--workspace-border)" />
					<YAxis
						tick={CHART_AXIS_TICK}
						stroke="var(--workspace-border)"
						tickFormatter={(v: number) => formatMoney(v, { compact: true })}
					/>
					<Tooltip
						contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
						formatter={(value: number | undefined) => {
							const v = value ?? 0;
							return [`${v >= 0 ? '+' : ''}${formatMoney(v)}`, 'Variance'];
						}}
					/>
					<ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
					<Bar dataKey="variance" name="Variance" radius={[2, 2, 0, 0]}>
						{chartData.map((entry, index) => (
							<Cell key={`cell-${index}`} fill={entry.fill} />
						))}
					</Bar>
				</BarChart>
			</ChartWrapper>
		</div>
	);
}
