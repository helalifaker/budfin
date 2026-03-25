import { useState } from 'react';
import { Users, DollarSign, Briefcase, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import { cn } from '../../lib/cn';
import { PageTransition } from '../../components/shared/page-transition';
import { KpiCard } from '../../components/dashboard/kpi-card';
import { ChartCard } from '../../components/dashboard/chart-card';
import { EnrollmentTrendChart } from '../../components/dashboard/enrollment-trend-chart';
import { RevenueBreakdownChart } from '../../components/dashboard/revenue-breakdown-chart';
import { StaffingDistributionChart } from '../../components/dashboard/staffing-distribution-chart';
import { CapacityAlerts } from '../../components/dashboard/capacity-alerts';
import { SetupChecklist } from '../../components/dashboard/setup-checklist';
import { BudgetCycleWizard } from '../../components/dashboard/budget-cycle-wizard';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useDashboard } from '../../hooks/use-dashboard';
import { formatMoney } from '../../lib/format-money';

const MONTH_LABELS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

function KpiSkeleton() {
	return (
		<div
			className={cn(
				'relative overflow-hidden',
				'rounded-xl border border-(--workspace-border)',
				'bg-(--workspace-bg-card) shadow-(--shadow-xs)',
				'p-5'
			)}
		>
			<div className="absolute top-0 left-0 right-0 h-[3px] bg-(--accent-500)" aria-hidden="true" />
			<div className="flex items-start justify-between">
				<div className="space-y-3">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-8 w-36" />
				</div>
				<Skeleton className="h-10 w-10 rounded-lg" />
			</div>
		</div>
	);
}

function StaleBanner({ staleModules }: { staleModules: string[] }) {
	if (staleModules.length === 0) return null;

	return (
		<div
			className={cn(
				'flex items-center gap-2 rounded-lg px-4 py-3',
				'border border-(--color-warning-border) bg-(--color-warning-bg)',
				'text-(--text-sm) text-(--color-warning)'
			)}
			role="alert"
		>
			<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
			<span>
				<strong>Stale data detected.</strong> The following modules need recalculation:{' '}
				{staleModules.join(', ')}.
			</span>
		</div>
	);
}

export function DashboardPage() {
	const [wizardOpen, setWizardOpen] = useState(false);
	const { versionId } = useWorkspaceContext();
	const { data, isLoading } = useDashboard(versionId);

	const kpis = data?.kpis;
	const monthlyTrend = data?.monthlyTrend ?? [];
	const staleModules = data?.staleModules ?? [];

	const totalRevenueNum = kpis ? parseFloat(kpis.totalRevenue) : 0;
	const totalStaffCostsNum = kpis ? parseFloat(kpis.totalStaffCosts) : 0;
	const netProfitNum = kpis ? parseFloat(kpis.netProfit) : 0;
	const enrollmentCount = kpis?.enrollmentCount ?? 0;

	return (
		<PageTransition>
			<div className="p-6 space-y-6">
				<div className="flex items-center justify-between">
					<h1 className="text-(--text-xl) font-semibold text-(--text-primary)">
						Budget Planning Dashboard
					</h1>
					<Button variant="primary" size="sm" onClick={() => setWizardOpen(true)}>
						<Sparkles className="h-4 w-4" aria-hidden="true" />
						New Budget
					</Button>
				</div>

				{/* Budget Cycle Wizard */}
				<BudgetCycleWizard open={wizardOpen} onOpenChange={setWizardOpen} />

				{/* Stale data warning banner */}
				{!isLoading && <StaleBanner staleModules={staleModules} />}

				{/* Setup Checklist */}
				{!isLoading && <SetupChecklist />}

				{/* No version selected */}
				{!versionId && !isLoading && (
					<div className="flex h-48 items-center justify-center rounded-md bg-(--workspace-bg-subtle)">
						<p className="text-(--text-sm) text-(--text-muted)">
							Select a budget version to view dashboard data.
						</p>
					</div>
				)}

				{/* KPI Cards Row */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{isLoading ? (
						<>
							<KpiSkeleton />
							<KpiSkeleton />
							<KpiSkeleton />
							<KpiSkeleton />
						</>
					) : (
						<>
							<div className="animate-stagger-reveal" style={{ animationDelay: '0ms' }}>
								<KpiCard title="Total Students" value={enrollmentCount} icon={Users} />
							</div>
							<div className="animate-stagger-reveal" style={{ animationDelay: '50ms' }}>
								<KpiCard
									title="Total Revenue"
									value={totalRevenueNum}
									icon={DollarSign}
									formatter={(v: number) => formatMoney(v, { showCurrency: true })}
								/>
							</div>
							<div className="animate-stagger-reveal" style={{ animationDelay: '100ms' }}>
								<KpiCard
									title="Staff Costs"
									value={totalStaffCostsNum}
									icon={Briefcase}
									formatter={(v: number) => formatMoney(v, { showCurrency: true })}
								/>
							</div>
							<div className="animate-stagger-reveal" style={{ animationDelay: '150ms' }}>
								<KpiCard
									title="Net Result"
									value={netProfitNum}
									icon={TrendingUp}
									formatter={(v: number) => formatMoney(v, { showCurrency: true })}
									className={
										netProfitNum >= 0
											? '[&_p:nth-child(2)]:text-(--color-success)'
											: '[&_p:nth-child(2)]:text-(--color-error)'
									}
								/>
							</div>
						</>
					)}
				</div>

				{/* Charts & Alerts Grid (2x2) */}
				{versionId && (
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<div className="animate-stagger-reveal" style={{ animationDelay: '200ms' }}>
							<ChartCard title="Enrollment Trend">
								<EnrollmentTrendChart />
							</ChartCard>
						</div>
						<div className="animate-stagger-reveal" style={{ animationDelay: '250ms' }}>
							<ChartCard title="Revenue Breakdown">
								<RevenueBreakdownChart monthlyTrend={monthlyTrend} isLoading={isLoading} />
							</ChartCard>
						</div>
						<div className="animate-stagger-reveal" style={{ animationDelay: '300ms' }}>
							<ChartCard title="Staffing Distribution">
								<StaffingDistributionChart versionId={versionId} />
							</ChartCard>
						</div>
						<div className="animate-stagger-reveal" style={{ animationDelay: '350ms' }}>
							<ChartCard title="Capacity Alerts">
								<CapacityAlerts versionId={versionId} />
							</ChartCard>
						</div>
					</div>
				)}

				{/* Monthly Trend Table */}
				{versionId && (
					<div className="animate-stagger-reveal" style={{ animationDelay: '200ms' }}>
						<ChartCard title="Monthly Trend">
							{isLoading ? (
								<div className="space-y-2">
									{Array.from({ length: 4 }).map((_, i) => (
										<Skeleton key={i} className="h-6 w-full" />
									))}
								</div>
							) : monthlyTrend.length > 0 ? (
								<div className="overflow-x-auto">
									<table className="w-full text-(--text-sm)">
										<thead>
											<tr className="border-b border-(--workspace-border)">
												<th className="px-3 py-2 text-left font-medium text-(--text-secondary)">
													Month
												</th>
												<th className="px-3 py-2 text-right font-medium text-(--text-secondary)">
													Revenue
												</th>
												<th className="px-3 py-2 text-right font-medium text-(--text-secondary)">
													Staff Costs
												</th>
												<th className="px-3 py-2 text-right font-medium text-(--text-secondary)">
													OpEx
												</th>
												<th className="px-3 py-2 text-right font-medium text-(--text-secondary)">
													Net Profit
												</th>
											</tr>
										</thead>
										<tbody>
											{monthlyTrend.map((row) => {
												const np = parseFloat(row.netProfit);
												return (
													<tr
														key={row.month}
														className="border-b border-(--workspace-border) last:border-b-0"
													>
														<td className="px-3 py-2 font-medium text-(--text-primary)">
															{MONTH_LABELS[row.month - 1]}
														</td>
														<td className="px-3 py-2 text-right font-mono tabular-nums text-(--text-primary)">
															{formatMoney(row.revenue)}
														</td>
														<td className="px-3 py-2 text-right font-mono tabular-nums text-(--text-primary)">
															{formatMoney(row.staffCosts)}
														</td>
														<td className="px-3 py-2 text-right font-mono tabular-nums text-(--text-primary)">
															{formatMoney(row.opex)}
														</td>
														<td
															className={cn(
																'px-3 py-2 text-right font-mono tabular-nums',
																np >= 0 ? 'text-(--color-success)' : 'text-(--color-error)'
															)}
														>
															{formatMoney(row.netProfit)}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							) : (
								<div className="flex h-48 items-center justify-center rounded-md bg-(--workspace-bg-subtle)">
									<p className="text-(--text-sm) text-(--text-muted)">
										No budget data calculated yet.
									</p>
								</div>
							)}
						</ChartCard>
					</div>
				)}
			</div>
		</PageTransition>
	);
}
