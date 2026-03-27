import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { KpiCard } from '../shared/kpi-card';

export type AdminKpiItem = {
	label: string;
	icon: LucideIcon;
	value: ReactNode;
	subtitle?: ReactNode;
	accentColor?: string;
};

export type AdminKpiRibbonProps = {
	items: AdminKpiItem[];
};

export function AdminKpiRibbon({ items }: AdminKpiRibbonProps) {
	if (items.length === 0) return null;

	return (
		<div role="list" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{items.map((item, index) => (
				<KpiCard
					key={item.label}
					role="listitem"
					label={item.label}
					icon={item.icon}
					index={index}
					accentColor={item.accentColor ?? 'var(--accent-500)'}
					subtitle={item.subtitle}
				>
					{item.value}
				</KpiCard>
			))}
		</div>
	);
}
