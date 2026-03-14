import { useMemo } from 'react';
import {
	Bar,
	BarChart,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import Decimal from 'decimal.js';
import type { RevenueResultsResponse } from '@budfin/types';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueReadiness, useRevenueResults } from '../../hooks/use-revenue';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { registerPanelContent } from '../../lib/right-panel-registry';
import {
	buildRevenueForecastGridRows,
	formatRevenueGridAmount,
	formatRevenueGridPercent,
} from '../../lib/revenue-workspace';
import { CHART_TOOLTIP_STYLE, useChartSeriesColors } from '../../lib/chart-utils';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { Button } from '../ui/button';

type BreakdownDimension = 'band' | 'nationality' | 'tariff' | 'category';

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
	const amount = formatRevenueGridAmount(value);
	return `SAR ${amount.text}`;
}

function formatChartTooltipValue(
	value: number | string | readonly (number | string)[] | undefined
) {
	const rawValue = Array.isArray(value) ? value[0] : value;
	const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
	return `${numericValue.toLocaleString('fr-FR')} SAR`;
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
				{ key: 'category' as const, title: 'By Category' },
				{ key: 'nationality' as const, title: 'By Nationality' },
				{ key: 'tariff' as const, title: 'By Tariff' },
			];
		case 'nationality':
			return [
				{ key: 'category' as const, title: 'By Category' },
				{ key: 'band' as const, title: 'By Band' },
				{ key: 'tariff' as const, title: 'By Tariff' },
			];
		case 'tariff':
			return [
				{ key: 'category' as const, title: 'By Category' },
				{ key: 'band' as const, title: 'By Band' },
				{ key: 'nationality' as const, title: 'By Nationality' },
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

function RevenueInspectorDefaultView() {
	const { versionId } = useWorkspaceContext();
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const { data } = useRevenueResults(versionId, 'category');
	const { data: readiness } = useRevenueReadiness(versionId);
	const chartColors = useChartSeriesColors(CHART_SERIES_TOKENS);

	if (!versionId) {
		return (
			<p className="text-(--text-sm) text-(--text-muted)">Select a version to inspect revenue.</p>
		);
	}

	const composition = data?.executiveSummary.composition ?? [];
	const monthlyTrend = data?.executiveSummary.monthlyTrend ?? [];

	return (
		<div className="space-y-5">
			<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">
					Revenue composition
				</h3>
				<div className="mt-3 flex justify-center">
					<ResponsiveContainer width="100%" height={180}>
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
										fill={chartColors[index % chartColors.length] ?? chartColors[0]!}
									/>
								))}
							</Pie>
							<Tooltip
								formatter={(value) => formatChartTooltipValue(value)}
								contentStyle={CHART_TOOLTIP_STYLE}
							/>
						</PieChart>
					</ResponsiveContainer>
				</div>
			</section>

			<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">Monthly trend</h3>
				<div className="mt-3 flex justify-center">
					<ResponsiveContainer width="100%" height={180}>
						<BarChart
							data={monthlyTrend.map((item) => ({
								month: item.month,
								amount: toNumber(item.amount),
							}))}
						>
							<XAxis
								dataKey="month"
								tickLine={false}
								axisLine={false}
								tick={{ fontSize: 'var(--chart-tick-size)' }}
							/>
							<YAxis hide />
							<Tooltip
								formatter={(value) => formatChartTooltipValue(value)}
								contentStyle={CHART_TOOLTIP_STYLE}
							/>
							<Bar dataKey="amount" fill={chartColors[0]} radius={[6, 6, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</section>

			<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">
					Readiness checklist
				</h3>
				<div className="mt-3 space-y-2 text-(--text-sm)">
					{[
						{ label: 'Fee Grid', ready: readiness?.feeGrid.ready ?? false },
						{ label: 'Tariff Assignment', ready: readiness?.tariffAssignment.ready ?? false },
						{ label: 'Discounts', ready: readiness?.discounts.ready ?? false },
						{
							label: 'Derived Revenue Rates',
							ready: readiness?.derivedRevenueSettings.ready ?? false,
						},
						{ label: 'Other Revenue', ready: readiness?.otherRevenue.ready ?? false },
					].map((item) => (
						<div key={item.label} className="flex items-center justify-between">
							<span>{item.label}</span>
							<span className={item.ready ? 'text-(--color-success)' : 'text-(--text-muted)'}>
								{item.ready ? 'Ready' : 'Needs attention'}
							</span>
						</div>
					))}
				</div>
			</section>

			<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">Quick links</h3>
				<div className="mt-3 flex flex-wrap gap-2">
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
			</section>
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
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const { data } = useRevenueResults(versionId, viewMode);
	const { data: gradeLevelsData } = useGradeLevels();
	const chartColors = useChartSeriesColors(CHART_SERIES_TOKENS);
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

	const monthlyTrend = selectedRow?.monthlyAmounts.map((amount, index) => ({
		month: index + 1,
		amount: toNumber(amount),
	}));

	const breakdowns = getBreakdownDimensions(viewMode).map((dimension) => ({
		...dimension,
		rows: buildDimensionBreakdown({
			data,
			dimension: dimension.key,
			label,
			viewMode,
			gradeBandMap,
		}),
	}));

	return (
		<div className="space-y-5">
			<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							Selected row
						</p>
						<h3 className="mt-1 text-(--text-lg) font-semibold text-(--text-primary)">{label}</h3>
						<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
							{selectedRow ? formatCompactSar(selectedRow.annualTotal) : 'SAR -'} •{' '}
							{selectedRow
								? `${formatRevenueGridPercent(selectedRow.percentageOfRevenue)} of revenue`
								: ''}
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => openSettings(getCategoryTab(label))}
					>
						Edit in Settings
					</Button>
				</div>
			</section>

			<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">Monthly trend</h3>
				<div className="mt-3 flex justify-center">
					<ResponsiveContainer width="100%" height={160}>
						<BarChart data={monthlyTrend ?? []}>
							<XAxis
								dataKey="month"
								tickLine={false}
								axisLine={false}
								tick={{ fontSize: 'var(--chart-tick-size)' }}
							/>
							<YAxis hide />
							<Tooltip
								formatter={(value) => formatChartTooltipValue(value)}
								contentStyle={CHART_TOOLTIP_STYLE}
							/>
							<Bar dataKey="amount" fill={chartColors[1]} radius={[6, 6, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</section>

			{breakdowns.map((breakdown) => (
				<section
					key={breakdown.title}
					className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4"
				>
					<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">
						{breakdown.title}
					</h3>
					<div className="mt-3 space-y-2 text-(--text-sm)">
						{breakdown.rows.length === 0 ? (
							<p className="text-(--text-muted)">
								No additional breakdown is available for this row.
							</p>
						) : (
							breakdown.rows.slice(0, 4).map((row) => (
								<div
									key={`${breakdown.title}-${row.label}`}
									className="flex items-center justify-between gap-3"
								>
									<span className="text-(--text-secondary)">{row.label}</span>
									<span className="font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)">
										{formatCompactSar(row.amount)}
									</span>
								</div>
							))
						)}
					</div>
				</section>
			))}
		</div>
	);
}

function RevenueInspectorContent() {
	const selection = useRevenueSelectionStore((state) => state.selection);

	if (!selection) {
		return <RevenueInspectorDefaultView />;
	}

	return <RevenueInspectorActiveView label={selection.label} viewMode={selection.viewMode} />;
}

registerPanelContent('revenue', RevenueInspectorContent);

export { RevenueInspectorContent };
