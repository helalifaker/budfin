import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { NationalityType } from '@budfin/types';
import { cn } from '../../lib/cn';
import {
	useNationalityBreakdown,
	usePutNationalityBreakdown,
	useResetNationalityBreakdown,
} from '../../hooks/use-nationality-breakdown';
import { useCalculateEnrollment } from '../../hooks/use-enrollment';
import { buildNationalityOverrideRows } from '../../lib/enrollment-workspace';

export type InspectorNationalityEditorProps = {
	gradeLevel: string;
	versionId: number | null;
	isReadOnly: boolean;
	ay2Headcount: number;
};

const NATIONALITIES = [
	{ key: 'Francais', label: 'Francais' },
	{ key: 'Nationaux', label: 'Nationaux' },
	{ key: 'Autres', label: 'Autres' },
] as const;

export function InspectorNationalityEditor({
	gradeLevel,
	versionId,
	isReadOnly,
	ay2Headcount,
}: InspectorNationalityEditorProps) {
	const { data: natData } = useNationalityBreakdown(versionId, 'AY2');
	const putNationality = usePutNationalityBreakdown(versionId);
	const resetNationality = useResetNationalityBreakdown(versionId);
	const calculateEnrollment = useCalculateEnrollment(versionId);

	const gradeEntries = useMemo(
		() => (natData?.entries ?? []).filter((entry) => entry.gradeLevel === gradeLevel),
		[gradeLevel, natData?.entries]
	);

	const weights = useMemo(() => {
		const result: Record<NationalityType, number> = {
			Francais: 0,
			Nationaux: 0,
			Autres: 0,
		};

		for (const entry of gradeEntries) {
			result[entry.nationality] = Math.round(entry.weight * 100);
		}

		return result;
	}, [gradeEntries]);

	const [localWeights, setLocalWeights] = useState(weights);

	useEffect(() => {
		setLocalWeights(weights);
	}, [weights]);

	const sum =
		(localWeights.Francais ?? 0) + (localWeights.Nationaux ?? 0) + (localWeights.Autres ?? 0);
	const isValid = Math.abs(sum - 100) < 0.01;
	const hasOverride = gradeEntries.some((entry) => entry.isOverridden);
	const isBusy =
		putNationality.isPending || resetNationality.isPending || calculateEnrollment.isPending;

	const handleChange = useCallback(
		(nationality: NationalityType, value: number) => {
			if (isReadOnly) {
				return;
			}

			const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
			setLocalWeights((current) => ({
				...current,
				[nationality]: normalizedValue,
			}));
		},
		[isReadOnly]
	);

	const handleSave = useCallback(async () => {
		if (isReadOnly || !versionId || !isValid) {
			return;
		}

		await putNationality.mutateAsync(
			buildNationalityOverrideRows({
				gradeLevel,
				weights: {
					Francais: (localWeights.Francais ?? 0) / 100,
					Nationaux: (localWeights.Nationaux ?? 0) / 100,
					Autres: (localWeights.Autres ?? 0) / 100,
				},
				ay2Headcount,
			})
		);
	}, [ay2Headcount, gradeLevel, isReadOnly, isValid, localWeights, putNationality, versionId]);

	const handleReset = useCallback(async () => {
		if (isReadOnly || !versionId) {
			return;
		}

		await resetNationality.mutateAsync(gradeLevel);
		await calculateEnrollment.mutateAsync();
	}, [calculateEnrollment, gradeLevel, isReadOnly, resetNationality, versionId]);

	return (
		<div>
			<h4 className="mb-2 text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted)">
				Nationality Override
			</h4>
			<div className="space-y-3 rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) p-3">
				<div className="flex items-start justify-between gap-3 rounded-lg border border-(--workspace-border) bg-(--workspace-bg-subtle) px-3 py-2">
					<div>
						<p className="text-(--text-sm) font-semibold text-(--text-primary)">
							{hasOverride ? 'Manual override active' : 'Computed distribution'}
						</p>
						<p className="mt-1 text-(--text-xs) text-(--text-muted)">
							Saving sends the full trio and reconciles counts to {ay2Headcount} projected AY2
							students.
						</p>
					</div>
					<span
						className={cn(
							'inline-flex rounded-full px-2 py-0.5 text-(--text-xs) font-semibold',
							hasOverride
								? 'bg-(--cell-override-bg) text-(--badge-lycee)'
								: 'bg-(--workspace-bg-card) text-(--text-muted)'
						)}
					>
						{hasOverride ? 'Override' : 'Computed'}
					</span>
				</div>

				{NATIONALITIES.map((nationality) => (
					<div key={nationality.key} className="flex items-center justify-between">
						<span className="text-(--text-sm) text-(--text-secondary)">{nationality.label}</span>
						<div className="flex items-center gap-1">
							<input
								type="number"
								min={0}
								max={100}
								value={localWeights[nationality.key] ?? 0}
								onChange={(event) => handleChange(nationality.key, Number(event.target.value))}
								disabled={isReadOnly || isBusy}
								className={cn(
									'w-16 rounded-sm border border-(--workspace-border) px-2 py-1',
									'bg-(--cell-editable-bg) text-right text-(length:--text-sm) tabular-nums',
									'focus:outline-none focus:ring-2 focus:ring-(--accent-400)',
									(isReadOnly || isBusy) && 'cursor-not-allowed bg-(--cell-readonly-bg)'
								)}
								aria-label={`${nationality.label} weight percentage`}
							/>
							<span className="text-(--text-xs) text-(--text-muted)">%</span>
						</div>
					</div>
				))}

				<div className="space-y-1">
					<div className="flex justify-between text-(--text-xs) tabular-nums">
						<span className="text-(--text-muted)">Total</span>
						<span
							className={cn(
								'font-medium',
								isValid ? 'text-(--color-success)' : 'text-(--color-error)'
							)}
						>
							{sum}%
						</span>
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-(--workspace-bg-muted)">
						<div
							className={cn(
								'h-full rounded-full transition-all duration-(--duration-normal)',
								isValid ? 'bg-(--color-success)' : 'bg-(--color-error)'
							)}
							style={{ width: `${Math.min(sum, 100)}%` }}
						/>
					</div>
				</div>

				{!isReadOnly && (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => void handleSave()}
							disabled={!isValid || isBusy}
							className={cn(
								'flex-1 rounded-md border px-3 py-1.5 text-(--text-sm) font-medium',
								'transition-colors duration-(--duration-fast)',
								isValid && !isBusy
									? 'border-(--accent-300) bg-(--accent-50) text-(--accent-700) hover:border-(--accent-400)'
									: 'cursor-not-allowed border-(--workspace-border) bg-(--workspace-bg-muted) text-(--text-muted)'
							)}
						>
							{putNationality.isPending ? 'Saving...' : 'Save Override'}
						</button>
						<button
							type="button"
							onClick={() => void handleReset()}
							disabled={!hasOverride || isBusy}
							className={cn(
								'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-(--text-sm) font-medium',
								'transition-colors duration-(--duration-fast)',
								hasOverride && !isBusy
									? 'border-(--workspace-border-strong) bg-(--workspace-bg-card) text-(--text-secondary) hover:border-(--accent-200) hover:text-(--text-primary)'
									: 'cursor-not-allowed border-(--workspace-border) bg-(--workspace-bg-muted) text-(--text-muted)'
							)}
						>
							<RotateCcw className="h-4 w-4" aria-hidden="true" />
							{resetNationality.isPending || calculateEnrollment.isPending
								? 'Resetting...'
								: 'Reset'}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
