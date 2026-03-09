import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { calculateCategoryMonthlyCosts, type CategoryCostConfig } from './category-cost-engine.js';

const defaultConfig: CategoryCostConfig = {
	remplacementsRate: '0.0200',
	formationRate: '0.0100',
	residentSalaryAnnual: '180000.0000',
	residentLogementAnnual: '60000.0000',
};

function makeMonthlySubtotals(value: string): Map<number, Decimal> {
	const map = new Map<number, Decimal>();
	for (let m = 1; m <= 12; m++) {
		map.set(m, new Decimal(value));
	}
	return map;
}

// ── AC-13: Category Monthly Costs ───────────────────────────────────────────

describe('calculateCategoryMonthlyCosts', () => {
	it('returns 48 rows (4 categories x 12 months)', () => {
		const subtotals = makeMonthlySubtotals('500000.0000');
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);
		expect(results).toHaveLength(48);
	});

	it('each month has all 4 categories', () => {
		const subtotals = makeMonthlySubtotals('500000.0000');
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		for (let month = 1; month <= 12; month++) {
			const monthRows = results.filter((r) => r.month === month);
			const categories = monthRows.map((r) => r.category).sort();
			expect(categories).toEqual([
				'formation',
				'remplacements',
				'resident_logement',
				'resident_salaires',
			]);
		}
	});

	it('remplacements = subtotal * remplacements_rate', () => {
		const subtotals = makeMonthlySubtotals('500000.0000');
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		const remplacement = results.find((r) => r.month === 1 && r.category === 'remplacements')!;
		// 500000 * 0.02 = 10000
		expect(remplacement.amount.toFixed(4)).toBe('10000.0000');
	});

	it('formation = subtotal * formation_rate', () => {
		const subtotals = makeMonthlySubtotals('500000.0000');
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		const formation = results.find((r) => r.month === 1 && r.category === 'formation')!;
		// 500000 * 0.01 = 5000
		expect(formation.amount.toFixed(4)).toBe('5000.0000');
	});

	it('resident_salaires = annual / 12', () => {
		const subtotals = makeMonthlySubtotals('500000.0000');
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		const salary = results.find((r) => r.month === 1 && r.category === 'resident_salaires')!;
		// 180000 / 12 = 15000
		expect(salary.amount.toFixed(4)).toBe('15000.0000');
	});

	it('resident_logement = annual / 12', () => {
		const subtotals = makeMonthlySubtotals('500000.0000');
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		const logement = results.find((r) => r.month === 1 && r.category === 'resident_logement')!;
		// 60000 / 12 = 5000
		expect(logement.amount.toFixed(4)).toBe('5000.0000');
	});

	it('resident costs are the same every month (independent of subtotal)', () => {
		const subtotals = new Map<number, Decimal>();
		for (let m = 1; m <= 12; m++) {
			subtotals.set(m, new Decimal(m * 100000)); // varying subtotals
		}
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		const residentSalaries = results.filter((r) => r.category === 'resident_salaires');
		const residentLogement = results.filter((r) => r.category === 'resident_logement');

		for (const row of residentSalaries) {
			expect(row.amount.toFixed(4)).toBe('15000.0000');
		}
		for (const row of residentLogement) {
			expect(row.amount.toFixed(4)).toBe('5000.0000');
		}
	});

	it('contrats locaux costs vary with monthly subtotals', () => {
		const subtotals = new Map<number, Decimal>();
		subtotals.set(1, new Decimal('100000'));
		subtotals.set(2, new Decimal('200000'));
		for (let m = 3; m <= 12; m++) {
			subtotals.set(m, new Decimal('0'));
		}
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		const rempM1 = results.find((r) => r.month === 1 && r.category === 'remplacements')!;
		const rempM2 = results.find((r) => r.month === 2 && r.category === 'remplacements')!;
		// 100000 * 0.02 = 2000, 200000 * 0.02 = 4000
		expect(rempM1.amount.toFixed(4)).toBe('2000.0000');
		expect(rempM2.amount.toFixed(4)).toBe('4000.0000');
	});

	it('handles zero subtotals gracefully', () => {
		const subtotals = makeMonthlySubtotals('0');
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		const remplacements = results.filter((r) => r.category === 'remplacements');
		const formations = results.filter((r) => r.category === 'formation');

		for (const row of remplacements) {
			expect(row.amount.toFixed(4)).toBe('0.0000');
		}
		for (const row of formations) {
			expect(row.amount.toFixed(4)).toBe('0.0000');
		}
	});

	it('handles missing months in subtotals map (defaults to 0)', () => {
		const subtotals = new Map<number, Decimal>();
		subtotals.set(1, new Decimal('100000'));
		// months 2-12 are missing
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		const rempM2 = results.find((r) => r.month === 2 && r.category === 'remplacements')!;
		expect(rempM2.amount.toFixed(4)).toBe('0.0000');
	});

	it('all amounts are Decimal instances (TC-001)', () => {
		const subtotals = makeMonthlySubtotals('500000.0000');
		const results = calculateCategoryMonthlyCosts(subtotals, defaultConfig);

		for (const row of results) {
			expect(row.amount).toBeInstanceOf(Decimal);
		}
	});

	it('no intermediate rounding (TC-004) — full precision maintained', () => {
		const subtotals = makeMonthlySubtotals('333333.3333');
		const config: CategoryCostConfig = {
			remplacementsRate: '0.0300',
			formationRate: '0.0150',
			residentSalaryAnnual: '100000.0000',
			residentLogementAnnual: '33333.3333',
		};
		const results = calculateCategoryMonthlyCosts(subtotals, config);

		const remp = results.find((r) => r.month === 1 && r.category === 'remplacements')!;
		// 333333.3333 * 0.03 = 9999.999999 — should NOT be rounded
		expect(remp.amount.toString()).toBe('9999.999999');

		const logement = results.find((r) => r.month === 1 && r.category === 'resident_logement')!;
		// 33333.3333 / 12 — full precision
		const expected = new Decimal('33333.3333').dividedBy(12);
		expect(logement.amount.toString()).toBe(expected.toString());
	});
});
