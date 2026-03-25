/**
 * Financial and domain glossary for BudFin.
 *
 * Maps term keys to plain-English definitions displayed via InfoTooltip.
 */
export const GLOSSARY: Record<string, string> = {
	YEARFRAC:
		'Excel-compatible year fraction calculation used to pro-rate annual salaries across months based on actual days.',
	'DHG Grille':
		'Detached Host Government salary grille defining base salary levels by echelon and indice for AEFE-recharge staff.',
	GOSI: 'General Organization for Social Insurance — Saudi employer contribution (11.75% of base salary for Saudi nationals).',
	Echelon:
		'A rank level within the DHG salary grille that determines base salary and progression steps.',
	Indice: 'The step within an echelon that determines the exact salary amount on the DHG grille.',
	'Cohort Retention':
		'The percentage of students expected to re-enroll from one academic year to the next, used to project AY2 headcounts.',
	AY1: 'Academic Year 1 — the first half of the fiscal year (September to December), covering the start of the school year.',
	AY2: 'Academic Year 2 — the second half of the fiscal year (January to August), continuing through year-end.',
	FTE: 'Full-Time Equivalent — a unit of measure representing one full-time teaching position (e.g., 0.5 FTE = half-time).',
	Ajeer:
		'Saudi labor leasing program for non-Saudi workers. Simplified cost model with a flat monthly rate rather than full salary breakdown.',
	IFRS: 'International Financial Reporting Standards — the accounting framework used for the P&L statement format.',
	Zakat:
		'Islamic wealth tax applicable in Saudi Arabia, calculated as 2.5% of the taxable base for Saudi-owned entities.',
	PERCENT_OF_REVENUE:
		'An OpEx driver mode where the line-item amount is calculated as a percentage of total revenue.',
	'Stale Module':
		'A calculation module whose inputs have changed since it was last calculated, requiring recalculation for accurate data.',
	DAI: 'Directorate of International Affairs — the AEFE body that sets detached teacher salary scales.',
	ORS: 'Overseas Resident Supplement — an allowance paid to AEFE-recharge staff posted abroad.',
	'Base Salary':
		'The core salary amount before any allowances, contributions, or deductions are applied.',
	Indemnity:
		'End-of-service benefit accrued monthly, calculated based on Saudi labor law (half-month per year for first 5 years, one month per year thereafter).',
	'Housing Allowance':
		'A monthly allowance provided to employees for housing, typically a percentage of base salary.',
	'Transport Allowance': 'A monthly allowance provided to employees for transportation costs.',
	'AEFE Contribution':
		'The annual recharge cost invoiced by AEFE (Agency for French Education Abroad) for detached teachers assigned to the school.',
	'Gross Salary':
		'Total salary before deductions — includes base salary plus all allowances (housing, transport, etc.).',
	'Net Cost':
		'The total employer cost for an employee including salary, allowances, employer social charges, and end-of-service provisions.',
	Band: 'A school division grouping (Maternelle, Elementaire, College, Lycee) used to organize grades and allocate staffing.',
	'Service Obligation Profile':
		'The teaching hours requirement per week for a given discipline and band, defining how many FTE are needed.',
};

/**
 * Returns the definition for a glossary term, or undefined if not found.
 */
export function getDefinition(term: string): string | undefined {
	return GLOSSARY[term];
}

/**
 * Returns all glossary term keys sorted alphabetically.
 */
export function getGlossaryTerms(): string[] {
	return Object.keys(GLOSSARY).sort((a, b) => a.localeCompare(b));
}
