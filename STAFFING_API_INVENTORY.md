# BudFin Staffing API — Complete Inventory

**Date**: 2026-03-19
**Scope**: All staffing-related backend routes, services, and data models
**Status**: Comprehensive (read-only reference document)

---

## Table of Contents

1. [API Routes](#api-routes)
2. [Service Engines](#service-engines)
3. [Prisma Data Models](#prisma-data-models)
4. [Dependencies & Architecture](#dependencies--architecture)

---

## API Routes

### 1. `/api/v1/versions/:versionId/staffing/employees`

**File**: `apps/api/src/routes/staffing/employees.ts`
**Exports**: `employeeRoutes(app: FastifyInstance)`

#### GET `/employees`

- **Params**: `versionId` (int, positive)
- **Query**:
    - `department` (string, optional) — filter by department
    - `status` (enum: 'Existing' | 'New' | 'Departed', optional)
    - `recordType` (enum: 'EMPLOYEE' | 'VACANCY', optional)
    - `page` (int, default 1)
    - `page_size` (int, max 100, default 50)
- **Auth**: `authenticate` only
- **Salary Redaction**: Viewers cannot see `baseSalary`, `housingAllowance`, `transportAllowance`, `responsibilityPremium`, `hsaAmount`, `augmentation` fields
- **Response**: Paginated list of employees with optional salary fields

#### GET `/employees/:id`

- **Params**: `versionId`, `id` (employee ID, int)
- **Auth**: `authenticate` only
- **Response**: Single employee object with salary redaction applied

#### POST `/employees`

- **Params**: `versionId` (int, positive)
- **Body**: `employeeBody` (see schema below)
    - `employeeCode` (string, optional; auto-generated for VAC records)
    - `name` (string, required)
    - `functionRole` (string, required)
    - `department` (string, required)
    - `status` (enum: 'Existing' | 'New' | 'Departed', default 'Existing')
    - `joiningDate` (date, required)
    - `paymentMethod` (string, required)
    - `isSaudi` (boolean, default false)
    - `isAjeer` (boolean, default false)
    - `isTeaching` (boolean, default false)
    - `hourlyPercentage` (string, default '1.0000')
    - `baseSalary` (string, nullable, default '0.0000')
    - `housingAllowance` (string, nullable, default '0.0000')
    - `transportAllowance` (string, nullable, default '0.0000')
    - `responsibilityPremium` (string, default '0.0000')
    - `augmentation` (string, default '0.0000')
    - `augmentationEffectiveDate` (date, nullable, optional)
    - `ajeerAnnualLevy` (string, default '0.0000')
    - `ajeerMonthlyFee` (string, default '0.0000')
    - **Epic 18 fields**:
        - `recordType` (enum: 'EMPLOYEE' | 'VACANCY', default 'EMPLOYEE')
        - `costMode` (enum: 'LOCAL_PAYROLL' | 'AEFE_RECHARGE' | 'NO_LOCAL_COST', default 'LOCAL_PAYROLL')
        - `disciplineId` (int, nullable, optional; required if `isTeaching=true`)
        - `serviceProfileId` (int, nullable, optional; required if `isTeaching=true`)
        - `homeBand` (enum: 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE', nullable, optional; required if `isTeaching=true`)
        - `contractEndDate` (date, nullable, optional)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Validation**:
    - `isTeaching=true` requires `disciplineId`, `serviceProfileId`, `homeBand` (AC-02)
    - Duplicate `employeeCode` check per version
    - For `recordType=VACANCY`, auto-generates `employeeCode` as `VAC-NNN` (AC-04)
    - Salary fields are encrypted via pgcrypto (`pgp_sym_encrypt`)
    - `hsaAmount` always defaults to '0.0000' (computed by pipeline, AC-03)
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log created for `EMPLOYEE_CREATED`
- **Response**: 201 Created; full employee object with decrypted salary fields
- **Constraints**:
    - Only Draft versions can be modified
    - All operations atomic (transaction-scoped)

#### PUT `/employees/:id`

- **Params**: `versionId`, `id` (employee ID, int)
- **Body**: Same as POST (with `employeeCode` optional, retains existing if not provided)
- **Header**: `If-Match` (optimistic locking via `updatedAt`)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Validation**:
    - Optimistic lock check on `updatedAt` if `If-Match` header present
    - Duplicate code check (excluding current record)
    - Teaching field validation (AC-02)
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log created for `EMPLOYEE_UPDATED` with old/new values
- **Response**: Updated employee object (200 OK)
- **Constraints**: Only Draft versions

#### DELETE `/employees/:id`

- **Params**: `versionId`, `id` (employee ID, int)
- **Auth**: `authenticate`, `requireRole('Admin', 'BudgetOwner')`
- **Behavior**:
    - **Draft version**: hard delete
    - **Published version**: soft delete (set `status='Departed'`)
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log created for `EMPLOYEE_DELETED` or `EMPLOYEE_DEPARTED`
- **Response**: 204 No Content

---

### 2. `/api/v1/versions/:versionId/staffing/employees/import`

**File**: `apps/api/src/routes/staffing/import.ts`
**Exports**: `employeeImportRoutes(app: FastifyInstance)`

#### POST `/employees/import`

- **Params**: `versionId` (int, positive)
- **Multipart**:
    - Field `mode` (required): enum 'validate' | 'commit'
    - File: `file` (Excel .xlsx, max 5 MB)
- **Auth**: `authenticate`, `requireRole('Admin', 'BudgetOwner', 'Editor')`
- **Excel Column Mapping**:
    - **Required columns**: `employee_code`, `name`, `function_role`, `department`, `joining_date`, `base_salary`, `housing_allowance`, `transport_allowance`
    - **Optional columns**: `status`, `payment_method`, `is_saudi`, `is_ajeer`, `is_teaching`, `hourly_percentage`, `responsibility_premium`, `augmentation`, `augmentation_effective_date`, `ajeer_annual_levy`, `ajeer_monthly_fee`, `record_type`, `cost_mode`, `home_band`, `contract_end_date`
- **Validation Mode** (`mode=validate`):
    - Parses and validates all rows without persisting
    - Returns preview of valid rows and list of errors/warnings
    - **AC-05**: Resolves `disciplineId` from `functionRole` via `DisciplineAlias` lookup (case-insensitive)
    - **AC-06**: Resolves `serviceProfileId` using heuristics:
        1. Maternelle/Elementaire department → PE
        2. Agrégé role → AGREGE
        3. EPS/Sport role → EPS
        4. Arabe/Islamic role → ARABIC_ISLAMIC
        5. Documentaliste role → DOCUMENTALISTE
        6. Teaching catch-all → CERTIFIE
        7. Non-teaching → null
    - Detects fuzzy duplicates (matching 2+ of: name, department, joining_date)
    - Checks for duplicate codes within file and against existing DB
    - Returns exceptions for unresolvable disciplines/profiles
- **Commit Mode** (`mode=commit`):
    - Fails if validation errors exist (422 Unprocessable Entity)
    - Fails if conflicting employee codes exist in version (409 Conflict)
    - Inserts all valid rows with pgcrypto encryption
    - All salary fields encrypted; `hsaAmount` always '0' (AC-03)
    - Marks STAFFING module as stale
    - Audit log `EMPLOYEE_BULK_IMPORT` includes count, warnings, exceptions
- **Response**:
    - Validate: `{ totalRows, validRows, errors[], conflictingCodes[], duplicateWarnings[], exceptions[], preview[] }`
    - Commit: `{ imported, duplicateWarnings[], exceptions[] }`
- **Constraints**: Only Draft versions

---

### 3. `/api/v1/versions/:versionId/staffing/staffing-assignments`

**File**: `apps/api/src/routes/staffing/assignments.ts`
**Exports**: `staffingAssignmentRoutes(app: FastifyInstance)`

#### GET `/staffing-assignments`

- **Params**: `versionId` (int, positive)
- **Query**:
    - `band` (enum: 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE', optional)
    - `disciplineId` (int, optional)
- **Auth**: `authenticate` only
- **Response**: Array of assignments with employee/discipline details; ordered by band, discipline code, name

#### POST `/staffing-assignments`

- **Params**: `versionId` (int, positive)
- **Body**: `assignmentBody`
    - `employeeId` (int, required)
    - `band` (enum: required)
    - `disciplineId` (int, required)
    - `hoursPerWeek` (decimal up to 2 places, required)
    - `fteShare` (decimal up to 4 places, required)
    - `source` (enum: 'MANUAL' | 'AUTO_SUGGESTED' | 'IMPORTED', default 'MANUAL')
    - `note` (string, max 1000, nullable, optional)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Validation**:
    - Employee must be teaching staff
    - Discipline must exist
    - Total `fteShare` per employee cannot exceed `hourlyPercentage` (AC-04)
    - Unique constraint: `(versionId, employeeId, band, disciplineId)` (only 1 assignment per combo)
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `STAFFING_ASSIGNMENT_CREATED`
- **Response**: 201 Created; assignment object
- **Constraints**: Only Draft versions

#### PUT `/staffing-assignments/:id`

- **Params**: `versionId`, `id` (assignment ID, int)
- **Body**: `assignmentUpdateBody` (same as POST, but `source` optional)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Validation**:
    - Discipline exists
    - FTE share total (excluding current assignment) doesn't exceed `hourlyPercentage`
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `STAFFING_ASSIGNMENT_UPDATED` with old/new values
- **Response**: Updated assignment object (200 OK)
- **Constraints**: Only Draft versions

#### DELETE `/staffing-assignments/:id`

- **Params**: `versionId`, `id` (assignment ID, int)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `STAFFING_ASSIGNMENT_DELETED` with old values
- **Response**: 204 No Content
- **Constraints**: Only Draft versions

#### POST `/staffing-assignments/auto-suggest`

- **Params**: `versionId` (int, positive)
- **Body**: `{ scope: 'HOME_BAND' | 'CROSS_BAND' }`
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Behavior** (AC-02 through AC-07):
    - **AC-02** (Exact band match): High confidence suggestions for employee's `homeBand` + `disciplineCode`
    - **AC-03** (Cross-band College↔Lycee): Medium confidence if `scope='CROSS_BAND'`
    - **AC-04** (Min capacity/gap): Proposes `min(remainingCap, lineGap)` FTE
    - **AC-05** (Exclude fully assigned): Skips employees with `totalFte >= hourlyPercentage`
    - **AC-06** (Filter unmatched): Counts employees with no suggestions
    - **AC-07** (Load requirements): Fails 409 if no TeachingRequirementLine rows exist (calculation required first)
- **Algorithm**:
    1. Load requirement lines for version (409 if none)
    2. Load teaching employees with discipline + homeBand
    3. Load existing assignments to compute remaining capacity per employee
    4. For each employee:
        - Skip if fully assigned (remaining capacity ≤ 0)
        - Match against exact band/discipline lines → High confidence
        - If CROSS_BAND scope, match against cross-band lines → Medium confidence
        - Propose `min(cap, gap)` FTE for each match
    5. Sort by confidence (High first), then employee name
- **Response**: `{ suggestions[], summary: { totalSuggestions, highConfidence, mediumConfidence, unassignedRemaining } }`
- **Side Effects**: None (read-only, no persistence)
- **Constraints**: Only Draft versions; requires STAFFING to not be stale (409 STALE_DATA if stale)

---

### 4. `/api/v1/versions/:versionId/staffing/staff-costs`

**File**: `apps/api/src/routes/staffing/results.ts`
**Exports**: `staffingResultRoutes(app: FastifyInstance)`

#### GET `/staff-costs`

- **Params**: `versionId` (int, positive)
- **Query**:
    - `group_by` (enum: 'employee' | 'department' | 'month' | 'category_month', default 'month')
    - `include_breakdown` (boolean, default false)
- **Auth**: `authenticate` only
- **Pre-condition**: `version.staleModules` must NOT include 'STAFFING' (409 STALE_DATA if stale)
- **Salary Redaction**: Viewers cannot see gross/allowance fields; only social charges visible
- **Response**:
    - `data[]` (grouped by query param)
    - `totals` (annual sums)
    - `breakdown[]` (optional; all monthly staff costs per employee if requested)

#### GET `/staffing-summary`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Pre-condition**: STAFFING not stale (409)
- **Response**:
    - `fte` (annual total FTE from TeachingRequirementLine.requiredFteRaw)
    - `cost` (annual total staff cost from MonthlyStaffCost)
    - `byDepartment[]` (cost per department)

#### GET `/category-costs`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Pre-condition**: STAFFING not stale (409)
- **Response**:
    - `data[]` (monthly breakdown by category; 5 categories: gross_salaries_existing, gross_salaries_new, gosi, ajeer, eos_accrual)
    - `grand_total` (annual sum of all category costs)

---

### 5. `/api/v1/versions/:versionId/staffing/settings`

**File**: `apps/api/src/routes/staffing/settings.ts`
**Exports**: `staffingSettingsRoutes(app: FastifyInstance)`

#### GET `/staffing-settings`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Behavior**: Auto-creates with defaults if not found
- **Response**: `{ data: { id, versionId, hsaTargetHours, hsaFirstHourRate, hsaAdditionalHourRate, hsaMonths, academicWeeks, ajeerAnnualLevy, ajeerMonthlyFee, reconciliationBaseline } }`

#### PUT `/staffing-settings`

- **Params**: `versionId` (int, positive)
- **Body**: `staffingSettingsBody`
    - `hsaTargetHours` (decimal up to 2 places)
    - `hsaFirstHourRate` (decimal up to 2 places)
    - `hsaAdditionalHourRate` (decimal up to 2 places)
    - `hsaMonths` (int, 1–12)
    - `academicWeeks` (int, 1–52)
    - `ajeerAnnualLevy` (decimal up to 4 places)
    - `ajeerMonthlyFee` (decimal up to 4 places)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `STAFFING_SETTINGS_UPDATED`
- **Response**: Updated settings object (200 OK)
- **Constraints**: Only Draft versions

#### GET `/service-profile-overrides`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Response**: Array of `VersionServiceProfileOverride` with serviceProfile details

#### PUT `/service-profile-overrides`

- **Params**: `versionId` (int, positive)
- **Body**: `serviceProfileOverridesBody`
    - `overrides[]`:
        - `serviceProfileId` (int)
        - `weeklyServiceHours` (decimal up to 1 place, nullable, optional)
        - `hsaEligible` (boolean, nullable, optional)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Behavior**: Delete-all-then-recreate pattern
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `SERVICE_PROFILE_OVERRIDES_UPDATED`
- **Response**: Freshly-written overrides list
- **Constraints**: Only Draft versions

#### GET `/cost-assumptions`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Response**: Array of `VersionStaffingCostAssumption`

#### PUT `/cost-assumptions`

- **Params**: `versionId` (int, positive)
- **Body**: `costAssumptionsBody`
    - `assumptions[]`:
        - `category` (enum: 'REMPLACEMENTS' | 'FORMATION' | 'RESIDENT_SALAIRES' | 'RESIDENT_LOGEMENT' | 'RESIDENT_PENSION')
        - `calculationMode` (enum: 'FLAT_ANNUAL' | 'PERCENT_OF_PAYROLL' | 'AMOUNT_PER_FTE')
        - `value` (decimal up to 4 places)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Behavior**: Delete-all-then-recreate
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `COST_ASSUMPTIONS_UPDATED`
- **Response**: Freshly-written assumptions list
- **Constraints**: Only Draft versions

#### GET `/lycee-group-assumptions`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Response**: Array of `VersionLyceeGroupAssumption` with discipline details

#### PUT `/lycee-group-assumptions`

- **Params**: `versionId` (int, positive)
- **Body**: `lyceeGroupAssumptionsBody`
    - `assumptions[]`:
        - `gradeLevel` (string, 1–10 chars)
        - `disciplineId` (int)
        - `groupCount` (int)
        - `hoursPerGroup` (decimal up to 2 places)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Behavior**: Delete-all-then-recreate
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `LYCEE_GROUP_ASSUMPTIONS_UPDATED`
- **Response**: Freshly-written assumptions list
- **Constraints**: Only Draft versions

#### GET `/demand-overrides`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Response**: Array of `DemandOverride` with discipline details

#### PUT `/demand-overrides`

- **Params**: `versionId` (int, positive)
- **Body**: `demandOverridesBody`
    - `overrides[]`:
        - `band` (enum: 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE')
        - `disciplineId` (int)
        - `lineType` (enum: 'STRUCTURAL' | 'HOST_COUNTRY' | 'AUTONOMY' | 'SPECIALTY')
        - `overrideFte` (decimal up to 4 places)
        - `reasonCode` (string, 1–30 chars)
        - `note` (string, max 1000, nullable, optional)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Behavior**: Delete-all-then-recreate (applied in calculate step)
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `DEMAND_OVERRIDES_UPDATED`
- **Response**: Freshly-written overrides list
- **Constraints**: Only Draft versions

#### DELETE `/demand-overrides/:id`

- **Params**: `versionId`, `id` (override ID, int)
- **Auth**: `authenticate`, `requirePermission('data:edit')`
- **Side Effects**:
    - Marks STAFFING module as stale
    - Audit log `DEMAND_OVERRIDE_DELETED`
- **Response**: 204 No Content
- **Constraints**: Only Draft versions

#### GET `/teaching-requirements`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Pre-condition**: STAFFING not stale (409 STALE_DATA)
- **Salary View Check** (AC-14): Non-Admin users without `salary:view` see `null` for `directCostAnnual`, `hsaCostAnnual`, and totals
- **Response**:
    - `lines[]` (TeachingRequirementLine with assigned employees)
    - `totals` (FTE, cost aggregates)
    - `warnings[]` (coverage gaps: band, discipline, status, required, covered, gap)

#### GET `/teaching-requirement-sources`

- **Params**: `versionId` (int, positive)
- **Auth**: `authenticate` only
- **Pre-condition**: STAFFING not stale (409)
- **Response**: Array of `TeachingRequirementSource` (per-grade source detail)

---

### 6. `/api/v1/versions/:versionId/calculate/staffing`

**File**: `apps/api/src/routes/staffing/calculate.ts`
**Exports**: `staffingCalculateRoutes(app: FastifyInstance)`

#### POST `/calculate/staffing` — 10-Step Pipeline (STEP 1–11)

**Params**: `versionId` (int, positive)
**Auth**: `authenticate`, `requirePermission('data:edit')`

**STEP 1: Validate Prerequisites**

- Version must exist and be Draft
- At least 1 AY2 enrollment record
- At least 1 non-Departed employee
- Returns 404 VERSION_NOT_FOUND, 409 VERSION_LOCKED, 422 MISSING_PREREQUISITES as needed

**STEP 2: Load All Inputs**

- Auto-create `VersionStaffingSettings` if missing (AC-01)
- Load enrollment headcounts (AY2)
- Load grade capacity overrides and global grade defaults
- Load DHG rules (year-filtered: `effectiveFromYear ≤ fiscalYear < effectiveToYear`)
- Load service profiles + version overrides → merge
- Load cost assumptions
- Load Lycee group assumptions
- Load demand overrides
- Load employees with decrypted salary via `pgp_sym_decrypt` ($queryRawUnsafe)
- Load staffing assignments with discipline codes

**STEP 3: Run Demand Engine**

- Call `calculateDemand(input)` → produces `DemandEngineOutput` with requirement lines
- Input: enrollments, DHG rules, group assumptions, settings, service profiles

**STEP 4: Apply Demand Overrides (AC-11)**

- For each override keyed by `${band}|${disciplineCode}|${lineType}`:
    - Override `requiredFtePlanned` → `overrideFte`
    - Store pre-override `requiredFteCalculated` for provenance (BC-05)

**STEP 5: Run Coverage Engine (AC-04)**

- Call `calculateCoverage(requirementLines, assignments, teachingEmployeeIds)` → produces coverage output
- Detects gaps, unassigned teachers, and coverage status per line

**STEP 6: Run HSA Engine (AC-05)**

- Call `calculateHsa(hsaInput)` → produces `hsaOutput` (monthly cost, annual per-teacher)
- Identifies HSA-eligible employees:
    - `costMode = 'LOCAL_PAYROLL'` AND
    - `serviceProfile.hsaEligible = true`
- Stores HSA amount per employee for cost engine step

**STEP 7: Run Cost Engine (AC-06)**

- For each employee, call `calculateEmployeeAnnualCost(input)` → produces monthly + EoS breakdown
- Aggregates monthly adjusted gross for category cost computation
- Only `LOCAL_PAYROLL` employees count toward category cost base

**STEP 8: Run Category Cost Engine (AC-07)**

- Call `calculateConfigurableCategoryMonthlyCosts(assumptions, monthlyAdjustedGross, totalTeachingFte)`
- Computes 5 categories: replacement, training, resident salary, resident housing, resident pension

**STEP 9: Aggregate Costs Onto Requirement Lines (AC-08)**

- For each coverage line, sum assigned employee costs proportional to `fteShare`
- Computes `directCostAnnual` and `hsaCostAnnual` per line

**STEP 10: Persist All in Single $transaction (AC-09, AC-10)**

- Delete old: TeachingRequirementSource, TeachingRequirementLine, MonthlyStaffCost, EosProvision, CategoryMonthlyCost
- Insert TeachingRequirementSource rows (per-grade demand source)
- Insert TeachingRequirementLine rows (aggregated demand + coverage + cost)
- Insert MonthlyStaffCost rows (12 months per employee breakdown)
- Insert EosProvision rows (1 per employee)
- Insert CategoryMonthlyCost rows (12 months × 5 categories)
- Update HSA amounts on eligible employees via `pgp_sym_encrypt`
- **CI-01**: Zero out HSA on previously-eligible but now-ineligible employees (idempotency)
- Update `staleModules`: remove 'STAFFING', add 'PNL'

**STEP 11: Audit Log + Return Summary (AC-12)**

- Create `CalculationAuditLog` with `module='STAFFING'`, `status='COMPLETED'`, duration, run ID
- Return: `{ runId, durationMs, summary: { totalFteNeeded, totalFteCovered, totalGap, totalCost, warningCount } }`

**Response**: 200 OK; calculation summary

---

### 7. Master Data Routes — DHG & Service Profiles

**File**: `apps/api/src/routes/master-data/staffing-master-data.ts`
**Exports**: `staffingMasterDataRoutes(app: FastifyInstance)`

#### GET `/service-profiles`

- **Auth**: `authenticate` only
- **Response**: Array of `ServiceObligationProfile` ordered by `sortOrder`

#### GET `/disciplines`

- **Query**: `category` (string, optional)
- **Auth**: `authenticate` only
- **Response**: Array of `Discipline` with aliases, ordered by `sortOrder`

#### GET `/dhg-rules`

- **Query**: `year` (int, optional) — filters to rules active in that year
- **Auth**: `authenticate` only
- **Response**: Array of `DhgRule` with discipline/serviceProfile joins, ordered by grade/discipline

#### POST `/dhg-rules`

- **Body**: `createDhgRuleSchema`
    - `gradeLevel` (string, 1–10 chars)
    - `disciplineId` (int)
    - `lineType` (enum: 'STRUCTURAL' | 'HOST_COUNTRY' | 'AUTONOMY' | 'SPECIALTY')
    - `driverType` (enum: 'HOURS' | 'GROUPS')
    - `hoursPerUnit` (decimal up to 2 places)
    - `serviceProfileId` (int)
    - `languageCode` (string, max 5, nullable, optional)
    - `groupingKey` (string, max 50, nullable, optional)
    - `effectiveFromYear` (int)
    - `effectiveToYear` (int, nullable, optional)
- **Auth**: `authenticate`, `requirePermission('admin:config')`
- **Constraints**: Unique on `(gradeLevel, disciplineId, lineType, languageCode, effectiveFromYear)`
- **Side Effects**: Audit log `DHG_RULE_CREATED`
- **Response**: 201 Created; rule object
- **Error Handling**:
    - 409 DUPLICATE_RULE if unique constraint violated
    - 400 INVALID_REFERENCE if discipline/serviceProfile doesn't exist

#### PUT `/dhg-rules/:id`

- **Params**: `id` (int)
- **Body**: `updateDhgRuleSchema` (includes `updatedAt` for optimistic lock)
- **Auth**: `authenticate`, `requirePermission('admin:config')`
- **Validation**: Optimistic lock on `updatedAt`
- **Side Effects**: Audit log `DHG_RULE_UPDATED` with old/new
- **Response**: Updated rule object (200 OK)
- **Constraints**: Same unique constraint as POST

#### DELETE `/dhg-rules/:id`

- **Params**: `id` (int)
- **Auth**: `authenticate`, `requirePermission('admin:config')`
- **Side Effects**: Audit log `DHG_RULE_DELETED`
- **Response**: 204 No Content
- **Error Handling**: 409 REFERENCED_RECORD if rule is referenced by other data

---

## Service Engines

**Location**: `apps/api/src/services/staffing/`

### 1. `demand-engine.ts`

**Exports**:

- `calculateDemand(input: DemandEngineInput): DemandEngineOutput`
- Types: `DemandEngineInput`, `DemandEngineOutput`, `RequirementLine`, `RequirementSource`, `DemandRuleInput`, `DemandServiceProfile`

**Inputs**:

- Enrollments (headcount per grade)
- DHG rules (discipline-driven hours per unit)
- Group assumptions (Lycee group count + hours)
- Settings (HSA target hours, academic weeks)
- Service profiles (weekly service hours, HSA eligibility)

**Outputs**:

- `lines[]` (one per discipline/grade/lineType combo) with:
    - `requiredFteRaw` (demand-calculated FTE)
    - `totalWeeklyHours`, `baseOrs`, `effectiveOrs`
- `sources[]` (per-grade breakdown for audit trail)

**Algorithm**:

- Groups sections by maxClassSize
- Computes hours-per-section based on DHG rules
- Sums per discipline+band to get FTE
- Applies HSA impact if eligible

---

### 2. `coverage-engine.ts`

**Exports**:

- `calculateCoverage(input: CoverageInput): CoverageOutput`
- Types: `CoverageInput`, `CoverageOutput`, `CoverageRequirementLine`, `CoverageAssignment`, `CoverageWarning`

**Inputs**:

- Requirement lines (demand from demand engine)
- Assignments (staff-to-discipline mappings)
- Teaching employee IDs (for unassigned detection)

**Outputs**:

- Updated lines with:
    - `coveredFte` (sum of assigned FTE)
    - `gapFte` (required − covered)
    - `coverageStatus` ('COVERED' | 'PARTIAL' | 'UNCOVERED')
    - `assignedStaffCount`, `vacancyCount`
- `warnings[]` (unassigned teachers, gaps, etc.)

---

### 3. `cost-engine.ts`

**Exports**:

- `calculateEmployeeAnnualCost(input: EmployeeCostInput): CostOutput`
- Types: `EmployeeCostInput`, `CostOutput`, `CostMode`, `MonthlyBreakdown`

**Inputs** (per employee):

- Salary components (base, allowances, premiums, augmentation, HSA)
- Employment flags (Saudi, Ajeer, teaching, status)
- Hire date
- Cost mode ('LOCAL_PAYROLL' | 'AEFE_RECHARGE' | 'NO_LOCAL_COST')

**Outputs**:

- 12 monthly breakdowns:
    - `baseGross`, `adjustedGross`, allowances, social charges (GOSI, Ajeer), EoS accrual
    - `totalCost` per month
- EoS provision (years of service, base, annual accrual, monthly accrual)
- Annual total cost

**Logic**:

- YEARFRAC for fractional months (hire mid-year, Departed mid-year)
- GOSI (Saudi employer contribution) only for Saudi employees
- Ajeer (expatriate annual levy + monthly fee) for Ajeer flag
- EoS (End-of-Service) accrual per KSA labor law (years × proportional base)

---

### 4. `category-cost-engine.ts`

**Exports**:

- `calculateConfigurableCategoryMonthlyCosts(input: CategoryCostInput): CategoryCost[]`
- Types: `CategoryCostInput`, `CategoryCost`, `CalculationMode`, `CategoryAssumption`

**Inputs**:

- Assumptions (category + calculation mode + value)
- Monthly adjusted gross totals (from cost engine)
- Total teaching FTE raw

**Calculation Modes**:

- `FLAT_ANNUAL` → divide value by 12
- `PERCENT_OF_PAYROLL` → apply % to monthly adjusted gross
- `AMOUNT_PER_FTE` → multiply by total teaching FTE, divide by 12

**Categories**: REMPLACEMENTS, FORMATION, RESIDENT_SALAIRES, RESIDENT_LOGEMENT, RESIDENT_PENSION

**Outputs**: Array of monthly cost records (1 per category per month)

---

### 5. `hsa-engine.ts`

**Exports**:

- `calculateHsa(input: HsaInput): HsaOutput`
- Types: `HsaInput`, `HsaOutput`

**Inputs**:

- HSA target hours (e.g., 1.5 hours/week)
- First-hour rate (e.g., 500 SAR)
- Additional-hour rate (e.g., 400 SAR)
- HSA months (e.g., 10 months)

**Outputs**:

- `hsaCostPerMonth` (monthly charge to eligible employees)
- `hsaAnnualPerTeacher` (annual charge per eligible teacher)

**Logic**:

- Computes cost based on target hours × rates × months
- All eligible teachers within a version get same HSA amount

---

### 6. `dhg-engine.ts`

**Exports**: _(Deprecated in Epic 20; replaced by demand-engine + coverage-engine)_

- Legacy DHG grille computation (retained for reference)

---

### 7. `crypto-helper.ts`

**Exports**:

- `getEncryptionKey(): string` — retrieves `SALARY_ENCRYPTION_KEY` from environment

**Used by**: All salary field operations (employee create/update, import, calculate)

---

### 8. `monthly-gross.ts`

**Exports**:

- `calculateMonthlyGross(...)` — helper for monthly salary proration

---

### 9. `yearfrac.ts`

**Exports**:

- `yearfrac(startDate: Date, endDate: Date, basis: number): number` — Excel-compatible YEARFRAC (TC-002)
- Basis 1: Actual/Actual (day-count accounting)
- Used for EoS and fractional-month cost calculations

---

## Prisma Data Models

**Location**: `apps/api/prisma/schema.prisma`

### Global Master Data (Non-Version-Scoped)

#### `ServiceObligationProfile`

- **Fields**:
    - `id` (int, PK)
    - `code` (string, unique) — e.g., 'CERTIFIE', 'AGREGE', 'PE', 'EPS'
    - `name` (string) — display name
    - `weeklyServiceHours` (decimal 4,1) — e.g., 18.0
    - `hsaEligible` (boolean, default false)
    - `defaultCostMode` (string, default 'LOCAL_PAYROLL')
    - `sortOrder` (int, default 0)
    - `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- **Relations**:
    - `employees` (1:N)
    - `dhgRules` (1:N)
    - `overrides` (1:N to VersionServiceProfileOverride)

#### `Discipline`

- **Fields**:
    - `id` (int, PK)
    - `code` (string, unique) — e.g., 'MATH', 'ENGLISH', 'ARABE'
    - `name` (string)
    - `category` (string, default 'SUBJECT')
    - `sortOrder` (int)
    - `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- **Relations**:
    - `aliases` (1:N to DisciplineAlias)
    - `employees` (1:N)
    - `dhgRules` (1:N)
    - `demandOverrides` (1:N)
    - `lyceeGroupAssumptions` (1:N)
    - `requirementSources` (1:N to TeachingRequirementSource)
    - `staffingAssignments` (1:N)

#### `DisciplineAlias`

- **Fields**:
    - `id` (int, PK)
    - `alias` (string, unique) — case-insensitive lookup key (e.g., 'Mathématiques')
    - `disciplineId` (int, FK)
    - `createdAt`
- **Used by**: Employee import (AC-05) to resolve `functionRole` → `disciplineId`

#### `DhgRule`

- **Fields**:
    - `id` (int, PK)
    - `gradeLevel` (string, e.g., 'GS', 'CP', 'Lycée 1ere')
    - `disciplineId` (int, FK)
    - `lineType` (string, default 'STRUCTURAL') — enum 'STRUCTURAL' | 'HOST_COUNTRY' | 'AUTONOMY' | 'SPECIALTY'
    - `driverType` (string, default 'HOURS') — enum 'HOURS' | 'GROUPS'
    - `hoursPerUnit` (decimal 5,2) — hours per class/group
    - `serviceProfileId` (int, FK)
    - `languageCode` (string, nullable) — e.g., 'AR', 'EN'
    - `groupingKey` (string, nullable) — custom grouping identifier
    - `effectiveFromYear` (int) — fiscal year start
    - `effectiveToYear` (int, nullable) — fiscal year end (null = ongoing)
    - `createdAt`, `updatedAt`
- **Unique Constraint**: `(gradeLevel, disciplineId, lineType, languageCode, effectiveFromYear)`
- **Relations**:
    - `discipline` (N:1)
    - `serviceProfile` (N:1)
- **Temporal Filtering**: Calculate step loads only rules where `effectiveFromYear ≤ version.fiscalYear < effectiveToYear`

---

### Version-Scoped Staffing Models

#### `Employee` (Version-Scoped)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK to BudgetVersion)
    - `employeeCode` (string) — unique per version; auto-generated for VAC records
    - `name` (string)
    - `functionRole` (string) — job title
    - `department` (string) — e.g., 'Teaching', 'Administration'
    - `status` (string, default 'Existing') — enum 'Existing' | 'New' | 'Departed'
    - `joiningDate` (date)
    - `paymentMethod` (string)
    - `isSaudi` (boolean, default false)
    - `isAjeer` (boolean, default false)
    - `isTeaching` (boolean, default false)
    - `hourlyPercentage` (decimal 5,4, default 1.0000) — FTE cap per employee
    - **Encrypted salary fields** (stored as pgcrypto Bytes):
        - `baseSalary`, `housingAllowance`, `transportAllowance`, `responsibilityPremium`
        - `hsaAmount` (computed by pipeline, defaults to '0')
        - `augmentation`
    - `augmentationEffectiveDate` (date, nullable)
    - `ajeerAnnualLevy` (decimal 15,4, default 0)
    - `ajeerMonthlyFee` (decimal 15,4, default 0)
    - `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
    - **Epic 18 fields**:
        - `recordType` (string, default 'EMPLOYEE') — enum 'EMPLOYEE' | 'VACANCY'
        - `costMode` (string, default 'LOCAL_PAYROLL') — enum 'LOCAL_PAYROLL' | 'AEFE_RECHARGE' | 'NO_LOCAL_COST'
        - `disciplineId` (int, nullable, FK)
        - `serviceProfileId` (int, nullable, FK)
        - `homeBand` (string, nullable) — enum 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE'
        - `contractEndDate` (date, nullable)
- **Unique Constraint**: `(versionId, employeeCode)`
- **Relations**:
    - `version` (N:1 to BudgetVersion)
    - `discipline` (N:1)
    - `serviceProfile` (N:1)
    - `monthlyStaffCosts` (1:N)
    - `eosProvision` (1:1)
    - `assignments` (1:N to StaffingAssignment)

#### `StaffingAssignment` (Version-Scoped)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `employeeId` (int, FK)
    - `band` (string) — enum 'MATERNELLE' | 'ELEMENTAIRE' | 'COLLEGE' | 'LYCEE'
    - `disciplineId` (int, FK)
    - `hoursPerWeek` (decimal 5,2)
    - `fteShare` (decimal 5,4) — proportion of employee's capacity assigned to this line
    - `source` (string, default 'MANUAL') — enum 'MANUAL' | 'AUTO_SUGGESTED' | 'IMPORTED'
    - `note` (string, nullable)
    - `createdAt`, `updatedAt`, `updatedBy`
- **Unique Constraint**: `(versionId, employeeId, band, disciplineId)` — only 1 assignment per combo
- **Relations**:
    - `version` (N:1)
    - `employee` (N:1)
    - `discipline` (N:1)
    - `updater` (N:1 to User, nullable)

#### `TeachingRequirementSource` (Version-Scoped, Audit Trail)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `gradeLevel` (string)
    - `disciplineId` (int, FK)
    - `lineType` (string) — e.g., 'STRUCTURAL'
    - `driverType` (string) — e.g., 'HOURS'
    - `headcount` (int)
    - `maxClassSize` (int)
    - `driverUnits` (int)
    - `hoursPerUnit` (decimal 5,2)
    - `totalWeeklyHours` (decimal 10,4)
    - `calculatedAt` (datetime)
- **Unique Constraint**: `(versionId, gradeLevel, disciplineId, lineType)`
- **Purpose**: Audit trail for demand engine input per grade

#### `TeachingRequirementLine` (Version-Scoped, Derived)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `band` (string)
    - `disciplineCode` (string) — discipline code (denormalized for reporting)
    - `lineLabel` (string) — human-readable line label
    - `lineType` (string)
    - `driverType` (string)
    - `serviceProfileCode` (string)
    - `totalDriverUnits` (int)
    - `totalWeeklyHours` (decimal 10,4)
    - `baseOrs` (decimal 5,2) — base weekly hours per section
    - `effectiveOrs` (decimal 5,2) — effective weekly hours (after adjustments)
    - **Demand fields**:
        - `requiredFteRaw` (decimal 7,4) — pure demand-engine result
        - `requiredFteCalculated` (decimal 7,4, nullable) — pre-override planned FTE (BC-05 provenance)
        - `requiredFtePlanned` (decimal 7,4) — after overrides applied
        - `recommendedPositions` (int) — ceil(requiredFtePlanned)
    - **Coverage fields**:
        - `coveredFte` (decimal 7,4)
        - `gapFte` (decimal 7,4)
        - `coverageStatus` (string) — enum 'COVERED' | 'PARTIAL' | 'UNCOVERED'
        - `assignedStaffCount` (int)
        - `vacancyCount` (int)
    - **Cost fields**:
        - `directCostAnnual` (decimal 15,4) — sum of employee costs for this line
        - `hsaCostAnnual` (decimal 15,4) — HSA costs for eligible staff on this line
    - `calculatedAt` (datetime)
- **Unique Constraint**: `(versionId, band, disciplineCode, lineType)`
- **Purpose**: Single denormalized view of complete staffing requirement with coverage + cost

#### `MonthlyStaffCost` (Version-Scoped, Derived)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `employeeId` (int, FK)
    - `month` (int, 1–12)
    - `baseGross` (decimal 15,4)
    - `adjustedGross` (decimal 15,4) — with YEARFRAC proration
    - `housingAllowance`, `transportAllowance`, `responsibilityPremium` (decimal 15,4)
    - `hsaAmount` (decimal 15,4)
    - `gosiAmount` (decimal 15,4) — GOSI/social security
    - `ajeerAmount` (decimal 15,4) — Ajeer expatriate fee
    - `eosMonthlyAccrual` (decimal 15,4) — EoS monthly accrual
    - `totalCost` (decimal 15,4)
    - `calculatedAt`, `calculatedBy`, `createdAt`, `updatedAt`
- **Unique Constraint**: `(versionId, employeeId, month)`
- **Purpose**: Per-employee monthly cost breakdown

#### `EosProvision` (Version-Scoped, Derived)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `employeeId` (int, unique within version, FK)
    - `yearsOfService` (decimal 7,4)
    - `eosBase` (decimal 15,4) — base salary for EoS calc
    - `eosAnnual` (decimal 15,4) — annual EoS liability
    - `eosMonthlyAccrual` (decimal 15,4)
    - `asOfDate` (date) — Dec 31 of fiscal year
    - `calculatedAt`, `createdAt`, `updatedAt`
- **Unique Constraint**: `(versionId, employeeId)`
- **Purpose**: EoS liability per employee per version

#### `CategoryMonthlyCost` (Version-Scoped, Derived)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `month` (int, 1–12)
    - `category` (string) — e.g., 'REMPLACEMENTS', 'FORMATION', 'RESIDENT_SALAIRES'
    - `amount` (decimal 15,4)
    - `calculationMode` (string, default 'PERCENT_OF_PAYROLL')
    - `calculatedAt`, `calculatedBy`, `createdAt`, `updatedAt`
- **Unique Constraint**: `(versionId, month, category)`
- **Purpose**: Additional cost categories per month (e.g., replacements, training, resident housing)

#### `VersionStaffingSettings` (Version-Scoped)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, unique, FK)
    - `hsaTargetHours` (decimal 4,2, default 1.5)
    - `hsaFirstHourRate` (decimal 10,2, default 500)
    - `hsaAdditionalHourRate` (decimal 10,2, default 400)
    - `hsaMonths` (int, default 10)
    - `academicWeeks` (int, default 36)
    - `ajeerAnnualLevy` (decimal 15,4, default 9500)
    - `ajeerMonthlyFee` (decimal 15,4, default 160)
    - `reconciliationBaseline` (JSON, nullable)
    - `createdAt`, `updatedAt`

#### `VersionServiceProfileOverride` (Version-Scoped)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `serviceProfileId` (int, FK)
    - `weeklyServiceHours` (decimal 4,1, nullable)
    - `hsaEligible` (boolean, nullable)
    - `createdAt`, `updatedAt`
- **Unique Constraint**: `(versionId, serviceProfileId)`
- **Purpose**: Override global service profile settings per version

#### `VersionStaffingCostAssumption` (Version-Scoped)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `category` (string)
    - `calculationMode` (string) — enum 'FLAT_ANNUAL' | 'PERCENT_OF_PAYROLL' | 'AMOUNT_PER_FTE'
    - `value` (decimal 15,4)
    - `createdAt`, `updatedAt`
- **Unique Constraint**: `(versionId, category)`

#### `VersionLyceeGroupAssumption` (Version-Scoped)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `gradeLevel` (string)
    - `disciplineId` (int, FK)
    - `groupCount` (int)
    - `hoursPerGroup` (decimal 5,2)
    - `createdAt`, `updatedAt`
- **Unique Constraint**: `(versionId, gradeLevel, disciplineId)`

#### `DemandOverride` (Version-Scoped)

- **Fields**:
    - `id` (int, PK)
    - `versionId` (int, FK)
    - `band` (string)
    - `disciplineId` (int, FK)
    - `lineType` (string)
    - `overrideFte` (decimal 7,4)
    - `reasonCode` (string) — e.g., 'BUDGET_CONSTRAINT', 'REORGANIZATION'
    - `note` (string, nullable)
    - `createdAt`, `updatedAt`, `updatedBy`
- **Unique Constraint**: `(versionId, band, disciplineId, lineType)`
- **Purpose**: Manual override of required FTE (applied in calculate step STEP 4)

---

## Dependencies & Architecture

### Import Hierarchy

```
routes/
  staffing/
    index.ts (registers sub-routes)
      ├─ employees.ts (Employee CRUD + list)
      │  └─ services/staffing/crypto-helper.ts (salary decryption)
      ├─ assignments.ts (StaffingAssignment CRUD + auto-suggest)
      ├─ results.ts (MonthlyStaffCost, EosProvision, CategoryMonthlyCost reporting)
      ├─ settings.ts (VersionStaffingSettings, overrides, assumptions, demand-overrides, teaching-requirements)
      ├─ import.ts (Employee bulk import from Excel)
      │  ├─ DisciplineAlias lookup for discipline resolution (AC-05)
      │  └─ Service profile heuristic matching (AC-06)
      └─ calculate.ts (10-step pipeline orchestration)
         ├─ demand-engine.ts (STEP 3)
         ├─ coverage-engine.ts (STEP 5)
         ├─ hsa-engine.ts (STEP 6)
         ├─ cost-engine.ts (STEP 7)
         │  └─ yearfrac.ts (Excel-compatible fractional year calc)
         ├─ category-cost-engine.ts (STEP 8)
         └─ crypto-helper.ts (salary encryption/decryption)

  master-data/
    staffing-master-data.ts (ServiceProfile, Discipline, DhgRule CRUD)
```

### Key Architectural Patterns

1. **Encryption**:
    - All salary fields (5 fields) encrypted with pgcrypto `pgp_sym_encrypt`/`pgp_sym_decrypt`
    - Key from environment variable `SALARY_ENCRYPTION_KEY`
    - Queries use `$queryRawUnsafe` with parameterized key (never interpolated)

2. **Stale Module Tracking**:
    - Any employee/assignment/setting change marks 'STAFFING' as stale
    - Frontend displays warning when stale
    - Calculate clears stale flag, adds 'PNL' as stale

3. **Salary Redaction** (AC-14):
    - Viewers (role='Viewer') see `NULL` for salary fields
    - Controlled at route level via `formatEmployee()` helper

4. **Transactions**:
    - Employee CRUD, settings, overrides, demand-overrides all use atomic transactions
    - Calculate STEP 10 is single massive transaction (all-or-nothing persistence)

5. **Audit Trail**:
    - Every mutation logged to `AuditEntry` with operation, old/new values
    - Calculate step logs to `CalculationAuditLog` with run ID, input/output summary

6. **Pure Functions**:
    - All engines in `services/staffing/` are pure (no DB deps)
    - Routes call engines, then persist results

7. **Version Scoping**:
    - All staffing models scoped to single version via `versionId` FK
    - Isolation: no cross-version calculations
    - Cloning: source version can be copied to create new draft

---

## Summary Statistics

- **API Endpoints**: 25+ routes (employees, assignments, results, settings, import, calculate, master-data)
- **Service Engines**: 6 calculation engines (demand, coverage, HSA, cost, category-cost, DHG)
- **Data Models**: 18 staffing-related Prisma models (9 global, 9 version-scoped)
- **Encrypted Fields**: 5 (base_salary, housing_allowance, transport_allowance, responsibility_premium, hsa_amount, augmentation)
- **Audit Operations**: 20+ operation types logged
- **Calculation Steps**: 11-step pipeline (STEP 1–11) including prerequisites, inputs, 6 engines, persistence, audit

---

## Cross-References

- **Calculation Pipeline**: `/api/v1/versions/:versionId/calculate/staffing` (POST)
- **Settings**: `/api/v1/versions/:versionId/staffing-settings` (GET/PUT)
- **Results**: `/api/v1/versions/:versionId/staff-costs` (GET)
- **Employees**: `/api/v1/versions/:versionId/employees` (CRUD)
- **Assignments**: `/api/v1/versions/:versionId/staffing-assignments` (CRUD)
- **Master Data**: `/api/v1/master-data/dhg-rules`, `/service-profiles`, `/disciplines`

---

**End of Inventory**
