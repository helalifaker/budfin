import { cn } from '../../lib/cn';

interface BadgeCellProps {
	value: string;
	colorMap?: Record<string, string>;
	className?: string;
}

export function BadgeCell({ value, colorMap, className }: BadgeCellProps) {
	const colorClass =
		colorMap?.[value] ?? 'bg-[var(--workspace-bg-muted)] text-[var(--text-secondary)]';

	return (
		<span
			className={cn(
				'inline-flex rounded-[var(--radius-sm)] px-2 py-0.5',
				'text-[length:var(--text-xs)] font-medium',
				colorClass,
				className
			)}
		>
			{value}
		</span>
	);
}

interface DotLabelCellProps {
	label: string;
	dotColor: string;
}

export function DotLabelCell({ label, dotColor }: DotLabelCellProps) {
	return (
		<span className="inline-flex items-center gap-1.5 text-[length:var(--text-xs)] font-medium">
			<span className={cn('h-2 w-2 rounded-full', dotColor)} aria-hidden="true" />
			{label}
		</span>
	);
}

interface NumericCellProps {
	value: number | string;
	className?: string;
}

export function NumericCell({ value, className }: NumericCellProps) {
	return (
		<span
			className={cn('font-[family-name:var(--font-mono)] text-[length:var(--text-xs)]', className)}
		>
			{typeof value === 'number' ? value.toLocaleString() : value}
		</span>
	);
}
