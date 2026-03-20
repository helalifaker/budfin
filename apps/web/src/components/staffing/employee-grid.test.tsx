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
		ajeerAnnualLevy: '0',
		ajeerMonthlyFee: '0',
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
	it('renders department group rows', () => {
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

	it('department rows have aria-expanded=false by default', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const deptRows = screen
			.getAllByRole('row')
			.filter((row) => row.getAttribute('aria-expanded') !== null);
		expect(deptRows.length).toBe(3);
		for (const row of deptRows) {
			expect(row.getAttribute('aria-expanded')).toBe('false');
		}
	});

	it('Space toggles department expand/collapse', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		expect(maternelleRow.getAttribute('aria-expanded')).toBe('false');

		// Space to expand
		fireEvent.keyDown(maternelleRow, { key: ' ' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('true');

		// Space to collapse
		fireEvent.keyDown(maternelleRow, { key: ' ' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('false');
	});

	it('Enter toggles department expand/collapse', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		fireEvent.keyDown(maternelleRow, { key: 'Enter' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('true');

		fireEvent.keyDown(maternelleRow, { key: 'Enter' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('false');
	});

	it('ArrowRight expands collapsed department', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		expect(maternelleRow.getAttribute('aria-expanded')).toBe('false');

		fireEvent.keyDown(maternelleRow, { key: 'ArrowRight' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('true');
	});

	it('ArrowRight does nothing on already expanded department', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		// First expand
		fireEvent.keyDown(maternelleRow, { key: 'ArrowRight' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('true');

		// ArrowRight again should stay expanded
		fireEvent.keyDown(maternelleRow, { key: 'ArrowRight' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('true');
	});

	it('ArrowLeft collapses expanded department', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		// Expand first
		fireEvent.keyDown(maternelleRow, { key: 'ArrowRight' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('true');

		// ArrowLeft to collapse
		fireEvent.keyDown(maternelleRow, { key: 'ArrowLeft' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('false');
	});

	it('ArrowLeft does nothing on already collapsed department', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		expect(maternelleRow.getAttribute('aria-expanded')).toBe('false');

		// ArrowLeft on collapsed should stay collapsed
		fireEvent.keyDown(maternelleRow, { key: 'ArrowLeft' });
		expect(maternelleRow.getAttribute('aria-expanded')).toBe('false');
	});

	it('shows employee rows when department is expanded', () => {
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

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		fireEvent.click(maternelleRow);

		// Now Alice and Bob should be visible
		expect(screen.getByText('Alice Martin')).toBeDefined();
		expect(screen.getByText('Bob Dupont')).toBeDefined();
		// Claire (Elementaire) should still be hidden
		expect(screen.queryByText('Claire Bernard')).toBeNull();
	});

	it('employee detail rows have aria-level=2', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		fireEvent.click(maternelleRow);

		const level2Rows = screen
			.getAllByRole('row')
			.filter((r) => r.getAttribute('aria-level') === '2');
		expect(level2Rows.length).toBe(2);
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

		const maternelleRow = screen
			.getAllByRole('row')
			.find((r) => r.getAttribute('data-department') === 'Maternelle')!;

		// Expand
		fireEvent.keyDown(maternelleRow, { key: 'Enter' });
		expect(liveRegion.textContent).toBe('Maternelle expanded, 2 employees');

		// Collapse
		fireEvent.keyDown(maternelleRow, { key: 'Enter' });
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

	it('renders grid with aria-label', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const grid = screen.getByRole('grid');
		expect(grid.getAttribute('aria-label')).toBe('Employee roster');
	});

	it('has aria-rowcount and aria-colcount on the grid', () => {
		render(
			<EmployeeGrid
				employees={EMPLOYEES}
				isReadOnly={false}
				onSelect={() => {}}
				selectedId={null}
			/>
		);

		const grid = screen.getByRole('grid');
		expect(grid.getAttribute('aria-rowcount')).toBeTruthy();
		expect(grid.getAttribute('aria-colcount')).toBeTruthy();
	});

	it('has aria-readonly on the grid when isReadOnly is true', () => {
		render(
			<EmployeeGrid employees={EMPLOYEES} isReadOnly={true} onSelect={() => {}} selectedId={null} />
		);

		const grid = screen.getByRole('grid');
		expect(grid.getAttribute('aria-readonly')).toBe('true');
	});

	it('hides salary column for read-only (Viewer) users', () => {
		render(
			<EmployeeGrid employees={EMPLOYEES} isReadOnly={true} onSelect={() => {}} selectedId={null} />
		);

		expect(screen.queryByText('Base Salary')).toBeNull();
	});
});
