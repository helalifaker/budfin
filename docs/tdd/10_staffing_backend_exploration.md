# BudFin Staffing Backend - Complete Exploration

**Date:** 2026-03-19
**Scope:** Comprehensive review of staffing API routes, calculation engines, data models, and FTE/coverage logic

---

## Executive Summary

The BudFin staffing module implements a sophisticated demand-driven staffing calculation pipeline. It:

1. **Computes teaching demand** from enrollment headcounts using DHG rules (Demandes de Heures Globales)
2. **Tracks coverage** by matching teacher assignments to requirement lines
3. **Calculates costs** with support for multiple employment models (local, recharge, no-cost)
4. **Manages HSA** (additional service obligations) for eligible roles
5. **Persists all results** in a single atomic transaction

The system is fully calculator-driven: all 10 calculation steps are pure functions with no direct database dependencies (except for the final transaction).

---

## 1. Data Model

### 1.1 Core Entities

#### `Employee`

Represents a hired staff member or vacancy placeholder.

| Field                       | Type    | Notes                                                 |
| --------------------------- | ------- | ----------------------------------------------------- |
| `id`                        | int     | Primary key                                           |
| `versionId`                 | int     | FK to BudgetVersion                                   |
| `employeeCode`              | string  | Unique per version                                    |
| `name`                      | string  | Full name                                             |
| `status`                    | enum    | 'Existing', 'New', 'Departed'                         |
| `isTeaching`                | bool    | True if subject teacher                               |
| `hourlyPercentage`          | decimal | 0.0000-1.0000 (FTE capacity)                          |
| `costMode`                  | enum    | 'LOCAL_PAYROLL' \| 'AEFE_RECHARGE' \| 'NO_LOCAL_COST' |
| `recordType`                | enum    | 'EMPLOYEE' \| 'VACANCY' (Epic 18)                     |
| `disciplineId`              | int?    | Foreign key to Discipline (teacher only)              |
| `serviceProfileId`          | int?    | Foreign key to ServiceObligationProfile               |
| **Encrypted salary fields** |
| `baseSalary`                | bytes   | pgp_sym_encrypt'd                                     |
| `housingAllowance`          | bytes   | pgp_sym_encrypt'd                                     |
| `transportAllowance`        | bytes   | pgp_sym_encrypt'd                                     |
| `responsibilityPremium`     | bytes   | pgp_sym_encrypt'd                                     |
| `hsaAmount`                 | bytes   | Updated during calculation                            |
| `augmentation`              | bytes   | Salary increase effective date support                |
| **Ajeer fields**            |
| `isAjeer`                   | bool    | Non-Saudi insurance                                   |
| `ajeerAnnualLevy`           | decimal | Contribution amount                                   |
| `ajeerMonthlyFee`           | decimal | Admin fee                                             |

**Status Lifecycle:**

- `Existing`: Already employed
- `New`: Hired this year; Ajeer contributions start month 9 only
- `Departed`: No cost rows generated; assignments ignored in coverage

**Cost Mode Impact:**

- `LOCAL_PAYROLL` (default): Full 12-month cost; included in category calculations
- `AEFE_RECHARGE`: Zero-cost rows (12 × all zeros); excluded from payroll totals
- `NO_LOCAL_COST`: No rows generated; entirely skipped

#### `StaffingAssignment`

Links employees to requirement lines. Many-to-many bridge.

| Field                                                     | Type    | Notes                                           |
| --------------------------------------------------------- | ------- | ----------------------------------------------- |
| `versionId`                                               | int     | FK                                              |
| `employeeId`                                              | int     | FK                                              |
| `band`                                                    | string  | 'MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE' |
| `disciplineId`                                            | int     | FK to Discipline                                |
| `hoursPerWeek`                                            | decimal | e.g. 18.0 (unused for now, audit field)         |
| `fteShare`                                                | decimal | 0.0000-1.0000 (e.g. 0.5000 = half FTE)          |
| `source`                                                  | enum    | 'MANUAL' \| 'AUTO_SUGGESTED' \| 'IMPORTED'      |
| **Unique:** `(versionId, employeeId, band, disciplineId)` |

**Critical Constraint:**
For each employee, `SUM(fteShare)` across all assignments **must be ≤** employee's `hourlyPercentage`.

- E.g., if hourlyPercentage = 0.8, can assign max 0.8 FTE total
- Validated by `validateFteShareLimit()` on create/update

#### `TeachingRequirementLine`

Computed during staffing calculation. One row per (band, disciplineCode, lineType).

| Field                                     | Type    | Notes                                              |
| ----------------------------------------- | ------- | -------------------------------------------------- |
| `versionId`                               | int     | FK                                                 |
| `band`                                    | string  | Aggregated from multiple grades                    |
| `disciplineCode`                          | string  | e.g., "FRENCH", "MATHS", "PE"                      |
| `lineLabel`                               | string  | Human-readable label                               |
| `lineType`                                | string  | 'STRUCTURAL', 'SUPPORT', etc.                      |
| `serviceProfileCode`                      | string  | e.g., "TEACHER_18"                                 |
| **Driver Info**                           |
| `totalDriverUnits`                        | int     | Sections or groups needed                          |
| `totalWeeklyHours`                        | decimal | SUM(driver_units × hours_per_unit)                 |
| `driverType`                              | string  | 'HOURS', 'SECTION', 'GROUP'                        |
| **ORS (Obligation de Service Régulière)** |
| `baseOrs`                                 | decimal | e.g., 18.0 hours/week                              |
| `effectiveOrs`                            | decimal | baseOrs + 1.5 if HSA-eligible                      |
| **FTE Calculations**                      |
| `requiredFteRaw`                          | decimal | Based on baseOrs                                   |
| `requiredFteCalculated`                   | decimal | Pre-override demand (audit trail)                  |
| `requiredFtePlanned`                      | decimal | Post-override, based on effectiveOrs               |
| `recommendedPositions`                    | int     | ceil(requiredFteRaw)                               |
| **Coverage**                              |
| `coveredFte`                              | decimal | SUM(assignment.fteShare) for active employees      |
| `gapFte`                                  | decimal | coveredFte - requiredFteRaw                        |
| `coverageStatus`                          | enum    | 'UNCOVERED' \| 'DEFICIT' \| 'COVERED' \| 'SURPLUS' |
| `assignedStaffCount`                      | int     | # of EMPLOYEE records assigned                     |
| `vacancyCount`                            | int     | # of VACANCY records assigned                      |
| **Costs**                                 |
| `directCostAnnual`                        | decimal | SUM(employee_cost × fteShare)                      |
| `hsaCostAnnual`                           | decimal | SUM(hsa_annual × fteShare for HSA-eligible)        |

#### `TeachingRequirementSource`

Audit trail. One row per (gradeLevel, disciplineCode, lineType). **Multiple source rows aggregate into one requirement line.**

| Field              | Type    | Notes                                      |
| ------------------ | ------- | ------------------------------------------ |
| `versionId`        | int     | FK                                         |
| `gradeLevel`       | string  | 'CP', 'CE1', '6EME', '2NDE', etc.          |
| `disciplineId`     | int     | FK (not code)                              |
| `lineType`         | string  | 'STRUCTURAL', 'SUPPORT', etc.              |
| `driverType`       | string  | 'HOURS', 'SECTION', 'GROUP'                |
| `headcount`        | int     | AY2 enrollment for this grade              |
| `maxClassSize`     | int     | Grade-level max                            |
| `driverUnits`      | int     | Sections needed (headcount / maxClassSize) |
| `hoursPerUnit`     | decimal | From DHG rule or group assumption          |
| `totalWeeklyHours` | decimal | driverUnits × hoursPerUnit                 |

**Purpose:** Allows auditing which grades contributed to each requirement line.

#### `DhgRule` (Replaces Deprecated `DhgRequirement`)

Demand rules: how to calculate teaching hours from enrollment.

| Field                                                                               | Type    | Notes                                       |
| ----------------------------------------------------------------------------------- | ------- | ------------------------------------------- |
| `gradeLevel`                                                                        | string  | 'CP', '6EME', '2NDE', etc.                  |
| `disciplineId`                                                                      | int     | FK                                          |
| `lineType`                                                                          | string  | 'STRUCTURAL', 'SUPPORT', etc.               |
| `driverType`                                                                        | string  | 'HOURS' (default), 'SECTION', 'GROUP'       |
| `hoursPerUnit`                                                                      | decimal | e.g., 1.5 hours per section for French      |
| `serviceProfileId`                                                                  | int     | FK to ServiceObligationProfile (ORS source) |
| `languageCode`                                                                      | string? | 'FR', 'AR', 'EN', etc.                      |
| `groupingKey`                                                                       | string? | Custom grouping for override logic          |
| `effectiveFromYear`                                                                 | int     | Fiscal year rule begins                     |
| `effectiveToYear`                                                                   | int?    | Fiscal year rule ends (null = ongoing)      |
| **Unique:** `(gradeLevel, disciplineId, lineType, languageCode, effectiveFromYear)` |

**Example:** Grade CP + French STRUCTURAL = 1.5 hours per section, 18-hour profile

#### `ServiceObligationProfile`

Teacher workload standard (ORS).

| Field                | Type    | Notes                          |
| -------------------- | ------- | ------------------------------ |
| `code`               | string  | 'TEACHER_18', 'ADMIN_35', etc. |
| `weeklyServiceHours` | decimal | Base ORS (e.g., 18.0)          |
| `hsaEligible`        | bool    | Can receive +1.5 HSA hours?    |
| `defaultCostMode`    | enum    | 'LOCAL_PAYROLL' (default)      |

#### `MonthlyStaffCost` (Computed)

Per employee, per month. 12 × # employees rows.

| Field                   | Type    | Notes                                     |
| ----------------------- | ------- | ----------------------------------------- |
| `versionId`             | int     | FK                                        |
| `employeeId`            | int     | FK                                        |
| `month`                 | int     | 1-12                                      |
| `baseGross`             | decimal | base_salary + allowances + responsibility |
| `adjustedGross`         | decimal | (accounting adjustments TBD)              |
| `housingAllowance`      | decimal | Decrypted, copied                         |
| `transportAllowance`    | decimal | Decrypted, copied                         |
| `responsibilityPremium` | decimal | Decrypted, copied                         |
| `hsaAmount`             | decimal | From HSA calculation                      |
| `gosiAmount`            | decimal | 11.75% of adjustedGross (Saudi only)      |
| `ajeerAmount`           | decimal | Non-Saudi employee insurance              |
| `eosMonthlyAccrual`     | decimal | EOS provision amortized                   |
| `totalCost`             | decimal | Sum of all above                          |

#### `EosProvision` (Computed)

End-of-Service accrual per employee.

| Field               | Type    | Notes                                       |
| ------------------- | ------- | ------------------------------------------- |
| `versionId`         | int     | FK                                          |
| `employeeId`        | int     | FK (unique per employee)                    |
| `yearsOfService`    | decimal | YEARFRAC(hireDate, asOfDate)                |
| `eosBase`           | decimal | base + housing + transport + responsibility |
| `eosAnnual`         | decimal | See EOS formula below                       |
| `eosMonthlyAccrual` | decimal | eosAnnual / 12                              |
| `asOfDate`          | date    | Calculation date (year-end)                 |

#### `CategoryMonthlyCost` (Computed)

Category-level costs (e.g., health insurance, bonuses).

| Field             | Type    | Notes                            |
| ----------------- | ------- | -------------------------------- |
| `versionId`       | int     | FK                               |
| `month`           | int     | 1-12                             |
| `category`        | string  | e.g., "HEALTH", "BONUS", "LUNCH" |
| `amount`          | decimal | Computed from assumption         |
| `calculationMode` | enum    | 'PERCENT_OF_PAYROLL' (default)   |

---

## 2. FTE Calculation

### 2.1 The Three FTE Values Per Line

Each requirement line computes **three FTE figures**:

1. **`requiredFteRaw`** (from baseOrs)
    - Represents the true demand in standard full-time equivalents
    - Used for coverage gap calculation: `gapFte = coveredFte - requiredFteRaw`
    - Formula: `totalWeeklyHours / baseOrs`

2. **`requiredFteCalculated`** (audit trail)
    - Snapshot of demand-engine value before manual demand overrides
    - Stored for provenance (BC-05)
    - Used in reports to show "what the algorithm wanted"

3. **`requiredFtePlanned`** (post-override, includes HSA)
    - The "planning FTE" after manual overrides are applied
    - Formula: `totalWeeklyHours / effectiveOrs`
    - If HSA-eligible: `effectiveOrs = baseOrs + 1.5`
    - Used for recommended positions: `recommendedPositions = ceil(requiredFtePlanned)`

### 2.2 Driver Types & Hour Calculation

**SECTION Driver (Flat Units)**

- `driverUnits = ceil(headcount / maxClassSize)` — number of sections needed
- `totalWeeklyHours = 0` (no hours, just section count)
- `requiredFteRaw = driverUnits` (1:1, no ORS division)
- Example: 100 students ÷ 25 max = 4 sections = 4.0 FTE

**HOURS Driver (Hours-per-Unit)**

- `driverUnits = sections_needed` (same calculation)
- `totalWeeklyHours = driverUnits × hoursPerUnit`
- `requiredFteRaw = totalWeeklyHours / baseOrs`
- Example: 4 sections × 1.5 hours/section = 6 hours; 6 ÷ 18 ORS = 0.3333 FTE

**GROUP Driver (Lycée-specific)**

- `driverUnits = groupCount` (from VersionLyceeGroupAssumption)
- `totalWeeklyHours = groupCount × hoursPerGroup`
- `requiredFteRaw = totalWeeklyHours / baseOrs`
- Example: 3 groups × 3 hours/group = 9 hours; 9 ÷ 18 = 0.5 FTE

### 2.3 ORS (Obligation de Service Régulière)

`baseOrs` comes from the service profile linked to the DHG rule.

- **Teachers:** 18.0 hours/week (typical)
- **Admin:** 35.0 hours/week
- **Support:** varies

If the service profile is HSA-eligible:

```
effectiveOrs = baseOrs + 1.5 hours = 18.0 + 1.5 = 19.5
```

This reflects that HSA-eligible teachers work 1.5 additional hours per week on average.

### 2.4 Demand Aggregation (Demand-to-Line)

**Demand Engine Groups:**

1. By `(band, disciplineCode, lineType)` across all source rows
2. Summing: `totalDriverUnits` and `totalWeeklyHours`
3. Outputs one **RequirementLine** per group

Example:

- Source: CP French STRUCTURAL = 6 hours
- Source: CE1 French STRUCTURAL = 8 hours
- **Aggregate:** ELEMENTAIRE French STRUCTURAL = 14 hours; FTE = 14 / 18 = 0.7778

### 2.5 Demand Overrides (Manual Adjustment)

Via `DemandOverride` table:

- `(versionId, band, disciplineId, lineType)` → `overrideFte`

After demand engine runs, if override exists:

```
requiredFtePlanned = overrideFte
recommendedPositions = ceil(overrideFte)
```

`requiredFteCalculated` preserves the pre-override value for audit.

---

## 3. Coverage Calculation

### 3.1 Coverage Metrics Per Line

**Matched Assignments:**
All `StaffingAssignment` records where:

- `status !== 'Departed'` (only active employees)
- `(band, disciplineCode)` matches the requirement line
- Note: lineType does NOT filter; all types for a discipline/band pool together

**Covered FTE:**

```
coveredFte = SUM(assignment.fteShare) for all matched assignments
```

Example: 2 assignments (0.5 + 0.3 FTE) → `coveredFte = 0.8`

**Gap FTE:**

```
gapFte = coveredFte - requiredFteRaw
```

- Negative = shortfall (vacancy)
- Positive = surplus (over-staffed)
- Zero/near-zero = balanced

### 3.2 Coverage Status Classification

Uses two thresholds (±0.25 FTE):

| Status      | Condition             | Meaning               |
| ----------- | --------------------- | --------------------- |
| `UNCOVERED` | No assignments        | Zero coverage         |
| `DEFICIT`   | gapFte < -0.25        | Significant shortfall |
| `COVERED`   | -0.25 ≤ gapFte ≤ 0.25 | Within tolerance      |
| `SURPLUS`   | gapFte > 0.25         | Over-staffed          |

Example:

- requiredFteRaw = 2.0, coveredFte = 1.5 → gapFte = -0.5 → **DEFICIT**
- requiredFteRaw = 2.0, coveredFte = 1.95 → gapFte = -0.05 → **COVERED**

### 3.3 Assignment Counts

Per line:

- **`assignedStaffCount`:** # of `recordType = 'EMPLOYEE'` assignments
- **`vacancyCount`:** # of `recordType = 'VACANCY'` assignments

Used for staffing plan visibility.

### 3.4 Warnings Emitted

The coverage engine detects 5 types of issues:

| Warning                     | Trigger                             | Meaning                            |
| --------------------------- | ----------------------------------- | ---------------------------------- |
| `UNCOVERED`                 | No assignments                      | Requirement line has zero coverage |
| `DEFICIT`                   | gapFte < -0.25                      | Major gap; hard to fill            |
| `COVERED`                   | -0.25 ≤ gapFte ≤ 0.25               | Within tolerance (informational)   |
| `SURPLUS`                   | gapFte > 0.25                       | Over-staffed; redundancy           |
| `OVER_ASSIGNED`             | SUM(fteShare) > hourlyPercentage    | Employee overbooked across lines   |
| `ORPHANED_ASSIGNMENT`       | No matching requirement line        | Dead assignment; no demand         |
| `UNASSIGNED_TEACHER`        | Teaching employee, zero assignments | Teacher not allocated              |
| `DEPARTED_WITH_ASSIGNMENTS` | Departed employee still assigned    | Stale assignment                   |
| `RECHARGE_COVERAGE`         | Line covered by AEFE_RECHARGE       | Zero-cost coverage; audit flag     |

---

## 4. Cost Engines

### 4.1 Cost Mode Impact

| Mode            | Monthly Rows      | Included in Category Payroll | Use Case             |
| --------------- | ----------------- | ---------------------------- | -------------------- |
| `LOCAL_PAYROLL` | 12 full-cost rows | ✓ Yes                        | Normal employees     |
| `AEFE_RECHARGE` | 12 zero-cost rows | ✗ No                         | AEFE-funded teachers |
| `NO_LOCAL_COST` | None (empty)      | ✗ No                         | Non-staff roles      |

### 4.2 Monthly Gross Calculation

**Base Gross:**

```
baseGross = baseSalary + housingAllowance + transportAllowance
          + responsibilityPremium + hsaAmount + augmentation
```

**Adjusted Gross:**
(Accounting-specific adjustments; currently same as baseGross)

### 4.3 GOSI (Social Insurance)

**Saudi employees only:**

```
gosiAmount = adjustedGross × 11.75%
```

Non-Saudi: 0

### 4.4 Ajeer (Non-Saudi Insurance)

**Conditions:**

- `isAjeer = true` AND
- `isSaudi = false`

**Calculation per month:**

- **Existing (status = 'Existing'):** 12 months
    ```
    ajeerAmount = (ajeerAnnualLevy / 12) + ajeerMonthlyFee
    ```
- **New (status = 'New'):** Only months 9-12
    ```
    ajeerAmount = (ajeerAnnualLevy / 12) + ajeerMonthlyFee (only Sep-Dec)
    ajeerAmount = 0 (for months 1-8)
    ```

### 4.5 End-of-Service (EOS) Accrual

**Years of Service:**

```
yearsOfService = YEARFRAC(hireDate, asOfDate) using US 30/360 convention
```

**EOS Salary Base** (excludes HSA):

```
eosBase = baseSalary + housingAllowance + transportAllowance + responsibilityPremium
```

**Annual EOS:**

- If YoS ≤ 5:
    ```
    eosAnnual = (eosBase / 2) × yearsOfService
    ```
- If YoS > 5:
    ```
    eosAnnual = (eosBase / 2 × 5) + eosBase × (yearsOfService - 5)
    eosAnnual = eosBase × (2.5 + yearsOfService - 5)
    eosAnnual = eosBase × (yearsOfService - 2.5)
    ```

**Monthly Accrual:**

```
eosMonthlyAccrual = eosAnnual / 12
```

### 4.6 Total Monthly Cost

```
totalCost = adjustedGross + gosiAmount + ajeerAmount + eosMonthlyAccrual
```

Note: Does NOT include category costs (health, bonuses, etc.) — those are stored separately.

### 4.7 HSA Calculation

**HSA Monthly Cost** (if eligible):

```
hsaCostPerMonth = firstHourRate + (hsaTargetHours - 1) × additionalHourRate
```

Default: `500 + 0.5 × 400 = 700/month = 7000/year`

**Annual:**

```
hsaAnnualPerTeacher = hsaCostPerMonth × hsaMonths (default 10)
```

**Eligibility:**

- `serviceProfile.hsaEligible = true` AND
- `employee.costMode = 'LOCAL_PAYROLL'`

**Application:** HSA amount written to `employees.hsa_amount` field (encrypted) during calculation. Non-eligible employees zeroed out (CI-01).

---

## 5. Category Costs

### 5.1 Cost Assumptions

Per version: `VersionStaffingCostAssumption`

- `category` (string, e.g., "HEALTH_INSURANCE")
- `calculationMode` (e.g., "PERCENT_OF_PAYROLL")
- `value` (decimal)

### 5.2 PERCENT_OF_PAYROLL Mode

```
monthlyAmount = sum(adjustedGross for LOCAL_PAYROLL employees in month M) × value
```

Example: If HEALTH category = 0.05 (5%) and August payroll = 500,000 SAR:

```
categoryAmount[8] = 500,000 × 0.05 = 25,000 SAR
```

**Key:** Only LOCAL_PAYROLL employees included; AEFE_RECHARGE and NO_LOCAL_COST excluded.

### 5.3 Output

`CategoryMonthlyCost` table: 12 × # of categories rows.

---

## 6. The 10-Step Calculation Pipeline

Implemented in `apps/api/src/routes/staffing/calculate.ts:65-842`

### Step 1: Validate Prerequisites

- Version exists and is Draft status
- ≥ 1 AY2 enrollment record
- ≥ 1 non-Departed employee

### Step 2: Load All Inputs

- Settings (auto-create if missing)
- Enrollments (AY2)
- Grade levels + capacity overrides
- DHG rules (year-filtered)
- Service profiles + version overrides (merged)
- Cost assumptions
- Lycée group assumptions
- Demand overrides
- Employees (raw, decrypted via pgcrypto)
- Staffing assignments

### Step 3: Run Demand Engine (Pure Function)

- Input: enrollments, rules, settings, service profiles
- Output: RequirementSource rows + RequirementLine rows with requiredFteRaw/Planned

### Step 4: Apply Demand Overrides

- Lookup overrides by `(band, disciplineCode, lineType)`
- Replace requiredFtePlanned with override if exists
- Store pre-override value in requiredFteCalculated

### Step 5: Run Coverage Engine (Pure Function)

- Input: requirement lines, assignments, teaching employee IDs
- Output: updated lines with coveredFte, gapFte, coverageStatus, counts
- Warnings: OVER_ASSIGNED, ORPHANED, UNASSIGNED_TEACHER, DEPARTED, RECHARGE

### Step 6: Run HSA Engine (Pure Function)

- Compute hsaCostPerMonth and hsaAnnualPerTeacher
- Build set of HSA-eligible employee IDs (profile + LOCAL_PAYROLL)

### Step 7: Run Cost Engine (Pure Function)

- For each employee:
    - If LOCAL_PAYROLL: compute all 12 months with full costs
    - If AEFE_RECHARGE: generate 12 zero-cost rows
    - If NO_LOCAL_COST: skip (empty)
    - Compute EOS provision
- Track monthlyAdjustedGrossTotals by month (LOCAL_PAYROLL only)

### Step 8: Run Category Cost Engine (Pure Function)

- For each assumption: compute monthly amount
- If PERCENT_OF_PAYROLL: amount = monthlyAdjustedGrossTotals[month] × value

### Step 9: Aggregate Costs onto Requirement Lines

- Per line, find all assignments matching (band, disciplineCode)
- For each assignment:
    - `directCostAnnual += employeeAnnualCost × fteShare`
    - If HSA-eligible: `hsaCostAnnual += hsaAnnualPerTeacher × fteShare`

### Step 10: Persist in Single Transaction

- Delete old: TeachingRequirementSource, TeachingRequirementLine, MonthlyStaffCost, EosProvision, CategoryMonthlyCost
- Insert new TeachingRequirementSource rows
- Insert new TeachingRequirementLine rows (with directCostAnnual, hsaCostAnnual)
- Insert new MonthlyStaffCost rows (12 per employee)
- Insert new EosProvision rows (1 per employee)
- Insert new CategoryMonthlyCost rows
- Update HSA amounts on eligible employees (pgcrypto)
- Zero out HSA for non-eligible employees (CI-01)
- Update version.staleModules: remove 'STAFFING', add 'PNL'

### Step 11: Return Summary & Audit Log

- Return: runId, durationMs, totalFteNeeded, totalFteCovered, totalGap, totalCost, warningCount
- Create CalculationAuditLog entry with input/output summary

---

## 7. Staffing Routes

All routes under `/api/v1/versions/:versionId/staffing`

### 7.1 Employees

**GET** — List all employees

- Query: `band?`, `disciplineId?`, `status?`
- Returns: decrypted salary fields (requires salary:view permission)

**GET** `/:id` — Single employee detail

**POST** — Create employee (requires data:edit)

**PATCH** `/:id` — Update employee

**DELETE** `/:id` — Mark as Departed (soft delete)

### 7.2 Assignments

**GET** — List assignments

- Query: `band?`, `disciplineId?`
- Returns: employee + discipline details

**GET** `/:id` — Single assignment

**POST** — Create assignment (requires data:edit)

- Validates: fteShare doesn't exceed hourlyPercentage
- Marks STAFFING stale

**PATCH** `/:id` — Update assignment (requires data:edit)

- Same validation

**DELETE** `/:id` — Remove assignment (requires data:edit)

- Marks STAFFING stale

### 7.3 Staffing Settings (VersionStaffingSettings)

**GET** — Retrieve settings for version

**PATCH** — Update settings

- HSA thresholds, academic weeks, Ajeer defaults, etc.

### 7.4 Cost Assumptions (VersionStaffingCostAssumption)

**GET** — List assumptions

**POST** — Create/update assumption

**DELETE** — Remove assumption

### 7.5 Demand Overrides (DemandOverride)

**GET** — List overrides

**POST** — Create override

**PATCH** — Update override

**DELETE** — Remove override

### 7.6 Results (TeachingRequirementLine)

**GET** — List requirement lines (post-calculation)

- Includes: FTE metrics, coverage, costs, staff assignments

**GET** `/:lineId/assignments` — Assignments for a specific line

### 7.7 Calculate

**POST** — `/versions/:versionId/calculate/staffing` (requires data:edit)

- Executes full 10-step pipeline
- Returns: runId, durationMs, summary (totalFte, totalCost, etc.), warnings

---

## 8. Key Architectural Patterns

### 8.1 Calculation as Pure Functions

- All engine logic in `apps/api/src/services/staffing/*.ts`
- **Zero database dependencies** during computation
- Inputs: plain objects, Decimal instances
- Output: computed results (no side effects)
- Single transaction at the end persists all

### 8.2 Encryption at Boundaries

- Salary fields encrypted with `pgp_sym_encrypt` in database
- Decrypted during calculation via `pgp_sym_decrypt` SQL
- Encryption key from Docker secret (production) or .env (dev)
- All in-memory calculations use unencrypted Decimal strings

### 8.3 Decimal.js Everywhere

- All financial calculations use `Decimal` (never `number` for money)
- Rounding: `ROUND_HALF_UP` to 4 decimal places
- Output: `.toFixed(4)` strings for database storage

### 8.4 Stale Module Chain

- Assignments change → STAFFING stale (needs recalc)
- Staffing calculated → STAFFING cleared, PNL stale

### 8.5 Graceful Cost Mode Handling

- LOCAL_PAYROLL: full rows (12 × employees)
- AEFE_RECHARGE: zero rows (still 12, for consistency)
- NO_LOCAL_COST: no rows (empty result)
- All handled transparently; no special UI logic needed

---

## 9. Critical Gotchas

1. **FTE is not 1.0 = one employee.** FTE is hours-based:
    - 0.5 FTE = half-time (9 hours/week for teachers)
    - Assignments pool by (band, disciplineCode), not lineType
    - An employee can have multiple assignments across different disciplines

2. **Coverage matches by (band, disciplineCode), ignoring lineType:**
    - Assignments to "ELEMENTAIRE French STRUCTURAL" and "ELEMENTAIRE French SUPPORT" both contribute to the same line's coverage
    - If demand splits support lines, coverage does too

3. **Demand overrides are post-calculation adjustments:**
    - Override affects only `requiredFtePlanned` (not `requiredFteRaw`)
    - Pre-override value preserved in `requiredFteCalculated` (audit trail)

4. **HSA adds 1.5 hours to ORS, affecting FTE:**
    - `effectiveOrs = 19.5` for HSA-eligible teachers
    - `requiredFtePlanned = totalWeeklyHours / 19.5` (fewer FTE needed)
    - But `requiredFteRaw` still uses `18.0` (true demand)

5. **Departed employees are excluded from coverage:**
    - Assignments remain in database but ignored during coverage calc
    - Warning emitted: `DEPARTED_WITH_ASSIGNMENTS`
    - Should be reassigned to active employees

6. **Salary fields are Bytes, not Decimal in Prisma:**
    - Decryption returns string, converted to Decimal for math
    - No validation at Prisma level; SQL handles pgcrypto

7. **EOS base excludes HSA:**
    - `eosBase = base + housing + transport + responsibility` (NOT hsaAmount)
    - Only used for EOS calculation, not monthly cost

8. **Ajeer is "New staff only Sep-Dec":**
    - Existing: all 12 months
    - New: months 9-12 only
    - Saudi employees: 0 (replaced by GOSI)

---

## 10. Future Considerations (Out of Scope)

- **Scholarship model integration:** `scholarshipDeduction` field exists but unused (v2 planned)
- **Virtual scrolling:** Frontend currently handles < 300 rows per ADR-016
- **Cross-band matching:** assignments.ts has stubs for College ↔ Lycée matching (not active)
- **Augmentation effective dates:** salary increases recorded but not applied during calc yet
- **Multi-version comparisons:** no built-in salary/cost delta analysis

---

## Appendix: Example Calculation

**Scenario:**

- Grade CP has 100 students, max 25/class → 4 sections
- French STRUCTURAL rule: HOURS driver, 1.5 hours/section
- Teacher ORS: 18 hours/week, HSA-eligible
- Assignment: Teacher A (hourlyPercentage 1.0) → 1.0 FTE to French LYCEE

**Step 3 (Demand):**

- totalWeeklyHours = 4 sections × 1.5 = 6 hours
- baseOrs = 18, effectiveOrs = 19.5
- requiredFteRaw = 6 / 18 = 0.3333
- requiredFtePlanned = 6 / 19.5 = 0.3077

**Step 5 (Coverage):**

- coveredFte = 1.0
- gapFte = 1.0 - 0.3333 = 0.6667
- coverageStatus = SURPLUS (> 0.25)
- Warning: OVER_ASSIGNED (if Teacher A has other assignments totaling > 1.0)

**Step 9 (Costs):**

- Teacher A annual cost: 500,000 SAR
- directCostAnnual = 500,000 × 1.0 = 500,000
- hsaCostAnnual = 7,000 × 1.0 = 7,000 (HSA-eligible)

---

**End of Exploration Document**
