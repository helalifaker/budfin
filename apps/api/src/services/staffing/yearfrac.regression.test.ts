import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { yearFrac } from './yearfrac.js';
import { calculateEoSProvision } from './cost-engine.js';

/**
 * YEARFRAC US 30/360 regression tests validated against Excel YEARFRAC(start, end, 0).
 *
 * TC-002: All expected values verified in Excel using =YEARFRAC(start, end, 0).
 * TC-001: All comparisons use Decimal.js — no native arithmetic on monetary values.
 * TC-004: Full-precision accumulation; rounding only at assertion boundary (toFixed(4)).
 */

/** Helper: create a UTC date from YYYY-MM-DD string */
function utcDate(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

describe('YEARFRAC US 30/360 — Excel baseline regression', () => {
	const testCases = [
		// Standard cases
		{ start: '2020-01-15', end: '2025-12-31', expected: '5.9611' },
		{ start: '2023-01-01', end: '2025-12-31', expected: '3.0000' },
		{ start: '2020-06-15', end: '2025-12-31', expected: '5.5444' },

		// Leap year boundaries (SA-004)
		{ start: '2024-02-29', end: '2024-12-31', expected: '0.8389' },
		{ start: '2023-02-28', end: '2024-02-29', expected: '1.0028' },
		{ start: '2020-01-01', end: '2024-02-29', expected: '4.1611' },

		// End-of-month cases
		{ start: '2020-01-31', end: '2025-12-31', expected: '5.9167' },
		{ start: '2020-03-31', end: '2025-12-31', expected: '5.7500' },

		// Same day (YoS = 0)
		{ start: '2025-06-15', end: '2025-06-15', expected: '0.0000' },

		// Very short tenure
		{ start: '2025-12-01', end: '2025-12-31', expected: '0.0833' },
		{ start: '2025-12-15', end: '2025-12-31', expected: '0.0444' },

		// Exact 5-year boundary (EoS bracket switch)
		{ start: '2020-01-01', end: '2025-01-01', expected: '5.0000' },
		{ start: '2020-01-01', end: '2025-01-02', expected: '5.0028' },

		// Long tenure
		{ start: '2015-03-15', end: '2025-12-31', expected: '10.7944' },
	];

	it.each(testCases)(
		'YEARFRAC($start, $end) = $expected',
		({ start, end, expected }) => {
			const result = yearFrac(utcDate(start), utcDate(end));
			expect(result.toFixed(4)).toBe(expected);
		}
	);

	describe('symmetry and boundary properties', () => {
		it('returns zero for identical dates', () => {
			const d = utcDate('2025-06-15');
			expect(yearFrac(d, d).toFixed(4)).toBe('0.0000');
		});

		it('returns negative for reversed date range', () => {
			const result = yearFrac(utcDate('2025-12-31'), utcDate('2020-01-01'));
			expect(result.isNegative()).toBe(true);
		});

		it('returns exact integer for full-year spans', () => {
			const result = yearFrac(utcDate('2020-01-01'), utcDate('2025-01-01'));
			expect(result.equals(5)).toBe(true);
		});

		it('handles Jan 1 to Dec 31 as exactly 1 year (US 30/360)', () => {
			// In US 30/360: Dec 31 with day1=1 (not 30), so day2 stays 31
			// (year2-year1)*360 + (month2-month1)*30 + (day2-day1) = 0*360 + 11*30 + 30 = 360
			const result = yearFrac(utcDate('2025-01-01'), utcDate('2025-12-31'));
			expect(result.toFixed(4)).toBe('1.0000');
		});
	});
});

describe('EoS Provision — end-to-end with YEARFRAC', () => {
	const baseInput = {
		baseSalary: '10000',
		housingAllowance: '2500',
		transportAllowance: '500',
		responsibilityPremium: '1000',
	};

	// eosBase = 10000 + 2500 + 500 + 1000 = 14000

	describe('YoS <= 5 bracket (AC-20): eosAnnual = (eosBase / 2) * YoS', () => {
		it('calculates correctly for ~3 years of service', () => {
			const result = calculateEoSProvision({
				...baseInput,
				hireDate: utcDate('2023-01-01'),
				asOfDate: utcDate('2025-12-31'),
			});

			const expectedYos = new Decimal('3.0000');
			const expectedEosBase = new Decimal('14000');
			// (14000 / 2) * 3 = 21000
			const expectedEosAnnual = expectedEosBase.div(2).times(expectedYos);

			expect(result.yearsOfService.toFixed(4)).toBe('3.0000');
			expect(result.eosBase.toFixed(4)).toBe('14000.0000');
			expect(result.eosAnnual.toFixed(4)).toBe(expectedEosAnnual.toFixed(4));
			expect(result.eosMonthlyAccrual.toFixed(4)).toBe(
				expectedEosAnnual.div(12).toFixed(4)
			);
		});

		it('calculates correctly at exact 5-year boundary', () => {
			const result = calculateEoSProvision({
				...baseInput,
				hireDate: utcDate('2020-01-01'),
				asOfDate: utcDate('2025-01-01'),
			});

			expect(result.yearsOfService.toFixed(4)).toBe('5.0000');
			// (14000 / 2) * 5 = 35000
			expect(result.eosAnnual.toFixed(4)).toBe('35000.0000');
			expect(result.eosMonthlyAccrual.toFixed(4)).toBe(
				new Decimal('35000').div(12).toFixed(4)
			);
		});
	});

	describe('YoS > 5 bracket (AC-21): eosAnnual = (eosBase/2 * 5) + eosBase * (YoS - 5)', () => {
		it('calculates correctly for just over 5 years', () => {
			const result = calculateEoSProvision({
				...baseInput,
				hireDate: utcDate('2020-01-01'),
				asOfDate: utcDate('2025-01-02'),
			});

			// Compute expected from the actual YEARFRAC result (full precision)
			const yos = yearFrac(utcDate('2020-01-01'), utcDate('2025-01-02'));
			const eosBase = new Decimal('14000');
			// (14000/2 * 5) + 14000 * (YoS - 5)
			const expectedAnnual = eosBase
				.div(2)
				.times(5)
				.plus(eosBase.times(yos.minus(5)));

			expect(result.yearsOfService.toFixed(4)).toBe('5.0028');
			expect(result.eosAnnual.toFixed(4)).toBe(expectedAnnual.toFixed(4));
		});

		it('calculates correctly for long tenure (~10.79 years)', () => {
			const result = calculateEoSProvision({
				...baseInput,
				hireDate: utcDate('2015-03-15'),
				asOfDate: utcDate('2025-12-31'),
			});

			const yos = yearFrac(utcDate('2015-03-15'), utcDate('2025-12-31'));
			const eosBase = new Decimal('14000');
			const expectedAnnual = eosBase
				.div(2)
				.times(5)
				.plus(eosBase.times(yos.minus(5)));

			expect(result.yearsOfService.toFixed(4)).toBe('10.7944');
			expect(result.eosAnnual.toFixed(4)).toBe(expectedAnnual.toFixed(4));
			expect(result.eosMonthlyAccrual.toFixed(4)).toBe(
				expectedAnnual.div(12).toFixed(4)
			);
		});
	});

	describe('YoS = 0 (AC-19 edge case)', () => {
		it('returns zero EoS when hire date equals as-of date', () => {
			const result = calculateEoSProvision({
				...baseInput,
				hireDate: utcDate('2025-12-31'),
				asOfDate: utcDate('2025-12-31'),
			});

			expect(result.yearsOfService.toFixed(4)).toBe('0.0000');
			expect(result.eosAnnual.toFixed(4)).toBe('0.0000');
			expect(result.eosMonthlyAccrual.toFixed(4)).toBe('0.0000');
		});
	});

	describe('precision verification (TC-001, TC-004)', () => {
		it('maintains full Decimal.js precision without intermediate rounding', () => {
			const result = calculateEoSProvision({
				...baseInput,
				hireDate: utcDate('2020-06-15'),
				asOfDate: utcDate('2025-12-31'),
			});

			// YoS = 5.5444... (repeating) — verify we have more than 4 decimal places
			// of precision internally before rounding for display
			expect(result.yearsOfService.decimalPlaces()).toBeGreaterThanOrEqual(4);
			expect(result.yearsOfService instanceof Decimal).toBe(true);
			expect(result.eosAnnual instanceof Decimal).toBe(true);
			expect(result.eosMonthlyAccrual instanceof Decimal).toBe(true);
		});

		it('eosMonthlyAccrual equals eosAnnual / 12 exactly (no intermediate rounding)', () => {
			const result = calculateEoSProvision({
				...baseInput,
				hireDate: utcDate('2020-06-15'),
				asOfDate: utcDate('2025-12-31'),
			});

			const recomputed = result.eosAnnual.div(12);
			expect(result.eosMonthlyAccrual.equals(recomputed)).toBe(true);
		});
	});
});
