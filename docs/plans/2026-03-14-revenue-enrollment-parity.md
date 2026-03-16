# Feature Spec: Revenue Page -- Enrollment Parity & Fee Grid Redesign

> **Epic:** 17 (#197) | **Phase:** 4 -- SPECIFY | **Status:** Revised (post-review) | **Date:** 2026-03-14
> **Predecessor:** Epic 16 -- Revenue Workspace Redesign (DONE)
> **Standard:** Enrollment page (`apps/web/src/pages/planning/enrollment.tsx`) is the gold standard
> **Revision:** Incorporates findings from two independent architecture reviews (R-01 through R-20, RPA-01 through RPA-20)

---

## Summary

Epic 16 shipped the Revenue workspace with a forecast grid, settings dialog, inspector, KPI ribbon, and status strip. However, the result diverges significantly from the Enrollment page in visual consistency, interaction patterns, feature depth, and component reuse. This epic closes every gap so that both planning workspaces feel like the same product.

The four major workstreams are:

1. **Design system enforcement** -- fix CSS uniformity gaps, extract shared primitives, eliminate hardcoded values, add token governance
2. **Shared primitive extraction** -- extract KPI cards, inspector sections, summary tables, chart wrappers, and workflow cards into shared components used by both modules
3. **Forecast grid + inspector parity** -- migrate to PlanningGrid, match right-panel behavior, add Guide tab, enforce keyboard/ARIA parity
4. **Fee grid redesign** -- restructure from flat table to EFIR fee schedule layout (nationality sections, band rows, term columns) with unified section chrome

**No backend changes.** All API endpoints, calculation engine, and data model remain unchanged from Epic 16.

**Frontend-only validation:** Fee grid ownership assumptions have been validated against the existing data model. `FeeGridEntry` records with `category = 'autres_frais'` already exist and are owned by the Fee Grid tab. `RevenueConfig` rates and `OtherRevenueDriver` records are owned by the Other Revenue tab. No storage contract changes are required.

---

## Parity Invariants

These are the non-negotiable behavioral contracts inherited from Enrollment. Revenue must preserve every one. They are not acceptance criteria -- they are architectural constraints that every story must respect.

| #      | Invariant                                                                                                                                                                                                                                                                                                                                           | Enforcement                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| INV-1  | **Fixed-height workspace frame**: banners, toolbar, KPI, status = `shrink-0`; grid zone = `flex-1 min-h-0 overflow-hidden` owning vertical scroll. The page itself never scrolls.                                                                                                                                                                   | `enrollment.tsx:327`                  |
| INV-2  | **Toolbar action zoning**: left side = filters / working context; right side = export / settings / calculate. Button order communicates workflow priority.                                                                                                                                                                                          | `enrollment.tsx:365-418`              |
| INV-3  | **Selection/panel synchronization**: select row = open Details tab; reselect same row = clear + close panel; close panel = clear selection; keyboard Enter = same as click; subtotal/total/group-header rows are non-selectable. Selecting a row while on any other tab (Guide, Activity, Audit) switches the panel to the Details tab.             | `enrollment-selection-store.ts:19-28` |
| INV-4  | **Default + active inspector modes**: no selection = general overview (workflow, readiness, summaries); selection = object-specific detail (KPI cards, charts, breakdowns, formula). Transition uses `animate-inspector-crossfade`.                                                                                                                 | `enrollment-inspector.tsx`            |
| INV-5  | **Guide tab populated per module**: Right panel Guide tab renders module-specific contextual help via `registerGuideContent()` registry, never placeholder text or cross-module content when `activePage` is set.                                                                                                                                   | `right-panel.tsx:156-163`             |
| INV-6  | **Trust cues visible without scrolling**: version lock/imported/viewer banners, last calculated timestamp, dirty count, downstream stale pills -- all in fixed `shrink-0` zones.                                                                                                                                                                    | `enrollment-status-strip.tsx`         |
| INV-7  | **Shared visual tokens**: all cards, grids, badges, charts use CSS custom properties exclusively. No hardcoded hex, no hardcoded font sizes, no hardcoded border radii. Enforced by automated token audit (QA-06).                                                                                                                                  | `index.css`                           |
| INV-8  | **Keyboard/accessibility**: arrow key grid navigation, Enter for selection, Escape to clear, `aria-selected` on active row, focus trap in dialogs, `role="grid"` on tables (including read-only forecast grid).                                                                                                                                     | `planning-grid.tsx`                   |
| INV-9  | **Chart styling invariant**: All Recharts charts use CSS variable fills resolved via `useChartColor()` hook, `contentStyle` with token-based border radius (`var(--radius-md)`), `<ResponsiveContainer>` for width adaptation, and `--chart-tick-size`/`--chart-tooltip-size` tokens for font sizes. No fixed-width charts in resizable containers. | New                                   |
| INV-10 | **Monetary formatting invariant**: All monetary values use a single shared formatter (`formatMoney`). The formatter uses `fr-FR` locale with thousands separator. Currency suffix (SAR) is shown only in fee grid contexts, not in forecast grids or inspector tables.                                                                              | New                                   |
| INV-11 | **Motion/animation invariant**: All new animation classes are disabled under `@media (prefers-reduced-motion: reduce)`. KPI entrance uses `animate-kpi-enter` with `60ms` stagger (matching enrollment). Inspector view transitions use `animate-inspector-crossfade`.                                                                              | New                                   |

**Where parity ends and module-specific behavior begins**: Revenue and Enrollment share the same interaction architecture, visual language, and workflow grammar. Module-specific controls are allowed where the domain requires them:

- Revenue keeps view-mode toggles (Category/Grade/Nationality/Tariff) because Enrollment doesn't need them.
- Revenue keeps the period toggle (AY1/AY2/FY2026) in the toolbar left zone because Revenue forecasts span multiple periods.
- Revenue removes Quick Edit because the forecast grid is read-only (calculation output, not input surface).
- Revenue uses a fullscreen settings dialog (not a sheet) because the fee schedule + 4 configuration areas require more space than Enrollment's simpler settings.

---

## Period Toggle Contract

The Revenue toolbar includes an AY1/AY2/FY2026 period toggle (`ToggleGroup`) in the toolbar left zone. This toggle affects the entire workspace state.

### Behavior rules

| Event                 | Behavior                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Period change         | Clears selection, closes panel, re-fetches forecast data for the selected period               |
| View mode change      | Does NOT clear period. Period is independent of view mode.                                     |
| Export with period    | Exported filename includes period context (e.g., `revenue-forecast-grade-AY1-2026-03-14.xlsx`) |
| Inspector with period | Inspector breakdowns show data for the active period only                                      |
| Default period        | `both` (FY2026) -- shows combined AY1+AY2 data                                                 |

### Toolbar left zone ordering

`[ViewMode toggle] [Period toggle] [BandFilter (grade view only)] [ExceptionFilter]`

### Toolbar right zone ordering

`[Export] [Revenue Settings] [Calculate]`

---

## Revenue Row Identity Contract

Revenue row selection must use a stable identity structure, not display labels alone.

```typescript
interface RevenueGridRowIdentity {
    id: string; // deterministic: `${viewMode}-${code}` e.g. "grade-CP", "category-tuition"
    code: string; // canonical identifier: grade code, category slug, nationality code, tariff code
    label: string; // display name: "Cours Preparatoire CP", "Tuition Fees", "Francais", "Plein"
    viewMode: RevenueViewMode;
    rowType: 'data' | 'subtotal' | 'total' | 'group-header';
    band?: string; // when viewMode === 'grade'
    groupKey?: string; // when viewMode === 'nationality' or 'tariff'
    settingsTarget?: RevenueSettingsTab; // deep-link target for "Edit in Settings"
}
```

**Selection rules:**

- Only `rowType === 'data'` rows are selectable.
- Selection equality uses `id` (not `label`).
- Changing `viewMode` clears selection, closes panel, and clears band filter.
- Changing `period` clears selection and closes panel.
- When a filter change hides the currently selected row, selection is cleared and panel returns to default view.
- Selecting a row while on any panel tab (Guide, Activity, Audit) switches the panel to the `details` tab.
- Inspector deep links use `settingsTarget` for "Edit in Settings" routing.

---

## Grid Metric Semantics

Each view mode must define what the cell values represent. Grand totals must reconcile across views.

| View Mode       | Row dimension                                                            | Cell metric                                             | Grand total                                    |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------- |
| **Category**    | Revenue categories (Tuition, Discounts, Registration, Activities, Exams) | Category total (monthly + annual)                       | Total Operating Revenue                        |
| **Grade**       | 15 grade levels                                                          | Gross tuition contribution per grade (monthly + annual) | Sum of all grades = Gross Tuition total        |
| **Nationality** | Francais, Nationaux, Autres                                              | Gross tuition contribution per nationality              | Sum of all nationalities = Gross Tuition total |
| **Tariff**      | Plein, RP, R3+                                                           | Gross tuition contribution per tariff                   | Sum of all tariffs = Gross Tuition total       |

**Reconciliation rule**: Grade, Nationality, and Tariff views all show gross tuition sliced differently. Their grand totals must all equal the "Tuition Fees" row in Category view. Category view shows the complete operating revenue picture including discounts, registration, activities, and exams. Assertion must use `Decimal.eq()`, not `===`.

**Inspector breakdown rule**: When a row is selected, the inspector shows breakdowns across the OTHER dimensions. The base measure is always the same metric shown in the grid cells for that view mode.

**Period interaction**: All grid values reflect the active period. When period is `AY1` or `AY2`, monthly columns show only the months in that period. When period is `both`, all 12 months are shown.

---

## Fee Schedule Writeback Rules

The fee schedule transforms flat `FeeGridEntry[]` storage rows into an aggregated EFIR presentation. Editing requires explicit writeback rules.

### Row editability classification

| Section          | Row type                   | Editability         | Writeback rule                                                                                      |
| ---------------- | -------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| **Tuition**      | PS standalone              | **Editable-source** | 1:1 map to PS FeeGridEntry rows for that nationality/tariff                                         |
| **Tuition**      | MS+GS combined             | **Editable-fanout** | Edit replaces both MS and GS underlying rows with the new value (they share identical fees at EFIR) |
| **Tuition**      | Elementaire band           | **Editable-fanout** | Edit replaces all CP, CE1, CE2, CM1, CM2 underlying rows with the new value                         |
| **Tuition**      | College band               | **Editable-fanout** | Edit replaces all 6eme, 5eme, 4eme, 3eme underlying rows with the new value                         |
| **Tuition**      | Lycee band                 | **Editable-fanout** | Edit replaces all 2nde, 1ere, Tle underlying rows with the new value                                |
| **Tuition**      | Nationality section header | **Non-editable**    | Group header only                                                                                   |
| **Autres Frais** | Each fee type row          | **Editable-source** | 1:1 map to OtherRevenueItem records                                                                 |
| **Abattement**   | Normal rate column         | **Summary-only**    | Derived from Tuition section (read-only)                                                            |
| **Abattement**   | Reduced rate column        | **Summary-only**    | Derived from discount % applied to normal rate (read-only)                                          |

### Fan-out writeback semantics

**Fan-out replaces all underlying values with the aggregate value.** This is not a delta distribution.

Example: If Elementaire shows 34,500 and user changes to 35,000, then CP, CE1, CE2, CM1, CM2 all become 35,000. The previous individual values are overwritten.

**Rounding rule:** Fan-out applies Decimal.js `ROUND_HALF_UP`. Since fan-out replaces (not distributes), rounding only applies to the user's input value itself, not to division across rows.

### Heterogeneous underlying values

If underlying grade-level rows within a band have different fee values (e.g., CP=34,500 but CE1=35,000), the aggregate row displays the value only if all underlying rows are identical. If they differ:

- The cell shows a warning indicator (amber dot) with tooltip: "Mixed values across grades"
- Editing is disabled for that cell -- user must click the chevron toggle to expand and edit individual grades
- Expanded grade rows appear in-line below the band row with indented labels and individual editable cells
- The chevron toggle collapses back to the band row after editing
- This is the safety net preventing silent data corruption

### HT/TTC semantics

| Column     | Tax treatment                        | Storage field                                      |
| ---------- | ------------------------------------ | -------------------------------------------------- |
| DAI        | TTC (fixed fee)                      | `FeeGridEntry.dai`                                 |
| Tuition HT | HT (before tax)                      | `FeeGridEntry.tuitionHt`                           |
| Term 1/2/3 | TTC amounts                          | `FeeGridEntry.term1Amount/term2Amount/term3Amount` |
| Total TTC  | Derived: `tuitionHt * (1 + taxRate)` | Not stored -- computed from tuitionHt + tax        |

Tax rate is not editable in the fee grid. It is a system-level configuration parameter.

### Round-trip guarantee

`FeeGridEntry[] -> FeeScheduleSection[] -> user edit -> writeback -> FeeGridEntry[]` must be round-trippable for all editable rows. Test: transform -> save -> re-fetch -> transform again -> compare. Values must match exactly (Decimal.js precision, using `.eq()`).

### Read-only affordance rules

Each editability mode has distinct, documented visual affordances:

| Mode                            | Cursor               | Focus                        | Background                           | Border                           | Helper                                                              |
| ------------------------------- | -------------------- | ---------------------------- | ------------------------------------ | -------------------------------- | ------------------------------------------------------------------- |
| **Editable-source**             | `cursor-text`        | Focusable, editable on click | `bg-white`                           | `border-(--grid-compact-border)` | None                                                                |
| **Editable-fanout**             | `cursor-text`        | Focusable, editable on click | `bg-(--color-info-bg)` (subtle tint) | `border-(--grid-compact-border)` | Tooltip: "Edits X underlying grades"                                |
| **Summary-only**                | `cursor-default`     | Not focusable                | `bg-(--workspace-bg-muted)`          | None                             | `aria-readonly="true"`                                              |
| **Mixed-value warning**         | `cursor-not-allowed` | Not focusable                | `bg-(--color-warning-bg)`            | Amber left accent                | `aria-disabled="true"`, `aria-describedby` pointing to warning text |
| **Read-only (imported/viewer)** | `cursor-default`     | Not focusable                | `bg-(--workspace-bg-muted)`          | None                             | `aria-readonly="true"`, tooltip: "Read-only"                        |

---

## Readiness / Settings Tab Reconciliation

The readiness model has 5 areas but the settings dialog has 4 tabs. This must be normalized.

| #   | Readiness area        | Settings tab                   | Resolution                            |
| --- | --------------------- | ------------------------------ | ------------------------------------- |
| 1   | Fee Grid              | `feeGrid` tab                  | 1:1                                   |
| 2   | Tariff Assignment     | `tariffAssignment` tab         | 1:1                                   |
| 3   | Discounts             | `discounts` tab                | 1:1                                   |
| 4   | Derived Revenue Rates | `otherRevenue` tab (section 1) | Shares tab with Other Revenue         |
| 5   | Other Revenue         | `otherRevenue` tab (section 2) | Shares tab with Derived Revenue Rates |

**Display rules:**

- Progress summary shows "X/5 complete" (5 readiness areas, not 4 tabs).
- The `otherRevenue` tab shows TWO readiness dots in its trigger: one for Derived Revenue Rates, one for Other Revenue Drivers.
- Sidebar readiness dots: 3 tabs show 1 dot each; `otherRevenue` tab shows 2 dots (or a combined indicator showing "1/2" or "2/2").
- Deep links from readiness counters route to the correct tab AND scroll to the relevant section within the tab.

---

## Fee Grid Tab vs Other Revenue Tab -- Ownership Split

The `Autres Frais` section in the fee schedule and the `otherRevenue` settings tab both deal with non-tuition revenue, but they own different row families. This distinction must be respected by all stories.

### Fee Grid tab (`feeGrid`) -- EFIR fee schedule items

These are **school-fee schedule items** that appear on the EFIR fee document and are charged per-student:

| Row family                 | Examples                                                      | Storage                                              |
| -------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Tuition fees               | PS, MS+GS, Elementaire, College, Lycee per nationality/tariff | `FeeGridEntry` rows                                  |
| Autres Frais (school fees) | Frais de Dossier, DPI, Evaluation, Garderie, Diplomes         | `FeeGridEntry` rows with `category = 'autres_frais'` |

The `Autres Frais` section in the fee schedule is a **visual grouping within the Fee Grid tab**. It shows per-student fees that are part of the EFIR fee document but are not tuition. These rows are editable-source (1:1 map to underlying storage rows).

### Other Revenue tab (`otherRevenue`) -- Non-fee operating revenue drivers

These are **revenue streams that are NOT per-student fees** and do NOT appear on the EFIR fee document:

| Row family                               | Examples                                                           | Storage                      |
| ---------------------------------------- | ------------------------------------------------------------------ | ---------------------------- |
| Derived Revenue Rates (readiness area 4) | Registration fee rate, exam fee rate, activity fee rate            | `RevenueConfig` fields       |
| Other Revenue Drivers (readiness area 5) | Cafeteria revenue, transport revenue, rental income, miscellaneous | `OtherRevenueDriver` records |

The `otherRevenue` tab has two distinct sections with independent readiness tracking:

- **Section 1 -- Derived Revenue Rates**: rates applied to enrollment counts to compute registration/exam/activity revenue. Readiness = all rates configured and non-zero.
- **Section 2 -- Other Revenue Drivers**: flat revenue amounts not tied to enrollment. Readiness = at least one driver configured OR explicitly marked "no other revenue."

### Summary rule

> If it appears on the EFIR fee document and is charged per-student, it belongs in the **Fee Grid tab**.
> If it is a revenue stream independent of the fee schedule, it belongs in the **Other Revenue tab**.

This split means:

- The Fee Grid tab owns `FeeGridEntry` records (tuition + autres frais).
- The Other Revenue tab owns `RevenueConfig` rates + `OtherRevenueDriver` records.
- No data is editable from two surfaces simultaneously.

---

## Filtered Total Label Parity

When filters change the visible dataset in the forecast grid, the total row label must reflect that state. This matches Enrollment's behavior.

### Rules

| Filter state                         | Total row label                 | Behavior                              |
| ------------------------------------ | ------------------------------- | ------------------------------------- |
| No filters active                    | **Grand Total**                 | Shows sum of all visible rows         |
| Band filter active (grade view only) | **Filtered Total (Maternelle)** | Label includes the active band name   |
| Exception filter active              | **Filtered Total**              | Generic filtered label                |
| Both band + exception filter         | **Filtered Total (Maternelle)** | Band name takes precedence in label   |
| View mode switch                     | Resets to **Grand Total**       | Changing view mode clears all filters |

### Export interaction

- When exporting with active filters, the exported total row uses the same filtered label shown in the grid.
- The export filename includes the filter context (e.g., `revenue-forecast-grade-maternelle-2026-03-14.xlsx`).
- The export filename includes the period context (e.g., `revenue-forecast-grade-AY1-2026-03-14.xlsx`).

---

## Shared Primitives Contract

These shared components must be created (or verified existing) and used by both Enrollment and Revenue. They are the primary mechanism for preventing visual drift.

### Primitive catalog

| Primitive                | Location                            | API                                                                                        | Used by                                                  |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| **KpiCard**              | `shared/kpi-card.tsx`               | `{ label, value, subtitle, icon, accentVariant, animationDelay? }`                         | Enrollment KPI ribbon, Revenue KPI ribbon                |
| **InspectorSection**     | `shared/inspector-section.tsx`      | `{ title, icon?, action?, children }` -- renders the rounded card with border, bg, padding | Enrollment inspector, Revenue inspector                  |
| **SummaryTable**         | `shared/summary-table.tsx`          | `{ rows: Array<{ dot?, label, amount, percent? }>, header? }`                              | Both inspectors for band/nationality/category breakdowns |
| **WorkflowStatusCard**   | `shared/workflow-status-card.tsx`   | `{ label, status, statusVariant, icon }` -- semantic left-border accent                    | Both inspectors' workflow section                        |
| **FormulaCard**          | `shared/formula-card.tsx`           | `{ title, formula, icon? }` -- calculation explanation                                     | Both inspectors' formula section                         |
| **ReadinessIndicator**   | `shared/readiness-indicator.tsx`    | `{ ready, total, size? }` -- colored dot or progress indicator                             | Settings sidebar, inspector readiness counters           |
| **StalePill**            | `shared/stale-pill.tsx`             | `{ label }` -- downstream stale module badge                                               | Both status strips                                       |
| **ChartWrapper**         | `shared/chart-wrapper.tsx`          | `{ children, height? }` -- ResponsiveContainer + tooltip/axis token defaults               | All Recharts usage in both inspectors                    |
| **CalculateButton**      | `shared/calculate-button.tsx`       | `{ onCalculate, isPending, isSuccess, isError, disabled? }`                                | Both toolbars                                            |
| **FilterPillMenu**       | `shared/filter-pill-menu.tsx`       | `{ filters: FilterConfig[], value, onChange }`                                             | Both toolbars                                            |
| **GuideSection**         | `shared/guide-section.tsx`          | `{ title, icon, children }` -- collapsible section                                         | Both guide contents                                      |
| **WorkspaceStatusStrip** | `shared/workspace-status-strip.tsx` | `{ sections: StatusSection[] }`                                                            | Both status strips                                       |

### StatusSection schema

```typescript
interface StatusSection {
    key: string;
    label: string;
    value: ReactNode;
    severity?: 'default' | 'warning' | 'success' | 'error';
    badge?: boolean; // renders as pill badge
    priority?: number; // ordering within the strip
}
```

### FilterConfig schema

```typescript
interface FilterConfig {
    value: string;
    label: string;
    description?: string;
    icon?: LucideIcon;
}
```

### Chart utilities

```typescript
// lib/chart-utils.ts

/**
 * Hook that resolves CSS custom properties to SVG-compatible color strings.
 * Caches results per token name. Re-resolves on theme change.
 */
function useChartColor(tokenName: string): string;

/**
 * Pre-configured Recharts tooltip contentStyle using CSS tokens.
 */
const CHART_TOOLTIP_STYLE = {
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--chart-tooltip-border)',
    fontSize: 'var(--chart-tooltip-size)',
};
```

### Monetary formatting consolidation

```typescript
// lib/format-money.ts

/**
 * Single shared monetary formatter. Replaces formatSar, formatCompactSar,
 * formatRevenueGridAmount with one function.
 */
function formatMoney(
    value: number | Decimal,
    options?: {
        showCurrency?: boolean; // default: false. When true, appends " SAR"
        compact?: boolean; // default: false. When true, uses compact notation (e.g., "34.5K")
    }
): string;
```

---

## CSS Token Additions

### Chart series tokens

```css
--chart-series-1: var(--color-info); /* #2463EB -> blue */
--chart-series-2: var(--color-success); /* #16A34A -> green */
--chart-series-3: var(--color-warning); /* #D97706 -> amber */
--chart-series-4: var(--color-error); /* #DC2626 -> red */
--chart-series-5: var(--color-purple); /* #7C3AED -> purple */
```

### Chart typography tokens

```css
--chart-tick-size: 11px;
--chart-tooltip-size: 12px;
--chart-tooltip-border: var(--workspace-border);
```

### Nationality badge tokens

```css
--badge-francais: var(--color-info); /* blue */
--badge-francais-bg: var(--color-info-bg);
--badge-nationaux: var(--color-success); /* green */
--badge-nationaux-bg: var(--color-success-bg);
--badge-autres: var(--color-warning); /* amber */
--badge-autres-bg: var(--color-warning-bg);
```

### Tariff group tokens

```css
--tariff-plein: var(--color-info);
--tariff-plein-bg: var(--color-info-bg);
--tariff-rp: var(--color-success);
--tariff-rp-bg: var(--color-success-bg);
--tariff-r3plus: var(--color-warning);
--tariff-r3plus-bg: var(--color-warning-bg);
```

### Additional tokens

```css
--kpi-stagger-delay: 60ms; /* matches enrollment */
--selected-row-accent: var(--accent-50);
```

---

## Acceptance Criteria

### CSS & Design System (DS)

- [ ] DS-01: Zero hardcoded hex colors in any `apps/web/src/components/revenue/`, `apps/web/src/lib/revenue-*`, or shared components used by Revenue. All colors use CSS custom properties.
- [ ] DS-02: Revenue KPI cards use shared `KpiCard` primitive with `rounded-xl`, `border-l-[3px]`, `shadow-(--shadow-card-elevated)`, and `hover:shadow-(--shadow-card-hover)` -- identical to enrollment KPI cards.
- [ ] DS-03: Revenue KPI ribbon uses `sm:grid-cols-2 lg:grid-cols-4` responsive breakpoints -- matching enrollment.
- [ ] DS-04: All Recharts chart font sizes use CSS variable tokens (`--chart-tick-size: 11px`, `--chart-tooltip-size: 12px`) instead of hardcoded pixel values.
- [ ] DS-05: Recharts tooltip uses `contentStyle` with token-based values: `{ borderRadius: 'var(--radius-md)', border: '1px solid var(--chart-tooltip-border)', fontSize: 'var(--chart-tooltip-size)' }`.
- [ ] DS-06: CSS tokens `--chart-series-1` through `--chart-series-5` exist in `index.css` with values: `var(--color-info)`, `var(--color-success)`, `var(--color-warning)`, `var(--color-error)`, `var(--color-purple)`.
- [ ] DS-07: CSS tokens `--badge-francais`, `--badge-nationaux`, `--badge-autres` (with `-bg` variants) exist with values: `var(--color-info)`, `var(--color-success)`, `var(--color-warning)` respectively.
- [ ] DS-08: All Recharts charts use `<ResponsiveContainer>` or width-adaptive rendering. No fixed-width charts in resizable containers (inspector panel).
- [ ] DS-09: A shared `useChartColor(tokenName: string): string` hook exists in `lib/chart-utils.ts` for resolving CSS custom properties to SVG-compatible hex values via `getComputedStyle`.
- [ ] DS-10: All new animation classes (`animate-kpi-enter`, `animate-inspector-crossfade`, stagger reveals) are disabled under `@media (prefers-reduced-motion: reduce)`.
- [ ] DS-11: Tariff group tokens `--tariff-plein`, `--tariff-rp`, `--tariff-r3plus` (with `-bg` variants) exist in `index.css`.

### Shared Components (SC)

- [ ] SC-01: `CalculateButton` lives at `shared/calculate-button.tsx` with API: `{ onCalculate, isPending, isSuccess, isError, disabled? }`. Both enrollment and revenue import from this location. Old enrollment import path re-exports for backward compatibility.
- [ ] SC-02: `BAND_STYLES`, `BAND_LABELS`, `BAND_DOT_COLORS` live at `lib/band-styles.ts`. `NATIONALITY_STYLES`, `NATIONALITY_LABELS`, `TARIFF_STYLES`, `TARIFF_LABELS` also live there. Domain ordering/labels are separated from visual style maps. Both enrollment and revenue import from this shared location.
- [ ] SC-03: A generalized `FilterPillMenu` component exists at `shared/filter-pill-menu.tsx` accepting a `filters: FilterConfig[]` prop with `{ value, label, description?, icon? }` schema. Enrollment's `ExceptionFilterMenu` wraps it with enrollment-specific filters.
- [ ] SC-04: A shared `GuideSection` component exists at `shared/guide-section.tsx` (extracted from enrollment guide). Both enrollment and revenue guide content import from it.
- [ ] SC-05: A shared `WorkspaceStatusStrip` component exists at `shared/workspace-status-strip.tsx` accepting `sections: StatusSection[]` config with strongly-typed schema. Both enrollment and revenue status strips are thin wrappers.
- [ ] SC-06: A shared `KpiCard` primitive exists at `shared/kpi-card.tsx`. Both enrollment and revenue KPI ribbons compose it. No module builds its own KPI card JSX inline.
- [ ] SC-07: A shared `InspectorSection` component exists at `shared/inspector-section.tsx` accepting `title`, `icon?`, `action?`, and `children` props. Both enrollment and revenue inspectors use it for all sidebar sections.
- [ ] SC-08: A shared `SummaryTable` component exists at `shared/summary-table.tsx` accepting `{ rows: Array<{ dot?, label, amount, percent? }>, header? }`. Both inspectors use it for breakdown tables.
- [ ] SC-09: A shared `ReadinessIndicator` component exists at `shared/readiness-indicator.tsx` for status dots, readiness counts, and tab indicators. Used by settings sidebar and inspector readiness counters.
- [ ] SC-10: A shared `ChartWrapper` component exists at `shared/chart-wrapper.tsx` wrapping `<ResponsiveContainer>` with default tooltip/axis token configuration. All Recharts usage goes through it.

### Page Layout (PL)

- [ ] PL-01: Revenue page outer container uses `flex h-full min-h-0 flex-col overflow-hidden` -- grid scrolls independently, toolbar/KPI/status stay fixed. Explicitly removes `space-y-4`, `pb-6`, and any `rounded-2xl` on grid/status/toolbar children.
- [ ] PL-02: Revenue toolbar is a flat strip with `border-b border-(--workspace-border) px-6 py-2` -- not a rounded card. Explicitly removes `rounded-2xl`, `shadow-(--shadow-xs)`, and `bg-(--workspace-bg-card)`.
- [ ] PL-03: Banners (version lock, imported, viewer) use `shrink-0` with `border-b` -- matching enrollment. Explicitly removes `rounded-lg`. Full-width expansion. Import/viewer banner includes action button pattern matching enrollment (e.g., "Open Version Management").
- [ ] PL-04: Forecast grid zone uses `flex-1 min-h-0 overflow-hidden px-6 py-2` with inner `h-full overflow-y-auto scrollbar-thin`.

### Settings & Setup Merge (SM)

- [ ] SM-01: "Setup" button is removed from the toolbar. Only "Revenue Settings" remains. The merged settings dialog inherits all setup affordances (readiness dots, guided flow, auto-navigate).
- [ ] SM-02: Revenue Settings dialog sidebar shows a colored dot per tab: green circle for ready, orange circle for needs-attention. Uses shared `ReadinessIndicator`.
- [ ] SM-03: Revenue Settings dialog sidebar shows progress summary below tab list: "X/5 complete".
- [ ] SM-04: When settings dialog opens and setup is incomplete, a progress bar shows at the top: "Complete N remaining steps to enable revenue calculation".
- [ ] SM-05: When setup is incomplete, the dialog auto-navigates to the first incomplete tab.
- [ ] SM-06: Settings dialog auto-opens on first page visit when setup is incomplete (replaces standalone setup checklist auto-open logic). Does not auto-open in read-only/imported/viewer mode.

### Forecast Grid (FG)

- [ ] FG-01: Forecast grid uses the shared `PlanningGrid` component from `data-grid/planning-grid.tsx` with `role="grid"` (forced via prop, not dependent on editability). Supports keyboard navigation in read-only mode.
- [ ] FG-02: Grade view shows band-grouped rows (MATERNELLE/ELEMENTAIRE/COLLEGE/LYCEE) with colored section headers using `BAND_STYLES` -- identical to enrollment master grid.
- [ ] FG-03: Grade view shows subtotal rows per band (dark background `--grid-subtotal-bg`, white text) and a grand total row (`--grid-grandtotal-bg`).
- [ ] FG-04: Nationality view shows nationality-grouped rows (Francais/Nationaux/Autres) with colored section headers using `NATIONALITY_STYLES`.
- [ ] FG-05: Tariff view shows tariff-grouped rows (Plein/RP/R3+) with colored section headers using `TARIFF_STYLES`.
- [ ] FG-06: Category view is flat (no grouping) with the total row styled as grand total. Income rows have default styling; discount row has `text-(--color-error)` left-border accent.
- [ ] FG-07: First column ("label") is pinned left (sticky) with border-right shadow -- matching enrollment.
- [ ] FG-08: All numeric columns are right-aligned with `font-[family-name:var(--font-mono)] tabular-nums`.
- [ ] FG-09: Full keyboard navigation: arrow keys move active cell, Tab/Shift+Tab cycle through columns, Enter selects row. This works in read-only mode via PlanningGrid's existing keyboard navigation.
- [ ] FG-10: When any filter is active, the grand total row label changes from "Grand Total" to "Filtered Total" (with band name suffix when band filter is active). Clearing all filters restores "Grand Total."

### Grid-Panel Integration (GP)

- [ ] GP-01: Clicking a non-total/non-subtotal row in the forecast grid opens the right panel Details tab and sets the selection. The sidebar immediately updates to show contextual information for that row.
- [ ] GP-02: Clicking the same row again deselects it and closes the right panel (toggle behavior -- matching enrollment).
- [ ] GP-03: Closing the right panel clears the revenue selection (sync behavior -- matching enrollment).
- [ ] GP-04: Selecting a row opens the Details tab; deselecting closes the panel. Implementation integrates `useRevenueSelectionStore` with `useRightPanelStore`.
- [ ] GP-05: The selected row in the grid shows `bg-(--accent-50)` highlight and `aria-selected="true"` -- matching enrollment's selected row styling.
- [ ] GP-06: Keyboard Enter on a focused grid row triggers the same selection behavior as clicking.
- [ ] GP-07: Selecting a revenue row always switches the right panel to the `details` tab, even if the user was previously on `guide`, `activity`, or `audit`.
- [ ] GP-08: Changing the revenue period clears selection and closes the panel.
- [ ] GP-09: When a filter change hides the currently selected row, selection is cleared and the panel returns to the default inspector view.

### Revenue Inspector -- Default View (RD) -- No row selected

When no row is selected, the sidebar shows a **general revenue overview** with 9 sections. All sections use the shared `InspectorSection` component.

- [ ] RD-01: Section 1 -- **Workflow status card**: Uses shared `WorkflowStatusCard` with "Revenue Workflow" label + status ("Setup complete" / "Setup pending" / "Review mode") with semantic left-border accent (`--color-success` / `--color-warning` / `--color-info`) and shield icon.
- [ ] RD-02: Section 2 -- **Readiness counters** in 2-column grid: "Config coverage" (X/5 ready) and "Validation issues" (count of non-ready areas). Uses shared `ReadinessIndicator`.
- [ ] RD-03: Section 3 -- **Revenue assumptions table**: Key-value table using shared `SummaryTable` showing: RP discount rate (e.g., "25%"), R3+ discount rate (e.g., "10%"), total enrolled students, enrollment data source. Action row at bottom: "Open Revenue Settings" button.
- [ ] RD-04: Section 4 -- **Recommended workflow** with 4 icon-labeled steps: (1) Configure fee grid, (2) Assign tariffs, (3) Set discounts, (4) Calculate revenue. Each with icon, title, description. Staggered reveal animation (`60ms` per step).
- [ ] RD-05: Section 5 -- **Validation queue table**: Columns: Area | Status | Action. Rows for each non-ready area from readiness endpoint. Status shows green/orange dot + "Ready" / "Needs attention" using shared `ReadinessIndicator`. Action is "Edit" link opening settings to that tab. Empty state: "All areas configured. Revenue is ready to calculate."
- [ ] RD-06: Section 6 -- **Revenue by Band summary table**: Uses shared `SummaryTable`. Columns: Band (with colored dot) | Gross | Net | % of Total. 4 rows (Maternelle, Elementaire, College, Lycee).
- [ ] RD-07: Section 7 -- **Revenue by Nationality summary table**: Uses shared `SummaryTable`. Columns: Nationality | Amount | % of Total. 3 rows (Francais, Nationaux, Autres).
- [ ] RD-08: Section 8 -- **Revenue composition donut chart** (Recharts PieChart inside shared `ChartWrapper`): Shows revenue breakdown by category. Uses CSS variable chart series colors via `useChartColor()`.
- [ ] RD-09: Section 9 -- **Monthly trend bar chart** (Recharts BarChart inside shared `ChartWrapper`): 12 bars showing monthly total operating revenue. Uses CSS variable fill colors via `useChartColor()`.
- [ ] RD-10: Revenue default inspector sections use the same section spacing, card elevation, heading hierarchy, and padding as enrollment inspector sections -- enforced by shared `InspectorSection` primitive.

### Revenue Inspector -- Active View (RA) -- Row selected

When a row is selected, the sidebar transitions (using `animate-inspector-crossfade`) to show **detailed contextual information for that specific row**. The content adapts based on the current view mode. All sections use shared `InspectorSection`.

**Header (all view modes):**

- [ ] RA-01: Back button (ArrowLeft icon) that clears selection and returns to default view. Focus returns to the originating selected grid row.
- [ ] RA-02: View mode badge (colored pill showing "Category" / "Grade" / "Nationality" / "Tariff") -- equivalent to enrollment's band badge.
- [ ] RA-03: Row label as heading (display font, large) -- matching enrollment's grade name heading.
- [ ] RA-04: Row code badge (rounded pill with muted text showing the row identifier).

**KPI Cards (all view modes):**

- [ ] RA-05: 2-column grid with two shared `KpiCard` components:
    - **Card 1 -- Gross Revenue**: Shows total gross tuition/fees for this row. Subtitle: headcount contribution (e.g., "132 students" for a grade, "Francais" for a nationality).
    - **Card 2 -- Net Revenue**: Shows gross minus discounts. Subtitle: "X.X% discount impact" showing effective discount rate.

**Monthly Trend Chart:**

- [ ] RA-06: Recharts BarChart inside shared `ChartWrapper` showing the selected row's 12-month revenue profile. Fill color resolved via `useChartColor()` matching the row's group color (band color for grades, nationality color for nationalities, tariff color for tariffs, accent for categories).

**Contextual Breakdowns (adapts per view mode):**

- [ ] RA-07: When viewMode is **"category"** (e.g., "Tuition Fees" selected):
    - Breakdown by Band: shared `SummaryTable` showing band name with dot, tuition amount, % of total tuition
    - Breakdown by Nationality: shared `SummaryTable` showing nationality, amount, % of total
    - Breakdown by Tariff: shared `SummaryTable` showing tariff tier, amount, % of total
    - "Edit in Settings" button linking to the relevant settings tab (Fee Grid for Tuition, Discounts for Discount Impact, Other Revenue for other categories)

- [ ] RA-08: When viewMode is **"grade"** (e.g., "Cours Preparatoire CP" selected):
    - Breakdown by Nationality: shared `SummaryTable` showing Fr/Nat/Aut amounts and headcounts
    - Breakdown by Tariff: shared `SummaryTable` showing Plein/RP/R3+ amounts
    - Breakdown by Category: shared `SummaryTable` showing Tuition/Discount/Other amounts
    - Fee summary: DAI + Tuition HT + Term breakdown for this grade (from fee grid data)
    - "Edit in Settings" button linking to Fee Grid tab

- [ ] RA-09: When viewMode is **"nationality"** (e.g., "Francais" selected):
    - Breakdown by Band: shared `SummaryTable` showing band name with dot, amount, %
    - Breakdown by Tariff: shared `SummaryTable` showing Plein/RP/R3+ amounts
    - Breakdown by Category: shared `SummaryTable` showing Tuition/Discount/Other amounts
    - "Edit in Settings" button linking to Tariff Assignment tab

- [ ] RA-10: When viewMode is **"tariff"** (e.g., "Plein" selected):
    - Breakdown by Band: shared `SummaryTable` showing band name with dot, amount, %
    - Breakdown by Nationality: shared `SummaryTable` showing Fr/Nat/Aut amounts
    - Breakdown by Category: shared `SummaryTable` showing Tuition/Discount/Other amounts
    - "Edit in Settings" button linking to Fee Grid tab

**Formula Explanation:**

- [ ] RA-11: Uses shared `FormulaCard` with Sigma icon showing the revenue formula for this row. Example for a grade: "132 students x 34,500 SAR (Tuition HT) - 8,625 SAR (R3+ discount for 12 students) = Net 4,542,000 SAR".

**Group Context:**

- [ ] RA-12: When in grade view, show the band's aggregate context (e.g., "Elementaire band: 618 students, 20.0M SAR gross, 33.9% of tuition").

**Breakdown Table Constraints:**

- [ ] RA-13: Each breakdown table (shared `SummaryTable`) shows max 5 rows. If more rows exist, show top 5 by amount with "and N more..." link.
- [ ] RA-14: All amounts in breakdown tables use `font-[family-name:var(--font-mono)] tabular-nums` and the shared `formatMoney()` formatter.
- [ ] RA-15: Revenue inspector default and active sections all use the shared `InspectorSection` primitive. No local one-off card shells.

### Inspector Transitions (RI)

- [ ] RI-01: Inspector container has `aria-live="polite"` for announcing content changes on selection/deselection to screen readers.
- [ ] RI-02: Inspector view transitions (default to active and back) use `animate-inspector-crossfade` class for smooth content swap. Animation is disabled under `prefers-reduced-motion: reduce`.

### Revenue Guide Content (RG)

- [ ] RG-01: Right panel Guide tab renders `RevenueGuideContent` when `activePage === 'revenue'` via `registerGuideContent('revenue', RevenueGuideContent)` -- not hardcoded conditional.
- [ ] RG-02: Guide content has 6 collapsible sections using shared `GuideSection` component: Workflow Overview, Revenue Calculation Formula, PS Fee Structure, Discount Policies, Nationality-Tariff Mapping, Revenue Validation.
- [ ] RG-03: Each section has a Lucide icon and collapsible content with `aria-expanded` -- matching enrollment guide.

### Toolbar Features (TF)

- [ ] TF-01: When `viewMode === 'grade'`, a band filter toggle group appears (All/Mat/Elem/Col/Lyc) -- matching enrollment.
- [ ] TF-02: A revenue exception filter menu appears wrapping shared `FilterPillMenu` with filters: All, Missing Fees, Missing Tariffs, High Discount, Zero Revenue.
- [ ] TF-03: Calculate button uses the shared `CalculateButton` component with 4 states (idle/pending/success/error) and Lucide icons.
- [ ] TF-04: Right side of toolbar: Export, Revenue Settings, Calculate. All `size="sm"`.
- [ ] TF-05: Left side of toolbar: ViewMode toggle, Period toggle, BandFilter (grade view only), ExceptionFilter.

### KPI Ribbon (KR)

- [ ] KR-01: Revenue KPI ribbon shows 4 cards (not 5): Net Tuition HT (with discount % subtitle), Other Revenue, Total Operating Revenue, SAR per Student. Explicitly removes Gross Tuition and Total Discounts as standalone cards from the previous 5-card layout.
- [ ] KR-02: Each card uses shared `KpiCard` primitive with icon circle (Lucide icon) -- matching enrollment's KPI card pattern.
- [ ] KR-03: Cards use `animate-kpi-enter` with staggered `animationDelay` (`60ms` x index) -- matching enrollment's actual 60ms delay.
- [ ] KR-04: Cards adopt `Counter` component from `shared/counter.tsx` for animated number display and `Sparkline` from `shared/sparkline.tsx` for trend visualization.

### Status Strip (SS)

- [ ] SS-01: Revenue status strip uses flat `border-b` style -- no rounded corners, no box shadow, no `bg-(--workspace-bg-card)`. Matching enrollment's flat inline strip.
- [ ] SS-02: Downstream stale modules show as shared `StalePill` component with `rounded-full bg-(--color-warning-bg) px-2 py-0.5 text-(--text-xs) font-medium text-(--color-warning)`.
- [ ] SS-03: Dirty tracking reads from `useRevenueSettingsDirtyStore` and shows "N settings changed since last calculation" when dirty.

### Fee Grid Redesign (FR)

- [ ] FR-01: Fee grid inside Revenue Settings dialog is restructured into 3 visual sections: Tuition Fees, Autres Frais, Tarifs Abattement -- matching the EFIR fee schedule document.
- [ ] FR-02: Tuition Fees section groups rows by nationality (Francais, Nationaux KSA, Autres Nationalites) as section headers with colored backgrounds.
- [ ] FR-03: Within each nationality group, rows show band-level aggregates: Maternelle (PS) standalone, Maternelle (MS+GS) combined, Elementaire, College, Lycee. The combined row label is "MS + GS".
- [ ] FR-04: Tuition Fees columns: DAI, Tuition HT (Frais Annuels), Term 1, Term 2, Term 3, Total TTC.
- [ ] FR-05: Autres Frais section shows other fees (Frais de Dossier, DPI, Evaluation, Garderie, Diplomes) grouped by fee type with per-nationality columns (Francais TTC, Nationaux HT, Autres TTC).
- [ ] FR-06: Tarifs Abattement section shows normal vs R3+ reduced rates (75%) per nationality per band level.
- [ ] FR-07: Tuition section uses `PlanningGrid` in `variant="compact"` with nationality grouping. Autres Frais and Abattement use semantic HTML tables with consistent styling.
- [ ] FR-08: Editable cells use `EditableCell` from `shared/editable-cell.tsx` when not read-only.
- [ ] FR-09: All monetary values display using shared `formatMoney()` formatter with `fr-FR` locale and thousands separator. Fee grid contexts use `showCurrency: true` (SAR suffix); forecast grid does not.
- [ ] FR-10: When a band row has heterogeneous underlying values, a chevron toggle expands individual grade rows in-line below the band row. Expanded rows have indented labels and individual editable cells. Collapse returns to the band aggregate view.
- [ ] FR-11: All three fee grid sections (Tuition, Autres Frais, Abattement) share consistent row height, cell padding, border styling, header treatment, and empty-state component via a shared `FeeScheduleSection` wrapper or CSS contract. No section looks like a different mini-design system.
- [ ] FR-12: Closing the settings dialog preserves or restores focus to the triggering control (Revenue Settings button in the toolbar).

### Row Identity & View-Mode Semantics (ID)

- [ ] ID-01: `RevenueForecastGridRow` carries a stable `id` field computed as `${viewMode}-${code}` -- not a display label. Selection equality uses `id`.
- [ ] ID-02: Each row carries a `rowType` field (`data | subtotal | total | group-header`). Only `data` rows are selectable.
- [ ] ID-03: Each data row carries an optional `settingsTarget` field mapping to the correct `RevenueSettingsTab` for "Edit in Settings" deep linking.
- [ ] ID-04: Changing `viewMode` clears selection, closes the right panel, and clears band filter. No stale inspector context or filter state persists after a mode switch.
- [ ] ID-05: Grade/Nationality/Tariff view grand totals all equal the "Tuition Fees" row from Category view (reconciliation invariant). Assertion uses `Decimal.eq()`.

### Export Semantics (EX)

- [ ] EX-01: Export respects the current `viewMode` -- exported rows match what the grid displays.
- [ ] EX-02: Export respects active filters (band filter, exception filter) and active period. If filtered, the filename includes the filter and period context.
- [ ] EX-03: Subtotal and group-header rows are included in export with clear labels (e.g., "Maternelle Subtotal").
- [ ] EX-04: Grand total row is always the last row in the export, regardless of filters.
- [ ] EX-05: Selected-row state does NOT affect export -- export always covers all visible rows.

### Empty States & Degenerate Data (ES)

- [ ] ES-01: When no revenue has been calculated yet, the forecast grid shows: "Run the revenue calculation to populate the forecast grid." (centered, muted text).
- [ ] ES-02: When setup is incomplete and right panel is open, the inspector default view shows the workflow card as "Setup pending" with the validation queue listing all non-ready areas.
- [ ] ES-03: When grade view is selected but all grades are filtered out by band/exception filter, the grid shows: "No grades match the current filters." with a "Clear filters" button. Selection is also cleared.
- [ ] ES-04: When a fee schedule section has no underlying data rows (e.g., no fee grid entries for a nationality), the section shows: "No fee data available for [Nationality]. Configure in the Fee Grid tab." -- using consistent empty-state styling across all three fee grid sections.
- [ ] ES-05: When category view shows a zero-value category row (e.g., Activities = 0 in all months), the row renders normally with dashes in month columns and "0" in the annual column -- not hidden.
- [ ] ES-06: When all downstream modules are stale, the status strip shows all stale pills without truncation.
- [ ] ES-07: When version is imported/read-only with incomplete setup, the settings dialog opens in read-only mode with readiness dots still visible (orange dots, but all editable fields disabled with `cursor-default` and `aria-readonly="true"`).

### Quality (QA)

- [ ] QA-01: `pnpm typecheck` passes with zero errors.
- [ ] QA-02: `pnpm lint` passes with zero warnings.
- [ ] QA-03: `pnpm test` passes with all existing + new tests.
- [ ] QA-04: New code achieves >= 80% test coverage.
- [ ] QA-05: WCAG AA: full keyboard navigation through forecast grid, fee grid sections, settings dialog.
- [ ] QA-06: No `.tsx` file in `components/revenue/`, `components/shared/`, or `lib/revenue-*` contains hardcoded hex color literals. Enforced by test assertion scanning file contents.
- [ ] QA-07: DOM-structure snapshot tests assert Revenue's banner/toolbar/KPI/status/grid shell structure matches the expected layout contract.
- [ ] QA-08: Shared primitive tests verify that Enrollment and Revenue use the same `KpiCard`, `InspectorSection`, `SummaryTable`, `GuideSection`, `WorkspaceStatusStrip`, and `CalculateButton` primitives.
- [ ] QA-09: Cross-view reconciliation test uses `Decimal.eq()` (not `===`) for comparing Grade/Nationality/Tariff grand totals to Category "Tuition Fees" annual total.

### Accessibility (A11Y)

- [ ] A11Y-01: Revenue forecast grid uses `role="grid"` (forced, not dependent on editability) and supports keyboard navigation in read-only mode through PlanningGrid.
- [ ] A11Y-02: Focus returns to the Revenue Settings toolbar button after closing the Revenue Settings dialog.
- [ ] A11Y-03: Using the inspector back button returns focus to the originating selected grid row.
- [ ] A11Y-04: All fee-grid sections (Tuition via PlanningGrid, Autres Frais and Abattement via semantic tables) expose a coherent keyboard model and ARIA labeling strategy. Fee grid editable cells have `aria-label` describing the cell context (e.g., "Tuition HT for Francais Elementaire").

### Drift Prevention (DP)

- [ ] DP-01: Enrollment and Revenue both import `BAND_STYLES`, `BAND_LABELS` from `lib/band-styles.ts`. No module has its own copy.
- [ ] DP-02: Both modules register guide content via `registerGuideContent`. Right panel never checks `activePage` directly for guide rendering.
- [ ] DP-03: A parity checkpoint review is required after foundation stories (S1-S2) complete and before inspector and fee-grid feature work proceeds.

---

## Stories

### Dependency DAG

```text
S1 ──→ S3 ──→ S5 ──→ S8 ──→ S11
       ↗              ↑
S2 ───→ S4 ──→ S6a ──→ S6b
  ↘       ↗
   S9 ───
  ↘
   S7

S11 = Integration Testing
```

S1-S2 are foundation (parallel). S3-S4-S7-S9 are layout/identity/KPI/guide (parallel after S1-S2, with parity checkpoint gate before proceeding). S5 is grid migration. S6a-S6b are inspector (split). S8 is fee grid. S11 is final assembly.

### Parity Checkpoint Gate

After S1+S2+S3+S4 complete and before S5+S6a+S7 begin, a parity checkpoint compares:

- Revenue page shell (banner/toolbar/KPI/status/grid zones) against Enrollment's shell
- Shared primitive adoption (both modules using the same components)
- Token compliance (no hardcoded hex in Revenue code)

This checkpoint is a review gate, not a story. Findings block S5+ until resolved.

### S1: CSS Foundation & Design Token Alignment

| Property | Value                                   |
| -------- | --------------------------------------- |
| Type     | Frontend (CSS + components + utilities) |
| ACs      | DS-01 through DS-11                     |
| Points   | 2.5                                     |

**Scope:**

- Add all chart series, chart typography, nationality badge, tariff group, and animation CSS tokens to `index.css` with exact values defined in the CSS Token Additions section
- Fix all CSS uniformity gaps: KPI border radius, border-left width, shadow tokens, responsive breakpoints
- Replace hardcoded chart font sizes and tooltip borderRadius across all Recharts usage
- Replace `CHART_COLORS` hex array in `revenue-inspector.tsx` with CSS variable references
- Create `useChartColor(tokenName: string): string` hook in `lib/chart-utils.ts` using `getComputedStyle` resolver for Recharts SVG fills
- Create shared `CHART_TOOLTIP_STYLE` constant
- Add `@media (prefers-reduced-motion: reduce)` rules for all new animation classes

**Files:**

| File                                                           | Action                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web/src/index.css`                                       | Add ~25 new CSS tokens + prefers-reduced-motion rules               |
| `apps/web/src/lib/chart-utils.ts`                              | Create: `useChartColor()` hook + `CHART_TOOLTIP_STYLE`              |
| `apps/web/src/components/revenue/revenue-inspector.tsx`        | Replace CHART_COLORS + bar fill hex values                          |
| `apps/web/src/components/revenue/kpi-ribbon.tsx`               | Fix rounded-2xl -> rounded-xl, border-l-4 -> border-l-[3px], shadow |
| `apps/web/src/components/enrollment/inspector-active-view.tsx` | Fix chart fontSize hardcodes                                        |
| `apps/web/src/components/enrollment/historical-chart.tsx`      | Fix chart fontSize hardcodes                                        |

### S2: Shared Primitive Extraction

| Property | Value                                |
| -------- | ------------------------------------ |
| Type     | Frontend (refactor + new components) |
| ACs      | SC-01 through SC-10, DP-01           |
| Points   | 5                                    |

**Scope:**

- Move `CalculateButton` to `shared/` with re-export from enrollment path. Update API to `{ onCalculate, isPending, isSuccess, isError, disabled? }`
- Extract `BAND_STYLES`, `BAND_LABELS`, `BAND_DOT_COLORS` to `lib/band-styles.ts`; add `NATIONALITY_STYLES`, `NATIONALITY_LABELS`, `TARIFF_STYLES`, `TARIFF_LABELS`. Separate domain ordering/labels from visual style maps
- Create generalized `FilterPillMenu` from enrollment's `ExceptionFilterMenu` with `FilterConfig` schema
- Extract `GuideSection` from enrollment guide to `shared/guide-section.tsx`
- Create `WorkspaceStatusStrip` shared component accepting `StatusSection[]` config with strongly-typed schema
- **Create `KpiCard` shared primitive** -- extract from enrollment KPI ribbon, make both modules compose it
- **Create `InspectorSection` shared primitive** -- rounded card shell for all sidebar sections
- **Create `SummaryTable` shared primitive** -- colored-dot + label + amount + percent breakdown table
- **Create `WorkflowStatusCard`** -- semantic-accent status card with left-border
- **Create `FormulaCard`** -- calculation explanation card with Sigma icon
- **Create `ReadinessIndicator`** -- status dots and counts
- **Create `StalePill`** -- downstream stale module badge
- **Create `ChartWrapper`** -- `<ResponsiveContainer>` wrapper with token defaults
- Create `formatMoney()` shared formatter in `lib/format-money.ts` replacing `formatSar`, `formatCompactSar`, `formatRevenueGridAmount`
- Migrate enrollment to use all new shared primitives (KpiCard, InspectorSection, SummaryTable, etc.)

**Files:**

| File                                                              | Action                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/src/components/shared/calculate-button.tsx`             | Create (move from enrollment)                                      |
| `apps/web/src/components/enrollment/calculate-button.tsx`         | Modify: re-export from shared                                      |
| `apps/web/src/lib/band-styles.ts`                                 | Create: all shared band/nationality/tariff styles                  |
| `apps/web/src/components/enrollment/enrollment-master-grid.tsx`   | Modify: import BAND_STYLES from shared                             |
| `apps/web/src/components/enrollment/inspector-default-view.tsx`   | Modify: import BAND_DOT_COLORS from shared, adopt InspectorSection |
| `apps/web/src/components/shared/filter-pill-menu.tsx`             | Create: generalized filter menu                                    |
| `apps/web/src/components/enrollment/exception-filter-menu.tsx`    | Modify: wrap shared component                                      |
| `apps/web/src/components/shared/guide-section.tsx`                | Create (extract from enrollment guide)                             |
| `apps/web/src/components/enrollment/enrollment-guide-content.tsx` | Modify: import from shared                                         |
| `apps/web/src/components/shared/workspace-status-strip.tsx`       | Create: shared status strip layout                                 |
| `apps/web/src/components/shared/kpi-card.tsx`                     | Create: config-driven KPI card                                     |
| `apps/web/src/components/shared/inspector-section.tsx`            | Create: inspector section shell                                    |
| `apps/web/src/components/shared/summary-table.tsx`                | Create: breakdown table                                            |
| `apps/web/src/components/shared/workflow-status-card.tsx`         | Create: workflow card                                              |
| `apps/web/src/components/shared/formula-card.tsx`                 | Create: formula explanation card                                   |
| `apps/web/src/components/shared/readiness-indicator.tsx`          | Create: readiness dots/counts                                      |
| `apps/web/src/components/shared/stale-pill.tsx`                   | Create: stale module badge                                         |
| `apps/web/src/components/shared/chart-wrapper.tsx`                | Create: ResponsiveContainer + defaults                             |
| `apps/web/src/lib/format-money.ts`                                | Create: shared monetary formatter                                  |
| `apps/web/src/components/enrollment/kpi-ribbon.tsx`               | Modify: adopt shared KpiCard                                       |
| `apps/web/src/components/enrollment/enrollment-status-strip.tsx`  | Modify: adopt shared WorkspaceStatusStrip                          |

### S3: Page Layout + Settings Merge + Toolbar

| Property   | Value                                                         |
| ---------- | ------------------------------------------------------------- |
| Type       | Frontend                                                      |
| ACs        | PL-01 through PL-04, SM-01 through SM-06, TF-01 through TF-05 |
| Points     | 3                                                             |
| Blocked by | S1, S2                                                        |

**Scope:**

- Restructure revenue page layout: flex column with independent grid scroll. Explicitly remove `space-y-4`, `pb-6`, `rounded-2xl` on children
- Fix toolbar: flat strip with `border-b`, remove rounded card styling, remove `shadow-(--shadow-xs)`, remove `bg-(--workspace-bg-card)`
- Fix banners: remove `rounded-lg`, add `shrink-0 border-b`, full-width
- Remove "Setup" button; merge setup checklist into settings dialog sidebar (readiness dots via `ReadinessIndicator`, progress bar, guided first-visit, auto-navigate to first incomplete tab)
- Preserve period toggle in toolbar left zone with explicit ordering
- Add band filter toggle (visible in grade view)
- Add revenue exception filter menu wrapping shared FilterPillMenu
- Adopt shared CalculateButton
- Fix status strip: flat strip, remove rounded corners and shadow

**Files:**

| File                                                           | Action                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/web/src/pages/planning/revenue.tsx`                      | Rewrite: layout, remove Setup, add filters, adopt CalculateButton, fix toolbar/banner |
| `apps/web/src/components/revenue/revenue-settings-dialog.tsx`  | Modify: readiness dots, progress bar, guided first-visit                              |
| `apps/web/src/components/revenue/setup-checklist.tsx`          | Remove standalone modal                                                               |
| `apps/web/src/components/revenue/revenue-exception-filter.tsx` | Create: revenue-specific filter wrapping shared FilterPillMenu                        |
| `apps/web/src/components/revenue/revenue-status-strip.tsx`     | Modify: adopt shared WorkspaceStatusStrip, flat strip styling                         |

### S4: Forecast Grid -- Row Identity & Selection Store

| Property   | Value                                    |
| ---------- | ---------------------------------------- |
| Type       | Frontend                                 |
| ACs        | GP-01 through GP-09, ID-01 through ID-04 |
| Points     | 3                                        |
| Blocked by | S1, S2                                   |

**Scope:**

- Define `RevenueGridRowIdentity` interface with `id`, `code`, `label`, `viewMode`, `rowType`, `band`, `groupKey`, `settingsTarget`
- **Rewrite** `revenue-selection-store.ts` (not just modify): add `id`-based equality, toggle behavior (click same row = deselect), integrate with right panel (`open('details')` on select, `close()` on deselect), enforce non-selectable subtotal/total/group-header rows, always switch to `details` tab on select
- Add panel-close sync in `revenue.tsx` (clear selection when panel closes)
- Add view-mode-change effect: clears selection, closes panel, clears band filter
- Add period-change effect: clears selection, closes panel
- Add filter-hides-selected-row effect: clears selection, returns to default view
- Add keyboard Enter parity (Enter on focused row = select)

**Files:**

| File                                             | Action                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `apps/web/src/stores/revenue-selection-store.ts` | Rewrite: id-based selection, toggle, right-panel integration, rowType guard                           |
| `apps/web/src/lib/revenue-workspace.ts`          | Modify: add RevenueGridRowIdentity, populate id/code/rowType/settingsTarget                           |
| `apps/web/src/pages/planning/revenue.tsx`        | Modify: add isPanelOpen sync + viewMode-change clear + period-change clear + filter-hides-row effects |

### S5: Forecast Grid -- PlanningGrid Migration

| Property   | Value                     |
| ---------- | ------------------------- |
| Type       | Frontend                  |
| ACs        | FG-01 through FG-10       |
| Points     | 3                         |
| Blocked by | S3, S4, parity checkpoint |

**Scope:**

- Extend `RevenueForecastGridRow` with full `RevenueGridRowIdentity` fields
- Create `buildRevenueForecastGridRowsForPlanningGrid()` returning data rows with identity metadata
- Rewrite `forecast-grid.tsx` using `PlanningGrid` with forced `role="grid"`: band grouping in grade view, nationality grouping in nationality view, tariff grouping in tariff view, flat in category view
- Wire keyboard navigation (PlanningGrid already supports read-only keyboard nav), row selection, pinned columns, numeric columns
- Add category view row-level styling via `getRowClassName`
- Verify cross-view reconciliation: Grade/Nationality/Tariff grand totals = Category "Tuition Fees" row (using `Decimal.eq()`)
- Clear selection on no-results after filter
- Implement filtered total label: "Grand Total" -> "Filtered Total (band)" when filters active

**Files:**

| File                                                | Action                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/src/lib/revenue-workspace.ts`             | Modify: add identity fields to GridRow, new PlanningGrid builder |
| `apps/web/src/components/revenue/forecast-grid.tsx` | Rewrite: raw table -> PlanningGrid                               |

### S6a: Revenue Inspector -- Default View

| Property   | Value                             |
| ---------- | --------------------------------- |
| Type       | Frontend                          |
| ACs        | RD-01 through RD-10, RI-01, RI-02 |
| Points     | 3                                 |
| Blocked by | S4                                |

**Scope:**

**Default view (9 sections) using shared primitives:**

- Workflow status card using shared `WorkflowStatusCard` with semantic accent
- Readiness counters (2-col grid) using shared `ReadinessIndicator`
- Revenue assumptions table using shared `SummaryTable` (key-value + "Open Settings" action)
- Recommended workflow (4 steps with icons, staggered animation at 60ms)
- Validation queue table (area/status/action with `ReadinessIndicator` dots)
- Revenue by Band summary using shared `SummaryTable` (4 rows with band dots)
- Revenue by Nationality summary using shared `SummaryTable` (3 rows)
- Revenue composition donut chart (Recharts PieChart inside shared `ChartWrapper`, colors via `useChartColor()`)
- Monthly trend bar chart (Recharts BarChart inside shared `ChartWrapper`, 12 bars, colors via `useChartColor()`)
- Inspector container with `aria-live="polite"`
- View transitions with `animate-inspector-crossfade`

**Files:**

| File                                                    | Action                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/web/src/components/revenue/revenue-inspector.tsx` | Rewrite: default view with 9 sections using shared primitives |

### S6b: Revenue Inspector -- Active View

| Property   | Value               |
| ---------- | ------------------- |
| Type       | Frontend            |
| ACs        | RA-01 through RA-15 |
| Points     | 3                   |
| Blocked by | S6a                 |

**Scope:**

**Active view (context-sensitive per view mode) using shared primitives:**

- Header: back button (with focus restoration to grid row), view-mode badge, row label, code pill
- 2 KPI cards using shared `KpiCard`: Gross Revenue + Net Revenue (with headcount and discount context)
- Monthly trend bar chart inside shared `ChartWrapper` for selected row (group-colored fill via `useChartColor()`)
- View-mode-specific breakdowns using shared `SummaryTable`:
    - Category view: by Band, by Nationality, by Tariff
    - Grade view: by Nationality, by Tariff, by Category + fee summary
    - Nationality view: by Band, by Tariff, by Category
    - Tariff view: by Band, by Nationality, by Category
- "Edit in Settings" button linking to the contextually correct settings tab
- Shared `FormulaCard` with computation breakdown
- Group context card showing band/nationality aggregate

**Files:**

| File                                                    | Action                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/web/src/components/revenue/revenue-inspector.tsx` | Extend: active view with 4 view-mode contexts using shared primitives |

### S7: KPI Ribbon + Status Strip Alignment

| Property   | Value                                    |
| ---------- | ---------------------------------------- |
| Type       | Frontend                                 |
| ACs        | KR-01 through KR-04, SS-01 through SS-03 |
| Points     | 2                                        |
| Blocked by | S1, S2                                   |

**Scope:**

- Reduce KPI ribbon from 5 to 4 cards: Net Tuition HT, Other Revenue, Total Operating Revenue, SAR per Student
- Adopt shared `KpiCard` with icon circles, `animate-kpi-enter` at 60ms stagger, `Counter` + `Sparkline`
- Adopt shared `WorkspaceStatusStrip` for revenue status strip
- Adopt shared `StalePill` for downstream stale module badges
- Add dirty tracking indicator

**Files:**

| File                                                       | Action                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `apps/web/src/components/revenue/kpi-ribbon.tsx`           | Rewrite: 4 shared KpiCards, icons, Counter, Sparkline  |
| `apps/web/src/components/revenue/revenue-status-strip.tsx` | Rewrite: adopt shared WorkspaceStatusStrip + StalePill |

### S8: Fee Grid Redesign

| Property   | Value                                  |
| ---------- | -------------------------------------- |
| Type       | Frontend                               |
| ACs        | FR-01 through FR-12                    |
| Points     | 5                                      |
| Blocked by | S5 (PlanningGrid patterns established) |

**Scope:**

- Create `FeeScheduleSection/Group/Row` types in `packages/types/src/revenue.ts` (include `editability` field: `'editable-source' | 'editable-fanout' | 'summary-only'`)
- Create `fee-schedule-builder.ts` transformer: converts flat `FeeGridEntry[]` to EFIR layout (3 sections, nationality grouping, PS standalone, MS+GS combined, band-level aggregates)
- Create `fee-schedule-writeback.ts`: reverse transformer handling fan-out rules (band edits replace all individual grade rows with the aggregate value)
- Handle heterogeneous underlying values: amber warning dot, disabled editing, chevron toggle for in-line grade detail expansion
- Rewrite `fee-grid-tab.tsx`: tuition section uses `PlanningGrid` `variant="compact"` with nationality grouping; Autres Frais and Abattement use semantic HTML tables
- **Create shared `FeeScheduleSection` wrapper** ensuring all three sections share consistent row height, cell padding, border styling, header treatment, and empty-state component
- Abattement section is derived presentation (not editable) -- shows normal rate from tuition + reduced rate computed from discount %
- Editable cells use `shared/editable-cell.tsx` with appropriate affordances per editability mode
- Focus restoration: closing settings dialog returns focus to toolbar button
- Round-trip test: transform -> edit -> writeback -> re-fetch -> transform -> compare (Decimal.js exact match using `.eq()`)

**Files:**

| File                                                       | Action                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/types/src/revenue.ts`                            | Modify: add FeeScheduleSection/Group/Row types with editability field |
| `apps/web/src/lib/fee-schedule-builder.ts`                 | Create: FeeGridEntry[] -> EFIR layout transformer                     |
| `apps/web/src/lib/fee-schedule-writeback.ts`               | Create: aggregate edit -> FeeGridEntry[] fan-out                      |
| `apps/web/src/components/revenue/fee-grid-tab.tsx`         | Rewrite: 3 sections matching EFIR fee schedule                        |
| `apps/web/src/components/revenue/fee-schedule-section.tsx` | Create: shared section wrapper for consistent styling                 |

### S9: Revenue Guide Content + Guide Rendering Architecture

| Property   | Value                      |
| ---------- | -------------------------- |
| Type       | Frontend                   |
| ACs        | RG-01 through RG-03, DP-02 |
| Points     | 2                          |
| Blocked by | S2                         |

**Scope:**

- **Architecture fix**: Replace the hardcoded Guide tab conditional in `right-panel.tsx` with a registry-based pattern (parallel to how Details already uses `registerPanelContent`). Create `registerGuideContent(page, renderer)` and `getGuideContent(page)` in the right-panel registry. Both Enrollment and Revenue register their guide content through this mechanism. No more `if (activePage === 'enrollment')` special-case.
- Create `RevenueGuideContent` with 6 collapsible sections using shared `GuideSection`: Workflow Overview, Revenue Calculation Formula, PS Fee Structure, Discount Policies, Nationality-Tariff Mapping, Revenue Validation
- Register revenue guide via `registerGuideContent('revenue', RevenueGuideContent)`
- Migrate enrollment guide to use the same registry: `registerGuideContent('enrollment', EnrollmentGuideContent)`
- Default fallback when no guide is registered: "Contextual help for the current module." (existing text)

**Files:**

| File                                                              | Action                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/src/lib/right-panel-registry.ts`                        | Modify: add `registerGuideContent` / `getGuideContent` functions |
| `apps/web/src/components/shell/right-panel.tsx`                   | Modify: replace hardcoded enrollment check with registry lookup  |
| `apps/web/src/components/revenue/revenue-guide-content.tsx`       | Create: 6 sections with icons + registry call                    |
| `apps/web/src/components/enrollment/enrollment-guide-content.tsx` | Modify: add registry call                                        |

### S10: Parity Checkpoint Gate (review, not a story)

This is a review gate after S1+S2+S3+S4 complete. It is not a story -- it is a mandatory review before S5+ can begin.

**Scope:**

- Compare Revenue shell (banner/toolbar/KPI/status/grid zones) against Enrollment shell
- Verify all shared primitives are adopted by both modules
- Run hex-literal audit on all Revenue code
- Side-by-side visual comparison of key components

**Outcome:** Findings must be resolved before S5, S6a, S7, S8 can proceed.

### S11: Integration Testing & Polish

| Property   | Value                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Type       | Frontend (tests + polish)                                                                                   |
| ACs        | QA-01 through QA-09, ID-05, EX-01 through EX-05, ES-01 through ES-07, A11Y-01 through A11Y-04, DP-01, DP-03 |
| Points     | 3                                                                                                           |
| Blocked by | S3, S5, S6a, S6b, S7, S8, S9                                                                                |

**Scope:**

- Update all existing revenue test files for new component structure
- **Row identity tests**: select -> reselect -> toggle -> mode switch -> clear -> period change -> filter-hides-row
- **Inspector sync tests**: panel close clears selection; subtotal row never opens panel; selected row highlight tracks store; tab switching to details on select
- **View-mode reconciliation tests**: Grade/Nationality/Tariff grand totals = Category "Tuition Fees" annual total (using `Decimal.eq()`)
- **Fee schedule round-trip tests**: flat rows -> schedule -> edit -> writeback -> persisted flat rows (Decimal.js exact). Edge cases: heterogeneous values, zero-value rows
- **Aggregate writeback tests**: MS+GS combined edit, band-level edit, heterogeneous value detection
- **Guide rendering tests**: Enrollment and Revenue guides both render correctly via shared registry
- **Readiness/tab consistency tests**: progress summary matches visible IA (5 areas, 4 tabs, correct dot mapping)
- **Export tests**: respects viewMode, respects filters, respects period, includes subtotals
- **Empty state tests**: no calculated revenue, filtered-to-empty, incomplete setup + panel open
- **Shared primitive tests**: verify both modules use same KpiCard, InspectorSection, SummaryTable, GuideSection, WorkspaceStatusStrip, CalculateButton
- **Token governance tests**: scan `.tsx` files for hardcoded hex color literals (QA-06)
- **DOM structure tests**: snapshot tests for Revenue shell structure (QA-07)
- **Accessibility tests**: focus restoration (dialog close, inspector back button), aria-live, keyboard nav
- Visual parity verification (side-by-side enrollment vs revenue)
- Final lint, typecheck, test pass

**Files:**

| File                                                            | Action                                            |
| --------------------------------------------------------------- | ------------------------------------------------- |
| `apps/web/src/pages/planning/revenue.test.tsx`                  | Update for layout changes                         |
| `apps/web/src/components/revenue/setup-checklist.test.tsx`      | Update for removal                                |
| `apps/web/src/components/revenue/revenue-inspector.test.tsx`    | Update for restructured views                     |
| `apps/web/src/components/revenue/revenue-status-strip.test.tsx` | Update for shared component                       |
| `apps/web/src/lib/fee-schedule-builder.test.ts`                 | Create: transformer + writeback round-trip tests  |
| `apps/web/src/lib/fee-schedule-writeback.test.ts`               | Create: fan-out + heterogeneous value tests       |
| `apps/web/src/lib/format-money.test.ts`                         | Create: shared formatter tests                    |
| `apps/web/src/lib/chart-utils.test.ts`                          | Create: useChartColor hook tests                  |
| `apps/web/src/components/shared/__tests__/`                     | Create: shared primitive usage verification tests |

---

## Story Summary

| #   | Story                                                | Points   | Blocked by         |
| --- | ---------------------------------------------------- | -------- | ------------------ |
| S1  | CSS Foundation & Design Token Alignment              | 2.5      | --                 |
| S2  | Shared Primitive Extraction                          | 5        | --                 |
| S3  | Page Layout + Settings Merge + Toolbar               | 3        | S1, S2             |
| S4  | Forecast Grid -- Row Identity & Selection Store      | 3        | S1, S2             |
| S7  | KPI Ribbon + Status Strip Alignment                  | 2        | S1, S2             |
| S9  | Revenue Guide Content + Guide Rendering Architecture | 2        | S2                 |
| --  | **Parity Checkpoint Gate** (review, not story)       | --       | S1, S2, S3, S4     |
| S5  | Forecast Grid -- PlanningGrid Migration              | 3        | S3, S4, checkpoint |
| S6a | Revenue Inspector -- Default View                    | 3        | S4                 |
| S6b | Revenue Inspector -- Active View                     | 3        | S6a                |
| S8  | Fee Grid Redesign (incl. writeback rules)            | 5        | S5                 |
| S11 | Integration Testing & Polish                         | 3        | S3-S9              |
|     | **Total**                                            | **34.5** |                    |

---

## Parallel Execution Plan

```text
Week 1: S1 + S2 (foundation, parallel)
Week 2: S3 + S4 + S7 + S9 (all unblocked after S1/S2, parallel)
         ── Parity Checkpoint Gate after S1+S2+S3+S4 ──
Week 3: S5 + S6a (grid + inspector default, parallel after checkpoint)
Week 4: S6b + S8 (inspector active + fee grid, parallel)
Week 5: S11 (integration + polish)
```

---

## Data Model Changes

None. All API endpoints, database schema, and calculation engine remain unchanged from Epic 16.

---

## API Endpoints

No new or modified endpoints. This epic is purely frontend.

---

## UI/UX Specification

### Shell & Layout

Revenue page lives under `PlanningShell`. After this epic, the layout matches enrollment exactly:

```text
PlanningShell
+-- ContextBar (shared, unchanged)
+-- VersionAccentStrip (shared, unchanged)
+-- Content row
    +-- <main> (flex-1)
    |   +-- RevenuePage
    |       +-- Banners (shrink-0, border-b, full-width, no rounded corners)
    |       +-- Toolbar (shrink-0, flat strip, border-b, no shadow)
    |       |   +-- Left: [ViewMode] [Period] [BandFilter?] [ExceptionFilter]
    |       |   +-- Right: [Export] [Settings] [Calculate]
    |       +-- KPI Ribbon (shrink-0, shared KpiCard x4)
    |       +-- Status Strip (shrink-0, border-b, flat, shared WorkspaceStatusStrip)
    |       +-- Grid Zone (flex-1, min-h-0, overflow-hidden)
    |           +-- ForecastGrid (PlanningGrid, role="grid", h-full, overflow-y-auto)
    +-- RightPanel (resizable)
        +-- Tabs: Details | Activity | Audit | Guide
        +-- Details: RevenueInspectorContent (default or active view, shared primitives)
        +-- Guide: RevenueGuideContent (via registry)
```

### Key Components

| Component               | Type                                       | Source                              | Notes                                                               |
| ----------------------- | ------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------- |
| ForecastGrid            | PlanningGrid (TanStack Table v8)           | `data-grid/planning-grid.tsx`       | Band/nationality/tariff grouping by view mode, `role="grid"` forced |
| RevenueKpiRibbon        | Shared `KpiCard` x4                        | `shared/kpi-card.tsx`               | Counter + Sparkline, 60ms stagger                                   |
| RevenueStatusStrip      | `WorkspaceStatusStrip` wrapper             | `shared/workspace-status-strip.tsx` | Dirty tracking + shared `StalePill` badges                          |
| RevenueInspectorContent | Shared `InspectorSection` + `SummaryTable` | `revenue-inspector.tsx`             | 9-section default + detail active view                              |
| RevenueGuideContent     | 6 collapsible shared `GuideSection`s       | `revenue-guide-content.tsx`         | Via `registerGuideContent` registry                                 |
| FeeGridTab              | PlanningGrid compact + 2 semantic tables   | `fee-grid-tab.tsx`                  | EFIR fee schedule with `FeeScheduleSection` wrapper                 |
| RevenueSettingsDialog   | Dialog with sidebar                        | `revenue-settings-dialog.tsx`       | Shared `ReadinessIndicator` dots + guided first-visit               |
| FilterPillMenu          | Shared generic filter                      | `shared/filter-pill-menu.tsx`       | Revenue wraps with specific filters                                 |
| CalculateButton         | Shared 4-state button                      | `shared/calculate-button.tsx`       | Idle/pending/success/error                                          |

### User Flows

**Flow 1: First-time Revenue Setup**

```
User -> Opens /planning/revenue -> Settings dialog auto-opens (setup incomplete)
     -> Progress bar shows "Complete 3 remaining steps"
     -> Auto-navigates to first incomplete tab (Fee Grid)
     -> User edits fees -> Saves -> Tab dot turns green (ReadinessIndicator)
     -> Navigates through tabs until all green -> Closes dialog
     -> Focus returns to Settings button in toolbar
     -> Clicks Calculate Revenue -> Results populate forecast grid
```

**Flow 2: Inspecting Revenue by Grade**

```
User -> Selects "Grade" view mode -> Grid shows band-grouped rows
     -> Clicks "Cours Preparatoire CP" row -> Row highlights with accent bg
     -> Right panel switches to Details tab (even if user was on Guide)
     -> Inspector transitions (animate-inspector-crossfade) to active view:
        - Header: [<- Back] [Elementaire badge] "Cours Preparatoire" [CP pill]
        - 2 shared KpiCards: Gross Revenue (with "126 students") + Net Revenue (with "4.2% discount impact")
        - Monthly trend bar chart in shared ChartWrapper (12 bars in Elementaire blue via useChartColor)
        - Breakdown by Nationality: shared SummaryTable with Francais 2.1M (48%), Nationaux 1.5M (34%), Autres 0.8M (18%)
        - Breakdown by Tariff: shared SummaryTable with Plein 3.2M (72%), RP 0.9M (21%), R3+ 0.3M (7%)
        - Breakdown by Category: shared SummaryTable with Tuition 4.2M, Discount (180K), Registration 95K
        - Fee summary: DAI 5,000 | Tuition HT 34,500 | Term 1: 13,800 | Term 2: 10,350 | Term 3: 10,350
        - Shared FormulaCard: "126 students x 34,500 SAR - 180,000 SAR discount = 4,167,000 SAR net"
        - Band context: "Elementaire band: 618 students, 20.0M SAR gross, 33.9% of tuition"
     -> Clicks "Edit in Settings" -> Settings dialog opens to Fee Grid tab
     -> Clicks same CP row again -> Panel closes, row deselects (toggle)
     -> Focus returns to the CP grid row
```

**Flow 2b: Inspecting Revenue by Category**

```
User -> Stays in "Category" view (default) -> Grid shows flat rows
     -> Clicks "Tuition Fees" row -> Right panel opens:
        - Header: [<- Back] [Category badge] "Tuition Fees"
        - 2 shared KpiCards: Gross Revenue 58.9M + Net Revenue 56.6M (3.9% discount)
        - Monthly trend in ChartWrapper (12 bars)
        - Breakdown by Band: SummaryTable with Maternelle 8.3M (14%), Elementaire 20.0M (34%), College 17.1M (29%), Lycee 13.5M (23%)
        - Breakdown by Nationality: SummaryTable with Francais 28.1M (48%), Nationaux 18.2M (31%), Autres 12.7M (21%)
        - Breakdown by Tariff: SummaryTable with Plein 42.3M (72%), RP 11.8M (20%), R3+ 4.9M (8%)
        - "Edit in Settings" links to Fee Grid tab
     -> Clicks "Discount Impact" row -> Inspector crossfades to:
        - KpiCards show (2.3M) discount total, by tariff breakdown (RP 25%, R3+ 10%)
        - "Edit in Settings" links to Discounts tab
```

**Flow 3: Reviewing Fee Schedule**

```
User -> Clicks "Revenue Settings" -> Dialog opens (focus trapped)
     -> Selects "Fee Grid" tab -> Sees EFIR-format fee schedule
     -> Francais section header (nationality badge color) -> PS row, MS+GS row, Elementaire, College, Lycee
     -> Elementaire row shows "34,500 SAR" -- clicks cell -> editable (editable-fanout, blue tint)
     -> Tooltip: "Edits 5 underlying grades"
     -> If grades have mixed values: amber dot, editing disabled, chevron toggle to expand
     -> Nationaux section header -> Same band rows with different rates
     -> Scrolls to Autres Frais section -> Per-nationality fee columns (consistent section styling)
     -> Scrolls to Abattement section -> Normal vs R3+ reduced rates (read-only, muted bg)
     -> Closes dialog -> Focus returns to "Revenue Settings" button
```

**Flow 4: Switching view modes and periods**

```
User -> In Grade view with Maternelle band filter and CP row selected
     -> Switches to Category view -> Selection cleared, panel closes, band filter cleared
     -> Switches period to AY1 -> Selection cleared (if any), grid shows AY1 months only
     -> Exports -> Filename: "revenue-forecast-category-AY1-2026-03-14.xlsx"
```

### Interaction Patterns

- **Grid keyboard nav**: Arrow keys move active cell, Tab/Shift+Tab cycle columns, Enter selects row and opens panel, Escape clears selection
- **Row selection toggle**: Click row = select + open panel (switch to Details tab). Click again = deselect + close panel. Panel close button = clear selection.
- **View mode switch**: Clears selection, closes panel, clears band filter
- **Period switch**: Clears selection, closes panel, re-fetches data
- **Band collapsing**: Click band header chevron to collapse/expand all rows in that band
- **Fee grid editing**: Click cell to edit, type value, Tab/Enter to commit. Unsaved changes tracked per-tab with dirty indicators.
- **Focus management**: Dialog close returns focus to trigger button. Inspector back button returns focus to selected grid row. Settings dialog traps focus while open.

### Accessibility Requirements

- Forecast grid: `role="grid"` (forced in read-only mode), `aria-label`, `aria-selected` on active row, arrow key navigation
- Inspector: `aria-live="polite"` on container, `animate-inspector-crossfade` transitions
- Fee grid: `role="grid"` (editable tuition section), `aria-label` per section, consistent keyboard model across all three sections
    - Editable cells: `aria-label="Tuition HT for Francais Elementaire"`
    - Summary-only cells: `aria-readonly="true"`
    - Mixed-value cells: `aria-disabled="true"`, `aria-describedby` pointing to warning text
- Settings dialog: focus trap, Escape to close (with dirty check), `aria-modal="true"`, focus restoration to trigger
- KPI cards: `role="list"` + `role="listitem"`, values announced with labels
- Status strip: `role="status"`, `aria-live="polite"`
- Guide sections: `aria-expanded` on collapse/expand buttons
- All interactive elements keyboard accessible
- All new animations disabled under `@media (prefers-reduced-motion: reduce)`

### Responsive / Viewport

BudFin targets desktop (1280px min). KPI ribbon uses `sm:grid-cols-2 lg:grid-cols-4`. Forecast grid has `min-w-[980px]` with horizontal scroll. Settings dialog uses `90vw x 90vh`. Inspector charts use `<ResponsiveContainer>` for width adaptation within resizable panel.

---

## Out of Scope

- Backend API changes (all endpoints unchanged from Epic 16)
- Database schema changes
- Revenue calculation engine changes
- Comparison mode (deferred)
- PDF export (deferred to Reporting Epic)
- Mobile responsive layout
- Visual regression tooling infrastructure (Chromatic/Percy -- separate infrastructure investment, does not block this epic)

---

## Open Questions

| #   | Question                            | Status                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Period toggle disposition           | **Resolved:** Kept in toolbar left zone. Period change clears selection and re-fetches data.                                                                                                                                                                                                                                              |
| 2   | PlanningGrid compact variant        | **Resolved:** Already exists (`variant="compact"` prop). No new work needed on the shared grid.                                                                                                                                                                                                                                           |
| 3   | PlanningGrid read-only keyboard nav | **Resolved:** PlanningGrid already supports keyboard navigation in read-only mode (`keyboardNavigation` prop defaults to true). However, `role` is downgraded to `"table"` for read-only grids. Revenue must force `role="grid"` via a new `forceGridRole` prop or by passing at least one dummy editable column. This is a minor change. |
| 4   | Fan-out writeback semantics         | **Resolved:** Fan-out replaces all underlying values (not delta distribution). See updated Fee Schedule Writeback Rules section.                                                                                                                                                                                                          |
| 5   | Frontend-only claim validation      | **Resolved:** Fee grid ownership assumptions validated against existing data model. `FeeGridEntry` with `category = 'autres_frais'` already exists. No backend changes required.                                                                                                                                                          |

---

## Review Resolution Log

This section tracks how each critical and high-severity finding from the two architecture reviews was resolved.

### From Review 1 (R-01 through R-20)

| ID                                        | Resolution                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| R-01 (Critical: layout removal checklist) | PL-01 now explicitly lists removals: `space-y-4`, `pb-6`, `rounded-2xl` on children               |
| R-02 (Critical: selection store rewrite)  | S4 increased to 3 points, scope explicitly says "rewrite" not "modify"                            |
| R-03 (Critical: PlanningGrid compact)     | Resolved -- codebase already has `variant="compact"` prop. No new work needed.                    |
| R-04 (High: chart token values)           | DS-06 now defines exact values: `var(--color-info)`, `var(--color-success)`, etc.                 |
| R-05 (High: nationality badge values)     | DS-07 now defines exact values                                                                    |
| R-06 (High: useChartColor)                | `useChartColor()` hook added to S1 scope with code pattern defined                                |
| R-07 (High: S6 split)                     | S6 split into S6a (default, 3pts) + S6b (active, 3pts)                                            |
| R-08 (High: visual regression)            | QA-06 through QA-08 added. Visual regression tooling noted as separate infrastructure investment. |
| R-09 (High: period toggle)                | New "Period Toggle Contract" section added with explicit rules                                    |
| R-10 (High: CalculateButton API)          | SC-01 now defines shared API: `{ onCalculate, isPending, isSuccess, isError, disabled? }`         |
| R-11 (Medium: banner rounded-lg)          | PL-03 now explicitly removes `rounded-lg`                                                         |
| R-12 (Medium: animation delay)            | KR-03 corrected to 60ms (matching enrollment code, not 50ms)                                      |
| R-13 (Medium: band filter reset)          | ID-04 now includes "clears band filter" on view mode change                                       |
| R-14 (Medium: InspectorSection)           | SC-07 added. All inspector sections use shared primitive.                                         |
| R-15 (Medium: writeback precision)        | Writeback semantics clarified: "replace all underlying values"                                    |
| R-16 (Medium: expand behavior)            | FR-10 added for chevron toggle expand behavior                                                    |
| R-17 (Medium: SAR suffix)                 | INV-10 and FR-09 clarify: SAR suffix only in fee grid, not forecast grid                          |
| R-18 (Low: GP-04 implementation detail)   | GP-04 rewritten to describe outcome, not implementation                                           |
| R-19 (Low: SS-01 explicit removals)       | SS-01 now says "no rounded corners, no box shadow"                                                |
| R-20 (Low: aria-live)                     | RI-01 added with `aria-live="polite"`                                                             |

### From Review 2 (RPA-01 through RPA-20)

| ID                                            | Resolution                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| RPA-01 (Critical: PlanningGrid read-only)     | Resolved -- PlanningGrid already supports keyboard nav in read-only mode. `role="grid"` forcing addressed in Open Questions #3. |
| RPA-02 (Critical: fee grid storage ownership) | Validated -- `FeeGridEntry` with `category = 'autres_frais'` exists. Frontend-only claim confirmed.                             |
| RPA-03 (High: WorkspaceStatusStrip schema)    | `StatusSection` schema now fully defined with typed fields                                                                      |
| RPA-04 (High: period selector)                | Full "Period Toggle Contract" section added                                                                                     |
| RPA-05 (High: hardcoded-color scope)          | DS-01 scope expanded to include `lib/revenue-*` and shared components                                                           |
| RPA-06 (High: shared primitive scope)         | SC-06 through SC-10 added for KpiCard, InspectorSection, SummaryTable, ReadinessIndicator, ChartWrapper                         |
| RPA-07 (High: fee grid section chrome)        | FR-11 added. `FeeScheduleSection` wrapper specified.                                                                            |
| RPA-08 (High: testing gaps)                   | QA-06 through QA-09 added for token governance, DOM structure, shared primitive verification                                    |
| RPA-09 (High: guide architecture timing)      | S9 moved earlier -- now parallel with S3/S4/S7 (blocked by S2 only)                                                             |
| RPA-10 (High: state coherence)                | GP-07, GP-08, GP-09 added for tab switching, period clearing, filter-hides-row                                                  |
| RPA-11 (Medium: class-string ACs)             | DS-02 changed to "use shared KpiCard" rather than literal class strings                                                         |
| RPA-12 (Medium: fee grid keyboard)            | A11Y-04 added for coherent keyboard model across all fee grid sections                                                          |
| RPA-13 (Medium: inspector section contract)   | RA-15 added. All sections use shared InspectorSection.                                                                          |
| RPA-14 (Medium: tariff tokens)                | DS-11 added. TARIFF_STYLES added to SC-02.                                                                                      |
| RPA-15 (Medium: dependency DAG)               | S7 now depends on S1+S2 (not just S2). S6a depends on S4. Updated DAG.                                                          |
| RPA-16 (Medium: token governance)             | QA-06 added. DP section added.                                                                                                  |
| RPA-17 (Medium: period-aware export)          | EX-02 updated to include period context                                                                                         |
| RPA-18 (Medium: read-only affordances)        | "Read-only affordance rules" table added to Fee Schedule section                                                                |
| RPA-19 (Low: open questions)                  | Open Questions section now has 5 resolved items                                                                                 |
| RPA-20 (Low: domain vs style separation)      | SC-02 notes "separate domain ordering/labels from visual style maps"                                                            |

---

## Expert Panel Review Summary

Four domain experts reviewed this spec against the enrollment page standard:

- **Financial Planner**: Fee grid must show EFIR fee schedule layout. SAR per student is the finance committee's primary metric. R3+ discount validation must be visible.
- **Software Architect**: PlanningGrid grouping should work in all view modes (not just grade). Use single PlanningGrid for tuition + simple tables for others. CSS variables work in SVG but use getComputedStyle as default.
- **Product Manager**: Merged settings dialog needs guided first-visit flow. Right panel tabs already exist (Details/Activity/Audit/Guide) -- revenue just needs to populate them. Exception filters needed for revenue.
- **Designer**: Reduce to 4 KPI cards for visual balance. Add band filter in grade view. Category view needs row-level visual distinction. Inspector needs "Revenue assumptions" table.

Two architecture reviewers provided targeted revision feedback (20 findings each) covering: shared primitive gaps, token governance, keyboard parity, fee grid visual consistency, state coherence, testing gaps, and story scoping. All 40 findings addressed in this revision.
