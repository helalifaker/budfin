import { cn } from '../../lib/cn';

interface StatusBadgeProps {
	isActive: boolean;
	className?: string;
}

export function StatusBadge({ isActive, className }: StatusBadgeProps) {
	return (
		<span
			className={cn('inline-flex items-center gap-1.5 text-(--text-xs) font-medium', className)}
		>
			<span
				className={cn(
					'h-2 w-2 rounded-sm',
					isActive ? 'bg-(--color-success)' : 'bg-(--text-muted)'
				)}
			/>
			{isActive ? 'Active' : 'Inactive'}
		</span>
	);
}
