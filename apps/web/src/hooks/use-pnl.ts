import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import { useWorkspaceContextStore } from '../stores/workspace-context-store';
import type {
	PnlResultsResponse,
	PnlKpis,
	PnlCalculateResponse,
	PnlFormat,
	ExportJobResponse,
	ExportFormat,
	ExportReportType,
} from '@budfin/types';

// ── Query Keys ──────────────────────────────────────────────────────────────

export const pnlKeys = {
	all: ['pnl'] as const,
	results: (versionId: number, format: PnlFormat, comparisonVersionId?: number) =>
		['pnl', 'results', versionId, format, comparisonVersionId] as const,
	kpis: (versionId: number) => ['pnl', 'kpis', versionId] as const,
	exportJob: (jobId: number) => ['pnl', 'export-job', jobId] as const,
};

// ── P&L Results Hook ────────────────────────────────────────────────────────

export function usePnlResults(format: PnlFormat = 'ifrs', comparisonVersionId?: number) {
	const versionId = useWorkspaceContextStore((s) => s.versionId);

	return useQuery({
		queryKey: pnlKeys.results(versionId!, format, comparisonVersionId),
		queryFn: async () => {
			const params = new URLSearchParams({ format });
			if (comparisonVersionId) {
				params.set('comparison_version_id', String(comparisonVersionId));
			}
			return apiClient<PnlResultsResponse>(
				`/api/v1/versions/${versionId}/pnl?${params.toString()}`
			);
		},
		enabled: !!versionId,
		staleTime: 30_000,
	});
}

// ── P&L KPIs Hook ───────────────────────────────────────────────────────────

export function usePnlKpis() {
	const versionId = useWorkspaceContextStore((s) => s.versionId);

	return useQuery({
		queryKey: pnlKeys.kpis(versionId!),
		queryFn: async () => {
			return apiClient<PnlKpis>(`/api/v1/versions/${versionId}/pnl/kpis`);
		},
		enabled: !!versionId,
		staleTime: 30_000,
	});
}

// ── Calculate P&L Mutation ──────────────────────────────────────────────────

export function useCalculatePnl() {
	const queryClient = useQueryClient();
	const versionId = useWorkspaceContextStore((s) => s.versionId);

	return useMutation({
		mutationFn: async () => {
			return apiClient<PnlCalculateResponse>(`/api/v1/versions/${versionId}/calculate/pnl`, {
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

// ── Export Job Mutation ──────────────────────────────────────────────────────

export function useCreateExportJob() {
	return useMutation({
		mutationFn: async (params: {
			versionId: number;
			reportType: ExportReportType;
			format: ExportFormat;
			comparisonVersionId?: number;
		}) => {
			return apiClient<ExportJobResponse>('/api/v1/export/jobs', {
				method: 'POST',
				body: JSON.stringify(params),
			});
		},
		onSuccess: () => {
			toast.info('Export started — generating report...');
		},
		onError: (error: Error) => {
			toast.error(`Export failed: ${error.message}`);
		},
	});
}

// ── Export Job Polling Hook ──────────────────────────────────────────────────

export function useExportJobStatus(jobId: number | null) {
	return useQuery({
		queryKey: pnlKeys.exportJob(jobId!),
		queryFn: async () => {
			return apiClient<ExportJobResponse>(`/api/v1/export/jobs/${jobId}`);
		},
		enabled: !!jobId,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (status === 'DONE' || status === 'FAILED') return false;
			return 2_000;
		},
		staleTime: 0,
	});
}
