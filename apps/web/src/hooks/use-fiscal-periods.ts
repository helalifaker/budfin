import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';

export interface FiscalPeriod {
	id: number;
	fiscalYear: number;
	month: number;
	status: string;
	actualVersionId: number | null;
	lockedAt: string | null;
	lockedById: number | null;
	createdAt: string;
	updatedAt: string;
}

export function useFiscalPeriods(fiscalYear: number) {
	return useQuery({
		queryKey: ['fiscal-periods', fiscalYear],
		queryFn: () => apiClient<FiscalPeriod[]>(`/fiscal-periods/${fiscalYear}`),
	});
}

export function useLockFiscalPeriod() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			fiscalYear,
			month,
			actual_version_id,
		}: {
			fiscalYear: number;
			month: number;
			actual_version_id: number;
		}) =>
			apiClient<FiscalPeriod>(`/fiscal-periods/${fiscalYear}/${month}/lock`, {
				method: 'PATCH',
				body: JSON.stringify({ actual_version_id }),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] }),
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}
