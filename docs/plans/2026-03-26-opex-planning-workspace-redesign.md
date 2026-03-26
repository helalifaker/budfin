# OpEx Planning Workspace Redesign

**Date:** 2026-03-26
**Status:** Design Approved
**Scope:** OpEx page UX overhaul + shared grid infrastructure upgrade

## Problem Statement

The current OpEx planning page is a manual data-entry form, not a planning workspace. Users must enter 12 monthly values per line item individually, with no automation, no bulk operations, and no Excel-like keyboard behavior. The grid is not functional for real financial planning workflows where the typical flow is "copy last year's actuals, adjust line by line."

### Pain Points

1. **No entry automation** -- 38 line items x 12 months = 456 cells entered manually
2. **No "copy from prior year"** -- users re-enter numbers that already exist in the system
3. **Grid is not keyboard-driven** -- no multi-cell selection, no copy/paste, no fill-down
4. **No entry modes** -- Rent (same every month) and Equipment Maintenance (summer only) require the same tedious manual entry
5. **School calendar awareness missing** -- many expenses run 10 months (Sep-Jun), not 12, but there's no way to express this
6. **Per-cell API calls** -- every cell edit fires an individual mutation, no batching or undo
7. **Right panel is read-only** -- shows details but can't edit line item properties
8. **OpEx % of Revenue KPI is broken** -- hardcoded to 0%

## Design Decisions

### D1: Page Layout -- Full-Width Grid + Slide-Out Panel

The grid takes the full page width (maximizing column visibility for 12 months). The property panel slides out from the right when a row is selected, overlapping the grid. Dismissed with Esc or clicking outside.

**Implementation:** Add an `isOverlay` mode to the existing `RightPanelStore`. When OpEx sets `isOverlay: true`, the panel renders with `position: absolute` + `z-index` instead of flexbox layout, so the grid retains full width underneath. Other pages continue to use the docked mode. This preserves the existing panel registry pattern -- no new component needed.

**Rationale:** OpEx has 12 monthly columns + FY Total + entry mode + line item name. Full width is needed to avoid horizontal scrolling. A persistent side panel would compress the grid too much.

### D2: Standard Page Structure

The page follows the established BudFin planning page structure exactly:

```
PlanningShell
  ContextBar
  VersionAccentStrip
  Conditional Banners (locked, viewer, uncalculated)
  ─────────────────────────────────────────────────
  TOOLBAR
    Left:  [Operating | Non-Operating] tabs
    Right: [Initialize from...] [Export] [Print] [Calculate]
  KPI RIBBON
    Total OpEx | vs Prior Year (delta%) | OpEx % of Revenue | Items (filled/total)
  STATUS STRIP (WorkspaceStatusStrip)
    Last calculated | Stale modules | Line item counts
  GRID ZONE (flex-1, scrollable)
  ─────────────────────────────────────────────────
  RightPanel (registered via side-effect, slide-out overlay)
```

No contextual toolbar that transforms on selection -- this is not an established pattern in the application. Bulk actions triggered via keyboard shortcuts and right-click context menu instead.

### D3: Four Entry Modes

Each line item has an `entryMode` field that controls how monthly amounts are generated:

| Mode                   | Input                          | Monthly Behavior                                                                                     | FY Total                 |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------ |
| **FLAT**               | Any month cell                 | All active months auto-fill with that value                                                          | Sum of months (computed) |
| **SEASONAL**           | Individual month cells         | All months start at 0. Enter values only where needed. Zero months shown as dash.                    | Sum of months (computed) |
| **ANNUAL_SPREAD**      | FY Total cell                  | System divides evenly across active months. Remainder to last active month. Monthly cells read-only. | Editable input           |
| **PERCENT_OF_REVENUE** | Rate (in panel or mode column) | Computed from monthly revenue x rate. All cells read-only.                                           | Sum of months (computed) |

**Visual distinction:** Input cells are bright/editable. Computed cells are dimmed/italic. Users always know what they can touch.

**FLAT mode detail:** Entering a value in any month fills all active months. To override a single month, double-click or press F2 on that cell -- it becomes "custom" (shown with a subtle override indicator via `--cell-override-bg`). The FY Total reflects the actual sum including overrides. Override tracking is stored via `flatOverrideMonths` (an `Int[]` on the line item) listing which months have user overrides. When `flatAmount` changes, overridden months keep their values; non-overridden months update to the new flat amount.

**PERCENT_OF_REVENUE rate storage:** The `computeRate` field is a fractional multiplier stored as `Decimal(7,6)`. A 6% rate is stored as `0.06`, not `6`. The UI must multiply by 100 for display ("6%") and divide by 100 before storage. The existing inspector display has a bug showing "0.06%" -- this will be fixed as part of this work.

**ANNUAL_SPREAD worked example:** Annual total = SAR 100,003, active months = 10 (Sep-Jun = months 9,10,11,12,1,2,3,4,5,6). Monthly = `Decimal('100003').dividedBy(10).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)` = 10,000.3000. All 10 months get 10,000.3000. The sum (100,003.0000) equals the annual total exactly because 10 x 10,000.3000 = 100,003.0000. If there is a remainder (e.g., annual = 100,001, monthly = 10,000.1000, sum = 100,001.0000), no adjustment needed. For cases where rounding creates a discrepancy, the remainder is added to the last active month (month 6, June). Zero active months is blocked by validation -- minimum 1 active month required. Negative annual totals are supported (expense credits/refunds).

### D4: School Calendar + Active Months

Two-tier system for month activation:

**Global school calendar** (page-level setting in OpEx Settings dialog):

- Defines default active months (e.g., Sep-Jun = 10 months)
- Stored as `activeMonthsDefault` on the version's OpEx configuration
- New line items inherit the school calendar

**Per-item override:**

- Each line item can override to "Full Year" (all 12), "School Calendar" (inherit default), or "Custom" (pick specific months)
- Stored as `activeMonths` array on the line item (null = inherit calendar)
- Examples: Rent = Full Year, School Materials = School Calendar, External Audit = Custom (Jan-Mar only)

**Grid behavior for inactive months:**

- Inactive month cells are disabled (grayed out, not editable)
- Show dash instead of 0
- Clearly distinguishable from active months with 0 value
- Uses existing `--cell-readonly-bg` token for inactive cells

### D5: Initialization Flow

"Initialize from..." button in the toolbar opens a dialog with:

| Source                 | Behavior                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prior Year Actuals** | Copies the `fy2025Actual` / `fy2024Actual` annual totals (monthly breakdown is not available). Entry mode set to ANNUAL_SPREAD. Divides annual total by active months. User selects which prior year to use (FY2025 or FY2024). |
| **Another Version**    | Pick any existing version from dropdown (including V6 Budget). Copies line items, monthly amounts, entry modes, active months as-is. This is the primary workflow -- copying V6 or last year's draft and adjusting.             |
| **Start Fresh**        | Empty grid with category structure only. You add line items manually.                                                                                                                                                           |

**Note:** "Prior Year Actuals" uses annual totals only because the current data model stores `fy2025Actual` / `fy2024Actual` as single annual figures, not monthly breakdowns. If monthly actuals become available in the future (e.g., via accounting system import), this source can be upgraded to copy per-month values with SEASONAL mode.

**Destructive with confirmation:** "This will replace all 38 current line items. 12 items have been modified since last initialization. Continue?" No merge/additive mode -- clean slate to avoid ambiguity.

Initialization preserves line item structure (names, categories, display order) from the source. After initialization, all values are editable and can be adjusted.

### D6: Slide-Out Property Panel -- Compact Sections

Single scrollable view (no tabs) with these sections:

1. **Header:** Section type label + Line item name (editable)
2. **Category:** Dropdown to move between IFRS categories
3. **Entry Mode:** Toggle buttons (Flat / Seasonal / Annual / % Rev)
4. **Active Months:** Clickable month pills (J F M A M J J A S O N D) + "Use school calendar" reset link
5. **Divider**
6. **KPI Cards:** FY Total + % of Category (mini card pair)
7. **Historical Comparison:** Current Plan vs V6 Budget (with delta %) vs FY2025 Actual vs FY2024 Actual
8. **Comment:** Editable textarea
9. **Quick Actions:** Copy from V6 Budget | Apply % adjustment | Delete line item
10. **Display Order:** Position within category + up/down arrows

**Panel width:** ~380px (consistent with other inspector panels in the app).

Changes in the panel apply immediately to the grid row (optimistic update). Entry mode changes trigger recalculation of monthly amounts per the new mode's rules.

### D7: Excel-Grade Keyboard Navigation (Shared PlanningGrid Upgrade)

Built into the shared `PlanningGrid` component so all planning pages benefit.

**Navigation:**

- Arrow keys: move between cells
- Tab / Shift+Tab: move right / left
- Enter: commit edit + move down
- Home / End: first / last column in row
- Ctrl+Home / Ctrl+End: first / last cell in grid
- Page Up / Down: scroll by visible rows

**Editing:**

- Start typing: overwrite cell value (overwrites mode)
- F2: enter edit mode (cursor in existing value)
- Escape: cancel edit, restore previous value
- Double-click: enter edit mode

**Selection:**

- Shift+Arrow: extend selection range
- Shift+Click: extend selection to clicked cell
- Ctrl+Click: toggle cell in multi-selection
- Click row header: select entire row

**Bulk operations on selection:**

- Ctrl+C / Ctrl+V: copy/paste (clipboard-compatible with Excel)
- Ctrl+D: fill down (copy top cell to all selected below)
- Ctrl+R: fill right (copy left cell to all selected right)
- Delete: clear selected cells to zero
- Type value into multi-cell selection: fill all selected

**Undo/Redo:**

- Ctrl+Z: undo last action (local buffer)
- Ctrl+Shift+Z: redo
- Changes batch locally, auto-save after 2 seconds of inactivity (debounced)

### D8: Drag-and-Drop Row Management

- Drag handle (grip icon) on left edge of each row
- Drag within a category: reorder display position
- Drag onto a different category header within the **same section type**: move line item to that category
- **Cross-section drag (operating to non-operating) is NOT allowed** -- operating and non-operating have different IFRS category sets (`OPEX_IFRS_CATEGORIES` vs `NON_OPERATING_IFRS_CATEGORIES`). Cross-section moves must be done via the property panel's category dropdown, which validates against the appropriate category list and shows a confirmation dialog to prevent accidental financial misclassification.
- Visual feedback: drop zone highlighted, ghost row follows cursor. Invalid drop zones (wrong section) show a "not allowed" cursor.
- After drop: API call to update `displayOrder` and/or `ifrsCategory`

### D9: Debounced Batch Saves

Replace per-cell API calls with a batched approach:

1. User edits cells (one or many)
2. Changes accumulate in a local dirty buffer (Zustand store)
3. After 2 seconds of inactivity, batch all dirty changes into a single `PUT /opex/monthly` call
4. Optimistic UI: grid shows new values immediately
5. On success: clear dirty buffer, flash save indicator
6. On error: revert to server values, show error toast
7. Unsaved changes indicator in status strip: "3 unsaved changes" with severity warning

**Undo/redo boundary:** Undo only operates on the local buffer (unflushed changes). Once a save completes successfully, those changes are removed from the undo stack and cannot be undone. This keeps the mechanism simple and avoids cross-flush complexity. If a user needs to revert saved changes, they use "Initialize from..." to restore from a prior version.

### D10: Fix Broken KPI

The "OpEx % of Revenue" KPI card is currently hardcoded to 0%. Fix by computing it from the OpEx summary total and the revenue total for the version. The API already has both values available -- the calculation just needs to be wired through.

## Data Model Changes

### New fields on `OpExLineItem`

```prisma
model OpExLineItem {
  // ... existing fields ...
  entryMode          String    @default("SEASONAL")  // FLAT | SEASONAL | ANNUAL_SPREAD | PERCENT_OF_REVENUE
  activeMonths       Int[]     @default([])           // Empty = inherit school calendar. Array of month numbers (1-12). Validated: each value 1-12, unique.
  annualTotal        Decimal?  @db.Decimal(15, 4)     // Used by ANNUAL_SPREAD mode as the input value
  flatAmount         Decimal?  @db.Decimal(15, 4)     // Used by FLAT mode as the per-month input value
  flatOverrideMonths Int[]     @default([])           // Months with user overrides in FLAT mode. Listed months keep their MonthlyOpEx value when flatAmount changes.
}
```

### School calendar on BudgetVersion

Add `schoolCalendarMonths` directly to `BudgetVersion` (similar to how `staleModules` is stored) rather than creating a sparse single-field table:

```prisma
model BudgetVersion {
  // ... existing fields ...
  schoolCalendarMonths Int[]  @default([1, 2, 3, 4, 5, 6, 9, 10, 11, 12])  // Default: Jan-Jun + Sep-Dec (no Jul/Aug)
}
```

This field is version-scoped because different versions may model different school year configurations. The default `[1,2,3,4,5,6,9,10,11,12]` represents a standard school year (Sep-Jun, skipping Jul/Aug). If more OpEx-specific config fields are needed in the future, a dedicated `OpExConfig` table can be introduced then.

### Migration notes

- Existing line items get `entryMode = "SEASONAL"` (preserves current behavior -- all months editable independently)
- `activeMonths = []` (inherit calendar, which defaults to full year for backward compatibility)
- `annualTotal` and `flatAmount` computed from existing monthly data on migration
- **`computeMethod` deprecation plan (atomic in Phase 2):**
    1. Migration adds `entryMode` column, populates from `computeMethod`: `MANUAL` -> `"SEASONAL"`, `PERCENT_OF_REVENUE` -> `"PERCENT_OF_REVENUE"`
    2. Migration adds `flatOverrideMonths` (empty default) and `schoolCalendarMonths` on `BudgetVersion`
    3. Engine updated to read `entryMode` instead of `computeMethod` in the same PR
    4. Routes updated: Zod schemas, create/update handlers switch from `computeMethod` to `entryMode`
    5. Types updated: `OpExComputeMethod` type replaced by `OpExEntryMode`
    6. `computeMethod` column dropped in a follow-up migration after Phase 2 is verified in production
    7. All references in `opex-inspector.tsx`, `import-opex-from-excel.ts`, and test files updated

## API Changes

### New endpoint: Initialize OpEx

```
POST /api/v1/versions/:versionId/opex/initialize
Body: { source: "PRIOR_YEAR_ACTUALS" | "VERSION", sourceVersionId?: number, priorYear?: "FY2025" | "FY2024" }
Response: { data: OpExLineItem[], summary: OpExSummary }
```

- `source = "PRIOR_YEAR_ACTUALS"`: Uses `fy2025Actual` or `fy2024Actual` annual totals (per `priorYear` param). Sets `entryMode = "ANNUAL_SPREAD"`. No monthly breakdown available.
- `source = "VERSION"`: Copies from `sourceVersionId` (required). Copies line items, monthly amounts, entry modes, active months. This covers both V6 budget and any other version.

Requires `data:edit` permission. Version must be unlocked. Destructive -- replaces all existing line items.

### Modified endpoint: Bulk update monthly

```
PUT /api/v1/versions/:versionId/opex/monthly
Body: { updates: Array<{ lineItemId: number, month: number, amount: string }> }
```

Already exists. No change needed -- it already supports bulk updates. The frontend just needs to batch changes instead of sending one at a time.

### New endpoint: Update line item properties

```
PATCH /api/v1/versions/:versionId/opex/line-items/:lineItemId
Body: { entryMode?, activeMonths?, ifrsCategory?, displayOrder?, comment?, lineItemName?, annualTotal?, flatAmount? }
```

Used by the property panel for updating individual line item settings. Returns the updated line item with recomputed monthly amounts (if entry mode or active months changed).

### New endpoint: Reorder line items

```
PUT /api/v1/versions/:versionId/opex/line-items/reorder
Body: { moves: Array<{ lineItemId: number, ifrsCategory: string, displayOrder: number }> }
```

Used by drag-and-drop. Supports both reordering within a category and moving between categories in a single call.

### Modified endpoint: School calendar (on version)

School calendar is read/written via the existing version endpoints. The `GET /api/v1/versions/:versionId` response already includes all version fields -- `schoolCalendarMonths` will be included automatically. To update:

```
PATCH /api/v1/versions/:versionId
Body: { schoolCalendarMonths: number[] }
```

Validation: `z.array(z.number().int().min(1).max(12)).min(1).refine(arr => new Set(arr).size === arr.length)` -- at least 1 month, all unique, all 1-12.

## Engine Changes

The `computeOpEx()` function in `services/opex/opex-engine.ts` needs to handle the new entry modes:

1. **FLAT mode:** When a line item has `entryMode = "FLAT"`, compute monthly amounts from `flatAmount` for all active months. Zero for inactive months. Allow per-month overrides stored in `monthlyAmounts`.
2. **ANNUAL_SPREAD mode:** When `entryMode = "ANNUAL_SPREAD"`, compute monthly amounts from `annualTotal / activeMonthCount`. Remainder allocated to last active month.
3. **SEASONAL mode:** No change -- monthly amounts are the direct input (current behavior).
4. **PERCENT_OF_REVENUE mode:** No change -- already implemented.

The engine remains a pure function with no DB dependencies. The new fields (`entryMode`, `activeMonths`, `annualTotal`, `flatAmount`) are passed in as part of the line item data.

## Frontend Changes

### Shared infrastructure (benefits all planning pages)

| Component                   | Change                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlanningGrid`              | Enhance multi-cell selection (Shift+Arrow, Shift+Click, Ctrl+Click). The `useGridSelection` hook already exists -- extend it with range selection and multi-select support.         |
| `PlanningGrid`              | Enhance keyboard navigation. The `useGridKeyboard` hook already exists -- extend with Home/End, Page Up/Down, and overwrite-on-type entry mode.                                     |
| `EditableCell`              | Add overwrite-on-type mode (current: click-to-edit only). Start typing replaces value without click.                                                                                |
| `EditableCell`              | Add F2 for edit mode (cursor in existing value) vs direct-type for overwrite mode.                                                                                                  |
| Enhance: `useGridClipboard` | Hook already exists -- extend with Ctrl+D (fill down) and Ctrl+R (fill right). Ensure clipboard format is tab-separated (Excel-compatible).                                         |
| New: `useGridUndoRedo`      | New hook for Ctrl+Z/Shift+Z. Local change buffer with undo stack.                                                                                                                   |
| `index.css`                 | New design tokens: `--cell-inactive-bg`, `--cell-inactive-text`, `--grid-drop-zone-bg`, `--entry-mode-flat`, `--entry-mode-seasonal`, `--entry-mode-annual`, `--entry-mode-revenue` |

### OpEx-specific components

| Component                         | Change                                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opex-page.tsx`                   | Add "Initialize from..." button in toolbar. Add OpEx Settings dialog (school calendar). Wire debounced batch saves.                                                                                                                                                                                               |
| `opex-grid.tsx`                   | Add entry mode column. Add drag handle column. Use inactive month styling. Distinguish input vs computed cells per entry mode. Remove duplicate code with `non-operating-grid.tsx` -- unify into single component with `sectionType` prop.                                                                        |
| `non-operating-grid.tsx`          | Remove. Merge into `opex-grid.tsx` with `sectionType` prop. The unified component must use `sectionType` to select the correct category style map: `CATEGORY_STYLES` (12 operating categories) vs `NON_OP_CATEGORY_STYLES` (4 non-operating categories: Depreciation, Impairment, Finance Income, Finance Costs). |
| `opex-inspector.tsx`              | Redesign as compact sections panel. Add editable fields: category dropdown, entry mode toggles, active months picker, comment textarea, quick actions.                                                                                                                                                            |
| `opex-kpi-ribbon.tsx`             | Fix OpEx % of Revenue (currently hardcoded 0%). Compute from summary data.                                                                                                                                                                                                                                        |
| New: `opex-settings-dialog.tsx`   | School calendar configuration. Month picker for default active months. Preview of affected line items.                                                                                                                                                                                                            |
| New: `opex-initialize-dialog.tsx` | Source selection dialog with confirmation. Shows preview of what will be replaced.                                                                                                                                                                                                                                |
| `opex-selection-store.ts`         | Extend to support multi-cell selection state (not just single row).                                                                                                                                                                                                                                               |
| New: `opex-dirty-store.ts`        | Zustand store for local dirty buffer. Tracks pending changes, undo stack, unsaved count.                                                                                                                                                                                                                          |

## Design Tokens (added to index.css)

```css
/* Entry mode badge colors */
--entry-mode-flat: var(--info);
--entry-mode-flat-bg: var(--info-bg);
--entry-mode-seasonal: var(--success);
--entry-mode-seasonal-bg: var(--success-bg);
--entry-mode-annual: var(--error);
--entry-mode-annual-bg: var(--error-bg);
--entry-mode-revenue: var(
    --version-locked
); /* #7c3aed -- reuses existing purple token from version badges */
--entry-mode-revenue-bg: var(--version-locked-bg); /* #ede9fe */

/* Inactive month cells */
--cell-inactive-bg: var(--workspace-bg);
--cell-inactive-text: var(--text-muted);

/* Drag and drop */
--grid-drop-zone-bg: color-mix(in srgb, var(--accent-100) 50%, transparent);
--grid-drop-zone-border: var(--accent-300);

/* Dark overrides */
.dark {
    --entry-mode-flat-bg: color-mix(in srgb, var(--info) 20%, var(--workspace-bg-card));
    --entry-mode-seasonal-bg: color-mix(in srgb, var(--success) 20%, var(--workspace-bg-card));
    --entry-mode-annual-bg: color-mix(in srgb, var(--error) 20%, var(--workspace-bg-card));
    --entry-mode-revenue-bg: color-mix(
        in srgb,
        var(--version-locked) 20%,
        var(--workspace-bg-card)
    );
    --cell-inactive-bg: color-mix(in srgb, var(--workspace-bg) 80%, black);
}
```

## Phasing

### Phase 1: Grid Infrastructure (shared, all pages benefit)

- Enhance `useGridSelection` hook (range selection, multi-select via Shift/Ctrl)
- Enhance `useGridKeyboard` hook (Home/End, Page Up/Down, overwrite-on-type entry)
- Enhance `useGridClipboard` hook (Ctrl+D fill down, Ctrl+R fill right, Excel-compatible TSV)
- `EditableCell` overwrite-on-type + F2 mode
- New design tokens in `index.css`

### Phase 2: OpEx Data Model + Engine (atomic migration)

- Prisma migration: add `entryMode`, `activeMonths`, `annualTotal`, `flatAmount`, `flatOverrideMonths` to `VersionOpExLineItem`; add `schoolCalendarMonths` to `BudgetVersion`
- Populate `entryMode` from existing `computeMethod` (`MANUAL` -> `SEASONAL`, `PERCENT_OF_REVENUE` -> `PERCENT_OF_REVENUE`)
- Update engine to read `entryMode` instead of `computeMethod`
- Update routes/Zod schemas to use `entryMode`
- Update `@budfin/types`: replace `OpExComputeMethod` with `OpExEntryMode`
- PATCH endpoint for line item properties
- Engine updates for FLAT and ANNUAL_SPREAD modes
- Drop `computeMethod` in follow-up migration after verification
- Merge `opex-grid.tsx` + `non-operating-grid.tsx` into unified component (with `sectionType`-aware category style maps)

### Phase 3: OpEx UI Overhaul

- Entry mode column in grid
- Slide-out property panel redesign (compact sections, editable) via `isOverlay` mode on `RightPanelStore`
- Active months picker (panel + settings dialog)
- School calendar global setting (OpEx settings dialog + version PATCH)
- Fix KPI (OpEx % of Revenue) -- compute from summary + revenue data
- Fix `computeRate` display bug in inspector (multiply by 100 for percentage display)
- Debounced batch saves + dirty store
- Undo/redo (local buffer only, cleared on successful save)

### Phase 4: Initialization + Drag-and-Drop

- Initialize dialog + API endpoint (Prior Year Actuals, Another Version, Start Fresh)
- Drag-and-drop reordering (within same section type only)
- Reorder API endpoint
- Cross-category move via property panel dropdown (with confirmation dialog)

## Out of Scope

- Applying this redesign to other planning pages (Enrollment, Revenue, Staffing) -- they benefit from shared grid upgrades but don't get entry modes or initialization flows
- Formula cells or cross-line-item references
- Conditional formatting rules
- Column hiding/showing/reordering
- Real-time collaboration (multi-user editing)
