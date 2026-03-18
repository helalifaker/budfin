import { StalePill } from '../shared/stale-pill';
import { WorkspaceStatusStrip } from '../shared/workspace-status-strip';
import type { StatusSection } from '../shared/workspace-status-strip';

const STALE_MODULE_LABELS: Record<string, string> = {
	ENROLLMENT: 'Enrollment',
	REVENUE: 'Revenue',
	STAFFING: 'Staffing',
	PNL: 'P&L',
};

function formatTimestamp(value: string | null | undefined): string {
	if (!value) {
		return 'Not yet calculated';
	}

	return new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Asia/Riyadh',
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date(value));
}

export function EnrollmentStatusStrip({
	baselineSource,
	lastCalculatedAt,
	dirtyCount,
	staleModules,
}: {
	baselineSource: string | null;
	lastCalculatedAt: string | null | undefined;
	dirtyCount: number;
	staleModules: string[];
}) {
	const downstreamStale = staleModules.filter((m) => m !== 'ENROLLMENT');

	const sections: StatusSection[] = [];

	if (baselineSource) {
		sections.push({
			key: 'baseline',
			label: 'Baseline',
			value: baselineSource,
			priority: 0,
		});
	}

	sections.push({
		key: 'lastCalculated',
		label: 'Last calculated',
		value: formatTimestamp(lastCalculatedAt),
		severity: lastCalculatedAt ? 'default' : 'warning',
		priority: 1,
	});

	if (dirtyCount > 0) {
		sections.push({
			key: 'dirty',
			label: 'Recalculation',
			value: `${dirtyCount} ${dirtyCount === 1 ? 'row needs' : 'rows need'} recalculation`,
			severity: 'warning',
			badge: true,
			priority: 2,
		});
	}

	if (downstreamStale.length > 0) {
		sections.push({
			key: 'downstream',
			label: 'Downstream stale',
			value: (
				<span className="flex items-center gap-1.5">
					{downstreamStale.map((mod) => (
						<StalePill key={mod} label={STALE_MODULE_LABELS[mod] ?? mod} />
					))}
				</span>
			),
			priority: 3,
		});
	}

	return <WorkspaceStatusStrip sections={sections} />;
}
