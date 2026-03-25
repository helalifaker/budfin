import { Link } from 'react-router';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { useTrends } from '../../hooks/use-trends';

function GrowthIndicator({
	value,
	positiveIsGood = true,
}: {
	value: string | null;
	positiveIsGood?: boolean;
}) {
	if (value === null) {
		return (
			<span className="flex items-center gap-1 text-(--text-muted)">
				<Minus className="h-3.5 w-3.5" aria-hidden="true" />
				<span>--</span>
			</span>
		);
	}

	const pct = parseFloat(value) * 100;
	const isPositive = pct > 0;
	const isGood = positiveIsGood ? isPositive : !isPositive;
	const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
	const sign = isPositive ? '+' : '';

	return (
		<span
			className={cn(
				'flex items-center gap-1 font-medium',
				pct === 0
					? 'text-(--text-muted)'
					: isGood
						? 'text-(--color-success)'
						: 'text-(--color-error)'
			)}
		>
			{pct !== 0 && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
			<span>
				{sign}
				{pct.toFixed(1)}%
			</span>
		</span>
	);
}

const GROWTH_METRICS = [
	{ key: 'revenue' as const, label: 'Revenue', positiveIsGood: true },
	{ key: 'staffCost' as const, label: 'Staff Cost', positiveIsGood: false },
	{ key: 'netProfit' as const, label: 'Net Profit', positiveIsGood: true },
	{ key: 'enrollment' as const, label: 'Enrollment', positiveIsGood: true },
];

export function YoyTrendsCard() {
	const { data, isLoading } = useTrends(5);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Year-over-Year</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-5 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	// Need at least 2 years for growth data
	if (!data || data.years.length < 2) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Year-over-Year</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex h-32 items-center justify-center">
						<p className="text-(--text-sm) text-(--text-muted)">
							Growth data available after 2+ fiscal years are locked.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	// Use the latest growth values (last element in each growth array)
	const lastIdx = data.years.length - 1;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Year-over-Year</CardTitle>
					<Link
						to="/planning/trends"
						className={cn(
							'flex items-center gap-1',
							'text-(--text-xs) font-medium text-(--accent-600)',
							'hover:text-(--accent-700) transition-colors'
						)}
					>
						<TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
						View Trends
					</Link>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{GROWTH_METRICS.map((metric) => {
						const growthValues = data.growth[metric.key] ?? [];
						const latestGrowth = growthValues[lastIdx] ?? null;

						return (
							<div key={metric.key} className="flex items-center justify-between text-(--text-sm)">
								<span className="text-(--text-secondary)">{metric.label}</span>
								<GrowthIndicator value={latestGrowth} positiveIsGood={metric.positiveIsGood} />
							</div>
						);
					})}
				</div>
				<p className="mt-3 text-[11px] text-(--text-muted)">
					Comparing {data.years[lastIdx - 1]!.fiscalYear} to {data.years[lastIdx]!.fiscalYear}
				</p>
			</CardContent>
		</Card>
	);
}
