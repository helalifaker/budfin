import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';
import type {
	HeadcountEntry,
	DetailEntry,
	CapacityResult,
	AcademicPeriod,
	CohortParameterEntry,
	HistoricalHeadcountPoint,
	NationalityBreakdownEntry,
	PlanningRules,
	EnrollmentSettings,
	EnrollmentSettingsUpdatePayload,
} from '@budfin/types';

// ── Response types ───────────────────────────────────────────────────────────

export interface HeadcountRow extends HeadcountEntry {
	gradeName: string;
	band: string;
	displayOrder: number;
}

export interface HeadcountResponse {
	entries: HeadcountRow[];
}

export interface DetailResponse {
	entries: DetailEntry[];
}

export interface HeadcountPutResponse {
	updated: number;
	staleModules: string[];
}

export interface HistoricalResponse {
	data: HistoricalHeadcountPoint[];
	cagrByBand: Record<string, string>;
	movingAvgByBand: Record<string, number>;
}

export interface ImportValidationResult {
	totalRows: number;
	validRows: number;
	errors: Array<{ row: number; field: string; message: string }>;
	preview: Array<{ gradeLevel: string; headcount: number }>;
}

export interface ImportCommitResult {
	imported: number;
}

export interface EnrollmentSetupBaselineEntry {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	baselineHeadcount: number;
}

export interface EnrollmentSetupBaselineResponse {
	available: boolean;
	sourceVersion: {
		id: number;
		name: string;
		fiscalYear: number;
		status: string;
		updatedAt: string;
	} | null;
	entries: EnrollmentSetupBaselineEntry[];
	totals: {
		grandTotal: number;
		bands: Array<{ band: string; total: number }>;
	};
}

export interface EnrollmentSetupImportPreviewRow {
	gradeLevel: string;
	gradeName: string;
	band: string;
	displayOrder: number;
	baselineHeadcount: number;
	importedHeadcount: number | null;
	delta: number | null;
	variancePct: number | null;
	hasLargeVariance: boolean;
}

export interface EnrollmentSetupImportValidationResponse {
	totalRows: number;
	validRows: number;
	errors: Array<{ row: number; field: string; message: string }>;
	preview: EnrollmentSetupImportPreviewRow[];
	summary: {
		baselineTotal: number;
		importTotal: number;
	};
}

export interface CapacityResultsResponse {
	summary: {
		totalStudentsAy1: number;
		totalStudentsAy2: number;
		overCapacityGrades: string[];
	};
	lastCalculatedAt: string | null;
	results: CapacityResult[];
}

export interface EnrollmentSettingsResponse extends EnrollmentSettings {
	staleModules?: string[];
}

// ── Headcount hooks (Stage 1) ────────────────────────────────────────────────

export function useHeadcount(versionId: number | null, academicPeriod?: AcademicPeriod | null) {
	const params = new URLSearchParams();
	if (academicPeriod) params.set('academic_period', academicPeriod);
	const query = params.toString();

	return useQuery({
		queryKey: ['enrollment', 'headcount', versionId, academicPeriod],
		queryFn: () =>
			apiClient<HeadcountResponse>(
				`/versions/${versionId}/enrollment/headcount${query ? `?${query}` : ''}`
			),
		enabled: versionId !== null,
	});
}

export function usePutHeadcount(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (entries: HeadcountEntry[]) =>
			apiClient<HeadcountPutResponse>(`/versions/${versionId}/enrollment/headcount`, {
				method: 'PUT',
				body: JSON.stringify({ entries }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['enrollment', 'headcount', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

// ── Detail hooks (Stage 2) ───────────────────────────────────────────────────

export function useDetail(versionId: number | null, academicPeriod?: AcademicPeriod | null) {
	const params = new URLSearchParams();
	if (academicPeriod) params.set('academic_period', academicPeriod);
	const query = params.toString();

	return useQuery({
		queryKey: ['enrollment', 'detail', versionId, academicPeriod],
		queryFn: () =>
			apiClient<DetailResponse>(
				`/versions/${versionId}/enrollment/detail${query ? `?${query}` : ''}`
			),
		enabled: versionId !== null,
	});
}

export function usePutDetail(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (entries: DetailEntry[]) =>
			apiClient<{ updated: number }>(`/versions/${versionId}/enrollment/detail`, {
				method: 'PUT',
				body: JSON.stringify({ entries }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['enrollment', 'detail', versionId] });
			queryClient.invalidateQueries({ queryKey: ['revenue', 'readiness', versionId] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

// ── Capacity calculation ─────────────────────────────────────────────────────

export interface CalculateEnrollmentResponse {
	runId: string;
	durationMs: number;
	summary: {
		totalStudentsAy1: number;
		totalStudentsAy2: number;
		overCapacityGrades: string[];
	};
	results: CapacityResult[];
}

export function useCalculateEnrollment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiClient<CalculateEnrollmentResponse>(`/versions/${versionId}/calculate/enrollment`, {
				method: 'POST',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['enrollment', 'headcount', versionId] });
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'capacity-results', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'nationality-breakdown', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function useEnrollmentSettings(versionId: number | null) {
	return useQuery({
		queryKey: ['enrollment', 'settings', versionId],
		queryFn: () =>
			apiClient<EnrollmentSettingsResponse>(`/versions/${versionId}/enrollment/settings`),
		enabled: versionId !== null,
	});
}

export function usePutEnrollmentSettings(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (settings: EnrollmentSettingsUpdatePayload) =>
			apiClient<EnrollmentSettingsResponse>(`/versions/${versionId}/enrollment/settings`, {
				method: 'PUT',
				body: JSON.stringify(settings),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['enrollment', 'settings', versionId] });
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'cohort-parameters', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'planning-rules', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'capacity-results', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

// ── Historical enrollment ────────────────────────────────────────────────────

export function useHistorical(years?: number) {
	const params = new URLSearchParams();
	if (years) params.set('years', String(years));
	const query = params.toString();

	return useQuery({
		queryKey: ['enrollment', 'historical', years],
		queryFn: () =>
			apiClient<HistoricalResponse>(`/enrollment/historical${query ? `?${query}` : ''}`),
	});
}

export function useImportHistorical() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			file,
			mode,
			academicYear,
		}: {
			file: File;
			mode: 'validate' | 'commit';
			academicYear: string;
		}) => {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('mode', mode);
			formData.append('academicYear', academicYear);

			return apiClient<ImportValidationResult | ImportCommitResult>(
				'/enrollment/historical/import',
				{
					method: 'POST',
					body: formData,
				}
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['enrollment', 'historical'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function useEnrollmentCapacityResults(versionId: number | null) {
	return useQuery({
		queryKey: ['enrollment', 'capacity-results', versionId],
		queryFn: () =>
			apiClient<CapacityResultsResponse>(`/versions/${versionId}/enrollment/capacity-results`),
		enabled: versionId !== null,
	});
}

export function useEnrollmentSetupBaseline(versionId: number | null) {
	return useQuery({
		queryKey: ['enrollment', 'setup-baseline', versionId],
		queryFn: () =>
			apiClient<EnrollmentSetupBaselineResponse>(
				`/versions/${versionId}/enrollment/setup-baseline`
			),
		enabled: versionId !== null,
	});
}

export function useValidateEnrollmentSetupImport(versionId: number | null) {
	return useMutation({
		mutationFn: async ({
			file,
			baselineEntries,
		}: {
			file: File;
			baselineEntries: Array<{ gradeLevel: string; headcount: number }>;
		}) => {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('baseline', JSON.stringify(baselineEntries));

			return apiClient<EnrollmentSetupImportValidationResponse>(
				`/versions/${versionId}/enrollment/setup-import/validate`,
				{
					method: 'POST',
					body: formData,
				}
			);
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function useApplyEnrollmentSetup(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			ay1Entries,
			cohortEntries,
			psAy2Headcount,
			planningRules,
		}: {
			ay1Entries: Array<{ gradeLevel: string; headcount: number }>;
			cohortEntries: CohortParameterEntry[];
			psAy2Headcount?: number;
			planningRules?: PlanningRules;
		}) =>
			apiClient<CalculateEnrollmentResponse>(`/versions/${versionId}/enrollment/setup/apply`, {
				method: 'POST',
				body: JSON.stringify({
					ay1Entries,
					cohortEntries,
					psAy2Headcount,
					planningRules,
				}),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['enrollment', 'headcount', versionId] });
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'cohort-parameters', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'nationality-breakdown', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['enrollment', 'capacity-results', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred'),
	});
}

export function buildCurrentNationalityRows(
	entries: NationalityBreakdownEntry[] | undefined,
	gradeLevel: string
) {
	const result: Record<string, number> = {
		Francais: 0,
		Nationaux: 0,
		Autres: 0,
	};

	for (const entry of entries ?? []) {
		if (entry.gradeLevel === gradeLevel && entry.academicPeriod === 'AY2') {
			result[entry.nationality] = entry.weight;
		}
	}

	return result;
}
