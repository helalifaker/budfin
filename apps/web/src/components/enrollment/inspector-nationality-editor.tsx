import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';
import {
	useNationalityBreakdown,
	usePutNationalityBreakdown,
} from '../../hooks/use-nationality-breakdown';

export type InspectorNationalityEditorProps = {
	gradeLevel: string;
	versionId: number | null;
	isReadOnly: boolean;
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
}: InspectorNationalityEditorProps) {
	const { data: natData } = useNationalityBreakdown(versionId, 'AY2');
	const putNationality = usePutNationalityBreakdown(versionId);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const weights = useMemo(() => {
		const entries = natData?.entries ?? [];
		const result: Record<string, number> = { Francais: 0, Nationaux: 0, Autres: 0 };
		for (const e of entries) {
			if (e.gradeLevel === gradeLevel && result[e.nationality] !== undefined) {
				result[e.nationality] = Math.round(e.weight * 100);
			}
		}
		return result;
	}, [natData, gradeLevel]);

	const [localWeights, setLocalWeights] = useState(weights);

	useEffect(() => {
		setLocalWeights(weights);
	}, [weights]);

	useEffect(() => {
		return () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		};
	}, []);

	const sum =
		(localWeights.Francais ?? 0) + (localWeights.Nationaux ?? 0) + (localWeights.Autres ?? 0);
	const isValid = Math.abs(sum - 100) < 0.01;

	const handleChange = useCallback(
		(nationality: string, value: number) => {
			if (isReadOnly) return;
			setLocalWeights((prev) => ({ ...prev, [nationality]: value }));
		},
		[isReadOnly]
	);

	const handleSave = useCallback(() => {
		if (!isValid || isReadOnly || !versionId) return;
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
		saveTimerRef.current = setTimeout(() => {
			const overrides = NATIONALITIES.map((n) => ({
				gradeLevel,
				nationality: n.key,
				weight: (localWeights[n.key] ?? 0) / 100,
				headcount: 0,
			}));
			putNationality.mutate(overrides);
		}, 300);
	}, [isValid, isReadOnly, versionId, gradeLevel, localWeights, putNationality]);

	return (
		<div>
			<h4 className="text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted) mb-2">
				Nationality Weights
			</h4>
			<div className="rounded-lg border border-(--inspector-section-border) p-3 bg-(--workspace-bg-card) space-y-3">
				{NATIONALITIES.map((nat) => (
					<div key={nat.key} className="flex items-center justify-between">
						<span className="text-(--text-sm) text-(--text-secondary)">{nat.label}</span>
						<div className="flex items-center gap-1">
							<input
								type="number"
								min={0}
								max={100}
								value={localWeights[nat.key] ?? 0}
								onChange={(e) => handleChange(nat.key, Number(e.target.value))}
								disabled={isReadOnly}
								className={cn(
									'w-16 rounded-sm border border-(--workspace-border) px-2 py-1',
									'text-right text-(length:--text-sm) tabular-nums',
									'bg-(--cell-editable-bg) focus:ring-2 focus:ring-(--accent-400) focus:outline-none',
									isReadOnly && 'bg-(--cell-readonly-bg) cursor-not-allowed'
								)}
								aria-label={`${nat.label} weight percentage`}
							/>
							<span className="text-(--text-xs) text-(--text-muted)">%</span>
						</div>
					</div>
				))}

				{/* Validation Bar */}
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
					<div className="h-1.5 w-full rounded-full bg-(--workspace-bg-muted) overflow-hidden">
						<div
							className={cn(
								'h-full rounded-full transition-all duration-(--duration-normal)',
								isValid ? 'bg-(--color-success)' : 'bg-(--color-error)'
							)}
							style={{ width: `${Math.min(sum, 100)}%` }}
						/>
					</div>
				</div>

				{/* Save Button */}
				{!isReadOnly && (
					<button
						type="button"
						onClick={handleSave}
						disabled={!isValid}
						className={cn(
							'w-full rounded-md py-1.5 text-(--text-sm) font-medium',
							'transition-colors duration-(--duration-fast)',
							isValid
								? 'bg-(--accent-500) text-white hover:bg-(--accent-600)'
								: 'bg-(--workspace-bg-muted) text-(--text-muted) cursor-not-allowed'
						)}
					>
						Save Weights
					</button>
				)}
			</div>
		</div>
	);
}
