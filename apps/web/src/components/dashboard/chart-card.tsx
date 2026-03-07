import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

interface ChartCardProps {
	title: string;
	children?: ReactNode;
	className?: string;
}

export function ChartCard({ title, children, className }: ChartCardProps) {
	return (
		<Card className={cn('hover:shadow-[var(--shadow-sm)] hover:-translate-y-px', className)}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{children ?? (
					<div className="flex h-48 items-center justify-center rounded-[var(--radius-md)] bg-[var(--workspace-bg-subtle)]">
						<p className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
							Chart data not available
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
