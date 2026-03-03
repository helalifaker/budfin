# Section 12 — Open Questions & Decisions Log

This section documents all open questions raised during TDD authoring, the assumptions made when concrete answers were unavailable, and the formal Architecture Decision Records (ADRs) that capture each significant design choice. Every item is resolved — there are no outstanding TBDs.

---

## 12.1 Open Questions (from PRD RAID Log)

All questions originally logged in the PRD RAID register have been investigated and resolved during TDD authoring. The table below records the original question, the resolution reached, the responsible owner, and the phase in which the resolution is validated.

| ID | Question | Resolution | Owner | Target Date |
| --- | --- | --- | --- | --- |
| I-001 | Executive Summary sheet has `#REF!` error in Excel source | Identified as cross-file reference to DHG workbook columns that were restructured. Resolve in Phase 1 Week 2 source data audit; does not block BudFin implementation as BudFin calculates P&L from scratch. | Finance SME + DBA | Phase 1 Week 2 |
| I-002 | Tech stack PoC must validate Decimal.js + PostgreSQL DECIMAL precision | Phase 1 Week 1 PoC: 50+ unit tests for Decimal.js; PostgreSQL DECIMAL(15,4) round-trip tests. TC-001 satisfied by Decimal.js; TC-003 satisfied by schema. | Tech Lead | Phase 1 Week 1 |
| I-003 | YEARFRAC US 30/360 implementation correctness | Custom TypeScript implementation documented in Section 4 (Component 4c). Validated against known Excel values in unit tests. Further validated against all 168 employee joining dates in Phase 3 Week 15. | Tech Lead | Phase 3 Week 15 |
| I-004 | Rounding rules — round-half-up vs. banker's rounding | TC-004 confirmed: round-half-up at presentation only; full DECIMAL(15,4) precision maintained throughout calculation chain. Implemented in Decimal.js with `Decimal.ROUND_HALF_UP`. | Tech Lead | Phase 1 Week 1 |
| I-005 | PDPL compliance assessment | Completed during TDD authoring. Field-level encryption using pgcrypto pgp_sym_encrypt/decrypt for 5 salary fields. Key management via Docker secret. Data residency: KSA only per SA-008. Full mapping in Section 7.4. | Tech Lead + DBA | Phase 1 Week 3 |
| I-006 | MVP/Target/Stretch tier sign-off required from CAO | All MUST-tagged FRs = MVP. SHOULD-tagged = Target. COULD-tagged = Stretch. Sign-off from CAO at project kickoff meeting prior to Phase 1 start. | CAO + PM | Pre-Phase 1 |

---

## 12.2 Assumptions Made During TDD Authoring

Each assumption below records what was assumed, the reasoning behind it, the alternatives that were considered, and the concrete consequence if the assumption proves incorrect. These assumptions should be validated with the relevant stakeholder during Phase 1.

---

### A-TDD-001: Node.js + TypeScript Selected as Backend Runtime

**Assumed:** Node.js 20 LTS + TypeScript 5 is the backend technology.

**Alternatives considered:**

- **Python + FastAPI:** Strong Decimal support via the `decimal.Decimal` module; excellent pandas/openpyxl for migration scripts; but would create a split-language stack (Python backend + TypeScript frontend) increasing cognitive overhead for a 3-person team.
- **Java + Spring Boot:** Mature BigDecimal support; strong type system; but highest setup complexity, slowest development cycle for a small team, and no Prisma equivalent for TypeScript cross-cutting concerns.

**Chosen because:** Decimal.js ecosystem satisfies TC-001; Prisma ORM provides a native Decimal type for TC-003; full-stack TypeScript consistency reduces context switching; the team has stronger frontend TypeScript skills that transfer directly to backend development.

**Consequence if wrong:** Refactoring to a Python backend in Phase 1 would require approximately 2 weeks of rework before significant code investment accumulates (per R-011 risk mitigation window).

---

### A-TDD-002: PostgreSQL 16 Selected over MySQL 8

**Assumed:** PostgreSQL 16 is the database engine.

**Rationale:**

- **pgcrypto extension:** Provides field-level AES-256 encryption for PDPL salary fields. MySQL does not offer an equivalent built-in extension — third-party plugins would be required.
- **DECIMAL(15,4) support:** Both PostgreSQL and MySQL support this type, but PostgreSQL has more precise handling of decimal arithmetic in stored procedures and functions.
- **JSONB:** Superior performance for `audit_entries.old_values` / `new_values` columns compared to the MySQL JSON type, particularly for containment and path queries.
- **Prisma ORM:** Excellent PostgreSQL support with all features including DECIMAL type mapping and native migrations.

**Consequence if wrong:** Migrating to MySQL 8 would require replacing pgcrypto with application-layer encryption, replacing JSONB queries with JSON queries (minor), and rewriting any PostgreSQL-specific SQL. Estimated rework: 1 week.

---

### A-TDD-003: AG Grid Community (Free Tier) Sufficient

**Assumed:** AG Grid Community license is adequate for all v1 requirements.

**Rationale:** Enterprise features are not needed for v1 data volumes (at most 2,500 students, at most 168 employees):

- **Server-side row model:** Not needed — all datasets contain fewer than 500 rows and fit comfortably in client-side memory.
- **Pivoting:** Not needed — reports are pre-aggregated server-side before being sent to the grid.
- **Advanced filtering:** Community filtering is sufficient for grids with 50 to 200 rows.

**Consequence if wrong:** AG Grid Enterprise license costs approximately $1,200 per developer per year. Any feature gap would need to be identified in Phase 2 before committing to Community. Risk is assessed as low.

---

### A-TDD-004: Export Jobs Use In-Process PostgreSQL Queue (No Redis)

**Assumed:** The export job queue is implemented using a PostgreSQL-backed queue (pg-boss pattern) with the `export_jobs` table as the backing store, not with Redis + BullMQ.

**Rationale:** Redis adds infrastructure complexity (additional Docker service, operational overhead, failover configuration). For at most 20 concurrent users and at most 5 simultaneous export requests, a PostgreSQL-backed job queue is sufficient.

**Implementation note:** The worker process polls `export_jobs WHERE status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED` — a standard PostgreSQL advisory lock pattern. This provides at-most-once processing without Redis.

**Consequence if wrong:** If export volume exceeds approximately 20 concurrent jobs (unlikely for at most 20 users), adding Redis + BullMQ is a 1-day infrastructure addition with no schema changes required.

---

### A-TDD-005: calculation_audit_log Implemented as Separate Table

**Assumed:** Calculation run audit data (which module ran, input hash, output summary, duration) is stored in the `calculation_audit_log` table, separate from `audit_entries`.

**Rationale:** The two tables serve different consumers with different requirements:

- `audit_entries`: compliance and data change auditing; 7-year retention per NFR 11.5.
- `calculation_audit_log`: debugging and performance monitoring per NFR 11.12; 5-year retention.
- Different query patterns: `audit_entries` is queried by entity and user; `calculation_audit_log` is queried by module and duration.

**Consequence if wrong:** Merging into `audit_entries` is a schema change plus data migration. Risk is low.

---

### A-TDD-006: PDPL Salary Field Encryption via pgcrypto pgp_sym_encrypt

**Assumed:** AES-256 field-level encryption using PostgreSQL pgcrypto `pgp_sym_encrypt(value::text, $key)` / `pgp_sym_decrypt(encrypted::bytea, $key)`.

**Rationale:** Application-layer encryption requires decryption in the application before querying — this adds complexity and leaks unencrypted values in application memory for longer periods. pgcrypto keeps encryption and decryption at the database layer; the application passes the key as a parameter; this results in a simpler code path.

**Limitation:** Encrypted fields cannot be indexed or searched by value (not a requirement for salary fields). Database-level aggregations cannot operate on encrypted columns — the calculation engine decrypts first and computes in Decimal.js.

**Key rotation procedure:** Documented in Section 5.3. The encryption key is never stored in the database.

**Consequence if wrong:** Migrating to application-layer encryption (e.g., `node:crypto` AES-256-GCM) is an estimated 2-day rework of the repository layer.

---

## 12.3 Architecture Decision Records (ADRs)

Each ADR follows a consistent format: title, status, context, decision, rationale, alternatives rejected, and consequences. These records are immutable once accepted — future changes create new ADRs that supersede earlier ones.

---

### ADR-001: Monolithic Architecture over Microservices

**Status:** Accepted

**Context:** BudFin serves at most 20 concurrent users at a single school. The calculation chain (enrollment -> revenue -> DHG -> staff costs -> P&L) is tightly coupled across 4 modules. The development team consists of 3 engineers. The deployment target is a single-server Docker Compose stack within KSA.

**Decision:** Single monolithic Node.js + TypeScript application with a layered architecture (Presentation -> Application -> Domain -> Data).

**Rationale:** Microservices would introduce distributed transactions (saga pattern or 2-phase commit) for the calculation chain with no throughput benefit. The monolith uses a single PostgreSQL transaction for atomicity, which is simpler and more reliable. No scaling requirement exists beyond 20 users.

**Alternatives Rejected:**

- **Microservices per calculation domain:** Adds network latency, distributed tracing, and service discovery overhead with no benefit at this scale. A single calculation run would require 4 inter-service calls instead of 4 in-process function calls.
- **Serverless functions:** Cold starts are unacceptable for calculation endpoints that have a 3-second response target. No persistent connection pool is available for PostgreSQL.

**Consequences:** All calculation modules share the same process and memory; any unhandled crash affects all modules. Mitigated by Docker restart policy (`restart: unless-stopped`) and health checks (`/health` endpoint). Future multi-school expansion would require an architectural rethink, but this is explicitly out of v1 scope per SA-006.

---

### ADR-002: Server-Side Calculation over Client-Side

**Status:** Accepted

**Context:** Calculations could run in the browser (client-side Decimal.js) or on the server. Both are technically feasible given the data volumes involved.

**Decision:** All calculations run server-side exclusively. The browser never performs financial arithmetic.

**Rationale:**

1. **RBAC enforcement:** The server can verify that the user has permission to run calculations on a locked version before executing.
2. **Consistency:** A single calculation implementation eliminates the risk of browser vs. server divergence producing different results.
3. **Bundle size:** Decimal.js is not shipped to the browser, reducing the JavaScript bundle.
4. **Audit trail:** The server records calculation runs to `calculation_audit_log` with input/output hashes immediately after execution.

**Alternatives Rejected:**

- **Client-side calculation:** The browser could run out of memory on large datasets; calculation results would need to be re-sent to the server for persistence; RBAC bypass risk exists because client-side code is user-modifiable.

**Consequences:** The browser cannot show a calculation preview without a server round-trip. Mitigated by the explicit Calculate button (ADR-004) and the sub-3-second response target per NFR 11.1.

---

### ADR-003: Snapshot Copy Version Model over Event Sourcing

**Status:** Accepted

**Context:** Budget versions need isolation so that changing one version does not affect another. Users expect to "make a copy of the budget" and work on it independently.

**Decision:** On version clone, deep-copy all version-scoped data (employees, fee_grids, enrollment) into new rows with the new `version_id`. Each version is a complete, independent snapshot.

**Rationale:** The PRD explicitly designs all entities with a `version_id` foreign key. Snapshot copy matches the mental model of "making a copy of the budget." Event sourcing would require time-travel queries that add significant complexity with no requirement for point-in-time reconstruction.

**Alternatives Rejected:**

- **Event sourcing:** Overkill for the use case; no audit requirement for point-in-time reconstruction beyond what the `audit_entries` table already provides; significantly higher implementation complexity.
- **Shared reference data with version-specific overrides:** Creates complex merge logic and introduces risk of unintended data sharing between versions.

**Consequences:** Version clone is O(n) in data size. For 168 employees plus 45 fee grid rows, the clone operation takes less than 1 second. Storage doubles per clone, which is acceptable for at most 10 versions per fiscal year.

---

### ADR-004: Explicit Calculate Button (No Auto-Calculation)

**Status:** Accepted

**Context:** Decision D-004 from the PRD Decision Log. Calculations could run automatically on every input change (like Excel) or only on explicit user request.

**Decision:** Explicit "Calculate" button per planning module. A stale indicator is shown when input data has changed but calculation has not been re-run.

**Rationale:** Auto-calculation on every keystroke would make the application unusable (3-second delays on every field edit). Batch auto-calculation (debounced) would create confusion about what is "current." The explicit Calculate button matches the Excel F9 (manual recalculate) workflow that EFIR's finance team already uses.

**Alternatives Rejected:**

- **Auto-calculate on save:** Too slow; blocks the user's input flow with a 3-second wait after every save.
- **Background auto-calculate:** Confusing; the user does not know when results are ready; creates a window where displayed results are stale without indication.

**Consequences:** Users must remember to click Calculate after changing inputs. The stale indicator mitigates this by clearly showing when results are out of date. UX design must make the stale state highly visible (yellow banner with "Results may be outdated" message).

---

### ADR-005: JWT with HTTP-only Refresh Cookie over Server-Side Sessions

**Status:** Accepted

**Context:** User authentication state must persist across browser tabs and page refreshes. The system needs to support at most 20 concurrent users with 4 RBAC roles.

**Decision:** Stateless JWT access tokens (30-minute TTL) plus refresh tokens stored in HTTP-only Secure cookies (8-hour TTL).

**Rationale:**

1. **Stateless:** The API does not need to query a session store on every request — the JWT payload contains `userId` and `role`.
2. **XSS resistance:** The refresh token in an HTTP-only cookie cannot be read by JavaScript.
3. **Standard practice:** This is the established pattern for REST APIs with token-based authentication.
4. **Scale-ready:** If multiple API instances are needed in the future, stateless auth works without a shared session store.

**Alternatives Rejected:**

- **Server-side sessions (express-session):** Requires a shared session store (Redis) for multiple API instances; adds an extra infrastructure dependency; the session store becomes a single point of failure.
- **Access token in localStorage:** Vulnerable to XSS attacks; rejected on security grounds.

**Consequences:** The access token stored in JavaScript memory is lost on page refresh — the refresh endpoint is called transparently on app load. The refresh token in the cookie is automatically sent by the browser on auth requests. Token rotation on refresh prevents replay attacks.

---

### ADR-006: Decimal.js over Native Number for All Financial Arithmetic

**Status:** Accepted

**Context:** TC-001 mandates fixed-point decimal arithmetic. JavaScript's native `Number` type uses IEEE 754 binary floating-point, which cannot represent exact decimal fractions.

**Decision:** All monetary computations use Decimal.js 10.x with zero exceptions. An ESLint rule (`no-restricted-syntax`) is configured to detect direct arithmetic operations on number literals used for monetary variables.

**Rationale:** The canonical example: `0.1 + 0.2 = 0.30000000000000004` in IEEE 754. Over 168 employees multiplied by 12 months multiplied by multiple salary components, these errors accumulate to material amounts. Decimal.js uses arbitrary-precision decimal arithmetic with no binary floating-point representation.

**Alternatives Rejected:**

- **big.js:** Less feature-rich than Decimal.js (though trigonometric functions are not needed). Decimal.js has a larger community and is more actively maintained.
- **Storing and computing as integers (SAR multiplied by 10000):** Requires all display logic to divide by 10000; error-prone; increases cognitive load across the entire codebase.

**Consequences:** Slight performance overhead compared to native Number (estimated less than 5% on the calculation engine). The benefit is guaranteed precision per TC-001. All developers must use Decimal.js methods (`.plus()`, `.times()`, `.dividedBy()`) instead of arithmetic operators.

---

### ADR-007: Prisma ORM over Raw SQL or Alternative ORMs

**Status:** Accepted

**Context:** The application needs a database access layer with strong TypeScript integration and support for PostgreSQL DECIMAL types.

**Decision:** Prisma 5 as the ORM for all database access.

**Rationale:**

1. **Native Decimal type:** Prisma maps PostgreSQL `DECIMAL(15,4)` to the Decimal.js type natively — no manual conversion is required between the database and the application.
2. **Type-safe client:** The generated TypeScript types cover all queries; invalid field names produce compile-time errors.
3. **Migration management:** `prisma migrate` generates forward-only migration files that are version-controlled alongside the application code.
4. **Audit middleware:** `prisma.$extends` enables transparent audit logging on all write operations without modifying individual repository methods.

**Alternatives Rejected:**

- **TypeORM:** Decorator-based approach; less idiomatic TypeScript; known performance issues with complex queries; Decimal support requires manual mapping.
- **Drizzle ORM:** Newer with a less mature ecosystem; Decimal support is less proven in production.
- **Raw SQL (pg driver):** No type safety; significantly more boilerplate; audit logging requires manual wrapping of every write operation.

**Consequences:** Prisma generates a client that must be regenerated after schema changes (`prisma generate`). Prisma migrations are forward-only by design — rollback requires a `pg_dump` restore, which is acceptable per the disaster recovery plan in Section 8 (`06_infrastructure.md`).
