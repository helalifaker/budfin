import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
	'inline-flex items-center rounded-sm px-2.5 py-0.5 text-(--text-xs) font-medium',
	{
		variants: {
			role: {
				Admin: 'bg-(--badge-admin-bg) text-(--badge-admin)',
				BudgetOwner: 'bg-(--accent-50) text-(--accent-700)',
				Editor: 'bg-(--badge-editor-bg) text-(--badge-editor)',
				Viewer: 'bg-(--workspace-bg-muted) text-(--text-primary)',
			},
		},
		defaultVariants: {
			role: 'Viewer',
		},
	}
);

type RoleBadgeProps = VariantProps<typeof badgeVariants> & {
	className?: string;
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
	const label = role === 'BudgetOwner' ? 'Budget Owner' : role;
	return <span className={cn(badgeVariants({ role }), className)}>{label}</span>;
}
