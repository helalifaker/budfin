import { useMemo } from 'react';
import { ArrowLeft, Sigma } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import Decimal from 'decimal.js';
import type { RevenueResultsResponse } from '@budfin/types';
import { cn } from '../../lib/cn';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueReadiness, useRevenueResults } from '../../hooks/use-revenue';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useChartColors } from '../../hooks/use-chart-colors';
import { registerPanelContent } from '../../lib/right-panel-registry';
import {
	buildRevenueForecastGridRows,
	formatRevenueGridAmount,
	formatRevenueGridPercent,
	REVENUE_MONTH_LABELS,
} from '../../lib/revenue-workspace';
import { BAND_LABELS } from '../../lib/enrollment-workspace';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { Button } from '../ui/button';

type BreakdownDimension = 'band' | 'nationality' | 'tariff' | 'category';

const CHART_COLORS = ['#2463EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED'];

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
	chartColors: ReturnType<typeof useChartColors>
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

	return CHART_COLORS[0]!;
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
					<PieChart width={260} height={180}>
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
									fill={CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]!}
								/>
							))}
						</Pie>
						<Tooltip formatter={(value) => formatChartTooltipValue(value)} />
					</PieChart>
				</div>
			</section>

			<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">Monthly trend</h3>
				<div className="mt-3 flex justify-center">
					<BarChart
						width={300}
						height={180}
						data={monthlyTrend.map((item) => ({
							month: item.month,
							amount: toNumber(item.amount),
						}))}
					>
						<XAxis dataKey="month" tickLine={false} axisLine={false} />
						<YAxis hide />
						<Tooltip formatter={(value) => formatChartTooltipValue(value)} />
						<Bar dataKey="amount" fill="#2463EB" radius={[6, 6, 0, 0]} />
					</BarChart>
				</div>
			</section>

			<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
				<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">
					Readiness checklist
				</h3>
				<div className="mt-3 space-y-2 text-(--text-sm)">
					{[
						{ label: 'Fee Grid', ready: readiness?.feeGrid.ready ?? false },
						{
							label: 'Tariff Assignment',
							ready: readiness?.tariffAssignment.ready ?? false,
						},
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
	const clearSelection = useRevenueSelectionStore((state) => state.clearSelection);
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const { data } = useRevenueResults(versionId, viewMode);
	const { data: gradeLevelsData } = useGradeLevels();
	const chartColors = useChartColors();

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
		() => getChartFillColor(viewMode, label, gradeBandMap, chartColors),
		[chartColors, gradeBandMap, label, viewMode]
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
				<div
					className={cn(
						'rounded-lg border border-(--inspector-section-border)',
						'bg-(--workspace-bg-card) px-3 py-3'
					)}
				>
					<p
						className={cn(
							'text-(--text-xs) font-semibold uppercase',
							'tracking-[0.08em] text-(--text-muted)'
						)}
					>
						Gross Revenue
					</p>
					<p
						className={cn(
							'mt-2 font-[family-name:var(--font-mono)]',
							'text-(--text-xl) font-semibold text-(--text-primary)'
						)}
					>
						{formatCompactSar(aggregates.grossRevenue)}
					</p>
					<p className="mt-1 text-(--text-xs) text-(--text-muted)">
						{aggregates.headcount} revenue entries
					</p>
				</div>
				<div
					className={cn(
						'rounded-lg border border-(--inspector-section-border)',
						'bg-(--workspace-bg-card) px-3 py-3'
					)}
				>
					<p
						className={cn(
							'text-(--text-xs) font-semibold uppercase',
							'tracking-[0.08em] text-(--text-muted)'
						)}
					>
						Net Revenue
					</p>
					<p
						className={cn(
							'mt-2 font-[family-name:var(--font-mono)]',
							'text-(--text-xl) font-semibold text-(--text-primary)'
						)}
					>
						{formatCompactSar(aggregates.netRevenue)}
					</p>
					<p className="mt-1 text-(--text-xs) text-(--text-muted)">
						{aggregates.discountImpact}% discount impact
					</p>
				</div>
			</div>

			{/* Revenue share indicator */}
			{selectedRow && (
				<div
					className={cn(
						'rounded-lg border border-(--workspace-border)',
						'bg-(--workspace-bg-subtle) px-3 py-2'
					)}
				>
					<p className="text-(--text-sm) text-(--text-secondary)">
						{formatRevenueGridPercent(selectedRow.percentageOfRevenue)} of total revenue
					</p>
				</div>
			)}

			{/* Monthly Trend Chart */}
			<div>
				<h4
					className={cn(
						'mb-2 text-(--text-xs) font-semibold uppercase',
						'tracking-[0.06em] text-(--text-muted)'
					)}
				>
					Monthly trend
				</h4>
				<div
					className={cn(
						'rounded-lg border border-(--inspector-section-border)',
						'bg-(--workspace-bg-card) p-3'
					)}
				>
					<div className="flex justify-center">
						<BarChart width={300} height={160} data={monthlyTrend}>
							<XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
							<YAxis hide />
							<Tooltip formatter={(value) => formatChartTooltipValue(value)} />
							<Bar dataKey="amount" fill={chartFill} radius={[6, 6, 0, 0]} />
						</BarChart>
					</div>
				</div>
			</div>

			{/* Contextual Breakdowns */}
			{breakdowns.map((breakdown) => (
				<div key={breakdown.title}>
					<h4
						className={cn(
							'mb-2 text-(--text-xs) font-semibold uppercase',
							'tracking-[0.06em] text-(--text-muted)'
						)}
					>
						{breakdown.title}
					</h4>
					<div className={cn('overflow-hidden rounded-lg border', 'border-(--workspace-border)')}>
						{breakdown.rows.length === 0 ? (
							<div className="px-3 py-6 text-center text-(--text-sm) text-(--text-muted)">
								No additional breakdown is available for this row.
							</div>
						) : (
							<div className="divide-y divide-(--workspace-border)">
								{breakdown.rows.map((row) => {
									const dot = getBreakdownDotColor(breakdown.key, row.label);
									const rowTotal = new Decimal(aggregates.grossRevenue);
									const rowAmount = new Decimal(row.amount);
									const percent = rowTotal.eq(0)
										? '0.0'
										: rowAmount.div(rowTotal).mul(100).toFixed(1);

									return (
										<div
											key={`${breakdown.title}-${row.label}`}
											className={cn('flex items-center justify-between', 'gap-3 px-3 py-2')}
										>
											<span
												className={cn(
													'inline-flex items-center gap-1.5',
													'text-(--text-sm) text-(--text-secondary)'
												)}
											>
												{dot && (
													<span
														className={cn('inline-block h-2 w-2 rounded-full', dot)}
														aria-hidden="true"
													/>
												)}
												{row.label}
											</span>
											<span className="flex items-center gap-2">
												<span
													className={cn(
														'font-[family-name:var(--font-mono)]',
														'text-(--text-sm) tabular-nums',
														'text-(--text-primary)'
													)}
												>
													{formatCompactSar(row.amount)}
												</span>
												<span
													className={cn('text-(--text-xs) tabular-nums', 'text-(--text-muted)')}
												>
													{percent}%
												</span>
											</span>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			))}

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
			<div>
				<h4
					className={cn(
						'mb-2 text-(--text-xs) font-semibold uppercase',
						'tracking-[0.06em] text-(--text-muted)'
					)}
				>
					How revenue is calculated
				</h4>
				<div
					className={cn(
						'rounded-lg border border-(--inspector-section-border)',
						'bg-(--workspace-bg-card) p-3'
					)}
				>
					<div className="flex items-start gap-3">
						<span
							className={cn(
								'mt-0.5 inline-flex h-8 w-8 items-center',
								'justify-center rounded-lg bg-(--accent-50)'
							)}
						>
							<Sigma className="h-4 w-4 text-(--accent-700)" aria-hidden="true" />
						</span>
						<div className="space-y-1">
							<p className="text-(--text-sm) font-semibold text-(--text-primary)">
								{formulaString}
							</p>
							<p className="text-(--text-xs) text-(--text-muted)">
								All values are HT (hors taxe). Discount rates and tariff assignments are configured
								in Revenue Settings.
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Band aggregate context (grade view only) */}
			{bandAggregateContext && (
				<div
					className={cn(
						'rounded-lg border border-(--inspector-section-border)',
						'bg-(--workspace-bg-card) px-3 py-2.5'
					)}
				>
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
				</div>
			)}
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
