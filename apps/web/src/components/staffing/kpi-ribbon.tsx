import { Briefcase, DollarSign, Users, Calculator } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Counter } from '../shared/counter';

export type StaffingKpiRibbonProps = {
	totalFte: number;
	totalEmployees: number;
	totalStaffCost: number;
	costPerFte: number;
	isStale: boolean;
};

const kpiDefs = [
	{
		label: 'Total FTE',
		key: 'totalFte',
		icon: Calculator,
		formatter: (v: number) => v.toFixed(1),
	},
	{
		label: 'Employees',
		key: 'totalEmployees',
		icon: Users,
		formatter: (v: number) => v.toLocaleString(),
	},
	{
		label: 'Annual Staff Cost',
		key: 'totalStaffCost',
		icon: DollarSign,
		formatter: (v: number) => `SAR ${v.toLocaleString()}`,
	},
	{
		label: 'Cost / FTE',
		key: 'costPerFte',
		icon: Briefcase,
		formatter: (v: number) => `SAR ${v.toLocaleString()}`,
	},
] as const;

export function StaffingKpiRibbon({
	totalFte,
	totalEmployees,
	totalStaffCost,
	costPerFte,
	isStale,
}: StaffingKpiRibbonProps) {
	const values = { totalFte, totalEmployees, totalStaffCost, costPerFte };

	return (
		<>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{kpiDefs.map((kpi, i) => {
					const Icon = kpi.icon;
					const value = values[kpi.key];

					return (
						<div
							key={kpi.key}
							className={cn(
								'animate-kpi-enter relative overflow-hidden',
								'rounded-[var(--radius-xl)]',
								'border border-[var(--workspace-border)]',
								'shadow-[var(--shadow-card)]',
								'bg-[var(--workspace-bg-card)] p-3'
							)}
							style={{ animationDelay: `${i * 60}ms` }}
						>
							<span
								className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[var(--accent-500)]"
								aria-hidden="true"
							/>

							<div className="flex items-center gap-3 pl-3">
								<span
									className={cn(
										'flex h-10 w-10 shrink-0 items-center justify-center',
										'rounded-[var(--radius-lg)]',
										'bg-[var(--accent-50)]'
									)}
								>
									<Icon className="h-5 w-5 text-[var(--accent-500)]" aria-hidden="true" />
								</span>

								<div className="flex flex-col">
									<span className="text-[length:var(--text-xs)] font-medium uppercase tracking-wider text-[var(--text-muted)]">
										{kpi.label}
									</span>
									<Counter
										value={value}
										formatter={kpi.formatter}
										className="text-[length:var(--text-2xl)] font-bold text-[var(--text-primary)] font-[family-name:var(--font-display)]"
									/>
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{isStale && (
				<div
					className="flex items-center gap-1.5"
					role="status"
					aria-label="Data is stale, recalculation needed"
				>
					<span
						className="size-2 animate-pulse rounded-full bg-[var(--color-stale)]"
						aria-hidden="true"
					/>
					<span className="text-[length:var(--text-xs)] font-medium text-[var(--color-stale)]">
						Stale — recalculate to refresh
					</span>
				</div>
			)}
		</>
	);
}
