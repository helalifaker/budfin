import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useHeadcount } from '../../hooks/use-enrollment';
import { useGradeLevels } from '../../hooks/use-grade-levels';
import { MousePointerClick, Calculator, BarChart3, Sparkles } from 'lucide-react';
import { SeedPreviewDialog } from './seed-preview-dialog';

const STEPS = [
	{
		icon: MousePointerClick,
		title: 'Enter AY1',
		description: 'Input current year headcounts',
	},
	{
		icon: Calculator,
		title: 'Configure Retention',
		description: 'Set retention rates and lateral entries',
	},
	{
		icon: BarChart3,
		title: 'Calculate',
		description: 'Run capacity calculation',
	},
] as const;

const BANDS = ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'] as const;
const BAND_LABELS: Record<string, string> = {
	MATERNELLE: 'Maternelle',
	ELEMENTAIRE: 'Elementaire',
	COLLEGE: 'College',
	LYCEE: 'Lycee',
};

export function InspectorDefaultView() {
	const { versionId } = useWorkspaceContext();
	const { data: headcountData } = useHeadcount(versionId);
	const { data: gradeLevelData } = useGradeLevels();
	const [seedOpen, setSeedOpen] = useState(false);

	const bandSummary = useMemo(() => {
		const entries = headcountData?.entries ?? [];
		const gradeLevels = gradeLevelData?.gradeLevels ?? [];
		const gradeMap = new Map(gradeLevels.map((gl) => [gl.gradeCode, gl.band]));

		const summary: Record<string, { ay1: number; ay2: number }> = {};
		for (const band of BANDS) {
			summary[band] = { ay1: 0, ay2: 0 };
		}

		for (const e of entries) {
			const band = gradeMap.get(e.gradeLevel);
			if (band && summary[band]) {
				if (e.academicPeriod === 'AY1') summary[band].ay1 += e.headcount;
				if (e.academicPeriod === 'AY2') summary[band].ay2 += e.headcount;
			}
		}

		return BANDS.map((band) => {
			const s = summary[band] ?? { ay1: 0, ay2: 0 };
			return {
				band,
				label: BAND_LABELS[band],
				ay1: s.ay1,
				ay2: s.ay2,
				change: s.ay1 > 0 ? ((s.ay2 - s.ay1) / s.ay1) * 100 : 0,
			};
		});
	}, [headcountData, gradeLevelData]);

	return (
		<div className="space-y-5">
			{/* Prompt */}
			<div className="text-center py-3">
				<p className="text-(--text-sm) text-(--text-muted)">
					Select a grade row to inspect details
				</p>
			</div>

			{/* Getting Started */}
			<div>
				<h4 className="text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted) mb-2">
					Getting Started
				</h4>
				<div className="space-y-2">
					{STEPS.map((step, i) => {
						const Icon = step.icon;
						return (
							<div
								key={step.title}
								className={cn(
									'flex items-start gap-3 rounded-lg p-2.5',
									'border border-(--workspace-border)',
									'bg-(--workspace-bg-card)',
									'animate-stagger-reveal'
								)}
								style={{ animationDelay: `${i * 50}ms` }}
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

			{/* Band Summary */}
			<div>
				<h4 className="text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted) mb-2">
					Summary by Band
				</h4>
				<div className="rounded-lg border border-(--workspace-border) overflow-hidden">
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
									<td className="px-3 py-1.5 text-right tabular-nums font-[family-name:var(--font-mono)]">
										{row.ay1}
									</td>
									<td className="px-3 py-1.5 text-right tabular-nums font-[family-name:var(--font-mono)]">
										{row.ay2}
									</td>
									<td
										className={cn(
											'px-3 py-1.5 text-right tabular-nums font-[family-name:var(--font-mono)]',
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

			{/* Quick Actions */}
			<div>
				<h4 className="text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted) mb-2">
					Quick Actions
				</h4>
				<button
					type="button"
					onClick={() => setSeedOpen(true)}
					className={cn(
						'flex w-full items-center gap-2 rounded-lg p-2.5',
						'border border-(--workspace-border)',
						'bg-(--workspace-bg-card)',
						'text-(--text-sm) font-medium text-(--text-primary)',
						'hover:bg-(--accent-50) hover:border-(--accent-200)',
						'transition-colors duration-(--duration-fast)'
					)}
				>
					<Sparkles className="h-4 w-4 text-(--accent-500)" aria-hidden="true" />
					Auto-seed from History
				</button>
			</div>

			<SeedPreviewDialog open={seedOpen} onClose={() => setSeedOpen(false)} />
		</div>
	);
}
