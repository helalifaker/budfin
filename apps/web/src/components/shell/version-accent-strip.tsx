import { useWorkspaceContextStore } from '../../stores/workspace-context-store';
import { cn } from '../../lib/cn';

const VERSION_TYPE_GRADIENT: Record<string, string> = {
	Budget: 'linear-gradient(90deg, var(--version-budget) 0%, var(--version-budget-bg) 100%)',
	Forecast: 'linear-gradient(90deg, var(--version-forecast) 0%, var(--version-forecast-bg) 100%)',
	Actual: 'linear-gradient(90deg, var(--version-actual) 0%, var(--version-actual-bg) 100%)',
};

export function VersionAccentStrip() {
	const versionType = useWorkspaceContextStore((s) => s.versionType);
	const gradient = versionType ? VERSION_TYPE_GRADIENT[versionType] : undefined;

	return (
		<div
			className={cn(
				'h-[2px] w-full shrink-0',
				'transition-[background] duration-(--duration-slow)'
			)}
			style={{
				background: gradient ?? 'var(--workspace-border)',
			}}
			aria-hidden="true"
		/>
	);
}
