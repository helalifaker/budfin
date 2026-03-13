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

const UTILIZATION_SCALE_MAX = 120;
const UTILIZATION_MARKERS = [70, 85, 100] as const;

export function AlertBadge({ alert }: AlertBadgeProps) {
	if (!alert) return <span className="text-(--text-muted)">-</span>;

	const config = ALERT_CONFIG[alert];
	if (!config) return null;

	const Icon = config.icon;
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-(--text-xs) font-medium',
				config.className
			)}
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

function getGaugeFillColor(utilization: number): string {
	if (utilization > 100) return 'var(--color-error)';
	if (utilization > 95) return 'var(--color-warning)';
	if (utilization >= 70) return 'var(--color-success)';
	return 'var(--accent-600)';
}

export function UtilizationGauge({
	utilization,
	plancher,
	cible,
	plafond,
}: {
	utilization: number;
	plancher: number;
	cible: number;
	plafond: number;
}) {
	if (utilization <= 0) {
		return <span className="text-(--text-muted)">-</span>;
	}

	const fillPct = Math.min((utilization / UTILIZATION_SCALE_MAX) * 100, 100);
	const fillColor = getGaugeFillColor(utilization);
	const tooltipText = `Util: ${utilization.toFixed(1)}% | Plancher: ${plancher} | Cible: ${cible} | Plafond: ${plafond}`;

	return (
		<div className="inline-flex items-center gap-2">
			<div
				role="meter"
				aria-valuenow={utilization}
				aria-valuemin={0}
				aria-valuemax={UTILIZATION_SCALE_MAX}
				aria-label={`Utilization ${utilization.toFixed(1)}%`}
				title={tooltipText}
				className="relative inline-flex items-center"
				style={{ width: 'var(--gauge-width)', height: 'var(--gauge-height)' }}
			>
				{/* Track */}
				<div
					className="absolute inset-0 rounded-full"
					style={{ background: 'var(--gauge-track-bg)' }}
				/>
				{/* Fill */}
				<div
					className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-200"
					style={{ width: `${fillPct}%`, background: fillColor }}
				/>
				{/* Tick marks at 70%, 85%, 100% */}
				<div
					className="absolute top-0 bottom-0 w-px bg-black/20"
					style={{ left: `${(UTILIZATION_MARKERS[0] / UTILIZATION_SCALE_MAX) * 100}%` }}
				/>
				<div
					className="absolute top-0 bottom-0 w-px bg-black/20"
					style={{ left: `${(UTILIZATION_MARKERS[1] / UTILIZATION_SCALE_MAX) * 100}%` }}
				/>
				<div
					className="absolute top-0 bottom-0 w-px bg-black/20"
					style={{ left: `${(UTILIZATION_MARKERS[2] / UTILIZATION_SCALE_MAX) * 100}%` }}
				/>
			</div>
			<span
				className={cn(
					'text-(--text-xs) font-[family-name:var(--font-mono)] tabular-nums font-medium',
					utilization > 100 && 'text-(--color-error)',
					utilization > 95 && utilization <= 100 && 'text-(--color-warning)',
					utilization >= 70 && utilization <= 95 && 'text-(--color-success)',
					utilization < 70 && utilization > 0 && 'text-(--accent-600)'
				)}
			>
				{utilization.toFixed(0)}%
			</span>
		</div>
	);
}

export function DeltaCell({ delta, ay1Headcount }: { delta: number; ay1Headcount: number }) {
	const isBold = ay1Headcount > 0 && Math.abs(delta / ay1Headcount) > 0.2;
	const prefix = delta > 0 ? '+' : '';

	return (
		<span
			className={cn(
				'font-[family-name:var(--font-mono)] tabular-nums',
				delta > 0 && 'text-(--delta-positive)',
				delta < 0 && 'text-(--delta-negative)',
				delta === 0 && 'text-(--delta-zero)',
				isBold && 'font-bold'
			)}
		>
			{prefix}
			{delta}
		</span>
	);
}
