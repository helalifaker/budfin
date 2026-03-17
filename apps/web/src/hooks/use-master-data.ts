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

export interface AutoSuggestResult {
	employeeId: number;
	employeeName: string;
	requirementLineId: number;
	band: string;
	disciplineCode: string;
	fteShare: string;
	confidence: 'High' | 'Medium';
}

export interface AutoSuggestResponse {
	data: AutoSuggestResult[];
}

export interface DemandOverride {
	id: number;
	requirementLineId: number;
	overrideType: string;
	value: string;
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
		queryFn: () => apiClient<DhgRulesResponse>('/master-data/dhg-rules'),
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
