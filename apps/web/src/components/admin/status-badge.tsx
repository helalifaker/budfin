import { cn } from '../../lib/cn';

interface StatusBadgeProps {
	isActive: boolean;
	className?: string;
}

export function StatusBadge({ isActive, className }: StatusBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 text-[length:var(--text-xs)] font-medium',
				className
			)}
		>
			<span
				className={cn(
					'h-2 w-2 rounded-[var(--radius-sm)]',
					isActive ? 'bg-[var(--color-success)]' : 'bg-[var(--text-muted)]'
				)}
			/>
			{isActive ? 'Active' : 'Inactive'}
		</span>
	);
}
