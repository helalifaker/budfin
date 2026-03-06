# Feature Spec: Version Management

> Epic: #14 | Phase: 4 — SPECIFY | Status: Draft | Date: 2026-03-06

## Summary

Epic 10 delivers the Version Management system — the foundational isolation layer that every
subsequent planning epic depends on. It enables finance staff to create, name, clone, publish,
lock, archive, and compare budget versions of type Actual, Budget, and Forecast. The Version
Lifecycle state machine (Draft → Published → Locked → Archived) enforces immutability guarantees:
Locked versions cannot be modified by any downstream calculation engine. The Comparison Engine
produces side-by-side monthly variance reports between any two versions in absolute and percentage
terms. This epic also implements the persistent Context Bar component that appears on every
PlanningShell screen to display and switch the active fiscal year, version, comparison version,
academic period, and scenario. Fiscal Period Management provides month-level locking of actuals
with a binding reference to the authoritative Actual version, enabling the Latest Estimate blended
view. PRD reference: Section 7 (FR-VER-001 through FR-VER-006).

## Acceptance Criteria

- [ ] AC-01: Given a user with Admin or BudgetOwner role, when they POST to `/api/v1/versions` with
      a unique name and type Budget or Forecast, then a Draft version is created for the fiscal year,
      `modification_count` is 0, `stale_modules` is empty, and the version appears in the list response.

- [ ] AC-02: Given any user role, when they attempt to create a version with `type: "Actual"`, then
      a 400 validation error is returned ("Actual versions cannot be created manually").

- [ ] AC-03: Given an existing version named "Budget v1" for FY2026, when a user creates a second
      version with the same name for FY2026, then 409 DUPLICATE_VERSION_NAME is returned.

- [ ] AC-04: Given a Draft version, when an Admin or BudgetOwner sends
      `PATCH /api/v1/versions/:id/status` with `new_status: "Published"`, then status becomes
      Published, `published_at` is set to the current timestamp, and the transition is written to
      `audit_entries`.

- [ ] AC-05: Given a Published version, when an Admin or BudgetOwner locks it, then status becomes
      Locked, `locked_at` is set, all planning write endpoints for that version return 409
      VERSION_LOCKED, and the audit trail records the lock event.

- [ ] AC-06: Given a Locked version, when an Admin archives it, then status becomes Archived and
      the version is still retrievable in read-only mode (GET succeeds, all writes return
      VERSION_LOCKED).

- [ ] AC-07: Given a Published or Locked version, when an Admin submits a reverse transition with
      `new_status: "Draft"` and a non-empty `audit_note` (≥10 chars), then the version reverts to
      Draft, the audit note is recorded, and `modification_count` is incremented.

- [ ] AC-08: Given a reverse transition request without an `audit_note` or with `audit_note` less
      than 10 characters, then 400 AUDIT_NOTE_REQUIRED is returned.

- [ ] AC-09: Given a Draft version, when an Admin or BudgetOwner sends `DELETE /api/v1/versions/:id`,
      then the version and all cascade-linked data are permanently deleted and 204 is returned.

- [ ] AC-10: Given a non-Draft version (Published/Locked/Archived), when any role sends DELETE,
      then 409 VERSION_NOT_DRAFT is returned.

- [ ] AC-11: Given a Budget or Forecast version, when an Admin or BudgetOwner sends
      `POST /api/v1/versions/:id/clone` with a unique name, then a new Draft version is created with
      `source_version_id` pointing to the original, and all currently existing version-scoped data
      (monthly_budget_summary rows) is deep-copied within a single Prisma interactive transaction.

- [ ] AC-12: Given an Actual version, when any role sends POST /clone, then 409
      ACTUAL_VERSION_CLONE_PROHIBITED is returned and the Clone button is disabled in the UI.

- [ ] AC-13: Given two versions A and B, when `GET /api/v1/versions/compare?primary=A&comparison=B`
      is called, then for each month 1-12 the response returns `revenue_abs`, `revenue_pct`,
      `staff_costs_abs`, `staff_costs_pct`, `net_profit_abs`, `net_profit_pct`. All arithmetic uses
      Decimal.js. Percentage fields are `null` when the comparison-version amount is 0.

- [ ] AC-14: Given a fiscal year, when `GET /api/v1/fiscal-periods/:fiscalYear` is called, then
      exactly 12 rows are returned (one per calendar month), each with `status`, `actual_version_id`,
      and `locked_at`.

- [ ] AC-15: Given an Admin or BudgetOwner, when they send
      `PATCH /api/v1/fiscal-periods/:fiscalYear/:month/lock` with a valid `actual_version_id`
      referencing a Locked Actual version, then the fiscal period status becomes Locked and
      `locked_at` is set.

- [ ] AC-16: Given a fiscal year with months 1-6 Locked (with Actual version refs) and months 7-12
      Draft, when `GET /api/v1/versions/:id/latest-estimate` is called, then months 1-6 return data
      from the bound Actual versions and months 7-12 return data from the supplied version.

- [ ] AC-17: Given a Draft version that has been modified (any downstream write sets stale flags),
      when `GET /api/v1/versions/:id` is called, then `stale_modules` lists the affected modules (e.g.
      `["REVENUE", "STAFFING"]`).

- [ ] AC-18: Given any user role, when `GET /api/v1/versions/:id` is called, then the response
      includes `created_by_email`, `created_at`, `published_at`, `locked_at`, `modification_count`,
      `data_source`, `source_version_id`, and `stale_modules` (FR-VER-006).

- [ ] AC-19: Given an Editor or Viewer user, when they attempt any mutation endpoint (POST /versions,
      PATCH /status, POST /clone, DELETE, PATCH /fiscal-periods/.../lock), then 403
      INSUFFICIENT_ROLE is returned. The UI hides all mutation controls for these roles.

- [ ] AC-20: Given the Context Bar rendered in PlanningShell, when a user selects a different version
      from the version dropdown, then the URL `?version=` query param is updated, TanStack Query
      invalidates all version-scoped queries, and the page data refreshes to the selected version.

## Stories

| #   | Story                                       | Depends On                | GitHub Issue |
| --- | ------------------------------------------- | ------------------------- | ------------ |
| 1   | DB schema: budget_versions + fiscal_periods | —                         | TBD          |
| 2   | Version CRUD API                            | Story 1                   | TBD          |
| 3   | Version Lifecycle API (state machine)       | Story 2                   | TBD          |
| 4   | Version Clone API                           | Story 2                   | TBD          |
| 5   | Fiscal Period API                           | Story 1, Story 2          | TBD          |
| 6   | Version Comparison API                      | Story 2                   | TBD          |
| 7   | Latest Estimate API                         | Story 5, Story 6          | TBD          |
| 8   | Version List UI                             | Story 2                   | TBD          |
| 9   | Version Create + Clone UI                   | Story 3, Story 4, Story 8 | TBD          |
| 10  | Version Lifecycle Action UI                 | Story 3, Story 8          | TBD          |
| 11  | Version Detail Side Panel UI                | Story 10                  | TBD          |
| 12  | Context Bar Component                       | Story 2                   | TBD          |
| 13  | Fiscal Period Management UI                 | Story 5, Story 12         | TBD          |

## Data Model Changes

```sql
-- budget_versions: central version isolation entity
CREATE TABLE budget_versions (
  id                  SERIAL PRIMARY KEY,
  fiscal_year         SMALLINT NOT NULL,
  name                VARCHAR(100) NOT NULL,
  type                VARCHAR(10) NOT NULL CHECK (type IN ('Actual', 'Budget', 'Forecast')),
  status              VARCHAR(10) NOT NULL DEFAULT 'Draft'
                        CHECK (status IN ('Draft', 'Published', 'Locked', 'Archived')),
  description         TEXT,
  data_source         VARCHAR(12) NOT NULL DEFAULT 'CALCULATED'
                        CHECK (data_source IN ('CALCULATED', 'IMPORTED')),
  source_version_id   INTEGER REFERENCES budget_versions(id) ON DELETE SET NULL,
  modification_count  INTEGER NOT NULL DEFAULT 0,
  stale_modules       TEXT[] NOT NULL DEFAULT '{}',
  created_by_id       INTEGER NOT NULL REFERENCES users(id),
  published_at        TIMESTAMPTZ,
  locked_at           TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_budget_version_name_fy UNIQUE (fiscal_year, name)
);
CREATE INDEX idx_budget_versions_fiscal_year ON budget_versions(fiscal_year);
CREATE INDEX idx_budget_versions_status ON budget_versions(status);

-- fiscal_periods: month-level locking for rolling forecasts (12 rows per fiscal year)
CREATE TABLE fiscal_periods (
  id                  SERIAL PRIMARY KEY,
  fiscal_year         SMALLINT NOT NULL,
  month               SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status              VARCHAR(10) NOT NULL DEFAULT 'Draft'
                        CHECK (status IN ('Draft', 'Locked')),
  actual_version_id   INTEGER REFERENCES budget_versions(id) ON DELETE SET NULL,
  locked_at           TIMESTAMPTZ,
  locked_by_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fiscal_period UNIQUE (fiscal_year, month)
);

-- monthly_budget_summary: stub table populated by calculation engines (Epics 1-5).
-- Epic 10 creates the schema; downstream epics write rows via their calculation engines.
CREATE TABLE monthly_budget_summary (
  id              SERIAL PRIMARY KEY,
  version_id      INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
  month           SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue_ht      DECIMAL(15,4) NOT NULL DEFAULT 0,
  staff_costs     DECIMAL(15,4) NOT NULL DEFAULT 0,
  net_profit      DECIMAL(15,4) NOT NULL DEFAULT 0,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_monthly_summary UNIQUE (version_id, month)
);
CREATE INDEX idx_monthly_summary_version ON monthly_budget_summary(version_id);

-- actuals_import_log: audit trail for Excel/CSV imports into Actual versions
CREATE TABLE actuals_import_log (
  id                SERIAL PRIMARY KEY,
  version_id        INTEGER NOT NULL REFERENCES budget_versions(id),
  module            VARCHAR(12) NOT NULL
                      CHECK (module IN ('REVENUE', 'STAFF_COSTS', 'ENROLLMENT', 'PNL')),
  source_file       VARCHAR(255) NOT NULL,
  validation_status VARCHAR(10) NOT NULL
                      CHECK (validation_status IN ('PENDING', 'VALID', 'INVALID')),
  rows_imported     INTEGER NOT NULL DEFAULT 0,
  imported_by_id    INTEGER NOT NULL REFERENCES users(id),
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Prisma model notes (Prisma 6 patterns):

- Binary fields: none in this epic
- `NotFoundError` removed — use `PrismaClientKnownRequestError` + code `P2025`
- `stale_modules` is `String[]` in Prisma schema (maps to `text[]` in PostgreSQL)

## API Endpoints

| Method | Path                                             | Request                                                         | Response                                        | Auth                        |
| ------ | ------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------- | --------------------------- |
| GET    | `/api/v1/versions`                               | `?fiscalYear&status&cursor`                                     | `{ data: Version[], nextCursor }`               | Bearer (all roles)          |
| POST   | `/api/v1/versions`                               | `{ name, type, description?, source_version_id?, fiscal_year }` | `Version`                                       | Bearer (Admin, BudgetOwner) |
| GET    | `/api/v1/versions/:id`                           | —                                                               | `Version & { stale_modules, created_by_email }` | Bearer (all roles)          |
| PATCH  | `/api/v1/versions/:id/status`                    | `{ new_status, audit_note? }`                                   | `Version`                                       | Bearer (Admin, BudgetOwner) |
| POST   | `/api/v1/versions/:id/clone`                     | `{ name, description? }`                                        | `Version`                                       | Bearer (Admin, BudgetOwner) |
| DELETE | `/api/v1/versions/:id`                           | —                                                               | 204                                             | Bearer (Admin, BudgetOwner) |
| GET    | `/api/v1/versions/compare`                       | `?primary=:id&comparison=:id`                                   | `{ months: MonthlyVariance[] }`                 | Bearer (all roles)          |
| GET    | `/api/v1/versions/:id/latest-estimate`           | —                                                               | `{ months: MonthlyEstimate[] }`                 | Bearer (all roles)          |
| GET    | `/api/v1/fiscal-periods/:fiscalYear`             | —                                                               | `FiscalPeriod[12]`                              | Bearer (all roles)          |
| PATCH  | `/api/v1/fiscal-periods/:fiscalYear/:month/lock` | `{ actual_version_id }`                                         | `FiscalPeriod`                                  | Bearer (Admin, BudgetOwner) |

**Error codes used across these endpoints:**

| Code                              | HTTP | Meaning                                  |
| --------------------------------- | ---- | ---------------------------------------- |
| `DUPLICATE_VERSION_NAME`          | 409  | Name already exists for this fiscal year |
| `INVALID_TRANSITION`              | 409  | State machine violation                  |
| `AUDIT_NOTE_REQUIRED`             | 400  | Reverse transition missing audit note    |
| `VERSION_NOT_DRAFT`               | 409  | Attempted delete on non-Draft            |
| `VERSION_LOCKED`                  | 409  | Write attempt on Locked/Archived version |
| `ACTUAL_VERSION_CLONE_PROHIBITED` | 409  | Clone attempted on Actual type           |
| `VERSION_IN_USE`                  | 409  | Version referenced by active job         |
| `INSUFFICIENT_ROLE`               | 403  | Role cannot perform mutation             |

## UI/UX Specification

> Source: `docs/ui-ux-spec/02-version-management.md` | Cross-cutting: `docs/ui-ux-spec/00-global-framework.md`, `docs/ui-ux-spec/00b-workspace-philosophy.md`

### Shell & Layout

**ManagementShell** — no context bar, no docked right panel (Global Framework §12.2).

```text
+--------+--------------------------------------------------------------+
|        | Module Toolbar (48px, sticky)                                |
| Side-  |  [Version Management h1]  [FY: Select]  [Type]  [Status]   |
| bar    |  [Search 200px]                      [Compare] [+ New Version]|
|        +--------------------------------------------------------------+
|        |                                                              |
|        |    TanStack Table v8 + shadcn/ui <Table>                    |
|        |    Name | Type | Status | Data Source | Created By | ...    |
|        |    ─────────────────────────────────────────────────────── |
|        |    Rows: 36px height, alternating bg, hover state           |
|        |    Actions column: MoreHorizontal overflow menu             |
|        |                                                              |
+--------+--------------------------------------------------------------+
```

Full workspace width (sidebar to right edge). No virtual scrolling (ADR-016). Table fills
available height with standard overflow scroll.

### Key Components

| Component                                | Type                       | Source          | Notes                                                                 |
| ---------------------------------------- | -------------------------- | --------------- | --------------------------------------------------------------------- |
| Module Toolbar                           | Custom layout              | §02 §4          | Sticky 48px, flexbox row, `--workspace-border` bottom                 |
| Fiscal Year `<Select>`                   | shadcn/ui Select           | §02 §4          | Width 120px; replaces context bar FY for this module                  |
| Type filter `<Select>`                   | shadcn/ui Select           | §02 §4          | All/Actual/Budget/Forecast; client-side filter                        |
| Status filter `<Select>`                 | shadcn/ui Select           | §02 §4          | All/Draft/Published/Locked/Archived; client-side                      |
| Search `<Input>`                         | shadcn/ui Input            | §02 §4          | 200px; debounced 300ms; filters by version name                       |
| Compare `<Button variant="outline">`     | shadcn/ui Button           | §02 §4          | Lucide `Columns` icon; visible all roles                              |
| New Version `<Button variant="default">` | shadcn/ui Button           | §02 §4          | Hidden for Editor/Viewer                                              |
| Version Table                            | TanStack Table v8          | §02 §5          | 9 columns; resizable Name + Created By cols                           |
| Type badge                               | Custom inline-flex         | §02 §5.3        | Color dot 8px + label: ACT/BUD/FC; no background                      |
| Status badge                             | Custom pill                | §02 §5.4        | Filled pill: Draft=gray, Published=blue, Locked=violet, Archived=gray |
| Row actions `<DropdownMenu>`             | shadcn/ui DropdownMenu     | §02 §5.5        | View/Clone/Publish/Lock/Archive/Revert/Delete                         |
| Create Version side panel                | shadcn/ui Sheet (480px)    | §02 §6          | 4 fields; fiscal year shown as read-only label                        |
| Clone `<Dialog>`                         | shadcn/ui Dialog (480px)   | §02 §7.1        | Name + description; progress bar during clone                         |
| Publish `<AlertDialog>`                  | shadcn/ui AlertDialog      | §02 §7.2        | Simple confirm; no extra fields                                       |
| Lock `<AlertDialog>`                     | shadcn/ui AlertDialog      | §02 §7.3        | Lock icon in confirm button                                           |
| Archive `<AlertDialog>`                  | shadcn/ui AlertDialog      | §02 §7.4        | Standard confirm                                                      |
| Revert to Draft `<Dialog>`               | shadcn/ui Dialog (480px)   | §02 §7.5        | Required audit note textarea (10-500 chars)                           |
| Delete `<AlertDialog>` with name confirm | shadcn/ui AlertDialog      | §02 §7.6        | Confirm button disabled until name typed exactly                      |
| Version Detail side panel                | shadcn/ui Sheet (480px)    | §02 §8          | Overview + Metadata + Stale Modules + Lifecycle History               |
| Compare selection `<Dialog>`             | shadcn/ui Dialog (520px)   | §02 §9.1        | Primary + Comparison version selects                                  |
| Context Bar                              | Custom persistent header   | §00-global §3   | FY/Version/Compare/Period/Scenario dropdowns; URL-synced              |
| Fiscal Period grid                       | TanStack Table v8 + shadcn | §02 §(implicit) | 12-row grid; month/status/lock action                                 |
| Empty state                              | Custom                     | §02 §10.1       | Lucide `Layers` icon; "No versions for FY[year]"                      |
| Skeleton table                           | shadcn/ui Skeleton         | §02 §10.2       | 10-row shimmer; 200ms delay                                           |

### User Flows

**Create Version:**
Admin/BudgetOwner → Click "+ New Version" → Create Side Panel opens → Fill Name + Type (+ optional
Description + Source Version) → Click "Create" → POST /api/v1/versions → Success: panel closes,
new row flashes `--color-info-bg`, toast "Version '[name]' created"

**Clone Version:**
Admin/BudgetOwner → Row action "Clone" → Clone Dialog opens → Fill Name → Click "Clone" →
POST /api/v1/versions/:id/clone → Progress bar shows "Copying version data..." → Success: dialog
closes, new Draft row added, toast "Version '[name]' cloned from '[source]'"

**Publish Version:**
Admin/BudgetOwner → Row action "Publish" → Publish AlertDialog → Click "Publish" →
PATCH /status {new_status: "Published"} → Row status badge updates to Published (optimistic), toast
"Version '[name]' published"

**Lock Version:**
Admin/BudgetOwner → Row action "Lock" → Lock AlertDialog → Click "Lock Version" →
PATCH /status {new_status: "Locked"} → Row status badge + locked_at column update, toast "Version
'[name]' locked"

**Revert to Draft:**
Admin → Row action "Revert to Draft" → Revert Dialog opens → Fill audit note (≥10 chars) → Click
"Revert to Draft" → PATCH /status {new_status: "Draft", audit_note: "..."} → Row status badge
updates, toast "Version '[name]' reverted to Draft"

**Delete Draft:**
Admin/BudgetOwner → Row action "Delete" → Delete AlertDialog → Type version name exactly →
"Delete Version" button enables → Click → DELETE /api/v1/versions/:id → Row fades out (200ms
animation), toast "Version '[name]' deleted"

**Compare Versions:**
Any role → Click "Compare" toolbar button → Compare Dialog → Select Primary + Comparison versions
→ Click "Compare" → Navigate to `/planning?fy=X&version=Y&compare=Z&period=full&scenario=base`

**View Details:**
Any role → Row action "View Details" OR click version name → Detail side panel slides in →
Overview + Metadata + Stale Modules (if any) + Lifecycle History timeline

### Interaction Patterns

- **No inline editing** — this module is ManagementShell with form-based editing only (side panels
  and dialogs). Reference: Global Framework §12.2.
- **Optimistic updates** for status transitions (Publish, Lock, Archive, Revert): update row badge
  immediately, roll back on API error. No optimistic update for Create or Clone (wait for server).
- **Delete confirmation** requires typing the exact version name (case-sensitive) before the
  destructive button enables.
- **Sort** on all columns except Data Source, Mod Count, Actions. Default: `created_at` DESC.
- **Client-side filters** for Type and Status (no re-fetch); debounced 300ms search on name.
- **Keyboard:** `Ctrl+Shift+N` = new version panel; `Enter` = open detail panel for focused row;
  `Delete` = open delete dialog for Draft rows; `Escape` = close panel/dialog; `↑↓` = navigate rows.

### Accessibility Requirements

- Table: `role="table"`, `role="row"`, `role="columnheader"`, `role="cell"` — standard table
  semantics (not grid; no inline editing). Sortable headers carry `aria-sort`.
- Actions menu trigger: `aria-haspopup="menu"`, `aria-label="Actions for [version name]"`.
- Status badges: `aria-label="Status: Published"`. Type badges: `aria-label="Type: Budget"`.
- Side panels: `role="complementary"`, `aria-label="Version details"`, focus trap on open.
- Dialogs: `role="alertdialog"` for confirmations, `role="dialog"` for form dialogs; focus trap.
- Toasts: `aria-live="polite"` on the toast container.
- All form fields have associated `<label>` or `aria-label`.
- Color contrast: all status badge colors (Draft #4B5563, Published #2563EB, Locked #7C3AED,
  Archived #6B7280) against their tint backgrounds meet WCAG AA 4.5:1.

### Responsive / Viewport

BudFin targets desktop (min 1280px). No mobile layout required. Table columns resizable by user
drag; Name and Created By columns have `minWidth: 120px`. At 1280px the Actions column stays
visible; lower priority columns (Mod Count, Published At, Locked At) may be hidden via column
visibility toggle if needed.

## Edge Cases Cross-Reference

From `docs/edge-cases/EDGE_CASE_QUICK_REFERENCE.csv`

| Case ID | Description                                                        | Handling                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PO-007  | Fee grid update mid-year; retroactive application to a version     | Version write endpoints accept updates only to Draft versions. On any input change, the version's `stale_modules` array is updated to flag dependent modules (FR-VER-001, FR-VER-003). |
| PO-008  | Version comparison with different enrollment counts                | Comparison engine returns null percentage variance when comparison-version amount is 0. Monthly rows with both values 0 return 0 absolute and null percentage.                         |
| PO-012  | EoS calculation with retroactive joining date update               | Joining date changes mark STAFFING as stale in `stale_modules`. Locked versions reject the change with VERSION_LOCKED.                                                                 |
| PO-015  | Comparison report with deleted line items in one version           | monthly_budget_summary uses ON DELETE CASCADE; missing rows treated as 0 in variance calculation. Null vs 0 distinction is documented in API response schema.                          |
| PO-017  | Scenario base parameters locked while assumptions change           | Locked versions reject assumption writes (VERSION_LOCKED). Only Draft versions accept parameter changes.                                                                               |
| PO-021  | Lock version after publication; subsequent edit requests           | Published and Locked versions return VERSION_LOCKED for any data mutation. The UI hides edit controls for non-Draft versions. Reverting to Draft requires audit note (AC-07).          |
| PO-029  | Master data changes (grade levels); retroactive impact on versions | Grade level changes in Master Data (Epic 7) mark REVENUE, STAFFING, PNL as stale in all affected Draft versions via the stale_modules mechanism. Locked versions are unaffected.       |
| PO-032  | Version comparison with different academic calendar structures     | Comparison is month-indexed (1-12 Gregorian); no academic calendar interpretation in the comparison engine itself. Upstream calculation engines handle calendar mapping.               |
| PO-033  | Deleted employee historical data during staff cost comparison      | monthly_budget_summary is version-scoped and immutable for Locked versions. Clone creates a point-in-time snapshot; deleted employees are preserved in the snapshot's summary data.    |

## Out of Scope

- **Multi-currency support** — BudFin is SAR-only in v1 (see PO-022). Version metadata stores no
  currency field.
- **Version-level permissions** — RBAC is role-based globally; no per-version access control.
- **Automatic Actual version creation** — Actual versions are created by the actuals import workflow
  (in later epics). Epic 10 only creates the schema and import log table.
- **Cloning Actual versions** — prohibited by design (FR-VER-005).
- **Bulk version operations** — no bulk publish/lock/archive in v1.
- **Version branching beyond one level** — clone lineage is tracked via `source_version_id` but
  tree-visualization and multi-generation diff are deferred to v2.
- **Populating monthly_budget_summary rows** — the stub table is created in Epic 10 but rows are
  written by the calculation engines in Epics 1-5 (Revenue, Staffing, P&L). Comparison API returns
  empty results until those epics are implemented.
- **Context Bar Scenario selector** — the Scenario dropdown in the context bar is a UI stub in
  Epic 10; Scenario Modeling logic is deferred to Epic 6.

## Open Questions

_(none — all questions resolved)_

## Planner Agent Sign-Off

- [x] No open questions
- [x] Acceptance criteria are testable
- [x] Edge cases cross-referenced
- [x] Data model complete
- [x] API contract complete
- [x] UI/UX specification complete
