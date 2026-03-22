# Staffing Master Data Remediation Plan

**Date**: 2026-03-22
**Scope**: DHG staffing, staff cost, FTE logic, subject mapping, KPI cards
**Source of Truth**: `data/School staff force master data/Staff force master data efir - FINAL (QA).xlsx`
**Approach**: Dependency-ordered remediation in 3 waves

---

## Executive Summary

The DHG staffing / staff cost setup contains multiple interrelated issues stemming from a stale
data import pipeline that does not match the updated Excel master data format. The new FINAL (QA)
Excel has 22 columns (vs old format), 192 employees (166 local + 26 AEFE), and includes new fields
(Subject/Discipline, Allocation/Band, Level) absent from the old pipeline.

**Key issues**: wrong employee count loaded (~50 vs 192), staff cost overstated at 1.6B SAR
(expected 25-35M), FTE Gap correct-but-misleading (-133 due to 0 assignments), three KPI cards
hardcoded to 0 (HSA Budget, H/E Ratio, Recharge Cost), and discipline resolution broken (matches
on Function/Role instead of Subject).

**Remediation strategy**: 3 dependency-ordered waves with validation gates.

---

## Current-State Data Flow

```
Excel (FINAL QA, 22 cols, 192 employees)
    |
    v  [BROKEN] parse-staff-costs-excel.ts expects OLD column layout
    |
    v  fy2026-staff-costs.json fixture (stale)
    |
    v  importers/employees.ts --> DB (pgcrypto encrypted)
    |
    v  staffing-data-migration.ts --> resolve discipline, serviceProfile, homeBand
    |
    v  calculate.ts (10-step pipeline)
    |    1. Validate prerequisites
    |    2. Load all inputs (decrypt salaries)
    |    3. Demand engine (enrollment + DHG rules --> FTE requirements)
    |    4. Apply demand overrides
    |    5. Coverage engine (assignments --> gap)
    |    6. HSA engine (per-teacher HSA cost)
    |    7. Cost engine (12-month employee costs)
    |    8. Category cost engine (RESIDENT_*, FORMATION, etc.)
    |    9. Aggregate costs onto requirement lines
    |   10. Persist in single transaction
    |
    v  API routes --> teaching-requirements, staff-costs, staffing-summary, category-costs
    |
    v  Frontend --> KPI cards, Demand tab, Roster tab, Coverage tab, Costs tab
```

---

## Findings Register

| ID    | Title                                    | Severity | Layer       | Root Cause                                                     | Business Impact               |
| ----- | ---------------------------------------- | -------- | ----------- | -------------------------------------------------------------- | ----------------------------- |
| F-001 | New Excel not imported                   | CRITICAL | Import      | Pipeline expects old column layout                             | All downstream data wrong     |
| F-002 | FTE Gap = -133.00                        | HIGH     | Coverage    | 0 assignments exist (coveredFte = 0)                           | Gap card misleading           |
| F-003 | Staff Cost = 1.6B SAR                    | CRITICAL | Calculation | Wrong salary columns read from old format                      | Cost figures unreliable       |
| F-004 | HSA Budget = 0 SAR                       | HIGH     | Frontend    | Hardcoded `hsaBudget: 0` in staffing-page-v2.tsx               | HSA cost invisible            |
| F-005 | H/E Ratio = 0.00                         | MEDIUM   | Frontend    | Hardcoded `heRatio: 0` in staffing-page-v2.tsx                 | Ratio metric missing          |
| F-006 | Recharge Cost = 0 SAR                    | MEDIUM   | Frontend    | Hardcoded `rechargeCost: 0` in staffing-page-v2.tsx            | AEFE cost invisible           |
| F-007 | (Merged into F-004)                      | --       | --          | User reported as "HSE not appearing"; same root cause as F-004 | --                            |
| F-008 | Department name inconsistency            | MEDIUM   | Import      | Accented vs non-accented French across contract types          | Grouping breaks               |
| F-009 | Subject/discipline mapping gaps          | MEDIUM   | Import      | 57 Excel subjects vs 33 seeded disciplines + 7 aliases         | Teaching staff unresolved     |
| F-010 | AEFE employees need validation           | LOW      | Import      | 26 AEFE with blank salaries need costMode=AEFE_RECHARGE        | Recharge cost wrong           |
| F-011 | Discipline resolved from wrong column    | HIGH     | Import      | Uses functionRole (generic) instead of Subject column          | Most teaching staff unmatched |
| F-012 | Saudi/Ajeer flags missing from new Excel | MEDIUM   | Import      | New format lacks Saudi/Ajeer column                            | GOSI/Ajeer costs wrong        |

---

## Wave 1: Foundation (Data Layer)

### 1a. New Excel Column Mapping

| Excel Col | Header               | DB Field              | Transform                                                                                         |
| --------- | -------------------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| A         | #                    | employeeCode          | `EFIR-{padStart(3,'0')}`                                                                          |
| B         | Last Name            | name (part 2)         | Combined: `{lastName} {firstName}` (French convention, matches existing codebase)                 |
| C         | First Name           | name (part 1)         | If blank, use Last Name only                                                                      |
| D         | Contract Type        | costMode              | Contrat Local -> LOCAL_PAYROLL, Titulaire EN -> AEFE_RECHARGE, unknown -> LOCAL_PAYROLL + warning |
| E         | Function / Role      | functionRole          | Trim                                                                                              |
| F         | Department           | department            | Normalize accents                                                                                 |
| G         | Subject / Discipline | disciplineId          | Resolve via discipline alias on Subject (NOT functionRole)                                        |
| H         | Allocation (Band)    | homeBand              | Parse class code -> MATERNELLE/ELEMENTAIRE/COLLEGE/LYCEE                                          |
| I         | Level                | --                    | Fallback for homeBand if Allocation is ambiguous                                                  |
| J         | Status               | status                | NEW (Sep) -> New, DEPARTED -> Departed, else -> Existing                                          |
| K         | Joining Date         | joiningDate           | Parse Excel date serial                                                                           |
| L         | YoS                  | --                    | SKIP (derived from joiningDate)                                                                   |
| M         | Base Salary          | baseSalary            | pgp_sym_encrypt, Decimal(15,4)                                                                    |
| N         | Housing (IL)         | housingAllowance      | pgp_sym_encrypt                                                                                   |
| O         | Transport (IT)       | transportAllowance    | pgp_sym_encrypt                                                                                   |
| P         | Resp. Premium        | responsibilityPremium | pgp_sym_encrypt                                                                                   |
| Q         | HSA (10m)            | hsaAmount             | pgp_sym_encrypt                                                                                   |
| R         | Monthly Gross        | --                    | SKIP (calculated on demand)                                                                       |
| S         | Hourly %             | hourlyPercentage      | Decimal(5,4), default 1.0                                                                         |
| T         | Payment Method       | paymentMethod         | Virement -> Bank Transfer, Liquide -> Cash, Mudad -> Mudad                                        |
| U         | Aug. 2026-27         | augmentation          | Parse numeric portion from text                                                                   |
| V         | Notes (QA)           | --                    | SKIP (informational)                                                                              |

### 1b. Discipline Alias Expansion

New aliases required:

| Excel Subject         | Target Discipline Code | Action                     |
| --------------------- | ---------------------- | -------------------------- |
| Musique               | EDUCATION_MUSICALE     | Add alias                  |
| Arts plastiques       | ARTS_PLASTIQUES        | Add alias                  |
| Generaliste           | PRIMARY_HOMEROOM       | Add alias                  |
| FLE                   | FLE                    | Add new discipline + alias |
| Sciences economiques  | SES                    | Add alias                  |
| PDMQDC                | PRIMARY_HOMEROOM       | Add alias                  |
| Remplacement          | null                   | Skip (substitute teacher)  |
| Inclusion             | null                   | Skip (non-curriculum)      |
| Non-teaching subjects | null                   | disciplineId = null        |

### 1c. Department Normalization

| Raw Value                         | Normalized                 |
| --------------------------------- | -------------------------- |
| College / Lycee (no accent, AEFE) | College / Lycee (accented) |
| Elementaire (no accent)           | Elementaire (accented)     |
| All others                        | Keep as-is                 |

### 1d. HomeBand Resolution

```
Allocation column:
  PS-*, MS-*, GS-*                        -> MATERNELLE
  CP-*, CE1-*, CE2-*, CM1-*, CM2-*        -> ELEMENTAIRE
  6eme-*, 5eme-*, 4eme-*, 3eme-*          -> COLLEGE
  2nde-*, 1ere-*, Term-*                  -> LYCEE
  "Secondaire (TBD)"                      -> COLLEGE (default)
  "TBD" / blank / admin                   -> null

Level column (fallback):
  Maternelle                              -> MATERNELLE
  Elementaire                             -> ELEMENTAIRE
  College / Lycee / Secondaire            -> COLLEGE
  Vie Scolaire & Support / Administration -> null
  Direction                               -> null
```

### 1e. Service Profile Resolution

Uses Subject column G (not Function/Role column E):

```
Subject contains "ASEM"              -> ASEM
Subject contains "Arabe"/"Islamique" -> ARABIC_ISLAMIC
Subject = "EPS"                      -> EPS
Subject = "Documentation"/"CDI"      -> DOCUMENTALISTE
functionRole contains "Agrege"       -> AGREGE
Level in (Maternelle, Elementaire)
  AND isTeaching                     -> PE
isTeaching AND secondary             -> CERTIFIE
Non-teaching                         -> null
```

### 1f. Saudi/Ajeer Handling

New Excel lacks Saudi/Ajeer column. Default:

- All local staff: `isSaudi=false, isAjeer=false`
- AEFE staff: `isSaudi=false, isAjeer=false`
- User can update individual records via UI later
- GOSI and Ajeer levy will be 0 until flags are set

### 1g. Edge Cases

| Case                                 | Handling                                      |
| ------------------------------------ | --------------------------------------------- |
| 2 merged dual-role staff (#82, #127) | 1 record each, combined FTE from Hourly %     |
| 1 departed employee (#126)           | status=Departed                               |
| 6 new positions                      | status=New, disciplineId=null, salary=0       |
| 17 TBD subjects                      | disciplineId=null                             |
| 1 missing joining date (#11)         | Default to 2025-09-01                         |
| AEFE blank salaries (26)             | All salary fields = 0, costMode=AEFE_RECHARGE |

### 1h. Migration Safety Strategy

**Pre-migration**: Back up the dev DB before running the import script.

```
pg_dump -Fc budfin_dev > budfin_dev_pre_staff_migration.dump
```

**Import strategy**: UPSERT via `ON CONFLICT (version_id, employee_code) DO UPDATE`.

- Existing employees with matching codes are updated (salary, department, discipline, etc.)
- New employees are inserted
- Employee IDs may change; therefore **delete all StaffingAssignments for the target version**
  before reimport (assignments will be recreated via auto-suggest or manually)
- Target version: the active Draft version (v2 / version_id=20)

**Rollback**: If migration fails, restore from backup:

```
pg_restore -d budfin_dev budfin_dev_pre_staff_migration.dump
```

### 1i. Parser vs Migration Script Relationship

Two distinct files serve different purposes:

- `parse-staff-costs-excel.ts`: **Permanent pipeline** -- rewritten to read the new 22-col format,
  outputs to `fy2026-staff-costs.json` fixture. Used by `importers/employees.ts` during seed.
  This makes the new format the standard for future seeds (`pnpm dev` auto-seeds correctly).
- `import-final-qa-staff.ts`: **One-shot migration** -- reads the Excel directly and upserts into
  the current running dev DB. Used once to fix the current state without re-seeding. Can be deleted
  after successful migration.

### 1j. Department Value Convention

The existing DB stores department values as raw strings. The old parser mapped French names to
English canonical values (Teaching, Administration, Support, Management, Maintenance) via
`DEPARTMENT_MAP`. The new Excel uses French department names.

**Decision**: Keep French department names as-is (matching the new Excel). This is a change from the
old convention but aligns with the source of truth. The frontend groups by these strings -- French
names are more meaningful to the EFIR planners who use the app.

Affected values: "College / Lycee", "Elementaire", "Maternelle", "Vie Scolaire & Support",
"Administration", "Direction", "Multi-department".

### 1k. Files Modified/Created

| File                                                      | Action                                       |
| --------------------------------------------------------- | -------------------------------------------- |
| `apps/api/prisma/seeds/staffing-master-data.ts`           | Add FLE discipline + missing aliases         |
| `apps/api/src/migration/parse-staff-costs-excel.ts`       | Rewrite column mapping for new 22-col format |
| `apps/api/src/migration/scripts/import-final-qa-staff.ts` | NEW: one-shot migration script               |
| `data/fixtures/fy2026-staff-costs.json`                   | Regenerated from new Excel                   |

### 1l. Validation Gate

- 192 employees in DB (166 local + 26 AEFE)
- All teaching staff have disciplineId set (except TBD)
- All teaching staff have serviceProfileId set
- All teaching staff have homeBand set
- All salary fields encrypted and decryptable
- Department values normalized (no accent duplicates)

---

## Wave 2: Calculation & Cost Verification

### 2a. Staff Cost Bug

**Expected range**: 25-35M SAR for ~166 local employees.

**Root cause**: The 1.6B SAR overstatement is caused by the old parser reading wrong column indices
from the new Excel format. The old `COL.BASE_SALARY` is column 9 (old layout), but in the new
22-column format column 9 is "Level" (a text field), producing garbage encrypted values. After
Wave 1 reimport with corrected column mapping, the cost should normalize to the expected range.

**Contingency** (if cost is still wrong after reimport):

1. Trace single employee: encrypted -> decrypted -> cost engine -> monthly rows -> annual
2. Verify monthly gross = base + housing + transport + resp + HSA
3. Check aggregation in staffing-summary endpoint
4. Compare DB decrypted values against Excel source for 3 employees

### 2b. FTE Gap

After reimport + recalculate:

- FTE Gap = coveredFte - requiredFteRaw
- With 0 assignments: gap = -totalRequiredFte (correct behavior)
- Verify required FTE is reasonable (~132 for 169 enrollment headcount)
- Spot-check one band manually

### 2c. HSA Budget

- HSA engine computes: `firstHourRate + max(0, targetHours - 1) * additionalRate`
- Default: 500 + 0.5 _ 400 = 700 SAR/month _ 10 months = 7,000 SAR/year/teacher
- Total = 7,000 \* count(eligible teachers)
- Stored as `hsaCostAnnual` on TeachingRequirementLine

### 2d. H/E Ratio

H/E = Host / Expatriate ratio:

- localCount = employees WHERE costMode = LOCAL_PAYROLL AND status != Departed
- aefeCount = employees WHERE costMode = AEFE_RECHARGE AND status != Departed
- H/E = aefeCount > 0 ? localCount / aefeCount : 0 (division-by-zero guard)
- Expected: 165 / 26 = 6.35 (excluding 1 departed)

### 2e. Recharge Cost

Sum of 3 specific RESIDENT category costs (annualized = sum all 12 months):

- `RESIDENT_SALAIRES` (AEFE salary recharge)
- `RESIDENT_LOGEMENT` (AEFE housing recharge)
- `RESIDENT_PENSION` (AEFE pension recharge)
- Filter: `category.startsWith('RESIDENT_')` on the category-costs API response
- Data already exists in CategoryMonthlyCost table
- Each category has 12 monthly rows; annual = sum of all 12 `amount` values

### 2f. Validation Gate

- Staff cost in 25-35M SAR range
- HSA budget non-zero for eligible teachers
- H/E Ratio computes ~6.38
- Recharge Cost = RESIDENT\_\* annual total
- No calculation errors in audit log

---

## Wave 3: Frontend Card Fixes

### 3a. HSA Budget Card

**File**: `apps/web/src/components/staffing/staffing-page-v2.tsx`
**Change**: Replace `hsaBudget: 0` with sum of `teachingReqData.lines[].hsaCostAnnual`

### 3b. H/E Ratio Card

**File**: `apps/web/src/components/staffing/staffing-page-v2.tsx`
**Change**: Replace `heRatio: 0` with `localCount / aefeCount` from employees data
**Filters**: Exclude Departed employees from both counts. Use `costMode` field (not contractType).
**Guard**: If aefeCount === 0, display 0 (not Infinity).

### 3c. Recharge Cost Card

**File**: `apps/web/src/components/staffing/staffing-page-v2.tsx`
**Change**: Replace `rechargeCost: 0` with sum of all months for categories matching
`category.startsWith('RESIDENT_')` (RESIDENT_SALAIRES, RESIDENT_LOGEMENT, RESIDENT_PENSION).
Annual total = sum of all 12 monthly `amount` values across the 3 categories.
**Dependency**: May need to lift `useCategoryCosts()` hook to page level

### 3d. Files Modified

| File                                                    | Changes                                      |
| ------------------------------------------------------- | -------------------------------------------- |
| `apps/web/src/components/staffing/staffing-page-v2.tsx` | Wire 3 KPI values                            |
| `apps/web/src/hooks/use-staffing.ts`                    | Possibly expose category costs at page scope |

### 3e. End-to-End Reconciliation Matrix

| Metric         | Source (Excel)  | DB                           | API                   | UI Card            |
| -------------- | --------------- | ---------------------------- | --------------------- | ------------------ |
| Employee count | 192             | count(\*) employees          | employeesData.total   | Total Headcount    |
| Local staff    | 166             | WHERE costMode=LOCAL_PAYROLL | filter                | (internal)         |
| AEFE count     | 26              | WHERE costMode=AEFE_RECHARGE | filter                | H/E denominator    |
| Staff Cost     | ~25-31M SAR     | SUM(totalCost)               | summaryData.cost      | Staff Cost card    |
| HSA Budget     | engine-computed | SUM(hsaCostAnnual)           | lines[].hsaCostAnnual | HSA Budget card    |
| H/E Ratio      | 166/26 = 6.38   | count by costMode            | computed client       | H/E Ratio card     |
| Recharge Cost  | RESIDENT\_\*    | CategoryMonthlyCost          | category-costs        | Recharge Cost card |
| FTE Required   | DHG-driven      | TeachingRequirementLine      | totals.totalFteRaw    | Demand tab         |
| FTE Gap        | 0 - required    | coverage engine              | totals.totalFteGap    | FTE Gap card       |

---

## Test Plan

### New Tests Required

| Test File                                                      | Purpose                                                            | Coverage                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `apps/api/src/migration/parse-staff-costs-excel.test.ts`       | Verify new 22-col column mapping, accent normalization, edge cases | Column mapping, department normalization, homeBand resolution |
| `apps/api/src/migration/scripts/import-final-qa-staff.test.ts` | Verify migration script handles all 192 records correctly          | Upsert logic, AEFE handling, departed status, TBD subjects    |

### Existing Tests Must Pass

- `apps/api/src/services/staffing/demand-engine.test.ts` -- demand calculation unchanged
- `apps/api/src/services/staffing/cost-engine.test.ts` -- cost calculation unchanged
- `apps/api/src/services/staffing/coverage-engine.test.ts` -- coverage calculation unchanged
- `apps/web/src/lib/curriculum-coverage-map.test.ts` -- curriculum mapping unchanged
- All other existing tests via `pnpm test`

### Manual Verification

After implementation, verify in browser:

1. Total Headcount card shows correct employee count
2. Staff Cost card shows value in 25-35M SAR range
3. HSA Budget card shows non-zero value
4. H/E Ratio card shows ~6.35
5. Recharge Cost card shows RESIDENT\_\* total
6. FTE Gap card shows correct negative value (if no assignments)
7. Demand tab shows all 4 bands with requirement lines
8. Roster tab shows all employees (teaching and non-teaching)

---

## Regression Risks

| Risk                       | Mitigation                                            |
| -------------------------- | ----------------------------------------------------- |
| Old seed script breaks     | Keep old script intact, add new migration alongside   |
| Existing tests invalidated | Run `pnpm test` after all changes                     |
| Encryption key mismatch    | Use same env var / Docker secret pattern              |
| Category costs hook moved  | Verify Costs tab still works independently            |
| FTE gap sign convention    | Verify coverage-engine tests pass unchanged           |
| AEFE zero-cost rows        | Verify AEFE_RECHARGE still produces 12 zero-cost rows |

---

## Implementation Order

| Step | Wave | Task                                                            | Dependency  | Validation           |
| ---- | ---- | --------------------------------------------------------------- | ----------- | -------------------- |
| 0    | W1   | Back up dev DB (pg_dump)                                        | None        | Dump file exists     |
| 1    | W1   | Add FLE discipline + missing aliases to staffing-master-data.ts | None        | pnpm test            |
| 2    | W1   | Rewrite parse-staff-costs-excel.ts for new column layout        | Step 1      | Unit test parse      |
| 3    | W1   | Regenerate fy2026-staff-costs.json fixture                      | Step 2      | Verify 192 records   |
| 4    | W1   | Create import-final-qa-staff.ts migration script                | Step 1      | Script runs clean    |
| 5    | W1   | Delete existing StaffingAssignments for target version          | Step 0      | Clean slate          |
| 6    | W1   | Run migration against dev DB (upsert 192 employees)             | Steps 3-5   | 192 employees in DB  |
| 7    | W1   | Verify DB state (discipline, profile, band, dept)               | Step 6      | Validation gate 1    |
| 8    | W2   | Run staffing calculation                                        | Step 7      | No errors            |
| 9    | W2   | Verify staff cost total                                         | Step 8      | 25-35M SAR           |
| 10   | W2   | Spot-check 3 employees end-to-end                               | Step 8      | Values match Excel   |
| 11   | W3   | Wire HSA Budget card                                            | Step 8      | Non-zero             |
| 12   | W3   | Wire H/E Ratio card                                             | Step 6      | ~6.35                |
| 13   | W3   | Wire Recharge Cost card                                         | Step 8      | Matches RESIDENT\_\* |
| 14   | W3   | Run full reconciliation matrix                                  | Steps 11-13 | All cells match      |
| 15   | ALL  | Run pnpm test + typecheck                                       | Step 14     | All pass             |
