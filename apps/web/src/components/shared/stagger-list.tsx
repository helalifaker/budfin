import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface StaggerListProps {
	children: ReactNode[];
	delay?: number;
	className?: string;
}

export function StaggerList({ children, delay = 50, className }: StaggerListProps) {
	return (
		<div className={cn('flex flex-col', className)}>
			{children.map((child, i) => (
				<div
					key={i}
					className="animate-stagger-reveal"
					style={{ animationDelay: `${i * delay}ms` }}
				>
					{child}
				</div>
			))}
		</div>
	);
}
