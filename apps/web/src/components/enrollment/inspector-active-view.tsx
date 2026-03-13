import { useCallback, useMemo } from 'react';
import { ArrowLeft, Sigma } from 'lucide-react';
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import type { CohortParameterEntry, GradeCode } from '@budfin/types';
import { cn } from '../../lib/cn';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useEnrollmentSelectionStore } from '../../stores/enrollment-selection-store';
import {
	useEnrollmentSettings,
	useEnrollmentSetupBaseline,
	useHeadcount,
	useHistorical,
	usePutHeadcount,
} from '../../hooks/use-enrollment';
import { useCohortParameters, usePutCohortParameters } from '../../hooks/use-cohort-parameters';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useChartColors } from '../../hooks/use-chart-colors';
import { InspectorInput } from '../shared/inspector-input';
import { InspectorNationalityEditor } from './inspector-nationality-editor';
import { InspectorCapacityPreview } from './inspector-capacity-preview';
import { useNationalityBreakdown } from '../../hooks/use-nationality-breakdown';
import {
	buildAy1HeadcountMap,
	buildBandNationalitySummary,
	buildCapacityPreviewRow,
	buildCohortProjectionRows,
	DEFAULT_PLANNING_RULES,
	deriveEnrollmentEditability,
	getPsAy2Headcount,
	isCohortEntryOverridden,
	BAND_LABELS,
	resolveEnrollmentGradeLevels,
} from '../../lib/enrollment-workspace';

const BAND_BADGE_STYLES: Record<string, string> = {
	MATERNELLE: 'bg-(--badge-maternelle-bg) text-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire-bg) text-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college-bg) text-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee-bg) text-(--badge-lycee)',
};

function getBandColor(band: string, colors: ReturnType<typeof useChartColors>): string {
	switch (band) {
		case 'MATERNELLE':
			return colors.maternelle;
		case 'ELEMENTAIRE':
			return colors.elementaire;
		case 'COLLEGE':
			return colors.college;
		case 'LYCEE':
			return colors.lycee;
		default:
			return colors.fallback;
	}
}

function ReadOnlyValue({ value, label }: { value: string | number | null; label: string }) {
	const display =
		value === null || value === undefined ? (
			<span className="italic text-(--text-muted)">n/a</span>
		) : (
			value
		);

	return (
		<div className="flex items-center justify-between">
			<span className="text-(--text-sm) text-(--text-secondary)">{label}</span>
			<span className="font-[family-name:var(--font-mono)] text-(--text-sm) tabular-nums text-(--text-primary)">
				{display}
			</span>
		</div>
	);
}

export function InspectorActiveView({ gradeLevel }: { gradeLevel: string }) {
	const { fiscalYear, versionId, versionStatus, versionDataSource } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const clearSelection = useEnrollmentSelectionStore((state) => state.clearSelection);
	const isReadOnly =
		deriveEnrollmentEditability({
			role: user?.role ?? null,
			versionStatus,
			dataSource: versionDataSource,
		}) !== 'editable';

	const { data: gradeLevelData } = useGradeLevels();
	const { data: historicalData } = useHistorical(5);
	const { data: cohortData } = useCohortParameters(versionId);
	const { data: headcountData } = useHeadcount(versionId);
	const { data: baselineData } = useEnrollmentSetupBaseline(versionId);
	const { data: enrollmentSettingsData } = useEnrollmentSettings(versionId);
	const { data: natData } = useNationalityBreakdown(versionId, 'AY2');
	const putCohortParams = usePutCohortParameters(versionId);
	const putHeadcount = usePutHeadcount(versionId);
	const chartColors = useChartColors();
	const headcountEntries = useMemo(() => headcountData?.entries ?? [], [headcountData?.entries]);
	const cohortEntries = useMemo(() => cohortData?.entries ?? [], [cohortData?.entries]);
	const planningRules =
		enrollmentSettingsData?.rules ?? cohortData?.planningRules ?? DEFAULT_PLANNING_RULES;
	const gradeLevels = useMemo(
		() =>
			resolveEnrollmentGradeLevels({
				gradeLevels: gradeLevelData?.gradeLevels ?? [],
				capacityByGrade: enrollmentSettingsData?.capacityByGrade,
			}),
		[enrollmentSettingsData?.capacityByGrade, gradeLevelData?.gradeLevels]
	);
	const historicalEntries = useMemo(() => historicalData?.data ?? [], [historicalData?.data]);

	const gradeInfo = useMemo(
		() => gradeLevels.find((entry) => entry.gradeCode === gradeLevel) ?? null,
		[gradeLevel, gradeLevels]
	);
	const isPS = gradeLevel === 'PS';
	const band = gradeInfo?.band ?? '';
	const bandColor = getBandColor(band, chartColors);

	const gradeHistory = useMemo(() => {
		return historicalEntries
			.filter((entry) => entry.gradeLevel === gradeLevel)
			.sort((left, right) => left.academicYear - right.academicYear)
			.map((entry) => ({
				year: entry.academicYear,
				headcount: entry.headcount,
			}));
	}, [gradeLevel, historicalEntries]);

	const cohortEntry = useMemo(
		() => cohortEntries.find((entry) => entry.gradeLevel === gradeLevel) ?? null,
		[cohortEntries, gradeLevel]
	);
	const ay1HeadcountMap = useMemo(() => buildAy1HeadcountMap(headcountEntries), [headcountEntries]);
	const defaultAy2Intake = gradeInfo?.defaultAy2Intake ?? null;
	const psAy2Headcount = useMemo(
		() => getPsAy2Headcount(headcountEntries, ay1HeadcountMap, null, defaultAy2Intake),
		[ay1HeadcountMap, defaultAy2Intake, headcountEntries]
	);
	const projectionRow = useMemo(() => {
		if (gradeLevels.length === 0) {
			return null;
		}

		return (
			buildCohortProjectionRows({
				gradeLevels,
				ay1HeadcountMap,
				cohortEntries,
				psAy2Headcount,
				planningRules,
				historicalEntries,
				targetFiscalYear: fiscalYear,
			}).find((entry) => entry.gradeLevel === gradeLevel) ?? null
		);
	}, [
		ay1HeadcountMap,
		cohortEntries,
		fiscalYear,
		gradeLevel,
		gradeLevels,
		historicalEntries,
		planningRules,
		psAy2Headcount,
	]);

	const ay1Headcount = projectionRow?.ay1Headcount ?? 0;
	const projectedAy2 = projectionRow?.ay2Headcount ?? 0;
	const retentionRate = cohortEntry?.retentionRate ?? projectionRow?.retentionRate ?? 0;
	const trendRetentionRate =
		projectionRow?.trendRetentionRate ?? cohortEntry?.historicalTrendRetention ?? null;
	const retainedFromPrior = projectionRow?.retainedFromPrior ?? cohortEntry?.retainedFromPrior ?? 0;
	const historicalTargetHeadcount =
		projectionRow?.historicalTargetHeadcount ?? cohortEntry?.historicalTargetHeadcount ?? null;
	const derivedLaterals = projectionRow?.lateralEntry ?? cohortEntry?.derivedLaterals ?? 0;
	const manualAdjustment = cohortEntry?.manualAdjustment ?? projectionRow?.manualAdjustment ?? 0;
	const recommendedRetention =
		cohortEntry?.recommendedRetentionRate ?? trendRetentionRate ?? retentionRate;
	const recommendedLaterals =
		cohortEntry?.recommendedLateralEntryCount ?? projectionRow?.lateralEntry ?? 0;
	const isManualOverride = cohortEntry ? isCohortEntryOverridden(cohortEntry) : false;
	const maxClassSize = gradeInfo?.maxClassSize ?? 0;
	const baselineHeadcount =
		baselineData?.entries.find((entry) => entry.gradeLevel === gradeLevel)?.baselineHeadcount ??
		null;
	const baselineDelta = baselineHeadcount === null ? null : ay1Headcount - baselineHeadcount;
	const priorGrade = useMemo(() => {
		if (!projectionRow || projectionRow.isPS) {
			return null;
		}

		return (
			gradeLevels.find((entry) => entry.displayOrder === projectionRow.displayOrder - 1) ?? null
		);
	}, [gradeLevels, projectionRow]);
	const priorGradeAy1 = priorGrade
		? (ay1HeadcountMap.get(priorGrade.gradeCode as GradeCode) ?? 0)
		: null;
	const capacityPreview = buildCapacityPreviewRow({
		gradeLevel,
		academicPeriod: 'AY2',
		headcount: projectedAy2,
		maxClassSize,
		plafondPct: Number(gradeInfo?.plafondPct ?? 0),
	});
	const chartData = useMemo(() => {
		if (gradeHistory.length === 0) {
			return [];
		}

		const lastPoint = gradeHistory[gradeHistory.length - 1]!;
		const projectionYear = Math.max(fiscalYear, lastPoint.year + 1);

		return [
			...gradeHistory.map((point, index) => ({
				year: point.year,
				actual: point.headcount,
				projection: index === gradeHistory.length - 1 ? point.headcount : null,
			})),
			{
				year: projectionYear,
				actual: null,
				projection: projectedAy2,
			},
		];
	}, [fiscalYear, gradeHistory, projectedAy2]);

	const bandNatContext = useMemo(() => {
		if (!band) return null;
		const all = buildBandNationalitySummary(natData?.entries ?? [], gradeLevels);
		return all.find((row) => row.band === band) ?? null;
	}, [band, gradeLevels, natData?.entries]);

	const handleCohortChange = useCallback(
		(
			field: keyof Pick<CohortParameterEntry, 'retentionRate' | 'manualAdjustment'>,
			value: number
		) => {
			if (isReadOnly || !versionId) {
				return;
			}

			const baseEntry: CohortParameterEntry = {
				gradeLevel: gradeLevel as CohortParameterEntry['gradeLevel'],
				retentionRate: cohortEntry?.retentionRate ?? retentionRate,
				manualAdjustment,
				lateralEntryCount: manualAdjustment,
				lateralWeightFr: cohortEntry?.lateralWeightFr ?? 0,
				lateralWeightNat: cohortEntry?.lateralWeightNat ?? 0,
				lateralWeightAut: cohortEntry?.lateralWeightAut ?? 0,
			};

			putCohortParams.mutate({
				entries: [
					{
						...baseEntry,
						[field]: field === 'retentionRate' ? value : Math.round(value),
					},
				],
			});
		},
		[
			cohortEntry,
			gradeLevel,
			isReadOnly,
			manualAdjustment,
			putCohortParams,
			retentionRate,
			versionId,
		]
	);

	const handlePsAy2Change = useCallback(
		(value: number) => {
			if (isReadOnly || !versionId || !isPS) {
				return;
			}

			putHeadcount.mutate([
				{
					gradeLevel: gradeLevel as GradeCode,
					academicPeriod: 'AY2',
					headcount: Math.max(0, Math.round(value)),
				},
			]);
		},
		[gradeLevel, isPS, isReadOnly, putHeadcount, versionId]
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={clearSelection}
					className={cn(
						'rounded-md p-1 text-(--text-muted) transition-colors duration-(--duration-fast)',
						'hover:bg-(--workspace-bg-muted) hover:text-(--text-primary)'
					)}
					aria-label="Back to overview"
				>
					<ArrowLeft className="h-4 w-4" />
				</button>
				{band && (
					<span
						className={cn(
							'rounded-sm px-1.5 py-0.5 text-(--text-xs) font-medium',
							BAND_BADGE_STYLES[band] ?? ''
						)}
					>
						{BAND_LABELS[band] ?? band}
					</span>
				)}
				<h3 className="font-[family-name:var(--font-display)] text-(--text-lg) font-semibold text-(--text-primary)">
					{gradeInfo?.gradeName ?? gradeLevel}
				</h3>
				<span className="rounded-full bg-(--workspace-bg-subtle) px-2 py-0.5 text-(--text-xs) font-semibold text-(--text-muted)">
					{gradeLevel}
				</span>
				{isManualOverride && (
					<span className="rounded-full bg-(--accent-50) px-2 py-0.5 text-(--text-xs) font-semibold text-(--accent-700)">
						Manual override
					</span>
				)}
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<div className="rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) px-3 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						Current AY1
					</p>
					<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">
						{ay1Headcount}
					</p>
					<p className="mt-1 text-(--text-xs) text-(--text-muted)">
						{baselineDelta === null
							? 'No prior-year baseline was available.'
							: `${baselineDelta > 0 ? '+' : ''}${baselineDelta} vs prior-year Actual AY2`}
					</p>
				</div>
				<div className="rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) px-3 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						Projected AY2
					</p>
					<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">
						{projectedAy2}
					</p>
					<p className="mt-1 text-(--text-xs) text-(--text-muted)">
						{capacityPreview.sectionsNeeded > 0
							? `${capacityPreview.sectionsNeeded} sections · ${capacityPreview.utilization.toFixed(1)}% utilization`
							: 'No capacity pressure yet'}
					</p>
				</div>
			</div>

			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Historical Trend
				</h4>
				<div className="rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) p-3">
					{chartData.length > 0 ? (
						<ResponsiveContainer width="100%" height={148}>
							<LineChart data={chartData}>
								<CartesianGrid stroke={chartColors.grid} strokeDasharray="4 4" />
								<XAxis dataKey="year" tick={{ fontSize: 10 }} stroke={chartColors.axis} />
								<YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} width={36} />
								<Tooltip
									contentStyle={{
										fontSize: 11,
										borderRadius: 8,
										border: `1px solid ${chartColors.tooltipBorder}`,
										backgroundColor: 'var(--workspace-bg-card)',
									}}
								/>
								<Line
									type="monotone"
									dataKey="actual"
									name="Actual"
									stroke={bandColor}
									strokeWidth={2}
									dot={{ r: 3 }}
									activeDot={{ r: 5 }}
								/>
								<Line
									type="monotone"
									dataKey="projection"
									name="Current plan"
									stroke={chartColors.total}
									strokeWidth={2}
									strokeDasharray="6 4"
									connectNulls
									dot={{ r: 3 }}
								/>
							</LineChart>
						</ResponsiveContainer>
					) : (
						<div className="rounded-lg bg-(--workspace-bg-subtle) px-3 py-6 text-center text-(--text-sm) text-(--text-muted)">
							No historical series is available for this grade yet.
						</div>
					)}
				</div>
			</div>

			{/* Your inputs -- editable fields */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Your inputs
				</h4>
				<div className="space-y-2 rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) p-3">
					{isPS ? (
						<div className="flex items-center justify-between gap-3">
							<p className="text-(--text-sm) font-medium text-(--text-primary)">AY2 intake</p>
							<InspectorInput
								value={projectedAy2}
								onChange={handlePsAy2Change}
								type="number"
								min={0}
								isReadOnly={isReadOnly}
								placeholder={defaultAy2Intake ? String(defaultAy2Intake) : 'Enter'}
								aria-label="AY2 intake for Petite Section"
							/>
						</div>
					) : (
						<>
							<div className="flex items-center justify-between">
								<span className="text-(--text-sm) font-medium text-(--text-primary)">
									Retention rate
								</span>
								<InspectorInput
									value={Math.round(retentionRate * 100)}
									onChange={(value) => handleCohortChange('retentionRate', value)}
									type="percentage"
									isReadOnly={isReadOnly || projectionRow?.usesConfiguredRetention !== true}
									aria-label="Retention rate"
								/>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-(--text-sm) font-medium text-(--text-primary)">
									Manual adjustment
								</span>
								<InspectorInput
									value={manualAdjustment}
									onChange={(value) => handleCohortChange('manualAdjustment', value)}
									type="number"
									isReadOnly={isReadOnly}
									placeholder="0"
									aria-label="Manual adjustment"
								/>
							</div>
						</>
					)}
				</div>
			</div>

			{/* Computed values -- read-only */}
			{!isPS && (
				<div>
					<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
						Computed values
					</h4>
					<div className="space-y-2 rounded-lg bg-(--workspace-bg-subtle) p-3">
						<ReadOnlyValue
							label="Trend retention rate"
							value={
								trendRetentionRate === null ? null : `${Math.round(trendRetentionRate * 100)}%`
							}
						/>
						<ReadOnlyValue label="Students retained" value={retainedFromPrior} />
						<ReadOnlyValue label="Historical target" value={historicalTargetHeadcount} />
						<ReadOnlyValue label="Lateral entries" value={derivedLaterals} />
						<ReadOnlyValue
							label="Prior grade (AY1)"
							value={priorGrade ? `${priorGrade.gradeName} · ${priorGradeAy1}` : null}
						/>
						<ReadOnlyValue
							label="Recommended values"
							value={`${Math.round(recommendedRetention * 100)}% · ${recommendedLaterals}`}
						/>
						<ReadOnlyValue label="Max class size" value={maxClassSize} />
					</div>
				</div>
			)}

			{isPS && (
				<div>
					<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
						Computed values
					</h4>
					<div className="space-y-2 rounded-lg bg-(--workspace-bg-subtle) p-3">
						<ReadOnlyValue label="Max class size" value={maxClassSize} />
					</div>
				</div>
			)}

			{/* How AY2 is calculated */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					How AY2 is calculated
				</h4>
				<div className="rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) p-3">
					<div className="flex items-start gap-3">
						<span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-(--accent-50)">
							<Sigma className="h-4 w-4 text-(--accent-700)" aria-hidden="true" />
						</span>
						<div className="space-y-1">
							<p className="text-(--text-sm) font-semibold text-(--text-primary)">
								{isPS
									? `AY2 intake is set to ${projectedAy2} students directly (no progression formula).`
									: `${retainedFromPrior} retained + ${derivedLaterals} lateral entries + ${manualAdjustment} adjustment = ${projectedAy2}`}
							</p>
							<p className="text-(--text-xs) text-(--text-muted)">
								{isPS
									? 'Petite Section bypasses retention and uses a direct AY2 entry.'
									: priorGrade
										? `Based on ${priorGrade.gradeName} AY1 headcount of ${priorGradeAy1}.`
										: 'No prior grade available for this calculation.'}
							</p>
							{cohortEntry?.recommendationSourceFiscalYear && (
								<p className="text-(--text-xs) text-(--text-muted)">
									Source: FY{cohortEntry.recommendationSourceFiscalYear} ·{' '}
									{cohortEntry.recommendationPriorAy1Headcount ?? 0} prior AY1 to{' '}
									{cohortEntry.recommendationAy2Headcount ?? 0} AY2
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{!isPS && (
				<InspectorNationalityEditor
					gradeLevel={gradeLevel}
					versionId={versionId}
					isReadOnly={isReadOnly}
					ay2Headcount={projectedAy2}
				/>
			)}

			{bandNatContext && bandNatContext.total > 0 && (
				<div className="rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) px-3 py-2.5">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						{bandNatContext.label} band context
					</p>
					<p className="mt-1 font-[family-name:var(--font-mono)] text-(--text-sm) tabular-nums text-(--text-secondary)">
						Fr {bandNatContext.francaisPct.toFixed(1)}%{' \u00B7 '}
						Nat {bandNatContext.nationauxPct.toFixed(1)}%{' \u00B7 '}
						Aut {bandNatContext.autresPct.toFixed(1)}%
					</p>
				</div>
			)}

			<InspectorCapacityPreview
				projectedAy2={projectedAy2}
				sectionsNeeded={capacityPreview.sectionsNeeded}
				utilization={capacityPreview.utilization}
				maxClassSize={maxClassSize}
			/>
		</div>
	);
}
