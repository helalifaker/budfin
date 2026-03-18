import { StalePill } from '../shared/stale-pill';
import { WorkspaceStatusStrip } from '../shared/workspace-status-strip';
import type { StatusSection } from '../shared/workspace-status-strip';

const STALE_MODULE_LABELS: Record<string, string> = {
	ENROLLMENT: 'Enrollment',
	REVENUE: 'Revenue',
	STAFFING: 'Staffing',
	PNL: 'P&L',
	DHG: 'Staffing (legacy)',
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

export type StaffingStatusStripProps = {
	lastCalculatedAt: string | null;
	staleModules: string[];
	demandPeriod: string;
	enrollmentCalculatedAt: string | null;
	enrollmentStale: boolean;
	supplyCount: { existing: number; new: number; vacancies: number };
	coverageSummary: { deficit: number; uncovered: number; balanced: number };
};

export function StaffingStatusStrip({
	lastCalculatedAt,
	staleModules,
	demandPeriod,
	enrollmentCalculatedAt,
	enrollmentStale,
	supplyCount,
	coverageSummary,
}: StaffingStatusStripProps) {
	const isStaffingStale = staleModules.includes('STAFFING');
	const downstreamStale = staleModules.filter((m) => m !== 'STAFFING' && m !== 'ENROLLMENT');

	const totalEmployees = supplyCount.existing + supplyCount.new;
	const hasDeficitOrUncovered = coverageSummary.deficit > 0 || coverageSummary.uncovered > 0;

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
	if (isStaffingStale) {
		sections.push({
			key: 'stale',
			label: 'Stale',
			value: 'Staffing data is stale — recalculate',
			severity: 'warning',
			badge: true,
			priority: 1,
		});
	}

	// Section 3: Demand period
	sections.push({
		key: 'demandPeriod',
		label: 'Demand',
		value: demandPeriod,
		priority: 2,
	});

	// Section 4: Source indicator
	const enrollmentInfo = enrollmentCalculatedAt
		? `Based on enrollment AY2 headcounts (calculated ${formatTimestamp(enrollmentCalculatedAt)})`
		: 'Based on enrollment AY2 headcounts';

	sections.push({
		key: 'source',
		label: 'Source',
		value: enrollmentInfo,
		severity: enrollmentStale ? 'warning' : 'default',
		priority: 3,
	});

	// Section 5: Supply count
	sections.push({
		key: 'supply',
		label: 'Supply',
		value: `${totalEmployees} employees (${supplyCount.existing} existing, ${supplyCount.new} new) + ${supplyCount.vacancies} ${supplyCount.vacancies === 1 ? 'vacancy' : 'vacancies'}`,
		priority: 4,
	});

	// Section 6: Coverage summary
	if (hasDeficitOrUncovered) {
		const parts: string[] = [];
		if (coverageSummary.deficit > 0) {
			parts.push(`${coverageSummary.deficit} deficit`);
		}
		if (coverageSummary.uncovered > 0) {
			parts.push(`${coverageSummary.uncovered} uncovered`);
		}
		parts.push(`${coverageSummary.balanced} balanced`);

		sections.push({
			key: 'coverage',
			label: 'Coverage',
			value: parts.join(', '),
			severity: 'warning',
			priority: 5,
		});
	} else {
		sections.push({
			key: 'coverage',
			label: 'Coverage',
			value: `${coverageSummary.balanced} balanced`,
			severity: 'success',
			priority: 5,
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
			priority: 6,
		});
	}

	return <WorkspaceStatusStrip sections={sections} />;
}
