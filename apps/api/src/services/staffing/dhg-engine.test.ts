import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	calculateSectionsNeeded,
	calculateFTE,
	calculateDHG,
	type DhgGrilleRow,
} from './dhg-engine.js';

function makeGrilleRow(overrides: Partial<DhgGrilleRow> = {}): DhgGrilleRow {
	return {
		gradeLevel: 'CP',
		subject: 'Français',
		dhgType: 'Structural',
		hoursPerWeekPerSection: '8.00',
		...overrides,
	};
}

describe('calculateSectionsNeeded', () => {
	it('AC-09: CEILING(headcount / maxClassSize)', () => {
		expect(calculateSectionsNeeded(25, 28)).toBe(1);
		expect(calculateSectionsNeeded(28, 28)).toBe(1);
		expect(calculateSectionsNeeded(29, 28)).toBe(2);
		expect(calculateSectionsNeeded(56, 28)).toBe(2);
		expect(calculateSectionsNeeded(57, 28)).toBe(3);
	});

	it('AC-09: zero headcount returns 0 (not 1)', () => {
		expect(calculateSectionsNeeded(0, 28)).toBe(0);
	});

	it('SA-005: CEILING boundary — exact divisor', () => {
		expect(calculateSectionsNeeded(30, 30)).toBe(1);
		expect(calculateSectionsNeeded(31, 30)).toBe(2);
		expect(calculateSectionsNeeded(60, 30)).toBe(2);
	});

	it('negative headcount returns 0', () => {
		expect(calculateSectionsNeeded(-5, 28)).toBe(0);
	});
});

describe('calculateFTE', () => {
	it('AC-10: total_weekly_hours = SUM(hours * sections)', () => {
		const rows = [
			makeGrilleRow({ subject: 'Français', hoursPerWeekPerSection: '8.00' }),
			makeGrilleRow({ subject: 'Maths', hoursPerWeekPerSection: '5.00' }),
			makeGrilleRow({ subject: 'Sciences', hoursPerWeekPerSection: '3.00' }),
		];
		const result = calculateFTE(2, rows);
		// (8+5+3) * 2 = 32
		expect(result.totalWeeklyHours.toString()).toBe('32');
	});

	it('AC-10: total_annual_hours = weekly * 36', () => {
		const rows = [makeGrilleRow({ hoursPerWeekPerSection: '10.00' })];
		const result = calculateFTE(1, rows);
		expect(result.totalAnnualHours.toString()).toBe('360');
	});

	it('AC-10: fte = weekly / 18', () => {
		const rows = [makeGrilleRow({ hoursPerWeekPerSection: '18.00' })];
		const result = calculateFTE(1, rows);
		expect(result.fte.toString()).toBe('1');
	});

	it('fractional FTE', () => {
		const rows = [makeGrilleRow({ hoursPerWeekPerSection: '9.00' })];
		const result = calculateFTE(1, rows);
		expect(result.fte.toString()).toBe('0.5');
	});

	it('zero sections = zero FTE', () => {
		const rows = [makeGrilleRow({ hoursPerWeekPerSection: '10.00' })];
		const result = calculateFTE(0, rows);
		expect(result.totalWeeklyHours.toString()).toBe('0');
		expect(result.fte.toString()).toBe('0');
	});

	it('returns Decimal instances', () => {
		const result = calculateFTE(1, [makeGrilleRow()]);
		expect(result.totalWeeklyHours).toBeInstanceOf(Decimal);
		expect(result.totalAnnualHours).toBeInstanceOf(Decimal);
		expect(result.fte).toBeInstanceOf(Decimal);
	});
});

describe('calculateDHG', () => {
	it('AC-11: computes requirements for all grades', () => {
		const enrollments = [
			{ gradeLevel: 'CP', headcount: 25, maxClassSize: 28 },
			{ gradeLevel: 'CE1', headcount: 50, maxClassSize: 28 },
		];
		const grille = [
			makeGrilleRow({ gradeLevel: 'CP', subject: 'Français', hoursPerWeekPerSection: '8.00' }),
			makeGrilleRow({ gradeLevel: 'CP', subject: 'Maths', hoursPerWeekPerSection: '5.00' }),
			makeGrilleRow({ gradeLevel: 'CE1', subject: 'Français', hoursPerWeekPerSection: '7.00' }),
			makeGrilleRow({ gradeLevel: 'CE1', subject: 'Maths', hoursPerWeekPerSection: '5.00' }),
		];

		const results = calculateDHG(enrollments, grille);

		expect(results).toHaveLength(2);

		const cp = results.find((r) => r.gradeLevel === 'CP')!;
		expect(cp.sectionsNeeded).toBe(1);
		expect(cp.totalWeeklyHours.toString()).toBe('13'); // 8+5
		expect(cp.fte.toFixed(4)).toBe(new Decimal(13).div(18).toFixed(4));

		const ce1 = results.find((r) => r.gradeLevel === 'CE1')!;
		expect(ce1.sectionsNeeded).toBe(2);
		expect(ce1.totalWeeklyHours.toString()).toBe('24'); // (7+5)*2
	});

	it('SA-003: grade with 0 enrollment — no division by zero', () => {
		const enrollments = [{ gradeLevel: 'CP', headcount: 0, maxClassSize: 28 }];
		const grille = [makeGrilleRow({ gradeLevel: 'CP', hoursPerWeekPerSection: '10.00' })];

		const results = calculateDHG(enrollments, grille);
		expect(results[0]!.sectionsNeeded).toBe(0);
		expect(results[0]!.fte.toString()).toBe('0');
	});

	it('grade with no grille rows — zero FTE', () => {
		const enrollments = [{ gradeLevel: 'CP', headcount: 25, maxClassSize: 28 }];
		const results = calculateDHG(enrollments, []);
		expect(results[0]!.totalWeeklyHours.toString()).toBe('0');
		expect(results[0]!.fte.toString()).toBe('0');
	});
});
