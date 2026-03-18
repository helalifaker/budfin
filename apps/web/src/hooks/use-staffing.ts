import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { toast } from '../components/ui/toast-state';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Employee {
	id: number;
	employeeCode: string;
	name: string;
	functionRole: string;
	department: string;
	status: string;
	joiningDate: string;
	paymentMethod: string;
	isSaudi: boolean;
	isAjeer: boolean;
	isTeaching: boolean;
	hourlyPercentage: string;
	baseSalary: string | null;
	housingAllowance: string | null;
	transportAllowance: string | null;
	responsibilityPremium: string | null;
	hsaAmount: string | null;
	augmentation: string | null;
	augmentationEffectiveDate: string | null;
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
	updatedAt: string;
	recordType: string;
	costMode: string;
	disciplineId: number | null;
	serviceProfileId: number | null;
	homeBand: string | null;
	contractEndDate: string | null;
	monthlyCost: string | null;
	annualCost: string | null;
}

export interface EmployeeListResponse {
	data: Employee[];
	total: number;
}

export interface StaffCostRow {
	group_key: string;
	total_gross_salary: string | null;
	total_allowances: string | null;
	total_social_charges: string;
	total_staff_cost: string;
}

export interface StaffCostBreakdown {
	employee_id: number;
	employee_name: string;
	department: string;
	month: number;
	base_gross: string;
	adjusted_gross: string;
	housing_allowance: string;
	transport_allowance: string;
	responsibility_premium: string;
	hsa_amount: string;
	gosi_amount: string;
	ajeer_amount: string;
	eos_monthly_accrual: string;
	total_cost: string;
}

export interface StaffCostResponse {
	data: StaffCostRow[];
	totals: {
		total_gross_salary: string | null;
		total_allowances: string | null;
		total_social_charges: string;
		total_staff_cost: string;
	};
	breakdown: StaffCostBreakdown[] | null;
}

export interface CategoryMonthCategory {
	category: string;
	label: string;
	parent: string | null;
	values: (string | null)[];
}

export interface CategoryMonthData {
	months: number[];
	categories: CategoryMonthCategory[];
	annual_totals: Record<string, string | null>;
}

export interface CategoryCostEntry {
	month: number;
	[category: string]: string | number;
}

export interface CategoryCostData {
	data: CategoryCostEntry[];
	grand_total: string;
}

export interface StaffingSummaryResponse {
	fte: string;
	cost: string;
	byDepartment: Array<{
		department: string;
		total_cost: string;
	}>;
}

export interface CalculateStaffingResponse {
	runId: string;
	durationMs: number;
	summary: {
		totalFteNeeded: string;
		totalFteCovered: string;
		totalGap: string;
		totalCost: string;
		warningCount: number;
	};
}

export interface ImportValidateResponse {
	totalRows: number;
	validRows: number;
	errors: Array<{ row: number; field: string; message: string }>;
	conflictingCodes: string[];
	duplicateWarnings: Array<{
		row: number;
		employeeCode: string;
		matchedFields: string[];
	}>;
	preview: Array<{
		employee_code: string;
		name: string;
		department: string;
		status: string;
		base_salary: string;
	}>;
}

export interface ImportCommitResponse {
	imported: number;
	duplicateWarnings: Array<{
		row: number;
		employeeCode: string;
		matchedFields: string[];
	}>;
}

// ── Employee Hooks ──────────────────────────────────────────────────────────

export function useEmployees(versionId: number | null) {
	return useQuery({
		queryKey: ['staffing', 'employees', versionId],
		queryFn: () => apiClient<EmployeeListResponse>(`/versions/${versionId}/employees`),
		enabled: versionId !== null,
	});
}

export function useEmployee(versionId: number | null, employeeId: number | null) {
	return useQuery({
		queryKey: ['staffing', 'employee', versionId, employeeId],
		queryFn: () => apiClient<Employee>(`/versions/${versionId}/employees/${employeeId}`),
		enabled: versionId !== null && employeeId !== null,
	});
}

export function useCreateEmployee(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: Partial<Employee>) =>
			apiClient<Employee>(`/versions/${versionId}/employees`, {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['staffing', 'employees', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Employee created');
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create employee'),
	});
}

export function useUpdateEmployee(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			data,
			updatedAt,
		}: {
			id: number;
			data: Partial<Employee>;
			updatedAt: string;
		}) =>
			apiClient<Employee>(`/versions/${versionId}/employees/${id}`, {
				method: 'PUT',
				body: JSON.stringify(data),
				headers: { 'If-Match': updatedAt },
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['staffing', 'employees', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Employee updated');
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update employee'),
	});
}

export function useDeleteEmployee(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient(`/versions/${versionId}/employees/${id}`, { method: 'DELETE' }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['staffing', 'employees', versionId] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Employee deleted');
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete employee'),
	});
}

// ── Staff Cost Hooks ────────────────────────────────────────────────────────

export function useStaffCosts(
	versionId: number | null,
	groupBy: 'employee' | 'department' | 'month' = 'month',
	includeBreakdown = false
) {
	const params = new URLSearchParams();
	params.set('group_by', groupBy);
	if (includeBreakdown) params.set('include_breakdown', 'true');

	return useQuery({
		queryKey: ['staffing', 'costs', versionId, groupBy, includeBreakdown],
		queryFn: () =>
			apiClient<StaffCostResponse>(`/versions/${versionId}/staff-costs?${params.toString()}`),
		enabled: versionId !== null,
	});
}

export function useStaffingSummary(versionId: number | null) {
	return useQuery({
		queryKey: ['staffing', 'summary', versionId],
		queryFn: () => apiClient<StaffingSummaryResponse>(`/versions/${versionId}/staffing-summary`),
		enabled: versionId !== null,
	});
}

export function useStaffCostsByCategory(versionId: number | null) {
	return useQuery({
		queryKey: ['staffing', 'costs', versionId, 'category_month'],
		queryFn: () =>
			apiClient<CategoryMonthData>(`/versions/${versionId}/staff-costs?group_by=category_month`),
		enabled: versionId !== null,
	});
}

export function useCategoryCosts(versionId: number | null) {
	return useQuery({
		queryKey: ['staffing', 'category-costs', versionId],
		queryFn: () => apiClient<CategoryCostData>(`/versions/${versionId}/category-costs`),
		enabled: versionId !== null,
	});
}

// ── Calculate Hook ──────────────────────────────────────────────────────────

export function useCalculateStaffing(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiClient<CalculateStaffingResponse>(`/versions/${versionId}/calculate/staffing`, {
				method: 'POST',
			}),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: ['staffing'] });
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success(
				`Staffing calculated: ${result.summary.totalFteNeeded} FTE, SAR ${Number(result.summary.totalCost).toLocaleString()}`
			);
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Staffing calculation failed'),
	});
}

// ── Import Hook ─────────────────────────────────────────────────────────────

export function useImportEmployees(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ file, mode }: { file: File; mode: 'validate' | 'commit' }) => {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('mode', mode);
			return apiClient<ImportValidateResponse | ImportCommitResponse>(
				`/versions/${versionId}/employees/import`,
				{ method: 'POST', body: formData }
			);
		},
		onSuccess: (_data, variables) => {
			if (variables.mode === 'commit') {
				queryClient.invalidateQueries({ queryKey: ['staffing', 'employees', versionId] });
				queryClient.invalidateQueries({ queryKey: ['versions'] });
				toast.success('Employees imported successfully');
			}
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : 'Import failed'),
	});
}

// ── Staffing Settings Hooks ─────────────────────────────────────────────────

export interface StaffingSettings {
	id: number;
	versionId: number;
	hsaTargetHours: string;
	hsaFirstHourRate: string;
	hsaAdditionalHourRate: string;
	hsaMonths: number;
	academicWeeks: number;
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
	reconciliationBaseline: unknown;
}

export interface StaffingSettingsResponse {
	data: StaffingSettings;
}

export function useStaffingSettings(versionId: number | null) {
	return useQuery({
		queryKey: ['staffing-settings', versionId],
		queryFn: () => apiClient<StaffingSettingsResponse>(`/versions/${versionId}/staffing-settings`),
		enabled: versionId !== null,
	});
}

export function usePutStaffingSettings(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: Partial<StaffingSettings>) =>
			apiClient<StaffingSettingsResponse>(`/versions/${versionId}/staffing-settings`, {
				method: 'PUT',
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['staffing-settings', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Staffing settings saved');
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Failed to save staffing settings'),
	});
}

// ── Service Profile Override Hooks ──────────────────────────────────────────

export interface ServiceProfileOverride {
	id: number;
	versionId: number;
	serviceProfileId: number;
	serviceProfileCode: string;
	serviceProfileName: string;
	weeklyServiceHours: string | null;
	hsaEligible: boolean;
}

export interface ServiceProfileOverridesResponse {
	data: ServiceProfileOverride[];
}

export function useServiceProfileOverrides(versionId: number | null) {
	return useQuery({
		queryKey: ['service-profile-overrides', versionId],
		queryFn: () =>
			apiClient<ServiceProfileOverridesResponse>(
				`/versions/${versionId}/service-profile-overrides`
			),
		enabled: versionId !== null,
	});
}

export interface ServiceProfileOverrideInput {
	serviceProfileId: number;
	weeklyServiceHours?: string | null;
	hsaEligible?: boolean | null;
}

export function usePutServiceProfileOverrides(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: ServiceProfileOverrideInput[]) =>
			apiClient<ServiceProfileOverridesResponse>(
				`/versions/${versionId}/service-profile-overrides`,
				{
					method: 'PUT',
					body: JSON.stringify({ overrides: data }),
				}
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['service-profile-overrides', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Service profile overrides saved');
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Failed to save service profile overrides'),
	});
}

// ── Cost Assumptions Hooks ──────────────────────────────────────────────────

export interface CostAssumption {
	id: number;
	versionId: number;
	category: string;
	calculationMode: string;
	value: string;
}

export interface CostAssumptionsResponse {
	data: CostAssumption[];
}

export function useCostAssumptions(versionId: number | null) {
	return useQuery({
		queryKey: ['cost-assumptions', versionId],
		queryFn: () => apiClient<CostAssumptionsResponse>(`/versions/${versionId}/cost-assumptions`),
		enabled: versionId !== null,
	});
}

export interface CostAssumptionInput {
	category: string;
	calculationMode: string;
	value: string;
}

export function usePutCostAssumptions(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CostAssumptionInput[]) =>
			apiClient<CostAssumptionsResponse>(`/versions/${versionId}/cost-assumptions`, {
				method: 'PUT',
				body: JSON.stringify({ assumptions: data }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['cost-assumptions', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Cost assumptions saved');
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Failed to save cost assumptions'),
	});
}

// ── Lycee Group Assumptions Hooks ───────────────────────────────────────────

export interface LyceeGroupAssumption {
	disciplineCode: string;
	groupCount: number;
	hoursPerGroup: string;
}

export interface LyceeGroupAssumptionsResponse {
	data: LyceeGroupAssumption[];
}

export function useLyceeGroupAssumptions(versionId: number | null) {
	return useQuery({
		queryKey: ['lycee-group-assumptions', versionId],
		queryFn: () =>
			apiClient<LyceeGroupAssumptionsResponse>(`/versions/${versionId}/lycee-group-assumptions`),
		enabled: versionId !== null,
	});
}

export function usePutLyceeGroupAssumptions(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: LyceeGroupAssumption[]) =>
			apiClient<LyceeGroupAssumptionsResponse>(`/versions/${versionId}/lycee-group-assumptions`, {
				method: 'PUT',
				body: JSON.stringify({ assumptions: data }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['lycee-group-assumptions', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Lycee group assumptions saved');
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Failed to save lycee group assumptions'),
	});
}

// ── Teaching Requirements Hooks ─────────────────────────────────────────────

export interface TeachingRequirementLine {
	id: number;
	band: string;
	disciplineCode: string;
	lineLabel: string;
	lineType: string;
	serviceProfileCode: string;
	totalDriverUnits: number;
	totalWeeklyHours: string;
	baseOrs: string;
	effectiveOrs: string;
	requiredFteRaw: string;
	requiredFteCalculated: string | null;
	requiredFtePlanned: string;
	recommendedPositions: number;
	coveredFte: string;
	gapFte: string;
	coverageStatus: string;
	assignedStaffCount: number;
	vacancyCount: number;
	driverType: string;
	directCostAnnual: string;
	hsaCostAnnual: string;
	assignedEmployees: unknown[];
}

export interface TeachingRequirementsResponse {
	lines: TeachingRequirementLine[];
	totals: {
		totalFteRaw: string;
		totalFteCovered: string;
		totalFteGap: string;
		totalDirectCost: string | null;
		totalHsaCost: string | null;
		lineCount: number;
	};
	warnings: unknown[];
}

export function useTeachingRequirements(versionId: number | null) {
	return useQuery({
		queryKey: ['teaching-requirements', versionId],
		queryFn: () =>
			apiClient<TeachingRequirementsResponse>(`/versions/${versionId}/teaching-requirements`),
		enabled: versionId !== null,
	});
}

export interface TeachingRequirementSource {
	id: number;
	versionId: number;
	disciplineId: number;
	disciplineCode: string;
	disciplineName: string;
	gradeLevel: string;
	headcount: number;
	sections: number;
	hoursPerUnit: string;
	totalWeeklyHours: string;
	lineType: string;
	driverType: string;
	maxClassSize: number;
	driverUnits: number;
	calculatedAt: string;
}

export interface TeachingRequirementSourcesResponse {
	data: TeachingRequirementSource[];
}

export function useTeachingRequirementSources(versionId: number | null) {
	return useQuery({
		queryKey: ['teaching-requirement-sources', versionId],
		queryFn: () =>
			apiClient<TeachingRequirementSourcesResponse>(
				`/versions/${versionId}/teaching-requirement-sources`
			),
		enabled: versionId !== null,
	});
}

// ── Staffing Assignment Hooks ───────────────────────────────────────────────

export interface StaffingAssignment {
	id: number;
	versionId: number;
	employeeId: number;
	band: string;
	disciplineId: number;
	fteShare: string;
	hoursPerWeek: string;
	note: string | null;
	source: string;
	employeeName: string;
	employeeCode: string;
	costMode: string;
	disciplineCode: string;
	disciplineName: string;
	updatedAt: string;
}

export interface StaffingAssignmentsResponse {
	data: StaffingAssignment[];
}

export function useStaffingAssignments(versionId: number | null) {
	return useQuery({
		queryKey: ['staffing-assignments', versionId],
		queryFn: () =>
			apiClient<StaffingAssignmentsResponse>(`/versions/${versionId}/staffing-assignments`),
		enabled: versionId !== null,
	});
}

export interface CreateAssignmentInput {
	employeeId: number;
	band: string;
	disciplineId: number;
	hoursPerWeek: string;
	fteShare: string;
	note?: string | null;
}

export function useCreateAssignment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: CreateAssignmentInput) =>
			apiClient<StaffingAssignment>(`/versions/${versionId}/staffing-assignments`, {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['staffing-assignments', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['teaching-requirements', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Assignment created');
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Failed to create assignment'),
	});
}

export function useUpdateAssignment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: number; data: Partial<StaffingAssignment> }) =>
			apiClient<StaffingAssignment>(`/versions/${versionId}/staffing-assignments/${id}`, {
				method: 'PUT',
				body: JSON.stringify(data),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['staffing-assignments', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['teaching-requirements', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Assignment updated');
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Failed to update assignment'),
	});
}

export function useDeleteAssignment(versionId: number | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) =>
			apiClient(`/versions/${versionId}/staffing-assignments/${id}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['staffing-assignments', versionId],
			});
			queryClient.invalidateQueries({
				queryKey: ['teaching-requirements', versionId],
			});
			queryClient.invalidateQueries({ queryKey: ['versions'] });
			toast.success('Assignment deleted');
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : 'Failed to delete assignment'),
	});
}
