import { useMemo } from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	useReactTable,
	type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
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

export type EmployeeGridProps = {
	employees: Employee[];
	isReadOnly: boolean;
	onSelect: (employee: Employee) => void;
	selectedId: number | null;
};

export function EmployeeGrid({ employees, isReadOnly, onSelect, selectedId }: EmployeeGridProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState('');

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
			columnHelper.accessor('department', {
				header: 'Department',
				size: 120,
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
				? [
						columnHelper.accessor('baseSalary', {
							header: 'Base Salary',
							size: 110,
							cell: (info) => {
								const val = info.getValue();
								return val === null ? (
									<span className="text-[var(--text-muted)]" aria-label="Salary data restricted">
										--
									</span>
								) : (
									`SAR ${Number(val).toLocaleString()}`
								);
							},
						}),
					]
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

	const visibleColumnCount = columns.length;
	const totalRowCount = table.getFilteredRowModel().rows.length + 1; // +1 for header row

	return (
		<div className="space-y-3">
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

			<div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--workspace-border)]">
				<table
					className="w-full border-collapse text-sm"
					role="grid"
					aria-label="Employee roster"
					aria-rowcount={totalRowCount}
					aria-colcount={visibleColumnCount}
				>
					<thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id} className="bg-[var(--workspace-bg-subtle)]">
								{headerGroup.headers.map((header, colIdx) => (
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
										aria-colindex={colIdx + 1}
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
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className="px-3 py-8 text-center text-[var(--text-muted)]"
								>
									No employees found. Add employees manually or import from xlsx.
								</td>
							</tr>
						) : (
							table.getRowModel().rows.map((row) => (
								<tr
									key={row.id}
									className={cn(
										'cursor-pointer transition-colors',
										'hover:bg-[var(--workspace-bg-subtle)]',
										row.original.id === selectedId &&
											'bg-[var(--accent-50)] hover:bg-[var(--accent-50)]'
									)}
									onClick={() => onSelect(row.original)}
									role="row"
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											onSelect(row.original);
										}
									}}
								>
									{row.getVisibleCells().map((cell, colIdx) => (
										<td
											key={cell.id}
											role="gridcell"
											aria-colindex={colIdx + 1}
											aria-readonly={isReadOnly ? 'true' : undefined}
											className={cn(
												'px-3 py-2 text-[var(--text-primary)]',
												'border-b border-[var(--workspace-border)]'
											)}
										>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<div className="text-[length:var(--text-xs)] text-[var(--text-muted)]">
				{table.getFilteredRowModel().rows.length} employee(s)
			</div>
		</div>
	);
}
