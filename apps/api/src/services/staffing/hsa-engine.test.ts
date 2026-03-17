import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { calculateHsa, type HsaInput } from './hsa-engine.js';

function makeHsaInput(overrides: Partial<HsaInput> = {}): HsaInput {
	return {
		hsaTargetHours: new Decimal('1.5'),
		hsaFirstHourRate: new Decimal('500'),
		hsaAdditionalHourRate: new Decimal('400'),
		hsaMonths: 10,
		...overrides,
	};
}

describe('calculateHsa', () => {
	// AC-08: default values — 500 + max(0, 1.5-1)*400 = 700/month, 7000/year
	it('AC-08: default values — 700 SAR/month, 7000 SAR/year', () => {
		const result = calculateHsa(makeHsaInput());
		expect(result.hsaCostPerMonth.toString()).toBe('700');
		expect(result.hsaAnnualPerTeacher.toString()).toBe('7000');
	});

	it('custom first/additional hour rates', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaFirstHourRate: new Decimal('600'),
				hsaAdditionalHourRate: new Decimal('300'),
			})
		);
		// 600 + max(0, 1.5-1)*300 = 600 + 150 = 750/month
		expect(result.hsaCostPerMonth.toString()).toBe('750');
		// 750 * 10 = 7500/year
		expect(result.hsaAnnualPerTeacher.toString()).toBe('7500');
	});

	it('hsaTargetHours = 0 — only first hour rate applies (additional = 0)', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaTargetHours: new Decimal('0'),
			})
		);
		// max(0, 0-1) = 0, so additional = 0
		// costPerMonth = 500 + 0 = 500
		expect(result.hsaCostPerMonth.toString()).toBe('500');
		expect(result.hsaAnnualPerTeacher.toString()).toBe('5000');
	});

	it('hsaTargetHours = 1 — exactly 1 hour, no additional cost', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaTargetHours: new Decimal('1'),
			})
		);
		// max(0, 1-1) = 0, so additional = 0
		// costPerMonth = 500 + 0 = 500
		expect(result.hsaCostPerMonth.toString()).toBe('500');
		expect(result.hsaAnnualPerTeacher.toString()).toBe('5000');
	});

	it('hsaTargetHours = 3 — 500 + 2*400 = 1300/month', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaTargetHours: new Decimal('3'),
			})
		);
		// max(0, 3-1) = 2, additional = 2*400 = 800
		// costPerMonth = 500 + 800 = 1300
		expect(result.hsaCostPerMonth.toString()).toBe('1300');
		expect(result.hsaAnnualPerTeacher.toString()).toBe('13000');
	});

	it('hsaMonths = 12 — full year', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaMonths: 12,
			})
		);
		// costPerMonth = 700 (unchanged)
		// annual = 700 * 12 = 8400
		expect(result.hsaCostPerMonth.toString()).toBe('700');
		expect(result.hsaAnnualPerTeacher.toString()).toBe('8400');
	});

	it('hsaTargetHours fractional (0.5) — max(0, 0.5-1) = 0', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaTargetHours: new Decimal('0.5'),
			})
		);
		// max(0, -0.5) = 0, additional = 0
		// costPerMonth = 500
		expect(result.hsaCostPerMonth.toString()).toBe('500');
		expect(result.hsaAnnualPerTeacher.toString()).toBe('5000');
	});

	it('precision: Decimal.js precision preserved (TC-001)', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaTargetHours: new Decimal('2.333'),
				hsaFirstHourRate: new Decimal('500.50'),
				hsaAdditionalHourRate: new Decimal('333.33'),
			})
		);
		// additional = max(0, 2.333 - 1) = 1.333
		// additionalCost = 1.333 * 333.33 = 444.33489
		// costPerMonth = 500.50 + 444.33489 = 944.83489
		const expectedMonthly = new Decimal('500.50').plus(
			new Decimal('1.333').times(new Decimal('333.33'))
		);
		expect(result.hsaCostPerMonth.toString()).toBe(expectedMonthly.toString());
		expect(result.hsaCostPerMonth).toBeInstanceOf(Decimal);
		expect(result.hsaAnnualPerTeacher).toBeInstanceOf(Decimal);
	});

	it('returns Decimal instances (TC-001)', () => {
		const result = calculateHsa(makeHsaInput());
		expect(result.hsaCostPerMonth).toBeInstanceOf(Decimal);
		expect(result.hsaAnnualPerTeacher).toBeInstanceOf(Decimal);
	});

	it('zero rates — everything is zero', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaFirstHourRate: new Decimal('0'),
				hsaAdditionalHourRate: new Decimal('0'),
			})
		);
		expect(result.hsaCostPerMonth.toString()).toBe('0');
		expect(result.hsaAnnualPerTeacher.toString()).toBe('0');
	});

	it('hsaMonths = 0 — annual is zero even with positive monthly', () => {
		const result = calculateHsa(
			makeHsaInput({
				hsaMonths: 0,
			})
		);
		expect(result.hsaCostPerMonth.toString()).toBe('700');
		expect(result.hsaAnnualPerTeacher.toString()).toBe('0');
	});
});
