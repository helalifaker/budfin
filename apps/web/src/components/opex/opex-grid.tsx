import { useCallback, useMemo, useRef, useState } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import Decimal from 'decimal.js';
import { GripVertical } from 'lucide-react';
import type { OpExLineItem, OpExReorderPayload } from '@budfin/types';
import { PlanningGrid } from '../data-grid/planning-grid';
import { EditableCell } from '../data-grid/editable-cell';
import { formatMoney } from '../../lib/format-money';
import { cn } from '../../lib/cn';
import { useOpExSelectionStore } from '../../stores/opex-selection-store';

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
] as const;

const CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
	'Rent & Utilities': { color: 'var(--accent-600)', bg: 'var(--accent-50)' },
	'Building Services': { color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
	'Office & Supplies': { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	Insurance: { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
	'Professional Services': { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
	'IT & Telecom': { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
	'Other General': { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
	'School Materials': { color: 'var(--badge-maternelle)', bg: 'var(--badge-maternelle-bg)' },
	Pedagogical: { color: 'var(--accent-600)', bg: 'var(--accent-50)' },
	'Library & Subscriptions': { color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
	'Evaluation & Testing': { color: 'var(--badge-elementaire)', bg: 'var(--badge-elementaire-bg)' },
	'Activities & Projects': { color: 'var(--badge-college)', bg: 'var(--badge-college-bg)' },
};

const NON_OP_CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
	Depreciation: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
	Impairment: { color: 'var(--color-error)', bg: 'var(--color-error-bg)' },
	'Finance Income': { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
	'Finance Costs': { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

const SECTION_CATEGORY_STYLES = {
	OPERATING: CATEGORY_STYLES,
	NON_OPERATING: NON_OP_CATEGORY_STYLES,
} as const;

const SECTION_LABELS = {
	OPERATING: {
		grandTotal: 'Grand Total',
		ariaLabel: 'Operating expenses grid',
	},
	NON_OPERATING: {
		grandTotal: 'Non-Operating Total',
		ariaLabel: 'Non-operating items grid',
	},
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthlyAmount(item: OpExLineItem, month: number): string {
	const entry = item.monthlyAmounts.find((m) => m.month === month);
	return entry?.amount ?? '0';
}

function computeFyTotal(item: OpExLineItem): Decimal {
	return item.monthlyAmounts.reduce((sum, m) => sum.plus(m.amount), new Decimal(0));
}

function formatGridValue(value: string | Decimal): string {
	const d = value instanceof Decimal ? value : new Decimal(value || '0');
	if (d.isZero()) return '';
	return formatMoney(d, { compact: false });
}

function buildCategorySubtotalValues(items: OpExLineItem[]): Record<string, React.ReactNode> {
	const values: Record<string, React.ReactNode> = {};

	for (let m = 1; m <= 12; m++) {
		let monthSum = new Decimal(0);
		for (const item of items) {
			monthSum = monthSum.plus(getMonthlyAmount(item, m));
		}
		values[`m${m}`] = monthSum.isZero() ? '' : formatGridValue(monthSum);
	}

	const fyTotal = items.reduce((sum, item) => sum.plus(computeFyTotal(item)), new Decimal(0));
	values.fyTotal = fyTotal.isZero() ? '' : formatGridValue(fyTotal);

	return values;
}

// ── Types ────────────────────────────────────────────────────────────────────

export type OpExGridProps = {
	sectionType: 'OPERATING' | 'NON_OPERATING';
	lineItems: OpExLineItem[];
	monthlyTotals: string[];
	isEditable: boolean;
	onMonthlyUpdate: (lineItemId: number, month: number, amount: string) => void;
	onCommentUpdate: (lineItemId: number, comment: string) => void;
	onAnnualTotalUpdate?: (lineItemId: number, annualTotal: string) => void;
	onReorder?: ((payload: OpExReorderPayload) => void) | undefined;
};

// ── Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<OpExLineItem>();

// ── Entry mode badge config ─────────────────────────────────────────────────

type EntryModeBadge = { label: string; colorVar: string; bgVar: string };

const DEFAULT_ENTRY_MODE_BADGE: EntryModeBadge = {
	label: 'SEAS',
	colorVar: '--entry-mode-seasonal',
	bgVar: '--entry-mode-seasonal-bg',
};

const ENTRY_MODE_CONFIG: Record<string, EntryModeBadge> = {
	FLAT: { label: 'FLAT', colorVar: '--entry-mode-flat', bgVar: '--entry-mode-flat-bg' },
	SEASONAL: DEFAULT_ENTRY_MODE_BADGE,
	ANNUAL_SPREAD: {
		label: 'ANNUAL',
		colorVar: '--entry-mode-annual',
		bgVar: '--entry-mode-annual-bg',
	},
	PERCENT_OF_REVENUE: {
		label: '% REV',
		colorVar: '--entry-mode-revenue',
		bgVar: '--entry-mode-revenue-bg',
	},
};

function buildColumns(
	isEditable: boolean,
	onMonthlyChange: (lineItemId: number, month: number, value: string) => void,
	onCommentUpdate: (lineItemId: number, comment: string) => void,
	onAnnualTotalUpdate?: (lineItemId: number, annualTotal: string) => void,
	dragHandleRenderer?: (item: OpExLineItem) => React.ReactNode
) {
	return [
		...(dragHandleRenderer
			? [
					columnHelper.display({
						id: 'drag-handle',
						size: 28,
						header: () => null,
						cell: ({ row }) => dragHandleRenderer(row.original),
					}),
				]
			: []),

		columnHelper.accessor('lineItemName', {
			id: 'lineItemName',
			header: 'Line Item',
			size: 220,
			cell: ({ getValue }) => (
				<span className="font-medium text-(--text-primary)">{getValue()}</span>
			),
		}),

		columnHelper.accessor('entryMode', {
			id: 'entryMode',
			header: 'Mode',
			size: 70,
			cell: ({ getValue, row }) => {
				const mode = getValue() ?? 'SEASONAL';
				const baseCfg = ENTRY_MODE_CONFIG[mode] ?? DEFAULT_ENTRY_MODE_BADGE;

				// For PERCENT_OF_REVENUE, show the compute rate as the label if available
				const label =
					mode === 'PERCENT_OF_REVENUE' && row.original.computeRate
						? `${new Decimal(row.original.computeRate).times(100).toFixed(1)}%`
						: baseCfg.label;

				return (
					<span
						className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium"
						style={{
							color: `var(${baseCfg.colorVar})`,
							backgroundColor: `var(${baseCfg.bgVar})`,
						}}
					>
						{label}
					</span>
				);
			},
		}),

		columnHelper.group({
			id: 'monthly-group',
			header: 'Monthly Amounts',
			columns: MONTHS.map((label, index) => {
				const month = index + 1;
				return columnHelper.display({
					id: `m${month}`,
					header: label,
					size: 90,
					cell: ({ row }) => {
						const amount = getMonthlyAmount(row.original, month);
						const d = new Decimal(amount);
						const entryMode = row.original.entryMode ?? 'SEASONAL';
						const itemActiveMonths = row.original.activeMonths ?? [];
						const isInactive = itemActiveMonths.length > 0 && !itemActiveMonths.includes(month);
						const isComputed = entryMode === 'ANNUAL_SPREAD' || entryMode === 'PERCENT_OF_REVENUE';
						const isOverride =
							entryMode === 'FLAT' && (row.original.flatOverrideMonths ?? []).includes(month);

						if (isInactive) {
							return (
								<span className="block px-2 py-1 text-center text-(--cell-inactive-text)">—</span>
							);
						}

						if (isComputed) {
							return (
								<span className="block px-2 py-1 text-right font-mono tabular-nums text-(--text-muted) italic">
									{d.isZero() ? '' : formatGridValue(amount)}
								</span>
							);
						}

						if (isOverride) {
							return (
								<EditableCell
									value={d.isZero() ? '' : formatGridValue(amount)}
									onChange={(val) => {
										const parsed = val.replace(/[^\d.-]/g, '');
										onMonthlyChange(row.original.id, month, parsed === '' ? '0' : parsed);
									}}
									isReadOnly={!isEditable}
									type="number"
									className="rounded-none border-0 bg-(--cell-override-bg)"
								/>
							);
						}

						return (
							<EditableCell
								value={d.isZero() ? '' : formatGridValue(amount)}
								onChange={(val) => {
									const parsed = val.replace(/[^\d.-]/g, '');
									onMonthlyChange(row.original.id, month, parsed === '' ? '0' : parsed);
								}}
								isReadOnly={!isEditable}
								type="number"
								className="rounded-none border-0"
							/>
						);
					},
				});
			}),
		}),

		columnHelper.display({
			id: 'fyTotal',
			header: 'FY Total',
			size: 110,
			cell: ({ row }) => {
				const entryMode = row.original.entryMode ?? 'SEASONAL';
				const total = computeFyTotal(row.original);

				// ANNUAL_SPREAD: editable annual total that drives monthly distribution
				if (entryMode === 'ANNUAL_SPREAD' && onAnnualTotalUpdate) {
					return (
						<EditableCell
							value={total.isZero() ? '' : formatGridValue(total)}
							onChange={(val) => {
								const parsed = val.replace(/[^\d.-]/g, '');
								onAnnualTotalUpdate(row.original.id, parsed === '' ? '0' : parsed);
							}}
							isReadOnly={!isEditable}
							type="number"
							className="rounded-none border-0 font-semibold"
						/>
					);
				}

				return (
					<span className="font-mono text-(--text-xs) font-semibold tabular-nums text-(--text-primary)">
						{total.isZero() ? '' : formatGridValue(total)}
					</span>
				);
			},
		}),

		columnHelper.accessor('budgetV6Total', {
			id: 'v6Total',
			header: 'V6 Total',
			size: 100,
			cell: ({ getValue }) => {
				const val = getValue();
				return (
					<span className="font-mono text-(--text-xs) tabular-nums text-(--text-muted)">
						{val ? formatGridValue(val) : ''}
					</span>
				);
			},
		}),

		columnHelper.accessor('fy2025Actual', {
			id: 'fy2025',
			header: 'FY2025',
			size: 100,
			cell: ({ getValue }) => {
				const val = getValue();
				return (
					<span className="font-mono text-(--text-xs) tabular-nums text-(--text-muted)">
						{val ? formatGridValue(val) : ''}
					</span>
				);
			},
		}),

		columnHelper.accessor('fy2024Actual', {
			id: 'fy2024',
			header: 'FY2024',
			size: 100,
			cell: ({ getValue }) => {
				const val = getValue();
				return (
					<span className="font-mono text-(--text-xs) tabular-nums text-(--text-muted)">
						{val ? formatGridValue(val) : ''}
					</span>
				);
			},
		}),

		columnHelper.display({
			id: 'comment',
			header: 'Comments',
			size: 180,
			cell: ({ row }) => {
				const item = row.original;
				return (
					<EditableCell
						value={item.comment ?? ''}
						onChange={(val) => onCommentUpdate(item.id, val)}
						isReadOnly={!isEditable}
						type="text"
						className="rounded-none border-0"
					/>
				);
			},
		}),
	];
}

// ── Component ────────────────────────────────────────────────────────────────

export function OpExGrid({
	sectionType,
	lineItems,
	monthlyTotals,
	isEditable,
	onMonthlyUpdate,
	onCommentUpdate,
	onAnnualTotalUpdate,
	onReorder,
}: OpExGridProps) {
	const selectLineItem = useOpExSelectionStore((s) => s.selectLineItem);
	const selectedId = useOpExSelectionStore((s) => s.selection?.lineItem.id ?? null);

	// ── Drag-and-drop state ──────────────────────────────────────────────────
	const [dragItemId, setDragItemId] = useState<number | null>(null);
	const [dropTargetId, setDropTargetId] = useState<number | null>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);

	const dragItem = useMemo(
		() => (dragItemId !== null ? (lineItems.find((i) => i.id === dragItemId) ?? null) : null),
		[dragItemId, lineItems]
	);

	const handleDragStart = useCallback((e: React.DragEvent, item: OpExLineItem) => {
		setDragItemId(item.id);
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', String(item.id));
		// Set a lightweight drag image
		if (e.currentTarget.parentElement) {
			const row = e.currentTarget.closest('tr');
			if (row) {
				e.dataTransfer.setDragImage(row, 0, 0);
			}
		}
	}, []);

	const handleDragEnd = useCallback(() => {
		setDragItemId(null);
		setDropTargetId(null);
	}, []);

	// Resolve the target row ID from a drag event using DOM data attributes
	const resolveDropRowId = useCallback((e: React.DragEvent): number | null => {
		const target = e.target as HTMLElement;
		const cell = target.closest('td[data-grid-row-id]');
		if (!cell) return null;
		const rowId = Number(cell.getAttribute('data-grid-row-id'));
		if (Number.isNaN(rowId)) return null;
		return rowId;
	}, []);

	const handleWrapperDragOver = useCallback(
		(e: React.DragEvent) => {
			if (!dragItem) return;
			const targetId = resolveDropRowId(e);
			if (targetId === null || targetId === dragItem.id) {
				setDropTargetId(null);
				return;
			}
			// Only allow drops within the same category
			const targetItem = lineItems.find((i) => i.id === targetId);
			if (!targetItem || targetItem.ifrsCategory !== dragItem.ifrsCategory) {
				e.dataTransfer.dropEffect = 'none';
				setDropTargetId(null);
				return;
			}
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
			setDropTargetId(targetId);
		},
		[dragItem, lineItems, resolveDropRowId]
	);

	const handleWrapperDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			if (!dragItem || !onReorder) {
				setDragItemId(null);
				setDropTargetId(null);
				return;
			}

			const targetId = resolveDropRowId(e);
			if (targetId === null || targetId === dragItem.id) {
				setDragItemId(null);
				setDropTargetId(null);
				return;
			}

			const targetItem = lineItems.find((i) => i.id === targetId);
			if (!targetItem || targetItem.ifrsCategory !== dragItem.ifrsCategory) {
				setDragItemId(null);
				setDropTargetId(null);
				return;
			}

			// Compute new display orders for all items within this category
			const categoryItems = lineItems
				.filter((i) => i.ifrsCategory === dragItem.ifrsCategory)
				.sort((a, b) => a.displayOrder - b.displayOrder);

			// Remove drag item, then insert at target position
			const withoutDrag = categoryItems.filter((i) => i.id !== dragItem.id);
			const targetIndex = withoutDrag.findIndex((i) => i.id === targetId);
			if (targetIndex === -1) {
				setDragItemId(null);
				setDropTargetId(null);
				return;
			}

			// Insert after the target if we were below it, before if above
			const dragOrigIndex = categoryItems.findIndex((i) => i.id === dragItem.id);
			const targetOrigIndex = categoryItems.findIndex((i) => i.id === targetId);
			const insertAt = dragOrigIndex < targetOrigIndex ? targetIndex + 1 : targetIndex;

			const reordered = [
				...withoutDrag.slice(0, insertAt),
				dragItem,
				...withoutDrag.slice(insertAt),
			];

			const moves = reordered.map((item, idx) => ({
				lineItemId: item.id,
				ifrsCategory: item.ifrsCategory,
				displayOrder: idx,
			}));

			onReorder({ moves });
			setDragItemId(null);
			setDropTargetId(null);
		},
		[dragItem, lineItems, onReorder, resolveDropRowId]
	);

	const dragHandleRenderer = useMemo(() => {
		if (!isEditable || !onReorder) return undefined;
		return (item: OpExLineItem) => (
			<span
				className={cn(
					'flex cursor-grab items-center justify-center',
					'text-(--text-muted) hover:text-(--text-secondary)',
					'active:cursor-grabbing'
				)}
				draggable
				onDragStart={(e) => handleDragStart(e, item)}
				onDragEnd={handleDragEnd}
				aria-label={`Drag to reorder ${item.lineItemName}`}
				role="button"
				tabIndex={0}
			>
				<GripVertical size={14} aria-hidden="true" />
			</span>
		);
	}, [isEditable, onReorder, handleDragStart, handleDragEnd]);

	const handleMonthlyChange = useCallback(
		(lineItemId: number, month: number, value: string) => {
			onMonthlyUpdate(lineItemId, month, value);
		},
		[onMonthlyUpdate]
	);

	const columns = useMemo(
		() =>
			buildColumns(
				isEditable,
				handleMonthlyChange,
				onCommentUpdate,
				onAnnualTotalUpdate,
				dragHandleRenderer
			),
		[isEditable, handleMonthlyChange, onCommentUpdate, onAnnualTotalUpdate, dragHandleRenderer]
	);

	const table = useReactTable({
		data: lineItems,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const monthColumnIds = useMemo(() => MONTHS.map((_, i) => `m${i + 1}`), []);

	const editableColumnIds = useMemo(
		() => (isEditable ? [...monthColumnIds, 'comment'] : []),
		[isEditable, monthColumnIds]
	);

	const numericColumnIds = useMemo(
		() => [...monthColumnIds, 'fyTotal', 'v6Total', 'fy2025', 'fy2024'],
		[monthColumnIds]
	);

	const bandFooterBuilder = useCallback(
		(bandItems: OpExLineItem[]) => ({
			label: `${bandItems[0]?.ifrsCategory ?? 'Category'} Subtotal`,
			type: 'subtotal' as const,
			values: buildCategorySubtotalValues(bandItems),
		}),
		[]
	);

	const categoryStyles = useMemo(() => SECTION_CATEGORY_STYLES[sectionType], [sectionType]);

	const categoryLabels = useMemo(
		() => Object.fromEntries(Object.keys(categoryStyles).map((k) => [k, k])),
		[categoryStyles]
	);

	const grandTotalRow = useMemo(() => {
		if (lineItems.length === 0) return [];

		const values: Record<string, React.ReactNode> = {};
		for (let m = 1; m <= 12; m++) {
			const val = monthlyTotals[m - 1];
			const d = val ? new Decimal(val) : new Decimal(0);
			values[`m${m}`] = d.isZero() ? '' : formatGridValue(d);
		}

		const grandTotal = lineItems.reduce(
			(sum, item) => sum.plus(computeFyTotal(item)),
			new Decimal(0)
		);
		values.fyTotal = grandTotal.isZero() ? '' : formatGridValue(grandTotal);

		return [
			{
				label: SECTION_LABELS[sectionType].grandTotal,
				type: 'grandtotal' as const,
				values,
			},
		];
	}, [lineItems, monthlyTotals, sectionType]);

	// Row class name callback for drag visual feedback
	const getRowClassName = useCallback(
		(item: OpExLineItem) => {
			if (!dragItemId) return undefined;
			if (item.id === dragItemId) return 'opacity-40';
			if (item.id === dropTargetId) {
				// Only highlight if same category as the dragged item
				if (dragItem && item.ifrsCategory === dragItem.ifrsCategory) {
					return 'ring-2 ring-inset ring-(--accent-400) bg-(--accent-50)/30';
				}
			}
			// Show not-allowed cursor for items in a different category
			if (dragItem && item.ifrsCategory !== dragItem.ifrsCategory) {
				return 'cursor-not-allowed opacity-60';
			}
			return undefined;
		},
		[dragItemId, dropTargetId, dragItem]
	);

	const pinnedCols = useMemo(() => {
		const base = ['lineItemName', 'entryMode'];
		if (dragHandleRenderer) return ['drag-handle', ...base];
		return base;
	}, [dragHandleRenderer]);

	const isDragging = dragItemId !== null;

	return (
		<div
			ref={wrapperRef}
			className="h-full"
			onDragOver={isDragging ? handleWrapperDragOver : undefined}
			onDrop={isDragging ? handleWrapperDrop : undefined}
		>
			<PlanningGrid
				table={table}
				variant="compact"
				ariaLabel={SECTION_LABELS[sectionType].ariaLabel}
				rangeSelection
				clipboardEnabled
				pinnedColumns={pinnedCols}
				numericColumns={numericColumnIds}
				editableColumns={editableColumnIds}
				bandGrouping={{
					getBand: (item) => item.ifrsCategory,
					bandLabels: categoryLabels,
					bandStyles: categoryStyles,
					collapsible: true,
					footerBuilder: bandFooterBuilder,
				}}
				footerRows={grandTotalRow}
				onRowSelect={selectLineItem}
				selectedRowPredicate={(item) => item.id === selectedId}
				getRowClassName={getRowClassName}
				forceGridRole
			/>
		</div>
	);
}
