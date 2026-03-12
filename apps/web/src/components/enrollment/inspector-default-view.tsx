import { useMemo, useState } from 'react';
import { ClipboardCheck, Rows3, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useHeadcount } from '../../hooks/use-enrollment';
import { useCohortParameters } from '../../hooks/use-cohort-parameters';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { usePlanningRules, usePutPlanningRules } from '../../hooks/use-planning-rules';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
	buildAy1HeadcountMap,
	buildCapacityPreviewRows,
	buildCohortProjectionRows,
	buildMasterGridRows,
	DEFAULT_PLANNING_RULES,
	deriveEnrollmentEditability,
	getPsAy2Headcount,
	isCohortEntryOverridden,
	BAND_LABELS,
} from '../../lib/enrollment-workspace';

const WORKFLOW_STEPS = [
	{
		icon: ClipboardCheck,
		title: 'Validate intake',
		description: 'Use the setup wizard to confirm the baseline, import deltas, and AY1 intake.',
	},
	{
		icon: Rows3,
		title: 'Tune rules',
		description: 'Adjust rollover threshold and capped retention before accepting suggestions.',
	},
	{
		icon: Sparkles,
		title: 'Work exceptions',
		description:
			'Keep the master grid focused on grades that are near capacity or manually overridden.',
	},
] as const;

const BANDS = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;

export function InspectorDefaultView() {
	const { versionId, versionStatus, versionDataSource } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const { data: headcountData } = useHeadcount(versionId);
	const { data: cohortData } = useCohortParameters(versionId);
	const { data: gradeLevelData } = useGradeLevels();
	const { data: planningRulesData } = usePlanningRules(versionId);
	const putPlanningRules = usePutPlanningRules(versionId);
	const [draftRulesOverride, setDraftRulesOverride] = useState<
		null | typeof DEFAULT_PLANNING_RULES
	>(null);
	const draftRules = draftRulesOverride ?? planningRulesData ?? DEFAULT_PLANNING_RULES;

	const editability = deriveEnrollmentEditability({
		role: user?.role ?? null,
		versionStatus,
		dataSource: versionDataSource,
	});

	const gradeLevels = useMemo(
		() => gradeLevelData?.gradeLevels ?? [],
		[gradeLevelData?.gradeLevels]
	);
	const headcountEntries = useMemo(() => headcountData?.entries ?? [], [headcountData?.entries]);
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
				planningRules: cohortData?.planningRules ?? DEFAULT_PLANNING_RULES,
			}),
		[ay1HeadcountMap, cohortData?.planningRules, cohortEntries, gradeLevels, psAy2Headcount]
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
				planningRules: cohortData?.planningRules ?? DEFAULT_PLANNING_RULES,
			}),
		[
			ay1HeadcountMap,
			capacityRows,
			cohortData?.planningRules,
			cohortEntries,
			gradeLevels,
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

	return (
		<div className="space-y-5">
			<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-4">
				<div className="flex items-start gap-3">
					<span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-(--accent-50)">
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
							Use the grid for operations, the wizard for intake resets, and this panel for rules
							and exception triage.
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

			<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h4 className="text-(--text-sm) font-semibold text-(--text-primary)">Planning rules</h4>
						<p className="text-(--text-xs) text-(--text-muted)">
							These govern the suggested cohort defaults across the version.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setDraftRulesOverride(null)}
						>
							Reset
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={() => putPlanningRules.mutate(draftRules)}
							disabled={editability !== 'editable'}
						>
							Save rules
						</Button>
					</div>
				</div>
				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<div>
						<label className="block text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							Rollover threshold
						</label>
						<Input
							type="number"
							min={0.5}
							max={2}
							step={0.01}
							value={draftRules.rolloverThreshold}
							onChange={(event) =>
								setDraftRulesOverride((current) => ({
									...(current ?? draftRules),
									rolloverThreshold: Number(event.target.value),
								}))
							}
							disabled={editability !== 'editable'}
							className={cn(
								'mt-2 w-full rounded-md border border-(--workspace-border) bg-(--cell-editable-bg) px-3 py-2',
								'font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)'
							)}
						/>
					</div>
					<div>
						<label className="block text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
							Capped retention
						</label>
						<Input
							type="number"
							min={0.5}
							max={1}
							step={0.01}
							value={draftRules.cappedRetention}
							onChange={(event) =>
								setDraftRulesOverride((current) => ({
									...(current ?? draftRules),
									cappedRetention: Number(event.target.value),
								}))
							}
							disabled={editability !== 'editable'}
							className={cn(
								'mt-2 w-full rounded-md border border-(--workspace-border) bg-(--cell-editable-bg) px-3 py-2',
								'font-[family-name:var(--font-mono)] tabular-nums text-(--text-primary)'
							)}
						/>
					</div>
				</div>
			</div>

			<div>
				<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
					Recommended workflow
				</h4>
				<div className="space-y-2">
					{WORKFLOW_STEPS.map((step, index) => {
						const Icon = step.icon;
						return (
							<div
								key={step.title}
								className={cn(
									'animate-stagger-reveal rounded-lg border border-(--workspace-border) bg-(--workspace-bg-card) p-2.5',
									'flex items-start gap-3'
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
								exceptionRows.map((row) => (
									<tr key={row.gradeLevel} className="border-t border-(--workspace-border)">
										<td className="px-3 py-1.5 font-medium">{row.gradeName}</td>
										<td className="px-3 py-1.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
											{row.ay2Headcount}
										</td>
										<td className="px-3 py-1.5 text-right text-(--text-muted)">
											{row.alert ?? 'Override'}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

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
							{bandSummary.map((row) => (
								<tr key={row.band} className="border-t border-(--workspace-border)">
									<td className="px-3 py-1.5 font-medium">{row.label}</td>
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
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
