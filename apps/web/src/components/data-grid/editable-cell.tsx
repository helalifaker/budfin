import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface EditableCellProps {
	value: string | number;
	onChange: (value: string) => void;
	onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
	isReadOnly?: boolean;
	type?: 'text' | 'number';
	className?: string;
	ariaLabel?: string;
}

/** Entry mode for edit state: 'full' preserves existing value, 'overwrite' replaces it. */
type EditEntryMode = 'full' | 'overwrite';

export function EditableCell({
	value,
	onChange,
	onNavigate,
	isReadOnly = false,
	type = 'text',
	className,
	ariaLabel,
}: EditableCellProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(String(value));
	const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
	const [showFlash, setShowFlash] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const entryModeRef = useRef<EditEntryMode>('full');
	const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	const flashTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		return () => {
			clearTimeout(saveTimerRef.current);
			clearTimeout(flashTimerRef.current);
		};
	}, []);

	useEffect(() => {
		setEditValue(String(value));
	}, [value]);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			if (entryModeRef.current === 'full') {
				inputRef.current.select();
			} else {
				// For overwrite mode, place cursor at end (after the typed character).
				// setSelectionRange is not supported on type="number" inputs, so we
				// guard with a try-catch.
				try {
					const len = inputRef.current.value.length;
					inputRef.current.setSelectionRange(len, len);
				} catch {
					// type="number" inputs throw InvalidStateError — cursor positioning
					// is not supported, but the value is already correct.
				}
			}
		}
	}, [isEditing]);

	const commitEdit = useCallback(() => {
		setIsEditing(false);
		if (editValue !== String(value)) {
			onChange(editValue);
			setSaveState('saved');
			setShowFlash(true);
			clearTimeout(saveTimerRef.current);
			clearTimeout(flashTimerRef.current);
			saveTimerRef.current = setTimeout(() => setSaveState('idle'), 1500);
			flashTimerRef.current = setTimeout(() => setShowFlash(false), 800);
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

	/** Enter edit mode with specified entry mode. */
	const enterEdit = useCallback(
		(mode: EditEntryMode, initialValue?: string) => {
			entryModeRef.current = mode;
			if (initialValue !== undefined) {
				setEditValue(initialValue);
			} else {
				setEditValue(String(value));
			}
			setIsEditing(true);
		},
		[value]
	);

	/** Handle keyboard events on the display button (non-editing state). */
	const handleButtonKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// Delete/Backspace: clear to '0' without entering edit mode
			if (e.key === 'Delete' || e.key === 'Backspace') {
				e.preventDefault();
				if (String(value) !== '0') {
					setEditValue('0');
					onChange('0');
					setSaveState('saved');
					setShowFlash(true);
					clearTimeout(saveTimerRef.current);
					clearTimeout(flashTimerRef.current);
					saveTimerRef.current = setTimeout(() => setSaveState('idle'), 1500);
					flashTimerRef.current = setTimeout(() => setShowFlash(false), 800);
				}
				return;
			}

			// F2: enter edit mode preserving existing value (cursor at end via select)
			if (e.key === 'F2') {
				e.preventDefault();
				enterEdit('full');
				return;
			}

			// Printable character (single char, no modifier keys): overwrite mode
			if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				enterEdit('overwrite', e.key);
				return;
			}

			// All other keys (arrows, Tab, Enter, Home, End, etc.): let parent handle
		},
		[value, onChange, enterEdit]
	);

	const isNumber = type === 'number';

	if (isReadOnly) {
		return (
			<span
				className={cn(
					'block px-2 py-1 text-(--text-xs)',
					'bg-(--cell-readonly-bg) rounded-sm',
					'font-mono',
					isNumber && 'text-right tabular-nums',
					className
				)}
			>
				{value === 0 || value === '0' ? '' : value}
			</span>
		);
	}

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type={type}
				value={editValue}
				aria-label={ariaLabel ?? 'Edit cell value'}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				className={cn(
					'w-full px-2 py-1 text-(--text-xs)',
					'rounded-sm',
					'border border-(--cell-editable-focus)',
					'shadow-(--shadow-glow-accent)',
					'bg-(--workspace-bg-card) scale-[1.02] origin-center',
					'font-mono',
					'outline-none',
					'transition-all duration-(--duration-fast)',
					isNumber && 'text-right tabular-nums',
					className
				)}
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={() => enterEdit('full')}
			onKeyDown={handleButtonKeyDown}
			className={cn(
				'block w-full text-left px-2 py-1 text-(--text-xs)',
				'rounded-sm cursor-text',
				'bg-(--cell-editable-bg)',
				'font-mono',
				'hover:border-(--accent-200) hover:shadow-(--shadow-xs)',
				'border border-transparent',
				'border-b border-dashed border-b-(--accent-200)',
				'transition-all duration-(--duration-fast)',
				'focus:border-(--cell-editable-focus) focus:shadow-(--shadow-glow-accent)',
				'focus:outline-none',
				isNumber && 'text-right tabular-nums',
				saveState === 'saved' && 'bg-(--accent-50)',
				saveState === 'error' && 'border-(--color-error) animate-shake',
				showFlash && 'animate-cell-save',
				className
			)}
		>
			{value === 0 || value === '0' ? '' : value}
			{saveState === 'saved' && (
				<Check className="inline-block ml-1 h-3 w-3 text-(--color-success)" aria-hidden="true" />
			)}
			{saveState === 'error' && (
				<X className="inline-block ml-1 h-3 w-3 text-(--color-error)" aria-hidden="true" />
			)}
		</button>
	);
}
