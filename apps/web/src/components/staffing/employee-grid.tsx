import { useMemo, useState, useCallback, useRef } from 'react';
import {
	createColumnHelper,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type SortingState,
} from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import type { Employee } from '../../hooks/use-staffing';
import { ListGrid } from '../data-grid/list-grid';

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
		(department: string) => {
			setExpandedDepartments((prev) => {
				const next = new Set(prev);
				if (next.has(department)) {
					next.delete(department);
					announce(`${department} collapsed`);
				} else {
					next.add(department);
					const count = employees.filter(
						(e) => (e.department || 'Unassigned') === department
					).length;
					announce(`${department} expanded, ${count} employees`);
				}
				return next;
			});
		},
		[announce, employees]
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

	// Count departments for the footer summary
	const departmentCount = useMemo(() => {
		const depts = new Set<string>();
		for (const emp of employees) {
			depts.add(emp.department || 'Unassigned');
		}
		return depts.size;
	}, [employees]);

	// Expandable config: group by department with collapsible sections
	const expandable = useMemo(
		() => ({
			groupKey: (row: Employee) => row.department || 'Unassigned',
			isExpanded: (row: Employee) => expandedDepartments.has(row.department || 'Unassigned'),
			onToggle: (row: Employee) => toggleDepartment(row.department || 'Unassigned'),
			renderExpanded: () => null,
			groupLabel: (key: string) => key,
			groupCount: (key: string) =>
				employees.filter((e) => (e.department || 'Unassigned') === key).length,
		}),
		[expandedDepartments, toggleDepartment, employees]
	);

	return (
		<div className="space-y-3">
			{/* Screen reader live region */}
			<div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />

			<ListGrid
				table={table}
				sortable
				expandable={expandable}
				selectedRowPredicate={(row: Employee) => row.id === selectedId}
				onRowSelect={onSelect}
				ariaLabel="Employee roster"
				emptyState={
					<p className="text-(--text-sm) text-(--text-muted)">
						No employees found. Add employees manually or import from xlsx.
					</p>
				}
			/>

			<div className="text-(--text-xs) text-(--text-muted)">
				{employees.length}
				{totalCount !== undefined && totalCount !== employees.length
					? ` of ${totalCount}`
					: ''}{' '}
				employee(s) in {departmentCount} department(s)
			</div>
		</div>
	);
}
