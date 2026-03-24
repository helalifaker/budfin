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

export type OpExGridProps = {
	lineItems: OpExLineItem[];
	monthlyTotals: string[];
	isEditable: boolean;
	onMonthlyUpdate: (lineItemId: number, month: number, amount: string) => void;
	onCommentUpdate: (lineItemId: number, comment: string) => void;
};

interface CategoryGroup {
	category: string;
	items: OpExLineItem[];
	subtotal: Decimal;
	monthlySubtotals: Decimal[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthlyAmount(item: OpExLineItem, month: number): string {
	const entry = item.monthlyAmounts.find((m) => m.month === month);
	return entry?.amount ?? '0';
}

function computeFyTotal(item: OpExLineItem): Decimal {
	return item.monthlyAmounts.reduce((sum, m) => sum.plus(m.amount), new Decimal(0));
}

function buildCategoryGroups(items: OpExLineItem[]): CategoryGroup[] {
	const categoryMap = new Map<string, OpExLineItem[]>();

	for (const item of items) {
		const existing = categoryMap.get(item.ifrsCategory);
		if (existing) {
			existing.push(item);
		} else {
			categoryMap.set(item.ifrsCategory, [item]);
		}
	}

	const groups: CategoryGroup[] = [];
	for (const [category, categoryItems] of categoryMap) {
		const monthlySubtotals: Decimal[] = [];
		for (let m = 1; m <= 12; m++) {
			let monthSum = new Decimal(0);
			for (const item of categoryItems) {
				monthSum = monthSum.plus(getMonthlyAmount(item, m));
			}
			monthlySubtotals.push(monthSum);
		}

		const subtotal = monthlySubtotals.reduce((sum, ms) => sum.plus(ms), new Decimal(0));

		groups.push({ category, items: categoryItems, subtotal, monthlySubtotals });
	}

	return groups;
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

export function OpExGrid({
	lineItems,
	monthlyTotals,
	isEditable,
	onMonthlyUpdate,
	onCommentUpdate,
}: OpExGridProps) {
	const [editingComment, setEditingComment] = useState<number | null>(null);
	const [commentDraft, setCommentDraft] = useState('');
	const commentInputRef = useRef<HTMLInputElement>(null);

	const categoryGroups = useMemo(() => buildCategoryGroups(lineItems), [lineItems]);

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

	const colCount = 19; // category + name + 12 months + FY Total + V6 + FY2025 + FY2024 + comment

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
				aria-label="Operating expenses grid"
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
					{categoryGroups.map((group) => (
						<CategoryGroupRows
							key={group.category}
							group={group}
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
					{/* Grand Total Row */}
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
							Grand Total
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

// ── Category Group Sub-Component ─────────────────────────────────────────────

type CategoryGroupRowsProps = {
	group: CategoryGroup;
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

function CategoryGroupRows({
	group,
	isEditable,
	onMonthlyChange,
	editingComment,
	commentDraft,
	commentInputRef,
	onStartCommentEdit,
	onCommitComment,
	onCommentDraftChange,
	onCommentKeyDown,
}: CategoryGroupRowsProps) {
	return (
		<>
			{group.items.map((item, itemIndex) => {
				const fyTotal = computeFyTotal(item);
				const isFirstInCategory = itemIndex === 0;

				return (
					<tr
						key={item.id}
						className={cn(
							'group border-b border-b-(--grid-compact-border)',
							'hover:bg-(--grid-row-hover)',
							'transition-colors duration-(--duration-fast)'
						)}
					>
						{/* IFRS Category — only show on first row, span all rows in group */}
						{isFirstInCategory ? (
							<td
								rowSpan={group.items.length}
								className={cn(
									'sticky left-0 z-1 bg-(--workspace-bg-card)',
									'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
									'border border-(--grid-compact-border)',
									'text-[11px] font-semibold text-(--text-secondary)',
									'align-top',
									'group-hover:bg-(--grid-row-hover)'
								)}
							>
								{group.category}
							</td>
						) : null}

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

						{/* Monthly Amount Cells */}
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

						{/* FY Total (computed, read-only) */}
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

						{/* V6 Total (reference) */}
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

						{/* FY2025 Actual */}
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

						{/* FY2024 Actual */}
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

			{/* Category Subtotal Row */}
			<tr
				className={cn(
					'bg-(--grid-subtotal-bg) text-(--grid-subtotal-text)',
					'font-semibold',
					'border-b border-b-(--grid-compact-border)'
				)}
			>
				<td
					colSpan={2}
					className={cn(
						'sticky left-0 z-1',
						'bg-(--grid-subtotal-bg) text-(--grid-subtotal-text)',
						'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
						'border border-(--grid-compact-border)',
						'text-[11px] font-semibold uppercase tracking-wider'
					)}
				>
					{group.category} Subtotal
				</td>
				{group.monthlySubtotals.map((ms, i) => (
					<td
						key={`sub-m${i + 1}`}
						className={cn(
							'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
							'border border-(--grid-compact-border)',
							'text-right',
							'font-[family-name:var(--font-mono)] tabular-nums',
							'text-[11px] font-semibold'
						)}
					>
						{ms.isZero() ? '' : formatCompact(ms)}
					</td>
				))}
				<td
					className={cn(
						'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
						'border border-(--grid-compact-border)',
						'text-right',
						'font-[family-name:var(--font-mono)] tabular-nums',
						'text-[11px] font-bold'
					)}
				>
					{group.subtotal.isZero() ? '' : formatCompact(group.subtotal)}
				</td>
				<td
					className={cn(
						'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
						'border border-(--grid-compact-border)'
					)}
				/>
				<td
					className={cn(
						'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
						'border border-(--grid-compact-border)'
					)}
				/>
				<td
					className={cn(
						'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
						'border border-(--grid-compact-border)'
					)}
				/>
				<td
					className={cn(
						'px-(--grid-compact-cell-px) py-(--grid-compact-cell-py)',
						'border border-(--grid-compact-border)'
					)}
				/>
			</tr>
		</>
	);
}
