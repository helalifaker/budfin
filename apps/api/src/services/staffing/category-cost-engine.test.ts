import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
	calculateCategoryMonthlyCosts,
	calculateConfigurableCategoryMonthlyCosts,
	type CategoryCostConfig,
	type ConfigurableCategoryCostInput,
} from './category-cost-engine.js';

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

// ── AC-13/AC-14: Configurable Category Monthly Costs (Epic 19) ──────────────

function makeConfigInput(
	overrides: Partial<ConfigurableCategoryCostInput> = {}
): ConfigurableCategoryCostInput {
	return {
		assumptions: [
			{
				category: 'REMPLACEMENTS',
				calculationMode: 'PERCENT_OF_PAYROLL',
				value: new Decimal('0.0200'),
				excludeSummerMonths: false,
			},
			{
				category: 'FORMATION',
				calculationMode: 'PERCENT_OF_PAYROLL',
				value: new Decimal('0.0100'),
				excludeSummerMonths: false,
			},
			{
				category: 'RESIDENT_SALAIRES',
				calculationMode: 'FLAT_ANNUAL',
				value: new Decimal('180000'),
				excludeSummerMonths: false,
			},
			{
				category: 'RESIDENT_LOGEMENT',
				calculationMode: 'FLAT_ANNUAL',
				value: new Decimal('60000'),
				excludeSummerMonths: false,
			},
			{
				category: 'RESIDENT_PENSION',
				calculationMode: 'AMOUNT_PER_FTE',
				value: new Decimal('12000'),
				excludeSummerMonths: false,
			},
		],
		monthlySubtotals: makeMonthlySubtotals('500000'),
		totalTeachingFteRaw: new Decimal('25'),
		...overrides,
	};
}

describe('calculateConfigurableCategoryMonthlyCosts', () => {
	// AC-14: 5 categories x 12 months = 60 rows
	it('AC-14: returns 60 rows (5 categories x 12 months)', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput());
		expect(results).toHaveLength(60);
	});

	it('each month has all 5 categories', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput());

		for (let month = 1; month <= 12; month++) {
			const monthRows = results.filter((r) => r.month === month);
			expect(monthRows).toHaveLength(5);
			const categories = monthRows.map((r) => r.category).sort();
			expect(categories).toEqual([
				'FORMATION',
				'REMPLACEMENTS',
				'RESIDENT_LOGEMENT',
				'RESIDENT_PENSION',
				'RESIDENT_SALAIRES',
			]);
		}
	});

	// ── AC-08: FLAT_ANNUAL mode ─────────────────────────────────────────────

	it('AC-13: FLAT_ANNUAL — value / 12 for each month', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput());

		const salaires = results.filter((r) => r.category === 'RESIDENT_SALAIRES');
		expect(salaires).toHaveLength(12);
		for (const row of salaires) {
			// 180000 / 12 = 15000
			expect(row.amount.toFixed(4)).toBe('15000.0000');
			expect(row.calculationMode).toBe('FLAT_ANNUAL');
		}
	});

	it('FLAT_ANNUAL — same amount every month regardless of subtotals', () => {
		const input = makeConfigInput({
			monthlySubtotals: new Map<number, Decimal>([
				[1, new Decimal('100000')],
				[2, new Decimal('999999')],
			]),
		});
		const results = calculateConfigurableCategoryMonthlyCosts(input);

		const logement = results.filter((r) => r.category === 'RESIDENT_LOGEMENT');
		for (const row of logement) {
			// 60000 / 12 = 5000
			expect(row.amount.toFixed(4)).toBe('5000.0000');
		}
	});

	// ── AC-09: PERCENT_OF_PAYROLL mode ──────────────────────────────────────

	it('AC-13: PERCENT_OF_PAYROLL — monthlySubtotal * value', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput());

		const remp = results.find((r) => r.month === 1 && r.category === 'REMPLACEMENTS')!;
		// 500000 * 0.02 = 10000
		expect(remp.amount.toFixed(4)).toBe('10000.0000');
		expect(remp.calculationMode).toBe('PERCENT_OF_PAYROLL');
	});

	it('AC-09: PERCENT_OF_PAYROLL subtotal uses LOCAL_PAYROLL only (caller responsibility)', () => {
		// The caller is responsible for computing monthlySubtotals from LOCAL_PAYROLL employees
		// only. The engine simply multiplies. This test verifies varying subtotals produce
		// varying amounts (the exclusion itself is enforced by the caller, not the engine).
		const subtotals = new Map<number, Decimal>();
		subtotals.set(1, new Decimal('100000'));
		subtotals.set(2, new Decimal('200000'));
		for (let m = 3; m <= 12; m++) {
			subtotals.set(m, new Decimal('0'));
		}

		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({ monthlySubtotals: subtotals })
		);

		const rempM1 = results.find((r) => r.month === 1 && r.category === 'REMPLACEMENTS')!;
		const rempM2 = results.find((r) => r.month === 2 && r.category === 'REMPLACEMENTS')!;
		const rempM3 = results.find((r) => r.month === 3 && r.category === 'REMPLACEMENTS')!;
		expect(rempM1.amount.toFixed(4)).toBe('2000.0000'); // 100000 * 0.02
		expect(rempM2.amount.toFixed(4)).toBe('4000.0000'); // 200000 * 0.02
		expect(rempM3.amount.toFixed(4)).toBe('0.0000'); // 0 * 0.02
	});

	it('PERCENT_OF_PAYROLL — missing month in subtotals defaults to 0', () => {
		const subtotals = new Map<number, Decimal>();
		subtotals.set(1, new Decimal('100000'));
		// months 2-12 missing

		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({ monthlySubtotals: subtotals })
		);

		const formM2 = results.find((r) => r.month === 2 && r.category === 'FORMATION')!;
		expect(formM2.amount.toFixed(4)).toBe('0.0000');
	});

	// ── AC-10: AMOUNT_PER_FTE mode ──────────────────────────────────────────

	it('AC-13: AMOUNT_PER_FTE — (value * totalTeachingFteRaw) / 12', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput());

		const pension = results.filter((r) => r.category === 'RESIDENT_PENSION');
		expect(pension).toHaveLength(12);
		for (const row of pension) {
			// (12000 * 25) / 12 = 300000 / 12 = 25000
			expect(row.amount.toFixed(4)).toBe('25000.0000');
			expect(row.calculationMode).toBe('AMOUNT_PER_FTE');
		}
	});

	it('AC-10: AMOUNT_PER_FTE uses requiredFteRaw — same every month', () => {
		const input = makeConfigInput({
			totalTeachingFteRaw: new Decimal('15.5'),
		});
		const results = calculateConfigurableCategoryMonthlyCosts(input);

		const pension = results.filter((r) => r.category === 'RESIDENT_PENSION');
		const expected = new Decimal('12000').times(new Decimal('15.5')).dividedBy(12);
		for (const row of pension) {
			expect(row.amount.toString()).toBe(expected.toString());
		}
	});

	it('AMOUNT_PER_FTE — independent of monthly subtotals', () => {
		const input = makeConfigInput({
			monthlySubtotals: makeMonthlySubtotals('999999'), // should not affect AMOUNT_PER_FTE
		});
		const results = calculateConfigurableCategoryMonthlyCosts(input);

		const pension = results.find((r) => r.month === 1 && r.category === 'RESIDENT_PENSION')!;
		// (12000 * 25) / 12 = 25000 — not affected by subtotals
		expect(pension.amount.toFixed(4)).toBe('25000.0000');
	});

	// ── Mixed modes ─────────────────────────────────────────────────────────

	it('mixed modes: each category uses its own calculation mode', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput());

		const month1 = results.filter((r) => r.month === 1);

		const remp = month1.find((r) => r.category === 'REMPLACEMENTS')!;
		const form = month1.find((r) => r.category === 'FORMATION')!;
		const sal = month1.find((r) => r.category === 'RESIDENT_SALAIRES')!;
		const log = month1.find((r) => r.category === 'RESIDENT_LOGEMENT')!;
		const pen = month1.find((r) => r.category === 'RESIDENT_PENSION')!;

		// PERCENT_OF_PAYROLL: 500000 * 0.02 = 10000
		expect(remp.amount.toFixed(4)).toBe('10000.0000');
		expect(remp.calculationMode).toBe('PERCENT_OF_PAYROLL');

		// PERCENT_OF_PAYROLL: 500000 * 0.01 = 5000
		expect(form.amount.toFixed(4)).toBe('5000.0000');
		expect(form.calculationMode).toBe('PERCENT_OF_PAYROLL');

		// FLAT_ANNUAL: 180000 / 12 = 15000
		expect(sal.amount.toFixed(4)).toBe('15000.0000');
		expect(sal.calculationMode).toBe('FLAT_ANNUAL');

		// FLAT_ANNUAL: 60000 / 12 = 5000
		expect(log.amount.toFixed(4)).toBe('5000.0000');
		expect(log.calculationMode).toBe('FLAT_ANNUAL');

		// AMOUNT_PER_FTE: (12000 * 25) / 12 = 25000
		expect(pen.amount.toFixed(4)).toBe('25000.0000');
		expect(pen.calculationMode).toBe('AMOUNT_PER_FTE');
	});

	// ── Edge cases ──────────────────────────────────────────────────────────

	it('empty assumptions array — returns 0 rows', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput({ assumptions: [] }));
		expect(results).toHaveLength(0);
	});

	it('single category — returns 12 rows', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({
				assumptions: [
					{
						category: 'CUSTOM',
						calculationMode: 'FLAT_ANNUAL',
						value: new Decimal('24000'),
						excludeSummerMonths: false,
					},
				],
			})
		);
		expect(results).toHaveLength(12);
		for (const row of results) {
			expect(row.category).toBe('CUSTOM');
			expect(row.amount.toFixed(4)).toBe('2000.0000'); // 24000 / 12
		}
	});

	it('zero FTE raw — AMOUNT_PER_FTE produces zero', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({ totalTeachingFteRaw: new Decimal(0) })
		);
		const pension = results.filter((r) => r.category === 'RESIDENT_PENSION');
		for (const row of pension) {
			expect(row.amount.toFixed(4)).toBe('0.0000');
		}
	});

	it('zero subtotals — PERCENT_OF_PAYROLL produces zero', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({ monthlySubtotals: makeMonthlySubtotals('0') })
		);
		const remp = results.filter((r) => r.category === 'REMPLACEMENTS');
		for (const row of remp) {
			expect(row.amount.toFixed(4)).toBe('0.0000');
		}
	});

	it('all amounts are Decimal instances (TC-001)', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput());
		for (const row of results) {
			expect(row.amount).toBeInstanceOf(Decimal);
		}
	});

	it('calculationMode is persisted on each row (AC-14)', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(makeConfigInput());
		for (const row of results) {
			expect(row.calculationMode).toBeDefined();
			expect(['FLAT_ANNUAL', 'PERCENT_OF_PAYROLL', 'AMOUNT_PER_FTE']).toContain(
				row.calculationMode
			);
		}
	});

	it('no intermediate rounding (TC-004) — full precision maintained', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({
				assumptions: [
					{
						category: 'TEST_FLAT',
						calculationMode: 'FLAT_ANNUAL',
						value: new Decimal('100000.0001'),
						excludeSummerMonths: false,
					},
					{
						category: 'TEST_PCT',
						calculationMode: 'PERCENT_OF_PAYROLL',
						value: new Decimal('0.0333'),
						excludeSummerMonths: false,
					},
					{
						category: 'TEST_FTE',
						calculationMode: 'AMOUNT_PER_FTE',
						value: new Decimal('7777.7777'),
						excludeSummerMonths: false,
					},
				],
				monthlySubtotals: makeMonthlySubtotals('333333.3333'),
				totalTeachingFteRaw: new Decimal('17.333'),
			})
		);

		const flat = results.find((r) => r.month === 1 && r.category === 'TEST_FLAT')!;
		const expected_flat = new Decimal('100000.0001').dividedBy(12);
		expect(flat.amount.toString()).toBe(expected_flat.toString());

		const pct = results.find((r) => r.month === 1 && r.category === 'TEST_PCT')!;
		const expected_pct = new Decimal('333333.3333').times(new Decimal('0.0333'));
		expect(pct.amount.toString()).toBe(expected_pct.toString());

		const fte = results.find((r) => r.month === 1 && r.category === 'TEST_FTE')!;
		const expected_fte = new Decimal('7777.7777').times(new Decimal('17.333')).dividedBy(12);
		expect(fte.amount.toString()).toBe(expected_fte.toString());
	});

	// ── Summer exclusion ────────────────────────────────────────────────────

	it('excludeSummerMonths: FLAT_ANNUAL produces 0 for months 7-8', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({
				assumptions: [
					{
						category: 'SUMMER_FLAT',
						calculationMode: 'FLAT_ANNUAL',
						value: new Decimal('120000'),
						excludeSummerMonths: true,
					},
				],
			})
		);
		const jul = results.find((r) => r.month === 7)!;
		const aug = results.find((r) => r.month === 8)!;
		const jan = results.find((r) => r.month === 1)!;
		const sep = results.find((r) => r.month === 9)!;
		expect(jul.amount.toFixed(4)).toBe('0.0000');
		expect(aug.amount.toFixed(4)).toBe('0.0000');
		expect(jan.amount.toFixed(4)).toBe('10000.0000'); // 120000 / 12
		expect(sep.amount.toFixed(4)).toBe('10000.0000');
	});

	it('excludeSummerMonths: PERCENT_OF_PAYROLL produces 0 for months 7-8', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({
				assumptions: [
					{
						category: 'SUMMER_PCT',
						calculationMode: 'PERCENT_OF_PAYROLL',
						value: new Decimal('0.0200'),
						excludeSummerMonths: true,
					},
				],
			})
		);
		const jul = results.find((r) => r.month === 7)!;
		const aug = results.find((r) => r.month === 8)!;
		const jan = results.find((r) => r.month === 1)!;
		expect(jul.amount.toFixed(4)).toBe('0.0000');
		expect(aug.amount.toFixed(4)).toBe('0.0000');
		expect(jan.amount.toFixed(4)).toBe('10000.0000'); // 500000 * 0.02
	});

	it('excludeSummerMonths: AMOUNT_PER_FTE produces 0 for months 7-8', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({
				assumptions: [
					{
						category: 'SUMMER_FTE',
						calculationMode: 'AMOUNT_PER_FTE',
						value: new Decimal('12000'),
						excludeSummerMonths: true,
					},
				],
			})
		);
		const jul = results.find((r) => r.month === 7)!;
		const aug = results.find((r) => r.month === 8)!;
		expect(jul.amount.toFixed(4)).toBe('0.0000');
		expect(aug.amount.toFixed(4)).toBe('0.0000');
		// Non-summer months still calculate normally
		const jan = results.find((r) => r.month === 1)!;
		expect(jan.amount.toFixed(4)).toBe('25000.0000'); // (12000 * 25) / 12
	});

	it('excludeSummerMonths: only flagged categories are excluded', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({
				assumptions: [
					{
						category: 'EXCLUDED',
						calculationMode: 'FLAT_ANNUAL',
						value: new Decimal('120000'),
						excludeSummerMonths: true,
					},
					{
						category: 'INCLUDED',
						calculationMode: 'FLAT_ANNUAL',
						value: new Decimal('120000'),
						excludeSummerMonths: false,
					},
				],
			})
		);
		const exclJul = results.find((r) => r.month === 7 && r.category === 'EXCLUDED')!;
		const inclJul = results.find((r) => r.month === 7 && r.category === 'INCLUDED')!;
		expect(exclJul.amount.toFixed(4)).toBe('0.0000');
		expect(inclJul.amount.toFixed(4)).toBe('10000.0000'); // not excluded
	});

	it('excludeSummerMonths: months 1-6 and 9-12 are unaffected', () => {
		const results = calculateConfigurableCategoryMonthlyCosts(
			makeConfigInput({
				assumptions: [
					{
						category: 'SUMMER_TEST',
						calculationMode: 'FLAT_ANNUAL',
						value: new Decimal('120000'),
						excludeSummerMonths: true,
					},
				],
			})
		);
		const nonSummerMonths = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12];
		for (const m of nonSummerMonths) {
			const row = results.find((r) => r.month === m)!;
			expect(row.amount.toFixed(4)).toBe('10000.0000');
		}
	});
});
