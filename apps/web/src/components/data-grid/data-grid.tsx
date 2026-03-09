import type { ReactNode } from 'react';
import type { Table } from '@tanstack/react-table';
import { flexRender as render } from '@tanstack/react-table';
import { cn } from '../../lib/cn';
import { GridSkeleton } from './grid-skeleton';

interface DataGridProps<T> {
	table: Table<T>;
	isLoading?: boolean;
	showSkeleton?: boolean;
	emptyState?: ReactNode;
	className?: string;
}

export function DataGrid<T>({
	table,
	isLoading = false,
	showSkeleton = false,
	emptyState,
	className,
}: DataGridProps<T>) {
	const cols = table.getAllColumns().length;

	return (
		<div
			className={cn(
				'overflow-x-auto',
				'rounded-lg border border-(--workspace-border)',
				'shadow-(--shadow-xs)',
				className
			)}
		>
			<table role="table" className="w-full text-left text-(--text-sm)">
				<thead className="border-b border-(--workspace-border) bg-(--workspace-bg-muted)">
					{table.getHeaderGroups().map((hg) => (
						<tr key={hg.id}>
							{hg.headers.map((header) => (
								<th
									key={header.id}
									className={cn(
										'px-4 py-3 font-medium text-(--text-secondary)',
										'text-(--text-xs) uppercase tracking-wide'
									)}
								>
									{render(header.column.columnDef.header, header.getContext())}
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody>
					{isLoading && showSkeleton ? (
						<GridSkeleton rows={10} cols={cols} />
					) : table.getRowModel().rows.length === 0 ? (
						<tr>
							<td colSpan={cols} className="px-4 py-12 text-center">
								{emptyState ?? (
									<p className="text-(--text-sm) text-(--text-muted)">No data available</p>
								)}
							</td>
						</tr>
					) : (
						table.getRowModel().rows.map((row, i) => (
							<tr
								key={row.id}
								className={cn(
									'border-b border-(--workspace-border) last:border-0',
									'transition-colors duration-(--duration-fast)',
									'hover:bg-(--accent-50)',
									'group',
									'animate-fade-in'
								)}
								style={{ animationDelay: `${i * 30}ms` }}
							>
								{row.getVisibleCells().map((cell) => (
									<td
										key={cell.id}
										role="cell"
										className={cn(
											'px-4 py-3',
											'border-l-2 border-l-transparent',
											'group-hover:border-l-(--accent-200)',
											'transition-all duration-(--duration-fast)'
										)}
									>
										{render(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}
