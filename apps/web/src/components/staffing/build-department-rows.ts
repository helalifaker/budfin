import type { GrossTooltipData } from './gross-tooltip';
import type { Employee, StaffCostBreakdown } from '../../hooks/use-staffing';

// ── Types ──────────────────────────────────────────────────────────────────

export type DepartmentGroupRow = {
	type: 'department';
	department: string;
	headcount: number;
	totalMonthlyGross: string;
	totalAnnualCost: string;
	subRows: EmployeeDetailRow[];
};

export type EmployeeDetailRow = {
	type: 'employee';
	employeeId: number;
	employeeCode: string;
	name: string;
	functionRole: string;
	monthlyGross: string;
	annualCost: string;
	tooltipData: GrossTooltipData;
	subRows?: never;
};

export type StaffCostGridRow = DepartmentGroupRow | EmployeeDetailRow;

/**
 * Build grouped rows from employee + breakdown data.
 * All values come pre-computed from the API (ADR-002).
 * We pick month=1 (January) as the representative month for the tooltip display.
 */
export function buildDepartmentRows(
	employees: Employee[],
	breakdown: StaffCostBreakdown[] | null
): DepartmentGroupRow[] {
	if (!breakdown || breakdown.length === 0) return [];

	// Build a lookup: employee_id -> month 1 breakdown
	const breakdownByEmployee = new Map<number, StaffCostBreakdown>();
	for (const b of breakdown) {
		// Use month 1 as the representative month for tooltip display
		if (b.month === 1) {
			breakdownByEmployee.set(b.employee_id, b);
		}
	}

	// Build annual cost lookup: employee_id -> sum of total_cost across all months
	// This aggregation is just summing pre-computed API values for display grouping
	const annualCostByEmployee = new Map<number, number>();
	for (const b of breakdown) {
		const prevCost = annualCostByEmployee.get(b.employee_id) ?? 0;
		annualCostByEmployee.set(b.employee_id, prevCost + Number(b.total_cost));
	}

	// Group employees by department
	const deptMap = new Map<string, Employee[]>();
	for (const emp of employees) {
		if (emp.status === 'Departed') continue;
		const list = deptMap.get(emp.department) ?? [];
		list.push(emp);
		deptMap.set(emp.department, list);
	}

	const rows: DepartmentGroupRow[] = [];

	for (const [dept, empList] of deptMap) {
		const subRows: EmployeeDetailRow[] = [];
		let deptMonthlyGross = 0;
		let deptAnnualCost = 0;

		for (const emp of empList) {
			const b = breakdownByEmployee.get(emp.id);
			if (!b) continue;

			const monthlyGross = b.adjusted_gross;
			const annualCost = annualCostByEmployee.get(emp.id) ?? 0;

			deptMonthlyGross += Number(monthlyGross);
			deptAnnualCost += annualCost;

			subRows.push({
				type: 'employee',
				employeeId: emp.id,
				employeeCode: emp.employeeCode,
				name: emp.name,
				functionRole: emp.functionRole,
				monthlyGross,
				annualCost: annualCost.toString(),
				tooltipData: {
					baseSalary: emp.baseSalary,
					housingAllowance: emp.housingAllowance,
					transportAllowance: emp.transportAllowance,
					responsibilityPremium: emp.responsibilityPremium,
					hsaAmount: emp.hsaAmount,
					hourlyPercentage: emp.hourlyPercentage,
					subtotal: b.base_gross,
					monthlyGross: b.adjusted_gross,
					isTeaching: emp.isTeaching,
				},
			});
		}

		if (subRows.length > 0) {
			rows.push({
				type: 'department',
				department: dept,
				headcount: subRows.length,
				totalMonthlyGross: deptMonthlyGross.toString(),
				totalAnnualCost: deptAnnualCost.toString(),
				subRows,
			});
		}
	}

	return rows;
}
