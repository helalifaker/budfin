import { useMemo } from 'react';
import Decimal from 'decimal.js';
import {
	ArrowLeft,
	ArrowRight,
	BarChart3,
	CheckCircle,
	DollarSign,
	PieChart as PieChartIcon,
	TrendingUp,
} from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { CHART_TOOLTIP_STYLE, useChartColor, useChartSeriesColors } from '../../lib/chart-utils';
import { registerPanelContent } from '../../lib/right-panel-registry';
import { usePnlResults, usePnlKpis } from '../../hooks/use-pnl';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useVersions } from '../../hooks/use-versions';
import { usePnlSelectionStore, type PnlSelection } from '../../stores/pnl-selection-store';
import { Button } from '../ui/button';
import { InspectorSection } from '../shared/inspector-section';
import { WorkflowStatusCard } from '../shared/workflow-status-card';
import { SummaryTable } from '../shared/summary-table';
import { ChartWrapper } from '../shared/chart-wrapper';
import { KpiCard } from '../shared/kpi-card';
import type { PnlLineItem } from '@budfin/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CHART_SERIES_TOKENS = [
	'--chart-series-1',
	'--chart-series-2',
	'--chart-series-3',
	'--chart-series-4',
	'--chart-series-5',
];

const SECTION_MODULE_MAP: Record<string, { path: string; label: string }> = {
	REVENUE_CONTRACTS: { path: '/planning/revenue', label: 'Revenue' },
	RENTAL_INCOME: { path: '/planning/revenue', label: 'Revenue' },
	TOTAL_REVENUE: { path: '/planning/revenue', label: 'Revenue' },
	STAFF_COSTS: { path: '/planning/staffing', label: 'Staffing' },
	OTHER_OPEX: { path: '/planning/opex', label: 'Operating Expenses' },
	DEPRECIATION: { path: '/planning/opex', label: 'Operating Expenses' },
	IMPAIRMENT: { path: '/planning/opex', label: 'Operating Expenses' },
	TOTAL_OPEX: { path: '/planning/opex', label: 'Operating Expenses' },
};

function formatCompactSar(value: string) {
	return formatMoney(value, { showCurrency: true, compact: true });
}

function toNumber(value: string) {
	return new Decimal(value).toNumber();
}

function formatChartTooltipValue(
	value: number | string | readonly (number | string)[] | undefined
) {
	const rawValue = Array.isArray(value) ? value[0] : value;
	const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
	return formatMoney(numericValue, { showCurrency: true });
}

function getChildLines(lines: PnlLineItem[], sectionKey: string): PnlLineItem[] {
	return lines.filter(
		(line) =>
			line.sectionKey === sectionKey && !line.isSubtotal && !line.isSeparator && line.depth > 1
	);
}

function getSectionSummaryRows(lines: PnlLineItem[], totalRevenue: Decimal) {
	const sectionTotals = lines.filter(
		(line) =>
			(line.isSubtotal || line.depth === 1) &&
			!line.isSeparator &&
			!new Decimal(line.annualTotal).isZero()
	);

	const majorSections = [
		'TOTAL_REVENUE',
		'STAFF_COSTS',
		'OTHER_OPEX',
		'DEPRECIATION',
		'OPERATING_PROFIT',
		'NET_FINANCE',
		'NET_PROFIT',
	];

	return sectionTotals
		.filter((line) => majorSections.includes(line.sectionKey) && line.isSubtotal)
		.map((line) => {
			const amount = new Decimal(line.annualTotal);
			const percent = totalRevenue.isZero()
				? '0.0%'
				: `${amount.div(totalRevenue).mul(100).abs().toFixed(1)}%`;
			return {
				label: line.displayLabel,
				amount: formatCompactSar(line.annualTotal),
				percent,
			};
		});
}

function getCostStructureData(lines: PnlLineItem[]) {
	const sections = [
		{ key: 'STAFF_COSTS', label: 'Staff Costs' },
		{ key: 'OTHER_OPEX', label: 'Other OpEx' },
		{ key: 'DEPRECIATION', label: 'Depreciation' },
		{ key: 'IMPAIRMENT', label: 'Impairment' },
	];

	return sections
		.map((section) => {
			const subtotal = lines.find((line) => line.sectionKey === section.key && line.isSubtotal);
			const value = subtotal ? Math.abs(toNumber(subtotal.annualTotal)) : 0;
			return { name: section.label, value };
		})
		.filter((item) => item.value > 0);
}

function getMonthlyNetProfitData(lines: PnlLineItem[]) {
	const netProfitLine = lines.find((line) => line.sectionKey === 'NET_PROFIT' && line.isSubtotal);
	if (!netProfitLine) return [];

	return netProfitLine.monthlyAmounts.map((amount, index) => ({
		month: MONTHS[index]!,
		amount: toNumber(amount),
	}));
}

// ── Default View ────────────────────────────────────────────────────────────

function PnlInspectorDefaultView() {
	const { versionId, fiscalYear } = useWorkspaceContext();
	const { data: pnlData } = usePnlResults('ifrs');
	const { data: kpis } = usePnlKpis();
	const { data: versionsData } = useVersions(fiscalYear);
	const seriesColors = useChartSeriesColors(CHART_SERIES_TOKENS);
	const primaryChartColor = useChartColor('--chart-series-1');
	const navigate = useNavigate();

	const version = versionsData?.data?.find((v) => v.id === versionId);
	const isCalculated = !!kpis;
	const staleModules: string[] = version?.staleModules ?? [];
	const isPnlStale = staleModules.includes('PNL');

	const workflowStatus = isCalculated
		? isPnlStale
			? 'Stale -- recalculate'
			: 'Calculated'
		: 'Not calculated';
	const workflowVariant = isCalculated ? (isPnlStale ? 'warning' : 'success') : 'warning';

	const totalRevenue = useMemo(() => {
		if (!kpis) return new Decimal(0);
		return new Decimal(kpis.totalRevenueHt);
	}, [kpis]);

	const summaryRows = useMemo(
		() => getSectionSummaryRows(pnlData?.lines ?? [], totalRevenue),
		[pnlData?.lines, totalRevenue]
	);

	const costStructure = useMemo(() => getCostStructureData(pnlData?.lines ?? []), [pnlData?.lines]);

	const monthlyNetProfit = useMemo(
		() => getMonthlyNetProfitData(pnlData?.lines ?? []),
		[pnlData?.lines]
	);

	if (!versionId) {
		return <p className="text-(--text-sm) text-(--text-muted)">Select a version to inspect P&L.</p>;
	}

	return (
		<div className="space-y-5">
			<WorkflowStatusCard
				label="P&L workflow"
				status={workflowStatus}
				statusVariant={workflowVariant}
				icon={CheckCircle}
			/>

			{summaryRows.length > 0 && (
				<InspectorSection title="P&L summary" icon={BarChart3}>
					<SummaryTable
						rows={summaryRows}
						header={{ label: 'Section', amount: 'Amount', percent: '% Rev' }}
					/>
				</InspectorSection>
			)}

			{costStructure.length > 0 && (
				<InspectorSection title="Cost structure" icon={PieChartIcon}>
					<ChartWrapper height={180}>
						<PieChart>
							<Pie
								data={costStructure}
								dataKey="value"
								nameKey="name"
								innerRadius={42}
								outerRadius={72}
							>
								{costStructure.map((_item, index) => (
									<Cell
										key={index}
										fill={seriesColors[index % seriesColors.length] ?? seriesColors[0]!}
									/>
								))}
							</Pie>
							<Tooltip
								formatter={(value) => formatChartTooltipValue(value)}
								contentStyle={CHART_TOOLTIP_STYLE}
							/>
						</PieChart>
					</ChartWrapper>
				</InspectorSection>
			)}

			{monthlyNetProfit.length > 0 && (
				<InspectorSection title="Monthly net profit" icon={TrendingUp}>
					<ChartWrapper height={180}>
						<BarChart data={monthlyNetProfit}>
							<XAxis dataKey="month" tickLine={false} axisLine={false} />
							<YAxis hide />
							<Tooltip
								formatter={(value) => formatChartTooltipValue(value)}
								contentStyle={CHART_TOOLTIP_STYLE}
							/>
							<Bar dataKey="amount" fill={primaryChartColor} radius={[6, 6, 0, 0]} />
						</BarChart>
					</ChartWrapper>
				</InspectorSection>
			)}

			<InspectorSection title="Quick links">
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => navigate('/planning/revenue')}
					>
						Revenue
						<ArrowRight className="ml-1 h-3 w-3" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => navigate('/planning/staffing')}
					>
						Staffing
						<ArrowRight className="ml-1 h-3 w-3" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => navigate('/planning/opex')}
					>
						OpEx
						<ArrowRight className="ml-1 h-3 w-3" />
					</Button>
				</div>
			</InspectorSection>
		</div>
	);
}

// ── Active View ─────────────────────────────────────────────────────────────

function PnlInspectorActiveView({ selection }: { selection: PnlSelection }) {
	const clearSelection = usePnlSelectionStore((state) => state.clearSelection);
	const { data: pnlData } = usePnlResults('ifrs');
	const { data: kpis } = usePnlKpis();
	const primaryChartColor = useChartColor('--chart-series-1');
	const navigate = useNavigate();

	const totalRevenue = useMemo(() => {
		if (!kpis) return new Decimal(0);
		return new Decimal(kpis.totalRevenueHt);
	}, [kpis]);

	const annualAmount = new Decimal(selection.annualTotal);
	const percentOfRevenue = totalRevenue.isZero()
		? '0.0'
		: annualAmount.div(totalRevenue).mul(100).abs().toFixed(1);

	const monthlyTrend = useMemo(
		() =>
			selection.monthlyAmounts.map((amount, index) => ({
				month: MONTHS[index]!,
				amount: toNumber(amount),
			})),
		[selection.monthlyAmounts]
	);

	const childLines = useMemo(
		() => getChildLines(pnlData?.lines ?? [], selection.sectionKey),
		[pnlData?.lines, selection.sectionKey]
	);

	const childRows = useMemo(
		() =>
			childLines
				.filter((line) => !new Decimal(line.annualTotal).isZero())
				.map((line) => ({
					label: line.displayLabel,
					amount: formatCompactSar(line.annualTotal),
				})),
		[childLines]
	);

	const varianceRows = useMemo(() => {
		if (!selection.varianceMonthlyAmounts) return [];
		return selection.varianceMonthlyAmounts.map((variance, index) => {
			const d = new Decimal(variance);
			return {
				label: MONTHS[index]!,
				amount: d.isZero()
					? '--'
					: d.isNeg()
						? `(${formatMoney(d.abs(), { compact: true })})`
						: formatMoney(d, { compact: true }),
			};
		});
	}, [selection.varianceMonthlyAmounts]);

	const moduleLink = SECTION_MODULE_MAP[selection.sectionKey];

	const handleBack = () => {
		clearSelection();
	};

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
						'bg-(--accent-50) text-(--accent-700)'
					)}
				>
					{selection.isSubtotal ? 'Subtotal' : 'Section'}
				</span>
				<h3
					className={cn(
						'font-[family-name:var(--font-display)]',
						'text-(--text-lg) font-semibold text-(--text-primary)'
					)}
				>
					{selection.displayLabel}
				</h3>
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<KpiCard
					label="Annual Total"
					icon={DollarSign}
					index={0}
					subtitle={`${percentOfRevenue}% of revenue`}
				>
					{formatCompactSar(selection.annualTotal)}
				</KpiCard>
				<KpiCard label="Monthly Avg" icon={BarChart3} index={1} subtitle="Average across 12 months">
					{formatCompactSar(
						annualAmount.div(12).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0)
					)}
				</KpiCard>
			</div>

			<InspectorSection title="Monthly trend" icon={TrendingUp}>
				<ChartWrapper height={160}>
					<BarChart data={monthlyTrend}>
						<XAxis dataKey="month" tickLine={false} axisLine={false} />
						<YAxis hide />
						<Tooltip
							formatter={(value) => formatChartTooltipValue(value)}
							contentStyle={CHART_TOOLTIP_STYLE}
						/>
						<Bar dataKey="amount" fill={primaryChartColor} radius={[6, 6, 0, 0]} />
					</BarChart>
				</ChartWrapper>
			</InspectorSection>

			{childRows.length > 0 && (
				<InspectorSection title="Line items">
					<SummaryTable rows={childRows} header={{ label: 'Item', amount: 'Amount' }} />
				</InspectorSection>
			)}

			{varianceRows.length > 0 && (
				<InspectorSection title="Variance vs comparison">
					<SummaryTable rows={varianceRows} header={{ label: 'Month', amount: 'Variance' }} />
					{selection.varianceAnnualTotal && (
						<div className="mt-3 flex items-center justify-between rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-3 py-2">
							<span className="text-(--text-sm) font-medium text-(--text-secondary)">
								Annual variance
							</span>
							<span
								className={cn(
									'font-mono text-(--text-sm) font-semibold tabular-nums',
									new Decimal(selection.varianceAnnualTotal).isNeg()
										? 'text-(--color-error)'
										: 'text-(--color-success)'
								)}
							>
								{formatCompactSar(selection.varianceAnnualTotal)}
								{selection.varianceAnnualPercent && (
									<span className="ml-1 text-(--text-xs) font-normal text-(--text-muted)">
										({selection.varianceAnnualPercent}%)
									</span>
								)}
							</span>
						</div>
					)}
				</InspectorSection>
			)}

			{moduleLink && (
				<div className="flex justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => navigate(moduleLink.path)}
					>
						Go to {moduleLink.label}
						<ArrowRight className="ml-1 h-3 w-3" />
					</Button>
				</div>
			)}
		</div>
	);
}

// ── Main Inspector Content ──────────────────────────────────────────────────

function PnlInspectorContent() {
	const selection = usePnlSelectionStore((state) => state.selection);

	return (
		<div aria-live="polite">
			{selection ? (
				<div key={`active-${selection.sectionKey}`} className="animate-inspector-crossfade">
					<PnlInspectorActiveView selection={selection} />
				</div>
			) : (
				<div key="default" className="animate-inspector-crossfade">
					<PnlInspectorDefaultView />
				</div>
			)}
		</div>
	);
}

registerPanelContent('pnl', PnlInspectorContent);

export { PnlInspectorContent };
