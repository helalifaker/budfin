import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanningRules } from '@budfin/types';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';

export function usePlanningRules(versionId: number | null) {
	return useQuery({
		queryKey: ['enrollment', 'planning-rules', versionId],
		queryFn: () => apiClient<PlanningRules>(`/versions/${versionId}/enrollment/planning-rules`),
		enabled: versionId !== null,
	});
}

export function usePutPlanningRules(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (planningRules: PlanningRules) =>
			apiClient<PlanningRules & { staleModules: string[] }>(
				`/versions/${versionId}/enrollment/planning-rules`,
				{
					method: 'PUT',
					body: JSON.stringify(planningRules),
				}
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'settings', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'planning-rules', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'cohort-parameters', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}
