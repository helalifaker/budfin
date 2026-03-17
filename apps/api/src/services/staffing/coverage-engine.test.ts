import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
	calculateCoverage,
	type CoverageAssignment,
	type CoverageEngineInput,
	type CoverageRequirementLine,
	type CoverageWarning,
	type CoverageWarningType,
} from './coverage-engine.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeLine(overrides: Partial<CoverageRequirementLine> = {}): CoverageRequirementLine {
	return {
		id: 1,
		band: 'COLLEGE',
		disciplineCode: 'FRANCAIS',
		lineType: 'STRUCTURAL',
		requiredFteRaw: new Decimal('1.5'),
		requiredFtePlanned: new Decimal('1.3'),
		coveredFte: new Decimal(0),
		gapFte: new Decimal(0),
		coverageStatus: 'UNCOVERED',
		assignedStaffCount: 0,
		vacancyCount: 0,
		...overrides,
	};
}

function makeAssignment(overrides: Partial<CoverageAssignment> = {}): CoverageAssignment {
	return {
		id: 1,
		employeeId: 100,
		band: 'COLLEGE',
		disciplineCode: 'FRANCAIS',
		hoursPerWeek: new Decimal('9'),
		fteShare: new Decimal('0.5'),
		employeeRecordType: 'EMPLOYEE',
		employeeStatus: 'Existing',
		employeeCostMode: 'LOCAL_PAYROLL',
		hourlyPercentage: new Decimal('1.0'),
		employeeName: 'Jean Dupont',
		...overrides,
	};
}

function warningsOfType(warnings: CoverageWarning[], type: CoverageWarningType): CoverageWarning[] {
	return warnings.filter((w) => w.type === type);
}

// ── Basic Coverage ──────────────────────────────────────────────────────────

describe('basic coverage', () => {
	it('AC-01: 1 line, 1 assignment -> COVERED', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('0.5') })],
			assignments: [makeAssignment({ fteShare: new Decimal('0.5') })],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		expect(result.updatedLines).toHaveLength(1);
		const line = result.updatedLines[0]!;
		expect(line.coveredFte.eq(new Decimal('0.5'))).toBe(true);
		expect(line.gapFte.eq(new Decimal('0'))).toBe(true);
		expect(line.coverageStatus).toBe('COVERED');
		expect(line.assignedStaffCount).toBe(1);
		expect(line.vacancyCount).toBe(0);
	});

	it('AC-02: coveredFte equals requiredFteRaw -> gapFte = 0 -> COVERED', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.5') })],
			assignments: [
				makeAssignment({ id: 1, employeeId: 100, fteShare: new Decimal('1.0') }),
				makeAssignment({
					id: 2,
					employeeId: 101,
					fteShare: new Decimal('0.5'),
					employeeName: 'Marie Curie',
				}),
			],
			allTeachingEmployeeIds: [100, 101],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.coveredFte.eq(new Decimal('1.5'))).toBe(true);
		expect(line.gapFte.eq(new Decimal('0'))).toBe(true);
		expect(line.coverageStatus).toBe('COVERED');
		expect(line.assignedStaffCount).toBe(2);
	});
});

// ── Deficit ─────────────────────────────────────────────────────────────────

describe('deficit coverage', () => {
	it('AC-03: coveredFte < requiredFteRaw by more than 0.25 -> DEFICIT', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('2.0') })],
			assignments: [makeAssignment({ fteShare: new Decimal('0.5') })],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		// gap = 0.5 - 2.0 = -1.5
		expect(line.gapFte.eq(new Decimal('-1.5'))).toBe(true);
		expect(line.coverageStatus).toBe('DEFICIT');
	});
});

// ── Surplus ─────────────────────────────────────────────────────────────────

describe('surplus coverage', () => {
	it('AC-03: coveredFte > requiredFteRaw by more than 0.25 -> SURPLUS', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [
				makeAssignment({ id: 1, employeeId: 100, fteShare: new Decimal('1.0') }),
				makeAssignment({
					id: 2,
					employeeId: 101,
					fteShare: new Decimal('0.5'),
					employeeName: 'Marie Curie',
				}),
			],
			allTeachingEmployeeIds: [100, 101],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		// gap = 1.5 - 1.0 = +0.5
		expect(line.gapFte.eq(new Decimal('0.5'))).toBe(true);
		expect(line.coverageStatus).toBe('SURPLUS');
	});
});

// ── Uncovered ───────────────────────────────────────────────────────────────

describe('uncovered', () => {
	it('AC-03: no assignments -> UNCOVERED', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [],
			allTeachingEmployeeIds: [],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.coveredFte.eq(new Decimal('0'))).toBe(true);
		expect(line.gapFte.eq(new Decimal('-1.0'))).toBe(true);
		expect(line.coverageStatus).toBe('UNCOVERED');
		expect(line.assignedStaffCount).toBe(0);
		expect(line.vacancyCount).toBe(0);
	});
});

// ── Threshold Boundaries ────────────────────────────────────────────────────

describe('threshold boundaries', () => {
	it('AC-03: gap = -0.25 exactly -> COVERED (not deficit)', () => {
		// requiredFteRaw = 1.0, coveredFte = 0.75 -> gap = -0.25
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [makeAssignment({ fteShare: new Decimal('0.75') })],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.gapFte.eq(new Decimal('-0.25'))).toBe(true);
		expect(line.coverageStatus).toBe('COVERED');
	});

	it('AC-03: gap = +0.25 exactly -> COVERED (not surplus)', () => {
		// requiredFteRaw = 1.0, coveredFte = 1.25 -> gap = +0.25
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [makeAssignment({ fteShare: new Decimal('1.25') })],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.gapFte.eq(new Decimal('0.25'))).toBe(true);
		expect(line.coverageStatus).toBe('COVERED');
	});

	it('AC-03: gap = -0.2501 -> DEFICIT', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [makeAssignment({ fteShare: new Decimal('0.7499') })],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.gapFte.eq(new Decimal('-0.2501'))).toBe(true);
		expect(line.coverageStatus).toBe('DEFICIT');
	});

	it('AC-03: gap = +0.2501 -> SURPLUS', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [makeAssignment({ fteShare: new Decimal('1.2501') })],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.gapFte.eq(new Decimal('0.2501'))).toBe(true);
		expect(line.coverageStatus).toBe('SURPLUS');
	});
});

// ── Over-Assigned Employee ──────────────────────────────────────────────────

describe('over-assigned employee', () => {
	it('AC-05: total fteShare > hourlyPercentage -> OVER_ASSIGNED warning', () => {
		const input: CoverageEngineInput = {
			requirementLines: [
				makeLine({
					id: 1,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					requiredFteRaw: new Decimal('1.0'),
				}),
				makeLine({
					id: 2,
					band: 'COLLEGE',
					disciplineCode: 'MATHEMATIQUES',
					requiredFteRaw: new Decimal('1.0'),
				}),
			],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('0.6'),
					hourlyPercentage: new Decimal('1.0'),
				}),
				makeAssignment({
					id: 2,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'MATHEMATIQUES',
					fteShare: new Decimal('0.5'),
					hourlyPercentage: new Decimal('1.0'),
				}),
			],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const overAssigned = warningsOfType(result.warnings, 'OVER_ASSIGNED');
		expect(overAssigned).toHaveLength(1);
		expect(overAssigned[0]!).toMatchObject({
			type: 'OVER_ASSIGNED',
			employeeId: 100,
		});
	});

	it('AC-05: total fteShare = hourlyPercentage exactly -> no warning', () => {
		const input: CoverageEngineInput = {
			requirementLines: [
				makeLine({
					id: 1,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					requiredFteRaw: new Decimal('0.5'),
				}),
				makeLine({
					id: 2,
					band: 'COLLEGE',
					disciplineCode: 'MATHEMATIQUES',
					requiredFteRaw: new Decimal('0.5'),
				}),
			],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('0.5'),
					hourlyPercentage: new Decimal('1.0'),
				}),
				makeAssignment({
					id: 2,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'MATHEMATIQUES',
					fteShare: new Decimal('0.5'),
					hourlyPercentage: new Decimal('1.0'),
				}),
			],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const overAssigned = warningsOfType(result.warnings, 'OVER_ASSIGNED');
		expect(overAssigned).toHaveLength(0);
	});
});

// ── Orphaned Assignment ─────────────────────────────────────────────────────

describe('orphaned assignment', () => {
	it('AC-06: assignment with no matching line -> ORPHANED_ASSIGNMENT warning', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ band: 'COLLEGE', disciplineCode: 'FRANCAIS' })],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('0.5'),
				}),
				makeAssignment({
					id: 2,
					employeeId: 101,
					band: 'LYCEE',
					disciplineCode: 'PHILOSOPHIE',
					fteShare: new Decimal('0.5'),
					employeeName: 'Sartre',
				}),
			],
			allTeachingEmployeeIds: [100, 101],
		};

		const result = calculateCoverage(input);

		const orphaned = warningsOfType(result.warnings, 'ORPHANED_ASSIGNMENT');
		expect(orphaned).toHaveLength(1);
		expect(orphaned[0]!).toMatchObject({
			type: 'ORPHANED_ASSIGNMENT',
			employeeId: 101,
			band: 'LYCEE',
			disciplineCode: 'PHILOSOPHIE',
		});

		// Orphaned assignment is excluded from coverage totals
		const line = result.updatedLines[0]!;
		expect(line.coveredFte.eq(new Decimal('0.5'))).toBe(true);
		expect(line.assignedStaffCount).toBe(1);
	});
});

// ── Departed Employee ───────────────────────────────────────────────────────

describe('departed employee', () => {
	it('AC-11: departed employees excluded from coverage, warning emitted', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					fteShare: new Decimal('0.5'),
					employeeStatus: 'Departed',
					employeeName: 'Departed Teacher',
				}),
				makeAssignment({
					id: 2,
					employeeId: 101,
					fteShare: new Decimal('0.3'),
					employeeStatus: 'Existing',
					employeeName: 'Active Teacher',
				}),
			],
			allTeachingEmployeeIds: [100, 101],
		};

		const result = calculateCoverage(input);

		// Only active employee counted
		const line = result.updatedLines[0]!;
		expect(line.coveredFte.eq(new Decimal('0.3'))).toBe(true);
		expect(line.assignedStaffCount).toBe(1);

		// Departed warning emitted
		const departedWarnings = warningsOfType(result.warnings, 'DEPARTED_WITH_ASSIGNMENTS');
		expect(departedWarnings).toHaveLength(1);
		expect(departedWarnings[0]!).toMatchObject({
			type: 'DEPARTED_WITH_ASSIGNMENTS',
			employeeId: 100,
		});
	});

	it('AC-11: multiple assignments for same departed employee -> one warning', () => {
		const input: CoverageEngineInput = {
			requirementLines: [
				makeLine({ id: 1, band: 'COLLEGE', disciplineCode: 'FRANCAIS' }),
				makeLine({ id: 2, band: 'COLLEGE', disciplineCode: 'MATHEMATIQUES' }),
			],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('0.5'),
					employeeStatus: 'Departed',
					employeeName: 'Departed One',
				}),
				makeAssignment({
					id: 2,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'MATHEMATIQUES',
					fteShare: new Decimal('0.5'),
					employeeStatus: 'Departed',
					employeeName: 'Departed One',
				}),
			],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const departedWarnings = warningsOfType(result.warnings, 'DEPARTED_WITH_ASSIGNMENTS');
		expect(departedWarnings).toHaveLength(1);
	});
});

// ── AEFE_RECHARGE Employee ──────────────────────────────────────────────────

describe('AEFE_RECHARGE employee', () => {
	it('AC-10: AEFE_RECHARGE counts toward coveredFte + RECHARGE_COVERAGE warning', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					fteShare: new Decimal('1.0'),
					employeeCostMode: 'AEFE_RECHARGE',
					employeeName: 'Recharge Teacher',
				}),
			],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.coveredFte.eq(new Decimal('1.0'))).toBe(true);
		expect(line.coverageStatus).toBe('COVERED');

		const rechargeWarnings = warningsOfType(result.warnings, 'RECHARGE_COVERAGE');
		expect(rechargeWarnings).toHaveLength(1);
		expect(rechargeWarnings[0]!).toMatchObject({
			type: 'RECHARGE_COVERAGE',
			employeeId: 100,
			band: 'COLLEGE',
			disciplineCode: 'FRANCAIS',
		});
	});

	it('AC-10: mixed LOCAL_PAYROLL and AEFE_RECHARGE on same line', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('2.0') })],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					fteShare: new Decimal('1.0'),
					employeeCostMode: 'LOCAL_PAYROLL',
					employeeName: 'Local Teacher',
				}),
				makeAssignment({
					id: 2,
					employeeId: 101,
					fteShare: new Decimal('1.0'),
					employeeCostMode: 'AEFE_RECHARGE',
					employeeName: 'Recharge Teacher',
				}),
			],
			allTeachingEmployeeIds: [100, 101],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.coveredFte.eq(new Decimal('2.0'))).toBe(true);
		expect(line.coverageStatus).toBe('COVERED');
		expect(line.assignedStaffCount).toBe(2);

		// Only recharge employee triggers warning
		const rechargeWarnings = warningsOfType(result.warnings, 'RECHARGE_COVERAGE');
		expect(rechargeWarnings).toHaveLength(1);
		expect(rechargeWarnings[0]!).toMatchObject({ employeeId: 101 });
	});
});

// ── Mixed Types (EMPLOYEE + VACANCY) ────────────────────────────────────────

describe('mixed record types', () => {
	it('AC-04: EMPLOYEE + VACANCY on same line -> correct counts', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('2.0') })],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					fteShare: new Decimal('1.0'),
					employeeRecordType: 'EMPLOYEE',
					employeeName: 'Real Teacher',
				}),
				makeAssignment({
					id: 2,
					employeeId: 200,
					fteShare: new Decimal('1.0'),
					employeeRecordType: 'VACANCY',
					employeeName: 'VAC-001',
				}),
			],
			allTeachingEmployeeIds: [100, 200],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.coveredFte.eq(new Decimal('2.0'))).toBe(true);
		expect(line.assignedStaffCount).toBe(1);
		expect(line.vacancyCount).toBe(1);
		expect(line.coverageStatus).toBe('COVERED');
	});
});

// ── Multiple Lines, Multiple Assignments ────────────────────────────────────

describe('multiple lines and assignments', () => {
	it('correct aggregation across multiple lines', () => {
		const input: CoverageEngineInput = {
			requirementLines: [
				makeLine({
					id: 1,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					requiredFteRaw: new Decimal('2.0'),
				}),
				makeLine({
					id: 2,
					band: 'COLLEGE',
					disciplineCode: 'MATHEMATIQUES',
					requiredFteRaw: new Decimal('1.5'),
				}),
				makeLine({
					id: 3,
					band: 'LYCEE',
					disciplineCode: 'PHYSIQUE',
					requiredFteRaw: new Decimal('1.0'),
				}),
			],
			assignments: [
				// Two teachers for FRANCAIS
				makeAssignment({
					id: 1,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('1.0'),
					employeeName: 'FR Teacher 1',
				}),
				makeAssignment({
					id: 2,
					employeeId: 101,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('0.8'),
					employeeName: 'FR Teacher 2',
				}),
				// One teacher for MATHEMATIQUES
				makeAssignment({
					id: 3,
					employeeId: 102,
					band: 'COLLEGE',
					disciplineCode: 'MATHEMATIQUES',
					fteShare: new Decimal('1.0'),
					employeeName: 'Math Teacher',
				}),
				// No assignments for PHYSIQUE -> UNCOVERED
			],
			allTeachingEmployeeIds: [100, 101, 102],
		};

		const result = calculateCoverage(input);

		expect(result.updatedLines).toHaveLength(3);

		// FRANCAIS: covered 1.8 of 2.0 -> gap = -0.2 -> COVERED (within threshold)
		const frLine = result.updatedLines.find((l) => l.disciplineCode === 'FRANCAIS')!;
		expect(frLine.coveredFte.eq(new Decimal('1.8'))).toBe(true);
		expect(frLine.gapFte.eq(new Decimal('-0.2'))).toBe(true);
		expect(frLine.coverageStatus).toBe('COVERED');
		expect(frLine.assignedStaffCount).toBe(2);

		// MATHEMATIQUES: covered 1.0 of 1.5 -> gap = -0.5 -> DEFICIT
		const mathLine = result.updatedLines.find((l) => l.disciplineCode === 'MATHEMATIQUES')!;
		expect(mathLine.coveredFte.eq(new Decimal('1.0'))).toBe(true);
		expect(mathLine.gapFte.eq(new Decimal('-0.5'))).toBe(true);
		expect(mathLine.coverageStatus).toBe('DEFICIT');
		expect(mathLine.assignedStaffCount).toBe(1);

		// PHYSIQUE: no assignments -> UNCOVERED
		const physLine = result.updatedLines.find((l) => l.disciplineCode === 'PHYSIQUE')!;
		expect(physLine.coveredFte.eq(new Decimal('0'))).toBe(true);
		expect(physLine.coverageStatus).toBe('UNCOVERED');
	});
});

// ── Unassigned Teacher ──────────────────────────────────────────────────────

describe('unassigned teacher', () => {
	it('AC-08: teaching employee with no assignments -> UNASSIGNED_TEACHER', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine()],
			assignments: [
				makeAssignment({
					employeeId: 100,
					fteShare: new Decimal('0.5'),
				}),
			],
			allTeachingEmployeeIds: [100, 200, 300],
		};

		const result = calculateCoverage(input);

		const unassigned = warningsOfType(result.warnings, 'UNASSIGNED_TEACHER');
		expect(unassigned).toHaveLength(2);

		const ids = unassigned.map((w) => w.employeeId);
		expect(ids).toContain(200);
		expect(ids).toContain(300);
	});

	it('AC-08: departed employee with assignments not flagged as unassigned', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine()],
			assignments: [
				makeAssignment({
					employeeId: 100,
					fteShare: new Decimal('0.5'),
					employeeStatus: 'Departed',
					employeeName: 'Departed One',
				}),
			],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		// Departed employee has assignments, so should NOT get UNASSIGNED_TEACHER
		const unassigned = warningsOfType(result.warnings, 'UNASSIGNED_TEACHER');
		expect(unassigned).toHaveLength(0);

		// But should get DEPARTED_WITH_ASSIGNMENTS
		const departed = warningsOfType(result.warnings, 'DEPARTED_WITH_ASSIGNMENTS');
		expect(departed).toHaveLength(1);
	});
});

// ── Empty Inputs ────────────────────────────────────────────────────────────

describe('empty inputs', () => {
	it('no lines, no assignments -> empty output, no warnings', () => {
		const input: CoverageEngineInput = {
			requirementLines: [],
			assignments: [],
			allTeachingEmployeeIds: [],
		};

		const result = calculateCoverage(input);

		expect(result.updatedLines).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it('lines but no assignments -> all UNCOVERED', () => {
		const input: CoverageEngineInput = {
			requirementLines: [
				makeLine({ id: 1, requiredFteRaw: new Decimal('1.0') }),
				makeLine({
					id: 2,
					band: 'LYCEE',
					disciplineCode: 'PHYSIQUE',
					requiredFteRaw: new Decimal('0.5'),
				}),
			],
			assignments: [],
			allTeachingEmployeeIds: [],
		};

		const result = calculateCoverage(input);

		expect(result.updatedLines).toHaveLength(2);
		for (const line of result.updatedLines) {
			expect(line.coverageStatus).toBe('UNCOVERED');
			expect(line.coveredFte.eq(new Decimal('0'))).toBe(true);
		}
	});

	it('assignments but no lines -> all orphaned', () => {
		const input: CoverageEngineInput = {
			requirementLines: [],
			assignments: [makeAssignment({ employeeId: 100, employeeName: 'Orphan Teacher' })],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		expect(result.updatedLines).toHaveLength(0);
		const orphaned = warningsOfType(result.warnings, 'ORPHANED_ASSIGNMENT');
		expect(orphaned).toHaveLength(1);
	});
});

// ── Decimal.js Precision ────────────────────────────────────────────────────

describe('TC-001: Decimal.js precision', () => {
	it('all output values are Decimal instances', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine()],
			assignments: [makeAssignment()],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		expect(line.coveredFte).toBeInstanceOf(Decimal);
		expect(line.gapFte).toBeInstanceOf(Decimal);
		expect(line.requiredFteRaw).toBeInstanceOf(Decimal);
		expect(line.requiredFtePlanned).toBeInstanceOf(Decimal);
	});

	it('accumulates precise fractional FTE values', () => {
		// Three assignments each 0.3333... FTE -> total should be exactly 0.9999
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [
				makeAssignment({ id: 1, employeeId: 100, fteShare: new Decimal('0.3333') }),
				makeAssignment({
					id: 2,
					employeeId: 101,
					fteShare: new Decimal('0.3333'),
					employeeName: 'B',
				}),
				makeAssignment({
					id: 3,
					employeeId: 102,
					fteShare: new Decimal('0.3333'),
					employeeName: 'C',
				}),
			],
			allTeachingEmployeeIds: [100, 101, 102],
		};

		const result = calculateCoverage(input);

		const line = result.updatedLines[0]!;
		// 0.3333 * 3 = 0.9999 exactly (no floating-point weirdness)
		expect(line.coveredFte.eq(new Decimal('0.9999'))).toBe(true);
		expect(line.gapFte.eq(new Decimal('-0.0001'))).toBe(true);
		expect(line.coverageStatus).toBe('COVERED'); // within threshold
	});
});

// ── Pure Function Properties ────────────────────────────────────────────────

describe('pure function', () => {
	it('produces deterministic output for same input', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine()],
			assignments: [makeAssignment()],
			allTeachingEmployeeIds: [100],
		};

		const result1 = calculateCoverage(input);
		const result2 = calculateCoverage(input);

		expect(result1.updatedLines.length).toBe(result2.updatedLines.length);
		expect(result1.updatedLines[0]!.coveredFte.eq(result2.updatedLines[0]!.coveredFte)).toBe(true);
		expect(result1.warnings.length).toBe(result2.warnings.length);
	});

	it('does not modify input arrays', () => {
		const lines = [makeLine()];
		const assignments = [makeAssignment()];
		const teacherIds = [100];

		const linesBefore = JSON.stringify(lines, (_, v) => (v instanceof Decimal ? v.toString() : v));
		const assignmentsBefore = JSON.stringify(assignments, (_, v) =>
			v instanceof Decimal ? v.toString() : v
		);
		const idsBefore = JSON.stringify(teacherIds);

		calculateCoverage({
			requirementLines: lines,
			assignments,
			allTeachingEmployeeIds: teacherIds,
		});

		expect(JSON.stringify(lines, (_, v) => (v instanceof Decimal ? v.toString() : v))).toBe(
			linesBefore
		);
		expect(JSON.stringify(assignments, (_, v) => (v instanceof Decimal ? v.toString() : v))).toBe(
			assignmentsBefore
		);
		expect(JSON.stringify(teacherIds)).toBe(idsBefore);
	});
});

// ── Over-Assigned Including Orphaned Assignments ────────────────────────────

describe('over-assigned with orphaned assignments', () => {
	it('orphaned assignments still count toward over-assigned check', () => {
		// Employee has 0.6 on a valid line + 0.6 on an orphaned line = 1.2 total > 1.0
		const input: CoverageEngineInput = {
			requirementLines: [
				makeLine({
					id: 1,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					requiredFteRaw: new Decimal('1.0'),
				}),
			],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('0.6'),
					hourlyPercentage: new Decimal('1.0'),
				}),
				makeAssignment({
					id: 2,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'NONEXISTENT',
					fteShare: new Decimal('0.6'),
					hourlyPercentage: new Decimal('1.0'),
				}),
			],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		// Should have ORPHANED_ASSIGNMENT for the nonexistent discipline
		const orphaned = warningsOfType(result.warnings, 'ORPHANED_ASSIGNMENT');
		expect(orphaned).toHaveLength(1);

		// Should have OVER_ASSIGNED since 0.6 + 0.6 = 1.2 > 1.0
		const overAssigned = warningsOfType(result.warnings, 'OVER_ASSIGNED');
		expect(overAssigned).toHaveLength(1);
		expect(overAssigned[0]!).toMatchObject({
			type: 'OVER_ASSIGNED',
			employeeId: 100,
		});
	});
});

// ── Part-Time Employee (hourlyPercentage < 1.0) ─────────────────────────────

describe('part-time employee', () => {
	it('respects hourlyPercentage for over-assigned check', () => {
		// Part-time employee: hourlyPercentage = 0.5, fteShare = 0.6 -> over-assigned
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('1.0') })],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					fteShare: new Decimal('0.6'),
					hourlyPercentage: new Decimal('0.5'),
				}),
			],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const overAssigned = warningsOfType(result.warnings, 'OVER_ASSIGNED');
		expect(overAssigned).toHaveLength(1);
	});

	it('part-time at exact capacity -> no over-assigned warning', () => {
		const input: CoverageEngineInput = {
			requirementLines: [makeLine({ requiredFteRaw: new Decimal('0.5') })],
			assignments: [
				makeAssignment({
					id: 1,
					employeeId: 100,
					fteShare: new Decimal('0.5'),
					hourlyPercentage: new Decimal('0.5'),
				}),
			],
			allTeachingEmployeeIds: [100],
		};

		const result = calculateCoverage(input);

		const overAssigned = warningsOfType(result.warnings, 'OVER_ASSIGNED');
		expect(overAssigned).toHaveLength(0);
	});
});

// ── Complex Scenario ────────────────────────────────────────────────────────

describe('complex multi-employee scenario', () => {
	it('handles mixed statuses, record types, cost modes, and orphans correctly', () => {
		const input: CoverageEngineInput = {
			requirementLines: [
				makeLine({
					id: 1,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					requiredFteRaw: new Decimal('2.0'),
				}),
				makeLine({
					id: 2,
					band: 'LYCEE',
					disciplineCode: 'MATHEMATIQUES',
					requiredFteRaw: new Decimal('1.0'),
				}),
			],
			assignments: [
				// Active EMPLOYEE on FRANCAIS
				makeAssignment({
					id: 1,
					employeeId: 100,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('1.0'),
					employeeRecordType: 'EMPLOYEE',
					employeeStatus: 'Existing',
					employeeCostMode: 'LOCAL_PAYROLL',
					employeeName: 'Active Local',
				}),
				// AEFE_RECHARGE on FRANCAIS
				makeAssignment({
					id: 2,
					employeeId: 101,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('0.5'),
					employeeRecordType: 'EMPLOYEE',
					employeeStatus: 'Existing',
					employeeCostMode: 'AEFE_RECHARGE',
					employeeName: 'Recharge Person',
				}),
				// VACANCY on FRANCAIS
				makeAssignment({
					id: 3,
					employeeId: 300,
					band: 'COLLEGE',
					disciplineCode: 'FRANCAIS',
					fteShare: new Decimal('0.5'),
					employeeRecordType: 'VACANCY',
					employeeStatus: 'New',
					employeeCostMode: 'LOCAL_PAYROLL',
					employeeName: 'VAC-001',
				}),
				// Departed on MATHEMATIQUES -> excluded
				makeAssignment({
					id: 4,
					employeeId: 200,
					band: 'LYCEE',
					disciplineCode: 'MATHEMATIQUES',
					fteShare: new Decimal('1.0'),
					employeeRecordType: 'EMPLOYEE',
					employeeStatus: 'Departed',
					employeeCostMode: 'LOCAL_PAYROLL',
					employeeName: 'Departed Math',
				}),
				// Orphaned assignment
				makeAssignment({
					id: 5,
					employeeId: 400,
					band: 'MATERNELLE',
					disciplineCode: 'ART',
					fteShare: new Decimal('0.5'),
					employeeRecordType: 'EMPLOYEE',
					employeeStatus: 'Existing',
					employeeCostMode: 'LOCAL_PAYROLL',
					employeeName: 'Orphan Art Teacher',
				}),
			],
			allTeachingEmployeeIds: [100, 101, 200, 300, 400, 500],
		};

		const result = calculateCoverage(input);

		// FRANCAIS: 1.0 + 0.5 + 0.5 = 2.0, gap = 0, COVERED
		const frLine = result.updatedLines.find((l) => l.disciplineCode === 'FRANCAIS')!;
		expect(frLine.coveredFte.eq(new Decimal('2.0'))).toBe(true);
		expect(frLine.gapFte.eq(new Decimal('0'))).toBe(true);
		expect(frLine.coverageStatus).toBe('COVERED');
		expect(frLine.assignedStaffCount).toBe(2); // 2 EMPLOYEEs
		expect(frLine.vacancyCount).toBe(1); // 1 VACANCY

		// MATHEMATIQUES: departed excluded -> 0 coverage, UNCOVERED
		const mathLine = result.updatedLines.find((l) => l.disciplineCode === 'MATHEMATIQUES')!;
		expect(mathLine.coveredFte.eq(new Decimal('0'))).toBe(true);
		expect(mathLine.coverageStatus).toBe('UNCOVERED');

		// Warnings check
		const recharge = warningsOfType(result.warnings, 'RECHARGE_COVERAGE');
		expect(recharge).toHaveLength(1);

		const departed = warningsOfType(result.warnings, 'DEPARTED_WITH_ASSIGNMENTS');
		expect(departed).toHaveLength(1);

		const orphaned = warningsOfType(result.warnings, 'ORPHANED_ASSIGNMENT');
		expect(orphaned).toHaveLength(1);

		// Employee 500 has no assignments -> UNASSIGNED_TEACHER
		const unassigned = warningsOfType(result.warnings, 'UNASSIGNED_TEACHER');
		expect(unassigned).toHaveLength(1);
		expect(unassigned[0]!).toMatchObject({ employeeId: 500 });
	});
});
