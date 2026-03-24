import { AlertTriangle, CheckCircle, MinusCircle, PlusCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

// ── Coverage badge config ───────────────────────────────────────────────────

export interface CoverageBadgeConfig {
	label: string;
	Icon: typeof AlertTriangle;
	className: string;
}

export function getCoverageBadgeConfig(status: string): CoverageBadgeConfig {
	switch (status) {
		case 'DEFICIT':
			return {
				label: '! Deficit',
				Icon: AlertTriangle,
				className: 'bg-(--coverage-deficit) text-white',
			};
		case 'COVERED':
			return {
				label: '\u2713 Covered',
				Icon: CheckCircle,
				className: 'bg-(--coverage-covered) text-white',
			};
		case 'SURPLUS':
			return {
				label: '+ Surplus',
				Icon: PlusCircle,
				className: 'bg-(--coverage-surplus-bg) text-(--text-primary)',
			};
		case 'UNCOVERED':
			return {
				label: '\u2014 None',
				Icon: MinusCircle,
				className: 'bg-(--workspace-bg-muted) text-(--text-muted)',
			};
		default:
			return {
				label: status,
				Icon: MinusCircle,
				className: 'bg-(--workspace-bg-muted) text-(--text-muted)',
			};
	}
}

// ── Coverage badge component ────────────────────────────────────────────────

export function CoverageBadge({ status, gap }: { status: string; gap?: string }) {
	const config = getCoverageBadgeConfig(status);
	const ariaLabel = gap != null ? `Coverage: ${status}, Gap: ${gap} FTE` : `Coverage: ${status}`;
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
				config.className
			)}
			aria-label={ariaLabel}
		>
			<config.Icon className="h-3 w-3" aria-hidden="true" />
			{config.label}
		</span>
	);
}

// ── Gap tint class ──────────────────────────────────────────────────────────

export function getGapTintClass(gap: string): string {
	const num = parseFloat(gap);
	if (num < 0) return 'bg-(--gap-negative-bg)';
	if (num > 0) return 'bg-(--gap-positive-bg)';
	return 'bg-(--gap-zero-bg)';
}
