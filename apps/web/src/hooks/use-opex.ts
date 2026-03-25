import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import { useWorkspaceContextStore } from '../stores/workspace-context-store';
import type {
	OpExLineItemsResponse,
	OpExBulkUpdatePayload,
	OpExCalculateResponse,
} from '@budfin/types';

// ── Query Keys ───────────────────────────────────────────────────────────────

export const opexKeys = {
	all: ['opex'] as const,
	lineItems: (versionId: number | null) => [...opexKeys.all, 'line-items', versionId] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useOpExLineItems(versionId: number | null) {
	return useQuery({
		queryKey: opexKeys.lineItems(versionId),
		queryFn: () => apiClient<OpExLineItemsResponse>(`/versions/${versionId}/opex/line-items`),
		enabled: !!versionId,
	});
}

export function useUpdateOpExMonthly(versionId: number | null) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (updates: { lineItemId: number; month: number; amount: string }[]) =>
			apiClient<{ updated: number }>(`/versions/${versionId}/opex/monthly`, {
				method: 'PUT',
				body: JSON.stringify({ updates }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: opexKeys.lineItems(versionId) });
		},
		onError: () => {
			toast.error('Failed to update monthly amounts');
		},
	});
}

export function useBulkUpdateOpEx(versionId: number | null) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: OpExBulkUpdatePayload) =>
			apiClient<OpExLineItemsResponse>(`/versions/${versionId}/opex/line-items/bulk`, {
				method: 'PUT',
				body: JSON.stringify(payload),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: opexKeys.lineItems(versionId) });
			toast.success('Operating expenses saved');
		},
		onError: () => {
			toast.error('Failed to save operating expenses');
		},
	});
}

export function useCalculateOpEx(versionId: number | null) {
	const queryClient = useQueryClient();
	const staleModules = useWorkspaceContextStore((s) => s.versionStaleModules);
	const isUpstreamStale = staleModules.includes('REVENUE');

	const mutation = useMutation({
		mutationFn: () =>
			apiClient<OpExCalculateResponse>(`/versions/${versionId}/calculate/opex`, { method: 'POST' }),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: opexKeys.lineItems(versionId) });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success(
				`OpEx calculated: ${data.totalOperating} SAR operating, ${data.totalNonOperating} SAR non-operating`
			);
		},
		onError: () => {
			toast.error('Failed to calculate operating expenses');
		},
	});

	return { ...mutation, isUpstreamStale };
}

export function useDeleteOpExLineItem(versionId: number | null) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (lineItemId: number) =>
			apiClient<void>(`/versions/${versionId}/opex/line-items/${lineItemId}`, { method: 'DELETE' }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: opexKeys.lineItems(versionId) });
			toast.success('Line item deleted');
		},
		onError: () => {
			toast.error('Failed to delete line item');
		},
	});
}
