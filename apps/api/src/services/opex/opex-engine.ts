/**
 * OpEx Calculation Engine — pure functions, no DB dependencies.
 *
 * Computes:
 * - Category subtotals (monthly + annual)
 * - PERCENT_OF_REVENUE line items (e.g. PFC Contribution = 6% of revenue)
 * - Section totals (operating / non-operating)
 * - Summary KPIs
 */
import { Decimal } from 'decimal.js';

// ── Input Types ──────────────────────────────────────────────────────────────

export interface OpExLineItemInput {
	id: number;
	sectionType: string;
	ifrsCategory: string;
	lineItemName: string;
	computeMethod: string;
	computeRate: string | null;
	monthlyAmounts: { month: number; amount: string }[];
}

export interface MonthlyRevenueInput {
	month: number;
	totalRevenue: string;
}

// ── Output Types ─────────────────────────────────────────────────────────────

export interface CategorySubtotal {
	ifrsCategory: string;
	sectionType: string;
	monthlyTotals: { month: number; amount: string }[];
	annualTotal: string;
}

export interface SectionTotal {
	sectionType: string;
	monthlyTotals: { month: number; amount: string }[];
	annualTotal: string;
}

export interface OpExComputeResult {
	/** Updated monthly amounts for PERCENT_OF_REVENUE line items */
	computedLineItems: { lineItemId: number; month: number; amount: string }[];
	categorySubtotals: CategorySubtotal[];
	sectionTotals: SectionTotal[];
	totalOperating: string;
	totalNonOperating: string;
}

// ── Engine ───────────────────────────────────────────────────────────────────

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Compute PERCENT_OF_REVENUE amounts for line items that use this method.
 * Returns the computed monthly amounts for those line items.
 */
export function computeRevenueBasedItems(
	lineItems: OpExLineItemInput[],
	monthlyRevenue: MonthlyRevenueInput[]
): { lineItemId: number; month: number; amount: string }[] {
	const revenueByMonth = new Map<number, Decimal>();
	for (const rev of monthlyRevenue) {
		revenueByMonth.set(rev.month, new Decimal(rev.totalRevenue));
	}

	const results: { lineItemId: number; month: number; amount: string }[] = [];

	for (const item of lineItems) {
		if (item.computeMethod !== 'PERCENT_OF_REVENUE' || !item.computeRate) continue;

		const rate = new Decimal(item.computeRate);
		for (const month of MONTHS) {
			const revenue = revenueByMonth.get(month) ?? new Decimal(0);
			const amount = revenue.times(rate).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
			results.push({
				lineItemId: item.id,
				month,
				amount: amount.toFixed(4),
			});
		}
	}

	return results;
}

/**
 * Aggregate monthly amounts by IFRS category.
 */
export function computeCategorySubtotals(lineItems: OpExLineItemInput[]): CategorySubtotal[] {
	const categoryMap = new Map<string, { sectionType: string; monthly: Map<number, Decimal> }>();

	for (const item of lineItems) {
		const key = `${item.sectionType}::${item.ifrsCategory}`;
		if (!categoryMap.has(key)) {
			categoryMap.set(key, {
				sectionType: item.sectionType,
				monthly: new Map(),
			});
		}
		const cat = categoryMap.get(key)!;
		for (const ma of item.monthlyAmounts) {
			const prev = cat.monthly.get(ma.month) ?? new Decimal(0);
			cat.monthly.set(ma.month, prev.plus(ma.amount));
		}
	}

	const results: CategorySubtotal[] = [];
	for (const [key, data] of categoryMap) {
		const ifrsCategory = key.split('::')[1]!;
		const monthlyTotals: { month: number; amount: string }[] = [];
		let annual = new Decimal(0);

		for (const month of MONTHS) {
			const amt = data.monthly.get(month) ?? new Decimal(0);
			monthlyTotals.push({ month, amount: amt.toFixed(4) });
			annual = annual.plus(amt);
		}

		results.push({
			ifrsCategory,
			sectionType: data.sectionType,
			monthlyTotals,
			annualTotal: annual.toFixed(4),
		});
	}

	return results;
}

/**
 * Aggregate monthly amounts by section type (OPERATING / NON_OPERATING).
 */
export function computeSectionTotals(lineItems: OpExLineItemInput[]): SectionTotal[] {
	const sectionMap = new Map<string, Map<number, Decimal>>();

	for (const item of lineItems) {
		if (!sectionMap.has(item.sectionType)) {
			sectionMap.set(item.sectionType, new Map());
		}
		const sec = sectionMap.get(item.sectionType)!;
		for (const ma of item.monthlyAmounts) {
			const prev = sec.get(ma.month) ?? new Decimal(0);
			sec.set(ma.month, prev.plus(ma.amount));
		}
	}

	const results: SectionTotal[] = [];
	for (const [sectionType, monthly] of sectionMap) {
		const monthlyTotals: { month: number; amount: string }[] = [];
		let annual = new Decimal(0);

		for (const month of MONTHS) {
			const amt = monthly.get(month) ?? new Decimal(0);
			monthlyTotals.push({ month, amount: amt.toFixed(4) });
			annual = annual.plus(amt);
		}

		results.push({ sectionType, monthlyTotals, annualTotal: annual.toFixed(4) });
	}

	return results;
}

/**
 * Full OpEx computation: compute revenue-based items, then aggregate.
 */
export function computeOpEx(
	lineItems: OpExLineItemInput[],
	monthlyRevenue: MonthlyRevenueInput[]
): OpExComputeResult {
	// Step 1: Compute PERCENT_OF_REVENUE items
	const computedLineItems = computeRevenueBasedItems(lineItems, monthlyRevenue);

	// Step 2: Merge computed amounts back into line items for aggregation
	const computedMap = new Map<string, string>();
	for (const ci of computedLineItems) {
		computedMap.set(`${ci.lineItemId}::${ci.month}`, ci.amount);
	}

	const mergedLineItems: OpExLineItemInput[] = lineItems.map((item) => {
		if (item.computeMethod !== 'PERCENT_OF_REVENUE') return item;

		const mergedMonthly = MONTHS.map((month) => {
			const key = `${item.id}::${month}`;
			return {
				month,
				amount: computedMap.get(key) ?? '0.0000',
			};
		});

		return { ...item, monthlyAmounts: mergedMonthly };
	});

	// Step 3: Aggregate
	const categorySubtotals = computeCategorySubtotals(mergedLineItems);
	const sectionTotals = computeSectionTotals(mergedLineItems);

	const operating = sectionTotals.find((s) => s.sectionType === 'OPERATING');
	const nonOperating = sectionTotals.find((s) => s.sectionType === 'NON_OPERATING');

	return {
		computedLineItems,
		categorySubtotals,
		sectionTotals,
		totalOperating: operating?.annualTotal ?? '0.0000',
		totalNonOperating: nonOperating?.annualTotal ?? '0.0000',
	};
}
