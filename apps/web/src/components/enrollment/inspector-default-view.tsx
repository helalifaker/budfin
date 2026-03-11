import { useMemo } from 'react';
import { ClipboardCheck, Rows3, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import { useHeadcount } from '../../hooks/use-enrollment';
import { useCohortParameters } from '../../hooks/use-cohort-parameters';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { deriveEnrollmentEditability, BAND_LABELS } from '../../lib/enrollment-workspace';

const WORKFLOW_STEPS = [
	{
		icon: ClipboardCheck,
		title: 'Validate the baseline',
		description: 'Start with the setup wizard to review prior-year actuals or imported AY1 data.',
	},
	{
		icon: Rows3,
		title: 'Confirm progression assumptions',
		description:
			'Retention and lateral entries should be validated before operational edits begin.',
	},
	{
		icon: Sparkles,
		title: 'Operate in the workspace',
		description: 'Use the grid for quick changes and the inspector for selected-grade decisions.',
	},
] as const;

const BANDS = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;

export function InspectorDefaultView() {
	const { versionId, versionStatus, versionDataSource } = useWorkspaceContext();
	const user = useAuthStore((state) => state.user);
	const { data: headcountData } = useHeadcount(versionId);
	const { data: cohortData } = useCohortParameters(versionId);
	const { data: gradeLevelData } = useGradeLevels();

	const editability = deriveEnrollmentEditability({
		role: user?.role ?? null,
		versionStatus,
		dataSource: versionDataSource,
	});

	const bandSummary = useMemo(() => {
		const entries = headcountData?.entries ?? [];
		const gradeLevels = gradeLevelData?.gradeLevels ?? [];
		const gradeMap = new Map(
			gradeLevels.map((gradeLevel) => [gradeLevel.gradeCode, gradeLevel.band])
		);

		const summary: Record<string, { ay1: number; ay2: number }> = {};
		for (const band of BANDS) {
			summary[band] = { ay1: 0, ay2: 0 };
		}

		for (const entry of entries) {
			const band = gradeMap.get(entry.gradeLevel);
			if (!band || !summary[band]) {
				continue;
			}

			if (entry.academicPeriod === 'AY1') {
				summary[band].ay1 += entry.headcount;
			}
			if (entry.academicPeriod === 'AY2') {
				summary[band].ay2 += entry.headcount;
			}
		}

		return BANDS.map((band) => {
			const value = summary[band] ?? { ay1: 0, ay2: 0 };
			return {
				band,
				label: BAND_LABELS[band],
				ay1: value.ay1,
				ay2: value.ay2,
				change: value.ay1 > 0 ? ((value.ay2 - value.ay1) / value.ay1) * 100 : 0,
			};
		});
	}, [gradeLevelData?.gradeLevels, headcountData?.entries]);

	const ay1ConfiguredCount = useMemo(
		() =>
			new Set(
				(headcountData?.entries ?? [])
					.filter((entry) => entry.academicPeriod === 'AY1')
					.map((entry) => entry.gradeLevel)
			).size,
		[headcountData?.entries]
	);
	const expectedAy1Count = gradeLevelData?.gradeLevels.length ?? 0;
	const cohortConfiguredCount = useMemo(
		() =>
			(cohortData?.entries ?? []).filter((entry) => entry.gradeLevel !== 'PS' && entry.isPersisted)
				.length,
		[cohortData?.entries]
	);
	const expectedCohortCount = useMemo(
		() =>
			(gradeLevelData?.gradeLevels ?? []).filter((gradeLevel) => gradeLevel.gradeCode !== 'PS')
				.length,
		[gradeLevelData?.gradeLevels]
	);
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
							Select a grade row for detailed planning, or use the setup wizard from the page header
							for a full data validation pass.
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
					<p className="mt-1 text-(--text-xs) text-(--text-muted)">
						Every grade should have a persisted AY1 headcount before the workspace is treated as
						configured.
					</p>
				</div>
				<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-3">
					<p className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						Cohort coverage
					</p>
					<p className="mt-2 text-(--text-xl) font-semibold text-(--text-primary)">
						{cohortConfiguredCount}/{expectedCohortCount}
					</p>
					<p className="mt-1 text-(--text-xs) text-(--text-muted)">
						Retention and laterals must be validated for all non-PS grades before setup is complete.
					</p>
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
