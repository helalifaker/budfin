import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HistoricalActual {
	id: number;
	fiscalYear: number;
	accountCode: string;
	amount: string;
	profitCenter: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ActualInput {
	fiscalYear: number;
	accountCode: string;
	amount: string;
	profitCenter?: string | null;
	notes?: string | null;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const actualKeys = {
	all: ['historical-actuals'] as const,
	list: (fiscalYear?: number) => ['historical-actuals', 'list', fiscalYear] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useHistoricalActuals(fiscalYear?: number) {
	return useQuery({
		queryKey: actualKeys.list(fiscalYear),
		queryFn: () => {
			const params = fiscalYear ? `?fiscalYear=${fiscalYear}` : '';
			return apiClient<{ actuals: HistoricalActual[] }>(`/historical-actuals${params}`);
		},
		select: (data) => data.actuals,
	});
}

export function useBulkImportActuals() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: { actuals: ActualInput[] }) =>
			apiClient<{ imported: number }>('/historical-actuals/bulk', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: actualKeys.all });
		},
	});
}
