# Staffing Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, planner-friendly guide
> to the Staffing planning page after the Epic 18-20 redesign (March 2026). It explains
> the business process, technical implementation, user actions, calculations, and data
> flow. It serves as a reference for budget planners, auditors, new developers, and
> business analysts.
>
> **Confidence labels used throughout**:
>
> - **[Confirmed]** — verified against source code
> - **[Inferred]** — derived from code patterns but not explicitly tested end-to-end
> - **[Needs Validation]** — requires user/domain expert confirmation

---

## Table of Contents

- [Part A: Review Summary (Old Document Audit)](#part-a-review-summary-old-document-audit)
- [1. Document Purpose](#1-document-purpose)
- [2. Executive Overview](#2-executive-overview)
- [3. Planner View — What This Page Means Operationally](#3-planner-view--what-this-page-means-operationally)
- [4. Page Context and Dependencies](#4-page-context-and-dependencies)
- [5. Current UI Walkthrough](#5-current-ui-walkthrough)
- [6. End-to-End User Workflow](#6-end-to-end-user-workflow)
- [7. Inputs Required](#7-inputs-required)
- [8. Calculations and Derived Logic](#8-calculations-and-derived-logic)
- [9. Database and Data Model](#9-database-and-data-model)
- [10. API and Data Flow](#10-api-and-data-flow)
- [11. Business Rules and Guardrails](#11-business-rules-and-guardrails)
- [12. Gaps Between Old Document and Actual Implementation](#12-gaps-between-old-document-and-actual-implementation)
- [13. Recommended Documentation Improvements](#13-recommended-documentation-improvements)
- [14. Appendix](#14-appendix)

---

## Part A: Review Summary (Old Document Audit)

The previous version of this document (v1.0, 2026-03-10) was written as a baseline draft
before the Epic 18-20 redesign. This section summarizes what was correct, what was wrong,
and what was entirely missing.

### What Was Correct

1. URL route `/planning/staffing` and page file location
   (`apps/web/src/pages/planning/staffing.tsx`) [Confirmed]
2. RBAC model with 4 roles (Admin, BudgetOwner, Editor, Viewer) and permission-gated
   access [Confirmed]
3. Enrollment as an upstream dependency concept [Confirmed]
4. EoS formula structure uses a tiered model at the 5-year mark [Confirmed]
5. Audit trail via `CalculationAuditLog` [Confirmed]
6. Version lock rule: non-Draft versions are read-only [Confirmed]
7. Salary encryption via pgcrypto with Docker secret key [Confirmed]
8. YEARFRAC US 30/360 convention for EoS [Confirmed]

### What Was Wrong

| #   | Old Claim                                                                            | Actual Implementation                                                                     | Source                            |
| --- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | 6 tabs (Roster, DHG Req, DHG Grille, Costs by Dept, Monthly Summary, Monthly Budget) | 2 workspace modes: Teaching / Support & Admin                                             | `staffing.tsx:51,220-228`         |
| 2   | Employee status: Active / Pending / Inactive                                         | Existing / New / Departed                                                                 | `cost-engine.ts:19,101`           |
| 3   | GOSI rate 12%                                                                        | 11.75% (Saudi only)                                                                       | `cost-engine.ts:7`                |
| 4   | Salary: Base + Housing + Transport + Food + Other                                    | Base + Housing + Transport + ResponsibilityPremium + HSA + Augmentation                   | `monthly-gross.ts:3-10`           |
| 5   | DHG Grille editable per-grade subject hours                                          | DHG Rules are read-only master data, viewed in Settings Curriculum tab                    | `staffing-settings-sheet.tsx:421` |
| 6   | Slide-out employee detail panel                                                      | Right panel inspector: requirement line detail, assignments, gap analysis, cost split     | `staffing-inspector-content.tsx`  |
| 7   | 5 database tables                                                                    | 18+ staffing models                                                                       | `schema.prisma:756-1165+`         |
| 8   | Simple salary + GOSI + EOS calculation                                               | 10-step orchestration pipeline (demand -> coverage -> HSA -> cost -> category -> persist) | `calculate.ts:66-842`             |
| 9   | Simple CSV import                                                                    | 3-step upload / validate / commit with discipline alias resolution                        | `import.ts`                       |
| 10  | KPIs: Headcount / Annual Cost / Avg Monthly / GOSI / Ajeer / EOS                     | KPIs: Total Headcount / FTE Gap / Staff Cost / HSA Budget / H:E Ratio / Recharge Cost     | `staffing-kpi-ribbon.tsx:52-92`   |
| 11  | EoS base includes Food allowance                                                     | EoS base = base + housing + transport + responsibilityPremium (HSA excluded)              | `cost-engine.ts:61-64`            |
| 12  | EoS formula: half-month salary \* years                                              | Tiered: YoS <= 5: (base/2) _ YoS; YoS > 5: (base/2 _ 5) + base \* (YoS - 5)               | `cost-engine.ts:67-77`            |

### What Was Missing Entirely

- Demand engine, Coverage engine, HSA engine, Category cost engine
- Staffing assignments model (teacher-to-requirement-line mapping)
- Workspace mode toggle (Teaching / Support & Admin)
- View presets (Need, Coverage, Cost, Full View)
- Band filters (Mat, Elem, Col, Lyc) and coverage filters
- Status strip (7 status sections)
- Settings sheet (5-6 tabs including HSA, ORS overrides, cost assumptions)
- Stale module propagation chain (ENROLLMENT -> REVENUE -> STAFFING -> PNL)
- Cost modes (LOCAL_PAYROLL, AEFE_RECHARGE, NO_LOCAL_COST)
- Record types (EMPLOYEE, VACANCY)
- Demand overrides, ORS overrides, Lycee group assumptions
- Auto-suggest button (UI present, not yet wired)
- Augmentation (Sep-Dec salary increase percentage)
- HSA summer exclusion (Jul-Aug for teaching staff)
- Ajeer rules (Saudi exempt, new staff Sep-Dec only)

---

## 1. Document Purpose

**Audience**: Budget planners at EFIR, auditors, new developers, and business analysts.

**Scope**: The Staffing planning page — its UI, workflows, calculations, data model,
and API surface. Covers the state of the codebase after Epic 18-20 (March 2026).

**How to read this document**:

- Planners: start with [Section 3](#3-planner-view--what-this-page-means-operationally)
  and [Section 6](#6-end-to-end-user-workflow)
- Developers: start with [Section 8](#8-calculations-and-derived-logic) and
  [Section 10](#10-api-and-data-flow)
- Auditors: start with [Section 11](#11-business-rules-and-guardrails) and
  [Section 9](#9-database-and-data-model)

---

## 2. Executive Overview

| Attribute            | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| **Page Name**        | Staffing                                                    |
| **URL Route**        | `/planning/staffing`                                        |
| **Module**           | Staffing & HR Planning (Epics 4, 18, 19, 20)                |
| **Page File**        | `apps/web/src/pages/planning/staffing.tsx`                  |
| **Shell**            | `PlanningShell` (shared `ContextBar` + docked `RightPanel`) |
| **Primary Function** | Plan teaching demand, assign staff, calculate costs         |

### What This Page Does [Confirmed]

1. **Calculates teaching demand** from enrollment headcounts and curriculum rules
   (DHG Rules), producing per-discipline FTE requirements grouped by school band
   (Maternelle, Elementaire, College, Lycee).
2. **Tracks staff supply** — employees (Existing, New, Departed) and vacancies — and
   maps them to requirement lines via staffing assignments.
3. **Computes coverage** — gap between demand FTE and covered FTE per discipline,
   flagging deficits, surpluses, and uncovered lines.
4. **Calculates per-employee monthly costs** — gross salary (with Sep-Dec augmentation),
   GOSI (11.75%, Saudi only), Ajeer levies, HSA, and End-of-Service provisions.
5. **Aggregates category-level costs** — Remplacements, Formation, Resident Salaires,
   Resident Logement, Resident Pension — using configurable modes (flat annual,
   % of payroll, amount per FTE).

### Position in Calculation Chain [Confirmed]

```text
ENROLLMENT  -->  REVENUE  -->  STAFFING  -->  PNL
                                  ^
                            (this page)
```

Staffing consumes **enrollment AY2 headcounts** as its primary demand driver.
When staffing data changes, it marks **PNL** as stale. When staffing is itself
stale (e.g., enrollment was recalculated), the page shows a stale banner and
returns HTTP 409 `STALE_DATA` on cost queries until recalculated.

---

## 3. Planner View — What This Page Means Operationally

### Teaching Staff Planning

As a planner, you use the **Teaching** workspace mode to answer one core question:
_"Do we have enough teachers for next year's curriculum?"_

The system calculates **demand** — how many FTE teachers each discipline needs based
on projected enrollment — and compares it to **supply** — the teachers you have
assigned. The gap tells you where to hire, redeploy, or accept vacancies.

**Key concepts**:

- **Band**: School section grouping (Maternelle, Elementaire, College, Lycee).
  Each band aggregates multiple grade levels. [Confirmed]
- **Discipline**: Teaching subject (e.g., Francais, English, Maths). [Confirmed]
- **Requirement Line**: One row per discipline per band, showing demand FTE,
  covered FTE, gap, and cost. [Confirmed]
- **ORS (Obligation Reglementaire de Service)**: The weekly teaching hours a
  teacher is contractually required to deliver. Varies by service profile. [Confirmed]
- **FTE**: Full-Time Equivalent = totalWeeklyHours / effectiveORS. [Confirmed]

### Support & Admin Staff Planning

The **Support & Admin** workspace mode shows non-teaching employees grouped by
department. There is no demand engine here — the planner manages headcount and
costs directly.

### The Demand-Supply-Gap Model [Confirmed]

```text
DEMAND (from curriculum rules + enrollment)
   - How many FTE does each discipline need?
   - Driven by: sections x hoursPerUnit / ORS

SUPPLY (from employee roster + assignments)
   - How many FTE are assigned to each discipline?
   - Driven by: SUM(assignment.fteShare)

GAP = coveredFte - requiredFtePlanned
   - Negative gap = DEFICIT (need more teachers)
   - Positive gap = SURPLUS (overstaffed)
   - Within ±0.25 = COVERED (balanced)
   - No assignments = UNCOVERED
```

### Cost Components Explained [Confirmed]

| Component                  | What It Is                                                            | Who Pays                    |
| -------------------------- | --------------------------------------------------------------------- | --------------------------- |
| **Base Salary**            | Monthly fixed salary                                                  | School                      |
| **Housing Allowance**      | Accommodation stipend                                                 | School                      |
| **Transport Allowance**    | Commute stipend                                                       | School                      |
| **Responsibility Premium** | Management/role premium                                               | School                      |
| **HSA**                    | Heures Supplementaires Annualisees — overtime hours compensation      | School (LOCAL_PAYROLL only) |
| **Augmentation**           | Sep-Dec salary increase (%) applied to base + allowances (not HSA)    | School                      |
| **GOSI**                   | Government Social Insurance — 11.75% of adjusted gross (Saudi only)   | School (employer share)     |
| **Ajeer**                  | Work permit levy for non-Saudi staff (annual levy / 12 + monthly fee) | School                      |
| **EoS**                    | End-of-Service provision accrual (Saudi labor law)                    | School                      |

### Key Decisions the Planner Makes

1. **Which employees to assign** to which requirement lines (and at what FTE share)
2. **Whether to accept deficits** or create vacancy records to flag hiring needs
3. **ORS overrides** per service profile (in Settings) to adjust FTE calculations
4. **Cost assumptions** — how to compute Remplacements, Formation, and Resident
   costs (mode and rate)
5. **HSA parameters** — target hours, rates (in Settings)
6. **Demand overrides** — manually adjust planned FTE for specific lines
7. **When to recalculate** — after any data change, click Calculate to refresh

---

## 4. Page Context and Dependencies

### Upstream Dependencies [Confirmed]

| Dependency                        | What It Provides                                              | Must Be Calculated First?          |
| --------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| **Enrollment**                    | AY2 headcounts per grade level                                | Yes — demand engine needs sections |
| **Master Data: DHG Rules**        | Curriculum rules (discipline, grade, hours/unit, driver type) | Yes — static reference data        |
| **Master Data: Service Profiles** | ORS values, HSA eligibility per teacher type                  | Yes — static reference data        |
| **Master Data: Disciplines**      | Discipline codes and aliases                                  | Yes — static reference data        |
| **Master Data: Grade Levels**     | Max class sizes per grade                                     | Yes — static reference data        |

### Downstream Dependents [Confirmed]

| Dependent | What It Consumes                     | Stale Propagation                           |
| --------- | ------------------------------------ | ------------------------------------------- |
| **PNL**   | Staff cost totals and category costs | PNL marked stale when staffing recalculates |

### Stale Module Chain [Confirmed]

```text
ENROLLMENT changes
    |
    v
REVENUE marked stale
    |
    v
STAFFING marked stale  <-- this page shows warning banner
    |
    v
PNL marked stale
```

When staffing is recalculated, it **removes STAFFING** from staleModules and
**adds PNL**. [Confirmed: `calculate.ts:769-776`]

### Pre-Conditions [Confirmed]

| Condition                        | Required? | What Happens If Missing                        |
| -------------------------------- | --------- | ---------------------------------------------- |
| Budget Version selected          | Yes       | Page shows "Select a version" placeholder      |
| Version status = Draft           | For edits | Page shows "locked" banner, all edits disabled |
| Enrollment AY2 calculated        | Yes       | Calculate returns 422 MISSING_PREREQUISITES    |
| At least 1 non-Departed employee | Yes       | Calculate returns 422 MISSING_PREREQUISITES    |
| User role != Viewer              | For edits | Page shows "view-only" banner                  |

### RBAC Permission Matrix [Confirmed]

| Action             | Admin | BudgetOwner | Editor | Viewer        |
| ------------------ | ----- | ----------- | ------ | ------------- |
| View staffing data | Yes   | Yes         | Yes    | Yes           |
| View salary fields | Yes   | Yes         | Yes    | No (redacted) |
| Edit employees     | Yes   | Yes         | Yes    | No            |
| Import employees   | Yes   | Yes         | Yes    | No            |
| Run calculation    | Yes   | Yes         | Yes    | No            |
| Manage assignments | Yes   | Yes         | Yes    | No            |
| Edit settings      | Yes   | Yes         | Yes    | No            |
| Add employee       | Yes   | Yes         | Yes    | No            |

> **Permission check**: All mutating routes require `data:edit`. Salary reads
> require `salary:view`. [Confirmed: `calculate.ts:69`]

---

## 5. Current UI Walkthrough

### Page Layout [Confirmed]

```text
+===================================================================+
| Context Bar (fiscal year, version, period selectors)    [PlanningShell]
+===================================================================+
| [Locked banner]  or  [Viewer banner]  or  [Uncalculated banner]   |
+-------------------------------------------------------------------+
| TOOLBAR                                                           |
| Left:  [Teaching|Support&Admin]  [All|Mat|Elem|Col|Lyc]           |
|        [Coverage filter dropdown]                                  |
| Right: [Need|Coverage|Cost|Full View]  [Settings] [Import]        |
|        [Add Employee] [Auto-Suggest]  [Calculate]                  |
+-------------------------------------------------------------------+
| STATUS STRIP                                                      |
| Last calculated | Stale | Demand | Source | Supply | Coverage     |
| | Downstream                                                      |
+-------------------------------------------------------------------+
| KPI RIBBON                                                        |
| [Total Headcount] [FTE Gap] [Staff Cost] [HSA Budget]             |
| [H:E Ratio] [Recharge Cost]                                       |
+-------------------------------------------------------------------+
| GRID ZONE (flex-1, scrollable)                                    |
|                                                                   |
| Teaching mode: TeachingMasterGrid                                 |
|   - Rows grouped by band (MAT -> ELEM -> COL -> LYC)             |
|   - Subtotal row per band                                         |
|   - Click row -> right panel inspector                            |
|                                                                   |
| Support mode: SupportAdminGrid                                    |
|   - Rows grouped by department                                    |
|   - Click row -> right panel inspector                            |
+-------------------------------------------------------------------+
| RIGHT PANEL (docked, resizable)               [PlanningShell]     |
| Inspector: requirement line detail, assignments, gap analysis     |
+===================================================================+
| SETTINGS SHEET (overlay, triggered by Settings button)            |
+===================================================================+
```

### Conditional Banners [Confirmed]

| Banner           | Condition                         | Message                                                          |
| ---------------- | --------------------------------- | ---------------------------------------------------------------- |
| **Locked**       | Version status != Draft           | "This version is locked. Staffing data is read-only."            |
| **Viewer**       | User role = Viewer                | "You have view-only access."                                     |
| **Uncalculated** | Not stale AND no lastCalculatedAt | "Staffing has not been calculated. Click Calculate to generate." |

Source: `staffing.tsx:196-214`

### Toolbar [Confirmed]

**Left side**:

- **Workspace mode toggle**: `Teaching` / `Support & Admin` — switches the grid
  zone between teaching requirement grid and support employee grid.
- **Band filter** (Teaching mode only): `All`, `Mat`, `Elem`, `Col`, `Lyc` — filters
  requirement lines by school band.
- **Coverage filter** (Teaching mode only, hidden in Need preset): dropdown with
  `All Coverage`, `Deficit`, `Surplus`, `Uncovered`, `Covered`.

**Right side**:

- **View presets** (Teaching mode only): `Need`, `Coverage`, `Cost`, `Full View` —
  controls which columns are visible in the teaching grid.
- **Settings**: Opens the `StaffingSettingsSheet` overlay.
- **Import**: (editable only) Opens employee import flow. [UI present]
- **Add Employee**: (editable only) Opens employee create dialog. [UI present]
- **Auto-Suggest**: (Teaching mode + editable only) Opens auto-suggest dialog.
  [UI present, handler not yet wired]
- **Calculate**: (editable only) Triggers the 10-step calculation pipeline.

Source: `staffing.tsx:217-327`

### Status Strip (7 Sections) [Confirmed]

| #   | Key              | Label            | Example Value                                                        | Severity Logic                                      |
| --- | ---------------- | ---------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | `lastCalculated` | Last calculated  | "18 Mar 2026, 14:32" or "Not yet calculated"                         | Warning if null                                     |
| 2   | `stale`          | Stale            | "Staffing data is stale — recalculate"                               | Warning (shown only when stale)                     |
| 3   | `demandPeriod`   | Demand           | "AY 2026"                                                            | Default                                             |
| 4   | `source`         | Source           | "Based on enrollment AY2 headcounts (calculated 18 Mar 2026, 14:00)" | Warning if enrollment stale                         |
| 5   | `supply`         | Supply           | "85 employees (72 existing, 13 new) + 3 vacancies"                   | Default                                             |
| 6   | `coverage`       | Coverage         | "4 deficit, 2 uncovered, 18 balanced"                                | Warning if any deficit/uncovered; success otherwise |
| 7   | `downstream`     | Downstream stale | Pills for stale downstream modules (PNL)                             | Shown only when downstream modules are stale        |

Source: `staffing-status-strip.tsx:50-144`

### KPI Ribbon (6 Cards) [Confirmed]

| Card                | Key              | Icon            | Formatter           | Conditional Styling                                    |
| ------------------- | ---------------- | --------------- | ------------------- | ------------------------------------------------------ |
| **Total Headcount** | `totalHeadcount` | Users           | Locale number       | Default accent                                         |
| **FTE Gap**         | `fteGap`         | TrendingUp/Down | 2 decimal places    | Error if < -0.25, Warning if > 0.25, Success otherwise |
| **Staff Cost**      | `staffCost`      | DollarSign      | Compact money (SAR) | Default accent                                         |
| **HSA Budget**      | `hsaBudget`      | Clock           | Compact money (SAR) | Default accent                                         |
| **H:E Ratio**       | `heRatio`        | BarChart3       | 2 decimal places    | Default accent                                         |
| **Recharge Cost**   | `rechargeCost`   | ArrowUpRight    | Compact money (SAR) | Default accent                                         |

When stale, a pulsing "Stale — recalculate to refresh" indicator appears below the
ribbon. [Confirmed: `staffing-kpi-ribbon.tsx:181-195`]

> **Note**: `hsaBudget`, `heRatio`, and `rechargeCost` are currently hardcoded to 0
> in the KPI value derivation. [Confirmed: `staffing.tsx:126-128`] [Needs Validation:
>
> > whether these are planned for future wiring or represent missing calculation]

### Teaching Master Grid [Confirmed]

The teaching grid displays requirement lines grouped by band, with columns controlled
by the active view preset.

**Column visibility by preset**:

| Column                 | Need | Coverage | Cost | Full View |
| ---------------------- | ---- | -------- | ---- | --------- |
| `lineLabel`            | Yes  | Yes      | Yes  | Yes       |
| `serviceProfileCode`   | Yes  | Yes      | -    | Yes       |
| `totalDriverUnits`     | Yes  | Yes      | -    | Yes       |
| `totalWeeklyHours`     | Yes  | Yes      | -    | Yes       |
| `baseOrs`              | Yes  | -        | -    | Yes       |
| `effectiveOrs`         | Yes  | -        | -    | Yes       |
| `requiredFteRaw`       | Yes  | Yes      | -    | Yes       |
| `requiredFtePlanned`   | Yes  | -        | -    | Yes       |
| `recommendedPositions` | Yes  | -        | -    | Yes       |
| `coveredFte`           | -    | Yes      | -    | Yes       |
| `gapFte`               | -    | Yes      | -    | Yes       |
| `coverageStatus`       | -    | Yes      | -    | Yes       |
| `assignedStaffCount`   | -    | Yes      | -    | Yes       |
| `directCostAnnual`     | -    | -        | Yes  | Yes       |
| `hsaCostAnnual`        | -    | -        | Yes  | Yes       |

Source: `teaching-master-grid.tsx:21-62`

**Row types**: requirement (data row), subtotal (per band), total.
**Grouping**: Rows sorted by band order (MAT -> ELEM -> COL -> LYC), with a subtotal
row after each band group.

**Row click**: Selecting a requirement line row updates the staffing selection store,
which drives the right panel inspector to show that line's detail.

### Support & Admin Grid [Confirmed]

Displays non-teaching employees grouped by department. Each department group shows
employee rows with a department subtotal for headcount and annual cost.

Source: `staffing-workspace.ts:219-253`, `support-admin-grid.tsx`

### Right Panel Inspector [Confirmed]

The docked right panel (registered via side-effect import in `staffing.tsx:40-41`)
shows contextual detail based on the current selection.

**View modes**:

1. **Requirement Line Detail** — when a teaching grid row is selected: shows band
   badge, discipline, coverage status, demand/coverage metrics, and a list of
   assigned employees with FTE share and cost mode badges. Includes an assignment
   form to add/edit/delete assignments.
2. **Support Employee Detail** — when a support grid row is selected: shows employee
   info and department context.
3. **Guide** — default content when no selection is active.

Source: `staffing-inspector-content.tsx`

### Settings Sheet (5-6 Tabs) [Confirmed]

Opened via the Settings button. A `Sheet` (side overlay) with tabbed content.

| Tab   | Label                  | Content                                                                                                                                                                               | Editable       |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **1** | Service Profiles & HSA | ORS overrides per service profile + HSA parameters (target hours, first hour rate, additional hour rate, HSA months)                                                                  | Yes (if Draft) |
| **2** | Curriculum             | Read-only view of DHG Rules grouped by band, with link to Master Data for editing                                                                                                     | No (view only) |
| **3** | Lycee Group            | Group count and hours/group per discipline (only shown when GROUPS-type rules exist)                                                                                                  | Yes (if Draft) |
| **4** | Cost Assumptions       | 5 cost categories (Remplacements, Formation, Resident Salaires, Resident Logement, Resident Pension) with mode selector (Flat Annual / % of Payroll / Amount per FTE) and value input | Yes (if Draft) |
| **5** | Enrollment             | Read-only enrollment AY2 headcount by grade with stale warning                                                                                                                        | No (view only) |
| **6** | Reconciliation         | Summary stats (FTE, cost) and navigation to related modules                                                                                                                           | No (view only) |

Source: `staffing-settings-sheet.tsx:418-425`

---

## 6. End-to-End User Workflow

A typical staffing planning cycle follows these steps:

### Step 1: Ensure Prerequisites [Confirmed]

- Select the correct **Budget Version** (must be Draft) from the context bar.
- Verify that **Enrollment** has been calculated (AY2 headcounts must exist).
- Confirm at least one employee record exists for this version.

### Step 2: Review Current State

- Open the Staffing page. Check the **status strip** for stale warnings.
- If stale, click **Calculate** to regenerate all staffing data.

### Step 3: Configure Settings (if needed) [Confirmed]

- Click **Settings** to open the settings sheet.
- **Service Profiles tab**: Review and override ORS values per service profile.
  Set HSA parameters (target hours, rates).
- **Lycee Group tab**: If Lycee group-driver rules exist, set group counts and
  hours per group per discipline.
- **Cost Assumptions tab**: Configure each cost category's calculation mode and
  value.
- Save changes. Settings changes mark STAFFING as stale.

### Step 4: Import or Add Employees [Confirmed]

- **Import**: Click Import to upload an employee file. The system runs a 3-step
  flow: upload -> validate (with discipline alias resolution) -> commit.
- **Add Employee**: Click Add Employee to create individual records.
- Employees have statuses: **Existing** (returning), **New** (joining this year),
  or **Departed** (leaving).

### Step 5: Review Teaching Demand [Confirmed]

- Switch to **Teaching** workspace mode.
- Use the **Need** view preset to see demand-side columns: weekly hours, ORS,
  required FTE (raw and planned), recommended positions.
- Use **band filters** to focus on one school section.

### Step 6: Manage Assignments [Confirmed]

- Click a requirement line row to open the **right panel inspector**.
- In the inspector, view current assignments and their FTE shares.
- Use the assignment form to **add**, **edit**, or **delete** teacher assignments.
- Each assignment specifies: employee, FTE share (derived hours/week shown
  automatically from FTE \* ORS).

### Step 7: Review Coverage [Confirmed]

- Switch to the **Coverage** view preset.
- Review coverage status per line: COVERED, DEFICIT, SURPLUS, or UNCOVERED.
- Use the **coverage filter** dropdown to focus on problem lines.
- The FTE Gap KPI card shows the aggregate gap with color coding.

### Step 8: Apply Demand Overrides (if needed) [Confirmed]

- If the calculated demand FTE needs manual adjustment (e.g., planned extra
  positions), demand overrides can be applied via the API to set
  `requiredFtePlanned` per line. [Inferred: no UI for this yet]

### Step 9: Run Calculation [Confirmed]

- Click **Calculate**. This runs the full 10-step pipeline:
  validate -> load inputs -> demand -> overrides -> coverage -> HSA -> cost ->
  category cost -> aggregate -> persist.
- On success, stale flag is removed from STAFFING, PNL is marked stale.
- The grid, KPIs, and status strip refresh with new data.

### Step 10: Review Costs [Confirmed]

- Switch to the **Cost** view preset to see `directCostAnnual` and
  `hsaCostAnnual` per requirement line.
- Check the **Staff Cost** KPI card for the total.
- Switch to **Support & Admin** mode to review non-teaching staff costs by
  department.

### Step 11: Iterate and Finalize

- Repeat steps 4-10 as needed: adjust employees, assignments, settings,
  and recalculate until the staffing plan is satisfactory.
- When satisfied, proceed to PNL calculation (which consumes staffing outputs).

---

## 7. Inputs Required

### User-Entered Inputs [Confirmed]

| Input                                                               | Where                       | When                         | Mandatory                                  |
| ------------------------------------------------------------------- | --------------------------- | ---------------------------- | ------------------------------------------ |
| **Employee records** (code, name, status, salary components, flags) | Import or Add Employee      | Before first calculation     | Yes (>= 1 non-Departed)                    |
| **Staffing assignments** (employee -> discipline, FTE share)        | Right panel inspector       | After employees exist        | No (but coverage will be UNCOVERED)        |
| **ORS overrides**                                                   | Settings > Service Profiles | Optional                     | No (defaults from master data)             |
| **HSA parameters** (target hours, rates, months)                    | Settings > Service Profiles | Optional                     | No (defaults from version settings)        |
| **Cost assumptions** (mode + value per category)                    | Settings > Cost Assumptions | Optional                     | No (defaults if no assumptions configured) |
| **Lycee group assumptions** (group count, hours/group)              | Settings > Lycee Group      | When GROUPS-type rules exist | Conditional                                |
| **Demand overrides** (manual FTE per line)                          | API only (no UI yet)        | Optional                     | No                                         |

### System-Derived Inputs [Confirmed]

| Input                         | Source                                   | Description                                                  |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| **Enrollment AY2 headcounts** | Enrollment module calculation            | Student count per grade for next year                        |
| **DHG Rules**                 | Master Data (`DhgRule` table)            | Curriculum rules: hours/unit, driver type, discipline, grade |
| **Service Profiles**          | Master Data (`ServiceObligationProfile`) | Default ORS hours, HSA eligibility per teacher type          |
| **Grade max class sizes**     | Master Data + version overrides          | Maximum students per section per grade                       |

### Context-Driven Inputs [Confirmed]

| Input              | Source                  | Description                                         |
| ------------------ | ----------------------- | --------------------------------------------------- |
| **Version ID**     | Workspace context store | Active budget version                               |
| **Fiscal Year**    | Workspace context store | Determines effective DHG rules and asOfDate for EoS |
| **Version Status** | Budget version record   | Controls editability (Draft = editable)             |
| **User Role**      | Auth context            | Controls RBAC permissions                           |

---

## 8. Calculations and Derived Logic

### 10-Step Calculation Pipeline Overview [Confirmed]

Source: `apps/api/src/routes/staffing/calculate.ts`

```text
Step  1: VALIDATE PREREQUISITES   — version exists, is Draft, enrollment + employees exist
Step  2: LOAD ALL INPUTS           — settings, enrollments, DHG rules, profiles, overrides,
                                     employees (decrypted), assignments, cost assumptions,
                                     Lycee group assumptions, demand overrides
Step  3: RUN DEMAND ENGINE         — calculate requirement lines from enrollment + rules
Step  4: APPLY DEMAND OVERRIDES    — manual FTE adjustments per line
Step  5: RUN COVERAGE ENGINE       — match assignments to requirement lines, compute gaps
Step  6: RUN HSA ENGINE            — compute HSA cost per eligible teacher per month
Step  7: RUN COST ENGINE           — compute 12-month cost per employee (gross, GOSI,
                                     Ajeer, EoS)
Step  8: RUN CATEGORY COST ENGINE  — compute configurable category costs (5 categories)
Step  9: AGGREGATE COSTS           — sum employee costs onto requirement lines via
                                     assignment fteShare
Step 10: PERSIST IN TRANSACTION    — delete old rows, insert new sources/lines/costs/
                                     EoS/categories, update HSA on employees, update
                                     staleModules (remove STAFFING, add PNL)
Step 11: AUDIT LOG + RETURN        — create CalculationAuditLog, return summary
```

### Step 3: Demand Engine [Confirmed]

Source: `apps/api/src/services/staffing/demand-engine.ts`

**Purpose**: Compute teaching requirement lines from enrollment + curriculum rules.

**Inputs**:

- Enrollment AY2 headcounts per grade
- DHG rules (grade, discipline, lineType, driverType, hoursPerUnit, serviceProfile)
- Service profiles with merged ORS overrides
- Lycee group assumptions
- HSA target hours, academic weeks

**Driver types**:

- `SECTIONS`: driverUnits = ceil(headcount / maxClassSize)
- `GROUPS`: driverUnits = from Lycee group assumptions
- [Other driver types may exist] [Needs Validation]

**FTE calculation**:

```text
totalWeeklyHours = SUM(driverUnits * hoursPerUnit)   per discipline per band
requiredFteRaw   = totalWeeklyHours / effectiveORS
requiredFtePlanned = ceil(requiredFteRaw) or custom rounding
recommendedPositions = ceil(requiredFtePlanned)
```

**Outputs**: `RequirementSource[]` (grade-level detail) and `RequirementLine[]`
(band-level aggregated lines).

### Step 5: Coverage Engine [Confirmed]

Source: `apps/api/src/services/staffing/coverage-engine.ts`

**Purpose**: Match assignments to requirement lines, compute coverage.

**Per line**:

```text
coveredFte = SUM(assignment.fteShare)  for matching (band, disciplineCode)
gapFte     = coveredFte - requiredFtePlanned
```

**Coverage status determination**:

| Condition             | Status      |
| --------------------- | ----------- |
| No assignments at all | `UNCOVERED` |
| gapFte < -0.25        | `DEFICIT`   |
| gapFte > +0.25        | `SURPLUS`   |
| Otherwise             | `COVERED`   |

**Warnings generated**: [Confirmed: `coverage-engine.ts:34-39`]

- `OVER_ASSIGNED` — employee assigned more than 100% FTE total
- `ORPHANED_ASSIGNMENT` — assignment to non-existent requirement line
- `UNASSIGNED_TEACHER` — teaching employee with no assignments
- `DEPARTED_WITH_ASSIGNMENTS` — departed employee still assigned
- `RECHARGE_COVERAGE` — AEFE_RECHARGE employee covering a line

### Step 6: HSA Engine [Confirmed]

Source: `apps/api/src/services/staffing/hsa-engine.ts`

**Formula** (AC-08):

```text
additionalHours     = max(0, hsaTargetHours - 1)
hsaCostPerMonth     = hsaFirstHourRate + additionalHours * hsaAdditionalHourRate
hsaAnnualPerTeacher = hsaCostPerMonth * hsaMonths
```

Default example: `500 + max(0, 1.5 - 1) * 400 = 700 SAR/month * 10 = 7,000 SAR/year`

**Eligibility** (AC-09): HSA applies only when `serviceProfile.hsaEligible === true`
AND `costMode === 'LOCAL_PAYROLL'`. [Confirmed: `calculate.ts:386-395`]

### Step 7: Monthly Gross Engine [Confirmed]

Source: `apps/api/src/services/staffing/monthly-gross.ts`

**Augmentation** (AC-13):

- Months 1-8: pre-augmentation salary (multiplier = 1)
- Months 9-12: augmentation applied to base, housing, transport, responsibility
  premium (multiplier = 1 + augPct). **HSA is NOT subject to augmentation**.

**HSA Summer Exclusion** (AC-14):

- Teaching staff: HSA = 0 for months 7-8 (July-August)
- Non-teaching staff: receive HSA year-round

**Adjusted gross formula**:

```text
adjustedGross = adjBase + adjHousing + adjTransport + adjResponsibility + adjHSA
```

where `adj*` = component \* augMultiplier (except HSA).

### Step 7: Cost Engine [Confirmed]

Source: `apps/api/src/services/staffing/cost-engine.ts`

**GOSI** (AC-15):

```text
gosiAmount = adjustedGross * 0.1175    (Saudi employees only)
```

Non-Saudi employees pay zero GOSI. [Confirmed: `cost-engine.ts:9-11`]

**Ajeer** (AC-16, AC-17, AC-18):

```text
ajeerMonthly = ajeerAnnualLevy / 12 + ajeerMonthlyFee
```

- AC-16: Existing staff pay all 12 months [Confirmed]
- AC-17: New staff only pay months 9-12 (Sep-Dec) [Confirmed]
- AC-18: Saudi employees pay zero Ajeer [Confirmed]
- Non-Ajeer employees pay zero [Confirmed]

**End-of-Service (EoS)** (AC-19, AC-20, AC-21):

```text
yearsOfService = YEARFRAC(hireDate, asOfDate)   -- US 30/360 (TC-002)
eosBase = baseSalary + housing + transport + responsibilityPremium
          (HSA excluded from EoS base)

if YoS <= 0:  eosAnnual = 0
if YoS <= 5:  eosAnnual = (eosBase / 2) * YoS           -- half salary per year
if YoS > 5:   eosAnnual = (eosBase / 2 * 5) + eosBase * (YoS - 5)  -- full salary after 5

eosMonthlyAccrual = eosAnnual / 12
```

**Total monthly cost** (AC-22):

```text
totalCost = adjustedGross + gosiAmount + ajeerAmount + eosMonthlyAccrual
```

**Cost modes** (AC-10, AC-11, AC-12):

| Mode            | Behavior                                                       |
| --------------- | -------------------------------------------------------------- |
| `LOCAL_PAYROLL` | Full cost calculation (default)                                |
| `AEFE_RECHARGE` | 12 zero-cost monthly rows (employee tracked but no local cost) |
| `NO_LOCAL_COST` | No output rows at all (employee skipped)                       |

### Step 8: Category Cost Engine [Confirmed]

Source: `apps/api/src/services/staffing/category-cost-engine.ts`

**5 configurable categories**: [Confirmed: `staffing-settings-sheet.tsx:42-48`]

1. `REMPLACEMENTS` — Replacements
2. `FORMATION` — Training
3. `RESIDENT_SALAIRES` — Resident Salaries
4. `RESIDENT_LOGEMENT` — Resident Housing
5. `RESIDENT_PENSION` — Resident Pension

**3 calculation modes** (AC-13, AC-14):

| Mode                 | Formula                                              |
| -------------------- | ---------------------------------------------------- |
| `FLAT_ANNUAL`        | monthlyAmount = value / 12                           |
| `PERCENT_OF_PAYROLL` | monthlyAmount = monthlyLocalPayrollSubtotal \* value |
| `AMOUNT_PER_FTE`     | monthlyAmount = (value \* totalTeachingFteRaw) / 12  |

Output: 5 categories x 12 months = 60 rows (or fewer if not all categories configured).

### YEARFRAC US 30/360 [Confirmed]

Source: `apps/api/src/services/staffing/yearfrac.ts`

Matches Excel `YEARFRAC(start, end, 0)` exactly (TC-002).

```text
Algorithm:
  if day1 == 31: day1 = 30
  if day2 == 31 AND day1 >= 30: day2 = 30
  numerator = (year2 - year1) * 360 + (month2 - month1) * 30 + (day2 - day1)
  result = numerator / 360
```

### Key Formulas Reference [Confirmed]

| Formula                 | Expression                                                     | Source               |
| ----------------------- | -------------------------------------------------------------- | -------------------- |
| Sections needed         | `ceil(headcount / maxClassSize)`                               | `demand-engine.ts`   |
| Required FTE            | `totalWeeklyHours / effectiveORS`                              | `demand-engine.ts`   |
| FTE Gap                 | `coveredFte - requiredFtePlanned`                              | `coverage-engine.ts` |
| HSA/month               | `firstHourRate + max(0, targetHours - 1) * additionalHourRate` | `hsa-engine.ts`      |
| Monthly gross (Sep-Dec) | `(base + housing + transport + resp) * (1 + augPct) + HSA`     | `monthly-gross.ts`   |
| GOSI                    | `adjustedGross * 0.1175` (Saudi only)                          | `cost-engine.ts`     |
| Ajeer/month             | `annualLevy / 12 + monthlyFee`                                 | `cost-engine.ts`     |
| EoS annual (<=5y)       | `(eosBase / 2) * YoS`                                          | `cost-engine.ts`     |
| EoS annual (>5y)        | `(eosBase / 2 * 5) + eosBase * (YoS - 5)`                      | `cost-engine.ts`     |
| Total monthly cost      | `adjustedGross + GOSI + Ajeer + eosMonthlyAccrual`             | `cost-engine.ts`     |

---

## 9. Database and Data Model

### Entity Classification [Confirmed]

| Model                           | Type       | Purpose                                                 |
| ------------------------------- | ---------- | ------------------------------------------------------- |
| `Employee`                      | User Input | Staff records with encrypted salary fields              |
| `StaffingAssignment`            | User Input | Teacher-to-discipline mapping with FTE share            |
| `DemandOverride`                | User Input | Manual FTE adjustments per requirement line             |
| `VersionStaffingSettings`       | User Input | HSA params, academic weeks per version                  |
| `VersionServiceProfileOverride` | User Input | ORS overrides per service profile per version           |
| `VersionStaffingCostAssumption` | User Input | Category cost modes and values per version              |
| `VersionLyceeGroupAssumption`   | User Input | Lycee group counts per version                          |
| `TeachingRequirementLine`       | Calculated | Aggregated demand/coverage/cost per discipline per band |
| `TeachingRequirementSource`     | Calculated | Grade-level demand detail (provenance)                  |
| `MonthlyStaffCost`              | Calculated | 12-month cost breakdown per employee                    |
| `EosProvision`                  | Calculated | End-of-service provision per employee                   |
| `CategoryMonthlyCost`           | Calculated | Category-level monthly costs                            |
| `ServiceObligationProfile`      | Reference  | ORS defaults, HSA eligibility                           |
| `Discipline`                    | Reference  | Teaching discipline codes                               |
| `DisciplineAlias`               | Reference  | Import alias resolution                                 |
| `DhgRule`                       | Reference  | Curriculum rules (hours, drivers, grades)               |
| `GradeLevel`                    | Reference  | Grade codes, max class sizes                            |
| `CalculationAuditLog`           | Audit      | Calculation run metadata                                |

### Key Relationships [Confirmed]

```text
Employee
  ├── many MonthlyStaffCost (12 per calculation)
  ├── one EosProvision (per calculation)
  ├── many StaffingAssignment (teacher -> discipline)
  └── belongs to BudgetVersion

StaffingAssignment
  ├── belongs to Employee
  ├── belongs to Discipline
  └── belongs to BudgetVersion

TeachingRequirementLine
  ├── belongs to BudgetVersion
  └── has many TeachingRequirementSource (grade-level detail)

DhgRule
  ├── belongs to Discipline
  └── belongs to ServiceObligationProfile
```

### Encryption [Confirmed]

5 salary fields on `Employee` are encrypted with `pgp_sym_encrypt` / `pgp_sym_decrypt`:

- `base_salary`
- `housing_allowance`
- `transport_allowance`
- `responsibility_premium`
- `hsa_amount`

The encryption key is delivered via Docker secret at `/run/secrets/salary_encryption_key`.
Decryption happens in raw SQL queries (see `calculate.ts:208-226`).

The `augmentation` field is stored as a plain `DECIMAL` (not encrypted) since it is a
percentage, not a monetary value. [Confirmed: `calculate.ts:54`]

---

## 10. API and Data Flow

### Staffing API Endpoints [Confirmed]

All routes are prefixed with `/api/v1/versions/:versionId/`.

| Method          | Path                                          | Description                    | Permission  | Source           |
| --------------- | --------------------------------------------- | ------------------------------ | ----------- | ---------------- |
| **Calculate**   |                                               |                                |             |                  |
| POST            | `calculate/staffing`                          | Run 10-step pipeline           | `data:edit` | `calculate.ts`   |
| **Employees**   |                                               |                                |             |                  |
| GET             | `staffing/employees`                          | List employees                 | `data:view` | `employees.ts`   |
| GET             | `staffing/employees/:id`                      | Get single employee            | `data:view` | `employees.ts`   |
| POST            | `staffing/employees`                          | Create employee                | `data:edit` | `employees.ts`   |
| PUT             | `staffing/employees/:id`                      | Update employee                | `data:edit` | `employees.ts`   |
| DELETE          | `staffing/employees/:id`                      | Delete employee                | `data:edit` | `employees.ts`   |
| **Import**      |                                               |                                |             |                  |
| POST            | `staffing/import/validate`                    | Validate import file           | `data:edit` | `import.ts`      |
| POST            | `staffing/import/commit`                      | Commit validated import        | `data:edit` | `import.ts`      |
| **Assignments** |                                               |                                |             |                  |
| GET             | `staffing/assignments`                        | List assignments               | `data:view` | `assignments.ts` |
| POST            | `staffing/assignments`                        | Create assignment              | `data:edit` | `assignments.ts` |
| PUT             | `staffing/assignments/:id`                    | Update assignment              | `data:edit` | `assignments.ts` |
| DELETE          | `staffing/assignments/:id`                    | Delete assignment              | `data:edit` | `assignments.ts` |
| POST            | `staffing/assignments/auto-suggest`           | Auto-suggest assignments       | `data:edit` | `assignments.ts` |
| **Settings**    |                                               |                                |             |                  |
| GET             | `staffing/settings`                           | Get version settings           | `data:view` | `settings.ts`    |
| PUT             | `staffing/settings`                           | Update version settings        | `data:edit` | `settings.ts`    |
| GET             | `staffing/settings/service-profile-overrides` | Get ORS overrides              | `data:view` | `settings.ts`    |
| PUT             | `staffing/settings/service-profile-overrides` | Update ORS overrides           | `data:edit` | `settings.ts`    |
| GET             | `staffing/settings/cost-assumptions`          | Get cost assumptions           | `data:view` | `settings.ts`    |
| PUT             | `staffing/settings/cost-assumptions`          | Update cost assumptions        | `data:edit` | `settings.ts`    |
| GET             | `staffing/settings/lycee-group-assumptions`   | Get Lycee groups               | `data:view` | `settings.ts`    |
| PUT             | `staffing/settings/lycee-group-assumptions`   | Update Lycee groups            | `data:edit` | `settings.ts`    |
| **Results**     |                                               |                                |             |                  |
| GET             | `staffing/teaching-requirements`              | Get requirement lines + totals | `data:view` | `results.ts`     |
| GET             | `staffing/teaching-requirements/:id/sources`  | Get source detail for a line   | `data:view` | `results.ts`     |
| GET             | `staffing/summary`                            | Get FTE + cost summary         | `data:view` | `results.ts`     |

### Stale Response Behavior [Confirmed]

When a module is stale, cost query endpoints return HTTP `409 STALE_DATA` to force
the frontend to show recalculation prompts rather than stale numbers.
[Confirmed from CLAUDE.md: "API returns 409 STALE_DATA when module is stale"]

### Data Flow Diagram [Confirmed]

```text
                    ┌──────────────┐
                    │  Master Data │
                    │  DHG Rules   │
                    │  Profiles    │
                    │  Grades      │
                    └──────┬───────┘
                           │
     ┌──────────────┐      │      ┌──────────────┐
     │  Enrollment  │      │      │   Settings   │
     │  AY2 heads   │      │      │  HSA / ORS   │
     │  per grade   │      │      │  Cost modes  │
     └──────┬───────┘      │      └──────┬───────┘
            │              │             │
            v              v             v
     ┌─────────────────────────────────────────┐
     │          STEP 3: DEMAND ENGINE          │
     │  enrollment + rules -> requirement lines │
     └──────────────────┬──────────────────────┘
                        │
                        v
     ┌─────────────────────────────────────────┐
     │       STEP 4: DEMAND OVERRIDES          │
     │  manual FTE adjustments per line        │
     └──────────────────┬──────────────────────┘
                        │
     ┌──────────────┐   │
     │  Employees   │   │
     │  Assignments │   │
     └──────┬───────┘   │
            │           │
            v           v
     ┌─────────────────────────────────────────┐
     │       STEP 5: COVERAGE ENGINE           │
     │  assignments -> coverage per line       │
     └──────────────────┬──────────────────────┘
                        │
                        v
     ┌─────────────────────────────────────────┐
     │         STEP 6: HSA ENGINE              │
     │  settings -> HSA cost per teacher/month │
     └──────────────────┬──────────────────────┘
                        │
                        v
     ┌─────────────────────────────────────────┐
     │         STEP 7: COST ENGINE             │
     │  per employee: gross + GOSI + Ajeer +   │
     │  EoS for 12 months                      │
     └──────────────────┬──────────────────────┘
                        │
                        v
     ┌─────────────────────────────────────────┐
     │     STEP 8: CATEGORY COST ENGINE        │
     │  5 categories x 12 months               │
     └──────────────────┬──────────────────────┘
                        │
                        v
     ┌─────────────────────────────────────────┐
     │     STEP 9: AGGREGATE ONTO LINES        │
     │  employee costs -> requirement lines    │
     │  via fteShare proportional split        │
     └──────────────────┬──────────────────────┘
                        │
                        v
     ┌─────────────────────────────────────────┐
     │     STEP 10: PERSIST IN $TRANSACTION    │
     │  delete old -> insert new -> update HSA │
     │  -> update staleModules                 │
     └──────────────────┬──────────────────────┘
                        │
                        v
     ┌─────────────────────────────────────────┐
     │     STEP 11: AUDIT LOG + RESPONSE       │
     │  totalFte, totalCost, warnings          │
     └─────────────────────────────────────────┘
```

---

## 11. Business Rules and Guardrails

### Version Lifecycle Rules [Confirmed]

- Only **Draft** versions allow staffing edits and calculations.
- **Published**, **Locked**, or **Archived** versions return `409 VERSION_LOCKED`.
- The calculate endpoint checks version status before proceeding.

### Stale Module Rules [Confirmed]

- When staffing data is modified (employees, assignments, settings), STAFFING
  is added to `staleModules`.
- When staffing calculation completes, STAFFING is **removed** and PNL is **added**.
- The frontend checks `staleModules` to display banners and stale indicators.

### Cost Mode Rules [Confirmed]

| Mode            | Monthly Cost Rows | Included in Payroll Subtotal | Included in Coverage |
| --------------- | ----------------- | ---------------------------- | -------------------- |
| `LOCAL_PAYROLL` | 12 full-cost rows | Yes                          | Yes                  |
| `AEFE_RECHARGE` | 12 zero-cost rows | No                           | Yes (with warning)   |
| `NO_LOCAL_COST` | 0 rows            | No                           | No                   |

### Coverage Thresholds [Confirmed]

| Gap Range             | Status      |
| --------------------- | ----------- |
| No assignments        | `UNCOVERED` |
| gap < -0.25 FTE       | `DEFICIT`   |
| gap > +0.25 FTE       | `SURPLUS`   |
| -0.25 <= gap <= +0.25 | `COVERED`   |

Source: `coverage-engine.ts:64-65`

### Temporal Rules [Confirmed]

| Rule                     | Months                     | Applies To                                                 |
| ------------------------ | -------------------------- | ---------------------------------------------------------- |
| **Augmentation**         | Sep-Dec (months 9-12)      | Base, housing, transport, responsibility premium (NOT HSA) |
| **HSA summer exclusion** | Jul-Aug (months 7-8)       | Teaching staff only (non-teaching receive HSA year-round)  |
| **Ajeer new staff**      | Sep-Dec (months 9-12) only | New (non-Saudi, non-Ajeer-exempt) employees                |

### Financial Precision [Confirmed]

- All monetary calculations use `decimal.js` with `ROUND_HALF_UP`.
- PostgreSQL stores monetary values as `DECIMAL(15,4)`.
- Frontend uses `decimal.js` for display rounding only (via `format-money.ts`).
- The `toDecimalPlaces(4, Decimal.ROUND_HALF_UP)` pattern is used consistently
  in the persist step.

### Salary Encryption [Confirmed]

- 5 salary fields encrypted via `pgp_sym_encrypt` / `pgp_sym_decrypt`.
- Key from Docker secret (`/run/secrets/salary_encryption_key`).
- Decryption happens in raw SQL (`$queryRawUnsafe` with parameterized key).
- Viewer role users cannot see salary data (`salary:view` permission required).

### Optimistic Concurrency [Inferred]

- The calculation pipeline uses `$transaction` for atomic persistence.
- Old calculated data is deleted before new data is inserted (replace pattern).
- No explicit optimistic concurrency (e.g., version counters) on individual
  employee edits. [Needs Validation]

---

## 12. Gaps Between Old Document and Actual Implementation

| ID   | Old Claim                                            | Actual State                                                    | Severity                                     |
| ---- | ---------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| G-01 | 6 tabs UI structure                                  | 2 workspace modes (Teaching / Support & Admin)                  | Critical — wrong mental model                |
| G-02 | Employee status: Active/Pending/Inactive             | Existing/New/Departed                                           | Critical — wrong enum values                 |
| G-03 | GOSI at 12%                                          | 11.75% (Saudi only)                                             | Critical — wrong rate                        |
| G-04 | Food allowance in salary                             | No Food; replaced by ResponsibilityPremium + HSA + Augmentation | Critical — wrong components                  |
| G-05 | 5 database tables                                    | 18+ models                                                      | Major — massively understated                |
| G-06 | Simple calc: salary + GOSI + EOS                     | 10-step pipeline with 6 engines                                 | Major — fundamentally different architecture |
| G-07 | DHG Grille editable per version                      | DHG Rules are read-only master data                             | Major — wrong editability                    |
| G-08 | Slide-out employee detail panel                      | Docked right panel with inspector registry                      | Moderate — different UI pattern              |
| G-09 | KPIs: Headcount/AnnualCost/AvgMonthly/GOSI/Ajeer/EOS | KPIs: Headcount/FTEGap/StaffCost/HSA/HERatio/Recharge           | Major — completely different KPIs            |
| G-10 | No mention of cost modes                             | 3 cost modes (LOCAL_PAYROLL, AEFE_RECHARGE, NO_LOCAL_COST)      | Major — missing feature                      |
| G-11 | No mention of demand/coverage model                  | Full demand-supply-gap model with 4 coverage statuses           | Major — missing core concept                 |
| G-12 | No mention of assignments                            | Staffing assignments are a core data model                      | Major — missing feature                      |
| G-13 | No mention of augmentation                           | Sep-Dec augmentation is a key cost driver                       | Moderate — missing business rule             |
| G-14 | No mention of HSA                                    | HSA engine, eligibility rules, summer exclusion                 | Major — missing feature                      |
| G-15 | Client-side salary encryption                        | Server-side pgcrypto (always was)                               | Minor — incorrectly described                |
| G-16 | No mention of settings sheet                         | 5-6 tab settings sheet with HSA, ORS, cost assumptions          | Major — missing UI                           |

---

## 13. Recommended Documentation Improvements

**Priority 1 (High)**:

1. Add screenshots or screen recordings of the actual UI (Teaching grid, Support grid,
   inspector panel, settings sheet) to supplement the ASCII diagrams.
2. Document the employee import file format and validation rules with a real example.
3. Document the auto-suggest algorithm once it is fully wired.

**Priority 2 (Medium)**:

4. Add a worked example: one complete cycle from enrollment through staffing to PNL,
   showing real numbers at each step.
5. Document demand override workflow (currently API-only, no UI).
6. Document the `hsaBudget`, `heRatio`, and `rechargeCost` KPI cards — are they
   planned for future implementation or already computed elsewhere?

**Priority 3 (Low)**:

7. Add an entity-relationship diagram (ERD) for the staffing data model.
8. Document edge cases: what happens with 0 enrollment, 0 employees, all Departed, etc.
9. Add version history tracking for this document.

---

## 14. Appendix

### A. Glossary

| Term             | Full Name                                        | Definition                                                                                                  |
| ---------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **ORS**          | Obligation Reglementaire de Service              | Weekly teaching hours a teacher must deliver. Varies by service profile.                                    |
| **HSA**          | Heures Supplementaires Annualisees               | Annualized overtime hours compensation for eligible teachers.                                               |
| **FTE**          | Full-Time Equivalent                             | Ratio of total weekly hours to ORS (e.g., 18h demand / 18h ORS = 1.0 FTE).                                  |
| **DHG**          | Dotation Horaire Globale                         | Global hourly allocation — the French system's method for computing teaching demand.                        |
| **GOSI**         | General Organization for Social Insurance        | Saudi government social insurance. Employer rate: 11.75% of gross salary.                                   |
| **Ajeer**        | Ajeer Platform                                   | Saudi work permit system for non-Saudi employees. Comprises an annual levy and monthly fee.                 |
| **EoS**          | End of Service                                   | Saudi labor law severance provision. Tiered formula based on years of service.                              |
| **AEFE**         | Agence pour l'Enseignement Francais a l'Etranger | French agency managing overseas French schools. Recharge employees are paid by AEFE, not locally.           |
| **Band**         | School Band                                      | Grouping of grade levels: Maternelle (PS-GS), Elementaire (CP-CM2), College (6eme-3eme), Lycee (2nde-Term). |
| **YEARFRAC**     | Year Fraction                                    | Excel-compatible day-count function using US 30/360 convention. Used for EoS years-of-service.              |
| **Augmentation** | Salary Augmentation                              | Annual salary increase percentage, applied Sep-Dec to base + allowances (not HSA).                          |

### B. Grade-to-Band Mapping [Confirmed]

| Grade                  | Band        |
| ---------------------- | ----------- |
| PS, MS, GS             | MATERNELLE  |
| CP, CE1, CE2, CM1, CM2 | ELEMENTAIRE |
| 6EME, 5EME, 4EME, 3EME | COLLEGE     |
| 2NDE, 1ERE, TERM       | LYCEE       |

Source: `staffing-settings-sheet.tsx:91-107`

### C. Coverage Status Badge Styling [Confirmed]

| Status      | Color           | Label       |
| ----------- | --------------- | ----------- |
| `COVERED`   | Green (success) | "Covered"   |
| `DEFICIT`   | Red (error)     | "! Deficit" |
| `SURPLUS`   | Amber (warning) | "+ Surplus" |
| `UNCOVERED` | Red (error)     | "Uncovered" |

Source: `staffing-inspector-content.tsx:66-71`, `teaching-master-grid.tsx:70-80`

### D. Cost Categories and Modes [Confirmed]

| Category Key        | Label             | Default Mode |
| ------------------- | ----------------- | ------------ |
| `REMPLACEMENTS`     | Remplacements     | Configurable |
| `FORMATION`         | Formation         | Configurable |
| `RESIDENT_SALAIRES` | Resident Salaires | Configurable |
| `RESIDENT_LOGEMENT` | Resident Logement | Configurable |
| `RESIDENT_PENSION`  | Resident Pension  | Configurable |

Available modes: `FLAT_ANNUAL`, `PERCENT_OF_PAYROLL`, `AMOUNT_PER_FTE`.

Source: `staffing-settings-sheet.tsx:42-54`

### E. Settings Sheet Tab Summary [Confirmed]

| #   | Tab                    | Key Settings                                                                                                          | Saveable |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Service Profiles & HSA | ORS overrides (effectiveOrs per profile), HSA target hours, HSA first hour rate, HSA additional hour rate, HSA months | Yes      |
| 2   | Curriculum             | DHG Rules by band (read-only, link to Master Data)                                                                    | No       |
| 3   | Lycee Group            | Group count, hours/group per discipline (conditional tab)                                                             | Yes      |
| 4   | Cost Assumptions       | 5 categories x (mode, value)                                                                                          | Yes      |
| 5   | Enrollment             | AY2 headcount by grade (read-only, stale warning)                                                                     | No       |
| 6   | Reconciliation         | FTE/cost summary, module navigation                                                                                   | No       |

---

## Document History

| Version | Date       | Author       | Changes                                                                                                                             |
| ------- | ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation                                                                                                           |
| 2.0     | 2026-03-18 | AI Assistant | Complete rewrite reflecting Epic 18-20 redesign. 14-section structure. All claims verified against codebase with confidence labels. |

---

_End of Document_
