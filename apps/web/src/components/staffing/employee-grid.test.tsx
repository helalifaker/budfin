import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EmployeeGrid } from './employee-grid';
import type { Employee } from '../../hooks/use-staffing';

afterEach(() => {
	cleanup();
});

function makeEmployee(overrides: Partial<Employee> & { id: number; name: string }): Employee {
	return {
		employeeCode: `EMP-${overrides.id}`,
		department: 'Administration',
		functionRole: 'Teacher',
		status: 'Existing',
		joiningDate: '2024-09-01',
		paymentMethod: 'Bank',
		isSaudi: false,
		isAjeer: false,
		isTeaching: true,
		hourlyPercentage: '1.0',
		baseSalary: '5000',
		housingAllowance: '1000',
		transportAllowance: '500',
		responsibilityPremium: null,
		hsaAmount: null,
		augmentation: null,
		augmentationEffectiveDate: null,
		updatedAt: '2026-03-01T00:00:00Z',
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

const EMPLOYEES: Employee[] = [
	makeEmployee({ id: 1, name: 'Alice Martin', department: 'Maternelle' }),
	makeEmployee({ id: 2, name: 'Bob Dupont', department: 'Maternelle' }),
	makeEmployee({ id: 3, name: 'Claire Bernard', department: 'Elementaire' }),
	makeEmployee({ id: 4, name: 'David Leroy', department: 'Elementaire' }),
	makeEmployee({ id: 5, name: 'Eve Moreau', department: 'Administration' }),
];

describe('EmployeeGrid department grouping', () => {
	it('renders department group headers with labels', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		expect(screen.getByText('Maternelle')).toBeDefined();
		expect(screen.getByText('Elementaire')).toBeDefined();
		expect(screen.getByText('Administration')).toBeDefined();
	});

	it('departments are collapsed by default (employee names hidden)', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		// Employee names should not be visible when collapsed
		expect(screen.queryByText('Alice Martin')).toBeNull();
		expect(screen.queryByText('Bob Dupont')).toBeNull();
		expect(screen.queryByText('Claire Bernard')).toBeNull();
	});

	it('clicking a department group header expands it to show employees', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		// Alice and Bob should not be visible initially
		expect(screen.queryByText('Alice Martin')).toBeNull();

		// Click the Maternelle group header row
		fireEvent.click(screen.getByText('Maternelle'));

		// Now Alice and Bob should be visible
		expect(screen.getByText('Alice Martin')).toBeDefined();
		expect(screen.getByText('Bob Dupont')).toBeDefined();
		// Claire (Elementaire) should still be hidden
		expect(screen.queryByText('Claire Bernard')).toBeNull();
	});

	it('clicking an expanded group header collapses it', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		// Expand
		fireEvent.click(screen.getByText('Maternelle'));
		expect(screen.getByText('Alice Martin')).toBeDefined();

		// Collapse
		fireEvent.click(screen.getByText('Maternelle'));
		expect(screen.queryByText('Alice Martin')).toBeNull();
	});

	it('announces expand/collapse via aria-live region', () => {
		const { container } = render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const liveRegion = container.querySelector('[aria-live="polite"]')!;
		expect(liveRegion).toBeDefined();

		// Expand
		fireEvent.click(screen.getByText('Maternelle'));
		expect(liveRegion.textContent).toBe('Maternelle expanded, 2 employees');

		// Collapse
		fireEvent.click(screen.getByText('Maternelle'));
		expect(liveRegion.textContent).toBe('Maternelle collapsed');
	});

	it('displays department headcount badges', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		// Maternelle has 2, Elementaire has 2, Administration has 1
		const badges = screen.getAllByText('2', { selector: 'span' });
		expect(badges.length).toBe(2); // Maternelle and Elementaire both have 2
		expect(screen.getByText('1', { selector: 'span' })).toBeDefined();
	});

	it('renders table with aria-label', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const table = screen.getByRole('table');
		expect(table.getAttribute('aria-label')).toBe('Employee roster');
	});

	it('hides salary column for read-only (Viewer) users', () => {
		render(
			<EmployeeGrid employees={EMPLOYEES} isReadOnly={true} onSelect={() => {}} selectedId={null} />
		);

		expect(screen.queryByText('Base Salary')).toBeNull();
	});

	it('shows summary text with employee and department counts', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		expect(screen.getByText(/5/)).toBeDefined();
		expect(screen.getByText(/3 department/)).toBeDefined();
	});

	it('shows total count when different from displayed employees', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
				totalCount={10}
			/>
		);

		expect(screen.getByText(/5 of 10/)).toBeDefined();
	});

	it('shows column headers for sortable fields', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		expect(screen.getByText('Code')).toBeDefined();
		expect(screen.getByText('Name')).toBeDefined();
		expect(screen.getByText('Role')).toBeDefined();
		expect(screen.getByText('Status')).toBeDefined();
		expect(screen.getByText('Base Salary')).toBeDefined();
	});

	it('shows employee data when department is expanded', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		// Expand Administration department
		fireEvent.click(screen.getByText('Administration'));

		// Eve's data should be visible
		expect(screen.getByText('Eve Moreau')).toBeDefined();
		expect(screen.getByText('EMP-5')).toBeDefined();
	});
});
