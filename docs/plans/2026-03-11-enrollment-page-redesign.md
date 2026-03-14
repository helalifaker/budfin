# Enrollment Page Redesign -- Implementation Plan

**Date:** 2026-03-11
**Target:** Enrollment Planning Module (`apps/web/src/pages/planning/enrollment.tsx`)
**Status:** Design Complete -- Pending Approval

## Context

The enrollment page currently suffers from six problems: (1) three separate grids create a ~2,500px tall page requiring heavy scrolling, (2) the wizard has implicit baseline precedence that confuses users, (3) retention/lateral recommendation rules use wrong thresholds (105%/97% instead of 100%/98%), (4) PS AY2 has no reliable default, (5) the page feels like a spreadsheet rather than a premium planning tool, and (6) the main grid is treated as a data-entry surface when editing should happen in the sidebar.

**Goal:** Transform the enrollment page into a fixed-viewport, no-scroll planning workspace with one master grid, a 3-step wizard, and a sidebar that serves as both the portfolio overview and the per-grade editing surface.

---

## Design Principles (Confirmed with User)

1. **Fixed viewport layout** -- The page never scrolls. The grid scrolls internally. Like Excel/Pigment/Anaplan.
2. **One master grid** -- Consolidate 3 grids into 1. Read-oriented. Row selection is the primary interaction.
3. **Sidebar is the action surface** -- Default view: portfolio charts + planning rules + band summary. Active view: grade inspector + editing. Guide tab: planning process README.
4. **3-step wizard** -- Source & AY1 > Parameters > Preview & Apply. Premium animations.
5. **Planning rules are version-scoped** -- Rollover threshold and retention cap editable in BOTH wizard and sidebar.
6. **PS default from grade settings** -- `defaultAy2Intake` stored on GradeLevel table, admin-configurable.
7. **Guide tab in sidebar** -- Rename "Help" to "Guide", render enrollment-specific planning process README.
8. **Trust must be explicit** -- Always show what is persisted vs preview-only, the baseline source, the last calculation timestamp, and which downstream modules are stale.
9. **Fast for analysts, safe for owners** -- Keep the sidebar-first editing model, but preserve bulk-entry speed, exportability, and undo/reset paths for spreadsheet-heavy users.

---

## Finance Professional Readout

Stepping into the shoes of a finance professional using this module during budget season: **the redesign direction is strong, but it is not yet “outstanding” without a few operational safeguards.**

### What already feels right

- **One master grid** is the correct move. Finance users want one trustworthy control table, not three disconnected canvases.
- **Sidebar-driven editing** reduces accidental edits and makes the main surface easier to scan.
- **Wizard consolidation** is a material improvement. The current multi-step setup likely feels longer than the work itself.
- **Version-scoped planning rules** fit real budgeting behavior; assumptions belong to the version, not to a temporary session.
- **PS default handling** closes a real planning gap and removes hidden tribal knowledge.

### What blocks an outstanding experience today

1. **Trust cues are still too light.** A finance user will immediately ask: “What is saved? What is preview-only? When was this last calculated? What changed downstream?”
2. **The redesign removes too much spreadsheet power.** A read-only master grid plus sidebar editing is elegant, but heavy planners may feel slowed down for repetitive assumption work.
3. **Charts are helpful, but exceptions are more valuable.** In live planning, users care more about grades requiring action than about an additional visual summary.
4. **Export and audit visibility are under-emphasized.** Finance teams share snapshots, defend assumptions, and revisit prior logic. They need traceability and extraction.
5. **Fixed-viewport/no-scroll is good only if it remains resilient on smaller laptop heights and in comparison mode.** Otherwise it becomes a polished box with hidden frustration.

### Recommendation before approval

Treat this redesign as **high-potential, not yet final**. Approve the direction, but only if the plan also ships explicit status/audit cues, exception-first workflows, export support, and safety nets for bulk actions.

---

## Layout Architecture

Current layout stack (verified from source):

```text
RootLayout (h-screen, flex, overflow-hidden)
  +-- Sidebar
  +-- Content (flex-1, flex-col, overflow-hidden)
      +-- PlanningShell (flex-1, flex-col, overflow-hidden)
          +-- ContextBar (shrink-0, ~48px)
          +-- VersionAccentStrip (shrink-0, ~4px)
          +-- Content row (flex-1, flex, overflow-hidden)
              +-- <main> (flex-1, overflow-y-auto, px-6 pt-4)
              |   +-- EnrollmentPage
              +-- RightPanel
```

### Layout Height Contract (Verified)

The `<main>` in `planning-shell.tsx` (line 31-36) has `overflow-y-auto`. This means it CAN scroll if its children exceed its height. The fix is NOT to change the shell -- it's to ensure the enrollment page's root div constrains itself to `h-full overflow-hidden`. Here's why this works:

1. `RootLayout` sets `h-screen` + `overflow-hidden` on the outer wrapper
2. `PlanningShell` is `flex-1 flex-col overflow-hidden` -- it fills remaining height after sidebar
3. Inside PlanningShell, `ContextBar` + `VersionAccentStrip` are shrink-0 fixed heights
4. The content row is `flex-1 overflow-hidden`
5. `<main>` is `flex-1 overflow-y-auto` -- it gets a computed height from the flex parent
6. If the enrollment page's root is `h-full overflow-hidden`, the content is bounded to `<main>`'s computed height
7. The `<main>` sees a child that fits exactly (h-full = 100% of main), so it never scrolls

**The `overflow-y-auto` on `<main>` is not a problem** -- it only scrolls when children exceed the computed height. With `h-full overflow-hidden` on the page root, they won't.

**Verification required during implementation:**

- Test with 0, 1, 2, and 3 banners stacked -- grid zone must still have usable height
- Test on 768px laptop viewport -- grid should show at least 8-10 grade rows
- Test with right panel open vs closed -- grid width adjusts, height stays fixed
- If any scenario causes page scroll, add `overflow-hidden` to the `<main>` element via a page-specific class

New enrollment page structure:

```html
<div class="flex h-full flex-col overflow-hidden">
    +-- Banners (conditional, shrink-0) +-- Header zone (shrink-0, ~80px) | +-- Title + description
    | +-- Actions: Band filter | Exception filter | Export | Setup | Calculate +-- KPI ribbon
    (shrink-0, ~48px) | +-- Total AY1 | Total AY2 | Util% | Alerts +-- Status strip (shrink-0,
    ~36px) | +-- Baseline source | Last calculated | Enrollment freshness | Downstream stale pills
    +-- Grid zone (flex-1, overflow-hidden, py-4) +-- EnrollmentMasterGrid (h-full, overflow-y-auto)
    +-- Sticky thead + scrollable tbody
</div>
```

### Operational UX gaps to close in the layout

To make the workspace finance-grade rather than merely visually cleaner, the layout should also reserve space for:

1. **Status strip** -- explicit persisted state, not just KPIs.
2. **Exception filter chips** -- `All`, `Over Capacity`, `Near Capacity`, `Missing Inputs`, `Manual Overrides`, `Low Confidence`.
3. **Export access** -- at least CSV/XLSX for the visible master grid and an exception report.
4. **Viewport resilience rule** -- if effective vertical space drops too low (small laptop height, browser zoom, comparison mode), prefer a controlled page-scroll fallback over clipped content.

The no-scroll principle is still valid, but it should be treated as a target, not a religion. Finance users forgive one scrollbar; they do not forgive hidden state.

---

## Phase 1: Schema & API Foundation

### 1.1 Prisma Schema Migration

**Migration:** `add_planning_rules_and_default_intake`

**`GradeLevel` model -- add field:**

```prisma
defaultAy2Intake  Int?  @map("default_ay2_intake")
```

**`BudgetVersion` model -- add fields:**

```prisma
rolloverThreshold  Decimal  @default(1.00) @map("rollover_threshold") @db.Decimal(5,4)
cappedRetention    Decimal  @default(0.98) @map("capped_retention") @db.Decimal(5,4)
```

Rationale: Version model already holds version-scoped config (`staleModules`, `dataSource`). Two fields don't justify a separate table.

**Seed script:** Set PS grade's `defaultAy2Intake = 66`. Set existing version defaults via migration default clause.

### 1.2 Shared Types

**File:** `packages/types/src/cohort.ts`

Add:

```typescript
export interface PlanningRules {
    rolloverThreshold: number; // e.g. 1.00 = 100%
    cappedRetention: number; // e.g. 0.98 = 98%
}

export interface MasterGridRow {
    gradeLevel: GradeCode;
    gradeName: string;
    band: string;
    displayOrder: number;
    isPS: boolean;
    ay1Headcount: number;
    retentionRate: number;
    lateralEntry: number;
    ay2Headcount: number;
    sectionsNeeded: number;
    utilization: number;
    alert: 'OVER' | 'NEAR_CAP' | 'OK' | 'UNDER' | null;
}
```

Update `CohortParameterEntry.recommendationRule`: rename `'fixed-97-growth'` to `'capped-retention-growth'`.

**Migration strategy: All-at-once rename.** The rule name is a computed value returned by the recommendation engine on each request. It is NOT persisted in the database. It is derived fresh every time `getHistoricalCohortRecommendations()` runs. Therefore:

- No database migration needed for the rename
- No backward compatibility needed -- old value never existed in storage
- All files must be updated in the same commit to avoid type errors
- Test fixtures and mocks must be updated simultaneously

**All files containing `'fixed-97-growth'` that need updating:**

- `packages/types/src/cohort.ts` (line 19, type union)
- `apps/api/src/services/cohort-recommendations.ts` (line 16, type definition + line 191, rule assignment)
- `apps/api/src/services/cohort-recommendations.test.ts` (lines 46, 115, 125, test assertions)
- `apps/web/src/components/enrollment/setup-wizard.tsx` (line 51, local type definition)

### 1.3 Recommendation Engine

**File:** `apps/api/src/services/cohort-recommendations.ts`

**Changes:**

- Remove hardcoded `HIGH_GROWTH_ROLLOVER_THRESHOLD = 1.05` and `DEFAULT_COHORT_RETENTION_RATE = 0.97`
- Add `planningRules: PlanningRules` parameter to `getHistoricalCohortRecommendations()` and `buildHistoricalCohortObservations()`
- Replace threshold check: `rolloverRatio >= 1.05` becomes `rolloverRatio > planningRules.rolloverThreshold`
- Replace cap value: `0.97` becomes `planningRules.cappedRetention`
- Rename rule: `'fixed-97-growth'` to `'capped-retention-growth'`
- Fallback default: use `planningRules.cappedRetention` instead of hardcoded 0.97

**Behavior after change:**

- rollover > threshold: suggested retention = cap, laterals = excess students
- rollover <= threshold: suggested retention = actual rollover, laterals = 0

### 1.4 Cohort Parameters Route

**File:** `apps/api/src/routes/enrollment/cohort-parameters.ts`

**GET changes:**

- Fetch `rolloverThreshold`, `cappedRetention` from version record
- Pass as `planningRules` to `getHistoricalCohortRecommendations()`
- Include `planningRules` in response envelope: `{ entries: [...], planningRules: { rolloverThreshold, cappedRetention } }`

**PUT changes:**

- Add optional `planningRules` to body schema (rolloverThreshold: 0.5-2.0, cappedRetention: 0.5-1.0)
- When present, update version's fields in same transaction
- Invalidation: same stale modules

### 1.5 Planning Rules Endpoint (new)

**File:** `apps/api/src/routes/enrollment/planning-rules.ts` (new)

- `GET /versions/:versionId/enrollment/planning-rules` -- returns `{ rolloverThreshold, cappedRetention }`
- `PUT /versions/:versionId/enrollment/planning-rules` -- updates both, marks enrollment modules stale

Register in `apps/api/src/routes/enrollment/index.ts`:

```typescript
import { planningRulesRoutes } from './planning-rules.js';
// ... inside register function:
await app.register(planningRulesRoutes);
```

### 1.6 Setup Route Update

**File:** `apps/api/src/routes/enrollment/setup.ts`

- Add optional `planningRules` to `setupApplyBodySchema`
- When present, persist on version before running calculation
- Pass through to recommendation engine

### 1.7 GradeLevel Response

Grade levels are served from `GET /master-data/grade-levels` in `apps/api/src/routes/master-data/grade-levels.ts` (not a root route). The `serializeGradeLevel()` function (line 24-31) returns all model fields. Adding `defaultAy2Intake` to the Prisma model means it will be included in the response automatically via `findMany()`.

**Frontend type update required:** The `GradeLevel` interface in `apps/web/src/hooks/use-grade-levels.ts` (line 6-17) must add `defaultAy2Intake: number | null`.

**Admin editing for `defaultAy2Intake`:**

- The update route in `grade-levels.ts` uses `updateGradeLevelSchema` (line 6-14) which currently accepts: `maxClassSize`, `plancherPct`, `ciblePct`, `plafondPct`, `displayOrder`, `version`
- Add `defaultAy2Intake: z.number().int().min(0).max(200).nullable().optional()` to this schema
- The `useUpdateGradeLevel` mutation in `use-grade-levels.ts` (line 28-49) needs its type updated to include `defaultAy2Intake`
- The admin UI is the Grade Levels tab in `apps/web/src/pages/master-data/academic.tsx` -- add the field to the grade edit form
- RBAC: Admin role only (already enforced on the PUT route)

### 1.8 Recommendation Refresh Strategy: Server Round-Trip (Option A)

Recommendations are derived server-side by `getHistoricalCohortRecommendations()`. The frontend receives pre-computed recommendations via `useCohortParameters()`. There is no client-side re-derivation capability.

**Decision: Option A (server round-trip).** When planning rules change:

1. `usePutPlanningRules` mutation fires
2. On success, invalidate `['enrollment', 'cohort-parameters', versionId]`
3. TanStack Query re-fetches cohort parameters from the server
4. Server recomputes recommendations using the new rules
5. UI updates with fresh recommendations

This is simpler and safer than Option B (client-side re-derivation), which would require shipping historical observation data to the frontend. The round-trip is fast (~50ms for this query) and guarantees consistency.

**In the wizard:** When the user changes planning rules in Step 2, the wizard should NOT do a server round-trip mid-step. Instead, it locally re-derives recommendations using a lightweight client-side approximation: apply the new cap/threshold to the already-fetched recommendation data. On "Confirm & Calculate", the server does the authoritative calculation. This avoids network latency during wizard interactions.

### 1.9 Existing Version Migration Policy

Existing versions will get `rolloverThreshold = 1.00` and `cappedRetention = 0.98` via the migration `@default` clause. This DOES change recommendation behavior for existing Draft versions:

- Old: rollover >= 1.05 triggered 97% cap
- New: rollover > 1.00 triggers 98% cap

**Decision: Accept the behavior change.** Rationale:

- The old thresholds (1.05 / 0.97) were wrong per business requirements
- Only Draft versions are affected (Published/Locked versions don't regenerate recommendations)
- Recommendations are suggestions, not persisted values -- they only affect what the wizard suggests
- Users who already saved explicit retention rates are unaffected (persisted values override recommendations)

No special migration logic needed beyond the column defaults.

### 1.10 Verified: Constant Usage is Internal Only

`DEFAULT_COHORT_RETENTION_RATE` and `HIGH_GROWTH_ROLLOVER_THRESHOLD` are defined and used ONLY inside `cohort-recommendations.ts`. They are exported but NOT imported by any other file. Safe to remove without cross-file breakage.

---

## Phase 2: Frontend Data Layer

### 2.1 Update CohortParametersResponse Type (BREAKING)

**File:** `apps/web/src/hooks/use-cohort-parameters.ts`

The current `CohortParametersResponse` interface is `{ entries: CohortParameterEntry[] }`. The API will now return `{ entries, planningRules }`. Update:

```typescript
export interface CohortParametersResponse {
    entries: CohortParameterEntry[];
    planningRules: PlanningRules;
}
```

All consumers of `useCohortParameters()` that destructure `.data.entries` will continue to work. The new `.data.planningRules` field becomes available for the sidebar default view and wizard.

### 2.2 Planning Rules Hook (new)

**File:** `apps/web/src/hooks/use-planning-rules.ts` (new)

```typescript
export function usePlanningRules(versionId: number | null); // useQuery
export function usePutPlanningRules(versionId: number | null); // useMutation
```

Query key: `['enrollment', 'planning-rules', versionId]`
On mutation success: invalidate `planning-rules` + `cohort-parameters` (recommendations refresh)

### 2.3 Master Grid Row Builder

**File:** `apps/web/src/lib/enrollment-workspace.ts`

Add function:

```typescript
export function buildMasterGridRows({
    gradeLevels,
    ay1HeadcountMap,
    cohortEntries,
    psAy2Headcount,
    capacityResults,
}): MasterGridRow[];
```

Internally calls existing `buildCohortProjectionRows()` then merges capacity results (sections, utilization, alert) per grade. Falls back gracefully when capacity results haven't been calculated yet.

Also attach UI-oriented row metadata used for finance workflows:

- `isPersistedResult: boolean`
- `hasManualOverride: boolean`
- `confidence: 'high' | 'medium' | 'low' | null`
- `hasBlockingIssue: boolean`
- `issueTags: string[]`

Rationale: finance users should be able to sort/filter by confidence, override state, and blockers without re-deriving that logic in multiple components.

---

## Phase 3: Master Grid Component (new, not yet wired)

### 3.1 EnrollmentMasterGrid

**File:** `apps/web/src/components/enrollment/enrollment-master-grid.tsx` (new)

Uses `PlanningGrid` as base. The existing PlanningGrid already supports: sticky headers, band grouping, subtotals, pinned columns, row selection, column resizing, loading skeletons.

**Columns (8):**

| #   | ID             | Header   | Width         | Content              | Notes                  |
| --- | -------------- | -------- | ------------- | -------------------- | ---------------------- |
| 1   | gradeName      | Grade    | 160px, pinned | Name + code subtitle | Band chip color        |
| 2   | ay1Headcount   | AY1      | 80px          | Integer              | Right-aligned          |
| 3   | retentionRate  | Ret%     | 72px          | Percentage           | PS shows "--"          |
| 4   | lateralEntry   | Laterals | 72px          | Integer              | PS shows "--"          |
| 5   | ay2Headcount   | AY2      | 80px          | Bold integer         | PS shows direct value  |
| 6   | sectionsNeeded | Sections | 72px          | Integer              | "-" if 0               |
| 7   | utilization    | Util%    | 80px          | % + color bar        | Reuse UtilizationCell  |
| 8   | alert          | Status   | 80px          | Alert badge          | OVER/NEAR_CAP/OK/UNDER |

**Band subtotals:** AY1 sum, "--" for Ret%, Laterals sum, AY2 sum, Sections sum, avg Util%, worst alert.

**Grand total footer:** Same pattern.

**Behaviors:**

- Row click: `selectGrade(row.gradeLevel)` -- opens sidebar inspector
- Selected row: highlighted with accent tint + left rail
- Band filter: prop from parent, filters `MasterGridRow[]`
- Exception filter: separate prop from parent, filters by actionable conditions without changing band selection
- No editable columns -- all editing via sidebar
- Grid root: `h-full overflow-y-auto` for internal scroll
- Support export of current visible rows and preserve filter state in URL/query params where practical

**Row height:** Compact -- `py-2` (32px total). Band headers `py-1.5` (28px). Subtotals `py-1.5` with muted text.

**Additional finance-user behaviors:**

- Double-click or keyboard shortcut on selected row opens the assumption editor directly in the sidebar
- `Accept All Recommendations` must show affected grade count and offer an undo action
- Filtered totals must be labeled clearly as `Filtered Total`, not `Total`, to avoid misreading during review meetings

### 3.2 Grid Styling Direction

- Softer stripe: alternate rows use `bg-(--grid-stripe)/30` (reduce current opacity)
- Selected row: `bg-(--accent-wash)` + 3px left border in `--accent`
- Numeric cells: tabular-nums, reduced font size for secondary data
- Band headers: calmer -- thin colored left bar instead of full-width colored background
- Subtotal rows: `text-(--text-muted)` italic, lighter weight
- Grand total: `font-semibold`, subtle top border

---

## Phase 4: Page Layout Swap

### 4.1 Enrollment Page Rewrite

**File:** `apps/web/src/pages/planning/enrollment.tsx`

**Remove:**

- `WorkspaceBoard` / `WorkspaceBlock` wrappers
- `CohortProgressionGrid` import and usage
- `NationalityDistributionGrid` import and usage
- `CapacityGrid` import and usage
- `HistoricalChart` import, `historyOpen` state, and toggle button
- All `space-y-4` scrollable wrapper divs

**Keep:**

- All data hooks (useHeadcount, useCohortParameters, useEnrollmentCapacityResults, useHistorical, useGradeLevels)
- Version guard (no versionId => empty state)
- Editability derivation (`deriveEnrollmentEditability`)
- KPI data computation (useMemo)
- Wizard open/close logic + auto-prompt
- `PageTransition` wrapper
- `VersionLockBanner`, imported/viewer banners
- Band filter toggle group + state
- Wizard dialog

**New structure:**

```tsx
<PageTransition>
    <div className="flex h-full flex-col overflow-hidden">
        {/* Conditional banners (shrink-0) -- keep ALL three from current page */}
        {isLocked && <VersionLockBanner status={versionStatus} versionName={versionName} />}
        {isImported && <ImportedVersionBanner />}
        {isViewer && <ViewerBanner />}

        {/* Header (shrink-0) */}
        <header className="shrink-0 border-b border-(--workspace-border) px-6 py-3">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold">Enrollment Planning</h1>
                    <p className="text-xs text-(--text-muted)">{versionName}</p>
                </div>
                <div className="flex items-center gap-2">
                    <BandFilterToggleGroup />
                    <ExceptionFilterMenu />
                    <ExportButton />
                    <SetupButton />
                    <CalculateButton />
                </div>
            </div>
        </header>

        {/* KPI ribbon (shrink-0) */}
        <EnrollmentKpiRibbon />

        {/* Status strip (shrink-0) */}
        <EnrollmentStatusStrip />

        {/* Master grid (flex-1, internal scroll) */}
        <div className="flex-1 overflow-hidden px-6 py-3">
            <EnrollmentMasterGrid className="h-full" />
        </div>
    </div>

    <EnrollmentSetupWizard />
</PageTransition>
```

**Do not remove export from the page-level experience.** Even if export implementation remains cross-cutting, the redesign should keep the affordance visible in the target layout because finance users expect extraction as part of review and sign-off.

---

## Phase 5: Sidebar Restructure

### 5.1 Tab Rename

**File:** `apps/web/src/components/shell/right-panel.tsx`

Change display label only: `'Help'` to `'Guide'` in the TABS array. Keep `id: 'help'` to avoid cascading type changes.

Add enrollment-specific guide content rendering in the `help` tab handler: when `activePage === 'enrollment'`, render `<EnrollmentGuideContent />`.

### 5.2 Default View Redesign

**File:** `apps/web/src/components/enrollment/inspector-default-view.tsx`

**Remove:**

- Workflow steps cards (3 animated cards) -- this content moves to Guide tab
- AY1/Cohort coverage metric cards -- setup-specific, not needed in steady state

**Keep:**

- Band summary table (4-row table with AY1 to AY2 deltas per band)

**Add (above band summary):**

- **Exception Queue** (highest priority block, above charts)
    - Compact list of grades requiring action
    - Order: OVER > Missing Inputs > Manual Override > Near Capacity > Low Confidence
    - Each item shows grade, issue label, and CTA (`Review`)
    - Empty state: `No blocking exceptions.`

- **Portfolio Charts** (two compact charts)
    - Enrollment Trend by Band: multi-series line chart, 3-5 years, using `useHistorical()` data
    - AY1 vs Projected AY2: grouped bar chart, 4 band groups
    - Both use `useChartColors()` for band colors
    - Height: ~130px each, compact
    - If vertical space becomes constrained, charts collapse below the exception queue rather than pushing critical controls out of view

- **Planning Rules card**
    - Rollover Threshold input (%, default 100%)
    - Retention Cap input (%, default 98%)
    - Changes are **staged locally** and committed with explicit `Save` / `Reset` actions
    - On save: call `usePutPlanningRules` mutation
    - Show impacted grades count after edits: e.g. `Affects 6 recommendation rows`
    - Info tooltips explaining each rule
    - Only editable when version is Draft + user has Editor+ role
    - Persist audit-friendly success text: `Planning rules saved for this version`

- **Workflow Status** (compact)
    - Three pills: Baseline (Complete/Pending), Assumptions (Complete/Pending), Calculation (Fresh/Stale)
    - Add `Last calculated <timestamp>` and `Downstream stale: Revenue, DHG, Staffing, P&L`
    - Replace the verbose 3-step workflow cards

**Finance-first prioritization note:** if the sidebar becomes crowded, keep Exception Queue + Planning Rules + Workflow Status first. Charts are useful, but they are not the first thing a finance planner needs during issue resolution.

### 5.3 Active View (Minimal Changes)

**File:** `apps/web/src/components/enrollment/inspector-active-view.tsx`

Changes:

- When PS grade is selected and AY2 is empty, show `defaultAy2Intake` from GradeLevel as placeholder in the intake input. Requires passing `defaultAy2Intake` from the `useGradeLevels()` response.
- Show explicit source labels where relevant: `Calculated from prior grade`, `Manual override`, `Direct intake`, `Not yet calculated`
- If a grade has a manual nationality override, display a persistent badge so reviewers can spot non-standard logic instantly

Everything else stays: grade header, AY1/AY2 cards, historical trend chart, assumption editor, nationality editor, capacity preview.

### 5.4 Guide Tab Content (new)

**File:** `apps/web/src/components/enrollment/enrollment-guide-content.tsx` (new)

Static JSX content organized in collapsible sections:

- **Workflow Overview:** Baseline to Assumptions to Calculate to Review
- **Cohort Formula:** `AY2 = floor(Prior_AY1 x Retention%) + Laterals`
- **PS Handling:** Direct intake, defaults from admin config
- **Planning Rules:** How threshold and cap affect recommendations
- **Nationality Overrides:** How the 3-group system works, 100% validation
- **Capacity Alerts:** What OVER/NEAR_CAP/OK/UNDER mean

---

## Phase 6: Wizard Consolidation (5 to 3 Steps)

### 6.1 Wizard Rewrite

**File:** `apps/web/src/components/enrollment/setup-wizard.tsx`

**New step structure:**

```typescript
const WIZARD_STEPS = [
    { id: 'source', title: 'Source & AY1', icon: Database },
    { id: 'parameters', title: 'Parameters', icon: Sliders },
    { id: 'preview', title: 'Preview & Apply', icon: CheckCircle },
];
```

**Step 1: Source & AY1** (merges old steps 1-3)

- Source picker: radio group with 2-3 options:
    - "Use stored AY1" (if version has saved data)
    - "Use latest baseline" (prior year Actual AY2)
    - "Import from file" (inline upload)
- Show source provenance summary under the picker: source version name, year, and last import/refresh date when known
- If "Import" selected: file upload + validation appears inline (not a separate step)
- Import compare table: shows delta vs selected source with variance highlighting (>=10%)
- AY1 review table: all grades with headcount, editable, delta column
- PS AY2 intake: prominent highlighted card at top with `defaultAy2Intake` as placeholder
- Source switch confirmation: if user modified staged rows and switches source, confirm dialog
- Add quick actions: `Paste from clipboard` and `Reset to source` if feasible within the existing table pattern; finance users will expect one of these bulk-entry accelerators

**Step 2: Progression Parameters** (enhanced old step 4)

- Planning Rules card at top: Rollover Threshold (%) + Retention Cap (%)
- Grade table: Grade | Current Ret% | Recommended | Laterals | Recommended | Confidence
- Recommendation chips: color-coded by confidence (green=high, amber=medium, gray=low)
- "Accept All Recommendations" bulk action button
- Bulk action confirm text must show how many grades will change
- Provide `Undo` for the current wizard session after bulk accept
- Include an exception sub-list for grades with low confidence, missing historical support, or unusually large projected movement
- Rule explanation tooltips on hover
- When rules change, recommendations refresh (re-derive from historical data on client)

**Step 3: Preview & Apply** (enhanced old step 5)

- Summary cards row: Total AY1, Total AY2, Growth %, Alert count
- Full projection table: Grade | AY1 | Ret% | Laterals | AY2 | Sections | Util% | Alert
- Capacity alerts highlighted (OVER in red, NEAR_CAP in amber)
- Nationality preview section (collapsed by default, expandable)
- Add a blocking validation summary above the primary CTA:
    - Missing AY1 grades
    - Missing PS intake when no default exists
    - Invalid or incomplete nationality assumptions
    - Missing grade-level master data (max class size / thresholds / default AY2 intake)
    - Unsaved planning rule changes
- "Confirm & Calculate" primary button

**Wizard state management notes:**

- All step state (staged AY1 values, import validation results, parameter selections) must persist during backward navigation. Use a single `useReducer` or state object that holds all 3 steps' data, not per-step useState.
- Import validation state from Step 1 must survive navigating to Step 2 and back.
- File input ref needs cleanup on wizard close (reset to null in onClose handler).
- Source switch confirmation: if user modified staged rows in Step 1, switching source radio clears staged edits with a confirmation dialog.

**What to keep from current wizard:**

- Portal-based rendering (`createPortal`)
- File upload/validation flow (`useSetupImportValidation`)
- `GroupedHeadcountTable` component (reuse for data tables)
- Apply mutation call (`useApplyEnrollmentSetup`)
- Keyboard navigation (Escape to close)
- Auto-prompt logic (auto-open for empty versions)

**Important UX safety rule:** the submit button should remain enabled until the request actually starts, then show a loading state. Do not pre-disable it merely because the form looks valid/in-progress; finance users often verify one last time before committing.

### 6.2 Wizard Animations

**Transitions:**

- Step content: `translateX(40px) to translateX(0)` with `ease-out-expo` (350ms) forward
- Step content: `translateX(-40px) to translateX(0)` with `ease-out-expo` (350ms) backward
- Progress bar: animated width transition (33% to 66% to 100%) with CSS transition
- Stepper: active step indicator slides with `transform` transition

**Success state:**

- On "Confirm & Calculate" success: subtle pulse animation on the confirmation card
- Checkmark draw animation (SVG stroke-dasharray/dashoffset technique)
- Auto-close wizard after 1.5s delay with fade-out

**CSS keyframes to add in `apps/web/src/index.css`:**

```css
@keyframes wizard-step-enter-right {
    from {
        transform: translateX(40px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes wizard-step-enter-left {
    from {
        transform: translateX(-40px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes wizard-success-pulse {
    0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.4);
    }
    50% {
        transform: scale(1.02);
        box-shadow: 0 0 20px 4px rgba(20, 184, 166, 0.2);
    }
    100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(20, 184, 166, 0);
    }
}

/* WCAG AA: Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
    .animate-wizard-step-right,
    .animate-wizard-step-left,
    .animate-wizard-success {
        animation: none !important;
        transition: none !important;
    }
}
```

---

## Phase 7: Cleanup & Polish

### 7.1 Delete Dead Components

- `apps/web/src/components/enrollment/cohort-progression-grid.tsx` -- replaced by master grid
- `apps/web/src/components/enrollment/nationality-distribution-grid.tsx` -- content in sidebar
- `apps/web/src/components/enrollment/capacity-grid.tsx` -- content in master grid + sidebar

### 7.2 Historical Chart

- Remove `apps/web/src/components/enrollment/historical-chart.tsx` as standalone component
- Historical data now lives in sidebar default view (portfolio charts) and active view (grade trend)
- The `useHistorical()` hook stays -- it feeds the sidebar charts

### 7.3 Visual Polish

- Grid row height: compact `py-2` (32px)
- Band separators: thin colored left bar (4px) instead of full-width colored background
- Selected row: accent wash + 3px left accent rail
- Subtotal rows: muted italic text
- Grand total: semibold with subtle top border

### 7.4 Test Updates

- `apps/api/src/services/cohort-recommendations.test.ts` -- parameterized thresholds, new rule name
- `apps/api/src/routes/enrollment/cohort-parameters.test.ts` -- planning rules in GET/PUT
- `apps/web/src/components/enrollment/setup-wizard.test.tsx` -- rewrite for 3-step flow
- New test for planning rules endpoint
- New test for master grid row builder
- Integration test: "Accept All Recommendations" with custom planning rules (threshold=1.0, cap=0.98)
- Edge case test: version with no historical data -- fallback defaults should use cappedRetention
- Verify invalidation chain: changing planning rules in sidebar refreshes cohort parameter recommendations
- Test: filtered totals are labeled correctly and cannot be confused with global totals
- Test: planning rules edited in sidebar are staged until Save, not persisted on each keystroke
- Test: comparison mode or narrow-height viewport does not trap critical controls off-screen
- Test: exported visible dataset respects active band/exception filters

---

## Edge Cases & Friction Checklist to Add Before Implementation

The current plan fixes important structural issues, but to make it resilient in real finance workflows it should explicitly account for the following:

| Area                       | Edge Case / Friction                                                    | Required Handling                                                                              |
| -------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Trust & persistence        | User reopens page after prior calculation                               | Load persisted results and show `Last calculated` metadata, not only in-session mutation state |
| Preview vs saved           | Wizard preview differs from persisted page state                        | Use clear labels: `Preview`, `Saved`, `Calculated`                                             |
| Master data dependency     | Grade has missing max class size, thresholds, or PS default intake      | Show blocking callout with link to master data; do not silently fall back                      |
| No historical data         | Recommendation confidence is weak                                       | Show `Low confidence` tag and explain fallback rule                                            |
| Comparison mode            | Right panel auto-collapses while redesign relies on sidebar             | Define explicit comparison-mode behavior before implementation                                 |
| Narrow viewport            | No-scroll layout clips controls on lower-height displays                | Allow controlled page-scroll fallback or compress non-critical regions                         |
| Bulk recommendation accept | User accepts all and regrets it                                         | Provide undo within session and confirmation with affected grade count                         |
| Export & review            | User needs board-pack / committee review output                         | Export current filtered grid and exception report                                              |
| Filtered interpretation    | User filters to one band and mistakes filtered KPI for whole-school KPI | Label filtered totals clearly and keep global totals visible in the KPI/status layer           |
| Concurrent edits           | Another user updates the same version                                   | Show conflict toast/dialog and refresh guidance                                                |
| Manual overrides           | Reviewer must identify non-standard assumptions quickly                 | Surface override badges in grid/sidebar/exception queue                                        |
| Locked/imported version    | User can inspect but not edit                                           | Keep actions visible only where helpful, with clear disabled reason text                       |
| Unsaved rule changes       | User edits sidebar rules then navigates away                            | Warn before losing staged rule edits                                                           |
| Downstream impact          | User finishes enrollment and forgets next step                          | Show downstream stale pills and a CTA to the next module                                       |

---

## Outstanding Experience Criteria

The redesign should only be considered truly outstanding if it satisfies all of the following experiential tests:

1. **A finance manager can explain the current state in 10 seconds**: source, saved status, last calculation, and blocking issues are visible immediately.
2. **A budget analyst can complete a normal update without touching more than one surface at a time**: grid to scan, sidebar to edit, wizard to set up.
3. **A reviewer can identify exceptions before charts**: action beats decoration.
4. **A user can recover from a mistake**: bulk accept, source switch, and rule changes all need clear undo/reset paths.
5. **A committee deck can be prepared without workarounds**: export is visible and trustworthy.
6. **The page remains usable on a typical laptop during long planning sessions**: no clipped controls, no hidden state, no mystery recalculations.

---

## File Change Matrix

### CREATE (new files):

| File                                                              | Purpose                                 |
| ----------------------------------------------------------------- | --------------------------------------- |
| `apps/api/src/routes/enrollment/planning-rules.ts`                | GET/PUT planning rules endpoint         |
| `apps/web/src/hooks/use-planning-rules.ts`                        | TanStack Query hooks for planning rules |
| `apps/web/src/components/enrollment/enrollment-master-grid.tsx`   | Single consolidated grid                |
| `apps/web/src/components/enrollment/enrollment-guide-content.tsx` | Guide tab README content                |

### MODIFY (existing files):

| File                                                            | Nature of Change                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                                 | Add defaultAy2Intake to GradeLevel, rolloverThreshold/cappedRetention to BudgetVersion |
| `packages/types/src/cohort.ts`                                  | Add PlanningRules, MasterGridRow interfaces; rename rule type                          |
| `apps/api/src/services/cohort-recommendations.ts`               | Parameterize thresholds, rename rule                                                   |
| `apps/api/src/routes/enrollment/cohort-parameters.ts`           | Include planning rules in GET/PUT                                                      |
| `apps/api/src/routes/enrollment/setup.ts`                       | Accept planning rules in apply                                                         |
| `apps/api/src/routes/enrollment/index.ts`                       | Register planning rules route                                                          |
| `apps/web/src/pages/planning/enrollment.tsx`                    | Full rewrite: fixed viewport + master grid                                             |
| `apps/web/src/components/enrollment/inspector-default-view.tsx` | Add charts, planning rules, compact status                                             |
| `apps/web/src/components/enrollment/inspector-active-view.tsx`  | PS defaultAy2Intake placeholder                                                        |
| `apps/web/src/components/enrollment/setup-wizard.tsx`           | 5 steps to 3 steps + animations                                                        |
| `apps/web/src/components/shell/right-panel.tsx`                 | Rename "Help" tab to "Guide" + enrollment guide content                                |
| `apps/web/src/lib/enrollment-workspace.ts`                      | Add buildMasterGridRows() function                                                     |
| `apps/web/src/hooks/use-cohort-parameters.ts`                   | Add planningRules to CohortParametersResponse type + PUT mutation type                 |
| `apps/web/src/hooks/use-enrollment.ts`                          | Add planningRules to apply mutation payload type                                       |
| `apps/web/src/hooks/use-grade-levels.ts`                        | Add defaultAy2Intake to GradeLevel interface + update mutation type                    |
| `apps/api/src/routes/master-data/grade-levels.ts`               | Add defaultAy2Intake to updateGradeLevelSchema                                         |
| `apps/web/src/pages/master-data/academic.tsx`                   | Add defaultAy2Intake field to grade edit form                                          |
| `apps/web/src/pages/planning/enrollment.test.tsx`               | Update mocks for new response shapes                                                   |
| `apps/web/src/index.css`                                        | Wizard animation keyframes + prefers-reduced-motion                                    |

### DELETE (after Phase 4 ships):

| File                                                                   | Reason                          |
| ---------------------------------------------------------------------- | ------------------------------- |
| `apps/web/src/components/enrollment/cohort-progression-grid.tsx`       | Replaced by master grid         |
| `apps/web/src/components/enrollment/nationality-distribution-grid.tsx` | Content moved to sidebar        |
| `apps/web/src/components/enrollment/capacity-grid.tsx`                 | Content merged into master grid |

### UNCHANGED:

- `apps/web/src/stores/enrollment-selection-store.ts` -- works as-is
- `apps/web/src/stores/right-panel-store.ts` -- works as-is
- `apps/web/src/components/enrollment/enrollment-inspector.tsx` -- router logic unchanged
- `apps/web/src/components/enrollment/inspector-nationality-editor.tsx` -- unchanged
- `apps/web/src/components/data-grid/planning-grid.tsx` -- already supports everything needed
- `apps/web/src/layouts/planning-shell.tsx` -- no changes needed
- `apps/web/src/layouts/root-layout.tsx` -- no changes needed

---

## Delivery Sequence (Strict Order)

| #   | Phase            | Ships                                                   | Risk     | Dependencies  |
| --- | ---------------- | ------------------------------------------------------- | -------- | ------------- |
| 1   | Schema + API     | Migration, planning rules endpoint, engine fix          | Low      | None          |
| 2   | Types + Hooks    | Shared types, planning rules hook, contract updates     | Low      | Phase 1       |
| 3a  | Master Grid      | New grid component (not wired yet)                      | Low      | Phase 2       |
| 3b  | Sidebar + Guide  | Default view redesign, guide tab, active view tweak     | Medium   | Phase 2       |
| 4   | Page Layout Swap | Enrollment page rewrite to fixed viewport + master grid | **High** | Phase 3a + 3b |
| 5   | Wizard           | 3-step consolidation + animations                       | **High** | Phase 4       |
| 6   | Cleanup          | Delete old grids, tests, polish                         | Low      | Phase 5       |

Phases 3a and 3b can run in parallel. Phase 4 is the critical swap point. The sidebar is ready BEFORE the page swap so charts, rules, and guide are functional when the new layout ships. See Appendix E for rationale.

---

## Verification

1. **Schema:** `pnpm --filter @budfin/api exec prisma migrate dev` succeeds, `pnpm --filter @budfin/api exec prisma generate` succeeds
2. **API tests:** `pnpm --filter @budfin/api test` -- all enrollment route tests pass including new planning rules tests
3. **Type check:** `pnpm typecheck` passes across all workspaces
4. **Visual verification:**
    - Open enrollment page -- NO page-level scrollbar, grid scrolls internally
    - KPI ribbon visible without scrolling
    - All grades visible in grid (may need to scroll grid body)
    - Click grade row -- sidebar shows inspector
    - Deselect -- sidebar shows portfolio charts + planning rules
    - Change planning rule in sidebar -- recommendations refresh
    - Click "Guide" tab -- planning README visible
5. **Wizard verification:**
    - Open wizard -- 3 steps with animations
    - Step 1: source selection works, PS AY2 shows default intake
    - Step 2: recommendations visible with chips, "Accept All" works, rules editable
    - Step 3: projection preview correct, capacity alerts shown
    - Confirm & Calculate -- success animation -- wizard closes -- grid updates
6. **Lint:** `pnpm lint` clean
7. **Coverage:** `pnpm test -- --coverage` maintains >=80%

---

## Appendix A: API Contract Changes and Affected Consumers

### Changed: `GET /versions/:versionId/enrollment/cohort-parameters`

**Old response:** `{ entries: CohortParameterEntry[] }`
**New response:** `{ entries: CohortParameterEntry[], planningRules: PlanningRules }`

| Consumer                | File                                                             | Impact                                         |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| `useCohortParameters()` | `apps/web/src/hooks/use-cohort-parameters.ts`                    | Update `CohortParametersResponse` type         |
| Enrollment page         | `apps/web/src/pages/planning/enrollment.tsx`                     | Uses `cohortData?.entries` -- no change needed |
| Inspector default view  | `apps/web/src/components/enrollment/inspector-default-view.tsx`  | Uses `cohortData?.entries` -- no change needed |
| Cohort progression grid | `apps/web/src/components/enrollment/cohort-progression-grid.tsx` | Being deleted -- N/A                           |
| Setup wizard            | `apps/web/src/components/enrollment/setup-wizard.tsx`            | Uses `cohortData?.entries` -- no change needed |
| Enrollment page test    | `apps/web/src/pages/planning/enrollment.test.tsx`                | Update mock to include `planningRules`         |

### Changed: `PUT /versions/:versionId/enrollment/cohort-parameters`

**Old body:** `{ entries: CohortParameterEntry[] }`
**New body:** `{ entries: CohortParameterEntry[], planningRules?: PlanningRules }`

| Consumer                   | File                                          | Impact                        |
| -------------------------- | --------------------------------------------- | ----------------------------- |
| `usePutCohortParameters()` | `apps/web/src/hooks/use-cohort-parameters.ts` | Update mutation function type |

### Changed: `POST /versions/:versionId/enrollment/setup/apply`

**Old body:** `{ ay1Entries, cohortEntries, psAy2Headcount? }`
**New body:** `{ ay1Entries, cohortEntries, psAy2Headcount?, planningRules? }`

| Consumer                    | File                                                       | Impact                           |
| --------------------------- | ---------------------------------------------------------- | -------------------------------- |
| `useApplyEnrollmentSetup()` | `apps/web/src/hooks/use-enrollment.ts`                     | Update mutation payload type     |
| Setup wizard                | `apps/web/src/components/enrollment/setup-wizard.tsx`      | Pass planningRules in apply call |
| Setup wizard test           | `apps/web/src/components/enrollment/setup-wizard.test.tsx` | Update mock                      |

### Changed: `GET /master-data/grade-levels`

**Old response field:** `{ gradeLevels: GradeLevel[] }` where GradeLevel has no `defaultAy2Intake`
**New response field:** GradeLevel now includes `defaultAy2Intake: number | null`

| Consumer                     | File                                                           | Impact                                           |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| `useGradeLevels()` type      | `apps/web/src/hooks/use-grade-levels.ts`                       | Add `defaultAy2Intake` to `GradeLevel` interface |
| `useUpdateGradeLevel()` type | `apps/web/src/hooks/use-grade-levels.ts`                       | Add `defaultAy2Intake` to Partial pick           |
| Academic master data page    | `apps/web/src/pages/master-data/academic.tsx`                  | Add field to grade edit form                     |
| Inspector active view        | `apps/web/src/components/enrollment/inspector-active-view.tsx` | Use for PS placeholder                           |
| Setup wizard                 | `apps/web/src/components/enrollment/setup-wizard.tsx`          | Use for PS AY2 default                           |
| Enrollment page test         | `apps/web/src/pages/planning/enrollment.test.tsx`              | Update mock                                      |

### New: `GET/PUT /versions/:versionId/enrollment/planning-rules`

No existing consumers. New hook `usePlanningRules` will be the sole consumer.

---

## Appendix B: Query Invalidation Matrix

| Trigger                            | Queries Invalidated                                  | Reason                                 |
| ---------------------------------- | ---------------------------------------------------- | -------------------------------------- |
| `usePutPlanningRules` (sidebar)    | `['enrollment', 'planning-rules', versionId]`        | Direct data                            |
|                                    | `['enrollment', 'cohort-parameters', versionId]`     | Recommendations recomputed server-side |
|                                    | `['versions']`                                       | Stale modules updated                  |
| `usePutCohortParameters` (sidebar) | `['enrollment', 'cohort-parameters', versionId]`     | Direct data                            |
|                                    | `['versions']`                                       | Stale modules updated                  |
| `useApplyEnrollmentSetup` (wizard) | `['enrollment', 'headcount', versionId]`             | AY1/AY2 changed                        |
|                                    | `['enrollment', 'cohort-parameters', versionId]`     | Parameters changed                     |
|                                    | `['enrollment', 'nationality-breakdown', versionId]` | Nationality recomputed                 |
|                                    | `['enrollment', 'capacity-results', versionId]`      | Capacity recomputed                    |
|                                    | `['enrollment', 'planning-rules', versionId]`        | Rules may have changed                 |
|                                    | `['versions']`                                       | Stale modules cleared                  |
| `useCalculateEnrollment`           | `['enrollment', 'headcount', versionId]`             | AY2 headcounts updated                 |
|                                    | `['enrollment', 'capacity-results', versionId]`      | Capacity computed                      |
|                                    | `['enrollment', 'nationality-breakdown', versionId]` | Nationality computed                   |
|                                    | `['versions']`                                       | Stale modules cleared                  |

**Note:** Planning rules do NOT directly change headcounts or capacity results. They only affect recommendation suggestions. Actual headcount/capacity changes only happen when the user runs Calculate or Apply.

---

## Appendix C: Wizard Behavior Preservation Checklist

These behaviors exist in the current wizard (`setup-wizard.tsx`) and MUST survive the rewrite:

| #   | Behavior                                                            | Current Code Reference          | Must Preserve?                                           |
| --- | ------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| 1   | `buildInitialWorkingRows()` prefers persisted AY1 over baseline     | Lines 70-99                     | Yes -- but source picker replaces this implicit behavior |
| 2   | `importMode` state tracks 'baseline' vs 'imported'                  | Line 431                        | Yes -- map to source picker radio                        |
| 3   | `initializedVersionRef` prevents re-initialization on same version  | Line 423, 441-448               | Yes                                                      |
| 4   | `requestAnimationFrame` for initialization to avoid render flash    | Lines 450-476                   | Yes                                                      |
| 5   | `normalizeWholeNumber()` for integer headcount values               | Lines 62-68                     | Yes                                                      |
| 6   | `validateImport.reset()` when wizard closes                         | Lines 434-437                   | Yes                                                      |
| 7   | `document.body.style.overflow = 'hidden'` to lock background scroll | Lines 484-485                   | Yes                                                      |
| 8   | Escape key closes wizard                                            | Lines 487-489                   | Yes                                                      |
| 9   | Overflow style restored on cleanup                                  | Lines 494-495                   | Yes                                                      |
| 10  | Wizard does not open for non-editable versions                      | Enrollment page line 121        | Yes                                                      |
| 11  | Auto-prompt only fires once per version                             | Lines 125-133 in enrollment.tsx | Yes                                                      |
| 12  | Closing and reopening wizard re-initializes from server state       | Line 434-437 (reset on !open)   | Yes                                                      |
| 13  | PS AY2 headcount uses `getPsAy2Headcount()` utility                 | Line 470                        | Yes -- with defaultAy2Intake enhancement                 |
| 14  | Apply payload includes ay1Entries, cohortEntries, psAy2Headcount    | In applySetup.mutateAsync call  | Yes -- add planningRules                                 |
| 15  | Read-only/imported/locked versions show disabled wizard             | Via `isEditable` check line 425 | Yes                                                      |

---

## Appendix D: Expanded Regression Test Matrix

### API Tests

| Test                                                         | File                             | Status |
| ------------------------------------------------------------ | -------------------------------- | ------ |
| Planning rules GET returns defaults for new version          | `planning-rules.test.ts` (new)   | New    |
| Planning rules PUT updates version fields                    | `planning-rules.test.ts` (new)   | New    |
| Planning rules PUT marks stale modules                       | `planning-rules.test.ts` (new)   | New    |
| Cohort parameters GET includes planningRules in response     | `cohort-parameters.test.ts`      | Update |
| Cohort parameters GET uses planningRules for recommendations | `cohort-parameters.test.ts`      | Update |
| Setup apply accepts optional planningRules                   | `setup.test.ts`                  | Update |
| Grade level GET returns defaultAy2Intake                     | `grade-levels.test.ts`           | Update |
| Grade level PUT accepts defaultAy2Intake                     | `grade-levels.test.ts`           | Update |
| Recommendation engine uses parameterized threshold           | `cohort-recommendations.test.ts` | Update |
| Recommendation engine uses parameterized cap                 | `cohort-recommendations.test.ts` | Update |
| Recommendation engine fallback uses cappedRetention          | `cohort-recommendations.test.ts` | Update |
| Rule name is 'capped-retention-growth' not 'fixed-97-growth' | `cohort-recommendations.test.ts` | Update |

### Frontend Unit Tests

| Test                                                     | File                                 | Status  |
| -------------------------------------------------------- | ------------------------------------ | ------- |
| Master grid row builder merges cohort + capacity data    | `enrollment-workspace.test.ts` (new) | New     |
| Master grid row builder handles missing capacity results | `enrollment-workspace.test.ts` (new) | New     |
| Master grid row builder PS shows direct intake           | `enrollment-workspace.test.ts` (new) | New     |
| Wizard renders 3 steps (not 5)                           | `setup-wizard.test.tsx`              | Rewrite |
| Wizard Step 1 source picker renders options              | `setup-wizard.test.tsx`              | Rewrite |
| Wizard Step 2 shows planning rules inputs                | `setup-wizard.test.tsx`              | Rewrite |
| Wizard "Accept All Recommendations" applies values       | `setup-wizard.test.tsx`              | Rewrite |
| Wizard preserves state on backward navigation            | `setup-wizard.test.tsx`              | Rewrite |
| Wizard apply includes planningRules in payload           | `setup-wizard.test.tsx`              | Rewrite |
| Enrollment page renders without old grids                | `enrollment.test.tsx`                | Update  |
| Enrollment page band filter works with master grid       | `enrollment.test.tsx`                | Update  |
| Guide tab renders enrollment-specific content            | New test                             | New     |
| Sidebar planning rules respects role + version status    | New test                             | New     |

### Layout Verification Tests

| Test                          | Assertion                                                        |
| ----------------------------- | ---------------------------------------------------------------- |
| No outer page scroll          | `<main>` does not have scrollbar (scrollHeight === clientHeight) |
| Grid is the scroll surface    | Grid container has scrollbar when rows exceed viewport           |
| Sticky header remains visible | Grid thead stays at top during internal scroll                   |
| Banner stacking (3 banners)   | Grid zone still has >300px usable height                         |
| Right panel open/closed       | Grid width adjusts, no horizontal overflow                       |

---

## Appendix E: Delivery Sequence Rationale

The reviewer suggested an alternative sequence: API+rules first, then sidebar+guide, then page swap, then wizard. Here is the analysis:

**Current plan:** API > Types > Grid > **Page Swap** > Sidebar + Wizard > Cleanup

**Reviewer suggestion:** API > Types > Sidebar+Guide > **Page Swap** > Wizard > Cleanup

The reviewer's concern is that during Phase 4 (page swap), row selection might open the old sidebar which assumes old grid behavior.

**Assessment: Not a risk.** The sidebar inspector already works correctly with the current selection store. The `enrollment-inspector.tsx` delegates to `inspector-default-view.tsx` (no selection) or `inspector-active-view.tsx` (grade selected). Neither depends on which grid fired the selection event. The selection store is decoupled from the grids.

However, the reviewer's point about shipping sidebar improvements BEFORE the page swap has merit for a smoother user experience during development. Updated sequence:

| #   | Phase            | Ships                                               | Risk     |
| --- | ---------------- | --------------------------------------------------- | -------- |
| 1   | Schema + API     | Migration, planning rules, engine fix               | Low      |
| 2   | Types + Hooks    | Shared types, planning rules hook, contract updates | Low      |
| 3   | Master Grid      | New grid component (not wired yet)                  | Low      |
| 3b  | Sidebar + Guide  | Default view redesign, guide tab, active view tweak | Medium   |
| 4   | Page Layout Swap | Enrollment page rewrite to fixed viewport           | **High** |
| 5   | Wizard           | 3-step consolidation + animations                   | **High** |
| 6   | Cleanup          | Delete old grids, tests, polish                     | Low      |

This way the sidebar is ready BEFORE the page swap. The page swap benefits from having charts, rules, and guide already functional in the sidebar.
