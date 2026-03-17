import { Decimal } from 'decimal.js';

// ── HSA Engine (AC-08, AC-09) ───────────────────────────────────────────────
// Pure function: computes HSA (Heures Supplémentaires Annualisées) cost per teacher.
// No database calls — all inputs loaded before calling.

export interface HsaInput {
	hsaTargetHours: Decimal;
	hsaFirstHourRate: Decimal;
	hsaAdditionalHourRate: Decimal;
	hsaMonths: number; // default 10 (Jul-Aug excluded)
}

export interface HsaOutput {
	hsaCostPerMonth: Decimal;
	hsaAnnualPerTeacher: Decimal;
}

/**
 * AC-08: Calculate HSA cost per teacher.
 *
 *   hsaCostPerMonth = hsaFirstHourRate + max(0, hsaTargetHours - 1) * hsaAdditionalHourRate
 *   hsaAnnualPerTeacher = hsaCostPerMonth * hsaMonths
 *
 * Default: 500 + max(0, 1.5-1)*400 = 500 + 200 = 700 SAR/month * 10 = 7,000 SAR/year.
 *
 * AC-09: HSA applies ONLY when serviceProfile.hsaEligible === true AND
 *         costMode === 'LOCAL_PAYROLL'. The caller is responsible for this eligibility
 *         check — this function computes the raw cost for a single eligible teacher.
 */
export function calculateHsa(input: HsaInput): HsaOutput {
	const additionalHours = Decimal.max(new Decimal(0), input.hsaTargetHours.minus(1));
	const additionalCost = additionalHours.times(input.hsaAdditionalHourRate);
	const costPerMonth = input.hsaFirstHourRate.plus(additionalCost);
	const annual = costPerMonth.times(input.hsaMonths);

	return {
		hsaCostPerMonth: costPerMonth,
		hsaAnnualPerTeacher: annual,
	};
}
