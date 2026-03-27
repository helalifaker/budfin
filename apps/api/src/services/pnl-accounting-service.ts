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

// ── Internal types ──────────────────────────────────────────────────────────

/** A matched analytical line with its amount and consumed flag */
interface MatchedLine {
	lineItemKey: string;
	categoryKey: string;
	month: number;
	amount: Decimal;
	consumed: boolean;
}

// ── Main transformation ─────────────────────────────────────────────────────

/**
 * Transform analytical P&L lines into an IFRS-structured accounting P&L.
 *
 * Algorithm:
 * 1. Filter to depth===3, isSubtotal===false, isSeparator===false (detail rows)
 * 2. Build actuals index from historical data
 * 3. Process mappings: LINE_ITEM first, then CATEGORY (prevents double-counting)
 * 4. Separate SHOW lines from GROUP lines (rolled into "Others")
 * 5. Evaluate subtotal formulas for computed sections (GP, EBITDA, etc.)
 * 6. Compute variance when actuals are available
 * 7. Derive KPIs from section totals
 */
export function transformToAccountingPnl(
	pnlLines: MonthlyPnlLineInput[],
	sections: TemplateSectionInput[],
	historicalActuals?: HistoricalActualInput[]
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

	// Step 3 & 4: Process each section
	const sectionTotals = new Map<string, Decimal>();
	const sortedSections = [...sections].sort((a, b) => a.displayOrder - b.displayOrder);

	const outputSections: AccountingPnlSection[] = [];

	for (const section of sortedSections) {
		if (section.isSubtotal) {
			// Subtotal sections: evaluate formula against accumulated section totals
			const subtotal = section.subtotalFormula
				? evaluateFormula(section.subtotalFormula, sectionTotals)
				: ZERO;

			sectionTotals.set(section.sectionKey, subtotal);

			const outputSection: AccountingPnlSection = {
				sectionKey: section.sectionKey,
				displayLabel: section.displayLabel,
				displayOrder: section.displayOrder,
				isSubtotal: true,
				signConvention: section.signConvention as 'POSITIVE' | 'NEGATIVE',
				lines: [],
				budgetSubtotal: toFixed4(subtotal),
			};

			outputSections.push(outputSection);
			continue;
		}

		// Non-subtotal section: process mappings
		const showLines: AccountingPnlLine[] = [];
		let groupTotal = ZERO;
		let sectionBudgetTotal = ZERO;
		let sectionActualTotal: Decimal | undefined = hasActuals ? ZERO : undefined;

		const sortedMappings = [...section.mappings].sort((a, b) => {
			if (a.analyticalKeyType !== b.analyticalKeyType) {
				return a.analyticalKeyType === 'LINE_ITEM' ? -1 : 1;
			}
			return a.displayOrder - b.displayOrder;
		});

		for (const mapping of sortedMappings) {
			// Sum matching lines
			let mappingTotal = ZERO;

			for (const line of detailLines) {
				if (line.consumed) continue;

				const matches =
					mapping.analyticalKeyType === 'LINE_ITEM'
						? line.lineItemKey === mapping.analyticalKey
						: line.categoryKey === mapping.analyticalKey;

				if (!matches) continue;

				// Apply month filter if specified
				if (mapping.monthFilter.length > 0 && !mapping.monthFilter.includes(line.month)) {
					continue;
				}

				mappingTotal = mappingTotal.plus(line.amount);
				line.consumed = true;
			}

			if (mapping.visibility === 'EXCLUDE') {
				continue;
			}

			// Look up actuals by accountCode
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
