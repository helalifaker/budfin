import { cn } from '../../lib/cn';

const STALE_MODULE_LABELS: Record<string, string> = {
	ENROLLMENT: 'Enrollment',
	REVENUE: 'Revenue',
	DHG: 'DHG',
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

	return (
		<div className="flex shrink-0 items-center gap-4 border-b border-(--workspace-border) bg-(--workspace-bg-subtle) px-6 py-2.5 text-(--text-sm) text-(--text-muted)">
			{baselineSource && (
				<span>
					<span className="font-semibold text-(--text-secondary)">Baseline:</span>{' '}
					<span className="font-medium text-(--text-secondary)">{baselineSource}</span>
				</span>
			)}

			<span>
				<span className="font-semibold text-(--text-secondary)">Last calculated:</span>{' '}
				<span
					className={cn(
						'font-medium',
						lastCalculatedAt ? 'text-(--text-secondary)' : 'text-(--color-warning)'
					)}
				>
					{formatTimestamp(lastCalculatedAt)}
				</span>
			</span>

			{dirtyCount > 0 && (
				<span className="font-medium text-(--color-warning)">
					{dirtyCount} {dirtyCount === 1 ? 'row needs' : 'rows need'} recalculation
				</span>
			)}

			{downstreamStale.length > 0 && (
				<span className="flex items-center gap-1.5">
					<span className="font-semibold text-(--text-secondary)">Downstream stale:</span>
					{downstreamStale.map((mod) => (
						<span
							key={mod}
							className="rounded-full bg-(--color-warning-bg) px-2 py-0.5 text-(--text-xs) font-medium text-(--color-warning)"
						>
							{STALE_MODULE_LABELS[mod] ?? mod}
						</span>
					))}
				</span>
			)}
		</div>
	);
}
