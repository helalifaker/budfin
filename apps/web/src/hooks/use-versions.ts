import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';

export interface BudgetVersion {
	id: number;
	fiscalYear: number;
	name: string;
	type: 'Budget' | 'Forecast' | 'Actual';
	status: 'Draft' | 'Published' | 'Locked' | 'Archived';
	description: string | null;
	dataSource: string;
	sourceVersionId: number | null;
	modificationCount: number;
	staleModules: string[];
	schoolCalendarMonths: number[];
	createdById: number;
	createdByEmail: string | null;
	publishedAt: string | null;
	lockedAt: string | null;
	archivedAt: string | null;
	lastCalculatedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface VersionListResponse {
	data: BudgetVersion[];
	total: number;
	nextCursor: number | null;
}

export interface CreateVersionInput {
	name: string;
	type: 'Budget' | 'Forecast';
	fiscalYear: number;
	description?: string;
	sourceVersionId?: number;
}

export interface CloneVersionInput {
	name: string;
	description?: string;
	fiscalYear?: number;
	includeEnrollment?: boolean;
	includeSummaries?: boolean;
}

export interface PatchStatusInput {
	new_status: BudgetVersion['status'];
	audit_note?: string;
}

export function useCreateVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateVersionInput) =>
			apiClient<BudgetVersion>('/versions', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['versions'] }),
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function useCloneVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...data }: { id: number } & CloneVersionInput) =>
			apiClient<BudgetVersion>(`/versions/${id}/clone`, {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['versions'] }),
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function usePatchVersionStatus() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...data }: { id: number } & PatchStatusInput) =>
			apiClient<BudgetVersion>(`/versions/${id}/status`, {
				method: 'PATCH',
				body: JSON.stringify(data),
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['versions'] }),
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function useDeleteVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => apiClient<void>(`/versions/${id}`, { method: 'DELETE' }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['versions'] }),
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function usePatchVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...data
		}: { id: number } & Partial<Pick<BudgetVersion, 'schoolCalendarMonths'>>) =>
			apiClient<BudgetVersion>(`/versions/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export interface AuditTrailEntry {
	id: number;
	operation: string;
	userId: number | null;
	newValues: Record<string, unknown> | null;
	oldValues: Record<string, unknown> | null;
	createdAt: string;
	ipAddress: string | null;
}

export function useVersionAuditTrail(versionId: number | undefined) {
	return useQuery({
		queryKey: ['version-audit-trail', versionId],
		queryFn: async () => {
			const res = await apiClient<{
				entries: Array<{
					id: number;
					operation: string;
					user_id: number | null;
					new_values: Record<string, unknown> | null;
					old_values: Record<string, unknown> | null;
					ip_address: string | null;
					created_at: string;
				}>;
			}>(`/audit?table_name=budget_versions&record_id=${versionId}`);
			return res.entries.map((e) => ({
				id: e.id,
				operation: e.operation,
				userId: e.user_id,
				newValues: e.new_values,
				oldValues: e.old_values,
				ipAddress: e.ip_address,
				createdAt: e.created_at,
			}));
		},
		enabled: !!versionId,
	});
}

export function useVersions(fiscalYear?: number, status?: string, type?: string) {
	const params = new URLSearchParams();
	if (fiscalYear) params.set('fiscalYear', String(fiscalYear));
	if (status) params.set('status', status);
	if (type) params.set('type', type);
	const query = params.toString();

	return useQuery({
		queryKey: ['versions', { fiscalYear, status, type }],
		queryFn: () => apiClient<VersionListResponse>(`/versions${query ? `?${query}` : ''}`),
	});
}

interface CompareVariance {
	revenueHt: { abs: string; pct: string | null };
	staffCosts: { abs: string; pct: string | null };
	netProfit: { abs: string; pct: string | null };
}

export interface MultiCompareResponse {
	versions: Array<{ id: number; name: string; type: string; fiscalYear: number }>;
	monthly: Array<{
		month: number;
		values: Array<{
			versionId: number;
			revenueHt: string;
			staffCosts: string;
			netProfit: string;
			variance: CompareVariance | null;
		}>;
	}>;
	annualTotals: Array<{
		versionId: number;
		revenueHt: string;
		staffCosts: string;
		netProfit: string;
		variance: CompareVariance | null;
	}>;
}

export function useMultiCompare(ids: number[]) {
	const idsStr = ids.join(',');
	return useQuery({
		queryKey: ['versions', 'compare-multi', idsStr],
		queryFn: () => apiClient<MultiCompareResponse>(`/versions/compare-multi?ids=${idsStr}`),
		enabled: ids.length >= 2,
	});
}

export interface ImportLogEntry {
	id: number;
	module: string;
	sourceFile: string;
	validationStatus: string;
	rowsImported: number;
	importedByEmail: string;
	importedAt: string;
}

export function useVersionImportLogs(versionId: number | undefined) {
	return useQuery({
		queryKey: ['version-import-logs', versionId],
		queryFn: () => apiClient<ImportLogEntry[]>(`/versions/${versionId}/import-logs`),
		enabled: !!versionId,
	});
}
