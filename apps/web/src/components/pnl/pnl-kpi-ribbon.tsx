import Decimal from 'decimal.js';
import { BarChart3, DollarSign, Percent, TrendingUp, Wallet } from 'lucide-react';
import type { AccountingPnlKpis } from '@budfin/types';
import { Counter } from '../shared/counter';
import { KpiCard } from '../shared/kpi-card';
import { formatMoney } from '../../lib/format-money';

export interface PnlKpiRibbonProps {
	kpis: AccountingPnlKpis;
	isStale: boolean;
}

const CARDS = [
	{
		key: 'revenue',
		label: 'Total Revenue',
		icon: DollarSign,
		accentColor: 'var(--color-info)',
		getValue: (k: AccountingPnlKpis) => k.revenue,
		format: 'money' as const,
		subtitle: 'Gross tuition and other revenue',
	},
	{
		key: 'gross-profit',
		label: 'Gross Profit',
		icon: TrendingUp,
		accentColor: 'var(--color-success)',
		getValue: (k: AccountingPnlKpis) => k.grossProfit,
		format: 'money' as const,
		subtitle: 'Revenue less direct costs',
	},
	{
		key: 'gp-margin',
		label: 'GP Margin',
		icon: Percent,
		accentColor: 'var(--color-success)',
		getValue: (k: AccountingPnlKpis) => k.gpMargin,
		format: 'percent' as const,
		subtitle: 'Gross profit / revenue',
	},
	{
		key: 'ebitda',
		label: 'EBITDA',
		icon: BarChart3,
		accentColor: 'var(--accent-500)',
		getValue: (k: AccountingPnlKpis) => k.ebitda,
		format: 'money' as const,
		subtitle: 'Operating profitability',
	},
	{
		key: 'net-profit',
		label: 'Net Profit',
		icon: Wallet,
		accentColor: 'var(--color-warning)',
		getValue: (k: AccountingPnlKpis) => k.netProfit,
		format: 'money' as const,
		subtitle: 'Bottom line after all charges',
	},
	{
		key: 'ebitda-margin',
		label: 'EBITDA Margin',
		icon: Percent,
		accentColor: 'var(--color-success)',
		getValue: (k: AccountingPnlKpis) => k.ebitdaMargin,
		format: 'percent' as const,
		subtitle: 'Operating profitability ratio',
	},
] as const;

export function PnlKpiRibbon({ kpis, isStale }: PnlKpiRibbonProps) {
	return (
		<div
			className="grid grid-cols-2 gap-3 lg:grid-cols-6"
			role="list"
			aria-label="P&L accounting key performance indicators"
		>
			{CARDS.map((card, index) => {
				const rawValue = card.getValue(kpis);
				const d = new Decimal(rawValue);
				const numericValue = d.toNumber();

				const accentColor =
					card.format === 'money' && d.lt(0) ? 'var(--color-error)' : card.accentColor;

				return (
					<KpiCard
						key={card.key}
						role="listitem"
						label={card.label}
						icon={card.icon}
						index={index}
						isStale={isStale}
						accentColor={accentColor}
						subtitle={card.subtitle}
					>
						{card.format === 'percent' ? (
							<Counter value={numericValue} formatter={(v) => `${v.toFixed(1)}%`} />
						) : (
							<Counter
								value={numericValue}
								formatter={(v) => formatMoney(v, { showCurrency: true, compact: true })}
							/>
						)}
					</KpiCard>
				);
			})}
		</div>
	);
}
