import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type {
	FeeGridEntry,
	DiscountEntry,
	OtherRevenueItem,
	RevenueResultsResponse,
} from '@budfin/types';

// ── Fee Grid ─────────────────────────────────────────────────────────────────

interface FeeGridResponse {
	entries: FeeGridEntry[];
}

export function useFeeGrid(versionId: number | null) {
	return useQuery({
		queryKey: ['revenue', 'fee-grid', versionId],
		queryFn: () => apiClient<FeeGridResponse>(`/versions/${versionId}/fee-grid`),
		enabled: versionId !== null,
	});
}

export function usePutFeeGrid(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (entries: FeeGridEntry[]) =>
			apiClient<{ updated: number }>(`/versions/${versionId}/fee-grid`, {
				method: 'PUT',
				body: JSON.stringify({ entries }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['revenue', 'fee-grid', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
	});
}

// ── Discounts ────────────────────────────────────────────────────────────────

interface DiscountsResponse {
	entries: DiscountEntry[];
}

export function useDiscounts(versionId: number | null) {
	return useQuery({
		queryKey: ['revenue', 'discounts', versionId],
		queryFn: () => apiClient<DiscountsResponse>(`/versions/${versionId}/discounts`),
		enabled: versionId !== null,
	});
}

export function usePutDiscounts(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (entries: DiscountEntry[]) =>
			apiClient<{ updated: number }>(`/versions/${versionId}/discounts`, {
				method: 'PUT',
				body: JSON.stringify({ entries }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['revenue', 'discounts', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
	});
}

// ── Other Revenue ────────────────────────────────────────────────────────────

interface OtherRevenueResponse {
	items: OtherRevenueItem[];
}

export function useOtherRevenue(versionId: number | null) {
	return useQuery({
		queryKey: ['revenue', 'other-revenue', versionId],
		queryFn: () => apiClient<OtherRevenueResponse>(`/versions/${versionId}/other-revenue`),
		enabled: versionId !== null,
	});
}

export function usePutOtherRevenue(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (items: OtherRevenueItem[]) =>
			apiClient<{ updated: number }>(`/versions/${versionId}/other-revenue`, {
				method: 'PUT',
				body: JSON.stringify({ items }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['revenue', 'other-revenue', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
	});
}

// ── Calculate Revenue ────────────────────────────────────────────────────────

interface CalculateRevenueResponse {
	runId: string;
	durationMs: number;
	summary: {
		totalGrossRevenueHt: string;
		totalDiscountAmount: string;
		totalNetRevenueHt: string;
		totalVatAmount: string;
		rowCount: number;
	};
}

export function useCalculateRevenue(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiClient<CalculateRevenueResponse>(`/versions/${versionId}/calculate/revenue`, {
				method: 'POST',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['revenue', 'results', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
	});
}

// ── Revenue Results ──────────────────────────────────────────────────────────

export function useRevenueResults(
	versionId: number | null,
	groupBy: 'month' | 'grade' | 'nationality' | 'tariff' = 'month'
) {
	const params = new URLSearchParams();
	params.set('group_by', groupBy);
	const query = params.toString();

	return useQuery({
		queryKey: ['revenue', 'results', versionId, groupBy],
		queryFn: () =>
			apiClient<RevenueResultsResponse>(`/versions/${versionId}/revenue-results?${query}`),
		enabled: versionId !== null,
	});
}
