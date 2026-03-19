import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { MonthlyCostBudgetGrid } from './monthly-cost-budget-grid';
import { StaffCostsDepartmentGrid } from './staff-costs-department-grid';
import {
	useStaffCostsByCategory,
	useCategoryCosts,
	useEmployees,
	useStaffCosts,
	type Employee,
} from '../../hooks/use-staffing';
import { useStaffingSelectionStore } from '../../stores/staffing-selection-store';

export type CostsTabContentProps = {
	versionId: number;
	isEditable: boolean;
	canViewSalary: boolean;
};

type CostsView = 'monthly' | 'department';

export function CostsTabContent({
	versionId,
	isEditable: _isEditable,
	canViewSalary,
}: CostsTabContentProps) {
	const [view, setView] = useState<CostsView>('monthly');

	const { data: staffCostsByCatData, isLoading: staffCostsByCatLoading } =
		useStaffCostsByCategory(versionId);
	const { data: categoryCostsData, isLoading: categoryCostsLoading } = useCategoryCosts(versionId);
	const { data: employeesData, isLoading: employeesLoading } = useEmployees(versionId);
	const { data: staffCostsData, isLoading: staffCostsLoading } = useStaffCosts(
		versionId,
		'employee',
		true
	);

	const { selection, selectEmployee } = useStaffingSelectionStore();
	const selectedEmployeeId = selection?.type === 'EMPLOYEE' ? selection.employeeId : null;

	function handleSelectEmployee(emp: Employee) {
		selectEmployee(emp.id, emp.department);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<ToggleGroup
					type="single"
					value={view}
					onValueChange={(val) => {
						if (val) setView(val as CostsView);
					}}
					aria-label="Costs view"
				>
					<ToggleGroupItem value="monthly">Monthly Budget</ToggleGroupItem>
					<ToggleGroupItem value="department">By Department</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{view === 'monthly' && (
				<MonthlyCostBudgetGrid
					staffCostData={staffCostsByCatData ?? null}
					categoryCostData={categoryCostsData ?? null}
					isLoading={staffCostsByCatLoading || categoryCostsLoading}
				/>
			)}

			{view === 'department' && (
				<StaffCostsDepartmentGrid
					employees={employeesData?.data ?? []}
					breakdown={staffCostsData?.breakdown ?? null}
					isLoading={employeesLoading || staffCostsLoading}
					isReadOnly={!canViewSalary}
					onSelectEmployee={handleSelectEmployee}
					selectedEmployeeId={selectedEmployeeId}
				/>
			)}
		</div>
	);
}
