import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type WorkspaceBoardProps = {
	title: string;
	description?: string;
	actions?: ReactNode;
	kpiRibbon?: ReactNode;
	children: ReactNode;
};

export function WorkspaceBoard({
	title,
	description,
	actions,
	kpiRibbon,
	children,
}: WorkspaceBoardProps) {
	return (
		<div className="space-y-4">
			{/* Header */}
			<header
				className={cn(
					'flex items-start justify-between gap-4',
					'rounded-lg border border-(--workspace-border)',
					'border-t-[3px] border-t-(--accent-500)',
					'bg-(--workspace-bg-card) p-5 shadow-(--shadow-card)'
				)}
			>
				<div className="min-w-0">
					<h1 className="text-(--text-2xl) font-bold font-[family-name:var(--font-display)] text-(--text-primary)">
						{title}
					</h1>
					{description && (
						<p className="mt-2 text-(--text-sm) text-(--text-muted)">{description}</p>
					)}
				</div>
				{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
			</header>

			{/* KPI Ribbon */}
			{kpiRibbon && (
				<div
					className={cn(
						'sticky top-0 z-10',
						'rounded-lg border border-(--workspace-border)',
						'bg-(--glass-bg-strong) px-4 py-3 shadow-(--shadow-sm)',
						'backdrop-blur-md'
					)}
					role="region"
					aria-label="Key metrics"
				>
					{kpiRibbon}
				</div>
			)}

			{/* Content blocks */}
			<div className="space-y-4">{children}</div>
		</div>
	);
}
