import type { RevenueReadinessResponse } from '@budfin/types';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/format-date';
import { StalePill } from '../shared/stale-pill';
import { WorkspaceStatusStrip } from '../shared/workspace-status-strip';
import { useRevenueSettingsDirtyStore } from '../../stores/revenue-settings-dirty-store';

const STALE_LABELS: Record<string, string> = {
	STAFFING: 'Staffing',
	PNL: 'P&L',
};

function formatReadiness(readiness: RevenueReadinessResponse | undefined) {
	if (!readiness) {
		return 'Loading readiness...';
	}

	return `${readiness.readyCount} of ${readiness.totalCount} complete`;
}

export function RevenueStatusStrip({
	lastCalculated,
	enrollmentStale,
	downstreamStale,
	readiness,
}: {
	lastCalculated: string | null;
	enrollmentStale: boolean;
	downstreamStale: string[];
	readiness: RevenueReadinessResponse | undefined;
}) {
	const dirtyFields = useRevenueSettingsDirtyStore((state) => state.dirtyFields);
	const totalDirtyCount = [...dirtyFields.values()].reduce((sum, fields) => sum + fields.size, 0);

	return (
		<WorkspaceStatusStrip>
			<span>
				<span className="font-semibold text-(--text-secondary)">Last calculated:</span>{' '}
				<span
					className={cn(
						'font-medium',
						lastCalculated ? 'text-(--text-secondary)' : 'text-(--color-warning)'
					)}
				>
					{lastCalculated ? formatDateTime(lastCalculated) : 'Not yet calculated'}
				</span>
			</span>

			<span>
				<span className="font-semibold text-(--text-secondary)">Enrollment:</span>{' '}
				<span
					className={cn(
						'font-medium',
						enrollmentStale ? 'text-(--color-warning)' : 'text-(--text-secondary)'
					)}
				>
					{enrollmentStale ? 'Stale' : 'Fresh'}
				</span>
			</span>

			{downstreamStale.length > 0 && (
				<span className="flex items-center gap-1.5">
					<span className="font-semibold text-(--text-secondary)">Downstream stale:</span>
					{downstreamStale.map((mod) => (
						<StalePill key={mod} label={STALE_LABELS[mod] ?? mod} />
					))}
				</span>
			)}

			{totalDirtyCount > 0 && (
				<span className="font-medium text-(--color-warning)">
					{totalDirtyCount} {totalDirtyCount === 1 ? 'setting changed' : 'settings changed'} since
					last calculation
				</span>
			)}

			<span>
				<span className="font-semibold text-(--text-secondary)">Config:</span>{' '}
				<span className="font-medium text-(--text-secondary)">{formatReadiness(readiness)}</span>
			</span>
		</WorkspaceStatusStrip>
	);
}
