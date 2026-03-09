import { AlertTriangle, BarChart3, UserPlus, Users } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Counter } from '../shared/counter';

export type EnrollmentKpiRibbonProps = {
	totalAy1: number;
	totalAy2: number;
	utilizationPct: number;
	alertCount: number;
	isStale: boolean;
};

const kpiDefs = [
	{
		label: 'Total AY1',
		key: 'totalAy1',
		icon: Users,
		formatter: (v: number) => v.toLocaleString(),
	},
	{
		label: 'Total AY2',
		key: 'totalAy2',
		icon: UserPlus,
		formatter: (v: number) => v.toLocaleString(),
	},
	{
		label: 'Utilization',
		key: 'utilizationPct',
		icon: BarChart3,
		formatter: (v: number) => `${v.toFixed(0)}%`,
	},
	{
		label: 'Alerts',
		key: 'alertCount',
		icon: AlertTriangle,
		formatter: (v: number) => String(v),
	},
] as const;

export function EnrollmentKpiRibbon({
	totalAy1,
	totalAy2,
	utilizationPct,
	alertCount,
	isStale,
}: EnrollmentKpiRibbonProps) {
	const values = { totalAy1, totalAy2, utilizationPct, alertCount };

	return (
		<>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{kpiDefs.map((kpi, i) => {
					const Icon = kpi.icon;
					const value = values[kpi.key];
					const isAlert = kpi.key === 'alertCount';
					const hasAlerts = isAlert && alertCount > 0;
					const noAlerts = isAlert && alertCount === 0;

					return (
						<div
							key={kpi.key}
							className={cn(
								'animate-kpi-enter relative overflow-hidden',
								'rounded-xl',
								'border border-(--workspace-border)',
								'shadow-(--shadow-card)',
								'bg-(--workspace-bg-card) p-3'
							)}
							style={{ animationDelay: `${i * 60}ms` }}
						>
							<span
								className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-(--accent-500)"
								aria-hidden="true"
							/>

							<div className="flex items-center gap-3 pl-3">
								<span
									className={cn(
										'flex h-10 w-10 shrink-0 items-center justify-center',
										'rounded-lg',
										hasAlerts && 'bg-(--color-warning-bg)',
										noAlerts && 'bg-(--color-success-bg)',
										!isAlert && 'bg-(--accent-50)'
									)}
								>
									<Icon
										className={cn(
											'h-5 w-5',
											hasAlerts && 'text-(--color-warning)',
											noAlerts && 'text-(--color-success)',
											!isAlert && 'text-(--accent-500)'
										)}
										aria-hidden="true"
									/>
								</span>

								<div className="flex flex-col">
									<span className="text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
										{kpi.label}
									</span>
									<Counter
										value={value}
										formatter={kpi.formatter}
										className="text-(--text-2xl) font-bold text-(--text-primary) font-[family-name:var(--font-display)]"
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
					<span className="text-(--text-xs) font-medium text-(--color-stale)">Stale</span>
				</div>
			)}
		</>
	);
}
