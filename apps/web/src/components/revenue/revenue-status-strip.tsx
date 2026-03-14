import type { RevenueReadinessResponse } from '@budfin/types';
import { formatDateTime } from '../../lib/format-date';
import { useRevenueSettingsDirtyStore } from '../../stores/revenue-settings-dirty-store';

const STALE_LABELS: Record<string, string> = {
	STAFFING: 'Staffing',
	PNL: 'P&L',
};

function formatDownstreamModules(modules: string[]) {
	if (modules.length === 0) {
		return 'None';
	}

	return modules.map((module) => STALE_LABELS[module] ?? module).join(', ');
}

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
	const dirtyCount = [...dirtyFields.values()].reduce((sum, fields) => sum + fields.size, 0);

	return (
		<div
			role="status"
			aria-live="polite"
			className="flex flex-wrap items-center gap-3 rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-subtle) px-4 py-3 text-(--text-sm) text-(--text-secondary)"
		>
			<span>
				<span className="font-semibold">Last calculated:</span>{' '}
				{lastCalculated ? formatDateTime(lastCalculated) : 'Not yet calculated'}
			</span>
			<span aria-hidden="true">|</span>
			<span>
				<span className="font-semibold">Enrollment:</span> {enrollmentStale ? 'Stale' : 'Fresh'}
			</span>
			<span aria-hidden="true">|</span>
			<span>
				<span className="font-semibold">Downstream:</span>{' '}
				{formatDownstreamModules(downstreamStale)}
			</span>
			<span aria-hidden="true">|</span>
			<span>
				<span className="font-semibold">Config:</span> {formatReadiness(readiness)}
			</span>
			{dirtyCount > 0 && (
				<>
					<span aria-hidden="true">|</span>
					<span className="text-(--color-warning)">
						<span className="font-semibold">Unsaved:</span> {dirtyCount}{' '}
						{dirtyCount === 1 ? 'setting' : 'settings'} changed since last calculation
					</span>
				</>
			)}
		</div>
	);
}
