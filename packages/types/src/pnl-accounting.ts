// P&L Accounting Bridge types for @budfin/types
// Used by the IFRS-structured accounting P&L view

// ── Accounting P&L Line ─────────────────────────────────────────────────────

export interface AccountingPnlLine {
	displayLabel: string;
	budgetAmount: string;
	actualAmount?: string;
	variance?: string;
	variancePct?: string;
	accountCode?: string;
}

// ── Accounting P&L Section ──────────────────────────────────────────────────

export interface AccountingPnlSection {
	sectionKey: string;
	displayLabel: string;
	displayOrder: number;
	isSubtotal: boolean;
	signConvention: 'POSITIVE' | 'NEGATIVE';
	lines: AccountingPnlLine[];
	othersAmount?: string;
	budgetSubtotal: string;
	actualSubtotal?: string;
	varianceSubtotal?: string;
	variancePctSubtotal?: string;
}

// ── Accounting P&L KPIs ─────────────────────────────────────────────────────

export interface AccountingPnlKpis {
	revenue: string;
	grossProfit: string;
	gpMargin: string;
	ebitda: string;
	ebitdaMargin: string;
	netProfit: string;
}

// ── Accounting P&L View (top-level response) ────────────────────────────────

export interface AccountingPnlView {
	sections: AccountingPnlSection[];
	kpis: AccountingPnlKpis;
}
