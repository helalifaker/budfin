# Revenue Page Spec Deep Review -- Enrollment Parity Audit

> **Reviewer:** Principal Product Architect / Staff Frontend Engineer
> **Spec under review:** `docs/plans/2026-03-14-revenue-enrollment-parity.md`
> **Gold standard:** Enrollment page (`apps/web/src/pages/planning/enrollment.tsx`)
> **Date:** 2026-03-14

---

## 1. Executive Verdict

| Dimension                   | Score  |
| --------------------------- | ------ |
| **Parity Confidence**       | 6.5/10 |
| **Architecture Confidence** | 7.5/10 |
| **Design System Maturity**  | 5.5/10 |
| **Delivery Risk**           | 6/10   |
| **Maintainability**         | 7/10   |

The spec is **substantially correct in intent** and demonstrates genuine understanding of the Enrollment page's architecture. The 8 parity invariants are a strong structural anchor. The row identity contract, grid metric semantics, and fee schedule writeback rules show real domain rigor.

However, the spec has three systemic weaknesses that undermine confidence:

1. **Parity is stated but not mechanistically enforced.** The phrase "matching enrollment" appears 30+ times but the spec provides no shared abstraction layer, no token governance, no visual regression framework, and no parity-specific test assertions. Each story will re-derive enrollment patterns from memory rather than from shared code.

2. **The design system layer is under-specified.** The spec adds ~15 CSS tokens but does not audit the full token gap. Current Revenue code has 5+ hardcoded hex colors, mismatched border radii, wrong shadow tokens, wrong responsive breakpoints, and card-style components where Enrollment uses flat strips. The spec's DS-01 through DS-07 are necessary but insufficient.

3. **The fee grid creates a genuine second-system risk.** It mixes PlanningGrid compact, two HTML tables, a novel editability model (editable-source/editable-fanout/summary-only), heterogeneous-value warnings, and EFIR-specific nationality grouping -- all inside a settings dialog. This is the most complex single component in the entire workspace, yet it has the fewest guardrails for visual parity.

**Verdict: Approve with targeted revisions** -- the spec is strong enough to implement but needs the additions described in this review to prevent drift during execution.

---

## 2. Overall Assessment

### What the spec does well

- **Parity invariants (INV-1 through INV-8)** are well-defined and cover the key architectural contracts. INV-1 (fixed-height frame), INV-3 (selection/panel sync), and INV-7 (shared visual tokens) are the most important and are correctly identified.
- **Row identity contract** is precise. The `RevenueGridRowIdentity` interface solves a real problem -- the current Revenue selection store uses `label`-based equality, which is fragile. Moving to `${viewMode}-${code}` is correct.
- **Fee schedule writeback rules** are the most domain-rigorous section. Editable-source vs editable-fanout classification is sound. The heterogeneous-value guard (amber dot + disabled editing) is the right safety model.
- **View mode metric semantics** with reconciliation invariant (Grade/Nationality/Tariff totals = Category "Tuition Fees") is excellent.
- **Story dependency DAG** is correct and the parallel execution plan is realistic.
- **"Where parity ends and module-specific behavior begins"** section is mature -- it correctly identifies that Revenue keeps view-mode toggles, removes Quick Edit, and uses a fullscreen dialog instead of a sheet.

### Where the spec is strong

- Inspector restructure (S6) is the most ambitious story and the spec correctly identifies 9 default sections + 4 context-sensitive active views. The breakdown-per-view-mode matrix (RA-07 through RA-10) is thorough.
- The readiness/settings tab reconciliation table (5 areas, 4 tabs, correct dot mapping) prevents a common implementation confusion.
- Fee Grid tab vs Other Revenue tab ownership split is correctly delineated.

### Where the spec remains vulnerable

- **No shared abstraction enforcement mechanism.** The spec says "extract `CalculateButton` to shared/" but does not define how parity is maintained after extraction. There is no component API contract, no Storybook, no visual snapshot, no lint rule.
- **Token gaps are listed as ACs but not audited.** The spec says "add ~15 new CSS tokens" but does not enumerate all missing tokens. The current `index.css` has zero `--chart-series-*` tokens, zero `--chart-tick-size`/`--chart-tooltip-size` tokens, zero nationality badge tokens. The gap is larger than ~15.
- **Testing strategy validates functionality but not parity.** S10 tests row identity, inspector sync, and fee schedule round-trip -- but never asserts that Revenue's DOM structure, CSS class usage, or token consumption matches Enrollment's patterns.

---

## 3. Findings by Category

### 3.1 UI/UX Identity Parity

**Strengths:**

- INV-1 through INV-8 cover the key structural contracts.
- The spec correctly identifies that the current Revenue page uses `space-y-4 pb-6` (scrolling page) while Enrollment uses `flex h-full min-h-0 flex-col overflow-hidden` (fixed frame). PL-01 addresses this.
- PL-02 correctly identifies the toolbar must be a flat strip with `border-b`, not a rounded card.
- PL-03 correctly addresses banner styling.

**Weaknesses:**

1. **Toolbar rounded card is the single most visible parity violation today.** The current Revenue toolbar uses `rounded-2xl border border-(--workspace-border) bg-(--workspace-bg-card) px-4 py-3 shadow-(--shadow-xs)` which looks like a floating card. Enrollment's toolbar is `flex shrink-0 items-center justify-between border-b border-(--workspace-border) px-6 py-2` -- a flat inline strip. The spec says to fix this (PL-02) but does not call out the `shadow-(--shadow-xs)` removal or the `bg-(--workspace-bg-card)` -> implicit transparent background change.

2. **Banner parity is weak.** Current Revenue banners use `rounded-lg` styling (see `ImportedBanner` and `ViewerBanner` in `revenue.tsx:32-46`). Enrollment banners use `shrink-0 border-b` with full-width expansion. PL-03 mentions `shrink-0 border-b` but the spec does not specify removing `rounded-lg` or adding the same copy/action patterns (e.g., Enrollment's imported banner has a "Open Version Management" button; Revenue's does not).

3. **Period toggle is missing from the spec.** The current Revenue page has an AY1/AY2/FY2026 period toggle group (`revenue.tsx:150-160`). The spec does not mention it anywhere -- not in the toolbar section, not in the ACs. This is either a deliberate removal (should be documented) or an oversight.

4. **No animation parity specified.** Enrollment KPI cards use `animate-kpi-enter` with staggered `animationDelay: i * 60ms` (`kpi-ribbon.tsx:93`). The spec mentions KR-03 (`animate-kpi-enter` with `50ms * index`) -- the delay is different (60ms vs 50ms). This is minor but shows the spec is specifying from memory rather than from code.

5. **Inspector transition animations.** Enrollment uses `animate-inspector-slide-in` and `animate-inspector-crossfade` (defined in `index.css:556-576`). The spec does not mention these transitions for Revenue's inspector view switches.

**Likely drift points:**

- The toolbar left/right action zoning (INV-2) is specified but the exact button order within each zone is not. Current Revenue has: [ViewMode, Period] | [Export, Settings, Setup, Calculate]. Enrollment has: [BandFilter, ExceptionFilter] | [QuickEdit, Export, Settings, SetupWizard, Calculate]. The spec says to remove Setup and keep Settings + Calculate, but does not specify the exact button ordering.
- Status strip transition from card to flat strip (SS-01) will require removing `rounded-2xl`, `shadow`, and `bg` -- the spec mentions `border-b` but not the explicit removal of these properties.

### 3.2 Design System / CSS / Tokens

**Strengths:**

- DS-01 (zero hardcoded hex) is the right gate.
- DS-06 (chart series tokens) and DS-07 (nationality badge tokens) address real gaps.
- The spec correctly identifies `--chart-tick-size` and `--chart-tooltip-size` as needed tokens.

**Weaknesses:**

1. **Chart tokens are under-enumerated.** The spec says to add `--chart-series-1` through `--chart-series-5` and chart typography tokens. But the current Revenue inspector has:
    - `CHART_COLORS = ['#2463EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED']` (5 hardcoded hex colors at `revenue-inspector.tsx:20`)
    - `fill="#2463EB"` on the monthly trend bar (`revenue-inspector.tsx:218`)
    - `fill="#16A34A"` on the active view bar (`revenue-inspector.tsx:348`)
    - Recharts tooltip with no `borderRadius` specification
    - XAxis/YAxis with no explicit `fontSize` specification

    The spec needs to define the full mapping: `--chart-series-1: var(--color-info)`, `--chart-series-2: var(--color-success)`, etc., not just their existence.

2. **Missing token: `--shadow-card-elevated`** is already in `index.css:205-207` but not used by Revenue KPI cards. The spec's DS-02 says to use it, which is correct. But the broader issue is that Revenue currently uses `shadow-(--shadow-xs)` in multiple places (KPI ribbon, grid wrapper, toolbar) where Enrollment uses `shadow-(--shadow-card-elevated)` or no shadow at all. The spec only fixes KPI cards, not the grid or toolbar.

3. **Missing Recharts tooltip `borderRadius` token.** DS-05 says to use `var(--radius-md)` for tooltip `borderRadius`. But `borderRadius` in Recharts Tooltip is set via `contentStyle` prop, not CSS. The spec should specify: `<Tooltip contentStyle={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--chart-tooltip-border)' }} />`.

4. **No token lint guard.** The spec adds tokens but provides no mechanism to prevent future hardcoded values from creeping in. A CSS lint rule or ESLint rule checking for hex literals in component files would be the correct long-term solution.

5. **Missing nationality badge tokens: values not defined.** DS-07 says `--badge-francais`, `--badge-nationaux`, `--badge-autres` (with `-bg` variants) should exist. But the spec does not specify their values. Given the domain, these need explicit color values matching the design language.

6. **Enrollment also has hardcoded chart patterns.** The spec correctly targets Revenue chart hardcodes but S1 also lists enrollment files (`inspector-active-view.tsx`, `historical-chart.tsx`) for fontSize fixes. This is good but the audit should confirm Enrollment's charts also use the new chart series tokens, not just font sizes.

### 3.3 Shared Components & Reuse

**Strengths:**

- The extraction list (SC-01 through SC-05) covers the right components.
- The spec correctly identifies that `CalculateButton`, `BAND_STYLES`, `FilterPillMenu`, `GuideSection`, and `WorkspaceStatusStrip` should be shared.
- The guide registry architecture (S9) is the right pattern -- replacing hardcoded `if (activePage === 'enrollment')` with `registerGuideContent`.

**Weaknesses:**

1. **Missing shared abstraction: Inspector section card.** Both Enrollment's inspector and Revenue's inspector (current and proposed) render sections as `<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">`. This pattern appears 4 times in the current Revenue inspector and will appear 9+ times in the proposed default view. This should be a shared `InspectorSection` component.

2. **Missing shared abstraction: Workflow status card.** RD-01 describes a workflow card with semantic left-border accent, shield icon, and status label. Enrollment's `inspector-default-view.tsx:61-72` has the same pattern with `getWorkflowAccent()`. This should be a shared `WorkflowStatusCard` component, not independently implemented.

3. **Missing shared abstraction: Breakdown table.** Both Enrollment (inspector-default-view's "Summary by Band" table) and Revenue (RA-07 through RA-10's breakdown tables) render the same pattern: colored dot + label + amount + percentage. This should be a shared `BreakdownTable` component.

4. **Missing shared abstraction: KPI card.** The spec says Revenue KPI cards should match Enrollment's pattern (icon circle, Counter, Sparkline, border-l-[3px], rounded-xl, shadow-card-elevated). Rather than having each module implement this independently, a shared `KpiCard` component with a configuration-driven API would prevent drift.

5. **Counter and Sparkline components.** Enrollment uses `Counter` from `shared/counter.tsx` and `Sparkline` from `shared/sparkline.tsx`. The spec's KR-04 says Revenue should adopt Counter, but does not mention Sparkline. Revenue KPI cards should also support sparklines for trend visualization.

6. **`WorkspaceStatusStrip` API is under-specified.** SC-05 says it accepts `sections[]` config but does not define the section type. At minimum: `{ label: string; value: ReactNode; severity?: 'default' | 'warning' | 'success' }`. Without this, each module will implement the sections differently.

7. **`FilterPillMenu` API is under-specified.** SC-03 says it accepts a `filters` config prop but does not define the filter type. Enrollment's `ExceptionFilterMenu` has `{ value: string; label: string; description?: string }` filters. Revenue's exception filter has different filter values. The shared component needs a defined interface.

8. **CalculateButton shared extraction timing.** SC-01 says to move it to shared and re-export from enrollment path. But the current `CalculateButton` (in `enrollment/calculate-button.tsx`) takes `versionId`, `onCalculate`, `isPending`, `isSuccess`, `isError`. The Revenue page currently uses a raw `<Button>` with inline calculate logic (`revenue.tsx:183-189`). The shared component's API must accommodate both modules. This needs to be defined in the spec.

### 3.4 Interaction Model & State Behavior

**Strengths:**

- GP-01 through GP-06 cover the full selection/panel lifecycle.
- ID-04 (viewMode change clears selection) is correct.
- The spec correctly identifies that `selectRow` in Revenue must integrate with `useRightPanelStore.getState().open('details')` on select and `.close()` on deselect (GP-04).

**Weaknesses:**

1. **Toggle behavior is not implemented in Revenue's selection store.** The current `revenue-selection-store.ts` has:

    ```typescript
    selectRow: (selection) => set({ selection });
    ```

    There is no toggle logic. Enrollment's store has:

    ```typescript
    selectGrade: (grade) => {
        const current = get().selection;
        if (current?.type === 'GRADE' && current.id === grade) {
            set({ selection: null });
            useRightPanelStore.getState().close();
            return;
        }
        set({ selection: { type: 'GRADE', id: grade } });
        useRightPanelStore.getState().open('details');
    };
    ```

    The spec says to add this (GP-02, GP-04) -- this is correctly identified but is a **structural rewrite**, not a minor change. Story S4 (2 points) may be under-scoped.

2. **Panel-close -> clear-selection sync is in `enrollment.tsx` but not in `revenue.tsx`.** Enrollment has:

    ```typescript
    useEffect(() => {
        if (!isPanelOpen) {
            clearSelection();
        }
    }, [clearSelection, isPanelOpen]);
    ```

    Revenue has no such effect. S4 correctly adds this but the spec should call out that this is a sync behavior replicated from enrollment, not a new invention.

3. **Subtotal/total/group-header non-selectability.** The current Revenue forecast grid has:

    ```typescript
    const isSelectable = !row.isTotal && !row.isSubtotal;
    ```

    The spec adds `group-header` to the non-selectable set (ID-02). But the current Revenue grid has no group-header rows at all -- those come with the PlanningGrid migration in S5. This means S4 (selection store) depends on S5 (PlanningGrid) for full testing, yet the dependency DAG shows S5 depends on S4, not the reverse. This is correct for implementation but means S4's tests must mock group-header rows.

4. **Keyboard navigation scope.** The spec says FG-09 requires "arrow keys move active cell, Tab/Shift+Tab cycle through columns, Enter selects row." But this is PlanningGrid behavior, not Revenue-specific behavior. If PlanningGrid already implements this, then FG-09 is really "verify PlanningGrid keyboard behavior works in Revenue context" -- not "implement keyboard navigation."

5. **Missing state: band filter reset on view mode change.** The current Revenue page keeps `viewMode` in `useState`. When the user switches from grade view (with Maternelle band filter active) to category view, should the band filter be cleared? The spec adds band filter in TF-01 but only for grade view, and ID-04 says viewMode change clears selection -- but it does not say viewMode change clears band filter. This will create a subtle bug if the filter persists invisibly.

### 3.5 Fee Grid Redesign

**This is the highest-risk section of the spec.**

**Strengths:**

- The editability classification (editable-source, editable-fanout, summary-only) is a sound model.
- The heterogeneous-value guard is the right safety mechanism.
- The HT/TTC semantics table is clear and correct.
- The round-trip guarantee test specification is rigorous.

**Weaknesses:**

1. **Three visual systems in one tab.** FR-07 says: "Tuition section uses `PlanningGrid` in compact variant with nationality grouping. Autres Frais and Abattement use simple HTML tables." This creates three distinct visual systems within a single tab:
    - PlanningGrid compact (Tuition) -- TanStack Table with headers, grouping, editable cells
    - HTML table 1 (Autres Frais) -- presumably custom styling
    - HTML table 2 (Abattement) -- read-only derived data

    The risk is that each table has slightly different padding, font sizes, border styles, and row heights. The spec should define a `FeeScheduleTable` component or CSS contract that normalizes styling across all three sections, even if the underlying implementation differs.

2. **PlanningGrid compact variant does not exist.** The spec references `PlanningGrid` in "compact variant" but the current PlanningGrid has no compact mode. The CSS tokens `--grid-compact-cell-px`, `--grid-compact-cell-py`, `--grid-compact-border`, `--grid-compact-group-bg`, `--grid-compact-group-border` exist in `index.css:181-186` but PlanningGrid itself does not consume them. S8 will need to add a `compact` prop to PlanningGrid -- this is a dependency on the shared grid component that the spec does not call out explicitly.

3. **Fan-out writeback precision.** The spec says editing an "Elementaire band" row fans out equally to CP, CE1, CE2, CM1, CM2 rows. But "equally" is ambiguous:
    - Does "fan out equally" mean the edited value replaces all 5 underlying values?
    - Or does it mean the delta is distributed equally across the 5 rows?
    - Example: If Elementaire shows 34,500 and user changes to 35,000:
        - Option A: All 5 grades become 35,000
        - Option B: Each grade gets +100 (500 / 5)
          The spec should explicitly state "replace all underlying values with the aggregate value" if that is the intent.

4. **MS+GS combined row adds UX confusion.** PS is standalone, MS+GS are combined. This means Maternelle has 2 display rows (PS standalone, MS+GS combined) instead of 3 grade rows. Users must understand that editing "MS+GS" edits both underlying grades simultaneously. The spec mentions this (FR-03) but does not specify how the row label communicates this -- "Maternelle (MS+GS)" vs "MS + GS" vs "MS/GS".

5. **Expandable grade detail is mentioned but not specified.** The heterogeneous-value section says: "user must click 'Show grade detail' to expand and edit individual grades." But no AC specifies this expand/collapse behavior. Is it an in-line expansion (rows appear below the band row)? A dialog? A tooltip? This needs an AC.

6. **FR-09 (monetary display with fr-FR locale, thousands separator, and SAR suffix) conflicts with the rest of the app.** The current Revenue grid uses `formatRevenueGridAmount` which produces numbers without a currency suffix. Enrollment uses `new Intl.NumberFormat('en-US')` for headcounts. Adding "SAR" suffix specifically to the fee grid creates an inconsistency with the forecast grid. The spec should clarify: does the fee grid alone use SAR suffix, or should all monetary displays use it?

### 3.6 Acceptance Criteria Quality

**Strengths:**

- ACs are numerous (80+) and well-organized by category.
- Most ACs are testable with specific CSS class names, token names, or behavioral outcomes.
- The empty state ACs (ES-01 through ES-07) are unusually thorough.

**Weaknesses:**

1. **"Matching enrollment" ACs are not independently testable.** DS-02 says KPI cards should use "identical to enrollment KPI cards." This is not a testable AC -- it is an aspiration. The AC should specify the exact classes: `rounded-xl border-l-[3px] shadow-(--shadow-card-elevated) hover:shadow-(--shadow-card-hover)`. (DS-02 does include these, so this is a partial concern -- the phrase "identical to enrollment" could be dropped.)

2. **Several ACs describe implementation, not outcome:**
    - GP-04: "Revenue selection store calls `useRightPanelStore.getState().open('details')` on select" -- describes the implementation, not the outcome. The outcome is "selecting a row opens the Details tab."
    - FG-01: "Forecast grid uses the shared `PlanningGrid` component" -- describes implementation. The outcome is "Forecast grid renders as a TanStack Table with band grouping, sticky headers, and keyboard navigation."

3. **Missing ACs:**
    - No AC for inspector transition animations (slide-in, crossfade on view switch)
    - No AC for `prefers-reduced-motion` support in new animations
    - No AC for Revenue page `setActivePage('revenue')` on mount and cleanup on unmount (this already exists and should be preserved)
    - No AC for the period toggle group (AY1/AY2/FY2026) -- is it being removed?
    - No AC for filter state persistence across view mode changes (the spec says viewMode change clears selection, but does it also clear band filter?)
    - No AC for Revenue inspector responsive behavior within the right panel width
    - No AC for fee grid expandable grade-detail rows

4. **Conflicting ACs:**
    - KR-01 says "4 cards: Net Tuition HT, Other Revenue, Total Operating Revenue, SAR per Student" but the current code has 5 cards (Gross Tuition HT, Total Discounts, Net Revenue HT, Other Revenue, Total Operating Revenue). The transition from 5 to 4 removes Gross Tuition and Total Discounts as standalone cards. The spec should explicitly state what is removed and why.
    - FG-10 says "Grand Total" changes to "Filtered Total" when filters are active. But Revenue currently has no band filter (only a view mode toggle). The spec adds a band filter in TF-01 but only for grade view. What about exception filters in non-grade views -- do they also trigger "Filtered Total"?

5. **Over-specified ACs:**
    - DS-02 specifies exact Tailwind classes. If these values later change in Enrollment, Revenue must be updated separately. A shared `KpiCard` component would make these literal class checks obsolete and auto-enforce parity.

### 3.7 Story Plan / Sequencing / Delivery Risk

**Strengths:**

- The dependency DAG is correct and the parallel execution plan is realistic.
- S1+S2 as foundation stories (parallel) is the right approach.
- S9 (Guide content) being independent is correct.

**Weaknesses:**

1. **S1 (1.5 points) is under-scoped.** It must:
    - Add ~15+ CSS tokens to `index.css`
    - Fix all hex colors in Revenue components
    - Fix chart font sizes in Revenue AND Enrollment components
    - Fix KPI card border radius, border width, and shadow tokens
    - Replace `CHART_COLORS` hex array with CSS variable references
    - Implement `getComputedStyle` resolver for Recharts SVG fills

    The `getComputedStyle` resolver for Recharts is a non-trivial pattern. Recharts renders to SVG and SVG `fill` attributes do not resolve CSS custom properties. You need a runtime resolver:

    ```typescript
    const rootStyle = getComputedStyle(document.documentElement);
    const series1 = rootStyle.getPropertyValue('--chart-series-1').trim();
    ```

    This pattern needs to be documented and potentially shared as a hook. 1.5 points is tight for this scope.

2. **S6 (5 points) is the largest story and has the most risk.** It rewrites the entire revenue inspector with 9 default sections and 4 context-sensitive active views. The current inspector is ~390 lines. The proposed inspector will be 800+ lines. S6 should be split:
    - S6a: Inspector default view (9 sections) -- 3 points
    - S6b: Inspector active view (4 view modes) -- 3 points
      This reduces integration risk and enables earlier review.

3. **S8 (5 points) depends on S5 for "PlanningGrid patterns established" but the dependency is soft.** S8 needs PlanningGrid compact variant, which S5 does not create -- S5 uses PlanningGrid in its standard mode for the forecast grid. The compact variant is S8-specific. This means S8 actually blocks on PlanningGrid accepting a `compact` prop, which should be an explicit subtask in S2 or S5.

4. **S10 comes too late.** Parity testing in S10 means parity violations discovered during final testing will require rework across S3-S9. A lightweight parity verification should happen at each story completion, not only as a final gate.

5. **Missing story: PlanningGrid compact mode.** No story explicitly adds a `compact` prop/variant to PlanningGrid. S8 assumes it exists. This should be a subtask in S2 or a dedicated enabling story.

6. **Hidden blocker: Recharts CSS variable resolution.** S1 needs to solve `getComputedStyle` for chart fills. This pattern must be established before S6 (which adds more charts) and before any chart-touching story. If S1 is late or the pattern is fragile, all chart-dependent stories are blocked.

### 3.8 Testing & Validation Coverage

**Strengths:**

- S10 lists specific test categories: row identity, inspector sync, view-mode reconciliation, fee schedule round-trip, aggregate writeback, guide rendering, readiness/tab consistency, export, empty states.
- QA-04 requires >= 80% coverage.

**Weaknesses:**

1. **No visual regression testing.** The spec has no mechanism to detect visual parity drift. All tests are functional. A user could pass every test while Revenue looks visibly different from Enrollment. Visual regression tools (Chromatic, Percy, Playwright visual comparisons) are not mentioned.

2. **No token usage enforcement.** DS-01 says "zero hardcoded hex colors" but there is no lint rule or test to enforce this. After initial cleanup, new hardcoded values can be introduced without detection.

3. **No DOM structure parity assertions.** The spec could include snapshot tests or structural assertions that verify:
    - Revenue page outer div has `flex h-full min-h-0 flex-col overflow-hidden`
    - Revenue toolbar has `border-b border-(--workspace-border) px-6 py-2`
    - Revenue KPI cards have `rounded-xl border-l-[3px]`
      These assertions prevent accidental CSS changes from breaking parity.

4. **No Storybook / component isolation testing.** Shared components (KpiCard, StatusStrip, FilterPillMenu) should have isolated stories that render both Enrollment and Revenue variants side-by-side. The spec does not mention this.

5. **Cross-view reconciliation test needs specificity.** The spec says "Grade/Nationality/Tariff grand totals = Category 'Tuition Fees' annual total" but does not specify precision. These are Decimal.js values -- the assertion must use `.eq()` not `===`.

6. **Fee schedule round-trip test needs edge cases.** The spec mentions "transform -> save -> re-fetch -> transform -> compare" but does not specify:
    - What happens when fan-out creates rounding issues (e.g., 100,000 / 3 grades)
    - What happens when heterogeneous values exist before transformation
    - What happens with zero-value rows

### 3.9 Accessibility & Keyboard Parity

**Strengths:**

- FG-09 covers grid keyboard navigation.
- INV-8 establishes the keyboard accessibility invariant.
- QA-05 requires WCAG AA keyboard navigation.

**Weaknesses:**

1. **Missing `aria-live` on inspector view transitions.** When selection changes, the inspector content swaps. Screen readers need `aria-live="polite"` on the inspector container or an `aria-describedby` update to announce the content change.

2. **Missing focus management on panel open/close.** When a row is selected and the panel opens, focus should move to the panel (or remain on the grid row with the panel as supplementary content). The spec does not specify focus management for panel transitions.

3. **Fee grid accessibility is under-specified.** The fee grid has three sections with different editability rules. The spec says `role="grid"` for the tuition section but does not specify:
    - `aria-readonly` on summary-only cells
    - `aria-disabled` on heterogeneous-value cells
    - Section headings for screen reader navigation
    - `aria-describedby` for the amber warning dot (tooltip text must be accessible)

4. **Missing `prefers-reduced-motion` for new animations.** The spec adds staggered reveal, KPI enter, and inspector transitions. The existing `index.css` has a `@media (prefers-reduced-motion: reduce)` block for wizard animations (`index.css:817-825`) but not for the other animation classes. New animations should be included.

### 3.10 Simplification Opportunities

**Quick wins (< 1 day each):**

1. **Extract `InspectorSection` component.** Both inspectors use `<section className="rounded-xl border border-(--workspace-border) bg-(--workspace-bg-card) p-4">`. Extract to `shared/inspector-section.tsx` with `title`, `children`, and optional `action` props. Saves ~50 lines of repeated Tailwind across both inspectors.

2. **Extract `BreakdownRow` component.** The pattern `<div className="flex items-center justify-between gap-3"><span>{label}</span><span className="font-mono tabular-nums">{amount}</span></div>` appears in both inspectors. Extract to shared.

3. **Create `useChartColor(tokenName)` hook.** A 10-line utility that calls `getComputedStyle` once and caches the result. All charts consume it instead of each inventing their own resolution.

4. **Consolidate `formatSar` / `formatCompactSar` / `formatRevenueGridAmount`.** The Revenue codebase has 3 overlapping formatting functions. One shared formatter with options would suffice: `formatMoney(value, { showCurrency?: boolean })`.

5. **Add `prefers-reduced-motion` to new animation classes** in a single CSS block.

**Medium refactors (1-2 days each):**

6. **Config-driven KPI ribbon.** Instead of each module building its own KPI ribbon, define `KpiRibbonConfig = Array<{ label: string; value: number | string; icon: LucideIcon; accentVariant: string; subtitle: string }>` and render via a shared `KpiRibbon` component.

7. **Config-driven `WorkspaceToolbar`.** The toolbar left/right zoning pattern is identical across modules. A shared `WorkspaceToolbar` component accepting `leftActions` and `rightActions` arrays would enforce consistent spacing, sizing, and ordering.

8. **PlanningGrid `compact` prop.** Add reduced padding mode consuming `--grid-compact-cell-px/py` tokens already defined in `index.css`.

9. **`FeeScheduleTable` wrapper.** Normalizes padding, font, borders across PlanningGrid compact and HTML table sections within the fee grid.

**Strategic refactors (3+ days):**

10. **Style lint rule for hex literals.** An ESLint rule or Stylelint rule that forbids hex color literals in `.tsx` files (except in CSS files and approved exceptions) would prevent token regression permanently.

11. **Component parity test harness.** A test utility that renders both the Enrollment and Revenue versions of shared components and compares their DOM structure, applied classes, and computed styles. This is the strongest drift prevention mechanism.

12. **Unified panel content registry.** Merge `registerPanelContent` and `registerGuideContent` into `registerPanelTab(page, tab, renderer)`.

---

## 4. Detailed Issue Register

| ID   | Severity | Category    | Spec Reference | Issue                                                                                                                                            | Why It Matters                                                                                  | Recommendation                                                                                              |
| ---- | -------- | ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R-01 | Critical | Layout      | PL-01          | Revenue page currently uses `space-y-4 pb-6` (scrolling page). Spec says to fix but does not enumerate all the styling that must be removed.     | Partial fix will leave hybrid layout -- some zones fixed, some scrolling.                       | Add explicit "remove" checklist: remove `space-y-4`, `pb-6`, `rounded-2xl` on grid/status/toolbar children. |
| R-02 | Critical | Selection   | GP-02, GP-04   | Revenue selection store has no toggle behavior and no right-panel integration. Current store is a simple set/clear with no toggle or panel sync. | Without toggle, the core INV-3 interaction is broken.                                           | S4 must be treated as a rewrite, not a modification. Consider increasing to 3 points.                       |
| R-03 | Critical | Fee Grid    | FR-07          | PlanningGrid compact variant does not exist. S8 assumes it does.                                                                                 | S8 will be blocked on creating compact mode, adding hidden scope.                               | Add PlanningGrid `compact` prop as explicit subtask in S2 or new story.                                     |
| R-04 | High     | Tokens      | DS-06          | Chart series token values not defined. Only names specified.                                                                                     | Implementer will choose arbitrary values, potentially mismatching semantic intent.              | Define exact values: `--chart-series-1: var(--color-info)`, `--chart-series-2: var(--color-success)`, etc.  |
| R-05 | High     | Tokens      | DS-07          | Nationality badge token values not defined.                                                                                                      | Same as R-04.                                                                                   | Define values based on domain semantics.                                                                    |
| R-06 | High     | Charts      | S1 scope       | `getComputedStyle` resolver for Recharts SVG fills is a non-trivial pattern not called out in S1.                                                | If not established cleanly, every chart will implement it differently.                          | Create `useChartColor(tokenName)` hook in `lib/chart-utils.ts`. Document pattern in S1 scope.               |
| R-07 | High     | Story scope | S6             | S6 (5 pts) combines 9 default sections + 4 active view modes in one story.                                                                       | High integration risk, late feedback, hard to review.                                           | Split into S6a (default view, 3 pts) + S6b (active view, 3 pts).                                            |
| R-08 | High     | Testing     | S10            | No visual regression testing mechanism in the spec.                                                                                              | All functional tests can pass while parity is visibly wrong.                                    | Add visual snapshot assertions for key components (KPI card, toolbar, status strip, grid row).              |
| R-09 | High     | Spec gap    | Toolbar        | Period toggle (AY1/AY2/FY2026) in current Revenue toolbar not mentioned in spec.                                                                 | Implementer will not know whether to keep or remove it.                                         | Explicitly state: keep/remove/move to settings.                                                             |
| R-10 | High     | Shared      | SC-01          | `CalculateButton` API not defined for Revenue compatibility. Current enrollment version takes `versionId`.                                       | Revenue uses inline button; API must accommodate both.                                          | Define shared API: `{ onCalculate, isPending, isSuccess, isError, disabled? }`.                             |
| R-11 | Medium   | Parity      | Banner section | Revenue banners use `rounded-lg` while Enrollment banners use `shrink-0 border-b` full-width.                                                    | Banners will look different even after PL-03 fix if rounded corners remain.                     | Explicitly remove `rounded-lg`, add `shrink-0 border-b`, match Enrollment copy pattern.                     |
| R-12 | Medium   | Animations  | KR-03          | Spec says stagger delay = 50ms x index. Enrollment code uses 60ms.                                                                               | Minor visual inconsistency in KPI entrance animation.                                           | Use Enrollment's 60ms value or define shared `--kpi-stagger-delay` token.                                   |
| R-13 | Medium   | State       | ID-04          | Band filter behavior on view mode change not specified.                                                                                          | User in grade view with Maternelle filter -> switches to category -> filter persists invisibly? | Specify: view mode change clears band filter (it is only relevant in grade view).                           |
| R-14 | Medium   | Shared      | Missing        | No shared `InspectorSection` component for the card pattern used 13+ times across inspectors.                                                    | Each section will have slightly different padding/border/radius over time.                      | Extract `shared/inspector-section.tsx`.                                                                     |
| R-15 | Medium   | Fee Grid    | Writeback      | "Fan out equally" is ambiguous for non-divisible amounts.                                                                                        | Rounding errors in writeback (e.g., 100,001 / 3).                                               | Specify rounding rule: Decimal.js `ROUND_HALF_UP`, remainder assigned to first row.                         |
| R-16 | Medium   | Fee Grid    | Missing AC     | "Show grade detail" expand behavior for heterogeneous values not specified as AC.                                                                | Critical safety UX has no testable acceptance criterion.                                        | Add AC: FR-10 specifying expand/collapse in-line behavior with chevron toggle.                              |
| R-17 | Medium   | Fee Grid    | FR-09          | SAR suffix in fee grid conflicts with forecast grid (no suffix).                                                                                 | Inconsistent monetary display within the same workspace.                                        | Define a rule: fee grid uses SAR suffix, forecast grid does not. Or standardize.                            |
| R-18 | Low      | ACs         | GP-04          | AC describes implementation (`calls useRightPanelStore.getState().open('details')`) not outcome.                                                 | Ties test to implementation detail; refactoring the store breaks the test.                      | Rewrite: "selecting a row opens the Details tab; deselecting closes the panel."                             |
| R-19 | Low      | CSS         | SS-01          | Revenue status strip removal of `rounded-2xl` and `shadow` not explicitly specified in SS-01.                                                    | Implementer may add `border-b` while keeping rounded corners, creating hybrid styling.          | SS-01 should say: "flat strip with `border-b`, no rounded corners, no box shadow."                          |
| R-20 | Low      | A11y        | Inspector      | Missing `aria-live` on inspector content region for view transitions.                                                                            | Screen readers will not announce content change when selection changes.                         | Add `aria-live="polite"` to inspector container.                                                            |

---

## 5. Hidden Risks / Drift Risks

1. **Token regression without lint guard.** The spec adds tokens but any future contributor can introduce `fill="#2463EB"` without breaking any test. Within 3 months, the token system will have gaps again.

2. **Inspector section styling drift.** Revenue's 9 default sections + active view sections will be implemented as inline JSX with Tailwind classes. Over time, padding and border tweaks in one section will not propagate to others. Without a shared `InspectorSection` component, drift is certain.

3. **Fee grid as autonomous visual system.** The fee grid uses PlanningGrid compact + two HTML tables. These three rendering systems will inevitably diverge in row height, cell padding, font size, and border color -- because they are rendered by different mechanisms (TanStack Table vs raw HTML).

4. **Chart wrapper duplication.** The spec adds charts to the default view (donut, bar), active view (monthly bar), and they all independently configure Recharts props (tooltip style, axis style, fill color). Without a shared chart wrapper, tooltip `borderRadius` and axis `fontSize` will diverge.

5. **Guide content registry is partial.** S9 introduces `registerGuideContent` for the Guide tab but the Details tab already uses `registerPanelContent`. These are two separate registries in `right-panel-registry.ts`. Future modules (Staffing, P&L) will need to register both. The spec should consider a unified panel content registry.

6. **`formatRevenueGridAmount` / `formatSar` / `formatCompactSar` proliferation.** Three overlapping formatters exist already. The spec does not consolidate them. Revenue and Enrollment formatting will diverge because they use different formatter functions.

7. **Recharts responsive container.** All current charts use fixed `width` props (`width={260}`, `width={300}` in `revenue-inspector.tsx`). The inspector panel is resizable. Charts will overflow or be cut off at narrow panel widths. The spec does not mention `<ResponsiveContainer>`.

8. **Downstream stale pills.** SS-02 specifies pill badge styling. Enrollment already has this pattern (`enrollment-status-strip.tsx:66-73`). But the styles are implemented independently. Without a shared `StalePill` component, they will diverge subtly.

---

## 6. What Is Missing from the Spec

### Missing invariants

- **INV-9: Chart styling invariant.** All Recharts charts must use CSS variable fills via `useChartColor()`, `contentStyle` with token-based border radius, and `ResponsiveContainer` for width adaptation. Font sizes must use `--chart-tick-size` and `--chart-tooltip-size` tokens.

- **INV-10: Monetary formatting invariant.** All monetary values must use a single shared formatter. The formatter must use `fr-FR` locale with thousands separator. Currency suffix (SAR) is only shown in fee grid contexts, not in forecast grids.

### Missing ACs

- Period toggle disposition: AC specifying whether AY1/AY2/FY2026 toggle is kept, removed, or relocated.
- PlanningGrid compact prop: AC that PlanningGrid accepts `compact` prop with reduced cell padding.
- Fee grid expandable rows: AC for expand/collapse of individual grade rows within a band when values are heterogeneous.
- Inspector transitions: AC for slide-in and crossfade animations on view switch.
- Chart responsive containers: AC that all charts use `ResponsiveContainer` or width adaptation.
- `prefers-reduced-motion`: AC that new animations are disabled under reduced-motion preference.

### Missing shared abstractions

- `InspectorSection` -- card wrapper for inspector sections
- `BreakdownTable` -- colored-dot + label + amount + percent table
- `WorkflowStatusCard` -- semantic-accent status card
- `ChartWrapper` / `useChartColor()` -- Recharts CSS variable resolution
- `KpiCard` -- configuration-driven KPI card with icon, counter, sparkline
- `StalePill` -- downstream stale module badge

### Missing state contracts

- Band filter reset on view mode change
- Period toggle state disposition
- Settings dialog auto-open on first visit (SM-06) interaction with existing setup wizard auto-open

### Missing layout constraints

- Maximum chart width within resizable panel
- Minimum panel width for inspector content
- Fee grid minimum dialog width for 6+ columns

---

## 7. Simplification / Refactor Opportunities

(See Section 3.10 for full details. Summary by tier:)

### Quick wins

1. Extract `InspectorSection` component
2. Extract `BreakdownRow` component
3. Create `useChartColor()` hook
4. Consolidate monetary formatting functions
5. Add `prefers-reduced-motion` CSS block

### Medium refactors

6. Config-driven KPI ribbon
7. Config-driven `WorkspaceToolbar`
8. PlanningGrid `compact` prop
9. `FeeScheduleTable` CSS normalizer

### Strategic refactors

10. Hex-literal lint rule
11. Component parity test harness
12. Unified panel content registry

---

## 8. Recommended Spec Improvements

### Priority 1 -- Must Fix Before Implementation

1. **Define chart series token values.** In DS-06, specify exact CSS values for `--chart-series-1` through `--chart-series-5`. Same for DS-07 nationality badges.

2. **Resolve period toggle disposition.** Add explicit AC: "Period toggle (AY1/AY2/FY2026) is [kept in toolbar / moved to settings / removed]."

3. **Add PlanningGrid compact variant as explicit scope.** In S2 or new enabling story, add: "PlanningGrid accepts `compact?: boolean` prop."

4. **Specify fan-out writeback semantics.** In Fee Schedule Writeback Rules, add: "Fan-out replaces all underlying values with the aggregate value. Rounding uses Decimal.js `ROUND_HALF_UP`."

5. **Split S6 into S6a (default view) + S6b (active view).** Update dependency DAG and point estimates.

### Priority 2 -- Should Fix Before Parallel Execution

6. **Add `useChartColor()` hook to S1 scope.** Document the pattern for Recharts CSS variable resolution. All subsequent chart stories depend on this.

7. **Add missing shared abstractions to S2 scope.** Include `InspectorSection`, `BreakdownTable`, `ChartWrapper` in S2's extraction list.

8. **Specify banner parity explicitly.** In PL-03: "Remove `rounded-lg` from Revenue banners. Match Enrollment's full-width `shrink-0 border-b` pattern."

9. **Add FR-10 AC for heterogeneous-value expand behavior.** "When a band row has heterogeneous underlying values, a 'Show grade detail' toggle expands individual grade rows in-line below the band row."

10. **Increase S4 scope to 3 points.** The selection store rewrite is more substantial than 2 points.

### Priority 3 -- Nice to Strengthen Before Final Build

11. **Add visual snapshot ACs to S10.** Structural snapshot assertions for key components.

12. **Add hex-literal lint rule to QA section.** No `.tsx` file in revenue or enrollment components contains hex color literals.

13. **Add `prefers-reduced-motion` AC.** All new animation classes disabled under reduced-motion preference.

14. **Add chart responsive container AC.** All Recharts charts within the right panel use `<ResponsiveContainer>`.

---

## 9. Proposed Additional Acceptance Criteria

### Design system

- **DS-08**: All Recharts charts use `<ResponsiveContainer>` or width-adaptive rendering. No fixed-width charts in resizable containers.
- **DS-09**: A shared `useChartColor(tokenName: string): string` hook exists in `lib/chart-utils.ts` for resolving CSS custom properties to SVG-compatible values.
- **DS-10**: All new animation classes are disabled under `@media (prefers-reduced-motion: reduce)`.

### Shared components

- **SC-06**: A shared `InspectorSection` component exists at `shared/inspector-section.tsx` accepting `title`, `children`, and optional `action` props. Both inspectors use it.
- **SC-07**: A shared `BreakdownTable` component exists at `shared/breakdown-table.tsx` accepting `rows: Array<{ dot?: string; label: string; amount: string; percent?: string }>`. Both inspectors use it.
- **SC-08**: PlanningGrid accepts a `compact?: boolean` prop that applies `--grid-compact-cell-px/py` tokens for reduced-density rendering.

### Interaction parity

- **GP-07**: View mode change clears both selection AND band filter (band filter is only meaningful in grade view).
- **GP-08**: Period toggle disposition is explicitly defined (kept/removed/relocated).

### Inspector parity

- **RI-01**: Inspector container has `aria-live="polite"` or equivalent for announcing content changes on selection/deselection.
- **RI-02**: Inspector view transitions use `animate-inspector-crossfade` class for smooth content swap.

### Fee grid parity

- **FR-10**: When a band row has heterogeneous underlying values, a "Show grade detail" toggle expands individual grade rows in-line. The toggle is a chevron button. Expanded rows have indented labels.
- **FR-11**: All three fee grid sections (Tuition, Autres Frais, Abattement) share consistent row height, cell padding, and border styling via a shared wrapper or CSS contract.

### Testing / QA

- **QA-06**: No `.tsx` file in `components/revenue/` contains hardcoded hex color literals. Enforced by test assertion scanning file contents.
- **QA-07**: Visual snapshots of Revenue KPI ribbon, toolbar, status strip, and grid first-row are structurally compared to Enrollment counterparts.

### Accessibility

- **A11Y-01**: Fee grid editable cells have `aria-label` describing the cell context (e.g., "Tuition HT for Francais Elementaire").
- **A11Y-02**: Fee grid heterogeneous-value cells have `aria-disabled="true"` and `aria-describedby` pointing to warning text.
- **A11Y-03**: New animation classes include `prefers-reduced-motion: reduce` disable rules.

### Drift prevention

- **DP-01**: Enrollment and Revenue both import `BAND_STYLES`, `BAND_LABELS` from `lib/band-styles.ts`. No module has its own copy.
- **DP-02**: Both modules register guide content via `registerGuideContent`. Right panel never checks `activePage` directly for guide rendering.

---

## 10. Final Recommendation

**Approve with targeted revisions.**

The spec is architecturally sound and demonstrates genuine understanding of the Enrollment page's patterns. The 8 parity invariants, row identity contract, and fee schedule writeback rules are strong foundations. The story slicing is largely correct and the parallel execution plan is realistic.

However, the spec's primary weakness is that it **describes parity without mechanistically enforcing it**. The phrase "matching enrollment" is a claim, not a contract. Without shared component extraction (InspectorSection, BreakdownTable, ChartWrapper), token value definitions (chart series, nationality badges), and parity test assertions (structural snapshots, hex-literal scanning), the implementation will achieve functional correctness while allowing visual drift.

The targeted revisions required before implementation:

1. **Resolve the 5 Priority 1 items** (token values, period toggle, PlanningGrid compact, writeback precision, S6 split) -- these are blocking ambiguities or scope issues.
2. **Add the shared abstractions** (InspectorSection, BreakdownTable, useChartColor) to S2 -- needed by S6/S7 and will prevent drift at the component level.
3. **Add the proposed ACs** for design system enforcement (DS-08 through DS-10), accessibility (A11Y-01 through A11Y-03), and drift prevention (DP-01, DP-02).

With these revisions, parity confidence moves from 6.5/10 to ~8.5/10. The remaining 1.5 points require visual regression tooling, which is a separate infrastructure investment and should not block this epic.
