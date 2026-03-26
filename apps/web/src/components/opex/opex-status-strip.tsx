import { StalePill } from '../shared/stale-pill';
import { WorkspaceStatusStrip } from '../shared/workspace-status-strip';
import type { StatusSection } from '../shared/workspace-status-strip';

const STALE_MODULE_LABELS: Record<string, string> = {
	ENROLLMENT: 'Enrollment',
	REVENUE: 'Revenue',
	STAFFING: 'Staffing',
	OPEX: 'OpEx',
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

export type OpExStatusStripProps = {
	lastCalculatedAt: string | null;
	staleModules: string[];
	operatingLineCount: number;
	nonOperatingLineCount: number;
	unsavedCount?: number;
};

export function OpExStatusStrip({
	lastCalculatedAt,
	staleModules,
	operatingLineCount,
	nonOperatingLineCount,
	unsavedCount = 0,
}: OpExStatusStripProps) {
	const isOpExStale = staleModules.includes('OPEX');
	const downstreamStale = staleModules.filter(
		(m) => m !== 'OPEX' && m !== 'ENROLLMENT' && m !== 'REVENUE'
	);

	const sections: StatusSection[] = [];

	// Section 1: Calc timestamp
	sections.push({
		key: 'lastCalculated',
		label: 'Last calculated',
		value: formatTimestamp(lastCalculatedAt),
		severity: lastCalculatedAt ? 'default' : 'warning',
		priority: 0,
	});

	// Section 2: Stale warning
	if (isOpExStale) {
		sections.push({
			key: 'stale',
			label: 'Stale',
			value: 'OpEx data is stale -- recalculate',
			severity: 'warning',
			badge: true,
			priority: 1,
		});
	}

	// Section 3: Line item counts
	const totalItems = operatingLineCount + nonOperatingLineCount;
	sections.push({
		key: 'lineItems',
		label: 'Line items',
		value: `${totalItems} total (${operatingLineCount} operating, ${nonOperatingLineCount} non-operating)`,
		priority: 2,
	});

	// Section 4: Unsaved changes
	if (unsavedCount > 0) {
		sections.push({
			key: 'unsaved',
			label: 'Unsaved',
			value: `${unsavedCount} change${unsavedCount === 1 ? '' : 's'}`,
			severity: 'warning',
			priority: 4,
		});
	}

	// Downstream stale pills
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
