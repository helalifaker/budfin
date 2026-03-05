# Section 9: NFR Design

## 9.1 Performance Design

For each NFR target, the following describes the specific technical implementation
that achieves it.

### Page Load < 1 Second (NFR 11.1)

- Vite builds with code splitting: each route module is a separate JS chunk (lazy import)
- Initial bundle target: < 150 KB gzipped (TanStack Table is headless — no UI overhead; shadcn/ui components are copy-paste, tree-shakeable)
- TanStack Table and shadcn/ui Table components loaded only on module pages that require them (not on Dashboard/Auth pages)
- Static assets (JS, CSS) served from Nginx with `Cache-Control: public, immutable` and 1-year max-age
- Recharts loaded lazily for Dashboard charts

### Calculate < 3 Seconds (NFR 11.1)

- All calculation runs server-side in Node.js process — no per-row DB roundtrips during calculation
- Revenue engine: loads all enrollment_detail + fee_grids for version into memory at start, processes in-memory loop using Decimal.js, then batch upserts to monthly_revenue in a single Prisma `createMany` call
- Staff cost engine: loads all employees (decrypted) + salary components into memory, computes all 168 x 12 = 2,016 rows in-process, batch upserts monthly_staff_costs
- Benchmark target: < 2 seconds for 168 employees, < 1 second for revenue (typical dataset)
- Prisma connection pool: default 10 connections; adequate for batch writes

### Calculate Visual Feedback < 200ms (NFR 11.4)

- React frontend: on "Calculate" button click, immediately show spinner + disable button (optimistic UI)
- Button state managed by React state: `isCalculating: boolean`
- Spinner appears before API call completes (instant client-side response)
- Server response confirms completion; spinner removed on 200 OK

### Version Comparison < 5 Seconds (NFR 11.1)

- Pre-aggregated `monthly_budget_summary` table: one row per version per month (12 rows per version)
- Comparison query: single JOIN on two versions' monthly_budget_summary computes variance in SQL
- No re-aggregation required; all monthly totals already computed during P&L calculation

### Data Grid Render < 500ms (NFR 11.4)

- TanStack Table v8 (no virtual scrolling — ADR-016), memoized column defs
- For datasets of 500 rows or fewer (all EFIR use cases): client-side row model via `getCoreRowModel()`
- For audit log (> 500 rows): server-side pagination via `manualPagination: true` with TanStack Query
- Column definitions memoized via `useMemo` — not recreated on each render

### API Response Targets

| Endpoint Category | p50 Target | p95 Target |
| -------------------- | ---------- | ---------- |
| Read endpoints (GET) | < 100ms | < 500ms |
| Write endpoints (PUT/PATCH) | < 200ms | < 1s |
| Calculation endpoints | < 1.5s | < 3s |
| Export job creation | < 200ms | < 500ms |
| Version comparison | < 1s | < 5s |

## 9.2 Scalability Design

### 20 Concurrent Users (SA-004)

- Node.js event loop handles concurrent async I/O efficiently
- Prisma connection pool: 10 connections default (configurable via `DATABASE_URL?connection_limit=10`)
- 20 concurrent users at 100 req/min each = ~33 req/sec total; well within single Node.js process capacity
- No horizontal scaling required for this load profile

### 300 Employees (Projected Growth)

- Staff cost calculation is O(n x 12) where n = employee count
- 300 employees x 12 months = 3,600 computation rows; adds < 1 second to current 168-employee timing
- No architectural change required

### 2,500 Students

- Revenue calculation is O(grade_combinations x 12), not O(students)
- ~45 fee grid combinations x 2 academic periods x 12 months = 1,080 revenue rows maximum
- Student headcount does not affect calculation complexity

### Storage Projection

- Annual data volume: ~50 MB (enrollment + revenue + staff costs + audit)
- 10-year accumulation: ~500 MB; well within single PostgreSQL instance limits
- audit_entries growth: ~10,000 entries/year x 7 years = 70,000 rows; trivial for PostgreSQL

## 9.3 Reliability Design

### 99.9% Uptime Target (NFR 11.2)

- Docker restart policy: `unless-stopped` (restarts on crash, not on manual stop)
- Nginx health checks route traffic away from unhealthy API container
- PostgreSQL `unless-stopped` restart policy
- Planned downtime window: monthly maintenance (excluded from SLA calculation)

### Calculation Atomicity

- PostgreSQL transaction wraps the entire calculation run:
  - DELETE existing monthly_revenue/monthly_staff_costs for this version
  - INSERT all new calculated rows
  - UPDATE calculation_audit_log status = 'COMPLETED'
  - COMMIT (or ROLLBACK on any error)

- If calculation fails mid-run, all changes roll back; previous results remain intact
- Stale flag NOT cleared until transaction commits successfully

### Auto-Save (NFR 11.4)

- Form fields: debounced PATCH request 500ms after last keystroke (no UX-blocking confirmation)
- Background interval: additional PATCH every 30 seconds for any unsaved dirty state
- Auto-save does NOT trigger recalculation (explicit Calculate button only, per D-004)
- Auto-save failures shown as a non-blocking toast notification; user data retained in React state

### Optimistic Locking

- Every mutable entity has `updated_at TIMESTAMPTZ`
- PUT/PATCH requests include `updated_at` of the record the client loaded
- Server rejects if `WHERE id = $id AND updated_at = $clientUpdatedAt` matches zero rows
- Returns 409: `{ "code": "OPTIMISTIC_LOCK_CONFLICT", "current_updated_at": "<server value>" }`
- Client shows conflict dialog; user chooses to refresh or force-overwrite

## 9.4 Maintainability Design

### Code Coverage Targets (Vitest)

| Module | Line Coverage | Branch Coverage |
| ------------------- | ------------- | --------------- |
| Calculation engine | >= 80% | >= 90% |
| RBAC middleware | >= 80% | >= 90% |
| API routes | >= 60% | N/A |
| Overall codebase | >= 60% | N/A |

### API Documentation

- Zod schemas defined for all request/response types
- `zod-to-openapi` generates OpenAPI 3.0 spec automatically from schemas
- Swagger UI served at `/api/docs` (development and staging only, disabled in production)
- `GET /api/openapi.json` available in all environments for tooling

### Database Migrations

- Prisma Migrate for all schema changes: `prisma migrate dev --name <description>`
- Forward-only migrations: no rollback migrations (use forward fix-forward approach)
- Emergency rollback: pg_dump restore (see Section 8 HA/DR)
- Migration files committed to Git alongside feature code

### Code Quality Gates (CI)

- ESLint 9 (flat config via `eslint.config.ts` — breaking change from `.eslintrc.*`): zero errors + zero warnings (no disable comments without justification in PR description)
- Prettier: all files formatted (checked, not auto-fixed, in CI)
- TypeScript: zero type errors with `strict: true` tsconfig

---

## Section 10: Testing Strategy

## 10.1 Unit Tests (Vitest)

Framework: Vitest with TypeScript. Co-located with source files as `*.test.ts`.

### Calculation Engine (Highest Priority)

**Revenue Engine tests:**

- Basic revenue formula: headcount x net_fee / period_months = expected SAR amount (Decimal.js)
- AY1 distribution: revenue distributed across months 1-6 only (months 7-12 = 0)
- AY2 distribution: revenue distributed across months 9-12 only (months 1-8 = 0)
- VAT exemption: Nationaux (is_saudi) -> tuition_ht = tuition_ttc; non-Saudi -> tuition_ht = tuition_ttc / 1.15
- Discount mutual exclusivity: RP + R3+ both eligible -> apply only higher discount
- Zero enrollment: headcount = 0 -> revenue = 0 (no division error)
- All 45+ fee grid combinations produce positive results
- Custom weight array: sum != 1.0 -> validation error
- ACADEMIC_10 distribution: verify revenue in Jul-Aug = 0, 10 academic months receive 1/10 each

**Staff Cost Engine tests:**

- Monthly gross with augmentation: months 1-8 use pre-augmentation salary; months 9-12 include augmentation
- HSA exclusion: month 7 and 8 -> adjusted_gross excludes hsa_amount for teaching staff
- HSA inclusion: months 1-6 and 9-12 -> adjusted_gross includes hsa_amount
- Part-time factor: hourly_percentage = 0.5 -> all components halved
- GOSI: is_saudi = true -> 11.75% of adjusted_gross; is_saudi = false -> 0
- Ajeer existing: 12 months of (annual_levy / 12 + monthly_fee)
- Ajeer new: 4 months (Sep-Dec) only, prorated levy
- EoS <= 5 years: (eos_base / 2) x years_of_service (with known fixture values)
- EoS > 5 years: (eos_base / 2 x 5) + eos_base x (yos - 5)
- EoS mid-year hire: joining_date in current year -> fractional YoS via YEARFRAC

**YEARFRAC tests (TC-002 -- critical, validate against known values):**

```text
yearFrac(2018-01-15, 2026-12-31) -> expected: 8.9556 (verify against Excel)
yearFrac(2020-03-31, 2026-12-31) -> expected: 6.7500
yearFrac(2025-09-01, 2026-12-31) -> expected: 0.3333 (4 months / 12)
yearFrac(2021-12-31, 2026-12-31) -> expected: 5.0000
yearFrac(2024-08-31, 2026-12-31) -> expected: 2.3333
```

Edge cases: day 31 normalization; February end-of-month; same year/month.

**P&L Engine tests:**

- Zakat on positive profit: 2.5% applied
- Zakat on zero profit: 0 (no negative zakat)
- Zakat on loss (negative profit): 0

### RBAC Middleware

- Admin -> all protected routes: 200/201/204
- BudgetOwner -> data:edit routes: 200; users:manage routes: 403
- Editor -> data:edit routes: 200; versions:create route: 403
- Viewer -> data:view routes: 200; data:edit routes: 403
- Unauthenticated -> all protected routes: 401
- Expired JWT -> all protected routes: 401
- Tampered JWT signature -> all protected routes: 401

## 10.2 Integration Tests (Vitest + Real PostgreSQL)

Uses a dedicated test PostgreSQL database (separate from dev). Schema applied via
`prisma migrate deploy` in CI.

Test fixtures: seed data for 1 version, 5 employees (mix of Saudi/non-Saudi,
new/existing), 1 fee grid (simplified), 1 academic year of enrollment.

### Full Calculation Chain Test

1. PUT enrollment headcount for test version
2. PUT enrollment detail (nationality x tariff breakdown)
3. PUT fee grid for AY1 and AY2
4. POST /calculate/revenue -> assert HTTP 200
5. GET /versions/:id/revenue -> assert monthly totals match pre-computed fixture (+/- 1 SAR)
6. POST /calculate/staffing -> assert HTTP 200
7. GET /versions/:id/staff-costs -> assert monthly totals match fixture
8. POST /calculate/pnl -> assert HTTP 200
9. GET /versions/:id/pnl -> assert net_profit matches fixture

### Version Lifecycle Tests

- Draft -> Published: valid, HTTP 200
- Published -> Locked: valid, HTTP 200
- Locked -> Published (by Admin with audit_note): valid, HTTP 200
- Draft -> Locked (skip Published): invalid, 409 INVALID_TRANSITION
- Editor attempting Published -> Locked: 403 INSUFFICIENT_ROLE

### Import Flow Tests

- POST enrollment/historical/import (mode=validate): returns preview + error count, no DB write
- POST enrollment/historical/import (mode=commit): writes to DB, idempotent on re-run
- Duplicate academic_year: 409 DUPLICATE_YEAR response

### Optimistic Lock Test

- Load employee, note updated_at
- Concurrent PUT with stale updated_at -> 409 OPTIMISTIC_LOCK_CONFLICT

## 10.3 Excel Regression Suite (Phase 2+)

Python scripts in `/tests/regression/` that call the BudFin API and compare results
against frozen Excel workbook values.

Architecture:

```text
tests/regression/
  fixtures/                    # frozen expected values extracted from Excel
    revenue_expected.json
    staff_costs_expected.json
    pnl_expected.json
  compare_revenue.py
  compare_staff_costs.py
  compare_pnl.py
  run_regression.sh            # runs all comparisons, exits non-zero on failure
```

Pass criteria: every line item, every month within +/- 1.00 SAR (TC-004 tolerance).

CI integration: `run_regression.sh` called after integration tests. Non-zero exit code
blocks the build (Phase 2+).

Scope:

- All 12 months of monthly_revenue totals by grade and nationality
- All 168 employees x 12 months of monthly_staff_costs (GOSI, Ajeer, EoS per employee)
- All 12 months of monthly_budget_summary (revenue, costs, P&L subtotals)

## 10.4 End-to-End Tests (Playwright)

Browser: Chromium (default Playwright browser). Runs against staging environment.

Key scenarios:

1. **Annual budget preparation workflow**: Login -> Create new Budget version -> Enter enrollment -> Set fee grid -> Run revenue calc -> Verify revenue totals displayed correctly -> Run staffing calc -> Run P&L -> Export xlsx -> Verify download
2. **Version comparison workflow**: Select primary + comparison version -> Navigate to P&L -> Verify variance columns appear -> Verify green/red color coding on favorable/unfavorable variances
3. **Context bar persistence**: Navigate from Enrollment -> Revenue -> Staff Costs -> P&L -> verify fiscalYear and versionId remain unchanged in context bar throughout
4. **Calculate button stale indicator**: Modify enrollment headcount -> verify revenue module shows stale indicator -> click Calculate Revenue -> verify stale indicator clears

## 10.5 Performance Tests (k6)

Test scenarios in `/tests/performance/`:

### Concurrent Users Test

- 20 virtual users; 5-minute duration; ramp up over 30 seconds
- Scenario: browse dashboard, navigate all modules, run one calculation
- Pass criteria: p95 response time < 3s; error rate < 0.1%

### Calculation Load Test

- 10 simultaneous POST /calculate/revenue requests
- Pass criteria: all complete within 10 seconds; no 5xx errors; DB integrity intact

### Export Load Test

- 5 concurrent POST /export/jobs requests (xlsx format)
- Pass criteria: all jobs complete within 15 seconds; all files downloadable

## 10.6 Security Tests

- `npm audit --audit-level=high` in every CI run: fails build on HIGH or CRITICAL CVE
- OWASP ZAP DAST automated scan: run against staging pre-go-live; fix all MEDIUM and above findings
- RBAC penetration suite (Vitest): for every protected endpoint, each unauthorized role tested for 403
- JWT tampering: test with role field modified -> 401 (signature verification catches it)
- Replay attack: use invalidated refresh token -> 401 INVALID_REFRESH_TOKEN

## 10.7 UAT (Phase 6)

Finance team (HR/Payroll Coordinator + Budget Analyst + CAO) validates:

- All 30 Given/When/Then acceptance criteria from PRD Section 16.3
- Parallel run for 2 weeks: EFIR staff run both Excel and BudFin simultaneously
- Pass criteria: BudFin output matches Excel within +/- 1 SAR per line item per month; 100% enrollment headcount match
- Any discrepancy triggers a bug ticket (P1: same-day fix required for calculation errors)
