import { useState, useMemo, useCallback } from 'react';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useAuthStore } from '../../stores/auth-store';
import {
	useEmployees,
	useCreateEmployee,
	useUpdateEmployee,
	useDeleteEmployee,
	useCalculateStaffing,
	useDhgData,
	useStaffCosts,
	useStaffingSummary,
	type Employee,
} from '../../hooks/use-staffing';
import { useVersions } from '../../hooks/use-versions';
import { WorkspaceBoard } from '../../components/shared/workspace-board';
import { WorkspaceBlock } from '../../components/shared/workspace-block';
import { StaffingKpiRibbon } from '../../components/staffing/kpi-ribbon';
import { EmployeeGrid } from '../../components/staffing/employee-grid';
import { EmployeeForm, type EmployeeFormData } from '../../components/staffing/employee-form';
import { EmployeeImportDialog } from '../../components/staffing/employee-import-dialog';
import { DhgGrilleView, DhgRequirementsView } from '../../components/staffing/dhg-view';
import { MonthlyCostGrid } from '../../components/staffing/monthly-cost-grid';
import { Button } from '../../components/ui/button';
import { PageTransition } from '../../components/shared/page-transition';

export function StaffingPage() {
	const { versionId, fiscalYear } = useWorkspaceContext();
	const user = useAuthStore((s) => s.user);
	const isViewer = user?.role === 'Viewer';

	const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
	const [formOpen, setFormOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const costGroupBy: 'month' | 'department' | 'employee' = 'month';

	// Data hooks
	const { data: employeesData } = useEmployees(versionId);
	const { data: dhgData } = useDhgData(versionId);
	const { data: costData } = useStaffCosts(versionId, costGroupBy);
	const { data: breakdownData, isLoading: isBreakdownLoading } = useStaffCosts(
		versionId,
		'employee',
		true
	);
	const { data: summaryData, isLoading: isSummaryLoading } = useStaffingSummary(versionId);
	const { data: versionsData } = useVersions(fiscalYear);

	// Mutations
	const calculateMutation = useCalculateStaffing(versionId);
	const createMutation = useCreateEmployee(versionId);
	const updateMutation = useUpdateEmployee(versionId);
	const deleteMutation = useDeleteEmployee(versionId);

	const currentVersion = useMemo(() => {
		if (!versionId || !versionsData?.data) return null;
		return versionsData.data.find((v) => v.id === versionId) ?? null;
	}, [versionId, versionsData]);

	const isStale = currentVersion?.staleModules?.includes('STAFFING') ?? false;
	const employees = useMemo(() => employeesData?.data ?? [], [employeesData?.data]);

	const kpiData = useMemo(() => {
		const activeEmployees = employees.filter((e) => e.status !== 'Departed');
		const totalHeadcount = activeEmployees.length;
		const totalAnnualStaffCost = Number(summaryData?.cost ?? 0);
		const avgMonthlyCostPerEmployee =
			totalHeadcount > 0 ? Math.round(totalAnnualStaffCost / totalHeadcount / 12) : 0;

		// Sum GOSI, Ajeer, EoS from breakdown rows (API-provided values)
		const breakdown = breakdownData?.breakdown ?? [];
		let gosiTotal = 0;
		let ajeerTotal = 0;
		let eosTotal = 0;
		for (const row of breakdown) {
			gosiTotal += Number(row.gosi_amount);
			ajeerTotal += Number(row.ajeer_amount);
			eosTotal += Number(row.eos_monthly_accrual);
		}

		return {
			totalHeadcount,
			totalAnnualStaffCost,
			avgMonthlyCostPerEmployee,
			gosiTotal: Math.round(gosiTotal),
			ajeerTotal: Math.round(ajeerTotal),
			eosTotal: Math.round(eosTotal),
			isStale,
			isLoading: isSummaryLoading || isBreakdownLoading,
		};
	}, [summaryData, breakdownData, employees, isStale, isSummaryLoading, isBreakdownLoading]);

	const handleSelectEmployee = useCallback((emp: Employee) => {
		setSelectedEmployee(emp);
		setFormOpen(true);
	}, []);

	const handleNewEmployee = useCallback(() => {
		setSelectedEmployee(null);
		setFormOpen(true);
	}, []);

	const handleSave = useCallback(
		(data: EmployeeFormData) => {
			if (selectedEmployee) {
				updateMutation.mutate(
					{
						id: selectedEmployee.id,
						data: data as unknown as Partial<Employee>,
						updatedAt: selectedEmployee.updatedAt,
					},
					{
						onSuccess: () => setFormOpen(false),
					}
				);
			} else {
				createMutation.mutate(data as unknown as Partial<Employee>, {
					onSuccess: () => setFormOpen(false),
				});
			}
		},
		[selectedEmployee, updateMutation, createMutation]
	);

	const handleDelete = useCallback(() => {
		if (!selectedEmployee) return;
		deleteMutation.mutate(selectedEmployee.id, {
			onSuccess: () => {
				setFormOpen(false);
				setSelectedEmployee(null);
			},
		});
	}, [selectedEmployee, deleteMutation]);

	if (!versionId) {
		return (
			<div className="flex h-64 items-center justify-center text-(--text-muted)">
				Select a version from the context bar to begin staffing planning.
			</div>
		);
	}

	return (
		<PageTransition>
			<WorkspaceBoard
				title="Staffing & Staff Costs"
				description="Manage employees, DHG requirements, and cost projections."
				actions={
					<>
						{!isViewer && (
							<>
								<Button
									size="sm"
									disabled={calculateMutation.isPending}
									onClick={() => calculateMutation.mutate()}
								>
									{calculateMutation.isPending ? 'Calculating...' : 'Calculate'}
								</Button>
								<Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
									Import xlsx
								</Button>
								<Button variant="outline" size="sm" onClick={handleNewEmployee}>
									Add Employee
								</Button>
							</>
						)}
					</>
				}
				kpiRibbon={<StaffingKpiRibbon {...kpiData} />}
			>
				{/* Status feedback */}
				{calculateMutation.isSuccess && (
					<div
						className="rounded-lg border border-(--color-success) bg-(--color-success-bg) px-4 py-2 text-sm text-(--color-success)"
						role="status"
					>
						Staffing calculated successfully.
					</div>
				)}
				{calculateMutation.isError && (
					<div
						className="rounded-lg border border-(--color-error) bg-(--color-error-bg) px-4 py-2 text-sm text-(--color-error)"
						role="alert"
					>
						Calculation failed. Ensure enrollment and employee data are configured.
					</div>
				)}

				<WorkspaceBlock title="Employee Roster" count={employees.length} isStale={isStale}>
					<EmployeeGrid
						employees={employees}
						isReadOnly={isViewer}
						onSelect={handleSelectEmployee}
						selectedId={selectedEmployee?.id ?? null}
					/>
				</WorkspaceBlock>

				<WorkspaceBlock title="DHG Requirements" count={dhgData?.requirements?.length ?? 0}>
					<DhgRequirementsView requirements={dhgData?.requirements ?? []} />
				</WorkspaceBlock>

				<WorkspaceBlock
					title="DHG Grille Configuration"
					count={dhgData?.grilles?.length ?? 0}
					defaultOpen={false}
				>
					<DhgGrilleView grilles={dhgData?.grilles ?? []} />
				</WorkspaceBlock>

				<WorkspaceBlock title="Monthly Cost Budget">
					<MonthlyCostGrid
						data={costData?.data ?? []}
						totals={costData?.totals ?? null}
						isRedacted={isViewer}
					/>
				</WorkspaceBlock>

				{/* Employee Form Panel */}
				<EmployeeForm
					open={formOpen}
					onClose={() => {
						setFormOpen(false);
						setSelectedEmployee(null);
					}}
					employee={selectedEmployee}
					isReadOnly={isViewer}
					onSave={handleSave}
					onDelete={handleDelete}
					isPending={
						createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
					}
				/>

				{/* Import Dialog */}
				<EmployeeImportDialog
					open={importOpen}
					onClose={() => setImportOpen(false)}
					versionId={versionId}
				/>
			</WorkspaceBoard>
		</PageTransition>
	);
}
