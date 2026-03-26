import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';

export type EditableCellProps = {
	value: number | string;
	onChange: (value: number) => void;
	onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
	type?: 'number' | 'percentage';
	variant?: 'subtle' | 'highlighted';
	isReadOnly?: boolean;
	isError?: boolean;
	errorMessage?: string;
	min?: number;
	className?: string;
};

function formatDisplay(value: number | string, type: 'number' | 'percentage'): string {
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (isNaN(num)) return String(value);
	if (num === 0) return '';
	if (type === 'percentage') return `${num}%`;
	return formatMoney(num);
}

function toEditValue(value: number | string): string {
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (isNaN(num)) return String(value);
	return String(num);
}

export function EditableCell({
	value,
	onChange,
	onNavigate,
	type = 'number',
	variant = 'highlighted',
	isReadOnly = false,
	isError = false,
	errorMessage,
	min,
	className,
}: EditableCellProps) {
	const isSubtle = variant === 'subtle';
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		};
	}, []);

	const startEditing = useCallback(() => {
		if (isReadOnly) return;
		setDraft(toEditValue(value));
		setEditing(true);
	}, [isReadOnly, value]);

	const cancelEditing = useCallback(() => {
		setEditing(false);
		setDraft('');
	}, []);

	const confirmEdit = useCallback(() => {
		setEditing(false);
		const parsed = parseFloat(draft);
		if (isNaN(parsed)) return;

		const finalValue = type === 'percentage' ? parsed / 100 : parsed;
		const currentNum = typeof value === 'string' ? parseFloat(value) : value;
		const currentComparable = type === 'percentage' ? currentNum / 100 : currentNum;

		if (finalValue !== currentComparable) {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			saveTimerRef.current = setTimeout(() => {
				onChange(finalValue);
			}, 300);
		}
	}, [draft, type, value, onChange]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				confirmEdit();
				onNavigate?.('down');
			} else if (e.key === 'Escape') {
				e.preventDefault();
				cancelEditing();
			} else if (e.key === 'Tab') {
				e.preventDefault();
				confirmEdit();
				onNavigate?.(e.shiftKey ? 'left' : 'right');
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				confirmEdit();
				onNavigate?.('up');
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				confirmEdit();
				onNavigate?.('down');
			}
		},
		[confirmEdit, cancelEditing, onNavigate]
	);

	useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	if (editing) {
		return (
			<input
				ref={inputRef}
				type="number"
				min={min}
				className={cn(
					'w-full rounded-md border border-[color-mix(in_srgb,var(--workspace-border),white_35%)]',
					'px-2.5 py-1.5 text-right text-(length:--text-sm) font-medium tabular-nums',
					'ring-2 ring-(--cell-editable-focus)',
					'focus:outline-none',
					isSubtle
						? 'bg-(--workspace-bg-card)'
						: 'bg-(--cell-editable-bg) shadow-(--shadow-cell-inset-focus)',
					className
				)}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={confirmEdit}
				onKeyDown={handleKeyDown}
				aria-label="Edit cell value"
			/>
		);
	}

	if (isReadOnly) {
		return (
			<span
				className={cn(
					'inline-block w-full rounded-md border border-transparent px-2.5 py-1.5',
					'text-right text-(length:--text-sm) font-medium tabular-nums',
					'transition-[background-color,border-color] duration-(--duration-fast)',
					isSubtle
						? 'bg-transparent text-(--text-secondary)'
						: 'bg-(--cell-readonly-bg) text-(--text-secondary)',
					isError && 'border border-(--cell-error-border)',
					className
				)}
				title={isError && errorMessage ? errorMessage : undefined}
			>
				{formatDisplay(value, type)}
			</span>
		);
	}

	return (
		<button
			type="button"
			className={cn(
				'inline-block w-full rounded-md border border-transparent px-2.5 py-1.5',
				'text-right text-(length:--text-sm) font-medium tabular-nums',
				'transition-[background-color,border-color,box-shadow] duration-(--duration-fast)',
				'cursor-pointer',
				isSubtle
					? 'bg-transparent hover:bg-(--accent-50)/40'
					: 'bg-(--cell-editable-bg) shadow-(--shadow-cell-inset) hover:border-(--accent-200) hover:bg-[color-mix(in_srgb,var(--cell-editable-bg),white_20%)]',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-400)',
				isError && 'border border-(--cell-error-border)',
				className
			)}
			title={isError && errorMessage ? errorMessage : undefined}
			onClick={startEditing}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					startEditing();
				}
			}}
		>
			{formatDisplay(value, type)}
		</button>
	);
}
