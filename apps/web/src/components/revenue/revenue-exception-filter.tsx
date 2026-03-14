import { FilterPillMenu } from '../shared/filter-pill-menu';
import type { FilterConfig } from '../shared/filter-pill-menu';

export type RevenueExceptionFilterValue =
	| 'all'
	| 'missing-fees'
	| 'missing-tariffs'
	| 'high-discount'
	| 'zero-revenue';

const FILTERS: FilterConfig[] = [
	{ value: 'all', label: 'All' },
	{ value: 'missing-fees', label: 'Missing Fees' },
	{ value: 'missing-tariffs', label: 'Missing Tariffs' },
	{ value: 'high-discount', label: 'High Discount' },
	{ value: 'zero-revenue', label: 'Zero Revenue' },
];

export function RevenueExceptionFilter({
	value,
	onChange,
}: {
	value: RevenueExceptionFilterValue;
	onChange: (value: RevenueExceptionFilterValue) => void;
}) {
	return (
		<FilterPillMenu
			filters={FILTERS}
			value={value}
			onChange={(v) => onChange(v as RevenueExceptionFilterValue)}
			label="Revenue filter"
		/>
	);
}
