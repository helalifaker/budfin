import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface WorkflowStatusCardProps {
	label: string;
	status: string;
	statusVariant: 'success' | 'warning' | 'info';
	icon: LucideIcon;
}

const VARIANT_STYLES: Record<
	WorkflowStatusCardProps['statusVariant'],
	{ border: string; iconBg: string }
> = {
	success: { border: 'border-l-(--color-success)', iconBg: 'bg-(--color-success)/15' },
	warning: { border: 'border-l-(--color-warning)', iconBg: 'bg-(--color-warning)/15' },
	info: { border: 'border-l-(--color-info)', iconBg: 'bg-(--color-info)/15' },
};

export function WorkflowStatusCard({
	label,
	status,
	statusVariant,
	icon: Icon,
}: WorkflowStatusCardProps) {
	const styles = VARIANT_STYLES[statusVariant];

	return (
		<div
			className={cn(
				'rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-4',
				'border-l-[3px]',
				styles.border
			)}
		>
			<div className="flex items-start gap-3">
				<span
					className={cn(
						'mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl',
						styles.iconBg
					)}
				>
					<Icon className="h-4 w-4 text-(--accent-700)" aria-hidden="true" />
				</span>
				<div className="space-y-1">
					<p className="text-(--text-xs) font-semibold uppercase tracking-(--tracking-wide) text-(--text-muted)">
						{label}
					</p>
					<h3 className="text-(--text-lg) font-semibold text-(--text-primary)">{status}</h3>
				</div>
			</div>
		</div>
	);
}
