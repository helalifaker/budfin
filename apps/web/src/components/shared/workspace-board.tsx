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
					'rounded-[var(--radius-lg)] border border-[var(--workspace-border)]',
					'bg-[var(--workspace-bg-card)] p-4 shadow-[var(--shadow-xs)]'
				)}
			>
				<div className="min-w-0">
					<h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--text-primary)]">
						{title}
					</h1>
					{description && (
						<p className="mt-1 text-[length:var(--text-sm)] text-[var(--text-secondary)]">
							{description}
						</p>
					)}
				</div>
				{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
			</header>

			{/* KPI Ribbon */}
			{kpiRibbon && (
				<div
					className={cn(
						'sticky top-0 z-10',
						'rounded-[var(--radius-lg)] border border-[var(--workspace-border)]',
						'bg-white/80 px-4 py-3 shadow-[var(--shadow-sm)]',
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
