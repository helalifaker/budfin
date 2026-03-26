import { useCallback, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { ArrowLeft, ChevronDown, ChevronUp, Percent, Trash2 } from 'lucide-react';
import type { OpExEntryMode, OpExLineItem } from '@budfin/types';
import {
	OPEX_IFRS_CATEGORIES,
	NON_OPERATING_IFRS_CATEGORIES,
	OPEX_ENTRY_MODES,
} from '@budfin/types';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import {
	useOpExLineItems,
	useUpdateOpExLineItem,
	useReorderOpExLineItem,
	useDeleteOpExLineItem,
} from '../../hooks/use-opex';
import { useOpExSelectionStore } from '../../stores/opex-selection-store';
import { registerPanelContent } from '../../lib/right-panel-registry';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '../ui/alert-dialog';

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const ENTRY_MODE_LABELS: Record<OpExEntryMode, string> = {
	FLAT: 'Flat',
	SEASONAL: 'Seasonal',
	ANNUAL_SPREAD: 'Annual',
	PERCENT_OF_REVENUE: '% Rev',
};

const ENTRY_MODE_COLORS: Record<OpExEntryMode, { text: string; bg: string }> = {
	FLAT: {
		text: 'text-(--entry-mode-flat)',
		bg: 'bg-(--entry-mode-flat-bg)',
	},
	SEASONAL: {
		text: 'text-(--entry-mode-seasonal)',
		bg: 'bg-(--entry-mode-seasonal-bg)',
	},
	ANNUAL_SPREAD: {
		text: 'text-(--entry-mode-annual)',
		bg: 'bg-(--entry-mode-annual-bg)',
	},
	PERCENT_OF_REVENUE: {
		text: 'text-(--entry-mode-revenue)',
		bg: 'bg-(--entry-mode-revenue-bg)',
	},
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeFyTotal(item: OpExLineItem): Decimal {
	return item.monthlyAmounts.reduce((sum, m) => sum.plus(m.amount), new Decimal(0));
}

function formatFullSar(value: string | Decimal) {
	const d = value instanceof Decimal ? value : new Decimal(value || '0');
	return formatMoney(d, { showCurrency: true, compact: false });
}

function formatCompactSar(value: string | Decimal) {
	const d = value instanceof Decimal ? value : new Decimal(value || '0');
	return formatMoney(d, { showCurrency: true, compact: true });
}

// ── Default View ─────────────────────────────────────────────────────────────

function OpExInspectorDefaultView() {
	return (
		<div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
			<div
				className={cn(
					'flex h-10 w-10 items-center justify-center rounded-lg',
					'bg-(--workspace-bg-subtle)'
				)}
			>
				<ChevronDown className="h-5 w-5 text-(--text-muted)" aria-hidden="true" />
			</div>
			<p className="text-(--text-sm) font-medium text-(--text-secondary)">
				Select a line item to inspect
			</p>
			<p className="text-(--text-xs) text-(--text-muted)">
				Click any row in the grid to view and edit its properties.
			</p>
		</div>
	);
}

// ── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-(--text-xs) font-semibold uppercase tracking-wider text-(--text-muted)">
			{children}
		</p>
	);
}

// ── Inline Editable Name ─────────────────────────────────────────────────────

function InlineEditableName({
	value,
	onSave,
	disabled,
}: {
	value: string;
	onSave: (name: string) => void;
	disabled: boolean;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleStartEdit = () => {
		if (disabled) return;
		setDraft(value);
		setIsEditing(true);
		requestAnimationFrame(() => inputRef.current?.select());
	};

	const handleConfirm = () => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== value) {
			onSave(trimmed);
		}
		setIsEditing(false);
	};

	const handleCancel = () => {
		setDraft(value);
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleConfirm();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			handleCancel();
		}
	};

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type="text"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={handleConfirm}
				onKeyDown={handleKeyDown}
				className={cn(
					'w-full rounded-md border border-(--accent-500) bg-(--workspace-bg-card)',
					'px-2 py-1 text-(--text-base) font-semibold text-(--text-primary)',
					'focus:outline-none focus:ring-2 focus:ring-(--accent-500)'
				)}
				aria-label="Line item name"
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={handleStartEdit}
			disabled={disabled}
			className={cn(
				'w-full text-left text-(--text-base) font-semibold text-(--text-primary)',
				'rounded-md px-2 py-1',
				'transition-colors duration-(--duration-fast)',
				!disabled && 'hover:bg-(--workspace-bg-subtle) cursor-text',
				disabled && 'cursor-default'
			)}
			aria-label={`Edit line item name: ${value}`}
		>
			{value}
		</button>
	);
}

// ── Entry Mode Toggle ────────────────────────────────────────────────────────

function EntryModeToggle({
	value,
	onChange,
	disabled,
}: {
	value: OpExEntryMode;
	onChange: (mode: OpExEntryMode) => void;
	disabled: boolean;
}) {
	return (
		<div
			className={cn(
				'flex rounded-md border border-(--workspace-border)',
				'bg-(--workspace-bg-subtle)'
			)}
			role="radiogroup"
			aria-label="Entry mode"
		>
			{OPEX_ENTRY_MODES.map((mode) => {
				const isActive = mode === value;
				const colors = ENTRY_MODE_COLORS[mode];
				return (
					<button
						key={mode}
						type="button"
						role="radio"
						aria-checked={isActive}
						disabled={disabled}
						onClick={() => onChange(mode)}
						className={cn(
							'flex-1 px-2 py-1.5 text-(--text-xs) font-medium',
							'first:rounded-l-md last:rounded-r-md',
							'transition-all duration-(--duration-fast)',
							'focus-visible:outline-none focus-visible:ring-2',
							'focus-visible:ring-(--accent-500) focus-visible:ring-offset-1',
							'disabled:pointer-events-none disabled:opacity-50',
							isActive
								? `${colors.bg} ${colors.text} shadow-(--shadow-sm)`
								: 'bg-transparent text-(--text-secondary) hover:text-(--text-primary)'
						)}
					>
						{ENTRY_MODE_LABELS[mode]}
					</button>
				);
			})}
		</div>
	);
}

// ── Active Months Pills ──────────────────────────────────────────────────────

function ActiveMonthsPills({
	activeMonths,
	onChange,
	onReset,
	disabled,
}: {
	activeMonths: number[];
	onChange: (months: number[]) => void;
	onReset: () => void;
	disabled: boolean;
}) {
	const activeSet = useMemo(() => new Set(activeMonths), [activeMonths]);
	const allActive = activeSet.size === 0 || activeSet.size === 12;

	const handleToggle = (month: number) => {
		if (disabled) return;
		const newSet = new Set(activeSet);
		if (newSet.has(month)) {
			newSet.delete(month);
		} else {
			newSet.add(month);
		}
		onChange([...newSet].sort((a, b) => a - b));
	};

	return (
		<div>
			<div className="flex flex-wrap gap-1.5" role="group" aria-label="Active months">
				{MONTH_LABELS.map((label, index) => {
					const month = index + 1;
					const isActive = activeSet.size === 0 || activeSet.has(month);
					return (
						<button
							key={month}
							type="button"
							role="checkbox"
							aria-checked={isActive}
							aria-label={`Month ${month}`}
							disabled={disabled}
							onClick={() => handleToggle(month)}
							className={cn(
								'flex h-7 w-7 items-center justify-center rounded-full',
								'text-(--text-xs) font-medium',
								'transition-all duration-(--duration-fast)',
								'focus-visible:outline-none focus-visible:ring-2',
								'focus-visible:ring-(--accent-500) focus-visible:ring-offset-1',
								'disabled:pointer-events-none disabled:opacity-50',
								isActive
									? 'bg-(--accent-500) text-(--text-on-dark) shadow-(--shadow-sm)'
									: 'bg-(--workspace-bg-subtle) text-(--text-muted)',
								!disabled && !isActive && 'hover:bg-(--workspace-bg-muted)'
							)}
						>
							{label}
						</button>
					);
				})}
			</div>
			{!allActive && !disabled && (
				<button
					type="button"
					onClick={onReset}
					className={cn(
						'mt-2 text-(--text-xs) text-(--accent-600)',
						'hover:text-(--accent-700) hover:underline',
						'focus-visible:outline-none focus-visible:underline'
					)}
				>
					Use school calendar
				</button>
			)}
		</div>
	);
}

// ── KPI Mini Card ────────────────────────────────────────────────────────────

function KpiMiniCard({ label, value }: { label: string; value: string }) {
	return (
		<div
			className={cn(
				'flex-1 rounded-lg border border-(--workspace-border)',
				'bg-(--workspace-bg-card) px-3 py-2'
			)}
		>
			<p className="text-(--text-xs) font-medium text-(--text-muted)">{label}</p>
			<p className="mt-0.5 font-mono text-(--text-sm) font-semibold tabular-nums text-(--text-primary)">
				{value}
			</p>
		</div>
	);
}

// ── Active View ──────────────────────────────────────────────────────────────

function OpExInspectorActiveView({ lineItem }: { lineItem: OpExLineItem }) {
	const clearSelection = useOpExSelectionStore((s) => s.clearSelection);
	const { versionId, versionStatus } = useWorkspaceContext();
	const { data: lineItemsResponse } = useOpExLineItems(versionId);
	const updateMutation = useUpdateOpExLineItem(versionId);
	const reorderMutation = useReorderOpExLineItem(versionId);
	const deleteMutation = useDeleteOpExLineItem(versionId);

	const isLocked = versionStatus === 'Locked' || versionStatus === 'Archived';
	const disabled = isLocked;

	const [commentDraft, setCommentDraft] = useState(lineItem.comment ?? '');

	// Compute derived values from API data (display only, no arithmetic per ADR-002)
	const fyTotal = useMemo(() => computeFyTotal(lineItem), [lineItem]);

	const v6Total = useMemo(
		() => (lineItem.budgetV6Total ? new Decimal(lineItem.budgetV6Total) : null),
		[lineItem.budgetV6Total]
	);
	const fy2025 = useMemo(
		() => (lineItem.fy2025Actual ? new Decimal(lineItem.fy2025Actual) : null),
		[lineItem.fy2025Actual]
	);
	const fy2024 = useMemo(
		() => (lineItem.fy2024Actual ? new Decimal(lineItem.fy2024Actual) : null),
		[lineItem.fy2024Actual]
	);

	const v6Delta = useMemo(() => {
		if (!v6Total || v6Total.isZero()) return null;
		return fyTotal.minus(v6Total).div(v6Total).mul(100);
	}, [fyTotal, v6Total]);

	// Category items for share and display order
	const categoryItems = useMemo(() => {
		const allItems = lineItemsResponse?.data ?? [];
		return allItems
			.filter(
				(item) =>
					item.ifrsCategory === lineItem.ifrsCategory && item.sectionType === lineItem.sectionType
			)
			.sort((a, b) => a.displayOrder - b.displayOrder);
	}, [lineItemsResponse?.data, lineItem.ifrsCategory, lineItem.sectionType]);

	const categoryTotal = useMemo(
		() => categoryItems.reduce((sum, item) => sum.plus(computeFyTotal(item)), new Decimal(0)),
		[categoryItems]
	);

	const shareOfCategory = categoryTotal.isZero()
		? '0.0%'
		: `${fyTotal.div(categoryTotal).mul(100).toFixed(1)}%`;

	const positionInCategory = useMemo(() => {
		const idx = categoryItems.findIndex((item) => item.id === lineItem.id);
		return { current: idx + 1, total: categoryItems.length };
	}, [categoryItems, lineItem.id]);

	// IFRS categories filtered by section type
	const categoryOptions = useMemo(() => {
		return lineItem.sectionType === 'OPERATING'
			? OPEX_IFRS_CATEGORIES
			: NON_OPERATING_IFRS_CATEGORIES;
	}, [lineItem.sectionType]);

	const sectionLabel =
		lineItem.sectionType === 'OPERATING' ? 'OPERATING EXPENSE' : 'NON-OPERATING ITEM';

	// ── Handlers ───────────────────────────────────────────────────────────

	const handlePatch = useCallback(
		(patch: Parameters<typeof updateMutation.mutate>[0]['patch']) => {
			updateMutation.mutate({ lineItemId: lineItem.id, patch });
		},
		[updateMutation, lineItem.id]
	);

	const handleBack = useCallback(() => {
		const itemId = String(lineItem.id);
		clearSelection();
		requestAnimationFrame(() => {
			const focusTarget = Array.from(
				document.querySelectorAll<HTMLElement>('[data-grid-row-id][data-col-index="0"]')
			).find((el) => el.dataset.gridRowId === itemId);
			focusTarget?.focus();
		});
	}, [lineItem.id, clearSelection]);

	const handleNameSave = useCallback(
		(name: string) => handlePatch({ lineItemName: name }),
		[handlePatch]
	);

	const handleCategoryChange = useCallback(
		(ifrsCategory: string) => handlePatch({ ifrsCategory }),
		[handlePatch]
	);

	const handleEntryModeChange = useCallback(
		(entryMode: OpExEntryMode) => handlePatch({ entryMode }),
		[handlePatch]
	);

	const handleActiveMonthsChange = useCallback(
		(activeMonths: number[]) => handlePatch({ activeMonths }),
		[handlePatch]
	);

	const handleActiveMonthsReset = useCallback(
		() => handlePatch({ activeMonths: [] }),
		[handlePatch]
	);

	const handleCommentBlur = useCallback(() => {
		const trimmed = commentDraft.trim();
		const current = lineItem.comment?.trim() ?? '';
		if (trimmed !== current) {
			handlePatch({ comment: trimmed || null });
		}
	}, [commentDraft, lineItem.comment, handlePatch]);

	const handleDelete = useCallback(() => {
		deleteMutation.mutate(lineItem.id, {
			onSuccess: () => clearSelection(),
		});
	}, [deleteMutation, lineItem.id, clearSelection]);

	const handleMoveUp = useCallback(() => {
		const idx = categoryItems.findIndex((item) => item.id === lineItem.id);
		if (idx <= 0) return;
		const moves = categoryItems.map((item, i) => {
			let newOrder = i;
			if (i === idx - 1) newOrder = idx;
			else if (i === idx) newOrder = idx - 1;
			return {
				lineItemId: item.id,
				ifrsCategory: item.ifrsCategory,
				displayOrder: newOrder,
			};
		});
		reorderMutation.mutate({ moves });
	}, [categoryItems, lineItem.id, reorderMutation]);

	const handleMoveDown = useCallback(() => {
		const idx = categoryItems.findIndex((item) => item.id === lineItem.id);
		if (idx < 0 || idx >= categoryItems.length - 1) return;
		const moves = categoryItems.map((item, i) => {
			let newOrder = i;
			if (i === idx) newOrder = idx + 1;
			else if (i === idx + 1) newOrder = idx;
			return {
				lineItemId: item.id,
				ifrsCategory: item.ifrsCategory,
				displayOrder: newOrder,
			};
		});
		reorderMutation.mutate({ moves });
	}, [categoryItems, lineItem.id, reorderMutation]);

	return (
		<div className="space-y-4">
			{/* ── Back + Header ─────────────────────────────────────────── */}
			<div className="flex items-start gap-2">
				<button
					type="button"
					onClick={handleBack}
					className={cn(
						'mt-0.5 shrink-0 rounded-md p-1 text-(--text-muted)',
						'transition-colors duration-(--duration-fast)',
						'hover:bg-(--workspace-bg-muted) hover:text-(--text-primary)',
						'focus-visible:outline-none focus-visible:ring-2',
						'focus-visible:ring-(--accent-500)'
					)}
					aria-label="Back to overview"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<div className="min-w-0 flex-1">
					<SectionLabel>{sectionLabel}</SectionLabel>
					<InlineEditableName
						value={lineItem.lineItemName}
						onSave={handleNameSave}
						disabled={disabled}
					/>
				</div>
			</div>

			{/* ── Category ─────────────────────────────────────────────── */}
			<div>
				<SectionLabel>Category</SectionLabel>
				<div className="mt-1">
					<Select
						value={lineItem.ifrsCategory}
						onValueChange={handleCategoryChange}
						disabled={disabled}
					>
						<SelectTrigger className="h-8 text-(--text-sm)" aria-label="IFRS category">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{categoryOptions.map((cat) => (
								<SelectItem key={cat} value={cat}>
									{cat}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* ── Entry Mode ───────────────────────────────────────────── */}
			<div>
				<SectionLabel>Entry Mode</SectionLabel>
				<div className="mt-1">
					<EntryModeToggle
						value={lineItem.entryMode}
						onChange={handleEntryModeChange}
						disabled={disabled}
					/>
				</div>
			</div>

			{/* ── Active Months ─────────────────────────────────────────── */}
			<div>
				<SectionLabel>Active Months</SectionLabel>
				<div className="mt-1.5">
					<ActiveMonthsPills
						activeMonths={lineItem.activeMonths}
						onChange={handleActiveMonthsChange}
						onReset={handleActiveMonthsReset}
						disabled={disabled}
					/>
				</div>
			</div>

			{/* ── Divider ──────────────────────────────────────────────── */}
			<hr className="border-(--workspace-border)" />

			{/* ── KPI Mini Cards ────────────────────────────────────────── */}
			<div className="flex gap-3" role="list" aria-label="Key metrics">
				<KpiMiniCard label="FY Total" value={formatCompactSar(fyTotal)} />
				<KpiMiniCard label="% of Category" value={shareOfCategory} />
			</div>

			{/* ── Historical Comparison ──────────────────────────────────── */}
			<div>
				<SectionLabel>Historical Comparison</SectionLabel>
				<div className="mt-1.5 overflow-hidden rounded-lg border border-(--workspace-border)">
					<table className="w-full text-(--text-xs)">
						<thead>
							<tr className="bg-(--workspace-bg-muted)">
								<th className="px-2.5 py-1.5 text-left font-medium uppercase tracking-wider text-(--text-muted)">
									Period
								</th>
								<th className="px-2.5 py-1.5 text-right font-medium uppercase tracking-wider text-(--text-muted)">
									Amount
								</th>
								<th className="w-16 px-2.5 py-1.5 text-right font-medium uppercase tracking-wider text-(--text-muted)">
									Delta
								</th>
							</tr>
						</thead>
						<tbody>
							<tr className="border-t border-(--workspace-border)">
								<td className="px-2.5 py-1.5 font-medium text-(--text-primary)">Current Plan</td>
								<td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-(--text-primary)">
									{formatFullSar(fyTotal)}
								</td>
								<td className="px-2.5 py-1.5 text-right text-(--text-muted)">--</td>
							</tr>
							<tr className="border-t border-(--workspace-border)">
								<td className="px-2.5 py-1.5 font-medium text-(--text-secondary)">V6 Budget</td>
								<td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-(--text-secondary)">
									{v6Total ? formatFullSar(v6Total) : '--'}
								</td>
								<td className="px-2.5 py-1.5 text-right font-mono tabular-nums">
									{v6Delta ? (
										<span
											className={cn(
												v6Delta.gt(0) ? 'text-(--color-success)' : 'text-(--color-error)'
											)}
										>
											{v6Delta.gt(0) ? '+' : ''}
											{v6Delta.toFixed(1)}%
										</span>
									) : (
										<span className="text-(--text-muted)">--</span>
									)}
								</td>
							</tr>
							<tr className="border-t border-(--workspace-border)">
								<td className="px-2.5 py-1.5 font-medium text-(--text-secondary)">FY2025 Actual</td>
								<td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-(--text-secondary)">
									{fy2025 ? formatFullSar(fy2025) : '--'}
								</td>
								<td className="px-2.5 py-1.5 text-right text-(--text-muted)">--</td>
							</tr>
							<tr className="border-t border-(--workspace-border)">
								<td className="px-2.5 py-1.5 font-medium text-(--text-secondary)">FY2024 Actual</td>
								<td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-(--text-secondary)">
									{fy2024 ? formatFullSar(fy2024) : '--'}
								</td>
								<td className="px-2.5 py-1.5 text-right text-(--text-muted)">--</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			{/* ── Comment ──────────────────────────────────────────────── */}
			<div>
				<SectionLabel>Comment</SectionLabel>
				<div className="mt-1">
					<Textarea
						value={commentDraft}
						onChange={(e) => setCommentDraft(e.target.value)}
						onBlur={handleCommentBlur}
						placeholder="Add a note..."
						disabled={disabled}
						className="min-h-[60px] text-(--text-sm)"
						aria-label="Line item comment"
					/>
				</div>
			</div>

			{/* ── Quick Actions ─────────────────────────────────────────── */}
			{!disabled && (
				<div>
					<SectionLabel>Quick Actions</SectionLabel>
					<div className="mt-1.5 flex gap-2">
						<Button
							variant="secondary"
							size="sm"
							disabled
							className="flex-1"
							aria-label="Apply percentage adjustment"
						>
							<Percent className="h-3.5 w-3.5" aria-hidden="true" />
							Apply % adjustment
						</Button>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="destructive"
									size="sm"
									loading={deleteMutation.isPending}
									aria-label="Delete line item"
								>
									<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
									Delete
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete line item</AlertDialogTitle>
									<AlertDialogDescription>
										Are you sure you want to delete &ldquo;{lineItem.lineItemName}
										&rdquo;? This action cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={handleDelete}
										className="bg-(--color-error) hover:bg-[color-mix(in_srgb,var(--color-error),black_15%)]"
									>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>
			)}

			{/* ── Display Order ─────────────────────────────────────────── */}
			<div>
				<SectionLabel>Display Order</SectionLabel>
				<div className="mt-1.5 flex items-center gap-2">
					<span className="text-(--text-sm) text-(--text-secondary)">
						{positionInCategory.current} of {positionInCategory.total} in {lineItem.ifrsCategory}
					</span>
					<div className="ml-auto flex gap-1">
						<Button
							variant="ghost"
							size="icon"
							disabled={disabled || positionInCategory.current <= 1}
							onClick={handleMoveUp}
							aria-label="Move up"
						>
							<ChevronUp className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							disabled={disabled || positionInCategory.current >= positionInCategory.total}
							onClick={handleMoveDown}
							aria-label="Move down"
						>
							<ChevronDown className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ── Inspector Content ────────────────────────────────────────────────────────

function OpExInspectorContent() {
	const selection = useOpExSelectionStore((s) => s.selection);

	return (
		<div aria-live="polite">
			{selection ? (
				<div key={`active-${selection.lineItem.id}`} className="animate-inspector-crossfade">
					<OpExInspectorActiveView lineItem={selection.lineItem} />
				</div>
			) : (
				<div key="default" className="animate-inspector-crossfade">
					<OpExInspectorDefaultView />
				</div>
			)}
		</div>
	);
}

registerPanelContent('opex', OpExInspectorContent);

export { OpExInspectorContent };
