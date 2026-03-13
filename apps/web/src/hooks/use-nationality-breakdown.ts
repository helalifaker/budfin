import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import type { NationalityBreakdownEntry } from '@budfin/types';

// ── Response types ───────────────────────────────────────────────────────────

export interface NationalityBreakdownResponse {
	entries: NationalityBreakdownEntry[];
}

export interface NationalityOverride {
	gradeLevel: string;
	nationality: string;
	weight: number;
	headcount: number;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useNationalityBreakdown(versionId: number | null, academicPeriod?: string | null) {
	const params = new URLSearchParams();
	if (academicPeriod) params.set('academic_period', academicPeriod);
	const query = params.toString();

	return useQuery({
		queryKey: ['enrollment', 'nationality-breakdown', versionId, academicPeriod],
		queryFn: () =>
			apiClient<NationalityBreakdownResponse>(
				`/versions/${versionId}/enrollment/nationality-breakdown${query ? `?${query}` : ''}`
			),
		enabled: versionId !== null,
	});
}

export function usePutNationalityBreakdown(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (overrides: NationalityOverride[]) =>
			apiClient<{ updated: number }>(`/versions/${versionId}/enrollment/nationality-breakdown`, {
				method: 'PUT',
				body: JSON.stringify({ overrides }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'nationality-breakdown', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['revenue', 'readiness', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function useResetNationalityBreakdown(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (gradeLevel: string) =>
			apiClient<{ deleted: number }>(
				`/versions/${versionId}/enrollment/nationality-breakdown/${gradeLevel}`,
				{
					method: 'DELETE',
				}
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'nationality-breakdown', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['revenue', 'readiness', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}
