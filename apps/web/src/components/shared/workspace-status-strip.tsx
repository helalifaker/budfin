import { cn } from '../../lib/cn';

export interface StatusSection {
	key: string;
	label: string;
	value: React.ReactNode;
	severity?: 'default' | 'warning' | 'success' | 'error';
	badge?: boolean;
	priority?: number;
}

export type WorkspaceStatusStripProps = {
	sections: StatusSection[];
	className?: string;
};

const SEVERITY_CLASSES: Record<string, string> = {
	default: 'text-(--text-muted)',
	warning: 'text-(--color-warning)',
	success: 'text-(--color-success)',
	error: 'text-(--color-error)',
};

export function WorkspaceStatusStrip({ sections, className }: WorkspaceStatusStripProps) {
	const sorted = [...sections].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

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
			{sorted.map((section) => (
				<span
					key={section.key}
					className={cn(
						'flex items-center gap-1.5',
						SEVERITY_CLASSES[section.severity ?? 'default']
					)}
				>
					<span className="font-medium">{section.label}:</span>
					{section.value}
				</span>
			))}
		</div>
	);
}
