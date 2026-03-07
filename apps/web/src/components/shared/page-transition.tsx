import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PageTransitionProps {
	children: ReactNode;
	className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
	return (
		<div
			className={cn('animate-slide-up', className)}
			style={{
				animationDuration: 'var(--duration-normal)',
				animationTimingFunction: 'var(--ease-out-expo)',
			}}
		>
			{children}
		</div>
	);
}
