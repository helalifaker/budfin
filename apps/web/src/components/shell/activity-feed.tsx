import { Activity, FilePen, Trash2, PlusCircle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useVersionActivity } from '../../hooks/use-audit';
import type { AuditEntryDto } from '../../hooks/use-audit';
import { Skeleton } from '../ui/skeleton';
import { TimelineItem } from '../shared/timeline-item';

// ── Helpers ─────────────────────────────────────────────────────────────────

const OPERATION_META: Record<string, { label: string; icon: ReactNode }> = {
	CREATE: { label: 'Created', icon: <PlusCircle className="h-4 w-4" /> },
	UPDATE: { label: 'Updated', icon: <FilePen className="h-4 w-4" /> },
	DELETE: { label: 'Deleted', icon: <Trash2 className="h-4 w-4" /> },
	CALCULATE: { label: 'Calculated', icon: <RefreshCw className="h-4 w-4" /> },
};

function humanizeOperation(operation: string): { label: string; icon: ReactNode } {
	const upper = operation.toUpperCase();
	if (OPERATION_META[upper]) return OPERATION_META[upper];
	return {
		label: operation.charAt(0).toUpperCase() + operation.slice(1).toLowerCase(),
		icon: <Activity className="h-4 w-4" />,
	};
}

function humanizeTableName(tableName: string | null): string {
	if (!tableName) return '';
	return tableName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildTitle(entry: AuditEntryDto): string {
	const { label } = humanizeOperation(entry.operation);
	const table = humanizeTableName(entry.table_name);
	if (table) return `${label} ${table}`;
	return label;
}

function buildSubtitle(entry: AuditEntryDto): string | undefined {
	if (entry.user_id) return `User #${entry.user_id}`;
	return undefined;
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function ActivitySkeleton() {
	return (
		<div className="space-y-4" data-testid="activity-skeleton">
			{Array.from({ length: 5 }).map((_, i) => (
				<div key={i} className="flex gap-3">
					<Skeleton className="h-4 w-4 shrink-0 rounded-full" />
					<div className="flex-1 space-y-1.5">
						<Skeleton className="h-3.5 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</div>
				</div>
			))}
		</div>
	);
}

// ── Component ───────────────────────────────────────────────────────────────

export function ActivityFeed() {
	const { data, isLoading, isError } = useVersionActivity();

	if (isLoading) return <ActivitySkeleton />;

	if (isError) {
		return (
			<p className="text-sm text-(--text-muted)">
				Unable to load activity. Check permissions or try again later.
			</p>
		);
	}

	const entries = data?.entries ?? [];

	if (entries.length === 0) {
		return <p className="text-sm text-(--text-muted)">No recent activity for this version.</p>;
	}

	return (
		<div className="divide-y divide-(--workspace-border)">
			{entries.map((entry) => {
				const { icon } = humanizeOperation(entry.operation);
				return (
					<TimelineItem
						key={entry.id}
						icon={icon}
						title={buildTitle(entry)}
						subtitle={buildSubtitle(entry)}
						timestamp={entry.created_at}
					/>
				);
			})}
		</div>
	);
}
