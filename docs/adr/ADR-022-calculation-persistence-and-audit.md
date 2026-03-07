# ADR-022: Calculation Persistence and Audit Logging

> Date: 2026-03-07 | Status: Accepted | Deciders: Engineering team

## Context

The enrollment capacity calculation endpoint (`POST /api/v1/versions/:versionId/calculate/enrollment`) previously computed sections needed, utilization, and alerts on every request but returned results only in the HTTP response. Results were ephemeral -- they existed solely in the API response and were lost on page reload. This created three problems:

1. **No persistence for downstream modules.** The DHG (Dotation Horaire Globale) and Staffing modules need calculated section counts as inputs. Without a persisted table, they would need to re-invoke the calculation engine or duplicate the logic.
2. **No audit trail.** There was no record of when a calculation was run, who triggered it, what inputs were used, or how long it took. The existing `auditEntry` table captures CRUD operations but is not structured for calculation runs with timing and I/O summaries.
3. **No atomicity.** The stale-modules update happened outside a transaction. If the server crashed between computing results and clearing the ENROLLMENT stale flag, the version could be left in an inconsistent state.

## Decision

Introduce two new database tables and wrap the entire calculation lifecycle in a Prisma `$transaction`.

**`dhg_requirements`** stores one row per (version, academic_period, grade_level) with the calculated fields: headcount, max_class_size, sections_needed, utilization, alert, and recruitment_slots. Rows are upserted on each calculation run.

**`calculation_audit_log`** stores one row per calculation run with: run_id (UUID), module name, status (STARTED/COMPLETED/FAILED), timing (started_at, completed_at, duration_ms), input_summary (JSONB), output_summary (JSONB), and the triggering user FK.

The transaction sequence is:

1. Insert STARTED audit log entry
2. Upsert all dhg_requirements rows
3. Remove ENROLLMENT from version stale_modules
4. Update audit log to COMPLETED with duration and output summary

If any step fails, the entire transaction rolls back -- no partial state.

## Consequences

### Positive

- DHG and Staffing modules can read persisted section counts directly from `dhg_requirements` without re-running the calculation engine
- Full audit trail of every calculation run with timing, inputs, and outputs for accountability and debugging
- Atomic persistence eliminates the window for inconsistent stale-module state

### Negative

- Each calculation run performs N+3 database writes inside a transaction (N upserts for grades, plus audit create, version update, audit update), which increases write latency slightly compared to the previous fire-and-forget approach

### Neutral

- The `dhg_requirements` table is scoped to enrollment calculations for now but is named generically to accommodate future DHG module extensions (staffing hours, teaching load)

## Alternatives Considered

| Option                                                    | Why Rejected                                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Store results in a JSONB column on budget_versions        | Loses queryability; downstream modules would need to parse JSON blobs instead of joining on a relational table                                               |
| Use the existing auditEntry table for calculation logs    | auditEntry is designed for CRUD event logging (entity/action/before/after); it lacks fields for run timing, I/O summaries, and module-scoped status tracking |
| Skip persistence and have downstream modules re-calculate | Duplicates logic, increases latency on DHG/Staffing pages, and makes it impossible to audit when calculations occurred                                       |

## References

- Feature spec: `docs/specs/epic-1/enrollment-capacity.md` (AC-10 through AC-15, AC-23)
- Prisma schema: `apps/api/prisma/schema.prisma` (DhgRequirement, CalculationAuditLog models)
- Migration: `apps/api/prisma/migrations/20260307180100_add_dhg_and_calc_audit/migration.sql`
