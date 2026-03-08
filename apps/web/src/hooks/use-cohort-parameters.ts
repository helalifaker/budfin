import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import type { CohortParameterEntry } from '@budfin/types';

// ── Response types ───────────────────────────────────────────────────────────

export interface CohortParametersResponse {
	entries: CohortParameterEntry[];
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useCohortParameters(versionId: number | null) {
	return useQuery({
		queryKey: ['enrollment', 'cohort-parameters', versionId],
		queryFn: () =>
			apiClient<CohortParametersResponse>(`/versions/${versionId}/enrollment/cohort-parameters`),
		enabled: versionId !== null,
	});
}

export function usePutCohortParameters(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (entries: CohortParameterEntry[]) =>
			apiClient<{ updated: number; staleModules: string[] }>(
				`/versions/${versionId}/enrollment/cohort-parameters`,
				{
					method: 'PUT',
					body: JSON.stringify({ entries }),
				}
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'cohort-parameters', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}
