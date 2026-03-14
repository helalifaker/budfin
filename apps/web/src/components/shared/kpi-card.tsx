import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export type KpiCardProps = {
	label: string;
	icon: LucideIcon;
	children: React.ReactNode;
	subtitle?: React.ReactNode;
	index?: number;
	isStale?: boolean;
	accentColor?: string;
	sparkline?: React.ReactNode;
};

export function KpiCard({
	label,
	icon: Icon,
	children,
	subtitle,
	index = 0,
	isStale = false,
	accentColor = 'var(--accent-500)',
	sparkline,
}: KpiCardProps) {
	return (
		<div
			role="listitem"
			className={cn(
				'animate-kpi-enter relative overflow-hidden',
				'rounded-xl',
				'border border-(--workspace-border) border-l-[3px]',
				'shadow-(--shadow-card-elevated)',
				'hover:shadow-(--shadow-card-hover) transition-shadow duration-(--duration-fast)',
				'bg-(--workspace-bg-card) p-4',
				isStale && 'opacity-60'
			)}
			style={{
				animationDelay: `${index * 60}ms`,
				borderLeftColor: accentColor,
			}}
		>
			{isStale && (
				<span
					className="absolute right-3 top-3 size-2.5 animate-pulse rounded-full bg-(--color-stale)"
					aria-hidden="true"
				/>
			)}

			{sparkline && <div className="absolute right-3 top-3 opacity-60">{sparkline}</div>}

			<div className="flex items-center gap-3 pl-3">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent-50)">
					<Icon className="h-5 w-5 text-(--accent-500)" aria-hidden="true" />
				</span>

				<div className="flex min-w-0 flex-col">
					<span className="text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
						{label}
					</span>
					<div className="text-3xl font-bold text-(--text-primary) font-[family-name:var(--font-display)]">
						{children}
					</div>
					{subtitle && <span className="text-(--text-xs) text-(--text-secondary)">{subtitle}</span>}
				</div>
			</div>
		</div>
	);
}
