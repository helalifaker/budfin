import { Clock, DollarSign, FileText, Shield, TrendingUp, Users } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Counter } from '../shared/counter';
import { Skeleton } from '../ui/skeleton';

const sarFormatter = new Intl.NumberFormat('en-SA', {
	style: 'decimal',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

export type StaffingKpiRibbonProps = {
	totalHeadcount: number;
	totalAnnualStaffCost: number;
	avgMonthlyCostPerEmployee: number;
	gosiTotal: number;
	ajeerTotal: number;
	eosTotal: number;
	isStale: boolean;
	isLoading?: boolean;
};

const kpiDefs = [
	{
		label: 'Total Headcount',
		key: 'totalHeadcount' as const,
		icon: Users,
		formatter: (v: number) => v.toLocaleString(),
	},
	{
		label: 'Annual Staff Cost',
		key: 'totalAnnualStaffCost' as const,
		icon: DollarSign,
		formatter: (v: number) => `SAR ${sarFormatter.format(v)}`,
	},
	{
		label: 'Avg Monthly / Employee',
		key: 'avgMonthlyCostPerEmployee' as const,
		icon: TrendingUp,
		formatter: (v: number) => `SAR ${sarFormatter.format(v)}`,
	},
	{
		label: 'GOSI Total',
		key: 'gosiTotal' as const,
		icon: Shield,
		formatter: (v: number) => `SAR ${sarFormatter.format(v)}`,
	},
	{
		label: 'Ajeer Total',
		key: 'ajeerTotal' as const,
		icon: FileText,
		formatter: (v: number) => `SAR ${sarFormatter.format(v)}`,
	},
	{
		label: 'EoS Total',
		key: 'eosTotal' as const,
		icon: Clock,
		formatter: (v: number) => `SAR ${sarFormatter.format(v)}`,
	},
];

export function StaffingKpiRibbon({
	totalHeadcount,
	totalAnnualStaffCost,
	avgMonthlyCostPerEmployee,
	gosiTotal,
	ajeerTotal,
	eosTotal,
	isStale,
	isLoading = false,
}: StaffingKpiRibbonProps) {
	const values = {
		totalHeadcount,
		totalAnnualStaffCost,
		avgMonthlyCostPerEmployee,
		gosiTotal,
		ajeerTotal,
		eosTotal,
	};

	return (
		<>
			<div
				className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
				role="region"
				aria-label="Staffing key performance indicators"
			>
				{kpiDefs.map((kpi, i) => {
					const Icon = kpi.icon;
					const value = values[kpi.key];

					return (
						<div
							key={kpi.key}
							className={cn(
								'animate-kpi-enter relative overflow-hidden',
								'rounded-(--radius-xl)',
								'border border-(--workspace-border)',
								'shadow-(--shadow-card)',
								'bg-(--workspace-bg-card) p-3'
							)}
							style={{ animationDelay: `${i * 60}ms` }}
						>
							<span
								className={cn(
									'absolute left-0 top-2 bottom-2 w-[3px] rounded-full',
									'bg-(--accent-500)'
								)}
								aria-hidden="true"
							/>

							<div className="flex items-center gap-3 pl-3">
								<span
									className={cn(
										'flex h-10 w-10 shrink-0 items-center justify-center',
										'rounded-(--radius-lg)',
										'bg-(--accent-50)'
									)}
								>
									<Icon className="h-5 w-5 text-(--accent-500)" aria-hidden="true" />
								</span>

								<div className="flex min-w-0 flex-col">
									<span className="text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
										{kpi.label}
									</span>
									{isLoading ? (
										<Skeleton className="mt-1 h-7 w-20" />
									) : (
										<Counter
											value={value}
											formatter={kpi.formatter}
											className={cn(
												'truncate text-(--text-xl)',
												'font-bold text-(--text-primary)',
												'font-[family-name:var(--font-display)]',
												kpi.key !== 'totalHeadcount' && 'font-[family-name:var(--font-mono)]'
											)}
										/>
									)}
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
						className="size-2 animate-pulse rounded-full bg-(--color-stale)"
						aria-hidden="true"
					/>
					<span className="text-(--text-xs) font-medium text-(--color-stale)">
						Stale — recalculate to refresh
					</span>
				</div>
			)}
		</>
	);
}
