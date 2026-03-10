import { Lock, Eye, Archive } from 'lucide-react';
import { cn } from '../../lib/cn';

export type VersionLockBannerProps = {
	status: string;
	versionName?: string | undefined;
};

const STATUS_CONFIG: Record<string, { icon: typeof Lock; label: string; className: string }> = {
	Published: {
		icon: Eye,
		label: 'This version is published and read-only.',
		className: 'bg-(--color-info-bg) text-(--color-info) border-(--color-info)/20',
	},
	Locked: {
		icon: Lock,
		label: 'This version is locked. No changes allowed.',
		className: 'bg-(--status-locked-bg) text-(--status-locked) border-(--status-locked)/20',
	},
	Archived: {
		icon: Archive,
		label: 'This version is archived.',
		className: 'bg-(--workspace-bg-muted) text-(--text-muted) border-(--workspace-border)',
	},
};

export function VersionLockBanner({ status, versionName }: VersionLockBannerProps) {
	const config = STATUS_CONFIG[status];
	if (!config) return null;

	const Icon = config.icon;

	return (
		<div
			className={cn(
				'flex items-center gap-2 rounded-lg border px-3 py-2',
				'text-(--text-sm) font-medium',
				config.className
			)}
			role="status"
			aria-label={config.label}
		>
			<Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
			<span>
				{config.label}
				{versionName && <span className="ml-1 font-normal opacity-70">({versionName})</span>}
			</span>
		</div>
	);
}
