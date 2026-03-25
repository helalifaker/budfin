import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TrendYearMetrics {
	totalRevenue: string;
	totalStaffCost: string;
	totalOpEx: string;
	netProfit: string;
	totalEnrollment: number;
	totalFte: string;
}

export interface TrendYearEntry {
	fiscalYear: string;
	versionName: string;
	versionId: number;
	metrics: TrendYearMetrics;
}

export interface TrendsGrowth {
	revenue: (string | null)[];
	staffCost: (string | null)[];
	opex: (string | null)[];
	netProfit: (string | null)[];
	enrollment: (string | null)[];
	fte: (string | null)[];
}

export interface TrendsResponse {
	years: TrendYearEntry[];
	growth: TrendsGrowth;
}

// ── Query Keys ──────────────────────────────────────────────────────────────

export const trendsKeys = {
	all: ['trends'] as const,
	list: (years: number) => ['trends', years] as const,
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTrends(years: number = 5) {
	return useQuery({
		queryKey: trendsKeys.list(years),
		queryFn: () => apiClient<TrendsResponse>(`/trends?years=${years}`),
		staleTime: 5 * 60_000,
	});
}
