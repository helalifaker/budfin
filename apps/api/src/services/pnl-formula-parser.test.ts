import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { parseFormula, evaluateFormula } from './pnl-formula-parser.js';

// ── parseFormula ────────────────────────────────────────────────────────────

describe('parseFormula', () => {
	it('parses a simple subtraction formula', () => {
		const terms = parseFormula('REVENUE - COST_OF_SERVICE');
		expect(terms).toEqual([
			{ key: 'REVENUE', operator: '+' },
			{ key: 'COST_OF_SERVICE', operator: '-' },
		]);
	});

	it('parses a complex EBITDA formula with 6 terms', () => {
		const terms = parseFormula(
			'GROSS_PROFIT - PFC_6PCT - STAFF_COSTS - RENT - MAINTENANCE - OTHER_OPEX'
		);
		expect(terms).toEqual([
			{ key: 'GROSS_PROFIT', operator: '+' },
			{ key: 'PFC_6PCT', operator: '-' },
			{ key: 'STAFF_COSTS', operator: '-' },
			{ key: 'RENT', operator: '-' },
			{ key: 'MAINTENANCE', operator: '-' },
			{ key: 'OTHER_OPEX', operator: '-' },
		]);
	});

	it('parses an addition formula', () => {
		const terms = parseFormula('OPERATING_PROFIT + NET_FINANCE');
		expect(terms).toEqual([
			{ key: 'OPERATING_PROFIT', operator: '+' },
			{ key: 'NET_FINANCE', operator: '+' },
		]);
	});

	it('parses a single term formula', () => {
		const terms = parseFormula('REVENUE');
		expect(terms).toEqual([{ key: 'REVENUE', operator: '+' }]);
	});
});

// ── evaluateFormula ─────────────────────────────────────────────────────────

describe('evaluateFormula', () => {
	it('evaluates simple subtraction: REVENUE - COST_OF_SERVICE', () => {
		const totals = new Map<string, Decimal>([
			['REVENUE', new Decimal('1000')],
			['COST_OF_SERVICE', new Decimal('200')],
		]);

		const result = evaluateFormula('REVENUE - COST_OF_SERVICE', totals);
		expect(result.toNumber()).toBe(800);
	});

	it('evaluates complex EBITDA formula with 6 terms', () => {
		const totals = new Map<string, Decimal>([
			['GROSS_PROFIT', new Decimal('5000')],
			['PFC_6PCT', new Decimal('300')],
			['STAFF_COSTS', new Decimal('2000')],
			['RENT', new Decimal('500')],
			['MAINTENANCE', new Decimal('200')],
			['OTHER_OPEX', new Decimal('400')],
		]);

		const result = evaluateFormula(
			'GROSS_PROFIT - PFC_6PCT - STAFF_COSTS - RENT - MAINTENANCE - OTHER_OPEX',
			totals
		);
		// 5000 - 300 - 2000 - 500 - 200 - 400 = 1600
		expect(result.toNumber()).toBe(1600);
	});

	it('evaluates addition: OPERATING_PROFIT + NET_FINANCE', () => {
		const totals = new Map<string, Decimal>([
			['OPERATING_PROFIT', new Decimal('1000')],
			['NET_FINANCE', new Decimal('50')],
		]);

		const result = evaluateFormula('OPERATING_PROFIT + NET_FINANCE', totals);
		expect(result.toNumber()).toBe(1050);
	});

	it('returns zero for unknown keys without throwing', () => {
		const totals = new Map<string, Decimal>([['REVENUE', new Decimal('1000')]]);

		const result = evaluateFormula('REVENUE - UNKNOWN_SECTION', totals);
		expect(result.toNumber()).toBe(1000);
	});

	it('evaluates a single term formula', () => {
		const totals = new Map<string, Decimal>([['REVENUE', new Decimal('42000')]]);

		const result = evaluateFormula('REVENUE', totals);
		expect(result.toNumber()).toBe(42000);
	});

	it('returns zero when all keys are unknown', () => {
		const totals = new Map<string, Decimal>();
		const result = evaluateFormula('A - B + C', totals);
		expect(result.toNumber()).toBe(0);
	});
});
