import { useMemo } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, MinusCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useEnrollmentCapacityResults } from '../../hooks/use-enrollment';
import { Skeleton } from '../ui/skeleton';
import type { CapacityAlert } from '@budfin/types';

export type CapacityAlertsProps = {
	versionId: number | null;
};

interface AlertRow {
	gradeLevel: string;
	headcount: number;
	maxClassSize: number;
	sectionsNeeded: number;
	utilization: number;
	alert: CapacityAlert | null;
	sortOrder: number;
}

const ALERT_SORT: Record<string, number> = {
	OVER: 0,
	NEAR_CAP: 1,
	UNDER: 2,
	OK: 3,
};

function getAlertConfig(alert: CapacityAlert | null) {
	switch (alert) {
		case 'OVER':
			return {
				Icon: AlertTriangle,
				iconClass: 'text-(--color-error)',
				badge: 'Over Capacity',
				badgeClass: 'bg-(--color-error-bg) text-(--color-error)',
			};
		case 'NEAR_CAP':
			return {
				Icon: AlertCircle,
				iconClass: 'text-(--color-warning)',
				badge: 'Near Capacity',
				badgeClass: 'bg-(--color-warning-bg) text-(--color-warning)',
			};
		case 'UNDER':
			return {
				Icon: MinusCircle,
				iconClass: 'text-(--text-muted)',
				badge: 'Under-utilized',
				badgeClass: 'bg-(--workspace-bg-muted) text-(--text-muted)',
			};
		default:
			return {
				Icon: CheckCircle,
				iconClass: 'text-(--color-success)',
				badge: 'OK',
				badgeClass: 'bg-(--color-success-bg) text-(--color-success)',
			};
	}
}

export function CapacityAlerts({ versionId }: CapacityAlertsProps) {
	const { data, isLoading } = useEnrollmentCapacityResults(versionId);

	const alerts = useMemo<AlertRow[]>(() => {
		if (!data?.results?.length) return [];

		// Only show AY1 results to avoid duplicates
		const ay1Results = data.results.filter((r) => r.academicPeriod === 'AY1');

		return ay1Results
			.map((r) => ({
				gradeLevel: r.gradeLevel,
				headcount: r.headcount,
				maxClassSize: r.maxClassSize,
				sectionsNeeded: r.sectionsNeeded,
				utilization: r.utilization,
				alert: r.alert,
				sortOrder: ALERT_SORT[r.alert ?? 'OK'] ?? 3,
			}))
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}, [data]);

	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-10 w-full" />
				))}
			</div>
		);
	}

	if (alerts.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-md bg-(--workspace-bg-subtle)">
				<p className="text-(--text-sm) text-(--text-muted)">
					No capacity data available for this version.
				</p>
			</div>
		);
	}

	const hasAlerts = alerts.some((a) => a.alert === 'OVER' || a.alert === 'NEAR_CAP');

	if (!hasAlerts) {
		return (
			<div className="flex h-48 items-center justify-center rounded-md bg-(--workspace-bg-subtle)">
				<div className="flex items-center gap-2">
					<CheckCircle className="h-5 w-5 text-(--color-success)" aria-hidden="true" />
					<p className="text-(--text-sm) text-(--text-muted)">All grades within capacity.</p>
				</div>
			</div>
		);
	}

	return (
		<div aria-label="Capacity alerts" className="max-h-[320px] overflow-y-auto">
			<ul className="divide-y divide-(--workspace-border)">
				{alerts
					.filter((a) => a.alert === 'OVER' || a.alert === 'NEAR_CAP')
					.map((row) => {
						const config = getAlertConfig(row.alert);
						const { Icon } = config;

						return (
							<li key={row.gradeLevel} className="flex items-center gap-3 px-2 py-2.5">
								<Icon className={cn('h-4 w-4 shrink-0', config.iconClass)} aria-hidden="true" />
								<span className="flex-1 text-(--text-sm) font-medium text-(--text-primary)">
									{row.gradeLevel}
								</span>
								<span className="text-(--text-xs) font-mono tabular-nums text-(--text-secondary)">
									{row.headcount}/{row.maxClassSize * row.sectionsNeeded}
								</span>
								<span className="text-(--text-xs) font-mono tabular-nums text-(--text-secondary)">
									{Math.round(row.utilization * 100)}%
								</span>
								<span
									className={cn(
										'rounded-full px-2 py-0.5 text-(--text-xs) font-medium',
										config.badgeClass
									)}
								>
									{config.badge}
								</span>
							</li>
						);
					})}
			</ul>
		</div>
	);
}
