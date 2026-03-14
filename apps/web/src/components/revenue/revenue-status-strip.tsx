import type { RevenueReadinessResponse } from '@budfin/types';
import { formatDateTime } from '../../lib/format-date';
import { useRevenueSettingsDirtyStore } from '../../stores/revenue-settings-dirty-store';
import { WorkspaceStatusStrip, type StatusSection } from '../shared/workspace-status-strip';
import { StalePill } from '../shared/stale-pill';

const STALE_LABELS: Record<string, string> = {
	STAFFING: 'Staffing',
	PNL: 'P&L',
};

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
	const dirtyCount = [...dirtyFields.values()].reduce((sum, fields) => sum + fields.size, 0);

	const sections: StatusSection[] = [
		{
			key: 'last-calculated',
			label: 'Last calculated',
			value: lastCalculated ? formatDateTime(lastCalculated) : 'Not yet calculated',
			priority: 0,
		},
		{
			key: 'enrollment',
			label: 'Enrollment',
			value: enrollmentStale ? 'Stale' : 'Fresh',
			severity: enrollmentStale ? 'warning' : 'success',
			priority: 1,
		},
		{
			key: 'downstream',
			label: 'Downstream',
			value:
				downstreamStale.length > 0 ? (
					<span className="inline-flex items-center gap-1.5">
						{downstreamStale.map((mod) => (
							<StalePill key={mod} label={STALE_LABELS[mod] ?? mod} />
						))}
					</span>
				) : (
					'None'
				),
			severity: downstreamStale.length > 0 ? 'warning' : 'default',
			priority: 2,
		},
		{
			key: 'config',
			label: 'Config',
			value: readiness
				? `${readiness.readyCount} of ${readiness.totalCount} complete`
				: 'Loading readiness...',
			severity: readiness?.overallReady ? 'success' : 'warning',
			priority: 3,
		},
	];

	if (dirtyCount > 0) {
		sections.push({
			key: 'unsaved',
			label: 'Unsaved',
			value: `${dirtyCount} ${dirtyCount === 1 ? 'setting' : 'settings'} changed since last calculation`,
			severity: 'warning',
			priority: 4,
		});
	}

	return <WorkspaceStatusStrip sections={sections} />;
}
