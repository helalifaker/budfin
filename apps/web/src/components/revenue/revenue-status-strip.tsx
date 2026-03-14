import type { RevenueReadinessResponse } from '@budfin/types';
import { StalePill } from '../shared/stale-pill';
import { WorkspaceStatusStrip } from '../shared/workspace-status-strip';
import type { StatusSection } from '../shared/workspace-status-strip';

const STALE_LABELS: Record<string, string> = {
	STAFFING: 'Staffing',
	PNL: 'P&L',
};

function formatTimestamp(value: string | null): string {
	if (!value) {
		return 'Not yet calculated';
	}

	return new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Asia/Riyadh',
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(value));
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
	const sections: StatusSection[] = [];

	sections.push({
		key: 'lastCalculated',
		label: 'Last calculated',
		value: formatTimestamp(lastCalculated),
		severity: lastCalculated ? 'default' : 'warning',
		priority: 0,
	});

	sections.push({
		key: 'enrollment',
		label: 'Enrollment',
		value: enrollmentStale ? 'Stale' : 'Fresh',
		severity: enrollmentStale ? 'warning' : 'success',
		priority: 1,
	});

	if (downstreamStale.length > 0) {
		sections.push({
			key: 'downstream',
			label: 'Downstream stale',
			value: (
				<span className="flex items-center gap-1.5">
					{downstreamStale.map((mod) => (
						<StalePill key={mod} label={STALE_LABELS[mod] ?? mod} />
					))}
				</span>
			),
			priority: 2,
		});
	}

	if (readiness) {
		sections.push({
			key: 'config',
			label: 'Config',
			value: `${readiness.readyCount} of ${readiness.totalCount} complete`,
			severity: readiness.overallReady ? 'success' : 'warning',
			priority: 3,
		});
	}

	return <WorkspaceStatusStrip sections={sections} />;
}
