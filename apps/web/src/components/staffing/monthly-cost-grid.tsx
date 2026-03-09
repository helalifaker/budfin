import { useState } from 'react';
import { cn } from '../../lib/cn';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import type { StaffCostRow } from '../../hooks/use-staffing';

export type MonthlyCostGridProps = {
	data: StaffCostRow[];
	totals: {
		total_gross_salary: string | null;
		total_allowances: string | null;
		total_social_charges: string;
		total_staff_cost: string;
	} | null;
	isRedacted: boolean;
};

function formatSar(val: string | null): string {
	if (val === null) return '\u2014';
	return `SAR ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type GroupBy = 'month' | 'department' | 'employee';

export function MonthlyCostGrid({ data, totals, isRedacted }: MonthlyCostGridProps) {
	const [groupBy, setGroupBy] = useState<GroupBy>('month');

	if (data.length === 0) {
		return (
			<div className="py-6 text-center text-sm text-[var(--text-muted)]">
				No staff cost data available. Run Calculate to generate monthly costs.
			</div>
		);
	}

	const visibleColCount = isRedacted ? 3 : 5;
	// +1 for header row, +1 for totals footer row if present
	const totalRowCount = data.length + 1 + (totals ? 1 : 0);

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-[length:var(--text-xs)] font-medium text-[var(--text-muted)]">
					Group by:
				</span>
				<ToggleGroup
					type="single"
					value={groupBy}
					onValueChange={(val) => {
						if (val) setGroupBy(val as GroupBy);
					}}
					aria-label="Group costs by"
				>
					<ToggleGroupItem value="month">Month</ToggleGroupItem>
					<ToggleGroupItem value="department">Dept</ToggleGroupItem>
					<ToggleGroupItem value="employee">Employee</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--workspace-border)]">
				<table
					className="w-full border-collapse text-sm"
					role="grid"
					aria-label="Monthly staff costs"
					aria-readonly="true"
					aria-rowcount={totalRowCount}
					aria-colcount={visibleColCount}
				>
					<thead>
						<tr className="bg-[var(--workspace-bg-subtle)]">
							<th
								className="px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
								aria-colindex={1}
							>
								{groupBy === 'month'
									? 'Month'
									: groupBy === 'department'
										? 'Department'
										: 'Employee'}
							</th>
							{!isRedacted && (
								<>
									<th
										className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
										aria-colindex={2}
									>
										Gross Salary
									</th>
									<th
										className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
										aria-colindex={3}
									>
										Allowances
									</th>
								</>
							)}
							<th
								className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
								aria-colindex={isRedacted ? 2 : 4}
							>
								Social Charges
							</th>
							<th
								className="px-3 py-2 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider"
								aria-colindex={isRedacted ? 3 : 5}
							>
								Total Cost
							</th>
						</tr>
					</thead>
					<tbody>
						{data.map((row) => {
							let colCounter = 0;
							return (
								<tr
									key={row.group_key}
									className={cn(
										'border-t border-[var(--workspace-border)]',
										'hover:bg-[var(--workspace-bg-subtle)]'
									)}
								>
									<td
										role="gridcell"
										aria-colindex={++colCounter}
										className="px-3 py-1.5 font-medium text-[var(--text-primary)]"
									>
										{row.group_key}
									</td>
									{!isRedacted && (
										<>
											<td
												role="gridcell"
												aria-colindex={++colCounter}
												className="px-3 py-1.5 text-right font-mono text-[var(--text-primary)]"
											>
												{formatSar(row.total_gross_salary)}
											</td>
											<td
												role="gridcell"
												aria-colindex={++colCounter}
												className="px-3 py-1.5 text-right font-mono text-[var(--text-primary)]"
											>
												{formatSar(row.total_allowances)}
											</td>
										</>
									)}
									<td
										role="gridcell"
										aria-colindex={++colCounter}
										className="px-3 py-1.5 text-right font-mono text-[var(--text-primary)]"
									>
										{formatSar(row.total_social_charges)}
									</td>
									<td
										role="gridcell"
										aria-colindex={++colCounter}
										className="px-3 py-1.5 text-right font-mono font-medium text-[var(--accent-700)]"
									>
										{formatSar(row.total_staff_cost)}
									</td>
								</tr>
							);
						})}
					</tbody>
					{totals && (
						<tfoot>
							<tr className="border-t-2 border-[var(--workspace-border)] bg-[var(--workspace-bg-subtle)]">
								<td className="px-3 py-2 font-semibold text-[var(--text-primary)]">Total</td>
								{!isRedacted && (
									<>
										<td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-primary)]">
											{formatSar(totals.total_gross_salary)}
										</td>
										<td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-primary)]">
											{formatSar(totals.total_allowances)}
										</td>
									</>
								)}
								<td className="px-3 py-2 text-right font-mono font-semibold text-[var(--text-primary)]">
									{formatSar(totals.total_social_charges)}
								</td>
								<td className="px-3 py-2 text-right font-mono font-bold text-[var(--accent-700)]">
									{formatSar(totals.total_staff_cost)}
								</td>
							</tr>
						</tfoot>
					)}
				</table>
			</div>
		</div>
	);
}
