import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { subscribe } from './toast-state';

const TOAST_STYLES = {
	success: 'border-green-200 bg-green-50 text-green-900',
	error: 'border-red-200 bg-red-50 text-red-900',
	info: 'border-blue-200 bg-blue-50 text-blue-900',
	warning: 'border-amber-200 bg-amber-50 text-amber-900',
} as const;

const TOAST_DOT = {
	success: 'bg-green-500',
	error: 'bg-red-500',
	info: 'bg-blue-500',
	warning: 'bg-amber-500',
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
						'flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-md text-sm',
						TOAST_STYLES[t.type]
					)}
				>
					<span
						className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', TOAST_DOT[t.type])}
						aria-hidden="true"
					/>
					<span>{t.message}</span>
				</div>
			))}
		</div>
	);
}
