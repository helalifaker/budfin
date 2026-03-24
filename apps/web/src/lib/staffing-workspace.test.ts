import { describe, it, expect } from 'vitest';
import {
	buildSupportGridRows,
	buildTeachingGridRows,
	filterTeachingRows,
} from './staffing-workspace';
import type { TeachingGridRow } from './staffing-workspace';
import type { Employee, TeachingRequirementLine } from '../hooks/use-staffing';

// ── Support Grid Helpers ───────────────────────────────────────────────────

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

// ── Support Grid Tests ─────────────────────────────────────────────────────

describe('buildSupportGridRows', () => {
	it('groups non-teaching employees by department', () => {
		const employees = [
			makeEmployee({ id: 1, name: 'Alice', department: 'Administration' }),
			makeEmployee({ id: 2, name: 'Bob', department: 'Administration' }),
			makeEmployee({ id: 3, name: 'Charlie', department: 'Maintenance' }),
		];

		const groups = buildSupportGridRows(employees);
		expect(groups.length).toBe(2);

		const admin = groups.find((g) => g.department === 'Administration');
		expect(admin).toBeDefined();
		expect(admin!.employees.length).toBe(2);

		const maintenance = groups.find((g) => g.department === 'Maintenance');
		expect(maintenance).toBeDefined();
		expect(maintenance!.employees.length).toBe(1);
	});

	it('filters out teaching employees', () => {
		const employees = [
			makeEmployee({ id: 1, name: 'Alice', isTeaching: false }),
			makeEmployee({ id: 2, name: 'Bob', isTeaching: true }),
		];

		const groups = buildSupportGridRows(employees);
		const allEmployees = groups.flatMap((g) => g.employees);
		expect(allEmployees.length).toBe(1);
		expect(allEmployees[0]!.name).toBe('Alice');
	});

	it('computes department subtotal annual cost', () => {
		const employees = [
			makeEmployee({ id: 1, name: 'Alice', department: 'Admin', annualCost: '50000' }),
			makeEmployee({ id: 2, name: 'Bob', department: 'Admin', annualCost: '60000' }),
		];

		const groups = buildSupportGridRows(employees);
		expect(groups[0]!.subtotalAnnualCost).toBe('110000.0000');
	});

	it('computes employee count per department', () => {
		const employees = [
			makeEmployee({ id: 1, name: 'Alice', department: 'Support' }),
			makeEmployee({ id: 2, name: 'Bob', department: 'Support' }),
			makeEmployee({ id: 3, name: 'Charlie', department: 'Support' }),
		];

		const groups = buildSupportGridRows(employees);
		expect(groups[0]!.employeeCount).toBe(3);
	});

	it('computes grand total across all departments', () => {
		const employees = [
			makeEmployee({ id: 1, name: 'Alice', department: 'Admin', annualCost: '50000' }),
			makeEmployee({ id: 2, name: 'Bob', department: 'Support', annualCost: '40000' }),
		];

		const groups = buildSupportGridRows(employees);
		const grandTotal = groups.reduce((sum, g) => sum + parseFloat(g.subtotalAnnualCost), 0);
		expect(grandTotal).toBe(90000);
	});

	it('returns empty array for no non-teaching employees', () => {
		const employees = [makeEmployee({ id: 1, name: 'Teacher A', isTeaching: true })];

		const groups = buildSupportGridRows(employees);
		expect(groups.length).toBe(0);
	});

	it('handles vacancies in employee list', () => {
		const employees = [
			makeEmployee({
				id: 1,
				name: '',
				recordType: 'VACANCY',
				employeeCode: 'VAC-001',
				functionRole: 'IT Support',
				department: 'IT',
				status: 'Vacancy',
			}),
		];

		const groups = buildSupportGridRows(employees);
		expect(groups.length).toBe(1);
		expect(groups[0]!.employees[0]!.employeeCode).toBe('VAC-001');
	});
});

// ── Teaching Grid Pure Function Fixtures ────────────────────────────────────

function makeLine(overrides: Partial<TeachingRequirementLine> = {}): TeachingRequirementLine {
	return {
		id: 1,
		band: 'MATERNELLE',
		disciplineCode: 'FR',
		lineLabel: 'Francais - Maternelle',
		lineType: 'Structural',
		serviceProfileCode: 'PE',
		totalDriverUnits: 10,
		totalWeeklyHours: '15.0',
		baseOrs: '24.0',
		effectiveOrs: '24.0',
		requiredFteRaw: '0.63',
		requiredFteCalculated: null,
		requiredFtePlanned: '1.00',
		recommendedPositions: 1,
		coveredFte: '0.63',
		gapFte: '0.00',
		coverageStatus: 'COVERED',
		assignedStaffCount: 1,
		vacancyCount: 0,
		driverType: 'SECTION',
		directCostAnnual: '120000.00',
		hsaCostAnnual: '5000.00',
		assignedEmployees: [],
		...overrides,
	};
}

const SAMPLE_LINES: TeachingRequirementLine[] = [
	makeLine({
		id: 1,
		band: 'MATERNELLE',
		disciplineCode: 'FR',
		lineLabel: 'Francais - Maternelle',
		requiredFteRaw: '2.50',
		coveredFte: '2.00',
		gapFte: '-0.50',
		coverageStatus: 'DEFICIT',
	}),
	makeLine({
		id: 2,
		band: 'MATERNELLE',
		disciplineCode: 'MA',
		lineLabel: 'Maths - Maternelle',
		requiredFteRaw: '1.50',
		coveredFte: '1.50',
		gapFte: '0.00',
		coverageStatus: 'COVERED',
	}),
	makeLine({
		id: 3,
		band: 'ELEMENTAIRE',
		disciplineCode: 'FR',
		lineLabel: 'Francais - Elementaire',
		requiredFteRaw: '3.00',
		coveredFte: '3.50',
		gapFte: '0.50',
		coverageStatus: 'SURPLUS',
	}),
	makeLine({
		id: 4,
		band: 'COLLEGE',
		disciplineCode: 'SCI',
		lineLabel: 'Sciences - College',
		requiredFteRaw: '2.00',
		coveredFte: '0.00',
		gapFte: '-2.00',
		coverageStatus: 'UNCOVERED',
	}),
	makeLine({
		id: 5,
		band: 'LYCEE',
		disciplineCode: 'PHI',
		lineLabel: 'Philosophie - Lycee',
		requiredFteRaw: '1.00',
		coveredFte: '1.00',
		gapFte: '0.00',
		coverageStatus: 'COVERED',
	}),
];

// ── AC-05: buildTeachingGridRows — band grouping and ordering ──────────────

describe('buildTeachingGridRows', () => {
	it('groups rows by band in the correct display order: MAT -> ELEM -> COL -> LYC', () => {
		const mixedLines = [
			SAMPLE_LINES[4]!, // LYCEE
			SAMPLE_LINES[0]!, // MATERNELLE
			SAMPLE_LINES[3]!, // COLLEGE
			SAMPLE_LINES[2]!, // ELEMENTAIRE
			SAMPLE_LINES[1]!, // MATERNELLE
		];
		const result = buildTeachingGridRows(mixedLines);

		const requirementRows = result.filter((r) => r.rowType === 'requirement');
		const bands = requirementRows.map((r) => r.band);
		const uniqueBands = [...new Set(bands)];

		expect(uniqueBands).toEqual(['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE']);
	});

	it('returns requirement rows with all fields from the API line', () => {
		const result = buildTeachingGridRows([SAMPLE_LINES[0]!]);
		const requirementRows = result.filter((r) => r.rowType === 'requirement');

		expect(requirementRows).toHaveLength(1);
		const row = requirementRows[0]!;
		expect(row.rowType).toBe('requirement');
		expect(row.id).toBe(1);
		expect(row.band).toBe('MATERNELLE');
		expect(row.lineLabel).toBe('Francais - Maternelle');
		expect(row.requiredFteRaw).toBe('2.50');
		expect(row.coverageStatus).toBe('DEFICIT');
	});

	it('includes subtotal rows per band with summed FTE values', () => {
		const result = buildTeachingGridRows(SAMPLE_LINES);
		const subtotalRows = result.filter((r) => r.rowType === 'subtotal');

		expect(subtotalRows.length).toBe(4);

		const matSubtotal = subtotalRows.find((r) => r.band === 'MATERNELLE');
		expect(matSubtotal).toBeDefined();
		expect(matSubtotal!.requiredFteRaw).toBe('4.00');
		expect(matSubtotal!.coveredFte).toBe('3.50');
		expect(matSubtotal!.gapFte).toBe('-0.50');
	});

	it('returns empty array for empty input', () => {
		const result = buildTeachingGridRows([]);
		expect(result).toEqual([]);
	});

	it('preserves all 15 column fields in requirement rows', () => {
		const line = SAMPLE_LINES[0]!;
		const result = buildTeachingGridRows([line]);
		const row = result.find((r) => r.rowType === 'requirement')!;

		expect(row.lineLabel).toBe(line.lineLabel);
		expect(row.serviceProfileCode).toBe(line.serviceProfileCode);
		expect(row.totalDriverUnits).toBe(line.totalDriverUnits);
		expect(row.totalWeeklyHours).toBe(line.totalWeeklyHours);
		expect(row.baseOrs).toBe(line.baseOrs);
		expect(row.effectiveOrs).toBe(line.effectiveOrs);
		expect(row.requiredFteRaw).toBe(line.requiredFteRaw);
		expect(row.requiredFtePlanned).toBe(line.requiredFtePlanned);
		expect(row.recommendedPositions).toBe(line.recommendedPositions);
		expect(row.coveredFte).toBe(line.coveredFte);
		expect(row.gapFte).toBe(line.gapFte);
		expect(row.coverageStatus).toBe(line.coverageStatus);
		expect(row.assignedStaffCount).toBe(line.assignedStaffCount);
		expect(row.directCostAnnual).toBe(line.directCostAnnual);
		expect(row.hsaCostAnnual).toBe(line.hsaCostAnnual);
	});

	it('computes band line count correctly for the subtotal', () => {
		const result = buildTeachingGridRows(SAMPLE_LINES);
		const matSubtotal = result.find((r) => r.rowType === 'subtotal' && r.band === 'MATERNELLE');
		expect(matSubtotal!.lineCount).toBe(2);
	});
});

// ── AC-07: filterTeachingRows — band and coverage filters ──────────────────

describe('filterTeachingRows', () => {
	const allRows: TeachingGridRow[] = SAMPLE_LINES.map((line) => ({
		rowType: 'requirement' as const,
		id: line.id,
		band: line.band,
		disciplineCode: line.disciplineCode,
		lineLabel: line.lineLabel,
		lineType: line.lineType,
		serviceProfileCode: line.serviceProfileCode,
		totalDriverUnits: line.totalDriverUnits,
		totalWeeklyHours: line.totalWeeklyHours,
		baseOrs: line.baseOrs,
		effectiveOrs: line.effectiveOrs,
		requiredFteRaw: line.requiredFteRaw,
		requiredFtePlanned: line.requiredFtePlanned,
		recommendedPositions: line.recommendedPositions,
		coveredFte: line.coveredFte,
		gapFte: line.gapFte,
		coverageStatus: line.coverageStatus,
		assignedStaffCount: line.assignedStaffCount,
		directCostAnnual: line.directCostAnnual,
		hsaCostAnnual: line.hsaCostAnnual,
	}));

	it('returns all rows when both filters are ALL', () => {
		const result = filterTeachingRows(allRows, 'ALL', 'ALL');
		expect(result).toHaveLength(5);
	});

	it('filters by band when band filter is set (MAT)', () => {
		const result = filterTeachingRows(allRows, 'MAT', 'ALL');
		expect(result).toHaveLength(2);
		expect(result.every((r) => r.band === 'MATERNELLE')).toBe(true);
	});

	it('filters by ELEM band correctly', () => {
		const result = filterTeachingRows(allRows, 'ELEM', 'ALL');
		expect(result).toHaveLength(1);
		expect(result[0]!.band).toBe('ELEMENTAIRE');
	});

	it('filters by COL band correctly', () => {
		const result = filterTeachingRows(allRows, 'COL', 'ALL');
		expect(result).toHaveLength(1);
		expect(result[0]!.band).toBe('COLLEGE');
	});

	it('filters by LYC band correctly', () => {
		const result = filterTeachingRows(allRows, 'LYC', 'ALL');
		expect(result).toHaveLength(1);
		expect(result[0]!.band).toBe('LYCEE');
	});

	it('filters by coverage status DEFICIT', () => {
		const result = filterTeachingRows(allRows, 'ALL', 'DEFICIT');
		expect(result).toHaveLength(1);
		expect(result[0]!.coverageStatus).toBe('DEFICIT');
	});

	it('filters by coverage status COVERED', () => {
		const result = filterTeachingRows(allRows, 'ALL', 'COVERED');
		expect(result).toHaveLength(2);
		expect(result.every((r) => r.coverageStatus === 'COVERED')).toBe(true);
	});

	it('filters by coverage status SURPLUS', () => {
		const result = filterTeachingRows(allRows, 'ALL', 'SURPLUS');
		expect(result).toHaveLength(1);
		expect(result[0]!.coverageStatus).toBe('SURPLUS');
	});

	it('filters by coverage status UNCOVERED', () => {
		const result = filterTeachingRows(allRows, 'ALL', 'UNCOVERED');
		expect(result).toHaveLength(1);
		expect(result[0]!.coverageStatus).toBe('UNCOVERED');
	});

	it('applies band and coverage filters additively', () => {
		const result = filterTeachingRows(allRows, 'MAT', 'DEFICIT');
		expect(result).toHaveLength(1);
		expect(result[0]!.band).toBe('MATERNELLE');
		expect(result[0]!.coverageStatus).toBe('DEFICIT');
	});

	it('returns empty array when no rows match combined filters', () => {
		const result = filterTeachingRows(allRows, 'LYC', 'DEFICIT');
		expect(result).toHaveLength(0);
	});

	it('returns empty array for empty input', () => {
		const result = filterTeachingRows([], 'ALL', 'ALL');
		expect(result).toHaveLength(0);
	});
});

// ── AC-08: Totals compute from requiredFteRaw, never recommendedPositions ──

describe('buildTeachingGridRows — subtotal computations (AC-08)', () => {
	it('subtotals compute from requiredFteRaw (continuous decimal), not recommendedPositions', () => {
		const lines: TeachingRequirementLine[] = [
			makeLine({
				id: 10,
				band: 'MATERNELLE',
				requiredFteRaw: '1.33',
				recommendedPositions: 2,
			}),
			makeLine({
				id: 11,
				band: 'MATERNELLE',
				requiredFteRaw: '0.67',
				recommendedPositions: 1,
			}),
		];

		const result = buildTeachingGridRows(lines);
		const matSubtotal = result.find((r) => r.rowType === 'subtotal' && r.band === 'MATERNELLE');

		expect(matSubtotal!.requiredFteRaw).toBe('2.00');
	});

	it('subtotals sum coveredFte and gapFte as well', () => {
		const lines: TeachingRequirementLine[] = [
			makeLine({
				id: 20,
				band: 'ELEMENTAIRE',
				coveredFte: '1.25',
				gapFte: '-0.75',
			}),
			makeLine({
				id: 21,
				band: 'ELEMENTAIRE',
				coveredFte: '2.00',
				gapFte: '0.25',
			}),
		];

		const result = buildTeachingGridRows(lines);
		const elemSubtotal = result.find((r) => r.rowType === 'subtotal' && r.band === 'ELEMENTAIRE');

		expect(elemSubtotal!.coveredFte).toBe('3.25');
		expect(elemSubtotal!.gapFte).toBe('-0.50');
	});
});
