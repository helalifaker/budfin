# Feature Spec: Scenario Modeling

> Epic: #12 | Phase: 4 — SPECIFY | Status: Approved | Date: 2026-03-25

## Summary

Epic 6 delivers scenario modeling, allowing finance staff to create and compare Base, Optimistic, and Pessimistic budget scenarios within a single version. Each scenario has adjustable parameters (enrollment factor, retention adjustment, fee collection rate) that feed into the existing calculation engines as multipliers. A scenario parameters editor lets users configure these assumptions, and a comparison view shows all three scenarios side-by-side.

Existing infrastructure: MonthlyRevenue and MonthlyOtherRevenue already have `scenarioName` columns. The workspace context store already has `scenarioId`. This epic adds the parameters table, the parameter editor UI, the comparison view, and scenario-scoped calculation.

## Acceptance Criteria

- [x] AC-01: ScenarioParameters table stores 3 named scenarios (Base, Optimistic, Pessimistic) per version with 6 adjustable fields: newEnrollmentFactor, retentionAdjustment, feeCollectionRate, scholarshipAllocation, attritionRate, orsHours.
- [x] AC-02: GET `/scenarios/parameters` returns all 3 scenario parameter sets for a version.
- [x] AC-03: PATCH `/scenarios/parameters/:scenarioName` updates scenario parameters. Marks REVENUE and downstream as stale.
- [x] AC-04: GET `/scenarios/comparison` returns side-by-side P&L totals for all 3 scenarios with delta percentages vs Base.
- [x] AC-05: Scenario parameters editor page at `/planning/scenarios` with form fields for all 6 parameters per scenario.
- [x] AC-06: Scenario comparison view shows 3-column layout with revenue, staff costs, EBITDA, net profit for each scenario.
- [x] AC-07: Default scenario parameters are created when a version is created (Base: all factors = 1.0).
- [x] AC-08: Version clone copies scenario parameters.

## Stories

| #   | Story                                      | Depends On | GitHub Issue |
| --- | ------------------------------------------ | ---------- | ------------ |
| 1   | Scenario parameters data model and types   | --         | TBD          |
| 2   | Scenario parameters API routes (GET/PATCH) | Story 1    | TBD          |
| 3   | Scenario comparison API route              | Story 1    | TBD          |
| 4   | Scenario parameters editor page            | Story 2    | TBD          |
| 5   | Scenario comparison view                   | Story 3, 4 | TBD          |

## Data Model Changes

```prisma
model ScenarioParameters {
  id                    Int     @id @default(autoincrement())
  versionId             Int     @map("version_id")
  scenarioName          String  @map("scenario_name") @db.VarChar(20)
  newEnrollmentFactor   Decimal @default(1.000000) @map("new_enrollment_factor") @db.Decimal(7, 6)
  retentionAdjustment   Decimal @default(1.000000) @map("retention_adjustment") @db.Decimal(7, 6)
  feeCollectionRate     Decimal @default(1.000000) @map("fee_collection_rate") @db.Decimal(7, 6)
  scholarshipAllocation Decimal @default(0.000000) @map("scholarship_allocation") @db.Decimal(7, 6)
  attritionRate         Decimal @default(0.000000) @map("attrition_rate") @db.Decimal(7, 6)
  orsHours              Decimal @default(18.0000) @map("ors_hours") @db.Decimal(5, 4)
  createdAt             DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime @updatedAt @map("updated_at") @db.Timestamptz

  version BudgetVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([versionId, scenarioName], map: "uq_scenario_params")
  @@map("scenario_parameters")
}
```

## API Endpoints

| Method | Path                                                             | Request            | Response                                 | Auth                |
| ------ | ---------------------------------------------------------------- | ------------------ | ---------------------------------------- | ------------------- |
| GET    | `/api/v1/versions/:versionId/scenarios/parameters`               | --                 | `{ scenarios: ScenarioParams[] }`        | Bearer, `data:view` |
| PATCH  | `/api/v1/versions/:versionId/scenarios/parameters/:scenarioName` | `{ field: value }` | `{ updated: ScenarioParams }`            | Bearer, `data:edit` |
| GET    | `/api/v1/versions/:versionId/scenarios/comparison`               | --                 | `{ scenarios: ScenarioComparisonRow[] }` | Bearer, `data:view` |

## Out of Scope

- Modifying calculation engines to apply scenario multipliers (deferred — engines already produce Base scenario results; Optimistic/Pessimistic would require engine modifications)
- Custom scenario names beyond Base/Optimistic/Pessimistic
- Per-line-item scenario overrides

## Open Questions

(None)

## Planner Agent Sign-Off

- [x] No open questions
- [x] Acceptance criteria are testable
- [x] Data model complete
- [x] API contract complete
