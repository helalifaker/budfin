import { describe, it, expect } from 'vitest';
import {
	computeRevenueBasedItems,
	computeCategorySubtotals,
	computeSectionTotals,
	computeOpEx,
	type OpExLineItemInput,
	type MonthlyRevenueInput,
} from './opex-engine.js';

const MONTHS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function makeUniformMonthly(value: number): { month: number; amount: string }[] {
	return MONTHS_12.map((m) => ({ month: m, amount: value.toFixed(4) }));
}

describe('opex-engine', () => {
	describe('computeRevenueBasedItems', () => {
		it('computes 6% of revenue for each month', () => {
			const lineItems: OpExLineItemInput[] = [
				{
					id: 1,
					sectionType: 'OPERATING',
					ifrsCategory: 'Other General',
					lineItemName: 'PFC Contribution (6%)',
					computeMethod: 'PERCENT_OF_REVENUE',
					computeRate: '0.060000',
					monthlyAmounts: makeUniformMonthly(0),
				},
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

		it('skips MANUAL items', () => {
			const lineItems: OpExLineItemInput[] = [
				{
					id: 1,
					sectionType: 'OPERATING',
					ifrsCategory: 'Rent & Utilities',
					lineItemName: 'Rent',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(699626.5),
				},
			];

			const result = computeRevenueBasedItems(lineItems, []);
			expect(result.length).toBe(0);
		});
	});

	describe('computeCategorySubtotals', () => {
		it('aggregates by IFRS category', () => {
			const lineItems: OpExLineItemInput[] = [
				{
					id: 1,
					sectionType: 'OPERATING',
					ifrsCategory: 'Rent & Utilities',
					lineItemName: 'Rent',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(699626.5),
				},
				{
					id: 2,
					sectionType: 'OPERATING',
					ifrsCategory: 'Rent & Utilities',
					lineItemName: 'Electricity',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(35000),
				},
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
				{
					id: 1,
					sectionType: 'OPERATING',
					ifrsCategory: 'Rent & Utilities',
					lineItemName: 'Rent',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(1000),
				},
				{
					id: 2,
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Depreciation',
					lineItemName: 'DOA',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(500),
				},
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
				{
					id: 1,
					sectionType: 'OPERATING',
					ifrsCategory: 'Rent & Utilities',
					lineItemName: 'Rent',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(1000),
				},
				{
					id: 2,
					sectionType: 'OPERATING',
					ifrsCategory: 'Insurance',
					lineItemName: 'School Insurance',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(500),
				},
				{
					id: 3,
					sectionType: 'NON_OPERATING',
					ifrsCategory: 'Depreciation',
					lineItemName: 'DOA',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(200),
				},
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
				{
					id: 1,
					sectionType: 'OPERATING',
					ifrsCategory: 'Rent & Utilities',
					lineItemName: 'Rent',
					computeMethod: 'MANUAL',
					computeRate: null,
					monthlyAmounts: makeUniformMonthly(100),
				},
				{
					id: 2,
					sectionType: 'OPERATING',
					ifrsCategory: 'Other General',
					lineItemName: 'PFC (6%)',
					computeMethod: 'PERCENT_OF_REVENUE',
					computeRate: '0.060000',
					monthlyAmounts: makeUniformMonthly(0),
				},
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
});
