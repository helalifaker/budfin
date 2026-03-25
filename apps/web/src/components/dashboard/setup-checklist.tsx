import { Check, Circle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { cn } from '../../lib/cn';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useDashboard } from '../../hooks/use-dashboard';

interface ChecklistStep {
	label: string;
	complete: boolean;
}

function buildSteps(
	versionId: number | null,
	dashboardData:
		| {
				kpis?: { enrollmentCount: number };
				staleModules: string[];
				monthlyTrend: { netProfit: string }[];
		  }
		| undefined
): ChecklistStep[] {
	const hasVersion = !!versionId;
	const enrollmentCount = dashboardData?.kpis?.enrollmentCount ?? 0;
	const staleModules = dashboardData?.staleModules ?? [];
	const hasTrendData = (dashboardData?.monthlyTrend?.length ?? 0) > 0;
	const hasCalcData = hasTrendData && staleModules.length === 0;

	return [
		{ label: 'Version created', complete: hasVersion },
		{ label: 'Enrollment configured', complete: enrollmentCount > 0 },
		{ label: 'Fee grid set', complete: hasTrendData },
		{ label: 'Staff imported', complete: hasTrendData },
		{ label: 'OpEx configured', complete: hasTrendData },
		{ label: 'Calculations complete', complete: hasCalcData },
		{ label: 'P&L reviewed', complete: hasCalcData },
	];
}

export function SetupChecklist() {
	const { versionId } = useWorkspaceContext();
	const { data } = useDashboard(versionId);

	const steps = buildSteps(versionId, data);
	const completedCount = steps.filter((s) => s.complete).length;
	const totalCount = steps.length;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Budget Setup Checklist</CardTitle>
					<span
						className={cn(
							'text-(--text-sm) font-medium',
							completedCount === totalCount ? 'text-(--color-success)' : 'text-(--text-secondary)'
						)}
					>
						{completedCount}/{totalCount} steps complete
					</span>
				</div>
			</CardHeader>
			<CardContent>
				<ul className="space-y-2" role="list" aria-label="Budget setup steps">
					{steps.map((step) => (
						<li key={step.label} className="flex items-center gap-3">
							{step.complete ? (
								<div
									className={cn(
										'flex h-5 w-5 shrink-0 items-center justify-center',
										'rounded-full bg-(--color-success)/10'
									)}
								>
									<Check className="h-3.5 w-3.5 text-(--color-success)" aria-hidden="true" />
								</div>
							) : (
								<div
									className={cn(
										'flex h-5 w-5 shrink-0 items-center justify-center',
										'rounded-full'
									)}
								>
									<Circle className="h-3.5 w-3.5 text-(--text-muted)" aria-hidden="true" />
								</div>
							)}
							<span
								className={cn(
									'text-(--text-sm)',
									step.complete ? 'text-(--text-secondary) line-through' : 'text-(--text-primary)'
								)}
							>
								{step.label}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
