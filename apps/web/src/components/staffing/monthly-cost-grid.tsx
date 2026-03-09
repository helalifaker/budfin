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
	if (val === null) return '—';
	return `SAR ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type GroupBy = 'month' | 'department' | 'employee';

export function MonthlyCostGrid({ data, totals, isRedacted }: MonthlyCostGridProps) {
	const [groupBy, setGroupBy] = useState<GroupBy>('month');

	if (data.length === 0) {
		return (
			<div className="py-6 text-center text-sm text-(--text-muted)">
				No staff cost data available. Run Calculate to generate monthly costs.
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-(--text-xs) font-medium text-(--text-muted)">Group by:</span>
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

			<div className="overflow-x-auto rounded-(--radius-md) border border-(--workspace-border)">
				<table className="w-full border-collapse text-sm" role="grid">
					<thead>
						<tr className="bg-(--workspace-bg-subtle)">
							<th className="px-3 py-2 text-left text-xs font-medium text-(--text-muted) uppercase tracking-wider">
								{groupBy === 'month'
									? 'Month'
									: groupBy === 'department'
										? 'Department'
										: 'Employee'}
							</th>
							{!isRedacted && (
								<>
									<th className="px-3 py-2 text-right text-xs font-medium text-(--text-muted) uppercase tracking-wider">
										Gross Salary
									</th>
									<th className="px-3 py-2 text-right text-xs font-medium text-(--text-muted) uppercase tracking-wider">
										Allowances
									</th>
								</>
							)}
							<th className="px-3 py-2 text-right text-xs font-medium text-(--text-muted) uppercase tracking-wider">
								Social Charges
							</th>
							<th className="px-3 py-2 text-right text-xs font-medium text-(--text-muted) uppercase tracking-wider">
								Total Cost
							</th>
						</tr>
					</thead>
					<tbody>
						{data.map((row) => (
							<tr
								key={row.group_key}
								className={cn(
									'border-t border-(--workspace-border)',
									'hover:bg-(--workspace-bg-subtle)'
								)}
							>
								<td className="px-3 py-1.5 font-medium text-(--text-primary)">{row.group_key}</td>
								{!isRedacted && (
									<>
										<td className="px-3 py-1.5 text-right font-mono text-(--text-primary)">
											{formatSar(row.total_gross_salary)}
										</td>
										<td className="px-3 py-1.5 text-right font-mono text-(--text-primary)">
											{formatSar(row.total_allowances)}
										</td>
									</>
								)}
								<td className="px-3 py-1.5 text-right font-mono text-(--text-primary)">
									{formatSar(row.total_social_charges)}
								</td>
								<td className="px-3 py-1.5 text-right font-mono font-medium text-(--accent-700)">
									{formatSar(row.total_staff_cost)}
								</td>
							</tr>
						))}
					</tbody>
					{totals && (
						<tfoot>
							<tr className="border-t-2 border-(--workspace-border) bg-(--workspace-bg-subtle)">
								<td className="px-3 py-2 font-semibold text-(--text-primary)">Total</td>
								{!isRedacted && (
									<>
										<td className="px-3 py-2 text-right font-mono font-semibold text-(--text-primary)">
											{formatSar(totals.total_gross_salary)}
										</td>
										<td className="px-3 py-2 text-right font-mono font-semibold text-(--text-primary)">
											{formatSar(totals.total_allowances)}
										</td>
									</>
								)}
								<td className="px-3 py-2 text-right font-mono font-semibold text-(--text-primary)">
									{formatSar(totals.total_social_charges)}
								</td>
								<td className="px-3 py-2 text-right font-mono font-bold text-(--accent-700)">
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
