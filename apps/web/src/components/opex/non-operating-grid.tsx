import { useCallback, useMemo } from 'react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import Decimal from 'decimal.js';
import type { OpExLineItem } from '@budfin/types';
import { PlanningGrid } from '../data-grid/planning-grid';
import { EditableCell } from '../data-grid/editable-cell';
import { formatMoney } from '../../lib/format-money';
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

const NON_OP_CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
	Depreciation: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
	Impairment: { color: 'var(--color-error)', bg: 'var(--color-error-bg)' },
	'Finance Income': { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
	'Finance Costs': { color: 'var(--badge-lycee)', bg: 'var(--badge-lycee-bg)' },
};

const NON_OP_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
	Object.keys(NON_OP_CATEGORY_STYLES).map((k) => [k, k])
);

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

export type NonOperatingGridProps = {
	lineItems: OpExLineItem[];
	monthlyTotals: string[];
	isEditable: boolean;
	onMonthlyUpdate: (lineItemId: number, month: number, amount: string) => void;
	onCommentUpdate: (lineItemId: number, comment: string) => void;
};

// ── Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<OpExLineItem>();

function buildColumns(
	isEditable: boolean,
	onMonthlyChange: (lineItemId: number, month: number, value: string) => void,
	onCommentUpdate: (lineItemId: number, comment: string) => void
) {
	return [
		columnHelper.accessor('lineItemName', {
			id: 'lineItemName',
			header: 'Line Item',
			size: 220,
			cell: ({ getValue }) => (
				<span className="font-medium text-(--text-primary)">{getValue()}</span>
			),
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
				const total = computeFyTotal(row.original);
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

export function NonOperatingGrid({
	lineItems,
	monthlyTotals,
	isEditable,
	onMonthlyUpdate,
	onCommentUpdate,
}: NonOperatingGridProps) {
	const selectLineItem = useOpExSelectionStore((s) => s.selectLineItem);
	const selectedId = useOpExSelectionStore((s) => s.selection?.lineItem.id ?? null);

	const handleMonthlyChange = useCallback(
		(lineItemId: number, month: number, value: string) => {
			onMonthlyUpdate(lineItemId, month, value);
		},
		[onMonthlyUpdate]
	);

	const columns = useMemo(
		() => buildColumns(isEditable, handleMonthlyChange, onCommentUpdate),
		[isEditable, handleMonthlyChange, onCommentUpdate]
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
				label: 'Non-Operating Total',
				type: 'grandtotal' as const,
				values,
			},
		];
	}, [lineItems, monthlyTotals]);

	return (
		<PlanningGrid
			table={table}
			variant="compact"
			ariaLabel="Non-operating items grid"
			rangeSelection
			clipboardEnabled
			pinnedColumns={['lineItemName']}
			numericColumns={numericColumnIds}
			editableColumns={editableColumnIds}
			bandGrouping={{
				getBand: (item) => item.ifrsCategory,
				bandLabels: NON_OP_CATEGORY_LABELS,
				bandStyles: NON_OP_CATEGORY_STYLES,
				collapsible: true,
				footerBuilder: bandFooterBuilder,
			}}
			footerRows={grandTotalRow}
			onRowSelect={selectLineItem}
			selectedRowPredicate={(item) => item.id === selectedId}
			forceGridRole
		/>
	);
}
