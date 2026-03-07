import * as React from 'react';
import { cn } from '../../lib/cn';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => (
		<textarea
			ref={ref}
			className={cn(
				'flex min-h-[80px] w-full rounded-[var(--radius-md)]',
				'border border-[var(--workspace-border)] bg-white',
				'px-3 py-2 text-[length:var(--text-sm)] text-[var(--text-primary)]',
				'shadow-[var(--shadow-xs)]',
				'placeholder:text-[var(--text-muted)]',
				'focus:outline-none focus:border-[var(--accent-500)]',
				'focus:shadow-[var(--shadow-glow-accent)]',
				'transition-all duration-[var(--duration-fast)]',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	)
);
Textarea.displayName = 'Textarea';
