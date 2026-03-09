import { useMemo, useState, useCallback, useRef } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	useReactTable,
	type SortingState,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import type { Employee } from '../../hooks/use-staffing';

const columnHelper = createColumnHelper<Employee>();

function StatusBadge({ status }: { status: string }) {
	const color =
		status === 'Existing'
			? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
			: status === 'New'
				? 'bg-[var(--accent-50)] text-[var(--accent-700)]'
				: 'bg-[var(--color-error-bg)] text-[var(--color-error)]';
	return (
		<span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', color)}>
			{status}
		</span>
	);
}

export type DepartmentGroup = {
	department: string;
	employees: Employee[];
};

export type EmployeeGridProps = {
	employees: Employee[];
	isReadOnly: boolean;
	onSelect: (employee: Employee) => void;
	selectedId: number | null;
};

export function EmployeeGrid({ employees, isReadOnly, onSelect, selectedId }: EmployeeGridProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState('');
	const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
	const liveRegionRef = useRef<HTMLDivElement>(null);

	const announce = useCallback((message: string) => {
		if (liveRegionRef.current) {
			liveRegionRef.current.textContent = message;
		}
	}, []);

	const toggleDepartment = useCallback(
		(department: string, employees: Employee[]) => {
			setExpandedDepartments((prev) => {
				const next = new Set(prev);
				if (next.has(department)) {
					next.delete(department);
					announce(`${department} collapsed`);
				} else {
					next.add(department);
					announce(`${department} expanded, ${employees.length} employees`);
				}
				return next;
			});
		},
		[announce]
	);

	const expandDepartment = useCallback(
		(department: string, employees: Employee[]) => {
			setExpandedDepartments((prev) => {
				if (prev.has(department)) return prev;
				const next = new Set(prev);
				next.add(department);
				announce(`${department} expanded, ${employees.length} employees`);
				return next;
			});
		},
		[announce]
	);

	const collapseDepartment = useCallback(
		(department: string) => {
			setExpandedDepartments((prev) => {
				if (!prev.has(department)) return prev;
				const next = new Set(prev);
				next.delete(department);
				announce(`${department} collapsed`);
				return next;
			});
		},
		[announce]
	);

	const columns = useMemo(
		() => [
			columnHelper.accessor('employeeCode', {
				header: 'Code',
				size: 90,
			}),
			columnHelper.accessor('name', {
				header: 'Name',
				size: 180,
			}),
			columnHelper.accessor('functionRole', {
				header: 'Role',
				size: 150,
			}),
			columnHelper.accessor('status', {
				header: 'Status',
				size: 90,
				cell: (info) => <StatusBadge status={info.getValue()} />,
			}),
			columnHelper.accessor('isSaudi', {
				header: 'Saudi',
				size: 60,
				cell: (info) => (info.getValue() ? 'Yes' : 'No'),
			}),
			columnHelper.accessor('isTeaching', {
				header: 'Teaching',
				size: 70,
				cell: (info) => (info.getValue() ? 'Yes' : 'No'),
			}),
			...(isReadOnly
				? []
				: [
						columnHelper.accessor('baseSalary', {
							header: 'Base Salary',
							size: 110,
							cell: (info) => {
								const val = info.getValue();
								return val ? `SAR ${Number(val).toLocaleString()}` : '\u2014';
							},
						}),
					]),
		],
		[isReadOnly]
	);

	const table = useReactTable({
		data: employees,
		columns,
		state: { sorting, globalFilter },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	// Group filtered rows by department
	const filteredRows = table.getFilteredRowModel().rows;
	const departmentGroups = useMemo(() => {
		const groups = new Map<string, Employee[]>();
		for (const row of filteredRows) {
			const dept = row.original.department || 'Unassigned';
			const existing = groups.get(dept);
			if (existing) {
				existing.push(row.original);
			} else {
				groups.set(dept, [row.original]);
			}
		}
		return Array.from(groups.entries()).map(([department, emps]) => ({
			department,
			employees: emps,
		}));
	}, [filteredRows]);

	const colCount = columns.length + 1; // +1 for expand/collapse chevron column

	const handleDepartmentKeyDown = useCallback(
		(e: React.KeyboardEvent, group: DepartmentGroup) => {
			const isExpanded = expandedDepartments.has(group.department);

			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleDepartment(group.department, group.employees);
			} else if (e.key === 'ArrowRight' && !isExpanded) {
				e.preventDefault();
				expandDepartment(group.department, group.employees);
			} else if (e.key === 'ArrowLeft' && isExpanded) {
				e.preventDefault();
				collapseDepartment(group.department);
			}
		},
		[expandedDepartments, toggleDepartment, expandDepartment, collapseDepartment]
	);

	return (
		<div className="space-y-3">
			{/* Screen reader live region */}
			<div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />

			<input
				type="text"
				placeholder="Search employees..."
				value={globalFilter}
				onChange={(e) => setGlobalFilter(e.target.value)}
				className={cn(
					'w-full max-w-xs rounded-[var(--radius-md)]',
					'border border-[var(--workspace-border)] bg-[var(--workspace-bg)]',
					'px-3 py-1.5 text-sm text-[var(--text-primary)]',
					'placeholder:text-[var(--text-muted)]',
					'focus:outline-none focus:ring-2 focus:ring-[var(--accent-500)]'
				)}
				aria-label="Search employees"
			/>

			<div
				className={cn(
					'overflow-x-auto rounded-[var(--radius-md)]',
					'border border-[var(--workspace-border)]'
				)}
			>
				<table className="w-full border-collapse text-sm" role="grid" aria-label="Employee roster">
					<thead>
						<tr className="bg-[var(--workspace-bg-subtle)]">
							<th
								className={cn(
									'w-9 px-2 py-2 text-left font-medium',
									'text-[var(--text-muted)]',
									'text-[length:var(--text-xs)] uppercase tracking-wider',
									'border-b border-[var(--workspace-border)]'
								)}
								aria-label="Expand or collapse"
							/>
							{table.getHeaderGroups()[0]?.headers.map((header) => (
								<th
									key={header.id}
									className={cn(
										'px-3 py-2 text-left font-medium text-[var(--text-muted)]',
										'text-[length:var(--text-xs)] uppercase tracking-wider',
										'border-b border-[var(--workspace-border)]',
										header.column.getCanSort() && 'cursor-pointer select-none'
									)}
									style={{ width: header.getSize() }}
									onClick={header.column.getToggleSortingHandler()}
									aria-sort={
										header.column.getIsSorted() === 'asc'
											? 'ascending'
											: header.column.getIsSorted() === 'desc'
												? 'descending'
												: 'none'
									}
								>
									{flexRender(header.column.columnDef.header, header.getContext())}
									{header.column.getIsSorted() === 'asc'
										? ' \u2191'
										: header.column.getIsSorted() === 'desc'
											? ' \u2193'
											: ''}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{departmentGroups.length === 0 ? (
							<tr>
								<td colSpan={colCount} className="px-3 py-8 text-center text-[var(--text-muted)]">
									No employees found. Add employees manually or import from xlsx.
								</td>
							</tr>
						) : (
							departmentGroups.map((group) => {
								const isExpanded = expandedDepartments.has(group.department);
								return (
									<DepartmentRows
										key={group.department}
										group={group}
										isExpanded={isExpanded}
										colCount={colCount}
										columns={columns}
										selectedId={selectedId}
										isReadOnly={isReadOnly}
										onSelect={onSelect}
										onToggle={() => toggleDepartment(group.department, group.employees)}
										onKeyDown={(e) => handleDepartmentKeyDown(e, group)}
									/>
								);
							})
						)}
					</tbody>
				</table>
			</div>

			<div className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
				{table.getFilteredRowModel().rows.length} employee(s) in {departmentGroups.length}{' '}
				department(s)
			</div>
		</div>
	);
}

// Separate component to avoid re-renders of all groups when one toggles
type DepartmentRowsProps = {
	group: DepartmentGroup;
	isExpanded: boolean;
	colCount: number;
	columns: unknown[];
	selectedId: number | null;
	isReadOnly: boolean;
	onSelect: (employee: Employee) => void;
	onToggle: () => void;
	onKeyDown: (e: React.KeyboardEvent) => void;
};

function DepartmentRows({
	group,
	isExpanded,
	colCount,
	selectedId,
	isReadOnly,
	onSelect,
	onToggle,
	onKeyDown,
}: DepartmentRowsProps) {
	return (
		<>
			{/* Department group row */}
			<tr
				className={cn(
					'cursor-pointer select-none bg-[var(--workspace-bg-muted)]',
					'hover:bg-[var(--workspace-bg-subtle)]',
					'transition-colors'
				)}
				role="row"
				aria-expanded={isExpanded}
				tabIndex={0}
				onClick={onToggle}
				onKeyDown={onKeyDown}
				data-department={group.department}
			>
				<td className="w-9 px-2 py-2 border-b border-[var(--workspace-border)]">
					<span
						className={cn(
							'inline-flex h-5 w-5 items-center justify-center',
							'text-[var(--text-muted)] transition-transform',
							isExpanded && 'rotate-90'
						)}
						aria-hidden="true"
					>
						&#9654;
					</span>
				</td>
				<td
					colSpan={colCount - 1}
					className={cn(
						'px-3 py-2 font-semibold text-[var(--text-primary)]',
						'border-b border-[var(--workspace-border)]'
					)}
				>
					{group.department}
					<span
						className={cn(
							'ml-2 inline-flex items-center rounded-full',
							'bg-[var(--accent-50)] px-2 py-0.5',
							'text-[length:var(--text-xs)] font-medium text-[var(--accent-700)]'
						)}
					>
						{group.employees.length}
					</span>
				</td>
			</tr>

			{/* Employee detail rows */}
			{isExpanded &&
				group.employees.map((emp) => (
					<tr
						key={emp.id}
						className={cn(
							'cursor-pointer transition-colors',
							'hover:bg-[var(--workspace-bg-subtle)]',
							emp.id === selectedId && 'bg-[var(--accent-50)] hover:bg-[var(--accent-50)]'
						)}
						role="row"
						aria-level={2}
						tabIndex={0}
						onClick={() => onSelect(emp)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onSelect(emp);
							}
						}}
					>
						<td className="w-9 border-b border-[var(--workspace-border)]" />
						<td
							className={cn(
								'px-3 py-2 pl-6 text-[var(--text-primary)]',
								'border-b border-[var(--workspace-border)]'
							)}
						>
							{emp.employeeCode}
						</td>
						<td
							className={cn(
								'px-3 py-2 text-[var(--text-primary)]',
								'border-b border-[var(--workspace-border)]'
							)}
						>
							{emp.name}
						</td>
						<td
							className={cn(
								'px-3 py-2 text-[var(--text-primary)]',
								'border-b border-[var(--workspace-border)]'
							)}
						>
							{emp.functionRole}
						</td>
						<td className={cn('px-3 py-2', 'border-b border-[var(--workspace-border)]')}>
							<StatusBadge status={emp.status} />
						</td>
						<td
							className={cn(
								'px-3 py-2 text-[var(--text-primary)]',
								'border-b border-[var(--workspace-border)]'
							)}
						>
							{emp.isSaudi ? 'Yes' : 'No'}
						</td>
						<td
							className={cn(
								'px-3 py-2 text-[var(--text-primary)]',
								'border-b border-[var(--workspace-border)]'
							)}
						>
							{emp.isTeaching ? 'Yes' : 'No'}
						</td>
						{!isReadOnly && (
							<td
								className={cn(
									'px-3 py-2 text-[var(--text-primary)]',
									'border-b border-[var(--workspace-border)]'
								)}
							>
								{emp.baseSalary ? `SAR ${Number(emp.baseSalary).toLocaleString()}` : '\u2014'}
							</td>
						)}
					</tr>
				))}
		</>
	);
}
