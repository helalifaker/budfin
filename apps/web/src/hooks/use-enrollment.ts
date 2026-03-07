import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import type { HeadcountEntry, DetailEntry, CapacityResult, AcademicPeriod } from '@budfin/types';

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

export interface HistoricalDataPoint {
	academicYear: number;
	gradeLevel: string;
	headcount: number;
}

export interface HistoricalResponse {
	data: HistoricalDataPoint[];
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
		},
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
			queryClient.invalidateQueries({ queryKey: ['versions'] });
		},
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
	});
}
