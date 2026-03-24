import { useCallback, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import type { OpExLineItem } from '@budfin/types';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { EditableCell } from '../data-grid/editable-cell';

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

// ── Types ────────────────────────────────────────────────────────────────────

export type NonOperatingGridProps = {
	lineItems: OpExLineItem[];
	monthlyTotals: string[];
	isEditable: boolean;
	onMonthlyUpdate: (lineItemId: number, month: number, amount: string) => void;
	onCommentUpdate: (lineItemId: number, comment: string) => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthlyAmount(item: OpExLineItem, month: number): string {
	const entry = item.monthlyAmounts.find((m) => m.month === month);
	return entry?.amount ?? '0';
}

function computeFyTotal(item: OpExLineItem): Decimal {
	return item.monthlyAmounts.reduce((sum, m) => sum.plus(m.amount), new Decimal(0));
}

function formatCompact(value: string | Decimal): string {
	const d = value instanceof Decimal ? value : new Decimal(value || '0');
	if (d.isZero()) return '';
	return formatMoney(d, { compact: false });
}

function formatFull(value: string | Decimal): string {
	const d = value instanceof Decimal ? value : new Decimal(value || '0');
	if (d.isZero()) return '';
	return new Intl.NumberFormat('fr-FR', {
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
	}).format(d.toNumber());
}

// ── Component ────────────────────────────────────────────────────────────────

export function NonOperatingGrid({
	lineItems,
	monthlyTotals,
	isEditable,
	onMonthlyUpdate,
	onCommentUpdate,
}: NonOperatingGridProps) {
	const [editingComment, setEditingComment] = useState<number | null>(null);
	const [commentDraft, setCommentDraft] = useState('');
	const commentInputRef = useRef<HTMLInputElement>(null);

	const grandTotal = useMemo(() => {
		return lineItems.reduce((sum, item) => sum.plus(computeFyTotal(item)), new Decimal(0));
	}, [lineItems]);

	const monthlyGrandTotals = useMemo(() => {
		const totals: Decimal[] = [];
		for (let m = 0; m < 12; m++) {
			const val = monthlyTotals[m];
			totals.push(val ? new Decimal(val) : new Decimal(0));
		}
		return totals;
	}, [monthlyTotals]);

	const handleMonthlyChange = useCallback(
		(lineItemId: number, month: number, value: string) => {
			const parsed = value.replace(/[^\d.-]/g, '');
			const numVal = parsed === '' ? '0' : parsed;
			onMonthlyUpdate(lineItemId, month, numVal);
		},
		[onMonthlyUpdate]
	);

	const startCommentEdit = useCallback((itemId: number, currentComment: string | null) => {
		setEditingComment(itemId);
		setCommentDraft(currentComment ?? '');
		setTimeout(() => commentInputRef.current?.focus(), 0);
	}, []);

	const commitComment = useCallback(
		(itemId: number) => {
			setEditingComment(null);
			onCommentUpdate(itemId, commentDraft);
		},
		[commentDraft, onCommentUpdate]
	);

	const handleCommentKeyDown = useCallback(
		(e: React.KeyboardEvent, itemId: number) => {
			if (e.key === 'Enter') {
				commitComment(itemId);
			} else if (e.key === 'Escape') {
				setEditingComment(null);
			}
		},
		[commitComment]
	);

	// Group items by IFRS category for visual separation
	const categoryMap = useMemo(() => {
		const map = new Map<string, OpExLineItem[]>();
		for (const item of lineItems) {
			const existing = map.get(item.ifrsCategory);
			if (existing) {
				existing.push(item);
			} else {
				map.set(item.ifrsCategory, [item]);
			}
		}
		return map;
	}, [lineItems]);

	const colCount = 19;

	return (
		<div
			className={cn(
				'h-full overflow-auto',
				'rounded-lg border border-(--grid-frame-border)',
				'bg-(--workspace-bg-card)'
			)}
		>
			<table
				role="grid"
				aria-label="Non-operating items grid"
				aria-colcount={colCount}
				className="w-full border-collapse text-left text-(--text-xs)"
			>
				<colgroup>
					<col style={{ width: 140 }} />
					<col style={{ width: 180 }} />
					{MONTHS.map((m) => (
						<col key={m} style={{ width: 90 }} />
					))}
					<col style={{ width: 110 }} />
					<col style={{ width: 100 }} />
					<col style={{ width: 100 }} />
					<col style={{ width: 100 }} />
					<col style={{ width: 160 }} />
				</colgroup>
				<thead className="sticky top-0 z-2 bg-(--grid-subheader-bg) backdrop-blur-sm">
					<tr className="border-b-2 border-b-(--grid-frame-border)">
						<th
							className={cn(
								'sticky left-0 z-3 bg-(--grid-subheader-bg)',
								'px-(--grid-compact-cell-px) py-2.5',
								'text-[11px] font-semibold uppercase tracking-[0.12em]',
								'text-(--grid-subheader-text)',
								'border border-(--grid-compact-border)'
							)}
						>
							IFRS Category
						</th>
						<th
							className={cn(
								'sticky left-[140px] z-3 bg-(--grid-subheader-bg)',
								'px-(--grid-compact-cell-px) py-2.5',
								'text-[11px] font-semibold uppercase tracking-[0.12em]',
								'text-(--grid-subheader-text)',
								'border border-(--grid-compact-border)',
								'shadow-(--grid-pinned-shadow)'
							)}
						>
							Line Item
						</th>
						{MONTHS.map((m) => (
							<th
								key={m}
								className={cn(
									'px-(--grid-compact-cell-px) py-2.5 text-right',
									'text-[11px] font-semibold uppercase tracking-[0.12em]',
									'text-(--grid-subheader-text)',
									'border border-(--grid-compact-border)'
								)}
							>
								{m}
							</th>
						))}
						<th
							className={cn(
								'px-(--grid-compact-cell-px) py-2.5 text-right',
								'text-[11px] font-semibold uppercase tracking-[0.12em]',
								'text-(--grid-subheader-text)',
								'border border-(--grid-compact-border)',
								'bg-(--workspace-bg-muted)'
							)}
						>
							FY Total
						</th>
						<th
							className={cn(
								'px-(--grid-compact-cell-px) py-2.5 text-right',
								'text-[11px] font-semibold uppercase tracking-[0.12em]',
								'text-(--text-muted)',
								'border border-(--grid-compact-border)'
							)}
						>
							V6 Total
						</th>
						<th
							className={cn(
								'px-(--grid-compact-cell-px) py-2.5 text-right',
								'text-[11px] font-semibold uppercase tracking-[0.12em]',
								'text-(--text-muted)',
								'border border-(--grid-compact-border)'
							)}
						>
							FY2025
						</th>
						<th
							className={cn(
								'px-(--grid-compact-cell-px) py-2.5 text-right',
								'text-[11px] font-semibold uppercase tracking-[0.12em]',
								'text-(--text-muted)',
								'border border-(--grid-compact-border)'
							)}
						>
							FY2024
						</th>
						<th
							className={cn(
								'px-(--grid-compact-cell-px) py-2.5',
								'text-[11px] font-semibold uppercase tracking-[0.12em]',
								'text-(--grid-subheader-text)',
								'border border-(--grid-compact-border)'
							)}
						>
							Comments
						</th>
					</tr>
				</thead>
				<tbody>
					{Array.from(categoryMap.entries()).map(([category, items]) => (
						<NonOperatingCategoryRows
							key={category}
							category={category}
							items={items}
							isEditable={isEditable}
							onMonthlyChange={handleMonthlyChange}
							editingComment={editingComment}
							commentDraft={commentDraft}
							commentInputRef={commentInputRef}
							onStartCommentEdit={startCommentEdit}
							onCommitComment={commitComment}
							onCommentDraftChange={setCommentDraft}
							onCommentKeyDown={handleCommentKeyDown}
						/>
					))}
				</tbody>
				<tfoot>
					<tr
						className={cn(
							'bg-(--grid-grandtotal-bg) text-(--grid-grandtotal-text)',
							'border-t-2 border-t-(--grid-grandtotal-border-top)',
							'sticky bottom-0 z-2',
							'font-bold'
						)}
					>
						<td
							colSpan={2}
							className={cn(
								'sticky left-0 z-3',
								'bg-(--grid-grandtotal-bg) text-(--grid-grandtotal-text)',
								'px-(--grid-compact-cell-px) py-3',
								'font-bold text-[12px] uppercase tracking-wider'
							)}
						>
							Non-Operating Total
						</td>
						{monthlyGrandTotals.map((total, i) => (
							<td
								key={`grand-m${i + 1}`}
								className={cn(
									'px-(--grid-compact-cell-px) py-3 text-right',
									'font-[family-name:var(--font-mono)] tabular-nums',
									'text-[11px] font-bold'
								)}
							>
								{total.isZero() ? '' : formatCompact(total)}
							</td>
						))}
						<td
							className={cn(
								'px-(--grid-compact-cell-px) py-3 text-right',
								'font-[family-name:var(--font-mono)] tabular-nums',
								'text-[12px] font-bold'
							)}
						>
							{grandTotal.isZero() ? '' : formatCompact(grandTotal)}
						</td>
						<td className="px-(--grid-compact-cell-px) py-3" />
						<td className="px-(--grid-compact-cell-px) py-3" />
						<td className="px-(--grid-compact-cell-px) py-3" />
						<td className="px-(--grid-compact-cell-px) py-3" />
					</tr>
				</tfoot>
			</table>
		</div>
	);
}

// ── Category Rows Sub-Component ──────────────────────────────────────────────

type NonOperatingCategoryRowsProps = {
	category: string;
	items: OpExLineItem[];
	isEditable: boolean;
	onMonthlyChange: (lineItemId: number, month: number, value: string) => void;
	editingComment: number | null;
	commentDraft: string;
	commentInputRef: React.RefObject<HTMLInputElement | null>;
	onStartCommentEdit: (itemId: number, currentComment: string | null) => void;
	onCommitComment: (itemId: number) => void;
	onCommentDraftChange: (value: string) => void;
	onCommentKeyDown: (e: React.KeyboardEvent, itemId: number) => void;
};

function NonOperatingCategoryRows({
	category,
	items,
	isEditable,
	onMonthlyChange,
	editingComment,
	commentDraft,
	commentInputRef,
	onStartCommentEdit,
	onCommitComment,
	onCommentDraftChange,
	onCommentKeyDown,
}: NonOperatingCategoryRowsProps) {
	return (
		<>
			{/* Category header row */}
			<tr
				className={cn(
					'bg-(--grid-compact-group-bg)',
					'border-b border-b-(--grid-compact-group-border)'
				)}
			>
				<td
					colSpan={19}
					className={cn(
						'px-(--grid-compact-cell-px) py-2',
						'text-[11px] font-semibold uppercase tracking-wider',
						'text-(--grid-group-header-text)'
					)}
				>
					{category}
				</td>
			</tr>

			{/* Item rows */}
			{items.map((item) => {
				const fyTotal = computeFyTotal(item);

				return (
					<tr
						key={item.id}
						className={cn(
							'group border-b border-b-(--grid-compact-border)',
							'hover:bg-(--grid-row-hover)',
							'transition-colors duration-(--duration-fast)'
						)}
					>
						{/* Category (hidden — already shown in header) */}
						<td
							className={cn(
								'sticky left-0 z-1 bg-(--workspace-bg-card)',
								'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
								'border border-(--grid-compact-border)',
								'text-[11px] text-(--text-muted)',
								'group-hover:bg-(--grid-row-hover)'
							)}
						>
							{item.ifrsCategory}
						</td>

						{/* Line Item Name */}
						<td
							className={cn(
								'sticky left-[140px] z-1 bg-(--workspace-bg-card)',
								'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
								'border border-(--grid-compact-border)',
								'text-[11px] text-(--text-primary)',
								'shadow-(--grid-pinned-shadow)',
								'group-hover:bg-(--grid-row-hover)'
							)}
						>
							{item.lineItemName}
						</td>

						{/* Monthly Cells */}
						{MONTHS.map((_, monthIndex) => {
							const month = monthIndex + 1;
							const amount = getMonthlyAmount(item, month);

							return (
								<td
									key={`${item.id}-m${month}`}
									className={cn('px-0 py-0', 'border border-(--grid-compact-border)')}
								>
									<EditableCell
										value={new Decimal(amount).isZero() ? '' : formatFull(amount)}
										onChange={(val) => onMonthlyChange(item.id, month, val)}
										isReadOnly={!isEditable}
										type="number"
										className="rounded-none border-0"
									/>
								</td>
							);
						})}

						{/* FY Total */}
						<td
							className={cn(
								'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
								'border border-(--grid-compact-border)',
								'text-right',
								'font-[family-name:var(--font-mono)] tabular-nums',
								'text-[11px] font-semibold text-(--text-primary)',
								'bg-(--workspace-bg-muted)'
							)}
						>
							{fyTotal.isZero() ? '' : formatCompact(fyTotal)}
						</td>

						{/* V6 Total */}
						<td
							className={cn(
								'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
								'border border-(--grid-compact-border)',
								'text-right',
								'font-[family-name:var(--font-mono)] tabular-nums',
								'text-[11px] text-(--text-muted)',
								'bg-(--cell-readonly-bg)'
							)}
						>
							{item.budgetV6Total ? formatCompact(item.budgetV6Total) : ''}
						</td>

						{/* FY2025 */}
						<td
							className={cn(
								'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
								'border border-(--grid-compact-border)',
								'text-right',
								'font-[family-name:var(--font-mono)] tabular-nums',
								'text-[11px] text-(--text-muted)',
								'bg-(--cell-readonly-bg)'
							)}
						>
							{item.fy2025Actual ? formatCompact(item.fy2025Actual) : ''}
						</td>

						{/* FY2024 */}
						<td
							className={cn(
								'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
								'border border-(--grid-compact-border)',
								'text-right',
								'font-[family-name:var(--font-mono)] tabular-nums',
								'text-[11px] text-(--text-muted)',
								'bg-(--cell-readonly-bg)'
							)}
						>
							{item.fy2024Actual ? formatCompact(item.fy2024Actual) : ''}
						</td>

						{/* Comments */}
						<td
							className={cn(
								'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
								'border border-(--grid-compact-border)',
								'text-[11px] text-(--text-secondary)'
							)}
						>
							{editingComment === item.id ? (
								<input
									ref={commentInputRef}
									type="text"
									value={commentDraft}
									onChange={(e) => onCommentDraftChange(e.target.value)}
									onBlur={() => onCommitComment(item.id)}
									onKeyDown={(e) => onCommentKeyDown(e, item.id)}
									aria-label={`Comment for ${item.lineItemName}`}
									className={cn(
										'w-full px-1 py-0.5 text-[11px]',
										'rounded-sm',
										'border border-(--cell-editable-focus)',
										'shadow-(--shadow-glow-accent)',
										'bg-white outline-none',
										'transition-all duration-(--duration-fast)'
									)}
								/>
							) : isEditable ? (
								<button
									type="button"
									onClick={() => onStartCommentEdit(item.id, item.comment)}
									className={cn(
										'block w-full text-left truncate',
										'px-1 py-0.5 rounded-sm cursor-text',
										'bg-(--cell-editable-bg)',
										'border border-transparent',
										'border-b border-dashed',
										'border-b-(--accent-200)',
										'hover:border-(--accent-200)',
										'focus:border-(--cell-editable-focus)',
										'focus:shadow-(--shadow-glow-accent)',
										'focus:outline-none',
										'transition-all duration-(--duration-fast)'
									)}
									aria-label={`Edit comment for ${item.lineItemName}`}
								>
									{item.comment || '\u00A0'}
								</button>
							) : (
								<span className="truncate block">{item.comment || ''}</span>
							)}
						</td>
					</tr>
				);
			})}
		</>
	);
}
