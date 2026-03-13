# Feature Spec: Revenue Workspace Redesign (Epic 16)

> **Epic:** #16 — Revenue Workspace Redesign
> **PRD Coverage:** FR-REV-020 through FR-REV-040
> **Status:** Draft
> **Date:** 2026-03-14
> **Predecessor:** Epic 2 — Revenue Module (DONE)
> **Supersedes:** Tab-based layout in `docs/ui-ux-spec/04-revenue.md`
> **Design Brief:** `docs/plans/2026-03-13-revenue-page-redesign.md`

---

## Summary

Epic 16 redesigns the Revenue page from a `WorkspaceBoard` with 6 collapsible card sections
(148 lines) into a single-viewport workspace matching the Enrollment page pattern: compact
forecast grid, fullscreen settings dialog, right panel inspector, KPI ribbon (5 cards), status
strip, setup checklist, and version banners. This is a UX architecture overhaul — the data
model, calculation engine, and CRUD endpoints from Epic 2 remain unchanged except for:
DiscountPolicy nationality removal (schema simplification), a new readiness endpoint, and
downstream stale marking on calculate.

**In scope:**

- Smart Forecast Grid with 4 view modes (Category, Grade, Nationality, Tariff)
- Fullscreen settings dialog with 4 tabs (Fee Grid, Tariff Assignment, Discounts, Other Revenue)
- Right panel inspector with Recharts charts and multi-dimensional breakdowns
- KPI ribbon (5 cards), status strip, version banners, setup checklist
- DiscountPolicy schema simplification (drop nationality column)
- Revenue readiness endpoint (4 area checks)
- Downstream stale marking (STAFFING + PNL) on calculate

**Out of scope:**

- Parameters tab — deferred to P&L Epic
- Comparison mode — deferred to future iteration (D11)
- PDF export — deferred to Epic 11 (Reporting)
- Manual override column — no business case (D5)
- Revenue engine changes — engine logic unchanged from Epic 2

---

## Acceptance Criteria

### Discount Model Simplification (FR-REV-035)

- [ ] AC-01: Given a database with all DiscountPolicy rows having `nationality IS NULL`, when the
      migration runs, then the `nationality` column is dropped and the unique constraint changes to
      `(versionId, tariff)`.
- [ ] AC-02: Given a database with any DiscountPolicy row having `nationality IS NOT NULL`, when
      the migration runs, then it aborts with error
      `"Cannot drop nationality: N rows have non-null values. Consolidate before retrying."`.
- [ ] AC-03: Given the updated PUT `/discounts` endpoint, when called with
      `{ entries: [{ tariff: "RP", discountRate: "0.250000" }] }`, then the upsert succeeds using the
      `versionId_tariff` compound key.
- [ ] AC-04: Given the updated PUT `/discounts` endpoint, when called with a body containing a
      `nationality` field, then the field is silently stripped (Zod `.strip()`) and the upsert
      succeeds.
- [ ] AC-05: Given the updated GET `/discounts` endpoint, response entries contain only `tariff`
      and `discountRate` fields — no `nationality` field.
- [ ] AC-06: `pnpm typecheck` passes with zero errors across all workspaces after
      `DiscountEntry.nationality` removal.

### Revenue Readiness Endpoint (FR-REV-034)

- [ ] AC-07: Given a version with all 4 areas complete, when GET
      `/versions/:id/revenue/readiness` is called, then response contains `overallReady: true` and
      `readyCount: 4`.
- [ ] AC-08: Given a version with no revenue data configured, when GET readiness is called, then
      response contains `overallReady: false` and `readyCount: 0`.
- [ ] AC-09: Given a version with only discounts and other revenue configured, when GET readiness
      is called, then `readyCount: 2`, `feeGrid.ready: false`, `tariffAssignment.ready: false`.
- [ ] AC-10: Given a non-existent versionId, when GET readiness is called, then 404
      `VERSION_NOT_FOUND` is returned.
- [ ] AC-11: Given any authenticated user (including Viewer role), GET readiness succeeds — no
      RBAC restriction beyond authentication.
- [ ] AC-12: Readiness endpoint responds in < 200ms for a version with 90 fee grid rows, 20 other
      revenue items, and 2 discount policies.

### Downstream Stale Marking (FR-REV-036)

- [ ] AC-13: Given a version with REVENUE in staleModules, when POST `calculate/revenue`
      succeeds, then staleModules contains STAFFING and PNL but does not contain REVENUE.
- [ ] AC-14: Given a version with empty staleModules, when POST `calculate/revenue` succeeds,
      then staleModules contains exactly `['STAFFING', 'PNL']`.
- [ ] AC-15: Given a version that already has STAFFING in staleModules, when POST
      `calculate/revenue` succeeds, then staleModules still contains STAFFING and PNL (idempotent).

### Revenue Forecast Grid (FR-REV-020, FR-REV-021, FR-REV-022, FR-REV-023)

- [ ] AC-16: Category view renders exactly 6 rows (Tuition Fees, Discount Impact, Registration
      Fees, Activities & Services, Examination Fees, TOTAL OPERATING REV) from
      `executiveSummary.rows`.
- [ ] AC-17: Grade view renders 15 grade rows + 4 band subtotal rows (Maternelle, Elementaire,
      College, Lycee) + 1 grand total row = 20 rows. Band grouping uses `GRADE_BAND_MAP`.
- [ ] AC-18: Nationality view renders 4 rows (Francais, Nationaux, Autres, Grand Total).
- [ ] AC-19: Tariff view renders 4 rows (Plein, RP, R3+, Grand Total).
- [ ] AC-20: Period toggle AY1 shows only columns for months 1-6; AY2 shows only months 9-12; FY
      shows all 12 months. The API always returns all 12; filtering is frontend-only.
- [ ] AC-21: Negative values display in parentheses with `text-(--color-error)` styling.
- [ ] AC-22: Zero values in months 7-8 (summer) display as dash (`-`) in `text-(--text-muted)`.
- [ ] AC-23: Grand total row has `bg-(--workspace-bg-muted)`, `font-weight: 700`, and
      `position: sticky; bottom: 0`.
- [ ] AC-24: All monetary values use fr-FR locale with thousands separator and 0 decimal places.
- [ ] AC-25: Clicking a non-total row updates `revenue-selection-store` with the row's `label`
      and current `viewMode`.

### Revenue Inspector (FR-REV-029, FR-REV-037)

- [ ] AC-26: When no row is selected and `activePage === 'revenue'`, the right panel Details tab
      shows: Recharts composition chart, Recharts monthly trend bar chart (12 bars), readiness
      checklist (4 areas from readiness endpoint), and quick links section.
- [ ] AC-27: When a row is selected, the inspector shows: header with selected label + FY total +
      % of revenue, breakdowns by the OTHER dimensions than the current grid view (per D4 dimension
      table), and a monthly trend sparkline.
- [ ] AC-28: "Edit in Settings" shortcuts call
      `useRevenueSettingsDialogStore().open(targetTab)` to open the correct settings tab.

### KPI Ribbon + Status Strip (FR-REV-030, FR-REV-031, FR-REV-039)

- [ ] AC-29: KPI ribbon renders 5 cards in order: Gross Tuition HT (blue border), Total
      Discounts (red border), Net Revenue HT (green border), Other Revenue (default border), Total
      Operating Revenue (green border).
- [ ] AC-30: Card #5 subtitle shows `SAR {avgPerStudent} avg/student` computed as
      `Decimal(totalOperatingRevenue).div(headcount).toFixed(0)` where headcount is the sum of all
      AY1 entries from `useHeadcount(versionId)`.
- [ ] AC-31: When `isStale` is true, all KPI cards show `opacity-60` class and a pulsing amber
      dot (`animate-pulse bg-(--color-stale)`).
- [ ] AC-32: Status strip renders 4 elements: last calculated timestamp (formatted with date-fns
    - AST timezone), upstream enrollment stale status, downstream stale modules list, and
      configuration readiness summary.
- [ ] AC-33: Status strip has `role="status"` and `aria-live="polite"`.

### Setup Checklist (FR-REV-033)

- [ ] AC-34: Checklist displays 4 area rows with status from readiness endpoint, each with an
      [Edit] button.
- [ ] AC-35: Checklist auto-opens when: `sessionStorage.getItem('revenue-setup-dismissed-{versionId}')` is null AND `version.lastCalculatedAt` is null AND
      `readiness.overallReady` is false.
- [ ] AC-36: [Skip for Now] stores `'true'` in
      `sessionStorage('revenue-setup-dismissed-{versionId}')` and closes the checklist.
- [ ] AC-37: [Edit] buttons open the settings dialog to the matching tab: Fee Grid -> `feeGrid`,
      Tariff Assignment -> `tariffAssignment`, Discounts -> `discounts`, Other Revenue ->
      `otherRevenue`.
- [ ] AC-38: Footer shows `"{readyCount} of 4 complete"`.
- [ ] AC-39: Focus moves to checklist heading on auto-open; Escape key dismisses.

### Settings Dialog (FR-REV-024 through FR-REV-028, FR-REV-040)

- [ ] AC-40: Dialog renders at `width: 90vw; height: 90vh` centered, with a left sidebar
      containing 4 tab buttons and a content area rendering the active tab's component.
- [ ] AC-41: Fee Grid tab wraps `FeeGridTab` component; Tariff Assignment wraps
      `TariffAssignmentGrid`; Discounts wraps `DiscountsTab` (without nationality fields); Other
      Revenue wraps `OtherRevenueTab`.
- [ ] AC-42: Clicking a tab's [Save] calls the appropriate PUT endpoint, clears that tab's dirty
      set in `revenue-settings-dirty-store`, and adds REVENUE to `version.staleModules`.
- [ ] AC-43: Switching to a new tab while the current tab has dirty fields shows an inline
      warning banner: "You have unsaved changes. Switch anyway?" with [Stay] and [Switch] actions.
- [ ] AC-44: Clicking [X Close] while any tab has dirty fields shows a confirmation dialog:
      "Unsaved changes in {dirtyTabNames}. Discard and close?" with [Cancel] and [Discard] actions.
- [ ] AC-45: When `isViewer` is true: all form inputs have `disabled` attribute, [Save] buttons
      are not rendered, and a `ViewerBanner` appears at the top of the dialog.
- [ ] AC-46: Dialog has `role="dialog"`, `aria-modal="true"`, `aria-label="Revenue Settings"`.
      Focus is trapped inside; Escape triggers close (with dirty check). On close, focus returns to
      the triggering button.
- [ ] AC-47: Tabs use `role="tablist"`, `role="tab"` with `aria-selected`, and `role="tabpanel"`
      with `aria-labelledby`.

### Page Assembly (FR-REV-032, FR-REV-038)

- [ ] AC-48: Revenue page renders in order from top: version banners (VersionLockBanner when
      `version.status !== 'Draft'`, ImportedBanner when `version.dataSource === 'IMPORTED'`,
      ViewerBanner when `user.role === 'Viewer'`), toolbar, KPI ribbon, status strip, forecast grid.
- [ ] AC-49: `setActivePage('revenue')` is called on mount; `setActivePage(null)` on unmount.
- [ ] AC-50: Toolbar contains: view toggle (Category/Grade/Nationality/Tariff), period toggle
      (AY1/AY2/FY2026), Export button, Revenue Settings button (label: "View Settings" for Viewer),
      Setup button, Calculate Revenue button (hidden for Viewer).
- [ ] AC-51: Export generates CSV and XLSX of the current grid view data using the existing
      export utility pattern.
- [ ] AC-52: When `versionId` is null, page shows centered message: "Select a version from the
      context bar to begin revenue planning."
- [ ] AC-53: No references to `WorkspaceBoard` or `WorkspaceBlock` remain in revenue page
      imports.
- [ ] AC-54: All new code achieves >= 80% test coverage.

---

## Stories

### Dependency DAG

```text
S1 ──→ S3 ──→ S4 ──→ S5 ──→ S8
       ↗                      ↑
S2 ───        S6 ──────────→ S8
                              ↑
              S7 ──────────→ S8
```

S1 and S2 have no dependencies and can run in parallel. S3 depends on S1. S4 depends on S3.
S5 depends on S4. S6 and S7 are independent of S3-S5. S8 assembles all components.

### S1: Discount Model Simplification

| Property | Value                                     |
| -------- | ----------------------------------------- |
| Type     | Full-stack (schema + API + types + tests) |
| ACs      | AC-01 through AC-06                       |
| FRs      | FR-REV-035                                |

**Files:**

| File                                                             | Action                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                                  | Modify: remove nationality, update @@unique and @@index                                            |
| `apps/api/prisma/migrations/YYYYMMDD_drop_discount_nationality/` | Create: migration SQL with pre-assertion                                                           |
| `apps/api/src/routes/revenue/discounts.ts`                       | Modify: remove nationality from schema (use `.strip()`), upsert key, orderBy, GET response mapping |
| `packages/types/src/revenue.ts`                                  | Modify: remove nationality from DiscountEntry                                                      |
| `apps/api/src/routes/revenue/discounts.test.ts`                  | Modify: update tests for no-nationality behavior                                                   |

### S2: Downstream Stale Marking

| Property | Value               |
| -------- | ------------------- |
| Type     | Backend             |
| ACs      | AC-13 through AC-15 |
| FRs      | FR-REV-036          |

**Files:**

| File                                            | Action                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/revenue/calculate.ts`      | Modify: add `currentStale.add('STAFFING'); currentStale.add('PNL');` after `currentStale.delete('REVENUE')` |
| `apps/api/src/routes/revenue/calculate.test.ts` | Modify: add tests for downstream stale marking                                                              |

### S3: Revenue Readiness Endpoint + Setup Checklist

| Property   | Value                                               |
| ---------- | --------------------------------------------------- |
| Type       | Full-stack (API + types + hook + component + tests) |
| ACs        | AC-07 through AC-12, AC-34 through AC-39            |
| FRs        | FR-REV-033, FR-REV-034                              |
| Blocked by | S1 (DiscountEntry type change)                      |

**Files:**

| File                                                       | Action                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/types/src/revenue.ts`                            | Modify: add RevenueReadinessResponse and related interfaces |
| `apps/api/src/routes/revenue/readiness.ts`                 | Create: GET readiness endpoint with 4 area checks           |
| `apps/api/src/routes/revenue/readiness.test.ts`            | Create: tests for all-complete, empty, partial states       |
| `apps/api/src/routes/revenue/index.ts`                     | Modify: register readiness route                            |
| `apps/web/src/hooks/use-revenue.ts`                        | Modify: add useRevenueReadiness hook                        |
| `apps/web/src/components/revenue/setup-checklist.tsx`      | Create: non-linear checklist overlay                        |
| `apps/web/src/components/revenue/setup-checklist.test.tsx` | Create: auto-open, sessionStorage, deep-link tests          |

### S4: Revenue Forecast Grid

| Property   | Value                                          |
| ---------- | ---------------------------------------------- |
| Type       | Frontend                                       |
| ACs        | AC-16 through AC-25                            |
| FRs        | FR-REV-020, FR-REV-021, FR-REV-022, FR-REV-023 |
| Blocked by | S3 (readiness types needed for view mode type) |

**Files:**

| File                                                     | Action                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `apps/web/src/stores/revenue-selection-store.ts`         | Create: selected row + view mode state                  |
| `apps/web/src/hooks/use-revenue.ts`                      | Modify: add `'category'` to groupBy union type          |
| `apps/web/src/components/revenue/forecast-grid.tsx`      | Create: TanStack Table v8 with 4 view modes             |
| `apps/web/src/components/revenue/forecast-grid.test.tsx` | Create: view mode row counts, period toggle, formatting |

### S5: Revenue Inspector + Right Panel

| Property   | Value                                                    |
| ---------- | -------------------------------------------------------- |
| Type       | Frontend                                                 |
| ACs        | AC-26 through AC-28                                      |
| FRs        | FR-REV-029, FR-REV-037                                   |
| Blocked by | S4 (selection store + grid must exist for row selection) |

**Files:**

| File                                                         | Action                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `apps/web/src/components/revenue/revenue-inspector.tsx`      | Create: default view + active view with Recharts charts       |
| `apps/web/src/components/revenue/revenue-inspector.test.tsx` | Create: default/active view, chart rendering, deep-link tests |

### S6: Revenue KPI Ribbon + Status Strip

| Property | Value                              |
| -------- | ---------------------------------- |
| Type     | Frontend                           |
| ACs      | AC-29 through AC-33                |
| FRs      | FR-REV-030, FR-REV-031, FR-REV-039 |

**Files:**

| File                                                            | Action                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/web/src/components/revenue/kpi-ribbon.tsx`                | Modify: 4 -> 5 cards, string props, accent borders, avg/student |
| `apps/web/src/components/revenue/kpi-ribbon.test.tsx`           | Create: 5 cards, values, stale indicator                        |
| `apps/web/src/components/revenue/revenue-status-strip.tsx`      | Create: 4-element status bar                                    |
| `apps/web/src/components/revenue/revenue-status-strip.test.tsx` | Create: all 4 elements, a11y roles                              |

### S7: Revenue Settings Dialog

| Property | Value                                     |
| -------- | ----------------------------------------- |
| Type     | Frontend                                  |
| ACs      | AC-40 through AC-47                       |
| FRs      | FR-REV-024 through FR-REV-028, FR-REV-040 |

**Files:**

| File                                                               | Action                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `apps/web/src/stores/revenue-settings-dialog-store.ts`             | Create: open/close/setTab state                        |
| `apps/web/src/stores/revenue-settings-dirty-store.ts`              | Create: per-tab dirty tracking                         |
| `apps/web/src/components/revenue/revenue-settings-dialog.tsx`      | Create: fullscreen dialog with 4 tabs                  |
| `apps/web/src/components/revenue/revenue-settings-dialog.test.tsx` | Create: tabs render, dirty tracking, viewer mode, a11y |

### S8: Revenue Page Assembly + Polish

| Property   | Value                                                           |
| ---------- | --------------------------------------------------------------- |
| Type       | Full-stack (page rewrite + fixtures + docs + integration tests) |
| ACs        | AC-48 through AC-54                                             |
| FRs        | FR-REV-032, FR-REV-038                                          |
| Blocked by | S3, S4, S5, S6, S7                                              |

**Files:**

| File                                         | Action                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| `apps/web/src/pages/planning/revenue.tsx`    | Rewrite: compose all components into workspace layout |
| `data/fixtures/fy2026-expected-revenue.json` | Regenerate: match Validation Data section             |
| `docs/ui-ux-spec/04-revenue.md`              | Modify: add supersession note                         |

---

## Data Model Changes

### DiscountPolicy Schema Migration

**Current schema** (`apps/api/prisma/schema.prisma` lines 626-645):

```prisma
model DiscountPolicy {
  id           Int      @id @default(autoincrement())
  versionId    Int      @map("version_id")
  tariff       String   @db.VarChar(10)
  nationality  String?  @db.VarChar(10)    // DROP THIS
  discountRate Decimal  @map("discount_rate") @db.Decimal(7, 6)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdBy    Int      @map("created_by")
  updatedBy    Int?     @map("updated_by")

  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  creator User          @relation("DiscountCreator", fields: [createdBy], references: [id])
  updater User?         @relation("DiscountUpdater", fields: [updatedBy], references: [id])

  @@unique([versionId, tariff, nationality], map: "uq_discount_policy")
  @@index([versionId, tariff, nationality], map: "idx_discount_policies_calc")
  @@index([createdBy], map: "idx_discount_policies_created_by")
  @@map("discount_policies")
}
```

**Target schema:**

```prisma
model DiscountPolicy {
  id           Int      @id @default(autoincrement())
  versionId    Int      @map("version_id")
  tariff       String   @db.VarChar(10)
  discountRate Decimal  @map("discount_rate") @db.Decimal(7, 6)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz
  createdBy    Int      @map("created_by")
  updatedBy    Int?     @map("updated_by")

  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  creator User          @relation("DiscountCreator", fields: [createdBy], references: [id])
  updater User?         @relation("DiscountUpdater", fields: [updatedBy], references: [id])

  @@unique([versionId, tariff], map: "uq_discount_policy")
  @@index([versionId, tariff], map: "idx_discount_policies_calc")
  @@index([createdBy], map: "idx_discount_policies_created_by")
  @@map("discount_policies")
}
```

**Migration SQL:**

```sql
-- Pre-assertion: abort if any rows have non-null nationality
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM discount_policies WHERE nationality IS NOT NULL) > 0 THEN
    RAISE EXCEPTION 'Cannot drop nationality: % rows have non-null values. Consolidate before retrying.',
      (SELECT COUNT(*) FROM discount_policies WHERE nationality IS NOT NULL);
  END IF;
END $$;

-- Drop existing constraints
ALTER TABLE "discount_policies" DROP CONSTRAINT "uq_discount_policy";
DROP INDEX IF EXISTS "idx_discount_policies_calc";

-- Drop column
ALTER TABLE "discount_policies" DROP COLUMN "nationality";

-- Add new constraints
ALTER TABLE "discount_policies"
  ADD CONSTRAINT "uq_discount_policy" UNIQUE ("version_id", "tariff");
CREATE INDEX "idx_discount_policies_calc" ON "discount_policies" ("version_id", "tariff");
```

**No other schema changes.** All other revenue tables remain unchanged.

---

## API Endpoints

### New Endpoints

#### GET `/api/v1/versions/:versionId/revenue/readiness`

| Property | Value                                       |
| -------- | ------------------------------------------- |
| RBAC     | All authenticated (`app.authenticate` only) |
| Params   | `versionId: integer (positive)`             |
| Query    | None                                        |

**Response 200:**

```json
{
    "feeGrid": { "total": 90, "complete": 45, "ready": false },
    "tariffAssignment": { "reconciled": true, "ready": true },
    "discounts": { "rpRate": "0.250000", "r3Rate": "0.100000", "ready": true },
    "otherRevenue": { "total": 20, "configured": 20, "ready": true },
    "overallReady": false,
    "readyCount": 3,
    "totalCount": 4
}
```

**Area check logic:**

| Area             | Query                                                              | Ready When              |
| ---------------- | ------------------------------------------------------------------ | ----------------------- |
| feeGrid          | `COUNT(*)` WHERE versionId; `COUNT(*)` WHERE tuitionHt IS NOT NULL | complete == total       |
| tariffAssignment | enrollment_details exist AND tariff weights reconcile              | reconciled == true      |
| discounts        | `SELECT` WHERE versionId AND tariff IN ('RP','R3+')                | Both rates non-null > 0 |
| otherRevenue     | `COUNT(*)` WHERE versionId; `COUNT(*)` WHERE annualAmount > 0      | configured == total     |

**Error responses:**

| Status | Code              | When                 |
| ------ | ----------------- | -------------------- |
| 404    | VERSION_NOT_FOUND | Version ID not found |

### Modified Endpoints

#### PUT `/api/v1/versions/:versionId/discounts` (MODIFIED)

Remove `nationality` from request body schema. Use Zod `.strip()` to silently remove any
`nationality` field sent by older clients.

**New request body schema:**

```typescript
const discountEntrySchema = z
    .object({
        tariff: z.enum(['RP', 'R3+']),
        discountRate: z.string().regex(/^\d+(\.\d{1,6})?$/),
    })
    .strip();
```

Upsert key changes from `versionId_tariff_nationality` to `versionId_tariff`. Remove
`nationality` from `create` data and `orderBy` in GET handler.

#### GET `/api/v1/versions/:versionId/discounts` (MODIFIED)

Response entries no longer include `nationality` field.

#### POST `/api/v1/versions/:versionId/calculate/revenue` (MODIFIED)

After successful calculation, add STAFFING and PNL to `version.staleModules`:

```typescript
currentStale.delete('REVENUE');
currentStale.add('STAFFING');
currentStale.add('PNL');
```

### Existing Unchanged Endpoints

| Method | Path                                 | Notes                                                                   |
| ------ | ------------------------------------ | ----------------------------------------------------------------------- |
| GET    | `/versions/:versionId/fee-grid`      | No changes                                                              |
| PUT    | `/versions/:versionId/fee-grid`      | No changes                                                              |
| GET    | `/versions/:versionId/other-revenue` | No changes                                                              |
| PUT    | `/versions/:versionId/other-revenue` | No changes                                                              |
| GET    | `/versions/:versionId/revenue`       | No changes; frontend consumes `executiveSummary.rows` for Category view |

---

## UI/UX Specification

### Design Decisions (D1-D16)

See `docs/plans/2026-03-13-revenue-page-redesign.md` Sections 3 and 16 for the full decision log
with rationale. Key decisions summarized:

| #   | Decision         | Choice                                            |
| --- | ---------------- | ------------------------------------------------- |
| D1  | Architecture     | Smart Forecast Grid as main viewport              |
| D2  | Grid density     | Section headers only (6 rows in Category view)    |
| D3  | Settings surface | Fullscreen dialog, 4 tabs (Parameters deferred)   |
| D4  | Inspector        | Rich multi-dimensional breakdown in right panel   |
| D5  | Override column  | None — pure calculation engine                    |
| D6  | Setup flow       | Non-linear checklist, 4 areas                     |
| D10 | Discount model   | Per-tariff rates, drop nationality                |
| D12 | Category view    | Reuse `executiveSummary.rows` — no backend change |
| D13 | Charts           | Recharts (already installed)                      |
| D14 | Stale cascade    | Calculate adds STAFFING + PNL downstream          |
| D15 | Grade subtotals  | Frontend grouping via `GRADE_BAND_MAP`            |

### Page Layout

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
| REVENUE FORECAST MATRIX (6-20 rows depending on view mode)       | Details  |
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

### Component Tree

```text
RevenuePage (rewrite ~400 lines)
+-- VersionLockBanner (reuse)
+-- ImportedBanner (reuse)
+-- ViewerBanner (reuse)
+-- Toolbar
|   +-- ToggleGroup (view mode: Category|Grade|Nationality|Tariff)
|   +-- ToggleGroup (period: AY1|AY2|FY2026)
|   +-- ExportButton (reuse)
|   +-- Button (Revenue Settings / View Settings)
|   +-- Button (Setup)
|   +-- CalculateButton (reuse pattern)
+-- RevenueKpiRibbon (modify: 4->5 cards)
+-- RevenueStatusStrip (create ~80 lines)
+-- ForecastGrid (create ~200 lines)
|   +-- TanStack Table v8
+-- RightPanel (existing shell)
    +-- RevenueInspector (create ~200 lines)

RevenueSettingsDialog (create ~300 lines, portal)
+-- Left sidebar (tab navigation)
+-- Tab content area
    +-- FeeGridTab (reuse, wrapped)
    +-- TariffAssignmentGrid (reuse, wrapped)
    +-- DiscountsTab (reuse, modified — no nationality)
    +-- OtherRevenueTab (reuse, wrapped)

SetupChecklist (create ~120 lines, overlay)
+-- 4 area status rows
+-- [Edit] deep-links to settings tabs
+-- [Skip for Now] / [Open Settings]
```

### Zustand Stores (3 new)

**`revenue-selection-store.ts`** — Selected grid row state:

```typescript
interface RevenueSelectionState {
    selectedRow: { label: string; viewMode: RevenueViewMode } | null;
    selectRow: (label: string, viewMode: RevenueViewMode) => void;
    clearSelection: () => void;
}
```

**`revenue-settings-dialog-store.ts`** — Dialog open/close and tab state:

```typescript
interface RevenueSettingsDialogState {
    isOpen: boolean;
    activeTab: RevenueSettingsTab;
    open: (tab?: RevenueSettingsTab) => void;
    close: () => void;
    setTab: (tab: RevenueSettingsTab) => void;
}
```

**`revenue-settings-dirty-store.ts`** — Per-tab dirty tracking:

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

### New Hooks

```typescript
export function useRevenueReadiness(versionId: number | null) {
    return useQuery({
        queryKey: ['revenue', 'readiness', versionId],
        queryFn: () =>
            apiClient<RevenueReadinessResponse>(`/versions/${versionId}/revenue/readiness`),
        enabled: versionId !== null,
    });
}
```

### New Shared Types (`packages/types/src/revenue.ts`)

```typescript
export type RevenueViewMode = 'category' | 'grade' | 'nationality' | 'tariff';
export type RevenueSettingsTab = 'feeGrid' | 'tariffAssignment' | 'discounts' | 'otherRevenue';

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

### Modified Type: DiscountEntry

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

### Formatting Rules

- Negative values: parentheses + `text-(--color-error)` — `(986,000)`
- Zero summer months: dash `-` in `text-(--text-muted)`
- Grand total row: `bg-(--workspace-bg-muted)`, `font-weight: 700`, sticky bottom
- Thousands separator, 0 decimal places, fr-FR locale
- KPI props use `string` (Decimal.js format) to avoid floating-point loss

### Accessibility (WCAG AA)

- Grid: `role="grid"`, arrow key navigation, `aria-selected` on active row
- Settings dialog: `role="dialog"`, `aria-modal="true"`, focus trap, Escape to close
- Settings tabs: `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`
- KPI ribbon: `role="list"` / `role="listitem"`, values announced with labels
- Status strip: `role="status"`, `aria-live="polite"`
- Setup checklist: focus to heading on auto-open, descriptive button labels
- Color contrast: >= 4.5:1 for all text

---

## Edge Cases Cross-Reference

| Edge Case                                    | Source             | Impact on This Epic                                                                                 |
| -------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| PO-002: Negative discount rates              | `docs/edge-cases/` | Handled: existing rate validation [0, 1] in discounts.ts unchanged                                  |
| PO-024: Discount rate exceeds 100%           | `docs/edge-cases/` | Handled: Decimal check `rate.gt(1)` returns 422                                                     |
| PO-026: Monthly revenue mismatch with annual | `docs/edge-cases/` | Handled: last-bucket rounding ensures exact annual totals; monthly amounts may differ by SAR 1/row  |
| PO-030: Revenue recognition timing (IFRS 15) | `docs/edge-cases/` | Not in scope — engine logic unchanged                                                               |
| PO-034: Mutually exclusive discount policies | `docs/edge-cases/` | Simplified: nationality dropped; only 2 policies exist (RP, R3+) — mutual exclusivity is structural |
| SA-001: Decimal.js precision                 | `docs/edge-cases/` | Enforced: all monetary calculations use Decimal.js (TC-001)                                         |
| SA-006: Discount cascade                     | `docs/edge-cases/` | Simplified: no nationality matching needed post-migration                                           |
| SA-023: Decimal import precision             | `docs/edge-cases/` | Enforced: string-based serialization throughout                                                     |

---

## Validation Data (FY2026 Budget v3)

**Tolerance rule:** Annual totals must match exactly. Monthly amounts may differ by up to SAR 1
per row due to last-bucket rounding.

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

### Internal Consistency Checks

- Band sum: 1,954,349 + 6,397,197 + 20,010,530 + 17,129,430 + 13,480,748 = **58,972,254**
  (exact match with Tuition Fees annual total)
- Registration sum: 1,004,500 + 8,737,050 + 68,500 = **9,810,050** (exact match)
- Discount period sum: 1,338,193 + 995,520 = **2,333,713** (exact match)

Source: `data/budgets/01_EFIR_Revenue_FY2026_v3.xlsx`

---

## Performance Requirements

| Metric                          | Target  |
| ------------------------------- | ------- |
| Readiness endpoint response     | < 200ms |
| Settings dialog open            | < 500ms |
| Forecast grid render (any view) | < 300ms |
| Revenue calculation (full)      | < 3s    |
| Category view switch (no API)   | < 100ms |

---

## Open Questions

None. All design decisions have been validated and all contradictions resolved.
