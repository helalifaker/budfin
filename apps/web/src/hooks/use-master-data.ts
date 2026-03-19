import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ServiceProfile {
	id: number;
	code: string;
	label: string;
	defaultOrs: string;
	isHsaEligible: boolean;
}

export interface ServiceProfilesResponse {
	data: ServiceProfile[];
}

export interface Discipline {
	id: number;
	code: string;
	label: string;
	band: string | null;
}

export interface DisciplinesResponse {
	data: Discipline[];
}

export interface DhgRule {
	id: number;
	band: string;
	gradeLevel: string;
	disciplineCode: string;
	hoursPerWeekPerSection: string;
	dhgType: string;
}

export interface DhgRulesResponse {
	data: DhgRule[];
}

export interface DhgRuleDetail {
	id: number;
	gradeLevel: string;
	disciplineId: number;
	disciplineCode: string;
	disciplineName: string;
	lineType: string;
	driverType: string;
	hoursPerUnit: string;
	serviceProfileId: number;
	serviceProfileCode: string;
	serviceProfileName: string;
	languageCode: string | null;
	groupingKey: string | null;
	effectiveFromYear: number;
	effectiveToYear: number | null;
	updatedAt: string;
}

export interface AutoSuggestResult {
	employeeId: number;
	employeeName: string;
	band: string;
	disciplineId: number;
	disciplineCode: string;
	fteShare: string;
	hoursPerWeek: string;
	confidence: 'High' | 'Medium';
	reason: string;
}

export interface AutoSuggestResponse {
	suggestions: AutoSuggestResult[];
	summary: {
		totalSuggestions: number;
		highConfidence: number;
		mediumConfidence: number;
		unassignedRemaining: number;
	};
}

export interface DemandOverride {
	id: number;
	versionId: number;
	band: string;
	disciplineId: number;
	disciplineCode: string;
	disciplineName: string;
	lineType: string;
	overrideFte: string;
	reasonCode: string;
	note: string | null;
}

export interface DemandOverridesResponse {
	data: DemandOverride[];
}

// ── Master Data Hooks ───────────────────────────────────────────────────────

export function useServiceProfiles() {
	return useQuery({
		queryKey: ['master-data', 'service-profiles'],
		queryFn: () => apiClient<ServiceProfilesResponse>('/master-data/service-profiles'),
	});
}

export function useDisciplines() {
	return useQuery({
		queryKey: ['master-data', 'disciplines'],
		queryFn: () => apiClient<DisciplinesResponse>('/master-data/disciplines'),
	});
}

export function useDhgRules() {
	return useQuery({
		queryKey: ['master-data', 'dhg-rules'],
		queryFn: () => apiClient<{ rules: DhgRuleDetail[] }>('/master-data/dhg-rules'),
		select: (data) => data.rules,
	});
}

export function useCreateDhgRule() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			gradeLevel: string;
			disciplineId: number;
			lineType: string;
			driverType: string;
			hoursPerUnit: string;
			serviceProfileId: number;
			languageCode?: string | null | undefined;
			groupingKey?: string | null | undefined;
			effectiveFromYear: number;
			effectiveToYear?: number | null | undefined;
		}) =>
			apiClient<DhgRuleDetail>('/master-data/dhg-rules', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['master-data', 'dhg-rules'] });
		},
	});
}

export function useUpdateDhgRule() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...body
		}: {
			id: number;
			gradeLevel: string;
			disciplineId: number;
			lineType: string;
			driverType: string;
			hoursPerUnit: string;
			serviceProfileId: number;
			languageCode?: string | null | undefined;
			groupingKey?: string | null | undefined;
			effectiveFromYear: number;
			effectiveToYear?: number | null | undefined;
			updatedAt: string;
		}) =>
			apiClient<DhgRuleDetail>(`/master-data/dhg-rules/${id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['master-data', 'dhg-rules'] });
		},
	});
}

export function useDeleteDhgRule() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient<void>(`/master-data/dhg-rules/${id}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['master-data', 'dhg-rules'] });
		},
	});
}

// ── Version-Scoped Hooks ────────────────────────────────────────────────────

export function useAutoSuggestAssignments(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiClient<AutoSuggestResponse>(`/versions/${versionId}/staffing-assignments/auto-suggest`, {
				method: 'POST',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['staffing-assignments', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['teaching-requirements', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Auto-suggest assignments generated');
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Auto-suggest failed'),
	});
}

export function useDemandOverrides(versionId: number | null) {
	return useQuery({
		queryKey: ['demand-overrides', versionId],
		queryFn: () => apiClient<DemandOverridesResponse>(`/versions/${versionId}/demand-overrides`),
		enabled: versionId !== null,
	});
}
