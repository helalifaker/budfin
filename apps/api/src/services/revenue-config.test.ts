import { describe, expect, it } from 'vitest';
import {
	buildCanonicalDynamicOtherRevenueRows,
	CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS,
	DEFAULT_VERSION_REVENUE_SETTINGS,
	formatRevenueSettingsRecord,
	validateCanonicalDynamicOtherRevenueItems,
} from './revenue-config.js';

describe('buildCanonicalDynamicOtherRevenueRows', () => {
	it('returns exactly 14 rows in canonical order', () => {
		const rows = buildCanonicalDynamicOtherRevenueRows();
		expect(rows).toHaveLength(14);
		expect(rows.map((r) => r.lineItemName)).toEqual(
			CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.map((item) => item.lineItemName)
		);
	});

	it('initialises annualAmount to 0.0000 for all rows', () => {
		for (const row of buildCanonicalDynamicOtherRevenueRows()) {
			expect(row.annualAmount).toBe('0.0000');
		}
	});

	it('carries correct computeMethod for each canonical row', () => {
		const rows = buildCanonicalDynamicOtherRevenueRows();
		const byName = new Map(rows.map((r) => [r.lineItemName, r]));
		expect(byName.get('BAC')?.computeMethod).toBe('EXAM_BAC');
		expect(byName.get('DNB')?.computeMethod).toBe('EXAM_DNB');
		expect(byName.get('EAF')?.computeMethod).toBe('EXAM_EAF');
		expect(byName.get('DAI - Francais')?.computeMethod).toBe('DAI');
		expect(byName.get('DPI - Nationaux')?.computeMethod).toBe('DPI');
		expect(byName.get('Frais de Dossier - Autres')?.computeMethod).toBe('FRAIS_DOSSIER');
		expect(byName.get('Evaluation - Primaire')?.computeMethod).toBe('EVAL_PRIMAIRE');
		expect(byName.get('Evaluation - College+Lycee')?.computeMethod).toBe('EVAL_SECONDAIRE');
	});

	it('carries correct specificMonths for registration fee items (months 5, 6)', () => {
		const rows = buildCanonicalDynamicOtherRevenueRows();
		const daiRow = rows.find((r) => r.lineItemName === 'DAI - Francais');
		expect(daiRow?.specificMonths).toEqual([5, 6]);
	});

	it('carries correct specificMonths for exam items (months 4, 5)', () => {
		const rows = buildCanonicalDynamicOtherRevenueRows();
		const bacRow = rows.find((r) => r.lineItemName === 'BAC');
		expect(bacRow?.specificMonths).toEqual([4, 5]);
	});

	it('carries correct specificMonths for evaluation items (months 10, 11)', () => {
		const rows = buildCanonicalDynamicOtherRevenueRows();
		const evalRow = rows.find((r) => r.lineItemName === 'Evaluation - Primaire');
		expect(evalRow?.specificMonths).toEqual([10, 11]);
	});
});

describe('formatRevenueSettingsRecord', () => {
	it('formats all seven fields to 4 decimal places', () => {
		const result = formatRevenueSettingsRecord({
			dpiPerStudentHt: '2000',
			dossierPerStudentHt: '1000',
			examBacPerStudent: '2000',
			examDnbPerStudent: '600',
			examEafPerStudent: '800',
			evalPrimairePerStudent: '200',
			evalSecondairePerStudent: '300',
			flatDiscountPct: '0',
		});
		expect(result).toEqual(DEFAULT_VERSION_REVENUE_SETTINGS);
	});

	it('accepts Decimal objects returned by Prisma', () => {
		const result = formatRevenueSettingsRecord({
			dpiPerStudentHt: { toString: () => '2000.0000' },
			dossierPerStudentHt: { toString: () => '1000.0000' },
			examBacPerStudent: { toString: () => '2000.0000' },
			examDnbPerStudent: { toString: () => '600.0000' },
			examEafPerStudent: { toString: () => '800.0000' },
			evalPrimairePerStudent: { toString: () => '200.0000' },
			evalSecondairePerStudent: { toString: () => '300.0000' },
			flatDiscountPct: { toString: () => '0.000000' },
		});
		expect(result.dpiPerStudentHt).toBe('2000.0000');
	});
});

describe('validateCanonicalDynamicOtherRevenueItems', () => {
	function makeValidItems() {
		return CANONICAL_DYNAMIC_OTHER_REVENUE_ITEMS.map((item) => ({
			lineItemName: item.lineItemName,
			computeMethod: item.computeMethod,
			distributionMethod: item.distributionMethod,
			weightArray: item.weightArray,
			specificMonths: item.specificMonths ?? [],
			ifrsCategory: item.ifrsCategory,
		}));
	}

	it('returns no errors when all 14 canonical items are present and valid', () => {
		const result = validateCanonicalDynamicOtherRevenueItems(makeValidItems());
		expect(result.missing).toEqual([]);
		expect(result.unexpected).toEqual([]);
		expect(result.invalid).toEqual([]);
		expect(result.validCount).toBe(14);
	});

	it('reports missing items when fewer than 14 canonical rows are provided', () => {
		const items = makeValidItems().filter((item) => item.lineItemName !== 'BAC');
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.missing).toContain('BAC');
		expect(result.validCount).toBe(13);
	});

	it('reports unexpected items when a non-canonical lineItemName is included', () => {
		const items = [
			...makeValidItems(),
			{
				lineItemName: 'Unknown Fee',
				computeMethod: 'DAI',
				distributionMethod: 'SPECIFIC_PERIOD',
				weightArray: null,
				specificMonths: [5, 6],
				ifrsCategory: 'Registration Fees',
			},
		];
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.unexpected).toContain('Unknown Fee');
	});

	it('reports invalid when computeMethod does not match canonical value', () => {
		const items = makeValidItems().map((item) =>
			item.lineItemName === 'BAC' ? { ...item, computeMethod: 'EXAM_DNB' } : item
		);
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.invalid.some((e) => e.lineItemName === 'BAC')).toBe(true);
	});

	it('reports invalid when distributionMethod does not match canonical value', () => {
		const items = makeValidItems().map((item) =>
			item.lineItemName === 'BAC' ? { ...item, distributionMethod: 'EQUAL_MONTHLY' } : item
		);
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.invalid.some((e) => e.lineItemName === 'BAC')).toBe(true);
	});

	it('reports invalid when weightArray is non-null', () => {
		const items = makeValidItems().map((item) =>
			item.lineItemName === 'BAC' ? { ...item, weightArray: [1, 2, 3] } : item
		);
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.invalid.some((e) => e.lineItemName === 'BAC')).toBe(true);
	});

	it('reports invalid when specificMonths does not match canonical schedule', () => {
		const items = makeValidItems().map((item) =>
			item.lineItemName === 'BAC' ? { ...item, specificMonths: [1, 2] } : item
		);
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.invalid.some((e) => e.lineItemName === 'BAC')).toBe(true);
	});

	it('reports invalid when specificMonths has correct values but wrong length', () => {
		const items = makeValidItems().map((item) =>
			item.lineItemName === 'BAC' ? { ...item, specificMonths: [4, 5, 6] } : item
		);
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.invalid.some((e) => e.lineItemName === 'BAC')).toBe(true);
	});

	it('reports invalid when ifrsCategory does not match canonical value', () => {
		const items = makeValidItems().map((item) =>
			item.lineItemName === 'BAC' ? { ...item, ifrsCategory: 'Other Revenue' } : item
		);
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.invalid.some((e) => e.lineItemName === 'BAC')).toBe(true);
	});

	it('reports invalid when the same lineItemName appears twice', () => {
		const items = [
			...makeValidItems(),
			{ ...makeValidItems()[0]! }, // duplicate first item
		];
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		expect(result.invalid.some((e) => e.reason === 'Duplicate dynamic line item')).toBe(true);
	});

	it('reports multiple invalid fields for the same item', () => {
		const items = makeValidItems().map((item) =>
			item.lineItemName === 'BAC'
				? { ...item, computeMethod: 'DAI', specificMonths: [1, 2], ifrsCategory: 'Other Revenue' }
				: item
		);
		const result = validateCanonicalDynamicOtherRevenueItems(items);
		const bacErrors = result.invalid.filter((e) => e.lineItemName === 'BAC');
		expect(bacErrors.length).toBeGreaterThanOrEqual(2);
	});

	it('returns empty arrays for empty input with all 14 rows missing', () => {
		const result = validateCanonicalDynamicOtherRevenueItems([]);
		expect(result.missing).toHaveLength(14);
		expect(result.unexpected).toEqual([]);
		expect(result.invalid).toEqual([]);
	});
});
