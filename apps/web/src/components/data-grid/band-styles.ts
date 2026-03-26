import { cn } from '../../lib/cn';

export const BAND_COLOR_CLASS_MAP: Record<string, string> = {
	'var(--badge-maternelle)': 'text-(--badge-maternelle)',
	'var(--badge-elementaire)': 'text-(--badge-elementaire)',
	'var(--badge-college)': 'text-(--badge-college)',
	'var(--badge-lycee)': 'text-(--badge-lycee)',
	'var(--color-info)': 'text-(--color-info)',
	'var(--color-success)': 'text-(--color-success)',
	'var(--color-warning)': 'text-(--color-warning)',
	'var(--color-error)': 'text-(--color-error)',
	'var(--accent-600)': 'text-(--accent-600)',
};

export const BAND_BG_CLASS_MAP: Record<string, string> = {
	'var(--badge-maternelle-bg)': 'bg-(--badge-maternelle-bg)',
	'var(--badge-elementaire-bg)': 'bg-(--badge-elementaire-bg)',
	'var(--badge-college-bg)': 'bg-(--badge-college-bg)',
	'var(--badge-lycee-bg)': 'bg-(--badge-lycee-bg)',
	'var(--color-info-bg)': 'bg-(--color-info-bg)',
	'var(--color-success-bg)': 'bg-(--color-success-bg)',
	'var(--color-warning-bg)': 'bg-(--color-warning-bg)',
	'var(--color-error-bg)': 'bg-(--color-error-bg)',
	'var(--accent-50)': 'bg-(--accent-50)',
};

export const BAND_BORDER_CLASS_MAP: Record<string, string> = {
	'var(--badge-maternelle)': 'border-l-(--badge-maternelle)',
	'var(--badge-elementaire)': 'border-l-(--badge-elementaire)',
	'var(--badge-college)': 'border-l-(--badge-college)',
	'var(--badge-lycee)': 'border-l-(--badge-lycee)',
	'var(--color-info)': 'border-l-(--color-info)',
	'var(--color-success)': 'border-l-(--color-success)',
	'var(--color-warning)': 'border-l-(--color-warning)',
	'var(--color-error)': 'border-l-(--color-error)',
	'var(--accent-600)': 'border-l-(--accent-600)',
};

export function getBandClasses(
	style: { color: string; bg: string } | undefined,
	isCompact: boolean
) {
	return {
		backgroundClass: style ? BAND_BG_CLASS_MAP[style.bg] : undefined,
		borderClass:
			style && !isCompact ? cn('border-l-3', BAND_BORDER_CLASS_MAP[style.color]) : undefined,
		textClass: style ? BAND_COLOR_CLASS_MAP[style.color] : undefined,
	};
}
