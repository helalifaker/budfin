# Technical Requirements and Scope Assumptions

## BudFin -- School Financial Planning Workspace (EFIR)

| Field | Value |
| --- | --- |
| Parent Document | BudFin PRD v1.1 |
| Section Reference | PRD Sections 4, 9, 10, 11 |
| Date | March 3, 2026 |
| Status | Draft |

---

## 1. Scope Assumptions

The following assumptions constrain the design and implementation of BudFin v1. Any deviation from these assumptions triggers the Change Control Process (Section 2).

| ID | Assumption | Value | Rationale |
| --- | --- | --- | --- |
| SA-001 | Currency | SAR (Saudi Riyal) only. Multi-currency support is out of scope for v1. All monetary values are denominated in SAR. No exchange rate tables, currency conversion logic, or multi-currency ledger entries are required. | EFIR operates exclusively in Saudi Arabia with SAR-denominated tuition, salaries, and statutory obligations. |
| SA-002 | UI Language | English only for v1. French and Arabic localization (including RTL layout support) are deferred to v2. All UI labels, validation messages, error text, report headers, and help content are in English. Domain-specific French terms (e.g., grade names like "Terminale", cost lines like "Contrats Locaux Remplacements") are preserved as-is since they are proper nouns within the EFIR context. | Reduces v1 scope while preserving domain terminology that the finance team already uses in English/French. |
| SA-003 | Timezone | Arabia Standard Time (AST, UTC+3) for all timestamps, date calculations, and date display. No daylight saving time adjustments (Saudi Arabia does not observe DST). All server-side timestamps stored in UTC and converted to AST for display. YEARFRAC and date arithmetic use AST-anchored dates. | EFIR is located in Riyadh, Saudi Arabia. Single-timezone simplifies date logic. |
| SA-004 | Concurrent Users | Maximum ~20 concurrent users (single school finance team). No requirement for horizontal scaling, connection pooling beyond default limits, or real-time collaborative editing. Optimistic locking is sufficient for conflict resolution. | PRD Section 5 defines four personas (Budget Owner, Budget Analyst, HR/Payroll Coordinator, School Administrator) within a single school's finance and administrative staff. |
| SA-005 | Fiscal Years Supported | Maximum 10 fiscal years of active data (current year + 9 historical years). Fiscal years beyond the 10-year window must be archived per the version archival policy. Archived data remains queryable for read-only access but is excluded from active calculations and version comparison. | 10 years provides sufficient historical depth for trend analysis (PRD FR-ENR-001 requires 5+ years) while keeping database size manageable. |
| SA-006 | Deployment Model | Single-school, single-tenant deployment. No multi-entity consolidation, no shared infrastructure between schools, no tenant isolation logic. One database instance serves one EFIR installation. | PRD Section 4.1 explicitly scopes to "single-school deployment for EFIR." Section 4.2 defers multi-school consolidation to a future version. |
| SA-007 | Browser Support | Modern evergreen browsers: Chrome, Edge, Firefox, and Safari (latest 2 major versions at time of release). No support for Internet Explorer, legacy Edge (EdgeHTML), or mobile browsers. Progressive Web App (PWA) capabilities are not required. | Standard office environment with managed workstations. Evergreen browsers ensure access to modern JavaScript APIs (ES2022+), CSS Grid/Flexbox, and Web APIs required for keyboard-driven data grids. |
| SA-008 | Network Requirements | Standard office LAN/WiFi connectivity assumed. No offline mode, no service worker caching for offline use, no conflict resolution for offline-to-online sync. Application requires active network connection for all operations. Minimum expected bandwidth: 10 Mbps. | EFIR operates from a single physical campus with reliable office network infrastructure. Offline scenarios are not part of the daily finance workflow. |
| SA-009 | Data Volume | Approximately 1,500 students, 168 employees, 31 sheets across 4 Excel workbooks, 5 enrollment CSV files. Fee grid contains ~45+ combinations (15 grades x 3 nationalities x 3 tariffs, for 2 academic periods). Monthly budget grid produces 12 x 168 = ~2,016 employee-month records per fiscal year. Total active data fits comfortably within a single PostgreSQL/MySQL instance without partitioning or sharding. | Derived from actual EFIR data: enrollment CSVs (2021-22 through 2025-26), Revenue workbook (12 sheets), DHG workbook (9 sheets), Staff Costs workbook (8 sheets), Consolidated workbook (2 sheets). |

---

## 2. Change Control Process

All changes to requirements after the scope freeze date (Section 3) must follow this five-step process. The process applies to functional requirements (FR-*), non-functional requirements (NFR), scope assumptions (SA-*), and technology constraints (TC-*).

### Step 1: Change Request Submission

The requester submits a formal change request using the following template:

| Field | Description |
| --- | --- |
| CR Number | Auto-assigned sequential identifier (CR-001, CR-002, ...) |
| Requester | Name and role of the person requesting the change |
| Date Submitted | Date the change request was filed |
| Description | Clear description of what needs to change |
| Justification | Business or technical reason for the change |
| Affected FRs | List of functional requirement IDs impacted (e.g., FR-REV-011, FR-STC-009) |
| Affected Sections | PRD sections that would need revision |
| Estimated Impact | Requester's initial assessment: Low / Medium / High |

### Step 2: Impact Assessment (Tech Lead)

The Tech Lead performs a formal impact assessment within 3 business days of submission:

- **Effort estimate**: Story points or person-days required to implement
- **Risk assessment**: Impact on existing functionality, data integrity, and calculation accuracy
- **Timeline impact**: Effect on current sprint and overall delivery schedule
- **Dependency analysis**: Other FRs or modules affected by the change
- **Testing impact**: Additional test cases or regression testing required

### Step 3: Approval

Approval authority depends on the MoSCoW priority of the affected requirements:

| Affected Priority | Approval Authority | SLA |
| --- | --- | --- |
| [MUST] requirements | CAO (Chief Accounting Officer) approval required | 5 business days |
| [SHOULD] requirements | Project Manager approval sufficient | 3 business days |
| [COULD] requirements | Project Manager approval sufficient | 3 business days |
| New requirements (not in PRD) | CAO approval required | 5 business days |

### Step 4: Implementation

Upon approval:

1. Approved change is assigned to the next available sprint backlog
2. FR references in the PRD are updated to reflect the change
3. Implementation follows standard development workflow (branch, develop, test, review, merge)
4. Regression tests are executed for all affected modules
5. Calculation validation against Excel baselines is re-run if the change affects any calculation engine

### Step 5: Documentation

All approved changes are reflected in the PRD with:

- PRD version number incremented (e.g., v1.1 to v1.2)
- Change log entry added to the Decision Log (Section 19)
- Affected FR text updated in-place with a revision marker
- Impact assessment and approval record archived in project documentation

---

## 3. Scope Freeze Date

> **PRD v2.0 represents the frozen baseline.** After the scope freeze, all changes to functional requirements, non-functional requirements, scope assumptions, and technology constraints must follow the Change Control Process defined in Section 2. No exceptions.

Changes submitted after the scope freeze are evaluated against the current sprint plan. Emergency changes (e.g., regulatory compliance, data integrity issues) may be fast-tracked with CAO approval but still require formal documentation.

---

## 4. Technology Constraints

The following constraints are mandatory for any technology selection. They document hard requirements that the implementation must satisfy regardless of the specific technology stack chosen. Final technology decisions (frameworks, databases, hosting) are made in the Technical Design Document (Phase 3 of the Planning Process).

### TC-001: Fixed-Point Decimal Arithmetic

**Constraint:** All financial calculations must use fixed-point decimal arithmetic, not IEEE 754 binary floating-point. This is required to meet the +/-1 SAR tolerance specified in PRD Section 16.1 (acceptance criteria 1-3).

**Rationale:** IEEE 754 floating-point cannot exactly represent many decimal fractions (e.g., 0.1, 0.01). In a system performing thousands of multiply-accumulate operations across 168 employees, 12 months, and multiple fee grid combinations, floating-point rounding errors accumulate and can exceed the 1 SAR tolerance.

**Implementation guidance:**

- If using JavaScript/TypeScript: use a decimal library (e.g., `decimal.js`, `big.js`, or `Prisma Decimal`) -- never use native `Number` for monetary values.
- If using Python: use the `decimal.Decimal` module with explicit precision context, not `float`.
- If using Java/Kotlin: use `BigDecimal` with `HALF_UP` rounding mode.
- Database layer must use `DECIMAL` column types (see TC-003).
- All intermediate calculation results must maintain full precision; rounding occurs only at presentation (see TC-004).

### TC-002: YEARFRAC Implementation

**Constraint:** The system must implement a YEARFRAC function that matches Excel's `YEARFRAC(start_date, end_date, basis)` output for the US 30/360 convention (basis = 0), which is the default used in EFIR's End of Service calculations.

**Algorithm (US 30/360 basis):**

```
Given start_date (d1/m1/y1) and end_date (d2/m2/y2):

1. If d1 == 31, set d1 = 30
2. If d2 == 31 AND d1 >= 30, set d2 = 30
3. YEARFRAC = ((y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1)) / 360
```

**Validation:** The implementation must produce identical results to Excel's `YEARFRAC` function for all 168 employees' joining dates against the as-of dates (Dec 31 of prior year and Dec 31 of current year). Any discrepancy exceeding 0.001 years triggers a bug report.

**Context:** YEARFRAC is used in the End of Service provision formula (PRD Section 10.3) to compute fractional years of service, which determines whether the 0.5-month or 1-month accrual rate applies and the exact provision amount.

### TC-003: Database Decimal Precision

**Constraint:** The database must support `DECIMAL` (or equivalent fixed-point) column types with the following minimum precision:

| Data Category | Column Type | Example Fields |
| --- | --- | --- |
| Monetary values (SAR) | `DECIMAL(15,4)` | `base_salary`, `tuition_ttc`, `revenue_amount`, `eos_provision` |
| Percentage rates | `DECIMAL(7,6)` | `discount_rate`, `vat_rate`, `gosi_rate` |
| Headcount / counts | `INT` or `DECIMAL(10,0)` | `student_count`, `sections_needed`, `headcount` |
| Years of service | `DECIMAL(7,4)` | `years_of_service` (computed via YEARFRAC) |
| Hourly percentage | `DECIMAL(5,4)` | `hourly_percentage` (part-time factor, e.g., 0.5000 for half-time) |

**Rationale:** `DECIMAL(15,4)` supports values up to 99,999,999,999.9999 SAR with 4 decimal places of precision, which accommodates EFIR's total annual revenue (~42M SAR) and all intermediate calculations with room for growth. Percentage rates use `DECIMAL(7,6)` to support rates like 0.117500 (11.75% GOSI) without truncation.

### TC-004: Rounding Rules

**Constraint:** Round half-up (standard arithmetic rounding) at the presentation layer only. Banker's rounding (round half-to-even) is NOT used.

**Rules:**

1. **Intermediate calculations**: Maintain full precision (minimum 4 decimal places) throughout the calculation chain. No rounding between calculation steps.
2. **Presentation/display**: Round to 2 decimal places (SAR with fils) for all displayed monetary values. Use round half-up: values ending in exactly .5 round away from zero (e.g., 2.5 rounds to 3, -2.5 rounds to -3).
3. **Storage**: Store values at full precision (`DECIMAL(15,4)`) in the database. Rounding is applied only when rendering values in the UI or export files.
4. **Summation**: Sum the full-precision values first, then round the total for display. Do NOT sum pre-rounded values (this prevents rounding drift in large aggregations).
5. **Tolerance validation**: After rounding, all displayed totals must match the Excel baseline within +/-1 SAR per line item per month (PRD Section 16.1).

### TC-005: Date Arithmetic and Calendar

**Constraint:** All date arithmetic uses the Gregorian calendar exclusively. The Hijri (Islamic) calendar is not used for any calculation, scheduling, or date display in v1.

**Rules:**

1. **Timezone**: All dates and timestamps are anchored to AST (UTC+3). See Scope Assumption SA-003.
2. **Fiscal year**: January 1 through December 31 (Gregorian). PRD field: "Fiscal Year Scope: FY2026 (Jan-Dec 2026)."
3. **Academic periods**: AY1 = January through June (6 months), Summer = July through August (2 months, zero revenue/zero HSA), AY2 = September through December (4 months). These boundaries are hardcoded for v1 but should be stored as configurable parameters for future flexibility.
4. **Month boundaries**: Calendar month boundaries (1st through last day of month) determine when salary step-changes take effect (e.g., new positions start September 1, augmentations apply from September 1).
5. **YEARFRAC dates**: All YEARFRAC calculations use Gregorian dates with the US 30/360 convention (see TC-002).
6. **Week count**: DHG annual hours use 36 academic weeks per year (PRD FR-DHG-015). This is a configurable parameter, not derived from calendar dates.

---

## 5. Data Dictionary

The following data dictionary defines the five most critical entities in the BudFin system. Field definitions include SQL-style types with precision, constraints, and descriptions. The complete database schema is delivered in the Technical Design Document.

### 5.1 Employee

Represents a staff member (teaching or non-teaching) at EFIR. Source: Staff Master Data sheet (168 records in FY2026).

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `employee_id` | `INT` | `PRIMARY KEY, AUTO_INCREMENT` | Unique employee identifier. |
| `version_id` | `INT` | `FOREIGN KEY -> budget_versions.version_id, NOT NULL` | Budget version this employee record belongs to. Each version carries its own snapshot of employee data. |
| `name` | `VARCHAR(200)` | `NOT NULL` | Full name of the employee. |
| `function_role` | `VARCHAR(100)` | `NOT NULL` | Job title or function (e.g., "Professeur des ecoles", "Directeur adjoint", "ASEM"). |
| `department` | `ENUM('Maternelle', 'Elementaire', 'College', 'Lycee', 'Administration', 'Vie Scolaire & Support')` | `NOT NULL` | Organizational department assignment per PRD FR-STC-003. |
| `status` | `ENUM('Existing', 'New', 'Departed')` | `NOT NULL, DEFAULT 'Existing'` | Employment status. "Existing" = carrying over from prior year. "New" = starting September of current FY. "Departed" = no longer active. |
| `joining_date` | `DATE` | `NOT NULL` | Date the employee joined EFIR. Used in YEARFRAC calculation for End of Service provision (TC-002). |
| `years_of_service` | `DECIMAL(7,4)` | `COMPUTED` | Fractional years of service = YEARFRAC(joining_date, as_of_date). Not stored; computed at query/calculation time. |
| `payment_method` | `VARCHAR(50)` | `NOT NULL` | Payment method (e.g., "Bank Transfer", "Cash"). |
| `is_saudi` | `BOOLEAN` | `NOT NULL, DEFAULT FALSE` | Whether the employee is a Saudi national. Determines GOSI applicability (FR-STC-009). |
| `is_ajeer` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Whether the employee is registered under the Ajeer program. All non-Saudi employees are Ajeer (FR-STC-010). |
| `hourly_percentage` | `DECIMAL(5,4)` | `NOT NULL, DEFAULT 1.0000, CHECK (hourly_percentage > 0 AND hourly_percentage <= 1)` | Part-time adjustment factor. 1.0000 = full-time. Values < 1 apply pro-rata to gross salary (FR-STC-008). |
| `base_salary` | `DECIMAL(15,4)` | `NOT NULL, CHECK (base_salary >= 0)` | Core monthly salary in SAR. |
| `housing_allowance` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0, CHECK (housing_allowance >= 0)` | Monthly housing allowance (Indemnite Logement) in SAR. Included in EoS base. |
| `transport_allowance` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0, CHECK (transport_allowance >= 0)` | Monthly transport allowance (Indemnite Transport) in SAR. Included in EoS base. |
| `responsibility_premium` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0, CHECK (responsibility_premium >= 0)` | Monthly responsibility premium in SAR for leadership roles. Zero for most staff. Included in EoS base. |
| `hsa_amount` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0, CHECK (hsa_amount >= 0)` | Monthly HSA (Heures Supplementaires Annuelles) amount in SAR. Paid on 10-month basis; excluded during Jul-Aug (FR-STC-007). NOT included in EoS base. |
| `augmentation` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0` | Salary augmentation amount in SAR, applied from September onward (FR-STC-006). |
| `augmentation_effective_date` | `DATE` | `NULL` | Date the augmentation takes effect. NULL if no augmentation. Typically September 1 of the fiscal year. |

### 5.2 Fee Grid Entry

Represents a single fee combination in the tuition fee grid. Source: FEE_GRID sheet (~45+ combinations per academic period).

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `fee_grid_id` | `INT` | `PRIMARY KEY, AUTO_INCREMENT` | Unique fee grid entry identifier. |
| `version_id` | `INT` | `FOREIGN KEY -> budget_versions.version_id, NOT NULL` | Budget version this fee grid belongs to. Each version carries its own fee grid snapshot (FR-REV-004). |
| `academic_period` | `ENUM('AY1', 'AY2')` | `NOT NULL` | Academic period: AY1 (Jan-Jun) or AY2 (Sep-Dec). Separate fee grids per period (FR-REV-005). |
| `grade_level` | `ENUM('PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'Terminale')` | `NOT NULL` | Grade level per Appendix A. |
| `nationality` | `ENUM('Francais', 'Nationaux', 'Autres')` | `NOT NULL` | Nationality segment. "Nationaux" (Saudi nationals) are VAT-exempt (FR-REV-006). |
| `tariff` | `ENUM('RP', 'R3+', 'Plein')` | `NOT NULL` | Tariff category: RP (staff children), R3+ (3+ siblings), Plein (full price) per FR-REV-007. |
| `tuition_ttc` | `DECIMAL(15,4)` | `NOT NULL, CHECK (tuition_ttc >= 0)` | Annual tuition fee including VAT (Toutes Taxes Comprises) in SAR. |
| `tuition_ht` | `DECIMAL(15,4)` | `COMPUTED` | Annual tuition fee excluding VAT: `tuition_ttc / (1 + vat_rate)`. For Nationaux, vat_rate = 0 so tuition_ht = tuition_ttc (FR-REV-003, FR-REV-006). |
| `dai` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0, CHECK (dai >= 0)` | Annual registration fee (Droit Annuel d'Inscription) in SAR. |
| `t1` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0, CHECK (t1 >= 0)` | Term 1 installment amount in SAR. |
| `t2` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0, CHECK (t2 >= 0)` | Term 2 installment amount in SAR. |
| `t3` | `DECIMAL(15,4)` | `NOT NULL, DEFAULT 0, CHECK (t3 >= 0)` | Term 3 installment amount in SAR. |
| | | `UNIQUE (version_id, academic_period, grade_level, nationality, tariff)` | Composite unique constraint ensures no duplicate fee combinations within a version and period. |

### 5.3 Budget Version

Represents a named budget version with lifecycle state. Source: Version Management System (PRD Section 7).

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `version_id` | `INT` | `PRIMARY KEY, AUTO_INCREMENT` | Unique version identifier. |
| `name` | `VARCHAR(100)` | `NOT NULL` | User-assigned version name (e.g., "FY2026 Budget v1", "FC2 March Reforecast"). |
| `type` | `ENUM('Actual', 'Budget', 'Forecast')` | `NOT NULL` | Version type per PRD Section 7.1. Determines editability rules and color badge. |
| `status` | `ENUM('Draft', 'Published', 'Locked', 'Archived')` | `NOT NULL, DEFAULT 'Draft'` | Lifecycle status per PRD Section 7.2. Transitions: Draft -> Published -> Locked -> Archived. Reverse transitions require authorized user + audit note (FR-VER-003). |
| `fiscal_year` | `INT` | `NOT NULL, CHECK (fiscal_year >= 2020 AND fiscal_year <= 2040)` | Fiscal year this version covers (e.g., 2026). |
| `created_by` | `INT` | `FOREIGN KEY -> users.user_id, NOT NULL` | User who created this version. |
| `created_at` | `TIMESTAMP` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | Creation timestamp in UTC. Displayed in AST per SA-003. |
| `last_modified_at` | `TIMESTAMP` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE` | Last modification timestamp. Updated on any data change within this version. |
| `locked_at` | `TIMESTAMP` | `NULL` | Timestamp when the version was locked. NULL if not yet locked. |
| `locked_by` | `INT` | `FOREIGN KEY -> users.user_id, NULL` | User who locked this version. NULL if not yet locked. |
| `description` | `TEXT` | `NULL` | Optional description or notes about this version (FR-VER-006). |
| `source_version_id` | `INT` | `FOREIGN KEY -> budget_versions.version_id, NULL` | If this version was cloned from another version (FR-VER-005), references the source. NULL for original versions. |

### 5.4 Monthly Revenue

Represents calculated monthly revenue for a specific enrollment cohort. Source: REVENUE_ENGINE sheet output.

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `revenue_id` | `INT` | `PRIMARY KEY, AUTO_INCREMENT` | Unique revenue record identifier. |
| `version_id` | `INT` | `FOREIGN KEY -> budget_versions.version_id, NOT NULL` | Budget version this revenue record belongs to. |
| `month` | `INT` | `NOT NULL, CHECK (month >= 1 AND month <= 12)` | Calendar month (1 = January, 12 = December). Jul (7) and Aug (8) have zero tuition revenue. |
| `academic_period` | `ENUM('AY1', 'AY2', 'Summer')` | `NOT NULL` | Academic period: AY1 (months 1-6), Summer (months 7-8), AY2 (months 9-12). |
| `grade_level` | `ENUM('PS', 'MS', 'GS', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6eme', '5eme', '4eme', '3eme', '2nde', '1ere', 'Terminale')` | `NOT NULL` | Grade level. |
| `nationality` | `ENUM('Francais', 'Nationaux', 'Autres')` | `NOT NULL` | Nationality segment. |
| `tariff` | `ENUM('RP', 'R3+', 'Plein')` | `NOT NULL` | Tariff category. |
| `headcount` | `INT` | `NOT NULL, CHECK (headcount >= 0)` | Number of students in this cohort for this month. |
| `gross_fee` | `DECIMAL(15,4)` | `NOT NULL, CHECK (gross_fee >= 0)` | Gross annual fee from the fee grid (before discount) in SAR. |
| `discount_rate` | `DECIMAL(7,6)` | `NOT NULL, DEFAULT 0, CHECK (discount_rate >= 0 AND discount_rate <= 1)` | Applicable discount rate as a decimal (e.g., 0.250000 for 25% discount). 0 for Plein tariff. |
| `net_fee` | `DECIMAL(15,4)` | `NOT NULL, CHECK (net_fee >= 0)` | Net annual fee after discount: `gross_fee * (1 - discount_rate)`. |
| `revenue_amount` | `DECIMAL(15,4)` | `NOT NULL` | Monthly revenue for this cohort: `headcount * net_fee / period_months`. Period months: 6 for AY1, 4 for AY2, 0 for Summer. |
| `ifrs_category` | `VARCHAR(50)` | `NOT NULL` | IFRS 15 revenue classification (e.g., "Tuition Fees", "Registration & Miscellaneous", "Other Revenue") per FR-REV-013. |
| | | `UNIQUE (version_id, month, grade_level, nationality, tariff)` | Composite unique constraint prevents duplicate revenue entries within a version-month-cohort combination. |

### 5.5 Audit Entry

Records every data modification in the system. Source: PRD Section 8.7 (FR-AUD-001, FR-AUD-002).

| Field | Type | Constraints | Description |
| --- | --- | --- | --- |
| `audit_id` | `BIGINT` | `PRIMARY KEY, AUTO_INCREMENT` | Unique audit entry identifier. BIGINT to accommodate high-volume logging over 7+ year retention (PRD NFR). |
| `timestamp` | `TIMESTAMP` | `NOT NULL, DEFAULT CURRENT_TIMESTAMP` | When the change occurred, stored in UTC. Displayed in AST per SA-003. |
| `user_id` | `INT` | `FOREIGN KEY -> users.user_id, NOT NULL` | User who made the change. |
| `action_type` | `ENUM('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'IMPORT', 'CALCULATE')` | `NOT NULL` | Type of action performed. STATUS_CHANGE covers version lifecycle transitions (FR-AUD-002). CALCULATE logs calculation engine executions. |
| `entity_type` | `VARCHAR(50)` | `NOT NULL` | Name of the entity/table affected (e.g., "employee", "fee_grid_entry", "budget_version"). |
| `entity_id` | `INT` | `NOT NULL` | Primary key of the affected record. |
| `version_id` | `INT` | `FOREIGN KEY -> budget_versions.version_id, NULL` | Budget version context of the change. NULL for system-level changes (e.g., user management). |
| `field_name` | `VARCHAR(100)` | `NULL` | Specific field that was changed. NULL for INSERT/DELETE actions that affect the entire record. |
| `old_value` | `TEXT` | `NULL` | Previous value of the field, serialized as text. NULL for INSERT actions. |
| `new_value` | `TEXT` | `NULL` | New value of the field, serialized as text. NULL for DELETE actions. |
| `comment` | `TEXT` | `NULL` | Optional user-provided comment explaining the change. Required for version lifecycle transitions (unlock, delete of published/locked versions) per FR-VER-002 and FR-VER-003. |

**Indexing guidance:**

- Index on `(entity_type, entity_id)` for entity-level audit queries.
- Index on `(timestamp)` for date-range filtering (FR-AUD-003).
- Index on `(user_id, timestamp)` for per-user audit trail.
- Index on `(version_id)` for version-scoped audit queries.
- Retention: minimum 7 years per PRD NFR. Consider table partitioning by year for large-scale deployments.

---

## 6. API Contract Guidance

Full API contracts (endpoint specifications, request/response schemas, authentication flows) are deferred to the Technical Design Document (Phase 3 of the Planning Process). This section documents the high-level interface boundaries that the architecture must support.

### 6.1 Frontend-Backend Interface

- **Protocol**: RESTful API over HTTPS with JSON request/response payloads.
- **Authentication**: Token-based authentication (JWT or equivalent). Session state maintained server-side or via secure HTTP-only cookies.
- **Authorization**: Role-based access control (RBAC) with minimum three roles: Admin, Editor, Viewer (PRD NFR).
- **Versioning**: API versioned via URL prefix (e.g., `/api/v1/`) to support future backward-compatible evolution.
- **Error responses**: Structured JSON error objects with error code, human-readable message, and field-level validation details where applicable.

### 6.2 Calculation Engine Interface

- **Execution model**: Server-side calculation, triggered by an explicit "Calculate" button per planning module (PRD Section 12, Decision D-004). Calculations are NOT auto-triggered on data change.
- **Request**: Module identifier + version ID + optional parameters (e.g., scenario selection). The server reads all required inputs from the database.
- **Response**: Calculation status (success/error), summary metrics (e.g., "Total Revenue: 42.3M SAR"), validation warnings, and error details with field-level links.
- **Idempotency**: Repeated calculation requests with unchanged inputs produce identical outputs. The engine reads from the current saved state.
- **Stale state**: The API returns a `stale` flag when module inputs have changed since the last calculation, enabling the frontend to display a stale-data indicator.

### 6.3 Data Import Interface

- **Upload endpoint**: Accepts CSV (`.csv`) and Excel (`.xlsx`) file uploads with multipart form encoding.
- **Validation response**: Synchronous validation that returns row-level errors, warnings, and a summary (total rows, valid rows, error rows) before committing the import.
- **Two-phase import**: Phase 1 = upload + validate (returns preview). Phase 2 = confirm + commit (writes to database). User can cancel after Phase 1 without side effects.
- **File size limit**: Maximum 10 MB per upload (sufficient for all EFIR source files; the largest workbook is under 2 MB).

### 6.4 Export Interface

- **Formats**: Excel (`.xlsx`), PDF, and CSV for all reports and data views (PRD NFR).
- **Generation**: Asynchronous generation for large datasets. The API returns a job ID; the client polls or receives a notification when the file is ready for download.
- **Download**: Temporary signed URL for file download, expiring after 1 hour.
- **Scope**: Exports respect the current context bar state (fiscal year, version, academic period, scenario).

---

## 7. Data Flow Description

This section documents the end-to-end calculation chain that transforms raw input data into financial outputs. Each stage reads from upstream outputs and writes results that downstream stages consume.

### 7.1 Calculation Chain Overview

```
                            +-------------------+
                            |  Enrollment Data  |
                            |  (Headcount by    |
                            |  Grade/Nat/Tariff)|
                            +--------+----------+
                                     |
                      +--------------+--------------+
                      |                             |
                      v                             v
            +---------+----------+      +-----------+---------+
            |   Revenue Engine   |      |     DHG Engine      |
            | Enrollment x Fee   |      | Sections x Grille   |
            | Grid = Monthly     |      | Hours = FTE         |
            | Revenue            |      | Requirements        |
            +--------+-----------+      +-----------+---------+
                     |                              |
                     |                              v
                     |                  +-----------+---------+
                     |                  |  Staff Cost Engine  |
                     |                  | Employees x Salary  |
                     |                  | Components +        |
                     |                  | Statutory Costs     |
                     |                  | = Monthly Staff     |
                     |                  |   Costs             |
                     |                  +-----------+---------+
                     |                              |
                     +---------------+--------------+
                                     |
                                     v
                          +----------+----------+
                          |  P&L Consolidation  |
                          |  Revenue + Staff    |
                          |  Costs + Other =    |
                          |  IFRS Income        |
                          |  Statement          |
                          +---------------------+
```

### 7.2 Stage 1: Enrollment to Revenue

**Input:** Enrollment detail (headcount by grade x nationality x tariff) + fee grid (fees by grade x nationality x tariff x academic period) + discount policies.

**Process:**

1. For each enrollment detail row, look up the matching fee grid entry by `(grade_level, nationality, tariff, academic_period)`.
2. Determine applicable discount rate: RP and R3+ tariffs receive a configured percentage of the Plein rate (default 75%). Plein tariff receives 0% discount. Mutually exclusive -- highest applicable discount only (FR-REV-009).
3. Calculate net fee: `gross_fee * (1 - discount_rate)`.
4. Apply VAT exemption: for Nationaux (Saudi nationals), `vat_rate = 0%`, so `tuition_ht = tuition_ttc` (FR-REV-006).
5. Calculate monthly revenue: `headcount * net_fee / period_months` (6 for AY1 Jan-Jun, 4 for AY2 Sep-Dec).
6. Summer months (Jul-Aug): zero tuition revenue.
7. Non-tuition revenue items use their configured distribution methods: Academic /10, Year-round /12, Custom month weights, or specific period allocations (PRD Section 10.1).
8. Classify each revenue line per IFRS 15 categories: Tuition Fees, Registration & Miscellaneous, Other Revenue (FR-REV-013).

**Output:** `monthly_revenue` table with per-cohort, per-month revenue amounts and IFRS classifications.

### 7.3 Stage 2: Enrollment to DHG to FTE

**Input:** Enrollment headcount by grade (determines sections needed) + curriculum grilles (subject hours per week per section) + HSA optimization parameters.

**Process:**

1. Calculate sections needed per grade: `CEILING(enrollment / max_class_size)` (FR-CAP-001).
2. For each grade level and curriculum band, multiply subject hours per week by number of sections to get total weekly teaching hours.
3. Compute total DHG = Structural hours + Host-country hours (Arabic + Islamic Studies) + Complementary hours (FR-DHG-011).
4. Calculate base FTE: `total_dhg_hours / effective_ORS`, where effective ORS = 18 + HSA hours (configurable per FR-DHG-013).
5. Adjust FTE: `CEILING(base_FTE)` per level (FR-DHG calculation, PRD Section 10.5).
6. Calculate annual hours: `weekly_hours * 36 weeks` (FR-DHG-015).
7. Add support staff: 1 ASEM assistant per Maternelle class section (FR-DHG-012).
8. Run capacity utilization check: `enrollment / (sections * max_class_size)` with traffic-light alerts (FR-CAP-002 through FR-CAP-007).

**Output:** FTE requirements by level and subject type, sections needed by grade, capacity utilization alerts.

### 7.4 Stage 3: FTE and Employees to Staff Costs

**Input:** FTE requirements (from Stage 2) + employee master data (168 records) + salary components + statutory cost parameters (GOSI, Ajeer, EoS rates).

**Process:**

1. For each employee, for each month (1-12):
	- Calculate monthly adjusted gross: `(base_salary + housing + transport + premium + hsa) * hourly_percentage` (FR-STC-005).
	- New positions (status = "New"): zero cost Jan-Aug, full cost Sep-Dec (FR-STC-012).
	- HSA exclusion: set HSA = 0 for Jul-Aug for teaching staff (FR-STC-007).
	- Augmentation: add augmentation amount from September onward if augmentation_effective_date is set (FR-STC-006).
2. Calculate GOSI: `11.75% * full_salary_package` for Saudi nationals only (2 employees). Ajeer workers exempt (FR-STC-009).
3. Calculate Ajeer costs per non-Saudi employee (166 employees):
	- Annual levy: SAR 9,500 per worker (non-Nitaqat, configurable).
	- Monthly platform fee: SAR 160 per worker.
	- Existing staff: 12 months. New staff: 4 months (Sep-Dec) (FR-STC-010).
4. Calculate End of Service provision per employee:
	- `years_of_service = YEARFRAC(joining_date, as_of_date)` using US 30/360 basis (TC-002).
	- EoS base = base_salary + housing + transport + premium (excludes HSA).
	- If YoS <= 5: provision = `eos_base / 2 * yos`.
	- If YoS > 5: provision = `(eos_base / 2 * 5) + eos_base * (yos - 5)`.
	- Annual FY charge = EoS(Dec current year) - EoS(Dec prior year).
	- Monthly accrual = annual FY charge / 12 (FR-STC-011).
5. Add additional staff cost lines: Contrats Locaux Remplacements, 1% Masse Salariale, Residents Salaires, Residents Logement & Billets Avion (FR-STC-015 through FR-STC-018).
6. Compute grand total: Local Staff Salaries + Additional Staff Costs + Employer Charges (GOSI + EoS + Ajeer) (FR-STC-019).

**Output:** `monthly_staff_costs` table with per-employee, per-month cost breakdown. Department-level and function-level aggregations for analytics (FR-STC-020 through FR-STC-025).

### 7.5 Stage 4: Consolidation to P&L

**Input:** Monthly revenue (from Stage 1) + monthly staff costs (from Stage 3) + other operating expenses + finance items + IFRS mapping rules.

**Process:**

1. Aggregate monthly revenue by IFRS 15 category: Tuition Fees (by level and tariff), Registration & Miscellaneous, Other Revenue, Rental Income (FR-PNL-007 through FR-PNL-009).
2. Aggregate monthly expenses by IFRS category: Staff Costs, Other Operating Expenses, Depreciation & Amortization, Impairment Losses (FR-PNL-010).
3. Compute subtotals: Total Revenue, Total Expenses, EBITDA, Operating Profit (FR-PNL-004).
4. Add finance section: Finance Income (investment returns, FX gains) minus Finance Costs (Moyasar fees, bank charges, FX losses) = Net Finance Income/(Cost) (FR-PNL-011, FR-PNL-012).
5. Calculate Profit/(Loss) Before Zakat (FR-PNL-013).
6. Estimate Zakat: `2.5% * max(0, monthly_profit)` per ZATCA regulations (FR-PNL-014).
7. Calculate Net Profit/(Loss) for the Period (FR-PNL-015).
8. Apply IFRS mapping reclassifications: Moyasar fees from OpEx to Finance Costs, bad debt to Impairment Losses per IFRS 9, bank charges from Admin to Finance Costs per IAS 1 (Appendix G notes).
9. All values presented in SAR HT (excluding VAT) per IFRS 15 requirements (FR-PNL-018).

**Output:** Monthly P&L statement (12 months + annual total) with IFRS-compliant line items, subtotals, and key performance indicators (FR-PNL-001 through FR-PNL-018).

### 7.6 Scenario Overlay

Scenarios (Base, Optimistic, Pessimistic, Custom) apply adjustment factors at the input stage, then propagate through the entire calculation chain:

1. **Enrollment adjustment**: `adjusted_enrollment = base_enrollment * new_enrollment_factor + (base_enrollment * retention_adjustment) - (base_enrollment * attrition_rate)` (PRD Section 10.6).
2. **Revenue adjustment**: Recalculated using adjusted enrollment through the Revenue Engine (Stage 1).
3. **Scholarship deduction**: `total_tuition_revenue * scholarship_allocation_percentage`.
4. **Fee collection**: `net_revenue * fee_collection_rate`.
5. **Staff cost impact**: FTE requirements recalculated based on adjusted enrollment (sections change), which cascades through DHG and staff costs.

The scenario engine does NOT create separate data copies. Instead, it applies multiplicative factors at calculation time and stores scenario-specific outputs alongside the base version.

---

*End of Technical Requirements and Scope Assumptions*
