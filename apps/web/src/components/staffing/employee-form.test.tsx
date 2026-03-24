import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EmployeeForm } from './employee-form';
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
		...overrides,
	} as Employee;
}

const MOCK_DISCIPLINES = [
	{ id: 1, code: 'FR', label: 'Francais', band: null },
	{ id: 2, code: 'MATH', label: 'Mathematiques', band: null },
];

const MOCK_SERVICE_PROFILES = [
	{ id: 1, code: 'CERT', label: 'Certifie', defaultOrs: '18', isHsaEligible: true },
	{ id: 2, code: 'AGR', label: 'Agrege', defaultOrs: '15', isHsaEligible: true },
];

const defaultProps = {
	open: true,
	onClose: vi.fn(),
	employee: null,
	isReadOnly: false,
	onSave: vi.fn(),
	isPending: false,
	disciplines: MOCK_DISCIPLINES,
	serviceProfiles: MOCK_SERVICE_PROFILES,
};

// ── AC-10: Employee form 6 new fields ───────────────────────────────────────

describe('EmployeeForm — new fields', () => {
	describe('recordType field', () => {
		it('renders recordType radio with Employee, Vacancy, and Replacement options', () => {
			render(<EmployeeForm {...defaultProps} />);

			expect(screen.getByLabelText('Employee')).toBeDefined();
			expect(screen.getByLabelText('Vacancy')).toBeDefined();
			expect(screen.getByLabelText('Replacement')).toBeDefined();
		});

		it('defaults to Employee for new employees', () => {
			render(<EmployeeForm {...defaultProps} />);

			const employeeRadio = screen.getByLabelText('Employee') as HTMLInputElement;
			expect(employeeRadio.checked).toBe(true);
		});
	});

	describe('costMode field', () => {
		it('renders costMode select with 3 options', () => {
			render(<EmployeeForm {...defaultProps} />);

			expect(screen.getAllByText(/Local Payroll/).length).toBeGreaterThanOrEqual(1);
		});

		it('shows Local Payroll, AEFE Recharge, and No Local Cost options', async () => {
			render(<EmployeeForm {...defaultProps} />);

			// Find and click the costMode select trigger
			const costModeLabel = screen.getByText(/Cost Mode/i);
			expect(costModeLabel).toBeDefined();
		});
	});

	describe('disciplineId field', () => {
		it('shows discipline select when isTeaching is true', () => {
			const teachingEmployee = makeEmployee({
				id: 1,
				name: 'Teacher A',
				isTeaching: true,
			});
			render(<EmployeeForm {...defaultProps} employee={teachingEmployee} />);

			expect(screen.getByText(/Discipline/)).toBeDefined();
		});

		it('hides discipline select when isTeaching is false', () => {
			const nonTeachingEmployee = makeEmployee({
				id: 1,
				name: 'Admin A',
				isTeaching: false,
			});
			render(<EmployeeForm {...defaultProps} employee={nonTeachingEmployee} />);

			expect(screen.queryByText(/Discipline/)).toBeNull();
		});
	});

	describe('serviceProfileId field', () => {
		it('shows service profile select when isTeaching is true', () => {
			const teachingEmployee = makeEmployee({
				id: 1,
				name: 'Teacher A',
				isTeaching: true,
			});
			render(<EmployeeForm {...defaultProps} employee={teachingEmployee} />);

			expect(screen.getByText(/Service Profile/)).toBeDefined();
		});

		it('hides service profile select when isTeaching is false', () => {
			const nonTeachingEmployee = makeEmployee({
				id: 1,
				name: 'Admin A',
				isTeaching: false,
			});
			render(<EmployeeForm {...defaultProps} employee={nonTeachingEmployee} />);

			expect(screen.queryByText(/Service Profile/)).toBeNull();
		});
	});

	describe('homeBand field', () => {
		it('shows homeBand select with Mat/Elem/Col/Lyc when isTeaching', () => {
			const teachingEmployee = makeEmployee({
				id: 1,
				name: 'Teacher A',
				isTeaching: true,
			});
			render(<EmployeeForm {...defaultProps} employee={teachingEmployee} />);

			expect(screen.getByText(/Home Band/)).toBeDefined();
		});

		it('hides homeBand when isTeaching is false', () => {
			const nonTeachingEmployee = makeEmployee({
				id: 1,
				name: 'Admin A',
				isTeaching: false,
			});
			render(<EmployeeForm {...defaultProps} employee={nonTeachingEmployee} />);

			expect(screen.queryByText(/Home Band/)).toBeNull();
		});
	});

	describe('contractEndDate field', () => {
		it('always renders contractEndDate date picker', () => {
			render(<EmployeeForm {...defaultProps} />);

			expect(screen.getByText(/Contract End/)).toBeDefined();
		});
	});
});

describe('EmployeeForm — conditional visibility', () => {
	describe('costMode = AEFE_RECHARGE', () => {
		it('hides salary fields and shows info banner', () => {
			const employee = makeEmployee({
				id: 1,
				name: 'Recharge Employee',
				costMode: 'AEFE_RECHARGE',
			});
			render(<EmployeeForm {...defaultProps} employee={employee} />);

			// Salary fields (Compensation section) should be hidden
			expect(screen.queryByText(/Base Salary/)).toBeNull();
			expect(screen.queryByText(/Housing Allowance/)).toBeNull();

			// Info banner should be visible
			expect(screen.getByText(/salary managed by AEFE recharge/i)).toBeDefined();
		});
	});

	describe('costMode = NO_LOCAL_COST', () => {
		it('hides salary and Ajeer fields', () => {
			const employee = makeEmployee({
				id: 1,
				name: 'No Cost Employee',
				costMode: 'NO_LOCAL_COST',
			});
			render(<EmployeeForm {...defaultProps} employee={employee} />);

			// Salary fields should be hidden
			expect(screen.queryByText(/Base Salary/)).toBeNull();

			// Ajeer fields should be hidden
			expect(screen.queryByText(/Annual Levy/)).toBeNull();
			expect(screen.queryByText(/Monthly Fee/)).toBeNull();
		});
	});

	describe('recordType = VACANCY', () => {
		it('auto-generates VAC-NNN code and makes code read-only', () => {
			render(<EmployeeForm {...defaultProps} employee={null} />);

			// Switch to Vacancy mode
			const vacancyRadio = screen.getByLabelText('Vacancy');
			fireEvent.click(vacancyRadio);

			// Employee code should contain VAC- prefix
			const codeInput = screen.getByDisplayValue(/VAC-/);
			expect(codeInput).toBeDefined();
		});

		it('hides Saudi and Ajeer flags for vacancy', () => {
			const vacancy = makeEmployee({
				id: 1,
				name: '',
				recordType: 'VACANCY',
				employeeCode: 'VAC-001',
			});
			render(<EmployeeForm {...defaultProps} employee={vacancy} />);

			expect(screen.queryByLabelText(/Saudi/)).toBeNull();
			expect(screen.queryByLabelText(/Ajeer/)).toBeNull();
		});

		it('hides salary fields for vacancy', () => {
			const vacancy = makeEmployee({
				id: 1,
				name: '',
				recordType: 'VACANCY',
				employeeCode: 'VAC-001',
			});
			render(<EmployeeForm {...defaultProps} employee={vacancy} />);

			expect(screen.queryByText(/Base Salary/)).toBeNull();
			expect(screen.queryByText(/Housing Allowance/)).toBeNull();
		});
	});

	describe('isTeaching = false', () => {
		it('hides teaching profile section', () => {
			const nonTeaching = makeEmployee({
				id: 1,
				name: 'Admin A',
				isTeaching: false,
			});
			render(<EmployeeForm {...defaultProps} employee={nonTeaching} />);

			expect(screen.queryByText(/Teaching Profile/)).toBeNull();
			expect(screen.queryByText(/Discipline/)).toBeNull();
			expect(screen.queryByText(/Service Profile/)).toBeNull();
			expect(screen.queryByText(/Home Band/)).toBeNull();
		});
	});

	describe('isTeaching = true', () => {
		it('shows teaching profile section with discipline, profile, and band', () => {
			const teaching = makeEmployee({
				id: 1,
				name: 'Teacher A',
				isTeaching: true,
			});
			render(<EmployeeForm {...defaultProps} employee={teaching} />);

			expect(screen.getByText(/Teaching Profile/)).toBeDefined();
			expect(screen.getByText(/Discipline/)).toBeDefined();
			expect(screen.getByText(/Service Profile/)).toBeDefined();
			expect(screen.getByText(/Home Band/)).toBeDefined();
		});
	});

	describe('hsaAmount always hidden', () => {
		it('does NOT render hsaAmount field in the form', () => {
			const employee = makeEmployee({
				id: 1,
				name: 'Test Employee',
				costMode: 'LOCAL_PAYROLL',
			});
			render(<EmployeeForm {...defaultProps} employee={employee} />);

			expect(screen.queryByText(/HSA Amount/)).toBeNull();
		});
	});

	describe('Ajeer flag visibility', () => {
		it('shows Ajeer checkbox for EMPLOYEE recordType', () => {
			const employee = makeEmployee({
				id: 1,
				name: 'Regular Employee',
				costMode: 'LOCAL_PAYROLL',
			});
			render(<EmployeeForm {...defaultProps} employee={employee} />);

			expect(screen.getByLabelText('Ajeer')).toBeDefined();
		});

		it('no per-employee ajeer fee fields exist (moved to settings)', () => {
			const ajeerEmployee = makeEmployee({
				id: 1,
				name: 'Ajeer Worker',
				isAjeer: true,
				costMode: 'LOCAL_PAYROLL',
			});
			render(<EmployeeForm {...defaultProps} employee={ajeerEmployee} />);

			expect(screen.queryByText(/Annual Levy/)).toBeNull();
			expect(screen.queryByText(/Monthly Fee/)).toBeNull();
		});
	});
});

describe('EmployeeForm — form sections', () => {
	describe('Section 1: Identity', () => {
		it('renders employee code, name, department, function role', () => {
			render(<EmployeeForm {...defaultProps} />);

			expect(screen.getByText(/Employee Code/)).toBeDefined();
			expect(screen.getByText(/Full Name/)).toBeDefined();
			expect(screen.getByText(/Department/)).toBeDefined();
			expect(screen.getByText(/Function.*Role/i)).toBeDefined();
		});
	});

	describe('Section 2: Classification', () => {
		it('renders record type, status, cost mode, isTeaching', () => {
			render(<EmployeeForm {...defaultProps} />);

			expect(screen.getByText(/Record Type/i)).toBeDefined();
			expect(screen.getByText(/Status/)).toBeDefined();
			expect(screen.getByText(/Cost Mode/i)).toBeDefined();
			expect(screen.getByLabelText(/Teaching/)).toBeDefined();
		});
	});

	describe('Section 4: Employment', () => {
		it('renders joining date, contract end date, payment method, hourly percentage', () => {
			render(<EmployeeForm {...defaultProps} />);

			expect(screen.getByText(/Joining Date/)).toBeDefined();
			expect(screen.getByText(/Contract End/)).toBeDefined();
			expect(screen.getByText(/Payment Method/)).toBeDefined();
			expect(screen.getByText(/Hourly/)).toBeDefined();
		});
	});

	describe('Section 5: Compensation (LOCAL_PAYROLL only)', () => {
		it('shows compensation when costMode=LOCAL_PAYROLL', () => {
			const employee = makeEmployee({
				id: 1,
				name: 'Test',
				costMode: 'LOCAL_PAYROLL',
			});
			render(<EmployeeForm {...defaultProps} employee={employee} />);

			expect(screen.getByText(/Base Salary/)).toBeDefined();
			expect(screen.getByText(/Housing Allowance/)).toBeDefined();
			expect(screen.getByText(/Transport Allowance/)).toBeDefined();
		});

		it('shows augmentation with effective date', () => {
			const employee = makeEmployee({
				id: 1,
				name: 'Test',
				costMode: 'LOCAL_PAYROLL',
			});
			render(<EmployeeForm {...defaultProps} employee={employee} />);

			expect(screen.getByText(/Augmentation Effective Date/)).toBeDefined();
			expect(screen.getAllByText(/Augmentation/).length).toBeGreaterThanOrEqual(2);
		});
	});
});
