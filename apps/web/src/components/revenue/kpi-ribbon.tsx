import { cn } from '../../lib/cn';

export type RevenueKpiRibbonProps = {
	grossHt: number;
	totalDiscounts: number;
	netRevenue: number;
	avgPerStudent: number;
	isStale: boolean;
};

const compactSar = new Intl.NumberFormat('en-SA', {
	notation: 'compact',
	maximumFractionDigits: 1,
});

function formatSar(value: number): string {
	return `SAR ${compactSar.format(value)}`;
}

type KpiCardProps = {
	label: string;
	value: string;
	variant?: 'default' | 'negative' | 'accent';
};

function KpiCard({ label, value, variant = 'default' }: KpiCardProps) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-[length:var(--text-xs)] text-[var(--text-muted)]">{label}</span>
			<span
				className={cn(
					'text-[length:var(--text-lg)] font-semibold tabular-nums',
					variant === 'default' && 'text-[var(--text-primary)]',
					variant === 'negative' && 'text-[var(--color-error)]',
					variant === 'accent' && 'text-[var(--color-success)]'
				)}
			>
				{value}
			</span>
		</div>
	);
}

export function RevenueKpiRibbon({
	grossHt,
	totalDiscounts,
	netRevenue,
	avgPerStudent,
	isStale,
}: RevenueKpiRibbonProps) {
	return (
		<div className="flex items-center gap-6" role="list" aria-label="Revenue KPIs">
			<div role="listitem">
				<KpiCard label="Gross HT" value={formatSar(grossHt)} />
			</div>
			<div className="h-8 w-px bg-[var(--workspace-border)]" role="separator" aria-hidden="true" />
			<div role="listitem">
				<KpiCard label="Discounts" value={formatSar(totalDiscounts)} variant="negative" />
			</div>
			<div className="h-8 w-px bg-[var(--workspace-border)]" role="separator" aria-hidden="true" />
			<div role="listitem">
				<KpiCard label="Net Revenue" value={formatSar(netRevenue)} variant="accent" />
			</div>
			<div className="h-8 w-px bg-[var(--workspace-border)]" role="separator" aria-hidden="true" />
			<div role="listitem">
				<KpiCard label="Avg/Student" value={formatSar(avgPerStudent)} />
			</div>
			{isStale && (
				<>
					<div
						className="h-8 w-px bg-[var(--workspace-border)]"
						role="separator"
						aria-hidden="true"
					/>
					<div className="flex items-center gap-1.5" role="listitem">
						<span className="size-2.5 rounded-full bg-[var(--color-stale)]" aria-hidden="true" />
						<span className="text-[length:var(--text-xs)] font-medium text-[var(--color-stale)]">
							Stale
						</span>
					</div>
				</>
			)}
		</div>
	);
}
