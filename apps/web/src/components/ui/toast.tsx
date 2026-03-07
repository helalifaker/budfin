import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { subscribe } from './toast-state';

const TOAST_STYLES = {
	success: 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-green-900',
	error: 'border-[var(--color-error)] bg-[var(--color-error-bg)] text-red-900',
	info: 'border-[var(--color-info)] bg-[var(--color-info-bg)] text-blue-900',
	warning: 'border-[var(--color-warning)] bg-[var(--color-warning-bg)] text-amber-900',
} as const;

const TOAST_DOT = {
	success: 'bg-[var(--color-success)]',
	error: 'bg-[var(--color-error)]',
	info: 'bg-[var(--color-info)]',
	warning: 'bg-[var(--color-warning)]',
} as const;

const TOAST_PROGRESS = {
	success: 'bg-[var(--color-success)]',
	error: 'bg-[var(--color-error)]',
	info: 'bg-[var(--color-info)]',
	warning: 'bg-[var(--color-warning)]',
} as const;

export function Toaster() {
	const [toasts, setToasts] = useState<
		Array<{ id: string; message: string; type: keyof typeof TOAST_STYLES }>
	>([]);

	useEffect(() => subscribe(setToasts), []);

	if (toasts.length === 0) return null;

	return (
		<div
			className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80"
			aria-live="polite"
			aria-label="Notifications"
		>
			{toasts.map((t) => (
				<div
					key={t.id}
					role="status"
					className={cn(
						'relative flex items-start gap-2.5 overflow-hidden',
						'rounded-[var(--radius-md)] border px-4 py-3',
						'shadow-[var(--shadow-md)] text-[length:var(--text-sm)]',
						'animate-toast-enter',
						TOAST_STYLES[t.type]
					)}
				>
					<span
						className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', TOAST_DOT[t.type])}
						aria-hidden="true"
					/>
					<span>{t.message}</span>
					<div
						className={cn('absolute bottom-0 left-0 h-0.5', TOAST_PROGRESS[t.type])}
						style={{ animation: 'progress-shrink 4s linear forwards' }}
						aria-hidden="true"
					/>
				</div>
			))}
		</div>
	);
}
