import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import type {
	FeeGridEntry,
	DiscountEntry,
	OtherRevenueItem,
	RevenueSettings,
	RevenueReadinessResponse,
	RevenueResultsResponse,
	RevenueViewMode,
} from '@budfin/types';

// ── Fee Grid ─────────────────────────────────────────────────────────────────

interface FeeGridResponse {
	entries: FeeGridEntry[];
}

export function useFeeGrid(
	versionId: number | null,
	academicPeriod: 'AY1' | 'AY2' | 'both' = 'both'
) {
	const params = new URLSearchParams();
	params.set('academic_period', academicPeriod);
	const query = params.toString();

	return useQuery({
		queryKey: ['revenue', 'fee-grid', versionId, academicPeriod],
		queryFn: () => apiClient<FeeGridResponse>(`/versions/${versionId}/fee-grid?${query}`),
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
			queryClient.invalidateQueries({ queryKey: ['revenue', 'readiness', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
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
			queryClient.invalidateQueries({ queryKey: ['revenue', 'readiness', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

// ── Other Revenue ────────────────────────────────────────────────────────────

interface OtherRevenueResponse {
	items: OtherRevenueItem[];
}

interface RevenueSettingsResponse {
	settings: RevenueSettings;
}

export function useOtherRevenue(versionId: number | null) {
	return useQuery({
		queryKey: ['revenue', 'other-revenue', versionId],
		queryFn: () => apiClient<OtherRevenueResponse>(`/versions/${versionId}/other-revenue`),
		enabled: versionId !== null,
	});
}

export function useRevenueSettings(versionId: number | null) {
	return useQuery({
		queryKey: ['revenue', 'settings', versionId],
		queryFn: () => apiClient<RevenueSettingsResponse>(`/versions/${versionId}/revenue/settings`),
		enabled: versionId !== null,
	});
}

export function usePutRevenueSettings(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (settings: RevenueSettings) =>
			apiClient<RevenueSettingsResponse>(`/versions/${versionId}/revenue/settings`, {
				method: 'PUT',
				body: JSON.stringify(settings),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['revenue', 'settings', versionId] });
			queryClient.invalidateQueries({ queryKey: ['revenue', 'readiness', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
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
			queryClient.invalidateQueries({ queryKey: ['revenue', 'readiness', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

// ── Calculate Revenue ────────────────────────────────────────────────────────

interface CalculateRevenueResponse {
	runId: string;
	durationMs: number;
	summary: {
		grossRevenueHt: string;
		totalDiscounts: string;
		netRevenueHt: string;
		totalVat: string;
		totalOtherRevenue: string;
		totalExecutiveOtherRevenue: string;
		totalOperatingRevenue: string;
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
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

// ── Revenue readiness ─────────────────────────────────────────────────────────

export function useRevenueReadiness(versionId: number | null) {
	return useQuery({
		queryKey: ['revenue', 'readiness', versionId],
		queryFn: () => apiClient<RevenueReadinessResponse>(`/versions/${versionId}/revenue/readiness`),
		enabled: versionId !== null,
	});
}

// ── Revenue Results ──────────────────────────────────────────────────────────

export function useRevenueResults(
	versionId: number | null,
	groupBy: RevenueViewMode | 'month' = 'month'
) {
	const params = new URLSearchParams();
	params.set('group_by', groupBy === 'category' ? 'month' : groupBy);
	const query = params.toString();

	return useQuery({
		queryKey: ['revenue', 'results', versionId, groupBy],
		queryFn: () => apiClient<RevenueResultsResponse>(`/versions/${versionId}/revenue?${query}`),
		enabled: versionId !== null,
	});
}
