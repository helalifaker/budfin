import Decimal from 'decimal.js';
import type { AccountingPnlSection } from '@budfin/types';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';

export interface PnlAccountingGridProps {
	sections: AccountingPnlSection[];
	hasComparison: boolean;
	onRowClick: (sectionKey: string, lineLabel: string) => void;
}

function formatAmount(value: string): string {
	const d = new Decimal(value);
	if (d.isZero()) return '--';
	const formatted = formatMoney(d.abs());
	return d.isNeg() ? `(${formatted})` : formatted;
}

function varianceColorClass(value: string): string {
	const d = new Decimal(value);
	if (d.isZero()) return 'text-(--text-muted)';
	return d.gt(0) ? 'text-(--color-success)' : 'text-(--color-error)';
}

interface GridRow {
	key: string;
	type: 'detail' | 'others' | 'subtotal';
	sectionKey: string;
	displayLabel: string;
	budgetAmount: string;
	actualAmount: string | null;
	variance: string | null;
	variancePct: string | null;
	accountCode: string | null;
}

function flattenSections(sections: AccountingPnlSection[]): GridRow[] {
	const rows: GridRow[] = [];

	for (const section of sections) {
		if (section.isSubtotal) {
			rows.push({
				key: `subtotal-${section.sectionKey}`,
				type: 'subtotal',
				sectionKey: section.sectionKey,
				displayLabel: section.displayLabel,
				budgetAmount: section.budgetSubtotal,
				actualAmount: section.actualSubtotal ?? null,
				variance: section.varianceSubtotal ?? null,
				variancePct: section.variancePctSubtotal ?? null,
				accountCode: null,
			});
		} else {
			for (const line of section.lines) {
				rows.push({
					key: `${section.sectionKey}-${line.accountCode ?? line.displayLabel}`,
					type: 'detail',
					sectionKey: section.sectionKey,
					displayLabel: line.displayLabel,
					budgetAmount: line.budgetAmount,
					actualAmount: line.actualAmount ?? null,
					variance: line.variance ?? null,
					variancePct: line.variancePct ?? null,
					accountCode: line.accountCode ?? null,
				});
			}
			if (section.othersAmount) {
				rows.push({
					key: `others-${section.sectionKey}`,
					type: 'others',
					sectionKey: section.sectionKey,
					displayLabel: 'Others',
					budgetAmount: section.othersAmount,
					actualAmount: null,
					variance: null,
					variancePct: null,
					accountCode: null,
				});
			}
		}
	}

	return rows;
}

export function PnlAccountingGrid({ sections, hasComparison, onRowClick }: PnlAccountingGridProps) {
	const rows = flattenSections(sections);

	if (rows.length === 0) return null;

	return (
		<div
			className="overflow-hidden rounded-xl border border-(--workspace-border)"
			role="table"
			aria-label="P&L Accounting Statement"
		>
			<table className="w-full text-(--text-sm)">
				<thead>
					<tr className="bg-(--workspace-bg-muted)">
						<th
							className={cn(
								'px-4 py-2.5 text-left text-(--text-xs)',
								'font-medium uppercase tracking-wider text-(--text-muted)'
							)}
						>
							Line Item
						</th>
						<th
							className={cn(
								'px-4 py-2.5 text-right text-(--text-xs)',
								'font-medium uppercase tracking-wider text-(--text-muted)'
							)}
						>
							Budget
						</th>
						{hasComparison && (
							<>
								<th
									className={cn(
										'px-4 py-2.5 text-right text-(--text-xs)',
										'font-medium uppercase tracking-wider text-(--text-muted)'
									)}
								>
									Actual
								</th>
								<th
									className={cn(
										'px-4 py-2.5 text-right text-(--text-xs)',
										'font-medium uppercase tracking-wider text-(--text-muted)'
									)}
								>
									Variance
								</th>
								<th
									className={cn(
										'px-4 py-2.5 text-right text-(--text-xs)',
										'font-medium uppercase tracking-wider text-(--text-muted)'
									)}
								>
									Var %
								</th>
							</>
						)}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const isSubtotal = row.type === 'subtotal';
						const isOthers = row.type === 'others';
						const isClickable = row.type === 'detail';

						return (
							<tr
								key={row.key}
								className={cn(
									'border-t border-(--workspace-border)',
									'transition-colors duration-(--duration-fast)',
									isSubtotal && 'bg-(--workspace-bg-subtle) font-bold',
									isSubtotal && 'border-t-2',
									isOthers && 'text-(--text-muted) italic',
									isClickable && 'cursor-pointer hover:bg-(--accent-50)/50'
								)}
								onClick={
									isClickable ? () => onRowClick(row.sectionKey, row.displayLabel) : undefined
								}
								role={isClickable ? 'button' : undefined}
								tabIndex={isClickable ? 0 : undefined}
								onKeyDown={
									isClickable
										? (e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													onRowClick(row.sectionKey, row.displayLabel);
												}
											}
										: undefined
								}
								aria-label={isClickable ? `View details for ${row.displayLabel}` : undefined}
							>
								<td
									className={cn('px-4 py-2', isSubtotal && 'font-semibold', !isSubtotal && 'pl-8')}
								>
									{row.accountCode && !isSubtotal && (
										<span className="mr-2 font-mono text-(--text-xs) text-(--text-muted)">
											{row.accountCode}
										</span>
									)}
									{row.displayLabel}
								</td>
								<td
									className={cn(
										'px-4 py-2 text-right font-mono tabular-nums',
										isSubtotal && 'font-semibold'
									)}
								>
									{formatAmount(row.budgetAmount)}
								</td>
								{hasComparison && (
									<>
										<td className="px-4 py-2 text-right font-mono tabular-nums">
											{row.actualAmount ? formatAmount(row.actualAmount) : '--'}
										</td>
										<td
											className={cn(
												'px-4 py-2 text-right font-mono tabular-nums',
												row.variance && varianceColorClass(row.variance)
											)}
										>
											{row.variance ? formatAmount(row.variance) : '--'}
										</td>
										<td
											className={cn(
												'px-4 py-2 text-right font-mono tabular-nums',
												row.variancePct && varianceColorClass(row.variancePct)
											)}
										>
											{row.variancePct ? `${row.variancePct}%` : '--'}
										</td>
									</>
								)}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
