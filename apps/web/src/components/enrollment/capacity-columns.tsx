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
		className: 'bg-(--color-error-bg) text-(--color-error)',
	},
	NEAR_CAP: {
		icon: AlertTriangle,
		label: 'Near capacity',
		className: 'bg-(--color-warning-bg) text-(--color-warning)',
	},
	OK: {
		icon: CheckCircle,
		label: 'OK',
		className: 'bg-(--color-success-bg) text-(--color-success)',
	},
	UNDER: {
		icon: Info,
		label: 'Under-enrolled',
		className: 'bg-(--accent-50) text-(--badge-elementaire)',
	},
};

export function AlertBadge({ alert }: AlertBadgeProps) {
	if (!alert) return <span className="text-(--text-muted)">-</span>;

	const config = ALERT_CONFIG[alert];
	if (!config) return null;

	const Icon = config.icon;
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-(--radius-sm) px-2 py-0.5 text-(--text-xs) font-medium',
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
				'tabular-nums text-(--text-sm)',
				value > 100 && 'font-medium text-(--color-error)',
				value > 95 && value <= 100 && 'text-(--color-warning)',
				value >= 70 && value <= 95 && 'text-(--color-success)',
				value < 70 && value > 0 && 'text-(--accent-600)'
			)}
		>
			{value > 0 ? `${value.toFixed(1)}%` : '-'}
		</span>
	);
}
