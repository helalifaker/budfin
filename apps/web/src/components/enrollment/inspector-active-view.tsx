import { useMemo, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/cn';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useEnrollmentSelectionStore } from '../../stores/enrollment-selection-store';
import { useHistorical, useHeadcount } from '../../hooks/use-enrollment';
import { useCohortParameters, usePutCohortParameters } from '../../hooks/use-cohort-parameters';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useChartColors } from '../../hooks/use-chart-colors';
import { EditableCell } from '../shared/editable-cell';
import { InspectorNationalityEditor } from './inspector-nationality-editor';
import { InspectorCapacityPreview } from './inspector-capacity-preview';
import type { CohortParameterEntry } from '@budfin/types';

const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

const BAND_BADGE_STYLES: Record<string, string> = {
	MATERNELLE: 'bg-(--badge-maternelle-bg) text-(--badge-maternelle)',
	ELEMENTAIRE: 'bg-(--badge-elementaire-bg) text-(--badge-elementaire)',
	COLLEGE: 'bg-(--badge-college-bg) text-(--badge-college)',
	LYCEE: 'bg-(--badge-lycee-bg) text-(--badge-lycee)',
};

export function InspectorActiveView({ gradeLevel }: { gradeLevel: string }) {
	const { versionId, versionStatus } = useWorkspaceContext();
	const clearSelection = useEnrollmentSelectionStore((s) => s.clearSelection);
	const isReadOnly = versionStatus !== 'Draft';

	const { data: gradeLevelData } = useGradeLevels();
	const { data: historicalData } = useHistorical(5);
	const { data: cohortData } = useCohortParameters(versionId);
	const { data: headcountData } = useHeadcount(versionId);
	const putCohortParams = usePutCohortParameters(versionId);
	const chartColors = useChartColors();

	const gradeInfo = useMemo(() => {
		const gl = gradeLevelData?.gradeLevels?.find((g) => g.gradeCode === gradeLevel);
		return gl ?? null;
	}, [gradeLevelData, gradeLevel]);

	const isPS = gradeLevel === 'PS';
	const band = gradeInfo?.band ?? '';

	// Historical chart data for this specific grade
	const gradeHistory = useMemo(() => {
		if (!historicalData?.data) return [];
		const gradeData = historicalData.data.filter((d) => d.gradeLevel === gradeLevel);
		return gradeData
			.sort((a, b) => a.academicYear - b.academicYear)
			.map((d) => ({ year: d.academicYear, headcount: d.headcount }));
	}, [historicalData, gradeLevel]);

	// Current cohort parameters
	const cohortEntry = useMemo(() => {
		return cohortData?.entries?.find((c) => c.gradeLevel === gradeLevel) ?? null;
	}, [cohortData, gradeLevel]);

	const retentionRate = cohortEntry?.retentionRate ?? 0;
	const lateralEntry = cohortEntry?.lateralEntryCount ?? 0;
	const maxClassSize = gradeInfo?.maxClassSize ?? 0;

	// AY1 headcount for capacity preview
	const ay1Headcount = useMemo(() => {
		const entry = headcountData?.entries?.find(
			(e) => e.gradeLevel === gradeLevel && e.academicPeriod === 'AY1'
		);
		return entry?.headcount ?? 0;
	}, [headcountData, gradeLevel]);

	// Debounced cohort parameter update
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		};
	}, []);

	const handleCohortChange = useCallback(
		(field: 'retentionRate' | 'lateralEntryCount', value: number) => {
			if (isReadOnly || !versionId) return;
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
			saveTimerRef.current = setTimeout(() => {
				const entry: CohortParameterEntry = {
					gradeLevel: gradeLevel as CohortParameterEntry['gradeLevel'],
					retentionRate: cohortEntry?.retentionRate ?? 0,
					lateralEntryCount: cohortEntry?.lateralEntryCount ?? 0,
					lateralWeightFr: cohortEntry?.lateralWeightFr ?? 0,
					lateralWeightNat: cohortEntry?.lateralWeightNat ?? 0,
					lateralWeightAut: cohortEntry?.lateralWeightAut ?? 0,
					[field]: value,
				};
				putCohortParams.mutate([entry]);
			}, 300);
		},
		[isReadOnly, versionId, gradeLevel, cohortEntry, putCohortParams]
	);

	// Projected AY2
	const projectedAy2 = isPS ? 0 : Math.floor(ay1Headcount * retentionRate + lateralEntry);
	const sectionsNeeded = maxClassSize > 0 ? Math.ceil(projectedAy2 / maxClassSize) : 0;
	const utilization =
		maxClassSize > 0 && sectionsNeeded > 0
			? (projectedAy2 / (sectionsNeeded * maxClassSize)) * 100
			: 0;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={clearSelection}
					className={cn(
						'rounded-md p-1',
						'text-(--text-muted) hover:text-(--text-primary)',
						'hover:bg-(--workspace-bg-muted)',
						'transition-colors duration-(--duration-fast)'
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
				<h3 className="text-(--text-lg) font-semibold text-(--text-primary) font-[family-name:var(--font-display)]">
					{gradeInfo?.gradeName ?? gradeLevel}
				</h3>
			</div>

			{/* Historical Trend Chart */}
			{gradeHistory.length >= 2 && (
				<div>
					<h4 className="text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted) mb-2">
						Historical Trend
					</h4>
					<div className="rounded-lg border border-(--inspector-section-border) p-3 bg-(--workspace-bg-card)">
						<ResponsiveContainer width="100%" height={120}>
							<LineChart data={gradeHistory}>
								<XAxis dataKey="year" tick={{ fontSize: 10 }} stroke={chartColors.axis} />
								<YAxis tick={{ fontSize: 10 }} stroke={chartColors.axis} width={35} />
								<Tooltip
									contentStyle={{
										fontSize: 11,
										borderRadius: 6,
										border: `1px solid ${chartColors.tooltipBorder}`,
									}}
								/>
								<Line
									type="monotone"
									dataKey="headcount"
									stroke={chartColors.maternelle}
									strokeWidth={2}
									dot={{ r: 3 }}
									activeDot={{ r: 5 }}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>
			)}

			{/* Assumptions */}
			{!isPS && (
				<div>
					<h4 className="text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted) mb-2">
						Assumptions
					</h4>
					<div className="space-y-2 rounded-lg border border-(--inspector-section-border) p-3 bg-(--workspace-bg-card)">
						<div className="flex items-center justify-between">
							<span className="text-(--text-sm) text-(--text-secondary)">Retention Rate</span>
							<div className="w-20">
								<EditableCell
									value={Math.round(retentionRate * 100)}
									onChange={(val) => handleCohortChange('retentionRate', val)}
									type="percentage"
									isReadOnly={isReadOnly}
								/>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-(--text-sm) text-(--text-secondary)">Lateral Entries</span>
							<div className="w-20">
								<EditableCell
									value={lateralEntry}
									onChange={(val) => handleCohortChange('lateralEntryCount', val)}
									type="number"
									isReadOnly={isReadOnly}
								/>
							</div>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-(--text-sm) text-(--text-secondary)">Max Class Size</span>
							<span className="text-(--text-sm) tabular-nums font-[family-name:var(--font-mono)] text-(--text-muted)">
								{maxClassSize}
							</span>
						</div>
						{gradeHistory.length >= 3 && (
							<div className="mt-1 flex items-center gap-1.5">
								<span className="inline-block h-1.5 w-1.5 rounded-full bg-(--color-success)" />
								<span className="text-(--text-xs) text-(--text-muted)">
									Informed by {gradeHistory.length} years of data
								</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Nationality Weights */}
			{!isPS && (
				<InspectorNationalityEditor
					gradeLevel={gradeLevel}
					versionId={versionId}
					isReadOnly={isReadOnly}
				/>
			)}

			{/* Capacity Preview */}
			{!isPS && (
				<InspectorCapacityPreview
					projectedAy2={projectedAy2}
					sectionsNeeded={sectionsNeeded}
					utilization={utilization}
					maxClassSize={maxClassSize}
				/>
			)}
		</div>
	);
}
