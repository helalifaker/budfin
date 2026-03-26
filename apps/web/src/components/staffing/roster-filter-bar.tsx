import { useCallback } from 'react';
import { Button } from '../ui/button';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/cn';
import { type RosterFilters, EMPTY_FILTERS, countActiveFilters } from '../../lib/roster-filters';

// ── Types ────────────────────────────────────────────────────────────────────

export type RosterFilterBarProps = {
	filters: RosterFilters;
	onFiltersChange: (filters: RosterFilters) => void;
	departments: string[];
	totalCount: number;
	visibleCount: number;
	departmentCount: number;
};

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Existing', 'New', 'Departed'] as const;
const COST_MODE_OPTIONS = [
	{ value: 'LOCAL_PAYROLL', label: 'Local Payroll' },
	{ value: 'AEFE_RECHARGE', label: 'AEFE Recharge' },
	{ value: 'NO_LOCAL_COST', label: 'No Local Cost' },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function RosterFilterBar({
	filters,
	onFiltersChange,
	departments,
	totalCount,
	visibleCount,
	departmentCount,
}: RosterFilterBarProps) {
	const activeCount = countActiveFilters(filters);

	const toggleDepartment = useCallback(
		(dept: string) => {
			const next = filters.departments.includes(dept)
				? filters.departments.filter((d) => d !== dept)
				: [...filters.departments, dept];
			onFiltersChange({ ...filters, departments: next });
		},
		[filters, onFiltersChange]
	);

	const toggleCostMode = useCallback(
		(mode: string) => {
			const next = filters.costModes.includes(mode)
				? filters.costModes.filter((m) => m !== mode)
				: [...filters.costModes, mode];
			onFiltersChange({ ...filters, costModes: next });
		},
		[filters, onFiltersChange]
	);

	const handleStatusChange = useCallback(
		(values: string[]) => {
			onFiltersChange({ ...filters, statuses: values });
		},
		[filters, onFiltersChange]
	);

	const handleSearchChange = useCallback(
		(value: string) => {
			onFiltersChange({ ...filters, searchQuery: value });
		},
		[filters, onFiltersChange]
	);

	const handleClear = useCallback(() => {
		onFiltersChange(EMPTY_FILTERS);
	}, [onFiltersChange]);

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-2 flex-wrap">
				{/* Search */}
				<input
					type="text"
					placeholder="Search employees..."
					value={filters.searchQuery}
					onChange={(e) => handleSearchChange(e.target.value)}
					className={cn(
						'w-full max-w-xs rounded-md',
						'border border-(--workspace-border) bg-(--workspace-bg)',
						'px-3 py-1.5 text-sm text-(--text-primary)',
						'placeholder:text-(--text-muted)',
						'focus:outline-none focus:ring-2 focus:ring-(--accent-500)'
					)}
					aria-label="Search employees"
				/>

				{/* Department multi-select */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm">
							Department
							{filters.departments.length > 0 && (
								<span
									className={cn(
										'ml-1.5 inline-flex h-5 min-w-5 items-center justify-center',
										'rounded-full bg-(--accent-500) px-1',
										'text-xs font-medium text-(--text-on-dark)'
									)}
								>
									{filters.departments.length}
								</span>
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
						{departments.map((dept) => (
							<DropdownMenuCheckboxItem
								key={dept}
								checked={filters.departments.includes(dept)}
								onCheckedChange={() => toggleDepartment(dept)}
							>
								{dept}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Status toggles */}
				<ToggleGroup
					type="multiple"
					value={filters.statuses}
					onValueChange={handleStatusChange}
					aria-label="Filter by status"
				>
					{STATUS_OPTIONS.map((status) => (
						<ToggleGroupItem key={status} value={status} aria-label={`${status} employees`}>
							{status}
						</ToggleGroupItem>
					))}
				</ToggleGroup>

				{/* Cost Mode multi-select */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm">
							Cost Mode
							{filters.costModes.length > 0 && (
								<span
									className={cn(
										'ml-1.5 inline-flex h-5 min-w-5 items-center justify-center',
										'rounded-full bg-(--accent-500) px-1',
										'text-xs font-medium text-(--text-on-dark)'
									)}
								>
									{filters.costModes.length}
								</span>
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{COST_MODE_OPTIONS.map((opt) => (
							<DropdownMenuCheckboxItem
								key={opt.value}
								checked={filters.costModes.includes(opt.value)}
								onCheckedChange={() => toggleCostMode(opt.value)}
							>
								{opt.label}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Clear filters */}
				{activeCount > 0 && (
					<Button variant="ghost" size="sm" onClick={handleClear}>
						Clear
						<span
							className={cn(
								'ml-1.5 inline-flex h-5 min-w-5 items-center justify-center',
								'rounded-full bg-(--text-muted) px-1',
								'text-xs font-medium text-(--text-on-dark)'
							)}
						>
							{activeCount}
						</span>
					</Button>
				)}
			</div>

			{/* Footer */}
			<div className="text-xs text-(--text-muted)">
				Showing {visibleCount} of {totalCount} employees in {departmentCount} department(s)
			</div>
		</div>
	);
}
