import * as React from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant =
	| 'primary'
	| 'secondary'
	| 'ghost'
	| 'destructive'
	| 'default'
	| 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
};

const VARIANT_STYLES: Record<string, string> = {
	primary: [
		'bg-(--accent-500) text-(--text-on-dark) border-transparent',
		'hover:bg-(--accent-600) hover:shadow-md hover:-translate-y-px',
		'active:bg-(--accent-700) active:scale-[0.98] active:translate-y-0',
	].join(' '),
	secondary: [
		'bg-(--workspace-bg-card) text-(--accent-600) border-(--accent-300)',
		'hover:bg-(--accent-50)',
		'active:bg-(--accent-100)',
	].join(' '),
	ghost: [
		'bg-transparent text-(--text-secondary) border-transparent',
		'hover:bg-(--accent-50)',
		'active:bg-(--accent-100)',
	].join(' '),
	destructive: [
		'bg-(--color-error) text-(--text-on-dark) border-transparent',
		'hover:bg-[color-mix(in_srgb,var(--color-error),black_15%)]',
		'active:bg-[color-mix(in_srgb,var(--color-error),black_25%)] active:scale-[0.98]',
	].join(' '),
};
VARIANT_STYLES.default = VARIANT_STYLES.primary!;
VARIANT_STYLES.outline = VARIANT_STYLES.secondary!;

const SIZE: Record<ButtonSize, string> = {
	sm: 'h-8 px-3 text-xs gap-1.5',
	md: 'h-9 px-4 text-sm gap-2',
	lg: 'h-10 px-5 text-sm gap-2',
	icon: 'h-8 w-8 p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ variant = 'primary', size = 'md', loading = false, className, disabled, children, ...props },
	ref
) {
	return (
		<button
			ref={ref}
			{...props}
			disabled={disabled || loading}
			className={cn(
				'inline-flex items-center justify-center font-medium',
				'rounded-md border',
				'transition-all duration-(--duration-fast)',
				'focus-visible:outline-none focus-visible:ring-2',
				'focus-visible:ring-(--accent-500) focus-visible:ring-offset-2',
				'disabled:pointer-events-none disabled:opacity-50',
				VARIANT_STYLES[variant],
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
});
