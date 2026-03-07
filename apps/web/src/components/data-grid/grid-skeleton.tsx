import { Skeleton } from '../ui/skeleton';

interface GridSkeletonProps {
	rows?: number;
	cols: number;
}

export function GridSkeleton({ rows = 10, cols }: GridSkeletonProps) {
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
