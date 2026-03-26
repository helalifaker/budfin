import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';

interface EditableNumericCellProps {
	/** Current value as a number. */
	value: number;
	/** Called when the user commits an edit (Enter/Tab). */
	onSave: (newValue: number) => void;
	/** Whether inline editing is enabled. When false, the cell is read-only. */
	editable?: boolean;
	/** Optional CSS class for the outer container. */
	className?: string;
	/** Number of decimal places for display formatting (default: 0). */
	decimalPlaces?: number;
}

/**
 * Editable numeric cell for planning grids.
 *
 * - Double-click transforms the cell into an `<input type="number">`.
 * - Enter / Tab saves the new value and calls `onSave`.
 * - Escape cancels editing and restores the original value.
 * - The input text is auto-selected on focus.
 * - Only active when the `editable` prop is true.
 */
export function EditableNumericCell({
	value,
	onSave,
	editable = false,
	className,
	decimalPlaces = 0,
}: EditableNumericCellProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const enterEditMode = useCallback(() => {
		if (!editable) return;
		setDraft(String(value));
		setIsEditing(true);
	}, [editable, value]);

	// Auto-select text when the input mounts
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const commitEdit = useCallback(() => {
		const parsed = parseFloat(draft);
		if (!isNaN(parsed) && parsed !== value) {
			onSave(parsed);
		}
		setIsEditing(false);
	}, [draft, onSave, value]);

	const cancelEdit = useCallback(() => {
		setIsEditing(false);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				commitEdit();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				cancelEdit();
			}
		},
		[cancelEdit, commitEdit]
	);

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type="number"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={handleKeyDown}
				onBlur={commitEdit}
				className={cn(
					'w-full rounded border border-(--cell-editable-focus) bg-(--workspace-bg-card)',
					'px-2 py-0.5 text-right',
					'font-mono text-(--text-xs)',
					'outline-none ring-1 ring-(--cell-editable-focus)/30',
					className
				)}
				aria-label="Edit value"
			/>
		);
	}

	const displayValue =
		decimalPlaces > 0 ? formatMoney(value.toFixed(decimalPlaces)) : formatMoney(value);

	return (
		<div
			onDoubleClick={enterEditMode}
			role={editable ? 'button' : undefined}
			tabIndex={editable ? 0 : undefined}
			onKeyDown={
				editable
					? (e) => {
							if (e.key === 'Enter' || e.key === 'F2') {
								e.preventDefault();
								enterEditMode();
							}
						}
					: undefined
			}
			className={cn(
				'text-right font-mono text-(--text-xs) tabular-nums',
				'px-2 py-0.5',
				editable && [
					'cursor-pointer rounded',
					'bg-(--cell-editable-bg)',
					'hover:ring-1 hover:ring-(--cell-editable-focus)/40',
					'transition-shadow duration-(--duration-fast)',
				],
				className
			)}
			title={editable ? 'Double-click to edit' : undefined}
		>
			{displayValue}
		</div>
	);
}
