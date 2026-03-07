import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

interface EditableCellProps {
	value: string | number;
	onChange: (value: string) => void;
	isReadOnly?: boolean;
	type?: 'text' | 'number';
	className?: string;
}

export function EditableCell({
	value,
	onChange,
	isReadOnly = false,
	type = 'text',
	className,
}: EditableCellProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(String(value));
	const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
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

	const handleBlur = useCallback(() => {
		setIsEditing(false);
		if (editValue !== String(value)) {
			onChange(editValue);
			setSaveState('saved');
			setTimeout(() => setSaveState('idle'), 1500);
		}
	}, [editValue, value, onChange]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				handleBlur();
			} else if (e.key === 'Escape') {
				setEditValue(String(value));
				setIsEditing(false);
			}
		},
		[handleBlur, value]
	);

	if (isReadOnly) {
		return (
			<span
				className={cn(
					'block px-2 py-1 text-[length:var(--text-xs)]',
					'bg-[var(--cell-readonly-bg)] rounded-[var(--radius-sm)]',
					'font-[family-name:var(--font-mono)]',
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
				'transition-all duration-[var(--duration-fast)]',
				'focus:border-[var(--cell-editable-focus)] focus:shadow-[var(--shadow-glow-accent)]',
				'focus:outline-none',
				saveState === 'saved' && 'bg-[var(--accent-50)]',
				saveState === 'error' && 'border-[var(--color-error)] animate-shake',
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
