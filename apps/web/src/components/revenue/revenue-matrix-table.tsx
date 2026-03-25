import { Fragment } from 'react';
import Decimal from 'decimal.js';
import type { RevenueMatrixRow } from '@budfin/types';
import { formatMoney } from '../../lib/format-money';

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

function formatAmount(value: string) {
	const d = new Decimal(value || '0');
	if (d.abs().lessThan('0.0001')) {
		return '-';
	}

	return formatMoney(d);
}

function formatPercent(value: string) {
	const numeric = Number(value) * 100;
	return `${numeric.toFixed(2)}%`;
}

interface RevenueMatrixTableProps {
	rows: RevenueMatrixRow[];
	ariaLabel: string;
}

export function RevenueMatrixTable({ rows, ariaLabel }: RevenueMatrixTableProps) {
	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-(--workspace-border) px-4 py-12 text-center text-sm text-(--text-muted)">
				Run the revenue calculation to populate this sheet.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-lg border border-(--workspace-border) shadow-(--shadow-xs)">
			<table role="table" aria-label={ariaLabel} className="min-w-[1120px] w-full text-sm">
				<thead className="border-b border-(--workspace-border) bg-(--workspace-bg-muted)">
					<tr>
						<th className="sticky left-0 z-10 min-w-[220px] border-r border-(--workspace-border) bg-(--workspace-bg-muted) px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-(--text-secondary)">
							Line Item
						</th>
						{MONTH_NAMES.map((month) => (
							<th
								key={month}
								className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-(--text-secondary)"
							>
								{month}
							</th>
						))}
						<th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-(--text-secondary)">
							FY2026
						</th>
						<th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-(--text-secondary)">
							% Rev
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row, index) => {
						const previousSection = rows[index - 1]?.section;
						const sectionChanged = row.section !== previousSection;

						return (
							<Fragment key={`${row.section}-${row.label}`}>
								{sectionChanged && (
									<tr
										key={`${row.section}-heading`}
										className="border-b border-(--workspace-border)"
									>
										<td
											colSpan={15}
											className="bg-(--workspace-bg-subtle) px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-secondary)"
										>
											{row.section}
										</td>
									</tr>
								)}
								<tr
									className={`border-b border-(--workspace-border) last:border-0 ${
										row.isTotal
											? 'bg-(--workspace-bg-subtle) font-semibold'
											: 'hover:bg-(--accent-50)'
									}`}
								>
									<td className="sticky left-0 z-10 border-r border-(--workspace-border) bg-inherit px-4 py-3 text-left">
										{row.label}
									</td>
									{row.monthlyAmounts.map((amount, index) => {
										const isNeg = new Decimal(amount || '0').isNeg();
										return (
											<td
												key={`${row.label}-${MONTH_NAMES[index]}`}
												className={`px-3 py-3 text-right tabular-nums ${
													isNeg ? 'text-(--color-error)' : ''
												}`}
											>
												{formatAmount(amount)}
											</td>
										);
									})}
									<td
										className={`px-3 py-3 text-right tabular-nums ${
											new Decimal(row.annualTotal || '0').isNeg() ? 'text-(--color-error)' : ''
										}`}
									>
										{formatAmount(row.annualTotal)}
									</td>
									<td className="px-3 py-3 text-right tabular-nums text-(--text-muted)">
										{formatPercent(row.percentageOfRevenue)}
									</td>
								</tr>
							</Fragment>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
