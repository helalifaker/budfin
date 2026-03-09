import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Counter } from '../shared/counter';

interface KpiCardProps {
	title: string;
	value: number;
	formatter?: ((value: number) => string) | undefined;
	icon: LucideIcon;
	trend?: { value: number; label: string };
	className?: string;
}

export function KpiCard({ title, value, formatter, icon: Icon, trend, className }: KpiCardProps) {
	return (
		<div
			className={cn(
				'relative overflow-hidden',
				'rounded-xl border border-(--workspace-border)',
				'bg-(--workspace-bg-card) shadow-(--shadow-xs)',
				'p-5',
				'transition-shadow duration-(--duration-fast)',
				'hover:shadow-(--shadow-sm) hover:-translate-y-px',
				className
			)}
		>
			{/* Teal top accent */}
			<div className="absolute top-0 left-0 right-0 h-[3px] bg-(--accent-500)" aria-hidden="true" />

			<div className="flex items-start justify-between">
				<div>
					<p className="text-(--text-sm) font-medium text-(--text-secondary)">{title}</p>
					<p className="mt-2 text-(--text-2xl) font-bold text-(--text-primary)">
						<Counter value={value} formatter={formatter} />
					</p>
					{trend && (
						<p
							className={cn(
								'mt-1 text-(--text-xs)',
								trend.value >= 0 ? 'text-(--color-success)' : 'text-(--color-error)'
							)}
						>
							{trend.value >= 0 ? '+' : ''}
							{trend.value}% {trend.label}
						</p>
					)}
				</div>
				<div
					className={cn(
						'flex h-10 w-10 items-center justify-center',
						'rounded-lg bg-(--accent-50)'
					)}
				>
					<Icon className="h-5 w-5 text-(--accent-500)" aria-hidden="true" />
				</div>
			</div>
		</div>
	);
}
