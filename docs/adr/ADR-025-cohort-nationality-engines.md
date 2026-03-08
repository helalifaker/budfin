# ADR-025: Cohort Progression and Nationality Distribution Engines

> Date: 2026-03-08 | Status: Accepted | Deciders: Engineering team

## Context

BudFin's enrollment module previously required manual entry of AY2 headcounts and nationality breakdowns per grade. The source-of-truth Excel workbook (`ENROLLMENT_HEADCOUNT` Section B) models AY2 as a computed output: each grade's AY2 headcount is derived from the prior grade's AY1 headcount multiplied by a retention rate, plus lateral entries. Nationality distribution follows the same cohort flow, with retained students carrying forward their nationality proportions.

Without this computation, EFIR staff had to manually compute AY2 figures externally and re-enter them, creating opportunities for data entry errors and inconsistency between the tool and the workbook.

Two design decisions were required:

1. Where to place the computation logic (API service vs. database stored procedure vs. frontend).
2. How to store the parameters (retention rates, lateral entry weights) and computed results.

## Decision

Introduce two pure-function calculation engines and two new database tables:

**Engines (stateless, no DB dependencies):**

- **Cohort Engine** (`services/cohort-engine.ts`) -- Given AY1 headcounts and per-grade retention rates + lateral entry counts, computes AY2 headcounts for all 15 grades. PS (Petite Section) is a direct-entry grade with no retention from a prior grade. All other grades use `floor(priorGradeAY1 * retentionRate) + lateralEntryCount`.
- **Nationality Engine** (`services/nationality-engine.ts`) -- Given AY2 headcounts and prior-grade nationality data, distributes AY2 students across Francais/Nationaux/Autres buckets. Applies retention per nationality and distributes lateral entries by configurable weights. Uses integer reconciliation (largest-bucket adjustment) to ensure headcounts sum exactly to the grade total.

**Database tables:**

- **`cohort_parameters`** -- Stores per-version, per-grade retention rate (DECIMAL 5,4, default 0.97), lateral entry count (INT), and lateral nationality weights (Fr/Nat/Aut, each DECIMAL 5,4). Unique on `(version_id, grade_level)`.
- **`nationality_breakdown`** -- Stores per-version, per-period, per-grade, per-nationality weight and headcount with an `is_overridden` flag. Unique on `(version_id, academic_period, grade_level, nationality)`. Computed rows have `is_overridden = false`; user-edited rows have `is_overridden = true` and are preserved across recalculations.

Both engines are integrated into the enrollment calculation pipeline (`POST /calculate/enrollment`), which now:

1. Runs cohort progression to compute AY2 headcounts
2. Runs nationality distribution for non-overridden grades
3. Persists AY2 headcount rows and nationality breakdown rows
4. Runs capacity calculation on the combined AY1 + AY2 data

## Consequences

### Positive

- AY2 headcounts are formula-driven, matching the Excel workbook approach and eliminating manual computation
- Pure functions with no DB dependencies enable comprehensive unit testing (293 + 311 test lines)
- Override mechanism allows staff to manually adjust nationality breakdowns when the formula does not match reality, without losing the ability to recompute
- Version cloning deep-copies both tables, preserving the planning configuration across version iterations

### Negative

- Two additional database tables increase schema complexity -- mitigated by clear naming and CASCADE deletes tied to budget_versions
- The calculation pipeline is now a 12-step process (was 4 steps) -- acceptable given the added fidelity to the workbook model

### Neutral

- Lateral entry weights must sum to 1.0 when lateral count > 0; this is enforced by the API with a 422 response
- `Decimal.floor()` is used for retained student counts (conservative rounding -- no half-students)

## Alternatives Considered

| Option                                     | Why Rejected                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend-only calculation (no persistence) | AY2 data would not survive page reloads; downstream modules (Revenue, DHG) need persisted AY2 headcounts                                                        |
| PostgreSQL stored procedures               | Harder to unit test; engine logic should be co-located with other TypeScript business rules                                                                     |
| Single combined engine                     | Cohort progression and nationality distribution have different input shapes and can be tested independently; separation follows single-responsibility principle |

## References

- `apps/api/src/services/cohort-engine.ts` -- cohort progression pure functions
- `apps/api/src/services/nationality-engine.ts` -- nationality distribution pure functions
- `apps/api/prisma/migrations/20260308180000_cohort_nationality/migration.sql` -- table definitions
- `docs/plans/2026-03-08-enrollment-workspace-refactoring.md` -- Section 5.1, Cohort Grid specification
- FR-ENR-010 (Cohort progression modeling) and FR-ENR-011 (Lateral entry weight parameter) in `docs/tdd/10_traceability_matrix.md`
