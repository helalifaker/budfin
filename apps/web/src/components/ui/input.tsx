import * as React from 'react';
import { cn } from '../../lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, ...props }, ref) => (
		<input
			ref={ref}
			className={cn(
				'flex h-9 w-full rounded-md border border-slate-300 bg-white',
				'px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
				'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
				'disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...props}
		/>
	)
);
Input.displayName = 'Input';
