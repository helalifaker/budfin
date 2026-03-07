import * as React from 'react';
import { cn } from '../../lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, ...props }, ref) => (
		<input
			ref={ref}
			className={cn(
				'flex h-9 w-full rounded-[var(--radius-md)]',
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
Input.displayName = 'Input';
