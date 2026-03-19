import { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { EmployeeGrid } from './employee-grid';
import { SupportAdminGrid } from './support-admin-grid';
import { EmployeeForm, type EmployeeFormData } from './employee-form';
import { EmployeeImportDialog } from './employee-import-dialog';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';
import {
	useCreateEmployee,
	useUpdateEmployee,
	useDeleteEmployee,
	type Employee,
	type EmployeeListResponse,
} from '../../hooks/use-staffing';
import { deriveStaffingEditability } from '../../lib/staffing-workspace';
import { useAuthStore } from '../../stores/auth-store';

// ── Types ────────────────────────────────────────────────────────────────────

export type RosterTabContentProps = {
	versionId: number;
	employeesData: EmployeeListResponse;
	isEditable: boolean;
	canViewSalary: boolean;
	versionStatus?: string | null;
};

type SubView = 'teaching' | 'support' | 'all';

// ── Form data → API payload ──────────────────────────────────────────────────

function formDataToPayload(data: EmployeeFormData): Partial<Employee> {
	return {
		employeeCode: data.employeeCode,
		name: data.name,
		functionRole: data.functionRole,
		department: data.department,
		status: data.status,
		joiningDate: data.joiningDate || '',
		paymentMethod: data.paymentMethod,
		isSaudi: data.isSaudi,
		isAjeer: data.isAjeer,
		isTeaching: data.isTeaching,
		hourlyPercentage: data.hourlyPercentage,
		baseSalary: data.baseSalary || null,
		housingAllowance: data.housingAllowance || null,
		transportAllowance: data.transportAllowance || null,
		responsibilityPremium: data.responsibilityPremium || null,
		augmentation: data.augmentation || null,
		augmentationEffectiveDate: data.augmentationEffectiveDate || null,
		ajeerAnnualLevy: data.ajeerAnnualLevy,
		ajeerMonthlyFee: data.ajeerMonthlyFee,
		recordType: data.recordType,
		costMode: data.costMode,
		disciplineId: data.disciplineId ? parseInt(data.disciplineId, 10) : null,
		serviceProfileId: data.serviceProfileId ? parseInt(data.serviceProfileId, 10) : null,
		homeBand: data.homeBand || null,
		contractEndDate: data.contractEndDate || null,
	};
}

// ── Main Component ───────────────────────────────────────────────────────────

export function RosterTabContent({
	versionId,
	employeesData,
	isEditable,
	canViewSalary,
	versionStatus,
}: RosterTabContentProps) {
	const [formOpen, setFormOpen] = useState(false);
	const [formEmployee, setFormEmployee] = useState<Employee | null>(null);
	const [importOpen, setImportOpen] = useState(false);
	const [activeSubView, setActiveSubView] = useState<SubView>('all');
	const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

	const user = useAuthStore((s) => s.user);
	const selectEmployee = useStaffingSelectionStore((s) => s.selectEmployee);

	const createMutation = useCreateEmployee(versionId);
	const updateMutation = useUpdateEmployee(versionId);
	const deleteMutation = useDeleteEmployee(versionId);

	const editability = deriveStaffingEditability({
		role: user?.role ?? null,
		versionStatus: versionStatus ?? null,
	});

	// ── Filtered employee lists ──────────────────────────────────────────────

	const allEmployees = employeesData.data;

	const visibleEmployees = useCallback(
		(subView: SubView) => {
			if (subView === 'teaching') return allEmployees.filter((e) => e.isTeaching);
			if (subView === 'support') return allEmployees.filter((e) => !e.isTeaching);
			return allEmployees;
		},
		[allEmployees]
	);

	// ── Handlers ─────────────────────────────────────────────────────────────

	const handleOpenCreate = useCallback(() => {
		setFormEmployee(null);
		setFormOpen(true);
	}, []);

	const handleOpenVacancy = useCallback(() => {
		// Open the form in create mode; the form auto-sets the vacancy code when the user
		// selects recordType=VACANCY via the radio button. EmployeeForm has no external
		// defaultValues prop so we cannot pre-select the radio from outside.
		setFormEmployee(null);
		setFormOpen(true);
	}, []);

	const handleOpenEdit = useCallback((employee: Employee) => {
		setFormEmployee(employee);
		setFormOpen(true);
	}, []);

	const handleSelect = useCallback(
		(employee: Employee) => {
			setSelectedEmployeeId(employee.id);
			selectEmployee(employee.id, employee.department);
		},
		[selectEmployee]
	);

	const handleSave = useCallback(
		(data: EmployeeFormData) => {
			const payload = formDataToPayload(data);
			if (formEmployee) {
				updateMutation.mutate(
					{ id: formEmployee.id, data: payload, updatedAt: formEmployee.updatedAt },
					{ onSuccess: () => setFormOpen(false) }
				);
			} else {
				createMutation.mutate(payload, { onSuccess: () => setFormOpen(false) });
			}
		},
		[formEmployee, createMutation, updateMutation]
	);

	const handleDelete = useCallback(() => {
		if (!formEmployee) return;
		deleteMutation.mutate(formEmployee.id, { onSuccess: () => setFormOpen(false) });
	}, [formEmployee, deleteMutation]);

	// ── Render ───────────────────────────────────────────────────────────────

	return (
		<div className="space-y-3">
			{/* Toolbar */}
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<ToggleGroup
					type="single"
					value={activeSubView}
					onValueChange={(v) => {
						if (v) setActiveSubView(v as SubView);
					}}
					aria-label="Employee sub-view"
				>
					<ToggleGroupItem value="teaching" aria-label="Teaching staff">
						Teaching
					</ToggleGroupItem>
					<ToggleGroupItem value="support" aria-label="Support and admin staff">
						Support
					</ToggleGroupItem>
					<ToggleGroupItem value="all" aria-label="All staff">
						All
					</ToggleGroupItem>
				</ToggleGroup>

				{isEditable && (
					<div className="flex items-center gap-2">
						<Button size="sm" variant="outline" onClick={handleOpenCreate}>
							+ Add Employee
						</Button>
						<Button size="sm" variant="outline" onClick={handleOpenVacancy}>
							+ Add Vacancy
						</Button>
						<Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
							Import
						</Button>
					</div>
				)}
			</div>

			{/* Grid */}
			{activeSubView === 'support' ? (
				<SupportAdminGrid
					employees={visibleEmployees('support')}
					editability={editability}
					onEmployeeSelect={handleSelect}
					onEmployeeDoubleClick={handleOpenEdit}
				/>
			) : (
				<EmployeeGrid
					employees={visibleEmployees(activeSubView)}
					isReadOnly={!canViewSalary}
					onSelect={handleSelect}
					selectedId={selectedEmployeeId}
				/>
			)}

			{/* Employee form sheet */}
			<EmployeeForm
				open={formOpen}
				onClose={() => setFormOpen(false)}
				employee={formEmployee}
				isReadOnly={!isEditable}
				onSave={handleSave}
				{...(formEmployee ? { onDelete: handleDelete } : {})}
				isPending={createMutation.isPending || updateMutation.isPending}
			/>

			{/* Import dialog */}
			<EmployeeImportDialog
				open={importOpen}
				onClose={() => setImportOpen(false)}
				versionId={versionId}
			/>
		</div>
	);
}
