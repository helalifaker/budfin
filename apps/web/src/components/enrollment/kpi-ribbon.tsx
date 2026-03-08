import { cn } from '../../lib/cn';

export type EnrollmentKpiRibbonProps = {
	totalAy1: number;
	totalAy2: number;
	utilizationPct: number;
	alertCount: number;
	isStale: boolean;
};

function KpiCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{label}</span>
			<span className="text-[length:var(--text-lg)] font-semibold tabular-nums text-[var(--text-primary)]">
				{value}
			</span>
		</div>
	);
}

export function EnrollmentKpiRibbon({
	totalAy1,
	totalAy2,
	utilizationPct,
	alertCount,
	isStale,
}: EnrollmentKpiRibbonProps) {
	return (
		<div className="flex items-center gap-8">
			<KpiCard label="Total AY1" value={totalAy1.toLocaleString()} />
			<KpiCard label="Total AY2" value={totalAy2.toLocaleString()} />
			<KpiCard label="Utilization" value={`${utilizationPct.toFixed(0)}%`} />

			<div className="flex flex-col gap-0.5">
				<span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">Alerts</span>
				<span
					className={cn(
						'text-[length:var(--text-lg)] font-semibold tabular-nums',
						alertCount > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--text-primary)]'
					)}
				>
					{alertCount}
				</span>
			</div>

			{isStale && (
				<div
					className="ml-auto flex items-center gap-1.5"
					role="status"
					aria-label="Data is stale, recalculation needed"
				>
					<span className="size-2 rounded-full bg-[var(--color-stale)]" aria-hidden="true" />
					<span className="text-[length:var(--text-xs)] font-medium text-[var(--color-stale)]">
						Stale
					</span>
				</div>
			)}
		</div>
	);
}
