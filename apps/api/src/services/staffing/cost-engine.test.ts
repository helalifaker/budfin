import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	calculateGOSI,
	calculateAjeer,
	calculateEoSProvision,
	calculateFullMonthlyCost,
	calculateEmployeeAnnualCost,
	type AjeerInput,
	type EosInput,
	type EmployeeCostInput,
} from './cost-engine.js';

function utcDate(y: number, m: number, d: number): Date {
	return new Date(Date.UTC(y, m - 1, d));
}

// ── GOSI ─────────────────────────────────────────────────────────────────────

describe('calculateGOSI', () => {
	it('AC-15: Saudi employee — 11.75% of gross', () => {
		const result = calculateGOSI(new Decimal('15000'), true);
		expect(result.toString()).toBe('1762.5');
	});

	it('AC-15: non-Saudi employee — 0', () => {
		const result = calculateGOSI(new Decimal('15000'), false);
		expect(result.toString()).toBe('0');
	});

	it('returns Decimal', () => {
		expect(calculateGOSI(new Decimal('10000'), true)).toBeInstanceOf(Decimal);
	});
});

// ── Ajeer ────────────────────────────────────────────────────────────────────

describe('calculateAjeer', () => {
	const makeAjeer = (overrides: Partial<AjeerInput> = {}): AjeerInput => ({
		isAjeer: true,
		isSaudi: false,
		status: 'Existing',
		ajeerAnnualFee: '10925.0000',
		...overrides,
	});

	it('AC-16: existing non-Saudi — all 12 months', () => {
		const input = makeAjeer();
		const expected = new Decimal('10925').div(12);
		for (let month = 1; month <= 12; month++) {
			const result = calculateAjeer(input, month);
			expect(result.toFixed(4)).toBe(expected.toFixed(4));
		}
	});

	it('AC-17: new non-Saudi — only months 9-12', () => {
		const input = makeAjeer({ status: 'New' });
		const expected = new Decimal('10925').div(12);
		for (let month = 1; month <= 8; month++) {
			expect(calculateAjeer(input, month).toString()).toBe('0');
		}
		for (let month = 9; month <= 12; month++) {
			expect(calculateAjeer(input, month).toFixed(4)).toBe(expected.toFixed(4));
		}
	});

	it('AC-18: Saudi employee — 0 regardless of status', () => {
		const saudiExisting = makeAjeer({ isSaudi: true, status: 'Existing' });
		const saudiNew = makeAjeer({ isSaudi: true, status: 'New' });
		expect(calculateAjeer(saudiExisting, 6).toString()).toBe('0');
		expect(calculateAjeer(saudiNew, 10).toString()).toBe('0');
	});

	it('non-Ajeer employee — 0', () => {
		const input = makeAjeer({ isAjeer: false });
		expect(calculateAjeer(input, 6).toString()).toBe('0');
	});
});

// ── EoS Provision ────────────────────────────────────────────────────────────

describe('calculateEoSProvision (incremental)', () => {
	// Use Dec 31 as asOfDate to match real usage (fiscal year end)
	const makeEos = (overrides: Partial<EosInput> = {}): EosInput => ({
		baseSalary: '10000.0000',
		housingAllowance: '2500.0000',
		transportAllowance: '500.0000',
		responsibilityPremium: '1000.0000',
		hireDate: utcDate(2020, 1, 1),
		asOfDate: utcDate(2025, 12, 31),
		...overrides,
	});

	it('AC-19: uses YEARFRAC US 30/360 for YoS', () => {
		const result = calculateEoSProvision(makeEos());
		// yearFrac(2020-01-01, 2025-12-31) = ((2025-2020)*360 + 330 + 30)/360 = 2160/360 = 6
		expect(result.yearsOfService.toString()).toBe('6');
	});

	it('AC-20: YoS <= 5 — incremental annual provision = eosBase/2', () => {
		const input = makeEos({
			hireDate: utcDate(2023, 1, 1),
			asOfDate: utcDate(2025, 12, 31), // YoS at end = 3 years
		});
		const result = calculateEoSProvision(input);
		// eosBase = 14000
		// cumEOS at 2025-12-31: YoS=3 -> 14000/2 * 3 = 21000
		// cumEOS at 2024-12-31: YoS=2 -> 14000/2 * 2 = 14000
		// Annual provision = 21000 - 14000 = 7000
		expect(result.eosBase.toString()).toBe('14000');
		expect(result.eosAnnual.toString()).toBe('7000');
		expect(result.eosMonthlyAccrual.toFixed(4)).toBe(new Decimal(7000).div(12).toFixed(4));
	});

	it('AC-20: crossing 5-year boundary — blend of rates', () => {
		const input = makeEos({
			hireDate: utcDate(2020, 7, 1),
			asOfDate: utcDate(2025, 12, 31), // YoS at end ~5.5
		});
		const result = calculateEoSProvision(input);
		// Verifies EOS base excludes HSA
		expect(result.eosBase.toString()).toBe('14000');
		// Cumulative at end > cumulative at start — positive provision
		expect(result.eosAnnual.gt(0)).toBe(true);
	});

	it('AC-21: YoS > 5 — incremental annual provision = eosBase', () => {
		const input = makeEos({
			hireDate: utcDate(2017, 1, 1),
			asOfDate: utcDate(2025, 12, 31), // YoS at end = 9 years
		});
		const result = calculateEoSProvision(input);
		// eosBase = 14000
		// cumEOS at 2025-12-31: YoS=9 -> 35000 + 14000*4 = 91000
		// cumEOS at 2024-12-31: YoS=8 -> 35000 + 14000*3 = 77000
		// Annual provision = 91000 - 77000 = 14000
		expect(result.eosAnnual.toString()).toBe('14000');
		expect(result.eosMonthlyAccrual.toFixed(4)).toBe(new Decimal(14000).div(12).toFixed(4));
	});

	it('HSA excluded from EoS base', () => {
		const result = calculateEoSProvision(makeEos());
		expect(result.eosBase.toString()).toBe('14000');
	});

	it('negative YoS (future hire) returns 0', () => {
		const input = makeEos({
			hireDate: utcDate(2026, 7, 1),
			asOfDate: utcDate(2025, 12, 31),
		});
		const result = calculateEoSProvision(input);
		expect(result.eosAnnual.toString()).toBe('0');
	});
});

// ── Full Monthly Cost ────────────────────────────────────────────────────────

describe('calculateFullMonthlyCost', () => {
	const makeEmployee = (overrides: Partial<EmployeeCostInput> = {}): EmployeeCostInput => ({
		baseSalary: '10000.0000',
		housingAllowance: '2500.0000',
		transportAllowance: '500.0000',
		responsibilityPremium: '1000.0000',
		hsaAmount: '1500.0000',
		augmentation: '0.0300',
		isTeaching: false,
		isSaudi: true,
		isAjeer: false,
		status: 'Existing',
		ajeerAnnualFee: '0.0000',
		hireDate: utcDate(2020, 1, 1),
		asOfDate: utcDate(2025, 1, 1),
		...overrides,
	});

	it('AC-22: total = adjusted_gross + gosi + ajeer + eos', () => {
		const input = makeEmployee();
		const eos = calculateEoSProvision({
			baseSalary: input.baseSalary,
			housingAllowance: input.housingAllowance,
			transportAllowance: input.transportAllowance,
			responsibilityPremium: input.responsibilityPremium,
			hireDate: input.hireDate,
			asOfDate: input.asOfDate,
		});
		const monthlyEos = eos.eosMonthlyAccrual;
		const result = calculateFullMonthlyCost(input, 1, monthlyEos);

		const expected = result.adjustedGross
			.plus(result.gosiAmount)
			.plus(result.ajeerAmount)
			.plus(result.eosMonthlyAccrual);
		expect(result.totalCost.toString()).toBe(expected.toString());
	});

	it('Saudi employee in January: gross + GOSI + EoS (no Ajeer)', () => {
		const input = makeEmployee({ isSaudi: true, isAjeer: false });
		const eos = calculateEoSProvision({
			baseSalary: input.baseSalary,
			housingAllowance: input.housingAllowance,
			transportAllowance: input.transportAllowance,
			responsibilityPremium: input.responsibilityPremium,
			hireDate: input.hireDate,
			asOfDate: input.asOfDate,
		});
		const monthlyEos = eos.eosMonthlyAccrual;
		const result = calculateFullMonthlyCost(input, 1, monthlyEos);

		expect(result.gosiAmount.gt(0)).toBe(true);
		expect(result.ajeerAmount.toString()).toBe('0');
	});
});

// ── Annual Cost ──────────────────────────────────────────────────────────────

describe('calculateEmployeeAnnualCost', () => {
	const makeAnnualInput = (overrides: Partial<EmployeeCostInput> = {}): EmployeeCostInput => ({
		baseSalary: '10000.0000',
		housingAllowance: '2500.0000',
		transportAllowance: '500.0000',
		responsibilityPremium: '1000.0000',
		hsaAmount: '1500.0000',
		augmentation: '0.0300',
		isTeaching: true,
		isSaudi: false,
		isAjeer: true,
		status: 'Existing',
		ajeerAnnualFee: '10925.0000',
		hireDate: utcDate(2020, 1, 1),
		asOfDate: utcDate(2025, 12, 31),
		...overrides,
	});

	it('returns 12 months', () => {
		const { months, eos } = calculateEmployeeAnnualCost(makeAnnualInput());

		expect(months).toHaveLength(12);
		expect(months[0]!.month).toBe(1);
		expect(months[11]!.month).toBe(12);
		// yearFrac(2020-01-01, 2025-12-31) = 6
		expect(eos.yearsOfService.toString()).toBe('6');
	});

	it('September costs are higher than August (augmentation)', () => {
		const { months } = calculateEmployeeAnnualCost(
			makeAnnualInput({
				augmentation: '0.0500', // 5%
				isTeaching: false,
				isSaudi: false,
				isAjeer: false,
				ajeerAnnualFee: '0.0000',
			})
		);
		const aug = months[7]!; // month 8
		const sep = months[8]!; // month 9
		expect(sep.totalCost.gt(aug.totalCost)).toBe(true);
	});

	it('all values are Decimal', () => {
		const { months } = calculateEmployeeAnnualCost(
			makeAnnualInput({
				housingAllowance: '0.0000',
				transportAllowance: '0.0000',
				responsibilityPremium: '0.0000',
				hsaAmount: '0.0000',
				augmentation: '0.0000',
				isTeaching: false,
				isSaudi: false,
				isAjeer: false,
				ajeerAnnualFee: '0.0000',
				hireDate: utcDate(2023, 1, 1),
			})
		);
		for (const m of months) {
			expect(m.totalCost).toBeInstanceOf(Decimal);
			expect(m.adjustedGross).toBeInstanceOf(Decimal);
			expect(m.gosiAmount).toBeInstanceOf(Decimal);
		}
	});

	// ── costMode: LOCAL_PAYROLL (default, AC-12) ────────────────────────────

	it('AC-12: LOCAL_PAYROLL — existing behavior when costMode omitted', () => {
		const { months, eos } = calculateEmployeeAnnualCost(makeAnnualInput());
		expect(months).toHaveLength(12);
		expect(eos.yearsOfService.gt(0)).toBe(true);
		// Every month has positive totalCost
		for (const m of months) {
			expect(m.totalCost.gt(0)).toBe(true);
		}
	});

	it('AC-12: LOCAL_PAYROLL — explicit costMode matches omitted', () => {
		const withoutMode = calculateEmployeeAnnualCost(makeAnnualInput());
		const withMode = calculateEmployeeAnnualCost(makeAnnualInput({ costMode: 'LOCAL_PAYROLL' }));
		expect(withMode.months).toHaveLength(withoutMode.months.length);
		for (let i = 0; i < 12; i++) {
			expect(withMode.months[i]!.totalCost.toString()).toBe(
				withoutMode.months[i]!.totalCost.toString()
			);
		}
	});

	// ── costMode: AEFE_RECHARGE (AC-10) ─────────────────────────────────────

	it('AC-10: AEFE_RECHARGE — returns 12 zero-cost monthly rows', () => {
		const { months, eos } = calculateEmployeeAnnualCost(
			makeAnnualInput({ costMode: 'AEFE_RECHARGE' })
		);
		expect(months).toHaveLength(12);
		for (const m of months) {
			expect(m.totalCost.toString()).toBe('0');
			expect(m.adjustedGross.toString()).toBe('0');
			expect(m.baseGross.toString()).toBe('0');
			expect(m.gosiAmount.toString()).toBe('0');
			expect(m.ajeerAmount.toString()).toBe('0');
			expect(m.eosMonthlyAccrual.toString()).toBe('0');
			expect(m.hsaAmount.toString()).toBe('0');
			expect(m.housingAllowance.toString()).toBe('0');
			expect(m.transportAllowance.toString()).toBe('0');
			expect(m.responsibilityPremium.toString()).toBe('0');
		}
		// EoS is also zero
		expect(eos.eosAnnual.toString()).toBe('0');
		expect(eos.yearsOfService.toString()).toBe('0');
	});

	it('AC-10: AEFE_RECHARGE — months are numbered 1-12', () => {
		const { months } = calculateEmployeeAnnualCost(makeAnnualInput({ costMode: 'AEFE_RECHARGE' }));
		for (let i = 0; i < 12; i++) {
			expect(months[i]!.month).toBe(i + 1);
		}
	});

	it('AC-10: AEFE_RECHARGE — zero-cost values are Decimal instances', () => {
		const { months } = calculateEmployeeAnnualCost(makeAnnualInput({ costMode: 'AEFE_RECHARGE' }));
		for (const m of months) {
			expect(m.totalCost).toBeInstanceOf(Decimal);
			expect(m.adjustedGross).toBeInstanceOf(Decimal);
		}
	});

	// ── costMode: NO_LOCAL_COST (AC-11) ─────────────────────────────────────

	it('AC-11: NO_LOCAL_COST — returns empty months array', () => {
		const { months, eos } = calculateEmployeeAnnualCost(
			makeAnnualInput({ costMode: 'NO_LOCAL_COST' })
		);
		expect(months).toHaveLength(0);
		expect(eos.eosAnnual.toString()).toBe('0');
		expect(eos.yearsOfService.toString()).toBe('0');
	});

	it('AC-11: NO_LOCAL_COST — no output rows at all', () => {
		const { months } = calculateEmployeeAnnualCost(
			makeAnnualInput({
				costMode: 'NO_LOCAL_COST',
				baseSalary: '50000.0000', // high salary to verify it is truly skipped
			})
		);
		expect(months).toHaveLength(0);
	});
});
