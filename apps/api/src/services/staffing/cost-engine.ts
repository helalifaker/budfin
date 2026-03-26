import { Decimal } from 'decimal.js';
import { yearFrac } from './yearfrac.js';
import { calculateMonthlyGross, type MonthlyGrossInput } from './monthly-gross.js';

// ── GOSI (AC-15) ────────────────────────────────────────────────────────────

const GOSI_RATE = new Decimal('0.1175'); // 11.75%

export function calculateGOSI(fullMonthlyGross: Decimal, isSaudi: boolean): Decimal {
	if (!isSaudi) return new Decimal(0);
	return fullMonthlyGross.times(GOSI_RATE);
}

// ── Ajeer (AC-16, AC-17, AC-18) ─────────────────────────────────────────────

export interface AjeerInput {
	isAjeer: boolean;
	isSaudi: boolean;
	status: 'Existing' | 'New' | 'Departed';
	ajeerAnnualFee: string; // decimal string — single global fee from settings
}

export function calculateAjeer(input: AjeerInput, month: number): Decimal {
	// AC-18: Saudi employees pay no Ajeer
	if (input.isSaudi) return new Decimal(0);
	if (!input.isAjeer) return new Decimal(0);

	// AC-17: New staff only pay Sep-Dec (months 9-12)
	if (input.status === 'New' && month < 9) return new Decimal(0);

	// AC-16: existing staff pay all 12 months
	return new Decimal(input.ajeerAnnualFee).div(12);
}

// ── End-of-Service (AC-19, AC-20, AC-21) ─────────────────────────────────────

export interface EosInput {
	baseSalary: string;
	housingAllowance: string;
	transportAllowance: string;
	responsibilityPremium: string;
	hireDate: Date;
	asOfDate: Date;
}

export interface EosOutput {
	yearsOfService: Decimal;
	eosBase: Decimal;
	eosAnnual: Decimal;
	eosMonthlyAccrual: Decimal;
}

/**
 * Compute the cumulative EOS liability at a point in time given eosBase and YoS.
 */
export function computeCumulativeEos(eosBase: Decimal, yos: Decimal): Decimal {
	if (yos.lte(0)) return new Decimal(0);
	if (yos.lte(5)) {
		return eosBase.div(2).times(yos);
	}
	return eosBase
		.div(2)
		.times(5)
		.plus(eosBase.times(yos.minus(5)));
}

/**
 * Calculate the annual EOS provision as the incremental liability accrued
 * during the fiscal year (sum of monthly increments).
 *
 * For each month, we compute the cumulative EOS at month-end minus the
 * cumulative EOS at the previous month-end. The sum of these increments
 * is the FY provision. This matches the Excel methodology.
 */
export function calculateEoSProvision(input: EosInput): EosOutput {
	const fiscalYear = input.asOfDate.getUTCFullYear();

	const eosBase = new Decimal(input.baseSalary)
		.plus(new Decimal(input.housingAllowance))
		.plus(new Decimal(input.transportAllowance))
		.plus(new Decimal(input.responsibilityPremium));

	// YoS at end of fiscal year (for reporting)
	const yos = yearFrac(input.hireDate, input.asOfDate);

	// Cumulative EOS at end of previous fiscal year (Dec 31 of year-1)
	const prevYearEnd = new Date(Date.UTC(fiscalYear - 1, 11, 31));
	const yosPrev = yearFrac(input.hireDate, prevYearEnd);
	const cumEosPrev = computeCumulativeEos(eosBase, yosPrev);

	// Cumulative EOS at end of fiscal year
	const cumEosCurrent = computeCumulativeEos(eosBase, yos);

	// Annual provision = increment over the year
	const eosAnnual = cumEosCurrent.minus(cumEosPrev);
	const eosMonthlyAccrual = eosAnnual.div(12);

	return { yearsOfService: yos, eosBase, eosAnnual, eosMonthlyAccrual };
}

/**
 * Compute per-month EOS incremental accruals.
 * Returns an array of 12 Decimal values (one per month).
 * Each value = cumulative EOS at end of this month - cumulative EOS at end of previous month.
 */
export function calculateMonthlyEosAccruals(
	eosBase: Decimal,
	hireDate: Date,
	fiscalYear: number
): Decimal[] {
	const accruals: Decimal[] = [];
	const monthEndDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

	// Check for leap year (Feb)
	if ((fiscalYear % 4 === 0 && fiscalYear % 100 !== 0) || fiscalYear % 400 === 0) {
		monthEndDays[1] = 29;
	}

	// Cumulative EOS at Dec 31 of previous year
	const prevYearEnd = new Date(Date.UTC(fiscalYear - 1, 11, 31));
	let prevCumEos = computeCumulativeEos(eosBase, yearFrac(hireDate, prevYearEnd));

	for (let m = 0; m < 12; m++) {
		const monthEnd = new Date(Date.UTC(fiscalYear, m, monthEndDays[m]!));
		const yos = yearFrac(hireDate, monthEnd);
		const cumEos = computeCumulativeEos(eosBase, yos);
		const increment = cumEos.minus(prevCumEos);
		accruals.push(increment.lt(0) ? new Decimal(0) : increment);
		prevCumEos = cumEos;
	}

	return accruals;
}

// ── Cost Mode Types (Epic 19, AC-10/AC-11) ──────────────────────────────────

export type CostMode = 'LOCAL_PAYROLL' | 'AEFE_RECHARGE' | 'NO_LOCAL_COST';

// ── Full Monthly Cost (AC-22) ────────────────────────────────────────────────

export interface EmployeeCostInput {
	baseSalary: string;
	housingAllowance: string;
	transportAllowance: string;
	responsibilityPremium: string;
	hsaAmount: string;
	augmentation: string;
	isTeaching: boolean;
	isSaudi: boolean;
	isAjeer: boolean;
	status: 'Existing' | 'New' | 'Departed';
	ajeerAnnualFee: string;
	hireDate: Date;
	asOfDate: Date;
	costMode?: CostMode; // defaults to 'LOCAL_PAYROLL' for backwards compatibility
}

export interface MonthlyCostOutput {
	month: number;
	baseGross: Decimal;
	adjustedGross: Decimal;
	housingAllowance: Decimal;
	transportAllowance: Decimal;
	responsibilityPremium: Decimal;
	hsaAmount: Decimal;
	gosiAmount: Decimal;
	ajeerAmount: Decimal;
	eosMonthlyAccrual: Decimal;
	totalCost: Decimal;
}

export function calculateFullMonthlyCost(
	input: EmployeeCostInput,
	month: number,
	monthlyEosAccrual: Decimal
): MonthlyCostOutput {
	const grossInput: MonthlyGrossInput = {
		baseSalary: input.baseSalary,
		housingAllowance: input.housingAllowance,
		transportAllowance: input.transportAllowance,
		responsibilityPremium: input.responsibilityPremium,
		hsaAmount: input.hsaAmount,
		augmentation: input.augmentation,
		isTeaching: input.isTeaching,
	};

	const gross = calculateMonthlyGross(grossInput, month);

	const gosiAmount = calculateGOSI(gross.adjustedGross, input.isSaudi);

	const ajeerAmount = calculateAjeer(
		{
			isAjeer: input.isAjeer,
			isSaudi: input.isSaudi,
			status: input.status,
			ajeerAnnualFee: input.ajeerAnnualFee,
		},
		month
	);

	// AC-22: total_cost = adjusted_gross + gosi + ajeer + eos_monthly_accrual
	const totalCost = gross.adjustedGross.plus(gosiAmount).plus(ajeerAmount).plus(monthlyEosAccrual);

	return {
		month,
		baseGross: gross.baseGross,
		adjustedGross: gross.adjustedGross,
		housingAllowance: gross.housingAllowance,
		transportAllowance: gross.transportAllowance,
		responsibilityPremium: gross.responsibilityPremium,
		hsaAmount: gross.hsaAmount,
		gosiAmount,
		ajeerAmount,
		eosMonthlyAccrual: monthlyEosAccrual,
		totalCost,
	};
}

// ── Zero-cost row helper (AC-10: AEFE_RECHARGE) ────────────────────────────

const ZERO = new Decimal(0);

function makeZeroCostRow(month: number): MonthlyCostOutput {
	return {
		month,
		baseGross: ZERO,
		adjustedGross: ZERO,
		housingAllowance: ZERO,
		transportAllowance: ZERO,
		responsibilityPremium: ZERO,
		hsaAmount: ZERO,
		gosiAmount: ZERO,
		ajeerAmount: ZERO,
		eosMonthlyAccrual: ZERO,
		totalCost: ZERO,
	};
}

const ZERO_EOS: EosOutput = {
	yearsOfService: ZERO,
	eosBase: ZERO,
	eosAnnual: ZERO,
	eosMonthlyAccrual: ZERO,
};

/**
 * Compute all 12 months of cost for a single employee.
 *
 * AC-10: costMode === 'AEFE_RECHARGE' -> zero-cost monthly rows (12 rows, all amounts 0)
 * AC-11: costMode === 'NO_LOCAL_COST' -> no output rows (empty array)
 * AC-12: costMode === 'LOCAL_PAYROLL' (or omitted) -> existing full calculation
 */
export function calculateEmployeeAnnualCost(input: EmployeeCostInput): {
	months: MonthlyCostOutput[];
	eos: EosOutput;
} {
	const costMode = input.costMode ?? 'LOCAL_PAYROLL';

	// AC-11: NO_LOCAL_COST — skip entirely, no output rows
	if (costMode === 'NO_LOCAL_COST') {
		return { months: [], eos: ZERO_EOS };
	}

	// AC-10: AEFE_RECHARGE — return zero-cost rows for all 12 months
	if (costMode === 'AEFE_RECHARGE') {
		const months: MonthlyCostOutput[] = [];
		for (let month = 1; month <= 12; month++) {
			months.push(makeZeroCostRow(month));
		}
		return { months, eos: ZERO_EOS };
	}

	// LOCAL_PAYROLL — existing full calculation (AC-12)
	const eos = calculateEoSProvision({
		baseSalary: input.baseSalary,
		housingAllowance: input.housingAllowance,
		transportAllowance: input.transportAllowance,
		responsibilityPremium: input.responsibilityPremium,
		hireDate: input.hireDate,
		asOfDate: input.asOfDate,
	});

	// Compute per-month incremental EOS accruals
	const fiscalYear = input.asOfDate.getUTCFullYear();
	const monthlyEosAccruals = calculateMonthlyEosAccruals(eos.eosBase, input.hireDate, fiscalYear);

	// New employees only incur costs from September (month 9) onwards.
	// Jan-Aug: zero-cost rows. Sep-Dec: full calculation.
	const startMonth = input.status === 'New' ? 9 : 1;

	const months: MonthlyCostOutput[] = [];
	for (let month = 1; month <= 12; month++) {
		if (month < startMonth) {
			months.push(makeZeroCostRow(month));
		} else {
			const monthEos = monthlyEosAccruals[month - 1] ?? new Decimal(0);
			months.push(calculateFullMonthlyCost(input, month, monthEos));
		}
	}

	return { months, eos };
}
