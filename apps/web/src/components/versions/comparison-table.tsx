import { useMemo } from 'react';
import type { MultiCompareResponse } from '../../hooks/use-versions';
import type { MetricKey } from './comparison-view';

export type ComparisonTableProps = {
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

const intFmt = new Intl.NumberFormat('en-US', {
	style: 'decimal',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

const pctFmt = new Intl.NumberFormat('en-US', {
	style: 'decimal',
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});

function computeVariance(a: number, b: number): number | null {
	if (b === 0) return null;
	return ((a - b) / Math.abs(b)) * 100;
}

function varianceClass(variance: number | null, metric: MetricKey): string {
	if (variance === null || variance === 0) return '';
	// For costs, negative variance is favorable (costs went down)
	const isCost = metric === 'staffCosts';
	const isFavorable = isCost ? variance < 0 : variance > 0;
	return isFavorable ? 'text-emerald-600' : 'text-red-600';
}

function formatVariance(a: number, b: number, metric: MetricKey): { text: string; cls: string } {
	const v = computeVariance(a, b);
	return {
		text: v !== null ? `${pctFmt.format(v)}%` : '-',
		cls: varianceClass(v, metric),
	};
}

export function ComparisonTable({ data, metric }: ComparisonTableProps) {
	const versions = data.versions;
	const hasThird = versions.length >= 3;

	const rows = useMemo(() => {
		return MONTH_NAMES.map((monthName, idx) => {
			const monthEntry = data.monthly.find((m) => m.month === idx + 1);
			const values = versions.map((v) => {
				const val = monthEntry?.values.find((mv) => mv.versionId === v.id);
				return val ? Number(val[metric]) : 0;
			});
			return { label: monthName, values };
		});
	}, [data, metric, versions]);

	const totals = useMemo(() => {
		return versions.map((v) => {
			const total = data.annualTotals.find((t) => t.versionId === v.id);
			return total ? Number(total[metric]) : 0;
		});
	}, [data, metric, versions]);

	const t0 = totals[0] ?? 0;
	const t1 = totals[1] ?? 0;
	const t2 = totals[2] ?? 0;
	const totalVar12 = formatVariance(t0, t1, metric);
	const totalVar13 = formatVariance(t0, t2, metric);

	return (
		<div className="mt-6 overflow-x-auto" role="region" aria-label="Comparison table">
			<table className="w-full text-[length:var(--text-sm)]">
				<thead>
					<tr className="border-b border-[var(--workspace-border)] text-left">
						<th className="px-3 py-2 font-medium text-[var(--text-secondary)]">Month</th>
						{versions.map((v) => (
							<th
								key={v.id}
								className="px-3 py-2 text-right font-medium text-[var(--text-secondary)]"
							>
								{v.name}
							</th>
						))}
						<th className="px-3 py-2 text-right font-medium text-[var(--text-secondary)]">
							Var 1-2
						</th>
						{hasThird && (
							<th className="px-3 py-2 text-right font-medium text-[var(--text-secondary)]">
								Var 1-3
							</th>
						)}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const v0 = row.values[0] ?? 0;
						const v1 = row.values[1] ?? 0;
						const v2 = row.values[2] ?? 0;
						const var12 = formatVariance(v0, v1, metric);
						const var13 = formatVariance(v0, v2, metric);

						return (
							<tr
								key={row.label}
								className="border-b border-[var(--workspace-border)] hover:bg-[var(--bg-hover)]"
							>
								<td className="px-3 py-2 text-[var(--text-primary)]">{row.label}</td>
								{row.values.map((val, i) => (
									<td
										key={versions[i]?.id ?? i}
										className="px-3 py-2 text-right font-[family-name:var(--font-mono)] text-[var(--text-primary)]"
									>
										{intFmt.format(val)}
									</td>
								))}
								<td
									className={`px-3 py-2 text-right font-[family-name:var(--font-mono)] ${var12.cls}`}
								>
									{var12.text}
								</td>
								{hasThird && (
									<td
										className={`px-3 py-2 text-right font-[family-name:var(--font-mono)] ${var13.cls}`}
									>
										{var13.text}
									</td>
								)}
							</tr>
						);
					})}

					<tr className="border-t-2 border-[var(--workspace-border)] font-bold">
						<td className="px-3 py-2 text-[var(--text-primary)]">Total</td>
						{totals.map((val, i) => (
							<td
								key={versions[i]?.id ?? i}
								className="px-3 py-2 text-right font-[family-name:var(--font-mono)] text-[var(--text-primary)]"
							>
								{intFmt.format(val)}
							</td>
						))}
						<td
							className={`px-3 py-2 text-right font-[family-name:var(--font-mono)] ${totalVar12.cls}`}
						>
							{totalVar12.text}
						</td>
						{hasThird && (
							<td
								className={`px-3 py-2 text-right font-[family-name:var(--font-mono)] ${totalVar13.cls}`}
							>
								{totalVar13.text}
							</td>
						)}
					</tr>
				</tbody>
			</table>
		</div>
	);
}
