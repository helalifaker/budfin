import { FilterPillMenu } from '../shared/filter-pill-menu';
import type { FilterConfig } from '../shared/filter-pill-menu';

export type ExceptionFilterValue =
	| 'all'
	| 'over-capacity'
	| 'near-cap'
	| 'missing-inputs'
	| 'manual-override';

const FILTERS: FilterConfig[] = [
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
		<FilterPillMenu
			filters={FILTERS}
			value={value}
			onChange={(v) => onChange(v as ExceptionFilterValue)}
			label="Exception filter"
		/>
	);
}
