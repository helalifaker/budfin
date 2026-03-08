import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { yearFrac } from './yearfrac.js';

function utcDate(y: number, m: number, d: number): Date {
	return new Date(Date.UTC(y, m - 1, d));
}

describe('yearFrac — US 30/360 (Excel YEARFRAC basis 0)', () => {
	describe('AC-30: exact match with Excel YEARFRAC(start, end, 0)', () => {
		it('exact 5 years: 2020-01-01 to 2025-01-01', () => {
			const result = yearFrac(utcDate(2020, 1, 1), utcDate(2025, 1, 1));
			expect(result.toFixed(10)).toBe('5.0000000000');
		});

		it('exact 5 years mid-month: 2020-01-15 to 2025-01-15', () => {
			const result = yearFrac(utcDate(2020, 1, 15), utcDate(2025, 1, 15));
			expect(result.toFixed(10)).toBe('5.0000000000');
		});

		it('5 years + 5.5 months: 2020-01-01 to 2025-06-15', () => {
			// (5*360 + 5*30 + 14) / 360 = 1964/360
			const result = yearFrac(utcDate(2020, 1, 1), utcDate(2025, 6, 15));
			expect(result.toDecimalPlaces(10).toString()).toBe(
				new Decimal(1964).div(360).toDecimalPlaces(10).toString()
			);
		});

		it('month-end Jan to Feb: day1=31 adjusted to 30', () => {
			// 2020-01-31 -> day1=31->30, 2020-02-28 -> day2=28
			// (0*360 + 1*30 + (28-30)) / 360 = 28/360
			const result = yearFrac(utcDate(2020, 1, 31), utcDate(2020, 2, 28));
			expect(result.toFixed(10)).toBe(new Decimal(28).div(360).toFixed(10));
		});

		it('both day-31: 2020-01-31 to 2020-03-31', () => {
			// day1=31->30, day2=31->30 (because day1>=30)
			// (0*360 + 2*30 + 0) / 360 = 60/360
			const result = yearFrac(utcDate(2020, 1, 31), utcDate(2020, 3, 31));
			expect(result.toFixed(10)).toBe(new Decimal(60).div(360).toFixed(10));
		});

		it('day1=30, day2=31: day2 adjusted to 30', () => {
			// 2020-01-30 -> day1=30, 2020-03-31 -> day2=31->30 (day1>=30)
			// (0*360 + 2*30 + 0) / 360 = 60/360
			const result = yearFrac(utcDate(2020, 1, 30), utcDate(2020, 3, 31));
			expect(result.toFixed(10)).toBe(new Decimal(60).div(360).toFixed(10));
		});

		it('day1=29, day2=31: day2 NOT adjusted (day1 < 30)', () => {
			// 2020-01-29 -> day1=29, 2020-03-31 -> day2=31 stays (day1<30)
			// (0*360 + 2*30 + (31-29)) / 360 = 62/360
			const result = yearFrac(utcDate(2020, 1, 29), utcDate(2020, 3, 31));
			expect(result.toFixed(10)).toBe(new Decimal(62).div(360).toFixed(10));
		});

		it('leap year boundary: 2020-02-29 to 2021-02-28', () => {
			// day1=29, day2=28
			// (1*360 + 0*30 + (28-29)) / 360 = 359/360
			const result = yearFrac(utcDate(2020, 2, 29), utcDate(2021, 2, 28));
			expect(result.toFixed(10)).toBe(new Decimal(359).div(360).toFixed(10));
		});

		it('same date returns 0', () => {
			const result = yearFrac(utcDate(2020, 1, 1), utcDate(2020, 1, 1));
			expect(result.toFixed(10)).toBe('0.0000000000');
		});

		it('cross-year: 2019-09-01 to 2025-01-01', () => {
			// (6*360 + (-8)*30 + 0) / 360 = 1920/360
			const result = yearFrac(utcDate(2019, 9, 1), utcDate(2025, 1, 1));
			expect(result.toFixed(10)).toBe(new Decimal(1920).div(360).toFixed(10));
		});

		it('long span: 2018-03-15 to 2025-09-30', () => {
			// day1=15, day2=30
			// (7*360 + 6*30 + 15) / 360 = 2715/360
			const result = yearFrac(utcDate(2018, 3, 15), utcDate(2025, 9, 30));
			expect(result.toFixed(10)).toBe(new Decimal(2715).div(360).toFixed(10));
		});
	});

	describe('AC-28: return type is Decimal', () => {
		it('returns a Decimal instance', () => {
			const result = yearFrac(utcDate(2020, 1, 1), utcDate(2025, 1, 1));
			expect(result).toBeInstanceOf(Decimal);
		});
	});

	describe('edge cases', () => {
		it('start after end returns negative value', () => {
			const result = yearFrac(utcDate(2025, 1, 1), utcDate(2020, 1, 1));
			expect(result.isNeg()).toBe(true);
			expect(result.toFixed(10)).toBe('-5.0000000000');
		});

		it('one day difference: 2020-01-01 to 2020-01-02', () => {
			// (0*360 + 0*30 + 1) / 360 = 1/360
			const result = yearFrac(utcDate(2020, 1, 1), utcDate(2020, 1, 2));
			expect(result.toFixed(10)).toBe(new Decimal(1).div(360).toFixed(10));
		});

		it('Feb 28 non-leap to Mar 1', () => {
			// 2023-02-28 -> day1=28, 2023-03-01 -> day2=1
			// (0*360 + 1*30 + (1-28)) / 360 = 3/360
			const result = yearFrac(utcDate(2023, 2, 28), utcDate(2023, 3, 1));
			expect(result.toFixed(10)).toBe(new Decimal(3).div(360).toFixed(10));
		});
	});
});
