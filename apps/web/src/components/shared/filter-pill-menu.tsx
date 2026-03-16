import { cn } from '../../lib/cn';

export interface FilterConfig {
	value: string;
	label: string;
	description?: string;
}

export interface FilterPillMenuProps {
	filters: FilterConfig[];
	value: string;
	onChange: (value: string) => void;
	label?: string;
}

export function FilterPillMenu({ filters, value, onChange, label }: FilterPillMenuProps) {
	return (
		<div className="flex items-center gap-1" role="group" aria-label={label ?? 'Filter options'}>
			{filters.map((filter) => (
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
					title={filter.description}
				>
					{filter.label}
				</button>
			))}
		</div>
	);
}
