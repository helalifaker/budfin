import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';

interface StaleIndicatorProps {
	staleModules?: string[];
	className?: string;
}

export function StaleIndicator({ staleModules, className }: StaleIndicatorProps) {
	if (!staleModules || staleModules.length === 0) return null;

	return (
		<div
			className={cn(
				'flex items-center gap-1.5',
				'rounded-(--radius-sm) bg-(--color-warning-bg) px-2 py-1',
				'text-[11px] font-medium text-(--color-warning)',
				className
			)}
			title={`Stale modules: ${staleModules.join(', ')}`}
			aria-label={`${staleModules.length} stale modules: ${staleModules.join(', ')}`}
		>
			<AlertTriangle className="h-3 w-3" aria-hidden="true" />
			<span>{staleModules.length} stale</span>
		</div>
	);
}
