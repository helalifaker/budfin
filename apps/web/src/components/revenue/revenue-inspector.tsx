import { useMemo } from 'react';
import {
	ArrowLeft,
	CheckCircle,
	DollarSign,
	PieChart as PieChartIcon,
	Sigma,
	TrendingUp,
} from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import Decimal from 'decimal.js';
import type { RevenueResultsResponse } from '@budfin/types';
import { cn } from '../../lib/cn';
import { formatMoney } from '../../lib/format-money';
import { CHART_TOOLTIP_STYLE, useChartColor, useChartSeriesColors } from '../../lib/chart-utils';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueReadiness, useRevenueResults } from '../../hooks/use-revenue';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useChartColors } from '../../hooks/use-chart-colors';
import { registerPanelContent } from '../../lib/right-panel-registry';
import {
	buildRevenueForecastGridRows,
	formatRevenueGridPercent,
	REVENUE_MONTH_LABELS,
} from '../../lib/revenue-workspace';
import { BAND_LABELS } from '../../lib/enrollment-workspace';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { Button } from '../ui/button';
import { InspectorSection } from '../shared/inspector-section';
import { WorkflowStatusCard } from '../shared/workflow-status-card';
import { ReadinessIndicator } from '../shared/readiness-indicator';
import { SummaryTable } from '../shared/summary-table';
import { ChartWrapper } from '../shared/chart-wrapper';
import { KpiCard } from '../shared/kpi-card';
import { FormulaCard } from '../shared/formula-card';

type BreakdownDimension = 'band' | 'nationality' | 'tariff' | 'category';

const MAX_BREAKDOWN_ROWS = 5;

const BAND_DOT_COLORS: Record<string, string> = {
	MATERNELLE: 'bg-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee)',
};

const VIEW_MODE_BADGE_STYLES: Record<string, string> = {
	category: 'bg-(--accent-50) text-(--accent-700)',
	grade: 'bg-(--badge-elementaire-bg) text-(--badge-elementaire)',
	nationality: 'bg-(--badge-college-bg) text-(--badge-college)',
	tariff: 'bg-(--badge-lycee-bg) text-(--badge-lycee)',
};

const VIEW_MODE_LABELS: Record<string, string> = {
	category: 'Category',
	grade: 'Grade',
	nationality: 'Nationality',
	tariff: 'Tariff',
};

const CHART_SERIES_TOKENS = [
	'--chart-series-1',
	'--chart-series-2',
	'--chart-series-3',
	'--chart-series-4',
	'--chart-series-5',
];

function toNumber(value: string) {
	return new Decimal(value).toNumber();
}

function formatCompactSar(value: string) {
	return formatMoney(value, { showCurrency: true, compact: true });
}

function formatChartTooltipValue(
	value: number | string | readonly (number | string)[] | undefined
) {
	const rawValue = Array.isArray(value) ? value[0] : value;
	const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
	return formatMoney(numericValue, { showCurrency: true });
}

function getCategoryTab(label: string) {
	switch (label) {
		case 'Tuition Fees':
			return 'feeGrid' as const;
		case 'Discount Impact':
			return 'discounts' as const;
		case 'Registration Fees':
		case 'Activities & Services':
		case 'Examination Fees':
			return 'otherRevenue' as const;
		default:
			return 'tariffAssignment' as const;
	}
}

function getBreakdownDimensions(viewMode: 'category' | 'grade' | 'nationality' | 'tariff') {
	switch (viewMode) {
		case 'category':
			return [
				{ key: 'band' as const, title: 'By Band' },
				{ key: 'nationality' as const, title: 'By Nationality' },
				{ key: 'tariff' as const, title: 'By Tariff' },
			];
		case 'grade':
			return [
				{ key: 'nationality' as const, title: 'By Nationality' },
				{ key: 'tariff' as const, title: 'By Tariff' },
				{ key: 'category' as const, title: 'By Category' },
			];
		case 'nationality':
			return [
				{ key: 'band' as const, title: 'By Band' },
				{ key: 'tariff' as const, title: 'By Tariff' },
				{ key: 'category' as const, title: 'By Category' },
			];
		case 'tariff':
			return [
				{ key: 'band' as const, title: 'By Band' },
				{ key: 'nationality' as const, title: 'By Nationality' },
				{ key: 'category' as const, title: 'By Category' },
			];
	}
}

function buildCategoryBreakdown(data: RevenueResultsResponse | undefined) {
	if (!data) {
		return [];
	}

	return buildRevenueForecastGridRows({ data, viewMode: 'category' })
		.filter((row) => !row.isTotal)
		.map((row) => ({
			label: row.label,
			amount: row.annualTotal,
		}));
}

function buildDimensionBreakdown({
	data,
	dimension,
	label,
	viewMode,
	gradeBandMap,
}: {
	data: RevenueResultsResponse | undefined;
	dimension: BreakdownDimension;
	label: string;
	viewMode: 'category' | 'grade' | 'nationality' | 'tariff';
	gradeBandMap: Map<string, string>;
}) {
	const totals = new Map<string, Decimal>();

	for (const entry of data?.entries ?? []) {
		let matchesSelection = true;
		let amount = new Decimal(entry.grossRevenueHt);

		if (viewMode === 'grade') {
			matchesSelection = entry.gradeLevel === label;
		}
		if (viewMode === 'nationality') {
			matchesSelection = entry.nationality === label;
		}
		if (viewMode === 'tariff') {
			matchesSelection = entry.tariff === label;
		}
		if (viewMode === 'category') {
			if (label === 'Tuition Fees') {
				amount = new Decimal(entry.grossRevenueHt);
			} else if (label === 'Discount Impact') {
				amount = new Decimal(entry.discountAmount).negated();
			} else {
				matchesSelection = false;
			}
		}

		if (!matchesSelection) {
			continue;
		}

		const key =
			dimension === 'band'
				? (gradeBandMap.get(entry.gradeLevel) ?? 'Other')
				: dimension === 'nationality'
					? entry.nationality
					: dimension === 'tariff'
						? entry.tariff
						: 'Category';

		totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(amount));
	}

	if (dimension === 'category') {
		return buildCategoryBreakdown(data);
	}

	return [...totals.entries()]
		.map(([breakdownLabel, amount]) => ({
			label: breakdownLabel,
			amount: amount.toFixed(4),
		}))
		.sort((left, right) => new Decimal(right.amount).cmp(new Decimal(left.amount)));
}

function computeSelectedRowAggregates({
	data,
	label,
	viewMode,
}: {
	data: RevenueResultsResponse | undefined;
	label: string;
	viewMode: 'category' | 'grade' | 'nationality' | 'tariff';
}) {
	let grossTotal = new Decimal(0);
	let discountTotal = new Decimal(0);
	let netTotal = new Decimal(0);
	let headcount = 0;

	for (const entry of data?.entries ?? []) {
		let matchesSelection = true;

		if (viewMode === 'grade') {
			matchesSelection = entry.gradeLevel === label;
		} else if (viewMode === 'nationality') {
			matchesSelection = entry.nationality === label;
		} else if (viewMode === 'tariff') {
			matchesSelection = entry.tariff === label;
		} else if (viewMode === 'category') {
			matchesSelection = label === 'Tuition Fees' || label === 'Discount Impact';
		}

		if (!matchesSelection) {
			continue;
		}

		grossTotal = grossTotal.plus(new Decimal(entry.grossRevenueHt));
		discountTotal = discountTotal.plus(new Decimal(entry.discountAmount));
		netTotal = netTotal.plus(new Decimal(entry.netRevenueHt));
		headcount += 1;
	}

	const discountImpact = grossTotal.eq(0)
		? '0.0'
		: discountTotal.div(grossTotal).mul(100).abs().toFixed(1);

	return {
		grossRevenue: grossTotal.toFixed(4),
		netRevenue: netTotal.toFixed(4),
		discountImpact,
		headcount,
	};
}

function getChartFillColor(
	viewMode: 'category' | 'grade' | 'nationality' | 'tariff',
	label: string,
	gradeBandMap: Map<string, string>,
	chartColors: ReturnType<typeof useChartColors>,
	seriesFallback: string
): string {
	if (viewMode === 'grade') {
		const band = gradeBandMap.get(label);
		switch (band) {
			case 'MATERNELLE':
				return chartColors.maternelle;
			case 'ELEMENTAIRE':
				return chartColors.elementaire;
			case 'COLLEGE':
				return chartColors.college;
			case 'LYCEE':
				return chartColors.lycee;
			default:
				return chartColors.fallback;
		}
	}

	return seriesFallback;
}

function getBreakdownDotColor(dimension: BreakdownDimension, rowLabel: string): string | null {
	if (dimension === 'band') {
		return BAND_DOT_COLORS[rowLabel] ?? null;
	}

	return null;
}

function buildFormulaString(
	viewMode: 'category' | 'grade' | 'nationality' | 'tariff',
	label: string
): string {
	switch (viewMode) {
		case 'category':
			if (label === 'Tuition Fees') {
				return 'Gross Revenue = Headcount x Tuition Fee HT per student';
			}

			if (label === 'Discount Impact') {
				return 'Discount = (RP headcount x RP rate + R3+ headcount x R3+ rate) x fee';
			}

			return 'Other Revenue = configured annual amount distributed across months';
		case 'grade':
			return 'Grade Revenue = Sum of (each nationality x tariff combination for this grade)';
		case 'nationality':
			return 'Nationality Revenue = Sum of (all grades x tariff for this nationality)';
		case 'tariff':
			return 'Tariff Revenue = Sum of (all grades x nationalities at this tariff level)';
	}
}

function RevenueInspectorDefaultView() {
	const { versionId } = useWorkspaceContext();
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const { data } = useRevenueResults(versionId, 'category');
	const { data: readiness } = useRevenueReadiness(versionId);
	const seriesColors = useChartSeriesColors(CHART_SERIES_TOKENS);
	const primaryChartColor = useChartColor('--chart-series-1');

	if (!versionId) {
		return (
			<p className="text-(--text-sm) text-(--text-muted)">Select a version to inspect revenue.</p>
		);
	}

	const composition = data?.executiveSummary.composition ?? [];
	const monthlyTrend = data?.executiveSummary.monthlyTrend ?? [];

	const readinessItems = [
		{ label: 'Fee Grid', ready: readiness?.feeGrid.ready ?? false },
		{ label: 'Tariff Assignment', ready: readiness?.tariffAssignment.ready ?? false },
		{ label: 'Discounts', ready: readiness?.discounts.ready ?? false },
		{
			label: 'Derived Revenue Rates',
			ready: readiness?.derivedRevenueSettings.ready ?? false,
		},
		{ label: 'Other Revenue', ready: readiness?.otherRevenue.ready ?? false },
	];
	const readyCount = readinessItems.filter((item) => item.ready).length;

	const allReady = readyCount === readinessItems.length;
	const workflowStatus = allReady ? 'All systems configured' : 'Configuration needed';
	const workflowVariant = allReady ? 'success' : 'warning';

	const totalRevenue =
		data?.executiveSummary.composition.reduce(
			(sum, item) => sum.plus(new Decimal(item.amount)),
			new Decimal(0)
		) ?? new Decimal(0);

	const compositionSummaryRows = composition.map((item) => {
		const percent = totalRevenue.eq(0)
			? '0.0%'
			: `${new Decimal(item.amount).div(totalRevenue).mul(100).toFixed(1)}%`;
		return {
			label: item.label,
			amount: formatCompactSar(item.amount),
			percent,
		};
	});

	const bandSummaryRows = (data?.executiveSummary.composition ?? [])
		.filter((item) => BAND_LABELS[item.label] !== undefined)
		.map((item) => ({
			...(BAND_DOT_COLORS[item.label] ? { dot: BAND_DOT_COLORS[item.label] } : {}),
			label: BAND_LABELS[item.label] ?? item.label,
			amount: formatCompactSar(item.amount),
		}));

	const nationalitySummaryRows = (data?.executiveSummary.composition ?? [])
		.filter((item) => !BAND_LABELS[item.label])
		.map((item) => ({
			label: item.label,
			amount: formatCompactSar(item.amount),
		}));

	const assumptionRows = readinessItems.map((item) => ({
		label: item.label,
		amount: item.ready ? 'Ready' : 'Needs attention',
	}));

	return (
		<div className="space-y-5">
			{/* Section 1: Workflow status */}
			<WorkflowStatusCard
				label="Revenue workflow"
				status={workflowStatus}
				statusVariant={workflowVariant}
				icon={CheckCircle}
			/>

			{/* Section 2: Readiness counters */}
			<InspectorSection title="Readiness checklist">
				<div className="flex items-center justify-between">
					<span className="text-(--text-sm) text-(--text-secondary)">Subsystems ready</span>
					<ReadinessIndicator ready={readyCount} total={readinessItems.length} />
				</div>
			</InspectorSection>

			{/* Section 3: Assumptions table */}
			<InspectorSection title="Assumptions">
				<SummaryTable rows={assumptionRows} header={{ label: 'Subsystem', amount: 'Status' }} />
			</InspectorSection>

			{/* Section 4: Recommended workflow */}
			<InspectorSection title="Recommended workflow">
				<div className="space-y-2 text-(--text-sm)">
					<p className="text-(--text-secondary)">
						Configure fee grid, assign tariffs, set discount rates, then calculate.
					</p>
				</div>
			</InspectorSection>

			{/* Section 5: Revenue composition summary */}
			<InspectorSection title="Revenue composition">
				<SummaryTable
					rows={compositionSummaryRows}
					header={{ label: 'Category', amount: 'Amount', percent: '%' }}
				/>
			</InspectorSection>

			{/* Section 6: Band summary */}
			{bandSummaryRows.length > 0 && (
				<InspectorSection title="Summary by band">
					<SummaryTable rows={bandSummaryRows} header={{ label: 'Band', amount: 'Amount' }} />
				</InspectorSection>
			)}

			{/* Section 7: Nationality summary */}
			{nationalitySummaryRows.length > 0 && (
				<InspectorSection title="Summary by nationality">
					<SummaryTable
						rows={nationalitySummaryRows}
						header={{ label: 'Nationality', amount: 'Amount' }}
					/>
				</InspectorSection>
			)}

			{/* Section 8: Revenue composition pie chart */}
			<InspectorSection title="Composition chart" icon={PieChartIcon}>
				<ChartWrapper height={180}>
					<PieChart>
						<Pie
							data={composition.map((item) => ({
								name: item.label,
								value: toNumber(item.amount),
							}))}
							dataKey="value"
							nameKey="name"
							innerRadius={42}
							outerRadius={72}
						>
							{composition.map((item, index) => (
								<Cell
									key={item.label}
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

			{/* Section 9: Monthly trend bar chart */}
			<InspectorSection title="Monthly trend" icon={TrendingUp}>
				<ChartWrapper height={180}>
					<BarChart
						data={monthlyTrend.map((item) => ({
							month: item.month,
							amount: toNumber(item.amount),
						}))}
					>
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

			{/* Quick links */}
			<InspectorSection title="Quick links">
				<div className="flex flex-wrap gap-2">
					<Button type="button" variant="outline" size="sm" onClick={() => openSettings('feeGrid')}>
						Open Settings
					</Button>
					<Button type="button" variant="outline" size="sm">
						Go to Enrollment
					</Button>
					<Button type="button" variant="outline" size="sm">
						Calculation Log
					</Button>
				</div>
			</InspectorSection>
		</div>
	);
}

function RevenueInspectorActiveView({
	label,
	viewMode,
}: {
	label: string;
	viewMode: 'category' | 'grade' | 'nationality' | 'tariff';
}) {
	const { versionId } = useWorkspaceContext();
	const clearSelection = useRevenueSelectionStore((state) => state.clearSelection);
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const { data } = useRevenueResults(versionId, viewMode);
	const { data: gradeLevelsData } = useGradeLevels();
	const chartColors = useChartColors();
	const seriesPrimaryColor = useChartColor('--chart-series-1');

	const gradeBandMap = useMemo(
		() =>
			new Map(
				(gradeLevelsData?.gradeLevels ?? []).map((gradeLevel) => [
					gradeLevel.gradeCode,
					gradeLevel.band,
				])
			),
		[gradeLevelsData?.gradeLevels]
	);

	const selectedRow = useMemo(
		() =>
			buildRevenueForecastGridRows({
				data,
				viewMode,
				gradeLevels: gradeLevelsData?.gradeLevels,
			}).find((row) => row.label === label),
		[data, gradeLevelsData?.gradeLevels, label, viewMode]
	);

	const aggregates = useMemo(
		() => computeSelectedRowAggregates({ data, label, viewMode }),
		[data, label, viewMode]
	);

	const monthlyTrend = useMemo(
		() =>
			selectedRow?.monthlyAmounts.map((amount, index) => ({
				month: REVENUE_MONTH_LABELS[index] ?? String(index + 1),
				amount: toNumber(amount),
			})) ?? [],
		[selectedRow?.monthlyAmounts]
	);

	const chartFill = useMemo(
		() => getChartFillColor(viewMode, label, gradeBandMap, chartColors, seriesPrimaryColor),
		[chartColors, gradeBandMap, label, seriesPrimaryColor, viewMode]
	);

	const breakdowns = useMemo(
		() =>
			getBreakdownDimensions(viewMode).map((dimension) => ({
				...dimension,
				rows: buildDimensionBreakdown({
					data,
					dimension: dimension.key,
					label,
					viewMode,
					gradeBandMap,
				}),
			})),
		[data, gradeBandMap, label, viewMode]
	);

	const bandForGrade = viewMode === 'grade' ? (gradeBandMap.get(label) ?? null) : null;

	const bandAggregateContext = useMemo(() => {
		if (viewMode !== 'grade' || !bandForGrade) {
			return null;
		}

		const gradesInBand = [...gradeBandMap.entries()]
			.filter(([, band]) => band === bandForGrade)
			.map(([gradeCode]) => gradeCode);

		let bandGross = new Decimal(0);
		let bandNet = new Decimal(0);
		let bandHeadcount = 0;

		for (const entry of data?.entries ?? []) {
			if (gradesInBand.includes(entry.gradeLevel)) {
				bandGross = bandGross.plus(new Decimal(entry.grossRevenueHt));
				bandNet = bandNet.plus(new Decimal(entry.netRevenueHt));
				bandHeadcount += 1;
			}
		}

		return {
			label: BAND_LABELS[bandForGrade] ?? bandForGrade,
			grossRevenue: bandGross.toFixed(4),
			netRevenue: bandNet.toFixed(4),
			headcount: bandHeadcount,
			gradeCount: gradesInBand.length,
		};
	}, [bandForGrade, data?.entries, gradeBandMap, viewMode]);

	const formulaString = buildFormulaString(viewMode, label);

	return (
		<div className="space-y-5">
			{/* Header: back button, view mode badge, label heading, row code */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={clearSelection}
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
						VIEW_MODE_BADGE_STYLES[viewMode] ?? ''
					)}
				>
					{VIEW_MODE_LABELS[viewMode] ?? viewMode}
				</span>
				<h3
					className={cn(
						'font-[family-name:var(--font-display)]',
						'text-(--text-lg) font-semibold text-(--text-primary)'
					)}
				>
					{label}
				</h3>
				<span
					className={cn(
						'rounded-full bg-(--workspace-bg-subtle)',
						'px-2 py-0.5 text-(--text-xs) font-semibold text-(--text-muted)'
					)}
				>
					{viewMode === 'category' ? getCategoryTab(label) : label}
				</span>
			</div>

			{/* KPI Cards: Gross Revenue + Net Revenue */}
			<div className="grid gap-3 md:grid-cols-2">
				<KpiCard
					label="Gross Revenue"
					icon={DollarSign}
					index={0}
					subtitle={`${aggregates.headcount} revenue entries`}
				>
					{formatCompactSar(aggregates.grossRevenue)}
				</KpiCard>
				<KpiCard
					label="Net Revenue"
					icon={TrendingUp}
					index={1}
					subtitle={`${aggregates.discountImpact}% discount impact`}
				>
					{formatCompactSar(aggregates.netRevenue)}
				</KpiCard>
			</div>

			{/* Revenue share indicator */}
			{selectedRow && (
				<InspectorSection>
					<p className="text-(--text-sm) text-(--text-secondary)">
						{formatRevenueGridPercent(selectedRow.percentageOfRevenue)} of total revenue
					</p>
				</InspectorSection>
			)}

			{/* Monthly Trend Chart */}
			<InspectorSection title="Monthly trend" icon={TrendingUp}>
				<ChartWrapper height={160}>
					<BarChart data={monthlyTrend}>
						<XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
						<YAxis hide />
						<Tooltip
							formatter={(value) => formatChartTooltipValue(value)}
							contentStyle={CHART_TOOLTIP_STYLE}
						/>
						<Bar dataKey="amount" fill={chartFill} radius={[6, 6, 0, 0]} />
					</BarChart>
				</ChartWrapper>
			</InspectorSection>

			{/* Contextual Breakdowns */}
			{breakdowns.map((breakdown) => {
				const totalRows = breakdown.rows.length;
				const visibleRows = breakdown.rows.slice(0, MAX_BREAKDOWN_ROWS);
				const overflowCount = totalRows - visibleRows.length;

				const summaryRows = visibleRows.map((row) => {
					const dot = getBreakdownDotColor(breakdown.key, row.label);
					const rowTotal = new Decimal(aggregates.grossRevenue);
					const rowAmount = new Decimal(row.amount);
					const percent = rowTotal.eq(0)
						? '0.0%'
						: `${rowAmount.div(rowTotal).mul(100).toFixed(1)}%`;

					return {
						...(dot ? { dot } : {}),
						label: row.label,
						amount: formatCompactSar(row.amount),
						percent,
					};
				});

				return (
					<InspectorSection key={breakdown.title} title={breakdown.title}>
						{summaryRows.length === 0 ? (
							<p className="py-4 text-center text-(--text-sm) text-(--text-muted)">
								No additional breakdown is available for this row.
							</p>
						) : (
							<>
								<SummaryTable
									rows={summaryRows}
									header={{
										label: 'Item',
										amount: 'Amount',
										percent: '%',
									}}
								/>
								{overflowCount > 0 && (
									<p className="mt-1 text-(--text-xs) text-(--text-muted)">
										and {overflowCount} more...
									</p>
								)}
							</>
						)}
					</InspectorSection>
				);
			})}

			{/* Edit in Settings button */}
			<div className="flex justify-end">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => openSettings(getCategoryTab(label))}
				>
					Edit in Settings
				</Button>
			</div>

			{/* Formula Card */}
			<FormulaCard title="How revenue is calculated" formula={formulaString} icon={Sigma} />

			{/* Band aggregate context (grade view only) */}
			{bandAggregateContext && (
				<InspectorSection>
					<p
						className={cn(
							'text-(--text-xs) font-semibold uppercase',
							'tracking-[0.08em] text-(--text-muted)'
						)}
					>
						{bandAggregateContext.label} band context
					</p>
					<p
						className={cn(
							'mt-1 font-[family-name:var(--font-mono)]',
							'text-(--text-sm) tabular-nums text-(--text-secondary)'
						)}
					>
						Gross {formatCompactSar(bandAggregateContext.grossRevenue)}
						{' \u00B7 '}
						Net {formatCompactSar(bandAggregateContext.netRevenue)}
						{' \u00B7 '}
						{bandAggregateContext.gradeCount} grades
					</p>
				</InspectorSection>
			)}
		</div>
	);
}

function RevenueInspectorContent() {
	const selection = useRevenueSelectionStore((state) => state.selection);

	return (
		<div aria-live="polite">
			{selection ? (
				<div
					key={`active-${selection.label}-${selection.viewMode}`}
					className="animate-inspector-crossfade"
				>
					<RevenueInspectorActiveView label={selection.label} viewMode={selection.viewMode} />
				</div>
			) : (
				<div key="default" className="animate-inspector-crossfade">
					<RevenueInspectorDefaultView />
				</div>
			)}
		</div>
	);
}

registerPanelContent('revenue', RevenueInspectorContent);

export { RevenueInspectorContent };
