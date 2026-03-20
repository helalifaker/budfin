import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StaffCostsDepartmentGrid } from './staff-costs-department-grid';
import type { Employee, StaffCostBreakdown } from '../../hooks/use-staffing';

afterEach(() => {
	cleanup();
});

// ── Test data ──────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
	return {
		id: 1,
		employeeCode: 'EMP001',
		name: 'John Doe',
		functionRole: 'Teacher',
		department: 'Maternelle',
		status: 'Existing',
		joiningDate: '2022-09-01',
		paymentMethod: 'bank',
		isSaudi: false,
		isAjeer: true,
		isTeaching: true,
		hourlyPercentage: '1.00',
		baseSalary: '10000.00',
		housingAllowance: '2500.00',
		transportAllowance: '500.00',
		responsibilityPremium: '0.00',
		hsaAmount: '0.00',
		augmentation: '0.00',
		augmentationEffectiveDate: null,
		ajeerAnnualLevy: '9660.00',
		ajeerMonthlyFee: '805.00',
		updatedAt: '2026-01-01T00:00:00Z',
		recordType: 'EMPLOYEE',
		costMode: 'LOCAL_PAYROLL',
		disciplineId: null,
		serviceProfileId: null,
		homeBand: null,
		contractEndDate: null,
		monthlyCost: null,
		annualCost: null,
		disciplineName: null,
		serviceProfileName: null,
		...overrides,
	};
}

function makeBreakdown(overrides: Partial<StaffCostBreakdown> = {}): StaffCostBreakdown {
	return {
		employee_id: 1,
		employee_name: 'John Doe',
		department: 'Maternelle',
		month: 1,
		base_gross: '10000.00',
		adjusted_gross: '13000.00',
		housing_allowance: '2500.00',
		transport_allowance: '500.00',
		responsibility_premium: '0.00',
		hsa_amount: '0.00',
		gosi_amount: '0.00',
		ajeer_amount: '805.00',
		eos_monthly_accrual: '1083.33',
		total_cost: '14888.33',
		...overrides,
	};
}

const employees: Employee[] = [
	makeEmployee({ id: 1, name: 'Alice Martin', department: 'Maternelle' }),
	makeEmployee({
		id: 2,
		name: 'Bob Dupont',
		department: 'Maternelle',
		employeeCode: 'EMP002',
	}),
	makeEmployee({
		id: 3,
		name: 'Charlie Departed',
		department: 'Maternelle',
		employeeCode: 'EMP003',
		status: 'Departed',
	}),
	makeEmployee({
		id: 4,
		name: 'Dana Smith',
		department: 'Elementaire',
		employeeCode: 'EMP004',
		status: 'New',
	}),
];

const breakdowns: StaffCostBreakdown[] = [
	makeBreakdown({ employee_id: 1, employee_name: 'Alice Martin' }),
	makeBreakdown({ employee_id: 2, employee_name: 'Bob Dupont' }),
	makeBreakdown({
		employee_id: 3,
		employee_name: 'Charlie Departed',
		adjusted_gross: '5000.00',
	}),
	makeBreakdown({
		employee_id: 4,
		employee_name: 'Dana Smith',
		department: 'Elementaire',
		adjusted_gross: '15000.00',
		gosi_amount: '1762.50',
		ajeer_amount: '0.00',
		eos_monthly_accrual: '1250.00',
	}),
];

// ── Tests ──────────────────────────────────────────────────────────────────

describe('StaffCostsDepartmentGrid', () => {
	it('renders loading skeleton when isLoading is true', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={[]}
				breakdown={null}
				isLoading={true}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		const skeleton = screen.getByLabelText('Loading staff costs');
		expect(skeleton).toBeDefined();
		expect(skeleton.getAttribute('aria-busy')).toBe('true');
	});

	it('renders empty state when no employees', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={[]}
				breakdown={null}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		expect(screen.getByText(/No employees found/)).toBeDefined();
	});

	it('renders department group rows with department names', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		// Department names appear in the summary rows
		const allRows = screen.getAllByRole('row');
		const deptRows = allRows.filter((r) => r.hasAttribute('aria-expanded'));
		expect(deptRows.length).toBe(2);
	});

	it('excludes departed employees from headcount', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		// Maternelle: 3 total employees, 2 active (Charlie is Departed)
		// Find the Maternelle department row and verify headcount is 2
		const deptRows = screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-expanded'));

		// Rows are sorted alphabetically: Elementaire, Maternelle
		const maternelleRow = deptRows[1]!;
		// The headcount column (3rd cell) should show 2
		const cells = maternelleRow.querySelectorAll('td');
		// Cell index 2 is headcount
		expect(cells[2]!.textContent).toBe('2');
	});

	it('expands department on click showing employee rows', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		// Initially no employee names visible
		expect(screen.queryByText('Alice Martin')).toBeNull();

		// Find Maternelle department row and click it
		const deptRows = screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-expanded'));
		const maternelleRow = deptRows[1]!;
		fireEvent.click(maternelleRow);

		// Now employee names should be visible
		expect(screen.getByText('Alice Martin')).toBeDefined();
		expect(screen.getByText('Bob Dupont')).toBeDefined();
		expect(screen.getByText('Charlie Departed')).toBeDefined();
	});

	it('collapses expanded department on second click', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		const deptRows = screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-expanded'));
		const maternelleRow = deptRows[1]!;

		// Expand
		fireEvent.click(maternelleRow);
		expect(screen.getByText('Alice Martin')).toBeDefined();

		// Collapse — re-find the row since DOM changed
		const expandedRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('aria-expanded') === 'true');
		fireEvent.click(expandedRow!);

		expect(screen.queryByText('Alice Martin')).toBeNull();
	});

	it('has aria-expanded="false" on department rows initially', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		const deptRows = screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-expanded'));

		expect(deptRows.length).toBe(2);
		for (const row of deptRows) {
			expect(row.getAttribute('aria-expanded')).toBe('false');
		}
	});

	it('shows aria-level=2 on employee detail rows', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		// Expand Maternelle
		const deptRows = screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-expanded'));
		fireEvent.click(deptRows[1]!);

		const level2Rows = screen
			.getAllByRole('row')
			.filter((r) => r.getAttribute('aria-level') === '2');

		// 3 employee rows (including departed Charlie)
		expect(level2Rows.length).toBe(3);
	});

	it('calls onSelectEmployee when clicking an employee code', () => {
		const onSelect = vi.fn();

		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={onSelect}
				selectedEmployeeId={null}
			/>
		);

		// Expand Maternelle
		const deptRows = screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-expanded'));
		fireEvent.click(deptRows[1]!);

		// Click on Alice's employee code link
		const aliceLink = screen.getByText('EMP001');
		fireEvent.click(aliceLink);

		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Alice Martin' }));
	});

	it('renders status badges with correct status text', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		// Expand both departments
		const deptRows = screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-expanded'));

		fireEvent.click(deptRows[0]!); // Elementaire
		fireEvent.click(deptRows[1]!); // Maternelle

		expect(screen.getAllByText('Existing').length).toBeGreaterThan(0);
		expect(screen.getByText('Departed')).toBeDefined();
		expect(screen.getByText('New')).toBeDefined();
	});

	it('masks salary values when isReadOnly is true', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={true}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		// Department rows should show '--' for monetary columns
		const allCells = screen.getAllByText('--');
		expect(allCells.length).toBeGreaterThan(0);
	});

	it('renders Grand Total row in footer', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		expect(screen.getByText('Grand Total')).toBeDefined();
	});

	it('supports keyboard Enter to expand department', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		// Find Elementaire department row (first alphabetically)
		const deptRows = screen.getAllByRole('row').filter((r) => r.hasAttribute('aria-expanded'));
		fireEvent.keyDown(deptRows[0]!, { key: 'Enter' });

		expect(screen.getByText('Dana Smith')).toBeDefined();
	});

	it('renders the table with role="grid" attribute', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={false}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		expect(screen.getByRole('grid')).toBeDefined();
	});

	it('hides Grand Total row when isReadOnly is true', () => {
		render(
			<StaffCostsDepartmentGrid
				employees={employees}
				breakdown={breakdowns}
				isLoading={false}
				isReadOnly={true}
				onSelectEmployee={vi.fn()}
				selectedEmployeeId={null}
			/>
		);

		expect(screen.queryByText('Grand Total')).toBeNull();
	});
});
