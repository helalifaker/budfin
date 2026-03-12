import { cn } from '../../lib/cn';

export type ExceptionFilterValue =
	| 'all'
	| 'over-capacity'
	| 'near-cap'
	| 'missing-inputs'
	| 'manual-override';

const FILTERS: Array<{ value: ExceptionFilterValue; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: 'over-capacity', label: 'Over Capacity' },
	{ value: 'near-cap', label: 'Near Capacity' },
	{ value: 'missing-inputs', label: 'Missing Inputs' },
	{ value: 'manual-override', label: 'Manual Overrides' },
];

export function ExceptionFilterMenu({
	value,
	onChange,
}: {
	value: ExceptionFilterValue;
	onChange: (value: ExceptionFilterValue) => void;
}) {
	return (
		<div className="flex items-center gap-1" role="group" aria-label="Exception filter">
			{FILTERS.map((filter) => (
				<button
					key={filter.value}
					type="button"
					onClick={() => onChange(filter.value)}
					className={cn(
						'rounded-full px-2.5 py-1 text-(--text-xs) font-medium transition-colors duration-(--duration-fast)',
						value === filter.value
							? 'bg-(--accent-100) text-(--accent-700)'
							: 'bg-(--workspace-bg-muted) text-(--text-muted) hover:bg-(--workspace-bg-subtle) hover:text-(--text-secondary)'
					)}
					aria-pressed={value === filter.value}
				>
					{filter.label}
				</button>
			))}
		</div>
	);
}
