import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export interface CreateVersionInput {
	name: string;
	type: 'Budget' | 'Forecast';
	fiscalYear: number;
	description?: string;
	sourceVersionId?: number;
}

export interface CloneVersionInput {
	name: string;
	fiscalYear?: number;
}

export interface PatchStatusInput {
	new_status: BudgetVersion['status'];
	audit_note?: string;
}

export function useCreateVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateVersionInput) =>
			apiClient<BudgetVersion>('/versions', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['versions'] }),
	});
}

export function useCloneVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...data }: { id: number } & CloneVersionInput) =>
			apiClient<BudgetVersion>(`/versions/${id}/clone`, {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['versions'] }),
	});
}

export function usePatchVersionStatus() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...data }: { id: number } & PatchStatusInput) =>
			apiClient<BudgetVersion>(`/versions/${id}/status`, {
				method: 'PATCH',
				body: JSON.stringify(data),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['versions'] }),
	});
}

export function useDeleteVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/versions/${id}`, { method: 'DELETE' }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['versions'] }),
	});
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
