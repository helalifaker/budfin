import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface DashboardKpis {
	totalRevenue: string;
	totalStaffCosts: string;
	enrollmentCount: number;
	costPerStudent: string;
	ebitda: string;
	ebitdaMarginPct: string;
	netProfit: string;
}

export interface MonthlyTrendItem {
	month: number;
	revenue: string;
	staffCosts: string;
	opex: string;
	netProfit: string;
}

export interface DashboardResponse {
	kpis: DashboardKpis;
	monthlyTrend: MonthlyTrendItem[];
	staleModules: string[];
	lastCalculatedAt: string | null;
}

export function useDashboard(versionId: number | null) {
	return useQuery({
		queryKey: ['dashboard', versionId],
		queryFn: () => apiClient<DashboardResponse>(`/versions/${versionId}/dashboard`),
		enabled: !!versionId,
		staleTime: 30_000,
	});
}
