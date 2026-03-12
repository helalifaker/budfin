import { useState, useMemo, useCallback } from 'react';
import { cn } from '../../lib/cn';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useCohortParameters, usePutCohortParameters } from '../../hooks/use-cohort-parameters';
import type { CohortParameterEntry } from '@budfin/types';
import { toast } from '../ui/toast-state';
import { Sparkles, X, Check } from 'lucide-react';

type ConfidenceLevel = 'high' | 'medium' | 'low';

type SeedResult = {
	gradeLevel: string;
	suggestedRetention: number;
	suggestedLaterals: number;
	confidence: ConfidenceLevel;
};

export type SeedPreviewDialogProps = {
	open: boolean;
	onClose: () => void;
};

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { label: string; className: string }> = {
	high: { label: 'High', className: 'text-(--color-success) bg-(--color-success-bg)' },
	medium: { label: 'Medium', className: 'text-(--color-warning) bg-(--color-warning-bg)' },
	low: { label: 'Low', className: 'text-(--text-muted) bg-(--workspace-bg-muted)' },
};

export function SeedPreviewDialog({ open, onClose }: SeedPreviewDialogProps) {
	const { versionId } = useWorkspaceContext();
	const { data: cohortData } = useCohortParameters(versionId);
	const putCohortParams = usePutCohortParameters(versionId);

	const seedResults: SeedResult[] = useMemo(() => {
		return (cohortData?.entries ?? []).map((entry) => ({
			gradeLevel: entry.gradeLevel,
			suggestedRetention: entry.recommendedRetentionRate ?? entry.retentionRate,
			suggestedLaterals: entry.recommendedLateralEntryCount ?? entry.lateralEntryCount,
			confidence: entry.recommendationConfidence ?? 'low',
		}));
	}, [cohortData?.entries]);

	// Track user deselections rather than full accepted set to avoid setState in render
	const [deselected, setDeselected] = useState<Set<string>>(new Set());

	const accepted = useMemo(() => {
		const all = new Set(seedResults.filter((r) => r.gradeLevel !== 'PS').map((r) => r.gradeLevel));
		for (const grade of deselected) {
			all.delete(grade);
		}
		return all;
	}, [seedResults, deselected]);

	const toggleGrade = useCallback((grade: string) => {
		setDeselected((prev) => {
			const next = new Set(prev);
			if (next.has(grade)) next.delete(grade);
			else next.add(grade);
			return next;
		});
	}, []);

	const handleApply = useCallback(() => {
		if (!versionId) return;
		const cohortEntries = cohortData?.entries ?? [];

		const entries: CohortParameterEntry[] = seedResults
			.filter((r) => accepted.has(r.gradeLevel))
			.map((r) => {
				const existing = cohortEntries.find((c) => c.gradeLevel === r.gradeLevel);
				return {
					gradeLevel: r.gradeLevel as CohortParameterEntry['gradeLevel'],
					retentionRate: r.suggestedRetention,
					lateralEntryCount: r.suggestedLaterals,
					lateralWeightFr: existing?.lateralWeightFr ?? 0,
					lateralWeightNat: existing?.lateralWeightNat ?? 0,
					lateralWeightAut: existing?.lateralWeightAut ?? 0,
				};
			});

		putCohortParams.mutate(
			{ entries },
			{
				onSuccess: () => {
					const highCount = seedResults.filter(
						(r) => accepted.has(r.gradeLevel) && r.confidence === 'high'
					).length;
					const medCount = seedResults.filter(
						(r) => accepted.has(r.gradeLevel) && r.confidence === 'medium'
					).length;
					toast.success(
						`Seeded ${accepted.size} grades (${highCount} high confidence, ${medCount} medium)`
					);
					onClose();
				},
			}
		);
	}, [versionId, cohortData, seedResults, accepted, putCohortParams, onClose]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />

			{/* Dialog */}
			<div
				className={cn(
					'relative z-10 w-full max-w-lg rounded-xl',
					'bg-(--workspace-bg-card) shadow-(--shadow-lg)',
					'border border-(--workspace-border)',
					'animate-scale-in'
				)}
				role="dialog"
				aria-modal="true"
				aria-labelledby="seed-dialog-title"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-(--workspace-border) px-5 py-3">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-(--accent-500)" aria-hidden="true" />
						<h2
							id="seed-dialog-title"
							className="text-(--text-lg) font-semibold font-[family-name:var(--font-display)]"
						>
							Auto-Seed from History
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-sm p-1 text-(--text-muted) hover:text-(--text-primary) hover:bg-(--workspace-bg-muted)"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Body */}
				<div className="max-h-80 overflow-y-auto px-5 py-3 scrollbar-thin">
					{seedResults.length === 0 ? (
						<p className="py-8 text-center text-(--text-sm) text-(--text-muted)">
							No historical data available for seeding.
						</p>
					) : (
						<table className="w-full text-(--text-sm)">
							<thead>
								<tr className="text-(--text-xs) uppercase tracking-wider text-(--text-muted)">
									<th className="py-1.5 text-left font-medium">Grade</th>
									<th className="py-1.5 text-right font-medium">Ret%</th>
									<th className="py-1.5 text-right font-medium">Lat</th>
									<th className="py-1.5 text-center font-medium">Conf</th>
									<th className="py-1.5 text-center font-medium">
										<Check className="mx-auto h-3 w-3" aria-hidden="true" />
									</th>
								</tr>
							</thead>
							<tbody>
								{seedResults.map((r) => {
									const isPS = r.gradeLevel === 'PS';
									const confStyle = CONFIDENCE_STYLES[r.confidence];
									return (
										<tr
											key={r.gradeLevel}
											className={cn('border-t border-(--workspace-border)', isPS && 'opacity-50')}
										>
											<td className="py-1.5 font-medium">{r.gradeLevel}</td>
											<td className="py-1.5 text-right tabular-nums font-[family-name:var(--font-mono)]">
												{isPS ? '-' : `${(r.suggestedRetention * 100).toFixed(0)}%`}
											</td>
											<td className="py-1.5 text-right tabular-nums font-[family-name:var(--font-mono)]">
												{isPS ? '-' : r.suggestedLaterals}
											</td>
											<td className="py-1.5 text-center">
												<span
													className={cn(
														'inline-block rounded-sm px-1.5 py-0.5 text-(--text-xs) font-medium',
														confStyle.className
													)}
												>
													{confStyle.label}
												</span>
											</td>
											<td className="py-1.5 text-center">
												{!isPS && (
													<input
														type="checkbox"
														checked={accepted.has(r.gradeLevel)}
														onChange={() => toggleGrade(r.gradeLevel)}
														className="h-3.5 w-3.5 rounded border-(--workspace-border) accent-(--accent-500)"
														aria-label={`Accept seed for ${r.gradeLevel}`}
													/>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between border-t border-(--workspace-border) px-5 py-3">
					<span className="text-(--text-xs) text-(--text-muted)">
						{accepted.size} of {seedResults.filter((r) => r.gradeLevel !== 'PS').length} grades
						selected
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={onClose}
							className={cn(
								'rounded-md px-3 py-1.5 text-(--text-sm) font-medium',
								'border border-(--workspace-border)',
								'text-(--text-secondary) hover:bg-(--workspace-bg-muted)',
								'transition-colors duration-(--duration-fast)'
							)}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleApply}
							disabled={accepted.size === 0 || putCohortParams.isPending}
							className={cn(
								'rounded-md px-3 py-1.5 text-(--text-sm) font-medium',
								'bg-(--accent-500) text-white hover:bg-(--accent-600)',
								'transition-colors duration-(--duration-fast)',
								'disabled:bg-(--workspace-bg-muted) disabled:text-(--text-muted) disabled:cursor-not-allowed'
							)}
						>
							{putCohortParams.isPending ? 'Applying...' : `Apply (${accepted.size})`}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
