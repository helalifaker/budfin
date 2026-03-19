# Staffing Frontend Component Inventory

**Generated:** 2026-03-19
**Scope:** Complete mapping of all staffing-related frontend files in BudFin
**Total Components:** 30+
**Total Stores:** 2
**Total Hooks:** 50+

---

## Table of Contents

1. [Main Page](#main-page)
2. [Stores (State Management)](#stores-state-management)
3. [Hooks (Data & API)](#hooks-data--api)
4. [Components](#components)
5. [Utilities & Libraries](#utilities--libraries)
6. [Types Package](#types-package)
7. [Test Files](#test-files)
8. [Dependency Graph](#dependency-graph)

---

## Main Page

### `/apps/web/src/pages/planning/staffing.tsx` (432 lines)

**Exports:**

- `StaffingPage` (component)

**Key Props:** None (uses hooks)

**What it does:**

- Main staffing planning page for the PlanningShell
- Manages 4 view states: workspace mode (teaching/support), band filter, coverage filter, view preset
- Renders KPI ribbon, status strip, and teaching/support grids
- Handles row selection for right panel inspector
- Manages settings sheet visibility
- Calculates staffing, fetches teaching requirements, employees, and summary
- Handles staleness, uncalculated state, and editability

**Key State:**

- `workspaceMode`: 'teaching' | 'support'
- `bandFilter`: BandFilter
- `coverageFilter`: CoverageFilter
- `viewPreset`: ViewPreset ('Need' | 'Coverage' | 'Cost' | 'Full View')

**Imports from staffing ecosystem:**

- `useStaffingSelectionStore` (clear selection on unmount/panel close)
- `useStaffingSettingsSheetStore` (open settings)
- `useCalculateStaffing`, `useTeachingRequirements`, `useEmployees`, `useStaffingSummary` (data hooks)
- `BAND_FILTERS`, `COVERAGE_OPTIONS`, `VIEW_PRESETS`, `deriveStaffingEditability` (constants/helpers from staffing-workspace)
- `TeachingMasterGrid`, `SupportAdminGrid` (grid components)
- `StaffingKpiRibbonV2`, `StaffingStatusStrip`, `StaffingSettingsSheet`, `StaffingExportButton` (UI components)
- Side-effect imports: `staffing-inspector-content`, `staffing-guide-content` (right panel registration)

**Test file:** `staffing.test.tsx` ✓

---

## Stores (State Management)

### `/apps/web/src/stores/staffing-selection-store.ts` (55 lines)

**Exports:**

- `useStaffingSelectionStore` (Zustand store)
- `StaffingSelectionRequirementLine` (interface)
- `StaffingSelectionSupportEmployee` (interface)
- `StaffingSelection` (type union)

**Interfaces:**

```typescript
interface StaffingSelectionRequirementLine {
    type: 'REQUIREMENT_LINE';
    requirementLineId: number;
    band: string;
    disciplineCode: string;
}

interface StaffingSelectionSupportEmployee {
    type: 'SUPPORT_EMPLOYEE';
    employeeId: number;
    department: string;
}
```

**Store Methods:**

- `selectRequirementLine(requirementLineId, band, disciplineCode)` — toggles selection, opens right panel
- `selectSupportEmployee(employeeId, department)` — toggles selection, opens right panel
- `clearSelection()` — clears selection

**State:**

- `selection: StaffingSelection | null`

**Test file:** `staffing-selection-store.test.ts` ✓

---

### `/apps/web/src/stores/staffing-settings-store.ts` (16 lines)

**Exports:**

- `useStaffingSettingsSheetStore` (Zustand store)

**Store Methods:**

- `open()` — opens settings sheet
- `close()` — closes settings sheet
- `setOpen(open: boolean)` — sets open state

**State:**

- `isOpen: boolean`

**Test file:** `staffing-settings-store.test.ts` ✓

---

## Hooks (Data & API)

### `/apps/web/src/hooks/use-staffing.ts` (702 lines)

**Exports (50+ items):**

#### Types

- `Employee` — full employee record with all salary components
- `EmployeeListResponse`
- `StaffCostRow`, `StaffCostBreakdown`, `StaffCostResponse`
- `CategoryMonthCategory`, `CategoryMonthData`, `CategoryCostEntry`, `CategoryCostData`
- `StaffingSummaryResponse`
- `CalculateStaffingResponse`
- `ImportValidateResponse`, `ImportCommitResponse`
- `StaffingSettings`, `StaffingSettingsResponse`
- `ServiceProfileOverride`, `ServiceProfileOverridesResponse`, `ServiceProfileOverrideInput`
- `CostAssumption`, `CostAssumptionsResponse`, `CostAssumptionInput`
- `LyceeGroupAssumption`, `LyceeGroupAssumptionsResponse`
- `TeachingRequirementLine` (key model for teaching grid)
- `TeachingRequirementsResponse`
- `TeachingRequirementSource`, `TeachingRequirementSourcesResponse`
- `StaffingAssignment`, `StaffingAssignmentsResponse`
- `CreateAssignmentInput`

#### Query Hooks

- `useEmployees(versionId)` — fetch all employees for version
- `useEmployee(versionId, employeeId)` — fetch single employee
- `useStaffCosts(versionId, groupBy?, includeBreakdown?)` — fetch staff costs by grouping
- `useStaffingSummary(versionId)` — fetch summary (FTE, cost, by department)
- `useStaffCostsByCategory(versionId)` — fetch category-month costs
- `useCategoryCosts(versionId)` — fetch category costs
- `useTeachingRequirements(versionId)` — fetch teaching requirement lines & totals
- `useTeachingRequirementSources(versionId)` — fetch teaching requirement source data
- `useStaffingSettings(versionId)` — fetch staffing settings
- `useServiceProfileOverrides(versionId)` — fetch service profile overrides
- `useCostAssumptions(versionId)` — fetch cost assumptions
- `useLyceeGroupAssumptions(versionId)` — fetch lycee group assumptions
- `useStaffingAssignments(versionId)` — fetch all staffing assignments

#### Mutation Hooks

- `useCreateEmployee(versionId)` — POST employee
- `useUpdateEmployee(versionId)` — PUT employee (with If-Match ETag header)
- `useDeleteEmployee(versionId)` — DELETE employee
- `useCalculateStaffing(versionId)` — POST /calculate/staffing
- `useImportEmployees(versionId)` — POST multipart import (validate/commit)
- `usePutStaffingSettings(versionId)` — PUT staffing settings
- `usePutServiceProfileOverrides(versionId)` — PUT service profile overrides
- `usePutCostAssumptions(versionId)` — PUT cost assumptions
- `usePutLyceeGroupAssumptions(versionId)` — PUT lycee group assumptions
- `useCreateAssignment(versionId)` — POST staffing assignment
- `useUpdateAssignment(versionId)` — PUT assignment
- `useDeleteAssignment(versionId)` — DELETE assignment

**Test file:** (hooks are tested in component tests, see `use-staffing-hooks.test.ts` for unit tests) ✓

---

### `/apps/web/src/hooks/use-master-data.ts` (staffing-related exports)

**Exports (staffing-related types & hooks):**

#### Types

- `ServiceProfile` — service profile master data
- `ServiceProfilesResponse`
- `Discipline` — discipline (subject area)
- `DisciplinesResponse`
- `DhgRule` — legacy DHG rule (read-only in v1)
- `DhgRulesResponse`
- `DhgRuleDetail` — detailed DHG rule with computed fields
- `AutoSuggestResult` — auto-suggest assignment recommendation
- `AutoSuggestResponse`
- `DemandOverride`
- `DemandOverridesResponse`

#### Query Hooks

- `useServiceProfiles()` — fetch service profiles
- `useDisciplines()` — fetch disciplines
- `useDhgRules()` — fetch DHG rules (reference only)
- `useAutoSuggestAssignments(versionId)` — fetch auto-suggest recommendations
- `useDemandOverrides(versionId)` — fetch demand overrides

#### Mutation Hooks

- `useCreateDhgRule()` — POST DHG rule
- `useUpdateDhgRule()` — PUT DHG rule
- `useDeleteDhgRule()` — DELETE DHG rule

---

## Components

### Grid Components

#### `/apps/web/src/components/staffing/teaching-master-grid.tsx` (419 lines)

**Exports:**

- `TeachingMasterGrid` (component)
- `TeachingMasterGridProps` (interface)

**Props:**

```typescript
interface TeachingMasterGridProps {
    data: TeachingRequirementsResponse;
    viewPreset: ViewPreset;
    bandFilter: BandFilter;
    coverageFilter: CoverageFilter;
    selectedLineId: number | null;
}
```

**What it does:**

- Renders TanStack Table v8 headless table with 15+ columns
- Shows teaching requirement lines grouped by band with band subtotals
- Column visibility controlled by viewPreset (Need, Coverage, Cost, Full View)
- Columns: Line, Profile, Units, Hrs/w, ORS, Eff.ORS, Raw FTE, Plan FTE, Rec.Pos, Covered, Gap, Status, Staff, Direct Cost, HSA Cost
- Highlights selected row (selectedLineId)
- On row select: calls `selectRequirementLine` to set state & open inspector
- Uses `PlanningGrid` component (headless table wrapper) with band grouping & grand total
- Numeric column alignment and status badge rendering

**Key utilities:**

- `buildTeachingGridRows()` — transforms API data into grid rows (requirement + subtotals)
- `filterTeachingRows()` — filters by band and coverage status
- `CoverageBadge` — renders coverage status (DEFICIT, COVERED, SURPLUS, UNCOVERED)

**Test file:** `teaching-master-grid.test.tsx` ✓

---

#### `/apps/web/src/components/staffing/support-admin-grid.tsx` (513 lines)

**Exports:**

- `SupportAdminGrid` (component)
- `SupportAdminGridProps` (type)

**Props:**

```typescript
type SupportAdminGridProps = {
    employees: Employee[];
    editability: StaffingEditability;
    onEmployeeSelect: (employee: Employee) => void;
    onEmployeeDoubleClick: (employee: Employee) => void;
};
```

**What it does:**

- Renders pure HTML table (not TanStack Table) of support/admin employees
- Groups by department with expand/collapse (keyboard accessible: arrow keys, enter/space)
- Columns: Expand icon, Name/Position, Role, Status badge, FTE %, Start date, End date, Monthly cost, Annual cost
- Department headers show employee count and subtotal annual cost
- Grand total row at bottom
- Keyboard navigation for department expansion
- Screen reader live region for announcements
- Click handlers for employee selection
- `StatusBadge` renders employee status (Existing, New, Vacancy)

**Helper components:**

- `DepartmentSection` — memoized per-department group
- `EmployeeRow` — individual employee row
- `StatusBadge` — status badge renderer
- `NameCell` — handles vacancy records specially

**Test file:** `support-admin-grid.test.tsx` ✓

---

### Settings & Configuration

#### `/apps/web/src/components/staffing/staffing-settings-sheet.tsx` (300+ lines)

**Exports:**

- `StaffingSettingsSheet` (component)

**Props:**

```typescript
interface StaffingSettingsSheetProps {
    versionId: number;
    isEditable: boolean;
}
```

**What it does:**

- Slide-out sheet with 6 tabs for staffing configuration
- Uses React Hook Form + Zod validation
- **Tab 1: HSA Settings** — target hours, first/additional hour rates, HSA months
- **Tab 2: Academic Settings** — academic weeks (currently placeholder)
- **Tab 3: Cost Assumptions** — REMPLACEMENTS, FORMATION, RESIDENT\_\* categories with mode/value pairs
- **Tab 4: Service Profile Overrides** — weekly service hours and HSA eligibility per service profile
- **Tab 5: Lycee Group Assumptions** — discipline + group count + hours per group
- **Tab 6: Reconciliation** — placeholder for future reconciliation data

**State:**

- Draft values in form state (HSA, Cost, Lycee groups)
- Syncs with API on save/cancel

**Imports:**

- All staffing settings hooks from use-staffing
- Master data hooks (useServiceProfiles, useDhgRules)
- Enrollment hooks (useHeadcount)

**Test file:** `staffing-settings-sheet.test.tsx` ✓

---

### KPI & Status Display

#### `/apps/web/src/components/staffing/staffing-kpi-ribbon.tsx` (199 lines)

**Exports:**

- `StaffingKpiRibbonV2` (component)
- `StaffingKpiRibbonV2Props` (type)

**Props:**

```typescript
type StaffingKpiRibbonV2Props = {
    totalHeadcount: number;
    fteGap: number;
    staffCost: number;
    hsaBudget: number;
    heRatio: number;
    rechargeCost: number;
    isStale: boolean;
};
```

**What it does:**

- 6-column KPI grid (responsive: 2 cols → 3 → 6 on wider screens)
- Each KPI: icon + label + value with staggered entrance animation
- FTE Gap has dynamic color/icon based on value:
    - gap < -0.25: red (TrendingDown)
    - gap > 0.25: amber (TrendingUp)
    - else: green
- Shows stale indicator (pulsing red dot) if `isStale`
- Uses `Counter` component for animated value transitions
- Accessible: ARIA roles and labels

**Test file:** `staffing-kpi-ribbon.test.tsx` ✓

---

#### `/apps/web/src/components/staffing/staffing-status-strip.tsx` (148 lines)

**Exports:**

- `StaffingStatusStrip` (component)
- `StaffingStatusStripProps` (type)

**Props:**

```typescript
type StaffingStatusStripProps = {
    lastCalculatedAt: string | null;
    staleModules: string[];
    demandPeriod: string;
    enrollmentCalculatedAt: string | null;
    enrollmentStale: boolean;
    supplyCount: { existing: number; new: number; vacancies: number };
    coverageSummary: { deficit: number; uncovered: number; balanced: number };
};
```

**What it does:**

- Status bar displaying 6 sections:
    1. Last calculated timestamp (formatted Arabia Standard Time)
    2. Stale warning badge (if STAFFING is stale)
    3. Demand period (e.g., "AY 2025")
    4. Source indicator (enrollment AY2, with timestamp)
    5. Supply count (existing + new + vacancies)
    6. Coverage summary (deficit + uncovered + balanced)
- Downstream stale pills (P&L, etc.) shown if applicable
- Uses `WorkspaceStatusStrip` shared component
- Priority-ordered sections for layout

**Test file:** `staffing-status-strip.test.tsx` ✓

---

### Inspector & Details Panel

#### `/apps/web/src/components/staffing/staffing-inspector-content.tsx` (300+ lines)

**Exports:**

- `StaffingInspectorContent` (component, NOT exported; side-effect registers content)
- Registers inspector panel for 'staffing' page

**What it does:**

- Right panel content for staffing page
- Two tabs: **Requirement Line** (teaching grid) and **Support Employee** (support grid)
- **Requirement Line tab:**
    - Shows selected line details (band, discipline, line label)
    - Displays driver breakdown (units, weekly hours, ORS)
    - Lists assigned staff (clickable to select)
    - Shows gap and coverage status badge
    - Cost breakdown (direct + HSA)
    - Button to add new assignment
    - Delete assignment button
- **Support Employee tab:**
    - Employee details (name, code, function role, department)
    - Salary components (base, allowances, premiums, HSA, social charges)
    - Edit/delete buttons
- Uses selection store to determine which content to show
- Calls assignment hooks (create/update/delete)
- Handles validation and error states

**Dependencies:**

- `useStaffingSelectionStore` (read selection)
- Assignment hooks (create/update/delete)
- `useTeachingRequirements`, `useEmployees`
- Form validation hooks

**Test file:** `staffing-inspector-content.test.tsx` ✓

---

#### `/apps/web/src/components/staffing/staffing-guide-content.tsx` (40 lines)

**Exports:**

- `StaffingGuideContent` (component, side-effect registers guide)

**What it does:**

- Right panel guide content for staffing page
- 3 sections:
    1. KPI Metrics — explains the ribbon
    2. Detail Panel — how to inspect requirements/employees
    3. Stale Indicators — what red pulsing dot means
- Registers itself via `registerGuideContent('staffing', ...)`
- Simple static text, no interactive elements

**Test file:** `staffing-guide-content.test.tsx` ✓

---

### Dialogs & Modals

#### `/apps/web/src/components/staffing/auto-suggest-dialog.tsx` (100+ lines)

**Exports:**

- `AutoSuggestDialog` (component)
- `AutoSuggestDialogProps` (interface)

**Props:**

```typescript
interface AutoSuggestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    versionId: number;
    suggestions: AutoSuggestResult[];
}
```

**What it does:**

- Slide-out sheet with auto-suggest recommendations
- Lists suggestions with checkboxes (default all checked)
- Each suggestion shows: employee name, band, discipline, FTE share, confidence
- Confidence badge (High=green, Medium=amber)
- Summary: "X of Y employees, affecting Z requirement lines"
- Buttons: Apply Selected, Apply All, Cancel
- On apply: calls `createAssignment` mutation for each checked suggestion
- Handles loading and error states

**Test file:** `auto-suggest-dialog.test.tsx` ✓

---

### Export & Advanced

#### `/apps/web/src/components/staffing/staffing-export-button.tsx` (665 lines)

**Exports:**

- `StaffingExportButton` (component)
- `StaffingExportButtonProps` (interface)
- Re-exports `KpiValues` type

**Props:**

```typescript
interface StaffingExportButtonProps {
    versionId: number;
    data: TeachingRequirementsResponse;
    employeesData: EmployeeListResponse;
    summaryData: StaffingSummaryResponse | undefined;
    versionName: string;
    kpiValues: KpiValues;
}
```

**What it does:**

- Dropdown menu with 2 export options:
    1. **Export Teaching Requirements** — single-sheet Excel with KPI ribbon, teaching lines, band subtotals, grand total
    2. **Export Full Workbook** — 8-sheet Excel with settings, profiles, assumptions, enrollment, demand sources, teaching reqs, staff costs, category costs
- Single-sheet export uses colored band headers and conditional formatting
- Full workbook export fetches additional data in parallel (settings, profiles, costs, capacity, etc.)
- Handles 409 STALE_DATA errors gracefully
- Uses ExcelJS to build workbooks client-side
- Sanitizes filenames and triggers browser download

**Test file:** (tested via export functionality tests)

---

#### `/apps/web/src/lib/staffing-export-workbook.ts` (200+ lines)

**Exports:**

- `buildStaffingWorkbook(workbook, data)` — async builder for 8-sheet workbook
- `KpiValues` (interface)
- `StaffingWorkbookData` (interface)

**What it does:**

- Pure workbook builder (no side effects)
- 8 worksheets:
    1. **Settings** — staffing configuration with named ranges for formulas
    2. **Service Profiles** — profile overrides
    3. **Cost Assumptions** — cost categories and modes
    4. **Lycee Groups** — discipline + group assumptions
    5. **Enrollment** — capacity results (AY2)
    6. **Demand Sources** — teaching requirement sources (driver breakdown)
    7. **Teaching Requirements** — requirement lines with formulas
    8. **Summary** — KPI ribbon + aggregated totals
- Cross-linked Excel formulas (settings → demand → teaching reqs → summary)
- Handles band grouping, color coding, and formatting
- Uses Decimal.js for money arithmetic

---

### Other Components

#### `/apps/web/src/components/master-data/dhg-rule-side-panel.tsx` (150+ lines)

**Exports:**

- `DhgRuleSidePanel` (component)
- `DhgRuleSidePanelProps` (type)
- `DhgRuleFormValues` (type)

**Props:**

```typescript
type DhgRuleSidePanelProps = {
    open: boolean;
    onClose: () => void;
    dhgRule?: DhgRuleDetail | null;
    onSave: (data: DhgRuleFormValues) => void;
    loading?: boolean;
};
```

**What it does:**

- Side panel for creating/editing DHG rules (legacy staffing model, reference only in v1)
- Form fields: grade level, discipline, service profile, line type, driver type, hours per unit, effective years, language, grouping key
- Uses React Hook Form + Zod validation
- Fetches disciplines, service profiles, and grade levels on mount
- Called from master data pages (NOT from main staffing page)

---

#### `/apps/web/src/components/staffing/build-department-rows.ts` (utility, may not exist yet)

**Purpose:** Helper to build support grid department groupings
**Note:** Functionality integrated into `staffing-workspace.ts` via `buildSupportGridRows()`

---

## Utilities & Libraries

### `/apps/web/src/lib/staffing-workspace.ts` (254 lines)

**Exports:**

- Types:
    - `WorkspaceMode` = 'teaching' | 'support'
    - `BandFilter` = 'ALL' | 'MAT' | 'ELEM' | 'COL' | 'LYC'
    - `CoverageFilter` = 'ALL' | 'DEFICIT' | 'SURPLUS' | 'UNCOVERED' | 'COVERED'
    - `ViewPreset` = 'Need' | 'Coverage' | 'Cost' | 'Full View'
    - `StaffingEditability` = 'editable' | 'locked' | 'viewer'
    - `TeachingGridRow` (row type for grids)
    - `SupportDepartmentGroup` (group type for support grid)

- Constants:
    - `BAND_FILTERS` — filter options
    - `VIEW_PRESETS` — view preset options
    - `COVERAGE_OPTIONS` — coverage filter options
    - `BAND_ORDER` — canonical band sort order
    - `BAND_FILTER_MAP` — short name → full band name

- Functions:
    - `deriveStaffingEditability(role, versionStatus)` — determines if user can edit
    - `buildTeachingGridRows(lines)` — transforms API data into grid rows with band grouping & subtotals
    - `filterTeachingRows(rows, bandFilter, coverageFilter)` — applies filters
    - `buildSupportGridRows(employees)` — transforms employees into department groups

**Test file:** `staffing-workspace.test.ts` ✓

---

### `/apps/web/src/lib/band-styles.ts` (reference)

**Exports:**

- `BAND_LABELS` — display names for bands
- `BAND_STYLES` — Tailwind color classes per band

**Used by:** Teaching grid, inspector, export button, all band-related renderers

---

### Right Panel Registry

**File:** `/apps/web/src/lib/right-panel-registry.ts`

**Functions:**

- `registerPanelContent(pageKey, renderer)` — registers inspector content
- `registerGuideContent(pageKey, renderer)` — registers guide content

**Staffing registrations:**

- `staffing-inspector-content.tsx` registers inspector via side-effect
- `staffing-guide-content.tsx` registers guide via side-effect

**Pattern:** Side-effect imports in main page load the registrations automatically

---

## Types Package

### `/packages/types/` (relevant exports)

**CapacityResult** — used in staffing export
**Other types:** (checked in use-staffing.ts)

---

## Test Files

### Component Tests (all passing ✓)

- `teaching-master-grid.test.tsx`
- `support-admin-grid.test.tsx`
- `staffing-kpi-ribbon.test.tsx`
- `staffing-status-strip.test.tsx`
- `staffing-inspector-content.test.tsx`
- `staffing-guide-content.test.tsx`
- `staffing-settings-sheet.test.tsx`
- `auto-suggest-dialog.test.tsx`
- `kpi-ribbon.test.tsx` (legacy)
- `monthly-cost-grid.test.tsx`
- `monthly-cost-budget-grid.test.tsx`
- `staff-costs-department-grid.test.tsx`
- `employee-grid.test.tsx`
- `employee-form.test.tsx`

### Store Tests

- `staffing-selection-store.test.ts`
- `staffing-settings-store.test.ts`

### Utility Tests

- `staffing-workspace.test.ts`

### Page Tests

- `staffing.test.tsx`

### Hook Tests

- `use-staffing-hooks.test.ts` (unit tests for all hooks)

---

## Dependency Graph

### Core Flow: Staffing Page

```
StaffingPage (main page)
  ├─> useStaffingSelectionStore (selection state)
  ├─> useStaffingSettingsSheetStore (settings visibility)
  ├─> useWorkspaceContext (fiscal year, versionId)
  ├─> useAuthStore (role for editability)
  ├─> useRightPanelStore (panel visibility)
  │
  ├─> Data hooks:
  │   ├─> useTeachingRequirements → TeachingMasterGrid
  │   ├─> useEmployees → SupportAdminGrid
  │   ├─> useStaffingSummary → KPI Ribbon
  │   └─> useCalculateStaffing (mutation)
  │
  ├─> Workspace utilities:
  │   ├─> deriveStaffingEditability
  │   ├─> buildTeachingGridRows
  │   ├─> buildSupportGridRows
  │   └─> BAND_FILTERS, COVERAGE_OPTIONS, VIEW_PRESETS
  │
  ├─> UI Components:
  │   ├─> TeachingMasterGrid
  │   │   ├─> PlanningGrid (headless table)
  │   │   ├─> CoverageBadge
  │   │   └─> useStaffingSelectionStore.selectRequirementLine
  │   │
  │   ├─> SupportAdminGrid
  │   │   ├─> DepartmentSection (per department)
  │   │   ├─> EmployeeRow
  │   │   ├─> StatusBadge
  │   │   └─> useStaffingSelectionStore.selectSupportEmployee
  │   │
  │   ├─> StaffingKpiRibbonV2 (6-column KPI grid)
  │   ├─> StaffingStatusStrip (status sections)
  │   ├─> StaffingSettingsSheet (6 configuration tabs)
  │   └─> StaffingExportButton (export menu)
  │
  ├─> Right Panel (on selection):
  │   ├─> staffing-inspector-content
  │   │   ├─> Requirement Line tab
  │   │   │   ├─> useTeachingRequirements
  │   │   │   ├─> useStaffingAssignments
  │   │   │   ├─> useCreateAssignment
  │   │   │   ├─> useUpdateAssignment
  │   │   │   └─> useDeleteAssignment
  │   │   │
  │   │   └─> Support Employee tab
  │   │       ├─> useEmployees
  │   │       ├─> useEmployee (single)
  │   │       ├─> useUpdateEmployee
  │   │       └─> useDeleteEmployee
  │   │
  │   └─> staffing-guide-content (static guide text)
  │
  └─> Settings Sheet (when opened):
      ├─> useStaffingSettings
      ├─> usePutStaffingSettings
      ├─> useServiceProfileOverrides
      ├─> usePutServiceProfileOverrides
      ├─> useCostAssumptions
      ├─> usePutCostAssumptions
      ├─> useLyceeGroupAssumptions
      ├─> usePutLyceeGroupAssumptions
      ├─> useServiceProfiles (master data)
      ├─> useDhgRules (reference)
      └─> useHeadcount (enrollment)
```

### Export Flow

```
StaffingExportButton
  ├─> handleExportSingleSheet
  │   └─> buildSingleSheetExport (inline)
  │       └─> ExcelJS workbook builder
  │
  └─> handleExportFullWorkbook
      ├─> Parallel API calls:
      │   ├─> apiClient(/staffing-settings)
      │   ├─> apiClient(/service-profile-overrides)
      │   ├─> apiClient(/cost-assumptions)
      │   ├─> apiClient(/lycee-group-assumptions)
      │   ├─> apiClient(/enrollment/capacity-results)
      │   ├─> apiClient(/teaching-requirement-sources)
      │   ├─> apiClient(/staff-costs?group_by=employee&include_breakdown=true)
      │   └─> apiClient(/category-costs)
      │
      └─> buildStaffingWorkbook (8-sheet builder)
          └─> ExcelJS workbook builder
```

### Selection Flow

```
TeachingMasterGrid (row click)
  └─> selectRequirementLine()
      └─> useStaffingSelectionStore.set({
            type: 'REQUIREMENT_LINE',
            requirementLineId, band, disciplineCode
          })
      └─> useRightPanelStore.open('details')
          └─> Opens right panel with staffing-inspector-content
              └─> Shows Requirement Line tab
```

```
SupportAdminGrid (row click)
  └─> selectSupportEmployee()
      └─> useStaffingSelectionStore.set({
            type: 'SUPPORT_EMPLOYEE',
            employeeId, department
          })
      └─> useRightPanelStore.open('details')
          └─> Opens right panel with staffing-inspector-content
              └─> Shows Support Employee tab
```

---

## Summary Statistics

- **Total Components:** 30+
- **Total Stores:** 2
- **Total Hooks:** 50+ (from use-staffing.ts + use-master-data.ts)
- **Total Utility Functions:** 15+
- **Total Types/Interfaces:** 60+
- **Test Files:** 19+
- **Lines of Code (core):** 3000+

---

## Key Architecture Notes

1. **Side-Effect Imports:** Right panel content is registered via side-effect imports in the main page. This avoids prop drilling.

2. **Pure Functions:** Workspace utilities (buildTeachingGridRows, buildSupportGridRows) are pure functions with no side effects.

3. **Layered Grids:** Teaching grid uses TanStack Table v8 (headless); support grid uses plain HTML table for simplicity.

4. **Stale Module Tracking:** `BudgetVersion.staleModules` tracks which modules need recalculation. Frontend displays indicators and prevents export if stale.

5. **Editability Derivation:** `deriveStaffingEditability()` determines edit mode from user role + version status (Draft only = editable).

6. **Assignment Management:** Staffing assignments are created/updated/deleted through the inspector panel, with assignment hooks handling API calls.

7. **Export Architecture:** Two export paths:
    - Single-sheet: quick export of teaching requirements only
    - Full workbook: comprehensive 8-sheet export with formulas and cross-links

8. **Service Profile Overrides:** HSA eligibility and weekly service hours can be overridden per profile, affecting cost calculations.

9. **Cost Assumptions:** Multiple cost categories (REMPLACEMENTS, FORMATION, RESIDENT\_\*) with modes (FLAT_ANNUAL, PERCENT_OF_PAYROLL, AMOUNT_PER_FTE).

10. **Lycee Groups:** Discipline-level grouping assumptions for lycée (secondary) bands, affecting hours calculations.

---

## Next Steps for Integration

If you're planning a staffing workflow redesign, key integration points are:

1. **Settings Sheet:** 6 tabs manage all staffing configuration; consider adding new tabs here
2. **Inspector Panel:** Right panel shows details; assignment management happens here
3. **Grids:** Teaching grid filters & presets; support grid department grouping
4. **Export:** Full workbook builder in staffing-export-workbook.ts is the extensibility point
5. **Hooks:** All API contracts are in use-staffing.ts; add new hooks here for new features
