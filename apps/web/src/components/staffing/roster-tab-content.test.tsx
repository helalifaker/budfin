import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RosterTabContent } from './roster-tab-content';
import type { EmployeeListResponse } from '../../hooks/use-staffing';

// ── Store / hook mocks ──────────────────────────────────────────────────────

const mockSelectEmployee = vi.fn();
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('../../stores/staffing-selection-store', () => ({
	useStaffingSelectionStore: (selector: (state: unknown) => unknown) =>
		selector({ selectEmployee: mockSelectEmployee }),
}));

vi.mock('../../stores/auth-store', () => ({
	useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
		selector({ user: { role: 'Admin' } }),
}));

vi.mock('../../hooks/use-staffing', () => ({
	useCreateEmployee: () => ({ mutate: mockCreateMutate, isPending: false }),
	useUpdateEmployee: () => ({ mutate: mockUpdateMutate, isPending: false }),
	useDeleteEmployee: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

// ── Child component mocks ───────────────────────────────────────────────────

vi.mock('./employee-grid', () => ({
	EmployeeGrid: ({
		employees,
		isReadOnly,
		onSelect,
	}: {
		employees: unknown[];
		isReadOnly: boolean;
		onSelect: (emp: unknown) => void;
		selectedId: number | null;
	}) => (
		<div
			data-testid="employee-grid"
			data-employee-count={employees.length}
			data-readonly={String(isReadOnly)}
		>
			{employees.map((e: unknown) => {
				const emp = e as { id: number; name: string };
				return (
					<button key={emp.id} type="button" onClick={() => onSelect(emp)}>
						{emp.name}
					</button>
				);
			})}
		</div>
	),
}));

vi.mock('./support-admin-grid', () => ({
	SupportAdminGrid: ({
		employees,
	}: {
		employees: unknown[];
		editability: string;
		onEmployeeSelect: (emp: unknown) => void;
		onEmployeeDoubleClick: (emp: unknown) => void;
	}) => (
		<div data-testid="support-admin-grid" data-employee-count={employees.length}>
			Support Grid
		</div>
	),
}));

vi.mock('./employee-form', () => ({
	EmployeeForm: ({
		open,
		onClose,
	}: {
		open: boolean;
		onClose: () => void;
		employee: unknown;
		isReadOnly: boolean;
		onSave: (data: unknown) => void;
		isPending: boolean;
	}) =>
		open ? (
			<div data-testid="employee-form">
				<button type="button" onClick={onClose}>
					Close Form
				</button>
			</div>
		) : null,
}));

vi.mock('./employee-import-dialog', () => ({
	EmployeeImportDialog: ({ open }: { open: boolean; onClose: () => void; versionId: number }) =>
		open ? <div data-testid="import-dialog">Import Dialog</div> : null,
}));

vi.mock('../ui/button', () => ({
	Button: ({
		children,
		onClick,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
		<button type="button" onClick={onClick} {...props}>
			{children}
		</button>
	),
}));

vi.mock('../ui/toggle-group', () => ({
	ToggleGroup: ({
		children,
		onValueChange,
		'aria-label': ariaLabel,
	}: {
		children: ReactNode;
		value: string;
		onValueChange?: (v: string) => void;
		type: string;
		'aria-label'?: string;
	}) => (
		<div role="group" aria-label={ariaLabel} data-onchange={onValueChange ? 'true' : 'false'}>
			{children}
		</div>
	),
	ToggleGroupItem: ({
		children,
		value,
		'aria-label': ariaLabel,
	}: {
		children: ReactNode;
		value: string;
		'aria-label'?: string;
	}) => (
		<button type="button" data-value={value} aria-label={ariaLabel}>
			{children}
		</button>
	),
}));

vi.mock('../../lib/staffing-workspace', () => ({
	deriveStaffingEditability: ({ role }: { role: string | null; versionStatus: string | null }) => {
		if (role === 'Viewer') return 'viewer';
		return 'editable';
	},
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeEmployee(
	id: number,
	name: string,
	isTeaching: boolean
): EmployeeListResponse['data'][number] {
	return {
		id,
		employeeCode: `EMP-${id}`,
		name,
		functionRole: isTeaching ? 'Teacher' : 'Secretary',
		department: isTeaching ? 'Maternelle' : 'Administration',
		status: 'Existing',
		joiningDate: '2024-09-01',
		paymentMethod: 'Bank',
		isSaudi: false,
		isAjeer: false,
		isTeaching,
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
	};
}

const EMPLOYEES_DATA: EmployeeListResponse = {
	data: [
		makeEmployee(1, 'Alice Martin', true),
		makeEmployee(2, 'Bob Dupont', true),
		makeEmployee(3, 'Sophie Bernard', false),
	],
	total: 3,
};

const EMPTY_EMPLOYEES: EmployeeListResponse = { data: [], total: 0 };

afterEach(() => {
	cleanup();
	mockSelectEmployee.mockReset();
	mockCreateMutate.mockReset();
	mockUpdateMutate.mockReset();
	mockDeleteMutate.mockReset();
});

describe('RosterTabContent', () => {
	// ── Basic render ─────────────────────────────────────────────────────────

	it('renders without crashing with empty employee list', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPTY_EMPLOYEES}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		expect(screen.getByTestId('employee-grid')).toBeDefined();
	});

	it('renders the sub-view toggle group with aria-label', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		expect(screen.getByRole('group', { name: 'Employee sub-view' })).toBeDefined();
	});

	it('renders Teaching, Support, and All sub-view buttons', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		expect(screen.getByRole('button', { name: 'Teaching staff' })).toBeDefined();
		expect(screen.getByRole('button', { name: 'Support and admin staff' })).toBeDefined();
		expect(screen.getByRole('button', { name: 'All staff' })).toBeDefined();
	});

	// ── Editable toolbar ─────────────────────────────────────────────────────

	it('shows Add Employee, Add Vacancy, and Import buttons when editable', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		expect(screen.getByText('+ Add Employee')).toBeDefined();
		expect(screen.getByText('+ Add Vacancy')).toBeDefined();
		expect(screen.getByText('Import')).toBeDefined();
	});

	it('hides Add Employee, Add Vacancy, and Import buttons when not editable', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={false}
				canViewSalary={true}
			/>
		);
		expect(screen.queryByText('+ Add Employee')).toBeNull();
		expect(screen.queryByText('+ Add Vacancy')).toBeNull();
		expect(screen.queryByText('Import')).toBeNull();
	});

	// ── Grid visibility: default "all" sub-view ──────────────────────────────

	it('renders EmployeeGrid by default (all sub-view)', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		expect(screen.getByTestId('employee-grid')).toBeDefined();
		expect(screen.queryByTestId('support-admin-grid')).toBeNull();
	});

	it('passes all employees to EmployeeGrid in "all" sub-view', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		const grid = screen.getByTestId('employee-grid');
		expect(grid.getAttribute('data-employee-count')).toBe('3');
	});

	// ── isReadOnly derived from canViewSalary ────────────────────────────────

	it('passes isReadOnly=false to EmployeeGrid when canViewSalary is true', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		const grid = screen.getByTestId('employee-grid');
		expect(grid.getAttribute('data-readonly')).toBe('false');
	});

	it('passes isReadOnly=true to EmployeeGrid when canViewSalary is false', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={false}
			/>
		);
		const grid = screen.getByTestId('employee-grid');
		expect(grid.getAttribute('data-readonly')).toBe('true');
	});

	// ── Employee form ────────────────────────────────────────────────────────

	it('opens EmployeeForm when Add Employee is clicked', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		expect(screen.queryByTestId('employee-form')).toBeNull();
		fireEvent.click(screen.getByText('+ Add Employee'));
		expect(screen.getByTestId('employee-form')).toBeDefined();
	});

	it('opens EmployeeForm when Add Vacancy is clicked', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		fireEvent.click(screen.getByText('+ Add Vacancy'));
		expect(screen.getByTestId('employee-form')).toBeDefined();
	});

	it('closes EmployeeForm when form Close button is clicked', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		fireEvent.click(screen.getByText('+ Add Employee'));
		expect(screen.getByTestId('employee-form')).toBeDefined();
		fireEvent.click(screen.getByText('Close Form'));
		expect(screen.queryByTestId('employee-form')).toBeNull();
	});

	// ── Import dialog ────────────────────────────────────────────────────────

	it('opens import dialog when Import is clicked', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		expect(screen.queryByTestId('import-dialog')).toBeNull();
		fireEvent.click(screen.getByText('Import'));
		expect(screen.getByTestId('import-dialog')).toBeDefined();
	});

	// ── Employee selection ───────────────────────────────────────────────────

	it('calls selectEmployee store action when an employee is clicked in the grid', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={true}
				canViewSalary={true}
			/>
		);
		// EmployeeGrid mock renders buttons for each employee
		fireEvent.click(screen.getByText('Alice Martin'));
		expect(mockSelectEmployee).toHaveBeenCalledWith(1, 'Maternelle');
	});

	// ── Read-only mode (no version status prop) ──────────────────────────────

	it('renders correctly with no versionStatus prop', () => {
		render(
			<RosterTabContent
				versionId={42}
				employeesData={EMPLOYEES_DATA}
				isEditable={false}
				canViewSalary={false}
			/>
		);
		// Should render without crashing
		expect(screen.getByTestId('employee-grid')).toBeDefined();
	});
});
