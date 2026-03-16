import type { LucideIcon } from 'lucide-react';

export interface InspectorSectionProps {
	title?: string;
	icon?: LucideIcon;
	action?: React.ReactNode;
	children: React.ReactNode;
}

export function InspectorSection({ title, icon: Icon, action, children }: InspectorSectionProps) {
	return (
		<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
			{title && (
				<div className="mb-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						{Icon && <Icon className="h-4 w-4 text-(--accent-500)" aria-hidden="true" />}
						<h3 className="text-(--text-sm) font-semibold text-(--text-primary)">{title}</h3>
					</div>
					{action}
				</div>
			)}
			{children}
		</section>
	);
}
