# Feature Spec: Staffing (DHG)

> Epic: #7 | Phase: 4 — SPECIFY | Status: Draft | Date: 2026-03-09

## Summary

The Staffing (DHG) feature delivers the DHG (Dotation Horaire Globale) staffing model and Staff Cost calculation engine for EFIR's annual budget planning (PRD FR-DHG-001 through FR-DHG-021, FR-STC-001 through FR-STC-025). The DHG Engine computes FTE teaching requirements per grade level by deriving section counts from enrollment headcount and class capacity, then multiplying by the subject-hours grille to produce total weekly hours, annual hours, and FTE. The Staff Cost Engine computes monthly costs for every employee including base gross with September augmentation step-change, HSA summer exclusion for teaching staff, GOSI (11.75% for Saudi nationals), Ajeer levies (prorated for new staff Sep-Dec), and End-of-Service provision accruals using the YEARFRAC US 30/360 algorithm. This feature depends on Epic 11 (Auth/RBAC), Epic 7 (Master Data), Epic 1 (Enrollment & Capacity), and Epic 10 (Version Management).

## Acceptance Criteria

Each criterion must be testable and specific. Use "Given / When / Then" or plain language.

### Employee CRUD

- [x] AC-01: Given an authenticated Admin/BudgetOwner/Editor with a Draft version, when they POST to `/api/v1/versions/:versionId/employees` with valid employee data, then a new employee record is created with salary fields encrypted at rest via pgcrypto, and the STAFFING stale flag is set on the version.
- [x] AC-02: Given an authenticated user, when they GET `/api/v1/versions/:versionId/employees`, then paginated employee records are returned. Salary fields (`base_salary`, `housing_allowance`, `transport_allowance`, `responsibility_premium`, `hsa_amount`, `augmentation`) are returned as `null` for Viewer role.
- [x] AC-03: Given an authenticated Admin/BudgetOwner/Editor, when they PUT `/api/v1/versions/:versionId/employees/:id` with an `If-Match` header matching the current `updated_at`, then the employee record is updated and STAFFING stale flag is set. If `If-Match` does not match, a 409 OPTIMISTIC_LOCK error is returned.
- [x] AC-04: Given an authenticated Admin/BudgetOwner, when they DELETE an employee on a Draft version, then the record is hard-deleted. On a Published version, the employee status is set to `Departed` (soft-delete).
- [x] AC-05: Given an employee_code that already exists in the version, when creating a new employee, then a 409 DUPLICATE_EMPLOYEE_CODE error is returned.

### Employee Import

- [x] AC-06: Given an xlsx file uploaded in `validate` mode, when the server processes it, then a preview is returned with `total_rows`, `valid_rows`, `errors` (row-level with field and message), and a `preview` array of valid records. No data is persisted.
- [x] AC-07: Given an xlsx file uploaded in `commit` mode, when validation passes, then employee records are bulk-inserted, STAFFING stale flag is set, and a summary with `imported`/`skipped`/`errors` counts is returned.
- [x] AC-08: Given an xlsx row that matches 2+ of (name, department, joining_date) with an existing employee in the version, when validating, then the row is flagged as a potential duplicate in the `errors` array with a `POTENTIAL_DUPLICATE` code.

### DHG Engine

- [x] AC-09: Given enrollment headcount and max_class_size for a grade, when `calculateSectionsNeeded` runs, then `sections_needed = CEILING(headcount / max_class_size)`. When headcount is 0, sections_needed is 0 (not 1).
- [x] AC-10: Given a DHG grille with subject-hours per section and the computed sections_needed, when `calculateFTE` runs, then `total_weekly_hours = SUM(hours_per_week_per_section * sections_needed)` across all subjects for the grade, `total_annual_hours = total_weekly_hours * academic_weeks (36)`, and `fte = total_weekly_hours / 18` (ORS divisor).
- [x] AC-11: Given the POST `/api/v1/versions/:versionId/calculate/staffing` endpoint is called, when enrollment data and employee records exist, then DHG requirements are computed for all grades and staff costs are calculated for all employees. The response includes `run_id`, `duration_ms`, `total_fte`, and `total_annual_staff_costs`.
- [x] AC-12: Given a version where enrollment data has not been entered, when the staffing calculation is triggered, then a 422 MISSING_PREREQUISITES error is returned with `missing: ["ENROLLMENT"]`.
- [x] AC-12b: Given a version where no employee records exist, when the staffing calculation is triggered, then a 422 MISSING_PREREQUISITES error is returned with `missing: ["EMPLOYEES"]`. Both enrollment data and at least one employee record are required prerequisites.

### Staff Cost Engine — Monthly Gross

- [x] AC-13: Given an employee with a base_salary and augmentation percentage, when calculating monthly gross, then months 1-8 (Jan-Aug) use the pre-augmentation salary. Months 9-12 (Sep-Dec) apply the augmentation percentage to the base salary and all affected allowances (housing_allowance, transport_allowance, responsibility_premium) — the September step-change. HSA is NOT subject to augmentation. The augmentation field (`augmentationPercent` in TDD 4.4.3) is stored as a Decimal percentage (e.g., `0.0300` = 3%).
- [x] AC-14: Given a teaching employee (`isTeaching = true`), when calculating months 7 (July) and 8 (August), then `hsa_amount` is set to 0 for those months (HSA summer exclusion). Non-teaching employees receive HSA year-round.

### Staff Cost Engine — GOSI

- [x] AC-15: Given a Saudi national employee (`is_saudi = true`), when calculating GOSI, then `gosi_amount = 11.75% * full_monthly_gross`. For non-Saudi employees, `gosi_amount = 0`.

### Staff Cost Engine — Ajeer

- [x] AC-16: Given a non-Saudi existing employee (`is_ajeer = true`, `status = Existing`), when calculating Ajeer, then `ajeer_amount = (ajeer_annual_levy / 12) + ajeer_monthly_fee` for all 12 months.
- [x] AC-17: Given a non-Saudi new employee (`is_ajeer = true`, `status = New`), when calculating Ajeer, then Ajeer applies only for months 9-12 (Sep-Dec). The monthly amount is `(ajeer_annual_levy / 12) + ajeer_monthly_fee` for those 4 months, and 0 for months 1-8.
- [x] AC-18: Given a Saudi employee, when calculating Ajeer, then `ajeer_amount = 0` regardless of status.

### Staff Cost Engine — End-of-Service (EoS)

- [x] AC-19: Given an employee with a hire_date, when calculating EoS provision, then years_of_service (YoS) is computed via `YEARFRAC(hire_date, as_of_date)` using the US 30/360 algorithm matching Excel `YEARFRAC(start, end, 0)` exactly.
- [x] AC-20: Given YoS <= 5, when computing EoS, then `eos_annual = (eos_base / 2) * YoS` where `eos_base = base_salary + housing_allowance + transport_allowance + responsibility_premium` (HSA excluded).
- [x] AC-21: Given YoS > 5, when computing EoS, then `eos_annual = (eos_base / 2 * 5) + eos_base * (YoS - 5)`. Monthly accrual = `eos_annual / 12`.

### Staff Cost Engine — Total Cost

- [x] AC-22: Given a fully calculated month for an employee, then `total_cost = adjusted_gross + gosi_amount + ajeer_amount + eos_monthly_accrual`, where `adjusted_gross` includes base salary (with augmentation if month >= 9), housing allowance, transport allowance, responsibility premium, and HSA (with summer exclusion).

### Result Endpoints

- [x] AC-23: Given calculated staff costs, when GET `/api/v1/versions/:versionId/staff-costs` is called with `group_by=employee|department|month`, then results are grouped accordingly. Salary details are `null` for Viewer role.
- [x] AC-24: Given calculated DHG data, when GET `/api/v1/versions/:versionId/dhg-grilles` is called, then the DHG grid data with hourly allocations per teaching level is returned.
- [x] AC-25: Given calculated staffing data, when GET `/api/v1/versions/:versionId/staffing-summary` is called, then a department-level FTE and cost aggregation is returned.

### Version & Stale Flag Integration

- [x] AC-26: Given a Locked or Archived version, when any write operation (create/update/delete employee, calculate) is attempted, then a 409 VERSION_LOCKED error is returned.
- [x] AC-27: Given an employee record change (create, update, delete), then the STAFFING module is added to the version's `staleModules` array. When staffing calculation runs successfully, STAFFING is removed from `staleModules`.

### Financial Precision

- [x] AC-28: All monetary calculations in the DHG and Staff Cost engines use `Decimal.js` with `ROUND_HALF_UP`. No native JavaScript `Number` is used for monetary arithmetic (TC-001).
- [x] AC-29: All monetary values are stored as `DECIMAL(15,4)` in PostgreSQL. Values are serialized as strings in JSON responses to prevent IEEE 754 precision loss.
- [x] AC-30: The YEARFRAC US 30/360 implementation produces results identical to Excel's `YEARFRAC(start, end, 0)` for all test cases including month-end boundaries (day 31 adjustment) and leap year boundaries (TC-002).

### Audit & Security

- [x] AC-31: All employee record mutations are captured by the audit logger. Salary field values in audit entries are stored encrypted (pgcrypto), not plaintext, per PDPL compliance.
- [x] AC-32: RBAC is enforced on all endpoints: Viewer can read (with salary redaction), Editor/BudgetOwner/Admin can write, only Admin/BudgetOwner can delete.

## Stories

| #   | Story                                                                                                                           | Depends On        | GitHub Issue |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------ |
| 1   | Prisma schema: Employee, DhgGrilleConfig, MonthlyStaffCost, EosProvision models                                                 | —                 | #138         |
| 2   | Employee CRUD endpoints (GET list, GET by id, POST, PUT, DELETE) with pgcrypto encryption, salary redaction, optimistic locking | Story 1           | #140         |
| 3   | Employee xlsx bulk import (two-phase validate/commit) with duplicate detection                                                  | Story 2           | #142         |
| 4   | DHG grille config data model and GET endpoint                                                                                   | Story 1           | #141         |
| 5   | DHG Engine: calculateSectionsNeeded, calculateFTE, calculateDHG                                                                 | Story 4           | #143         |
| 6   | YEARFRAC US 30/360 implementation with Excel-matching test suite                                                                | —                 | #139         |
| 7   | Staff Cost Engine: calculateMonthlyGross with September augmentation step-change                                                | Story 1, Story 6  | #144         |
| 8   | Staff Cost Engine: calculateGOSI, calculateAjeer, calculateEoSProvision                                                         | Story 7           | #145         |
| 9   | Staff Cost Engine: full monthly cost computation and persistence (MonthlyStaffCost, EosProvision)                               | Story 8           | #146         |
| 10  | POST /calculate/staffing orchestration endpoint (DHG + Staff Cost pipeline)                                                     | Story 5, Story 9  | #147         |
| 11  | GET /staff-costs, GET /dhg-grilles, GET /staffing-summary result endpoints                                                      | Story 10          | #148         |
| 12  | Stale flag integration: mark STAFFING stale on employee changes, clear on calculation                                           | Story 2, Story 10 | #149         |
| 13  | Frontend: Employee List Page with PlanningGrid, department/status filters, salary redaction                                     | Story 2           | #150         |
| 14  | Frontend: Employee Form (create/edit) in right panel with all 18+ fields                                                        | Story 13          | #151         |
| 15  | Frontend: Employee Import dialog (two-phase xlsx upload with validation preview)                                                | Story 3, Story 13 | #152         |
| 16  | Frontend: DHG Grille View and DHG Requirements View tabs                                                                        | Story 4, Story 5  | #153         |
| 17  | Frontend: Monthly Cost Budget tab — 12-month read-only grid with hierarchical category rows, September indicator, period filter | Story 11          | #154         |
| 18  | Frontend: Staffing module toolbar with Calculate button, stale banner, and staffing summary KPI cards                           | Story 11          | #155         |

## Data Model Changes

### New Models

```sql
-- Employee master records with encrypted salary fields
CREATE TABLE employees (
    id              SERIAL PRIMARY KEY,
    version_id      INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
    employee_code   VARCHAR(20) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    function_role   VARCHAR(100) NOT NULL,
    department      VARCHAR(50) NOT NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'Existing', -- Existing | New | Departed
    joining_date    DATE NOT NULL,
    payment_method  VARCHAR(50) NOT NULL,
    is_saudi        BOOLEAN NOT NULL DEFAULT FALSE,
    is_ajeer        BOOLEAN NOT NULL DEFAULT FALSE,
    is_teaching     BOOLEAN NOT NULL DEFAULT FALSE,
    hourly_percentage DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    -- Salary fields: encrypted at rest via pgcrypto pgp_sym_encrypt
    base_salary           BYTEA NOT NULL,  -- pgcrypto encrypted DECIMAL(15,4)
    housing_allowance     BYTEA NOT NULL,
    transport_allowance   BYTEA NOT NULL,
    responsibility_premium BYTEA NOT NULL DEFAULT pgp_sym_encrypt('0.0000', key),
    hsa_amount            BYTEA NOT NULL DEFAULT pgp_sym_encrypt('0.0000', key),
    augmentation          BYTEA NOT NULL DEFAULT pgp_sym_encrypt('0.0000', key),
    augmentation_effective_date DATE,
    ajeer_annual_levy     DECIMAL(15,4) NOT NULL DEFAULT 0,
    ajeer_monthly_fee     DECIMAL(15,4) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      INTEGER NOT NULL REFERENCES users(id),
    updated_by      INTEGER REFERENCES users(id),
    CONSTRAINT uq_employee_code_version UNIQUE (version_id, employee_code)
);
CREATE INDEX idx_employees_version ON employees(version_id);
CREATE INDEX idx_employees_department ON employees(version_id, department);
CREATE INDEX idx_employees_status ON employees(version_id, status);

-- DHG teaching hour grille (not version-scoped; effective_from_year for grille changes)
CREATE TABLE dhg_grille_config (
    id                        SERIAL PRIMARY KEY,
    grade_level               VARCHAR(10) NOT NULL,
    subject                   VARCHAR(100) NOT NULL,
    dhg_type                  VARCHAR(20) NOT NULL DEFAULT 'Structural', -- Structural | Host_Country | Complementary
    hours_per_week_per_section DECIMAL(5,2) NOT NULL,
    effective_from_year       INTEGER NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dhg_grille UNIQUE (grade_level, subject, effective_from_year)
);
CREATE INDEX idx_dhg_grille_grade ON dhg_grille_config(grade_level);

-- Calculated: monthly cost breakdown per employee
CREATE TABLE monthly_staff_costs (
    id                  SERIAL PRIMARY KEY,
    version_id          INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
    employee_id         INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month               SMALLINT NOT NULL, -- 1-12
    base_gross          DECIMAL(15,4) NOT NULL,
    adjusted_gross      DECIMAL(15,4) NOT NULL,
    housing_allowance   DECIMAL(15,4) NOT NULL DEFAULT 0,
    transport_allowance DECIMAL(15,4) NOT NULL DEFAULT 0,
    responsibility_premium DECIMAL(15,4) NOT NULL DEFAULT 0,
    hsa_amount          DECIMAL(15,4) NOT NULL DEFAULT 0,
    gosi_amount         DECIMAL(15,4) NOT NULL DEFAULT 0,
    ajeer_amount        DECIMAL(15,4) NOT NULL DEFAULT 0,
    eos_monthly_accrual DECIMAL(15,4) NOT NULL DEFAULT 0,
    total_cost          DECIMAL(15,4) NOT NULL,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calculated_by       INTEGER REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_monthly_staff_cost UNIQUE (version_id, employee_id, month)
);
CREATE INDEX idx_monthly_staff_costs_version ON monthly_staff_costs(version_id);
CREATE INDEX idx_monthly_staff_costs_employee ON monthly_staff_costs(employee_id);

-- EoS provision per employee
CREATE TABLE eos_provisions (
    id                  SERIAL PRIMARY KEY,
    version_id          INTEGER NOT NULL REFERENCES budget_versions(id) ON DELETE CASCADE,
    employee_id         INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    years_of_service    DECIMAL(7,4) NOT NULL,
    eos_base            DECIMAL(15,4) NOT NULL,
    eos_annual          DECIMAL(15,4) NOT NULL,
    eos_monthly_accrual DECIMAL(15,4) NOT NULL,
    as_of_date          DATE NOT NULL,
    calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_eos_provision UNIQUE (version_id, employee_id)
);
CREATE INDEX idx_eos_provisions_version ON eos_provisions(version_id);
```

### Existing Model Changes

```sql
-- Add staffing relations to budget_versions
ALTER TABLE budget_versions ADD COLUMN -- (handled via Prisma relation only, no DDL)
-- employees[], monthly_staff_costs[], eos_provisions[] relations added in Prisma schema

-- Extend DhgRequirement model with FTE fields (currently only has sections/utilization)
ALTER TABLE dhg_requirements ADD COLUMN total_weekly_hours DECIMAL(10,4) DEFAULT 0;
ALTER TABLE dhg_requirements ADD COLUMN total_annual_hours DECIMAL(10,4) DEFAULT 0;
ALTER TABLE dhg_requirements ADD COLUMN fte DECIMAL(7,4) DEFAULT 0;
```

## API Endpoints

| Method | Path                                             | Request                                             | Response                                                                    | Auth                         |
| ------ | ------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------- |
| GET    | `/api/v1/versions/:versionId/employees`          | Query: `department`, `status`, `page`, `page_size`  | `{ employees: [...], total, page, page_size }`                              | All (salary null for Viewer) |
| POST   | `/api/v1/versions/:versionId/employees`          | Employee body (see below)                           | 201 Full employee object                                                    | Admin, BudgetOwner, Editor   |
| GET    | `/api/v1/versions/:versionId/employees/:id`      | —                                                   | Full employee object                                                        | All (salary null for Viewer) |
| PUT    | `/api/v1/versions/:versionId/employees/:id`      | Employee body + `If-Match` header                   | 200 Updated employee                                                        | Admin, BudgetOwner, Editor   |
| DELETE | `/api/v1/versions/:versionId/employees/:id`      | —                                                   | 204                                                                         | Admin, BudgetOwner           |
| POST   | `/api/v1/versions/:versionId/employees/import`   | multipart: `file` (xlsx) + `mode` (validate/commit) | 200/201 validation/import result                                            | Admin, BudgetOwner, Editor   |
| POST   | `/api/v1/versions/:versionId/calculate/staffing` | —                                                   | `{ run_id, duration_ms, summary: { total_fte, total_annual_staff_costs } }` | Admin, BudgetOwner, Editor   |
| GET    | `/api/v1/versions/:versionId/dhg-grilles`        | —                                                   | `{ grilles: [...] }`                                                        | All                          |
| GET    | `/api/v1/versions/:versionId/staff-costs`        | Query: `group_by`, `include_breakdown`              | `{ data: [...], totals: {...}, breakdown }`                                 | All (salary null for Viewer) |
| GET    | `/api/v1/versions/:versionId/staffing-summary`   | —                                                   | `{ totalFTE, totalSalaryCost, byDepartment: [...] }`                        | All                          |

### Employee Response Schema

All employee endpoints return objects with this shape (salary fields `null` for Viewer role):

```json
{
    "id": "number",
    "employee_code": "string",
    "name": "string",
    "function_role": "string",
    "department": "string",
    "status": "Existing|New|Departed",
    "joining_date": "string (YYYY-MM-DD)",
    "payment_method": "string",
    "is_saudi": "boolean",
    "is_ajeer": "boolean",
    "is_teaching": "boolean",
    "hourly_percentage": "string (decimal)",
    "base_salary": "string|null (decimal, null for Viewer)",
    "housing_allowance": "string|null",
    "transport_allowance": "string|null",
    "responsibility_premium": "string|null",
    "hsa_amount": "string|null",
    "augmentation": "string|null",
    "augmentation_effective_date": "string|null (YYYY-MM-DD)",
    "ajeer_annual_levy": "string (decimal)",
    "ajeer_monthly_fee": "string (decimal)",
    "updated_at": "string (ISO 8601)"
}
```

Note: `is_teaching`, `ajeer_annual_levy`, and `ajeer_monthly_fee` are returned in responses but omitted from the TDD 6.3.6 response schema. This spec supersedes the TDD for these fields.

### Staff Costs Response Schema

The `/staff-costs` endpoint returns grouped results. Field names align with the TDD 6.3.7 contract:

```json
{
    "data": [
        {
            "group_key": "string (employee name | department | month label)",
            "total_gross_salary": "string (decimal)",
            "total_allowances": "string (decimal)",
            "total_social_charges": "string (decimal)",
            "total_staff_cost": "string (decimal)"
        }
    ],
    "totals": {
        "total_gross_salary": "string (decimal)",
        "total_allowances": "string (decimal)",
        "total_social_charges": "string (decimal)",
        "total_staff_cost": "string (decimal)"
    },
    "breakdown": "array|null (employee-level monthly detail when include_breakdown=true)"
}
```

### Error Codes

| Status | Code                         | Condition                                                |
| ------ | ---------------------------- | -------------------------------------------------------- |
| 400    | VALIDATION_ERROR             | Missing or invalid fields                                |
| 404    | EMPLOYEE_NOT_FOUND           | No employee with this ID in this version                 |
| 404    | VERSION_NOT_FOUND            | Version does not exist                                   |
| 409    | DUPLICATE_EMPLOYEE_CODE      | Employee code already exists in this version             |
| 409    | OPTIMISTIC_LOCK              | Record modified by another user (If-Match mismatch)      |
| 409    | VERSION_LOCKED               | Version is Locked or Archived                            |
| 409    | VERSION_DATA_SOURCE_MISMATCH | Version uses imported data (Actual)                      |
| 409    | STALE_DATA                   | Staffing not recalculated since last input change        |
| 422    | MISSING_PREREQUISITES        | Enrollment data not entered or no employee records exist |

## UI/UX Specification

> Source: `docs/ui-ux-spec/05-staffing-costs.md` | Cross-cutting: `00-global-framework.md`, `00b-workspace-philosophy.md`, `10-input-management.md`

### Shell & Layout

**Shell:** PlanningShell (context bar + docked right panel). Sidebar entry: "Staffing & Staff Costs" under Planning group.

**Tab structure:** Top-level `<Tabs>` (shadcn/ui) with three tabs:

| Tab   | Label               | Description                                                                        |
| ----- | ------------------- | ---------------------------------------------------------------------------------- |
| Tab A | DHG & Staffing      | DHG grille view, FTE requirements, section counts                                  |
| Tab B | Staff Costs         | Employee roster grouped by department with salary/charge columns                   |
| Tab C | Monthly Cost Budget | 12-month cost grid with hierarchical category rows (FR-STC-012 through FR-STC-019) |

```
+--------+--------------------------------------------+------------------+
|        |  Context Bar (56px)                        |                  |
|        +--------------------------------------------+                  |
| Side-  |  Module Toolbar (48px)                     |  Right Panel     |
| bar    +--------------------------------------------+  (380px, docked) |
|        |  [DHG & Staffing] [Staff Costs] [Monthly]  |                  |
|        +--------------------------------------------+  - Details tab   |
|        |                                            |  - Form tab      |
|        |  Tab Content Area                          |  - Activity tab  |
|        |  (PlanningGrid / Results Table)            |                  |
|        |                                            |                  |
+--------+--------------------------------------------+------------------+
```

**Tab C — Monthly Cost Budget** (per UI/UX spec §7): A read-only 12-month cost grid with hierarchical rows:

| Level | Row                                   | Source                                                          |
| ----- | ------------------------------------- | --------------------------------------------------------------- |
| 1     | Local Staff Salaries                  | Aggregated from monthly_staff_costs                             |
| 2     | Existing Staff                        | Filtered by status=Existing                                     |
| 2     | New Staff                             | Filtered by status=New (0 for Jan-Aug, calculated Sep-Dec)      |
| 1     | GOSI                                  | Sum of gosi_amount per month                                    |
| 1     | Ajeer                                 | Sum of ajeer_amount per month                                   |
| 1     | EoS Accrual                           | Sum of eos_monthly_accrual per month                            |
| —     | **Subtotal Local Staff**              | Sum of above rows                                               |
| 1     | Contrats Locaux                       | **Deferred** — see Out of Scope                                 |
| 2     | Remplacements (FR-STC-015)            | **Deferred**                                                    |
| 2     | 1% Formation Continue (FR-STC-016)    | **Deferred**                                                    |
| 1     | Residents                             | **Deferred** — see Out of Scope                                 |
| 2     | Salaires (FR-STC-017)                 | **Deferred**                                                    |
| 2     | Logement & Billets Avion (FR-STC-018) | **Deferred**                                                    |
| —     | **GRAND TOTAL** (FR-STC-019)          | Subtotal Local Staff only (until deferred rows are implemented) |

The September column header includes an amber triangle indicator + tooltip: "New positions start September" (FR-STC-012). Period filter (AY1/AY2/Summer/Full Year) hides non-applicable months per UI/UX spec §7.5.

### Key Components

| Component                 | Type                             | Source                    | Notes                                                                             |
| ------------------------- | -------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `<StaffingWorkspace>`     | Custom page                      | 05-staffing-costs.md §2   | Tab container with 3 tabs                                                         |
| `<DhgGrilleGrid>`         | TanStack Table v8                | 05-staffing-costs.md §3.1 | Read-only DHG grille display (hours per grade/subject)                            |
| `<DhgRequirementsGrid>`   | TanStack Table v8                | 05-staffing-costs.md §3.2 | FTE requirements per grade (sections, hours, FTE)                                 |
| `<EmployeeGrid>`          | TanStack Table v8 (PlanningGrid) | 05-staffing-costs.md §3.3 | Editable employee roster with inline editing                                      |
| `<EmployeeForm>`          | React Hook Form + shadcn/ui      | 05-staffing-costs.md §3.4 | Create/edit form in right panel (18+ fields)                                      |
| `<EmployeeImportDialog>`  | shadcn/ui Dialog                 | 05-staffing-costs.md §3.5 | Two-phase xlsx upload wizard                                                      |
| `<MonthlyCostBudgetGrid>` | TanStack Table v8                | 05-staffing-costs.md §7   | Read-only 12-month cost grid with hierarchical rows, Sep indicator, period filter |
| `<StaffingSummaryCards>`  | Custom cards                     | 05-staffing-costs.md §10  | Department FTE/cost KPIs in toolbar area                                          |
| `<CalculateButton>`       | shadcn/ui Button                 | Global Framework §4.1     | Triggers staffing calculation with loading state                                  |

### User Flows

1. **View DHG Requirements:** User navigates to Staffing > DHG & Staffing tab -> reads grille config and FTE requirements per grade. Read-only grid.
2. **Manage Employees:** User navigates to Staff Costs tab -> views employee roster -> clicks "Add Employee" -> right panel form opens -> fills 18+ fields -> saves -> toast confirmation -> grid updates.
3. **Edit Employee Inline:** User double-clicks editable cell in employee grid -> edits value -> auto-save on blur -> STAFFING stale flag set.
4. **Import Employees:** User clicks "Import" in toolbar -> dialog opens -> uploads xlsx -> validation preview shown -> reviews errors/duplicates -> clicks "Commit" -> employees imported.
5. **Calculate Staffing:** User clicks "Calculate" in toolbar -> spinner shows -> DHG + Staff Cost engines run -> results populate result tabs -> stale flag cleared.
6. **View Staff Costs:** User navigates to Staff Costs tab -> selects grouping (employee/department/month) -> views monthly cost breakdown with gross, GOSI, Ajeer, EoS columns.

### Interaction Patterns

- **Inline editing** on employee grid (Tab B) for all fields including salary. Salary fields are editable inline per UI/UX spec §5.3 (all columns marked Editable=Yes). Viewer role sees `--` (masked) for all encrypted fields.
- **Keyboard navigation:** Arrow keys between cells, Enter to edit, Escape to cancel, Tab to move to next editable cell. Space/Enter on department group row to expand/collapse. Arrow Right/Left to expand/collapse.
- **Cell highlighting:** Editable cells with `--cell-editable-bg` (yellow-50), read-only with `--cell-readonly-bg` (slate-50), modified-unsaved with amber border per `10-input-management.md`.
- **Salary field masking:** Viewer role sees `--` (centered, `--text-muted`) instead of salary values. Non-viewer roles see decrypted values.
- **Monthly Cost Budget (Tab C):** Read-only grid. No inline editing. September column has amber background at 30% opacity. Period filter hides non-applicable months.
- **Stale banner:** When STAFFING is in `staleModules`, a warning banner appears: "Staffing data is out of date. Click Calculate to refresh."

### Accessibility Requirements

- All grids use `role="grid"` for editable tables, `role="table"` for read-only results.
- Employee form fields have associated `<label>` elements and `aria-describedby` for validation errors.
- Import dialog follows focus trap pattern (`role="dialog"`, `aria-modal="true"`).
- Salary-redacted cells announce "Restricted" to screen readers via `aria-label`.
- Keyboard shortcut `Ctrl+Shift+S` opens the staffing module (announced via `aria-keyshortcuts`).
- All color indicators (stale warning, validation errors) meet WCAG AA contrast ratios (4.5:1 text, 3:1 UI components).

### Responsive / Viewport

> BudFin targets desktop (1280px min). The employee grid uses horizontal scrolling for the 18+ column layout. Right panel collapses to overlay at viewports < 1440px. Tab content fills available width minus sidebar and right panel.

## UI Compliance (required for all stories with frontend changes)

Read before implementing any new screen:

- `docs/ui-ux-spec/00-global-framework.md` — tokens, shells, shared components
- `docs/ui-ux-spec/00b-workspace-philosophy.md` — two-shell architecture, progressive disclosure
- `docs/ui-ux-spec/05-staffing-costs.md` — module-specific layout, columns, interactions

Acceptance criteria:

- [ ] All interactive elements use shadcn/ui primitives from `apps/web/src/components/ui/`
- [ ] Design tokens used (`var(--token)`) — no arbitrary hex colors
- [ ] Mutation feedback via `toast` — no inline div status messages
- [ ] Async states via `Skeleton` / `TableSkeleton` — no plain "Loading..." text
- [ ] Table ARIA: `role="table"` (read-only) or `role="grid"` (inline-editable only)

## Edge Cases Cross-Reference

From `docs/edge-cases/budfin_edge_case_analysis.md`:

| Case ID | Description                                       | Handling                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SA-001  | IEEE 754 Precision Loss in Revenue Chain          | All monetary arithmetic uses `Decimal.js`. Salary fields stored as `DECIMAL(15,4)`. JSON serialization as strings. TC-001 enforced in every calculation function.                                                                                                                                                                                                             |
| SA-002  | YEARFRAC Implementation & EoS Rounding            | Custom YEARFRAC US 30/360 implementation validated against Excel output. Day-31 adjustment: `if (day1 === 31) day1 = 30; if (day2 === 31 && day1 >= 30) day2 = 30`. EoS uses full Decimal.js precision; round only at presentation.                                                                                                                                           |
| SA-003  | Division-by-Zero in FTE with Zero Enrollment      | `calculateSectionsNeeded(0, maxClassSize)` returns 0. FTE calculation guards against zero sections — no division by zero since the divisor (18 ORS) is a constant.                                                                                                                                                                                                            |
| SA-004  | YEARFRAC Leap Year Boundary                       | US 30/360 convention ignores actual calendar days; uses 360-day year. Leap years do not affect the calculation. Test suite includes Feb 28/29 boundary cases.                                                                                                                                                                                                                 |
| SA-007  | HSA Seasonal Exclusion Edge Case                  | Teaching staff HSA set to 0 for months 7-8 only. Non-teaching staff unaffected. Edge: employee with `is_teaching` changed mid-year — recalculation uses current flag for all 12 months (no partial-year tracking in v1).                                                                                                                                                      |
| SA-011  | Circular Dependencies: FTE <-> Staff Cost         | No circular dependency: DHG Engine computes FTE from enrollment (input), Staff Cost Engine computes costs from employee records (input). They share no mutual dependencies. Both are triggered sequentially by the `/calculate/staffing` endpoint.                                                                                                                            |
| SA-018  | Recalculation Cascade on Enrollment Change        | Enrollment changes set ENROLLMENT stale. Staffing calculation has ENROLLMENT as prerequisite — if stale, returns 422 MISSING_PREREQUISITES prompting user to recalculate enrollment first.                                                                                                                                                                                    |
| SA-005  | CEILING Rounding at Section Boundary              | `CEILING(headcount / max_class_size)` is used for section calculation. Since enrollment headcount is always a non-negative integer and max_class_size is always a positive integer, the CEILING operation is well-defined. Edge case: headcount exactly divisible by max_class_size produces no rounding. Test suite covers boundary values (e.g., 30/30=1, 31/30=2, 0/30=0). |
| SA-015  | Auto-Save Conflict During User Edit               | Employee grid inline editing uses auto-save on blur. Concurrent edits are protected by optimistic locking via `If-Match` header (AC-03). If another user modifies the same record, the save fails with 409 OPTIMISTIC_LOCK and a toast notifies the user to reload. The grid cell reverts to its pre-edit value.                                                              |
| SA-021  | Dirty Excel Data: Formula Errors & Missing Values | The xlsx import validator (AC-06) detects: missing required fields (error), formula error cells (#REF!, #VALUE!, #N/A treated as empty — error if required), non-numeric salary values (error), invalid date formats (error), and encoding issues. The two-phase workflow ensures no dirty data reaches the database.                                                         |
| SA-025  | Bulk Operations — 168 Employees Updated at Once   | Employee import uses a Prisma transaction for atomicity. Audit logger captures bulk operations as individual entries per record (not a single bulk entry). Performance target: < 5s for 168 records.                                                                                                                                                                          |

## Out of Scope

- **Scenario-specific staffing calculations** — Staffing uses Base scenario only in v1. Scenario modeling (Epic 6) will add Optimistic/Pessimistic overrides later.
- **Part-time FTE adjustments** — The `hourly_percentage` field is stored but not used in DHG FTE calculations in v1. FTE is computed purely from grille hours / ORS divisor.
- **Employee self-service** — No employee-facing portal. All data entry is by Finance/HR staff.
- **Historical EoS provision tracking** — Only current-period EoS is calculated. Year-over-year EoS comparison is deferred to Epic 5 (P&L Reporting).
- **Real-time salary decryption in audit trail** — Audit entries store encrypted salary values. A dedicated audit viewer with decryption is deferred to Epic 8 (Audit Trail).
- **DHG grille editing UI** — The DHG grille config is seeded/managed via admin tools or direct DB insert in v1. A UI for editing grille configurations is deferred.
- **Contrats Locaux rows (FR-STC-015, FR-STC-016)** — The Monthly Cost Budget tab will show "Remplacements" and "1% Formation Continue" rows as placeholders with zero values. These require a separate input form and data model for non-employee cost items, deferred to a future iteration. The rows render in the grid hierarchy but are not editable or calculated.
- **Residents rows (FR-STC-017, FR-STC-018)** — The Monthly Cost Budget tab will show "Salaires Residents" and "Logement & Billets Avion" rows as placeholders with zero values. These represent a distinct cost category (resident/expatriate staff) requiring a separate data model, deferred to a future iteration.
- **Export (xlsx/PDF)** — Staff cost export functionality is deferred to Epic 9 (Dashboard) which handles all cross-module exports.

## Open Questions

(none — all resolved)

## Planner Agent Sign-Off

- [x] No open questions
- [x] Acceptance criteria are testable
- [x] Edge cases cross-referenced
- [x] Data model complete
- [x] API contract complete
- [x] UI/UX specification complete
