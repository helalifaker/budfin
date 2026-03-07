# Feature Spec: Revenue Module (Epic 2)

> **Epic:** #6 — Revenue
> **PRD Coverage:** FR-REV-001 through FR-REV-021
> **Status:** Approved
> **Date:** 2026-03-07

---

## 1. Overview

The Revenue module delivers EFIR's revenue forecasting capability: fee grids, discount policies,
non-tuition revenue items, and a calculation engine that produces monthly revenue schedules.
All data is version-scoped (via BudgetVersion) and follows the same CRUD + Calculate pattern
established by Epic 1 (Enrollment).

## 2. Database Tables

Four new tables added to the Prisma schema:

| Table                 | Purpose                                             | Key Constraints                                         |
| --------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `fee_grids`           | Fee schedules per grade/nationality/tariff/period   | Unique on (version, period, grade, nationality, tariff) |
| `discount_policies`   | Discount rates for RP/R3+ tariffs                   | Unique on (version, tariff, nationality)                |
| `other_revenue_items` | Non-tuition revenue (cantine, transport, DAI, etc.) | Unique on (version, line_item_name)                     |
| `monthly_revenue`     | Calculated output: monthly revenue breakdown        | Unique on 7 columns incl. scenario_name                 |

## 3. API Endpoints

| Method | Path                                     | Purpose                     |
| ------ | ---------------------------------------- | --------------------------- |
| GET    | `/versions/:versionId/fee-grid`          | List fee grid entries       |
| PUT    | `/versions/:versionId/fee-grid`          | Upsert fee grid entries     |
| GET    | `/versions/:versionId/discounts`         | List discount policies      |
| PUT    | `/versions/:versionId/discounts`         | Upsert discount policies    |
| GET    | `/versions/:versionId/other-revenue`     | List other revenue items    |
| PUT    | `/versions/:versionId/other-revenue`     | Upsert other revenue items  |
| POST   | `/versions/:versionId/calculate/revenue` | Run revenue calculation     |
| GET    | `/versions/:versionId/revenue-results`   | Retrieve calculated results |

## 4. Revenue Engine

Pure function engine (`services/revenue-engine.ts`) with no DB dependencies.

### Formula

```
Revenue_month = Headcount x TuitionHT / PeriodMonths
  AY1 (months 1-6): PeriodMonths = 6
  AY2 (months 9-12): PeriodMonths = 4
  Summer (months 7-8): Revenue = 0
```

### VAT Treatment

- Nationaux: 0% VAT (TuitionHT = TuitionTTC)
- Francais/Autres: 15% VAT (TuitionHT = TuitionTTC / 1.15)

### Discount Resolution

- Highest applicable discount rate wins (SA-006)
- Matching: exact (tariff + nationality) or wildcard (tariff + null)
- Only RP and R3+ tariffs have discounts

### Distribution Methods (Other Revenue)

- `ACADEMIC_10`: 10 academic months (excludes Jul-Aug)
- `YEAR_ROUND_12`: Equal split across 12 months
- `CUSTOM_WEIGHTS`: 12-element weight array summing to 1.0
- `SPECIFIC_PERIOD`: Equal split across specified months

### Last-Bucket Rounding

All monthly distributions use "last bucket" technique: first N-1 months get
`floor(total / N, 4dp)`, last month gets `total - sum(first N-1)`. This ensures
monthly amounts sum exactly to the annual total.

## 5. UI Tabs

| Tab           | Type                 | Components                            |
| ------------- | -------------------- | ------------------------------------- |
| Fees          | Inline-editable grid | TanStack Table, validation on blur    |
| Discounts     | Inline-editable grid | TanStack Table, rate validation       |
| Other Revenue | Form-based editor    | React Hook Form, distribution preview |
| Forecast      | Read-only grid       | TanStack Table, Calculate button      |

All tabs render inside `PlanningShell` at route `/planning/revenue`.

## 6. Acceptance Criteria

1. Fee grid CRUD with VAT validation (FR-REV-001-006)
2. Discount policies CRUD with rate validation (FR-REV-007-010)
3. Other revenue CRUD with weight validation (FR-REV-014-019)
4. Revenue engine produces correct monthly breakdown
5. Last-bucket rounding ensures exact annual totals
6. Nationaux VAT exemption applied correctly
7. Highest discount wins when multiple policies match
8. Summer months (Jul-Aug) produce zero revenue
9. Stale module tracking on data changes
10. Version lock guard on all PUT endpoints
11. Audit logging for all mutations
12. All monetary arithmetic uses Decimal.js (TC-001)

## 7. Stories

| #    | Story                                        | Issue | Type       |
| ---- | -------------------------------------------- | ----- | ---------- |
| 2.1  | Prisma migration: 4 revenue tables           | #101  | Backend    |
| 2.2  | Fee Grid API: GET/PUT with VAT validation    | #102  | Backend    |
| 2.3  | Discount Policies API: GET/PUT               | #103  | Backend    |
| 2.4  | Other Revenue API: GET/PUT                   | #104  | Backend    |
| 2.5  | Revenue calculation engine (pure function)   | #105  | Backend    |
| 2.6  | Revenue calculation endpoint + audit         | #106  | Backend    |
| 2.7  | Revenue results API: GET with grouping       | #107  | Backend    |
| 2.8  | Shared types + Revenue page shell + Fees tab | #108  | Full-stack |
| 2.9  | Discounts tab UI                             | #109  | Full-stack |
| 2.10 | Other Revenue tab UI                         | #110  | Full-stack |
| 2.11 | Forecast tab UI + Calculate workflow         | #111  | Full-stack |
| 2.12 | Integration tests                            | #112  | Test       |

## 8. Edge Cases

- SA-001: Decimal.js precision for all monetary arithmetic
- SA-006: Discount cascade — highest rate wins, standardized rounding
- SA-009: Weight array validation — sum within 0.0001 tolerance
- SA-010: Orphan revenue on enrollment delete — CASCADE via Prisma
- SA-013: Grade deletion impact on fee grid — CASCADE
- SA-023: Decimal import precision — string-based serialization
