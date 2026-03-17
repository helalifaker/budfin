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
	ajeerAnnualLevy: string; // decimal string
	ajeerMonthlyFee: string; // decimal string
}

export function calculateAjeer(input: AjeerInput, month: number): Decimal {
	// AC-18: Saudi employees pay no Ajeer
	if (input.isSaudi) return new Decimal(0);
	if (!input.isAjeer) return new Decimal(0);

	// AC-17: New staff only pay Sep-Dec (months 9-12)
	if (input.status === 'New' && month < 9) return new Decimal(0);

	// AC-16: existing staff pay all 12 months
	const annualLevy = new Decimal(input.ajeerAnnualLevy);
	const monthlyFee = new Decimal(input.ajeerMonthlyFee);
	return annualLevy.div(12).plus(monthlyFee);
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

export function calculateEoSProvision(input: EosInput): EosOutput {
	// AC-19: YoS via YEARFRAC US 30/360
	const yos = yearFrac(input.hireDate, input.asOfDate);

	// EoS base = base_salary + housing + transport + responsibility (HSA excluded)
	const eosBase = new Decimal(input.baseSalary)
		.plus(new Decimal(input.housingAllowance))
		.plus(new Decimal(input.transportAllowance))
		.plus(new Decimal(input.responsibilityPremium));

	let eosAnnual: Decimal;
	if (yos.lte(0)) {
		eosAnnual = new Decimal(0);
	} else if (yos.lte(5)) {
		// AC-20: YoS <= 5 -> (eosBase/2) * YoS
		eosAnnual = eosBase.div(2).times(yos);
	} else {
		// AC-21: YoS > 5 -> (eosBase/2 * 5) + eosBase * (YoS - 5)
		eosAnnual = eosBase
			.div(2)
			.times(5)
			.plus(eosBase.times(yos.minus(5)));
	}

	const eosMonthlyAccrual = eosAnnual.div(12);

	return { yearsOfService: yos, eosBase, eosAnnual, eosMonthlyAccrual };
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
	ajeerAnnualLevy: string;
	ajeerMonthlyFee: string;
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
	eosProvision: EosOutput
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
			ajeerAnnualLevy: input.ajeerAnnualLevy,
			ajeerMonthlyFee: input.ajeerMonthlyFee,
		},
		month
	);

	// AC-22: total_cost = adjusted_gross + gosi + ajeer + eos_monthly_accrual
	const totalCost = gross.adjustedGross
		.plus(gosiAmount)
		.plus(ajeerAmount)
		.plus(eosProvision.eosMonthlyAccrual);

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
		eosMonthlyAccrual: eosProvision.eosMonthlyAccrual,
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

	const months: MonthlyCostOutput[] = [];
	for (let month = 1; month <= 12; month++) {
		months.push(calculateFullMonthlyCost(input, month, eos));
	}

	return { months, eos };
}
