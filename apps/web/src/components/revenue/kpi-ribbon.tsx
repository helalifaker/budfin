import Decimal from 'decimal.js';
import { BarChart3, DollarSign, TrendingUp, Users } from 'lucide-react';
import { Counter } from '../shared/counter';
import { KpiCard } from '../shared/kpi-card';
import { formatMoney } from '../../lib/format-money';

export type RevenueKpiRibbonProps = {
	grossHt: string;
	totalDiscounts: string;
	netRevenue: string;
	otherRevenue: string;
	totalOperatingRevenue: string;
	avgPerStudent: string;
	isStale: boolean;
};

const CARDS = [
	{
		key: 'net-tuition',
		label: 'Net Tuition HT',
		icon: DollarSign,
		accentColor: 'var(--color-info)',
		getValue: (p: RevenueKpiRibbonProps) => p.netRevenue,
		getSubtitle: (p: RevenueKpiRibbonProps) => {
			const gross = new Decimal(p.grossHt);
			const discounts = new Decimal(p.totalDiscounts);
			const ratio = gross.eq(0) ? '0.0' : discounts.div(gross).mul(100).toFixed(1);
			return `${formatMoney(p.totalDiscounts, { showCurrency: true })} discounts (${ratio}%)`;
		},
	},
	{
		key: 'other-revenue',
		label: 'Other Revenue',
		icon: TrendingUp,
		accentColor: 'var(--accent-500)',
		getValue: (p: RevenueKpiRibbonProps) => p.otherRevenue,
		getSubtitle: () => 'Registration, activities, exams',
	},
	{
		key: 'total-operating',
		label: 'Total Operating Revenue',
		icon: BarChart3,
		accentColor: 'var(--color-success)',
		getValue: (p: RevenueKpiRibbonProps) => p.totalOperatingRevenue,
		getSubtitle: () => 'Net tuition + other revenue',
	},
	{
		key: 'sar-per-student',
		label: 'SAR per Student',
		icon: Users,
		accentColor: 'var(--color-warning)',
		getValue: (p: RevenueKpiRibbonProps) => p.avgPerStudent,
		getSubtitle: () => 'Average revenue per enrolled student',
	},
] as const;

export function RevenueKpiRibbon(props: RevenueKpiRibbonProps) {
	return (
		<div
			className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
			role="list"
			aria-label="Revenue key performance indicators"
		>
			{CARDS.map((card, index) => {
				const raw = parseFloat(card.getValue(props));

				return (
					<KpiCard
						key={card.key}
						label={card.label}
						icon={card.icon}
						index={index}
						isStale={props.isStale}
						accentColor={card.accentColor}
						subtitle={card.getSubtitle(props)}
					>
						<Counter value={raw} formatter={(v) => formatMoney(v, { showCurrency: true })} />
					</KpiCard>
				);
			})}
		</div>
	);
}
