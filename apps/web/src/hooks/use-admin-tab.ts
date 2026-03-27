import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * URL-synced tab state for admin pages.
 * Reads `?tab=` from search params and provides a setter that updates the URL.
 */
export function useAdminTab<T extends string>(
	defaultTab: T,
	validTabs: readonly T[]
): [T, (tab: T) => void] {
	const [searchParams, setSearchParams] = useSearchParams();

	const activeTab = useMemo(() => {
		const param = searchParams.get('tab');
		return validTabs.includes(param as T) ? (param as T) : defaultTab;
	}, [searchParams, validTabs, defaultTab]);

	const setTab = useCallback(
		(tab: T) => {
			setSearchParams({ tab }, { replace: true });
		},
		[setSearchParams]
	);

	return [activeTab, setTab];
}
