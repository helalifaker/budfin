import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface SaveIndicatorProps {
	status: 'idle' | 'saving' | 'saved' | 'unsaved';
	className?: string;
}

export function SaveIndicator({ status, className }: SaveIndicatorProps) {
	if (status === 'idle') return null;

	return (
		<div
			className={cn(
				'flex items-center gap-1.5 text-(length:--text-xs) font-medium',
				status === 'saving' && 'text-(--text-muted) animate-pulse-save',
				status === 'saved' && 'text-(--color-success)',
				status === 'unsaved' && 'text-(--color-warning)',
				className
			)}
			aria-live="polite"
		>
			{status === 'saving' && <span>Saving...</span>}
			{status === 'saved' && (
				<>
					<Check className="h-3 w-3" aria-hidden="true" />
					<span>Saved</span>
				</>
			)}
			{status === 'unsaved' && (
				<span className="flex items-center gap-1">
					<span className="h-1.5 w-1.5 rounded-full bg-(--color-warning)" aria-hidden="true" />
					Unsaved
				</span>
			)}
		</div>
	);
}
