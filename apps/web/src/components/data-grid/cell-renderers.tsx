import type { ReactNode } from 'react';
import { format as formatDate } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface BadgeCellProps {
	value: string;
	colorMap?: Record<string, string>;
	className?: string;
}

export function BadgeCell({ value, colorMap, className }: BadgeCellProps) {
	const colorClass = colorMap?.[value] ?? 'bg-(--workspace-bg-muted) text-(--text-secondary)';

	return (
		<span
			className={cn(
				'inline-flex rounded-sm px-2 py-0.5',
				'text-(--text-xs) font-medium',
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
		<span className="inline-flex items-center gap-1.5 text-(--text-xs) font-medium">
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
		<span className={cn('font-mono text-(--text-xs)', className)}>
			{typeof value === 'number' ? formatMoney(value) : value}
		</span>
	);
}

interface StatusBadgeCellProps {
	value: string;
	colorMap: Record<string, { text: string; bg: string; border?: string }>;
	shape?: 'pill' | 'rounded';
	className?: string;
}

export function StatusBadgeCell({
	value,
	colorMap,
	shape = 'pill',
	className,
}: StatusBadgeCellProps) {
	const colors = colorMap[value] ?? {
		text: 'text-(--text-secondary)',
		bg: 'bg-(--workspace-bg-muted)',
	};
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 px-2 py-0.5',
				'text-(--text-xs) font-medium',
				shape === 'pill' ? 'rounded-full' : 'rounded-sm',
				colors.text,
				colors.bg,
				colors.border,
				className
			)}
		>
			{value}
		</span>
	);
}

interface MonetaryCellProps {
	value: number | string | null;
	compact?: boolean;
	zeroDisplay?: 'dash' | 'empty' | 'zero';
	className?: string;
}

export function MonetaryCell({
	value,
	compact = false,
	zeroDisplay = 'dash',
	className,
}: MonetaryCellProps) {
	const numVal = typeof value === 'string' ? parseFloat(value) : value;
	const isZero = numVal === 0 || numVal === null;
	const isNegative = numVal !== null && numVal < 0;

	if (isZero) {
		if (zeroDisplay === 'empty') return null;
		if (zeroDisplay === 'dash') {
			return <span className={cn('font-mono tabular-nums text-(--text-muted)', className)}>—</span>;
		}
	}

	const formatted = numVal !== null ? formatMoney(numVal, { compact }) : '—';

	return (
		<span
			className={cn(
				'font-mono tabular-nums',
				isNegative ? 'text-(--color-error)' : 'text-(--text-primary)',
				className
			)}
		>
			{formatted}
		</span>
	);
}

interface PercentCellProps {
	value: number | string | null;
	precision?: number;
	className?: string;
}

export function PercentCell({ value, precision = 0, className }: PercentCellProps) {
	if (value === null || value === undefined) {
		return <span className={cn('font-mono tabular-nums text-(--text-muted)', className)}>—</span>;
	}

	const numVal = typeof value === 'string' ? parseFloat(value) : value;

	return (
		<span className={cn('font-mono tabular-nums text-(--text-secondary)', className)}>
			{numVal.toFixed(precision)}%
		</span>
	);
}

interface DateCellProps {
	value: string | null;
	variant?: 'date' | 'datetime' | 'relative';
	className?: string;
}

export function DateCell({ value, variant = 'datetime', className }: DateCellProps) {
	if (!value) {
		return <span className={cn('text-(--text-muted)', className)}>—</span>;
	}

	const date = new TZDate(value, 'Asia/Riyadh');
	let formatted: string;

	switch (variant) {
		case 'date':
			formatted = formatDate(date, 'MMM d, yyyy');
			break;
		case 'datetime':
			formatted = formatDate(date, 'MMM d, yyyy HH:mm');
			break;
		case 'relative':
			formatted = formatDate(date, 'MMM d, yyyy');
			break;
		default:
			formatted = formatDate(date, 'MMM d, yyyy HH:mm');
	}

	return <span className={cn('text-(--text-muted) text-(--text-xs)', className)}>{formatted}</span>;
}

interface ActionCellProps {
	ariaLabel?: string;
	children: ReactNode;
}

export function ActionCell({ ariaLabel = 'Row actions', children }: ActionCellProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={ariaLabel}
					className={cn(
						'inline-flex h-7 w-7 items-center justify-center rounded-md',
						'text-(--text-muted) transition-colors',
						'hover:bg-(--workspace-bg-muted) hover:text-(--text-primary)',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--grid-focus-ring)'
					)}
				>
					<MoreHorizontal className="h-4 w-4" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">{children}</DropdownMenuContent>
		</DropdownMenu>
	);
}
