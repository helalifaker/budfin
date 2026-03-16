import { cn } from '../../lib/cn';

export interface ReadinessIndicatorProps {
	ready: number;
	total: number;
	size?: 'sm' | 'md';
}

export function ReadinessIndicator({ ready, total, size = 'md' }: ReadinessIndicatorProps) {
	const isComplete = ready === total;

	return (
		<span className="inline-flex items-center gap-1.5">
			<span
				className={cn(
					'inline-block rounded-full',
					isComplete ? 'bg-(--color-success)' : 'bg-(--color-warning)',
					size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
				)}
				aria-hidden="true"
			/>
			<span
				className={cn(
					'font-medium tabular-nums',
					size === 'sm' ? 'text-(--text-xs)' : 'text-(--text-sm)',
					isComplete ? 'text-(--color-success)' : 'text-(--text-secondary)'
				)}
			>
				{ready}/{total}
			</span>
		</span>
	);
}
