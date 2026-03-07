# Feature Spec: Revenue Forecasting

> Epic: #6 | Phase: 4 — SPECIFY | Status: Approved | Date: 2026-03-07

## Summary

The Revenue module delivers EFIR's tuition revenue forecasting engine. It combines enrollment headcount (from Epic 1) with fee grids per grade/nationality/tariff, applies discount policies with highest-discount-wins mutual exclusivity, handles VAT treatment (15% for non-Nationaux, 0% for Saudi nationals), manages non-tuition revenue items with configurable monthly distribution, and produces monthly revenue schedules. The module provides 4 DB tables, 8 API endpoints, a pure calculation engine, and 4 UI tabs within the PlanningShell. PRD coverage: FR-REV-001 through FR-REV-021.

## Acceptance Criteria

- [ ] AC-01: Fee grid GET returns all fee entries for a version, filterable by academic_period (AY1, AY2, both)
- [ ] AC-02: Fee grid PUT validates tuition_ht against tuition_ttc / (1 + VAT_rate) with tolerance 0.0001; rejects on mismatch (422 VAT_MISMATCH)
- [ ] AC-03: Fee grid PUT marks REVENUE module as stale on the version's stale_modules
- [ ] AC-04: Discount policies GET returns all discount entries for a version (tariff + nationality + rate)
- [ ] AC-05: Discount policies PUT validates rate range 0.000000–1.000000; rejects out-of-range (422 INVALID_DISCOUNT_RATE)
- [ ] AC-06: Discount policies PUT marks REVENUE module as stale
- [ ] AC-07: Other revenue GET returns all line items with distribution_method, weight_array, specific_months, ifrs_category
- [ ] AC-08: Other revenue PUT validates weight_array sums to 1.0 (tolerance 0.0001) when distribution_method is CUSTOM_WEIGHTS; rejects on mismatch (422 INVALID_WEIGHT_ARRAY)
- [ ] AC-09: Other revenue PUT validates specific_months contains valid month numbers (1-12) when distribution_method is SPECIFIC_PERIOD
- [ ] AC-10: Revenue calculation engine produces correct monthly revenue using formula: Revenue_month = Headcount x NetFee / PeriodMonths (AY1: 6, AY2: 4, summer months 7-8: 0)
- [ ] AC-11: Revenue engine derives HT from TTC: TuitionHT = TuitionTTC / (1 + vatRate) where vatRate = 0 for Nationaux, 0.15 for others
- [ ] AC-12: Revenue engine applies highest-discount-wins when multiple discount policies match a segment
- [ ] AC-13: Revenue engine uses Decimal.js for all arithmetic (TC-001); no native JS Number for monetary values
- [ ] AC-14: Revenue calculate endpoint persists results to monthly_revenue table within a transaction, deleting previous results first
- [ ] AC-15: Revenue calculate endpoint returns run_id, duration_ms, and summary with total_revenue_ht_ay1, total_revenue_ht_ay2, total_annual_revenue_ht
- [ ] AC-16: Revenue results GET returns calculated data with grouping support (by grade, nationality, tariff, month)
- [ ] AC-17: All PUT endpoints reject writes on Locked/Archived versions (409 VERSION_LOCKED)
- [ ] AC-18: All PUT endpoints log changes to audit_entries
- [ ] AC-19: Revenue UI renders inside PlanningShell with tabs: Fees, Discounts, Other Revenue, Forecast
- [ ] AC-20: Fee grid UI supports inline editing with cell-level validation and save
- [ ] AC-21: Discount grid UI shows tariff x nationality matrix with editable rate cells
- [ ] AC-22: Other revenue editor supports adding/removing line items with distribution method selector
- [ ] AC-23: Forecast tab shows calculated monthly revenue with grouping controls and Calculate button
- [ ] AC-24: All monetary values transmitted as strings in API responses (TC-001)
- [ ] AC-25: Monthly revenue for months 7-8 (Jul-Aug) is always zero
- [ ] AC-26: Other revenue distribution methods work correctly: ACADEMIC_10 (10 months, 0 for Jul-Aug), YEAR_ROUND_12 (equal 12-month split), CUSTOM_WEIGHTS (weight_array), SPECIFIC_PERIOD (specific_months)
- [ ] AC-27: "Last bucket" rounding technique ensures distributed amounts sum exactly to annual total

## Stories

| #   | Story                                                                                | Depends On | GitHub Issue |
| --- | ------------------------------------------------------------------------------------ | ---------- | ------------ |
| 1   | Prisma migration: fee_grids, discount_policies, other_revenue_items, monthly_revenue | —          | #101         |
| 2   | Fee Grid API: GET/PUT with VAT validation                                            | 1          | #102         |
| 3   | Discount Policies API: GET/PUT with rate validation                                  | 1          | #103         |
| 4   | Other Revenue API: GET/PUT with weight validation                                    | 1          | #104         |
| 5   | Revenue calculation engine (pure function)                                           | —          | #105         |
| 6   | Revenue calculation endpoint + audit + stale modules                                 | 2, 3, 4, 5 | #106         |
| 7   | Revenue results API: GET with grouping                                               | 6          | #107         |
| 8   | Shared types + Revenue page shell + Fees tab UI                                      | 2          | #108         |
| 9   | Discounts tab UI + impact summary                                                    | 3, 8       | #109         |
| 10  | Other Revenue tab UI + distribution editor                                           | 4, 8       | #110         |
| 11  | Forecast tab UI + Calculate workflow                                                 | 6, 7, 8    | #111         |
| 12  | Integration tests (E2E API + UI smoke)                                               | 1–11       | #112         |

## Data Model Changes

### Table: fee_grids (new)

```sql
CREATE TABLE fee_grids (
  id                  BIGSERIAL       PRIMARY KEY,
  version_id          BIGINT          NOT NULL,
  academic_period     TEXT            NOT NULL,
  grade_level         TEXT            NOT NULL,
  nationality         TEXT            NOT NULL,
  tariff              TEXT            NOT NULL,
  dai                 DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  tuition_ttc         DECIMAL(15,4)   NOT NULL,
  tuition_ht          DECIMAL(15,4)   NOT NULL,
  term1_amount        DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  term2_amount        DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  term3_amount        DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  registration_fee    DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  re_registration_fee DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  insurance_fee       DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by          BIGINT          NOT NULL,
  updated_by          BIGINT,

  CONSTRAINT fee_grids_version_fk         FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT fee_grids_created_by_fk      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fee_grids_updated_by_fk      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fee_grids_period_check       CHECK (academic_period IN ('AY1', 'AY2')),
  CONSTRAINT fee_grids_grade_check        CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT fee_grids_nationality_check  CHECK (nationality IN ('Francais', 'Nationaux', 'Autres')),
  CONSTRAINT fee_grids_tariff_check       CHECK (tariff IN ('RP', 'R3+', 'Plein')),
  CONSTRAINT fee_grids_dai_check          CHECK (dai >= 0),
  CONSTRAINT fee_grids_tuition_ttc_check  CHECK (tuition_ttc >= 0),
  CONSTRAINT fee_grids_tuition_ht_check   CHECK (tuition_ht >= 0),
  CONSTRAINT fee_grids_composite_unique   UNIQUE (version_id, academic_period, grade_level, nationality, tariff)
);

CREATE INDEX fee_grids_revenue_calc_idx ON fee_grids (version_id, academic_period, grade_level, nationality, tariff);
```

### Table: discount_policies (new)

```sql
CREATE TABLE discount_policies (
  id              BIGSERIAL       PRIMARY KEY,
  version_id      BIGINT          NOT NULL,
  tariff          TEXT            NOT NULL,
  nationality     TEXT,
  discount_rate   DECIMAL(7,6)    NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by      BIGINT          NOT NULL,
  updated_by      BIGINT,

  CONSTRAINT discount_policies_version_fk       FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT discount_policies_created_by_fk    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT discount_policies_updated_by_fk    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT discount_policies_tariff_check     CHECK (tariff IN ('RP', 'R3+')),
  CONSTRAINT discount_policies_nationality_check CHECK (nationality IS NULL OR nationality IN ('Francais', 'Nationaux', 'Autres')),
  CONSTRAINT discount_policies_rate_check       CHECK (discount_rate >= 0 AND discount_rate <= 1),
  CONSTRAINT discount_policies_composite_unique UNIQUE (version_id, tariff, nationality)
);

CREATE INDEX discount_policies_calc_idx ON discount_policies (version_id, tariff, nationality);
```

### Table: other_revenue_items (new)

```sql
CREATE TABLE other_revenue_items (
  id                    BIGSERIAL       PRIMARY KEY,
  version_id            BIGINT          NOT NULL,
  line_item_name        TEXT            NOT NULL,
  annual_amount         DECIMAL(15,4)   NOT NULL,
  distribution_method   TEXT            NOT NULL,
  weight_array          JSONB,
  specific_months       INTEGER[],
  ifrs_category         TEXT            NOT NULL,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by            BIGINT          NOT NULL,
  updated_by            BIGINT,

  CONSTRAINT other_revenue_version_fk       FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT other_revenue_created_by_fk    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT other_revenue_updated_by_fk    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT other_revenue_amount_check     CHECK (annual_amount > -1000000000),
  CONSTRAINT other_revenue_method_check     CHECK (distribution_method IN ('ACADEMIC_10', 'YEAR_ROUND_12', 'CUSTOM_WEIGHTS', 'SPECIFIC_PERIOD')),
  CONSTRAINT other_revenue_ifrs_check       CHECK (ifrs_category IN (
    'REVENUE_FROM_CONTRACTS', 'OTHER_OPERATING_INCOME', 'EMPLOYEE_BENEFITS_EXPENSE',
    'DEPRECIATION_AMORTIZATION', 'OPERATING_EXPENSES', 'FINANCE_INCOME', 'FINANCE_COSTS', 'ZAKAT'
  )),
  CONSTRAINT other_revenue_name_unique      UNIQUE (version_id, line_item_name),
  CONSTRAINT other_revenue_specific_months_check CHECK (
    specific_months IS NULL OR (
      array_length(specific_months, 1) >= 1 AND 1 <= ALL(specific_months) AND 12 >= ALL(specific_months)
    )
  )
);

CREATE INDEX other_revenue_items_version_idx ON other_revenue_items (version_id);
```

### Table: monthly_revenue (new)

```sql
CREATE TABLE monthly_revenue (
  id                      BIGSERIAL       PRIMARY KEY,
  version_id              BIGINT          NOT NULL,
  scenario_name           TEXT            NOT NULL DEFAULT 'Base',
  academic_period         TEXT            NOT NULL,
  grade_level             TEXT            NOT NULL,
  nationality             TEXT            NOT NULL,
  tariff                  TEXT            NOT NULL,
  month                   INTEGER         NOT NULL,
  gross_revenue_ht        DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  discount_amount         DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  scholarship_deduction   DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  net_revenue_ht          DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  vat_amount              DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  calculated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  calculated_by           BIGINT,
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT monthly_revenue_version_fk       FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT monthly_revenue_calculated_by_fk FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT monthly_revenue_period_check     CHECK (academic_period IN ('AY1', 'AY2')),
  CONSTRAINT monthly_revenue_grade_check      CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT monthly_revenue_month_check      CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT monthly_revenue_scenario_check   CHECK (scenario_name IN ('Base', 'Optimistic', 'Pessimistic')),
  CONSTRAINT monthly_revenue_composite_unique UNIQUE (version_id, scenario_name, academic_period, grade_level, nationality, tariff, month)
);

CREATE INDEX monthly_revenue_version_month_idx ON monthly_revenue (version_id, month);
CREATE INDEX monthly_revenue_version_period_idx ON monthly_revenue (version_id, academic_period);
```

## API Endpoints

| Method | Path                                            | Request                                       | Response                           | Auth                       |
| ------ | ----------------------------------------------- | --------------------------------------------- | ---------------------------------- | -------------------------- |
| GET    | `/api/v1/versions/:versionId/fee-grid`          | `?academic_period=AY1\|AY2\|both`             | `{ entries: FeeGridEntry[] }`      | All authenticated          |
| PUT    | `/api/v1/versions/:versionId/fee-grid`          | `{ entries: FeeGridEntry[] }`                 | `{ updated: number }`              | Admin, BudgetOwner, Editor |
| GET    | `/api/v1/versions/:versionId/discounts`         | —                                             | `{ entries: DiscountEntry[] }`     | All authenticated          |
| PUT    | `/api/v1/versions/:versionId/discounts`         | `{ entries: DiscountEntry[] }`                | `{ updated: number }`              | Admin, BudgetOwner, Editor |
| GET    | `/api/v1/versions/:versionId/other-revenue`     | —                                             | `{ items: OtherRevenueItem[] }`    | All authenticated          |
| PUT    | `/api/v1/versions/:versionId/other-revenue`     | `{ items: OtherRevenueItem[] }`               | `{ updated: number }`              | Admin, BudgetOwner, Editor |
| POST   | `/api/v1/versions/:versionId/calculate/revenue` | —                                             | `{ run_id, duration_ms, summary }` | Admin, BudgetOwner, Editor |
| GET    | `/api/v1/versions/:versionId/revenue`           | `?group_by=grade\|nationality\|tariff\|month` | `{ results: RevenueResult[] }`     | All authenticated          |

## UI/UX Specification

> Source: `docs/ui-ux-spec/04-revenue.md` | Cross-cutting: `00-global-framework.md`, `10-input-management.md`

### Shell & Layout

PlanningShell with Module Toolbar containing: module title "Revenue", AY1/AY2 period filter, Calculate button, Export button, More menu. Tab bar with 4 tabs: Fees, Discounts, Other Revenue, Forecast.

### Key Components

| Component          | Type              | Source            | Notes                                                 |
| ------------------ | ----------------- | ----------------- | ----------------------------------------------------- |
| FeeGridTable       | TanStack Table v8 | UI spec Section 3 | Inline-editable grid, ~90 rows, grouped by grade band |
| DiscountGrid       | TanStack Table v8 | UI spec Section 4 | Tariff x nationality matrix with editable rate cells  |
| OtherRevenueEditor | Form + Table      | UI spec Section 5 | Line-item CRUD with distribution method selector      |
| ForecastGrid       | TanStack Table v8 | UI spec Section 6 | Read-only calculated results with grouping controls   |
| CalculateButton    | shadcn/ui Button  | UI spec Section 2 | Triggers POST calculate/revenue, shows loading state  |

### User Flows

1. **Fee Entry**: User navigates to Revenue > Fees tab -> selects AY1/AY2 -> edits fee cells inline -> cell validates on blur -> auto-saves via PUT
2. **Discount Setup**: User switches to Discounts tab -> edits discount rate cells -> validates 0-100% range -> auto-saves via PUT
3. **Other Revenue**: User switches to Other Revenue tab -> adds line item -> selects distribution method -> enters annual amount -> saves
4. **Calculate**: User clicks Calculate button -> POST calculate/revenue -> loading spinner -> results populate Forecast tab
5. **Review**: User switches to Forecast tab -> groups by grade/nationality/month -> reviews totals

### Interaction Patterns

- Inline cell editing follows `10-input-management.md`: click to edit, blur or Enter to save, Escape to cancel
- Validation feedback via toast notifications (not inline divs)
- Stale indicator shown when REVENUE module is stale (inputs changed since last calculation)
- Calculate button disabled when version is Locked/Archived

### Accessibility Requirements

- Grid cells use `role="grid"` with `role="gridcell"` for editable tables
- Read-only Forecast tab uses `role="table"`
- All inputs have associated labels via `aria-label`
- Tab navigation between cells via Arrow keys
- Sufficient color contrast per WCAG AA (4.5:1 for text)

### Responsive / Viewport

Desktop-only (1280px min). Fee grid uses horizontal scroll for wide tables. No mobile layout required.

## UI Compliance

- [ ] All interactive elements use shadcn/ui primitives from `apps/web/src/components/ui/`
- [ ] Design tokens used (`var(--token)`) — no arbitrary hex colors
- [ ] Mutation feedback via `toast` — no inline div status messages
- [ ] Async states via `Skeleton` / `TableSkeleton` — no plain "Loading..." text
- [ ] Table ARIA: `role="grid"` (inline-editable) or `role="table"` (read-only Forecast)

## Edge Cases Cross-Reference

| Case ID | Description                                         | Handling                                                                                            |
| ------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| SA-001  | IEEE 754 precision loss in revenue chain            | All arithmetic via Decimal.js; monetary values stored as DECIMAL(15,4); transmitted as strings      |
| SA-006  | Multi-stage rounding in discount cascade            | Standardize: NetFee = round(GrossFee \* (1 - rate), 4); audit trail captures intermediate values    |
| SA-009  | Non-tuition revenue distribution weights            | Zod refinement: weight_array must have exactly 12 elements summing to 1.0 within 0.0001 tolerance   |
| SA-010  | Orphan revenue records on enrollment deletion       | monthly_revenue has CASCADE delete via version_id; re-calculation required after enrollment changes |
| SA-013  | Fee grid cascade on grade deletion                  | Grade levels are reference data (not deletable in production); fee_grids cascade via version_id     |
| SA-023  | Decimal vs integer discrepancies in fee grid import | All fee amounts validated as Decimal strings; Zod schema rejects non-numeric inputs                 |

## Out of Scope

- Scenario modeling (Optimistic/Pessimistic) — Epic 6. The scenario_name column is wired but defaults to 'Base'.
- Scholarship allocation deduction (FR-REV-015/020/021 scenario factors) — Epic 6
- PDF/Excel export of revenue reports — deferred to post-MVP
- Historical revenue data import — Epic 12
- Revenue variance analysis (actual vs budget) — Epic 5

## Open Questions

(None — all resolved during spec writing)

## Planner Agent Sign-Off

- [x] No open questions
- [x] Acceptance criteria are testable
- [x] Edge cases cross-referenced
- [x] Data model complete
- [x] API contract complete
- [x] UI/UX specification complete
