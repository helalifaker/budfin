import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { CapacityAlert } from '@budfin/types';

interface AlertBadgeProps {
	alert: CapacityAlert | null;
}

const ALERT_CONFIG: Record<
	string,
	{ icon: typeof AlertTriangle; label: string; className: string }
> = {
	OVER: {
		icon: AlertTriangle,
		label: 'Over capacity',
		className: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
	},
	NEAR_CAP: {
		icon: AlertTriangle,
		label: 'Near capacity',
		className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
	},
	OK: {
		icon: CheckCircle,
		label: 'OK',
		className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
	},
	UNDER: {
		icon: Info,
		label: 'Under-enrolled',
		className: 'bg-[var(--accent-50)] text-[var(--badge-elementaire)]',
	},
};

export function AlertBadge({ alert }: AlertBadgeProps) {
	if (!alert) return <span className="text-[var(--text-muted)]">-</span>;

	const config = ALERT_CONFIG[alert];
	if (!config) return null;

	const Icon = config.icon;
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-0.5 text-[length:var(--text-xs)] font-medium',
				config.className
			)}
			role="status"
			aria-label={config.label}
		>
			<Icon className="h-3 w-3" aria-hidden="true" />
			{config.label}
		</span>
	);
}

export function UtilizationCell({ value }: { value: number }) {
	return (
		<span
			className={cn(
				'tabular-nums text-[length:var(--text-sm)]',
				value > 100 && 'font-medium text-[var(--color-error)]',
				value > 95 && value <= 100 && 'text-[var(--color-warning)]',
				value >= 70 && value <= 95 && 'text-[var(--color-success)]',
				value < 70 && value > 0 && 'text-[var(--accent-600)]'
			)}
		>
			{value > 0 ? `${value.toFixed(1)}%` : '-'}
		</span>
	);
}
