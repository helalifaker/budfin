import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { subscribe } from './toast-state';

const TOAST_STYLES = {
	success: 'border-(--color-success) bg-(--color-success-bg) text-(--color-success)',
	error: 'border-(--color-error) bg-(--color-error-bg) text-(--color-error)',
	info: 'border-(--color-info) bg-(--color-info-bg) text-(--color-info)',
	warning: 'border-(--color-warning) bg-(--color-warning-bg) text-(--color-warning)',
} as const;

const TOAST_DOT = {
	success: 'bg-(--color-success)',
	error: 'bg-(--color-error)',
	info: 'bg-(--color-info)',
	warning: 'bg-(--color-warning)',
} as const;

const TOAST_PROGRESS = {
	success: 'bg-(--color-success)',
	error: 'bg-(--color-error)',
	info: 'bg-(--color-info)',
	warning: 'bg-(--color-warning)',
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
						'rounded-md border px-4 py-3',
						'shadow-(--shadow-md) text-(--text-sm)',
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
