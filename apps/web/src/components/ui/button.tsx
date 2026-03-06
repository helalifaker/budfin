import * as React from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'default' | 'outline' | 'destructive' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
};

const VARIANT: Record<ButtonVariant, string> = {
	default: 'bg-blue-600 text-white hover:bg-blue-700 border-transparent',
	outline: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
	destructive: 'bg-red-600 text-white hover:bg-red-700 border-transparent',
	ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 border-transparent',
};

const SIZE: Record<ButtonSize, string> = {
	sm: 'h-8 px-3 text-xs',
	md: 'h-9 px-4 text-sm',
	lg: 'h-10 px-5 text-sm',
};

export function Button({
	variant = 'default',
	size = 'md',
	loading = false,
	className,
	disabled,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			{...props}
			disabled={disabled || loading}
			className={cn(
				'inline-flex items-center justify-center gap-2 rounded-md border font-medium',
				'transition-colors focus-visible:outline-none focus-visible:ring-2',
				'focus-visible:ring-blue-500 focus-visible:ring-offset-2',
				'disabled:pointer-events-none disabled:opacity-50',
				VARIANT[variant],
				SIZE[size],
				className
			)}
		>
			{loading && (
				<svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					/>
				</svg>
			)}
			{children}
		</button>
	);
}
