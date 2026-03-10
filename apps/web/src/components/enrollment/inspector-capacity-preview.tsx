import { cn } from '../../lib/cn';
import { AlertBadge } from './capacity-columns';
import type { CapacityAlert } from '@budfin/types';

export type InspectorCapacityPreviewProps = {
	projectedAy2: number;
	sectionsNeeded: number;
	utilization: number;
	maxClassSize: number;
};

function getAlert(utilization: number): CapacityAlert | null {
	if (utilization === 0) return null;
	if (utilization > 100) return 'OVER';
	if (utilization > 95) return 'NEAR_CAP';
	if (utilization >= 70) return 'OK';
	return 'UNDER';
}

export function InspectorCapacityPreview({
	projectedAy2,
	sectionsNeeded,
	utilization,
	maxClassSize,
}: InspectorCapacityPreviewProps) {
	const alert = getAlert(utilization);

	return (
		<div>
			<h4 className="text-(--text-xs) font-semibold uppercase tracking-[0.06em] text-(--text-muted) mb-2">
				Capacity Preview
			</h4>
			<div className="rounded-lg border border-(--inspector-section-border) p-3 bg-(--workspace-bg-card)">
				<div className="grid grid-cols-2 gap-3">
					<div>
						<span className="text-(--text-xs) text-(--text-muted)">Projected AY2</span>
						<p className="text-(--text-lg) font-bold tabular-nums font-[family-name:var(--font-display)]">
							{projectedAy2}
						</p>
					</div>
					<div>
						<span className="text-(--text-xs) text-(--text-muted)">Sections</span>
						<p className="text-(--text-lg) font-bold tabular-nums font-[family-name:var(--font-display)]">
							{sectionsNeeded}
						</p>
					</div>
					<div>
						<span className="text-(--text-xs) text-(--text-muted)">Utilization</span>
						<p
							className={cn(
								'text-(--text-lg) font-bold tabular-nums font-[family-name:var(--font-display)]',
								utilization > 100 && 'text-(--color-error)',
								utilization > 95 && utilization <= 100 && 'text-(--color-warning)',
								utilization >= 70 && utilization <= 95 && 'text-(--color-success)'
							)}
						>
							{utilization > 0 ? `${utilization.toFixed(1)}%` : '-'}
						</p>
					</div>
					<div>
						<span className="text-(--text-xs) text-(--text-muted)">Max Size</span>
						<p className="text-(--text-lg) font-bold tabular-nums font-[family-name:var(--font-display)] text-(--text-muted)">
							{maxClassSize}
						</p>
					</div>
				</div>
				{alert && (
					<div className="mt-3 pt-3 border-t border-(--inspector-section-border)">
						<AlertBadge alert={alert} />
					</div>
				)}
			</div>
		</div>
	);
}
