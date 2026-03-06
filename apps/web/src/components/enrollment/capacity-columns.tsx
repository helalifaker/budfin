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
		className: 'bg-red-100 text-red-800',
	},
	NEAR_CAP: {
		icon: AlertTriangle,
		label: 'Near capacity',
		className: 'bg-amber-100 text-amber-800',
	},
	OK: {
		icon: CheckCircle,
		label: 'OK',
		className: 'bg-green-100 text-green-800',
	},
	UNDER: {
		icon: Info,
		label: 'Under-enrolled',
		className: 'bg-blue-100 text-blue-800',
	},
};

export function AlertBadge({ alert }: AlertBadgeProps) {
	if (!alert) return <span className="text-slate-300">-</span>;

	const config = ALERT_CONFIG[alert];
	if (!config) return null;

	const Icon = config.icon;
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
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
				'tabular-nums text-sm',
				value > 100 && 'font-medium text-red-600',
				value > 95 && value <= 100 && 'text-amber-600',
				value >= 70 && value <= 95 && 'text-green-600',
				value < 70 && value > 0 && 'text-blue-600'
			)}
		>
			{value > 0 ? `${value.toFixed(1)}%` : '-'}
		</span>
	);
}
