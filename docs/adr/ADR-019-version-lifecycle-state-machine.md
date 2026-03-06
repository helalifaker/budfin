# ADR-019: Version Lifecycle State Machine with Role-Gated Transitions

> Date: 2026-03-06 | Status: Accepted | Deciders: Implementation team

## Context

Epic 10 (Version Management) requires budget versions to move through a defined lifecycle: Draft, Published, Locked, and Archived. The PRD specifies that only certain roles may perform certain transitions, that reverse transitions (e.g., Published back to Draft) should be restricted to Admins and require an audit justification, and that lifecycle timestamps must be managed precisely (set on forward transitions, cleared on reverse transitions).

Several implementation approaches were considered for encoding the allowed transitions, role requirements, and side effects (timestamps, modification counters, audit entries).

## Decision

Implement the lifecycle as a declarative state machine defined in a `TRANSITIONS` lookup table within the versions route module. Each entry maps `(currentStatus, targetStatus)` to a transition definition containing:

- **roles**: which user roles may perform this transition
- **isReverse**: whether this is a reverse transition (triggers audit note requirement and modification counter increment)
- **timestampField**: which timestamp column to set on forward transitions (e.g., `publishedAt`, `lockedAt`, `archivedAt`)
- **clearFields**: which timestamp columns to null out on reverse transitions
- **operation**: the audit log operation name (e.g., `VERSION_PUBLISHED`, `VERSION_REVERTED`)

The single `PATCH /versions/:id/status` handler looks up the transition, enforces all guards (role check, audit note length for reverse transitions, invalid transition rejection), and applies the update + audit entry within a single Prisma transaction.

## Consequences

### Positive

- All valid transitions are visible in one data structure, making the state machine easy to audit and extend
- Adding a new state or transition requires only adding an entry to the lookup table -- no control flow changes
- Role enforcement, audit logging, and timestamp management are handled uniformly for all transitions
- Reverse transitions automatically increment `modificationCount`, providing a tamper-evident counter
- Invalid transitions return a clear 409 error with the current and requested states

### Negative

- The state machine is defined in application code rather than at the database level (e.g., PostgreSQL CHECK constraints or triggers). Mitigated by the fact that all writes go through the API, and the Prisma schema enforces the enum values at the column level.

### Neutral

- Actual versions are created only via the import flow (not manual creation), so the state machine applies equally to Budget and Forecast types. Actual version restrictions are enforced separately at the create/clone endpoints.

## Alternatives Considered

| Option | Why Rejected |
|--------|-------------|
| Database-level state machine (triggers + CHECK constraints) | More complex to maintain; transition logic would be split between application and database; harder to include role checks and audit note validation in SQL |
| Separate endpoints per transition (e.g., POST /versions/:id/publish) | Proliferates endpoints unnecessarily; the state machine pattern with a single PATCH endpoint is more RESTful and easier to extend |
| External workflow engine (e.g., XState, temporal) | Over-engineering for a 4-state linear lifecycle; adds a runtime dependency for minimal benefit |

## References

- Version routes: `apps/api/src/routes/versions.ts` (TRANSITIONS constant, lines 37-74)
- Lifecycle tests: `apps/api/src/routes/versions-lifecycle.test.ts`
- PRD Section 8.1: FR-VER-003 (Version lifecycle transitions)
- TDD: `docs/tdd/02_component_design.md` (Version Manager component)
