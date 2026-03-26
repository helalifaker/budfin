import { describe, it, expect } from 'vitest';
import {
	computeRevenueBasedItems,
	computeCategorySubtotals,
	computeSectionTotals,
	computeOpEx,
	computeEntryModeAmounts,
	type OpExLineItemInput,
	type MonthlyRevenueInput,
} from './opex-engine.js';

const MONTHS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SCHOOL_10 = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]; // no Jul (7), Aug (8)

function makeUniformMonthly(value: number): { month: number; amount: string }[] {
	return MONTHS_12.map((m) => ({ month: m, amount: value.toFixed(4) }));
}

/** Helper to build a line item with sensible defaults for the new entry-mode fields. */
function makeLineItem(overrides: Partial<OpExLineItemInput> = {}): OpExLineItemInput {
	return {
		id: 1,
		sectionType: 'OPERATING',
		ifrsCategory: 'Rent & Utilities',
		lineItemName: 'Test Item',
		computeMethod: 'MANUAL',
		computeRate: null,
		monthlyAmounts: makeUniformMonthly(0),
		entryMode: 'SEASONAL',
		flatAmount: null,
		annualTotal: null,
		activeMonths: [],
		flatOverrideMonths: [],
		...overrides,
	};
}

describe('opex-engine', () => {
	describe('computeRevenueBasedItems', () => {
		it('computes 6% of revenue for each month', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					ifrsCategory: 'Other General',
					lineItemName: 'PFC Contribution (6%)',
					computeMethod: 'PERCENT_OF_REVENUE',
					entryMode: 'PERCENT_OF_REVENUE',
					computeRate: '0.060000',
				}),
			];

			const revenue: MonthlyRevenueInput[] = [
				{ month: 1, totalRevenue: '5951175.7000' },
				{ month: 2, totalRevenue: '5951175.7000' },
				{ month: 6, totalRevenue: '13571466.7000' },
				{ month: 7, totalRevenue: '4269.1700' },
			];

			const result = computeRevenueBasedItems(lineItems, revenue);

			expect(result.length).toBe(12);
			const jan = result.find((r) => r.month === 1);
			expect(jan?.amount).toBe('357070.5420');
			const jun = result.find((r) => r.month === 6);
			expect(jun?.amount).toBe('814288.0020');
			const jul = result.find((r) => r.month === 7);
			expect(jul?.amount).toBe('256.1502');
		});

		it('skips MANUAL/SEASONAL items', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					lineItemName: 'Rent',
					entryMode: 'SEASONAL',
					monthlyAmounts: makeUniformMonthly(699626.5),
				}),
			];

			const result = computeRevenueBasedItems(lineItems, []);
			expect(result.length).toBe(0);
		});
	});

	describe('computeCategorySubtotals', () => {
		it('aggregates by IFRS category', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					lineItemName: 'Rent',
					monthlyAmounts: makeUniformMonthly(699626.5),
				}),
				makeLineItem({
					id: 2,
					lineItemName: 'Electricity',
					monthlyAmounts: makeUniformMonthly(35000),
				}),
			];

			const result = computeCategorySubtotals(lineItems);
			expect(result.length).toBe(1);
			expect(result[0]!.ifrsCategory).toBe('Rent & Utilities');
			expect(result[0]!.annualTotal).toBe('8815518.0000');

			const janTotal = result[0]!.monthlyTotals.find((m) => m.month === 1);
			expect(janTotal?.amount).toBe('734626.5000');
		});

		it('separates OPERATING and NON_OPERATING categories', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					sectionType: 'OPERATING',
					lineItemName: 'Rent',
					monthlyAmounts: makeUniformMonthly(1000),
				}),
				makeLineItem({
					id: 2,
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Depreciation',
					lineItemName: 'DOA',
					monthlyAmounts: makeUniformMonthly(500),
				}),
			];

			const result = computeCategorySubtotals(lineItems);
			expect(result.length).toBe(2);
			const operating = result.find((r) => r.sectionType === 'OPERATING');
			const nonOperating = result.find((r) => r.sectionType === 'NON_OPERATING');
			expect(operating?.annualTotal).toBe('12000.0000');
			expect(nonOperating?.annualTotal).toBe('6000.0000');
		});
	});

	describe('computeSectionTotals', () => {
		it('aggregates all items by section type', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					sectionType: 'OPERATING',
					lineItemName: 'Rent',
					monthlyAmounts: makeUniformMonthly(1000),
				}),
				makeLineItem({
					id: 2,
					sectionType: 'OPERATING',
					ifrsCategory: 'Insurance',
					lineItemName: 'School Insurance',
					monthlyAmounts: makeUniformMonthly(500),
				}),
				makeLineItem({
					id: 3,
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Depreciation',
					lineItemName: 'DOA',
					monthlyAmounts: makeUniformMonthly(200),
				}),
			];

			const result = computeSectionTotals(lineItems);
			const operating = result.find((r) => r.sectionType === 'OPERATING');
			const nonOperating = result.find((r) => r.sectionType === 'NON_OPERATING');

			expect(operating?.annualTotal).toBe('18000.0000');
			expect(nonOperating?.annualTotal).toBe('2400.0000');
		});
	});

	describe('computeOpEx (full computation)', () => {
		it('integrates PERCENT_OF_REVENUE computation with aggregation', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					lineItemName: 'Rent',
					entryMode: 'SEASONAL',
					monthlyAmounts: makeUniformMonthly(100),
				}),
				makeLineItem({
					id: 2,
					ifrsCategory: 'Other General',
					lineItemName: 'PFC (6%)',
					computeMethod: 'PERCENT_OF_REVENUE',
					entryMode: 'PERCENT_OF_REVENUE',
					computeRate: '0.060000',
					monthlyAmounts: makeUniformMonthly(0),
				}),
			];

			const revenue: MonthlyRevenueInput[] = MONTHS_12.map((m) => ({
				month: m,
				totalRevenue: '10000.0000',
			}));

			const result = computeOpEx(lineItems, revenue);

			expect(result.computedLineItems.length).toBe(12);
			expect(result.computedLineItems[0]!.amount).toBe('600.0000');
			expect(result.totalOperating).toBe('8400.0000'); // (100 + 600) * 12
		});

		it('handles empty line items', () => {
			const result = computeOpEx([], []);
			expect(result.totalOperating).toBe('0.0000');
			expect(result.totalNonOperating).toBe('0.0000');
			expect(result.computedLineItems.length).toBe(0);
		});
	});

	// ── computeEntryModeAmounts ─────────────────────────────────────────────

	describe('computeEntryModeAmounts', () => {
		describe('FLAT mode', () => {
			it('applies same amount to all 12 active months', () => {
				const item = makeLineItem({
					entryMode: 'FLAT',
					flatAmount: '5000.0000',
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				expect(result.length).toBe(12);
				for (const entry of result) {
					expect(entry.amount).toBe('5000.0000');
				}
			});

			it('zeros inactive months with school calendar (10 months)', () => {
				const item = makeLineItem({
					entryMode: 'FLAT',
					flatAmount: '5000.0000',
				});
				const result = computeEntryModeAmounts(item, SCHOOL_10);

				expect(result.length).toBe(12);
				for (const entry of result) {
					if (SCHOOL_10.includes(entry.month)) {
						expect(entry.amount).toBe('5000.0000');
					} else {
						expect(entry.amount).toBe('0.0000');
					}
				}
				expect(result.find((r) => r.month === 7)?.amount).toBe('0.0000');
				expect(result.find((r) => r.month === 8)?.amount).toBe('0.0000');
			});

			it('preserves override months existing values', () => {
				const item = makeLineItem({
					entryMode: 'FLAT',
					flatAmount: '5000.0000',
					flatOverrideMonths: [3, 6],
					monthlyAmounts: MONTHS_12.map((m) => ({
						month: m,
						amount: m === 3 ? '8500.0000' : m === 6 ? '2000.0000' : '0.0000',
					})),
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				expect(result.length).toBe(12);
				// Override months keep their existing values
				expect(result.find((r) => r.month === 3)?.amount).toBe('8500.0000');
				expect(result.find((r) => r.month === 6)?.amount).toBe('2000.0000');
				// Non-override active months get flat amount
				expect(result.find((r) => r.month === 1)?.amount).toBe('5000.0000');
				expect(result.find((r) => r.month === 12)?.amount).toBe('5000.0000');
			});

			it('handles null flatAmount as zero', () => {
				const item = makeLineItem({
					entryMode: 'FLAT',
					flatAmount: null,
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				for (const entry of result) {
					expect(entry.amount).toBe('0.0000');
				}
			});

			it('override months that are inactive get zero (not the override value)', () => {
				const item = makeLineItem({
					entryMode: 'FLAT',
					flatAmount: '5000.0000',
					activeMonths: [1, 2, 3],
					flatOverrideMonths: [7], // month 7 not in activeMonths
					monthlyAmounts: MONTHS_12.map((m) => ({
						month: m,
						amount: m === 7 ? '9999.0000' : '0.0000',
					})),
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				// Month 7 is inactive, so zero regardless of override
				expect(result.find((r) => r.month === 7)?.amount).toBe('0.0000');
				// Active months get flat
				expect(result.find((r) => r.month === 1)?.amount).toBe('5000.0000');
				expect(result.find((r) => r.month === 4)?.amount).toBe('0.0000');
			});

			it('uses item activeMonths over schoolCalendar when non-empty', () => {
				const item = makeLineItem({
					entryMode: 'FLAT',
					flatAmount: '1000.0000',
					activeMonths: [1, 2, 3],
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				let activeCount = 0;
				let zeroCount = 0;
				for (const entry of result) {
					if ([1, 2, 3].includes(entry.month)) {
						expect(entry.amount).toBe('1000.0000');
						activeCount++;
					} else {
						expect(entry.amount).toBe('0.0000');
						zeroCount++;
					}
				}
				expect(activeCount).toBe(3);
				expect(zeroCount).toBe(9);
			});
		});

		describe('ANNUAL_SPREAD mode', () => {
			it('evenly spreads across all 12 months', () => {
				const item = makeLineItem({
					entryMode: 'ANNUAL_SPREAD',
					annualTotal: '120000.0000',
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				expect(result.length).toBe(12);
				// 120000 / 12 = 10000 exactly, no remainder difference
				for (const entry of result) {
					expect(entry.amount).toBe('10000.0000');
				}
			});

			it('spreads across 10 active months with school calendar', () => {
				const item = makeLineItem({
					entryMode: 'ANNUAL_SPREAD',
					annualTotal: '100000.0000',
				});
				const result = computeEntryModeAmounts(item, SCHOOL_10);

				expect(result.length).toBe(12);
				// Jul and Aug are inactive
				expect(result.find((r) => r.month === 7)?.amount).toBe('0.0000');
				expect(result.find((r) => r.month === 8)?.amount).toBe('0.0000');
				// 100000 / 10 = 10000 exactly
				for (const entry of result) {
					if (SCHOOL_10.includes(entry.month)) {
						expect(entry.amount).toBe('10000.0000');
					}
				}
			});

			it('puts remainder on last active month when not evenly divisible', () => {
				// 100000 / 12 = 8333.3333 (rounded to 4 dp)
				// Months 1-11: 8333.3333 each
				// Month 12 (last active): 100000 - 8333.3333 * 11 = 8333.3337
				const item = makeLineItem({
					entryMode: 'ANNUAL_SPREAD',
					annualTotal: '100000.0000',
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				expect(result.length).toBe(12);
				for (let m = 1; m <= 11; m++) {
					expect(result.find((r) => r.month === m)?.amount).toBe('8333.3333');
				}
				expect(result.find((r) => r.month === 12)?.amount).toBe('8333.3337');
			});

			it('returns all zeros when active month count is zero', () => {
				const item = makeLineItem({
					entryMode: 'ANNUAL_SPREAD',
					annualTotal: '100000.0000',
				});
				const result = computeEntryModeAmounts(item, []);

				expect(result.length).toBe(12);
				for (const entry of result) {
					expect(entry.amount).toBe('0.0000');
				}
			});

			it('handles negative total correctly (even division)', () => {
				const item = makeLineItem({
					entryMode: 'ANNUAL_SPREAD',
					annualTotal: '-24000.0000',
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				expect(result.length).toBe(12);
				// -24000 / 12 = -2000 exactly
				for (const entry of result) {
					expect(entry.amount).toBe('-2000.0000');
				}
			});

			it('handles negative total with remainder', () => {
				// -10000 / 3 = -3333.3333 (rounded HALF_UP toward zero = -3333.3333)
				// Months 1,2: -3333.3333 each
				// Month 3 (last): -10000 - (-3333.3333 * 2) = -10000 + 6666.6666 = -3333.3334
				const item = makeLineItem({
					entryMode: 'ANNUAL_SPREAD',
					annualTotal: '-10000.0000',
					activeMonths: [1, 2, 3],
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				expect(result.find((r) => r.month === 1)?.amount).toBe('-3333.3333');
				expect(result.find((r) => r.month === 2)?.amount).toBe('-3333.3333');
				expect(result.find((r) => r.month === 3)?.amount).toBe('-3333.3334');
				// Inactive months
				expect(result.find((r) => r.month === 4)?.amount).toBe('0.0000');
				expect(result.find((r) => r.month === 12)?.amount).toBe('0.0000');
			});

			it('handles null annualTotal as zero', () => {
				const item = makeLineItem({
					entryMode: 'ANNUAL_SPREAD',
					annualTotal: null,
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				for (const entry of result) {
					expect(entry.amount).toBe('0.0000');
				}
			});
		});

		describe('SEASONAL mode', () => {
			it('passes through existing monthlyAmounts', () => {
				const amounts = MONTHS_12.map((m) => ({
					month: m,
					amount: (m * 1000).toFixed(4),
				}));
				const item = makeLineItem({
					entryMode: 'SEASONAL',
					monthlyAmounts: amounts,
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				expect(result.length).toBe(12);
				for (const entry of result) {
					expect(entry.amount).toBe((entry.month * 1000).toFixed(4));
				}
			});

			it('fills missing months with zero', () => {
				const item = makeLineItem({
					entryMode: 'SEASONAL',
					monthlyAmounts: [
						{ month: 1, amount: '5000.0000' },
						{ month: 6, amount: '3000.0000' },
					],
				});
				const result = computeEntryModeAmounts(item, MONTHS_12);

				expect(result.find((r) => r.month === 1)?.amount).toBe('5000.0000');
				expect(result.find((r) => r.month === 6)?.amount).toBe('3000.0000');
				expect(result.find((r) => r.month === 2)?.amount).toBe('0.0000');
				expect(result.find((r) => r.month === 12)?.amount).toBe('0.0000');
			});

			it('zeros inactive months per school calendar', () => {
				const item = makeLineItem({
					entryMode: 'SEASONAL',
					monthlyAmounts: MONTHS_12.map((m) => ({ month: m, amount: '1000.0000' })),
				});
				const result = computeEntryModeAmounts(item, SCHOOL_10);

				expect(result.find((r) => r.month === 7)?.amount).toBe('0.0000');
				expect(result.find((r) => r.month === 8)?.amount).toBe('0.0000');
				expect(result.find((r) => r.month === 1)?.amount).toBe('1000.0000');
				expect(result.find((r) => r.month === 12)?.amount).toBe('1000.0000');
			});
		});
	});

	// ── Full pipeline with entry modes ──────────────────────────────────────

	describe('computeOpEx with entry modes', () => {
		it('resolves FLAT items in the full pipeline', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					entryMode: 'FLAT',
					flatAmount: '5000.0000',
					lineItemName: 'Rent',
				}),
			];

			const result = computeOpEx(lineItems, []);

			// FLAT items produce no computedLineItems (they are not PERCENT_OF_REVENUE)
			expect(result.computedLineItems.length).toBe(0);
			// 5000 * 12 = 60000
			expect(result.totalOperating).toBe('60000.0000');
		});

		it('resolves ANNUAL_SPREAD items in the full pipeline', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					entryMode: 'ANNUAL_SPREAD',
					annualTotal: '120000.0000',
					ifrsCategory: 'Insurance',
					lineItemName: 'Insurance',
				}),
			];

			const result = computeOpEx(lineItems, []);

			expect(result.computedLineItems.length).toBe(0);
			expect(result.totalOperating).toBe('120000.0000');

			const insurance = result.categorySubtotals.find((c) => c.ifrsCategory === 'Insurance');
			expect(insurance?.annualTotal).toBe('120000.0000');
			for (const mt of insurance!.monthlyTotals) {
				expect(mt.amount).toBe('10000.0000');
			}
		});

		it('resolves FLAT with school calendar (10 months) in pipeline', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					entryMode: 'FLAT',
					flatAmount: '5000.0000',
					lineItemName: 'Rent',
				}),
			];

			const result = computeOpEx(lineItems, [], SCHOOL_10);

			// 5000 * 10 = 50000
			expect(result.totalOperating).toBe('50000.0000');

			const section = result.sectionTotals.find((s) => s.sectionType === 'OPERATING');
			expect(section!.monthlyTotals.find((m) => m.month === 7)?.amount).toBe('0.0000');
			expect(section!.monthlyTotals.find((m) => m.month === 8)?.amount).toBe('0.0000');
		});

		it('mixes FLAT, SEASONAL, and PERCENT_OF_REVENUE items', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					entryMode: 'FLAT',
					flatAmount: '1000.0000',
					lineItemName: 'Rent',
				}),
				makeLineItem({
					id: 2,
					entryMode: 'SEASONAL',
					ifrsCategory: 'Insurance',
					lineItemName: 'Insurance',
					monthlyAmounts: makeUniformMonthly(500),
				}),
				makeLineItem({
					id: 3,
					entryMode: 'PERCENT_OF_REVENUE',
					computeMethod: 'PERCENT_OF_REVENUE',
					ifrsCategory: 'Other General',
					lineItemName: 'PFC (6%)',
					computeRate: '0.060000',
				}),
			];

			const revenue: MonthlyRevenueInput[] = MONTHS_12.map((m) => ({
				month: m,
				totalRevenue: '10000.0000',
			}));

			const result = computeOpEx(lineItems, revenue);

			// PFC: 10000 * 0.06 = 600 per month => 12 computed items
			expect(result.computedLineItems.length).toBe(12);
			expect(result.computedLineItems[0]!.amount).toBe('600.0000');
			// Total: (1000 + 500 + 600) * 12 = 25200
			expect(result.totalOperating).toBe('25200.0000');
		});

		it('PERCENT_OF_REVENUE remains unchanged from existing behavior', () => {
			const lineItems: OpExLineItemInput[] = [
				makeLineItem({
					id: 1,
					entryMode: 'PERCENT_OF_REVENUE',
					computeMethod: 'PERCENT_OF_REVENUE',
					ifrsCategory: 'Other General',
					lineItemName: 'PFC (6%)',
					computeRate: '0.060000',
				}),
			];

			const revenue: MonthlyRevenueInput[] = [
				{ month: 1, totalRevenue: '5951175.7000' },
				{ month: 2, totalRevenue: '5951175.7000' },
				{ month: 6, totalRevenue: '13571466.7000' },
				{ month: 7, totalRevenue: '4269.1700' },
			];

			const result = computeOpEx(lineItems, revenue);

			expect(result.computedLineItems.length).toBe(12);
			expect(result.computedLineItems.find((r) => r.month === 1)?.amount).toBe('357070.5420');
			expect(result.computedLineItems.find((r) => r.month === 6)?.amount).toBe('814288.0020');
			expect(result.computedLineItems.find((r) => r.month === 7)?.amount).toBe('256.1502');
		});
	});
});
