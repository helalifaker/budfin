import Decimal from 'decimal.js';
import { BarChart3, DollarSign, TrendingUp, Users } from 'lucide-react';
import { formatRevenueGridAmount } from '../../lib/revenue-workspace';
import { Counter } from '../shared/counter';
import { KpiCard } from '../shared/kpi-card';

export type RevenueKpiRibbonProps = {
	grossHt: string;
	totalDiscounts: string;
	netRevenue: string;
	otherRevenue: string;
	totalOperatingRevenue: string;
	avgPerStudent: string;
	isStale: boolean;
};

function sarAmount(value: string): number {
	return new Decimal(value).abs().toDecimalPlaces(0).toNumber();
}

function formatSarLabel(value: string): string {
	const amount = formatRevenueGridAmount(value);
	return `SAR ${amount.text}`;
}

export function RevenueKpiRibbon({
	grossHt,
	totalDiscounts,
	netRevenue,
	otherRevenue,
	totalOperatingRevenue,
	avgPerStudent,
	isStale,
}: RevenueKpiRibbonProps) {
	const gross = new Decimal(grossHt);
	const discounts = new Decimal(totalDiscounts);
	const discountPct = gross.eq(0) ? '0.0' : discounts.div(gross).mul(100).toFixed(1);

	const cards = [
		{
			key: 'net-tuition',
			label: 'Net Tuition HT',
			icon: DollarSign,
			value: sarAmount(netRevenue),
			subtitle: `${discountPct}% discount applied`,
			accentColor: 'var(--color-success)',
		},
		{
			key: 'other-revenue',
			label: 'Other Revenue',
			icon: TrendingUp,
			value: sarAmount(otherRevenue),
			subtitle: 'Registration, activities, exams',
			accentColor: 'var(--accent-500)',
		},
		{
			key: 'total-operating',
			label: 'Total Operating Revenue',
			icon: BarChart3,
			value: sarAmount(totalOperatingRevenue),
			subtitle: `${formatSarLabel(avgPerStudent)} avg/student`,
			accentColor: 'var(--color-success)',
		},
		{
			key: 'sar-per-student',
			label: 'SAR per Student',
			icon: Users,
			value: sarAmount(avgPerStudent),
			subtitle: 'Revenue intensity',
			accentColor: 'var(--accent-500)',
		},
	] as const;

	const sarFormatter = new Intl.NumberFormat('en-SA', {
		style: 'decimal',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});

	return (
		<div
			className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
			role="list"
			aria-label="Revenue key performance indicators"
		>
			{cards.map((card, i) => (
				<KpiCard
					key={card.key}
					label={card.label}
					icon={card.icon}
					index={i}
					isStale={isStale}
					accentColor={card.accentColor}
					subtitle={card.subtitle}
				>
					<Counter
						value={card.value}
						formatter={(v) => `SAR ${sarFormatter.format(v)}`}
						className="truncate font-[family-name:var(--font-mono)]"
					/>
				</KpiCard>
			))}
		</div>
	);
}
