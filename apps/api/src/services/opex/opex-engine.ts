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
	entryMode: string;
	flatAmount: string | null;
	annualTotal: string | null;
	activeMonths: number[];
	flatOverrideMonths: number[];
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
 * Resolve effective active months for a line item.
 * If the item has explicit activeMonths, use those; otherwise fall back to schoolCalendar.
 */
function resolveActiveMonths(item: OpExLineItemInput, schoolCalendar: number[]): Set<number> {
	const months = item.activeMonths.length > 0 ? item.activeMonths : schoolCalendar;
	return new Set(months);
}

/**
 * Compute monthly amounts for a single line item based on its entry mode.
 * Returns exactly 12 entries (months 1-12).
 *
 * - FLAT: active non-override months get flatAmount; override months keep existing; inactive = 0
 * - ANNUAL_SPREAD: annualTotal / activeCount with remainder on last active month; inactive = 0
 * - SEASONAL: passthrough of existing monthlyAmounts; missing months filled with 0; inactive = 0
 */
export function computeEntryModeAmounts(
	item: OpExLineItemInput,
	schoolCalendar: number[]
): { month: number; amount: string }[] {
	const activeSet = resolveActiveMonths(item, schoolCalendar);
	const overrideSet = new Set(item.flatOverrideMonths);

	// Build a lookup for existing monthly amounts
	const existingByMonth = new Map<number, string>();
	for (const ma of item.monthlyAmounts) {
		existingByMonth.set(ma.month, ma.amount);
	}

	if (item.entryMode === 'FLAT') {
		const flatAmt = item.flatAmount ? new Decimal(item.flatAmount) : new Decimal(0);
		return MONTHS.map((month) => {
			if (!activeSet.has(month)) {
				return { month, amount: '0.0000' };
			}
			if (overrideSet.has(month)) {
				// Override months keep their existing monthlyAmounts value
				const existing = existingByMonth.get(month) ?? '0.0000';
				return {
					month,
					amount: new Decimal(existing).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				};
			}
			return {
				month,
				amount: flatAmt.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
			};
		});
	}

	if (item.entryMode === 'ANNUAL_SPREAD') {
		const total = item.annualTotal ? new Decimal(item.annualTotal) : new Decimal(0);
		const activeMonthsSorted = [...activeSet].sort((a, b) => a - b);
		const activeCount = activeMonthsSorted.length;

		if (activeCount === 0) {
			return MONTHS.map((month) => ({ month, amount: '0.0000' }));
		}

		const perMonth = total.dividedBy(activeCount).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
		// Remainder goes to the last active month (highest month number)
		const lastActiveMonth = activeMonthsSorted[activeCount - 1]!;
		const remainder = total.minus(perMonth.times(activeCount - 1));

		return MONTHS.map((month) => {
			if (!activeSet.has(month)) {
				return { month, amount: '0.0000' };
			}
			if (month === lastActiveMonth) {
				return {
					month,
					amount: remainder.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
				};
			}
			return { month, amount: perMonth.toFixed(4) };
		});
	}

	// SEASONAL: passthrough existing monthlyAmounts, zero for inactive months
	return MONTHS.map((month) => {
		if (!activeSet.has(month)) {
			return { month, amount: '0.0000' };
		}
		const existing = existingByMonth.get(month) ?? '0.0000';
		return {
			month,
			amount: new Decimal(existing).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
		};
	});
}

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
		if (item.entryMode !== 'PERCENT_OF_REVENUE' || !item.computeRate) continue;

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
 * Full OpEx computation: resolve entry modes, compute revenue-based items, then aggregate.
 */
export function computeOpEx(
	lineItems: OpExLineItemInput[],
	monthlyRevenue: MonthlyRevenueInput[],
	schoolCalendar: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
): OpExComputeResult {
	// Step 0: Resolve FLAT and ANNUAL_SPREAD entry modes into monthly amounts
	const entryModeResolved: OpExLineItemInput[] = lineItems.map((item) => {
		if (item.entryMode === 'FLAT' || item.entryMode === 'ANNUAL_SPREAD') {
			const resolvedAmounts = computeEntryModeAmounts(item, schoolCalendar);
			return { ...item, monthlyAmounts: resolvedAmounts };
		}
		if (item.entryMode === 'SEASONAL') {
			const resolvedAmounts = computeEntryModeAmounts(item, schoolCalendar);
			return { ...item, monthlyAmounts: resolvedAmounts };
		}
		// PERCENT_OF_REVENUE — monthly amounts will be computed in Step 1
		return item;
	});

	// Step 1: Compute PERCENT_OF_REVENUE items
	const computedLineItems = computeRevenueBasedItems(entryModeResolved, monthlyRevenue);

	// Step 2: Merge computed amounts back into line items for aggregation
	const computedMap = new Map<string, string>();
	for (const ci of computedLineItems) {
		computedMap.set(`${ci.lineItemId}::${ci.month}`, ci.amount);
	}

	const mergedLineItems: OpExLineItemInput[] = entryModeResolved.map((item) => {
		if (item.entryMode !== 'PERCENT_OF_REVENUE') return item;

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
