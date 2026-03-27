// P&L formula parser — pure functions, no DB dependencies
// Parses space-delimited formulas like "REVENUE - COST_OF_SERVICE"
// and evaluates them against a map of section totals.

import { Decimal } from 'decimal.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FormulaTerm {
	key: string;
	operator: '+' | '-';
}

// ── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a space-delimited formula string into an array of terms.
 * First term is implicitly '+'. Subsequent terms are preceded by '+' or '-'.
 *
 * Examples:
 *   "REVENUE - COST_OF_SERVICE"
 *     → [{ key: 'REVENUE', operator: '+' }, { key: 'COST_OF_SERVICE', operator: '-' }]
 *   "OPERATING_PROFIT + NET_FINANCE"
 *     → [{ key: 'OPERATING_PROFIT', operator: '+' }, { key: 'NET_FINANCE', operator: '+' }]
 */
export function parseFormula(formula: string): FormulaTerm[] {
	const tokens = formula.trim().split(/\s+/);
	const terms: FormulaTerm[] = [];
	let currentOperator: '+' | '-' = '+';

	for (const token of tokens) {
		if (token === '+') {
			currentOperator = '+';
		} else if (token === '-') {
			currentOperator = '-';
		} else {
			terms.push({ key: token, operator: currentOperator });
			// Reset to '+' for next term (will be overridden if an operator follows)
			currentOperator = '+';
		}
	}

	return terms;
}

// ── Evaluator ───────────────────────────────────────────────────────────────

const ZERO = new Decimal(0);

/**
 * Parse the formula and evaluate it by looking up each key in sectionTotals.
 * Unknown keys resolve to zero (no error thrown).
 *
 * TC-001: All arithmetic uses Decimal.js with ROUND_HALF_UP.
 */
export function evaluateFormula(formula: string, sectionTotals: Map<string, Decimal>): Decimal {
	const terms = parseFormula(formula);
	let result = ZERO;

	for (const term of terms) {
		const value = sectionTotals.get(term.key) ?? ZERO;
		if (term.operator === '+') {
			result = result.plus(value);
		} else {
			result = result.minus(value);
		}
	}

	return result;
}
