# Revenue Page Redesign — Epic Specification

> **Date:** 2026-03-13
> **Module:** Epic 2 — Revenue Planning
> **Route:** `/planning/revenue`
> **Reference Model:** Enrollment Page (`/planning/enrollment`)
> **Status:** Epic-ready specification — 13 stories, 21 functional requirements, 11 validated
> decisions
> **Supersedes:** Tab-based layout in `docs/ui-ux-spec/04-revenue.md`

---

## 1. Overview

### Vision

Redesign the Revenue page to deliver the same workspace environment as the Enrollment page.
When the user switches between modules, they must experience an identical architectural approach:
same shell, same toolbar pattern, same KPI ribbon, same inspector sidebar, same settings surface,
same calculate workflow.

### Scope

The Revenue page today uses a `WorkspaceBoard` with 6 collapsible card sections (148 lines). The
target is a single-viewport workspace with a compact forecast grid, rich sidebar inspector, and a
fullscreen settings dialog for all configuration.

**In scope:**

- Smart Forecast Grid with 4 view modes (Category, Grade, Nationality, Tariff)
- Fullscreen settings dialog with 4 tabs (Fee Grid, Tariff Assignment, Discounts, Other Revenue)
- Right panel inspector with Recharts charts and multi-dimensional breakdowns
- KPI ribbon (5 cards), status strip, version banners, setup checklist
- DiscountPolicy schema simplification (drop nationality)
- Revenue readiness endpoint
- Downstream stale marking (STAFFING + PNL) on calculate

**Out of scope (deferred):**

- Parameters tab (deferred to P&L Epic)
- Comparison mode (D11)
- PDF export (deferred to Epic 11 — Reporting)
- Manual override column (D5)

---

## 2. Current State Analysis

### What exists today (`revenue.tsx` — 148 lines)

- `WorkspaceBoard` + 6 collapsible `WorkspaceBlock` sections stacked vertically
- Sections: Tariff Assignment, Fee Grid, Discounts, Other Revenue, Revenue Engine, Executive
  Summary
- Simple toolbar: Period toggle (FY2026/AY1/AY2) + Calculate button
- KPI Ribbon with 4 values (Gross HT, Discounts, Net Revenue, Avg/Student — but Avg/Student is
  hardcoded to 0)
- No right panel, no settings sheet, no setup wizard, no dirty tracking, no status strip, no
  inspector, no version lock banners, no export

### What the Enrollment page delivers (`enrollment.tsx` — 487 lines)

- Full PlanningShell integration with RightPanel inspector
- Rich toolbar: Band filters, Exception filter, Quick Edit toggle, Export, Settings, Setup Wizard,
  Calculate
- KPI Ribbon (AY1, AY2, Delta, Utilization%, Alert count)
- Status Strip (baseline source, last calculated time, dirty count, stale modules)
- Single dense TanStack Table grid filling the viewport (3 editable columns)
- Inspector sidebar: grade-level details, capacity preview, nationality breakdown
- DirtyRowsStore for edit tracking, editability logic, version lock banners
- EnrollmentSettingsSheet for configuration, EnrollmentSetupWizard for onboarding

### Fundamental difference

- **Enrollment** = 1 primary data shape (grades x metrics) -> single interactive grid
- **Revenue** = 4 input areas (fee grid ~90 rows, tariff matrix ~45 rows, discounts ~6 rows,
  other revenue ~20 items) + 2 output views (engine matrix, executive summary) -> multiple distinct
  data shapes that belong in a settings dialog, not the main viewport

---

## 3. Design Decisions

### D1: Smart Forecast Grid as Main Viewport

The main workspace is a **compact revenue forecast matrix** — a read-only grid showing the
calculated revenue output. This is where the user spends 80% of their time: reviewing, analyzing,
and presenting the revenue forecast.

The grid is NOT a dashboard — it becomes a workspace through:

- **View switching** (4 dimensions: Category, Grade, Nationality, Tariff)
- **Row selection** for sidebar drill-down
- **Settings dialog** for editing all revenue assumptions
- **Calculate button** for refreshing the output after changes

No manual override column. Revenue is a pure calculation engine that combines components from
different sources (enrollment headcounts, fee grid, discounts, other revenue items) and applies
formulas. There is no business reason to manually override a calculated value.

### D2: Compact Main Grid — Section Headers Only

The default "Category" view shows **~5 IFRS category rows + grand total**:

```text
Revenue Category      | Jan  | Feb  |...| Dec  | Annual  | %Rev
-------------------------------------------------------------------
Tuition Fees          | 5.8M | 5.8M |...| 6.0M | 59.0M   | 86.5%
Discount Impact       |(223K)|(223K)|...|(249K)| (2.3M)  | -3.4%
Registration Fees     |    0 |    0 |...|    0 |  9.8M   | 14.4%
Activities & Services | 126K | 126K |...| 152K |  1.3M   |  1.9%
Examination Fees      |    0 |    0 |...|    0 |  395K   |  0.6%
===================================================================
TOTAL OPERATING REV   | 5.7M | 5.7M |...| 5.9M | 68.2M   |
```

**No VAT row in the main grid.** VAT is a calculation detail, not a top-level IFRS category.
It appears in the inspector sidebar when any fee line in the selected row has `localTaxRate > 0`.

**View switching** (ToggleGroup in toolbar) changes the grid rows:

- **Category** (default): ~6 rows — IFRS section totals (from `executiveSummary.rows`)
- **Grade**: ~15 rows grouped by band (Maternelle/Elementaire/College/Lycee) with subtotals
- **Nationality**: 3 rows (Francais, Nationaux, Autres) + total
- **Tariff**: 3 rows (Plein, RP, R3+) + total

**Category view data source:** Consumes `executiveSummary.rows` from the existing
`GET /versions/{id}/revenue` response. No backend change needed — the `RevenueMatrixRow[]`
returned by `executiveSummary.rows` already contains the 5 category rows + grand total with
monthly amounts.

Grade, Nationality, and Tariff views use the existing `group_by` API parameter.

**Grade view subtotals:** Frontend groups `group_by=grade` response rows by band using
`GRADE_BAND_MAP` and computes subtotals client-side. No backend change needed.

**Columns:** 15 total

1. Category/Label (200px, pinned left)
2. Jan through Dec (100px each, currency, monospace, right-aligned)
3. Annual Total (120px, bold)
4. % of Revenue (80px, muted)

**Formatting:**

- Negative values: parentheses + error color — `(986,000)`
- Zero values in summer months (Jul/Aug for tuition): dash `-` in muted text
- Grand total row: muted background, weight 700, sticky bottom
- Thousands separator, 0 decimal places for compact display
- fr-FR locale formatting (existing pattern)

### D3: Fullscreen Tabbed Dialog for Settings

All revenue configuration lives in a **fullscreen dialog (~90% viewport)** with left sidebar tab
navigation. This resolves the critical concern that the fee grid (90 rows x 6 editable columns =
540+ inputs) cannot fit in a 680px side sheet.

```text
+------+---------------------------------------------------+
| REVENUE SETTINGS                              [X Close] |
+------+---------------------------------------------------+
|      |                                                   |
| Fee  | ACTIVE TAB: Fee Grid                             |
| Grid | [AY1 | AY2 | Both]  [Band: All|Mat|Elem|Col|Lyc] |
| ---- | [Save Fee Grid]                                   |
| Tari |                                                   |
| ffs  | Per|Grade|Nat  |Tariff|DAI  |TTC   |HT   |T1-T3 |
| ---- | AY1|PS   |Fr   |Plein |5000 |30000 |26086|...   |
| Disc | AY1|PS   |Fr   |RP    |5000 |22500 |19565|...   |
| ---- | AY1|PS   |Nat  |Plein |5000 |30000 |30000|...   |
| Othr | ... (90 rows, full TanStack Table, inline edit)   |
| Rev  |                                                   |
|      | Dirty: 3 rows modified                            |
+------+---------------------------------------------------+
```

**4 tabs, ordered by edit frequency:**

| Tab               | Content                                          | Rows     | Edit Frequency       |
| ----------------- | ------------------------------------------------ | -------- | -------------------- |
| Fee Grid          | Tuition rates per grade/nationality/tariff       | ~90      | Most frequent        |
| Tariff Assignment | Grade x Nationality x Tariff headcount matrix    | ~45      | Second               |
| Discounts         | Per-tariff effective rates (RP %, R3+ %)         | 2 fields | Set once per version |
| Other Revenue     | Non-tuition line items with distribution methods | ~20      | Set once, adjusted   |

Each tab saves independently. On save, the version's `staleModules` is updated to include REVENUE,
which triggers the stale indicator on the main grid.

**Dirty state management:** Each tab maintains independent dirty state via a Zustand store
(`useRevenueSettingsDirtyStore`). The store tracks per-tab dirty status:
`Map<TabName, Set<string>>` where keys are row/field identifiers. Behavior:

- Each tab's [Save] button persists only that tab's changes and clears its dirty set
- Switching tabs with unsaved changes shows an inline warning banner at the top of the departing
  tab: "You have unsaved changes. Switch anyway?" with [Stay] / [Switch] actions
- The dialog [X Close] button checks ALL tabs — if any tab is dirty, a confirmation dialog
  appears: "Unsaved changes in Fee Grid, Discounts. Discard and close?" with [Cancel] / [Discard]
- No "Save All" — independent saves match independent configuration areas

**Viewer role:** When `isViewer`, the settings dialog opens in **read-only mode** — all form
fields are disabled, [Save] buttons are hidden, and a `ViewerBanner` appears at the top of the
dialog. The toolbar button label changes from "Revenue Settings" to "View Settings".

**Tariff Assignment tab:** Nationality breakdown is consumed from the enrollment module (read-only
display of enrollment's nationality totals). Only the tariff weight distribution per nationality
slot is editable. Revenue does not recalculate nationality — it inherits it. Data source: existing
enrollment detail endpoints.

### D4: Rich Breakdown Inspector in Right Panel Sidebar

When the user clicks a row in the main grid, the **right panel sidebar** shows a
multi-dimensional breakdown. The main grid stays compact; all detail lives in the sidebar.

**Default view (no row selected):**

- Revenue composition chart (Recharts pie/bar — Tuition/Registration/Activities/Exam/Other)
- Monthly trend bar chart (Jan-Dec, Recharts)
- Configuration readiness checklist (from readiness endpoint, 4 areas)
- Quick links: Open Settings, Go to Enrollment, Calculation Log

**Active view (row selected — e.g., "Tuition Fees"):**

- Header: selected label + FY total + % of revenue
- Breakdown by each OTHER dimension than the current grid view
- Student contribution: headcount x avg tuition
- Monthly trend sparkline
- "Edit in Settings" shortcuts deep-link to the correct tab in the settings dialog

**Key rule:** The inspector always shows breakdowns by the OTHER dimensions than the current grid
view:

| Grid View   | Inspector Shows                    |
| ----------- | ---------------------------------- |
| Category    | By Band + Nationality + Tariff     |
| Grade       | By Category + Nationality + Tariff |
| Nationality | By Category + Band + Tariff        |
| Tariff      | By Category + Band + Nationality   |

### D5: KPI Ribbon — 5 Cards

Matches enrollment's card layout (grid of cards with accent borders, stale indicators).

| #   | KPI                     | Accent  | Subtitle                               |
| --- | ----------------------- | ------- | -------------------------------------- |
| 1   | Gross Tuition HT        | Blue    | YoY delta if comparison version exists |
| 2   | Total Discounts         | Red     | "X.X% of gross tuition"                |
| 3   | Net Revenue HT          | Green   | Headline number for the CFO            |
| 4   | Other Revenue           | Default | Registration + Activities + Exam fees  |
| 5   | Total Operating Revenue | Green   | Avg per student subtitle               |

- Stale state: `opacity-60` + pulsing amber dot when `isStale`
- Avg per student: `totalOperatingRevenue / totalEnrolledStudents` (cross-module from enrollment
  via `useHeadcount` hook — sum all AY1 entries)

### D6: Toolbar — Mirrors Enrollment

```text
LEFT:   [Category | Grade | Nationality | Tariff]    [AY1 | AY2 | FY2026]
RIGHT:  [Export]  [Revenue Settings]  [Setup]  [Calculate Revenue]
```

- **View ToggleGroup** (left): switches grid rows via API `groupBy` parameter (or
  `executiveSummary.rows` for Category)
- **Period ToggleGroup** (left): filters the grid by date range. **FY2026** = full fiscal year
  (all 12 months). **AY1** = Jan-Jun only. **AY2** = Sep-Dec only. The period selection is a
  frontend column filter — the API always returns all 12 months; the frontend hides columns
  outside the selected range.
- **Export** (right): CSV and XLSX of current grid view using existing export pattern
- **Revenue Settings** (right): opens the fullscreen tabbed dialog
- **Setup** (right): opens the setup checklist — text adapts: "Resume Setup" / "Reopen Setup"
- **Calculate Revenue** (right): triggers engine with pending/success/error states, hidden for
  Viewer role

No Quick Edit toggle (grid is read-only output).

### D7: Status Strip — Mirrors Enrollment

| Element              | Content                                                   |
| -------------------- | --------------------------------------------------------- |
| Last calculated      | "Last calc: 12 Mar 2026, 14:32" or "Never calculated"     |
| Upstream status      | "Enrollment: Fresh" or "Enrollment: Stale (recalculate)"  |
| Downstream stale     | "Downstream stale: Staffing, P&L" (after revenue changes) |
| Configuration status | "Config: 45/45 fees, RP 25%/R3+ 10%, 20/20 items"         |

### D8: Version Banners — Reuse Enrollment Components

- **VersionLockBanner** — when version is Approved/Submitted (not Draft)
- **ImportedBanner** — when version dataSource is IMPORTED
- **ViewerBanner** — when user role is Viewer

All three reuse existing enrollment banner components with no changes.

### D9: Setup Checklist — Not a Sequential Wizard

Revenue's 4 configuration areas are independent (no sequential dependency). A
**non-linear checklist** replaces the enrollment wizard pattern:

```text
+----------------------------------------------+
| REVENUE SETUP CHECKLIST                      |
| Complete these to run your first calculation |
+----------------------------------------------+
| [x] Fee Grid          45/45 entries    [Edit]|
| [x] Tariff Assignment Reconciled       [Edit]|
| [ ] Discount Rates    Not set          [Edit]|
| [x] Other Revenue     20/20 items      [Edit]|
+----------------------------------------------+
| 3 of 4 complete                              |
| [Skip for Now]        [Open Settings ->]     |
+----------------------------------------------+
```

- Each [Edit] opens the settings dialog to the correct tab
- Auto-opens on first version visit if any area is incomplete AND version never calculated
- User can complete areas in any order
- Dismissed state tracked per version per session via `sessionStorage` key
  `revenue-setup-dismissed-{versionId}`

**Completion rules:**

| Area              | Data Source                       | Complete When                                                                |
| ----------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| Fee Grid          | Readiness endpoint (COUNT query)  | All grade x nationality x tariff combinations have non-null `tuitionHT`      |
| Tariff Assignment | Readiness endpoint (EXISTS query) | All enrollment grades have tariff weights summing to 100% per nationality    |
| Discount Rates    | Readiness endpoint (SELECT query) | Both RP and R3+ rates are set (non-null, > 0)                                |
| Other Revenue     | Readiness endpoint (COUNT query)  | All line items have non-zero `annualAmount` and a valid `distributionMethod` |

All checks are **server-side** — the setup checklist calls a single
`GET /versions/{id}/revenue/readiness` endpoint that returns per-area status.

### D10: Per-Tariff Effective Rates (Revised)

**Decision: Keep per-tariff effective rates (RP and R3+ separately), drop nationality dimension.**

The Discounts tab in Revenue Settings contains two fields — one effective rate per discounted
tariff. Plein tariff students always pay full tuition (0% discount).

| Tariff | Effective Rate | Meaning                               |
| ------ | -------------- | ------------------------------------- |
| RP     | 25%            | RP students pay 75% of Plein tuition  |
| R3+    | 10%            | R3+ students pay 90% of Plein tuition |

**Rationale:** The CFO manages scholarship and discount rates per tariff category, not as a
blended average. The nationality dimension is dropped because discounts apply uniformly across
nationalities.

**Migration safety:** The `nationality` field is nullable (`String?`) and all existing
`DiscountPolicy` rows have `nationality IS NULL`. No data consolidation is needed.

### D11: Comparison Mode — Not Applicable

The redesigned forecast workspace does not include comparison mode. The inspector sidebar (D4)
already provides multi-dimensional breakdowns. Cross-version comparison is deferred to a future
iteration if CFO feedback warrants it.

---

## 4. Functional Requirements

| ID         | Requirement                                                                              | Source  |
| ---------- | ---------------------------------------------------------------------------------------- | ------- |
| FR-REV-020 | Revenue forecast grid displays 4 view modes (Category, Grade, Nationality, Tariff)       | D1, D2  |
| FR-REV-021 | Category view shows 5 IFRS rows + grand total from `executiveSummary.rows`               | D2      |
| FR-REV-022 | Grade view groups by band with subtotals (frontend aggregation via `GRADE_BAND_MAP`)     | D2      |
| FR-REV-023 | Period toggle filters grid columns: AY1=Jan-Jun, AY2=Sep-Dec, FY=all 12                  | D6      |
| FR-REV-024 | Revenue settings dialog: fullscreen (~90% viewport), 4 tabs, per-tab independent save    | D3      |
| FR-REV-025 | Fee Grid tab: inline-editable TanStack Table with ~90 rows                               | D3      |
| FR-REV-026 | Tariff Assignment tab: enrollment nationality (read-only) + tariff weights (editable)    | D3      |
| FR-REV-027 | Discounts tab: 2 rate fields (RP %, R3+ %), no nationality dimension                     | D3, D10 |
| FR-REV-028 | Other Revenue tab: line items with distribution methods and annual amounts               | D3      |
| FR-REV-029 | Right panel inspector: default view with charts + readiness, active view with breakdowns | D4      |
| FR-REV-030 | KPI ribbon: 5 cards with accent borders and stale indicators                             | D5      |
| FR-REV-031 | Status strip: last calc, upstream enrollment, downstream stale, config status            | D7      |
| FR-REV-032 | Version banners: reuse VersionLockBanner, ImportedBanner, ViewerBanner                   | D8      |
| FR-REV-033 | Setup checklist: 4 areas, non-linear, auto-open when incomplete + never calculated       | D9      |
| FR-REV-034 | Readiness endpoint: 4 area checks (fee grid, tariff, discounts, other revenue)           | D9      |
| FR-REV-035 | DiscountPolicy: drop nationality, simplify unique constraint to `(versionId, tariff)`    | D10     |
| FR-REV-036 | Revenue calculate marks STAFFING + PNL stale downstream                                  | New     |
| FR-REV-037 | Inspector charts via Recharts (monthly trend bar, composition pie/bar)                   | D4      |
| FR-REV-038 | Export: CSV/XLSX of current grid view using existing export pattern                      | D6      |
| FR-REV-039 | Avg per student KPI: `totalOperatingRevenue / enrollmentHeadcount`                       | D5      |
| FR-REV-040 | Viewer role: calculate hidden, settings read-only, checklist [Edit] opens read-only      | D3      |

---

## 5. Non-Functional Requirements

### Performance

| Metric                             | Target  | Rationale                                    |
| ---------------------------------- | ------- | -------------------------------------------- |
| Readiness endpoint response time   | < 200ms | 4 lightweight COUNT/EXISTS queries           |
| Settings dialog open               | < 500ms | Lazy-load tab content; eager-load active tab |
| Forecast grid render (any view)    | < 300ms | Max ~15 rows x 15 columns = 225 cells        |
| Revenue calculation (full)         | < 3s    | Existing engine benchmark                    |
| Category view switch (no API call) | < 100ms | Data already in `executiveSummary.rows`      |

### Accessibility (WCAG AA)

- All interactive elements keyboard accessible (Tab, Enter, Escape, Arrow keys)
- Grid cells navigable via arrow keys within TanStack Table
- Settings dialog: focus trap on open, return focus on close
- Setup checklist: focus management on auto-open
- Color contrast ratio >= 4.5:1 for all text
- ARIA roles: `grid` for forecast table, `dialog` for settings, `tablist`/`tab`/`tabpanel` for
  settings tabs, `list`/`listitem` for KPI ribbon, `status` for status strip
- Screen reader: KPI values announced with labels ("Gross Tuition HT: SAR 59M")

### Security

- Readiness endpoint: all authenticated users (GET, read-only)
- Settings dialog: Viewer role sees read-only mode
- Calculate button: hidden for Viewer role (existing RBAC via `requireRole`)
- All data version-scoped; no cross-version data leakage

---

## 6. Data Model Changes

### DiscountPolicy Schema Migration

**Current schema** (`apps/api/prisma/schema.prisma` lines 626-645):

```prisma
model DiscountPolicy {
  id           Int      @id @default(autoincrement())
  versionId    Int      @map("version_id")
  tariff       String   @db.VarChar(10)
  nationality  String?  @db.VarChar(10)    // DROP THIS
  discountRate Decimal  @map("discount_rate") @db.Decimal(7, 6)
  // ... audit fields ...

  @@unique([versionId, tariff, nationality], map: "uq_discount_policy")       // CHANGE
  @@index([versionId, tariff, nationality], map: "idx_discount_policies_calc") // CHANGE
}
```

**Target schema:**

```prisma
model DiscountPolicy {
  id           Int      @id @default(autoincrement())
  versionId    Int      @map("version_id")
  tariff       String   @db.VarChar(10)
  discountRate Decimal  @map("discount_rate") @db.Decimal(7, 6)
  // ... audit fields unchanged ...

  @@unique([versionId, tariff], map: "uq_discount_policy")
  @@index([versionId, tariff], map: "idx_discount_policies_calc")
}
```

**Migration steps:**

1. Pre-migration assertion:
   `SELECT COUNT(*) FROM discount_policies WHERE nationality IS NOT NULL` must return 0
2. Drop existing unique constraint `uq_discount_policy`
3. Drop existing index `idx_discount_policies_calc`
4. Drop `nationality` column
5. Add new unique constraint on `(version_id, tariff)`
6. Add new index on `(version_id, tariff)`

If the pre-migration assertion fails, the migration aborts with an error message instructing the
operator to manually consolidate nationality-specific discount rows before retrying.

**No other schema changes.** All other revenue tables (fee_grids, other_revenue_items,
monthly_revenue, monthly_other_revenue) remain unchanged.

---

## 7. API Contracts

### 7.1. New Endpoints

#### GET `/api/v1/versions/:versionId/revenue/readiness`

| Property | Value                                       |
| -------- | ------------------------------------------- |
| RBAC     | All authenticated (`app.authenticate` only) |
| Params   | `versionId: integer (positive)`             |
| Query    | None                                        |

**Response 200:**

```json
{
    "feeGrid": {
        "total": 90,
        "complete": 45,
        "ready": false
    },
    "tariffAssignment": {
        "reconciled": true,
        "ready": true
    },
    "discounts": {
        "rpRate": "0.250000",
        "r3Rate": "0.100000",
        "ready": true
    },
    "otherRevenue": {
        "total": 20,
        "configured": 20,
        "ready": true
    },
    "overallReady": false,
    "readyCount": 3,
    "totalCount": 4
}
```

**Area check logic:**

| Area             | Query                                                                                       | Ready When              |
| ---------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| feeGrid          | `COUNT(*)` from fee_grids WHERE versionId, then `COUNT(*)` WHERE tuitionHt IS NOT NULL      | complete == total       |
| tariffAssignment | Check enrollment_details exist and tariff weights reconcile                                 | reconciled == true      |
| discounts        | `SELECT` discount_policies WHERE versionId AND tariff IN ('RP','R3+')                       | Both rates non-null > 0 |
| otherRevenue     | `COUNT(*)` from other_revenue_items WHERE versionId, then `COUNT(*)` WHERE annualAmount > 0 | configured == total     |

**Error responses:**

| Status | Code              | When                 |
| ------ | ----------------- | -------------------- |
| 404    | VERSION_NOT_FOUND | Version ID not found |

### 7.2. Modified Endpoints

#### PUT `/api/v1/versions/:versionId/discounts` (MODIFIED)

**Changes:**

- Remove `nationality` from request body schema (`discountEntrySchema`)
- Remove `nationality` from upsert `where` clause (change from
  `versionId_tariff_nationality` to `versionId_tariff`)
- Remove `nationality` from `create` data
- Remove `nationality` from `orderBy` in GET handler

**New request body schema:**

```typescript
const discountEntrySchema = z.object({
    tariff: z.enum(['RP', 'R3+']),
    discountRate: z.string().regex(/^\d+(\.\d{1,6})?$/),
});
```

**Validation:** Reject requests that include a `nationality` field (Zod strict mode or
`.strip()` to silently remove).

#### POST `/api/v1/versions/:versionId/calculate/revenue` (MODIFIED)

**Changes:** After successful calculation, add STAFFING and PNL to `version.staleModules`
(in addition to existing behavior of removing REVENUE).

**Current behavior** (`calculate.ts` line 177-178):

```typescript
currentStale.delete('REVENUE');
```

**New behavior:**

```typescript
currentStale.delete('REVENUE');
currentStale.add('STAFFING');
currentStale.add('PNL');
```

### 7.3. Existing Unchanged Endpoints

| Method | Path                                 | Notes                                                                    |
| ------ | ------------------------------------ | ------------------------------------------------------------------------ |
| GET    | `/versions/:versionId/fee-grid`      | No changes                                                               |
| PUT    | `/versions/:versionId/fee-grid`      | No changes                                                               |
| GET    | `/versions/:versionId/other-revenue` | No changes                                                               |
| PUT    | `/versions/:versionId/other-revenue` | No changes                                                               |
| GET    | `/versions/:versionId/revenue`       | No changes — frontend consumes `executiveSummary.rows` for Category view |
| GET    | `/versions/:versionId/discounts`     | Remove nationality from response mapping                                 |

---

## 8. Shared Types

### Modified Types (`packages/types/src/revenue.ts`)

#### DiscountEntry (MODIFIED)

```typescript
// BEFORE:
export interface DiscountEntry {
    tariff: 'RP' | 'R3+';
    nationality: 'Francais' | 'Nationaux' | 'Autres' | null;
    discountRate: string;
}

// AFTER:
export interface DiscountEntry {
    tariff: 'RP' | 'R3+';
    discountRate: string;
}
```

### New Types

#### RevenueReadinessResponse

```typescript
export interface RevenueReadinessAreaStatus {
    ready: boolean;
}

export interface FeeGridReadiness extends RevenueReadinessAreaStatus {
    total: number;
    complete: number;
}

export interface TariffAssignmentReadiness extends RevenueReadinessAreaStatus {
    reconciled: boolean;
}

export interface DiscountReadiness extends RevenueReadinessAreaStatus {
    rpRate: string | null;
    r3Rate: string | null;
}

export interface OtherRevenueReadiness extends RevenueReadinessAreaStatus {
    total: number;
    configured: number;
}

export interface RevenueReadinessResponse {
    feeGrid: FeeGridReadiness;
    tariffAssignment: TariffAssignmentReadiness;
    discounts: DiscountReadiness;
    otherRevenue: OtherRevenueReadiness;
    overallReady: boolean;
    readyCount: number;
    totalCount: 4;
}
```

#### RevenueViewMode

```typescript
export type RevenueViewMode = 'category' | 'grade' | 'nationality' | 'tariff';
```

#### RevenueSettingsTab

```typescript
export type RevenueSettingsTab = 'feeGrid' | 'tariffAssignment' | 'discounts' | 'otherRevenue';
```

### Existing Types (No Changes)

These types are already correct and need no modification:

- `RevenueMatrixRow` — used for both `revenueEngine.rows` and `executiveSummary.rows`
- `RevenueExecutiveSummary` — contains `rows`, `composition`, `monthlyTrend`
- `RevenueResultsResponse` — contains `executiveSummary` field used by Category view
- `FeeGridEntry`, `OtherRevenueItem`, `MonthlyRevenueEntry` — unchanged

---

## 9. Frontend Architecture

### 9.1. Component Tree

```text
RevenuePage (rewrite)
├── VersionLockBanner (reuse)
├── ImportedBanner (reuse)
├── ViewerBanner (reuse)
├── Toolbar
│   ├── ToggleGroup (view mode)
│   ├── ToggleGroup (period)
│   ├── ExportButton (reuse)
│   ├── Button (Revenue Settings / View Settings)
│   ├── Button (Setup)
│   └── CalculateButton (reuse pattern)
├── RevenueKpiRibbon (modify: 4 → 5 cards)
├── RevenueStatusStrip (new)
├── ForecastGrid (new)
│   └── TanStack Table v8
└── RightPanel (existing shell)
    └── RevenueInspector (new, registered via right-panel-registry)

RevenueSettingsDialog (new, portal)
├── DialogOverlay
├── Left sidebar (tab navigation)
└── Tab content area
    ├── FeeGridTab (reuse, wrapped)
    ├── TariffAssignmentGrid (reuse, wrapped)
    ├── DiscountsTab (reuse, modified — no nationality)
    └── OtherRevenueTab (reuse, wrapped)

SetupChecklist (new, overlay)
├── 4 area status rows
├── [Edit] deep-links
└── [Skip for Now] / [Open Settings]
```

### 9.2. Component Inventory

| Component             | File                                             | Action  | Lines (est.)       |
| --------------------- | ------------------------------------------------ | ------- | ------------------ |
| RevenuePage           | `pages/planning/revenue.tsx`                     | Rewrite | ~400               |
| ForecastGrid          | `components/revenue/forecast-grid.tsx`           | Create  | ~200               |
| RevenueInspector      | `components/revenue/revenue-inspector.tsx`       | Create  | ~200               |
| RevenueSettingsDialog | `components/revenue/revenue-settings-dialog.tsx` | Create  | ~300               |
| SetupChecklist        | `components/revenue/setup-checklist.tsx`         | Create  | ~120               |
| RevenueStatusStrip    | `components/revenue/revenue-status-strip.tsx`    | Create  | ~80                |
| RevenueKpiRibbon      | `components/revenue/kpi-ribbon.tsx`              | Modify  | ~120 (was 80)      |
| DiscountsTab          | `components/revenue/discounts-tab.tsx`           | Modify  | Remove nationality |
| FeeGridTab            | `components/revenue/fee-grid-tab.tsx`            | Reuse   | No changes         |
| TariffAssignmentGrid  | `components/revenue/tariff-assignment-grid.tsx`  | Reuse   | No changes         |
| OtherRevenueTab       | `components/revenue/other-revenue-tab.tsx`       | Reuse   | No changes         |

**Deleted components:** None. `WorkspaceBoard` and `WorkspaceBlock` are shared components used by
other pages — only removed from revenue imports.

### 9.3. Zustand Stores

#### `revenue-selection-store.ts` (new)

```typescript
interface RevenueSelectionState {
    selectedRow: { label: string; viewMode: RevenueViewMode } | null;
    selectRow: (label: string, viewMode: RevenueViewMode) => void;
    clearSelection: () => void;
}
```

#### `revenue-settings-dialog-store.ts` (new)

```typescript
interface RevenueSettingsDialogState {
    isOpen: boolean;
    activeTab: RevenueSettingsTab;
    open: (tab?: RevenueSettingsTab) => void;
    close: () => void;
    setTab: (tab: RevenueSettingsTab) => void;
}
```

#### `revenue-settings-dirty-store.ts` (new)

```typescript
interface RevenueSettingsDirtyState {
    dirtyFields: Map<RevenueSettingsTab, Set<string>>;
    markDirty: (tab: RevenueSettingsTab, fieldId: string) => void;
    clearTab: (tab: RevenueSettingsTab) => void;
    clearAll: () => void;
    isTabDirty: (tab: RevenueSettingsTab) => boolean;
    isAnyDirty: () => boolean;
    getDirtyTabs: () => RevenueSettingsTab[];
}
```

### 9.4. Hooks

#### New Hooks (`use-revenue.ts`)

```typescript
// New: Readiness query
export function useRevenueReadiness(versionId: number | null) {
    return useQuery({
        queryKey: ['revenue', 'readiness', versionId],
        queryFn: () =>
            apiClient<RevenueReadinessResponse>(`/versions/${versionId}/revenue/readiness`),
        enabled: versionId !== null,
    });
}
```

#### Modified Hooks

```typescript
// MODIFIED: Add 'category' to groupBy union (for type safety, though category view
// consumes executiveSummary.rows directly and does not call this hook)
export function useRevenueResults(
    versionId: number | null,
    groupBy: 'month' | 'grade' | 'nationality' | 'tariff' | 'category' = 'month'
);
```

**Note:** When `groupBy === 'category'`, the hook is NOT called. The ForecastGrid component
reads `executiveSummary.rows` from the `useRevenueResults(versionId, 'month')` response instead.
The `'category'` value exists in the union type solely for type-safe view mode tracking.

### 9.5. Routing

**No route changes.** The route remains `/planning/revenue` under PlanningShell. The router
configuration is unchanged.

### 9.6. Right Panel Registration

In `apps/web/src/components/revenue/revenue-inspector.tsx`:

```typescript
import { registerPanelContent } from '../../lib/right-panel-registry';

registerPanelContent('revenue', () => <RevenueInspector />);
```

In `revenue.tsx` (on mount):

```typescript
useEffect(() => {
    setActivePage('revenue');
    return () => setActivePage(null);
}, [setActivePage]);
```

---

## 10. Component Specifications

### 10.1. ForecastGrid

**Props:**

```typescript
interface ForecastGridProps {
    versionId: number;
    viewMode: RevenueViewMode;
    period: 'AY1' | 'AY2' | 'both';
}
```

**Behavior:**

- TanStack Table v8 with 15 columns (label + 12 months + annual + % of rev)
- Category view: renders `executiveSummary.rows` directly (no API call, data from parent query)
- Grade/Nationality/Tariff views: renders from `useRevenueResults(versionId, viewMode)`
- Grade view: frontend groups rows by band using `GRADE_BAND_MAP`, computes subtotals
- Period toggle: hides columns outside range (AY1=months 1-6, AY2=months 9-12, both=all 12)
- Row selection: clicking a row updates `revenue-selection-store`
- Grand total row: sticky bottom, muted bg, font-weight 700
- Formatting: fr-FR locale, parentheses for negatives, dash for zeros, monospace

**Accessibility:**

- `role="grid"` on table element
- Arrow key navigation between cells
- Selected row announced via `aria-selected`
- Grand total row has `aria-label="Grand total"`

### 10.2. RevenueInspector

**Props:** None (reads from stores and hooks internally)

**Behavior:**

- Reads `selectedRow` from `revenue-selection-store`
- Default view (no selection): composition chart, monthly trend chart, readiness checklist,
  quick links
- Active view (row selected): header with label + FY total, breakdowns by OTHER dimensions,
  monthly sparkline, "Edit in Settings" links
- Charts: Recharts `<BarChart>` for monthly trend, `<PieChart>` or stacked `<BarChart>` for
  composition
- "Edit in Settings" deep-links: calls `useRevenueSettingsDialogStore().open(tab)`

### 10.3. RevenueSettingsDialog

**Props:**

```typescript
interface RevenueSettingsDialogProps {
    versionId: number;
    isViewer: boolean;
}
```

**Behavior:**

- Fullscreen dialog (~90% viewport width/height)
- Left sidebar with 4 tab buttons, active tab highlighted
- Tab content renders the wrapped existing component for the active tab
- Per-tab save: each tab's [Save] calls the appropriate PUT endpoint and clears its dirty set
- Tab switch warning: if departing tab is dirty, inline banner with [Stay] / [Switch]
- Close confirmation: if any tab is dirty, dialog with [Cancel] / [Discard]
- Viewer mode: all inputs disabled, save buttons hidden, ViewerBanner shown

**Accessibility:**

- `role="dialog"` with `aria-label="Revenue Settings"` and `aria-modal="true"`
- Focus trap: Tab key cycles within dialog, Escape closes (with dirty check)
- Tab navigation: `role="tablist"`, `role="tab"`, `role="tabpanel"`
- On close: return focus to the element that opened the dialog

### 10.4. SetupChecklist

**Props:**

```typescript
interface SetupChecklistProps {
    versionId: number;
    isViewer: boolean;
    onDismiss: () => void;
}
```

**Behavior:**

- Consumes `useRevenueReadiness(versionId)`
- Shows 4 area rows with status (complete/incomplete) and detail text
- [Edit] buttons deep-link to settings dialog tab (read-only if viewer)
- Auto-opens on first version visit if: readiness is incomplete AND version never calculated
- Dismissal stored in `sessionStorage` key `revenue-setup-dismissed-{versionId}`
- "N of 4 complete" footer with [Skip for Now] and [Open Settings] buttons

**Accessibility:**

- Focus moves to checklist heading on auto-open
- [Edit] buttons have descriptive labels: "Edit Fee Grid", "Edit Discounts", etc.
- Escape key dismisses the checklist

### 10.5. RevenueStatusStrip

**Props:**

```typescript
interface RevenueStatusStripProps {
    lastCalculated: string | null;
    enrollmentStale: boolean;
    downstreamStale: string[];
    readiness: RevenueReadinessResponse | undefined;
}
```

**Behavior:**

- 4 inline elements separated by `|` dividers
- Last calculated: formatted with `date-fns` + Arabia Standard Time
- Upstream: checks enrollment stale status from version's `staleModules`
- Downstream: lists STAFFING/PNL if present in staleModules
- Config: summarizes readiness (e.g., "45/45 fees, RP 25%/R3+ 10%, 20/20 items")

**Accessibility:**

- `role="status"` for live updates
- `aria-live="polite"` for status changes

### 10.6. RevenueKpiRibbon (Modified)

**Current:** 4 cards (Gross HT, Discounts, Net Revenue, Avg/Student)

**New:** 5 cards with accent borders and improved data sources:

| #   | Label                   | Source                         | Accent  | Subtitle                           |
| --- | ----------------------- | ------------------------------ | ------- | ---------------------------------- |
| 1   | Gross Tuition HT        | `totals.grossRevenueHt`        | Blue    | YoY delta (if comparison)          |
| 2   | Total Discounts         | `totals.discountAmount`        | Red     | "X.X% of gross tuition"            |
| 3   | Net Revenue HT          | `totals.netRevenueHt`          | Green   | Headline number                    |
| 4   | Other Revenue           | `totals.otherRevenueAmount`    | Default | Sum of non-tuition categories      |
| 5   | Total Operating Revenue | `totals.totalOperatingRevenue` | Green   | Avg per student via `useHeadcount` |

**Props change:**

```typescript
// BEFORE:
interface RevenueKpiRibbonProps {
    grossHt: number;
    totalDiscounts: number;
    netRevenue: number;
    avgPerStudent: number;
    isStale: boolean;
}

// AFTER:
interface RevenueKpiRibbonProps {
    grossHt: string;
    totalDiscounts: string;
    netRevenue: string;
    otherRevenue: string;
    totalOperatingRevenue: string;
    avgPerStudent: string;
    isStale: boolean;
}
```

Values are now `string` (decimal.js format) to avoid floating-point precision loss. The component
uses `Decimal` for display rounding only.

---

## 11. Data Flow

### Cross-Module Data Dependencies

```text
ENROLLMENT MODULE                    REVENUE SETTINGS
+------------------+                +-------------------+
| Headcount (AY1)  |---+           | Fee Grid          |
| Headcount (AY2)  |   |           | Discount Policies |
| Nationality Brkdn|---+---->      | Other Revenue     |
| Tariff Assignment|   |    |      +--------+----------+
+------------------+   |    |               |
                       |    |               |
                       v    v               v
                  +------------------------------+
                  | REVENUE ENGINE (server-side)  |
                  | Headcount x TuitionHT / months|
                  | Apply discount rates           |
                  | Distribute other rev by method |
                  | Last-bucket rounding           |
                  +------------------------------+
                             |
                             v
                  +------------------------------+
                  | MAIN GRID + KPI + INSPECTOR  |
                  | (frontend, read-only display) |
                  +------------------------------+
                             |
                             v (staleModules)
                  +------------------------------+
                  | DOWNSTREAM: STAFFING + P&L    |
                  | marked stale after calculate  |
                  +------------------------------+
```

### User Workflow

1. Edit settings in dialog -> save -> REVENUE marked stale
2. Click Calculate Revenue -> engine runs server-side -> results persisted
3. Grid + KPIs refresh -> STAFFING + P&L marked stale downstream
4. Click any row -> inspector sidebar shows full breakdown

### Avg Per Student Data Source

The KPI card #5 subtitle shows `totalOperatingRevenue / headcount`. Headcount is obtained from:

```typescript
const { data: headcountData } = useHeadcount(versionId);
// Sum all AY1 entries to get total enrolled students
const totalStudents =
    headcountData?.entries
        .filter((e) => e.academicPeriod === 'AY1')
        .reduce((sum, e) => sum + e.headcount, 0) ?? 0;
```

This reuses the existing `useHeadcount` hook from `apps/web/src/hooks/use-enrollment.ts`.

---

## 12. Page Layout

```text
+------------------------------------------------------------------+----------+
| [BANNER: Version lock / Imported / Viewer-mode]                  |          |
+------------------------------------------------------------------+ RIGHT    |
| TOOLBAR                                                          | PANEL    |
|  Left:  [Category|Grade|Nat|Tariff]  [AY1|AY2|FY2026]           |          |
|  Right: [Export] [Revenue Settings] [Setup] [Calculate Revenue]  | INSPECTOR|
+------------------------------------------------------------------+          |
| KPI RIBBON                                                       |          |
| Gross Tuition HT | Discounts | Net Revenue | Other Rev | Total  |          |
+------------------------------------------------------------------+          |
| STATUS STRIP                                                     |          |
| Last calc: 14:32 | Enrollment: Fresh | Stale: Staffing, P&L     |          |
+==================================================================+          |
|                                                                   |          |
| REVENUE FORECAST MATRIX (compact, ~6-15 rows depending on view)  | Details  |
|                                                                   | for      |
| Revenue Category    | Jan  | Feb  |...| Dec  | Annual  | %Rev   | selected |
| Tuition Fees        | 5.8M | 5.8M |...| 6.0M | 59.0M   | 86.5%  | row      |
| Discount Impact     |(223K)|(223K)|...|(249K)| (2.3M)  | -3.4%  |          |
| Registration Fees   |    0 |    0 |...|    0 |  9.8M   | 14.4%  |          |
| Activities & Svc    | 126K | 126K |...| 152K |  1.3M   |  1.9%  |          |
| Examination Fees    |    0 |    0 |...|    0 |  395K   |  0.6%  |          |
|==================================================================|          |
| TOTAL OPERATING REV | 5.7M | 5.7M |...| 5.9M | 68.2M   |        |          |
+------------------------------------------------------------------+----------+
```

---

## 13. Story Breakdown

### Dependency DAG

```text
A1 ──→ A2 ──→ B1 ──→ C1 ──→ C2 ──→ C3 ──→ D1
                                            ↑
       A2 ──→ B2 ──→ C4 ──→ C5 ──→ C6 ──→ D1
                                            │
                                            ↓
                                           D2 ──→ D3
```

### Phase A — Data Foundation (2 stories)

#### A1: DiscountPolicy Schema Migration

**Scope:** Drop `nationality` column from `DiscountPolicy`, simplify unique constraint.

**Files:**

| File                                                             | Action                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                                  | Modify: remove nationality field, update @@unique and @@index |
| `apps/api/prisma/migrations/YYYYMMDD_drop_discount_nationality/` | Create: migration SQL                                         |
| `apps/api/src/routes/revenue/discounts.ts`                       | Modify: remove nationality from schema, upsert, orderBy       |
| `packages/types/src/revenue.ts`                                  | Modify: remove nationality from DiscountEntry                 |

**Acceptance Criteria:**

- [ ] AC-A1-01: Given a database with all DiscountPolicy rows having `nationality IS NULL`, when
      the migration runs, then the `nationality` column is dropped and the unique constraint changes
      to `(versionId, tariff)`.
- [ ] AC-A1-02: Given a database with any DiscountPolicy row having `nationality IS NOT NULL`,
      when the migration runs, then it aborts with an error message.
- [ ] AC-A1-03: Given the updated discount route, when PUT `/discounts` is called with
      `{ entries: [{ tariff: "RP", discountRate: "0.250000" }] }`, then the upsert succeeds using
      the `versionId_tariff` compound key.
- [ ] AC-A1-04: Given the updated discount route, when PUT `/discounts` is called with a body
      containing `nationality`, then the field is ignored (stripped by Zod).
- [ ] AC-A1-05: Given the updated GET `/discounts` endpoint, response entries do not include a
      `nationality` field.
- [ ] AC-A1-06: `pnpm typecheck` passes with no errors related to DiscountEntry or nationality.

#### A2: Shared Types + Revenue Readiness Endpoint

**Scope:** Add `RevenueReadinessResponse` type and implement the readiness endpoint.

**Files:**

| File                                       | Action                                                      |
| ------------------------------------------ | ----------------------------------------------------------- |
| `packages/types/src/revenue.ts`            | Modify: add RevenueReadinessResponse and related interfaces |
| `apps/api/src/routes/revenue/readiness.ts` | Create: GET readiness endpoint                              |
| `apps/api/src/routes/revenue/index.ts`     | Modify: register readiness route                            |
| `apps/web/src/hooks/use-revenue.ts`        | Modify: add useRevenueReadiness hook                        |

**Acceptance Criteria:**

- [ ] AC-A2-01: Given a version with all 4 areas complete, when GET
      `/versions/:id/revenue/readiness` is called, then `overallReady: true` and `readyCount: 4`.
- [ ] AC-A2-02: Given a version with no data configured, when GET readiness is called, then
      `overallReady: false` and `readyCount: 0`.
- [ ] AC-A2-03: Given a version with only discounts and other revenue configured, when GET
      readiness is called, then `readyCount: 2` with `feeGrid.ready: false` and
      `tariffAssignment.ready: false`.
- [ ] AC-A2-04: Given a non-existent versionId, when GET readiness is called, then 404
      `VERSION_NOT_FOUND` is returned.
- [ ] AC-A2-05: Given any authenticated user (including Viewer), GET readiness succeeds (no RBAC
      restriction beyond authentication).
- [ ] AC-A2-06: Readiness endpoint responds in < 200ms for a version with ~90 fee grid rows.
- [ ] AC-A2-07: The `useRevenueReadiness` hook returns typed `RevenueReadinessResponse` data and
      is enabled only when `versionId !== null`.

### Phase B — Backend Changes (2 stories)

#### B1: Revenue Calculate — Downstream Stale Marking

**Scope:** After successful revenue calculation, mark STAFFING and PNL as stale downstream.

**Files:**

| File                                       | Action                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `apps/api/src/routes/revenue/calculate.ts` | Modify: add STAFFING + PNL to staleModules after clearing REVENUE |

**Acceptance Criteria:**

- [ ] AC-B1-01: Given a version with REVENUE in staleModules, when POST `calculate/revenue`
      succeeds, then staleModules contains STAFFING and PNL but not REVENUE.
- [ ] AC-B1-02: Given a version with no stale modules, when POST `calculate/revenue` succeeds,
      then staleModules contains exactly STAFFING and PNL.
- [ ] AC-B1-03: Given a version that already has STAFFING in staleModules (from a prior
      calculation), when POST `calculate/revenue` succeeds, then staleModules still contains
      STAFFING and PNL (idempotent add).
- [ ] AC-B1-04: The calculation audit log records `status: 'COMPLETED'` with correct
      `outputSummary`.

#### B2: Revenue Results — Category View Support + Recharts Dependency

**Scope:** Verify `executiveSummary.rows` shape is correct for Category view. Add `recharts`
dependency.

**Files:**

| File                    | Action                            |
| ----------------------- | --------------------------------- |
| `apps/web/package.json` | Modify: add `recharts` dependency |

**Acceptance Criteria:**

- [ ] AC-B2-01: Given a version with calculated revenue, when GET
      `/versions/:id/revenue?group_by=month` is called, then `executiveSummary.rows` contains
      6 `RevenueMatrixRow` objects (5 categories + grand total).
- [ ] AC-B2-02: Each `RevenueMatrixRow` in `executiveSummary.rows` has `monthlyAmounts` array
      of length 12, `annualTotal` string, `percentageOfRevenue` string, and `isTotal` boolean.
- [ ] AC-B2-03: The grand total row (last row, `isTotal: true`) has `annualTotal` matching
      `totals.totalOperatingRevenue`.
- [ ] AC-B2-04: `recharts` is installed and importable in `apps/web`.

### Phase C — Frontend Components (6 stories)

#### C1: Zustand Stores + Updated Hooks

**Scope:** Create 3 new Zustand stores and update `useRevenueResults` type.

**Files:**

| File                                                   | Action                                    |
| ------------------------------------------------------ | ----------------------------------------- |
| `apps/web/src/stores/revenue-selection-store.ts`       | Create                                    |
| `apps/web/src/stores/revenue-settings-dialog-store.ts` | Create                                    |
| `apps/web/src/stores/revenue-settings-dirty-store.ts`  | Create                                    |
| `apps/web/src/hooks/use-revenue.ts`                    | Modify: add `'category'` to groupBy union |

**Acceptance Criteria:**

- [ ] AC-C1-01: `revenue-selection-store` exports `useRevenueSelectionStore` with `selectRow`,
      `clearSelection`, and `selectedRow` state.
- [ ] AC-C1-02: `revenue-settings-dialog-store` exports `useRevenueSettingsDialogStore` with
      `open(tab?)`, `close`, `setTab`, `isOpen`, and `activeTab` state.
- [ ] AC-C1-03: `revenue-settings-dirty-store` exports `useRevenueSettingsDirtyStore` with
      `markDirty`, `clearTab`, `clearAll`, `isTabDirty`, `isAnyDirty`, and `getDirtyTabs`.
- [ ] AC-C1-04: `useRevenueResults` accepts `'category'` in its `groupBy` parameter type.
- [ ] AC-C1-05: `pnpm typecheck` passes with zero errors.

#### C2: Revenue Forecast Grid

**Scope:** Create the main forecast grid component with 4 view modes.

**Files:**

| File                                                | Action              |
| --------------------------------------------------- | ------------------- |
| `apps/web/src/components/revenue/forecast-grid.tsx` | Create (~200 lines) |

**Acceptance Criteria:**

- [ ] AC-C2-01: Category view renders 6 rows (5 IFRS categories + grand total) from
      `executiveSummary.rows`.
- [ ] AC-C2-02: Grade view renders ~15 rows grouped by band with band subtotal rows.
- [ ] AC-C2-03: Nationality view renders 4 rows (3 nationalities + total).
- [ ] AC-C2-04: Tariff view renders 4 rows (3 tariffs + total).
- [ ] AC-C2-05: Period toggle AY1 shows only Jan-Jun columns; AY2 shows only Sep-Dec; FY shows
      all 12.
- [ ] AC-C2-06: Negative values display in parentheses with error color.
- [ ] AC-C2-07: Zero values in summer months display as dash (`-`) in muted text.
- [ ] AC-C2-08: Grand total row has muted background, font-weight 700, and is sticky at bottom.
- [ ] AC-C2-09: Clicking a row updates `revenue-selection-store` with the row label and view mode.
- [ ] AC-C2-10: Formatting uses fr-FR locale with thousands separators and 0 decimal places.
- [ ] AC-C2-11: Grid has `role="grid"` and supports arrow key navigation.

#### C3: Revenue Inspector + Right Panel

**Scope:** Create the inspector component and register it in the right panel.

**Files:**

| File                                                    | Action                                          |
| ------------------------------------------------------- | ----------------------------------------------- |
| `apps/web/src/components/revenue/revenue-inspector.tsx` | Create (~200 lines)                             |
| `apps/web/src/lib/right-panel-registry.ts`              | No change (registration via side-effect import) |

**Acceptance Criteria:**

- [ ] AC-C3-01: When no row is selected, inspector shows default view: composition chart, monthly
      trend chart, readiness checklist, quick links.
- [ ] AC-C3-02: When a row is selected, inspector shows active view: header with label + FY
      total, breakdowns by OTHER dimensions, monthly sparkline.
- [ ] AC-C3-03: "Edit in Settings" shortcuts open the settings dialog to the correct tab.
- [ ] AC-C3-04: Composition chart renders using Recharts `<BarChart>` or `<PieChart>`.
- [ ] AC-C3-05: Monthly trend renders using Recharts `<BarChart>` with 12 bars.
- [ ] AC-C3-06: When `activePage === 'revenue'`, the right panel Details tab renders
      RevenueInspector.

#### C4: Revenue Status Strip + KPI Ribbon Update

**Scope:** Create status strip component and update KPI ribbon from 4 to 5 cards.

**Files:**

| File                                                       | Action                             |
| ---------------------------------------------------------- | ---------------------------------- |
| `apps/web/src/components/revenue/revenue-status-strip.tsx` | Create (~80 lines)                 |
| `apps/web/src/components/revenue/kpi-ribbon.tsx`           | Modify: 4 -> 5 cards, string props |

**Acceptance Criteria:**

- [ ] AC-C4-01: KPI ribbon shows 5 cards: Gross Tuition HT (blue), Discounts (red), Net Revenue
      (green), Other Revenue (default), Total Operating Revenue (green).
- [ ] AC-C4-02: Card #5 subtitle shows "SAR X avg/student" computed from
      `totalOperatingRevenue / headcount`.
- [ ] AC-C4-03: When `isStale`, all cards show `opacity-60` and pulsing amber dot.
- [ ] AC-C4-04: Status strip shows 4 elements: last calculated, upstream enrollment status,
      downstream stale modules, configuration status.
- [ ] AC-C4-05: Status strip has `role="status"` and `aria-live="polite"`.

#### C5: Revenue Setup Checklist

**Scope:** Create the non-linear setup checklist overlay.

**Files:**

| File                                                  | Action              |
| ----------------------------------------------------- | ------------------- |
| `apps/web/src/components/revenue/setup-checklist.tsx` | Create (~120 lines) |

**Acceptance Criteria:**

- [ ] AC-C5-01: Checklist shows 4 areas with correct status from readiness endpoint.
- [ ] AC-C5-02: Auto-opens on first version visit if any area is incomplete AND version has never
      been calculated.
- [ ] AC-C5-03: Dismissal is stored in `sessionStorage` with key
      `revenue-setup-dismissed-{versionId}`.
- [ ] AC-C5-04: [Edit] buttons deep-link to the correct settings dialog tab.
- [ ] AC-C5-05: Footer shows "N of 4 complete" count.
- [ ] AC-C5-06: Viewer mode: [Edit] opens read-only settings dialog.
- [ ] AC-C5-07: Focus moves to checklist heading on auto-open; Escape dismisses.

#### C6: Revenue Settings Dialog

**Scope:** Create the fullscreen settings dialog with 4 tabs and dirty tracking.

**Files:**

| File                                                          | Action              |
| ------------------------------------------------------------- | ------------------- |
| `apps/web/src/components/revenue/revenue-settings-dialog.tsx` | Create (~300 lines) |

**Acceptance Criteria:**

- [ ] AC-C6-01: Dialog opens at ~90% viewport with left sidebar tab navigation.
- [ ] AC-C6-02: 4 tabs render their wrapped components: FeeGridTab, TariffAssignmentGrid,
      DiscountsTab (no nationality), OtherRevenueTab.
- [ ] AC-C6-03: Per-tab save: clicking [Save] on a tab calls the appropriate PUT endpoint and
      clears that tab's dirty set, then marks REVENUE stale.
- [ ] AC-C6-04: Tab switch with dirty state shows inline warning banner with [Stay] / [Switch].
- [ ] AC-C6-05: Close with any dirty tab shows confirmation dialog with [Cancel] / [Discard].
- [ ] AC-C6-06: Viewer mode: all inputs disabled, save buttons hidden, ViewerBanner shown at top.
- [ ] AC-C6-07: Focus trap active when dialog is open; Escape triggers close (with dirty check).
- [ ] AC-C6-08: Dialog uses `role="dialog"`, `aria-modal="true"`,
      `aria-label="Revenue Settings"`.
- [ ] AC-C6-09: Tabs use `role="tablist"`, `role="tab"`, `role="tabpanel"` with proper
      `aria-selected` and `aria-controls`.

### Phase D — Assembly & Testing (3 stories)

#### D1: Revenue Page Rewrite

**Scope:** Replace the current `WorkspaceBoard`-based page with the full workspace layout.

**Files:**

| File                                      | Action               |
| ----------------------------------------- | -------------------- |
| `apps/web/src/pages/planning/revenue.tsx` | Rewrite (~400 lines) |

**Acceptance Criteria:**

- [ ] AC-D1-01: Page layout matches Section 12: banners at top, toolbar, KPI ribbon, status
      strip, forecast grid + inspector side panel.
- [ ] AC-D1-02: `setActivePage('revenue')` is called on mount; cleared on unmount.
- [ ] AC-D1-03: Toolbar contains: view toggle (4 modes), period toggle (AY1/AY2/FY), Export,
      Revenue Settings, Setup, Calculate.
- [ ] AC-D1-04: Calculate button hidden for Viewer role; Settings button shows "View Settings".
- [ ] AC-D1-05: Version banners (VersionLockBanner, ImportedBanner, ViewerBanner) render
      correctly based on version state and user role.
- [ ] AC-D1-06: Export generates CSV/XLSX of the current grid view data.
- [ ] AC-D1-07: No references to `WorkspaceBoard` or `WorkspaceBlock` remain in revenue.tsx.
- [ ] AC-D1-08: Page renders the no-version-selected state when `versionId` is null.

#### D2: Backend + Frontend Test Suites

**Scope:** Comprehensive test coverage for all new and modified code.

**Files:**

| File                                                               | Action                            |
| ------------------------------------------------------------------ | --------------------------------- |
| `apps/api/src/routes/revenue/readiness.test.ts`                    | Create                            |
| `apps/api/src/routes/revenue/discounts.test.ts`                    | Modify: update for no-nationality |
| `apps/web/src/components/revenue/forecast-grid.test.tsx`           | Create                            |
| `apps/web/src/components/revenue/revenue-inspector.test.tsx`       | Create                            |
| `apps/web/src/components/revenue/revenue-settings-dialog.test.tsx` | Create                            |
| `apps/web/src/components/revenue/setup-checklist.test.tsx`         | Create                            |
| `apps/web/src/components/revenue/kpi-ribbon.test.tsx`              | Create                            |

**Acceptance Criteria:**

- [ ] AC-D2-01: Backend: readiness endpoint tests cover all-complete, empty, and partial states.
- [ ] AC-D2-02: Backend: discount route tests verify upsert without nationality and rejection of
      nationality field.
- [ ] AC-D2-03: Frontend: forecast grid tests verify 4 view modes render correct row counts.
- [ ] AC-D2-04: Frontend: inspector tests verify default and active views.
- [ ] AC-D2-05: Frontend: settings dialog tests verify 4 tabs render, dirty tracking, and viewer
      mode.
- [ ] AC-D2-06: Frontend: setup checklist tests verify auto-open, sessionStorage dismissal, and
      deep-links.
- [ ] AC-D2-07: Frontend: KPI ribbon tests verify 5 cards with correct values and stale state.
- [ ] AC-D2-08: Integration: settings edit -> calculate -> grid refresh verified.
- [ ] AC-D2-09: Coverage >= 80% for all new files.

#### D3: Fixture Regeneration + Spec Update

**Scope:** Update fixtures and documentation to reflect the redesign decisions.

**Files:**

| File                                         | Action                          |
| -------------------------------------------- | ------------------------------- |
| `data/fixtures/fy2026-expected-revenue.json` | Regenerate from Section 15 data |
| `docs/ui-ux-spec/04-revenue.md`              | Update with supersession note   |

**Acceptance Criteria:**

- [ ] AC-D3-01: Fixture file contains correct monthly amounts matching Section 15 validation
      data.
- [ ] AC-D3-02: Discount fixtures omit nationality field.
- [ ] AC-D3-03: UI spec doc includes supersession note referencing this Epic specification.
- [ ] AC-D3-04: `pnpm lint:md` passes on updated docs.

---

## 14. Test Strategy

**Target:** 80% coverage minimum (per CLAUDE.md). All tests use Vitest.

### Backend Tests

| Area                     | Test File           | Key Scenarios                                                          |
| ------------------------ | ------------------- | ---------------------------------------------------------------------- |
| Readiness endpoint       | `readiness.test.ts` | All-complete returns 4/4; empty returns 0/4; partial states            |
| Discount simplification  | `discounts.test.ts` | Upsert with tariff-only key; reject/strip nationality                  |
| Downstream stale marking | `calculate.test.ts` | STAFFING + PNL added; REVENUE removed; idempotent                      |
| Migration                | Migration test      | Pre-assertion blocks on non-null nationality; clean migration succeeds |

### Frontend Tests

| Area                  | Test File                          | Key Scenarios                                       |
| --------------------- | ---------------------------------- | --------------------------------------------------- |
| ForecastGrid          | `forecast-grid.test.tsx`           | 4 view modes, row counts, period toggle, formatting |
| RevenueInspector      | `revenue-inspector.test.tsx`       | Default vs active view, chart rendering, deep-links |
| RevenueSettingsDialog | `revenue-settings-dialog.test.tsx` | 4 tabs, dirty tracking, viewer mode, a11y           |
| SetupChecklist        | `setup-checklist.test.tsx`         | Auto-open, sessionStorage, [Edit] deep-links        |
| KPI Ribbon            | `kpi-ribbon.test.tsx`              | 5 cards, correct values, stale indicator            |
| Stores                | Store unit tests                   | Selection, dialog, dirty tracking state machines    |

### Accessibility Tests

- Keyboard navigation through forecast grid (arrow keys, Tab, Enter)
- Focus trap in settings dialog
- Screen reader announcements for KPI values and status strip updates
- ARIA roles verified on all interactive components

### Integration Scenarios

| Scenario                                   | What to Verify                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Settings edit -> Calculate -> Grid refresh | Stale indicator after save; clears after calculate; grid values update |
| Enrollment stale -> Revenue status strip   | "Enrollment: Stale" shown; calculate still works                       |
| Viewer role                                | Calculate hidden; settings read-only; checklist [Edit] opens read-only |
| Period toggle                              | AY1 = Jan-Jun; AY2 = Sep-Dec; FY = all 12                              |
| Setup checklist -> Settings deep-link      | Correct tab opens; checklist closes                                    |
| Downstream stale after calculate           | STAFFING + PNL in staleModules; status strip shows                     |

---

## 15. Validation Data (FY2026 Budget v3)

### Summary by IFRS Category

| IFRS Category           | FY2026 Total   | % of Rev   |
| ----------------------- | -------------- | ---------- |
| Tuition Fees            | 58,972,254     | 86.5%      |
| Discount Impact         | (2,333,713)    | -3.4%      |
| Registration Fees       | 9,810,050      | 14.4%      |
| Activities & Services   | 1,312,800      | 1.9%       |
| Examination Fees        | 394,800        | 0.6%       |
| **TOTAL OPERATING REV** | **68,156,191** | **100.0%** |

### Monthly Detail

| Month | Tuition   | Discounts | Registration | Activities | Exams   | Total Operating |
| ----- | --------- | --------- | ------------ | ---------- | ------- | --------------- |
| Jan   | 5,825,396 | (223,032) | 0            | 126,000    | 0       | 5,728,364       |
| Feb   | 5,825,396 | (223,032) | 0            | 126,000    | 0       | 5,728,364       |
| Mar   | 5,825,396 | (223,032) | 0            | 126,000    | 0       | 5,728,364       |
| Apr   | 5,825,396 | (223,032) | 0            | 126,000    | 189,900 | 5,918,264       |
| May   | 5,825,396 | (223,032) | 4,836,525    | 126,000    | 189,900 | 10,754,789      |
| Jun   | 5,825,396 | (223,032) | 4,836,525    | 126,000    | 0       | 10,564,889      |
| Jul   | 0         | 0         | 0            | 0          | 0       | 0               |
| Aug   | 0         | 0         | 0            | 0          | 0       | 0               |
| Sep   | 6,004,970 | (248,880) | 0            | 126,000    | 0       | 5,882,090       |
| Oct   | 6,004,970 | (248,880) | 68,500       | 126,000    | 7,500   | 5,958,090       |
| Nov   | 6,004,970 | (248,880) | 68,500       | 152,400    | 7,500   | 5,984,490       |
| Dec   | 6,004,970 | (248,880) | 0            | 152,400    | 0       | 5,908,490       |

### Tuition Breakdown by Band

| Band               | FY2026 Total | % of Tuition |
| ------------------ | ------------ | ------------ |
| Maternelle PS      | 1,954,349    | 3.3%         |
| Maternelle (MS+GS) | 6,397,197    | 10.8%        |
| Elementaire        | 20,010,530   | 33.9%        |
| College            | 17,129,430   | 29.0%        |
| Lycee              | 13,480,748   | 22.9%        |

### Discount Breakdown

| Period          | AY1 (Jan-Jun) | AY2 (Sep-Dec) | FY2026 Total |
| --------------- | ------------- | ------------- | ------------ |
| Discount Impact | (1,338,193)   | (995,520)     | (2,333,713)  |

### Registration Fee Line Items

| Line Item                      | Distribution     | FY2026 Total |
| ------------------------------ | ---------------- | ------------ |
| New Student Fees (Dossier+DPI) | May-Jun, Oct-Nov | 1,004,500    |
| Re-registration (DAI)          | May-Jun          | 8,737,050    |
| Evaluation Tests               | Oct-Nov          | 68,500       |

Source: `data/budgets/01_EFIR_Revenue_FY2026_v3.xlsx` — the revenue engine output must match these
numbers exactly. The existing fixture file `data/fixtures/fy2026-expected-revenue.json` is outdated
and must be regenerated from this budget.

### Internal Consistency Checks

- Tuition by band sum: 1,954,349 + 6,397,197 + 20,010,530 + 17,129,430 + 13,480,748 =
  **58,972,254** (matches IFRS Tuition Fees total)
- Monthly tuition sum: (5,825,396 x 6) + (6,004,970 x 4) = 34,952,376 + 24,019,880 =
  **58,972,256** (SAR 2 rounding vs 58,972,254 — within last-bucket tolerance)
- Monthly total operating sum: 5,728,364 + 5,728,364 + 5,728,364 + 5,918,264 + 10,754,789 +
  10,564,889 + 0 + 0 + 5,882,090 + 5,958,090 + 5,984,490 + 5,908,490 = **68,156,194**
  (SAR 3 rounding vs 68,156,191 — within last-bucket tolerance)
- Registration sum: 1,004,500 + 8,737,050 + 68,500 = **9,810,050** (matches IFRS total)
- Discount AY1 + AY2: 1,338,193 + 995,520 = **2,333,713** (matches IFRS total)

---

## 16. Decision Log

| #   | Decision           | Choice                             | Rationale                                                                                                                      |
| --- | ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Architecture model | Smart Forecast Grid                | Compact matrix as workspace; interactivity via view switching + inspector + settings                                           |
| D2  | Grid density       | Section headers only (~6 rows)     | Clean executive view; detail in sidebar inspector                                                                              |
| D3  | Settings surface   | Fullscreen tabbed dialog (4 tabs)  | Fee grid needs full viewport width; Parameters deferred to P&L Epic                                                            |
| D4  | Inspector content  | Rich multi-dimensional breakdown   | By band, nationality, tariff, student contribution, monthly trend                                                              |
| D5  | Override column    | None (v1)                          | Revenue is a pure calculation engine; no business case for manual overrides                                                    |
| D6  | Setup flow         | Non-linear checklist (4 areas)     | Config areas are independent; wizard forces unnecessary sequential traversal                                                   |
| D7  | Enrollment align   | Identical shell patterns           | Same toolbar, KPI, status strip, banners, inspector approach across modules                                                    |
| D8  | Nationality data   | Consumed from enrollment           | Already calculated in enrollment module; no duplication in revenue                                                             |
| D9  | VAT in main grid   | Excluded                           | VAT is a calculation detail, not a top-level IFRS category                                                                     |
| D10 | Discount model     | Per-tariff rates, drop nationality | CFO manages each tariff's discount separately; nationality dimension unused. Impact: 4 files across types/API/schema/migration |
| D11 | Comparison mode    | Not applicable                     | Inspector sidebar fulfills analysis role; clean executive grid prioritized                                                     |
| D12 | Category view      | Reuse `executiveSummary.rows`      | No backend change needed; frontend consumes existing response field                                                            |
| D13 | Charts library     | Recharts                           | Monthly trend bar chart + composition chart in inspector                                                                       |
| D14 | Stale cascade      | Add downstream marking             | Revenue calculate adds STAFFING + PNL to staleModules                                                                          |
| D15 | Grade subtotals    | Frontend grouping                  | No backend change; frontend groups by band with subtotals                                                                      |
| D16 | WorkspaceBoard     | Keep shared component              | Used by other pages; only remove from revenue imports                                                                          |

---

## Critical Files Summary

| File                                                          | Action  |
| ------------------------------------------------------------- | ------- |
| `apps/api/prisma/schema.prisma`                               | MODIFY  |
| `packages/types/src/revenue.ts`                               | MODIFY  |
| `apps/api/src/routes/revenue/discounts.ts`                    | MODIFY  |
| `apps/api/src/routes/revenue/readiness.ts`                    | CREATE  |
| `apps/api/src/routes/revenue/index.ts`                        | MODIFY  |
| `apps/api/src/routes/revenue/calculate.ts`                    | MODIFY  |
| `apps/web/src/pages/planning/revenue.tsx`                     | REWRITE |
| `apps/web/src/components/revenue/forecast-grid.tsx`           | CREATE  |
| `apps/web/src/components/revenue/revenue-inspector.tsx`       | CREATE  |
| `apps/web/src/components/revenue/revenue-settings-dialog.tsx` | CREATE  |
| `apps/web/src/components/revenue/setup-checklist.tsx`         | CREATE  |
| `apps/web/src/components/revenue/revenue-status-strip.tsx`    | CREATE  |
| `apps/web/src/components/revenue/kpi-ribbon.tsx`              | MODIFY  |
| `apps/web/src/components/revenue/discounts-tab.tsx`           | MODIFY  |
| `apps/web/src/hooks/use-revenue.ts`                           | MODIFY  |
| `apps/web/src/stores/revenue-selection-store.ts`              | CREATE  |
| `apps/web/src/stores/revenue-settings-dialog-store.ts`        | CREATE  |
| `apps/web/src/stores/revenue-settings-dirty-store.ts`         | CREATE  |
