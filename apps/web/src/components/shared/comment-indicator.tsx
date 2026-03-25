import { MessageSquare } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CommentIndicatorProps {
	count: number;
	className?: string;
	onClick?: () => void;
}

/**
 * Small badge showing the unresolved comment count for a target.
 * Renders nothing when count is 0. Use in data grid rows or table cells.
 */
export function CommentIndicator({ count, className, onClick }: CommentIndicatorProps) {
	if (count <= 0) return null;

	const label = `${count} unresolved comment${count === 1 ? '' : 's'}`;

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				'inline-flex items-center gap-1 rounded-full',
				'bg-(--accent-50) px-1.5 py-0.5',
				'text-[11px] font-medium text-(--accent-700)',
				'hover:bg-(--accent-100) transition-colors',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-500)',
				className
			)}
			title={label}
			aria-label={label}
		>
			<MessageSquare className="h-3 w-3" />
			{count}
		</button>
	);
}
