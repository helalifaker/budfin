import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export function GuideSection({
	title,
	icon: Icon,
	children,
	defaultOpen = false,
}: {
	title: string;
	icon: LucideIcon;
	children: React.ReactNode;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className="rounded-lg border border-(--inspector-section-border) bg-(--workspace-bg-card) px-3 py-1">
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				className={cn(
					'flex w-full items-center gap-2 py-2.5',
					'text-(--text-xs) font-semibold uppercase tracking-[0.08em] text-(--text-muted)',
					'hover:text-(--text-primary) transition-colors duration-(--duration-fast)'
				)}
				aria-expanded={open}
			>
				<Icon className="h-5 w-5 text-(--accent-500)" aria-hidden="true" />
				<span className="flex-1 text-left">{title}</span>
				<ChevronDown
					className={cn(
						'h-3.5 w-3.5 transition-transform duration-(--duration-fast)',
						open && 'rotate-180'
					)}
					aria-hidden="true"
				/>
			</button>
			{open && <div className="pb-3 text-(--text-sm) text-(--text-secondary)">{children}</div>}
		</div>
	);
}
