import { TrendingUp } from 'lucide-react';
import { cn } from '../../lib/cn';

interface TrendEmptyStateProps {
	yearCount: number;
}

export function TrendEmptyState({ yearCount }: TrendEmptyStateProps) {
	const message =
		yearCount === 0
			? 'No locked or archived budget versions found. Lock or archive a budget version to see historical trends.'
			: 'Historical comparison will be available after the next fiscal year is locked or archived.';

	return (
		<div
			className={cn(
				'flex flex-col items-center justify-center gap-4 py-16',
				'rounded-xl border border-(--workspace-border)',
				'bg-(--workspace-bg-card) shadow-(--shadow-xs)'
			)}
		>
			<div
				className={cn(
					'flex h-14 w-14 items-center justify-center rounded-full',
					'bg-(--accent-100) text-(--accent-600)'
				)}
			>
				<TrendingUp className="h-7 w-7" aria-hidden="true" />
			</div>
			<div className="max-w-md text-center space-y-2">
				<h3 className="text-(--text-base) font-semibold text-(--text-primary)">
					{yearCount === 0 ? 'No Historical Data' : 'Building History'}
				</h3>
				<p className="text-(--text-sm) text-(--text-muted)">{message}</p>
			</div>
		</div>
	);
}
