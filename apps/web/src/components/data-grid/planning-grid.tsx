import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Header, Table } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { ChevronDown } from 'lucide-react';
import { useGridKeyboard } from '../../hooks/use-grid-keyboard';
import { cn } from '../../lib/cn';
import { getBandClasses } from './band-styles';
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
	forceGridRole?: boolean;
	className?: string;
	ariaLabel?: string;
	rangeSelection?: boolean;
	clipboardEnabled?: boolean;
	getCellValue?: (rowIndex: number, colId: string) => string;
	onPaste?: (startRow: number, startCol: number, data: string[][]) => void;
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

const ROW_ENTER_DELAY_CLASSES = [
	'row-enter-delay-0',
	'row-enter-delay-25',
	'row-enter-delay-50',
	'row-enter-delay-75',
	'row-enter-delay-100',
	'row-enter-delay-125',
	'row-enter-delay-150',
	'row-enter-delay-175',
	'row-enter-delay-200',
	'row-enter-delay-225',
	'row-enter-delay-250',
	'row-enter-delay-275',
	'row-enter-delay-300',
	'row-enter-delay-325',
	'row-enter-delay-350',
	'row-enter-delay-375',
	'row-enter-delay-400',
	'row-enter-delay-425',
	'row-enter-delay-450',
	'row-enter-delay-475',
	'row-enter-delay-500',
];

function getRowEnterDelayClass(animationIndex: number): string {
	return (
		ROW_ENTER_DELAY_CLASSES[Math.min(animationIndex, ROW_ENTER_DELAY_CLASSES.length - 1)] ??
		ROW_ENTER_DELAY_CLASSES[0] ??
		''
	);
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
	forceGridRole = false,
	className,
	ariaLabel,
	rangeSelection,
	clipboardEnabled,
	getCellValue,
	onPaste,
}: PlanningGridProps<T>) {
	const isCompact = variant === 'compact';
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
	const tableRole = isEditable || forceGridRole ? 'grid' : 'table';
	const cellRole = isEditable || forceGridRole ? 'gridcell' : 'cell';

	const columnIds = useMemo(() => leafHeaders.map((h) => h.id), [leafHeaders]);

	const keyboard = useGridKeyboard({
		tableRef,
		rowCount: rows.length,
		colCount: cols,
		enabled: keyboardNavigation,
		editableColumns,
		columnIds,
		rangeSelection,
		clipboardEnabled,
		getCellValue,
		onPaste,
		onRowSelect: onRowSelect
			? (rowIndex: number) => {
					const row = rows[rowIndex];
					if (row) onRowSelect(row.original);
				}
			: undefined,
		onActiveRowChange,
	});

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

	const handleTableFocus = useCallback(() => {
		if (!keyboardNavigation || keyboard.activeCell || rows.length === 0 || cols === 0) {
			return;
		}
		keyboard.setActiveCell({ rowIndex: 0, colIndex: 0, colId: columnIds[0] ?? '' });
	}, [keyboard, cols, keyboardNavigation, rows.length, columnIds]);

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
				<table aria-label={ariaLabel} className="w-full text-left">
					<tbody>
						<GridSkeleton rows={10} cols={cols} />
					</tbody>
				</table>
			</div>
		);
	}

	const renderHeaderRow = () =>
		headerGroups.map((hg) => (
			<tr key={hg.id}>
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
									pinned && 'sticky left-0 z-1'
								)}
							/>
						);
					}

					return (
						<th
							key={header.id}
							colSpan={header.colSpan}
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
								pinned && 'sticky left-0 z-1',
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
		const isActive = keyboard.isCellActive(rowIndex, colIndex);
		const isInRange = keyboard.isCellInRange(rowIndex, colIndex);
		const isRowSelected = selectedRowPredicate ? selectedRowPredicate(row.original) : false;
		const pinnedBackgroundClass = isRowSelected
			? 'bg-(--grid-selected-row)'
			: !isCompact && rowIndex % 2 === 1
				? 'bg-(--grid-row-stripe)'
				: 'bg-(--workspace-bg-card)';

		return (
			<td
				key={cell.id}
				onClick={(e) => keyboard.handlers.onCellClick(rowIndex, colIndex, e)}
				onDoubleClick={() => keyboard.handlers.onCellDoubleClick(rowIndex, colIndex)}
				role={cellRole}
				data-grid-row-id={String((row.original as { id?: unknown }).id ?? row.id)}
				data-row-index={rowIndex}
				data-col-index={colIndex}
				tabIndex={keyboardNavigation ? (isActive ? 0 : -1) : undefined}
				className={cn(
					isCompact
						? 'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py) border-b border-b-(--grid-compact-border)'
						: 'px-(--grid-cell-px) py-(--grid-cell-py)',
					'align-middle text-token-sm',
					'transition-[background-color,box-shadow,transform] duration-(--duration-fast)',
					numeric && 'text-right font-mono tabular-nums text-(--text-primary)',
					pinned && 'sticky left-0 z-1',
					pinned && pinnedBackgroundClass,
					pinned &&
						(isCompact
							? 'group-hover:bg-(--workspace-bg-subtle)/60'
							: 'group-hover:bg-(--grid-row-hover)'),
					pinned && isRowSelected && 'group-hover:bg-(--grid-selected-row)',
					lastPin && 'shadow-(--grid-pinned-shadow)',
					isInRange && 'bg-(--grid-range-bg)',
					isActive &&
						(isCompact
							? 'ring-(length:--grid-focus-ring-width) ring-(--grid-focus-ring) ring-inset'
							: 'ring-(length:--grid-focus-ring-width) ring-(--grid-focus-ring) ring-inset shadow-(--shadow-glow-accent)')
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
		const isActiveRow = keyboard.activeCell?.rowIndex === rowIndex;
		const isSelected = selectedRowPredicate ? selectedRowPredicate(row.original) : false;
		const headers = leafHeaders;
		const customRowClass = getRowClassName?.(row.original);

		return (
			<tr
				key={row.id}
				onClick={() => handleRowClick(row)}
				role="row"
				aria-selected={isSelected ? 'true' : undefined}
				className={cn(
					'group border-b border-(--workspace-border) last:border-0',
					'transition-colors duration-(--duration-fast)',
					!isCompact && rowIndex % 2 === 1 && 'bg-(--grid-row-stripe)',
					isCompact ? 'hover:bg-(--workspace-bg-subtle)/60' : 'hover:bg-(--grid-row-hover)',
					isActiveRow && 'bg-(--grid-active-row)',
					isSelected && 'border-l-[3px] border-l-(--accent-500) bg-(--grid-selected-row)',
					isFirstInBand && bandGrouping && 'border-t-2 border-t-(--workspace-border-strong)',
					rowAnimation && 'animate-row-enter',
					rowAnimation && getRowEnterDelayClass(animationIndex),
					onRowSelect && 'cursor-pointer',
					customRowClass
				)}
			>
				{headers.map((header, colIndex) => renderDataCell(row, rowIndex, colIndex, header.id))}
			</tr>
		);
	};

	const renderBandHeader = (band: string, rowCount: number) => {
		if (!bandGrouping) return null;
		const label = bandGrouping.bandLabels[band] ?? band;
		const style = bandGrouping.bandStyles[band];
		const { backgroundClass, borderClass, textClass } = getBandClasses(style, isCompact);
		const isCollapsed = collapsedBands.has(band);

		return (
			<tr key={`band-${band}`} className="border-b border-(--workspace-border)">
				<td
					colSpan={cols}
					className={cn(
						'px-(--grid-cell-px) py-3 text-token-xs font-semibold',
						backgroundClass,
						borderClass
					)}
				>
					<span className="inline-flex items-center gap-2">
						{bandGrouping.collapsible &&
							(isCollapsed ? (
								<button
									type="button"
									onClick={() => toggleBand(band)}
									aria-expanded="false"
									aria-label={`Expand ${label}`}
									className={cn(
										'inline-flex items-center justify-center',
										'h-5 w-5 rounded-sm',
										'hover:bg-(--workspace-bg-muted)',
										'transition-transform duration-(--duration-fast)'
									)}
								>
									<ChevronDown
										className="h-3.5 w-3.5 -rotate-90 transition-transform duration-(--duration-fast)"
										aria-hidden="true"
									/>
								</button>
							) : (
								<button
									type="button"
									onClick={() => toggleBand(band)}
									aria-expanded="true"
									aria-label={`Collapse ${label}`}
									className={cn(
										'inline-flex items-center justify-center',
										'h-5 w-5 rounded-sm',
										'hover:bg-(--workspace-bg-muted)',
										'transition-transform duration-(--duration-fast)'
									)}
								>
									<ChevronDown
										className="h-3.5 w-3.5 transition-transform duration-(--duration-fast)"
										aria-hidden="true"
									/>
								</button>
							))}
						<span
							className={cn(
								'font-(family-name:--font-display) uppercase tracking-[0.08em]',
								textClass
							)}
						>
							{label}
						</span>
						<span
							className={cn(
								'inline-flex items-center justify-center',
								'min-w-6 rounded-full px-2 py-0.5',
								'text-[11px] font-semibold',
								backgroundClass,
								textClass
							)}
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
				className={cn(
					'border-t border-(--workspace-border)',
					summaryRow.type === 'grandtotal' &&
						'font-semibold bg-(--grid-grandtotal-bg) text-(--grid-grandtotal-text) border-t-2 border-t-(--grid-grandtotal-border-top) sticky bottom-0 z-2',
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
							className={cn(
								isCompact
									? 'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py) border-b border-b-(--grid-compact-border)'
									: 'px-(--grid-cell-px) py-(--grid-cell-py)',
								'align-middle text-token-sm',
								numeric && 'text-right font-mono tabular-nums',
								pinned && 'sticky left-0 z-1',
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
						<p className="text-token-sm text-(--text-muted)">No data available</p>
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
				'h-full overflow-auto',
				isCompact
					? 'rounded-lg border border-(--grid-frame-border) bg-(--workspace-bg-card)'
					: 'rounded-[18px] border border-(--workspace-border) bg-(--workspace-bg-card) shadow-(--shadow-card)',
				className
			)}
		>
			<table
				ref={tableRef}
				role={tableRole}
				aria-rowcount={tableRole === 'grid' ? rows.length : undefined}
				aria-colcount={tableRole === 'grid' ? cols : undefined}
				aria-label={ariaLabel}
				onKeyDown={keyboard.handlers.onKeyDown}
				onFocus={handleTableFocus}
				tabIndex={keyboardNavigation ? 0 : undefined}
				className={cn(
					'w-full text-left text-token-sm',
					!isCompact && 'min-w-245',
					isCompact && 'border-collapse'
				)}
			>
				<colgroup>
					{leafHeaders.map((header) => (
						<col key={header.id} width={header.getSize()} />
					))}
				</colgroup>
				<thead
					className={cn(
						'sticky top-0 z-2',
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
