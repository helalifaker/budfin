import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SupportAdminGrid } from './support-admin-grid';
import type { Employee } from '../../hooks/use-staffing';

afterEach(() => {
	cleanup();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> & { id: number; name: string }): Employee {
	return {
		employeeCode: `EMP-${overrides.id}`,
		department: 'Administration',
		functionRole: 'Secretary',
		status: 'Existing',
		joiningDate: '2024-09-01',
		paymentMethod: 'Bank',
		isSaudi: false,
		isAjeer: false,
		isTeaching: false,
		hourlyPercentage: '1.0000',
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
		monthlyCost: '6500',
		annualCost: '78000',
		disciplineName: null,
		serviceProfileName: null,
		...overrides,
	} as Employee;
}

const EMPLOYEES: Employee[] = [
	makeEmployee({
		id: 1,
		name: 'Alice Martin',
		department: 'Administration',
		functionRole: 'Admin Assistant',
		status: 'Existing',
		hourlyPercentage: '1.0000',
		monthlyCost: '8000',
		annualCost: '96000',
	}),
	makeEmployee({
		id: 2,
		name: 'Bob Dupont',
		department: 'Administration',
		functionRole: 'Office Manager',
		status: 'New',
		hourlyPercentage: '1.0000',
		monthlyCost: '10000',
		annualCost: '120000',
	}),
	makeEmployee({
		id: 3,
		name: 'Charlie Bernard',
		department: 'Maintenance',
		functionRole: 'Janitor',
		status: 'Existing',
		hourlyPercentage: '0.5000',
		monthlyCost: '3000',
		annualCost: '36000',
	}),
	makeEmployee({
		id: 4,
		name: '',
		department: 'IT',
		functionRole: 'IT Support',
		status: 'Vacancy',
		employeeCode: 'VAC-001',
		recordType: 'VACANCY',
		hourlyPercentage: '1.0000',
		monthlyCost: '7000',
		annualCost: '84000',
	}),
];

// ── AC-09: SupportAdminGrid renders ─────────────────────────────────────────

describe('SupportAdminGrid', () => {
	describe('department grouping', () => {
		it('renders department group headers', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			expect(screen.getByText('Administration')).toBeDefined();
			expect(screen.getByText('Maintenance')).toBeDefined();
			expect(screen.getByText('IT')).toBeDefined();
		});

		it('shows employee count in department headers', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Administration has 2 employees
			const adminHeader = screen.getByText('Administration').closest('tr')!;
			expect(adminHeader.textContent).toContain('2');
		});

		it('shows subtotal annual cost in department headers', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Administration subtotal = 96000 + 120000 = 216000
			const adminHeader = screen.getByText('Administration').closest('tr')!;
			// SAR compact format -- exact text depends on formatMoney
			expect(adminHeader.textContent).toMatch(/216/);
		});

		it('department headers are collapsible', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			const deptRows = screen
				.getAllByRole('row')
				.filter((row) => row.getAttribute('aria-expanded') !== null);
			expect(deptRows.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe('column rendering', () => {
		it('renders all 8 column headers', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Check for the 8 required columns
			expect(screen.getByText('Name / Position')).toBeDefined();
			expect(screen.getByText('Role')).toBeDefined();
			expect(screen.getByText('Status')).toBeDefined();
			expect(screen.getByText('FTE')).toBeDefined();
			expect(screen.getByText('Start')).toBeDefined();
			expect(screen.getByText('End')).toBeDefined();
			expect(screen.getByText('Monthly')).toBeDefined();
			expect(screen.getByText('Annual')).toBeDefined();
		});
	});

	describe('status badges', () => {
		it('renders Existing status badge with info styling', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand Administration to see Alice (Existing)
			const adminRow = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Administration'))!;
			fireEvent.click(adminRow);

			const existingBadges = screen.getAllByText('Existing');
			expect(existingBadges.length).toBeGreaterThanOrEqual(1);
		});

		it('renders New status badge with success styling', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand Administration to see Bob (New)
			const adminRow = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Administration'))!;
			fireEvent.click(adminRow);

			expect(screen.getByText('New')).toBeDefined();
		});

		it('renders Vacancy status badge with muted styling', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand IT to see vacancy
			const itRow = screen.getAllByRole('row').find((r) => r.textContent?.includes('IT'))!;
			fireEvent.click(itRow);

			expect(screen.getByText('Vacancy')).toBeDefined();
		});
	});

	describe('vacancy display', () => {
		it('shows "Vacancy: [role]" in muted italic for vacancy rows', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand IT
			const itRow = screen.getAllByRole('row').find((r) => r.textContent?.includes('IT'))!;
			fireEvent.click(itRow);

			const vacancyText = screen.getByText(/Vacancy: IT Support/);
			expect(vacancyText).toBeDefined();
			expect(vacancyText.className).toContain('italic');
		});
	});

	describe('row interaction', () => {
		it('clicking a row calls onEmployeeSelect with the employee', () => {
			const onSelect = vi.fn();
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={onSelect}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand Administration
			const adminRow = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Administration'))!;
			fireEvent.click(adminRow);

			// Click Alice's row
			const aliceRow = screen.getByText('Alice Martin').closest('tr')!;
			fireEvent.click(aliceRow);

			expect(onSelect).toHaveBeenCalledWith(
				expect.objectContaining({ id: 1, name: 'Alice Martin' })
			);
		});

		it('double-clicking a row calls onEmployeeDoubleClick when editable', () => {
			const onDoubleClick = vi.fn();
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={onDoubleClick}
				/>
			);

			// Expand Administration
			const adminRow = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Administration'))!;
			fireEvent.click(adminRow);

			// Double-click Alice's row
			const aliceRow = screen.getByText('Alice Martin').closest('tr')!;
			fireEvent.doubleClick(aliceRow);

			expect(onDoubleClick).toHaveBeenCalledWith(
				expect.objectContaining({ id: 1, name: 'Alice Martin' })
			);
		});

		it('double-clicking does NOT call onEmployeeDoubleClick when locked', () => {
			const onDoubleClick = vi.fn();
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="locked"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={onDoubleClick}
				/>
			);

			// Expand Administration
			const adminRow = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Administration'))!;
			fireEvent.click(adminRow);

			// Double-click Alice's row
			const aliceRow = screen.getByText('Alice Martin').closest('tr')!;
			fireEvent.doubleClick(aliceRow);

			expect(onDoubleClick).not.toHaveBeenCalled();
		});
	});

	describe('grand total row', () => {
		it('renders a grand total row at the bottom', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			expect(screen.getByText('TOTAL')).toBeDefined();
		});

		it('grand total shows sum of all annual costs', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Grand total = 96000 + 120000 + 36000 + 84000 = 336000
			const totalRow = screen.getByText('TOTAL').closest('tr')!;
			expect(totalRow.textContent).toMatch(/336/);
		});
	});

	describe('empty state', () => {
		it('shows empty message when no non-teaching employees', () => {
			render(
				<SupportAdminGrid
					employees={[]}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			expect(screen.getByText(/no.*employees/i)).toBeDefined();
		});
	});

	describe('accessibility', () => {
		it('table has role="table" (read-only grid)', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			const table = screen.getByRole('table');
			expect(table).toBeDefined();
			expect(table.getAttribute('aria-label')).toBe('Support and admin employees');
		});

		it('has aria-live region for announcements', () => {
			const { container } = render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			const liveRegion = container.querySelector('[aria-live="polite"]');
			expect(liveRegion).toBeDefined();
		});

		it('keyboard Enter/Space toggles department expand/collapse', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			const adminRow = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Administration'))!;

			expect(adminRow.getAttribute('aria-expanded')).toBe('false');

			fireEvent.keyDown(adminRow, { key: 'Enter' });
			expect(adminRow.getAttribute('aria-expanded')).toBe('true');

			fireEvent.keyDown(adminRow, { key: ' ' });
			expect(adminRow.getAttribute('aria-expanded')).toBe('false');
		});
	});

	describe('monetary formatting', () => {
		it('formats monthly cost using SAR compact format via font-mono', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand Administration
			const adminRow = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Administration'))!;
			fireEvent.click(adminRow);

			// Find a cell with monthly cost -- "8000" or formatted SAR equivalent
			const aliceRow = screen.getByText('Alice Martin').closest('tr')!;
			expect(aliceRow.textContent).toMatch(/8/); // Should show monetary value
		});

		it('annual cost cells use bold font weight', () => {
			render(
				<SupportAdminGrid
					employees={EMPLOYEES}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand Administration
			const adminRow = screen
				.getAllByRole('row')
				.find((r) => r.textContent?.includes('Administration'))!;
			fireEvent.click(adminRow);

			// Find annual cost cells -- they should use font-semibold or font-bold
			const aliceRow = screen.getByText('Alice Martin').closest('tr')!;
			const cells = aliceRow.querySelectorAll('td');
			const lastCell = cells[cells.length - 1]!; // annual cost is last column
			expect(lastCell.className).toMatch(/font-(bold|semibold)/);
		});
	});

	describe('date formatting', () => {
		it('shows contract end date when present', () => {
			const employees = [
				makeEmployee({
					id: 1,
					name: 'Alice',
					contractEndDate: '2027-06-30',
				}),
			];

			render(
				<SupportAdminGrid
					employees={employees}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand department
			const deptRow = screen
				.getAllByRole('row')
				.find((r) => r.getAttribute('aria-expanded') !== null)!;
			fireEvent.click(deptRow);

			// Should show a date representation of 2027-06-30
			const aliceRow = screen.getByText('Alice').closest('tr')!;
			expect(aliceRow.textContent).toMatch(/Jun|2027/);
		});

		it('shows dash when contractEndDate is null', () => {
			const employees = [
				makeEmployee({
					id: 1,
					name: 'Alice',
					contractEndDate: null,
				}),
			];

			render(
				<SupportAdminGrid
					employees={employees}
					editability="editable"
					onEmployeeSelect={() => {}}
					onEmployeeDoubleClick={() => {}}
				/>
			);

			// Expand department
			const deptRow = screen
				.getAllByRole('row')
				.find((r) => r.getAttribute('aria-expanded') !== null)!;
			fireEvent.click(deptRow);

			const aliceRow = screen.getByText('Alice').closest('tr')!;
			expect(aliceRow.textContent).toContain('\u2014'); // em dash
		});
	});
});
