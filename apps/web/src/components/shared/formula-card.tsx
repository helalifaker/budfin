import type { LucideIcon } from 'lucide-react';

export interface FormulaCardProps {
	title: string;
	formula: string;
	icon?: LucideIcon;
}

export function FormulaCard({ title, formula, icon: Icon }: FormulaCardProps) {
	return (
		<div className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">
			<div className="flex items-center gap-2">
				{Icon && <Icon className="h-4 w-4 text-(--accent-500)" aria-hidden="true" />}
				<h4 className="text-(--text-sm) font-semibold text-(--text-primary)">{title}</h4>
			</div>
			<div className="mt-2 rounded-md bg-(--workspace-bg-muted) px-3 py-2 font-[family-name:var(--font-mono)] text-(--text-xs) text-(--text-secondary)">
				{formula}
			</div>
		</div>
	);
}
