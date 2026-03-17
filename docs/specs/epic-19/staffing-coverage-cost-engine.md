# Epic 19: Staffing Coverage & Cost Engine

> Source Plan: `docs/plans/2026-03-17-dhg-staffing-redesign.md`

## Summary

Epic 19 delivers the staffing assignment model, coverage engine, HSA engine, cost engine
modifications, and calculation orchestration pipeline for the redesigned staffing module. It
introduces `StaffingAssignment` as the authoritative link between employee supply and teaching
demand, computes coverage gaps with status indicators, implements per-profile HSA cost
calculations, extends the category cost engine with 3 calculation modes, and rewrites the
staffing calculation pipeline as an atomic transaction. After this epic ships, EFIR budget
planners can explicitly assign teachers to requirement lines, see FTE coverage gaps, run the
full staffing calculation, and manage employee records with discipline/profile awareness.

## Acceptance Criteria

- AC-01: `StaffingAssignment` model with unique `(versionId, employeeId, band, disciplineId)` and proper indexes
- AC-02: Assignment CRUD validates disciplineId, band, isTeaching, and fteShare constraints
- AC-03: Coverage engine joins assignments to lines by `(band, disciplineCode)` with correct FTE aggregation
- AC-04: Coverage status: UNCOVERED/DEFICIT(< -0.25)/SURPLUS(> +0.25)/COVERED with gap = coveredFte - requiredFteRaw
- AC-05: Coverage warnings: OVER_ASSIGNED, ORPHANED_ASSIGNMENT, DEPARTED_WITH_ASSIGNMENTS
- AC-06: HSA engine: `hsaCostPerMonth = firstHourRate + max(0, hsaTargetHours-1) * additionalHourRate`
- AC-07: HSA applies only to hsaEligible=true AND costMode=LOCAL_PAYROLL
- AC-08: Cost engine skips AEFE_RECHARGE (zero-cost) and NO_LOCAL_COST (no output)
- AC-09: Category cost engine: 3 modes (FLAT_ANNUAL, PERCENT_OF_PAYROLL, AMOUNT_PER_FTE), 5 categories x 12 months
- AC-10: Calculation pipeline: atomic transaction, demand + coverage + HSA + cost + category cost
- AC-11: STAFFING removed from staleModules on calculate; PNL added
- AC-12: Employee endpoints include 6 new fields, validate isTeaching constraints, support VACANCY record type
- AC-13: Import resolves discipline via DisciplineAlias and service profile via heuristics
- AC-14: Auto-suggest endpoint returns proposed assignments with confidence levels (High/Medium)
- AC-15: Version clone copies all staffing tables with correct employee ID remapping

## Data Model Changes

### New Model

- `StaffingAssignment`: versionId, employeeId, band, disciplineId, fteShare, source (MANUAL/AUTO_SUGGESTED), note, isActive, unique (versionId, employeeId, band, disciplineId)

### Extended Models

- `Employee`: new fields validated on CRUD (recordType, costMode, disciplineId, serviceProfileId, homeBand, contractEndDate)

## API Endpoints

### Assignment Routes (version-scoped)

| Method | Path                                          | Auth      | Description                                  |
| ------ | --------------------------------------------- | --------- | -------------------------------------------- |
| GET    | `/versions/:vId/staffing/assignments`         | data:view | List with joined employee/discipline         |
| POST   | `/versions/:vId/staffing/assignments`         | data:edit | Create with validation, marks STAFFING stale |
| PUT    | `/versions/:vId/staffing/assignments/:id`     | data:edit | Update with validation, marks STAFFING stale |
| DELETE | `/versions/:vId/staffing/assignments/:id`     | data:edit | Remove, marks STAFFING stale                 |
| GET    | `/versions/:vId/staffing/assignments/suggest` | data:edit | Auto-suggest proposed assignments            |

### Calculation Routes (version-scoped)

| Method | Path                                | Auth      | Description                                           |
| ------ | ----------------------------------- | --------- | ----------------------------------------------------- |
| POST   | `/versions/:vId/calculate/staffing` | data:edit | Full pipeline rewrite: demand + coverage + HSA + cost |

### Employee Routes (modified)

| Method | Path                              | Auth      | Description                           |
| ------ | --------------------------------- | --------- | ------------------------------------- |
| GET    | `/versions/:vId/employees`        | data:view | Includes 6 new fields                 |
| POST   | `/versions/:vId/employees`        | data:edit | Validates isTeaching constraints      |
| PUT    | `/versions/:vId/employees/:id`    | data:edit | Validates isTeaching constraints      |
| POST   | `/versions/:vId/employees/import` | data:edit | Alias resolution + profile heuristics |

## Out of Scope

- Frontend components (Epic 20)
- Settings CRUD (Epic 18)
- Master data models (Epic 18)
- Demand engine (Epic 18)

## Open Questions

None — all design decisions resolved in the source plan.
