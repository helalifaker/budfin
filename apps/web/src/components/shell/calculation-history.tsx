import { Calculator, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCalculationHistory } from '../../hooks/use-audit';
import type { CalculationEntryDto } from '../../hooks/use-audit';
import { Skeleton } from '../ui/skeleton';
import { TimelineItem } from '../shared/timeline-item';
import { cn } from '../../lib/cn';

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: ReactNode; className: string }> = {
	COMPLETED: {
		label: 'Completed',
		icon: <CheckCircle2 className="h-3.5 w-3.5" />,
		className: 'text-green-600',
	},
	FAILED: {
		label: 'Failed',
		icon: <XCircle className="h-3.5 w-3.5" />,
		className: 'text-red-600',
	},
	STARTED: {
		label: 'Running',
		icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
		className: 'text-amber-600',
	},
};

function getStatusConfig(status: string) {
	return (
		STATUS_CONFIG[status.toUpperCase()] ?? {
			label: status,
			icon: <Clock className="h-3.5 w-3.5" />,
			className: 'text-(--text-muted)',
		}
	);
}

function formatDuration(ms: number | null): string {
	if (ms === null) return '';
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function humanizeModule(module: string): string {
	return module.charAt(0).toUpperCase() + module.slice(1).toLowerCase();
}

function buildCalcTitle(entry: CalculationEntryDto): string {
	return `${humanizeModule(entry.module)} calculation`;
}

function buildCalcSubtitle(entry: CalculationEntryDto): string {
	const parts: string[] = [];
	if (entry.triggered_by) parts.push(entry.triggered_by);
	const duration = formatDuration(entry.duration_ms);
	if (duration) parts.push(duration);
	return parts.join(' — ');
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function CalculationSkeleton() {
	return (
		<div className="space-y-4" data-testid="calculation-skeleton">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex gap-3">
					<Skeleton className="h-4 w-4 shrink-0 rounded-full" />
					<div className="flex-1 space-y-1.5">
						<Skeleton className="h-3.5 w-2/3" />
						<Skeleton className="h-3 w-1/3" />
					</div>
				</div>
			))}
		</div>
	);
}

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
	const config = getStatusConfig(status);
	return (
		<span className={cn('inline-flex items-center gap-1 text-xs font-medium', config.className)}>
			{config.icon}
			{config.label}
		</span>
	);
}

// ── Component ───────────────────────────────────────────────────────────────

export function CalculationHistory() {
	const { data, isLoading, isError } = useCalculationHistory();

	if (isLoading) return <CalculationSkeleton />;

	if (isError) {
		return (
			<p className="text-sm text-(--text-muted)">
				Unable to load calculation history. Check permissions or try again later.
			</p>
		);
	}

	const entries = data?.entries ?? [];

	if (entries.length === 0) {
		return (
			<p className="text-sm text-(--text-muted)">
				No calculations have been run for this version yet.
			</p>
		);
	}

	return (
		<div className="divide-y divide-(--workspace-border)">
			{entries.map((entry) => (
				<div key={entry.id} className="py-2">
					<TimelineItem
						icon={<Calculator className="h-4 w-4" />}
						title={buildCalcTitle(entry)}
						subtitle={buildCalcSubtitle(entry)}
						timestamp={entry.started_at}
					/>
					<div className="ml-7 mt-1">
						<StatusBadge status={entry.status} />
					</div>
				</div>
			))}
		</div>
	);
}
