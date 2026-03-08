import { Decimal } from 'decimal.js';

export interface MonthlyGrossInput {
	baseSalary: string;
	housingAllowance: string;
	transportAllowance: string;
	responsibilityPremium: string;
	hsaAmount: string;
	augmentation: string; // decimal percentage e.g. "0.0300" = 3%
	isTeaching: boolean;
}

export interface MonthlyGrossOutput {
	baseGross: Decimal;
	adjustedGross: Decimal;
	housingAllowance: Decimal;
	transportAllowance: Decimal;
	responsibilityPremium: Decimal;
	hsaAmount: Decimal;
}

/**
 * Calculate monthly gross for a single employee for a given month.
 *
 * AC-13: Months 1-8 use pre-augmentation salary. Months 9-12 apply
 * augmentation to base_salary, housing_allowance, transport_allowance,
 * and responsibility_premium. HSA is NOT subject to augmentation.
 *
 * AC-14: Teaching employees (isTeaching=true) have HSA=0 for months 7-8
 * (July-August summer exclusion). Non-teaching receive HSA year-round.
 */
export function calculateMonthlyGross(input: MonthlyGrossInput, month: number): MonthlyGrossOutput {
	const baseSalary = new Decimal(input.baseSalary);
	const housing = new Decimal(input.housingAllowance);
	const transport = new Decimal(input.transportAllowance);
	const responsibility = new Decimal(input.responsibilityPremium);
	const hsa = new Decimal(input.hsaAmount);
	const augPct = new Decimal(input.augmentation);

	const isSeptemberOrLater = month >= 9;
	const augMultiplier = isSeptemberOrLater ? new Decimal(1).plus(augPct) : new Decimal(1);

	// Apply augmentation to base + affected allowances (NOT HSA)
	const adjBaseSalary = baseSalary.times(augMultiplier);
	const adjHousing = housing.times(augMultiplier);
	const adjTransport = transport.times(augMultiplier);
	const adjResponsibility = responsibility.times(augMultiplier);

	// HSA summer exclusion for teaching staff (months 7-8)
	const isSummerExclusion = input.isTeaching && (month === 7 || month === 8);
	const adjHsa = isSummerExclusion ? new Decimal(0) : hsa;

	// Base gross = sum of all components before augmentation
	const baseGross = baseSalary.plus(housing).plus(transport).plus(responsibility).plus(hsa);

	// Adjusted gross = sum of augmented components + HSA (with exclusion)
	const adjustedGross = adjBaseSalary
		.plus(adjHousing)
		.plus(adjTransport)
		.plus(adjResponsibility)
		.plus(adjHsa);

	return {
		baseGross,
		adjustedGross,
		housingAllowance: adjHousing,
		transportAllowance: adjTransport,
		responsibilityPremium: adjResponsibility,
		hsaAmount: adjHsa,
	};
}
