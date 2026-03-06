# BudFin Epic Dependency Analysis: Version Management Sequencing

**Date:** 2026-03-06
**Analysis Type:** Data model and API contract review
**Question:** Should Epic 10 (Version Management) move earlier in the implementation order?

---

## Executive Summary

**CRITICAL FINDING: Epic 10 (Version Management) is a foundational dependency that MUST be implemented before Epic 7 (Master Data Management).**

The current planned order places Version Management at position 10, but **every data-modifying epic after Epic 6 (Authentication & RBAC) requires a `BudgetVersion` record to exist.** This creates a chicken-and-egg problem:

- Epics 7, 1, 2, 3, 4 all depend on writing data to version-scoped tables
- No version-scoped table can accept writes without a valid `version_id` foreign key reference
- A version is created via the Version Manager API in Epic 10
- **Result:** Epic 7+ will block until Epic 10 is complete

**Recommended order:** Shift Epic 10 immediately after Epic 11 (Auth), making it Epic 11B or renaming the sequence to:

```text
Epic 13 → Epic 11 → Epic 10 → Epic 7 → Epic 1 → Epic 2 → Epic 3 → Epic 4 → Epic 5 → Epic 6 → Epic 8 → Epic 9 → Epic 12
```text

---

## Analysis

### 1. Version as a Foundational Container

The `budget_versions` table is the **central isolation entity** for all planning data. From `docs/tdd/03_data_architecture.md`:

> "Budget version container. All planning data is scoped by version_id FK. Versions are isolated snapshots — cloning creates independent copies with no shared mutable state."

Every data-modifying epic after authentication requires a version to exist:

| Epic   | Title                  | Data Modified                      | Requires `version_id`?  |
| ------ | ---------------------- | ---------------------------------- | ----------------------- |
| 13     | Infrastructure & CI    | (None — setup only)                | No                      |
| 11     | Authentication & RBAC  | `users`, `refresh_tokens`, etc.    | No (system-level)       |
| **10** | **Version Management** | **`budget_versions` (creates it)** | **N/A — creates it**    |
| 7      | Master Data            | `chart_of_accounts`, etc.          | No (global, not scoped) |
| 1      | Enrollment             | `enrollment_headcount`, `_detail`  | **YES — both have FK**  |
| 2      | Revenue                | `fee_grids`, `discount_policies`   | **YES — both have FK**  |
| 3      | Staffing (DHG)         | `employees`, `scenario_parameters` | **YES — employees FK**  |
| 4      | Staff Costs            | (calculations on employees)        | **YES — via employees** |
| 5      | P&L Reporting          | (aggregations, no new tables)      | **YES — calculations**  |
| 6      | Scenario Modeling      | `scenario_parameters`              | **YES — has FK**        |
| 8      | Audit Trail            | `calculation_audit_log`            | No (system-level)       |
| 9      | Dashboard              | (read-only aggregates)             | **YES — reads from**    |
| 12     | Data Migration         | (imports into versions)            | **YES — requires**      |

### 2. Version-Scoped Table Dependencies

From `docs/tdd/03_data_architecture.md`, these tables MUST have a `version_id` FK to `budget_versions`:

```text
FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE
```text

Tables explicitly dependent:

- `employees` (Epic 3 writes here)
- `fee_grids` (Epic 2 writes here)
- `enrollment_headcount` (Epic 1 writes here)
- `enrollment_detail` (Epic 1 writes here)
- `discount_policies` (Epic 2 writes here)
- `other_revenue_items` (Epic 2 writes here)
- `scenario_parameters` (Epic 6 writes here)
- `actuals_import_log` (Epic 12 writes here)
- `monthly_revenue`, `monthly_staff_costs`, `monthly_budget_summary` (downstream calculations)

**Impact:** Epics 1, 2, 3, 6, and 12 cannot execute even a single INSERT/UPDATE until at least one `BudgetVersion` record exists.

### 3. Version Manager Responsibilities (Epic 10)

From `docs/tdd/02_component_design.md` §4.5, Version Manager must provide:

| Operation          | Endpoint                            | Effect                                      |
| ------------------ | ----------------------------------- | ------------------------------------------- |
| Create version     | `POST /api/v1/versions`             | Creates `BudgetVersion` row in Draft status |
| Clone version      | `POST /api/v1/versions/:id/clone`   | Deep-copies all version-scoped data         |
| List versions      | `GET /api/v1/versions`              | Returns all versions for a fiscal year      |
| Get version detail | `GET /api/v1/versions/:id`          | Returns stale flags and version status      |
| Change status      | `PATCH /api/v1/versions/:id/status` | Draft → Published → Locked → Archived       |
| Delete draft       | `DELETE /api/v1/versions/:id`       | Only for Draft versions                     |

Without these endpoints (or at minimum `POST /api/v1/versions` to create), no downstream epic can create test data.

### 4. API Contract Confirms Version-First Flow

From `docs/tdd/04_api_contract.md`, all data-modifying endpoints follow this pattern:

```text
PUT /api/v1/versions/:versionId/enrollment/headcount
PUT /api/v1/versions/:versionId/fee-grid
PUT /api/v1/versions/:versionId/employees
POST /api/v1/versions/:versionId/employees/import
PUT /api/v1/versions/:versionId/discounts
POST /api/v1/versions/:versionId/calculate/enrollment
```text

Every path includes `:versionId`, and the API contract defines `404 VERSION_NOT_FOUND` as a potential error for each, confirming that:

1. A version MUST exist before writing data
2. The endpoint validates the version exists
3. No "auto-create-a-version" fallback exists

### 5. Current Plan Creates a Blocker

**Scenario: Implementing Epic 7 (Master Data) in the current order (position 3)**

At this point:

- Epic 13 (CI/CD infrastructure) is done ✓
- Epic 11 (Auth) is done ✓
- Epic 10 (Version Management) has NOT been implemented yet ✗

Epic 7 story: "As Finance Director, I can view Chart of Accounts master data"

- Backend implementation: `GET /api/v1/chart-of-accounts`
- This endpoint CAN be implemented (it's not version-scoped)
- **But:** Testing the system end-to-end requires creating a test version
- Test setup would need to manually INSERT into `budget_versions` (database-level)
- This breaks the abstraction — developers shouldn't write raw SQL to bypass the API

**Scenario: Implementing Epic 1 (Enrollment) without Epic 10**

At position 4, with Epic 10 still unimplemented:

- Story: "As Budget Analyst, I can import enrollment headcount by grade level"
- Backend: `PUT /api/v1/versions/:versionId/enrollment/headcount`
- **Cannot be tested:** No version exists
- **Cannot be deployed:** Migrations would fail FK checks
- **Workaround:** Hard-code a test version ID in fixtures — introduces technical debt

### 6. No Circular Dependency

Shifting Epic 10 earlier does NOT create a reverse dependency:

- Epic 10 (Version Manager) depends only on:
  - Epic 11 (Auth) — for role-gated RBAC checks ✓ Already scheduled first
  - Database schema — available immediately after migrations ✓

Epic 11 does not depend on Epic 10 — it creates the auth infrastructure, not versions.

---

## Recommended Action

**Move Epic 10 (Version Management) to position 3, immediately after Epic 11 (Authentication & RBAC).**

### New Sequence

```text
Phase 5 (IMPLEMENT):
  Epic 13 (Week 1-2)       → Infrastructure & CI/CD
  Epic 11 (Week 3-4)       → Authentication & RBAC
  Epic 10 (Week 5-6)       → Version Management           ← MOVED UP
  Epic 7  (Week 7-8)       → Master Data Management
  Epic 1  (Week 9-10)      → Enrollment & Capacity
  Epic 2  (Week 11-12)     → Revenue Forecasting
  Epic 3  (Week 13-14)     → Staffing (DHG)
  Epic 4  (Week 15-16)     → Staff Costs
  Epic 5  (Week 17-18)     → P&L Reporting
  Epic 6  (Week 19-20)     → Scenario Modeling
  Epic 8  (Week 21-22)     → Audit Trail
  Epic 9  (Week 23-24)     → Dashboard
  Epic 12 (Week 25-26+)    → Data Migration
```text

### Why This Works

1. **Unblocks Epics 1–6:** All downstream epics can immediately create test versions and write data
2. **No reverse dependency:** Auth doesn't depend on Version Management
3. **Minimal risk:** Version Manager is a straightforward CRUD service with one complex operation (clone)
4. **Early validation:** Tests the data isolation model in isolation before adding complexity
5. **Enables parallel work:** Once Epic 10 is done, Teams can start Epics 7, 1, 2, 3, 4, 6 independently

---

## Implementation Notes

### Schemas for Epic 10 (Version Manager)

Required Prisma models (in addition to existing auth/system):

- `BudgetVersion` (from `docs/tdd/03_data_architecture.md` §Table 3)
- `FiscalPeriod` (month-level period management)
- `StaleFlag` (module-level cache invalidation)

Required migrations:

1. Create `budget_versions` table with self-referential `source_version_id` FK
2. Create `fiscal_periods` with `actual_version_id` FK to `budget_versions`
3. Create `stale_flags` table for invalidation tracking

### Stories for Epic 10

Likely stories (to be confirmed in `/plan:spec epic-10`):

- S-1: Create version (POST /api/v1/versions)
- S-2: Clone version (POST /api/v1/versions/:id/clone)
- S-3: List versions (GET /api/v1/versions)
- S-4: View version detail with stale flags
- S-5: Transition version status (Draft → Published → Locked → Archived)
- S-6: Delete draft version
- S-7: Version compare (side-by-side variance)

---

## Risks Mitigated

| Risk                                              | Current Plan | Revised Plan    |
| ------------------------------------------------- | ------------ | --------------- |
| Epic 7+ blocked on Version Manager implementation | HIGH         | ELIMINATED      |
| Raw SQL workarounds in test fixtures              | MEDIUM       | ELIMINATED      |
| FK constraint violations during testing           | HIGH         | ELIMINATED      |
| Unclear when version isolation is validated       | MEDIUM       | Validated early |

---

## References

- `docs/tdd/03_data_architecture.md` — data model and version-scoped tables
- `docs/tdd/02_component_design.md` §4.5 — Version Manager component design
- `docs/tdd/04_api_contract.md` — API endpoints with `:versionId` paths
- `docs/plans/2026-03-06-audit-remediation-report.md` — current planned order
