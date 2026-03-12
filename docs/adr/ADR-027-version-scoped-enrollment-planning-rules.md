# ADR-027: Version-Scoped Enrollment Planning Rules on BudgetVersion

> Date: 2026-03-12 | Status: Accepted | Deciders: BudFin Engineering

## Context

The enrollment cohort-progression engine uses two parameters to derive AY2 headcounts from AY1:

- **Rollover threshold** — the capacity utilization ratio above which the engine recommends capping growth
  (previously hard-coded to 1.05; corrected value per EFIR workbook is 1.00).
- **Capped retention rate** — the retention fraction applied when the rollover threshold is breached
  (previously hard-coded to 0.97; corrected value per EFIR workbook is 0.98).

Prior to PR #184 these values were compile-time constants in
`apps/api/src/services/cohort-recommendations.ts`. That meant:

1. Every budget version shared the same thresholds — no version-level override was possible.
2. Changing the values required a code deployment, not an in-app edit.
3. The setup wizard showed recommendations derived from the wrong thresholds, creating a visible
   discrepancy between wizard previews and the actual calculation output.

Three storage locations were evaluated for making these values configurable.

## Decision

Store `rollover_threshold` and `capped_retention` as two `DECIMAL(5,4)` columns directly on the
`budget_versions` table, with defaults of `1.0000` and `0.9800` respectively.

The `GET /api/v1/versions/:versionId/enrollment/planning-rules` and
`PUT /api/v1/versions/:versionId/enrollment/planning-rules` endpoints read and write these fields.
The setup wizard's `POST .../setup` body accepts an optional `planningRules` object that writes them
atomically inside the same transaction that applies enrollment headcounts. The calculate endpoint
reads the fields from the version row at the moment of calculation so results are always consistent
with the rules that were in effect.

Version cloning carries the source version's planning rules forward by copying both columns into the
newly created version row.

## Consequences

### Positive

- Each budget version carries its own planning rules — a scenario version can test a conservative
  0.95 retention rate without affecting the live budget version.
- The setup wizard and the calculate endpoint consume the same stored values, eliminating the
  previous discrepancy between wizard previews and actual calculation output.
- Version cloning preserves planning rules, so a cloned version begins from the same assumptions
  as its source rather than falling back to system-wide defaults.
- No new table is required — two columns on an existing row avoids a join and keeps the planning
  rules co-located with the version metadata they govern.
- The corrected threshold values (1.00 / 0.98) are applied as column defaults and backfilled by the
  migration, so existing versions automatically receive the correct values without a manual data fix.

### Negative

- Planning rules are not independently version-controlled; if a user changes the rules mid-planning
  cycle, there is no history of what the rules were before the change (mitigated by the enrollment
  module being marked stale on any rule change, forcing a recalculate before results can be trusted).
- Adding two columns to `budget_versions` increases the surface area of the version serialization
  format — callers that cache version JSON must accommodate the two new fields.

### Neutral

- A separate `enrollment_planning_rules` table was considered but rejected (see Alternatives).
- The `defaultAy2Intake` field added to `grade_levels` in the same migration follows the same
  embedded-config pattern for a different domain (master data rather than version data) and is not
  governed by this ADR.

## Alternatives Considered

| Option                                                           | Why Rejected                                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Keep as compile-time constants                                   | Not configurable without a code deployment; prevents per-version scenario testing                                                         |
| Separate `enrollment_planning_rules` table keyed on `version_id` | Extra join for every calculation; requires its own clone logic; adds complexity without benefit given there are exactly two scalar values |
| System-level configuration (Assumptions table)                   | Rules would apply globally across all versions, defeating the per-version isolation requirement                                           |

## References

- Feature plan: `docs/plans/2026-03-11-enrollment-page-redesign.md`
- Migration: `apps/api/prisma/migrations/20260311103000_enrollment_redesign_rules/migration.sql`
- Implementation: `apps/api/src/services/planning-rules.ts`, `apps/api/src/routes/enrollment/planning-rules.ts`
- PR #184 (Enrollment Planning Workspace Redesign)
