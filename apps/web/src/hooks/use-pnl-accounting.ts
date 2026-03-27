import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useWorkspaceContextStore } from '../stores/workspace-context-store';
import type { AccountingPnlView } from '@budfin/types';

// ── Query Keys ───────────────────────────────────────────────────────────────

export const pnlAccountingKeys = {
	all: ['pnl-accounting'] as const,
	view: (versionId: number, compareYear?: number, profitCenter?: string) =>
		['pnl-accounting', versionId, compareYear, profitCenter] as const,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePnlAccounting(options?: { compareYear?: number; profitCenter?: string }) {
	const versionId = useWorkspaceContextStore((s) => s.versionId);

	return useQuery({
		queryKey: pnlAccountingKeys.view(versionId!, options?.compareYear, options?.profitCenter),
		queryFn: async () => {
			const params = new URLSearchParams();
			if (options?.compareYear) params.set('compareYear', String(options.compareYear));
			if (options?.profitCenter) params.set('profitCenter', options.profitCenter);
			const qs = params.toString();
			return apiClient<AccountingPnlView>(
				`/versions/${versionId}/pnl/accounting${qs ? `?${qs}` : ''}`
			);
		},
		enabled: !!versionId,
		staleTime: 30_000,
	});
}
