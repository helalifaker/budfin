import { cn } from '../../lib/cn';

export type WorkspaceStatusStripProps = {
	children: React.ReactNode;
	className?: string;
};

export function WorkspaceStatusStrip({ children, className }: WorkspaceStatusStripProps) {
	return (
		<div
			role="status"
			aria-live="polite"
			className={cn(
				'flex shrink-0 flex-wrap items-center gap-4',
				'border-b border-(--workspace-border)',
				'bg-(--workspace-bg-subtle) px-6 py-2.5',
				'text-(--text-sm) text-(--text-muted)',
				className
			)}
		>
			{children}
		</div>
	);
}
