import { useEffect, useState } from 'react';

/**
 * Hook to delay showing skeleton loading state to prevent flicker on fast loads.
 * Standard delay is 200ms as per project conventions.
 *
 * @param isLoading - The loading state from the data hook
 * @param delay - Delay in milliseconds before showing skeleton (default: 200)
 * @returns Boolean indicating whether skeleton should be shown
 *
 * @example
 * const { data, isLoading } = useVersions();
 * const showSkeleton = useDelayedSkeleton(isLoading);
 *
 * return (
 *   <table>
 *     {isLoading && showSkeleton ? <TableSkeleton /> : <DataRows />}
 *   </table>
 * );
 */
export function useDelayedSkeleton(isLoading: boolean, delay = 200): boolean {
	const [showSkeleton, setShowSkeleton] = useState(false);

	useEffect(() => {
		if (!isLoading) {
			const t = setTimeout(() => setShowSkeleton(false), 0);
			return () => clearTimeout(t);
		}
		const t = setTimeout(() => setShowSkeleton(true), delay);
		return () => clearTimeout(t);
	}, [isLoading, delay]);

	return showSkeleton;
}
