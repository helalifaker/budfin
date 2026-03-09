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
