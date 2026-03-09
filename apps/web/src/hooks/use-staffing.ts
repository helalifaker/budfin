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
}

export interface EmployeeListResponse {
	data: Employee[];
	total: number;
}

export interface DhgGrilleEntry {
	gradeLevel: string;
	subject: string;
	dhgType: string;
	hoursPerWeekPerSection: string;
}

export interface DhgRequirement {
	gradeLevel: string;
	headcount: number;
	maxClassSize: number;
	sectionsNeeded: number;
	totalWeeklyHours: string;
	totalAnnualHours: string;
	fte: string;
}

export interface DhgResponse {
	grilles: DhgGrilleEntry[];
	requirements: DhgRequirement[];
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

export interface CategoryMonthEntry {
	key: string;
	label: string;
	monthly_amounts: string[];
	annual_total: string;
}

export interface CategoryMonthData {
	months: number[];
	categories: CategoryMonthEntry[];
	annual_totals: Record<string, string>;
}

export interface CategoryCostData {
	categories: CategoryMonthEntry[];
}

export interface StaffingSummaryResponse {
	totalFTE: string;
	totalSalaryCost: string;
	byDepartment: Array<{
		department: string;
		total_cost: string;
	}>;
}

export interface CalculateStaffingResponse {
	run_id: string;
	duration_ms: number;
	summary: {
		total_fte: string;
		total_annual_staff_costs: string;
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

// ── DHG Hooks ───────────────────────────────────────────────────────────────

export function useDhgData(versionId: number | null) {
	return useQuery({
		queryKey: ['staffing', 'dhg', versionId],
		queryFn: () => apiClient<DhgResponse>(`/versions/${versionId}/dhg-grilles`),
		enabled: versionId !== null,
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
				`Staffing calculated: ${result.summary.total_fte} FTE, SAR ${Number(result.summary.total_annual_staff_costs).toLocaleString()}`
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
