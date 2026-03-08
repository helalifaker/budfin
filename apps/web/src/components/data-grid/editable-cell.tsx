import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

interface EditableCellProps {
	value: string | number;
	onChange: (value: string) => void;
	onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
	isReadOnly?: boolean;
	type?: 'text' | 'number';
	className?: string;
}

export function EditableCell({
	value,
	onChange,
	onNavigate,
	isReadOnly = false,
	type = 'text',
	className,
}: EditableCellProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(String(value));
	const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
	const [showFlash, setShowFlash] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEditValue(String(value));
	}, [value]);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const commitEdit = useCallback(() => {
		setIsEditing(false);
		if (editValue !== String(value)) {
			onChange(editValue);
			setSaveState('saved');
			setShowFlash(true);
			setTimeout(() => setSaveState('idle'), 1500);
			setTimeout(() => setShowFlash(false), 800);
		}
	}, [editValue, value, onChange]);

	const handleBlur = useCallback(() => {
		commitEdit();
	}, [commitEdit]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				commitEdit();
				onNavigate?.('down');
			} else if (e.key === 'Escape') {
				setEditValue(String(value));
				setIsEditing(false);
			} else if (e.key === 'Tab') {
				e.preventDefault();
				commitEdit();
				onNavigate?.(e.shiftKey ? 'left' : 'right');
			} else if (e.key === 'ArrowUp') {
				commitEdit();
				onNavigate?.('up');
			} else if (e.key === 'ArrowDown') {
				commitEdit();
				onNavigate?.('down');
			}
		},
		[commitEdit, value, onNavigate]
	);

	const isNumber = type === 'number';

	if (isReadOnly) {
		return (
			<span
				className={cn(
					'block px-2 py-1 text-[length:var(--text-xs)]',
					'bg-[var(--cell-readonly-bg)] rounded-[var(--radius-sm)]',
					'font-[family-name:var(--font-mono)]',
					isNumber && 'text-right tabular-nums',
					className
				)}
			>
				{value}
			</span>
		);
	}

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type={type}
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				className={cn(
					'w-full px-2 py-1 text-[length:var(--text-xs)]',
					'rounded-[var(--radius-sm)]',
					'border border-[var(--cell-editable-focus)]',
					'shadow-[var(--shadow-glow-accent)]',
					'bg-white scale-[1.02] origin-center',
					'font-[family-name:var(--font-mono)]',
					'outline-none',
					'transition-all duration-[var(--duration-fast)]',
					isNumber && 'text-right tabular-nums',
					className
				)}
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setIsEditing(true)}
			className={cn(
				'block w-full text-left px-2 py-1 text-[length:var(--text-xs)]',
				'rounded-[var(--radius-sm)] cursor-text',
				'bg-[var(--cell-editable-bg)]',
				'font-[family-name:var(--font-mono)]',
				'hover:border-[var(--accent-200)] hover:shadow-[var(--shadow-xs)]',
				'border border-transparent',
				'border-b border-dashed border-b-[var(--accent-200)]',
				'transition-all duration-[var(--duration-fast)]',
				'focus:border-[var(--cell-editable-focus)] focus:shadow-[var(--shadow-glow-accent)]',
				'focus:outline-none',
				isNumber && 'text-right tabular-nums',
				saveState === 'saved' && 'bg-[var(--accent-50)]',
				saveState === 'error' && 'border-[var(--color-error)] animate-shake',
				showFlash && 'animate-cell-save',
				className
			)}
		>
			{value}
			{saveState === 'saved' && (
				<svg
					className="inline-block ml-1 h-3 w-3 text-[var(--color-success)]"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path
						d="M5 12l5 5L20 7"
						style={{
							strokeDasharray: 24,
							animation: 'checkmark-draw 300ms ease-out forwards',
						}}
					/>
				</svg>
			)}
			{saveState === 'error' && (
				<svg
					className="inline-block ml-1 h-3 w-3 text-[var(--color-error)]"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			)}
		</button>
	);
}
