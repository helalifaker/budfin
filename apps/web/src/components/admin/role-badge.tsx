import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
	'inline-flex items-center rounded-[var(--radius-sm)] px-2.5 py-0.5 text-[length:var(--text-xs)] font-medium',
	{
		variants: {
			role: {
				Admin: 'bg-[var(--badge-admin-bg)] text-[var(--badge-admin)]',
				BudgetOwner: 'bg-[var(--accent-50)] text-[var(--accent-700)]',
				Editor: 'bg-[var(--badge-editor-bg)] text-[var(--badge-editor)]',
				Viewer: 'bg-[var(--workspace-bg-muted)] text-[var(--text-primary)]',
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
