import * as React from 'react';
import { cn } from '../../lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, ...props }, ref) => (
		<input
			ref={ref}
			className={cn(
				'flex h-9 w-full rounded-md',
				'border border-(--workspace-border) bg-white',
				'px-3 py-2 text-(--text-sm) text-(--text-primary)',
				'shadow-(--shadow-xs)',
				'placeholder:text-(--text-muted)',
				'focus:outline-none focus:border-(--accent-500)',
				'focus:shadow-(--shadow-glow-accent)',
				'transition-all duration-(--duration-fast)',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	)
);
Input.displayName = 'Input';
