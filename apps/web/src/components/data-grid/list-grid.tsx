import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import type { Table } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useGridKeyboard } from '../../hooks/use-grid-keyboard';
import { GridSkeleton } from './grid-skeleton';

// ── Types ───────────────────────────────────────────────────────────────────

interface ExpandableConfig<T> {
	isExpanded: (row: T) => boolean;
	onToggle: (row: T) => void;
	renderExpanded: (row: T) => ReactNode;
	groupKey?: (row: T) => string;
	groupLabel?: (key: string) => string;
	groupCount?: (key: string) => number;
}

interface PaginationConfig {
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
}

export interface ListGridProps<T> {
	table: Table<T>;
	isLoading?: boolean;
	emptyState?: ReactNode;
	sortable?: boolean;
	numericColumns?: string[];
	pagination?: PaginationConfig;
	expandable?: ExpandableConfig<T>;
	actionsColumn?:
		| {
				render: (row: T) => ReactNode;
				width?: number;
		  }
		| undefined;
	selectable?: boolean;
	selectedRowPredicate?: (row: T) => boolean;
	onRowSelect?: (rowData: T) => void;
	onRowClick?: (rowData: T) => void;
	keyboardNavigation?: boolean;
	className?: string;
	ariaLabel?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isNumeric(columnId: string, numericColumns?: string[]): boolean {
	return numericColumns?.includes(columnId) ?? false;
}

// ── Component ───────────────────────────────────────────────────────────────

export function ListGrid<T>({
	table,
	isLoading = false,
	emptyState,
	sortable = false,
	numericColumns,
	pagination,
	expandable,
	actionsColumn,
	selectable: _selectable,
	selectedRowPredicate,
	onRowSelect,
	onRowClick,
	keyboardNavigation = false,
	className,
	ariaLabel,
}: ListGridProps<T>) {
	const tableRef = useRef<HTMLTableElement>(null);
	const rows = table.getRowModel().rows;
	const headerGroups = table.getHeaderGroups();
	const leafHeaders = useMemo(
		() => headerGroups[headerGroups.length - 1]?.headers ?? [],
		[headerGroups]
	);

	// Total visible columns including optional expand + actions columns
	const hasExpandCol = !!expandable;
	const hasActionsCol = !!actionsColumn;
	const dataColCount = leafHeaders.length;
	const totalColSpan = dataColCount + (hasExpandCol ? 1 : 0) + (hasActionsCol ? 1 : 0);

	const columnIds = useMemo(() => leafHeaders.map((h) => h.id), [leafHeaders]);

	const keyboard = useGridKeyboard({
		tableRef,
		rowCount: rows.length,
		colCount: dataColCount,
		enabled: keyboardNavigation,
		columnIds,
		onRowSelect: onRowSelect
			? (rowIndex: number) => {
					const row = rows[rowIndex];
					if (row) onRowSelect(row.original);
				}
			: undefined,
	});

	// ── Group rows by expandable.groupKey ────────────────────────────────

	const groupedRows = useMemo(() => {
		if (!expandable?.groupKey) return null;

		const groups: { key: string; rowIndices: number[] }[] = [];
		let currentKey: string | null = null;

		rows.forEach((row, i) => {
			const key = expandable.groupKey!(row.original);
			if (key !== currentKey) {
				groups.push({ key, rowIndices: [i] });
				currentKey = key;
			} else {
				const last = groups[groups.length - 1];
				if (last) last.rowIndices.push(i);
			}
		});

		return groups;
	}, [expandable, rows]);

	// ── Event handlers ──────────────────────────────────────────────────

	const handleTableFocus = useCallback(() => {
		if (!keyboardNavigation || keyboard.activeCell || rows.length === 0 || dataColCount === 0) {
			return;
		}
		keyboard.setActiveCell({ rowIndex: 0, colIndex: 0, colId: columnIds[0] ?? '' });
	}, [keyboard, dataColCount, keyboardNavigation, rows.length, columnIds]);

	const handleRowClick = useCallback(
		(rowData: T) => {
			if (onRowClick) onRowClick(rowData);
			if (onRowSelect) onRowSelect(rowData);
		},
		[onRowClick, onRowSelect]
	);

	// ── Pagination helpers ──────────────────────────────────────────────

	const paginationInfo = useMemo(() => {
		if (!pagination) return null;
		const { page, pageSize, total } = pagination;
		const start = (page - 1) * pageSize + 1;
		const end = Math.min(page * pageSize, total);
		const totalPages = Math.max(1, Math.ceil(total / pageSize));
		return { start, end, total, totalPages, page };
	}, [pagination]);

	// ── Loading state ───────────────────────────────────────────────────

	if (isLoading) {
		return (
			<div
				className={cn(
					'rounded-(--list-border-radius) border border-(--workspace-border)',
					'bg-(--workspace-bg-card) shadow-(--shadow-xs) overflow-hidden',
					className
				)}
			>
				<div className="overflow-x-auto">
					<table aria-label={ariaLabel} className="w-full text-left text-(--text-sm)">
						<tbody>
							<GridSkeleton rows={8} cols={totalColSpan} />
						</tbody>
					</table>
				</div>
			</div>
		);
	}

	// ── Render helpers ──────────────────────────────────────────────────

	const renderSortIndicator = (header: (typeof leafHeaders)[number]) => {
		if (!sortable || !header.column.getCanSort()) return null;

		const sorted = header.column.getIsSorted();
		if (sorted === 'asc') {
			return <ArrowUp className="ml-1 inline h-3.5 w-3.5 text-(--list-sort-indicator)" />;
		}
		if (sorted === 'desc') {
			return <ArrowDown className="ml-1 inline h-3.5 w-3.5 text-(--list-sort-indicator)" />;
		}
		return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-(--text-muted) opacity-50" />;
	};

	const renderHeaderRow = () =>
		headerGroups.map((hg) => (
			<tr key={hg.id}>
				{/* Optional expand toggle column header */}
				{hasExpandCol && (
					<th
						className={cn(
							'w-9 px-2 py-3',
							'bg-(--list-header-bg)',
							'border-b border-(--list-header-border)'
						)}
					/>
				)}

				{/* Data column headers */}
				{hg.headers.map((header) => {
					const numeric = isNumeric(header.id, numericColumns);
					const isSortable = sortable && header.column.getCanSort();

					return (
						<th
							key={header.id}
							colSpan={header.colSpan}
							onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
							className={cn(
								'px-(--list-cell-px) py-3',
								'bg-(--list-header-bg)',
								'text-(--text-xs) font-semibold uppercase tracking-[0.08em]',
								'text-(--list-header-text)',
								'border-b border-(--list-header-border)',
								numeric && 'text-right',
								isSortable &&
									'cursor-pointer select-none hover:text-(--text-primary) hover:bg-(--workspace-bg-muted)'
							)}
						>
							{header.isPlaceholder
								? null
								: flexRender(header.column.columnDef.header, header.getContext())}
							{!header.isPlaceholder && renderSortIndicator(header)}
						</th>
					);
				})}

				{/* Optional actions column header */}
				{hasActionsCol && (
					<th
						className={cn(
							'px-2 py-3',
							'bg-(--list-header-bg)',
							'border-b border-(--list-header-border)',
							'text-(--text-xs) font-semibold uppercase tracking-[0.08em]',
							'text-(--list-header-text) text-center'
						)}
						style={actionsColumn.width ? { width: actionsColumn.width } : { width: 64 }}
					>
						Actions
					</th>
				)}
			</tr>
		));

	const renderDataCell = (
		row: (typeof rows)[number],
		rowIndex: number,
		colIndex: number,
		columnId: string
	) => {
		const cell = row.getVisibleCells()[colIndex];
		if (!cell) return null;

		const numeric = isNumeric(columnId, numericColumns);
		const isActive = keyboard.isCellActive(rowIndex, colIndex);
		const isInRange = keyboard.isCellInRange(rowIndex, colIndex);

		return (
			<td
				key={cell.id}
				onClick={
					keyboardNavigation
						? (e) => keyboard.handlers.onCellClick(rowIndex, colIndex, e)
						: undefined
				}
				data-row-index={rowIndex}
				data-col-index={colIndex}
				tabIndex={keyboardNavigation ? (isActive ? 0 : -1) : undefined}
				className={cn(
					'px-(--list-cell-px) py-(--list-cell-py)',
					'text-(--text-primary)',
					numeric && 'text-right font-mono tabular-nums text-(--text-primary)',
					isActive && 'ring-(length:--grid-focus-ring-width) ring-(--grid-focus-ring) ring-inset',
					isInRange && 'bg-(--grid-range-bg)'
				)}
			>
				{flexRender(cell.column.columnDef.cell, cell.getContext())}
			</td>
		);
	};

	const renderDataRow = (row: (typeof rows)[number], rowIndex: number) => {
		const isSelected = selectedRowPredicate ? selectedRowPredicate(row.original) : false;
		const isClickable = !!onRowClick || !!onRowSelect;
		const isExpanded = expandable?.isExpanded(row.original) ?? false;

		return (
			<tr
				key={row.id}
				onClick={() => handleRowClick(row.original)}
				role="row"
				aria-selected={isSelected ? 'true' : undefined}
				className={cn(
					'border-b border-(--workspace-border) last:border-0',
					'transition-colors duration-(--duration-fast)',
					'hover:bg-(--list-row-hover)',
					isSelected && 'bg-(--list-row-selected) border-l-[3px] border-l-(--accent-500)',
					isClickable && 'cursor-pointer'
				)}
			>
				{/* Optional expand toggle cell */}
				{hasExpandCol && (
					<td className="w-9 px-2 py-(--list-cell-py)">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								expandable!.onToggle(row.original);
							}}
							aria-expanded={isExpanded}
							aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
							className={cn(
								'inline-flex items-center justify-center',
								'h-6 w-6 rounded-sm',
								'hover:bg-(--workspace-bg-muted)',
								'transition-transform duration-(--duration-fast)'
							)}
						>
							<ChevronRight
								className={cn(
									'h-4 w-4 transition-transform duration-(--duration-fast)',
									isExpanded && 'rotate-90'
								)}
								aria-hidden="true"
							/>
						</button>
					</td>
				)}

				{/* Data cells */}
				{leafHeaders.map((header, colIndex) => renderDataCell(row, rowIndex, colIndex, header.id))}

				{/* Optional actions cell */}
				{hasActionsCol && (
					<td className="px-2 py-(--list-cell-py) text-center" onClick={(e) => e.stopPropagation()}>
						{actionsColumn.render(row.original)}
					</td>
				)}
			</tr>
		);
	};

	const renderExpandedRow = (row: (typeof rows)[number]) => {
		if (!expandable || !expandable.isExpanded(row.original)) return null;

		return (
			<tr key={`${row.id}-expanded`}>
				<td colSpan={totalColSpan}>{expandable.renderExpanded(row.original)}</td>
			</tr>
		);
	};

	const renderGroupHeader = (groupKey: string) => {
		if (!expandable) return null;

		const label = expandable.groupLabel?.(groupKey) ?? groupKey;
		const count = expandable.groupCount?.(groupKey);
		// Check if any row in the group is expanded to determine group chevron state
		const isGroupExpanded = rows.some(
			(row) =>
				expandable.groupKey?.(row.original) === groupKey && expandable.isExpanded(row.original)
		);

		return (
			<tr
				key={`group-${groupKey}`}
				onClick={() => {
					// Toggle all rows in the group via the first row
					const firstRow = rows.find((row) => expandable.groupKey?.(row.original) === groupKey);
					if (firstRow) expandable.onToggle(firstRow.original);
				}}
				className={cn(
					'bg-(--workspace-bg-muted) hover:bg-(--workspace-bg-subtle)',
					'transition-colors cursor-pointer select-none'
				)}
			>
				<td colSpan={totalColSpan} className="px-(--list-cell-px) py-(--list-cell-py)">
					<span className="inline-flex items-center gap-2">
						<ChevronRight
							className={cn(
								'h-4 w-4 transition-transform duration-(--duration-fast)',
								isGroupExpanded && 'rotate-90'
							)}
							aria-hidden="true"
						/>
						<span className="font-semibold text-(--text-primary)">{label}</span>
						{count != null && (
							<span
								className={cn(
									'inline-flex rounded-full',
									'bg-(--accent-50) px-2 py-0.5',
									'text-(--text-xs) font-medium text-(--accent-700)'
								)}
							>
								{count}
							</span>
						)}
					</span>
				</td>
			</tr>
		);
	};

	const renderBody = () => {
		if (rows.length === 0) {
			return (
				<tr>
					<td colSpan={totalColSpan} className="px-4 py-12 text-center">
						{emptyState ?? (
							<p className="text-(--text-sm) text-(--text-muted)">No data available</p>
						)}
					</td>
				</tr>
			);
		}

		// Grouped rendering with collapsible support
		if (groupedRows) {
			return groupedRows.flatMap((group) => {
				const elements: ReactNode[] = [];
				elements.push(renderGroupHeader(group.key));

				// Only render data rows if the group is expanded
				const isGroupExpanded = rows.some(
					(row) =>
						expandable?.groupKey?.(row.original) === group.key &&
						expandable?.isExpanded(row.original)
				);

				if (isGroupExpanded) {
					group.rowIndices.forEach((rowIndex) => {
						const row = rows[rowIndex];
						if (row) {
							elements.push(renderDataRow(row, rowIndex));
							elements.push(renderExpandedRow(row));
						}
					});
				}

				return elements;
			});
		}

		// Flat rendering
		return rows.flatMap((row, rowIndex) => [renderDataRow(row, rowIndex), renderExpandedRow(row)]);
	};

	const renderPagination = () => {
		if (!pagination || !paginationInfo) return null;

		const { start, end, total, totalPages, page } = paginationInfo;
		const hasPrev = page > 1;
		const hasNext = page < totalPages;

		return (
			<div
				className={cn(
					'border-t border-(--workspace-border)',
					'px-(--list-cell-px) py-2',
					'flex items-center justify-between',
					'text-(--text-xs) text-(--text-muted)'
				)}
			>
				<span>
					Showing {start}-{end} of {total}
				</span>
				<div className="flex gap-1">
					<button
						type="button"
						disabled={!hasPrev}
						onClick={() => pagination.onPageChange(page - 1)}
						className={cn(
							'rounded-md border border-(--workspace-border) px-3 py-1',
							'text-(--text-xs) font-medium',
							'transition-colors duration-(--duration-fast)',
							hasPrev
								? 'hover:bg-(--workspace-bg-muted) text-(--text-primary)'
								: 'opacity-50 cursor-not-allowed text-(--text-muted)'
						)}
					>
						Previous
					</button>
					<button
						type="button"
						disabled={!hasNext}
						onClick={() => pagination.onPageChange(page + 1)}
						className={cn(
							'rounded-md border border-(--workspace-border) px-3 py-1',
							'text-(--text-xs) font-medium',
							'transition-colors duration-(--duration-fast)',
							hasNext
								? 'hover:bg-(--workspace-bg-muted) text-(--text-primary)'
								: 'opacity-50 cursor-not-allowed text-(--text-muted)'
						)}
					>
						Next
					</button>
				</div>
			</div>
		);
	};

	// ── Main render ─────────────────────────────────────────────────────

	return (
		<div
			className={cn(
				'rounded-(--list-border-radius) border border-(--workspace-border)',
				'bg-(--workspace-bg-card) shadow-(--shadow-xs) overflow-hidden',
				className
			)}
		>
			<div className="overflow-x-auto">
				<table
					ref={tableRef}
					role="table"
					aria-label={ariaLabel}
					onKeyDown={keyboardNavigation ? keyboard.handlers.onKeyDown : undefined}
					onFocus={keyboardNavigation ? handleTableFocus : undefined}
					tabIndex={keyboardNavigation ? 0 : undefined}
					className="w-full text-left text-(--text-sm)"
				>
					<thead>{renderHeaderRow()}</thead>
					<tbody>{renderBody()}</tbody>
				</table>
			</div>
			{renderPagination()}
		</div>
	);
}
