import { cn } from '../../lib/cn';

export type StalePillProps = {
	label: string;
	className?: string;
};

export function StalePill({ label, className }: StalePillProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center rounded-full',
				'bg-(--color-warning-bg) px-2 py-0.5',
				'text-(--text-xs) font-medium text-(--color-warning)',
				className
			)}
		>
			{label}
		</span>
	);
}
