import { describe, it, expect } from 'vitest';
import {
	applyRosterFilters,
	countActiveFilters,
	extractDepartments,
	EMPTY_FILTERS,
	type RosterFilters,
} from './roster-filters';
import type { Employee } from '../hooks/use-staffing';

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
	return {
		id: 1,
		employeeCode: 'EFIR-001',
		name: 'Test Employee',
		functionRole: 'Teacher',
		department: 'Primaire',
		status: 'Existing',
		joiningDate: '2020-01-01',
		paymentMethod: 'Bank Transfer',
		isSaudi: false,
		isAjeer: false,
		isTeaching: true,
		hourlyPercentage: '1.0000',
		baseSalary: '10000.0000',
		housingAllowance: '2500.0000',
		transportAllowance: '500.0000',
		responsibilityPremium: '0.0000',
		hsaAmount: '0.0000',
		augmentation: '0.0000',
		augmentationEffectiveDate: null,
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

const employees: Employee[] = [
	makeEmployee({
		id: 1,
		employeeCode: 'EFIR-001',
		name: 'Alice',
		department: 'Primaire',
		status: 'Existing',
		costMode: 'LOCAL_PAYROLL',
		functionRole: 'Teacher',
	}),
	makeEmployee({
		id: 2,
		employeeCode: 'EFIR-002',
		name: 'Bob',
		department: 'Maternelle',
		status: 'New',
		costMode: 'AEFE_RECHARGE',
		functionRole: 'Assistant',
	}),
	makeEmployee({
		id: 3,
		employeeCode: 'EFIR-003',
		name: 'Charlie',
		department: 'Administration',
		status: 'Departed',
		costMode: 'LOCAL_PAYROLL',
		functionRole: 'Manager',
	}),
	makeEmployee({
		id: 4,
		employeeCode: 'EFIR-004',
		name: 'Diana',
		department: 'Primaire',
		status: 'Existing',
		costMode: 'AEFE_RECHARGE',
		functionRole: 'Coordinator',
	}),
];

describe('applyRosterFilters', () => {
	it('returns all employees with EMPTY_FILTERS', () => {
		const result = applyRosterFilters(employees, EMPTY_FILTERS);
		expect(result).toHaveLength(4);
	});

	it('filters by department', () => {
		const filters: RosterFilters = { ...EMPTY_FILTERS, departments: ['Primaire'] };
		const result = applyRosterFilters(employees, filters);
		expect(result).toHaveLength(2);
		expect(result.every((e) => e.department === 'Primaire')).toBe(true);
	});

	it('filters by status', () => {
		const filters: RosterFilters = { ...EMPTY_FILTERS, statuses: ['New', 'Departed'] };
		const result = applyRosterFilters(employees, filters);
		expect(result).toHaveLength(2);
	});

	it('filters by cost mode', () => {
		const filters: RosterFilters = { ...EMPTY_FILTERS, costModes: ['AEFE_RECHARGE'] };
		const result = applyRosterFilters(employees, filters);
		expect(result).toHaveLength(2);
	});

	it('searches across code, name, role, and department', () => {
		expect(applyRosterFilters(employees, { ...EMPTY_FILTERS, searchQuery: 'alice' })).toHaveLength(
			1
		);
		expect(
			applyRosterFilters(employees, { ...EMPTY_FILTERS, searchQuery: 'EFIR-003' })
		).toHaveLength(1);
		expect(
			applyRosterFilters(employees, { ...EMPTY_FILTERS, searchQuery: 'Manager' })
		).toHaveLength(1);
		expect(
			applyRosterFilters(employees, { ...EMPTY_FILTERS, searchQuery: 'maternelle' })
		).toHaveLength(1);
	});

	it('combines multiple filters', () => {
		const filters: RosterFilters = {
			departments: ['Primaire'],
			statuses: ['Existing'],
			costModes: ['LOCAL_PAYROLL'],
			searchQuery: '',
		};
		const result = applyRosterFilters(employees, filters);
		expect(result).toHaveLength(1);
		expect(result[0]!.name).toBe('Alice');
	});

	it('returns empty array when no matches', () => {
		const filters: RosterFilters = { ...EMPTY_FILTERS, searchQuery: 'nonexistent' };
		expect(applyRosterFilters(employees, filters)).toHaveLength(0);
	});
});

describe('countActiveFilters', () => {
	it('returns 0 for EMPTY_FILTERS', () => {
		expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
	});

	it('counts each active filter category once', () => {
		expect(countActiveFilters({ ...EMPTY_FILTERS, departments: ['A'] })).toBe(1);
		expect(countActiveFilters({ ...EMPTY_FILTERS, departments: ['A', 'B'] })).toBe(1);
		expect(
			countActiveFilters({
				departments: ['A'],
				statuses: ['New'],
				costModes: ['LOCAL_PAYROLL'],
				searchQuery: 'foo',
			})
		).toBe(4);
	});

	it('ignores whitespace-only search', () => {
		expect(countActiveFilters({ ...EMPTY_FILTERS, searchQuery: '   ' })).toBe(0);
	});
});

describe('extractDepartments', () => {
	it('returns sorted unique departments', () => {
		const result = extractDepartments(employees);
		expect(result).toEqual(['Administration', 'Maternelle', 'Primaire']);
	});

	it('returns empty array for no employees', () => {
		expect(extractDepartments([])).toEqual([]);
	});

	it('excludes empty department strings', () => {
		const emps = [makeEmployee({ department: '' }), makeEmployee({ department: 'X' })];
		expect(extractDepartments(emps)).toEqual(['X']);
	});
});
