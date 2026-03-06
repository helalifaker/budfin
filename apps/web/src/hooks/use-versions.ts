import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface BudgetVersion {
	id: number;
	fiscalYear: number;
	name: string;
	type: 'Budget' | 'Forecast' | 'Actual';
	status: 'Draft' | 'Published' | 'Locked' | 'Archived';
	description: string | null;
	dataSource: string;
	sourceVersionId: number | null;
	modificationCount: number;
	staleModules: string[];
	createdById: number;
	createdByEmail: string | null;
	publishedAt: string | null;
	lockedAt: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface VersionListResponse {
	data: BudgetVersion[];
	total: number;
	nextCursor: number | null;
}

export function useVersions(fiscalYear?: number, status?: string) {
	const params = new URLSearchParams();
	if (fiscalYear) params.set('fiscalYear', String(fiscalYear));
	if (status) params.set('status', status);
	const query = params.toString();

	return useQuery({
		queryKey: ['versions', { fiscalYear, status }],
		queryFn: () =>
			apiClient<VersionListResponse>(`/versions${query ? `?${query}` : ''}`),
	});
}
