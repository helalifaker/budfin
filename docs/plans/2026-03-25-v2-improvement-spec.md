# BudFin v2 Improvement Spec

**Date**: 2026-03-25
**Status**: Approved
**Approach**: Bottom-Up (Fixes -> Infrastructure -> Features -> Polish -> Tests)
**Timeline**: Quality-first, no hard deadline

---

## Scope Summary

- **Tier 1**: 6 critical fixes (calculate buttons, stale validation, format-money, design tokens, audit RBAC, error boundary)
- **Tier 2**: 10 UI/UX improvements (right panel, progress indicator, budget wizard, drill-down, comparison charts, inline editing, tooltips, dark mode, print styles, command palette)
- **Feature A**: Comments & Annotations (threaded discussions, resolve/unresolve)
- **Feature B**: PDF & Excel Export (all modules, full budget book)
- **Feature C**: Historical Trend Analysis (multi-year, graceful degradation)
- **Test Coverage**: Breadth-first to 80% across all modules (~750 new tests)

---

## Phase 1: Tier 1 Critical Fixes

### 1.1 Calculate Button Consistency

**Problem**: Staffing uses a plain `<Button>` instead of the shared `CalculateButton`. Enrollment, OpEx, and P&L already use `CalculateButton` but OpEx and P&L have duplicate buttons in their empty states.

**Files to modify**:

| Module   | File                                                    | Change                                                                                    |
| -------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Staffing | `apps/web/src/components/staffing/staffing-page-v2.tsx` | Replace plain `<Button>` with `<CalculateButton>`, wire `isPending`/`isSuccess`/`isError` |
| OpEx     | `apps/web/src/components/opex/opex-page.tsx`            | Remove duplicate calculate button in empty state                                          |
| P&L      | `apps/web/src/components/pnl/pnl-page.tsx`              | Remove duplicate calculate button in empty state                                          |

Enrollment and Revenue already use `CalculateButton` correctly -- no changes needed.

### 1.2 Upstream Stale Validation

**Problem**: Only P&L checks for stale upstream modules before calculating.

Add frontend stale-module guards to calculate hooks. Note: Revenue already has a page-level enrollment stale check, and OpEx backend already returns 409 for stale REVENUE. This consolidates all guards into the hooks for consistency.

| Hook                   | File                                 | Guard                                   | Notes                                    |
| ---------------------- | ------------------------------------ | --------------------------------------- | ---------------------------------------- |
| `useCalculateRevenue`  | `apps/web/src/hooks/use-revenue.ts`  | Block if `ENROLLMENT` in `staleModules` | Move existing page-level guard into hook |
| `useCalculateStaffing` | `apps/web/src/hooks/use-staffing.ts` | Block if `REVENUE` in `staleModules`    | New frontend guard                       |
| `useCalculateOpEx`     | `apps/web/src/hooks/use-opex.ts`     | Block if `REVENUE` in `staleModules`    | Complement existing backend 409 guard    |

The version object (from `useVersions`) carries `staleModules: string[]`. Each hook reads this and prevents the mutation from being sent. The calculate button shows disabled state with a tooltip explaining why.

### 1.3 Format-Money Consistency

Replace all raw `toLocaleString()` calls on monetary values with `formatMoney()` from `apps/web/src/lib/format-money.ts`. Known monetary usages to fix:

- `apps/web/src/components/revenue/forecast-tab.tsx:46`
- `apps/web/src/components/revenue/revenue-matrix-table.tsx:26`
- `apps/web/src/components/staffing/monthly-cost-grid.tsx:19`
- `apps/web/src/components/scenarios/scenario-page.tsx:51`
- `apps/web/src/components/data-grid/cell-renderers.tsx:48`
- `apps/web/src/components/data-grid/editable-cell.tsx:22`
- `apps/web/src/components/dashboard/kpi-ribbon.tsx:22,28`
- `apps/web/src/components/dashboard/enrollment-trend-chart.tsx:74`
- `apps/web/src/components/dashboard/staffing-distribution-chart.tsx:75`
- `apps/web/src/hooks/use-staffing.ts:286`
- `apps/web/src/lib/revenue-workspace.ts:182`

Note: `toLocaleString()` calls used for dates or non-monetary formatting (e.g., in `audit.tsx`, `users.tsx`) are intentional and should not be changed.

### 1.4 Design Token Violations

Replace 12 raw Tailwind color classes with CSS custom properties:

- `apps/web/src/components/pnl/pnl-page.tsx` (8 instances): `text-emerald-600` -> `text-(--color-success)`, `text-red-600` -> `text-(--color-error)`, `text-amber-600` -> `text-(--color-warning)`
- `apps/web/src/pages/admin/audit.tsx` (3 instances)
- `apps/web/src/components/scenarios/scenario-page.tsx` (1 instance)
- `apps/web/src/components/pnl/pnl-page.tsx` (comparison rendering section, 1 additional instance)
- `apps/web/src/components/master-data/curriculum-rules-table.tsx` (1 instance)

### 1.5 Audit RBAC Fix

**File**: `apps/api/src/routes/audit.ts:97`

Change calculation history role check from `'Admin'` to `['Admin', 'BudgetOwner']`.

### 1.6 React Error Boundary

**New file**: `apps/web/src/components/shared/error-boundary.tsx`

- Class component implementing `componentDidCatch`
- Fallback UI: error icon, "Something went wrong" message, "Reload Page" button, optional error details in dev mode
- Logs error to console

**Modified file**: `apps/web/src/layouts/root-layout.tsx`

- Wrap children with `<ErrorBoundary>`

---

## Phase 2: Tier 2 UI/UX Improvements

### 2.1 Right Panel Activity & Audit Tabs

**Modified file**: `apps/web/src/components/shell/right-panel.tsx`

Replace placeholder text with real components.

**New files**:

- `apps/web/src/components/shell/activity-feed.tsx` -- Timeline of recent version changes
- `apps/web/src/components/shell/calculation-history.tsx` -- Calculation audit log for current module
- `apps/web/src/components/shared/timeline-item.tsx` -- Shared timeline row (icon, title, subtitle, timestamp)

**New hook**: `apps/web/src/hooks/use-audit.ts`

- `useVersionActivity(versionId)` -- queries `GET /api/v1/audit?versionId=X&limit=20`, `refetchInterval: 60_000`
- `useCalculationHistory(versionId)` -- queries `GET /api/v1/audit/calculation?versionId=X`

### 2.2 Calculation Progress Indicator

**Modified file**: `apps/web/src/components/shared/calculate-button.tsx`

- Add optional `estimatedDurationMs` prop
- When `isPending` and `estimatedDurationMs` is set, render a determinate progress bar beneath the button
- Progress calculated from elapsed time vs estimate
- Store last calculation duration per module in `localStorage`

**Modified hooks**: Each `useCalculate*` hook tracks the response `durationMs` and persists to localStorage.

### 2.3 Guided Budget Cycle Wizard

**New files**:

- `apps/web/src/components/dashboard/budget-cycle-wizard.tsx` -- 7-step wizard dialog
- `apps/web/src/components/dashboard/setup-checklist.tsx` -- Persistent checklist card for Dashboard

**Modified file**: `apps/web/src/pages/planning/dashboard.tsx` -- Add "Start New Budget" button and `<SetupChecklist>` card

7 steps:

1. Create or clone version
2. Configure enrollment settings + import headcounts
3. Set fee grid + revenue settings
4. Import/configure staff
5. Set OpEx line items
6. Run full calculation chain ("Calculate All" button)
7. Review P&L summary

Each step checks data existence via current query hooks. No new backend endpoints.

### 2.4 Drill-Down from Dashboard & P&L

**Modified files**:

- `apps/web/src/pages/planning/dashboard.tsx` -- Make KPI cards clickable with `useNavigate()`
- `apps/web/src/components/pnl/pnl-page.tsx` -- Make category rows clickable, navigating to the source module
- `apps/web/src/components/pnl/pnl-page.tsx` -- Make monthly cells clickable, setting period filter in workspace-context-store

### 2.5 Version Comparison Charts

**New files**:

- `apps/web/src/components/pnl/comparison-bar-chart.tsx` -- Side-by-side bar chart (primary vs comparison)
- `apps/web/src/components/pnl/variance-waterfall-chart.tsx` -- Waterfall showing variance drivers

**Charting library**: Recharts (already installed: `recharts: ^3.0.0` in `apps/web/package.json`).

**Data source**: `usePnlResults(format, comparisonVersionId)` already returns both versions.

**Modified file**: `apps/web/src/components/pnl/pnl-page.tsx` -- Render charts above the table when comparison version is selected.

### 2.6 Inline Cell Editing in Grids

**Modified files**:

- `apps/web/src/components/data-grid/planning-grid.tsx` -- Add double-click-to-edit behavior for numeric cells
- `apps/web/src/components/data-grid/cell-renderers.tsx` -- Add `EditableNumericCell` renderer with Enter/Tab/Escape handling

**Scope**: Enrollment headcounts and OpEx amounts. Revenue fee grid editing stays in the existing settings modal (which uses dirty-field tracking and auto-routing -- inline editing would conflict with that pattern). Staffing salary fields excluded (side panel only, due to RBAC complexity).

### 2.7 Contextual Help Tooltips

**New files**:

- `apps/web/src/components/shared/info-tooltip.tsx` -- `(i)` icon with hover tooltip
- `apps/web/src/lib/glossary.ts` -- Map of `{ term: definition }` (~25 terms)

**Terms**: YEARFRAC, DHG Grille, GOSI, Echelon, Indice, Cohort Retention, AY1, AY2, FTE, Ajeer, IFRS, Zakat, PERCENT_OF_REVENUE, Stale Module, DAI, ORS, Base Salary, Indemnity, Housing Allowance, Transport Allowance, AEFE Contribution, Gross Salary, Net Cost, Band, Service Obligation Profile.

**Integration**: Add `<InfoTooltip term="X">` next to relevant column headers and form labels across all planning pages.

### 2.8 Dark Mode

**New file**: `apps/web/src/components/shared/theme-provider.tsx` -- Context provider managing light/dark/system preference

**Modified files**:

- `apps/web/src/index.css` -- Add `@dark` variant tokens alongside existing light tokens
- `apps/web/src/layouts/root-layout.tsx` -- Wrap with `<ThemeProvider>`
- `apps/web/src/components/shell/sidebar.tsx` (or user menu) -- Add theme toggle (Light/Dark/System)

**Prerequisite**: Tier 1.4 (design token fix) must complete first.

### 2.9 Print-Optimized Views

**Modified file**: `apps/web/src/index.css` -- Add `@media print` rules:

- Hide sidebar, context bar, right panel, tooltips, all buttons
- Full-width main content
- A4 landscape table formatting with page breaks
- Print header: school name, version name, fiscal year, print date

**Modified files**: Add "Print" button to toolbar of:

- `apps/web/src/components/pnl/pnl-page.tsx`
- `apps/web/src/pages/planning/revenue.tsx`
- `apps/web/src/components/staffing/staffing-page-v2.tsx`

### 2.10 Keyboard Shortcuts + Command Palette

**New files**:

- `apps/web/src/components/shared/command-palette.tsx` -- `Cmd+K` / `Ctrl+K` modal with search
- `apps/web/src/lib/hotkeys.ts` -- `useHotkeys(key, callback)` utility hook

**Shortcuts**:

| Shortcut    | Action                        |
| ----------- | ----------------------------- |
| `Cmd+K`     | Open command palette          |
| `Cmd+Enter` | Calculate (on planning pages) |
| `Cmd+P`     | Print current view            |
| `g then e`  | Go to Enrollment              |
| `g then r`  | Go to Revenue                 |
| `g then s`  | Go to Staffing                |
| `g then o`  | Go to OpEx                    |
| `g then p`  | Go to P&L                     |
| `g then d`  | Go to Dashboard               |
| `g then t`  | Go to Trends                  |
| `Escape`    | Close palette / cancel edit   |

**Modified file**: `apps/web/src/layouts/root-layout.tsx` -- Mount `<CommandPalette>` at root level.

---

## Phase 3: Feature A -- Comments & Annotations

### Data Model

**New Prisma model** in `apps/api/prisma/schema.prisma`:

```prisma
model Comment {
  id           Int       @id @default(autoincrement())
  versionId    Int       @map("version_id")
  targetType   String    @map("target_type") @db.VarChar(30)
  targetId     String    @map("target_id") @db.VarChar(100)
  parentId     Int?      @map("parent_id")
  authorId     Int       @map("author_id")
  body         String    @db.Text
  resolvedAt   DateTime? @map("resolved_at") @db.Timestamptz
  resolvedById Int?      @map("resolved_by_id")
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  version    BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  parent     Comment?      @relation("CommentThread", fields: [parentId], references: [id], onDelete: Cascade)
  replies    Comment[]     @relation("CommentThread")
  author     User          @relation("CommentAuthor", fields: [authorId], references: [id])
  resolvedBy User?         @relation("CommentResolver", fields: [resolvedById], references: [id])

  @@index([versionId, targetType, targetId], map: "idx_comment_target")
  @@index([parentId], map: "idx_comment_parent")
  @@map("comments")
}
```

**Target types**: `VERSION`, `REVENUE_LINE`, `STAFF_POSITION`, `OPEX_LINE`, `PNL_LINE`, `ENROLLMENT_GRADE`

**User model update**: Add two relation fields to the existing `User` model in `schema.prisma`:

- `commentsAuthored Comment[] @relation("CommentAuthor")`
- `commentsResolved Comment[] @relation("CommentResolver")`

**Thread behavior**: Editing a reply does NOT update the parent's `updatedAt`. Threads are sorted by root `createdAt` descending. Replies within a thread are sorted by `createdAt` ascending.

### API Endpoints

**New route file**: `apps/api/src/routes/comments.ts`

Registered at `/api/v1/versions/:versionId/comments`.

| Method   | Path             | Purpose                                                               | Permission                 |
| -------- | ---------------- | --------------------------------------------------------------------- | -------------------------- |
| `GET`    | `/`              | List comments for a target (`?targetType=X&targetId=Y`)               | `data:view`                |
| `GET`    | `/counts`        | Unresolved counts by targetId (`?targetType=X`)                       | `data:view`                |
| `POST`   | `/`              | Create comment or reply (`{ targetType, targetId, parentId?, body }`) | `data:edit`                |
| `PATCH`  | `/:id`           | Edit own comment body                                                 | `data:edit` + author check |
| `POST`   | `/:id/resolve`   | Resolve thread (sets `resolvedAt` + `resolvedById`)                   | `data:edit`                |
| `POST`   | `/:id/unresolve` | Reopen thread (clears `resolvedAt`)                                   | `data:edit`                |
| `DELETE` | `/:id`           | Delete own comment (cascades replies)                                 | `data:edit` + author check |

All endpoints version-scoped and audit-logged.

### Frontend

**New files**:

- `apps/web/src/hooks/use-comments.ts` -- TanStack Query hooks:
    - `useComments(versionId, targetType, targetId)`
    - `useCommentCounts(versionId, targetType)`
    - `useCreateComment()`, `useEditComment()`, `useDeleteComment()`
    - `useResolveComment()`, `useUnresolveComment()`
- `apps/web/src/components/shared/comment-thread.tsx` -- Thread view: root + replies, resolve button, reply input
- `apps/web/src/components/shared/comment-indicator.tsx` -- Badge for grid rows (shows unresolved count, click opens right panel)

**Integration**:

- Right panel "Details" tab: Show comment threads for selected row
- Grid rows: `<CommentIndicator>` column in all planning grids
- Version-level comments: "Notes" section on Dashboard

---

## Phase 4: Feature B -- PDF & Excel Export

### Architecture

```text
User -> POST /export/jobs -> pg-boss queue -> Worker -> File on disk
User -> GET /export/jobs/:id (poll) -> status + progress
User -> GET /export/jobs/:id/download -> File stream
Background cleanup -> Delete expired files (24h TTL)
```

### API Endpoints

**New route file**: `apps/api/src/routes/export.ts`

Registered at `/api/v1/export`.

| Method | Path                 | Purpose                | Permission                                         |
| ------ | -------------------- | ---------------------- | -------------------------------------------------- |
| `POST` | `/jobs`              | Create export job      | `data:view` (salary reports require `salary:view`) |
| `GET`  | `/jobs/:id`          | Poll status + progress | `data:view` + creator check                        |
| `GET`  | `/jobs/:id/download` | Download file          | `data:view` + creator check                        |

**POST body**:

```json
{
    "versionId": 1,
    "reportType": "PNL | REVENUE | STAFFING | OPEX | ENROLLMENT | DASHBOARD | FULL_BUDGET",
    "format": "PDF | EXCEL",
    "comparisonVersionId": null,
    "options": { "pnlFormat": "ifrs", "includeCharts": true }
}
```

### Worker Implementation

**New files** in `apps/api/src/services/export/`:

| File                       | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `export-worker.ts`         | pg-boss job handler, dispatches to generators, updates progress |
| `report-data-loader.ts`    | Loads data per report type (reuses query patterns from routes)  |
| `pdf-generator.ts`         | `@react-pdf/renderer` templates per report type                 |
| `excel-generator.ts`       | ExcelJS workbook generation per report type                     |
| `templates/pdf-header.tsx` | Shared PDF header (EFIR branding, version info, date)           |
| `templates/pdf-table.tsx`  | Shared PDF table component                                      |

### Report Matrix

| Report Type   | Content                                      | PDF Pages | Excel Sheets |
| ------------- | -------------------------------------------- | --------- | ------------ |
| `PNL`         | Summary + detailed + IFRS + variance         | 3         | 3            |
| `REVENUE`     | Fee grid + other revenue + monthly breakdown | 2         | 2            |
| `STAFFING`    | Roster + dept costs + category costs + FTE   | 4         | 4            |
| `OPEX`        | Line items by section + monthly              | 1         | 1            |
| `ENROLLMENT`  | Headcounts by grade + AY1/AY2 + capacity     | 2         | 2            |
| `DASHBOARD`   | KPI summary                                  | 1         | 1            |
| `FULL_BUDGET` | All of the above                             | ~13       | ~13          |

### Frontend

**New files**:

- `apps/web/src/components/shared/export-dialog.tsx` -- Modal: report type selector, format toggle, options
- `apps/web/src/hooks/use-export.ts` -- Move `useCreateExportJob` and `useExportJobStatus` from `use-pnl.ts`, add download trigger. Update all existing consumers of these hooks (currently `pnl-page.tsx`) to import from the new location.

**Modified files**: Add "Export" button to each module toolbar.

### Error Handling

- On worker failure: set `ExportJob.status` to `'FAILED'`, store error in `errorMessage` field
- No automatic retry -- user can re-trigger from the dialog
- Frontend: `useExportJobStatus` detects `FAILED` status, shows toast with error message and "Try Again" button
- Common failure cases: version deleted mid-export, database timeout on large datasets, disk full

### File Management

- Files stored in `data/exports/` (Docker volume)
- `expiresAt` set to `now() + 24h` on creation
- Background pg-boss job runs hourly to delete expired files

---

## Phase 5: Feature C -- Historical Trend Analysis

### API Endpoint

**New route file**: `apps/api/src/routes/trends.ts`

Registered at `/api/v1/trends`.

| Method | Path | Purpose                             | Permission  |
| ------ | ---- | ----------------------------------- | ----------- |
| `GET`  | `/`  | Historical KPIs across fiscal years | `data:view` |

**Query params**: `metrics=revenue,staffCost,opex,netProfit,enrollment,fte&years=5`

**Version selection logic**: Per fiscal year, pick the canonical version. Note: status values in the database are title-case strings (`'Locked'`, `'Archived'`, `'Published'`, `'Draft'`).

1. Prefer `'Locked'` status
2. If no Locked, use `'Archived'`
3. If multiple, use the most recently updated
4. Skip fiscal years with no Locked/Archived versions

**Caching**: Results cached in TanStack Query with `staleTime: 5 * 60_000` (5 minutes). The data changes infrequently (only when versions are locked/archived). No server-side cache needed for v1.

**Response**:

```json
{
    "years": [
        {
            "fiscalYear": "2022-2023",
            "versionName": "Budget 2022-23 Final",
            "versionId": 3,
            "metrics": {
                "totalRevenue": "12500000.00",
                "totalStaffCost": "9200000.00",
                "totalOpEx": "1800000.00",
                "netProfit": "1500000.00",
                "totalEnrollment": 820,
                "totalFte": 95.5
            }
        }
    ],
    "growth": {
        "revenue": [null, "0.08", "0.12"],
        "staffCost": [null, "0.06", "0.09"]
    }
}
```

### Frontend

**New page**: `apps/web/src/pages/planning/trends.tsx` -- route `/planning/trends`

**New components** in `apps/web/src/components/trends/`:

| Component               | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `trend-line-chart.tsx`  | Multi-line chart: selected metrics over fiscal years |
| `growth-rate-table.tsx` | YoY growth rates, conditional formatting             |
| `per-pupil-kpis.tsx`    | Derived: revenue/student, cost/student, cost/FTE     |
| `trend-empty-state.tsx` | Graceful message when < 2 years of data              |

**Navigation**: Add "Trends" to sidebar under Planning, after Dashboard.

**Graceful degradation**:

- 0 years: Empty state with explanation
- 1 year: Show metrics, no growth, message about future availability
- 2+ years: Full charts and growth analysis

---

## Phase 6: Test Coverage to 80%

### Wave 1 -- Zero-Coverage Modules

| Module                                   | File          | Est. Tests |
| ---------------------------------------- | ------------- | ---------- |
| `validation/parse-consolidated-excel.ts` | New test file | ~40 tests  |
| `validation/parse-dhg-excel.ts`          | New test file | ~50 tests  |
| `validation/parse-enrollment-csv.ts`     | New test file | ~25 tests  |
| `validation/parse-revenue-excel.ts`      | New test file | ~50 tests  |
| `validation/seed-fy2026.ts`              | New test file | ~20 tests  |
| `validation/seed-prior-year-fees.ts`     | New test file | ~20 tests  |
| `services/staffing/crypto-helper.ts`     | New test file | ~10 tests  |
| `routes/dashboard.ts`                    | New test file | ~15 tests  |
| Dashboard page                           | New test file | ~15 tests  |
| Scenario page                            | New test file | ~20 tests  |
| P&L page                                 | New test file | ~25 tests  |
| OpEx page + grid                         | New test file | ~30 tests  |

### Wave 2 -- Below-Threshold Modules

Focus areas:

- Route handlers: Add error path tests (409 STALE_DATA, 403, validation errors)
- Frontend hooks: Test mutation callbacks (onSuccess invalidation, onError toast)
- Frontend pages: Test interactions (button clicks, filter changes, empty states)
- Stores: Test state transitions and selectors

### Wave 3 -- New Feature Tests

Every new file in Phases 3-5 gets a paired test file. Minimum 80% coverage per file.

### Test Patterns

- **API routes**: Fastify `.inject()` integration tests, real test DB, mock pg-boss
- **Services/engines**: Pure unit tests with fixture data
- **Frontend components**: Vitest + React Testing Library, mock apiClient
- **Frontend hooks**: `renderHook` with QueryClient wrapper
- **Validation modules**: Unit tests with fixture Excel/CSV buffers

### Target Outcome

| Metric         | Before | After  |
| -------------- | ------ | ------ |
| API lines      | 66.5%  | >= 80% |
| API functions  | 76.9%  | >= 80% |
| API statements | 65.0%  | >= 80% |
| API branches   | 57.9%  | >= 80% |
| Web lines      | 33.9%  | >= 80% |
| Total tests    | ~2,131 | ~2,880 |

---

## Implementation Order

```text
Phase 1 (Tier 1 Fixes)
  |
  v
Phase 2 (Tier 2 UI/UX) ----+
  |                          |
  v                          v
Phase 3 (Comments)  Phase 4 (Export)  Phase 5 (Trends)
  |                       |                  |
  +-----------------------+------------------+
                          |
                          v
                    Phase 6 (Tests)
```

Phases 3, 4, and 5 can all run in parallel (independent features with no shared files except Prisma schema, where migrations are sequenced). Phase 6 covers everything.

---

## Dependencies and New Libraries

| Library               | Purpose                                          | Phase  |
| --------------------- | ------------------------------------------------ | ------ |
| `@react-pdf/renderer` | PDF generation (already documented in CLAUDE.md) | 4      |
| `exceljs`             | Excel .xlsx generation                           | 4      |
| `recharts`            | Charts (already installed: `^3.0.0`)             | 2.5, 5 |

No other new dependencies. All other functionality built with existing stack.

---

## Files Created (Summary)

| Phase     | New Files                                         | Modified Files            |
| --------- | ------------------------------------------------- | ------------------------- |
| 1         | 1 (error-boundary)                                | ~12                       |
| 2         | ~12 (wizard, palette, tooltips, theme, etc.)      | ~15                       |
| 3         | 4 (model, routes, hooks, components)              | ~8                        |
| 4         | 8 (routes, worker, generators, templates, dialog) | ~8                        |
| 5         | 5 (route, page, chart components)                 | ~3                        |
| 6         | ~50 (test files)                                  | ~20 (existing test files) |
| **Total** | **~80 new files**                                 | **~66 modified files**    |
