import * as React from 'react';
import { cn } from '../../lib/cn';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => (
		<textarea
			ref={ref}
			className={cn(
				'flex min-h-[80px] w-full rounded-(--radius-md)',
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
Textarea.displayName = 'Textarea';
