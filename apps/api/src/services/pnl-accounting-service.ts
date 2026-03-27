// P&L Accounting transformation service — pure functions, no DB dependencies
// Maps analytical P&L lines to an IFRS-structured accounting P&L using a
// configurable template with section definitions and account mappings.
//
// TC-001: All monetary arithmetic uses Decimal.js with ROUND_HALF_UP.
// TC-004: Accumulate full precision, round only at final serialization.

import { Decimal } from 'decimal.js';
import type {
	AccountingPnlView,
	AccountingPnlSection,
	AccountingPnlLine,
	AccountingPnlKpis,
} from '@budfin/types';
import { evaluateFormula } from './pnl-formula-parser.js';
import { toFixed4, toFixed2 } from './decimal-utils.js';

// ── Constants ───────────────────────────────────────────────────────────────

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

// ── Input Types ─────────────────────────────────────────────────────────────

export interface MonthlyPnlLineInput {
	month: number;
	sectionKey: string;
	categoryKey: string;
	lineItemKey: string;
	displayLabel: string;
	depth: number;
	amount: string | Decimal;
	isSubtotal: boolean;
	isSeparator: boolean;
}

export interface MappingInput {
	analyticalKey: string;
	analyticalKeyType: 'CATEGORY' | 'LINE_ITEM';
	accountCode: string | null;
	monthFilter: number[];
	displayLabel: string | null;
	visibility: 'SHOW' | 'GROUP' | 'EXCLUDE';
	displayOrder: number;
}

export interface TemplateSectionInput {
	sectionKey: string;
	displayLabel: string;
	displayOrder: number;
	isSubtotal: boolean;
	subtotalFormula: string | null;
	signConvention: string;
	mappings: MappingInput[];
}

export interface HistoricalActualInput {
	accountCode: string;
	annualAmount: string | Decimal;
}

/** Profit center filter options */
export interface ProfitCenterFilter {
	/** The band to isolate (MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE) */
	band: string;
	/** Headcount for the selected band */
	bandHeadcount: number;
	/** Total headcount across all bands */
	totalHeadcount: number;
}

// ── Internal types ──────────────────────────────────────────────────────────

/** A matched analytical line with its amount and consumed flag */
interface MatchedLine {
	lineItemKey: string;
	categoryKey: string;
	month: number;
	amount: Decimal;
	consumed: boolean;
}

// ── Matching helpers ────────────────────────────────────────────────────────

/**
 * LINE_ITEM matching uses prefix match: analyticalKey "OPEX_AGENCE" matches
 * lineItemKey "OPEX_AGENCE_ENSEIGNEMENT_FRANCAIS". This is more robust than
 * exact equality because lineItemKey values are derived from safeKey(name)
 * and the exact suffix depends on user-entered line item names.
 *
 * For CATEGORY matching, exact equality is used since categoryKey values are
 * stable engine constants (TUITION_FEES, LOCAL_SALARIES, etc.).
 */
function matchesKey(line: MatchedLine, mapping: MappingInput): boolean {
	if (mapping.analyticalKeyType === 'LINE_ITEM') {
		return (
			line.lineItemKey === mapping.analyticalKey ||
			line.lineItemKey.startsWith(mapping.analyticalKey + '_')
		);
	}
	return line.categoryKey === mapping.analyticalKey;
}

// ── Main transformation ─────────────────────────────────────────────────────

/**
 * Transform analytical P&L lines into an IFRS-structured accounting P&L.
 *
 * Algorithm (two-pass to prevent cross-section consumption):
 * 1. Filter to depth===3, isSubtotal===false, isSeparator===false (detail rows)
 * 2. Build actuals index from historical data
 * 3. GLOBAL PASS 1: Process ALL LINE_ITEM mappings across all sections first.
 *    This ensures specific line items (e.g., EOS_PROVISION) are claimed by
 *    their target section before a broad CATEGORY mapping (EMPLOYER_CHARGES)
 *    in another section can consume them. Uses prefix matching.
 * 4. PASS 2: Process CATEGORY mappings per section in display order.
 *    When the same categoryKey appears multiple times in one section (e.g.,
 *    LOCAL_SALARIES → 641100/641400/641200), the total is computed once and
 *    assigned to the first mapping. Later mappings for the same key get zero.
 *    (Proper department-based splitting requires employee data — see spec §6.)
 * 5. Evaluate subtotal formulas for computed sections (GP, EBITDA, etc.)
 * 6. Compute variance when actuals are available
 * 7. Derive KPIs from section totals
 */
export function transformToAccountingPnl(
	pnlLines: MonthlyPnlLineInput[],
	sections: TemplateSectionInput[],
	historicalActuals?: HistoricalActualInput[],
	profitCenterFilter?: ProfitCenterFilter
): AccountingPnlView {
	// Step 1: Filter to detail rows only (depth 3, not subtotals, not separators)
	const detailLines: MatchedLine[] = pnlLines
		.filter((line) => line.depth === 3 && !line.isSubtotal && !line.isSeparator)
		.map((line) => ({
			lineItemKey: line.lineItemKey,
			categoryKey: line.categoryKey,
			month: line.month,
			amount: new Decimal(line.amount.toString()),
			consumed: false,
		}));

	// Step 1b: Apply profit center allocation if a filter is active.
	// Revenue lines (REVENUE_CONTRACTS, RENTAL_INCOME) are filtered to the grade
	// band matching the profit center. Cost lines are weighted by headcount ratio.
	if (profitCenterFilter && profitCenterFilter.totalHeadcount > 0) {
		const ratio = new Decimal(profitCenterFilter.bandHeadcount).dividedBy(
			profitCenterFilter.totalHeadcount
		);
		const bandUpper = profitCenterFilter.band.toUpperCase();
		const revenueKeys = new Set([
			'TUITION_FEES',
			'REGISTRATION_FEES',
			'ACTIVITIES_SERVICES',
			'EXAMINATION_FEES',
		]);

		for (const line of detailLines) {
			if (revenueKeys.has(line.categoryKey)) {
				// Revenue: check if the lineItemKey contains the band name (e.g., TUITION_MATERNELLE)
				// If not, apply headcount ratio as an approximation
				if (!line.lineItemKey.toUpperCase().includes(bandUpper)) {
					line.amount = line.amount.times(ratio);
				}
				// Lines matching the band keep their full amount
			} else {
				// Costs and other items: allocate by headcount ratio
				line.amount = line.amount.times(ratio);
			}
		}
	}

	// Step 2: Build actuals index keyed by accountCode
	const actualsIndex = new Map<string, Decimal>();
	if (historicalActuals) {
		for (const actual of historicalActuals) {
			const existing = actualsIndex.get(actual.accountCode) ?? ZERO;
			actualsIndex.set(
				actual.accountCode,
				existing.plus(new Decimal(actual.annualAmount.toString()))
			);
		}
	}
	const hasActuals = actualsIndex.size > 0;

	const sortedSections = [...sections].sort((a, b) => a.displayOrder - b.displayOrder);

	// ── Step 3: GLOBAL LINE_ITEM pass ────────────────────────────────────────
	// Collect all LINE_ITEM mappings from all non-subtotal sections, ordered by
	// section displayOrder then mapping displayOrder. Process them globally so
	// specific line items are claimed regardless of section ordering.
	type LineItemResult = {
		sectionKey: string;
		mapping: MappingInput;
		total: Decimal;
	};
	const lineItemResults: LineItemResult[] = [];

	for (const section of sortedSections) {
		if (section.isSubtotal) continue;

		const lineItemMappings = section.mappings
			.filter((m) => m.analyticalKeyType === 'LINE_ITEM')
			.sort((a, b) => a.displayOrder - b.displayOrder);

		for (const mapping of lineItemMappings) {
			let mappingTotal = ZERO;

			for (const line of detailLines) {
				if (line.consumed) continue;
				if (!matchesKey(line, mapping)) continue;
				if (mapping.monthFilter.length > 0 && !mapping.monthFilter.includes(line.month)) {
					continue;
				}
				mappingTotal = mappingTotal.plus(line.amount);
				line.consumed = true;
			}

			lineItemResults.push({
				sectionKey: section.sectionKey,
				mapping,
				total: mappingTotal,
			});
		}
	}

	// ── Step 4: CATEGORY pass per section ────────────────────────────────────
	const sectionTotals = new Map<string, Decimal>();
	const outputSections: AccountingPnlSection[] = [];

	for (const section of sortedSections) {
		if (section.isSubtotal) {
			const subtotal = section.subtotalFormula
				? evaluateFormula(section.subtotalFormula, sectionTotals)
				: ZERO;

			sectionTotals.set(section.sectionKey, subtotal);

			outputSections.push({
				sectionKey: section.sectionKey,
				displayLabel: section.displayLabel,
				displayOrder: section.displayOrder,
				isSubtotal: true,
				signConvention: section.signConvention as 'POSITIVE' | 'NEGATIVE',
				lines: [],
				budgetSubtotal: toFixed4(subtotal),
			});
			continue;
		}

		// Gather pre-computed LINE_ITEM results for this section
		const sectionLineItemResults = lineItemResults.filter(
			(r) => r.sectionKey === section.sectionKey
		);

		// Process CATEGORY mappings. Lines are consumed per-line (not per-key),
		// so month-filtered mappings with the same categoryKey (e.g., TUITION_FEES
		// × T1/T2/T3) naturally partition by month — no conflict. Same-key mappings
		// WITHOUT month filters (e.g., LOCAL_SALARIES × 3) see the first mapping
		// consume all lines, leaving zero for subsequent ones. Proper splitting of
		// LOCAL_SALARIES by department requires employee data (see spec §6).
		const categoryMappings = section.mappings
			.filter((m) => m.analyticalKeyType === 'CATEGORY')
			.sort((a, b) => a.displayOrder - b.displayOrder);

		type MappingResult = { mapping: MappingInput; total: Decimal };
		const categoryResults: MappingResult[] = [];

		for (const mapping of categoryMappings) {
			let mappingTotal = ZERO;

			for (const line of detailLines) {
				if (line.consumed) continue;
				if (!matchesKey(line, mapping)) continue;
				if (mapping.monthFilter.length > 0 && !mapping.monthFilter.includes(line.month)) {
					continue;
				}
				mappingTotal = mappingTotal.plus(line.amount);
				line.consumed = true;
			}

			categoryResults.push({ mapping, total: mappingTotal });
		}

		// Merge LINE_ITEM + CATEGORY results and build output lines
		const allResults: MappingResult[] = [
			...sectionLineItemResults.map((r) => ({ mapping: r.mapping, total: r.total })),
			...categoryResults,
		];
		// Sort by displayOrder for final output
		allResults.sort((a, b) => a.mapping.displayOrder - b.mapping.displayOrder);

		const showLines: AccountingPnlLine[] = [];
		let groupTotal = ZERO;
		let sectionBudgetTotal = ZERO;
		let sectionActualTotal: Decimal | undefined = hasActuals ? ZERO : undefined;

		for (const { mapping, total: mappingTotal } of allResults) {
			if (mapping.visibility === 'EXCLUDE') {
				continue;
			}

			let actualAmount: Decimal | undefined;
			if (hasActuals && mapping.accountCode) {
				actualAmount = actualsIndex.get(mapping.accountCode) ?? ZERO;
				sectionActualTotal = sectionActualTotal!.plus(actualAmount);
			}

			sectionBudgetTotal = sectionBudgetTotal.plus(mappingTotal);

			if (mapping.visibility === 'SHOW') {
				const line: AccountingPnlLine = {
					displayLabel: mapping.displayLabel ?? mapping.analyticalKey,
					budgetAmount: toFixed4(mappingTotal),
				};

				if (mapping.accountCode) {
					line.accountCode = mapping.accountCode;
				}

				if (hasActuals && actualAmount !== undefined) {
					line.actualAmount = toFixed4(actualAmount);
					const variance = mappingTotal.minus(actualAmount);
					line.variance = toFixed4(variance);
					line.variancePct = actualAmount.abs().isZero()
						? '0.00'
						: toFixed2(variance.dividedBy(actualAmount.abs()).times(HUNDRED));
				}

				showLines.push(line);
			} else if (mapping.visibility === 'GROUP') {
				groupTotal = groupTotal.plus(mappingTotal);
			}
		}

		sectionTotals.set(section.sectionKey, sectionBudgetTotal);

		const outputSection: AccountingPnlSection = {
			sectionKey: section.sectionKey,
			displayLabel: section.displayLabel,
			displayOrder: section.displayOrder,
			isSubtotal: false,
			signConvention: section.signConvention as 'POSITIVE' | 'NEGATIVE',
			lines: showLines,
			budgetSubtotal: toFixed4(sectionBudgetTotal),
		};

		if (!groupTotal.isZero()) {
			outputSection.othersAmount = toFixed4(groupTotal);
		}

		if (hasActuals && sectionActualTotal !== undefined) {
			outputSection.actualSubtotal = toFixed4(sectionActualTotal);
			const variance = sectionBudgetTotal.minus(sectionActualTotal);
			outputSection.varianceSubtotal = toFixed4(variance);
			outputSection.variancePctSubtotal = sectionActualTotal.abs().isZero()
				? '0.00'
				: toFixed2(variance.dividedBy(sectionActualTotal.abs()).times(HUNDRED));
		}

		outputSections.push(outputSection);
	}

	// Step 7: Compute KPIs from section totals
	const kpis = computeKpis(sectionTotals);

	return {
		sections: outputSections,
		kpis,
	};
}

// ── KPI computation ─────────────────────────────────────────────────────────

function computeKpis(sectionTotals: Map<string, Decimal>): AccountingPnlKpis {
	const revenue = sectionTotals.get('REVENUE') ?? ZERO;
	const grossProfit = sectionTotals.get('GROSS_PROFIT') ?? ZERO;
	const ebitda = sectionTotals.get('EBITDA') ?? ZERO;
	const netProfit = sectionTotals.get('NET_PROFIT') ?? ZERO;

	const gpMargin = revenue.isZero() ? ZERO : grossProfit.dividedBy(revenue).times(HUNDRED);

	const ebitdaMargin = revenue.isZero() ? ZERO : ebitda.dividedBy(revenue).times(HUNDRED);

	return {
		revenue: toFixed4(revenue),
		grossProfit: toFixed4(grossProfit),
		gpMargin: toFixed2(gpMargin),
		ebitda: toFixed4(ebitda),
		ebitdaMargin: toFixed2(ebitdaMargin),
		netProfit: toFixed4(netProfit),
	};
}
