import { useMemo } from 'react';
import Decimal from 'decimal.js';
import {
	ArrowLeft,
	Building2,
	CheckCircle,
	DollarSign,
	FileSpreadsheet,
	Sigma,
	TrendingDown,
} from 'lucide-react';
import { Bar, BarChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { OpExLineItem } from '@budfin/types';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { CHART_TOOLTIP_STYLE, useChartColor } from '../../lib/chart-utils';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useOpExLineItems } from '../../hooks/use-opex';
import { useOpExSelectionStore } from '../../stores/opex-selection-store';
import { registerPanelContent } from '../../lib/right-panel-registry';
import { InspectorSection } from '../shared/inspector-section';
import { WorkflowStatusCard } from '../shared/workflow-status-card';
import { SummaryTable } from '../shared/summary-table';
import { ChartWrapper } from '../shared/chart-wrapper';
import { KpiCard } from '../shared/kpi-card';
import { FormulaCard } from '../shared/formula-card';

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthlyAmount(item: OpExLineItem, month: number): string {
	const entry = item.monthlyAmounts.find((m) => m.month === month);
	return entry?.amount ?? '0';
}

function computeFyTotal(item: OpExLineItem): Decimal {
	return item.monthlyAmounts.reduce((sum, m) => sum.plus(m.amount), new Decimal(0));
}

function formatCompactSar(value: string | Decimal) {
	const d = value instanceof Decimal ? value : new Decimal(value || '0');
	return formatMoney(d, { showCurrency: true, compact: true });
}

function formatFullSar(value: string | Decimal) {
	const d = value instanceof Decimal ? value : new Decimal(value || '0');
	return formatMoney(d, { showCurrency: true, compact: false });
}

function formatChartTooltipValue(
	value: number | string | readonly (number | string)[] | undefined
) {
	const rawValue = Array.isArray(value) ? value[0] : value;
	const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
	return formatMoney(numericValue, { showCurrency: true });
}

function buildCategoryBreakdown(items: OpExLineItem[], sectionType: 'OPERATING' | 'NON_OPERATING') {
	const categoryTotals = new Map<string, Decimal>();
	const filtered = items.filter((item) => item.sectionType === sectionType);

	for (const item of filtered) {
		const total = computeFyTotal(item);
		categoryTotals.set(
			item.ifrsCategory,
			(categoryTotals.get(item.ifrsCategory) ?? new Decimal(0)).plus(total)
		);
	}

	const grandTotal = [...categoryTotals.values()].reduce(
		(sum, val) => sum.plus(val),
		new Decimal(0)
	);

	return [...categoryTotals.entries()]
		.sort((a, b) => b[1].cmp(a[1]))
		.map(([category, amount]) => ({
			label: category,
			amount: formatCompactSar(amount),
			percent: grandTotal.isZero() ? '0.0%' : `${amount.div(grandTotal).mul(100).toFixed(1)}%`,
		}));
}

function buildMonthlyTrend(items: OpExLineItem[]) {
	return MONTHS.map((label, index) => {
		const month = index + 1;
		let total = new Decimal(0);
		for (const item of items) {
			total = total.plus(getMonthlyAmount(item, month));
		}
		return {
			month: label,
			amount: total.toNumber(),
		};
	});
}

// ── Default View ─────────────────────────────────────────────────────────────

function OpExInspectorDefaultView() {
	const { versionId } = useWorkspaceContext();
	const { data: lineItemsResponse } = useOpExLineItems(versionId);
	const primaryColor = useChartColor('--chart-series-1');

	const allItems = useMemo(() => lineItemsResponse?.data ?? [], [lineItemsResponse?.data]);
	const summary = lineItemsResponse?.summary;
	const operatingItems = useMemo(
		() => allItems.filter((item) => item.sectionType === 'OPERATING'),
		[allItems]
	);
	const nonOperatingItems = useMemo(
		() => allItems.filter((item) => item.sectionType === 'NON_OPERATING'),
		[allItems]
	);

	const totalOperating = new Decimal(summary?.totalOperating ?? '0');
	const totalNonOperating = new Decimal(summary?.totalNonOperating ?? '0');
	const totalDepreciation = new Decimal(summary?.totalDepreciation ?? '0');
	const hasData = allItems.length > 0;

	const operatingBreakdown = useMemo(
		() => buildCategoryBreakdown(allItems, 'OPERATING'),
		[allItems]
	);

	const nonOperatingBreakdown = useMemo(
		() => buildCategoryBreakdown(allItems, 'NON_OPERATING'),
		[allItems]
	);

	const monthlyTrend = useMemo(() => buildMonthlyTrend(operatingItems), [operatingItems]);

	const workflowStatus = hasData ? 'Data loaded' : 'No data';
	const workflowVariant = hasData ? 'success' : 'warning';

	return (
		<div className="space-y-5">
			<WorkflowStatusCard
				label="OpEx workflow"
				status={workflowStatus}
				statusVariant={workflowVariant as 'success' | 'warning'}
				icon={CheckCircle}
			/>

			<div className="grid gap-3 md:grid-cols-2">
				<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-subtle) px-3 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						Operating items
					</p>
					<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">
						{operatingItems.length}
					</p>
				</div>
				<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-subtle) px-3 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						Non-operating items
					</p>
					<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">
						{nonOperatingItems.length}
					</p>
				</div>
			</div>

			<InspectorSection title="Key totals">
				<SummaryTable
					rows={[
						{ label: 'Total Operating', amount: formatCompactSar(totalOperating) },
						{ label: 'Total Non-Operating', amount: formatCompactSar(totalNonOperating) },
						{ label: 'Depreciation', amount: formatCompactSar(totalDepreciation) },
					]}
					header={{ label: 'Category', amount: 'Amount' }}
				/>
			</InspectorSection>

			{operatingBreakdown.length > 0 && (
				<InspectorSection title="Operating by category" icon={Building2}>
					<SummaryTable
						rows={operatingBreakdown}
						header={{ label: 'Category', amount: 'Amount', percent: '%' }}
					/>
				</InspectorSection>
			)}

			{monthlyTrend.length > 0 && hasData && (
				<InspectorSection title="Monthly trend (operating)" icon={TrendingDown}>
					<ChartWrapper height={160}>
						<BarChart data={monthlyTrend}>
							<XAxis dataKey="month" tickLine={false} axisLine={false} />
							<YAxis hide />
							<Tooltip
								formatter={(value) => formatChartTooltipValue(value)}
								contentStyle={CHART_TOOLTIP_STYLE}
							/>
							<Bar dataKey="amount" fill={primaryColor} radius={[6, 6, 0, 0]} />
						</BarChart>
					</ChartWrapper>
				</InspectorSection>
			)}

			{nonOperatingBreakdown.length > 0 && (
				<InspectorSection title="Non-operating by category">
					<SummaryTable
						rows={nonOperatingBreakdown}
						header={{ label: 'Category', amount: 'Amount', percent: '%' }}
					/>
				</InspectorSection>
			)}

			<FormulaCard
				title="How OpEx is calculated"
				formula="Each line item is set manually or as a % of revenue. FY Total = Sum(Jan..Dec). Grand Total = Sum of all line items."
				icon={Sigma}
			/>
		</div>
	);
}

// ── Active View ──────────────────────────────────────────────────────────────

function OpExInspectorActiveView({ lineItem }: { lineItem: OpExLineItem }) {
	const clearSelection = useOpExSelectionStore((s) => s.clearSelection);
	const { versionId } = useWorkspaceContext();
	const { data: lineItemsResponse } = useOpExLineItems(versionId);
	const primaryColor = useChartColor('--chart-series-1');

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

	const yoyChange = useMemo(() => {
		if (!fy2025 || fy2025.isZero()) return null;
		return fyTotal.minus(fy2025).div(fy2025).mul(100);
	}, [fyTotal, fy2025]);

	const monthlyData = useMemo(
		() =>
			MONTHS.map((label, index) => ({
				month: label,
				amount: new Decimal(getMonthlyAmount(lineItem, index + 1)).toNumber(),
				fy2025: fy2025 ? fy2025.div(12).toNumber() : 0,
			})),
		[lineItem, fy2025]
	);

	const categoryItems = useMemo(() => {
		const allItems = lineItemsResponse?.data ?? [];
		return allItems.filter(
			(item) =>
				item.ifrsCategory === lineItem.ifrsCategory && item.sectionType === lineItem.sectionType
		);
	}, [lineItemsResponse?.data, lineItem.ifrsCategory, lineItem.sectionType]);

	const categoryTotal = useMemo(
		() => categoryItems.reduce((sum, item) => sum.plus(computeFyTotal(item)), new Decimal(0)),
		[categoryItems]
	);

	const shareOfCategory = categoryTotal.isZero()
		? '0.0%'
		: `${fyTotal.div(categoryTotal).mul(100).toFixed(1)}%`;

	const handleBack = () => {
		const itemId = String(lineItem.id);
		clearSelection();
		requestAnimationFrame(() => {
			const focusTarget = Array.from(
				document.querySelectorAll<HTMLElement>('[data-grid-row-id][data-col-index="0"]')
			).find((el) => el.dataset.gridRowId === itemId);
			focusTarget?.focus();
		});
	};

	const sectionLabel = lineItem.sectionType === 'OPERATING' ? 'Operating' : 'Non-Operating';

	return (
		<div className="space-y-5">
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={handleBack}
					className={cn(
						'rounded-md p-1 text-(--text-muted)',
						'transition-colors duration-(--duration-fast)',
						'hover:bg-(--workspace-bg-muted) hover:text-(--text-primary)'
					)}
					aria-label="Back to overview"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				<span
					className={cn(
						'rounded-sm px-1.5 py-0.5 text-(--text-xs) font-medium',
						lineItem.sectionType === 'OPERATING'
							? 'bg-(--accent-50) text-(--accent-700)'
							: 'bg-(--badge-lycee-bg) text-(--badge-lycee)'
					)}
				>
					{sectionLabel}
				</span>
				<h3 className="font-[family-name:var(--font-display)] text-(--text-lg) font-semibold text-(--text-primary)">
					{lineItem.lineItemName}
				</h3>
			</div>

			<p className="text-(--text-xs) font-medium text-(--text-muted)">
				{lineItem.ifrsCategory} &middot;{' '}
				{lineItem.computeMethod === 'MANUAL'
					? 'Manual entry'
					: `% of revenue (${lineItem.computeRate ?? '0'}%)`}
			</p>

			<div className="grid gap-3 md:grid-cols-2">
				<KpiCard
					label="FY Total"
					icon={DollarSign}
					index={0}
					subtitle={
						yoyChange
							? `${yoyChange.gt(0) ? '+' : ''}${yoyChange.toFixed(1)}% vs FY2025`
							: undefined
					}
				>
					{formatCompactSar(fyTotal)}
				</KpiCard>
				<KpiCard
					label="Category Share"
					icon={Building2}
					index={1}
					subtitle={`of ${lineItem.ifrsCategory}`}
				>
					{shareOfCategory}
				</KpiCard>
			</div>

			<InspectorSection title="Historical comparison" icon={FileSpreadsheet}>
				<SummaryTable
					rows={[
						{
							label: 'Current plan',
							amount: formatFullSar(fyTotal),
						},
						{
							label: 'V6 Budget',
							amount: v6Total ? formatFullSar(v6Total) : '--',
						},
						{
							label: 'FY2025 Actual',
							amount: fy2025 ? formatFullSar(fy2025) : '--',
						},
						{
							label: 'FY2024 Actual',
							amount: fy2024 ? formatFullSar(fy2024) : '--',
						},
					]}
					header={{ label: 'Period', amount: 'Amount' }}
				/>
			</InspectorSection>

			<InspectorSection title="Monthly breakdown" icon={TrendingDown}>
				<ChartWrapper height={160}>
					<BarChart data={monthlyData}>
						<XAxis dataKey="month" tickLine={false} axisLine={false} />
						<YAxis hide />
						<Tooltip
							formatter={(value) => formatChartTooltipValue(value)}
							contentStyle={CHART_TOOLTIP_STYLE}
						/>
						<Bar dataKey="amount" name="Current" fill={primaryColor} radius={[6, 6, 0, 0]} />
					</BarChart>
				</ChartWrapper>
			</InspectorSection>

			{lineItem.comment && (
				<InspectorSection title="Comment">
					<p className="text-(--text-sm) text-(--text-secondary)">{lineItem.comment}</p>
				</InspectorSection>
			)}

			{categoryItems.length > 1 && (
				<InspectorSection title={`Other items in ${lineItem.ifrsCategory}`}>
					<SummaryTable
						rows={categoryItems
							.filter((item) => item.id !== lineItem.id)
							.map((item) => ({
								label: item.lineItemName,
								amount: formatCompactSar(computeFyTotal(item)),
							}))}
						header={{ label: 'Line Item', amount: 'Amount' }}
					/>
				</InspectorSection>
			)}

			<FormulaCard
				title="How this line item works"
				formula={
					lineItem.computeMethod === 'MANUAL'
						? 'FY Total = Sum(Jan..Dec). Each month is entered manually.'
						: `Monthly Amount = Revenue x ${lineItem.computeRate ?? '0'}%. FY Total = Sum(Jan..Dec).`
				}
				icon={Sigma}
			/>
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
