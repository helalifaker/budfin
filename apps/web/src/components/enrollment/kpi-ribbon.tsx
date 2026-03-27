import { AlertTriangle, BarChart3, UserPlus, Users } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Counter } from '../shared/counter';
import { Sparkline } from '../shared/sparkline';

export type EnrollmentKpiRibbonProps = {
	totalAy1: number;
	totalAy2: number;
	totalDelta?: number;
	utilizationPct: number;
	alertCount: number;
	isStale: boolean;
	historicalTotals?: number[] | undefined;
	previousYearTotal?: number | undefined;
};

const kpiDefs = [
	{
		label: 'Total AY1',
		key: 'totalAy1',
		icon: Users,
		formatter: (v: number) => new Intl.NumberFormat('fr-FR').format(v),
	},
	{
		label: 'Total AY2',
		key: 'totalAy2',
		icon: UserPlus,
		formatter: (v: number) => new Intl.NumberFormat('fr-FR').format(v),
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
	totalDelta,
	utilizationPct,
	alertCount,
	isStale,
	historicalTotals,
	previousYearTotal,
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

					const isUtilization = kpi.key === 'utilizationPct';
					const showSparkline =
						historicalTotals &&
						historicalTotals.length >= 2 &&
						(kpi.key === 'totalAy1' || kpi.key === 'totalAy2');

					return (
						<div
							key={kpi.key}
							className={cn(
								'animate-kpi-enter relative overflow-hidden',
								'rounded-xl',
								'border border-(--workspace-border)',
								'shadow-(--shadow-card-elevated)',
								'hover:shadow-(--shadow-card-hover) transition-shadow duration-(--duration-fast)',
								'bg-(--workspace-bg-card) p-4',
								'border-l-[3px]',
								isUtilization && utilizationPct > 100 && 'border-l-(--color-error)',
								isUtilization &&
									utilizationPct > 95 &&
									utilizationPct <= 100 &&
									'border-l-(--color-warning)',
								isUtilization && utilizationPct <= 95 && 'border-l-(--kpi-accent-default)',
								hasAlerts && 'border-l-(--color-warning)',
								noAlerts && 'border-l-(--color-success)',
								!isUtilization && !isAlert && 'border-l-(--kpi-accent-default)'
							)}
							style={{ animationDelay: `${i * 60}ms` }}
						>
							{showSparkline && (
								<Sparkline
									data={historicalTotals}
									width={64}
									height={20}
									color="var(--accent-500)"
									className="absolute right-3 top-3 opacity-60"
								/>
							)}

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
										className="text-3xl font-bold text-(--text-primary) font-[family-name:var(--font-display)]"
									/>
									{kpi.key === 'totalAy2' && totalDelta !== undefined && totalDelta !== 0 && (
										<span
											className={cn(
												'text-(--text-xs) font-medium tabular-nums',
												totalDelta >= 0 ? 'text-(--color-success)' : 'text-(--color-error)'
											)}
										>
											{totalDelta >= 0 ? '+' : ''}
											{totalDelta} vs AY1
										</span>
									)}
									{kpi.key === 'totalAy2' &&
										previousYearTotal !== undefined &&
										previousYearTotal > 0 && (
											<span
												className={cn(
													'text-(--text-xs) font-medium tabular-nums',
													totalAy2 >= previousYearTotal
														? 'text-(--color-success)'
														: 'text-(--color-error)'
												)}
											>
												{totalAy2 >= previousYearTotal ? '+' : ''}
												{totalAy2 - previousYearTotal} vs last year
											</span>
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
					<span className="text-(--text-xs) font-medium text-(--color-stale)">Stale</span>
				</div>
			)}
		</>
	);
}
