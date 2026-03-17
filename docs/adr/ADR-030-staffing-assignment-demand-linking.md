# ADR-030: Staffing Assignments Link to Demand via Stable Keys, Not Derived Line IDs

> Date: 2026-03-17 | Status: Accepted | Deciders: Architecture team

## Context

Epic 19 introduces `StaffingAssignment` as the link between employee supply (teachers,
vacancies) and teaching demand (requirement lines produced by the demand engine in Epic 18).
The demand engine recalculates requirement lines on every staffing calculation run, deleting
and recreating `TeachingRequirementLine` rows. If assignments referenced requirement line IDs
directly, they would be orphaned or require complex remapping after every calculation.

The staffing calculation pipeline also grew from a simple 2-pass (DHG + cost) to a 10-step
orchestration (validate, load, demand, coverage, HSA, cost, category cost, aggregation,
persist, stale update). A decision was needed on whether to run these steps independently
or as a single atomic transaction.

## Decision

Assignments reference demand lines via the stable composite key `(band, disciplineId)` rather
than the derived `TeachingRequirementLine.id`. The coverage engine joins assignments to lines
by matching `(band, disciplineCode)` at computation time. This makes assignments durable
across recalculations.

The 10-step calculation pipeline runs inside a single Prisma `$transaction` to guarantee
atomicity. All derived outputs (requirement sources, requirement lines, monthly staff costs,
EoS provisions, category monthly costs) are deleted and reinserted within the same transaction,
ensuring no partial state is ever visible to readers.

## Consequences

### Positive

- Assignments survive demand recalculation without remapping or orphaning
- The `(band, disciplineCode)` join is guaranteed unique per requirement line because
  DhgRule validation (Epic 18, section 6.4 rule #4) enforces at most one lineType per
  `(gradeLevel, disciplineId)`, which maps to one line per `(band, disciplineCode)`
- Single-transaction pipeline eliminates partial calculation states that could confuse
  users or downstream modules (P&L)
- Orphaned assignments (where the underlying DhgRule was removed) are detected by the
  coverage engine and surfaced as warnings, not silently dropped

### Negative

- The `(band, disciplineCode)` join requires resolving `disciplineId` to `disciplineCode`
  at query time, adding a JOIN to assignment queries -- mitigated by the
  `idx_staffing_assignment_demand` index on `(versionId, band, disciplineId)`
- Large transaction scope (10 steps) holds a database transaction open longer than the
  previous 2-step pipeline -- mitigated by the bounded dataset size (fewer than 200
  employees and 100 requirement lines in EFIR's single-school deployment)

### Neutral

- The `source` field on assignments (`MANUAL`, `AUTO_SUGGESTED`, `IMPORTED`) is metadata
  only and does not affect coverage computation or cost allocation

## Alternatives Considered

| Option                                            | Why Rejected                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| FK to `TeachingRequirementLine.id`                | Lines are recalculated outputs that get deleted/recreated -- FK would cascade-delete assignments on every calculation |
| Soft-delete requirement lines instead of recreate | Adds complexity to demand engine; stale soft-deleted lines accumulate; coverage engine must filter active-only        |
| Per-step independent transactions                 | Partial failures leave inconsistent state; downstream queries could read half-calculated data                         |

## References

- Feature spec: `docs/specs/epic-19/staffing-coverage-cost-engine.md`
- Design plan: `docs/plans/2026-03-17-dhg-staffing-redesign.md` (sections 6.10, 7.2-7.6)
- Epic 18 DhgRule uniqueness constraint: section 6.4 rule #4
