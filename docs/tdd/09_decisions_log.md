| Field  | Value           |
| ------ | --------------- |
| Status | Living Document |

# Section 12 — Open Questions & Decisions Log

This section documents all open questions raised during TDD authoring, the assumptions made when concrete answers were unavailable, and the formal Architecture Decision Records (ADRs) that capture each significant design choice. Every item is resolved — there are no outstanding TBDs.

---

## 12.1 Open Questions (from PRD RAID Log)

All questions originally logged in the PRD RAID register have been investigated and resolved during TDD authoring. The table below records the original question, the resolution reached, the responsible owner, and the phase in which the resolution is validated.

| ID    | Question                                                               | Resolution                                                                                                                                                                                                             | Owner             | Target Date     |
| ----- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------- |
| I-001 | Executive Summary sheet has `#REF!` error in Excel source              | Identified as cross-file reference to DHG workbook columns that were restructured. Resolve in Phase 1 Week 2 source data audit; does not block BudFin implementation as BudFin calculates P&L from scratch.            | Finance SME + DBA | Phase 1 Week 2  |
| I-002 | Tech stack PoC must validate Decimal.js + PostgreSQL DECIMAL precision | Phase 1 Week 1 PoC: 50+ unit tests for Decimal.js; PostgreSQL DECIMAL(15,4) round-trip tests. TC-001 satisfied by Decimal.js; TC-003 satisfied by schema.                                                              | Tech Lead         | Phase 1 Week 1  |
| I-003 | YEARFRAC US 30/360 implementation correctness                          | Custom TypeScript implementation documented in Section 4 (Component 4c). Validated against known Excel values in unit tests. Further validated against all 168 employee joining dates in Phase 3 Week 15.              | Tech Lead         | Phase 3 Week 15 |
| I-004 | Rounding rules — round-half-up vs. banker's rounding                   | TC-004 confirmed: round-half-up at presentation only; full DECIMAL(15,4) precision maintained throughout calculation chain. Implemented in Decimal.js with `Decimal.ROUND_HALF_UP`.                                    | Tech Lead         | Phase 1 Week 1  |
| I-005 | PDPL compliance assessment                                             | Completed during TDD authoring. Field-level encryption using pgcrypto pgp_sym_encrypt/decrypt for 5 salary fields. Key management via Docker secret. Data residency: KSA only per SA-008. Full mapping in Section 7.4. | Tech Lead + DBA   | Phase 1 Week 3  |
| I-006 | MVP/Target/Stretch tier sign-off required from CAO                     | All MUST-tagged FRs = MVP. SHOULD-tagged = Target. COULD-tagged = Stretch. Sign-off from CAO at project kickoff meeting prior to Phase 1 start.                                                                        | CAO + PM          | Pre-Phase 1     |

---

## 12.2 Assumptions Made During TDD Authoring

Each assumption below records what was assumed, the reasoning behind it, the alternatives that were considered, and the concrete consequence if the assumption proves incorrect. These assumptions should be validated with the relevant stakeholder during Phase 1.

---

### A-TDD-001: Node.js + TypeScript Selected as Backend Runtime

**Assumed:** Node.js 22 LTS + TypeScript 5.9.3 is the backend technology. Node.js 20 LTS EOL is April 2026 — v22 LTS is required. TypeScript is pinned at 5.9.3 (latest stable); see ADR-013 for the decision to use TS 5.9.3 over the 6.0.0-beta that was originally planned.

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

### A-TDD-003: TanStack Table Replaces AG Grid Community

**Assumed:** `@tanstack/react-table` v8 + shadcn/ui `<Table>` components are sufficient for all v1 data grid requirements. `@tanstack/react-virtual` is **not included** (see ADR-016 — not needed at < 300 rows per view).

**Rationale:**

- AG Grid Community is replaced by TanStack Table (headless) + shadcn/ui. This stack integrates with Tailwind v4 and the broader shadcn/ui component library without CSS conflicts.
- All required grid features (sorting, filtering, pagination, row selection, column definitions) are provided by TanStack Table v8 at no licensing cost.
- Server-side pagination (`manualPagination: true`) handles large datasets (audit log). Virtual scrolling is deferred to v2 per ADR-016.
- Headless design means no imposed styles — Tailwind v4 controls all layout.

**Consequence if wrong:** If AG Grid-specific features are needed (e.g., clipboard paste, complex column grouping), migrating back to AG Grid Community or Enterprise is a UI-layer replacement only — the data fetching and domain logic layers are unaffected.

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

**Decision:** Prisma 6 as the ORM for all database access.

**Rationale:**

1. **Native Decimal type:** Prisma maps PostgreSQL `DECIMAL(15,4)` to the Decimal.js type natively — no manual conversion is required between the database and the application.
2. **Type-safe client:** The generated TypeScript types cover all queries; invalid field names produce compile-time errors.
3. **Migration management:** `prisma migrate` generates forward-only migration files that are version-controlled alongside the application code.
4. **Audit middleware:** `prisma.$extends` enables transparent audit logging on all write operations without modifying individual repository methods.

**Alternatives Rejected:**

- **TypeORM:** Decorator-based approach; less idiomatic TypeScript; known performance issues with complex queries; Decimal support requires manual mapping.
- **Drizzle ORM:** Newer with a less mature ecosystem; Decimal support is less proven in production.
- **Raw SQL (pg driver):** No type safety; significantly more boilerplate; audit logging requires manual wrapping of every write operation.

**Consequences:** Prisma generates a client that must be regenerated after schema changes (`prisma generate`). Prisma 6 migrations are forward-only by design — rollback requires a `pg_dump` restore, which is acceptable per the disaster recovery plan in Section 8 (`06_infrastructure.md`).

**Prisma 6 Breaking Changes (relevant to BudFin):**

1. `Buffer` → `Uint8Array`: All binary columns (e.g., `*_encrypted BYTEA`) use `Uint8Array` in the generated client, not `Buffer`.
2. `NotFoundError` removed: Use `PrismaClientKnownRequestError` with code `P2025` instead.
3. Implicit many-to-many `_id` fields renamed: Check generated schema if m-n relations added.

---

### ADR-008: Fastify 5 over Express 5

**Status:** Accepted

**Context:** The TDD v1.0 deferred the backend framework decision to Phase 1. Fastify 4 EOL passed June 2025, so v5 is mandatory if Fastify is chosen. Express v5 is also a viable option.

**Decision:** Fastify 5 as the HTTP framework.

**Rationale:**

1. **Schema-first validation:** Fastify integrates with Zod via `@fastify/type-provider-zod`, validating request/response shapes at the framework level before route handlers execute. Express requires manual Zod calls in each handler.
2. **Native TypeScript:** Fastify 5 ships with full TypeScript support. Express 5 requires `@types/express`.
3. **Performance:** Fastify benchmarks ~5–10% faster than Express on equivalent workloads. Negligible at this scale, but not a negative.
4. **Active maintenance:** Fastify 5 is the current supported major version (v4 EOL June 2025).

**Alternatives Rejected:**

- **Express 5:** More familiar but requires more boilerplate for schema validation; no built-in type provider pattern; slightly slower.

**Consequences:** Fastify uses a plugin-based architecture. All cross-cutting middleware (auth, CORS, rate limiting, cookies) is registered as Fastify plugins (`@fastify/jwt`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/cookie`). Route handlers are typed via the Zod type provider.

---

### ADR-009: jose over jsonwebtoken for JWT Operations

**Status:** Accepted

**Context:** The auth service requires JWT generation, validation, and refresh token signing. The TDD v1.0 referenced `jsonwebtoken` implicitly.

**Decision:** `jose` v5 replaces `jsonwebtoken` for all JWT operations.

**Rationale:**

1. **ESM-native:** `jose` ships as pure ESM. `jsonwebtoken` is CommonJS — creates bundler friction in an ESM-first Node.js 22 project.
2. **Standards compliance:** `jose` implements IETF standards (RFC 7519 JWT, RFC 7515 JWS, RFC 7516 JWE) with full algorithm support including EdDSA and RSA-PSS.
3. **Tree-shakeable:** Only the JWT operations used are included in the bundle.
4. **Active maintenance:** `jsonwebtoken` has known CVEs and slower response to security updates.
5. **Fastify integration:** `@fastify/jwt` wraps `jose` internally in v9.

**Alternatives Rejected:**

- **jsonwebtoken:** CommonJS only; slower CVE response; effectively legacy for new ESM projects.

**Consequences:** JWT signing and verification APIs differ from `jsonwebtoken`. The `jose` API is promise-based and explicit about algorithm choice. All auth service code must use `jose` primitives (`SignJWT`, `jwtVerify`).

---

### ADR-010: Tailwind CSS v4 + shadcn/ui as UI Stack

**Status:** Accepted

**Context:** The TDD v1.0 did not include a component library or CSS framework. This left the frontend UI layer unspecified, risking inconsistent styling and accessibility compliance.

**Decision:** Tailwind CSS v4 + shadcn/ui (built on Radix UI) as the complete UI stack.

**Rationale:**

1. **WCAG AA compliance:** shadcn/ui components are built on Radix UI headless primitives, which are fully keyboard-accessible and ARIA-compliant by design. Meets NFR accessibility requirements without manual audit overhead.
2. **Tailwind v4 CSS-first config:** No `tailwind.config.js` required. Configuration lives in CSS via `@theme` directives. The Oxide engine builds 5x faster than v3.
3. **React 19 compatibility:** shadcn/ui and the unified `radix-ui` package (Feb 2026 release) are fully compatible with React 19.
4. **Copy-paste ownership:** shadcn/ui components are copied into the codebase (`src/components/ui/`), not imported from a package. This gives full control over component code and prevents upstream breaking changes from affecting the application.
5. **Vite integration:** The `@tailwindcss/vite` plugin replaces PostCSS integration, providing faster HMR and build times.

**Alternatives Rejected:**

- **Material UI (MUI):** Opinionated styling; difficult to override with Tailwind; large bundle.
- **Chakra UI:** Good accessibility but slower adoption of React 19; Tailwind integration conflicts.
- **No component library (custom):** Significant time investment to build accessible components from scratch; reinvents the wheel.

**Consequences:** All UI components live in `src/components/ui/` and are tracked in Git. shadcn/ui CLI is used to add new components (`npx shadcn@latest add button`). Any upstream changes to shadcn/ui components require manual re-copy. Tailwind v4 uses a different configuration model than v3 — no `tailwind.config.js`; theme customization uses `@theme` CSS blocks in the global stylesheet.

---

### ADR-011: TanStack Table v8 over AG Grid

**Status:** Accepted (supersedes A-TDD-003; partially superseded by ADR-016 which removes react-virtual)

**Context:** The TDD v1.0 selected AG Grid Community for data grid rendering. The stack upgrade introduces Tailwind v4 + shadcn/ui, which conflict with AG Grid's own CSS theming system.

**Decision:** Replace AG Grid Community with `@tanstack/react-table` v8 (headless table logic) + shadcn/ui `<Table>` components (rendering). `@tanstack/react-virtual` is excluded per ADR-016.

**Rationale:**

1. **Tailwind integration:** TanStack Table is headless — it provides zero CSS. All rendering is done by the developer using shadcn/ui Table components and Tailwind classes. No style conflicts.
2. **No licensing concerns:** Both packages are MIT-licensed. AG Grid Community is also free, but the Enterprise upgrade path ($1,200/dev/year) is now irrelevant.
3. **Bundle size:** AG Grid Community adds ~300 KB gzipped. TanStack Table + Virtual is headless and tree-shakeable.
4. **Feature parity for v1 requirements:** Sorting, filtering, pagination, row selection, and virtual scrolling are all covered. The audit log pagination requirement is handled by `manualPagination: true` + TanStack Query server-side fetching.
5. **React 19 compatibility:** TanStack Table v8 and Virtual v3 are fully compatible with React 19.

**Feature mapping:**

| AG Grid Feature       | TanStack Replacement                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Client-side row model | `getCoreRowModel()`                                                                                             |
| Server-side row model | `manualPagination: true` + TanStack Query                                                                       |
| Row virtualization    | Server-side pagination (`manualPagination: true`) for v1; `@tanstack/react-virtual` available in v2 per ADR-016 |
| Column sorting        | `getSortedRowModel()`                                                                                           |
| Column filtering      | `getFilteredRowModel()`                                                                                         |
| Pagination            | `getPaginationRowModel()`                                                                                       |
| Row selection         | `getSelectedRowModel()`                                                                                         |
| Column pinning        | `columnPinning` state                                                                                           |

**Alternatives Rejected:**

- **Keep AG Grid Community:** CSS conflicts with Tailwind v4; unnecessary given the headless alternative covers all v1 requirements.
- **AG Grid Enterprise:** Not justified at this user scale; $1,200/dev/year license cost.

**Consequences:** TanStack Table renders nothing by default — each table must be explicitly wired to shadcn/ui components. This requires more initial boilerplate than AG Grid but gives complete control over rendering. Excel-like keyboard navigation (the original justification for AG Grid) must be implemented manually via `tabIndex` and `onKeyDown` handlers on the shadcn Table cells.

---

### ADR-012: JWT Token TTL Reconciliation (Access 30 min / Refresh 8 hr)

**Status:** Accepted (resolves schema findings S-03 and S-04 from the 360-degree schema review, 2026-03-04)

**Context:** A 360-degree schema review identified a contradiction between two authoritative sources on security-critical JWT TTL parameters:

- The `system_config` seed data (TDD §5.1 Table 21) set `jwt_access_token_ttl_minutes = '15'` (15 minutes) and `jwt_refresh_token_ttl_days = '7'` (7 days).
- ADR-005 (accepted, see above) explicitly states: "Stateless JWT access tokens (30-minute TTL) plus refresh tokens stored in HTTP-only Secure cookies (8-hour TTL)."

This 21x discrepancy on the refresh token TTL (7 days vs. 8 hours) is security-critical: a 7-day refresh token dramatically increases the window for token theft compared to an 8-hour token.

**Decision:**

1. **Access token TTL = 30 minutes.** ADR-005 is the authoritative source. The seed data value `'15'` was a draft-time placeholder that was not updated when ADR-005 was finalised. The seed data is corrected to `'30'`.

2. **Refresh token TTL = 8 hours.** ADR-005 explicitly states "8-hour TTL" for the HTTP-only cookie. The `system_config` key is renamed from `jwt_refresh_token_ttl_days` to `jwt_refresh_token_ttl_hours` with value `'8'` to avoid unit confusion and prevent a future implementer from interpreting the field as days (0.33 days would be a type mismatch for an INTEGER column).

**Rationale:**

- **Security:** An 8-hour refresh token expires with the workday for a school finance application. A 7-day token survives an entire week, increasing the blast radius if a token is stolen from a cookie jar backup or server log.
- **Consistency:** ADR-005 is the security architecture decision, written with full consideration of the threat model. The seed data is a schema artefact — it has no independent authority over security parameters.
- **Implementation alignment:** The `TokenService` (TDD §4.1) is the consuming code. It reads the TTL from `system_config` at runtime. Correcting the seed data ensures the implementation matches the security specification from first deployment.

**Alternatives Rejected:**

- **Keep 15-min access / 7-day refresh:** Misaligns with ADR-005, reduces security. No justification for the 7-day value exists in any requirement.
- **Keep field name `jwt_refresh_token_ttl_days` with value `'0.333333'`:** The `data_type` for this field is `INTEGER` — storing a fractional day value would cause a parse error. Renaming to `_hours` with integer `'8'` is unambiguous.

**Consequences:**

- The `TokenService` must reference `jwt_refresh_token_ttl_hours` (not `jwt_refresh_token_ttl_days`) when setting cookie expiry.
- Any environment that ran the original seed data must update the key: `UPDATE system_config SET key = 'jwt_refresh_token_ttl_hours', value = '8' WHERE key = 'jwt_refresh_token_ttl_days'; UPDATE system_config SET value = '30' WHERE key = 'jwt_access_token_ttl_minutes';`
- All integration tests for token expiry must use 30 min / 8 hr, not 15 min / 7 days.

---

### ADR-013: TypeScript 5.9.3 over 6.0.0-beta

**Status:** Accepted (supersedes A-TDD-001 TypeScript version selection; stack-versions.md v1.2)

**Context:** The original stack pinned TypeScript at `6.0.0-beta` on the rationale that TS 6 was the "last JS-based compiler before the Go rewrite in v7" and that the beta was an accepted risk on a greenfield project. A March 2026 verification via Context7 confirmed that no TypeScript 6.0 stable release exists on npm — the latest stable versions are 5.9.2 and 5.9.3.

**Decision:** Downgrade TypeScript to **5.9.3** (pinned) across all workspaces.

**Rationale:**

1. **No stable TS 6 release exists.** The `6.0.0-beta` tag is a pre-release. Financial systems require stable tooling — betting on a beta compiler is not acceptable when a stable alternative exists.
2. **No material benefit for this project.** The primary TS 6 gain is compile speed via the Go-based compiler. This matters for large monorepos. BudFin has 3 workspace packages; `tsc --noEmit` runs in under 5 seconds on TS 5.9.3.
3. **Beta risk is real.** Pre-release compilers can introduce new inference behaviors, edge-case bugs in algebraic types, and breaking changes between beta releases. Community resources (Stack Overflow, GitHub issues) are minimal for beta versions.
4. **TS 5.9.3 has all features needed for v1.** Decorators, `satisfies`, `const` type parameters, and all other features used in this codebase are stable in TS 5.9.

**Alternatives Rejected:**

- **Keep TS 6.0.0-beta:** Pre-release risk with no benefit at this project scale. Rejected.
- **Pin to TS 5.7.x:** TS 5.9.3 is newer and has additional improvements. Use the latest stable.

**Consequences:** `typescript: "5.9.3"` is pinned in root `package.json`. Re-evaluate when TS 6 publishes a stable npm tag. The `ignoreDeprecations: "6.0"` pattern seen in TS 5.x error messages confirms TS 6 is a planned future release — it is not yet published.

---

### ADR-014: @react-pdf/renderer over Puppeteer for PDF Export

**Status:** Accepted (stack-versions.md v1.2)

**Context:** The original stack used Puppeteer v24 (headless Chromium) to generate PDF exports for P&L statements, staff cost breakdowns, and scenario comparison reports. For an on-premise server where RAM is the primary cost driver, Puppeteer introduces significant operational overhead.

**Decision:** Replace Puppeteer with **`@react-pdf/renderer`** for all PDF export use cases.

**Rationale:**

1. **RAM footprint.** Puppeteer spawns a full headless Chromium process (~300–500 MB RAM per concurrent export). `@react-pdf/renderer` uses < 50 MB per job. For 5 concurrent export jobs, Puppeteer creates up to 2 GB of RAM spikes vs. ~250 MB with react-pdf.
2. **Docker image size.** Puppeteer adds ~300 MB of Chromium binaries to the Docker image. Removing it reduces the image from ~800 MB+ to ~200 MB.
3. **Startup time.** Chrome startup takes 1–3 seconds per spawn. `@react-pdf/renderer` starts in < 100 ms.
4. **Output fidelity.** BudFin's PDF exports are tabular financial data (P&L statements, staff cost breakdowns, scenario comparisons). `@react-pdf/renderer` handles tables natively and produces PDFs with excellent fidelity for tabular data. No complex CSS animations or SVG rendering is required.
5. **React syntax.** `@react-pdf/renderer` uses React component syntax, which is idiomatic for a TypeScript + React team. PDF layout components are defined as React trees.
6. **Server cost reduction.** Eliminating the ~400 MB per-export RAM spike allows the production server to run on 4 GB RAM instead of 8 GB, cutting hosting cost.

**Alternatives Rejected:**

- **Keep Puppeteer:** 300–500 MB per Chrome process; Docker image bloat; zombie-process risk; not justified for tabular-only output.
- **pdfkit:** Programmatic PDF API; no React syntax; manual layout computation required; higher implementation burden.
- **jspdf + jspdf-autotable:** Primarily a client-side library; server-side usage is less well-documented; react-pdf is a better fit for a React-first team.

**Consequences:** PDF templates must be written as `@react-pdf/renderer` React components (`<Document>`, `<Page>`, `<View>`, `<Text>`, `<StyleSheet>`). No Chromium installation is required in the Docker image. The `puppeteer` entry is removed from `pnpm.onlyBuiltDependencies` in root `package.json`.

---

### ADR-015: pg-boss In-Process Workers over Separate Worker Container

**Status:** Accepted (stack-versions.md v1.2)

**Context:** The original architecture used a four-container Docker Compose stack: nginx, api, worker, db. The `worker` container ran the same Node.js image with a different entrypoint (`dist/worker.js`) to process pg-boss background jobs (PDF exports, calculation tasks).

**Decision:** Fold the background worker into the `api` process. pg-boss workers are registered inside the Fastify server startup using `boss.work('job-type', handler)`. The Docker Compose stack reduces from 4 containers to **3 containers** (nginx, api, db).

**Rationale:**

1. **pg-boss natively supports in-process workers.** `boss.work()` registers a polling handler in the same Node.js process. There is no architectural requirement for a separate process.
2. **Scale fit.** At most 5 concurrent export jobs for 20 users is well within what a single Node.js event loop handles, particularly with `@react-pdf/renderer` (< 50 MB per job, < 100 ms startup).
3. **Operational simplicity.** One fewer container to monitor, restart, log, and alert on. The worker and API already share the same codebase and secrets — the separation provided no isolation benefit.
4. **Reduced coordination overhead.** A separate worker container requires the same Docker secrets, the same database credentials, and produces logs in a separate stream. Folding it in simplifies the operational runbook.
5. **Memory.** The separate worker process consumed ~200 MB idle RAM. In-process workers add negligible overhead to the existing API process.

**Alternatives Rejected:**

- **Keep separate worker container:** Adds operational overhead with no benefit at 20-user scale. Rejected.
- **Use a thread pool for workers:** Node.js Worker Threads are appropriate for CPU-bound tasks (calculation engine). pg-boss job dispatch and `@react-pdf/renderer` rendering are I/O-bounded enough for the main event loop, or can be isolated to Worker Threads if needed in v2.

**Consequences:** The `worker:` service block is removed from `docker-compose.yml`. The `api` container startup registers pg-boss workers after Fastify is ready. The `dist/worker.js` entrypoint is eliminated. All job processing logs appear in the `api` container log stream.

---

### ADR-016: @tanstack/react-virtual Not Required for v1

**Status:** Accepted (supersedes ADR-011 which included react-virtual; stack-versions.md v1.2)

**Context:** ADR-011 selected `@tanstack/react-virtual` v3 alongside `@tanstack/react-table` v8 as the replacement for AG Grid's built-in row virtualization. The rationale cited "large datasets" and equivalence with AG Grid's virtualization.

**Decision:** Remove `@tanstack/react-virtual` from the v1 dependency set. It is not required and adds unnecessary complexity.

**Rationale:**

1. **Maximum table size is ~300 rows.** The largest table in BudFin v1 is the staff cost grid: at most 700 employees, but paginated (the UI specification shows 50 rows per page). The full-table view maxes out at 300 rows for a scenario comparison. Modern browsers render 300 DOM rows trivially; virtualization is not needed below ~2,000 rows.
2. **NFR confirms this.** NFR 11.3 targets `< 500ms` for "data grid rendering (up to 200 rows)" — the specification itself caps the expected data at 200 rows per view.
3. **Complexity cost.** Virtualization requires explicit row heights, scroll container sizing, and `useVirtualizer` hooks. This boilerplate is not justified for 300-row tables.
4. **Re-evaluate in v2.** If a full audit log UI (10M+ entries, served without pagination) is required in a future version, `@tanstack/react-virtual` can be added then. The API pagination layer (`manualPagination: true` in TanStack Table) is already designed for server-side paging.

**Alternatives Rejected:**

- **Keep react-virtual for future-proofing:** YAGNI. Adding complexity for a hypothetical future requirement that is explicitly scoped to v2+ is premature.

**Consequences:** `@tanstack/react-virtual` is removed from `apps/web/package.json`. All table components use `@tanstack/react-table` v8 with server-side pagination (`manualPagination: true`) for large datasets. Virtual scrolling is available as a v2 addition with no architectural changes required.

---

### ADR-017: Grafana Deferred to v2 (UptimeRobot + Winston for v1)

**Status:** Accepted (stack-versions.md v1.2)

**Context:** The original environment matrix listed "Grafana + UptimeRobot" for production monitoring. `prom-client` metrics instrumentation is already planned in the codebase. Grafana requires a Prometheus container (scrape target), a Grafana container (dashboard), persistent storage for both, and alert configuration.

**Decision:** Deploy Grafana and the Prometheus scraper in **v2 only**. For v1, use UptimeRobot (free tier) for health check monitoring and Winston's built-in email transport for ERROR/FATAL alerts.

**Rationale:**

1. **Operational overhead is disproportionate for v1.** Grafana + Prometheus adds 2 containers, alert rule configuration, dashboard maintenance, and persistent storage management. For a 20-user internal tool with a small IT team, this is significant overhead before the system has even served its first production user.
2. **v1 alerting needs are simple.** ERROR/FATAL → email within 5 minutes (Winston email transport); disk > 80% → email (cron + shell); health check failure → email/SMS (UptimeRobot free tier). These three requirements cover all NFR 11.12 alerts without Grafana.
3. **`prom-client` stays in the codebase.** Metrics instrumentation (`http_request_duration_ms`, `calculation_duration_ms`, etc.) is retained. The `/metrics` endpoint is available. This future-proofs for Grafana in v2 with zero additional code changes.
4. **Docker Compose stays at 3 containers.** nginx + api + db. Adding Prometheus + Grafana would bring the v1 stack to 5 containers.

**Alternatives Rejected:**

- **Deploy Grafana in v1:** Operational overhead is not justified before the system has proven its load characteristics. Premature.
- **Remove prom-client:** Removing the instrumentation would require re-adding it in v2 alongside Grafana. Keeping it in code costs nothing.

**Consequences:** The production environment matrix is updated: "Grafana + UptimeRobot" → "UptimeRobot + Winston email alerts". Grafana setup is documented as a v2 deliverable in `08_implementation_roadmap.md`. The `/metrics` endpoint is protected by nginx (subnet restriction) but is live and ready for a future Prometheus scraper.

---

## Post-TDD ADRs

ADRs created during epic implementation are stored in `docs/adr/`. These extend the decisions log above:

- **ADR-018** — Dedicated Master Data Endpoints (`docs/adr/ADR-018-dedicated-master-data-endpoints.md`): Created during Epic 7 (Master Data Management) implementation.
- **ADR-019** — Version Lifecycle State Machine (`docs/adr/ADR-019-version-lifecycle-state-machine.md`): Created during Epic 10 (Version Management) implementation.
- **ADR-020** — Allow Logout Without Valid Access Token (`docs/adr/ADR-020-unauthenticated-logout.md`): Created during Epic 15 (UI/UX Rewrite) implementation.
- **ADR-021** — Single-Shell Layout (`docs/adr/ADR-021-single-shell-layout.md`): Superseded by ADR-023.
- **ADR-022** — Calculation Persistence and Audit Logging (`docs/adr/ADR-022-calculation-persistence-and-audit.md`): Created during Epic 1 (Enrollment) remediation.
- **ADR-023** — Restore Two-Shell Layout Architecture (`docs/adr/ADR-023-two-shell-layout.md`): Created during Epic 15 (UI/UX Rewrite) implementation. Supersedes ADR-021.
- **ADR-024** — Continuous Planning Board Layout Pattern (`docs/adr/ADR-024-continuous-planning-board.md`): Adopted 2026-03-08. Replaces tabbed layout with vertically stacked WorkspaceBoard/WorkspaceBlock pattern for all planning pages; moves tariff assignment from Enrollment to Revenue domain.
- **ADR-025** — Cohort Progression and Nationality Distribution Engines (`docs/adr/ADR-025-cohort-nationality-engines.md`): Accepted 2026-03-08. Introduces two pure-function calculation engines and two database tables for formula-driven AY2 headcount and nationality distribution.
- **ADR-026** — CLI-Only Data Migration Pipeline (`docs/adr/ADR-026-cli-only-data-migration.md`): Accepted 2026-03-09. Uses TypeScript CLI scripts within the monorepo for one-time go-live data import across 10 phases with idempotent upserts and zero-tolerance validation.
- **ADR-027** — Version-Scoped Enrollment Planning Rules on BudgetVersion (`docs/adr/ADR-027-version-scoped-enrollment-planning-rules.md`): Accepted 2026-03-12. Stores rollover threshold and capped retention rate as columns on budget_versions for per-version scenario testing.
- **ADR-028** — Auth Refresh 204 for Missing Cookie (`docs/adr/ADR-028-auth-refresh-204-for-missing-cookie.md`): Accepted 2026-03-14. Changes `POST /api/v1/auth/refresh` to return 204 No Content when the refresh token cookie is absent, distinguishing no-session from token-theft 401 responses. Also documents env-dependent `secure` cookie flag.
