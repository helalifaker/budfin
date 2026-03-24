# Feature Spec: P&L Reporting

> Epic: #11 | Phase: 4 — SPECIFY | Status: Draft | Date: 2026-03-24

## Summary

Epic 5 delivers the consolidated P&L (Profit & Loss) reporting module — the primary deliverable that replaces the Consolidated Budget Excel workbook. The P&L Engine aggregates upstream calculated data (monthly revenue from Epic 2, monthly staff costs from Epic 4, and monthly operating expenses from OpEx) into an IFRS-compliant Income Statement following IAS 1 Function of Expense method. Finance staff can view the P&L in three formats (Summary, Detailed, IFRS), compare two budget versions side-by-side with absolute and percentage variances, and export reports to PDF (A3 landscape) or xlsx. The engine enforces staleness checks — refusing to calculate if upstream modules (REVENUE, STAFFING, OPEX) have been modified since their last calculation. All monetary computations use Decimal.js (TC-001) and results are persisted with DECIMAL(15,4) precision.

Reference: PRD Section 2.1.5 (P&L Reporting), PRD Section 2.1.6 (Scenario Comparison — partial, deferred to Epic 6).

## Acceptance Criteria

### P&L Engine

- [x] AC-01: Given a version with calculated revenue, staff costs, and OpEx, when `POST /calculate/pnl` is called, then the engine produces 12 monthly P&L rows plus annual totals matching the IFRS Income Statement structure from `EFIR_Consolidated_Monthly_Budget_FY2026.xlsx`.
- [x] AC-02: Given upstream module REVENUE or STAFFING or OPEX is stale (listed in `version.staleModules`), when `POST /calculate/pnl` is called, then the API returns 409 with error code `STALE_PREREQUISITES` and a `staleModules` array listing the outdated modules.
- [x] AC-03: Given a successful P&L calculation, then `PNL` is removed from `version.staleModules`, `version.lastCalculatedAt` is updated, and a `CalculationAuditLog` entry is created with module=PNL, inputSummary (row counts), and outputSummary (totals).
- [x] AC-04: The P&L Engine is a pure function with no DB dependencies. It accepts typed inputs and returns typed outputs. All monetary arithmetic uses `Decimal.js` with `ROUND_HALF_UP`.
- [x] AC-05: Zakat is calculated as `profitBeforeZakat * 0.025` when `profitBeforeZakat > 0`; zero otherwise. This is applied per-month independently.

### P&L Line Items

- [x] AC-06: The P&L contains these IFRS sections in order: (1) Revenue from Contracts with Customers, (2) Rental Income, (3) Total Revenue, (4) Staff Costs, (5) Other Operating Expenses, (6) Depreciation & Amortization, (7) Impairment Losses, (8) Total Operating Expenses, (9) Operating Profit/(Loss), (10) Finance Income, (11) Finance Costs, (12) Net Finance Income/(Cost), (13) Profit/(Loss) Before Zakat, (14) Estimated Zakat, (15) Net Profit/(Loss).
- [x] AC-07: Revenue sub-categories include: Tuition Fees (by grade level x tariff type), Registration Fees, Activities & Services, Examination Fees. Aggregated from `MonthlyRevenue` and `MonthlyOtherRevenue`.
- [x] AC-08: Staff Costs sub-categories include: Local Staff Salaries (base, housing, transport, responsibility premium, HSA), New Positions, Additional Staff Costs (replacements, continuing education, resident salaries, pension, resident housing & flights), Employer Charges (GOSI, EoS, Ajeer). Aggregated from `MonthlyStaffCost` and `CategoryMonthlyCost`.
- [x] AC-09: Operating expenses, D&A, Impairment, Finance Income, and Finance Costs are sourced from `MonthlyOpEx` joined with `VersionOpExLineItem` and grouped by `sectionType` and `ifrsCategory`.

### API Endpoints

- [x] AC-10: `POST /api/v1/versions/:versionId/calculate/pnl` — runs P&L consolidation. Returns `{ runId, durationMs, totalRevenueHt, totalStaffCosts, ebitda, ebitdaMarginPct, netProfit }`. Requires `data:edit` permission. Blocked for Locked/Archived versions.
- [x] AC-11: `GET /api/v1/versions/:versionId/pnl` — returns IFRS P&L data. Accepts `format` query param (summary | detailed | ifrs, default ifrs). Returns hierarchical line items with monthly amounts and annual totals.
- [x] AC-12: `GET /api/v1/versions/:versionId/pnl?comparison_version_id=:id` — returns side-by-side P&L for two versions with absolute and percentage variance columns per month and annual.
- [x] AC-13: `GET /api/v1/versions/:versionId/pnl/kpis` — returns KPI card data: totalRevenueHt, ebitda, ebitdaMarginPct, netProfit. All as decimal strings.

### Export

- [x] AC-14: `POST /api/v1/export/jobs` with `{ versionId, reportType: 'PNL_MONTHLY', format: 'xlsx' | 'pdf' | 'csv', comparisonVersionId? }` creates an async export job. Returns `{ jobId, status: 'PENDING' }`.
- [x] AC-15: `GET /api/v1/export/jobs/:id` returns job status (`PENDING | PROCESSING | DONE | FAILED`), progress percentage, and download URL when done.
- [x] AC-16: `GET /api/v1/export/jobs/:id/download` returns the generated file. Returns 410 Gone after 1 hour.
- [x] AC-17: PDF export uses `@react-pdf/renderer` (server-side, no Chromium). A3 landscape layout with school header, watermark "BUDGET", and page numbers.
- [x] AC-18: Excel export uses ExcelJS with proper formatting: number format `#,##0.00`, negative in parentheses, section headers bold, subtotal rows with top border.

### Frontend

- [x] AC-19: P&L page at `/planning/pnl` in PlanningShell with module toolbar (format toggle, Calculate button, Export dropdown).
- [x] AC-20: KPI Summary Strip shows 4 cards: Total Revenue HT, EBITDA, EBITDA Margin %, Net Profit. EBITDA Margin color-coded: green >= 15%, amber 5-15%, red < 5%.
- [x] AC-21: IFRS Income Statement grid using TanStack Table v8 + DataGrid with 3-level row hierarchy: Level 1 (sections), Level 2 (categories), Level 3 (detail lines). Rows expandable/collapsible.
- [x] AC-22: All cells read-only. Values formatted: SAR HT, 2 decimal places, thousands separator, negative in parentheses. Annual total column at right.
- [x] AC-23: Comparison mode shows variance columns (absolute + percentage) per month. Favorable variances green, unfavorable red.
- [x] AC-24: Calculate button checks stale flags first. If prerequisites stale, shows blocking dialog with navigation links to Revenue/Staffing/OpEx pages.
- [x] AC-25: Export dialog with format selector. Progress toast during generation, success toast with download link on completion.
- [x] AC-26: Empty state shows "No P&L data yet. Click Calculate to generate." with Calculate button (hidden for Viewer role).
- [x] AC-27: Stale data amber banner: "P&L data may be outdated. Click Calculate to refresh." shown when PNL is in staleModules.
- [x] AC-28: Loading states use skeleton grid (15 rows, 13 columns). KPI strip shows skeleton cards.

## Stories

| #   | Story                                                     | Depends On       | GitHub Issue |
| --- | --------------------------------------------------------- | ---------------- | ------------ |
| 1   | P&L types and Prisma data model                           | —                | #241         |
| 2   | P&L calculation engine (pure function)                    | Story 1          | #242         |
| 3   | P&L calculate route (POST)                                | Story 2          | #243         |
| 4   | P&L results routes (GET with format modes and comparison) | Story 1          | #244         |
| 5   | Export service (PDF + Excel generation)                   | Story 1          | #245         |
| 6   | Export API routes (POST/GET job lifecycle)                | Story 5          | #246         |
| 7   | P&L frontend page (grid, KPI cards, toolbar, states)      | Story 4          | #247         |
| 8   | Comparison mode frontend                                  | Story 7          | #248         |
| 9   | Export dialog frontend                                    | Story 6, Story 7 | #249         |

## Data Model Changes

### New Model: `MonthlyPnlLine`

Stores individual P&L line items per month per version. Populated by the P&L Engine.

```prisma
model MonthlyPnlLine {
  id              Int      @id @default(autoincrement())
  versionId       Int      @map("version_id")
  month           Int      @db.SmallInt
  sectionKey      String   @map("section_key") @db.VarChar(60)
  categoryKey     String   @map("category_key") @db.VarChar(60)
  lineItemKey     String   @map("line_item_key") @db.VarChar(80)
  displayLabel    String   @map("display_label") @db.VarChar(120)
  depth           Int      @default(3) @db.SmallInt
  displayOrder    Int      @map("display_order") @db.SmallInt
  amount          Decimal  @default(0) @db.Decimal(15, 4)
  signConvention  String   @default("POSITIVE") @map("sign_convention") @db.VarChar(10)
  isSubtotal      Boolean  @default(false) @map("is_subtotal")
  isSeparator     Boolean  @default(false) @map("is_separator")
  calculatedAt    DateTime @default(now()) @map("calculated_at") @db.Timestamptz

  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([versionId, month, sectionKey, categoryKey, lineItemKey], map: "uq_pnl_line")
  @@index([versionId], map: "idx_pnl_line_version")
  @@map("monthly_pnl_line")
}
```

### Enhanced: `MonthlyBudgetSummary`

Add fields for EBITDA, OpEx, D&A, and Zakat to the existing summary table.

```prisma
// Add to existing MonthlyBudgetSummary:
  opexCosts        Decimal  @default(0) @map("opex_costs") @db.Decimal(15, 4)
  depreciation     Decimal  @default(0) @map("depreciation") @db.Decimal(15, 4)
  impairment       Decimal  @default(0) @map("impairment") @db.Decimal(15, 4)
  ebitda           Decimal  @default(0) @db.Decimal(15, 4)
  operatingProfit  Decimal  @default(0) @map("operating_profit") @db.Decimal(15, 4)
  financeNet       Decimal  @default(0) @map("finance_net") @db.Decimal(15, 4)
  profitBeforeZakat Decimal @default(0) @map("profit_before_zakat") @db.Decimal(15, 4)
  zakatAmount      Decimal  @default(0) @map("zakat_amount") @db.Decimal(15, 4)
```

### New Model: `ExportJob`

```prisma
model ExportJob {
  id              Int       @id @default(autoincrement())
  versionId       Int       @map("version_id")
  reportType      String    @map("report_type") @db.VarChar(30)
  format          String    @db.VarChar(10)
  status          String    @default("PENDING") @db.VarChar(20)
  progress        Int       @default(0) @db.SmallInt
  filePath        String?   @map("file_path") @db.VarChar(500)
  errorMessage    String?   @map("error_message") @db.Text
  comparisonVersionId Int?  @map("comparison_version_id")
  createdById     Int       @map("created_by_id")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  completedAt     DateTime? @map("completed_at") @db.Timestamptz
  expiresAt       DateTime? @map("expires_at") @db.Timestamptz

  version    BudgetVersion @relation("ExportJobVersion", fields: [versionId], references: [id])
  comparisonVersion BudgetVersion? @relation("ExportJobComparison", fields: [comparisonVersionId], references: [id])
  createdBy  User          @relation("ExportJobCreator", fields: [createdById], references: [id])

  @@index([versionId], map: "idx_export_job_version")
  @@index([status], map: "idx_export_job_status")
  @@map("export_jobs")
}
```

## API Endpoints

| Method | Path                                        | Request                                                   | Response                                                                                     | Auth                |
| ------ | ------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------- |
| POST   | `/api/v1/versions/:versionId/calculate/pnl` | —                                                         | `{ runId, durationMs, totalRevenueHt, totalStaffCosts, ebitda, ebitdaMarginPct, netProfit }` | Bearer, `data:edit` |
| GET    | `/api/v1/versions/:versionId/pnl`           | `?format=summary\|detailed\|ifrs&comparison_version_id=N` | `{ lines: PnlLineItem[], kpis: PnlKpis, format }`                                            | Bearer, `data:view` |
| GET    | `/api/v1/versions/:versionId/pnl/kpis`      | —                                                         | `{ totalRevenueHt, ebitda, ebitdaMarginPct, netProfit }`                                     | Bearer, `data:view` |
| POST   | `/api/v1/export/jobs`                       | `{ versionId, reportType, format, comparisonVersionId? }` | `{ jobId, status }`                                                                          | Bearer, `data:view` |
| GET    | `/api/v1/export/jobs/:id`                   | —                                                         | `{ id, status, progress, downloadUrl? }`                                                     | Bearer, `data:view` |
| GET    | `/api/v1/export/jobs/:id/download`          | —                                                         | Binary file (xlsx/pdf/csv)                                                                   | Bearer, `data:view` |

### P&L Response Shape

```typescript
interface PnlLineItem {
    sectionKey: string; // e.g. "REVENUE_CONTRACTS"
    categoryKey: string; // e.g. "TUITION_FEES"
    lineItemKey: string; // e.g. "MATERNELLE_REDUIT"
    displayLabel: string; // e.g. "Maternelle -- Tarif Reduit"
    depth: 1 | 2 | 3;
    displayOrder: number;
    isSubtotal: boolean;
    isSeparator: boolean;
    monthlyAmounts: string[]; // 12 decimal strings (Jan-Dec)
    annualTotal: string;
    // Comparison fields (present only when comparison_version_id is provided)
    comparisonMonthlyAmounts?: string[];
    comparisonAnnualTotal?: string;
    varianceMonthlyAmounts?: string[];
    varianceAnnualTotal?: string;
    varianceMonthlyPercents?: string[];
    varianceAnnualPercent?: string;
}
```

## P&L Engine Structure

### IFRS Line Item Mapping

The P&L Engine maps upstream data to these sections (matching the Excel "IFRS Income Statement" sheet):

```
REVENUE
  Revenue from Contracts with Customers (IFRS 15)
    Tuition fees                    <- SUM(MonthlyRevenue) by grade
    Registration & re-registration  <- MonthlyOtherRevenue where executiveCategory = 'Registration Fees'
    Activities & services           <- MonthlyOtherRevenue where executiveCategory = 'Activities & Services'
    Examination fees                <- MonthlyOtherRevenue where executiveCategory = 'Examination Fees'
  Rental Income (IFRS 16)
    Rental income                   <- MonthlyOtherRevenue where ifrsCategory = 'Rental Income'
  TOTAL REVENUE

OPERATING EXPENSES (all shown as negatives)
  Staff costs                       <- SUM(MonthlyStaffCost.totalCost) + SUM(CategoryMonthlyCost.amount)
  Other operating expenses          <- SUM(MonthlyOpEx) where sectionType = 'OPERATING'
  Depreciation & amortization       <- SUM(MonthlyOpEx) where ifrsCategory = 'Depreciation'
  Impairment losses                 <- SUM(MonthlyOpEx) where ifrsCategory = 'Impairment'
  TOTAL OPERATING EXPENSES

OPERATING PROFIT / (LOSS)          = Total Revenue + Total Operating Expenses

FINANCE
  Finance income                    <- SUM(MonthlyOpEx) where ifrsCategory = 'Finance Income'
  Finance costs                     <- SUM(MonthlyOpEx) where ifrsCategory = 'Finance Costs' (negative)
  NET FINANCE INCOME / (COST)

PROFIT / (LOSS) BEFORE ZAKAT       = Operating Profit + Net Finance
ESTIMATED ZAKAT (2.5%)             = MAX(0, profitBeforeZakat) * 0.025 (negative)
NET PROFIT / (LOSS)                = Profit Before Zakat - Zakat
```

### Format Modes

| Format     | Description                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `summary`  | Top-level sections only (depth 1): Total Revenue, Total Staff Costs, Total OpEx, EBITDA, Operating Profit, Net Finance, Net Profit. ~10 rows.             |
| `detailed` | Sections + categories (depth 1-2): Revenue by sub-category, Staff Costs by sub-category, OpEx by IFRS category, Finance breakdown. ~25 rows.              |
| `ifrs`     | Full IFRS hierarchy (depth 1-3): All detail lines including individual fee types, individual OpEx line items, individual staff cost components. ~80 rows. |

## UI/UX Specification

> Source: `docs/ui-ux-spec/06-pnl-reporting.md` | Cross-cutting: `00-global-framework.md`, `10-input-management.md`

### Shell & Layout

PlanningShell. Right panel auto-closes when comparison mode is active.

```
+----------------------------------------------------+
| Module Toolbar                                      |
|  [P&L & Reporting]  [Summary|Detailed|IFRS]        |
|  [Calculate]  [Export v]  [...]                     |
+----------------------------------------------------+
| KPI Strip                                           |
|  [Revenue HT]  [EBITDA]  [Margin %]  [Net Profit]  |
+----------------------------------------------------+
| IFRS Income Statement Grid                          |
|  Row Label | Jan | Feb | ... | Dec | FY Total       |
|  > Revenue from Contracts                           |
|    > Tuition Fees                                   |
|      Maternelle - Reduit  | 138,227.96 | ...       |
|      Maternelle - Plein   | 574,782.21 | ...       |
|    Subtotal Tuition       | 5,820,906.53 | ...     |
|  Total Revenue            | 5,951,175.70 | ...     |
|  ...                                                |
|  NET PROFIT / (LOSS)      | 282,532.61 | ...       |
+----------------------------------------------------+
```

### Key Components

| Component               | Type                      | Source                             | Notes                                 |
| ----------------------- | ------------------------- | ---------------------------------- | ------------------------------------- |
| PnlPage                 | Page component            | `pages/planning/pnl.tsx`           | Orchestrates toolbar, KPI strip, grid |
| PnlToolbar              | Custom                    | `components/pnl/pnl-toolbar.tsx`   | Format toggle, Calculate, Export      |
| PnlKpiStrip             | Custom                    | `components/pnl/pnl-kpi-strip.tsx` | 4 KPI cards with comparison deltas    |
| PnlGrid                 | DataGrid + TanStack Table | `components/pnl/pnl-grid.tsx`      | Hierarchical read-only grid           |
| ExportDialog            | shadcn/ui Dialog          | `components/pnl/export-dialog.tsx` | Format picker + job status            |
| StalePrerequisiteDialog | shadcn/ui AlertDialog     | `components/pnl/stale-dialog.tsx`  | Blocking dialog for stale upstream    |

### User Flows

1. **View P&L**: Navigate to /planning/pnl -> grid loads from API -> user switches format -> grid re-renders
2. **Calculate P&L**: Click Calculate -> check stale flags -> if stale: dialog -> if clean: POST calculate -> toast success -> invalidate queries -> grid refreshes
3. **Compare Versions**: Select comparison version in ContextBar -> grid adds variance columns -> KPI cards show deltas
4. **Export Report**: Click Export -> select format -> POST job -> poll status -> download on completion

### Accessibility Requirements

- ARIA role="grid" with role="row", role="columnheader", role="gridcell"
- All cells `aria-readonly="true"`
- Expandable rows: `aria-level` (1-3), `aria-expanded` (true/false)
- Keyboard: Space to expand/collapse, Arrow keys for navigation, Ctrl+Shift+E expand all, Ctrl+Shift+C collapse all
- Screen reader announcements for calculation completion and export events
- Color contrast ratios meet WCAG AA for all status colors (green/amber/red)

## Edge Cases Cross-Reference

| Case ID | Description                                   | Handling                                                                                                    |
| ------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| SA-001  | IEEE 754 Precision Loss                       | All P&L engine arithmetic uses Decimal.js. Never native JS arithmetic on monetary values.                   |
| SA-006  | Multi-stage rounding in discount cascade      | P&L engine aggregates pre-rounded upstream values; no additional rounding until presentation (toFixed(2)).  |
| SA-009  | Non-tuition revenue distribution weights      | P&L consumes pre-calculated monthly values; weight validation is upstream.                                  |
| SA-010  | Orphan revenue records on enrollment deletion | P&L aggregates whatever is in MonthlyRevenue; staleness flag forces recalculation after enrollment changes. |
| SA-012  | Negative enrollment in pessimistic scenario   | P&L engine handles negative amounts correctly; IFRS sign conventions maintained regardless of polarity.     |
| SA-018  | Recalculation cascade performance             | P&L calculation is final in chain. Target < 500ms for P&L alone (aggregation only, no upstream recalc).     |
| SA-021  | Dirty Excel data in migration                 | P&L is downstream; data quality validated at import time. P&L engine validates non-null inputs.             |
| SA-028  | Excel export formula errors                   | ExcelJS writes static values (not formulas). No #DIV/0! or #REF! possible.                                  |
| SA-029  | PDF export SAR encoding                       | Use "SAR" text prefix instead of ﷼ symbol. @react-pdf/renderer handles UTF-8 natively.                      |

## Out of Scope

- **Scenario Modeling** (Epic 6): Base/Optimistic/Pessimistic scenario comparison is deferred to Epic 6.
- **Dashboard KPI Cards** (Epic 9): Dashboard page aggregation is deferred to Epic 9.
- **Actuals Import**: Importing actual vs. budget variance data is not in scope.
- **Cash Flow Statement**: Only Income Statement (P&L) is in scope; Balance Sheet and Cash Flow are excluded.
- **Multi-currency**: All amounts are in SAR only.
- **Latest Estimate blending**: Mixing Locked (actuals) with Draft (budget) periods is deferred.
- **Print preview**: Deferred to post-MVP.

## Open Questions

(None — all questions resolved during spec authoring.)

## Planner Agent Sign-Off

- [x] No open questions
- [x] Acceptance criteria are testable
- [x] Edge cases cross-referenced
- [x] Data model complete
- [x] API contract complete
- [x] UI/UX specification complete
