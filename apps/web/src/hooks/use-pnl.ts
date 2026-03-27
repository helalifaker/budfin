import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import { useWorkspaceContextStore } from '../stores/workspace-context-store';
import type { PnlResultsResponse, PnlKpis, PnlCalculateResponse, PnlFormat } from '@budfin/types';

// Re-export from dedicated export hook for backward compatibility
export { useCreateExportJob, useExportJobStatus } from './use-export.js';

// ── Query Keys ──────────────────────────────────────────────────────────────

export const pnlKeys = {
	all: ['pnl'] as const,
	results: (versionId: number, format: PnlFormat, comparisonVersionId?: number) =>
		['pnl', 'results', versionId, format, comparisonVersionId] as const,
	kpis: (versionId: number) => ['pnl', 'kpis', versionId] as const,
};

// ── P&L Results Hook ────────────────────────────────────────────────────────

export function usePnlResults(format: PnlFormat = 'ifrs', comparisonVersionId?: number) {
	const versionId = useWorkspaceContextStore((s) => s.versionId);

	return useQuery({
		queryKey: pnlKeys.results(versionId ?? 0, format, comparisonVersionId),
		queryFn: async () => {
			const params = new URLSearchParams({ format });
			if (comparisonVersionId) {
				params.set('comparison_version_id', String(comparisonVersionId));
			}
			return apiClient<PnlResultsResponse>(`/versions/${versionId}/pnl?${params.toString()}`);
		},
		enabled: !!versionId,
		staleTime: 30_000,
		retry: (failureCount, error) => {
			if (error instanceof ApiError && error.code === 'PNL_NOT_CALCULATED') return false;
			return failureCount < 3;
		},
	});
}

// ── P&L KPIs Hook ───────────────────────────────────────────────────────────

export function usePnlKpis() {
	const versionId = useWorkspaceContextStore((s) => s.versionId);

	return useQuery({
		queryKey: pnlKeys.kpis(versionId ?? 0),
		queryFn: async () => {
			return apiClient<PnlKpis>(`/versions/${versionId}/pnl/kpis`);
		},
		enabled: !!versionId,
		staleTime: 30_000,
		retry: (failureCount, error) => {
			if (error instanceof ApiError && error.code === 'PNL_NOT_CALCULATED') return false;
			return failureCount < 3;
		},
	});
}

// ── Calculate P&L Mutation ──────────────────────────────────────────────────

export function useCalculatePnl() {
	const queryClient = useQueryClient();
	const versionId = useWorkspaceContextStore((s) => s.versionId);

	return useMutation({
		mutationFn: async () => {
			return apiClient<PnlCalculateResponse>(`/versions/${versionId}/calculate/pnl`, {
				method: 'POST',
			});
		},
		onSuccess: (data) => {
			toast.success(`P&L calculated — Net profit: ${data.netProfit} SAR (${data.durationMs}ms)`);
			void queryClient.invalidateQueries({ queryKey: ['pnl'] });
			void queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (error: Error & { status?: number; body?: { staleModules?: string[] } }) => {
			if (error.status === 409) {
				const modules = error.body?.staleModules?.join(', ') ?? 'upstream modules';
				toast.warning(`Prerequisites outdated — recalculate: ${modules}`);
			} else {
				toast.error(`Calculation failed: ${error.message}`);
			}
		},
	});
}
