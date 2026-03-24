import { Decimal } from 'decimal.js';

// ── Category Cost Engine (AC-13) ────────────────────────────────────────────
// Pure function: computes Contrats Locaux and Residents category-level costs.
// No database calls — all inputs loaded before calling.

export interface CategoryCostConfig {
	remplacementsRate: string; // decimal string, e.g. "0.0200"
	formationRate: string; // decimal string, e.g. "0.0100"
	residentSalaryAnnual: string; // decimal string, e.g. "180000.0000"
	residentLogementAnnual: string; // decimal string, e.g. "60000.0000"
}

export interface CategoryMonthlyCostOutput {
	month: number;
	category: string;
	amount: Decimal;
	calculationMode?: CalculationMode;
}

/**
 * Calculate category-level monthly costs for Contrats Locaux and Residents.
 *
 * - remplacements = subtotalLocalSalaries * remplacementsRate (per month)
 * - formation = subtotalLocalSalaries * formationRate (per month)
 * - resident_salaires = residentSalaryAnnual / 12
 * - resident_logement = residentLogementAnnual / 12
 *
 * @param monthlySubtotals - Map of month (1-12) to subtotal of adjusted_gross
 *                           for all non-departed employees that month
 * @param config - The 4 rate/amount config values from system_config
 * @returns Array of CategoryMonthlyCostOutput rows (4 categories x 12 months = 48 rows)
 */
export function calculateCategoryMonthlyCosts(
	monthlySubtotals: Map<number, Decimal>,
	config: CategoryCostConfig
): CategoryMonthlyCostOutput[] {
	const remplacementsRate = new Decimal(config.remplacementsRate);
	const formationRate = new Decimal(config.formationRate);
	const residentSalaryAnnual = new Decimal(config.residentSalaryAnnual);
	const residentLogementAnnual = new Decimal(config.residentLogementAnnual);

	const residentMonthlySalary = residentSalaryAnnual.dividedBy(12);
	const residentMonthlyLogement = residentLogementAnnual.dividedBy(12);

	const results: CategoryMonthlyCostOutput[] = [];

	for (let month = 1; month <= 12; month++) {
		const subtotal = monthlySubtotals.get(month) ?? new Decimal(0);

		results.push({
			month,
			category: 'remplacements',
			amount: subtotal.times(remplacementsRate),
		});

		results.push({
			month,
			category: 'formation',
			amount: subtotal.times(formationRate),
		});

		results.push({
			month,
			category: 'resident_salaires',
			amount: residentMonthlySalary,
		});

		results.push({
			month,
			category: 'resident_logement',
			amount: residentMonthlyLogement,
		});
	}

	return results;
}

// ── Configurable Category Cost Engine (Epic 19, AC-13/AC-14) ────────────────
// Supports 3 calculation modes per category from VersionStaffingCostAssumption.
// Replaces the legacy fixed-config function in the calculation pipeline.

export type CalculationMode = 'FLAT_ANNUAL' | 'PERCENT_OF_PAYROLL' | 'AMOUNT_PER_FTE';

export interface CategoryAssumption {
	category: string;
	calculationMode: CalculationMode;
	value: Decimal;
	excludeSummerMonths: boolean;
}

export interface ConfigurableCategoryCostInput {
	/** Per-category assumptions from VersionStaffingCostAssumption */
	assumptions: CategoryAssumption[];
	/**
	 * AC-09 (PERCENT_OF_PAYROLL): month -> subtotal of adjusted_gross for
	 * LOCAL_PAYROLL employees only (AEFE_RECHARGE excluded)
	 */
	monthlySubtotals: Map<number, Decimal>;
	/**
	 * AC-10 (AMOUNT_PER_FTE): SUM(requiredFteRaw) from all teaching requirement
	 * lines — curriculum demand, not HSA-adjusted planned FTE
	 */
	totalTeachingFteRaw: Decimal;
}

/**
 * AC-13: Compute category-level monthly costs using configurable modes.
 *
 * Formulas:
 *   - FLAT_ANNUAL:        monthlyAmount = value / 12
 *   - PERCENT_OF_PAYROLL: monthlyAmount = monthlySubtotal * value
 *   - AMOUNT_PER_FTE:     monthlyAmount = (value * totalTeachingFteRaw) / 12
 *
 * AC-14: Produces N categories x 12 months rows with calculationMode persisted
 * on each row. With 5 categories, this yields 60 rows.
 *
 * @param input - Assumptions, monthly subtotals, and FTE total
 * @returns Array of CategoryMonthlyCostOutput rows
 */
export function calculateConfigurableCategoryMonthlyCosts(
	input: ConfigurableCategoryCostInput
): CategoryMonthlyCostOutput[] {
	const results: CategoryMonthlyCostOutput[] = [];

	for (const assumption of input.assumptions) {
		for (let month = 1; month <= 12; month++) {
			let amount: Decimal;

			switch (assumption.calculationMode) {
				case 'FLAT_ANNUAL':
					// value is the annual amount, divide by 12
					amount = assumption.value.dividedBy(12);
					break;

				case 'PERCENT_OF_PAYROLL':
					// value is a rate (e.g., 0.02 = 2%), multiply by LOCAL_PAYROLL subtotal
					amount = (input.monthlySubtotals.get(month) ?? new Decimal(0)).times(assumption.value);
					break;

				case 'AMOUNT_PER_FTE':
					// value is annual cost per FTE, multiply by total FTE, divide by 12
					amount = assumption.value.times(input.totalTeachingFteRaw).dividedBy(12);
					break;
			}

			// Summer exclusion: zero out months 7-8 (Jul-Aug) for flagged categories
			if (assumption.excludeSummerMonths && (month === 7 || month === 8)) {
				amount = new Decimal(0);
			}

			results.push({
				month,
				category: assumption.category,
				amount,
				calculationMode: assumption.calculationMode,
			});
		}
	}

	return results;
}
