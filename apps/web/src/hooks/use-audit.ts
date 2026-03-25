import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useWorkspaceContextStore } from '../stores/workspace-context-store';

// ── Response types (matching API snake_case) ────────────────────────────────

export interface AuditEntryDto {
	id: number;
	user_id: number | null;
	operation: string;
	table_name: string | null;
	record_id: number | null;
	old_values: unknown;
	new_values: unknown;
	ip_address: string | null;
	created_at: string;
}

export interface CalculationEntryDto {
	id: number;
	run_id: string;
	version_id: number | null;
	version_name: string | null;
	fiscal_year: number | null;
	module: string;
	status: string;
	started_at: string;
	completed_at: string | null;
	duration_ms: number | null;
	triggered_by: string | null;
	input_summary: unknown;
	output_summary: unknown;
}

interface AuditListResponse {
	entries: AuditEntryDto[];
	total: number;
	page: number;
	page_size: number;
}

interface CalculationListResponse {
	entries: CalculationEntryDto[];
	total: number;
	page: number;
	page_size: number;
}

// ── Query keys ──────────────────────────────────────────────────────────────

export const auditKeys = {
	activity: (versionId: number) => ['audit', 'activity', versionId] as const,
	calculations: (versionId: number) => ['audit', 'calculations', versionId] as const,
};

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useVersionActivity() {
	const versionId = useWorkspaceContextStore((s) => s.versionId);
	return useQuery({
		queryKey: auditKeys.activity(versionId ?? 0),
		queryFn: () => apiClient<AuditListResponse>('/audit?page_size=20'),
		enabled: !!versionId,
		refetchInterval: 60_000,
	});
}

export function useCalculationHistory() {
	const versionId = useWorkspaceContextStore((s) => s.versionId);
	return useQuery({
		queryKey: auditKeys.calculations(versionId ?? 0),
		queryFn: () =>
			apiClient<CalculationListResponse>(`/audit/calculation?version_id=${versionId}&page_size=20`),
		enabled: !!versionId,
	});
}
