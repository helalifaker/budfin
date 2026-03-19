# Staffing Workspace Refactor: 4-Tab Pipeline + Slim Settings Dialog

**Date**: 2026-03-19
**Status**: Draft
**Scope**: Frontend-only refactor (no backend engine changes)

---

## Executive Summary

Replace the staffing page's 2-mode workspace (Teaching/Support) and 4 view presets (Need/Coverage/Cost/Full View) with a 4-tab planning pipeline: **Demand -> Roster -> Coverage -> Costs**. Replace the `StaffingSettingsSheet` (720px side sheet with horizontal tabs) with a `StaffingSettingsDialog` (full-screen dialog matching the revenue settings pattern).

---

## Architecture Decision: Why 4 Tabs

The current 2-mode split (Teaching vs Support) forces users to context-switch between two different table structures. The 4 view presets within Teaching mode add further cognitive overhead. The new 4-tab model maps directly to the staffing planning workflow:

1. **Demand** -- "What does the school need?" (curriculum-driven requirements)
2. **Roster** -- "Who do we have?" (all employees in one unified grid)
3. **Coverage** -- "Are needs met?" (requirement-vs-assignment gap analysis)
4. **Costs** -- "What will it cost?" (monthly/departmental cost views)

This linear pipeline eliminates the Teaching/Support split and the Need/Coverage/Cost/Full View presets. Support employees appear alongside teaching employees in the Roster tab, filtered by a sub-toggle.

---

## Phase Breakdown

### Phase 0: Infrastructure (Foundation)

**Goal**: Create the stores, types, and workspace utility changes needed by all subsequent phases. No visible UI changes.

#### Files to Create

| File                                       | Purpose                                                                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `stores/staffing-workspace-store.ts`       | Zustand store: `activeTab`, `rosterFilter`, `costsSubView`, `demandBandFilter`                                                |
| `stores/staffing-settings-dialog-store.ts` | Zustand store mirroring `revenue-settings-dialog-store.ts`: `isOpen`, `activeTab`, `open()`, `close()`, `setTab()`            |
| `stores/staffing-settings-dirty-store.ts`  | Zustand store mirroring `revenue-settings-dirty-store.ts`: `dirtyFields` Map, `markDirty()`, `clearTab()`, `clearAll()`       |
| `lib/staffing-readiness.ts`                | Readiness checker (5 areas: profiles, costAssumptions, curriculum, lyceeGroups, enrollment). Parallels `revenue-readiness.ts` |

#### Files to Modify

| File                        | Change                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/staffing-workspace.ts` | Add `StaffingTab` type (`'demand' \| 'roster' \| 'coverage' \| 'costs'`), `RosterFilter` type (`'all' \| 'teaching' \| 'support'`), `CostsSubView` type (`'monthly' \| 'department'`). Keep existing types (they're still used in Phase 1). |

#### Files to Delete

None in this phase.

#### Risk

- **Low**. Pure additive changes -- new files, no existing behavior affected.

#### Testing

- Unit tests for `staffing-workspace-store.ts` (tab transitions, filter state)
- Unit tests for `staffing-readiness.ts` (readiness computation)

---

### Phase 1: StaffingSettingsDialog (Revenue Pattern Clone)

**Goal**: Build the new settings dialog matching the revenue pattern. Run it side-by-side with the old sheet during development.

**Dependency**: Phase 0 (stores)

#### Files to Create

| File                                                    | Purpose                                                                                                                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/staffing/staffing-settings-dialog.tsx`      | Full-screen Dialog (90vh x 90vw) with left sidebar, vertical tabs, readiness bar, per-tab save buttons, dirty state warnings. 5 tabs: Service Profiles & ORS, Cost Assumptions, Curriculum, Lycee Groups, Enrollment |
| `components/staffing/staffing-settings-dialog.test.tsx` | Test: renders, tab switching, dirty state warning, save per tab                                                                                                                                                      |

#### Tab Content Architecture

The dialog extracts tab content from the existing `StaffingSettingsSheet` into the new dialog layout. No new data hooks needed -- the same hooks (`useStaffingSettings`, `useServiceProfileOverrides`, `useCostAssumptions`, `useLyceeGroupAssumptions`, `useHeadcount`) are reused.

**Tab 1: Service Profiles & ORS**

- Content: Profile table with editable ORS + HSA settings grid
- Source: Lines 419-587 of current `staffing-settings-sheet.tsx`
- Save: `usePutStaffingSettings` + `usePutServiceProfileOverrides`

**Tab 2: Cost Assumptions**

- Content: Cost categories table with mode selector and value input
- Source: Lines 752-845 of current `staffing-settings-sheet.tsx`
- Save: `usePutCostAssumptions`

**Tab 3: Curriculum (DHG Rules)**

- Content: Read-only DHG rules grouped by band, with "Edit in Master Data" link
- Source: Lines 590-657 of current `staffing-settings-sheet.tsx`
- Save: None (read-only, link to master data)

**Tab 4: Lycee Groups**

- Content: Editable group count and hours per group
- Source: Lines 660-749 of current `staffing-settings-sheet.tsx`
- Save: `usePutLyceeGroupAssumptions`
- Visibility: Only shown when DHG rules include GROUP driver type

**Tab 5: Enrollment**

- Content: AY2 headcount table, stale warning, link to enrollment page
- Source: Lines 848-904 of current `staffing-settings-sheet.tsx`
- Save: None (read-only, link to enrollment page)

#### Key Patterns (from Revenue Dialog)

- Readiness progress bar in header using `ReadinessIndicator`
- Per-tab readiness badges in sidebar
- Field-level dirty tracking via `staffing-settings-dirty-store.ts`
- Inline unsaved-changes warning on tab switch
- `AlertDialog` confirmation on close with dirty state
- Auto-route to first incomplete tab on open
- Per-tab save buttons (not dialog-level save)

#### Files to Modify

| File                          | Change                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/planning/staffing.tsx` | Import and render `StaffingSettingsDialog` alongside existing `StaffingSettingsSheet`. Wire Settings button to new dialog store. (Dual-render during dev; sheet removed in Phase 4) |

#### Risk

- **Low-Medium**. The revenue pattern is well-established. Main risk is getting per-tab save isolation right (each tab saves independently vs the old sheet's monolithic save).

#### Testing

- Render test: dialog opens, shows 5 tabs in sidebar
- Tab switching with dirty state warning
- Save per tab clears dirty state for that tab
- Close with dirty state shows AlertDialog
- Readiness bar reflects backend readiness data

---

### Phase 2: Demand Tab + Roster Tab (Core Work Surfaces)

**Goal**: Build the two primary data tabs. This is the largest phase.

**Dependency**: Phase 0 (stores), Phase 1 (settings dialog for testing)

#### Files to Create

| File                                       | Purpose                                                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/staffing/demand-tab.tsx`       | Wraps existing `TeachingMasterGrid` with band filter. KPI ribbon: Total FTE needed, Total hours, Sections. No view presets -- always shows full requirement columns.   |
| `components/staffing/demand-tab.test.tsx`  | Test: renders grid, band filter works, KPI values correct                                                                                                              |
| `components/staffing/roster-tab.tsx`       | Evolves `EmployeeGrid` with sub-filter (Teaching/Support/All), Add Employee + Add Vacancy buttons, click-to-select wiring. Opens `EmployeeForm` sheet for create/edit. |
| `components/staffing/roster-tab.test.tsx`  | Test: renders grid, sub-filter toggles, employee selection, form open/close                                                                                            |
| `components/staffing/demand-kpi-strip.tsx` | Compact KPI strip for Demand tab (3 values: Total FTE, Total Hours, Sections)                                                                                          |
| `components/staffing/roster-kpi-strip.tsx` | Compact KPI strip for Roster tab (3 values: Headcount, Monthly Payroll, Unassigned)                                                                                    |

#### Design: Demand Tab

```
+--------------------------------------------------+
| [Band Filter: All | Mat | Elem | Col | Lyc]       |
+--------------------------------------------------+
| KPI: Total FTE Needed | Total Hours | Sections    |
+--------------------------------------------------+
| TeachingMasterGrid (Need + Coverage columns)       |
| - Always shows: Line, Profile, Units, Hrs/w,      |
|   ORS, Eff.ORS, Raw FTE, Plan FTE, Rec.Pos,       |
|   Covered, Gap, Status, Staff                      |
| - Band grouping with collapsible headers           |
| - Click row -> right panel shows requirement       |
|   detail (existing inspector behavior)             |
+--------------------------------------------------+
```

The Demand tab replaces the Teaching mode's requirement grid. It uses the existing `TeachingMasterGrid` component directly. The `viewPreset` prop is hardcoded to `'Full View'` (always show all columns). The `bandFilter` and `coverageFilter` are local state controlled by the tab's toolbar.

#### Design: Roster Tab

```
+--------------------------------------------------+
| [Sub-filter: All | Teaching | Support]             |
| [Add Employee] [Add Vacancy] [Import]              |
+--------------------------------------------------+
| KPI: Headcount | Monthly Payroll | Unassigned      |
+--------------------------------------------------+
| EmployeeGrid (evolved)                             |
| - Department grouping with collapsible headers     |
| - Columns: Code, Name, Role, Status, Saudi,        |
|   Teaching, Discipline, Band, Base Salary           |
| - Click row -> opens right panel or EmployeeForm   |
| - Inline search filter                             |
+--------------------------------------------------+
```

The Roster tab unifies Teaching and Support employees into a single grid. It reuses the existing `EmployeeGrid` component, extending it with:

- A sub-filter toggle (Teaching/Support/All) that filters `employees` by `isTeaching`
- Integration with `EmployeeForm` for create/edit (the form already exists with all fields)
- Right panel selection for employee detail view

#### Files to Modify

| File                                    | Change                                                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/staffing/employee-grid.tsx` | Add optional `discipline` and `homeBand` columns. Add `onDoubleClick` prop for opening edit form. No structural changes.                                                          |
| `stores/staffing-selection-store.ts`    | Add `selectEmployee(employeeId, department)` action (generic, not just "support"). Keep existing `selectRequirementLine` and `selectSupportEmployee` as aliases during migration. |

#### Risk

- **Medium**. The Demand tab is straightforward (wraps existing grid). The Roster tab requires integrating `EmployeeGrid` + `EmployeeForm` + selection store, which is more complex but uses pre-built components.

#### Testing

- Demand tab: renders TeachingMasterGrid, band filter changes rows, KPI strip shows correct values
- Roster tab: renders EmployeeGrid, sub-filter toggles work, Add Employee opens EmployeeForm, row click triggers selection

---

### Phase 3: Coverage Tab + Costs Tab

**Goal**: Build the two analytical tabs.

**Dependency**: Phase 0 (stores), Phase 2 (Demand/Roster data)

#### Files to Create

| File                                                   | Purpose                                                                                                                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/staffing/coverage-tab.tsx`                 | Discipline-level coverage summary grid. One row per discipline, pooling Col+Lyc. Shows: FTE needed, Postes, Teachers assigned, FTE covered, Gap, Status. Click discipline -> right panel shows assigned teachers. |
| `components/staffing/coverage-tab.test.tsx`            | Test: renders grid, discipline aggregation correct, gap calculation                                                                                                                                               |
| `components/staffing/coverage-kpi-strip.tsx`           | KPI strip for Coverage (3 values: Covered, Deficit, Total Gap FTE)                                                                                                                                                |
| `components/staffing/costs-tab.tsx`                    | Two sub-views: Monthly Budget (existing `MonthlyCostBudgetGrid`) and By Department (existing `StaffCostsDepartmentGrid`). Toggle between sub-views.                                                               |
| `components/staffing/costs-tab.test.tsx`               | Test: renders both sub-views, toggle works, KPI values correct                                                                                                                                                    |
| `components/staffing/costs-kpi-strip.tsx`              | KPI strip for Costs (3 values: Grand Total, Monthly Avg, Cost per FTE)                                                                                                                                            |
| `components/staffing/discipline-summary-grid.tsx`      | New TanStack Table grid: one row per discipline, aggregated from teaching requirements. Columns: Discipline, Band(s), FTE Needed, Postes, Teachers, FTE Covered, Gap, Status                                      |
| `components/staffing/discipline-summary-grid.test.tsx` | Test: aggregation logic, status derivation                                                                                                                                                                        |

#### Design: Coverage Tab

```
+--------------------------------------------------+
| KPI: Covered | Deficit | Total Gap FTE            |
+--------------------------------------------------+
| DisciplineSummaryGrid                              |
| - One row per discipline                           |
| - Aggregates Col+Lyc requirement lines per disc    |
| - Columns: Discipline, Band(s), FTE Needed,        |
|   Postes, Teachers, FTE Covered, Gap, Status        |
| - Click row -> right panel shows assigned teachers  |
|   + "Add Vacancy" shortcut                         |
+--------------------------------------------------+
```

The discipline summary is computed client-side from the existing `useTeachingRequirements` data. No new API endpoint needed for v1 (the teaching requirements response already contains all the data). The aggregation logic:

1. Group requirement lines by `disciplineCode`
2. Sum `requiredFteRaw`, `coveredFte`, `gapFte` per discipline
3. Count `assignedStaffCount` per discipline
4. Derive status: if total gap < 0 -> DEFICIT, if gap === 0 -> COVERED, if gap > 0 -> SURPLUS

#### Design: Costs Tab

```
+--------------------------------------------------+
| [Sub-view: Monthly Budget | By Department]         |
+--------------------------------------------------+
| KPI: Grand Total | Monthly Avg | Cost per FTE      |
+--------------------------------------------------+
| [Monthly Budget sub-view]                          |
|   MonthlyCostBudgetGrid (existing component)       |
|   - 12-month cost grid with period filter          |
|   - Categories: Local Staff, Social Charges,        |
|     Contrats Locaux, Residents                     |
|                                                     |
| [By Department sub-view]                           |
|   StaffCostsDepartmentGrid (existing component)    |
|   - Per-employee costs grouped by department       |
|   - Drill-down with expanded employee rows         |
+--------------------------------------------------+
```

The Costs tab wires two existing pre-built components that are currently not rendered anywhere in the page. Data comes from existing hooks: `useStaffCosts(versionId)` for `StaffCostsDepartmentGrid` and `useCategoryCosts(versionId)` for `MonthlyCostBudgetGrid`.

#### Files to Modify

| File                                                 | Change                                                                                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/staffing/staffing-inspector-content.tsx` | Add `InspectorDisciplineView` for Coverage tab's discipline click. Shows list of requirement lines + assigned teachers for that discipline. Reuses existing assignment form. |

#### Risk

- **Medium**. Coverage tab requires new aggregation logic (discipline summary), but the data is already available. Costs tab is low-risk (wiring existing components). The discipline summary grid is new but follows established TanStack Table patterns.

#### Testing

- Coverage: discipline aggregation produces correct FTE/gap/status per discipline
- Coverage: click discipline triggers right panel with teacher list
- Costs: Monthly Budget sub-view renders `MonthlyCostBudgetGrid` with data
- Costs: By Department sub-view renders `StaffCostsDepartmentGrid` with data
- Costs: sub-view toggle switches between the two views

---

### Phase 4: Page Integration + Dead Code Removal

**Goal**: Rewire `staffing.tsx` to use the 4-tab layout. Remove deprecated components and stores.

**Dependency**: Phases 1, 2, 3

#### Files to Modify

| File                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages/planning/staffing.tsx`                        | **Major rewrite**. Replace 2-mode workspace toggle with 4-tab `Tabs` component. Remove view presets, band filter, coverage filter from toolbar (moved into individual tabs). Wire each `TabsContent` to the corresponding tab component. Toolbar becomes: `[Settings] [Calculate]` + tab-specific toolbar injected by each tab. Remove `StaffingSettingsSheet` render. Wire Settings button to `staffing-settings-dialog-store`. |
| `components/staffing/staffing-inspector-content.tsx` | Update `InspectorDefaultView` to show tab-aware context (remove redundant coverage distribution that's now in Coverage tab). Add discipline selection type to `StaffingSelection`.                                                                                                                                                                                                                                               |
| `stores/staffing-selection-store.ts`                 | Consolidate selection types. Add `DISCIPLINE` selection type for Coverage tab. Remove `SUPPORT_EMPLOYEE` type (employees are now selected generically via `EMPLOYEE` type in Roster tab).                                                                                                                                                                                                                                        |

#### Files to Delete

| File                                                   | Reason                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `components/staffing/staffing-settings-sheet.tsx`      | Replaced by `staffing-settings-dialog.tsx`                                    |
| `components/staffing/staffing-settings-sheet.test.tsx` | Test for removed component                                                    |
| `stores/staffing-settings-store.ts`                    | Replaced by `staffing-settings-dialog-store.ts`                               |
| `components/staffing/auto-suggest-dialog.tsx`          | Not wired to any handler; assignment now done in Roster tab via EmployeeForm  |
| `components/staffing/auto-suggest-dialog.test.tsx`     | Test for removed component                                                    |
| `components/staffing/support-admin-grid.tsx`           | Support employees now shown in Roster tab's EmployeeGrid                      |
| `components/staffing/support-admin-grid.test.tsx`      | Test for removed component                                                    |
| `components/staffing/kpi-ribbon.tsx`                   | Old KPI ribbon (replaced by `staffing-kpi-ribbon.tsx` and per-tab KPI strips) |
| `components/staffing/kpi-ribbon.test.tsx`              | Test for removed component                                                    |

#### Updated `staffing.tsx` Structure

```tsx
<PageTransition>
  <div className="flex h-full min-h-0 flex-col overflow-hidden">
    {/* Conditional banners (locked, viewer, uncalculated) */}

    {/* Global toolbar */}
    <div className="flex shrink-0 items-center justify-between ...">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="demand">Demand</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
        {/* Tab-specific actions rendered by each tab */}
        <Button onClick={openSettings}>Settings</Button>
        {isEditable && <Button onClick={calculate}>Calculate</Button>}
      </div>
    </div>

    {/* Status strip */}
    <StaffingStatusStrip ... />

    {/* Tab content */}
    <div className="flex-1 min-h-0 overflow-hidden">
      <TabsContent value="demand"><DemandTab ... /></TabsContent>
      <TabsContent value="roster"><RosterTab ... /></TabsContent>
      <TabsContent value="coverage"><CoverageTab ... /></TabsContent>
      <TabsContent value="costs"><CostsTab ... /></TabsContent>
    </div>

    {/* Settings dialog */}
    <StaffingSettingsDialog versionId={versionId} isViewer={isViewer} />
  </div>
</PageTransition>
```

#### Risk

- **High**. This is the integration phase where all tabs come together. The main risk is regressions in existing functionality (right panel selection, calculation triggers, stale state handling, export). Mitigation: keep the old page code in git history; the new page is a rewrite, not an edit.

#### Testing

- Page renders with 4 tabs
- Tab switching renders correct content
- Settings button opens dialog (not sheet)
- Calculate button triggers calculation
- Export still works (may need to be tab-aware)
- Right panel selection works for each tab type
- Stale/locked/viewer banners still display correctly
- Keyboard navigation between tabs (WCAG AA)

---

### Phase 5: Test Cleanup + Export Adaptation

**Goal**: Update all affected tests, ensure export works with new tab structure, final polish.

**Dependency**: Phase 4

#### Files to Modify

| File                                                      | Change                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/staffing/staffing-kpi-ribbon.test.tsx`        | Update to reflect new KPI ribbon used in page (still `StaffingKpiRibbonV2`, may need props adjustment)                                                                                                                                                                                         |
| `components/staffing/staffing-inspector-content.test.tsx` | Add tests for `DISCIPLINE` selection type, update `SUPPORT_EMPLOYEE` -> `EMPLOYEE`                                                                                                                                                                                                             |
| `components/staffing/staffing-export-button.tsx`          | May need to accept `activeTab` prop to export correct data per tab                                                                                                                                                                                                                             |
| `lib/staffing-export-workbook.ts`                         | May need tab-aware export (Demand exports requirements, Costs exports monthly budget)                                                                                                                                                                                                          |
| `pages/planning/staffing.tsx` test (if exists)            | Full rewrite for new 4-tab structure                                                                                                                                                                                                                                                           |
| `lib/staffing-workspace.ts`                               | Remove `WorkspaceMode`, `ViewPreset`, `VIEW_PRESETS`, `COVERAGE_OPTIONS` types/constants (dead code after Phase 4). Keep `BandFilter`, `CoverageFilter`, `StaffingEditability`, `TeachingGridRow`, `buildTeachingGridRows`, `filterTeachingRows`, `buildSupportGridRows` (still used by tabs). |

#### Risk

- **Low-Medium**. Primarily test updates and cleanup. Export adaptation is the only functional change.

#### Testing

- All existing test files pass (or are updated to match new structure)
- Export produces correct workbook from each tab context
- No TypeScript errors (`pnpm typecheck`)
- No ESLint errors (`pnpm lint`)

---

## Dependency Graph

```
Phase 0 (Infrastructure)
    |
    +-------+-------+
    |               |
Phase 1         Phase 2
(Settings)    (Demand + Roster)
    |               |
    +-------+-------+
            |
        Phase 3
    (Coverage + Costs)
            |
        Phase 4
    (Page Integration)
            |
        Phase 5
    (Test Cleanup)
```

Phases 1 and 2 can be developed in parallel since they have no mutual dependencies (both depend only on Phase 0).

---

## Component Inventory

### Components Reused (No Changes)

| Component                  | Used In                                                   |
| -------------------------- | --------------------------------------------------------- |
| `TeachingMasterGrid`       | Demand tab                                                |
| `MonthlyCostBudgetGrid`    | Costs tab (Monthly Budget sub-view)                       |
| `StaffCostsDepartmentGrid` | Costs tab (By Department sub-view)                        |
| `EmployeeForm`             | Roster tab (create/edit side sheet)                       |
| `StaffingStatusStrip`      | Page-level (above tabs)                                   |
| `StaffingKpiRibbonV2`      | Page-level (may be moved to per-tab KPI strips in future) |
| `ReadinessIndicator`       | Settings dialog sidebar                                   |
| `StaffingExportButton`     | Toolbar (tab-aware)                                       |
| `PlanningGrid`             | Used by TeachingMasterGrid (unchanged)                    |

### Components Evolved (Modified)

| Component                        | Change                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| `EmployeeGrid`                   | Add discipline/band columns, onDoubleClick prop                    |
| `staffing-inspector-content.tsx` | Add discipline selection view, rename SUPPORT_EMPLOYEE -> EMPLOYEE |

### Components Created (New)

| Component                      | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `staffing-settings-dialog.tsx` | Full-screen settings dialog (revenue pattern) |
| `demand-tab.tsx`               | Demand tab wrapper                            |
| `roster-tab.tsx`               | Roster tab wrapper                            |
| `coverage-tab.tsx`             | Coverage tab wrapper                          |
| `costs-tab.tsx`                | Costs tab wrapper                             |
| `discipline-summary-grid.tsx`  | Discipline-level coverage grid                |
| `demand-kpi-strip.tsx`         | Demand tab KPI strip                          |
| `roster-kpi-strip.tsx`         | Roster tab KPI strip                          |
| `coverage-kpi-strip.tsx`       | Coverage tab KPI strip                        |
| `costs-kpi-strip.tsx`          | Costs tab KPI strip                           |

### Components Removed (Dead Code)

| Component                     | Reason                                                |
| ----------------------------- | ----------------------------------------------------- |
| `staffing-settings-sheet.tsx` | Replaced by dialog                                    |
| `auto-suggest-dialog.tsx`     | Not wired, replaced by Roster tab assignment          |
| `support-admin-grid.tsx`      | Replaced by unified EmployeeGrid in Roster tab        |
| `kpi-ribbon.tsx`              | Old KPI ribbon, replaced by `staffing-kpi-ribbon.tsx` |

---

## Store Changes Summary

### New Stores

| Store                               | State                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `staffing-workspace-store.ts`       | `activeTab: StaffingTab`, `rosterFilter: RosterFilter`, `costsSubView: CostsSubView`, `demandBandFilter: BandFilter`, `demandCoverageFilter: CoverageFilter` |
| `staffing-settings-dialog-store.ts` | `isOpen: boolean`, `activeTab: StaffingSettingsTab`                                                                                                          |
| `staffing-settings-dirty-store.ts`  | `dirtyFields: Map<StaffingSettingsTab, Set<string>>`                                                                                                         |

### Modified Stores

| Store                         | Change                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `staffing-selection-store.ts` | Add `EMPLOYEE` and `DISCIPLINE` selection types. Deprecate `SUPPORT_EMPLOYEE` (alias for migration). |

### Removed Stores

| Store                        | Reason                                     |
| ---------------------------- | ------------------------------------------ |
| `staffing-settings-store.ts` | Simple open/close replaced by dialog store |

---

## Data Flow (No Backend Changes)

All data comes from existing hooks in `use-staffing.ts`:

- **Demand tab**: `useTeachingRequirements(versionId)` -- already used
- **Roster tab**: `useEmployees(versionId)` -- already used
- **Coverage tab**: `useTeachingRequirements(versionId)` -- client-side discipline aggregation
- **Costs tab**: `useStaffCosts(versionId)` + `useCategoryCosts(versionId)` -- hooks exist but unused in page
- **Settings dialog**: `useStaffingSettings`, `useServiceProfileOverrides`, `useCostAssumptions`, `useLyceeGroupAssumptions`, `useHeadcount` -- all existing

No new API endpoints required. The discipline summary for the Coverage tab is computed client-side by aggregating teaching requirement lines by discipline code.

---

## RBAC Considerations

- Salary columns in Roster tab: gated by `salary:view` permission (same as current EmployeeGrid `isReadOnly` behavior)
- Employee create/edit/delete in Roster tab: gated by `data:edit` (same as current)
- Settings dialog save buttons: gated by `isEditable` (derived from `deriveStaffingEditability`)
- Calculate button: gated by `isEditable`
- Export: no permission gate (data is already visible)

---

## Migration Safety

### Rollback Strategy

- Old `staffing.tsx` is preserved in git history
- During Phase 1-3, the old page continues to work (new components are additive)
- Phase 4 is the cutover point -- if issues arise, revert the Phase 4 commit

### Gradual Migration Path

- Phase 1 runs the new dialog alongside the old sheet (dual render)
- Phase 2-3 build new tab components without touching the page
- Phase 4 is the atomic swap (old page -> new page)
- Phase 5 cleans up dead code only after Phase 4 is stable

### Right Panel Registry

- The `registerPanelContent('staffing', ...)` side-effect import continues to work unchanged
- The inspector content is extended (not replaced) with discipline view
- Page still calls `setActivePage('staffing')` on mount

---

## Estimated File Count

| Category                              | Count         |
| ------------------------------------- | ------------- |
| New files (components + stores + lib) | ~18           |
| New test files                        | ~8            |
| Modified files                        | ~6            |
| Deleted files                         | ~10           |
| **Net change**                        | **+12 files** |

---

## Open Questions

1. **Export per tab**: Should the Export button export different data depending on the active tab? (e.g., Demand exports requirements, Costs exports monthly budget). Current export only handles teaching requirements + employees. Recommendation: keep current export behavior in v1, add tab-aware export in a follow-up.

2. **Discipline summary API endpoint**: The Coverage tab computes discipline aggregation client-side. If performance is an issue with many disciplines, a server-side `GET /versions/:versionId/discipline-summary` endpoint could be added later. Not needed for v1 (<50 disciplines).

3. **Auto-Suggest removal**: The `auto-suggest-dialog.tsx` is being deleted. The auto-suggest hook (`useAutoSuggestAssignments`) still exists in `use-staffing.ts`. Should it remain for future use, or be removed? Recommendation: keep the hook, remove only the dialog component.

4. **Global vs per-tab KPI ribbon**: The current `StaffingKpiRibbonV2` is page-level. The plan creates per-tab KPI strips. Should we keep the global ribbon AND have per-tab strips, or replace the global ribbon with per-tab strips? Recommendation: replace the global ribbon with per-tab strips. Each tab shows only the KPIs relevant to that tab's context.
