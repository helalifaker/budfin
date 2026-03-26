import { cn } from '../../lib/cn';
import { PageTransition } from '../../components/shared/page-transition';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { TrendLineChart } from '../../components/trends/trend-line-chart';
import { GrowthRateTable } from '../../components/trends/growth-rate-table';
import { TrendEmptyState } from '../../components/trends/trend-empty-state';
import { useTrends } from '../../hooks/use-trends';
import { formatMoney } from '../../lib/format-money';

function ChartSkeleton() {
	return (
		<div className="space-y-3">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-64 w-full" />
		</div>
	);
}

export function TrendsPage() {
	const { data, isLoading, isError } = useTrends(5);

	const yearCount = data?.years.length ?? 0;
	const hasFullData = yearCount >= 2;

	// Per-pupil KPIs from the latest year
	const latestYear = data?.years[data.years.length - 1];
	const revenuePerPupil =
		latestYear && latestYear.metrics.totalEnrollment > 0
			? parseFloat(latestYear.metrics.totalRevenue) / latestYear.metrics.totalEnrollment
			: null;
	const costPerPupil =
		latestYear && latestYear.metrics.totalEnrollment > 0
			? parseFloat(latestYear.metrics.totalStaffCost) / latestYear.metrics.totalEnrollment
			: null;

	return (
		<PageTransition>
			<div className="p-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-(--text-xl) font-semibold text-(--text-primary)">
							Historical Trends
						</h1>
						<p className="mt-1 text-(--text-sm) text-(--text-secondary)">
							Year-over-year comparison of locked budget versions
						</p>
					</div>
				</div>

				{isLoading && (
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<Card>
							<CardContent className="pt-5">
								<ChartSkeleton />
							</CardContent>
						</Card>
						<Card>
							<CardContent className="pt-5">
								<ChartSkeleton />
							</CardContent>
						</Card>
					</div>
				)}

				{isError && (
					<div
						className={cn(
							'flex items-center justify-center rounded-xl p-8',
							'border border-(--color-error-border) bg-(--color-error-bg)',
							'text-(--text-sm) text-(--color-error)'
						)}
					>
						Failed to load trend data. Please try again later.
					</div>
				)}

				{!isLoading && !isError && !hasFullData && <TrendEmptyState yearCount={yearCount} />}

				{/* Single-year summary when only 1 year available */}
				{!isLoading && !isError && yearCount === 1 && latestYear && (
					<Card>
						<CardHeader>
							<CardTitle>Current Year Summary ({latestYear.fiscalYear})</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
								<KpiMini
									label="Revenue"
									value={formatMoney(latestYear.metrics.totalRevenue, {
										showCurrency: true,
										compact: true,
									})}
								/>
								<KpiMini
									label="Staff Cost"
									value={formatMoney(latestYear.metrics.totalStaffCost, {
										showCurrency: true,
										compact: true,
									})}
								/>
								<KpiMini
									label="OpEx"
									value={formatMoney(latestYear.metrics.totalOpEx, {
										showCurrency: true,
										compact: true,
									})}
								/>
								<KpiMini
									label="Net Profit"
									value={formatMoney(latestYear.metrics.netProfit, {
										showCurrency: true,
										compact: true,
									})}
								/>
								<KpiMini label="Enrollment" value={String(latestYear.metrics.totalEnrollment)} />
								<KpiMini label="FTE" value={latestYear.metrics.totalFte} />
							</div>
						</CardContent>
					</Card>
				)}

				{/* Full charts and growth analysis when 2+ years */}
				{!isLoading && !isError && hasFullData && data && (
					<>
						{/* Per-pupil KPIs */}
						{revenuePerPupil !== null && costPerPupil !== null && (
							<div
								className="animate-stagger-reveal grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
								style={{ animationDelay: '0ms' }}
							>
								<KpiMini
									label="Revenue / Pupil"
									value={formatMoney(revenuePerPupil, {
										showCurrency: true,
									})}
								/>
								<KpiMini
									label="Staff Cost / Pupil"
									value={formatMoney(costPerPupil, {
										showCurrency: true,
									})}
								/>
								<KpiMini
									label="Total Enrollment"
									value={String(latestYear!.metrics.totalEnrollment)}
								/>
								<KpiMini label="Total FTE" value={latestYear!.metrics.totalFte} />
							</div>
						)}

						{/* Financial Trends Chart */}
						<div className="animate-stagger-reveal" style={{ animationDelay: '100ms' }}>
							<Card>
								<CardHeader>
									<CardTitle>Financial Trends</CardTitle>
								</CardHeader>
								<CardContent>
									<TrendLineChart years={data.years} />
								</CardContent>
							</Card>
						</div>

						{/* Year-over-Year Growth Rates */}
						<div className="animate-stagger-reveal" style={{ animationDelay: '200ms' }}>
							<Card>
								<CardHeader>
									<CardTitle>Year-over-Year Growth</CardTitle>
								</CardHeader>
								<CardContent>
									<GrowthRateTable years={data.years} growth={data.growth} />
								</CardContent>
							</Card>
						</div>
					</>
				)}
			</div>
		</PageTransition>
	);
}

// ── Mini KPI card ───────────────────────────────────────────────────────────

function KpiMini({ label, value }: { label: string; value: string }) {
	return (
		<div
			className={cn(
				'rounded-lg border border-(--workspace-border)',
				'bg-(--workspace-bg-card) p-4 shadow-(--shadow-xs)'
			)}
		>
			<p className="text-(length:--text-xs) font-medium uppercase tracking-wider text-(--text-muted)">
				{label}
			</p>
			<p className="mt-1 text-(--text-lg) font-semibold tabular-nums text-(--text-primary)">
				{value}
			</p>
		</div>
	);
}
