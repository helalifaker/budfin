# P&L Page Redesign Spec

**Date:** 2026-03-25
**Status:** Approved
**Approach:** Full Pattern Alignment (Approach 1)

## Problem

The P&L page is the only planning module that doesn't follow BudFin's established design patterns. It uses wrong design tokens, has no inspector integration, no row interactivity, no animated KPIs, and no shared component usage. It feels like a second-class page compared to Revenue and Staffing.

## Goals

1. Match Revenue/Staffing page architecture exactly
2. Full inspector integration with row-click detail views
3. Shared component reuse (KpiCard, CalculateButton, ToggleGroup, InspectorSection, SummaryTable, ChartWrapper, Counter, WorkflowStatusCard)
4. Design token consistency throughout (zero hardcoded colors)
5. Viewport-contained layout (no page-level scroll)
6. Professional number formatting with accounting conventions
7. Smooth animations matching rest of app

## Non-Goals

- New API endpoints (existing hooks are sufficient)
- "Detailed" P&L format as a separate grid view (detail lives in the inspector now)
- Comparison version diff grid (variance data shows in inspector when comparison selected)

## Design

### Page Layout

Viewport-contained flex column:

```tsx
<div className="flex h-full flex-col overflow-hidden">
    toolbar (shrink-0) stale banner (shrink-0, conditional) KPI ribbon (shrink-0) status strip
    (shrink-0) grid (flex-1 min-h-0 overflow-y-auto)
</div>
```

### Toolbar

- `ToggleGroup` (shadcn/ui) for format selection: Summary | Detailed | IFRS
- `CalculateButton` (shared) with spinner/check/error states
- Export button placeholder
- Calls `setActivePage('pnl')` on mount, clears on unmount

### KPI Ribbon

4 cards using shared `KpiCard` component:

| Card             | Icon       | Accent                    | Subtitle                                      |
| ---------------- | ---------- | ------------------------- | --------------------------------------------- |
| Total Revenue HT | DollarSign | `var(--color-info)`       | "Gross revenue before costs"                  |
| EBITDA           | TrendingUp | dynamic green/red         | "Earnings before interest, tax, depreciation" |
| EBITDA Margin    | BarChart3  | dynamic green/warning/red | "Operating profitability ratio"               |
| Net Profit       | Landmark   | dynamic green/red         | "Bottom line after all charges"               |

Features: `animate-kpi-enter` stagger, `Counter` animation, `border-l-[3px]` accent, `font-display`, `isStale` pulsing dot.

### Status Strip

`PnlStatusStrip` component showing:

- Last calculated timestamp
- Stale module warnings with navigation links

### P&L Grid

TanStack Table with full design token system:

- **Header:** `bg-(--workspace-bg-muted)`, `text-(--text-xs) font-medium uppercase tracking-wider text-(--text-muted)`
- **Numeric cells:** `font-[family-name:var(--font-mono)] tabular-nums text-right`
- **Borders:** `border-(--workspace-border)`
- **Subtotal rows:** `bg-(--workspace-bg-subtle) font-semibold`
- **Section headers (depth 1):** `bg-(--workspace-bg-muted) font-semibold`
- **Separators:** `h-1` spacer, no dashing
- **Negative values:** `text-(--color-error)` with parentheses `(1,234,567)`
- **Zero values:** `--` in `text-(--text-muted)`
- **FY Total column:** `font-medium`, subtle `bg-(--workspace-bg-subtle)` background
- **Sticky header:** `sticky top-0 z-10 bg-(--workspace-bg-card)`

**Row interactivity:**

- Section headers + subtotal rows are clickable
- `hover:bg-(--workspace-bg-muted) cursor-pointer transition-colors duration-(--duration-fast)`
- Selected row: `bg-(--accent-50) border-l-[3px] border-l-(--accent-500)`
- Click sets `pnl-selection-store` and opens right panel

### Selection Store

`pnl-selection-store.ts` (Zustand):

```ts
type PnlSelection = {
    sectionKey: string;
    displayLabel: string;
    depth: 1 | 2 | 3;
    isSubtotal: boolean;
    monthlyAmounts: string[];
    annualTotal: string;
    comparisonMonthlyAmounts?: string[];
    comparisonAnnualTotal?: string;
    varianceMonthlyAmounts?: string[];
    varianceAnnualTotal?: string;
    varianceAnnualPercent?: string;
};
```

### Inspector

Registered via `registerPanelContent('pnl', PnlInspectorContent)`.

**Default view (no selection):**

1. `WorkflowStatusCard` -- P&L workflow status
2. `InspectorSection` "P&L Summary" -- SummaryTable with major lines + annual totals + % of revenue
3. `InspectorSection` "Cost Structure" -- pie chart (Revenue vs Staff vs OpEx vs Depreciation)
4. `InspectorSection` "Monthly Trend" -- bar chart of monthly net profit
5. `InspectorSection` "Quick links" -- navigate to Revenue, Staffing, OpEx

**Active view (row selected):**

1. Back button + section badge + heading (Revenue inspector pattern)
2. KpiCard pair: section annual total + % of revenue
3. `InspectorSection` "Monthly trend" -- bar chart of section's monthly amounts
4. `InspectorSection` "Line items" -- SummaryTable with child line items
5. `InspectorSection` "Variance" (conditional) -- variance amounts + percentages with green/red
6. Navigation link to relevant module

Transitions: `animate-inspector-crossfade` / `animate-inspector-slide-in`.

### Stale Banner

- `rounded-lg border border-(--color-warning)/20 bg-(--color-warning-bg) px-4 py-3`
- `AlertTriangle` icon
- Clickable upstream module links

### Empty State

- Centered in flex-1 area
- `Landmark` icon in muted circle
- Heading + subtitle
- `CalculateButton` if permitted
- `animate-slide-up` entrance

## Files

| File                                       | Action  |
| ------------------------------------------ | ------- |
| `stores/pnl-selection-store.ts`            | New     |
| `components/pnl/pnl-inspector-content.tsx` | New     |
| `components/pnl/pnl-page.tsx`              | Rewrite |
| `components/pnl/pnl-page.test.tsx`         | Update  |

No new dependencies. No API changes.
