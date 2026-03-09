import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
	return (
		<div className={cn('rounded-(--radius-md) animate-shimmer', className)} aria-hidden="true" />
	);
}

export function TableSkeleton({ rows = 10, cols }: { rows?: number; cols: number }) {
	return (
		<>
			{Array.from({ length: rows }).map((_, i) => (
				<tr key={i} aria-hidden="true">
					{Array.from({ length: cols }).map((_, j) => (
						<td key={j} className="px-4 py-3">
							<Skeleton className="h-4 w-full" />
						</td>
					))}
				</tr>
			))}
		</>
	);
}
