import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Header, Table } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { GridSkeleton } from './grid-skeleton';

interface BandGrouping<T> {
	getBand: (row: T) => string;
	bandLabels: Record<string, string>;
	bandStyles: Record<string, { color: string; bg: string }>;
	collapsible?: boolean;
	footerBuilder?: (rows: T[], band: string) => FooterRow | null;
}

interface FooterRow {
	label: string;
	type: 'subtotal' | 'grandtotal';
	values: Record<string, ReactNode>;
}

interface ActiveCell {
	rowIndex: number;
	colIndex: number;
}

export interface PlanningGridProps<T> {
	table: Table<T>;
	variant?: 'default' | 'compact';
	isLoading?: boolean;
	bandGrouping?: BandGrouping<T>;
	pinnedColumns?: string[];
	numericColumns?: string[];
	editableColumns?: string[];
	footerRows?: FooterRow[];
	keyboardNavigation?: boolean;
	rowAnimation?: boolean;
	onCellEdit?: (rowIndex: number, columnId: string, value: number) => void;
	onActiveRowChange?: (rowIndex: number) => void;
	onRowSelect?: (rowData: T) => void;
	selectedRowPredicate?: (row: T) => boolean;
	getRowClassName?: (row: T) => string | undefined;
	className?: string;
	ariaLabel?: string;
}

function isPinned(columnId: string, pinnedColumns?: string[]): boolean {
	return pinnedColumns?.includes(columnId) ?? false;
}

function isLastPinned(columnId: string, pinnedColumns?: string[]): boolean {
	if (!pinnedColumns?.length) return false;
	return pinnedColumns[pinnedColumns.length - 1] === columnId;
}

function isNumeric(columnId: string, numericColumns?: string[]): boolean {
	return numericColumns?.includes(columnId) ?? false;
}

function ResizeHandle<T>({ header }: { header: Header<T, unknown> }) {
	return (
		<div
			onMouseDown={header.getResizeHandler()}
			onTouchStart={header.getResizeHandler()}
			role="separator"
			aria-orientation="vertical"
			className={cn(
				'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize',
				'opacity-0 hover:opacity-100 transition-opacity',
				'bg-(--grid-resize-handle)'
			)}
		/>
	);
}

export function PlanningGrid<T>({
	table,
	variant = 'default',
	isLoading = false,
	bandGrouping,
	pinnedColumns,
	numericColumns,
	editableColumns,
	footerRows,
	keyboardNavigation = true,
	rowAnimation = true,
	onCellEdit: _onCellEdit,
	onActiveRowChange,
	onRowSelect,
	selectedRowPredicate,
	getRowClassName,
	className,
	ariaLabel,
}: PlanningGridProps<T>) {
	const isCompact = variant === 'compact';
	const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
	const [collapsedBands, setCollapsedBands] = useState<Set<string>>(new Set());
	const tableRef = useRef<HTMLTableElement>(null);

	const cols = table.getAllColumns().length;
	const rows = table.getRowModel().rows;
	const headerGroups = table.getHeaderGroups();
	const leafHeaders = useMemo(
		() => headerGroups[headerGroups.length - 1]?.headers ?? [],
		[headerGroups]
	);
	const isEditable = (editableColumns?.length ?? 0) > 0;
	const tableRole = isEditable ? 'grid' : 'table';
	const cellRole = isEditable ? 'gridcell' : 'cell';

	// Build band groups when bandGrouping is provided
	const bandedRows = useMemo(() => {
		if (!bandGrouping) return null;
		const groups: { band: string; rowIndices: number[] }[] = [];
		let currentBand: string | null = null;
		rows.forEach((row, i) => {
			const band = bandGrouping.getBand(row.original);
			if (band !== currentBand) {
				groups.push({ band, rowIndices: [i] });
				currentBand = band;
			} else {
				const last = groups[groups.length - 1];
				if (last) last.rowIndices.push(i);
			}
		});
		return groups;
	}, [bandGrouping, rows]);

	const toggleBand = useCallback((band: string) => {
		setCollapsedBands((prev) => {
			const next = new Set(prev);
			if (next.has(band)) {
				next.delete(band);
			} else {
				next.add(band);
			}
			return next;
		});
	}, []);

	// Notify on active row change
	useEffect(() => {
		if (activeCell && onActiveRowChange) {
			onActiveRowChange(activeCell.rowIndex);
		}
	}, [activeCell, onActiveRowChange]);

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!keyboardNavigation || !activeCell) return;

			const maxRow = rows.length - 1;
			const maxCol = cols - 1;

			const move = (rowDelta: number, colDelta: number) => {
				e.preventDefault();
				setActiveCell((prev) => {
					if (!prev) return prev;
					return {
						rowIndex: Math.max(0, Math.min(maxRow, prev.rowIndex + rowDelta)),
						colIndex: Math.max(0, Math.min(maxCol, prev.colIndex + colDelta)),
					};
				});
			};

			switch (e.key) {
				case 'ArrowUp':
					move(-1, 0);
					break;
				case 'ArrowDown':
					move(1, 0);
					break;
				case 'ArrowLeft':
					if (!(e.target instanceof HTMLInputElement)) move(0, -1);
					break;
				case 'ArrowRight':
					if (!(e.target instanceof HTMLInputElement)) move(0, 1);
					break;
				case 'Tab': {
					if (!editableColumns?.length) break;
					e.preventDefault();
					const dir = e.shiftKey ? -1 : 1;
					const allHeaders = leafHeaders;
					let { colIndex, rowIndex } = activeCell;
					// Find next editable cell
					let steps = 0;
					do {
						colIndex += dir;
						if (colIndex > maxCol) {
							colIndex = 0;
							rowIndex = Math.min(maxRow, rowIndex + 1);
						} else if (colIndex < 0) {
							colIndex = maxCol;
							rowIndex = Math.max(0, rowIndex - 1);
						}
						steps++;
					} while (
						steps <= cols * rows.length &&
						!editableColumns.includes(allHeaders[colIndex]?.id ?? '')
					);
					setActiveCell({ rowIndex, colIndex });
					break;
				}
				case 'Enter': {
					if (onRowSelect && activeCell) {
						const row = rows[activeCell.rowIndex];
						if (row) onRowSelect(row.original);
					}
					break;
				}
				case 'Escape':
					setActiveCell(null);
					break;
			}
		},
		[keyboardNavigation, activeCell, rows, cols, editableColumns, leafHeaders, onRowSelect]
	);

	const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
		setActiveCell({ rowIndex, colIndex });
	}, []);

	const handleRowClick = useCallback(
		(row: (typeof rows)[number]) => {
			if (onRowSelect) {
				onRowSelect(row.original);
			}
		},
		[onRowSelect]
	);

	if (isLoading) {
		return (
			<div
				className={cn(
					'overflow-x-auto',
					'rounded-[18px] border border-(--workspace-border) bg-(--workspace-bg-card)',
					'shadow-(--shadow-card)',
					className
				)}
			>
				<table role={tableRole} aria-label={ariaLabel} className="w-full text-left">
					<tbody>
						<GridSkeleton rows={10} cols={cols} />
					</tbody>
				</table>
			</div>
		);
	}

	const renderHeaderRow = () =>
		headerGroups.map((hg) => (
			<tr key={hg.id} role="row">
				{hg.headers.map((header) => {
					const isGroupHeader = header.colSpan > 1;
					const pinned = isPinned(header.id, pinnedColumns);
					const lastPin = isLastPinned(header.id, pinnedColumns);
					const numeric = isNumeric(header.id, numericColumns);

					if (header.isPlaceholder) {
						const hasGroupSiblings = hg.headers.some((h) => h.colSpan > 1);
						return (
							<th
								key={header.id}
								colSpan={header.colSpan}
								className={cn(
									isCompact && 'border border-(--grid-compact-border)',
									isCompact && hasGroupSiblings && 'bg-(--grid-compact-group-bg)',
									isCompact && !hasGroupSiblings && 'bg-(--grid-subheader-bg)',
									pinned && 'sticky left-0 z-[1]'
								)}
							/>
						);
					}

					return (
						<th
							key={header.id}
							role="columnheader"
							colSpan={header.colSpan}
							style={{ width: isGroupHeader ? undefined : header.getSize() }}
							className={cn(
								'relative align-middle',
								'text-[11px] font-semibold uppercase tracking-[0.12em]',
								isCompact
									? 'px-(--grid-compact-cell-px) py-2 border border-(--grid-compact-border)'
									: 'px-(--grid-cell-px) py-4',
								isGroupHeader &&
									isCompact &&
									'bg-(--grid-compact-group-bg) text-(--grid-group-header-text) text-center border-b-2 border-b-(--grid-compact-group-border)',
								!isGroupHeader &&
									isCompact &&
									'bg-(--grid-subheader-bg) text-(--grid-subheader-text)',
								!isGroupHeader && !isCompact && 'text-(--text-muted)',
								!isGroupHeader && numeric && 'text-right',
								pinned && 'sticky left-0 z-[1]',
								pinned && isGroupHeader && isCompact && 'bg-(--grid-compact-group-bg)',
								pinned && !isGroupHeader && isCompact && 'bg-(--grid-subheader-bg)',
								pinned && !isCompact && 'bg-(--grid-header-bg)',
								lastPin && 'shadow-(--grid-pinned-shadow)'
							)}
						>
							{flexRender(header.column.columnDef.header, header.getContext())}
							{!isGroupHeader && header.column.getCanResize() && <ResizeHandle header={header} />}
						</th>
					);
				})}
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

		const pinned = isPinned(columnId, pinnedColumns);
		const lastPin = isLastPinned(columnId, pinnedColumns);
		const numeric = isNumeric(columnId, numericColumns);
		const isActive = activeCell?.rowIndex === rowIndex && activeCell?.colIndex === colIndex;
		const isRowSelected = selectedRowPredicate ? selectedRowPredicate(row.original) : false;
		const pinnedBackgroundClass = isRowSelected
			? 'bg-(--grid-selected-row)'
			: !isCompact && rowIndex % 2 === 1
				? 'bg-(--grid-row-stripe)'
				: 'bg-(--workspace-bg-card)';

		return (
			<td
				key={cell.id}
				role={cellRole}
				aria-selected={isActive}
				onClick={() => handleCellClick(rowIndex, colIndex)}
				style={{ width: cell.column.getSize() }}
				className={cn(
					isCompact
						? 'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py) border-b border-b-(--grid-compact-border)'
						: 'px-(--grid-cell-px) py-(--grid-cell-py)',
					'align-middle text-(--text-sm)',
					'transition-[background-color,box-shadow,transform] duration-(--duration-fast)',
					numeric &&
						'text-right font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)',
					pinned && 'sticky left-0 z-[1]',
					pinned && pinnedBackgroundClass,
					pinned && (isCompact ? 'group-hover:bg-gray-50/60' : 'group-hover:bg-(--grid-row-hover)'),
					pinned && isRowSelected && 'group-hover:bg-(--grid-selected-row)',
					lastPin && 'shadow-(--grid-pinned-shadow)',
					isActive &&
						(isCompact
							? 'ring-1 ring-(--accent-300) ring-inset'
							: 'ring-2 ring-(--accent-400) ring-inset shadow-(--shadow-glow-accent)')
				)}
			>
				{flexRender(cell.column.columnDef.cell, cell.getContext())}
			</td>
		);
	};

	const renderDataRow = (
		row: (typeof rows)[number],
		rowIndex: number,
		animationIndex: number,
		isFirstInBand: boolean
	) => {
		const isActiveRow = activeCell?.rowIndex === rowIndex;
		const isSelected = selectedRowPredicate ? selectedRowPredicate(row.original) : false;
		const headers = leafHeaders;
		const customRowClass = getRowClassName?.(row.original);

		return (
			<tr
				key={row.id}
				role="row"
				aria-selected={isSelected || undefined}
				onClick={() => handleRowClick(row)}
				className={cn(
					'group border-b border-(--workspace-border) last:border-0',
					'transition-colors duration-(--duration-fast)',
					!isCompact && rowIndex % 2 === 1 && 'bg-(--grid-row-stripe)',
					isCompact ? 'hover:bg-gray-50/60' : 'hover:bg-(--grid-row-hover)',
					isActiveRow && 'bg-(--grid-active-row)',
					isSelected && 'border-l-[3px] border-l-(--accent-500) bg-(--grid-selected-row)',
					isFirstInBand && bandGrouping && 'border-t-2 border-t-(--workspace-border-strong)',
					rowAnimation && 'animate-row-enter',
					onRowSelect && 'cursor-pointer',
					customRowClass
				)}
				style={
					rowAnimation ? { animationDelay: `${Math.min(animationIndex, 20) * 25}ms` } : undefined
				}
			>
				{headers.map((header, colIndex) => renderDataCell(row, rowIndex, colIndex, header.id))}
			</tr>
		);
	};

	const renderBandHeader = (band: string, rowCount: number) => {
		if (!bandGrouping) return null;
		const label = bandGrouping.bandLabels[band] ?? band;
		const style = bandGrouping.bandStyles[band];
		const isCollapsed = collapsedBands.has(band);

		return (
			<tr key={`band-${band}`} role="row" className="border-b border-(--workspace-border)">
				<td
					colSpan={cols}
					className={cn('px-(--grid-cell-px) py-3', 'text-(--text-xs) font-semibold')}
					style={{
						borderLeft:
							style && !isCompact
								? `var(--grid-band-accent-width) solid ${style.color}`
								: undefined,
						background: style
							? `color-mix(in srgb, ${style.bg} ${isCompact ? '50%' : '60%'}, white)`
							: undefined,
					}}
				>
					<span className="inline-flex items-center gap-2">
						{bandGrouping.collapsible && (
							<button
								type="button"
								onClick={() => toggleBand(band)}
								aria-expanded={!isCollapsed}
								aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`}
								className={cn(
									'inline-flex items-center justify-center',
									'h-5 w-5 rounded-sm',
									'hover:bg-(--workspace-bg-muted)',
									'transition-transform duration-(--duration-fast)'
								)}
							>
								<ChevronDown
									className={cn(
										'h-3.5 w-3.5 transition-transform duration-(--duration-fast)',
										isCollapsed && '-rotate-90'
									)}
									aria-hidden="true"
								/>
							</button>
						)}
						<span
							className="font-[family-name:var(--font-display)] uppercase tracking-[0.08em]"
							style={{ color: style?.color }}
						>
							{label}
						</span>
						<span
							className={cn(
								'inline-flex items-center justify-center',
								'min-w-6 rounded-full px-2 py-0.5',
								'text-[11px] font-semibold'
							)}
							style={{
								backgroundColor: style?.bg,
								color: style?.color,
							}}
						>
							{rowCount}
						</span>
					</span>
				</td>
			</tr>
		);
	};

	const renderSummaryRow = (summaryRow: FooterRow, key: string) => {
		const headers = leafHeaders;

		return (
			<tr
				key={key}
				role="row"
				className={cn(
					'border-t border-(--workspace-border)',
					summaryRow.type === 'grandtotal' &&
						'font-semibold bg-(--grid-grandtotal-bg) text-(--grid-grandtotal-text) border-t-2 border-t-(--grid-grandtotal-border-top) sticky bottom-0 z-[2]',
					summaryRow.type === 'subtotal' &&
						'bg-(--grid-subtotal-bg) text-(--grid-subtotal-text) font-semibold'
				)}
			>
				{headers.map((header, colIdx) => {
					const numeric = isNumeric(header.id, numericColumns);
					const pinned = isPinned(header.id, pinnedColumns);
					const lastPin = isLastPinned(header.id, pinnedColumns);
					const cellValue = summaryRow.values[header.id];

					return (
						<td
							key={`${key}-${header.id}`}
							role={cellRole}
							className={cn(
								isCompact
									? 'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py) border-b border-b-(--grid-compact-border)'
									: 'px-(--grid-cell-px) py-(--grid-cell-py)',
								'align-middle text-(--text-sm)',
								numeric && 'text-right font-[family-name:var(--font-mono)] tabular-nums',
								pinned && 'sticky left-0 z-[1]',
								lastPin && 'shadow-(--grid-pinned-shadow)',
								summaryRow.type === 'grandtotal' &&
									'bg-(--grid-grandtotal-bg) text-(--grid-grandtotal-text) py-3 font-bold',
								summaryRow.type === 'subtotal' &&
									'bg-(--grid-subtotal-bg) text-(--grid-subtotal-text) font-semibold',
								summaryRow.type === 'subtotal' && colIdx === 0 && 'pl-8'
							)}
						>
							{colIdx === 0 && cellValue === undefined
								? summaryRow.label
								: cellValue !== undefined
									? cellValue
									: ''}
						</td>
					);
				})}
			</tr>
		);
	};

	const renderBody = () => {
		if (rows.length === 0) {
			return (
				<tr>
					<td colSpan={cols} className="px-4 py-12 text-center">
						<p className="text-(--text-sm) text-(--text-muted)">No data available</p>
					</td>
				</tr>
			);
		}

		if (bandedRows) {
			let animIdx = 0;
			return bandedRows.flatMap((group) => {
				const isCollapsed = collapsedBands.has(group.band);
				const elements = [renderBandHeader(group.band, group.rowIndices.length)];
				if (!isCollapsed) {
					const groupRows = group.rowIndices
						.map((rowIndex) => rows[rowIndex]?.original)
						.filter(Boolean) as T[];
					group.rowIndices.forEach((rowIndex, i) => {
						const row = rows[rowIndex];
						if (row) {
							elements.push(renderDataRow(row, rowIndex, animIdx++, i === 0));
						}
					});
					const footerRow = bandGrouping?.footerBuilder?.(groupRows, group.band);
					if (footerRow) {
						elements.push(renderSummaryRow(footerRow, `band-summary-${group.band}`));
					}
				}
				return elements;
			});
		}

		return rows.map((row, i) => renderDataRow(row, i, i, false));
	};

	const renderFooter = () => {
		if (!footerRows?.length) return null;

		return (
			<tfoot>
				{footerRows.map((footerRow, index) => renderSummaryRow(footerRow, `footer-${index}`))}
			</tfoot>
		);
	};

	return (
		<div
			className={cn(
				'overflow-x-auto',
				isCompact
					? 'rounded-lg border border-(--grid-frame-border) bg-(--workspace-bg-card)'
					: 'rounded-[18px] border border-(--workspace-border) bg-(--workspace-bg-card) shadow-(--shadow-card)',
				className
			)}
		>
			<table
				ref={tableRef}
				role={tableRole}
				aria-label={ariaLabel}
				onKeyDown={handleKeyDown}
				tabIndex={keyboardNavigation ? 0 : undefined}
				className={cn(
					'w-full text-left text-(--text-sm)',
					!isCompact && 'min-w-[980px]',
					isCompact && 'border-collapse'
				)}
			>
				<thead
					className={cn(
						'sticky top-0 z-[2]',
						isCompact ? 'bg-(--grid-subheader-bg)' : 'bg-(--grid-header-bg)',
						isCompact
							? 'border-b-2 border-b-(--grid-frame-border)'
							: 'border-b-2 border-b-(--grid-header-border)',
						'backdrop-blur-sm'
					)}
				>
					{renderHeaderRow()}
				</thead>
				<tbody>{renderBody()}</tbody>
				{renderFooter()}
			</table>
		</div>
	);
}
