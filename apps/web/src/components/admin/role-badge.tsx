import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
	'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
	{
		variants: {
			role: {
				Admin: 'bg-red-100 text-red-800',
				BudgetOwner: 'bg-blue-100 text-blue-800',
				Editor: 'bg-green-100 text-green-800',
				Viewer: 'bg-slate-100 text-slate-800',
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
