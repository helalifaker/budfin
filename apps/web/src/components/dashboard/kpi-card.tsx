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
				'rounded-[var(--radius-xl)] border border-[var(--workspace-border)]',
				'bg-[var(--workspace-bg-card)] shadow-[var(--shadow-xs)]',
				'p-5',
				'transition-shadow duration-[var(--duration-fast)]',
				'hover:shadow-[var(--shadow-sm)] hover:-translate-y-px',
				className
			)}
		>
			{/* Teal top accent */}
			<div
				className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--accent-500)]"
				aria-hidden="true"
			/>

			<div className="flex items-start justify-between">
				<div>
					<p className="text-[length:var(--text-sm)] font-medium text-[var(--text-secondary)]">
						{title}
					</p>
					<p className="mt-2 text-[length:var(--text-2xl)] font-bold text-[var(--text-primary)]">
						<Counter value={value} formatter={formatter} />
					</p>
					{trend && (
						<p
							className={cn(
								'mt-1 text-[length:var(--text-xs)]',
								trend.value >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
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
						'rounded-[var(--radius-lg)] bg-[var(--accent-50)]'
					)}
				>
					<Icon className="h-5 w-5 text-[var(--accent-500)]" aria-hidden="true" />
				</div>
			</div>
		</div>
	);
}
