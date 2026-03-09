import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
	className?: string;
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	actionLabel,
	onAction,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				'flex flex-col items-center justify-center py-16 text-center',
				'animate-fade-in',
				className
			)}
		>
			<div
				className={cn(
					'flex h-12 w-12 items-center justify-center',
					'rounded-lg bg-(--accent-50)',
					'animate-slide-up'
				)}
			>
				<Icon className="h-6 w-6 text-(--accent-500)" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3
				className={cn(
					'mt-4 text-(--text-base) font-semibold text-(--text-primary)',
					'animate-slide-up'
				)}
				style={{ animationDelay: '100ms' }}
			>
				{title}
			</h3>
			{description && (
				<p
					className={cn(
						'mt-1.5 max-w-sm text-(--text-sm) text-(--text-secondary)',
						'animate-slide-up'
					)}
					style={{ animationDelay: '150ms' }}
				>
					{description}
				</p>
			)}
			{actionLabel && onAction && (
				<div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
					<Button variant="primary" size="sm" onClick={onAction} className="mt-4">
						{actionLabel}
					</Button>
				</div>
			)}
		</div>
	);
}
