import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import type { ScenarioParameters, ScenarioComparisonResponse } from '@budfin/types';

// ── Query Keys ───────────────────────────────────────────────────────────────

export const scenarioKeys = {
	all: ['scenarios'] as const,
	parameters: (versionId: number | null) => [...scenarioKeys.all, 'parameters', versionId] as const,
	comparison: (versionId: number | null) => [...scenarioKeys.all, 'comparison', versionId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useScenarioParameters(versionId: number | null) {
	return useQuery({
		queryKey: scenarioKeys.parameters(versionId),
		queryFn: () =>
			apiClient<{ data: ScenarioParameters[] }>(`/versions/${versionId}/scenarios/parameters`),
		enabled: !!versionId,
	});
}

export function useUpdateScenarioParameters(versionId: number | null) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			scenarioName,
			params,
		}: {
			scenarioName: string;
			params: Record<string, string>;
		}) =>
			apiClient<ScenarioParameters>(`/versions/${versionId}/scenarios/parameters/${scenarioName}`, {
				method: 'PATCH',
				body: JSON.stringify(params),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: scenarioKeys.parameters(versionId) });
			queryClient.invalidateQueries({ queryKey: scenarioKeys.comparison(versionId) });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Scenario parameters updated');
		},
		onError: () => {
			toast.error('Failed to update scenario parameters');
		},
	});
}

export function useScenarioComparison(versionId: number | null) {
	return useQuery({
		queryKey: scenarioKeys.comparison(versionId),
		queryFn: () =>
			apiClient<ScenarioComparisonResponse>(`/versions/${versionId}/scenarios/comparison`),
		enabled: !!versionId,
	});
}
