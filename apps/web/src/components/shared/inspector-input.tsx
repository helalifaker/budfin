import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/cn';

export type InspectorInputProps = {
	value: number;
	onChange: (value: number) => void;
	type?: 'number' | 'percentage';
	isReadOnly?: boolean;
	placeholder?: string;
	min?: number;
	max?: number;
	className?: string;
	'aria-label'?: string;
};

function formatDraft(value: number): string {
	return value === 0 ? '' : String(value);
}

export function InspectorInput({
	value,
	onChange,
	type = 'number',
	isReadOnly = false,
	placeholder = 'Enter',
	min,
	max,
	className,
	'aria-label': ariaLabel,
}: InspectorInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const committedRef = useRef(value);

	const [isFocused, setIsFocused] = useState(false);
	const [draft, setDraft] = useState(() => formatDraft(value));
	const [prevValue, setPrevValue] = useState(value);

	// Controlled sync: when external value changes while not focused, update draft
	if (prevValue !== value) {
		setPrevValue(value);
		if (!isFocused) {
			setDraft(formatDraft(value));
		}
	}

	useEffect(() => {
		return () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		};
	}, []);

	const commit = useCallback(
		(raw: string) => {
			const parsed = parseFloat(raw);
			if (isNaN(parsed)) return;

			const clamped =
				min !== undefined || max !== undefined
					? Math.max(min ?? -Infinity, Math.min(max ?? Infinity, parsed))
					: parsed;

			const finalValue = type === 'percentage' ? clamped / 100 : clamped;

			if (finalValue !== committedRef.current) {
				committedRef.current = finalValue;
				if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
				saveTimerRef.current = setTimeout(() => {
					onChange(finalValue);
				}, 300);
			}
		},
		[max, min, onChange, type]
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				commit(draft);
				inputRef.current?.blur();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				setDraft(formatDraft(value));
				inputRef.current?.blur();
			}
		},
		[commit, draft, value]
	);

	const handleFocus = useCallback(() => {
		setIsFocused(true);
		committedRef.current = value;
	}, [value]);

	const handleBlur = useCallback(() => {
		setIsFocused(false);
		committedRef.current = value;
		if (draft.trim() !== '') {
			commit(draft);
		}
	}, [commit, draft, value]);

	const input = (
		<input
			ref={inputRef}
			type="number"
			inputMode="numeric"
			min={min}
			max={max}
			step={1}
			value={draft}
			placeholder={placeholder}
			disabled={isReadOnly}
			onChange={(event) => setDraft(event.target.value)}
			onFocus={handleFocus}
			onBlur={handleBlur}
			onKeyDown={handleKeyDown}
			aria-label={ariaLabel}
			className={cn(
				'w-20 rounded-md border border-[color-mix(in_srgb,var(--workspace-border),white_35%)]',
				'px-2.5 py-1.5 text-right text-(length:--text-sm)',
				'font-[family-name:var(--font-mono)] tabular-nums',
				'transition-[background-color,border-color,box-shadow] duration-(--duration-fast)',
				'focus:outline-none focus:ring-2 focus:ring-(--cell-editable-focus)',
				isReadOnly
					? 'cursor-not-allowed bg-(--cell-readonly-bg) text-(--text-secondary)'
					: 'bg-(--cell-editable-bg) text-(--text-primary) shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
				className
			)}
		/>
	);

	if (type === 'percentage') {
		return (
			<div className="flex items-center gap-1">
				{input}
				<span className="text-(--text-xs) text-(--text-muted)">%</span>
			</div>
		);
	}

	return input;
}
