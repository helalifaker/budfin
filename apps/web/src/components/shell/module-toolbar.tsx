import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ModuleToolbarProps {
	title: string;
	children?: ReactNode;
	className?: string;
}

export function ModuleToolbar({ title, children, className }: ModuleToolbarProps) {
	return (
		<div
			className={cn(
				'flex h-12 shrink-0 items-center justify-between gap-4 px-6',
				'border-b border-(--workspace-border)',
				'bg-(--workspace-bg)',
				'sticky top-0 z-10',
				className
			)}
		>
			<h1 className="text-(--text-xl) font-semibold text-(--text-primary) truncate">{title}</h1>
			{children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
		</div>
	);
}
