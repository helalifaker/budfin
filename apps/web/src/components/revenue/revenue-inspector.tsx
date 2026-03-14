import { useMemo } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Grid3x3, Percent, ShieldCheck, Tag, Calculator } from 'lucide-react';
import Decimal from 'decimal.js';
import type { RevenueReadinessResponse, RevenueResultsResponse } from '@budfin/types';
import { cn } from '../../lib/cn';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useRevenueReadiness, useRevenueResults } from '../../hooks/use-revenue';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { registerPanelContent } from '../../lib/right-panel-registry';
import {
	buildRevenueForecastGridRows,
	formatRevenueGridAmount,
	formatRevenueGridPercent,
} from '../../lib/revenue-workspace';
import { BAND_LABELS } from '../../lib/enrollment-workspace';
import { formatMoney } from '../../lib/format-money';
import { BAND_DOT_COLORS, NATIONALITY_STYLES } from '../../lib/band-styles';
import { useChartColor, useChartSeriesColors, CHART_TOOLTIP_STYLE } from '../../lib/chart-utils';
import { useRevenueSelectionStore } from '../../stores/revenue-selection-store';
import { useRevenueSettingsDialogStore } from '../../stores/revenue-settings-dialog-store';
import { InspectorSection } from '../shared/inspector-section';
import { SummaryTable } from '../shared/summary-table';
import { WorkflowStatusCard } from '../shared/workflow-status-card';
type WorkflowVariant = 'success' | 'warning' | 'info';
import { ReadinessIndicator } from '../shared/readiness-indicator';
import { ChartWrapper } from '../shared/chart-wrapper';
import { Button } from '../ui/button';

type BreakdownDimension = 'band' | 'nationality' | 'tariff' | 'category';

const BANDS = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;
const NATIONALITIES = ['Francais', 'Nationaux', 'Autres'] as const;
const REVENUE_MONTH_LABELS = [
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

const WORKFLOW_STEPS = [
	{
		icon: Grid3x3,
		title: 'Configure fee grid',
		description: 'Set tuition and registration fees for each grade and nationality.',
	},
	{
		icon: Tag,
		title: 'Assign tariffs',
		description: 'Map students to RP, R3+, or Plein tariff profiles.',
	},
	{
		icon: Percent,
		title: 'Set discounts',
		description: 'Configure RP and R3+ discount rates for the version.',
	},
	{
		icon: Calculator,
		title: 'Calculate revenue',
		description: 'Run the revenue engine to produce monthly forecasts.',
	},
] as const;

const READINESS_AREAS: Array<{
	key: keyof Pick<
		RevenueReadinessResponse,
		'feeGrid' | 'tariffAssignment' | 'discounts' | 'derivedRevenueSettings' | 'otherRevenue'
	>;
	label: string;
	tab: 'feeGrid' | 'tariffAssignment' | 'discounts' | 'otherRevenue';
}> = [
	{ key: 'feeGrid', label: 'Fee Grid', tab: 'feeGrid' },
	{ key: 'tariffAssignment', label: 'Tariff Assignment', tab: 'tariffAssignment' },
	{ key: 'discounts', label: 'Discounts', tab: 'discounts' },
	{ key: 'derivedRevenueSettings', label: 'Derived Revenue Rates', tab: 'otherRevenue' },
	{ key: 'otherRevenue', label: 'Other Revenue', tab: 'otherRevenue' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function getWorkflowStatus(readiness: RevenueReadinessResponse | undefined): {
	text: string;
	variant: WorkflowVariant;
} {
	if (!readiness) {
		return { text: 'Loading...', variant: 'info' };
	}
	if (readiness.overallReady) {
		return { text: 'Setup complete', variant: 'success' };
	}
	if (readiness.readyCount > 0) {
		return { text: 'Setup pending', variant: 'warning' };
	}
	return { text: 'Setup pending', variant: 'warning' };
}

function getValidationIssueCount(readiness: RevenueReadinessResponse | undefined): number {
	if (!readiness) return 0;
	return READINESS_AREAS.filter((area) => !readiness[area.key].ready).length;
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

// ── Band/Nationality Revenue Summaries ──────────────────────────────────────

function buildBandRevenueSummary(
	data: RevenueResultsResponse | undefined,
	gradeBandMap: Map<string, string>
) {
	if (!data) return [];

	const bandTotals = new Map<string, { gross: Decimal; net: Decimal }>();
	for (const band of BANDS) {
		bandTotals.set(band, { gross: new Decimal(0), net: new Decimal(0) });
	}

	for (const entry of data.entries) {
		const band = gradeBandMap.get(entry.gradeLevel) ?? 'Other';
		const existing = bandTotals.get(band);
		if (!existing) continue;
		existing.gross = existing.gross.plus(new Decimal(entry.grossRevenueHt));
		existing.net = existing.net.plus(new Decimal(entry.netRevenueHt));
	}

	const grandGross = [...bandTotals.values()].reduce(
		(sum, val) => sum.plus(val.gross),
		new Decimal(0)
	);

	return BANDS.map((band) => {
		const totals = bandTotals.get(band) ?? { gross: new Decimal(0), net: new Decimal(0) };
		const pctOfTotal = grandGross.isZero()
			? '0.0%'
			: `${totals.gross.div(grandGross).mul(100).toFixed(1)}%`;
		return {
			band,
			label: BAND_LABELS[band] ?? band,
			gross: totals.gross.toFixed(4),
			net: totals.net.toFixed(4),
			pctOfTotal,
		};
	});
}

function buildNationalityRevenueSummary(data: RevenueResultsResponse | undefined) {
	if (!data) return [];

	const natTotals = new Map<string, { gross: Decimal; net: Decimal }>();
	for (const nat of NATIONALITIES) {
		natTotals.set(nat, { gross: new Decimal(0), net: new Decimal(0) });
	}

	for (const entry of data.entries) {
		const existing = natTotals.get(entry.nationality);
		if (!existing) continue;
		existing.gross = existing.gross.plus(new Decimal(entry.grossRevenueHt));
		existing.net = existing.net.plus(new Decimal(entry.netRevenueHt));
	}

	const grandGross = [...natTotals.values()].reduce(
		(sum, val) => sum.plus(val.gross),
		new Decimal(0)
	);

	return NATIONALITIES.map((nat) => {
		const totals = natTotals.get(nat) ?? { gross: new Decimal(0), net: new Decimal(0) };
		const pctOfTotal = grandGross.isZero()
			? '0.0%'
			: `${totals.gross.div(grandGross).mul(100).toFixed(1)}%`;
		return {
			nationality: nat,
			gross: totals.gross.toFixed(4),
			net: totals.net.toFixed(4),
			pctOfTotal,
		};
	});
}

// ── Default View (9 sections) ───────────────────────────────────────────────

function RevenueInspectorDefaultView() {
	const { versionId } = useWorkspaceContext();
	const openSettings = useRevenueSettingsDialogStore((state) => state.open);
	const { data } = useRevenueResults(versionId, 'category');
	const { data: readiness } = useRevenueReadiness(versionId);
	const { data: gradeLevelsData } = useGradeLevels();
	const chartColor = useChartColor('primary');
	const seriesColors = useChartSeriesColors([
		'--chart-series-1',
		'--chart-series-2',
		'--chart-series-3',
		'--chart-series-4',
		'--chart-series-5',
	]);

	const gradeBandMap = useMemo(
		() => new Map((gradeLevelsData?.gradeLevels ?? []).map((gl) => [gl.gradeCode, gl.band])),
		[gradeLevelsData?.gradeLevels]
	);

	const bandRevenue = useMemo(
		() => buildBandRevenueSummary(data, gradeBandMap),
		[data, gradeBandMap]
	);

	const nationalityRevenue = useMemo(() => buildNationalityRevenueSummary(data), [data]);

	const composition = data?.executiveSummary.composition ?? [];
	const monthlyTrend = data?.executiveSummary.monthlyTrend ?? [];

	const workflowStatus = getWorkflowStatus(readiness);
	const validationIssueCount = getValidationIssueCount(readiness);
	const nonReadyAreas = READINESS_AREAS.filter((area) => readiness && !readiness[area.key].ready);

	const totalEnrolled = useMemo(() => {
		if (!data) return 0;
		const gradeSet = new Set<string>();
		for (const entry of data.entries) {
			gradeSet.add(`${entry.gradeLevel}-${entry.nationality}-${entry.tariff}`);
		}
		return gradeSet.size;
	}, [data]);

	if (!versionId) {
		return (
			<p className="text-(--text-sm) text-(--text-muted)">Select a version to inspect revenue.</p>
		);
	}

	return (
		<div className="space-y-5">
			{/* Section 1: Workflow status card */}
			<WorkflowStatusCard
				label="Revenue Workflow"
				status={workflowStatus.text}
				icon={ShieldCheck}
				statusVariant={workflowStatus.variant as 'success' | 'warning' | 'info'}
			/>

			{/* Section 2: Readiness counters */}
			<div className="grid gap-3 md:grid-cols-2">
				<InspectorSection title="Config coverage">
					<ReadinessIndicator
						ready={readiness?.readyCount ?? 0}
						total={readiness?.totalCount ?? 5}
					/>
				</InspectorSection>
				<InspectorSection title="Validation issues">
					<p className="text-(--text-sm) font-medium">{validationIssueCount} issues</p>
				</InspectorSection>
			</div>

			{/* Section 3: Revenue assumptions table */}
			<InspectorSection title="Revenue assumptions">
				<SummaryTable
					rows={[
						{
							label: 'RP discount rate',
							amount: readiness?.discounts.rpRate
								? `${new Decimal(readiness.discounts.rpRate).mul(100).toFixed(1)}%`
								: '--',
						},
						{
							label: 'R3+ discount rate',
							amount: readiness?.discounts.r3Rate
								? `${new Decimal(readiness.discounts.r3Rate).mul(100).toFixed(1)}%`
								: '--',
						},
						{
							label: 'Enrolled students',
							amount: String(totalEnrolled),
						},
						{
							label: 'Enrollment source',
							amount: 'Cohort model',
						},
					]}
				/>
				<Button
					variant="outline"
					size="sm"
					className="mt-3 w-full"
					onClick={() => openSettings('feeGrid')}
				>
					Open Revenue Settings
				</Button>
			</InspectorSection>

			{/* Section 4: Recommended workflow */}
			<InspectorSection title="Recommended workflow">
				<div className="rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card)">
					{WORKFLOW_STEPS.map((step, index) => {
						const Icon = step.icon;
						return (
							<div
								key={step.title}
								className={cn(
									'animate-stagger-reveal flex items-start gap-3 p-2.5',
									'border-b border-(--workspace-border) last:border-b-0'
								)}
								style={{ animationDelay: `${index * 60}ms` }}
							>
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-(--accent-50)">
									<Icon className="h-3.5 w-3.5 text-(--accent-500)" aria-hidden="true" />
								</span>
								<div>
									<p className="text-(--text-sm) font-medium text-(--text-primary)">{step.title}</p>
									<p className="text-(--text-xs) text-(--text-muted)">{step.description}</p>
								</div>
							</div>
						);
					})}
				</div>
			</InspectorSection>

			{/* Section 5: Validation queue */}
			<InspectorSection title="Validation queue">
				<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
					<table className="w-full text-(--text-sm)">
						<thead>
							<tr className="bg-(--workspace-bg-muted)">
								<th className="px-3 py-1.5 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Area
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Status
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Action
								</th>
							</tr>
						</thead>
						<tbody>
							{nonReadyAreas.length === 0 ? (
								<tr>
									<td
										colSpan={3}
										className="px-3 py-6 text-center text-(--text-sm) text-(--text-muted)"
									>
										All areas configured.
									</td>
								</tr>
							) : (
								nonReadyAreas.map((area) => (
									<tr key={area.key} className="border-t border-(--workspace-border)">
										<td className="px-3 py-1.5 font-medium">
											<span className="inline-flex items-center gap-1.5">
												<span
													className="inline-block h-2 w-2 rounded-full bg-(--color-warning)"
													aria-hidden="true"
												/>
												{area.label}
											</span>
										</td>
										<td className="px-3 py-1.5 text-right text-(--text-muted)">Needs attention</td>
										<td className="px-3 py-1.5 text-right">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => openSettings(area.tab)}
											>
												Edit
											</Button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</InspectorSection>

			{/* Section 6: Revenue by Band summary */}
			<InspectorSection title="Revenue by Band">
				<SummaryTable
					header={{ label: 'Band', amount: 'Gross', percent: '% Total' }}
					rows={bandRevenue.map((row) => {
						const dot = BAND_DOT_COLORS[row.band];
						return {
							...(dot ? { dot } : {}),
							label: row.label,
							amount: formatMoney(row.gross),
							percent: row.pctOfTotal,
						};
					})}
				/>
			</InspectorSection>

			{/* Section 7: Revenue by Nationality summary */}
			<InspectorSection title="Revenue by Nationality">
				<SummaryTable
					header={{ label: 'Nationality', amount: 'Gross', percent: '% Total' }}
					rows={nationalityRevenue.map((row) => {
						const dot = NATIONALITY_STYLES[row.nationality as string]?.color;
						return {
							...(dot ? { dot } : {}),
							label: row.nationality as string,
							amount: formatMoney(row.gross),
							percent: row.pctOfTotal,
						};
					})}
				/>
			</InspectorSection>

			{/* Section 8: Revenue composition donut chart */}
			<InspectorSection title="Revenue composition">
				<ChartWrapper height={200}>
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
								<Cell key={item.label} fill={seriesColors[index % seriesColors.length]!} />
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
			<InspectorSection title="Monthly trend">
				<ChartWrapper height={200}>
					<BarChart
						data={monthlyTrend.map((item) => ({
							month: REVENUE_MONTH_LABELS[item.month - 1] ?? `M${item.month}`,
							amount: toNumber(item.amount),
						}))}
					>
						<XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
						<YAxis hide />
						<Tooltip
							formatter={(value) => formatChartTooltipValue(value)}
							contentStyle={CHART_TOOLTIP_STYLE}
						/>
						<Bar dataKey="amount" fill={chartColor} radius={[6, 6, 0, 0]} />
					</BarChart>
				</ChartWrapper>
			</InspectorSection>
		</div>
	);
}

// ── Active View (row selected) ──────────────────────────────────────────────

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
					<BarChart width={300} height={160} data={monthlyTrend ?? []}>
						<XAxis dataKey="month" tickLine={false} axisLine={false} />
						<YAxis hide />
						<Tooltip formatter={(value) => formatChartTooltipValue(value)} />
						<Bar dataKey="amount" fill="#16A34A" radius={[6, 6, 0, 0]} />
					</BarChart>
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

// ── Content Wrapper ─────────────────────────────────────────────────────────

function RevenueInspectorContent() {
	const selection = useRevenueSelectionStore((state) => state.selection);

	return (
		<div className="relative min-h-full" aria-live="polite">
			{!selection ? (
				<div className="animate-inspector-crossfade">
					<RevenueInspectorDefaultView />
				</div>
			) : (
				<div
					key={`${selection.viewMode}-${selection.label}`}
					className="animate-inspector-crossfade"
				>
					<RevenueInspectorActiveView label={selection.label} viewMode={selection.viewMode} />
				</div>
			)}
		</div>
	);
}

registerPanelContent('revenue', RevenueInspectorContent);

export { RevenueInspectorContent };
