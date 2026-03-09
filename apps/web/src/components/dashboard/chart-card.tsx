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
		<Card className={cn('hover:shadow-(--shadow-sm) hover:-translate-y-px', className)}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{children ?? (
					<div className="flex h-48 items-center justify-center rounded-md bg-(--workspace-bg-subtle)">
						<p className="text-(--text-sm) text-(--text-muted)">Chart data not available</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
