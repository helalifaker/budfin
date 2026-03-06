# BudFin Technical Design Document v1.0

## Section 0 — Document Control

| Field             | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Title             | BudFin Technical Design Document v1.0                    |
| Status            | Draft                                                    |
| Author            | [Tech Lead — to be assigned]                             |
| Date              | March 3, 2026                                            |
| Related Documents | PRD v2.0 (`BudFin_PRD_v2.0.md`), Edge Case Analysis v1.0 |

### Revision History

| Version | Date          | Author                       | Description   |
| ------- | ------------- | ---------------------------- | ------------- |
| 1.0     | March 3, 2026 | [Tech Lead — to be assigned] | Initial draft |

### Approvers

| Role      | Name             | Status  |
| --------- | ---------------- | ------- |
| Tech Lead | [To be assigned] | Pending |
| CAO       | [To be assigned] | Pending |
| DBA       | [To be assigned] | Pending |

---

## Section 1 — Executive Technical Summary

### 1.1 Architecture Style

BudFin adopts a **monolithic SPA + REST API** architecture. The system is not decomposed into microservices. This decision is deliberate and grounded in the operational reality of the deployment target.

**Justification:**

- **User scale does not warrant distribution.** The system serves a single school (EFIR) with a maximum of 20 concurrent users (SA-004). There is no multi-tenant requirement (SA-006). A monolith handles this load trivially.
- **The calculation chain is tightly coupled.** Budget computation flows sequentially through enrollment, revenue, DHG (Dotation Horaire Globale), staff costs, and finally the P&L summary. Each stage depends on the outputs of the previous stage. Splitting these across service boundaries would introduce distributed transaction complexity (sagas, eventual consistency, compensating transactions) with absolutely zero scaling benefit.
- **Atomicity is straightforward in a monolith.** A single PostgreSQL transaction can wrap the full calculation chain for a budget version. This guarantees that either all calculations succeed and commit together, or none do. Achieving the same guarantee across microservices would require a two-phase commit protocol or saga orchestration — both far more complex than the problem warrants.
- **Operational simplicity.** A single Docker Compose stack is easier to deploy, monitor, back up, and troubleshoot than a distributed system. The target environment is an on-premise or private cloud server within KSA, operated by a small IT team.

### 1.2 Key Technical Decisions

| Decision             | Choice                                               | Alternatives Rejected            | Rationale                                                                                                                                        |
| -------------------- | ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend runtime      | Node.js 22 LTS + TypeScript 5.9.3 (pinned — ADR-013) | Python/FastAPI, Java/Spring Boot | Decimal.js ecosystem for TC-001; Prisma ORM native Decimal type; full-stack TypeScript consistency; Node 20 EOL April 2026                       |
| Database             | PostgreSQL 16                                        | MySQL 8, SQLite                  | pgcrypto for PDPL field encryption; native DECIMAL(15,4) per TC-003; JSONB audit log; row-level security primitives; superior Prisma integration |
| Decimal library      | Decimal.js 10.6.x                                    | big.js, native Number            | TC-001 compliance; arbitrary precision; actively maintained; works in Node.js; Prisma Decimal compatibility                                      |
| ORM                  | Prisma 6                                             | TypeORM, Drizzle, raw SQL        | Native Decimal type; type-safe migrations; typed client generation; audit middleware via $extends                                                |
| Frontend             | React 19 + Vite 7 + TypeScript                       | Next.js, Vue.js                  | Modern SSR not needed (internal tool, no SEO); Vite fast dev cycle; TypeScript safety on financial data                                          |
| UI component library | shadcn/ui + Tailwind CSS 4                           | MUI, Chakra UI                   | WCAG AA compliant; copy-paste components on Radix UI; CSS-first Tailwind v4 with Oxide engine                                                    |
| Data grid            | TanStack Table v8 (no virtual scrolling — ADR-016)   | AG Grid Community                | Headless table logic paired with shadcn/ui Table components; server-side pagination for audit log; integrates with Tailwind v4                   |
| Excel export         | ExcelJS                                              | SheetJS (xlsx)                   | Server-side xlsx generation; formula preservation; column width/formatting per NFR 11.10; active maintenance                                     |
| PDF export           | @react-pdf/renderer v4.3 (ADR-014)                   | Puppeteer, PDFKit, jsPDF         | React-PDF document components; A3 landscape for P&L; no Chromium dependency; < 50 MB RAM per job                                                 |
| Authentication       | JWT + bcrypt cost 12                                 | Server-side sessions, OAuth      | Stateless tokens; bcrypt cost 12 per NFR 11.3.1; refresh token rotation; horizontal scale-ready                                                  |
| Deployment           | Single Docker Compose stack                          | Kubernetes, bare metal           | Single-school; on-premise/private cloud KSA per PDPL SA-008; no orchestration overhead                                                           |
| YEARFRAC             | Custom server-side function                          | Excel-compatible library         | TC-002 US 30/360 algorithm exactly; validated against 168 employee records                                                                       |

### 1.3 Technology Constraints Acknowledgment

Each technical constraint from the PRD is addressed by a specific design decision. These constraints are non-negotiable and enforced throughout the codebase.

**TC-001 — Fixed-Point Decimal Arithmetic.** All monetary computations use `Decimal.js 10.x`. JavaScript's native `Number` type (IEEE 754 double-precision float) is never used for any value that represents money, rates, or percentages in the calculation chain. The Prisma schema declares all monetary columns as `Decimal`, and the generated client returns `Prisma.Decimal` objects that are interoperable with Decimal.js. Linting rules flag any arithmetic operation on financial fields that does not use Decimal.js methods.

**TC-002 — YEARFRAC US 30/360 Algorithm.** A custom TypeScript function implements the US 30/360 day-count convention exactly as specified by the NASD variant used in Microsoft Excel's `YEARFRAC` function with `basis=0`. The implementation handles the end-of-month edge cases (February 28/29, months ending on the 31st) according to the published algorithm. Unit tests validate the function against 168 employee records from EFIR's existing payroll data, ensuring the output matches Excel to the last decimal place.

**TC-003 — Database Decimal Precision.** PostgreSQL column types are explicitly specified for each category of financial data:

- `DECIMAL(15,4)` for all monetary amounts (salaries, fees, totals, variances)
- `DECIMAL(7,6)` for rates (discount percentages, tax rates, GOSI rates)
- `DECIMAL(5,4)` for hourly percentage allocations (teaching load percentages)
- `DECIMAL(7,4)` for years-of-service calculations (YEARFRAC output)

**TC-004 — Rounding Policy.** The system stores all computed values at full precision in the database. Rounding to SAR (2 decimal places, round-half-up) occurs only at the presentation layer — when values are displayed in the UI or included in exported reports. Intermediate calculations never round. This prevents cumulative rounding drift across the calculation chain.

**TC-005 — Date Arithmetic.** All date handling uses the Gregorian calendar in the Arabia Standard Time zone (UTC+3). The academic year is split into three periods: AY1 (January through June), Summer (July through August), and AY2 (September through December). The standard academic year comprises 36 instructional weeks. Date parsing, storage, and comparison all operate in AST to prevent timezone-related off-by-one errors.

### 1.4 Top 5 Technical Risks

| Risk ID | Description                         | Probability | Impact | Mitigation                                                                                                |
| ------- | ----------------------------------- | ----------- | ------ | --------------------------------------------------------------------------------------------------------- |
| R-001   | Calculation discrepancies vs. Excel | 4           | 5      | Automated regression suite with ±1 SAR tolerance gate; Decimal.js per TC-001; parallel run in Phase 6     |
| R-004   | IEEE 754 precision failures         | 3           | 5      | TC-001 mandates Decimal.js for all financial math; CI pipeline includes precision validation checks       |
| R-003   | Source data quality issues          | 3           | 4      | 6-step validation protocol on data import; two-phase commit (validate then persist); parallel run Phase 6 |
| R-006   | YEARFRAC mismatch with Excel        | 3           | 4      | TC-002 exact algorithm implementation; 168-employee validation suite built in Phase 1                     |
| R-009   | Key personnel dependency            | 2           | 4      | Documentation-first approach; knowledge transfer sessions; this TDD as institutional knowledge            |

### 1.5 Complexity and Debt Assessment

**Complexity rating: HIGH.** The system combines financial domain logic (multi-step calculation chains with strict precision requirements), a custom YEARFRAC implementation matching Excel behavior, PDPL-mandated field-level encryption via pgcrypto, and version isolation semantics where each budget version is a self-contained snapshot. Each of these domains carries inherent complexity that cannot be simplified without compromising correctness.

**Technical debt: None introduced.** The architecture explicitly avoids precision shortcuts. TC-001 through TC-005 prohibit the common patterns that introduce financial calculation debt (floating-point money, implicit rounding, timezone-naive dates). Every design decision documented in Section 1.2 was evaluated against these constraints. No "temporary" workarounds or deferred decisions exist in the initial architecture.

---

## Section 2 — System Context and Boundaries

### 2.1 C4 Level 1 — System Context Diagram

```text
                    ┌─────────────────┐
                    │  Budget Owner    │
                    │  (CAO)           │
                    └────────┬────────┘
                             │ approves versions,
                             │ publishes budgets
    ┌─────────────────┐      │      ┌──────────────────────┐
    │  Budget Analyst  │      │      │  HR/Payroll           │
    │                  ├──────┤──────┤  Coordinator          │
    │  creates versions│      │      │  manages employees    │
    │  enters data     │      │      └──────────────────────┘
    └─────────────────┘      │
                             │
                   ┌─────────▼─────────┐
                   │                   │
                   │   BudFin System   │
                   │                   │
                   │  School Financial │
                   │  Planning App     │
                   │                   │
                   └─────────┬─────────┘
                             │
    ┌─────────────────┐      │      ┌──────────────────────┐
    │  School          │      │      │  External Auditor     │
    │  Administrator   ├──────┤──────┤  (read-only)          │
    │  reads dashboard │      │      │  reviews published    │
    └─────────────────┘      │      │  versions & audit log │
                             │      └──────────────────────┘
                    ┌────────┴────────┐
                    │  System          │
                    │  Administrator   │
                    │  user mgmt,      │
                    │  config, audit   │
                    └─────────────────┘
```

BudFin v1 is a fully self-contained system. There are no inbound or outbound integrations with external systems. All six actor types interact directly with the BudFin web application through a browser on the internal network.

### 2.2 Actor Catalog

| Actor                  | Role                                                                                | Key Interactions                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget Owner (CAO)     | Approves budget versions; publishes final budgets; reads all reports and dashboards | Approve/reject version submissions; publish budget to "published" status; view P&L, revenue, staff cost reports; export PDF/Excel summaries                                            |
| Budget Analyst         | Primary data entry operator; creates and manages budget versions                    | Create new budget versions; clone existing versions; enter/edit fee grids, enrollment, discount policies; trigger calculation runs; export detailed reports; compare version variances |
| HR/Payroll Coordinator | Manages employee master data; reviews staff cost outputs                            | Import/edit employee records (contracts, salaries, allowances); review staff cost calculations; verify YEARFRAC computations; export staff cost reports                                |
| School Administrator   | Reads dashboards and summary reports; reviews enrollment capacity                   | View enrollment summaries by grade/section; read revenue dashboards; review high-level P&L; no data entry permissions                                                                  |
| System Administrator   | Manages users, roles, and system configuration                                      | Create/deactivate user accounts; assign roles; review audit trail; manage system settings; monitor application health                                                                  |
| External Auditor       | Read-only access to published versions and audit trail                              | View published budget versions; read audit log entries; export reports from published versions only; no access to draft versions                                                       |

### 2.3 External Systems

BudFin v1 operates as a fully standalone application. There are no integrations with external systems:

- **No ERP/GL connection.** Budget data is not pushed to or pulled from any enterprise resource planning or general ledger system.
- **No HRMS integration.** Employee records are managed within BudFin. Payroll data is imported via CSV/xlsx upload, not via API connection.
- **No external data feeds.** Enrollment figures, fee schedules, and all other source data are entered manually or imported from spreadsheet files.
- **No SSO provider.** Authentication is handled internally via JWT. No LDAP, Active Directory, or OAuth provider is connected.

Future versions may introduce ERP export and HRMS sync, but these are explicitly out of scope for v1 and do not influence the current architecture.

### 2.4 Deployment Context

BudFin is deployed on-premise or within a private cloud environment located within the Kingdom of Saudi Arabia, in compliance with PDPL data residency requirements (SA-008). The deployment characteristics are:

- **Single server or small VM.** The monolithic architecture runs on a single host via Docker Compose. No horizontal scaling or load balancing is required for the expected user count.
- **Internal network only.** The application is accessible over the school's LAN/WiFi network. There is no requirement for public internet exposure. Nginx serves as the reverse proxy and TLS termination point within the internal network.
- **No CDN.** Static assets (the React SPA bundle) are served directly by Nginx from the same host. The internal network latency is negligible, and the SPA bundle size does not warrant CDN distribution.
- **Backup target.** PostgreSQL backups via `pg_dump` are stored on a separate volume or network-attached storage, also within KSA.

### 2.5 Trust Levels

The system defines four trust levels in descending order of privilege. The full RBAC matrix with per-endpoint permissions is detailed in Section 7 (Security Architecture).

| Trust Level | Role                                            | Access Scope                                                                         |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1 (Highest) | System Administrator                            | Full system access: user management, configuration, audit trail, all data            |
| 2           | Budget Owner (CAO)                              | All budget data read/write; version approval and publishing; all reports             |
| 3           | Editor (Budget Analyst, HR/Payroll Coordinator) | Version-scoped data entry and calculation; own-module reports; no approval authority |
| 4 (Lowest)  | Viewer (School Administrator, External Auditor) | Read-only access; published versions only (Auditor) or all versions (School Admin)   |

---

## Section 3 — Architecture Overview

### 3.1 Layer Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                                 │
│  React 19 SPA (Vite 7 + TypeScript)                                 │
│  Context Bar | Navigation | Module Pages | Export UI                │
│  TanStack Table + shadcn/ui (data tables) | Recharts (charts)       │
│  Tailwind CSS 4 (styling) | Decimal.js (display formatting)         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS / REST JSON (/api/v1/)
┌──────────────────────────▼──────────────────────────────────────────┐
│  APPLICATION LAYER                                                  │
│  Node.js 22 + TypeScript 5.9.3 (pinned) + Fastify 5                 │
│  Auth Middleware | RBAC Guards | Route Handlers | Zod Validation    │
│  Winston Logger | prom-client Metrics | Request ID Middleware       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Prisma Client
┌──────────────────────────▼──────────────────────────────────────────┐
│  DOMAIN / SERVICE LAYER                                             │
│  Calculation Engine (pure TypeScript + Decimal.js)                  │
│  ├── Revenue Engine      ├── DHG Engine                             │
│  ├── Staff Cost Engine   └── P&L Engine                             │
│  Version Manager | Audit Logger ($extends middleware)               │
│  Export Service (ExcelJS / @react-pdf/renderer / fast-csv)          │
│  Data Import Service (two-phase validation + commit)                │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Prisma ORM
┌──────────────────────────▼──────────────────────────────────────────┐
│  DATA LAYER                                                         │
│  PostgreSQL 16                                                      │
│  budget_versions | employees (pgcrypto) | fee_grids                │
│  enrollment_detail | monthly_revenue | monthly_staff_costs          │
│  audit_entries (append-only) | calculation_audit_log               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│  INFRASTRUCTURE                                                     │
│  Docker Compose: nginx | api | db                (ADR-015 — worker in-process) │
│  GitHub Actions CI/CD | pg_dump backups | UptimeRobot monitoring    │
└─────────────────────────────────────────────────────────────────────┘
```

**Presentation Layer.** The React 19 SPA is the sole user interface. It communicates with the backend exclusively through REST API calls over HTTPS. TanStack Table v8 (headless) combined with shadcn/ui `<Table>` components renders financial data tables with keyboard navigation and server-side pagination (ADR-016 — no virtual scrolling). Recharts provides visualization for dashboards. Tailwind CSS v4 handles all layout and styling. Decimal.js is used on the client side solely for display formatting — rounding monetary values to 2 decimal places (round-half-up) for presentation per TC-004. No financial calculations are performed client-side.

**Application Layer.** Fastify 5 handles HTTP routing, request parsing, and response serialization. Every request passes through authentication middleware (JWT verification), RBAC guards (role and permission checks), and Zod schema validation before reaching a route handler. Winston provides structured JSON logging with a correlation `requestId` propagated through all log entries for a given request. The `prom-client` library exposes Prometheus-compatible metrics for latency percentiles and error rates.

**Domain / Service Layer.** This is the core of the system. The calculation engine is implemented as pure TypeScript functions operating on Decimal.js values. Each engine (Revenue, DHG, Staff Cost, P&L) is a self-contained module with explicit inputs and outputs. Calculations are always explicitly invoked (never triggered by implicit events — this is architectural decision D-004) via command objects: `CalculateRevenueCommand`, `CalculateDHGCommand`, `CalculateStaffCostsCommand`, `CalculateConsolidatedPLCommand`. The Version Manager handles version creation, cloning (snapshot copy), status transitions, and locking. The Audit Logger, implemented as Prisma `$extends` middleware, intercepts every write operation and appends an entry to the audit trail automatically. The Export Service generates Excel (ExcelJS), PDF (@react-pdf/renderer — ADR-014), and CSV (fast-csv) outputs. The Data Import Service validates uploaded CSV/xlsx files in two phases (structural validation, then business rule validation) before committing data.

**Data Layer.** PostgreSQL 16 stores all persistent state. The schema enforces decimal precision at the column level per TC-003. PII fields in the `employees` table are encrypted at rest using pgcrypto (AES-256) per PDPL requirements. The `audit_entries` table is append-only — no UPDATE or DELETE operations are permitted, enforced by a database trigger. The `calculation_audit_log` captures the inputs, outputs, and intermediate values of every calculation run for reproducibility and debugging.

**Infrastructure Layer.** Docker Compose orchestrates three containers: `nginx` (reverse proxy, TLS termination, static asset serving), `api` (Node.js application + in-process pg-boss background workers per ADR-015), and `db` (PostgreSQL 16). GitHub Actions runs CI/CD: lint, type-check, unit tests, integration tests, and Docker image builds. PostgreSQL backups run on a cron schedule via `pg_dump`. UptimeRobot or equivalent monitors the `/api/v1/health` endpoint.

### 3.2 Architecture Patterns

**1. Repository Pattern.** Prisma repositories abstract all database queries behind a clean interface. Domain services (e.g., the Revenue Engine) call repository methods like `feeGridRepository.findByVersionAndAcademicYear(versionId, year)` rather than invoking Prisma client queries directly. This separation enables unit testing of domain logic with mocked repositories and prevents Prisma query syntax from leaking into business logic.

**2. Command/Service Pattern.** Each major operation is represented as an explicit command object. `CalculateRevenueCommand` takes a version ID and academic year as inputs and produces monthly revenue rows as output. `CalculateStaffCostsCommand` takes a version ID and produces monthly staff cost breakdowns. These commands are explicitly invoked by route handlers — there are no implicit event-driven triggers (architectural decision D-004). This makes the execution flow predictable, debuggable, and auditable. Every command execution is logged with its inputs and outputs.

**3. Snapshot Copy (Version Isolation).** When a user clones a budget version, the system creates a deep copy of all version-scoped data: employees, fee grids, enrollment detail, discount policies, and all calculated outputs. The cloned version shares no mutable state with the source version. Changes to the clone do not affect the original, and vice versa. This isolation is critical for the budget workflow where analysts explore "what-if" scenarios by cloning a base version and modifying assumptions. Version isolation is implemented as a single PostgreSQL transaction that copies all related rows with a new `version_id` foreign key.

**4. Optimistic Locking.** Every mutable entity includes an `updated_at` timestamp. On every write operation, the application checks that the `updated_at` value in the request matches the current value in the database. If another user has modified the record since it was loaded, the write is rejected with a `409 Conflict` response. The client then reloads the current state before retrying. This mechanism is sufficient for the expected concurrency level of fewer than 20 simultaneous users and avoids the complexity and performance cost of pessimistic locking.

**5. Decorator/Middleware Pattern (Audit Logging).** Prisma's `$extends` API is used to attach middleware that intercepts all `create`, `update`, and `delete` operations across every model. The middleware automatically captures the operation type, table name, record ID, old values (for updates and deletes), new values (for creates and updates), the authenticated user ID, and a timestamp. These entries are written to the `audit_entries` table in the same transaction as the data modification, ensuring that no write can occur without a corresponding audit record. This pattern eliminates the risk of developers forgetting to add audit logging to new endpoints.

### 3.3 Cross-Cutting Concerns

**Logging.** All application logging uses Winston configured for structured JSON output. Every log entry includes the fields: `timestamp` (ISO 8601, AST), `level` (DEBUG, INFO, WARN, ERROR, FATAL), `requestId` (UUID v4 correlation ID assigned per HTTP request), `userId` (authenticated user or "anonymous"), `module` (e.g., "revenue-engine", "auth-middleware"), `message` (human-readable description), `duration_ms` (for timed operations), and an optional `error` object with stack trace. Log levels follow the convention: DEBUG for development diagnostics, INFO for normal operations, WARN for recoverable issues, ERROR for failures that affect a single request, FATAL for conditions that require immediate attention. ERROR and FATAL entries trigger an email alert to the System Administrator within 5 minutes.

**Observability.** The application exposes a `GET /api/v1/health` endpoint that returns the application status, database connectivity, and uptime. The `prom-client` library collects HTTP request duration histograms (p50, p95, p99) per endpoint, active connection count, and calculation engine execution times. These metrics are scraped by Prometheus. Note: Grafana dashboard integration is deferred to v2 per ADR-017. Alerts are configured for: p95 latency exceeding 2 seconds, error rate exceeding 5% over a 5-minute window, and health check failures.

**Error Handling.** The calculation engine follows a fail-fast strategy. If any step in the calculation chain encounters an error (missing data, constraint violation, unexpected state), the entire calculation transaction is rolled back. Partial calculation results are never persisted. The API returns a structured error response with a correlation `requestId` for debugging. Export operations (Excel, PDF, CSV) follow a different strategy: export jobs are queued and processed asynchronously, with automatic retry (up to 3 attempts with exponential backoff). Failed exports are flagged in the UI with the error details.

**Caching.** There is no application-level cache for financial data. This is a deliberate decision driven by correctness requirements. Financial calculations must always reflect the current state of the underlying data. Stale cache entries could produce incorrect reports — an unacceptable outcome for budget planning. The only caching in the system is at the Nginx layer for static assets (the React SPA bundle, images, fonts) with appropriate `Cache-Control` headers.

**Configuration Management.** Environment-specific configuration is managed through `.env` files (development, staging, production). Sensitive values (database credentials, JWT signing keys, pgcrypto encryption keys) are injected via Docker secrets in production and never committed to source control. The application validates all required environment variables at startup and fails fast with a clear error message if any are missing. A `.env.example` file documents all expected variables with placeholder values.
