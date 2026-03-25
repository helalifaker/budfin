import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import type { ExportJobResponse, ExportReportType, ExportFormat } from '@budfin/types';

// ── Query Keys ──────────────────────────────────────────────────────────────

export const exportKeys = {
	all: ['export'] as const,
	job: (jobId: number) => ['export', 'job', jobId] as const,
};

// ── Create Export Job Mutation ───────────────────────────────────────────────

export function useCreateExportJob() {
	return useMutation({
		mutationFn: async (params: {
			versionId: number;
			reportType: ExportReportType;
			format: ExportFormat;
			comparisonVersionId?: number;
		}) => {
			return apiClient<ExportJobResponse>('/export/jobs', {
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
		queryKey: exportKeys.job(jobId!),
		queryFn: async () => {
			return apiClient<ExportJobResponse>(`/export/jobs/${jobId}`);
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
