# Feature Spec: Master Data Management

> Epic: #5 | Phase: 4 -- SPECIFY | Status: Draft | Date: 2026-03-06

## Summary

Epic 7 delivers CRUD interfaces for all reference data consumed by BudFin's planning modules (PRD Section 8.6, FR-MDM-001 through FR-MDM-008). It comprises four sub-modules: Chart of Accounts & Centers (account codes, types, center mappings, IFRS categories), Academic Years & Grade Levels (fiscal year date periods and the fixed 15-grade structure with plancher/cible/plafond thresholds), Reference Data (Nationalities, Tariffs, Departments), and Assumptions & Parameters (tax rates, discount rates, social charges, academic settings). This epic is a MUST-HAVE MVP dependency that unblocks Epics 1-6 by providing the foundational reference data they consume. Auth/RBAC (Epic 11) is complete, so role enforcement is available for all endpoints and UI.

## Acceptance Criteria

Each criterion must be testable and specific.

- [ ] AC-01: Given an Admin user, when they POST `/api/v1/master-data/accounts` with valid data, then a new ChartOfAccount record is created and returned with HTTP 201.
- [ ] AC-02: Given a ChartOfAccount with accountCode "REV001" exists, when any user POSTs a new account with accountCode "REV001", then the API returns HTTP 409 with code `DUPLICATE_CODE`.
- [ ] AC-03: Given a Viewer user, when they attempt to POST/PUT/DELETE any Chart of Accounts endpoint, then the API returns HTTP 403 with code `FORBIDDEN`.
- [ ] AC-04: Given a ChartOfAccount referenced by a downstream planning module, when an Admin DELETEs it, then the API returns HTTP 409 with code `REFERENCED_RECORD` and the record is not deleted.
- [ ] AC-05: Given an Admin user, when they POST `/api/v1/master-data/academic-years` with ay1Start > ay1End, then the API returns HTTP 422 with a field error on ay1End indicating date ordering violation.
- [ ] AC-06: Given the 15 pre-seeded grade levels, when any user sends POST to `/api/v1/master-data/grade-levels`, then the API returns HTTP 405 Method Not Allowed.
- [ ] AC-07: Given the 15 pre-seeded grade levels, when any user sends DELETE to `/api/v1/master-data/grade-levels/:id`, then the API returns HTTP 405 Method Not Allowed.
- [ ] AC-08: Given an Admin user, when they PUT a grade level with plancherPct=0.80, ciblePct=0.70, plafondPct=0.90, then the API returns HTTP 422 because plancher > cible (must be plancher <= cible <= plafond).
- [ ] AC-09: Given an Admin user, when they PUT a grade level with plancher=0.70, cible=0.80, plafond=0.90, then the update succeeds with HTTP 200.
- [ ] AC-10: Given an Admin user, when they POST `/api/v1/master-data/nationalities` with `{ code: "FR", label: "Francais", vatExempt: true }`, then a Nationality record is created and returned with HTTP 201.
- [ ] AC-11: Given a Nationality with code "FR" exists, when a user POSTs a new nationality with code "FR", then the API returns HTTP 409 with code `DUPLICATE_CODE`.
- [ ] AC-12: Given any mutation (create/update/delete) on a master data entity, then an audit log entry is written recording the userId, operation, entityType, entityId, and timestamp.
- [ ] AC-13: Given a BudgetOwner user, when they PATCH `/api/v1/master-data/assumptions` with `{ vatRate: "18.0" }`, then the assumption is updated and HTTP 200 is returned.
- [ ] AC-14: Given an Editor user, when they PATCH `/api/v1/master-data/assumptions` with valid data, then the assumption is updated and HTTP 200 is returned.
- [ ] AC-15: Given a Viewer user, when they PATCH `/api/v1/master-data/assumptions`, then the API returns HTTP 403.
- [ ] AC-16: Given GOSI sub-components gosiPension=9.75, gosiSaned=1.50, gosiOhi=1.00, when assumptions are retrieved via GET, then gosiRateTotal is computed server-side as 12.25 (sum of sub-components).
- [ ] AC-17: Given two Admin users editing the same account concurrently, when Admin B saves after Admin A has already saved (changing `updatedAt`), then Admin B receives HTTP 409 with code `OPTIMISTIC_LOCK`.
- [ ] AC-18: Given invalid request body on any master data endpoint, then the API returns HTTP 422 with Zod validation field_errors array containing specific field-level messages.
- [ ] AC-19: Given a fresh database, when the seed migration runs, then exactly 15 GradeLevel records and 14 Assumption records are created with default values.

## Stories

| #   | Story                                                        | Depends On | GitHub Issue |
| --- | ------------------------------------------------------------ | ---------- | ------------ |
| 1   | Prisma schema: 7 models + 6 enums + indexes + seed migration | --         | #36          |
| 2   | Chart of Accounts API (CRUD + validation + RBAC + audit)     | 1          | #37          |
| 3   | Academic Years API (CRUD + date cross-validation)            | 1          | #38          |
| 4   | Grade Levels API (GET + PUT only, 405 on POST/DELETE)        | 1          | #39          |
| 5   | Reference Data API (Nationalities/Tariffs/Departments CRUD)  | 1          | #40          |
| 6   | Assumptions API (GET + PATCH, computed GOSI total)           | 1          | #41          |
| 7   | Chart of Accounts UI (table + side panel + filters)          | 2          | #42          |
| 8   | Academic Years & Grades UI (split layout + date pickers)     | 3, 4       | #43          |
| 9   | Reference Data UI (tabbed layout + 3 entity forms)           | 5          | #44          |
| 10  | Assumptions UI (grouped inline-editing table)                | 6          | #45          |
| 11  | Seed data migration (15 grades + 14 assumptions)             | 1          | #46          |
| 12  | E2E integration tests (all endpoints)                        | 2-6        | #47          |

## Data Model Changes

### 6 New Enums

```prisma
enum AccountType {
    REVENUE
    EXPENSE
    ASSET
    LIABILITY
}

enum CenterType {
    PROFIT_CENTER
    COST_CENTER
}

enum AccountStatus {
    ACTIVE
    INACTIVE
}

enum GradeBand {
    MATERNELLE
    ELEMENTAIRE
    COLLEGE
    LYCEE
}

enum DepartmentBand {
    MATERNELLE
    ELEMENTAIRE
    COLLEGE
    LYCEE
    NON_ACADEMIC
}

enum AssumptionValueType {
    PERCENTAGE
    CURRENCY
    INTEGER
    DECIMAL
    TEXT
}
```

### 7 New Models

```prisma
model ChartOfAccount {
    id            Int           @id @default(autoincrement())
    accountCode   String        @unique @db.VarChar(10)
    accountName   String        @db.VarChar(100)
    type          AccountType
    ifrsCategory  String        @db.VarChar(100)
    centerType    CenterType
    description   String?       @db.VarChar(500)
    status        AccountStatus @default(ACTIVE)
    version       Int           @default(1)
    createdAt     DateTime      @default(now()) @map("created_at")
    updatedAt     DateTime      @updatedAt @map("updated_at")
    createdBy     Int           @map("created_by")
    updatedBy     Int           @map("updated_by")

    creator       User          @relation("AccountCreator", fields: [createdBy], references: [id])
    updater       User          @relation("AccountUpdater", fields: [updatedBy], references: [id])

    @@map("chart_of_accounts")
}

model AcademicYear {
    id            Int      @id @default(autoincrement())
    fiscalYear    String   @unique @db.VarChar(6)
    ay1Start      DateTime @map("ay1_start") @db.Date
    ay1End        DateTime @map("ay1_end") @db.Date
    ay2Start      DateTime @map("ay2_start") @db.Date
    ay2End        DateTime @map("ay2_end") @db.Date
    summerStart   DateTime @map("summer_start") @db.Date
    summerEnd     DateTime @map("summer_end") @db.Date
    academicWeeks Int      @map("academic_weeks")
    version       Int      @default(1)
    createdAt     DateTime @default(now()) @map("created_at")
    updatedAt     DateTime @updatedAt @map("updated_at")
    createdBy     Int      @map("created_by")
    updatedBy     Int      @map("updated_by")

    creator       User     @relation("AcademicYearCreator", fields: [createdBy], references: [id])
    updater       User     @relation("AcademicYearUpdater", fields: [updatedBy], references: [id])

    @@map("academic_years")
}

model GradeLevel {
    id           Int       @id @default(autoincrement())
    gradeCode    String    @unique @db.VarChar(10)
    gradeName    String    @db.VarChar(60)
    band         GradeBand
    maxClassSize Int       @map("max_class_size")
    plancherPct  Decimal   @map("plancher_pct") @db.Decimal(5, 4)
    ciblePct     Decimal   @map("cible_pct") @db.Decimal(5, 4)
    plafondPct   Decimal   @map("plafond_pct") @db.Decimal(5, 4)
    displayOrder Int       @map("display_order")
    version      Int       @default(1)
    createdAt    DateTime  @default(now()) @map("created_at")
    updatedAt    DateTime  @updatedAt @map("updated_at")

    @@map("grade_levels")
}

model Nationality {
    id         Int      @id @default(autoincrement())
    code       String   @unique @db.VarChar(5)
    label      String   @db.VarChar(100)
    vatExempt  Boolean  @default(false) @map("vat_exempt")
    version    Int      @default(1)
    createdAt  DateTime @default(now()) @map("created_at")
    updatedAt  DateTime @updatedAt @map("updated_at")
    createdBy  Int      @map("created_by")
    updatedBy  Int      @map("updated_by")

    creator    User     @relation("NationalityCreator", fields: [createdBy], references: [id])
    updater    User     @relation("NationalityUpdater", fields: [updatedBy], references: [id])

    @@map("nationalities")
}

model Tariff {
    id          Int      @id @default(autoincrement())
    code        String   @unique @db.VarChar(10)
    label       String   @db.VarChar(100)
    description String?  @db.VarChar(500)
    version     Int      @default(1)
    createdAt   DateTime @default(now()) @map("created_at")
    updatedAt   DateTime @updatedAt @map("updated_at")
    createdBy   Int      @map("created_by")
    updatedBy   Int      @map("updated_by")

    creator     User     @relation("TariffCreator", fields: [createdBy], references: [id])
    updater     User     @relation("TariffUpdater", fields: [updatedBy], references: [id])

    @@map("tariffs")
}

model Department {
    id          Int            @id @default(autoincrement())
    code        String         @unique @db.VarChar(20)
    label       String         @db.VarChar(100)
    bandMapping DepartmentBand @map("band_mapping")
    version     Int            @default(1)
    createdAt   DateTime       @default(now()) @map("created_at")
    updatedAt   DateTime       @updatedAt @map("updated_at")
    createdBy   Int            @map("created_by")
    updatedBy   Int            @map("updated_by")

    creator     User           @relation("DepartmentCreator", fields: [createdBy], references: [id])
    updater     User           @relation("DepartmentUpdater", fields: [updatedBy], references: [id])

    @@map("departments")
}

model Assumption {
    id        Int                 @id @default(autoincrement())
    key       String              @unique @db.VarChar(50)
    value     String              @db.VarChar(500)
    unit      String              @db.VarChar(20)
    section   String              @db.VarChar(50)
    label     String              @db.VarChar(100)
    valueType AssumptionValueType @map("value_type")
    version   Int                 @default(1)
    createdAt DateTime            @default(now()) @map("created_at")
    updatedAt DateTime            @updatedAt @map("updated_at")
    updatedBy Int?                @map("updated_by")

    updater   User?               @relation("AssumptionUpdater", fields: [updatedBy], references: [id])

    @@map("assumptions")
}
```

### SQL CHECK Constraints (applied via raw migration)

```sql
-- Account code pattern: 3-10 uppercase alphanumeric characters
ALTER TABLE chart_of_accounts ADD CONSTRAINT chk_account_code
    CHECK (account_code ~ '^[A-Z0-9]{3,10}$');

-- Nationality code pattern: 2-5 uppercase letters
ALTER TABLE nationalities ADD CONSTRAINT chk_nationality_code
    CHECK (code ~ '^[A-Z]{2,5}$');

-- Tariff code pattern: 2-10 uppercase alphanumeric + plus sign
ALTER TABLE tariffs ADD CONSTRAINT chk_tariff_code
    CHECK (code ~ '^[A-Z0-9+]{2,10}$');

-- Department code pattern: 2-20 uppercase + underscore
ALTER TABLE departments ADD CONSTRAINT chk_department_code
    CHECK (code ~ '^[A-Z_]{2,20}$');

-- Academic year date ordering: ay1Start < ay1End <= summerStart < summerEnd <= ay2Start < ay2End
ALTER TABLE academic_years ADD CONSTRAINT chk_date_ordering
    CHECK (ay1_start < ay1_end
        AND ay1_end <= summer_start
        AND summer_start < summer_end
        AND summer_end <= ay2_start
        AND ay2_start < ay2_end);

-- Academic weeks range
ALTER TABLE academic_years ADD CONSTRAINT chk_academic_weeks
    CHECK (academic_weeks BETWEEN 1 AND 52);

-- Grade level percentage ordering: plancher <= cible <= plafond
ALTER TABLE grade_levels ADD CONSTRAINT chk_pct_ordering
    CHECK (plancher_pct <= cible_pct AND cible_pct <= plafond_pct);

-- Grade level max class size range
ALTER TABLE grade_levels ADD CONSTRAINT chk_max_class_size
    CHECK (max_class_size BETWEEN 1 AND 50);
```

## API Endpoints

All endpoints are under `/api/v1/master-data/`. All protected routes require `Authorization: Bearer <access_token>`.

### Chart of Accounts

| Method | Path            | Request                                                                               | Response                         | Auth                       |
| ------ | --------------- | ------------------------------------------------------------------------------------- | -------------------------------- | -------------------------- |
| GET    | `/accounts`     | Query: `?type=&centerType=&status=&search=`                                           | `{ accounts: ChartOfAccount[] }` | Any authenticated role     |
| GET    | `/accounts/:id` | --                                                                                    | `ChartOfAccount`                 | Any authenticated role     |
| POST   | `/accounts`     | `{ accountCode, accountName, type, ifrsCategory, centerType, description?, status? }` | `ChartOfAccount` (201)           | Admin only (`config:edit`) |
| PUT    | `/accounts/:id` | Same as POST + `version` (optimistic lock)                                            | `ChartOfAccount` (200)           | Admin only (`config:edit`) |
| DELETE | `/accounts/:id` | --                                                                                    | 204 No Content                   | Admin only (`config:edit`) |

### Academic Years

| Method | Path                  | Request                                                                                     | Response                            | Auth                       |
| ------ | --------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------- |
| GET    | `/academic-years`     | --                                                                                          | `{ academicYears: AcademicYear[] }` | Any authenticated role     |
| GET    | `/academic-years/:id` | --                                                                                          | `AcademicYear`                      | Any authenticated role     |
| POST   | `/academic-years`     | `{ fiscalYear, ay1Start, ay1End, ay2Start, ay2End, summerStart, summerEnd, academicWeeks }` | `AcademicYear` (201)                | Admin only (`config:edit`) |
| PUT    | `/academic-years/:id` | Same as POST + `version`                                                                    | `AcademicYear` (200)                | Admin only (`config:edit`) |
| DELETE | `/academic-years/:id` | --                                                                                          | 204 No Content                      | Admin only (`config:edit`) |

### Grade Levels

| Method | Path                | Request                                                                      | Response                        | Auth                       |
| ------ | ------------------- | ---------------------------------------------------------------------------- | ------------------------------- | -------------------------- |
| GET    | `/grade-levels`     | --                                                                           | `{ gradeLevels: GradeLevel[] }` | Any authenticated role     |
| PUT    | `/grade-levels/:id` | `{ maxClassSize, plancherPct, ciblePct, plafondPct, displayOrder, version }` | `GradeLevel` (200)              | Admin only (`config:edit`) |
| POST   | `/grade-levels`     | --                                                                           | 405 Method Not Allowed          | --                         |
| DELETE | `/grade-levels/:id` | --                                                                           | 405 Method Not Allowed          | --                         |

### Nationalities

| Method | Path                 | Request                       | Response                           | Auth                       |
| ------ | -------------------- | ----------------------------- | ---------------------------------- | -------------------------- |
| GET    | `/nationalities`     | --                            | `{ nationalities: Nationality[] }` | Any authenticated role     |
| POST   | `/nationalities`     | `{ code, label, vatExempt? }` | `Nationality` (201)                | Admin only (`config:edit`) |
| PUT    | `/nationalities/:id` | Same as POST + `version`      | `Nationality` (200)                | Admin only (`config:edit`) |
| DELETE | `/nationalities/:id` | --                            | 204 No Content                     | Admin only (`config:edit`) |

### Tariffs

| Method | Path           | Request                         | Response                | Auth                       |
| ------ | -------------- | ------------------------------- | ----------------------- | -------------------------- |
| GET    | `/tariffs`     | --                              | `{ tariffs: Tariff[] }` | Any authenticated role     |
| POST   | `/tariffs`     | `{ code, label, description? }` | `Tariff` (201)          | Admin only (`config:edit`) |
| PUT    | `/tariffs/:id` | Same as POST + `version`        | `Tariff` (200)          | Admin only (`config:edit`) |
| DELETE | `/tariffs/:id` | --                              | 204 No Content          | Admin only (`config:edit`) |

### Departments

| Method | Path               | Request                        | Response                        | Auth                       |
| ------ | ------------------ | ------------------------------ | ------------------------------- | -------------------------- |
| GET    | `/departments`     | --                             | `{ departments: Department[] }` | Any authenticated role     |
| POST   | `/departments`     | `{ code, label, bandMapping }` | `Department` (201)              | Admin only (`config:edit`) |
| PUT    | `/departments/:id` | Same as POST + `version`       | `Department` (200)              | Admin only (`config:edit`) |
| DELETE | `/departments/:id` | --                             | 204 No Content                  | Admin only (`config:edit`) |

### Assumptions

| Method | Path           | Request                                         | Response                                                                   | Auth                                     |
| ------ | -------------- | ----------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| GET    | `/assumptions` | --                                              | `{ assumptions: Assumption[], computed: { gosiRateTotal: string } }`       | Any authenticated role                   |
| PATCH  | `/assumptions` | `{ [key]: value, ... }` (partial update by key) | `{ assumptions: Assumption[], computed: { gosiRateTotal: string } }` (200) | Admin, BudgetOwner, Editor (`data:edit`) |

### Common Response Patterns

All endpoints follow the standard error response format from `04_api_contract.md`:

```json
{
    "code": "VALIDATION_ERROR | DUPLICATE_CODE | REFERENCED_RECORD | OPTIMISTIC_LOCK | FORBIDDEN",
    "message": "Human-readable description",
    "field_errors": [{ "field": "accountCode", "message": "Must match ^[A-Z0-9]{3,10}$" }]
}
```

Optimistic locking: PUT/PATCH requests include a `version` field. If the server's current version differs, HTTP 409 with `OPTIMISTIC_LOCK` is returned.

## UI/UX Specification

> Source: `docs/ui-ux-spec/08-master-data.md` | Cross-cutting: `00-global-framework.md`, `10-input-management.md`

### Shell & Layout

Master Data renders inside **ManagementShell** -- no context bar, no docked right panel. Master data is version-independent. Four routes:

| Route                      | Sidebar Label            |
| -------------------------- | ------------------------ |
| `/master-data/accounts`    | Chart of Accounts        |
| `/master-data/academic`    | Academic Years & Grades  |
| `/master-data/reference`   | Reference Data           |
| `/master-data/assumptions` | Assumptions & Parameters |

Layout: Left area (~65%) holds a searchable, filterable data table. Right area hosts a 480px slide-in side panel overlay (z-index:30) for create/edit forms per Global Framework Section 4.4.1.

```text
+--------+---------------------------------------------------------+
|        | Module Toolbar (48px)                                   |
| Side-  |---------------------------------------------------------|
| bar    | Tab Navigation (if applicable, 40px)                    |
|        |---------------------------------------------------------|
|        |                         |                               |
|        |   Data Table (~65%)     |   Side Panel (480px)          |
|        |                         |   (hidden by default)         |
|        |                         |                               |
+--------+-------------------------+-------------------------------+
```

### Key Components

| Component          | Type                   | Source                 | Notes                                                   |
| ------------------ | ---------------------- | ---------------------- | ------------------------------------------------------- |
| AccountsTable      | TanStack Table v8      | UI/UX spec Section 3   | 7 columns, badge columns for type/centerType/status     |
| AcademicYearsTable | TanStack Table v8      | UI/UX spec Section 4.2 | 9 columns, date formatting DD/MM/YYYY                   |
| GradeLevelsTable   | TanStack Table v8      | UI/UX spec Section 4.4 | 9 columns, edit-only (no add/delete), band badges       |
| ReferenceDataTabs  | shadcn/ui Tabs         | UI/UX spec Section 5.1 | 3 tabs: Nationalities, Tariffs, Departments             |
| AssumptionsTable   | TanStack Table v8      | UI/UX spec Section 6   | Grouped sections, inline editing, computed GOSI row     |
| SidePanel          | Custom (480px overlay) | Global Framework 4.4.1 | React Hook Form + Zod validation                        |
| ModuleToolbar      | Custom                 | UI/UX spec Section 2.2 | Search (280px, 300ms debounce), filters, Add New button |

### User Flows

1. **Create Account**: Admin clicks "Add New" -> Side panel opens with empty form -> fills fields -> clicks "Save" -> API POST -> table refreshes -> panel closes -> toast "Account created successfully"
2. **Edit Grade Level**: Admin clicks row -> Side panel opens in edit mode (code/name/band read-only) -> edits maxClassSize and percentages -> clicks "Update" -> API PUT with optimistic lock version -> table refreshes
3. **Edit Assumption**: BudgetOwner clicks editable cell -> cell enters edit mode -> types new value -> Tab/Enter confirms -> auto-save PATCH -> GOSI total recomputes if applicable -> save indicator shows "Saved"
4. **Delete Reference Data**: Admin clicks Trash icon -> Confirmation dialog "Type the code to confirm" -> types code -> clicks Delete -> API DELETE -> row removed -> toast "Deleted successfully"

### Interaction Patterns

- **Side panel CRUD forms**: Vertical field stack, `--space-4` gap, labels above inputs, inline validation per Global Framework Section 4.3
- **Inline editing (Assumptions only)**: Single-click activates edit mode, Enter/Tab confirms, Escape cancels, auto-save on blur
- **Editable cells**: `--cell-editable-bg` (yellow-50) background to distinguish from read-only cells
- **Computed cells**: `--cell-readonly-bg` background with Calculator icon (GOSI total row)
- **Keyboard**: Tab navigates form fields in side panel; Arrow keys navigate table rows; Enter opens side panel or confirms edit

### Accessibility Requirements

- All tables use `role="grid"` with `role="row"`, `role="columnheader"`, `role="gridcell"` per WCAG AA
- Editable cells have `aria-readonly="false"`, read-only cells have `aria-readonly="true"`
- Side panel uses `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing to panel title
- Delete confirmation uses `role="alertdialog"`
- Reference Data tabs use `role="tablist"`, `role="tab"` with `aria-selected`, `role="tabpanel"` with `aria-labelledby`
- Collapsible assumption sections use `aria-expanded`
- Status badges have `aria-label` (e.g., "Status: Active")
- Screen reader announcements via `aria-live` regions: polite for CRUD success, assertive for validation errors
- All interactive elements keyboard accessible (Tab, Enter, Space, Escape, Arrow keys)

### Responsive / Viewport

BudFin targets desktop (1280px min). Master data tables are not virtualized (all datasets < 50 rows). No mobile layout required.

## Edge Cases Cross-Reference

From `docs/edge-cases/` -- list all relevant cases for this feature.

| Case ID   | Description                                                     | Handling                                                                                                                                                                                                |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SA-013    | Fee Grid Cascade on Grade Deletion                              | Mitigated: Grade levels are edit-only (POST/DELETE return 405). Grades cannot be deleted, eliminating cascade risk entirely.                                                                            |
| SA-021    | Dirty Excel Data -- Formula Errors & Missing Values             | Deferred to Epic 12 (Data Migration). Master data CRUD validates all input via Zod schemas and `valueType` enforcement.                                                                                 |
| SA-023    | Decimal vs. Integer Discrepancies in Fee Grid                   | Mitigated: All percentage fields use `DECIMAL(5,4)` in PostgreSQL. API serializes as strings to prevent JSON floating-point loss. `decimal.js` used for any server-side computation (GOSI total).       |
| EC-MDM-01 | Duplicate code insertion (concurrent POST with same code)       | Handled: `@unique` constraint on code fields + Prisma P2002 error mapped to HTTP 409 `DUPLICATE_CODE`.                                                                                                  |
| EC-MDM-02 | Concurrent editing (optimistic lock conflict)                   | Handled: `version` column incremented on each update. PUT/PATCH checks version match; returns HTTP 409 `OPTIMISTIC_LOCK` on mismatch. UI shows conflict dialog with "Keep mine" / "Use theirs" options. |
| EC-MDM-03 | Referential integrity on delete (account referenced by budget)  | Handled: Foreign key constraints block deletion. Prisma P2003 error mapped to HTTP 409 `REFERENCED_RECORD` with message identifying the referencing module.                                             |
| EC-MDM-04 | Assumption value type mismatch (e.g., text in percentage field) | Handled: Zod schema validates value against `valueType` before persistence. `PERCENTAGE` must be numeric 0-100, `CURRENCY` must be non-negative numeric, `INTEGER` must be whole number.                |

## Out of Scope

- Bulk CSV/Excel import (Epic 12 -- Data Migration)
- Master data versioning across budget versions (master data is version-independent)
- Dynamic recalculation triggers (calculations are explicit per PRD D-004)
- Fee grid management (Epic 2 -- Revenue)
- Employee/staff master data (Epic 4 -- Staff Costs)
- Soft delete / archive (hard delete with referential integrity checks)
- Multi-select VAT exempt nationalities parameter (simplified to single-value in v1; multi-select deferred)

## Open Questions

None -- all resolved.

## Planner Agent Sign-Off

- [x] No open questions
- [x] Acceptance criteria are testable
- [x] Edge cases cross-referenced
- [x] Data model complete
- [x] API contract complete
- [x] UI/UX specification complete
