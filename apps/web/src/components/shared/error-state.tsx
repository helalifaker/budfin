import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';

interface ErrorStateProps {
	title?: string;
	message?: string;
	onRetry?: () => void;
	className?: string;
}

export function ErrorState({
	title = 'Something went wrong',
	message = 'An unexpected error occurred. Please try again.',
	onRetry,
	className,
}: ErrorStateProps) {
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
					'rounded-[var(--radius-lg)] bg-[var(--color-error-bg)]'
				)}
			>
				<AlertTriangle className="h-6 w-6 text-[var(--color-error)]" aria-hidden="true" />
			</div>
			<h3 className="mt-4 text-[length:var(--text-base)] font-semibold text-[var(--text-primary)]">
				{title}
			</h3>
			<p className="mt-1.5 max-w-sm text-[length:var(--text-sm)] text-[var(--text-secondary)]">
				{message}
			</p>
			{onRetry && (
				<Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
					Try again
				</Button>
			)}
		</div>
	);
}
