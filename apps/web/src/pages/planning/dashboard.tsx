import { Users, DollarSign, Briefcase, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/cn';
import { PageTransition } from '../../components/shared/page-transition';
import { KpiCard } from '../../components/dashboard/kpi-card';
import { ChartCard } from '../../components/dashboard/chart-card';

export function DashboardPage() {
	return (
		<PageTransition>
			<div className="p-6 space-y-6">
				<h1 className="text-(--text-xl) font-semibold text-(--text-primary)">
					Budget Planning Dashboard
				</h1>

				{/* KPI Cards Row */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{[
						{
							title: 'Total Students',
							value: 0,
							icon: Users,
							delay: 0,
						},
						{
							title: 'Total Revenue',
							value: 0,
							icon: DollarSign,
							formatter: (v: number) => `SAR ${v.toLocaleString()}`,
							delay: 50,
						},
						{
							title: 'Staff Costs',
							value: 0,
							icon: Briefcase,
							formatter: (v: number) => `SAR ${v.toLocaleString()}`,
							delay: 100,
						},
						{
							title: 'Net Result',
							value: 0,
							icon: TrendingUp,
							formatter: (v: number) => `SAR ${v.toLocaleString()}`,
							delay: 150,
						},
					].map((kpi) => (
						<div
							key={kpi.title}
							className={cn('animate-stagger-reveal')}
							style={{ animationDelay: `${kpi.delay}ms` }}
						>
							<KpiCard
								title={kpi.title}
								value={kpi.value}
								icon={kpi.icon}
								formatter={kpi.formatter}
							/>
						</div>
					))}
				</div>

				{/* Charts Row */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div className="animate-stagger-reveal" style={{ animationDelay: '200ms' }}>
						<ChartCard title="Revenue vs Budget" />
					</div>
					<div className="animate-stagger-reveal" style={{ animationDelay: '250ms' }}>
						<ChartCard title="Enrollment by Band" />
					</div>
				</div>

				<div className="animate-stagger-reveal" style={{ animationDelay: '300ms' }}>
					<ChartCard title="Monthly Trend" />
				</div>
			</div>
		</PageTransition>
	);
}
