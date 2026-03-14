import { cn } from '../../lib/cn';

export interface StatusSection {
	key: string;
	label: string;
	value: React.ReactNode;
	severity?: 'default' | 'warning' | 'success' | 'error';
	badge?: boolean;
	priority?: number;
}

export interface WorkspaceStatusStripProps {
	sections: StatusSection[];
}

const SEVERITY_CLASSES: Record<NonNullable<StatusSection['severity']>, string> = {
	default: 'text-(--text-secondary)',
	warning: 'text-(--color-warning)',
	success: 'text-(--color-success)',
	error: 'text-(--color-error)',
};

export function WorkspaceStatusStrip({ sections }: WorkspaceStatusStripProps) {
	const sorted = [...sections].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

	return (
		<div className="flex shrink-0 items-center gap-4 border-b border-(--workspace-border) bg-(--workspace-bg-subtle) px-6 py-2.5 text-(--text-sm) text-(--text-muted)">
			{sorted.map((section) => {
				const severity = section.severity ?? 'default';
				const valueClass = SEVERITY_CLASSES[severity];

				if (section.badge) {
					return (
						<span key={section.key} className={cn('font-medium', valueClass)}>
							{section.value}
						</span>
					);
				}

				return (
					<span key={section.key}>
						<span className="font-semibold text-(--text-secondary)">{section.label}:</span>{' '}
						<span className={cn('font-medium', valueClass)}>{section.value}</span>
					</span>
				);
			})}
		</div>
	);
}
