# BudFin Technical Design Document v1.0 — Section 5: Data Architecture

| Field            | Value                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Section          | 5 — Data Architecture                                                                                                    |
| Status           | Draft                                                                                                                    |
| Date             | March 3, 2026                                                                                                            |
| Related Sections | 01_overview.md (TC-001 through TC-005), 02_component_design.md (engine interfaces), 05_security.md (RBAC and encryption) |

---

## 5.1 Database Schema

PostgreSQL 16 is the sole persistent data store. Every table in this section is production-ready DDL — it can be executed directly against a clean PostgreSQL 16 instance. The schema enforces the precision requirements of TC-003, the encryption requirements of PDPL, and the audit requirements of NFR 11.5 and 11.12.

### PostgreSQL Best Practices Applied Throughout

- `BIGSERIAL` primary keys (not `SERIAL`) — 8-byte counter avoids overflow in long-lived systems
- `TIMESTAMPTZ` (not `TIMESTAMP`) — all timestamps include timezone; stored as UTC internally, rendered in AST (UTC+3) by the application
- `TEXT` preferred over `VARCHAR(n)` — PostgreSQL stores both identically; `TEXT` avoids artificial truncation
- Explicit named constraints (`CONSTRAINT name TYPE`) — enables targeted migration and error handling
- Named foreign keys with explicit `ON DELETE` behaviour — no implicit cascade; every relationship's delete semantics are documented
- Named indexes with `COMMENT` explaining which query they serve
- `pgcrypto` for PDPL salary field encryption (AES-256 via `pgp_sym_encrypt`)
- `COMMENT ON TABLE` and `COMMENT ON COLUMN` for every table and every column
- `updated_at` trigger function installed on all mutable tables
- Append-only `audit_entries` with `REVOKE` statements for the application role
- Monetary columns: `DECIMAL(15,4)` per TC-003
- Rate columns: `DECIMAL(7,6)` per TC-003
- Percentage/factor columns: `DECIMAL(5,4)` per TC-003
- Years of service: `DECIMAL(7,4)` per TC-003

---

### Prerequisite: Extensions and Utility Functions

These must be executed before any table creation.

```sql
-- =============================================================================
-- EXTENSION: pgcrypto
-- Required for PDPL-compliant field-level encryption of salary data.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- FUNCTION: update_updated_at_column()
-- Trigger function that sets updated_at to the current timestamp on every UPDATE.
-- Installed on every mutable table via a BEFORE UPDATE trigger.
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### Table 1: users

Stores all application user accounts. Passwords are hashed with bcrypt cost 12 (NFR 11.3.1). Account lockout after 5 failed attempts (NFR 11.3.2).

```sql
CREATE TABLE users (
  id                BIGSERIAL    PRIMARY KEY,
  email             TEXT         NOT NULL,
  password_hash     TEXT         NOT NULL,
  role              TEXT         NOT NULL,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  failed_attempts   INTEGER      NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  last_login        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT users_email_unique          UNIQUE (email),
  CONSTRAINT users_role_check            CHECK (role IN ('Admin', 'BudgetOwner', 'Editor', 'Viewer')),
  CONSTRAINT users_failed_attempts_check CHECK (failed_attempts >= 0)
);

COMMENT ON TABLE users IS 'Application user accounts. Passwords stored as bcrypt cost-12 hashes. Account locks after 5 consecutive failed login attempts.';
COMMENT ON COLUMN users.id IS 'Auto-incrementing primary key (BIGSERIAL).';
COMMENT ON COLUMN users.email IS 'Unique email address used as the login identifier.';
COMMENT ON COLUMN users.password_hash IS 'bcrypt cost-12 hash of the user password. Never stored or transmitted in plaintext.';
COMMENT ON COLUMN users.role IS 'Application role: Admin, BudgetOwner, Editor, or Viewer. Determines RBAC permissions (see Section 7).';
COMMENT ON COLUMN users.is_active IS 'Soft-delete flag. FALSE disables login without removing the record. Financial data may reference this user.';
COMMENT ON COLUMN users.failed_attempts IS 'Count of consecutive failed login attempts. Resets to 0 on successful login.';
COMMENT ON COLUMN users.locked_until IS 'If set and in the future, the account is locked. NULL means not locked. Set after 5 failed attempts.';
COMMENT ON COLUMN users.last_login IS 'Timestamp of the most recent successful authentication. NULL if never logged in.';
COMMENT ON COLUMN users.created_at IS 'Row creation timestamp (UTC). Set once on INSERT.';
COMMENT ON COLUMN users.updated_at IS 'Last modification timestamp (UTC). Auto-updated by trigger on every UPDATE.';
-- S-28: The users table intentionally omits created_by and updated_by audit columns.
-- Rationale: (1) The first Admin user is seeded at deploy time with no creator; (2) self-referential
-- FKs (user modifies themselves) add no meaningful audit value; (3) all user management actions
-- are captured by audit_entries (operation = 'INSERT'/'UPDATE' on table_name = 'users').
-- This exception is documented here to prevent future "fix" attempts that would add unused columns.

-- Index: supports login lookup by email (every authentication request)
CREATE INDEX users_email_idx ON users (email);

-- Index: supports admin filtering of active/inactive users
CREATE INDEX users_is_active_idx ON users (is_active);

-- Trigger: auto-update updated_at on every modification
CREATE TRIGGER users_updated_at_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 2: refresh_tokens

Stores hashed refresh tokens for JWT token family rotation. Enables theft detection — if a revoked token is reused, the entire family is invalidated.

```sql
CREATE TABLE refresh_tokens (
  id              BIGSERIAL    PRIMARY KEY,
  user_id         BIGINT       NOT NULL,
  token_hash      TEXT         NOT NULL,
  family_id       UUID         NOT NULL,
  is_revoked      BOOLEAN      NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT refresh_tokens_user_fk          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash)
);

COMMENT ON TABLE refresh_tokens IS 'Hashed refresh tokens for JWT rotation. Token family tracking enables theft detection per NFR 11.3.';
COMMENT ON COLUMN refresh_tokens.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN refresh_tokens.user_id IS 'FK to users. CASCADE delete: removing a user invalidates all their tokens.';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'bcrypt hash of the refresh token value. The plaintext token is never stored.';
COMMENT ON COLUMN refresh_tokens.family_id IS 'UUID identifying the token family. All tokens issued from the same login share a family_id. If a revoked token in the family is reused, the entire family is invalidated (theft detection).';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'TRUE if this token has been consumed (rotated) or explicitly revoked. A reused revoked token triggers family-wide revocation.';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Absolute expiry timestamp. Tokens are invalid after this time regardless of revocation status.';
COMMENT ON COLUMN refresh_tokens.created_at IS 'Row creation timestamp.';

-- Index: lookup by user_id for listing/revoking user sessions
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);

-- Index: lookup by family_id for theft detection (revoke all tokens in family)
CREATE INDEX refresh_tokens_family_id_idx ON refresh_tokens (family_id);

-- Index: cleanup query for expired tokens (periodic maintenance job)
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at)
  WHERE is_revoked = FALSE;
```

---

### Table 3: budget_versions

Central entity for version isolation. Every piece of planning data (employees, fees, enrollment, calculations) is scoped to a budget version via `version_id` FK. Versions progress through Draft -> Published -> Locked -> Archived.

```sql
CREATE TABLE budget_versions (
  id                  BIGSERIAL    PRIMARY KEY,
  fiscal_year         INTEGER      NOT NULL,
  name                TEXT         NOT NULL,
  type                TEXT         NOT NULL,
  status              TEXT         NOT NULL DEFAULT 'Draft',
  description         TEXT,
  source_version_id   BIGINT,
  modification_count  INTEGER      NOT NULL DEFAULT 0,
  published_at        TIMESTAMPTZ,
  locked_at           TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by          BIGINT       NOT NULL,
  updated_by          BIGINT,
  data_source         TEXT         NOT NULL DEFAULT 'CALCULATED',

  CONSTRAINT budget_versions_type_check        CHECK (type IN ('Actual', 'Budget', 'Forecast')),
  CONSTRAINT budget_versions_status_check      CHECK (status IN ('Draft', 'Published', 'Locked', 'Archived')),
  CONSTRAINT budget_versions_data_source_check CHECK (data_source IN ('CALCULATED', 'IMPORTED')),
  -- S-27 ADVISORY: The UNIQUE (fiscal_year, name) constraint intentionally blocks reusing a version name
  -- even after archiving. This prevents confusion between an active version and a retired one with the same name.
  -- Business decision: version names are permanent identifiers within a fiscal year regardless of status.
  -- If this causes UX friction (users wanting to reuse "Base Budget" after archiving), revisit in Phase 2
  -- with a partial unique: UNIQUE (fiscal_year, name) WHERE status != 'Archived'. Not implemented now.
  CONSTRAINT budget_versions_fiscal_year_name_unique UNIQUE (fiscal_year, name),
  CONSTRAINT budget_versions_source_fk         FOREIGN KEY (source_version_id) REFERENCES budget_versions(id) ON DELETE SET NULL,
  CONSTRAINT budget_versions_created_by_fk     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT budget_versions_updated_by_fk     FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE budget_versions IS 'Budget version container. All planning data is scoped by version_id FK. Versions are isolated snapshots — cloning creates independent copies with no shared mutable state.';
COMMENT ON COLUMN budget_versions.id IS 'Auto-incrementing primary key. Used as version_id FK in all planning data tables.';
COMMENT ON COLUMN budget_versions.fiscal_year IS 'Fiscal year this version applies to (e.g., 2026). Combined with name for uniqueness.';
COMMENT ON COLUMN budget_versions.name IS 'Human-readable version name (e.g., "Base Budget", "Optimistic Scenario Q2"). Unique within a fiscal year.';
COMMENT ON COLUMN budget_versions.type IS 'Version category: Actual (historical), Budget (planning), or Forecast (projection).';
COMMENT ON COLUMN budget_versions.status IS 'Lifecycle state: Draft (editable), Published (read-only, visible to all), Locked (immutable), Archived (cold storage). Status transitions are one-way.';
COMMENT ON COLUMN budget_versions.description IS 'Optional free-text description of the version purpose or assumptions.';
COMMENT ON COLUMN budget_versions.source_version_id IS 'Self-referential FK to the version this was cloned from. NULL for original versions. SET NULL if source is deleted.';
COMMENT ON COLUMN budget_versions.modification_count IS 'Incremented on every data modification within this version. Used for optimistic locking at the version level.';
COMMENT ON COLUMN budget_versions.published_at IS 'Timestamp when status transitioned to Published. NULL if still Draft.';
COMMENT ON COLUMN budget_versions.locked_at IS 'Timestamp when status transitioned to Locked. NULL if not yet locked.';
COMMENT ON COLUMN budget_versions.archived_at IS 'Timestamp when status transitioned to Archived. NULL if not yet archived.';
COMMENT ON COLUMN budget_versions.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN budget_versions.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN budget_versions.created_by IS 'FK to users. The user who created this version. RESTRICT delete to preserve audit trail.';
COMMENT ON COLUMN budget_versions.updated_by IS 'FK to users. The user who last modified this version. SET NULL if that user is deleted. NULL for versions not yet modified after creation.';
COMMENT ON COLUMN budget_versions.data_source IS
  'Data origin for this version. CALCULATED: all output rows written by calculation engines (Revenue, Staffing, P&L).
   IMPORTED: all output rows written directly by the Excel import service. Calculation engine endpoints return 409 Conflict
   for IMPORTED versions; direct import writes are rejected for CALCULATED versions.
   Budget and Forecast versions must be CALCULATED. Actual versions must be IMPORTED.';

-- Index: version list filtered by fiscal year (dashboard and version selector)
CREATE INDEX budget_versions_fiscal_year_idx ON budget_versions (fiscal_year);

-- Index: version list filtered by status (e.g., show all Published versions)
CREATE INDEX budget_versions_status_idx ON budget_versions (status);

-- Index: filter by data_source (import service pre-flight check)
CREATE INDEX budget_versions_data_source_idx ON budget_versions (data_source);

-- Index: version lineage queries (find clones of a source version) (Phase 3 I-04)
CREATE INDEX budget_versions_source_version_idx ON budget_versions (source_version_id);

-- Index: FK column created_by — required per FK indexing convention (Phase 3)
CREATE INDEX budget_versions_created_by_idx ON budget_versions (created_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER budget_versions_updated_at_trigger
  BEFORE UPDATE ON budget_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 3b: fiscal_periods

Month-level period management for rolling forecasts. Each row represents one calendar month within a fiscal year. When a period is `Locked`, the `actual_version_id` points to the confirmed Actual budget version for that month. The Latest Estimate API uses this table to merge locked actuals with future budget projections.

```sql
CREATE TABLE fiscal_periods (
  id                BIGSERIAL    PRIMARY KEY,
  fiscal_year       INTEGER      NOT NULL,
  month             INTEGER      NOT NULL,
  status            TEXT         NOT NULL DEFAULT 'Draft',
  actual_version_id BIGINT,
  locked_at         TIMESTAMPTZ,
  locked_by         BIGINT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by        BIGINT,

  CONSTRAINT fiscal_periods_year_month_unique  UNIQUE (fiscal_year, month),
  CONSTRAINT fiscal_periods_month_check        CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT fiscal_periods_status_check       CHECK (status IN ('Draft', 'Locked')),
  CONSTRAINT fiscal_periods_actual_version_fk
    FOREIGN KEY (actual_version_id) REFERENCES budget_versions(id) ON DELETE SET NULL,
  CONSTRAINT fiscal_periods_locked_by_fk
    FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fiscal_periods_updated_by_fk
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE fiscal_periods IS
  'Month-level period management. Draft = actuals not yet confirmed; Locked = actuals confirmed.
   actual_version_id points to the Actual budget_version that is authoritative for this month.
   Used by Latest Estimate queries to merge confirmed actuals with future projections.
   Locking is manual and irreversible; only Admin/BudgetOwner role may lock a period.';

COMMENT ON COLUMN fiscal_periods.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN fiscal_periods.fiscal_year IS
  'Calendar fiscal year (e.g., 2026). Combined with month for unique period identification.';
COMMENT ON COLUMN fiscal_periods.month IS
  'Calendar month (1=Jan through 12=Dec). Summer months (7–8) may be locked with zero actuals.';
COMMENT ON COLUMN fiscal_periods.status IS
  'Draft: planning numbers apply for this month. Locked: actual_version_id contains confirmed data.
   Status is one-way (Draft → Locked only). Requires explicit admin action to lock.';
COMMENT ON COLUMN fiscal_periods.actual_version_id IS
  'FK to the Actual budget_version containing confirmed financial data for this month.
   NULL while status = Draft. Must point to a version where data_source = IMPORTED.';
COMMENT ON COLUMN fiscal_periods.locked_at IS 'Timestamp when status was set to Locked.';
COMMENT ON COLUMN fiscal_periods.locked_by IS 'FK to the user who locked this period.';
COMMENT ON COLUMN fiscal_periods.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN fiscal_periods.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN fiscal_periods.updated_by IS 'FK to users. The user who last modified this period record. SET NULL if that user is deleted.';

-- Index: lookup all periods for a fiscal year (Latest Estimate query)
CREATE INDEX fiscal_periods_fiscal_year_idx ON fiscal_periods (fiscal_year);

-- Index: find all locked periods (rollup queries filtering by status)
CREATE INDEX fiscal_periods_status_idx ON fiscal_periods (status);

-- Index: Latest Estimate query — JOIN fiscal_periods.actual_version_id to budget_versions (Phase 3 I-01 MAJOR)
-- This is used in the hot path: for each locked period, fetch the confirmed actual version.
CREATE INDEX fiscal_periods_actual_version_idx ON fiscal_periods (actual_version_id);

-- Index: FK column locked_by (Phase 3)
CREATE INDEX fiscal_periods_locked_by_idx ON fiscal_periods (locked_by);

CREATE TRIGGER fiscal_periods_updated_at_trigger
  BEFORE UPDATE ON fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 3c: actuals_import_log

Audit trail for all Excel/CSV imports into Actual versions. One row is created per import run per module. Provides full traceability: who imported what file, when, targeting which fiscal year and period, and with what validation outcome.

```sql
CREATE TABLE actuals_import_log (
  id                  BIGSERIAL    PRIMARY KEY,
  version_id          BIGINT       NOT NULL,
  import_module       TEXT         NOT NULL,
  source_file         TEXT         NOT NULL,
  academic_year_label TEXT,
  target_fiscal_year  INTEGER,
  target_period       TEXT,
  rows_imported       INTEGER      NOT NULL DEFAULT 0,
  validation_status   TEXT         NOT NULL DEFAULT 'PENDING',
  validation_notes    JSONB,
  imported_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  imported_by         BIGINT,

  CONSTRAINT actuals_import_log_version_fk
    FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT actuals_import_log_imported_by_fk
    FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT actuals_import_log_module_check
    CHECK (import_module IN ('REVENUE', 'STAFF_COSTS', 'ENROLLMENT', 'PNL')),
  CONSTRAINT actuals_import_log_status_check
    CHECK (validation_status IN ('PENDING', 'PASSED', 'FAILED'))
);

COMMENT ON TABLE actuals_import_log IS
  'Audit trail for all Excel imports into Actual versions. One row per import run per module.
   Provides traceability: who imported what file, when, with what result.';
COMMENT ON COLUMN actuals_import_log.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN actuals_import_log.version_id IS
  'FK to budget_versions (must have data_source = IMPORTED). CASCADE delete.';
COMMENT ON COLUMN actuals_import_log.import_module IS
  'Which data module was imported: REVENUE, STAFF_COSTS, ENROLLMENT, or PNL.';
COMMENT ON COLUMN actuals_import_log.source_file IS
  'Original filename of the uploaded file (e.g., "enrollment_2024-25.csv").';
COMMENT ON COLUMN actuals_import_log.academic_year_label IS
  'Source academic year label (e.g., "2024-25"). For enrollment imports, maps to the
   target_fiscal_year + target_period per the academic year mapping rule (see section 5.3).';
COMMENT ON COLUMN actuals_import_log.target_fiscal_year IS
  'Fiscal year the imported data applies to (e.g., 2025).';
COMMENT ON COLUMN actuals_import_log.target_period IS
  'Academic period the imported data applies to: AY1, AY2, or FULL_YEAR.';
COMMENT ON COLUMN actuals_import_log.rows_imported IS
  'Number of rows successfully written to the target table(s).';
COMMENT ON COLUMN actuals_import_log.validation_status IS
  'PENDING: import in progress. PASSED: all validation checks cleared. FAILED: one or more checks failed (see validation_notes).';
COMMENT ON COLUMN actuals_import_log.validation_notes IS
  'JSONB detail of validation results: row counts, column checksums, error messages.';
COMMENT ON COLUMN actuals_import_log.imported_at IS 'Timestamp when the import was initiated.';
COMMENT ON COLUMN actuals_import_log.imported_by IS 'FK to users who triggered the import. SET NULL if user deleted.';

-- Index: import history for a version (audit panel)
CREATE INDEX actuals_import_log_version_idx ON actuals_import_log (version_id);

-- Index: filter imports by validation outcome
CREATE INDEX actuals_import_log_status_idx ON actuals_import_log (validation_status);

-- Index: FK column imported_by (Phase 3)
CREATE INDEX actuals_import_log_imported_by_idx ON actuals_import_log (imported_by);
```

---

### Table 4: employees

Per-version employee records. Salary fields are encrypted with pgcrypto for PDPL compliance. Each budget version has its own copy of employee data (version isolation via snapshot copy on clone).

```sql
CREATE TABLE employees (
  id                                BIGSERIAL       PRIMARY KEY,
  version_id                        BIGINT          NOT NULL,
  employee_code                     TEXT            NOT NULL,
  name                              TEXT            NOT NULL,
  function_role                     TEXT            NOT NULL,
  department                        TEXT            NOT NULL,
  status                            TEXT            NOT NULL DEFAULT 'Existing',
  joining_date                      DATE            NOT NULL,
  payment_method                    TEXT            NOT NULL,
  is_saudi                          BOOLEAN         NOT NULL DEFAULT FALSE,
  is_ajeer                          BOOLEAN         NOT NULL DEFAULT TRUE,
  hourly_percentage                 DECIMAL(5,4)    NOT NULL DEFAULT 1.0000,
  base_salary_encrypted             BYTEA           NOT NULL,
  housing_allowance_encrypted       BYTEA           NOT NULL,
  transport_allowance_encrypted     BYTEA           NOT NULL,
  responsibility_premium_encrypted  BYTEA           NOT NULL,
  hsa_amount_encrypted              BYTEA           NOT NULL,
  augmentation                      DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  augmentation_effective_date       DATE,
  notes                             TEXT,
  created_at                        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by                        BIGINT          NOT NULL,
  updated_by                        BIGINT,

  CONSTRAINT employees_version_fk          FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT employees_created_by_fk       FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT employees_updated_by_fk       FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT employees_version_code_unique UNIQUE (version_id, employee_code),
  CONSTRAINT employees_department_check    CHECK (department IN ('Maternelle', 'Elementaire', 'College', 'Lycee', 'Administration', 'Vie Scolaire & Support')),
  CONSTRAINT employees_status_check        CHECK (status IN ('Existing', 'New', 'Departed')),
  -- S-25: payment_method constrained to the three values present in source EFIR data.
  CONSTRAINT employees_payment_method_check CHECK (payment_method IN ('Bank Transfer', 'Cash', 'Cheque')),
  CONSTRAINT employees_hourly_pct_check    CHECK (hourly_percentage > 0 AND hourly_percentage <= 1.0000),
  CONSTRAINT employees_augmentation_check  CHECK (augmentation >= 0)
);

COMMENT ON TABLE employees IS 'Per-version employee records. Each budget version contains its own snapshot of all employees. Salary fields are AES-256 encrypted via pgcrypto for PDPL compliance.';
COMMENT ON COLUMN employees.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN employees.version_id IS 'FK to budget_versions. CASCADE delete: deleting a version removes all its employee records.';
COMMENT ON COLUMN employees.employee_code IS 'Unique employee identifier within a version (e.g., "EMP-001"). Used for cross-reference with source spreadsheets.';
COMMENT ON COLUMN employees.name IS 'Full name of the employee.';
COMMENT ON COLUMN employees.function_role IS 'Job title or function (e.g., "Professeur des ecoles", "Surveillant").';
COMMENT ON COLUMN employees.department IS 'School department: Maternelle, Elementaire, College, Lycee, Administration, or Vie Scolaire & Support.';
COMMENT ON COLUMN employees.status IS 'Employment status within this budget version: Existing (continuing), New (joining during the fiscal year), Departed (leaving during the fiscal year).';
COMMENT ON COLUMN employees.joining_date IS 'Date the employee started or will start employment. Used by YEARFRAC US 30/360 for EoS calculation (TC-002).';
-- S-25: payment_method is constrained to the three values present in source EFIR data.
COMMENT ON COLUMN employees.payment_method IS 'Payment method for salary disbursement. Valid values: ''Bank Transfer'', ''Cash'', ''Cheque''. Informational field sourced from the EFIR staff spreadsheet.';
COMMENT ON COLUMN employees.is_saudi IS 'TRUE if the employee is a Saudi national. Determines GOSI applicability (11.75% employer contribution for Saudis only).';
COMMENT ON COLUMN employees.is_ajeer IS 'TRUE if the employee is registered on the Ajeer platform. Determines Ajeer levy and monthly fee applicability.';
COMMENT ON COLUMN employees.hourly_percentage IS 'Teaching load fraction (0.0001 to 1.0000). 1.0000 = full-time. Part-time employees have proportionally reduced salary costs. DECIMAL(5,4) per TC-003.';
COMMENT ON COLUMN employees.base_salary_encrypted IS 'AES-256 encrypted using pgp_sym_encrypt(value::text, encryption_key). Decryption: pgp_sym_decrypt(base_salary_encrypted, $key)::DECIMAL(15,4). Encryption key stored in Docker secret SALARY_ENCRYPTION_KEY env var. PDPL compliance: employee salary is classified as Confidential PII.';
COMMENT ON COLUMN employees.housing_allowance_encrypted IS 'AES-256 encrypted housing allowance. Same encryption scheme as base_salary_encrypted.';
COMMENT ON COLUMN employees.transport_allowance_encrypted IS 'AES-256 encrypted transport allowance. Same encryption scheme as base_salary_encrypted.';
COMMENT ON COLUMN employees.responsibility_premium_encrypted IS 'AES-256 encrypted responsibility premium. Same encryption scheme as base_salary_encrypted.';
COMMENT ON COLUMN employees.hsa_amount_encrypted IS 'AES-256 encrypted HSA (Head of School Allowance) amount. Excluded from gross during Jul-Aug (summer months). Same encryption scheme as base_salary_encrypted.';
COMMENT ON COLUMN employees.augmentation IS 'Annual salary increase amount (SAR). Applied from September onward (AY2). DECIMAL(15,4) per TC-003.';
COMMENT ON COLUMN employees.augmentation_effective_date IS 'Date the augmentation takes effect. Typically September 1 of the fiscal year.';
COMMENT ON COLUMN employees.notes IS 'Optional free-text notes about the employee record.';
COMMENT ON COLUMN employees.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN employees.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN employees.created_by IS 'FK to users. The user who created or imported this employee record.';
COMMENT ON COLUMN employees.updated_by IS 'FK to users. The user who last modified this employee record. SET NULL if that user is deleted.';

-- Index: all employees for a version (employee list page)
CREATE INDEX employees_version_id_idx ON employees (version_id);

-- Index: employees filtered by version and department (department-level cost view)
CREATE INDEX employees_version_department_idx ON employees (version_id, department);

-- Index: employees filtered by version and status (filter by Existing/New/Departed)
CREATE INDEX employees_version_status_idx ON employees (version_id, status);

-- Index: FK column created_by (Phase 3)
CREATE INDEX employees_created_by_idx ON employees (created_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER employees_updated_at_trigger
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Salary Decryption Note:**

In practice, the decryption key is never stored in the database or embedded in views. The application decrypts salary fields at read time by passing the key as a query parameter:

```sql
-- Application-level decryption (executed via Prisma raw query):
SELECT
  id,
  employee_code,
  name,
  pgp_sym_decrypt(base_salary_encrypted, $1)::DECIMAL(15,4) AS base_salary,
  pgp_sym_decrypt(housing_allowance_encrypted, $1)::DECIMAL(15,4) AS housing_allowance,
  pgp_sym_decrypt(transport_allowance_encrypted, $1)::DECIMAL(15,4) AS transport_allowance,
  pgp_sym_decrypt(responsibility_premium_encrypted, $1)::DECIMAL(15,4) AS responsibility_premium,
  pgp_sym_decrypt(hsa_amount_encrypted, $1)::DECIMAL(15,4) AS hsa_amount
FROM employees
WHERE version_id = $2;
-- $1 = SALARY_ENCRYPTION_KEY from environment variable
-- $2 = budget version ID
```

---

### Table 5: fee_grids

Fee schedules per grade, nationality, and tariff. Separate rows for AY1 and AY2 to support mid-year fee adjustments. Tuition HT is the VAT-exclusive amount used in all revenue calculations.

```sql
CREATE TABLE fee_grids (
  id              BIGSERIAL       PRIMARY KEY,
  version_id      BIGINT          NOT NULL,
  academic_period  TEXT           NOT NULL,
  grade_level     TEXT            NOT NULL,
  nationality     TEXT            NOT NULL,
  tariff          TEXT            NOT NULL,
  dai             DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  tuition_ttc     DECIMAL(15,4)   NOT NULL,
  tuition_ht      DECIMAL(15,4)   NOT NULL,
  term1_amount    DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  term2_amount    DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  term3_amount    DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by      BIGINT          NOT NULL,
  updated_by      BIGINT,

  CONSTRAINT fee_grids_version_fk     FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT fee_grids_created_by_fk  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fee_grids_updated_by_fk  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fee_grids_period_check   CHECK (academic_period IN ('AY1', 'AY2')),
  -- S-10: grade_level constrained to the 15 canonical EFIR grade values (PRD Appendix A).
  CONSTRAINT fee_grids_grade_check    CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT fee_grids_nationality_check CHECK (nationality IN ('Francais', 'Nationaux', 'Autres')),
  CONSTRAINT fee_grids_tariff_check   CHECK (tariff IN ('RP', 'R3+', 'Plein')),
  CONSTRAINT fee_grids_dai_check      CHECK (dai >= 0),
  CONSTRAINT fee_grids_tuition_ttc_check CHECK (tuition_ttc >= 0),
  CONSTRAINT fee_grids_tuition_ht_check  CHECK (tuition_ht >= 0),
  CONSTRAINT fee_grids_composite_unique  UNIQUE (version_id, academic_period, grade_level, nationality, tariff)
);

COMMENT ON TABLE fee_grids IS 'Fee schedules per version, academic period, grade, nationality, and tariff. Tuition HT (excl. VAT) is the base for revenue calculations. TTC includes 15% VAT (0% for Nationaux).';
COMMENT ON COLUMN fee_grids.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN fee_grids.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN fee_grids.academic_period IS 'AY1 (Jan-Jun) or AY2 (Sep-Dec). Separate rows allow mid-year fee adjustments.';
COMMENT ON COLUMN fee_grids.grade_level IS 'Grade identifier (e.g., PS, MS, GS, CP, CE1, CE2, CM1, CM2, 6eme, 5eme, 4eme, 3eme, 2nde, 1ere, Terminale).';
COMMENT ON COLUMN fee_grids.nationality IS 'Student nationality category: Francais (French), Nationaux (Saudi — VAT exempt), Autres (other nationalities).';
COMMENT ON COLUMN fee_grids.tariff IS 'Pricing tier: RP (Reduced Price), R3+ (3+ children reduction), Plein (full price).';
COMMENT ON COLUMN fee_grids.dai IS 'Droit Admission Inscription — one-time admission fee per student. DECIMAL(15,4).';
COMMENT ON COLUMN fee_grids.tuition_ttc IS 'Tuition fee including VAT (TTC = Toutes Taxes Comprises). For Nationaux, TTC = HT (0% VAT). DECIMAL(15,4).';
COMMENT ON COLUMN fee_grids.tuition_ht IS 'Tuition fee excluding VAT (HT = Hors Taxe). Computed as TTC / (1 + vat_rate). Used in all revenue calculations. DECIMAL(15,4).';
COMMENT ON COLUMN fee_grids.term1_amount IS 'Term 1 payment amount for installment plan reference. DECIMAL(15,4).';
COMMENT ON COLUMN fee_grids.term2_amount IS 'Term 2 payment amount for installment plan reference. DECIMAL(15,4).';
COMMENT ON COLUMN fee_grids.term3_amount IS 'Term 3 payment amount for installment plan reference. DECIMAL(15,4).';
COMMENT ON COLUMN fee_grids.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN fee_grids.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN fee_grids.created_by IS 'FK to users who created or imported this fee grid row.';
COMMENT ON COLUMN fee_grids.updated_by IS 'FK to users who last modified this fee grid row. SET NULL if that user is deleted.';

-- Index: revenue calculation 5-column covering index (Phase 3 I-02 MAJOR).
-- The Revenue Engine JOIN is: enrollment_detail JOIN fee_grids ON
--   version_id, academic_period, grade_level, nationality, tariff.
-- The old 2-column (version_id, academic_period) index was too narrow — replaced with covering index.
CREATE INDEX fee_grids_revenue_calc_idx ON fee_grids (version_id, academic_period, grade_level, nationality, tariff);

-- Index: FK column created_by (Phase 3)
CREATE INDEX fee_grids_created_by_idx ON fee_grids (created_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER fee_grids_updated_at_trigger
  BEFORE UPDATE ON fee_grids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 6: enrollment_headcount

Stage 1 enrollment data: total headcount per grade and academic period within a budget version. Stage 2 (enrollment_detail) must sum to these totals.

```sql
CREATE TABLE enrollment_headcount (
  id              BIGSERIAL    PRIMARY KEY,
  version_id      BIGINT       NOT NULL,
  academic_period  TEXT         NOT NULL,
  grade_level     TEXT         NOT NULL,
  headcount       INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      BIGINT       NOT NULL,
  updated_by      BIGINT,

  CONSTRAINT enrollment_headcount_version_fk    FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT enrollment_headcount_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT enrollment_headcount_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT enrollment_headcount_period_check  CHECK (academic_period IN ('AY1', 'AY2')),
  -- S-10: grade_level constrained to canonical 15 values (PRD Appendix A).
  CONSTRAINT enrollment_headcount_grade_check   CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT enrollment_headcount_count_check   CHECK (headcount >= 0),
  CONSTRAINT enrollment_headcount_composite_unique UNIQUE (version_id, academic_period, grade_level)
);

COMMENT ON TABLE enrollment_headcount IS 'Stage 1 enrollment: total headcount per grade and academic period. Stage 2 breakdown (enrollment_detail) must match these totals.';
COMMENT ON COLUMN enrollment_headcount.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN enrollment_headcount.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN enrollment_headcount.academic_period IS 'AY1 (Jan-Jun) or AY2 (Sep-Dec).';
COMMENT ON COLUMN enrollment_headcount.grade_level IS 'Grade identifier.';
COMMENT ON COLUMN enrollment_headcount.headcount IS 'Total number of students in this grade for this period. Must be >= 0.';
COMMENT ON COLUMN enrollment_headcount.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN enrollment_headcount.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN enrollment_headcount.created_by IS 'FK to users who entered this enrollment data.';
COMMENT ON COLUMN enrollment_headcount.updated_by IS 'FK to users who last modified this headcount entry. SET NULL if that user is deleted.';

-- Index: enrollment data retrieval for a version and period
CREATE INDEX enrollment_headcount_version_period_idx ON enrollment_headcount (version_id, academic_period);

-- Index: FK column created_by (Phase 3)
CREATE INDEX enrollment_headcount_created_by_idx ON enrollment_headcount (created_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER enrollment_headcount_updated_at_trigger
  BEFORE UPDATE ON enrollment_headcount
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 7: enrollment_detail

Stage 2 enrollment: breakdown by nationality and tariff. The sum of headcount rows per (version_id, academic_period, grade_level) must equal the corresponding enrollment_headcount row (validated by the application before saving).

```sql
CREATE TABLE enrollment_detail (
  id              BIGSERIAL    PRIMARY KEY,
  version_id      BIGINT       NOT NULL,
  academic_period  TEXT         NOT NULL,
  grade_level     TEXT         NOT NULL,
  nationality     TEXT         NOT NULL,
  tariff          TEXT         NOT NULL,
  headcount       INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by      BIGINT       NOT NULL,
  updated_by      BIGINT,

  CONSTRAINT enrollment_detail_version_fk    FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT enrollment_detail_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT enrollment_detail_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  -- S-11: FK to enrollment_headcount parent ensures detail rows cannot exist without a headcount row.
  -- CASCADE preserves the invariant: deleting a headcount row removes all its detail rows.
  CONSTRAINT enrollment_detail_headcount_fk  FOREIGN KEY (version_id, academic_period, grade_level)
    REFERENCES enrollment_headcount(version_id, academic_period, grade_level) ON DELETE CASCADE,
  CONSTRAINT enrollment_detail_period_check  CHECK (academic_period IN ('AY1', 'AY2')),
  -- S-10: grade_level constrained to canonical 15 values (PRD Appendix A).
  CONSTRAINT enrollment_detail_grade_check   CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT enrollment_detail_nationality_check CHECK (nationality IN ('Francais', 'Nationaux', 'Autres')),
  CONSTRAINT enrollment_detail_tariff_check  CHECK (tariff IN ('RP', 'R3+', 'Plein')),
  CONSTRAINT enrollment_detail_count_check   CHECK (headcount >= 0),
  CONSTRAINT enrollment_detail_composite_unique UNIQUE (version_id, academic_period, grade_level, nationality, tariff)
);

COMMENT ON TABLE enrollment_detail IS 'Stage 2 enrollment breakdown by nationality and tariff. Sum per (version, period, grade) must equal enrollment_headcount. Drives revenue calculation JOIN with fee_grids.';
COMMENT ON COLUMN enrollment_detail.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN enrollment_detail.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN enrollment_detail.academic_period IS 'AY1 (Jan-Jun) or AY2 (Sep-Dec).';
COMMENT ON COLUMN enrollment_detail.grade_level IS 'Grade identifier.';
COMMENT ON COLUMN enrollment_detail.nationality IS 'Student nationality category: Francais, Nationaux, or Autres.';
COMMENT ON COLUMN enrollment_detail.tariff IS 'Pricing tier: RP, R3+, or Plein.';
COMMENT ON COLUMN enrollment_detail.headcount IS 'Number of students in this grade/nationality/tariff segment. Must be >= 0.';
COMMENT ON COLUMN enrollment_detail.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN enrollment_detail.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN enrollment_detail.created_by IS 'FK to users who entered this breakdown.';
COMMENT ON COLUMN enrollment_detail.updated_by IS 'FK to users who last modified this detail row. SET NULL if that user is deleted.';

-- Index: revenue calculation JOIN with fee_grids (version + period + grade)
CREATE INDEX enrollment_detail_version_period_grade_idx ON enrollment_detail (version_id, academic_period, grade_level);

-- Index: FK column created_by (Phase 3)
CREATE INDEX enrollment_detail_created_by_idx ON enrollment_detail (created_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER enrollment_detail_updated_at_trigger
  BEFORE UPDATE ON enrollment_detail
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 8: class_capacity_config

Reference table defining maximum class sizes and capacity thresholds per grade level. Not version-scoped — these are school-wide structural parameters. Used by the DHG engine to calculate sections needed.

```sql
CREATE TABLE class_capacity_config (
  id              BIGSERIAL       PRIMARY KEY,
  grade_level     TEXT            NOT NULL,
  grade_band      TEXT            NOT NULL,
  max_class_size  INTEGER         NOT NULL,
  plancher_pct    DECIMAL(5,4)    NOT NULL DEFAULT 0.7000,
  cible_pct       DECIMAL(5,4)    NOT NULL DEFAULT 0.8500,
  plafond_pct     DECIMAL(5,4)    NOT NULL DEFAULT 1.0000,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by      BIGINT,
  updated_by      BIGINT,

  CONSTRAINT class_capacity_grade_unique     UNIQUE (grade_level),
  -- S-10: grade_level constrained to canonical 15 values (PRD Appendix A).
  CONSTRAINT class_capacity_grade_check      CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT class_capacity_band_check       CHECK (grade_band IN ('Maternelle', 'Elementaire', 'College', 'Lycee')),
  CONSTRAINT class_capacity_size_check       CHECK (max_class_size > 0),
  CONSTRAINT class_capacity_plancher_check   CHECK (plancher_pct >= 0 AND plancher_pct <= 1.0000),
  CONSTRAINT class_capacity_cible_check      CHECK (cible_pct >= 0 AND cible_pct <= 1.0000),
  CONSTRAINT class_capacity_plafond_check    CHECK (plafond_pct >= 0 AND plafond_pct <= 1.0000),
  -- S-26: Cross-column ordering constraint prevents logically invalid configs (e.g., plancher=0.9, cible=0.5).
  -- Invariant: plancher (floor) < cible (target) <= plafond (ceiling). FR-CAP-002.
  CONSTRAINT class_capacity_pct_ordering_check CHECK (plancher_pct < cible_pct AND cible_pct <= plafond_pct),
  CONSTRAINT class_capacity_created_by_fk    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT class_capacity_updated_by_fk    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE class_capacity_config IS 'School-wide class size limits and capacity thresholds per grade. Used by DHG engine to calculate sections_needed = CEILING(headcount / max_class_size). Not version-scoped.';
COMMENT ON COLUMN class_capacity_config.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN class_capacity_config.grade_level IS 'Grade identifier (unique). One row per grade in the school.';
COMMENT ON COLUMN class_capacity_config.grade_band IS 'School division: Maternelle (PS/MS/GS, max 24), Elementaire (CP-CM2, max 26), College (6e-3e), Lycee (2nde-Terminale).';
COMMENT ON COLUMN class_capacity_config.max_class_size IS 'Maximum students per section. Maternelle=24, Elementaire=26, College/Lycee=30 (typical). Must be > 0.';
COMMENT ON COLUMN class_capacity_config.plancher_pct IS 'Floor threshold (plancher): below this percentage of max_class_size, a section is considered under-enrolled. Default 70%. DECIMAL(5,4).';
COMMENT ON COLUMN class_capacity_config.cible_pct IS 'Target threshold (cible): optimal enrollment percentage per section. Default 85%. DECIMAL(5,4).';
COMMENT ON COLUMN class_capacity_config.plafond_pct IS 'Ceiling threshold (plafond): maximum enrollment percentage. Default 100%. DECIMAL(5,4).';
COMMENT ON COLUMN class_capacity_config.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN class_capacity_config.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN class_capacity_config.created_by IS 'FK to users who configured this capacity. SET NULL if user deleted.';
COMMENT ON COLUMN class_capacity_config.updated_by IS 'FK to users who last modified this capacity configuration. SET NULL if user deleted.';

-- Trigger: auto-update updated_at
CREATE TRIGGER class_capacity_config_updated_at_trigger
  BEFORE UPDATE ON class_capacity_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 9: discount_policies

Version-scoped discount rates for reduced-price tariffs. The discount rate is a percentage off the Plein (full) tariff. Only RP and R3+ tariffs have discounts.

```sql
CREATE TABLE discount_policies (
  id              BIGSERIAL       PRIMARY KEY,
  version_id      BIGINT          NOT NULL,
  tariff          TEXT            NOT NULL,
  nationality     TEXT,
  discount_rate   DECIMAL(7,6)    NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by      BIGINT          NOT NULL,
  updated_by      BIGINT,

  CONSTRAINT discount_policies_version_fk    FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT discount_policies_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT discount_policies_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT discount_policies_tariff_check  CHECK (tariff IN ('RP', 'R3+')),
  CONSTRAINT discount_policies_nationality_check CHECK (nationality IS NULL OR nationality IN ('Francais', 'Nationaux', 'Autres')),
  CONSTRAINT discount_policies_rate_check    CHECK (discount_rate >= 0 AND discount_rate <= 1),
  CONSTRAINT discount_policies_composite_unique UNIQUE (version_id, tariff, nationality)
);

COMMENT ON TABLE discount_policies IS 'Discount rates for reduced-price tariffs (RP, R3+). Rate is the percentage discount from the Plein tariff. NULL nationality means the discount applies to all nationalities.';
COMMENT ON COLUMN discount_policies.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN discount_policies.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN discount_policies.tariff IS 'Tariff tier receiving the discount: RP or R3+ only. Plein tariff has no discount.';
COMMENT ON COLUMN discount_policies.nationality IS 'If set, the discount applies only to this nationality. NULL means it applies to all nationalities for this tariff.';
COMMENT ON COLUMN discount_policies.discount_rate IS 'Discount as a decimal fraction (e.g., 0.250000 = 25% discount). DECIMAL(7,6) per TC-003.';
COMMENT ON COLUMN discount_policies.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN discount_policies.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN discount_policies.created_by IS 'FK to users who set this discount policy.';
COMMENT ON COLUMN discount_policies.updated_by IS 'FK to users who last modified this discount policy. SET NULL if that user is deleted.';

-- Index: revenue calculation discount lookup — composite index for JOIN on (version_id, tariff, nationality) (Phase 3 I-03 MAJOR).
-- The Revenue Engine looks up discounts by (version, tariff, nationality). The old single-column index
-- required a version-level scan; the composite index provides O(log n) lookup for each enrollment_detail row.
CREATE INDEX discount_policies_calc_idx ON discount_policies (version_id, tariff, nationality);

-- Index: FK column created_by (Phase 3)
CREATE INDEX discount_policies_created_by_idx ON discount_policies (created_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER discount_policies_updated_at_trigger
  BEFORE UPDATE ON discount_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 10: other_revenue_items

Non-tuition revenue line items (e.g., cantine, transport services, DAI totals, AEFE subventions). Each item has a distribution method for monthly allocation.

```sql
CREATE TABLE other_revenue_items (
  id                    BIGSERIAL       PRIMARY KEY,
  version_id            BIGINT          NOT NULL,
  line_item_name        TEXT            NOT NULL,
  annual_amount         DECIMAL(15,4)   NOT NULL,
  distribution_method   TEXT            NOT NULL,
  weight_array          JSONB,
  specific_months       INTEGER[],
  ifrs_category         TEXT            NOT NULL,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by            BIGINT          NOT NULL,
  updated_by            BIGINT,

  CONSTRAINT other_revenue_version_fk      FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT other_revenue_created_by_fk   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT other_revenue_updated_by_fk   FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  -- S-02: Negative amounts allowed for Social Aid / Bourses deduction items (FR-REV-016).
  -- A lower-bound guard prevents runaway data errors; no upper-bound restriction needed.
  CONSTRAINT other_revenue_amount_check    CHECK (annual_amount > -1000000000),
  CONSTRAINT other_revenue_method_check    CHECK (distribution_method IN ('ACADEMIC_10', 'YEAR_ROUND_12', 'CUSTOM_WEIGHTS', 'SPECIFIC_PERIOD')),
  -- S-17: ifrs_category constrained to the same enumeration as ifrs_line_items (FR-REV-013).
  CONSTRAINT other_revenue_ifrs_check      CHECK (ifrs_category IN (
    'REVENUE_FROM_CONTRACTS',
    'OTHER_OPERATING_INCOME',
    'EMPLOYEE_BENEFITS_EXPENSE',
    'DEPRECIATION_AMORTIZATION',
    'OPERATING_EXPENSES',
    'FINANCE_INCOME',
    'FINANCE_COSTS',
    'ZAKAT'
  )),
  CONSTRAINT other_revenue_name_unique     UNIQUE (version_id, line_item_name),
  -- S-24: Validate that specific_months elements are valid calendar months (1-12).
  -- Uses ALL operator (no subquery) to check every element in the array.
  -- array_length check ensures the array is non-empty when provided.
  CONSTRAINT other_revenue_specific_months_check CHECK (
    specific_months IS NULL OR (
      array_length(specific_months, 1) >= 1
      AND 1 <= ALL(specific_months)
      AND 12 >= ALL(specific_months)
    )
  )
);

COMMENT ON TABLE other_revenue_items IS 'Non-tuition revenue: cantine, transport, DAI, AEFE subventions, etc. Each item defines how its annual_amount is distributed across 12 months.';
COMMENT ON COLUMN other_revenue_items.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN other_revenue_items.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN other_revenue_items.line_item_name IS 'Descriptive name (e.g., "Cantine Revenue", "Transport Services"). Unique within a version.';
COMMENT ON COLUMN other_revenue_items.annual_amount IS 'Total annual amount for this line item. DECIMAL(15,4). Negative values are permitted for Social Aid / Bourses deduction items (e.g., Bourses AEFE, Bourses AESH) per FR-REV-016.';
COMMENT ON COLUMN other_revenue_items.distribution_method IS 'How to spread annual_amount across months: ACADEMIC_10 (10 academic months, 0 for Jul-Aug), YEAR_ROUND_12 (equal 12-month split), CUSTOM_WEIGHTS (use weight_array), SPECIFIC_PERIOD (only in specific_months).';
COMMENT ON COLUMN other_revenue_items.weight_array IS 'JSON array of 12 decimal values summing to 1.0. Required when distribution_method = CUSTOM_WEIGHTS. Each element is the fraction allocated to that month (index 0 = January).';
COMMENT ON COLUMN other_revenue_items.specific_months IS 'Integer array of month numbers (1-12). Required when distribution_method = SPECIFIC_PERIOD. Amount is split equally across these months.';
COMMENT ON COLUMN other_revenue_items.ifrs_category IS 'IFRS 15 revenue classification for this line item (e.g., "REVENUE_FROM_CONTRACTS", "OTHER_OPERATING_INCOME").';
COMMENT ON COLUMN other_revenue_items.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN other_revenue_items.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN other_revenue_items.created_by IS 'FK to users who created this line item.';
COMMENT ON COLUMN other_revenue_items.updated_by IS 'FK to users who last modified this revenue item. SET NULL if that user is deleted.';

-- Index: FK column created_by (Phase 3)
CREATE INDEX other_revenue_items_created_by_idx ON other_revenue_items (created_by);

-- Index: list all other revenue items for a version
CREATE INDEX other_revenue_items_version_idx ON other_revenue_items (version_id);

-- Trigger: auto-update updated_at
CREATE TRIGGER other_revenue_items_updated_at_trigger
  BEFORE UPDATE ON other_revenue_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 11: monthly_revenue

Calculated output: monthly revenue broken down by grade, nationality, and tariff. Populated by the Revenue Engine. Zero for months 7-8 (summer).

```sql
CREATE TABLE monthly_revenue (
  id                      BIGSERIAL       PRIMARY KEY,
  version_id              BIGINT          NOT NULL,
  -- S-07: scenario_name discriminator enables storing multiple scenario outputs per version
  -- without overwriting each other, supporting FR-SCN-004 side-by-side scenario comparison.
  scenario_name           TEXT            NOT NULL DEFAULT 'Base',
  academic_period         TEXT            NOT NULL,
  grade_level             TEXT            NOT NULL,
  nationality             TEXT            NOT NULL,
  tariff                  TEXT            NOT NULL,
  month                   INTEGER         NOT NULL,
  gross_revenue_ht        DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  discount_amount         DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  scholarship_deduction   DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  net_revenue_ht          DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  vat_amount              DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  calculated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  calculated_by           BIGINT,
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT monthly_revenue_version_fk       FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT monthly_revenue_calculated_by_fk FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT monthly_revenue_period_check     CHECK (academic_period IN ('AY1', 'AY2')),
  -- S-10: grade_level constrained to canonical 15 values (PRD Appendix A).
  CONSTRAINT monthly_revenue_grade_check      CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT monthly_revenue_month_check      CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT monthly_revenue_scenario_check   CHECK (scenario_name IN ('Base', 'Optimistic', 'Pessimistic')),
  -- S-07: scenario_name added to unique key to allow multiple scenario outputs per version.
  CONSTRAINT monthly_revenue_composite_unique UNIQUE (version_id, scenario_name, academic_period, grade_level, nationality, tariff, month)
);

COMMENT ON TABLE monthly_revenue IS 'Calculated monthly revenue output. Populated by Revenue Engine. One row per grade/nationality/tariff/month combination. Months 7-8 (Jul-Aug) are zero (summer).';
COMMENT ON COLUMN monthly_revenue.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN monthly_revenue.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN monthly_revenue.scenario_name IS 'Scenario this row belongs to: Base (default), Optimistic, or Pessimistic. Allows side-by-side scenario comparison (FR-SCN-004) without re-running all calculations. The Revenue Engine passes the active scenario_name as a parameter; the P&L Engine aggregates by scenario_name.';
COMMENT ON COLUMN monthly_revenue.academic_period IS 'AY1 or AY2. Determines which fee grid and enrollment data were used.';
COMMENT ON COLUMN monthly_revenue.grade_level IS 'Grade identifier.';
COMMENT ON COLUMN monthly_revenue.nationality IS 'Nationality category from enrollment detail.';
COMMENT ON COLUMN monthly_revenue.tariff IS 'Tariff tier from enrollment detail.';
COMMENT ON COLUMN monthly_revenue.month IS 'Calendar month (1=Jan, 12=Dec). AY1 months: 1-6, AY2 months: 9-12, Summer (7-8): always zero.';
COMMENT ON COLUMN monthly_revenue.gross_revenue_ht IS 'Gross revenue excluding VAT before discounts and scholarships. = headcount * tuition_ht / period_months. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_revenue.discount_amount IS 'Discount deduction based on discount_policies rate. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_revenue.scholarship_deduction IS 'Scholarship allocation deduction per scenario_parameters.scholarship_allocation. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_revenue.net_revenue_ht IS 'Net revenue HT = gross_revenue_ht - discount_amount - scholarship_deduction. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_revenue.vat_amount IS 'VAT on net revenue. 15% for Francais and Autres, 0% for Nationaux. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_revenue.calculated_at IS 'Timestamp of the calculation run that produced this row.';
COMMENT ON COLUMN monthly_revenue.calculated_by IS 'FK to user who triggered the calculation. SET NULL if user deleted.';
COMMENT ON COLUMN monthly_revenue.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN monthly_revenue.updated_at IS 'Last modification timestamp.';

-- Index: P&L aggregation query (sum revenue by version and month)
CREATE INDEX monthly_revenue_version_month_idx ON monthly_revenue (version_id, month);

-- Index: revenue detail view by version and academic period
CREATE INDEX monthly_revenue_version_period_idx ON monthly_revenue (version_id, academic_period);

-- Index: FK column calculated_by (Phase 3)
CREATE INDEX monthly_revenue_calculated_by_idx ON monthly_revenue (calculated_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER monthly_revenue_updated_at_trigger
  BEFORE UPDATE ON monthly_revenue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 12: dhg_grille_config

DHG (Dotation Horaire Globale) teaching hour allocations per grade and subject. Defines the structural teaching requirements. Not version-scoped — represents the school's pedagogical structure. The `effective_from_year` allows grille changes across fiscal years.

```sql
CREATE TABLE dhg_grille_config (
  id                            BIGSERIAL       PRIMARY KEY,
  band                          TEXT            NOT NULL,
  grade_level                   TEXT            NOT NULL,
  subject                       TEXT            NOT NULL,
  hours_per_week_per_section    DECIMAL(7,4)    NOT NULL,
  dhg_type                      TEXT            NOT NULL,
  effective_from_year           INTEGER,
  created_at                    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by                    BIGINT,
  updated_by                    BIGINT,

  CONSTRAINT dhg_grille_band_check    CHECK (band IN ('Maternelle', 'Elementaire', 'College', 'Lycee')),
  -- S-10: grade_level constrained to canonical 15 values (PRD Appendix A).
  CONSTRAINT dhg_grille_grade_check   CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT dhg_grille_hours_check   CHECK (hours_per_week_per_section >= 0),
  CONSTRAINT dhg_grille_type_check    CHECK (dhg_type IN ('Structural', 'Host_Country', 'Complementary')),
  -- S-08: UNIQUE constraint removed. PostgreSQL NULL != NULL semantics allow duplicate (band, grade_level, subject)
  -- rows when effective_from_year IS NULL, producing duplicate default-grille rows and incorrect FTE calculations.
  -- Replaced with two partial unique indexes below.
  CONSTRAINT dhg_grille_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT dhg_grille_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE dhg_grille_config IS 'DHG grille: teaching hours per subject per grade per section. Used by DHG engine to compute total weekly hours and FTE requirements. Not version-scoped.';
COMMENT ON COLUMN dhg_grille_config.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN dhg_grille_config.band IS 'School division: Maternelle, Elementaire, College, or Lycee.';
COMMENT ON COLUMN dhg_grille_config.grade_level IS 'Grade identifier within the band.';
COMMENT ON COLUMN dhg_grille_config.subject IS 'Teaching subject (e.g., "Francais", "Mathematiques", "Arabe", "EPS").';
COMMENT ON COLUMN dhg_grille_config.hours_per_week_per_section IS 'Weekly teaching hours required for this subject per section (class group). DECIMAL(7,4).';
COMMENT ON COLUMN dhg_grille_config.dhg_type IS 'DHG category: Structural (core curriculum), Host_Country (Arabic, Islamic studies — KSA requirement), Complementary (electives, support).';
COMMENT ON COLUMN dhg_grille_config.effective_from_year IS 'Fiscal year this grille version applies from. NULL means it applies to all years (default grille). Uniqueness for NULL rows is enforced via a partial unique index (not a standard UNIQUE constraint) because PostgreSQL NULL != NULL semantics would allow duplicate default rows under a standard constraint.';
COMMENT ON COLUMN dhg_grille_config.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN dhg_grille_config.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN dhg_grille_config.created_by IS 'FK to users who configured this grille. SET NULL if user deleted.';
COMMENT ON COLUMN dhg_grille_config.updated_by IS 'FK to users who last modified this grille entry. SET NULL if user deleted.';

-- Index: DHG calculation lookup by band and grade
CREATE INDEX dhg_grille_band_grade_idx ON dhg_grille_config (band, grade_level);

-- Index: FK column created_by (Phase 3)
CREATE INDEX dhg_grille_config_created_by_idx ON dhg_grille_config (created_by);

-- S-08: Partial unique index for default grille rows (effective_from_year IS NULL).
-- Prevents duplicate default-grille rows; a standard UNIQUE constraint would allow duplicates
-- because PostgreSQL treats NULL != NULL, making (band, grade_level, subject, NULL) non-unique.
CREATE UNIQUE INDEX dhg_grille_default_unique
  ON dhg_grille_config (band, grade_level, subject)
  WHERE effective_from_year IS NULL;

-- S-08: Partial unique index for year-specific grille rows (effective_from_year IS NOT NULL).
CREATE UNIQUE INDEX dhg_grille_year_unique
  ON dhg_grille_config (band, grade_level, subject, effective_from_year)
  WHERE effective_from_year IS NOT NULL;

-- Trigger: auto-update updated_at
CREATE TRIGGER dhg_grille_config_updated_at_trigger
  BEFORE UPDATE ON dhg_grille_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 13: dhg_requirements

Calculated output: sections needed and FTE requirements per grade and academic period. Populated by the DHG Engine based on enrollment headcount and dhg_grille_config.

```sql
CREATE TABLE dhg_requirements (
  id                          BIGSERIAL       PRIMARY KEY,
  version_id                  BIGINT          NOT NULL,
  academic_period             TEXT            NOT NULL,
  grade_level                 TEXT            NOT NULL,
  sections_needed             INTEGER         NOT NULL,
  total_dhg_hours_per_week    DECIMAL(10,4)   NOT NULL,
  fte_required                DECIMAL(10,4)   NOT NULL,
  ors_hours                   DECIMAL(5,4)    NOT NULL DEFAULT 18.0000,
  calculated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  calculated_by               BIGINT,
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_by                  BIGINT,

  CONSTRAINT dhg_requirements_version_fk       FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT dhg_requirements_calculated_by_fk FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT dhg_requirements_updated_by_fk    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT dhg_requirements_period_check     CHECK (academic_period IN ('AY1', 'AY2')),
  -- S-10: grade_level constrained to canonical 15 values (PRD Appendix A).
  CONSTRAINT dhg_requirements_grade_check      CHECK (grade_level IN ('PS','MS','GS','CP','CE1','CE2','CM1','CM2','6eme','5eme','4eme','3eme','2nde','1ere','Terminale')),
  CONSTRAINT dhg_requirements_sections_check   CHECK (sections_needed >= 0),
  CONSTRAINT dhg_requirements_composite_unique UNIQUE (version_id, academic_period, grade_level)
);

COMMENT ON TABLE dhg_requirements IS 'Calculated DHG output: sections needed and FTE requirements per grade. sections_needed = CEILING(headcount / max_class_size). FTE = total_weekly_hours / ORS.';
COMMENT ON COLUMN dhg_requirements.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN dhg_requirements.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN dhg_requirements.academic_period IS 'AY1 or AY2.';
COMMENT ON COLUMN dhg_requirements.grade_level IS 'Grade identifier.';
COMMENT ON COLUMN dhg_requirements.sections_needed IS 'Number of class sections required = CEILING(headcount / max_class_size). Integer.';
COMMENT ON COLUMN dhg_requirements.total_dhg_hours_per_week IS 'Sum of (hours_per_week_per_section * sections_needed) across all subjects for this grade. DECIMAL(10,4).';
COMMENT ON COLUMN dhg_requirements.fte_required IS 'Full-time equivalent teachers needed = total_dhg_hours_per_week / ors_hours. DECIMAL(10,4).';
COMMENT ON COLUMN dhg_requirements.ors_hours IS 'Obligation Reglementaire de Service: weekly teaching hours per FTE. Default 18h, configurable per scenario. DECIMAL(5,4).';
COMMENT ON COLUMN dhg_requirements.calculated_at IS 'Timestamp of the calculation run.';
COMMENT ON COLUMN dhg_requirements.calculated_by IS 'FK to user who triggered the calculation.';
COMMENT ON COLUMN dhg_requirements.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN dhg_requirements.updated_at IS 'Last modification timestamp.';
COMMENT ON COLUMN dhg_requirements.updated_by IS 'FK to user who last modified this row (e.g., manual override of sections_needed). SET NULL if user deleted.';

-- Index: DHG results for a version and period
CREATE INDEX dhg_requirements_version_period_idx ON dhg_requirements (version_id, academic_period);

-- Index: FK column calculated_by (Phase 3)
CREATE INDEX dhg_requirements_calculated_by_idx ON dhg_requirements (calculated_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER dhg_requirements_updated_at_trigger
  BEFORE UPDATE ON dhg_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 14: monthly_staff_costs

Calculated output: monthly cost breakdown per employee. Includes base gross, adjusted gross (after hourly percentage), GOSI, Ajeer, and EoS accrual. Populated by the Staff Cost Engine.

```sql
CREATE TABLE monthly_staff_costs (
  id                  BIGSERIAL       PRIMARY KEY,
  version_id          BIGINT          NOT NULL,
  employee_id         BIGINT          NOT NULL,
  month               INTEGER         NOT NULL,
  base_gross          DECIMAL(15,4)   NOT NULL,
  adjusted_gross      DECIMAL(15,4)   NOT NULL,
  hsa_included        BOOLEAN         NOT NULL,
  gosi_amount         DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  ajeer_amount        DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  eos_monthly_accrual DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  total_cost          DECIMAL(15,4)   NOT NULL,
  calculated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  calculated_by       BIGINT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  -- S-19: updated_at added for consistency with all other calculated output tables.
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT monthly_staff_costs_version_fk      FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT monthly_staff_costs_employee_fk     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT monthly_staff_costs_calculated_by_fk FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT monthly_staff_costs_month_check     CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT monthly_staff_costs_composite_unique UNIQUE (version_id, employee_id, month)
);

COMMENT ON TABLE monthly_staff_costs IS 'Calculated monthly staff cost output per employee. Populated by Staff Cost Engine. total_cost = adjusted_gross + gosi_amount + ajeer_amount + eos_monthly_accrual.';
COMMENT ON COLUMN monthly_staff_costs.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN monthly_staff_costs.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN monthly_staff_costs.employee_id IS 'FK to employees. CASCADE delete (if employee record removed from version, costs are removed too).';
COMMENT ON COLUMN monthly_staff_costs.month IS 'Calendar month (1=Jan, 12=Dec).';
COMMENT ON COLUMN monthly_staff_costs.base_gross IS 'Pre-adjustment gross: base + housing + transport + premium + HSA (if applicable). Months 9-12 include augmentation. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_staff_costs.adjusted_gross IS 'After hourly_percentage factor: base_gross * hourly_percentage. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_staff_costs.hsa_included IS 'FALSE for months 7-8 (Jul-Aug summer). TRUE for all other months. HSA excluded from gross during summer.';
COMMENT ON COLUMN monthly_staff_costs.gosi_amount IS 'GOSI employer contribution: 11.75% of adjusted_gross for Saudi employees. 0 for non-Saudi. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_staff_costs.ajeer_amount IS 'Ajeer levy + monthly fee for non-Saudi Ajeer employees. 0 for Saudi. Prorated for New employees joining in AY2. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_staff_costs.eos_monthly_accrual IS 'End-of-Service monthly provision = annual_eos_provision / 12. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_staff_costs.total_cost IS 'Total employer cost = adjusted_gross + gosi_amount + ajeer_amount + eos_monthly_accrual. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_staff_costs.calculated_at IS 'Timestamp of the calculation run.';
COMMENT ON COLUMN monthly_staff_costs.calculated_by IS 'FK to user who triggered the calculation.';
COMMENT ON COLUMN monthly_staff_costs.created_at IS 'Row creation timestamp.';
-- S-19: updated_at tracks last UPSERT timestamp for consistency with sibling output tables.
COMMENT ON COLUMN monthly_staff_costs.updated_at IS 'Auto-updated on every UPSERT via trigger. Consistent with monthly_revenue, dhg_requirements, monthly_budget_summary. DECIMAL(15,4) monetary columns are immutable once written — updated_at records when the last recalculation overwrote this row.';

-- Index: P&L aggregation (sum costs by version and month)
CREATE INDEX monthly_staff_costs_version_month_idx ON monthly_staff_costs (version_id, month);

-- Index: employee cost detail view (all months for one employee in a version)
CREATE INDEX monthly_staff_costs_version_employee_idx ON monthly_staff_costs (version_id, employee_id);

-- Index: FK column calculated_by (Phase 3)
CREATE INDEX monthly_staff_costs_calculated_by_idx ON monthly_staff_costs (calculated_by);

-- Trigger: auto-update updated_at (S-19)
CREATE TRIGGER monthly_staff_costs_updated_at_trigger
  BEFORE UPDATE ON monthly_staff_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 15: eos_provisions

End-of-Service provision calculations per employee. Uses YEARFRAC US 30/360 (TC-002) to compute years of service and applies the KSA Labor Law brackets (<=5 years: 0.5 month per year; >5 years: 1 month per year for the excess).

```sql
CREATE TABLE eos_provisions (
  id                  BIGSERIAL       PRIMARY KEY,
  version_id          BIGINT          NOT NULL,
  employee_id         BIGINT          NOT NULL,
  as_of_date          DATE            NOT NULL,
  years_of_service    DECIMAL(7,4)    NOT NULL,
  eos_base            DECIMAL(15,4)   NOT NULL,
  -- S-16: opening_provision = EoS(Dec prior year) for the same employee.
  -- Allows computing annual_fy_charge = provision_amount - opening_provision (PRD §10.3).
  opening_provision   DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  -- S-16: annual_fy_charge = provision_amount - opening_provision.
  -- Computed and stored at calculation time to avoid re-querying prior year versions.
  annual_fy_charge    DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  provision_amount    DECIMAL(15,4)   NOT NULL,
  monthly_accrual     DECIMAL(15,4)   NOT NULL,
  calculation_note    TEXT,
  calculated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  calculated_by       BIGINT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  -- S-20: updated_at added for consistency with sibling calculated output tables.
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT eos_provisions_version_fk       FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT eos_provisions_employee_fk      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT eos_provisions_calculated_by_fk FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT eos_provisions_composite_unique UNIQUE (version_id, employee_id, as_of_date)
);

COMMENT ON TABLE eos_provisions IS 'End-of-Service provision per employee. years_of_service computed via YEARFRAC US 30/360 (TC-002). KSA Labor Law: <=5yr = 0.5 month/yr, >5yr = 1 month/yr for excess.';
COMMENT ON COLUMN eos_provisions.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN eos_provisions.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN eos_provisions.employee_id IS 'FK to employees. CASCADE delete.';
COMMENT ON COLUMN eos_provisions.as_of_date IS 'Reference date for YoS calculation. Typically December 31 of the budget fiscal year.';
COMMENT ON COLUMN eos_provisions.years_of_service IS 'YEARFRAC(joining_date, as_of_date) using US 30/360 day-count convention (TC-002). DECIMAL(7,4).';
COMMENT ON COLUMN eos_provisions.eos_base IS 'EoS base salary = base + housing + transport + premium (excludes HSA). DECIMAL(15,4).';
COMMENT ON COLUMN eos_provisions.opening_provision IS 'EoS provision at December 31 of the prior fiscal year for this employee. Sourced from the prior year''s eos_provisions row (same employee_id, as_of_date = prior year Dec 31). 0.0000 for employees with no prior year record (first year of employment). DECIMAL(15,4).';
COMMENT ON COLUMN eos_provisions.annual_fy_charge IS 'Annual FY charge = provision_amount - opening_provision (PRD §10.3). Represents the incremental EoS cost for this fiscal year. Written to monthly_staff_costs.eos_monthly_accrual = annual_fy_charge / 12. DECIMAL(15,4).';
COMMENT ON COLUMN eos_provisions.provision_amount IS 'Closing EoS provision = total liability as of as_of_date. For YoS<=5: (YoS * eos_base * 0.5) / year. For YoS>5: (5 * eos_base * 0.5 + (YoS-5) * eos_base) / year. DECIMAL(15,4).';
COMMENT ON COLUMN eos_provisions.monthly_accrual IS 'provision_amount / 12. Written to monthly_staff_costs.eos_monthly_accrual. DECIMAL(15,4).';
COMMENT ON COLUMN eos_provisions.calculation_note IS 'Documents the YoS bracket applied and any edge cases (e.g., "YoS=3.2500, bracket <=5yr, rate=0.5").';
COMMENT ON COLUMN eos_provisions.calculated_at IS 'Timestamp of the calculation run.';
COMMENT ON COLUMN eos_provisions.calculated_by IS 'FK to user who triggered the calculation.';
COMMENT ON COLUMN eos_provisions.created_at IS 'Row creation timestamp.';
-- S-20: updated_at tracks recalculation timestamp for consistency with sibling output tables.
COMMENT ON COLUMN eos_provisions.updated_at IS 'Auto-updated on every UPSERT via trigger. Consistent with monthly_staff_costs and other calculated output tables.';

-- Index: EoS lookup by version and employee
CREATE INDEX eos_provisions_version_employee_idx ON eos_provisions (version_id, employee_id);

-- Index: FK column calculated_by (Phase 3)
CREATE INDEX eos_provisions_calculated_by_idx ON eos_provisions (calculated_by);

-- Trigger: auto-update updated_at (S-20)
CREATE TRIGGER eos_provisions_updated_at_trigger
  BEFORE UPDATE ON eos_provisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 16: monthly_budget_summary

Consolidated P&L summary per month. Populated by the P&L Engine after revenue and staff costs are calculated. This is the primary output table for dashboard display and report generation.

```sql
CREATE TABLE monthly_budget_summary (
  id                          BIGSERIAL       PRIMARY KEY,
  version_id                  BIGINT          NOT NULL,
  -- S-07: scenario_name discriminator mirrors monthly_revenue.scenario_name (FR-SCN-004).
  scenario_name               TEXT            NOT NULL DEFAULT 'Base',
  month                       INTEGER         NOT NULL,
  total_tuition_revenue_ht    DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  total_other_revenue_ht      DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  total_revenue_ht            DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  total_local_staff_costs     DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  total_employer_charges      DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  total_additional_costs      DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  total_staff_costs           DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  gross_profit                DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  other_operating_expenses    DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  ebitda                      DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  depreciation_amortization   DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  operating_profit            DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  net_finance_income          DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  profit_before_zakat         DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  zakat                       DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  net_profit                  DECIMAL(15,4)   NOT NULL DEFAULT 0.0000,
  calculated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  calculated_by               BIGINT,
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  -- S-21: updated_at added for consistency with monthly_revenue and other output tables.
  updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT monthly_budget_summary_version_fk       FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT monthly_budget_summary_calculated_by_fk FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT monthly_budget_summary_month_check      CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT monthly_budget_summary_scenario_check   CHECK (scenario_name IN ('Base', 'Optimistic', 'Pessimistic')),
  -- S-07: scenario_name added to unique key (FR-SCN-004).
  CONSTRAINT monthly_budget_summary_composite_unique UNIQUE (version_id, scenario_name, month)
);

COMMENT ON TABLE monthly_budget_summary IS 'Consolidated monthly P&L summary. Primary output for dashboards and reports. Populated by P&L Engine after revenue and staff cost calculations.';
COMMENT ON COLUMN monthly_budget_summary.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN monthly_budget_summary.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN monthly_budget_summary.scenario_name IS 'Scenario this P&L row belongs to: Base, Optimistic, or Pessimistic. Mirrors monthly_revenue.scenario_name (FR-SCN-004). The P&L Engine aggregates monthly_revenue rows for the matching scenario_name.';
COMMENT ON COLUMN monthly_budget_summary.month IS 'Calendar month (1=Jan, 12=Dec).';
COMMENT ON COLUMN monthly_budget_summary.total_tuition_revenue_ht IS 'SUM of monthly_revenue.net_revenue_ht for this month. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.total_other_revenue_ht IS 'SUM of other_revenue_items distributed to this month. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.total_revenue_ht IS 'total_tuition_revenue_ht + total_other_revenue_ht. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.total_local_staff_costs IS 'SUM of monthly_staff_costs.adjusted_gross for this month. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.total_employer_charges IS 'SUM of GOSI + EoS accrual + Ajeer for this month. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.total_additional_costs IS 'Residents, replacements, training, and other additional staff-related costs. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.total_staff_costs IS 'total_local_staff_costs + total_employer_charges + total_additional_costs. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.gross_profit IS 'total_revenue_ht - total_staff_costs. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.other_operating_expenses IS 'Non-staff operating expenses (facilities, materials, utilities, etc.). DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.ebitda IS 'gross_profit - other_operating_expenses. Earnings Before Interest, Tax, Depreciation, Amortization. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.depreciation_amortization IS 'D&A charge for the month. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.operating_profit IS 'ebitda - depreciation_amortization. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.net_finance_income IS 'Finance income minus finance costs (e.g., bank interest, late payment penalties). DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.profit_before_zakat IS 'operating_profit + net_finance_income. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.zakat IS 'Zakat liability: MAX(0, profit_before_zakat * 0.025). DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.net_profit IS 'profit_before_zakat - zakat. Final bottom line. DECIMAL(15,4).';
COMMENT ON COLUMN monthly_budget_summary.calculated_at IS 'Timestamp of the P&L calculation run.';
COMMENT ON COLUMN monthly_budget_summary.calculated_by IS 'FK to user who triggered the P&L calculation.';
COMMENT ON COLUMN monthly_budget_summary.created_at IS 'Row creation timestamp.';
-- S-21: updated_at tracks recalculation timestamp for UPSERT idempotency and audit consistency.
COMMENT ON COLUMN monthly_budget_summary.updated_at IS 'Auto-updated on every UPSERT via trigger. Consistent with monthly_revenue and other calculated output tables.';

-- Index: version comparison queries (load all 12 months for a version)
CREATE INDEX monthly_budget_summary_version_idx ON monthly_budget_summary (version_id);

-- Index: FK column calculated_by (Phase 3)
CREATE INDEX monthly_budget_summary_calculated_by_idx ON monthly_budget_summary (calculated_by);

-- Trigger: auto-update updated_at (S-21)
CREATE TRIGGER monthly_budget_summary_updated_at_trigger
  BEFORE UPDATE ON monthly_budget_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 17: ifrs_line_items

IFRS-classified financial line items for standards-compliant P&L reporting. Generated alongside monthly_budget_summary by the P&L Engine.

```sql
CREATE TABLE ifrs_line_items (
  id              BIGSERIAL       PRIMARY KEY,
  version_id      BIGINT          NOT NULL,
  -- S-07 awareness: scenario_name matches monthly_budget_summary.scenario_name.
  scenario_name   TEXT            NOT NULL DEFAULT 'Base',
  month           INTEGER         NOT NULL,
  ifrs_category   TEXT            NOT NULL,
  ifrs_sub_category TEXT          NOT NULL,
  ifrs_standard   TEXT,
  amount_ht       DECIMAL(15,4)   NOT NULL,
  line_order      INTEGER         NOT NULL DEFAULT 0,
  calculated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  -- S-12: calculated_by FK added — consistent with all other calculated output tables.
  calculated_by   BIGINT,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  -- S-12: updated_at added — consistent with all other calculated output tables.
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT ifrs_line_items_version_fk        FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT ifrs_line_items_calculated_by_fk  FOREIGN KEY (calculated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ifrs_line_items_month_check        CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT ifrs_line_items_scenario_check     CHECK (scenario_name IN ('Base', 'Optimistic', 'Pessimistic')),
  -- S-14: ifrs_category CHECK — IFRS categories are a fixed regulatory enumeration.
  CONSTRAINT ifrs_line_items_category_check     CHECK (ifrs_category IN (
    'REVENUE_FROM_CONTRACTS',
    'OTHER_OPERATING_INCOME',
    'EMPLOYEE_BENEFITS_EXPENSE',
    'DEPRECIATION_AMORTIZATION',
    'OPERATING_EXPENSES',
    'FINANCE_INCOME',
    'FINANCE_COSTS',
    'ZAKAT'
  )),
  -- S-13: composite UNIQUE — prevents duplicate rows on re-calculation (other output tables use UPSERT).
  CONSTRAINT ifrs_line_items_composite_unique   UNIQUE (version_id, scenario_name, month, ifrs_category, ifrs_sub_category)
);

COMMENT ON TABLE ifrs_line_items IS 'IFRS-classified P&L line items for standards-compliant reporting. Generated by P&L Engine. Each row is a single line item for one month.';
COMMENT ON COLUMN ifrs_line_items.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN ifrs_line_items.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN ifrs_line_items.month IS 'Calendar month (1=Jan, 12=Dec).';
COMMENT ON COLUMN ifrs_line_items.ifrs_category IS 'Top-level IFRS classification (e.g., "REVENUE_FROM_CONTRACTS", "EMPLOYEE_BENEFITS_EXPENSE", "OPERATING_EXPENSES").';
COMMENT ON COLUMN ifrs_line_items.ifrs_sub_category IS 'Detailed sub-category (e.g., "Tuition Fees - Maternelle Plein", "GOSI Employer Contribution").';
COMMENT ON COLUMN ifrs_line_items.ifrs_standard IS 'Applicable IFRS standard reference (e.g., "IFRS 15", "IAS 19", "IAS 1"). NULL if no specific standard applies.';
COMMENT ON COLUMN ifrs_line_items.amount_ht IS 'Amount excluding VAT. All IFRS reporting uses HT values per IFRS 15. DECIMAL(15,4).';
COMMENT ON COLUMN ifrs_line_items.line_order IS 'Display order within a category for structured P&L presentation. Lower values appear first.';
COMMENT ON COLUMN ifrs_line_items.scenario_name IS 'Scenario label matching monthly_budget_summary.scenario_name.';
COMMENT ON COLUMN ifrs_line_items.calculated_at IS 'Timestamp of the calculation run.';
COMMENT ON COLUMN ifrs_line_items.calculated_by IS 'FK to user who triggered the P&L calculation. SET NULL if user deleted.';
COMMENT ON COLUMN ifrs_line_items.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN ifrs_line_items.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';

-- Index: IFRS P&L report query (version + month + category)
CREATE INDEX ifrs_line_items_version_month_category_idx ON ifrs_line_items (version_id, month, ifrs_category);

-- Trigger: auto-update updated_at
CREATE TRIGGER ifrs_line_items_updated_at_trigger
  BEFORE UPDATE ON ifrs_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 18: scenario_parameters

Per-version scenario assumptions. Each version can have Base, Optimistic, and Pessimistic parameter sets. These feed into the calculation engines as adjustment factors.

```sql
CREATE TABLE scenario_parameters (
  id                        BIGSERIAL       PRIMARY KEY,
  version_id                BIGINT          NOT NULL,
  scenario_name             TEXT            NOT NULL,
  new_enrollment_factor     DECIMAL(7,6)    NOT NULL DEFAULT 1.000000,
  retention_adjustment      DECIMAL(7,6)    NOT NULL DEFAULT 1.000000,
  attrition_rate            DECIMAL(7,6)    NOT NULL DEFAULT 0.050000,
  fee_collection_rate       DECIMAL(7,6)    NOT NULL DEFAULT 0.950000,
  scholarship_allocation    DECIMAL(7,6)    NOT NULL DEFAULT 0.020000,
  ors_hours                 DECIMAL(5,4)    NOT NULL DEFAULT 18.0000,
  created_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by                BIGINT          NOT NULL,
  updated_by                BIGINT,

  CONSTRAINT scenario_params_version_fk    FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT scenario_params_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT scenario_params_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT scenario_params_name_check    CHECK (scenario_name IN ('Base', 'Optimistic', 'Pessimistic')),
  CONSTRAINT scenario_params_composite_unique UNIQUE (version_id, scenario_name)
);

COMMENT ON TABLE scenario_parameters IS 'Scenario assumptions per version. Three named scenarios (Base, Optimistic, Pessimistic) with adjustable factors that feed into calculation engines.';
COMMENT ON COLUMN scenario_parameters.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN scenario_parameters.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN scenario_parameters.scenario_name IS 'Scenario label: Base (default assumptions), Optimistic (higher enrollment/retention), Pessimistic (lower enrollment, higher attrition).';
COMMENT ON COLUMN scenario_parameters.new_enrollment_factor IS 'Multiplier for new student enrollment projections. 1.0 = no change. >1.0 = more optimistic. DECIMAL(7,6).';
COMMENT ON COLUMN scenario_parameters.retention_adjustment IS 'Multiplier for student retention rates. 1.0 = no change. DECIMAL(7,6).';
COMMENT ON COLUMN scenario_parameters.attrition_rate IS 'Expected student attrition rate (fraction). Default 5%. DECIMAL(7,6).';
COMMENT ON COLUMN scenario_parameters.fee_collection_rate IS 'Expected fee collection rate (fraction). Default 95%. DECIMAL(7,6).';
COMMENT ON COLUMN scenario_parameters.scholarship_allocation IS 'Fraction of gross revenue allocated to scholarships. Default 2%. DECIMAL(7,6).';
COMMENT ON COLUMN scenario_parameters.ors_hours IS 'ORS (Obligation Reglementaire de Service) weekly hours per FTE. Default 18h. Adjustable per scenario. DECIMAL(5,4).';
COMMENT ON COLUMN scenario_parameters.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN scenario_parameters.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN scenario_parameters.created_by IS 'FK to users who configured this scenario.';
COMMENT ON COLUMN scenario_parameters.updated_by IS 'FK to users who last modified this scenario configuration. SET NULL if that user is deleted.';

-- Index: scenario lookup by version
CREATE INDEX scenario_parameters_version_idx ON scenario_parameters (version_id);

-- Index: FK column created_by (Phase 3)
CREATE INDEX scenario_parameters_created_by_idx ON scenario_parameters (created_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER scenario_parameters_updated_at_trigger
  BEFORE UPDATE ON scenario_parameters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Enum: audit_operation

Defines the set of auditable event types used by the `audit_entries` table. Using a PostgreSQL ENUM enforces type safety at the database level and provides clearer schema documentation than an inline CHECK constraint. See also 05_security.md §Audit Logging.

```sql
-- =============================================================================
-- ENUM: audit_operation
-- All recognised audit event types. See also 05_security.md §Audit Logging.
-- =============================================================================
CREATE TYPE audit_operation AS ENUM (
  'INSERT',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'VERSION_TRANSITION',
  'CALCULATION_RUN',
  'ACCOUNT_LOCKOUT',
  'EXPORT_DOWNLOAD'
);
```

---

### Table 19: audit_entries

Append-only audit trail. No UPDATE or DELETE permitted for the application role. Captures every data modification, authentication event, version transition, and calculation run.

```sql
CREATE TABLE audit_entries (
  id              BIGSERIAL        PRIMARY KEY,
  occurred_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  user_id         BIGINT,
  user_email      TEXT,
  table_name      TEXT             NOT NULL,
  record_id       BIGINT,
  operation       audit_operation  NOT NULL,  -- See also 05_security.md §Audit Logging
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  session_id      TEXT,
  audit_note      TEXT
);

COMMENT ON TABLE audit_entries IS 'Append-only audit log. Application role has INSERT+SELECT only — no UPDATE or DELETE permitted. 7-year retention per NFR 11.5. Archived to cold storage after 3 years.';
COMMENT ON COLUMN audit_entries.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN audit_entries.occurred_at IS 'Timestamp of the audited event. Indexed DESC for recent-first queries.';
COMMENT ON COLUMN audit_entries.user_id IS 'User who performed the action. NULL for system-initiated operations. No FK to avoid circular dependency and preserve audit if user is hard-deleted.';
COMMENT ON COLUMN audit_entries.user_email IS 'Denormalized email at the time of the event. Preserved even if user record changes or is deactivated. Ensures audit durability.';
COMMENT ON COLUMN audit_entries.table_name IS 'Name of the database table affected by the operation.';
COMMENT ON COLUMN audit_entries.record_id IS 'Primary key of the affected record. NULL for non-record operations (LOGIN, LOGOUT).';
COMMENT ON COLUMN audit_entries.operation IS 'Type of audited event (audit_operation ENUM): INSERT, UPDATE, DELETE (data ops), LOGIN, LOGOUT (auth events), VERSION_TRANSITION (status changes), CALCULATION_RUN (engine executions), ACCOUNT_LOCKOUT (account locked after 5 failed attempts — NFR 11.3.2), EXPORT_DOWNLOAD (file download event — NFR 11.10). See also 05_security.md §Audit Logging.';
COMMENT ON COLUMN audit_entries.old_values IS 'JSONB snapshot of the record before modification. NULL for INSERT and LOGIN/LOGOUT operations.';
COMMENT ON COLUMN audit_entries.new_values IS 'JSONB snapshot of the record after modification. NULL for DELETE and LOGIN/LOGOUT operations.';
COMMENT ON COLUMN audit_entries.ip_address IS 'Client IP address at the time of the event. INET type for efficient storage and query.';
COMMENT ON COLUMN audit_entries.session_id IS 'JWT session identifier or request correlation ID for grouping related audit entries.';
COMMENT ON COLUMN audit_entries.audit_note IS 'Optional free-text explanation (e.g., "Bulk import from Staff_Costs spreadsheet", "Version published by CAO").';

-- Revoke mutating privileges from application user.
-- Execute as superuser during initial database setup:
-- REVOKE UPDATE, DELETE ON audit_entries FROM app_user;
-- GRANT INSERT, SELECT ON audit_entries TO app_user;

-- Index: recent audit entries (dashboard, admin review)
CREATE INDEX audit_entries_occurred_at_idx ON audit_entries (occurred_at DESC);

-- Index: filter by user (user activity review)
CREATE INDEX audit_entries_user_id_idx ON audit_entries (user_id);

-- Index: filter by table (table-specific audit history)
CREATE INDEX audit_entries_table_name_idx ON audit_entries (table_name);

-- Index: composite partial index for recent user activity queries (Phase 3 I-02 ADVISORY).
-- audit_entries is projected to grow to 10M+ rows over the 7-year retention period.
-- The most common admin query is: recent entries for a specific user (last 1 year).
-- This partial index covers that query pattern efficiently.
CREATE INDEX audit_entries_user_recent_idx ON audit_entries (user_id, occurred_at DESC)
  WHERE occurred_at > NOW() - INTERVAL '1 year';

-- Index: filter by operation type
CREATE INDEX audit_entries_operation_idx ON audit_entries (operation);
```

---

### Table 20: system_config

Key-value store for global system parameters. Single source of truth for rates, thresholds, and configuration values used across all calculation engines.

```sql
CREATE TABLE system_config (
  key          TEXT         PRIMARY KEY,
  value        TEXT         NOT NULL,
  description  TEXT         NOT NULL,
  data_type    TEXT         NOT NULL,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by   BIGINT,

  CONSTRAINT system_config_data_type_check CHECK (data_type IN ('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON')),
  CONSTRAINT system_config_updated_by_fk   FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE system_config IS 'Global configuration key-value store. Stores system-wide parameters used by all calculation engines. Values are text; data_type indicates how to parse them.';
COMMENT ON COLUMN system_config.key IS 'Configuration key (primary key). Naming convention: snake_case (e.g., fiscal_year, vat_rate).';
COMMENT ON COLUMN system_config.value IS 'Configuration value as text. Parse according to data_type column.';
COMMENT ON COLUMN system_config.description IS 'Human-readable description of what this parameter controls and its expected format.';
COMMENT ON COLUMN system_config.data_type IS 'Data type hint for parsing: STRING, INTEGER, DECIMAL, BOOLEAN, or JSON.';
COMMENT ON COLUMN system_config.updated_at IS 'Last modification timestamp.';
COMMENT ON COLUMN system_config.updated_by IS 'FK to users who last updated this value. SET NULL if user deleted.';

-- Index: FK column updated_by — low traffic (system_config is rarely modified) (Phase 3 ADVISORY)
CREATE INDEX system_config_updated_by_idx ON system_config (updated_by);

-- Trigger: auto-update updated_at
CREATE TRIGGER system_config_updated_at_trigger
  BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Seed data for default system configuration:**

```sql
INSERT INTO system_config (key, value, description, data_type) VALUES
  ('fiscal_year', '2026', 'Current fiscal year for budget planning.', 'INTEGER'),
  ('vat_rate', '0.150000', 'Saudi Arabia VAT rate (15%). Applied to non-Nationaux tuition.', 'DECIMAL'),
  ('gosi_rate_saudi', '0.117500', 'GOSI employer contribution rate for Saudi employees (11.75%).', 'DECIMAL'),
  -- S-29: gosi_rate_non_saudi is stored for reference only. The Staff Cost Engine does NOT use this
  -- rate — non-Saudi GOSI is employee-only (not employer-funded) in the EFIR model (TDD §5.2 Flow 3).
  -- gosi_amount = 0 for all non-Saudi employees regardless of this value.
  ('gosi_rate_non_saudi', '0.020000', 'GOSI rate for non-Saudi employees — REFERENCE ONLY, NOT USED BY EMPLOYER COST MODEL. Non-Saudi GOSI is employee-only, not employer-funded in this model. gosi_amount = 0 for all non-Saudi employees (see TDD §5.2 Flow 3 step 3b).', 'DECIMAL'),
  ('ajeer_levy_nitaqat', '1500', 'Annual Ajeer levy per non-Saudi employee (Nitaqat-compliant employer) in SAR.', 'INTEGER'),
  ('ajeer_levy_non_nitaqat', '9500', 'Annual Ajeer levy per non-Saudi employee (non-Nitaqat-compliant) in SAR.', 'INTEGER'),
  ('ajeer_monthly_fee', '160', 'Monthly Ajeer platform fee per non-Saudi employee in SAR.', 'INTEGER'),
  ('academic_week_count', '36', 'Number of instructional weeks in the academic year.', 'INTEGER'),
  ('default_ors_hours', '18.0000', 'Default ORS (Obligation Reglementaire de Service) weekly hours per FTE teacher.', 'DECIMAL'),
  ('zakat_rate', '0.025000', 'Zakat rate applied to profit before zakat (2.5%).', 'DECIMAL'),
  ('salary_encryption_key_id', 'SALARY_ENCRYPTION_KEY', 'Reference to the Docker secret / env var name holding the pgcrypto encryption key. The actual key is NEVER stored in this table.', 'STRING'),
  ('max_failed_login_attempts', '5', 'Number of consecutive failed login attempts before account lockout.', 'INTEGER'),
  ('lockout_duration_minutes', '30', 'Duration in minutes that a locked account remains locked.', 'INTEGER'),
  -- S-03: Reconciled with ADR-005 and ADR-012. Access token TTL = 30 min (not 15).
  ('jwt_access_token_ttl_minutes', '30', 'JWT access token time-to-live in minutes. Reconciled with ADR-005 (30-min stateless JWT). See ADR-012.', 'INTEGER'),
  -- S-04: Reconciled with ADR-005 and ADR-012. Refresh token TTL = 8 hours (not 7 days).
  -- Stored as hours for precision; field renamed to _hours to avoid unit confusion.
  ('jwt_refresh_token_ttl_hours', '8', 'JWT refresh token time-to-live in hours. Reconciled with ADR-005 (8-hour HTTP-only cookie). See ADR-012.', 'INTEGER'),
  ('export_download_ttl_minutes', '60', 'Export file download link expiry in minutes.', 'INTEGER');
```

---

### Table 21: calculation_audit_log

Tracks every calculation engine run with input snapshots, output summaries, timing, and status. Separate from audit_entries — this table is specifically for calculation reproducibility and debugging (NFR 11.12).

```sql
CREATE TABLE calculation_audit_log (
  id              BIGSERIAL    PRIMARY KEY,
  run_id          UUID         NOT NULL DEFAULT gen_random_uuid(),
  user_id         BIGINT,
  version_id      BIGINT,
  module          TEXT         NOT NULL,
  input_snapshot  JSONB,
  output_summary  JSONB,
  duration_ms     INTEGER,
  status          TEXT         NOT NULL,
  error_details   JSONB,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT calc_audit_user_fk    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT calc_audit_version_fk FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE SET NULL,
  -- S-15: DHG module added — DHG calculation runs are triggered separately via POST /calculate/dhg.
  CONSTRAINT calc_audit_module_check CHECK (module IN ('ENROLLMENT', 'REVENUE', 'STAFFING', 'PNL', 'DHG')),
  CONSTRAINT calc_audit_status_check CHECK (status IN ('STARTED', 'COMPLETED', 'FAILED'))
);

COMMENT ON TABLE calculation_audit_log IS 'Tracks calculation engine runs for debugging and compliance (NFR 11.12). Separate from audit_entries. Stores input snapshots and output summaries for reproducibility.';
COMMENT ON COLUMN calculation_audit_log.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN calculation_audit_log.run_id IS 'UUID identifying this specific calculation run. Used for correlation in logs and error reports.';
COMMENT ON COLUMN calculation_audit_log.user_id IS 'FK to user who triggered the calculation. SET NULL if user deleted.';
COMMENT ON COLUMN calculation_audit_log.version_id IS 'FK to budget_versions being calculated. SET NULL if version deleted.';
COMMENT ON COLUMN calculation_audit_log.module IS 'Calculation engine module: ENROLLMENT (validation), REVENUE, STAFFING, PNL, or DHG (separate engine triggered via POST /calculate/dhg).';
COMMENT ON COLUMN calculation_audit_log.input_snapshot IS 'JSONB summary or hash of inputs used (e.g., enrollment totals, fee grid checksums, employee count). For reproducibility.';
COMMENT ON COLUMN calculation_audit_log.output_summary IS 'JSONB summary of key outputs (e.g., total_revenue_ht, total_staff_costs, net_profit). For quick inspection.';
COMMENT ON COLUMN calculation_audit_log.duration_ms IS 'Calculation execution time in milliseconds. Used for performance monitoring.';
COMMENT ON COLUMN calculation_audit_log.status IS 'Run status: STARTED (in progress), COMPLETED (success), FAILED (error occurred — see error_details).';
COMMENT ON COLUMN calculation_audit_log.error_details IS 'JSONB error information if status = FAILED. Includes error message, stack trace summary, and failing step.';
COMMENT ON COLUMN calculation_audit_log.created_at IS 'Row creation timestamp.';

-- Index: lookup calculation history for a version and module (debugging, compliance review)
CREATE INDEX calc_audit_version_module_idx ON calculation_audit_log (version_id, module, created_at DESC);

-- Index: lookup by run_id for correlation
CREATE INDEX calc_audit_run_id_idx ON calculation_audit_log (run_id);

-- Index: FK column user_id — query recent calculations by a specific user (Phase 3)
CREATE INDEX calc_audit_user_id_idx ON calculation_audit_log (user_id);
```

---

### Table 22: export_jobs

Tracks asynchronous export operations (Excel, PDF, CSV). Jobs are queued, processed by the worker container, and expire after 1 hour. Job records are retained for 30 days.

```sql
CREATE TABLE export_jobs (
  id              BIGSERIAL    PRIMARY KEY,
  user_id         BIGINT       NOT NULL,
  version_id      BIGINT,
  format          TEXT         NOT NULL,
  report_type     TEXT         NOT NULL,
  -- S-23: Status values uppercased for consistency with all other status columns in the schema.
  status          TEXT         NOT NULL DEFAULT 'PENDING',
  file_path       TEXT,
  file_size_bytes BIGINT,
  expires_at      TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT export_jobs_user_fk     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT export_jobs_version_fk  FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE SET NULL,
  CONSTRAINT export_jobs_format_check CHECK (format IN ('xlsx', 'pdf', 'csv')),
  -- S-23: Uppercase values match the convention used by all other status columns.
  CONSTRAINT export_jobs_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED'))
);

COMMENT ON TABLE export_jobs IS 'Async export job tracking. Jobs are queued, processed by the worker container, and produce downloadable files. Files expire after 1 hour; job records retained 30 days.';
COMMENT ON COLUMN export_jobs.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN export_jobs.user_id IS 'FK to users who requested the export. CASCADE delete.';
COMMENT ON COLUMN export_jobs.version_id IS 'FK to budget_versions being exported. SET NULL if version deleted (job record preserved for audit).';
COMMENT ON COLUMN export_jobs.format IS 'Export file format: xlsx (Excel), pdf, or csv.';
COMMENT ON COLUMN export_jobs.report_type IS 'Report identifier (e.g., "REVENUE_DETAIL", "STAFF_COSTS", "PNL_MONTHLY", "IFRS_PL"). Determines which data and template are used.';
-- S-23: Status values uppercase for consistency with all other status columns.
COMMENT ON COLUMN export_jobs.status IS 'Job lifecycle: PENDING (queued), PROCESSING (worker picked up), DONE (file ready), FAILED (error — see error_message).';
COMMENT ON COLUMN export_jobs.file_path IS 'Server-side file path to the generated export. Populated when status = done.';
COMMENT ON COLUMN export_jobs.file_size_bytes IS 'Size of the generated file in bytes. Populated when status = done.';
COMMENT ON COLUMN export_jobs.expires_at IS 'Download link expiry timestamp. Set to NOW() + 1 hour when status transitions to done.';
COMMENT ON COLUMN export_jobs.error_message IS 'Error description if status = failed. Includes enough detail for debugging.';
COMMENT ON COLUMN export_jobs.created_at IS 'Job creation (queue) timestamp.';
COMMENT ON COLUMN export_jobs.updated_at IS 'Last status change timestamp. Auto-updated by trigger.';

-- Index: user's export history (most recent first)
CREATE INDEX export_jobs_user_status_idx ON export_jobs (user_id, status, created_at DESC);

-- Index: FK column version_id — find all exports for a given budget version (Phase 3)
CREATE INDEX export_jobs_version_id_idx ON export_jobs (version_id);

-- Index: partial index for worker queue — efficiently find PENDING/PROCESSING jobs (Phase 3 I-04 ADVISORY)
CREATE INDEX export_jobs_pending_idx ON export_jobs (created_at ASC)
  WHERE status IN ('PENDING', 'PROCESSING');

-- Trigger: auto-update updated_at
CREATE TRIGGER export_jobs_updated_at_trigger
  BEFORE UPDATE ON export_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 23: other_operating_costs

Input table for non-staff operating expenses (facilities, utilities, materials, D&A, finance items). Provides the source data for `monthly_budget_summary.other_operating_expenses`, `depreciation_amortization`, and `net_finance_income` populated by the P&L Engine. Added to resolve S-06 (missing P&L input source).

```sql
CREATE TABLE other_operating_costs (
  id                    BIGSERIAL       PRIMARY KEY,
  version_id            BIGINT          NOT NULL,
  -- S-07 awareness: scenario_name allows per-scenario OpEx assumptions.
  scenario_name         TEXT            NOT NULL DEFAULT 'Base',
  cost_category         TEXT            NOT NULL,
  line_item_name        TEXT            NOT NULL,
  annual_amount         DECIMAL(15,4)   NOT NULL,
  distribution_method   TEXT            NOT NULL,
  weight_array          JSONB,
  specific_months       INTEGER[],
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  created_by            BIGINT          NOT NULL,

  CONSTRAINT other_costs_version_fk       FOREIGN KEY (version_id) REFERENCES budget_versions(id) ON DELETE CASCADE,
  CONSTRAINT other_costs_created_by_fk    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT other_costs_scenario_check   CHECK (scenario_name IN ('Base', 'Optimistic', 'Pessimistic')),
  CONSTRAINT other_costs_category_check   CHECK (cost_category IN (
    'OPERATING_EXPENSES',
    'DEPRECIATION_AMORTIZATION',
    'FINANCE_INCOME',
    'FINANCE_COSTS'
  )),
  CONSTRAINT other_costs_method_check     CHECK (distribution_method IN ('ACADEMIC_10', 'YEAR_ROUND_12', 'CUSTOM_WEIGHTS', 'SPECIFIC_PERIOD')),
  CONSTRAINT other_costs_name_unique      UNIQUE (version_id, scenario_name, cost_category, line_item_name)
);

COMMENT ON TABLE other_operating_costs IS
  'Input table for non-staff P&L expenses: facilities, utilities, materials, D&A, and finance items.
   Provides the source data for monthly_budget_summary.other_operating_expenses,
   depreciation_amortization, and net_finance_income (FR-PNL-003, FR-PNL-010, FR-PNL-011).
   The P&L Engine distributes each row across 12 months per the distribution_method,
   then aggregates by cost_category into the corresponding monthly_budget_summary column.';
COMMENT ON COLUMN other_operating_costs.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN other_operating_costs.version_id IS 'FK to budget_versions. CASCADE delete.';
COMMENT ON COLUMN other_operating_costs.scenario_name IS 'Scenario label matching monthly_budget_summary.scenario_name. Allows scenario-specific OpEx assumptions.';
COMMENT ON COLUMN other_operating_costs.cost_category IS 'P&L line mapping: OPERATING_EXPENSES -> other_operating_expenses, DEPRECIATION_AMORTIZATION -> depreciation_amortization, FINANCE_INCOME or FINANCE_COSTS -> net_finance_income (income positive, costs negative).';
COMMENT ON COLUMN other_operating_costs.line_item_name IS 'Descriptive name (e.g., "Building Rent", "Equipment Depreciation"). Unique within version + scenario + category.';
COMMENT ON COLUMN other_operating_costs.annual_amount IS 'Annual amount in SAR. Positive for costs/expenses. For FINANCE_INCOME items, use positive values — the engine maps them as positive contributors to net_finance_income.';
COMMENT ON COLUMN other_operating_costs.distribution_method IS 'Monthly allocation method: ACADEMIC_10, YEAR_ROUND_12, CUSTOM_WEIGHTS, or SPECIFIC_PERIOD.';
COMMENT ON COLUMN other_operating_costs.weight_array IS 'JSON array of 12 decimal weights summing to 1.0. Required for CUSTOM_WEIGHTS distribution.';
COMMENT ON COLUMN other_operating_costs.specific_months IS 'Month numbers (1-12) for SPECIFIC_PERIOD distribution.';
COMMENT ON COLUMN other_operating_costs.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN other_operating_costs.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN other_operating_costs.created_by IS 'FK to users who created this cost item.';

-- Index: P&L Engine loads all costs for a version and scenario
CREATE INDEX other_operating_costs_version_scenario_idx ON other_operating_costs (version_id, scenario_name);

-- Trigger: auto-update updated_at
CREATE TRIGGER other_operating_costs_updated_at_trigger
  BEFORE UPDATE ON other_operating_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Table 24: pdpl_consent_records

PDPL Article 11 compliance: records employee consent for processing of personal data (salary, HR data). Consent grant and withdrawal events are captured as separate rows for an immutable audit trail. Added to resolve S-05.

```sql
CREATE TABLE pdpl_consent_records (
  id              BIGSERIAL    PRIMARY KEY,
  employee_id     BIGINT       NOT NULL,
  consent_type    TEXT         NOT NULL,
  granted_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  withdrawn_at    TIMESTAMPTZ,
  granted_by      BIGINT       NOT NULL,
  withdrawn_by    BIGINT,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT pdpl_consent_employee_fk   FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT pdpl_consent_granted_by_fk FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT pdpl_consent_withdrawn_by_fk FOREIGN KEY (withdrawn_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT pdpl_consent_type_check    CHECK (consent_type IN (
    'SALARY_DATA_PROCESSING',
    'HR_DATA_PROCESSING',
    'FINANCIAL_REPORTING',
    'THIRD_PARTY_DISCLOSURE'
  ))
);

COMMENT ON TABLE pdpl_consent_records IS
  'PDPL Article 11 compliance: employee consent records for personal data processing.
   Each consent event (grant or withdrawal) is a separate row — append-only for audit integrity.
   Active consent = latest row for (employee_id, consent_type) with withdrawn_at IS NULL.
   Withdrawn consent = withdrawn_at IS NOT NULL.
   Application MUST check active consent before processing salary or HR data (NFR 11.7).';
COMMENT ON COLUMN pdpl_consent_records.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN pdpl_consent_records.employee_id IS 'FK to employees. RESTRICT delete: employee cannot be hard-deleted while consent records exist.';
COMMENT ON COLUMN pdpl_consent_records.consent_type IS 'Category of data processing consented to: SALARY_DATA_PROCESSING (payroll, EoS), HR_DATA_PROCESSING (attendance, appraisals), FINANCIAL_REPORTING (inclusion in budget reports), THIRD_PARTY_DISCLOSURE (auditors, AEFE reporting).';
COMMENT ON COLUMN pdpl_consent_records.granted_at IS 'Timestamp when consent was given.';
COMMENT ON COLUMN pdpl_consent_records.withdrawn_at IS 'Timestamp when consent was withdrawn. NULL while consent is active.';
COMMENT ON COLUMN pdpl_consent_records.granted_by IS 'FK to the Admin user who recorded the consent grant on behalf of the employee.';
COMMENT ON COLUMN pdpl_consent_records.withdrawn_by IS 'FK to the Admin user who recorded the consent withdrawal. SET NULL if that user is later deleted.';
COMMENT ON COLUMN pdpl_consent_records.notes IS 'Optional note (e.g., "Consent form ref: CF-2026-042", "Employee verbally requested withdrawal").';
COMMENT ON COLUMN pdpl_consent_records.created_at IS 'Row creation timestamp. Append-only: no UPDATE or DELETE permitted on this table.';

-- Revoke mutating privileges from application user (same pattern as audit_entries):
-- REVOKE UPDATE, DELETE ON pdpl_consent_records FROM app_user;
-- GRANT INSERT, SELECT ON pdpl_consent_records TO app_user;

-- Index: active consent check for an employee (most common query: "does this employee consent to X?")
CREATE INDEX pdpl_consent_employee_type_idx ON pdpl_consent_records (employee_id, consent_type, granted_at DESC);
```

---

### Table 25: pdpl_data_requests

PDPL Article 12–14 compliance: tracks data subject access requests (DSAR), correction requests, and deletion requests. The 30-day fulfilment window (NFR 11.7) is enforced by setting `due_by` at insert time. Added to resolve S-18.

```sql
CREATE TABLE pdpl_data_requests (
  id              BIGSERIAL    PRIMARY KEY,
  employee_id     BIGINT       NOT NULL,
  request_type    TEXT         NOT NULL,
  requested_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  due_by          TIMESTAMPTZ  NOT NULL,
  fulfilled_at    TIMESTAMPTZ,
  fulfilled_by    BIGINT,
  status          TEXT         NOT NULL DEFAULT 'PENDING',
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT pdpl_request_employee_fk   FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT pdpl_request_fulfilled_by_fk FOREIGN KEY (fulfilled_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT pdpl_request_type_check    CHECK (request_type IN ('ACCESS', 'CORRECTION', 'DELETION', 'PORTABILITY')),
  CONSTRAINT pdpl_request_status_check  CHECK (status IN ('PENDING', 'IN_PROGRESS', 'FULFILLED', 'DENIED')),
  CONSTRAINT pdpl_request_due_by_check  CHECK (due_by > requested_at)
);

COMMENT ON TABLE pdpl_data_requests IS
  'PDPL data subject rights tracker (NFR 11.7). Tracks access, correction, deletion, and portability
   requests. due_by = requested_at + 30 days (set by application on INSERT). Admin receives an alert
   when due_by approaches. Fulfilment documentation should be attached via the notes column.';
COMMENT ON COLUMN pdpl_data_requests.id IS 'Auto-incrementing primary key.';
COMMENT ON COLUMN pdpl_data_requests.employee_id IS 'FK to the employee making the request. RESTRICT delete to preserve compliance records.';
COMMENT ON COLUMN pdpl_data_requests.request_type IS 'Type of PDPL data subject right exercised: ACCESS (copy of held data), CORRECTION (fix inaccurate data), DELETION (right to be forgotten), PORTABILITY (machine-readable export).';
COMMENT ON COLUMN pdpl_data_requests.requested_at IS 'Timestamp the request was received.';
COMMENT ON COLUMN pdpl_data_requests.due_by IS 'Deadline for fulfilment: requested_at + 30 days per PDPL Article 12. Set by application on INSERT.';
COMMENT ON COLUMN pdpl_data_requests.fulfilled_at IS 'Timestamp when the request was fulfilled. NULL while status = PENDING or IN_PROGRESS.';
COMMENT ON COLUMN pdpl_data_requests.fulfilled_by IS 'FK to the Admin user who fulfilled the request.';
COMMENT ON COLUMN pdpl_data_requests.status IS 'Request lifecycle: PENDING (not started), IN_PROGRESS (being processed), FULFILLED (completed), DENIED (refused with documented reason in notes).';
COMMENT ON COLUMN pdpl_data_requests.notes IS 'Fulfilment notes, denial reasons, or references to documents provided to the data subject.';
COMMENT ON COLUMN pdpl_data_requests.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN pdpl_data_requests.updated_at IS 'Last modification timestamp. Auto-updated by trigger.';

-- Index: Admin dashboard — show all pending requests ordered by due date (SLA monitoring)
CREATE INDEX pdpl_requests_status_due_idx ON pdpl_data_requests (status, due_by)
  WHERE status IN ('PENDING', 'IN_PROGRESS');

-- Index: employee-specific request history
CREATE INDEX pdpl_requests_employee_idx ON pdpl_data_requests (employee_id, requested_at DESC);

-- Trigger: auto-update updated_at
CREATE TRIGGER pdpl_data_requests_updated_at_trigger
  BEFORE UPDATE ON pdpl_data_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 5.2 Data Flows

This section documents the five critical calculation flows that transform input data into financial outputs. Each flow is triggered explicitly by the user (architectural decision D-004) and executes within a single PostgreSQL transaction.

**Guard: IMPORTED versions reject calculation engines.** Before any calculation engine flow (Flows 1–4) executes, the API checks `budget_versions.data_source`. If `data_source = 'IMPORTED'`, all three calculation endpoints (`POST /calculate/revenue`, `/calculate/staffing`, `/calculate/pnl`) return `409 Conflict` with: "Version uses imported data — calculation engine is disabled for this version."

### Flow 1: Enrollment -> Revenue Calculation

**Trigger:** User clicks "Calculate Revenue" -> `POST /api/v1/versions/:id/calculate/revenue`

1. **Stage 1 input.** User enters or imports enrollment headcount per grade and academic period. Data is validated and stored in `enrollment_headcount`.

2. **Stage 2 input.** User enters the nationality + tariff breakdown for each grade. Data is validated and stored in `enrollment_detail`.

3. **Stage 2 validation.** The system validates that the sum of `enrollment_detail.headcount` for each `(version_id, academic_period, grade_level)` equals the corresponding `enrollment_headcount.headcount`. If any mismatch is found, the calculation is rejected with a `400 Bad Request` listing the mismatched grades.

4. **Revenue Engine invoked.** A `CalculateRevenueCommand` is created and logged to `calculation_audit_log` with status `STARTED`.

5. **Revenue computation.** For each row in `enrollment_detail`, the engine JOINs with `fee_grids` on `(version_id, academic_period, grade_level, nationality, tariff)`:
    - **Gross revenue HT** = `headcount * tuition_ht / period_months` (AY1: 6 months, AY2: 4 months). Computed using Decimal.js at full precision (TC-001).
    - **Discount** = look up `discount_policies` for `(version_id, tariff, nationality)`. Apply the highest applicable `discount_rate` to gross revenue. If no policy exists, discount = 0.
    - **Scholarship deduction** = `gross_revenue_ht * scenario_parameters.scholarship_allocation` (from the active scenario).
    - **Net revenue HT** = `gross_revenue_ht - discount_amount - scholarship_deduction`.
    - **VAT** = `net_revenue_ht * vat_rate` (15% for Francais and Autres; 0% for Nationaux).
    - **Monthly distribution:** AY1 rows are distributed to months 1-6; AY2 rows to months 9-12. Months 7-8 (summer) are always zero.

6. **Batch UPSERT.** All computed `monthly_revenue` rows are upserted in a single transaction using `INSERT ... ON CONFLICT (version_id, scenario_name, academic_period, grade_level, nationality, tariff, month) DO UPDATE`.

7. **Staleness propagation.** The system marks the P&L module as stale for this version (revenue inputs changed). The P&L Engine will refuse to run until revenue is recalculated or confirmed current.

8. **Audit.** `calculation_audit_log` is updated with status `COMPLETED`, output summary (total revenue HT, row count), and duration.

### Flow 2: Enrollment -> DHG -> FTE Requirements

**Trigger:** Calculated automatically as part of enrollment processing or explicitly via `POST /api/v1/versions/:id/calculate/dhg`

1. **Sections calculation.** For each grade in `enrollment_headcount`, the DHG Engine looks up `class_capacity_config.max_class_size` and computes:
    - `sections_needed = CEILING(headcount / max_class_size)` — integer arithmetic, always rounds up.
    - If headcount = 0, sections_needed = 0.

2. **DHG hours computation.** For each grade, the engine JOINs `dhg_grille_config` (filtering by the appropriate `effective_from_year` or the default grille) and sums:
    - `total_dhg_hours_per_week = SUM(hours_per_week_per_section * sections_needed)` across all subjects and DHG types (Structural, Host_Country, Complementary).

3. **FTE requirement.** `fte_required = total_dhg_hours_per_week / ors_hours` where `ors_hours` comes from `scenario_parameters` for the active scenario (default 18.0000).

4. **Upsert.** Results are upserted to `dhg_requirements` per `(version_id, academic_period, grade_level)`.

5. **Downstream usage.** The FTE totals from `dhg_requirements` are used by the Staff Cost Engine for headcount cross-checks — verifying that the employee roster covers the required FTE.

### Flow 3: Employees -> Staff Costs (Monthly)

**Trigger:** User clicks "Calculate Staffing" -> `POST /api/v1/versions/:id/calculate/staffing`

1. **Employee data load.** The Staff Cost Engine loads all employee records for the version. Encrypted salary fields are decrypted at read time using `pgp_sym_decrypt(field, $SALARY_ENCRYPTION_KEY)::DECIMAL(15,4)`.

2. **Calculation logged.** `calculation_audit_log` entry created with status `STARTED`, input snapshot (employee count, version_id).

3. **Per-employee monthly computation.** For each employee in the version, for each month 1-12:

    a. **Monthly gross:**
    - Months 1-8: `base_salary + housing_allowance + transport_allowance + responsibility_premium + (hsa_amount if month NOT IN (7,8))`.
    - Months 9-12: `(base_salary + augmentation) + housing_allowance + transport_allowance + responsibility_premium + hsa_amount`.
    - `adjusted_gross = monthly_gross * hourly_percentage`.

    b. **GOSI (employer contribution):**
    - If `is_saudi = TRUE`: `gosi_amount = adjusted_gross * gosi_rate_saudi` (11.75% from `system_config`).
    - If `is_saudi = FALSE`: `gosi_amount = 0` (non-Saudi GOSI is employee-only, not employer-funded in this model).

    c. **Ajeer:**
    - If `is_saudi = TRUE`: `ajeer_amount = 0`.
    - If `is_ajeer = TRUE` and status = `Existing`: `ajeer_amount = (ajeer_levy_nitaqat / 12) + ajeer_monthly_fee` per month.
    - If `is_ajeer = TRUE` and status = `New`: Ajeer applies from Sep-Dec only (4 months). `ajeer_amount = (ajeer_levy_nitaqat / 12) + ajeer_monthly_fee` for months 9-12; 0 for months 1-8.
    - `ajeer_levy_nitaqat`, `ajeer_monthly_fee` from `system_config`.

    d. **EoS provision:**
    - `years_of_service = YEARFRAC(joining_date, fiscal_year_dec_31)` using US 30/360 (TC-002).
    - If `years_of_service <= 5`: `annual_provision = years_of_service * eos_base * 0.5`.
    - If `years_of_service > 5`: `annual_provision = (5 * eos_base * 0.5) + ((years_of_service - 5) * eos_base * 1.0)`.
    - `eos_base = base_salary + housing + transport + responsibility_premium` (excludes HSA).
    - `monthly_accrual = annual_provision / 12`.

    e. **Total cost:** `total_cost = adjusted_gross + gosi_amount + ajeer_amount + eos_monthly_accrual`.

4. **Batch UPSERT.** All `monthly_staff_costs` and `eos_provisions` rows are upserted in a single transaction.

5. **Staleness propagation.** The P&L module is marked stale for this version.

### Flow 4: Revenue + Costs -> P&L Consolidation

**Trigger:** User clicks "Calculate P&L" -> `POST /api/v1/versions/:id/calculate/pnl`

1. **Staleness check.** The P&L Engine checks whether `monthly_revenue` and `monthly_staff_costs` are stale for this version. If either module has been modified since the last calculation, the API returns `400 Bad Request` with a list of stale modules that must be recalculated first.

2. **Calculation logged.** `calculation_audit_log` entry created with status `STARTED`.

3. **Monthly consolidation.** For each month 1-12:
    - **Total tuition revenue HT** = `SUM(monthly_revenue.net_revenue_ht)` for this version and month.
    - **Total other revenue HT** = sum of `other_revenue_items` distributed to this month (per each item's `distribution_method`).
    - **Total revenue HT** = tuition + other revenue.
    - **Total local staff costs** = `SUM(monthly_staff_costs.adjusted_gross)` for this version and month.
    - **Total employer charges** = `SUM(monthly_staff_costs.gosi_amount + ajeer_amount + eos_monthly_accrual)`.
    - **Total additional costs** = Residents, replacements, and training costs (from `other_revenue_items` classified as cost items via `ifrs_category`).
    - **Total staff costs** = local + employer charges + additional.
    - **Gross profit** = total revenue - total staff costs.
    - **Other operating expenses** = non-staff OpEx (from `other_revenue_items` or manual input).
    - **EBITDA** = gross profit - other operating expenses.
    - **Operating profit** = EBITDA - depreciation and amortization.
    - **Net finance income** = finance income - finance costs.
    - **Profit before Zakat** = operating profit + net finance income.
    - **Zakat** = `MAX(0, profit_before_zakat * 0.025)`.
    - **Net profit** = profit before Zakat - Zakat.

4. **Upsert summary.** All 12 rows upserted to `monthly_budget_summary`.

5. **Generate IFRS line items.** For each revenue and cost component, generate detailed IFRS-classified line items and upsert to `ifrs_line_items` with appropriate `ifrs_category`, `ifrs_sub_category`, and `ifrs_standard` references.

6. **Audit.** `calculation_audit_log` updated with status `COMPLETED`, output summary (annual totals: revenue, costs, EBITDA, net profit), and duration.

### Flow 5: Excel Import for Actual Versions

**Trigger:** User selects "Import Actuals" for a version where `data_source = 'IMPORTED'` and `status IN ('Draft', 'Published')`.

1. **Pre-flight check.** API verifies two conditions: (a) `budget_versions.type = 'Actual'` — return `409 Conflict` ("Only Actual versions accept direct imports") if type is Budget or Forecast; (b) `budget_versions.data_source = 'IMPORTED'` — return `409 Conflict` ("Calculation engine data cannot be replaced by direct import") if data_source is CALCULATED.

2. **Import log created.** An `actuals_import_log` row is inserted with `validation_status = 'PENDING'`, recording `source_file`, `import_module`, `academic_year_label`, `target_fiscal_year`, and `target_period` as confirmed by the user in the upload UI.

3. **File parsed.** The uploaded Excel/CSV file is parsed using the module-specific import schema (same column mapping as `migrate_*.py` scripts but with runtime validation).

4. **Validation.** Row counts, decimal precision, column checksums, and enrollment period mapping are verified. For enrollment imports, the academic year label is cross-checked against the target fiscal year + period per the mapping rule in section 5.3.

5. **Direct table writes.** Data is written directly to the target output tables (`enrollment_headcount`, `monthly_revenue`, `monthly_staff_costs`, `monthly_budget_summary`, `ifrs_line_items`) using `INSERT ... ON CONFLICT DO UPDATE`. No calculation engines are invoked.

6. **Import log updated.** `actuals_import_log.validation_status` is set to `'PASSED'` (or `'FAILED'` with structured `validation_notes` if any check failed). `rows_imported` is set to the count of rows written.

7. **Version lock.** After all required modules are imported and all `actuals_import_log` rows show `PASSED`, the user (BudgetOwner or Admin) manually sets `budget_versions.status = 'Locked'` via `PATCH /api/v1/versions/:id/status`. This makes the version immutable.

8. **Period lock.** After the version is Locked, an Admin or BudgetOwner may lock individual `fiscal_periods` rows by calling `PATCH /api/v1/fiscal-periods/:year/:month/lock` and providing the `actual_version_id`. This sets `fiscal_periods.status = 'Locked'` and records `locked_at` and `locked_by`. The Latest Estimate API will then serve actuals from this version for the locked month.

---

## 5.3 Data Management Policies

### Retention

| Data                                        | Active Retention            | Archive                        | Total Retention              |
| ------------------------------------------- | --------------------------- | ------------------------------ | ---------------------------- |
| `audit_entries`                             | 3 years in primary database | Cold storage (pg_dump archive) | 7 years (NFR 11.5)           |
| `budget_versions` + all version-scoped data | 3 years active access       | Archived status, read-only     | 10 years (NFR 11.7)          |
| `export_jobs` (files)                       | 1 hour (download expiry)    | N/A                            | Files deleted after 24 hours |
| `export_jobs` (records)                     | 30 days                     | N/A                            | Records purged after 30 days |
| `calculation_audit_log`                     | 2 years                     | Cold storage                   | 5 years                      |

### Delete Policy

- **Users:** Soft delete only (`is_active = FALSE`). Hard delete is prohibited — financial records, audit entries, and budget versions reference `user_id`. Deactivated users cannot log in but their historical records remain intact.
- **Employees:** No hard delete. Status is set to `Departed` and the record is preserved within its version snapshot. Historical records are maintained per version isolation.
- **Budget versions:** Only `Draft` status versions may be hard-deleted (cascade deletes all version-scoped data). `Published`, `Locked`, and `Archived` versions cannot be deleted — they are immutable financial records.
- **Financial data:** No hard deletes on any planning data tables (`monthly_revenue`, `monthly_staff_costs`, `monthly_budget_summary`, `ifrs_line_items`, `eos_provisions`). Version isolation provides logical separation. Recalculation overwrites via UPSERT, preserving the audit trail of each calculation run.

### Version Isolation

All planning data is scoped by `version_id` foreign key. There is no shared mutable state between versions. When a version is cloned:

1. A new `budget_versions` row is created with `source_version_id` pointing to the original.
2. All version-scoped rows (`employees`, `fee_grids`, `enrollment_headcount`, `enrollment_detail`, `discount_policies`, `scenario_parameters`, `other_revenue_items`) are deep-copied with the new `version_id`.
3. Calculated output tables (`monthly_revenue`, `monthly_staff_costs`, `eos_provisions`, `dhg_requirements`, `monthly_budget_summary`, `ifrs_line_items`) are NOT copied — they must be recalculated for the new version.
4. The entire clone operation executes in a single PostgreSQL transaction. If any step fails, nothing is committed.

**Restriction: Actual versions (`type = 'Actual'`) cannot be cloned.** The clone endpoint (`POST /api/v1/versions/:id/clone`) returns `409 Conflict` if the source version has `type = 'Actual'`. Rationale: Actual versions represent confirmed historical data. Their data_source is `IMPORTED` and their output tables are populated by the import service, not calculation engines. Cloning them would produce a new IMPORTED version with no valid way to re-import the same historical data under a different version ID. To create a variant, a new Actual version must be created from scratch and re-imported.

### Academic Year → Fiscal Year Mapping

Enrollment data crosses academic year boundaries. Academic years at EFIR span two calendar years (e.g., "2024-25" = Sep 2024 – Jun 2025). The fiscal year is calendar-based (Jan–Dec). Enrollment counts for a given fiscal year must be sourced from two different academic year files:

| Fiscal Year | Period | Academic Year Source | Calendar Months |
| ----------- | ------ | -------------------- | --------------- |
| FY2025      | AY1    | "2024-25" CSV        | Jan–Jun 2025    |
| FY2025      | AY2    | "2025-26" CSV        | Sep–Dec 2025    |
| FY2026      | AY1    | "2025-26" CSV        | Jan–Jun 2026    |
| FY2026      | AY2    | "2026-27" CSV        | Sep–Dec 2026    |

**General rule:**

- FY `N` AY1 (Jan–Jun `N`) ← academic year "(`N`-1)–`N`"
- FY `N` AY2 (Sep–Dec `N`) ← academic year "`N`–(`N`+1)"

The import UI must ask the user to confirm which academic year they are uploading and which fiscal year + period it maps to. The `actuals_import_log.academic_year_label`, `target_fiscal_year`, and `target_period` columns capture this explicitly for the audit trail.

**Trend analysis query:**

```sql
SELECT bv.fiscal_year, eh.academic_period, eh.grade_level, eh.headcount
FROM enrollment_headcount eh
JOIN budget_versions bv ON eh.version_id = bv.id
WHERE bv.type = 'Actual'
  AND eh.grade_level = 'CP'
ORDER BY bv.fiscal_year, eh.academic_period;
```

### Period Locking

Period locking is the mechanism by which an authorized user permanently marks a given month's actuals as confirmed, making the Latest Estimate API serve those actuals instead of budget projections for that month.

**Locking actions and permissions:**

| Action                      | Who               | Effect                                                      |
| --------------------------- | ----------------- | ----------------------------------------------------------- |
| Import actuals into version | Editor+           | Writes to output tables; version stays 'Draft'              |
| Publish version             | BudgetOwner       | `status = 'Published'`; visible to all roles                |
| Lock version                | BudgetOwner       | `status = 'Locked'`; version immutable                      |
| Lock fiscal period          | Admin/BudgetOwner | `fiscal_periods.status = 'Locked'`; `actual_version_id` set |

Period locking is one-way (`Draft → Locked`). A locked period cannot be reopened. If actuals need to be revised after locking, a new superseding Actual version must be created, imported, locked, and its `id` written to `fiscal_periods.actual_version_id` via an admin override. This preserves the full audit trail of the previous version.

**Latest Estimate query pattern (used by `GET /api/v1/versions/:id/latest-estimate`):**

For each month M in fiscal year F:

- If `fiscal_periods.status = 'Locked'` for (F, M) → pull `monthly_budget_summary` from `actual_version_id`
- If `fiscal_periods.status = 'Draft'` for (F, M) → pull `monthly_budget_summary` from the requesting Budget/Forecast version

This merge is performed at the API layer. No additional database tables are required beyond `fiscal_periods` and `monthly_budget_summary`.

### PDPL Compliance

**Encrypted fields (PDPL — Confidential PII):**

- `employees.base_salary_encrypted`
- `employees.housing_allowance_encrypted`
- `employees.transport_allowance_encrypted`
- `employees.responsibility_premium_encrypted`
- `employees.hsa_amount_encrypted`

**Encryption method:**

- Algorithm: AES-256 via pgcrypto `pgp_sym_encrypt(value::text, $key)`.
- Decryption: `pgp_sym_decrypt(encrypted_field, $key)::DECIMAL(15,4)`.
- Key source: `SALARY_ENCRYPTION_KEY` environment variable. In production, injected as a Docker secret.

**Key rotation procedure:**

1. Generate new encryption key.
2. Execute migration script that decrypts all salary fields with the old key and re-encrypts with the new key in a single transaction.
3. Update the Docker secret with the new key.
4. Restart the application container to pick up the new key.
5. Verify decryption works by running the 6-step validation protocol against known test values.

**Data residency:** The PostgreSQL database is hosted within the Kingdom of Saudi Arabia per SA-008. No data is replicated or backed up to servers outside KSA.

**Purpose limitation:** Salary data is accessed only by roles with `data:edit` or `data:view` permissions. The `Viewer` role cannot see salary fields — the repository layer excludes encrypted columns from Viewer queries (RBAC enforced at the application level, not the database level).

---

## 5.4 Data Migration Strategy

### Source Files

| #   | File                                                      | Description                                                                                                |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | `01_EFIR_Revenue_FY2026_v3.xlsx`                          | Fee grids, enrollment assumptions, revenue calculation                                                     |
| 2   | `02_EFIR_DHG_FY2026_v1.xlsx`                              | DHG grilles, FTE calculations                                                                              |
| 3   | `EFIR_Staff_Costs_Budget_FY2026_V3.xlsx`                  | Employee records, salary components, statutory costs                                                       |
| 4   | `EFIR_Consolidated_Monthly_Budget_FY2026.xlsx`            | P&L consolidation, IFRS mapping                                                                            |
| 5   | `enrollment_2021-22.csv` through `enrollment_2025-26.csv` | 5 years historical enrollment — imported as Actual budget_versions (type='Actual', data_source='IMPORTED') |

### Source -> Target Mapping

| Source File     | Source Sheet/Column        | Target Table                                       | Target Column                      | Transformation                                                                                                                 |
| --------------- | -------------------------- | -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Staff_Costs     | Staff Master / Name        | `employees`                                        | `name`                             | Direct copy, trim whitespace                                                                                                   |
| Staff_Costs     | Staff Master / Function    | `employees`                                        | `function_role`                    | Direct copy                                                                                                                    |
| Staff_Costs     | Staff Master / Department  | `employees`                                        | `department`                       | Map to CHECK constraint values                                                                                                 |
| Staff_Costs     | Staff Master / Base Salary | `employees`                                        | `base_salary_encrypted`            | `pgp_sym_encrypt(value::text, $key)`                                                                                           |
| Staff_Costs     | Staff Master / Housing     | `employees`                                        | `housing_allowance_encrypted`      | `pgp_sym_encrypt(value::text, $key)`                                                                                           |
| Staff_Costs     | Staff Master / Transport   | `employees`                                        | `transport_allowance_encrypted`    | `pgp_sym_encrypt(value::text, $key)`                                                                                           |
| Staff_Costs     | Staff Master / Premium     | `employees`                                        | `responsibility_premium_encrypted` | `pgp_sym_encrypt(value::text, $key)`                                                                                           |
| Staff_Costs     | Staff Master / HSA         | `employees`                                        | `hsa_amount_encrypted`             | `pgp_sym_encrypt(value::text, $key)`                                                                                           |
| Staff_Costs     | Staff Master / Start Date  | `employees`                                        | `joining_date`                     | Parse date string, validate format                                                                                             |
| Staff_Costs     | Staff Master / Saudi Flag  | `employees`                                        | `is_saudi`                         | Boolean mapping (Y/N -> TRUE/FALSE)                                                                                            |
| Staff_Costs     | Staff Master / Hourly %    | `employees`                                        | `hourly_percentage`                | Divide by 100 if percentage; validate range                                                                                    |
| Revenue         | Fee Grid AY1               | `fee_grids`                                        | `tuition_ttc`, `tuition_ht`        | Validate HT = TTC / (1 + VAT); cast to DECIMAL(15,4)                                                                           |
| Revenue         | Fee Grid AY1 / DAI         | `fee_grids`                                        | `dai`                              | Cast to DECIMAL(15,4)                                                                                                          |
| Revenue         | Enrollment AY1             | `enrollment_headcount`                             | `headcount`                        | Integer; validate >= 0                                                                                                         |
| Revenue         | Enrollment Detail          | `enrollment_detail`                                | `headcount`                        | Integer per nationality/tariff; validate sums                                                                                  |
| DHG             | Grille                     | `dhg_grille_config`                                | `hours_per_week_per_section`       | Cast to DECIMAL(7,4)                                                                                                           |
| DHG             | Grille / Subject           | `dhg_grille_config`                                | `subject`                          | Direct copy, normalize case                                                                                                    |
| Consolidated    | P&L Line Items             | `other_revenue_items`                              | `annual_amount`, `ifrs_category`   | Map Excel line items to IFRS categories                                                                                        |
| Enrollment CSVs | level_code                 | `enrollment_headcount` (via Actual budget_version) | `grade_level`                      | Map level codes to standard grade identifiers; one enrollment_headcount row per grade per AY period under the Actual version   |
| Enrollment CSVs | student_count              | `enrollment_headcount` (via Actual budget_version) | `headcount`                        | Integer; validate >= 0; academic year label resolved to fiscal_year + academic_period per the AY→FY mapping rule (section 5.3) |

### 6-Step Validation Protocol

Automated as a CI pipeline step in Phase 6. All validations must pass before migration is considered successful.

1. **Row count check.** `SELECT COUNT(*)` in source (openpyxl/pandas row count) must equal `SELECT COUNT(*)` in target for each migrated table. Tolerance: exact match (0 difference).

2. **Column checksum.** SHA-256 hash of concatenated values for each monetary column in the source workbook must match the hash of the corresponding decrypted database values. This catches individual cell-level discrepancies.

3. **Revenue totals.** `SUM(monthly_revenue.net_revenue_ht)` for the migrated version must equal the Revenue Total from the source Excel workbook. Tolerance: +/- 1 SAR (accounts for rounding differences at the presentation layer boundary).

4. **Staff cost totals.** `SUM(monthly_staff_costs.total_cost)` for the migrated version must equal the Staff Cost Total from the source Excel workbook. Tolerance: +/- 1 SAR.

5. **P&L reconciliation.** `SUM(monthly_budget_summary.net_profit)` must equal the Net Profit total from the consolidated Excel sheet. Tolerance: +/- 1 SAR.

6. **Enrollment cross-check.** For every grade, `SUM(enrollment_detail.headcount)` grouped by `(version_id, academic_period, grade_level)` must equal the corresponding `enrollment_headcount.headcount`. Tolerance: exact match (0 difference).

### Rollback Plan

- **Pre-migration backup:** `pg_dump -Fc budfindb > pre_migration_YYYYMMDD_HHMMSS.dump` taken immediately before migration starts.
- **2-hour rollback window:** If any validation step fails within 2 hours of migration completion, restore immediately: `pg_restore -d budfindb --clean pre_migration.dump`.
- **Staging-first policy:** All migration scripts run on the staging environment first. Full 6-step validation must pass on staging before production migration is scheduled.
- **No partial migration:** If any single table migration fails, the entire migration transaction is rolled back. Tables are never in a partially-migrated state.

### Migration Tooling

- **Runtime:** Python 3.11 with explicit `decimal.Decimal` context — no `float` types are ever used for monetary values (mirroring TC-001 at the migration layer).
- **Libraries:** `openpyxl` for xlsx reading, `pandas` with `decimal.Decimal` columns for data transformation, `psycopg2` with `decimal.Decimal` adapter for PostgreSQL writes.
- **Script per workbook:**
    - `migrate_revenue.py` — fee grids, enrollment data, discount policies.
    - `migrate_staff_costs.py` — employee records with salary encryption.
    - `migrate_dhg.py` — DHG grille configuration.
    - `migrate_consolidated.py` — other revenue items, operating expenses, IFRS mappings.
    - `migrate_enrollment_actuals.py` — converts 5 enrollment CSVs (2021-22 through 2025-26) into
      Actual budget_versions. Creates one `budget_versions` row per academic year
      (type='Actual', data_source='IMPORTED', status='Locked'), then populates
      `enrollment_headcount` rows per grade per AY period using the AY→FY mapping rule.
- **Idempotency:** All scripts use `INSERT ... ON CONFLICT DO UPDATE`. Safe to re-run without creating duplicates.
- **Encryption:** `migrate_staff_costs.py` encrypts salary fields using `pgp_sym_encrypt()` via a raw SQL `INSERT` statement with the encryption key passed as a parameter from the `SALARY_ENCRYPTION_KEY` environment variable.
- **Logging:** Each migration script writes a structured JSON log with row counts, checksums, duration, and any warnings or skipped rows.
