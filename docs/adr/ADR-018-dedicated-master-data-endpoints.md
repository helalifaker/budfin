# ADR-018: Dedicated Master Data REST Endpoints Instead of Generic system-config

> Date: 2026-03-06 | Status: Accepted | Deciders: Implementation team

## Context

The original TDD API contract (Section 6.3.10 in `04_api_contract.md`) designed master data management (FR-MDM-001 through FR-MDM-008) as part of a generic `GET/PUT /api/v1/system-config` endpoint that stored all configuration as a single JSON blob. This approach was simple but had several limitations as the feature spec for Epic 7 was developed:

- No per-entity validation (e.g., account code patterns, date ordering for academic years, percentage ordering for grade levels).
- No optimistic locking at the entity level -- concurrent edits could silently overwrite each other.
- No referential integrity enforcement -- deleting a referenced account would not be caught.
- No audit trail at the entity level -- only a single "system config changed" event.
- Scaling concerns if the JSON blob grew large with 7 distinct entity types.

## Decision

Replace the generic `system-config` approach for master data with 7 dedicated REST resource endpoints under `/api/v1/master-data/`, each backed by its own Prisma model and database table.

The new endpoints are:
- `/api/v1/master-data/accounts` -- Chart of Accounts (CRUD)
- `/api/v1/master-data/academic-years` -- Academic Years (CRUD)
- `/api/v1/master-data/grade-levels` -- Grade Levels (GET + PUT only)
- `/api/v1/master-data/nationalities` -- Nationalities (CRUD)
- `/api/v1/master-data/tariffs` -- Tariffs (CRUD)
- `/api/v1/master-data/departments` -- Departments (CRUD)
- `/api/v1/master-data/assumptions` -- Assumptions (GET + PATCH)

Each entity has its own Zod validation schema, optimistic lock version column, SQL CHECK constraints, and per-record audit logging.

## Consequences

### Positive

- Entity-level validation with Zod schemas catches invalid data at the API boundary (e.g., account codes matching `^[A-Z0-9]{3,10}$`, academic year date ordering).
- Optimistic locking via `version` column prevents silent overwrites on concurrent edits.
- SQL CHECK constraints provide a second layer of defense at the database level.
- Referential integrity via foreign keys prevents deletion of records referenced by downstream modules.
- Fine-grained audit trail records who changed what entity, when.
- Each endpoint can enforce appropriate RBAC independently (e.g., Assumptions allow Editor role, while Chart of Accounts requires Admin).

### Negative

- More API surface area to maintain (7 route files instead of 1). Mitigated by consistent patterns across all route files and shared error handling.
- Deviation from the original TDD API contract design. Mitigated by documenting the full API spec in `docs/specs/epic-7/master-data-management.md`.

### Neutral

- The original `system-config` endpoints remain available for non-master-data system settings (session limits, lockout thresholds, etc.) as implemented in Epic 11.

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| Keep generic system-config JSON blob | No per-entity validation, no optimistic locking, no referential integrity, no granular audit trail |
| Single master-data endpoint with type discriminator | Overly complex request/response schemas; still cannot leverage SQL constraints per entity |

## References

- Feature spec: `docs/specs/epic-7/master-data-management.md`
- Original API contract: `docs/tdd/04_api_contract.md` Section 6.3.10
- PRD Section 8.6: FR-MDM-001 through FR-MDM-008
