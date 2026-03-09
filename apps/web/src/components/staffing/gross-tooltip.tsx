import type { ReactNode } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/tooltip';

export type GrossTooltipData = {
	baseSalary: string | null;
	housingAllowance: string | null;
	transportAllowance: string | null;
	responsibilityPremium: string | null;
	hsaAmount: string | null;
	hourlyPercentage: string;
	/** Pre-computed subtotal from API (base_gross) */
	subtotal: string;
	/** Pre-computed monthly gross from API (adjusted_gross) */
	monthlyGross: string;
	isTeaching: boolean;
};

const sarFormatter = new Intl.NumberFormat('en-SA', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

function formatSar(val: string | null): string {
	if (val === null) return '0.00';
	return sarFormatter.format(Number(val));
}

function BreakdownRow({
	label,
	value,
	note,
	bold,
}: {
	label: string;
	value: string;
	note?: string;
	bold?: boolean;
}) {
	return (
		<div className={`flex justify-between gap-6 ${bold ? 'font-semibold' : ''}`}>
			<span className="whitespace-nowrap">
				{label}
				{note && <span className="opacity-70"> {note}</span>}
			</span>
			<span className="font-[family-name:var(--font-mono)] tabular-nums whitespace-nowrap">
				SAR {value}
			</span>
		</div>
	);
}

export type GrossTooltipProps = {
	data: GrossTooltipData;
	children: ReactNode;
};

export function GrossTooltip({ data, children }: GrossTooltipProps) {
	const baseSalary = formatSar(data.baseSalary);
	const housing = formatSar(data.housingAllowance);
	const transport = formatSar(data.transportAllowance);
	const premium = formatSar(data.responsibilityPremium);
	const hsa = formatSar(data.hsaAmount);
	const subtotal = formatSar(data.subtotal);
	const hourlyPct = Number(data.hourlyPercentage);
	const hourlyDisplay = `${(hourlyPct * 100).toFixed(0)}%`;
	const monthlyGross = formatSar(data.monthlyGross);

	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>{children}</TooltipTrigger>
				<TooltipContent
					side="top"
					align="end"
					className="w-[280px] space-y-0.5 p-3 text-(length:--text-xs)"
					aria-label="Monthly gross calculation breakdown"
				>
					<div className="mb-1.5 font-semibold">Monthly Gross Breakdown</div>
					<BreakdownRow label="Base Salary:" value={baseSalary} />
					<BreakdownRow label="Housing (IL):" value={housing} />
					<BreakdownRow label="Transport (IT):" value={transport} />
					<BreakdownRow label="Premium:" value={premium} />
					<BreakdownRow label="HSA:" value={hsa} {...(data.isTeaching ? { note: '*' } : {})} />
					<div className="my-1 border-t border-current opacity-30" role="separator" />
					<BreakdownRow label="Subtotal:" value={subtotal} />
					<div className="flex justify-between gap-6">
						<span className="whitespace-nowrap">{'\u00D7 Hourly %:'}</span>
						<span className="font-[family-name:var(--font-mono)] tabular-nums">
							{hourlyDisplay}
						</span>
					</div>
					<div className="my-1 border-t border-current opacity-30" role="separator" />
					<BreakdownRow label="Monthly Gross:" value={monthlyGross} bold />
					{data.isTeaching && (
						<div className="mt-1.5 opacity-70 italic">* HSA excluded Jul-Aug</div>
					)}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
