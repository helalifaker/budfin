import Decimal from 'decimal.js';
import { Building2, DollarSign, Landmark, Percent, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Counter } from '../shared/counter';
import { formatMoney } from '../../lib/format-money';

export type OpExKpiRibbonProps = {
	totalOperating: number;
	totalDepreciation: number;
	financeNet: number;
	totalRevenue: string;
	totalNonOperating: number;
	isStale: boolean;
};

type KpiDef = {
	label: string;
	key: keyof Omit<OpExKpiRibbonProps, 'isStale'> | 'opexPercentOfRevenue';
	icon: typeof DollarSign;
	formatter: (v: number) => string;
	getBorderClass?: (value: number) => string;
	getIconBgClass?: (value: number) => string;
	getIconColorClass?: (value: number) => string;
};

function financeNetBorderClass(value: number): string {
	if (value < 0) return 'border-l-(--color-error)';
	if (value > 0) return 'border-l-(--color-success)';
	return 'border-l-(--kpi-accent-default)';
}

function financeNetIconBgClass(value: number): string {
	if (value < 0) return 'bg-(--color-error-bg)';
	if (value > 0) return 'bg-(--color-success-bg)';
	return 'bg-(--accent-50)';
}

function financeNetIconColorClass(value: number): string {
	if (value < 0) return 'text-(--color-error)';
	if (value > 0) return 'text-(--color-success)';
	return 'text-(--accent-500)';
}

const kpiDefs: KpiDef[] = [
	{
		label: 'Total OpEx',
		key: 'totalOperating',
		icon: Building2,
		formatter: (v: number) => formatMoney(v, { millions: true, showCurrency: true }),
	},
	{
		label: 'Depreciation',
		key: 'totalDepreciation',
		icon: TrendingDown,
		formatter: (v: number) => formatMoney(v, { millions: true, showCurrency: true }),
	},
	{
		label: 'Finance Net',
		key: 'financeNet',
		icon: DollarSign,
		formatter: (v: number) => formatMoney(v, { millions: true, showCurrency: true }),
		getBorderClass: financeNetBorderClass,
		getIconBgClass: financeNetIconBgClass,
		getIconColorClass: financeNetIconColorClass,
	},
	{
		label: 'OpEx % of Revenue',
		key: 'opexPercentOfRevenue',
		icon: Percent,
		formatter: (v: number) => `${v.toFixed(1)}%`,
	},
	{
		label: 'Total Non-Operating',
		key: 'totalNonOperating',
		icon: Landmark,
		formatter: (v: number) => formatMoney(v, { millions: true, showCurrency: true }),
	},
];

export function OpExKpiRibbon({
	totalOperating,
	totalDepreciation,
	financeNet,
	totalRevenue,
	totalNonOperating,
	isStale,
}: OpExKpiRibbonProps) {
	const revDec = new Decimal(totalRevenue || '0');
	const opexPercentOfRevenue = revDec.gt(0)
		? new Decimal(totalOperating).div(revDec).times(100).toNumber()
		: 0;

	const values: Record<string, number> = {
		totalOperating,
		totalDepreciation,
		financeNet,
		opexPercentOfRevenue,
		totalNonOperating,
	};

	return (
		<>
			<div
				className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5"
				role="region"
				aria-label="Operating expenses key performance indicators"
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

					const Icon = kpi.icon;

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
								'hover:shadow-(--shadow-card-hover)',
								'transition-shadow duration-(--duration-fast)',
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
						Stale -- recalculate to refresh
					</span>
				</div>
			)}
		</>
	);
}
