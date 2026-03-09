import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EmployeeGrid } from './employee-grid';
import type { Employee } from '../../hooks/use-staffing';

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
	return {
		id: 1,
		employeeCode: 'EMP-001',
		name: 'Alice Martin',
		functionRole: 'Teacher',
		department: 'Primary',
		status: 'Existing',
		joiningDate: '2022-09-01',
		paymentMethod: 'Bank',
		isSaudi: true,
		isAjeer: false,
		isTeaching: true,
		hourlyPercentage: '1.0000',
		baseSalary: '10000',
		housingAllowance: '2500',
		transportAllowance: '500',
		responsibilityPremium: '1000',
		hsaAmount: '300',
		augmentation: '500',
		augmentationEffectiveDate: '2026-09-01',
		ajeerAnnualLevy: '0',
		ajeerMonthlyFee: '0',
		updatedAt: '2026-03-01T00:00:00Z',
		...overrides,
	};
}

describe('EmployeeGrid', () => {
	afterEach(() => {
		cleanup();
	});

	describe('salary field masking for Viewer role', () => {
		it('shows salary column when isReadOnly is false', () => {
			const emp = makeEmployee();
			render(
				<EmployeeGrid employees={[emp]} isReadOnly={false} onSelect={vi.fn()} selectedId={null} />
			);

			expect(screen.getByText('Base Salary')).toBeDefined();
			expect(screen.getByText(/10,000/)).toBeDefined();
		});

		it('shows masked "--" for salary fields when isReadOnly is true and salary is null', () => {
			const emp = makeEmployee({
				baseSalary: null,
				housingAllowance: null,
				transportAllowance: null,
				responsibilityPremium: null,
				hsaAmount: null,
			});
			render(
				<EmployeeGrid employees={[emp]} isReadOnly={true} onSelect={vi.fn()} selectedId={null} />
			);

			// Should show masked salary column with "--" text
			const maskedCells = screen.getAllByText('--');
			expect(maskedCells.length).toBeGreaterThanOrEqual(1);
		});

		it('adds aria-label="Salary data restricted" on masked salary cells', () => {
			const emp = makeEmployee({
				baseSalary: null,
				housingAllowance: null,
				transportAllowance: null,
				responsibilityPremium: null,
				hsaAmount: null,
			});
			render(
				<EmployeeGrid employees={[emp]} isReadOnly={true} onSelect={vi.fn()} selectedId={null} />
			);

			const restricted = screen.getAllByLabelText('Salary data restricted');
			expect(restricted.length).toBeGreaterThanOrEqual(1);
		});

		it('keeps non-salary columns visible for Viewers', () => {
			const emp = makeEmployee({ baseSalary: null });
			render(
				<EmployeeGrid employees={[emp]} isReadOnly={true} onSelect={vi.fn()} selectedId={null} />
			);

			// Non-salary columns should be present
			expect(screen.getByText('Code')).toBeDefined();
			expect(screen.getByText('Name')).toBeDefined();
			expect(screen.getByText('Department')).toBeDefined();
			expect(screen.getByText('Role')).toBeDefined();
			expect(screen.getByText('Status')).toBeDefined();
		});
	});

	describe('ARIA attributes', () => {
		it('has role="grid" on table element', () => {
			render(
				<EmployeeGrid
					employees={[makeEmployee()]}
					isReadOnly={false}
					onSelect={vi.fn()}
					selectedId={null}
				/>
			);

			expect(screen.getByRole('grid')).toBeDefined();
		});

		it('has aria-label on the grid', () => {
			render(
				<EmployeeGrid
					employees={[makeEmployee()]}
					isReadOnly={false}
					onSelect={vi.fn()}
					selectedId={null}
				/>
			);

			const grid = screen.getByRole('grid');
			expect(grid.getAttribute('aria-label')).toBeTruthy();
		});

		it('has aria-rowcount and aria-colcount on the grid', () => {
			const employees = [makeEmployee(), makeEmployee({ id: 2, employeeCode: 'EMP-002' })];
			render(
				<EmployeeGrid
					employees={employees}
					isReadOnly={false}
					onSelect={vi.fn()}
					selectedId={null}
				/>
			);

			const grid = screen.getByRole('grid');
			expect(grid.getAttribute('aria-rowcount')).toBeTruthy();
			expect(grid.getAttribute('aria-colcount')).toBeTruthy();
		});

		it('has aria-colindex on cells', () => {
			render(
				<EmployeeGrid
					employees={[makeEmployee()]}
					isReadOnly={false}
					onSelect={vi.fn()}
					selectedId={null}
				/>
			);

			const cells = screen.getAllByRole('gridcell');
			expect(cells.length).toBeGreaterThan(0);
			expect(cells[0]!.getAttribute('aria-colindex')).toBeTruthy();
		});

		it('has aria-readonly="true" on non-editable cells', () => {
			render(
				<EmployeeGrid
					employees={[makeEmployee()]}
					isReadOnly={true}
					onSelect={vi.fn()}
					selectedId={null}
				/>
			);

			const cells = screen.getAllByRole('gridcell');
			// All cells in read-only mode should have aria-readonly
			const readonlyCells = cells.filter((cell) => cell.getAttribute('aria-readonly') === 'true');
			expect(readonlyCells.length).toBeGreaterThan(0);
		});
	});
});
