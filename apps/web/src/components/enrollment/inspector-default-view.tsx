import { useMemo } from 'react';
import { ClipboardCheck, Rows3, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useEnrollmentSettings, useHeadcount, useHistorical } from '../../hooks/use-enrollment';
import { useCohortParameters } from '../../hooks/use-cohort-parameters';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { useEnrollmentSettingsSheetStore } from '../../stores/enrollment-settings-store';
import { useNationalityBreakdown } from '../../hooks/use-nationality-breakdown';
import { Button } from '../ui/button';
import {
	buildAy1HeadcountMap,
	buildBandNationalitySummary,
	buildCapacityPreviewRows,
	buildCohortProjectionRows,
	buildMasterGridRows,
	DEFAULT_PLANNING_RULES,
	deriveEnrollmentEditability,
	getPsAy2Headcount,
	isCohortEntryOverridden,
	resolveEnrollmentGradeLevels,
} from '../../lib/enrollment-workspace';
import { BAND_DOT_COLORS, BAND_LABELS } from '../../lib/band-styles';

const WORKFLOW_STEPS = [
	{
		icon: ClipboardCheck,
		title: 'Validate intake',
		description: 'Use the setup wizard to confirm the baseline, import deltas, and AY1 intake.',
	},
	{
		icon: Rows3,
		title: 'Open settings',
		description:
			'Manage rollover rules and version-level capacity policy from Enrollment Settings.',
	},
	{
		icon: Sparkles,
		title: 'Work exceptions',
		description:
			'Keep the master grid focused on grades that are near capacity or manually overridden.',
	},
] as const;

const BANDS = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;

const ALERT_DOT_COLORS: Record<string, string> = {
	OVER: 'bg-(--color-error)',
	NEAR_CAP: 'bg-(--color-warning)',
	Override: 'bg-(--accent-500)',
};

function getWorkflowAccent(label: string): { border: string; iconBg: string } {
	switch (label) {
		case 'Setup complete':
			return { border: 'border-l-(--color-success)', iconBg: 'bg-(--color-success)/15' };
		case 'Setup pending':
			return { border: 'border-l-(--color-warning)', iconBg: 'bg-(--color-warning)/15' };
		case 'Review mode':
			return { border: 'border-l-(--color-info)', iconBg: 'bg-(--color-info)/15' };
		default:
			return { border: 'border-l-(--accent-500)', iconBg: 'bg-(--accent-50)' };
	}
}

export function InspectorDefaultView() {
	const { versionId, fiscalYear, versionStatus, versionDataSource } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const { data: headcountData } = useHeadcount(versionId);
	const { data: historicalData } = useHistorical(5);
	const { data: cohortData } = useCohortParameters(versionId);
	const { data: gradeLevelData } = useGradeLevels();
	const { data: enrollmentSettingsData } = useEnrollmentSettings(versionId);
	const { data: natData } = useNationalityBreakdown(versionId, 'AY2');
	const openEnrollmentSettings = useEnrollmentSettingsSheetStore((state) => state.open);

	const editability = deriveEnrollmentEditability({
		role: user?.role ?? null,
		versionStatus,
		dataSource: versionDataSource,
	});

	const gradeLevels = useMemo(
		() =>
			resolveEnrollmentGradeLevels({
				gradeLevels: gradeLevelData?.gradeLevels ?? [],
				capacityByGrade: enrollmentSettingsData?.capacityByGrade,
			}),
		[enrollmentSettingsData?.capacityByGrade, gradeLevelData?.gradeLevels]
	);
	const headcountEntries = useMemo(() => headcountData?.entries ?? [], [headcountData?.entries]);
	const historicalEntries = useMemo(() => historicalData?.data ?? [], [historicalData?.data]);
	const cohortEntries = useMemo(() => cohortData?.entries ?? [], [cohortData?.entries]);
	const ay1HeadcountMap = useMemo(() => buildAy1HeadcountMap(headcountEntries), [headcountEntries]);
	const psDefaultAy2Intake =
		gradeLevels.find((gradeLevel) => gradeLevel.gradeCode === 'PS')?.defaultAy2Intake ?? null;
	const psAy2Headcount = getPsAy2Headcount(
		headcountEntries,
		ay1HeadcountMap,
		null,
		psDefaultAy2Intake
	);
	const projectionRows = useMemo(
		() =>
			buildCohortProjectionRows({
				gradeLevels,
				ay1HeadcountMap,
				cohortEntries,
				psAy2Headcount,
				planningRules:
					enrollmentSettingsData?.rules ?? cohortData?.planningRules ?? DEFAULT_PLANNING_RULES,
				historicalEntries,
				targetFiscalYear: fiscalYear,
			}),
		[
			ay1HeadcountMap,
			cohortEntries,
			cohortData?.planningRules,
			enrollmentSettingsData?.rules,
			fiscalYear,
			gradeLevels,
			historicalEntries,
			psAy2Headcount,
		]
	);
	const capacityRows = useMemo(
		() =>
			buildCapacityPreviewRows({
				gradeLevels,
				ay1HeadcountMap,
				projectionRows,
			}),
		[ay1HeadcountMap, gradeLevels, projectionRows]
	);
	const masterRows = useMemo(
		() =>
			buildMasterGridRows({
				gradeLevels,
				ay1HeadcountMap,
				cohortEntries,
				psAy2Headcount,
				capacityResults: capacityRows,
				planningRules:
					enrollmentSettingsData?.rules ?? cohortData?.planningRules ?? DEFAULT_PLANNING_RULES,
				historicalEntries,
				targetFiscalYear: fiscalYear,
			}),
		[
			ay1HeadcountMap,
			capacityRows,
			cohortEntries,
			cohortData?.planningRules,
			enrollmentSettingsData?.rules,
			fiscalYear,
			gradeLevels,
			historicalEntries,
			psAy2Headcount,
		]
	);

	const exceptionRows = useMemo(
		() =>
			masterRows.filter((row) => {
				const cohortEntry = cohortEntries.find((entry) => entry.gradeLevel === row.gradeLevel);
				return (
					row.alert === 'OVER' ||
					row.alert === 'NEAR_CAP' ||
					(cohortEntry ? isCohortEntryOverridden(cohortEntry) : false)
				);
			}),
		[cohortEntries, masterRows]
	);

	const bandSummary = useMemo(() => {
		const summary: Record<string, { ay1: number; ay2: number }> = {};
		for (const band of BANDS) {
			summary[band] = { ay1: 0, ay2: 0 };
		}

		for (const row of masterRows) {
			const currentBand = summary[row.band];
			if (!currentBand) {
				continue;
			}

			currentBand.ay1 += row.ay1Headcount;
			currentBand.ay2 += row.ay2Headcount;
		}

		return BANDS.map((band) => {
			const totals = summary[band] ?? { ay1: 0, ay2: 0 };
			return {
				band,
				label: BAND_LABELS[band],
				ay1: totals.ay1,
				ay2: totals.ay2,
				change: totals.ay1 > 0 ? ((totals.ay2 - totals.ay1) / totals.ay1) * 100 : 0,
			};
		});
	}, [masterRows]);

	const bandNationality = useMemo(
		() => buildBandNationalitySummary(natData?.entries ?? [], gradeLevels),
		[natData?.entries, gradeLevels]
	);

	const ay1ConfiguredCount = new Set(
		headcountEntries
			.filter((entry) => entry.academicPeriod === 'AY1')
			.map((entry) => entry.gradeLevel)
	).size;
	const expectedAy1Count = gradeLevels.length;
	const cohortConfiguredCount = cohortEntries.filter(
		(entry) => entry.gradeLevel !== 'PS' && entry.isPersisted
	).length;
	const expectedCohortCount = gradeLevels.filter(
		(gradeLevel) => gradeLevel.gradeCode !== 'PS'
	).length;
	const readinessLabel =
		editability === 'editable'
			? ay1ConfiguredCount === expectedAy1Count && cohortConfiguredCount === expectedCohortCount
				? 'Setup complete'
				: 'Setup pending'
			: 'Review mode';

	const workflowAccent = getWorkflowAccent(readinessLabel);
	const planningRules =
		enrollmentSettingsData?.rules ?? cohortData?.planningRules ?? DEFAULT_PLANNING_RULES;

	return (
		<div className="space-y-5">
			{/* 4a: Workflow status card with semantic left accent */}
			<div
				className={cn(
					'rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-4',
					'border-l-[3px]',
					workflowAccent.border
				)}
			>
				<div className="flex items-start gap-3">
					<span
						className={cn(
							'mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl',
							workflowAccent.iconBg
						)}
					>
						<ShieldCheck className="h-4 w-4 text-(--accent-700)" aria-hidden="true" />
					</span>
					<div className="space-y-1">
						<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							Enrollment workflow
						</p>
						<h3 className="text-(--text-lg) font-semibold text-(--text-primary)">
							{readinessLabel}
						</h3>
						<p className="text-(--text-sm) text-(--text-secondary)">
							Use the grid for operations, the wizard for intake resets, and Enrollment Settings for
							version-wide assumptions.
						</p>
					</div>
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						AY1 coverage
					</p>
					<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">
						{ay1ConfiguredCount}/{expectedAy1Count}
					</p>
				</div>
				<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						Exception queue
					</p>
					<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">
						{exceptionRows.length}
					</p>
				</div>
			</div>

			{/* 4b: Settings card — compact key-value table with action row */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Planning rules
				</h4>
				<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
					<div className="divide-y divide-(--workspace-border)">
						{[
							{
								label: 'Rollover threshold',
								value: `${Math.round(planningRules.rolloverThreshold * 100)}%`,
							},
							{
								label: 'Retention cap',
								value: `${Math.round((planningRules.cappedRetention ?? 0.98) * 100)}%`,
							},
							{
								label: 'Recent-year weight',
								value: `${Math.round(planningRules.retentionRecentWeight * 100)}%`,
							},
							{
								label: 'Target trend weight',
								value: `${Math.round(planningRules.historicalTargetRecentWeight * 100)}%`,
							},
						].map((item) => (
							<div key={item.label} className="flex items-center justify-between px-3 py-2">
								<span className="text-(--text-sm) text-(--text-secondary)">{item.label}</span>
								<span className="font-[family-name:var(--font-mono)] text-(--text-sm) tabular-nums text-(--text-primary)">
									{item.value}
								</span>
							</div>
						))}
					</div>
					<div className="border-t border-(--workspace-border) bg-(--workspace-bg-muted) px-3 py-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full"
							onClick={openEnrollmentSettings}
						>
							Open Enrollment Settings
						</Button>
					</div>
				</div>
			</div>

			{/* 4c: Recommended workflow -- divider-separated list in one card */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Recommended workflow
				</h4>
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
								style={{ animationDelay: `${index * 50}ms` }}
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
			</div>

			{/* 4d: Exception queue with alert color indicators */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Exception queue
				</h4>
				<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
					<table className="w-full text-(--text-sm)">
						<thead>
							<tr className="bg-(--workspace-bg-muted)">
								<th className="px-3 py-1.5 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Grade
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									AY2
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Alert
								</th>
							</tr>
						</thead>
						<tbody>
							{exceptionRows.length === 0 ? (
								<tr>
									<td
										colSpan={3}
										className="px-3 py-6 text-center text-(--text-sm) text-(--text-muted)"
									>
										No active exceptions. The grid is clean right now.
									</td>
								</tr>
							) : (
								exceptionRows.map((row) => {
									const alertLabel = row.alert ?? 'Override';
									const dotColor = ALERT_DOT_COLORS[alertLabel] ?? '';
									return (
										<tr key={row.gradeLevel} className="border-t border-(--workspace-border)">
											<td className="px-3 py-1.5 font-medium">{row.gradeName}</td>
											<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
												{row.ay2Headcount}
											</td>
											<td className="px-3 py-1.5 text-right text-(--text-muted)">
												<span className="inline-flex items-center gap-1.5">
													<span
														className={cn('inline-block h-2 w-2 rounded-full', dotColor)}
														aria-hidden="true"
													/>
													{alertLabel}
												</span>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* 4e: Band summary with color dots */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Summary by Band
				</h4>
				<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
					<table className="w-full text-(--text-sm)">
						<thead>
							<tr className="bg-(--workspace-bg-muted)">
								<th className="px-3 py-1.5 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Band
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									AY1
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									AY2
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									%
								</th>
							</tr>
						</thead>
						<tbody>
							{bandSummary.map((row) => {
								const dotColor = BAND_DOT_COLORS[row.band] ?? '';
								return (
									<tr key={row.band} className="border-t border-(--workspace-border)">
										<td className="px-3 py-1.5 font-medium">
											<span className="inline-flex items-center gap-1.5">
												<span
													className={cn('inline-block h-2 w-2 rounded-full', dotColor)}
													aria-hidden="true"
												/>
												{row.label}
											</span>
										</td>
										<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
											{row.ay1}
										</td>
										<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
											{row.ay2}
										</td>
										<td
											className={cn(
												'px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums',
												row.change > 0 && 'text-(--color-success)',
												row.change < 0 && 'text-(--color-error)',
												row.change === 0 && 'text-(--text-muted)'
											)}
										>
											{row.change > 0 ? '+' : ''}
											{row.change.toFixed(1)}%
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
			{/* 4f: Nationality by Band */}
			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Nationality by Band
				</h4>
				<div className="overflow-hidden rounded-lg border border-(--workspace-border)">
					<table className="w-full text-(--text-sm)">
						<thead>
							<tr className="bg-(--workspace-bg-muted)">
								<th className="px-3 py-1.5 text-left text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Band
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Fr%
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Nat%
								</th>
								<th className="px-3 py-1.5 text-right text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
									Aut%
								</th>
							</tr>
						</thead>
						<tbody>
							{bandNationality.map((row) => {
								const dotColor = BAND_DOT_COLORS[row.band] ?? '';
								return (
									<tr key={row.band} className="border-t border-(--workspace-border)">
										<td className="px-3 py-1.5 font-medium">
											<span className="inline-flex items-center gap-1.5">
												<span
													className={cn('inline-block h-2 w-2 rounded-full', dotColor)}
													aria-hidden="true"
												/>
												{row.label}
											</span>
										</td>
										<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
											{row.total === 0 ? '--' : `${row.francaisPct.toFixed(1)}%`}
										</td>
										<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
											{row.total === 0 ? '--' : `${row.nationauxPct.toFixed(1)}%`}
										</td>
										<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
											{row.total === 0 ? '--' : `${row.autresPct.toFixed(1)}%`}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
