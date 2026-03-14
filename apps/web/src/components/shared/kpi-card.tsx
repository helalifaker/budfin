import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface KpiCardProps {
	label: string;
	value: string | number;
	subtitle?: string;
	icon: LucideIcon;
	accentVariant: string;
	animationDelay?: number;
}

export function KpiCard({
	label,
	value,
	subtitle,
	icon: Icon,
	accentVariant,
	animationDelay,
}: KpiCardProps) {
	return (
		<div
			className={cn(
				'animate-kpi-enter relative overflow-hidden',
				'rounded-xl',
				'border border-(--workspace-border)',
				'shadow-(--shadow-card-elevated)',
				'hover:shadow-(--shadow-card-hover) transition-shadow duration-(--duration-fast)',
				'bg-(--workspace-bg-card) p-4',
				'border-l-[3px]',
				accentVariant
			)}
			style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
		>
			<div className="flex items-center gap-3 pl-3">
				<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent-50)">
					<Icon className="h-5 w-5 text-(--accent-500)" aria-hidden="true" />
				</span>

				<div className="flex flex-col">
					<span className="text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
						{label}
					</span>
					<span className="text-3xl font-bold text-(--text-primary) font-[family-name:var(--font-display)]">
						{value}
					</span>
					{subtitle && (
						<span className="text-(--text-xs) font-medium text-(--text-secondary)">{subtitle}</span>
					)}
				</div>
			</div>
		</div>
	);
}
