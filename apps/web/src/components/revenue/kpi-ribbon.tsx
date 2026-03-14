import Decimal from 'decimal.js';
import { cn } from '../../lib/cn';
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

type KpiCardDefinition = {
	label: string;
	value: string;
	subtitle: string;
	accent: 'blue' | 'red' | 'green' | 'default';
};

const ACCENT_CLASSES: Record<KpiCardDefinition['accent'], string> = {
	blue: 'border-l-(--color-info)',
	red: 'border-l-(--color-error)',
	green: 'border-l-(--color-success)',
	default: 'border-l-(--workspace-border)',
};

function buildKpiCards({
	grossHt,
	totalDiscounts,
	netRevenue,
	otherRevenue,
	totalOperatingRevenue,
	avgPerStudent,
}: Omit<RevenueKpiRibbonProps, 'isStale'>): KpiCardDefinition[] {
	const gross = new Decimal(grossHt);
	const discounts = new Decimal(totalDiscounts);
	const discountRatio = gross.eq(0) ? '0.0' : discounts.div(gross).mul(100).toFixed(1);

	return [
		{
			label: 'Gross Tuition HT',
			value: formatMoney(grossHt, { showCurrency: true }),
			subtitle: 'Primary tuition forecast',
			accent: 'blue',
		},
		{
			label: 'Total Discounts',
			value: formatMoney(totalDiscounts, { showCurrency: true }),
			subtitle: `${discountRatio}% of gross tuition`,
			accent: 'red',
		},
		{
			label: 'Net Revenue HT',
			value: formatMoney(netRevenue, { showCurrency: true }),
			subtitle: 'Headline tuition revenue',
			accent: 'green',
		},
		{
			label: 'Other Revenue',
			value: formatMoney(otherRevenue, { showCurrency: true }),
			subtitle: 'Registration, activities, exams',
			accent: 'default',
		},
		{
			label: 'Total Operating Revenue',
			value: formatMoney(totalOperatingRevenue, { showCurrency: true }),
			subtitle: `${formatMoney(avgPerStudent, { showCurrency: true })} avg/student`,
			accent: 'green',
		},
	];
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
	const cards = buildKpiCards({
		grossHt,
		totalDiscounts,
		netRevenue,
		otherRevenue,
		totalOperatingRevenue,
		avgPerStudent,
	});

	return (
		<div
			className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5"
			role="list"
			aria-label="Revenue key performance indicators"
		>
			{cards.map((card) => (
				<div
					key={card.label}
					role="listitem"
					className={cn(
						'relative rounded-2xl border border-(--workspace-border) border-l-4 bg-(--workspace-bg-card) p-4 shadow-(--shadow-xs)',
						ACCENT_CLASSES[card.accent],
						isStale && 'opacity-60'
					)}
				>
					{isStale && (
						<span
							className="absolute right-4 top-4 size-2.5 animate-pulse rounded-full bg-(--color-stale)"
							aria-hidden="true"
						/>
					)}
					<div className="text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)">
						{card.label}
					</div>
					<div className="mt-2 font-[family-name:var(--font-mono)] text-(--text-xl) font-bold text-(--text-primary)">
						{card.value}
					</div>
					<div className="mt-1 text-(--text-xs) text-(--text-secondary)">{card.subtitle}</div>
				</div>
			))}
		</div>
	);
}
