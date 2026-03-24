import {
	ArrowUpRight,
	BarChart3,
	Clock,
	DollarSign,
	TrendingDown,
	TrendingUp,
	Users,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Counter } from '../shared/counter';
import { formatMoney } from '../../lib/format-money';

export type StaffingKpiRibbonV2Props = {
	totalHeadcount: number;
	fteGap: number;
	staffCost: number;
	hsaBudget: number;
	heRatio: number;
	rechargeCost: number;
	isStale: boolean;
};

type KpiDef = {
	label: string;
	key: keyof Omit<StaffingKpiRibbonV2Props, 'isStale'>;
	icon: typeof Users;
	formatter: (v: number) => string;
	getBorderClass?: (value: number) => string;
	getIconBgClass?: (value: number) => string;
	getIconColorClass?: (value: number) => string;
};

function fteGapBorderClass(gap: number): string {
	if (gap < -0.25) return 'border-l-(--color-error)';
	if (gap > 0.25) return 'border-l-(--color-warning)';
	return 'border-l-(--color-success)';
}

function fteGapIconBgClass(gap: number): string {
	if (gap < -0.25) return 'bg-(--color-error-bg)';
	if (gap > 0.25) return 'bg-(--color-warning-bg)';
	return 'bg-(--color-success-bg)';
}

function fteGapIconColorClass(gap: number): string {
	if (gap < -0.25) return 'text-(--color-error)';
	if (gap > 0.25) return 'text-(--color-warning)';
	return 'text-(--color-success)';
}

const kpiDefs: KpiDef[] = [
	{
		label: 'Total Headcount',
		key: 'totalHeadcount',
		icon: Users,
		formatter: (v: number) => new Intl.NumberFormat('fr-FR').format(v),
	},
	{
		label: 'FTE Gap',
		key: 'fteGap',
		icon: TrendingUp,
		formatter: (v: number) => v.toFixed(2),
		getBorderClass: fteGapBorderClass,
		getIconBgClass: fteGapIconBgClass,
		getIconColorClass: fteGapIconColorClass,
	},
	{
		label: 'Staff Cost',
		key: 'staffCost',
		icon: DollarSign,
		formatter: (v: number) => formatMoney(v, { millions: true, showCurrency: true }),
	},
	{
		label: 'HSA Budget',
		key: 'hsaBudget',
		icon: Clock,
		formatter: (v: number) => formatMoney(v, { millions: true, showCurrency: true }),
	},
	{
		label: 'H/E Ratio',
		key: 'heRatio',
		icon: BarChart3,
		formatter: (v: number) => v.toFixed(2),
	},
	{
		label: 'Recharge Cost',
		key: 'rechargeCost',
		icon: ArrowUpRight,
		formatter: (v: number) => formatMoney(v, { millions: true, showCurrency: true }),
	},
];

function getFteGapIcon(gap: number) {
	return gap < 0 ? TrendingDown : TrendingUp;
}

export function StaffingKpiRibbonV2({
	totalHeadcount,
	fteGap,
	staffCost,
	hsaBudget,
	heRatio,
	rechargeCost,
	isStale,
}: StaffingKpiRibbonV2Props) {
	const values: Record<string, number> = {
		totalHeadcount,
		fteGap,
		staffCost,
		hsaBudget,
		heRatio,
		rechargeCost,
	};

	return (
		<>
			<div
				className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6"
				role="region"
				aria-label="Staffing key performance indicators"
			>
				{kpiDefs.map((kpi, i) => {
					const value = values[kpi.key] ?? 0;
					const borderClass = kpi.getBorderClass
						? kpi.getBorderClass(value)
						: 'border-l-(--kpi-accent-default)';
					const iconBgClass = kpi.getIconBgClass ? kpi.getIconBgClass(value) : 'bg-(--accent-50)';
					const iconColorClass = kpi.getIconColorClass
						? kpi.getIconColorClass(value)
						: 'text-(--accent-500)';

					const Icon = kpi.key === 'fteGap' ? getFteGapIcon(value) : kpi.icon;

					return (
						<div
							key={kpi.key}
							data-kpi={kpi.key}
							className={cn(
								'animate-kpi-enter relative overflow-hidden',
								'rounded-xl',
								'border border-(--workspace-border)',
								'shadow-(--shadow-card-elevated)',
								'bg-(--workspace-bg-card) p-4',
								'hover:shadow-(--shadow-card-hover) transition-shadow duration-(--duration-fast)',
								'border-l-[3px]',
								borderClass
							)}
							style={{ animationDelay: `${i * 60}ms` }}
						>
							<div className="flex items-center gap-3 pl-3">
								<span
									className={cn(
										'flex h-10 w-10 shrink-0 items-center justify-center',
										'rounded-lg',
										iconBgClass
									)}
								>
									<Icon className={cn('h-5 w-5', iconColorClass)} aria-hidden="true" />
								</span>

								<div className="flex min-w-0 flex-col">
									<span className="text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
										{kpi.label}
									</span>
									<Counter
										value={value}
										formatter={kpi.formatter}
										className={cn(
											'truncate text-3xl',
											'font-bold text-(--text-primary)',
											'font-[family-name:var(--font-display)]'
										)}
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
