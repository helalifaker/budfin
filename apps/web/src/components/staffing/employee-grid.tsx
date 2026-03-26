import { useMemo, useState, useCallback, useRef } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type SortingState,
} from '@tanstack/react-table';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import type { Employee } from '../../hooks/use-staffing';

const columnHelper = createColumnHelper<Employee>();

function StatusBadge({ status }: { status: string }) {
	const color =
		status === 'Existing'
			? 'bg-(--color-success-bg) text-(--color-success)'
			: status === 'New'
				? 'bg-(--accent-50) text-(--accent-700)'
				: 'bg-(--color-error-bg) text-(--color-error)';
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
	totalCount?: number;
};

export function EmployeeGrid({
	employees,
	isReadOnly,
	onSelect,
	selectedId,
	totalCount,
}: EmployeeGridProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
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
								return val ? formatMoney(val, { showCurrency: true }) : '\u2014';
							},
						}),
					]),
		],
		[isReadOnly]
	);

	const table = useReactTable({
		data: employees,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	// Group rows by department
	const filteredRows = table.getSortedRowModel().rows;
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

			<div className={cn('overflow-x-auto rounded-md', 'border border-(--workspace-border)')}>
				<table
					className="w-full border-collapse text-sm"
					role="grid"
					aria-label="Employee roster"
					aria-readonly={isReadOnly ? 'true' : undefined}
					aria-rowcount={filteredRows.length + departmentGroups.length + 1}
					aria-colcount={colCount}
				>
					<thead>
						<tr className="bg-(--workspace-bg-subtle)">
							<th
								className={cn(
									'w-9 px-2 py-2 text-left font-semibold',
									'text-(--text-muted)',
									'text-(--text-xs) uppercase tracking-[0.08em]',
									'border-b border-(--workspace-border)'
								)}
								aria-label="Expand or collapse"
							/>
							{table.getHeaderGroups()[0]?.headers.map((header) => (
								<th
									key={header.id}
									className={cn(
										'px-3 py-2 text-left font-semibold text-(--text-muted)',
										'text-(--text-xs) uppercase tracking-[0.08em]',
										'border-b border-(--workspace-border)',
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
								<td colSpan={colCount} className="px-3 py-8 text-center text-(--text-muted)">
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

			<div className="text-(length:--text-xs) text-(--text-muted)">
				{employees.length}
				{totalCount !== undefined && totalCount !== employees.length
					? ` of ${totalCount}`
					: ''}{' '}
				employee(s) in {departmentGroups.length} department(s)
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
					'cursor-pointer select-none bg-(--workspace-bg-muted)',
					'hover:bg-(--workspace-bg-subtle)',
					'transition-colors'
				)}
				role="row"
				aria-expanded={isExpanded}
				tabIndex={0}
				onClick={onToggle}
				onKeyDown={onKeyDown}
				data-department={group.department}
			>
				<td className="w-9 px-2 py-2 border-b border-(--workspace-border)">
					<ChevronRight
						className={cn(
							'h-4 w-4 text-(--text-muted)',
							'transition-transform duration-150',
							isExpanded && 'rotate-90'
						)}
						aria-hidden="true"
					/>
				</td>
				<td
					colSpan={colCount - 1}
					className={cn(
						'px-3 py-2 font-semibold text-(--text-primary)',
						'border-b border-(--workspace-border)'
					)}
				>
					{group.department}
					<span
						className={cn(
							'ml-2 inline-flex items-center rounded-full',
							'bg-(--accent-50) px-2 py-0.5',
							'text-(length:--text-xs) font-medium text-(--accent-700)'
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
							'hover:bg-(--workspace-bg-subtle)',
							emp.id === selectedId && 'bg-(--accent-50) hover:bg-(--accent-50)'
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
						<td className="w-9 border-b border-(--workspace-border)" />
						<td
							className={cn(
								'px-3 py-2 pl-6 text-(--text-primary)',
								'border-b border-(--workspace-border)'
							)}
						>
							{emp.employeeCode}
						</td>
						<td
							className={cn(
								'px-3 py-2 text-(--text-primary)',
								'border-b border-(--workspace-border)'
							)}
						>
							{emp.name}
						</td>
						<td
							className={cn(
								'px-3 py-2 text-(--text-primary)',
								'border-b border-(--workspace-border)'
							)}
						>
							{emp.functionRole}
						</td>
						<td className={cn('px-3 py-2', 'border-b border-(--workspace-border)')}>
							<StatusBadge status={emp.status} />
						</td>
						<td
							className={cn(
								'px-3 py-2 text-(--text-primary)',
								'border-b border-(--workspace-border)'
							)}
						>
							{emp.isSaudi ? 'Yes' : 'No'}
						</td>
						<td
							className={cn(
								'px-3 py-2 text-(--text-primary)',
								'border-b border-(--workspace-border)'
							)}
						>
							{emp.isTeaching ? 'Yes' : 'No'}
						</td>
						{!isReadOnly && (
							<td
								className={cn(
									'px-3 py-2 text-(--text-primary)',
									'border-b border-(--workspace-border)'
								)}
							>
								{emp.baseSalary ? formatMoney(emp.baseSalary, { showCurrency: true }) : '\u2014'}
							</td>
						)}
					</tr>
				))}
		</>
	);
}
