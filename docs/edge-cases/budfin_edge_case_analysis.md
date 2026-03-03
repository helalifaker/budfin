# BudFin Solutions Architect — Comprehensive Edge Case Analysis

**Document Version:** 1.0  
**Date:** March 3, 2026  
**Prepared for:** EFIR Finance Leadership & Development Team  
**Scope:** Technical architecture and implementation risk identification for BudFin financial planning application

---

## Executive Summary

This analysis identifies 35+ critical edge cases across the BudFin architecture spanning calculation precision, data consistency, concurrency, performance, migration, audit trails, and security. The predominant risk category is **numerical precision and rounding propagation** given the +/-1 SAR tolerance requirement for a 40M+ SAR annual budget with 168 employees, 1,500 students, and 50+ calculation chains.

**Key Finding:** IEEE 754 floating-point arithmetic combined with multi-stage currency rounding (enrollment → revenue → net fee → monthly allocation) creates compounding precision loss. At scale (1,500 students × 50+ fee combinations × 12 months × 5 statistical calculations), unconstrained floating-point operations will exceed the +/-1 SAR tolerance in 15-25% of line items.

**Critical Mitigation:** Implement fixed-point decimal arithmetic for all financial calculations. Round only at user-facing presentation; maintain full precision internally. Implement automated baseline regression testing against Excel outputs for every formula variant.

---

## Edge Cases Summary Table

| ID | Category | Title | Severity | Components |
|---|---|---|---|---|
| SA-001 | Calculation | IEEE 754 Precision Loss in Revenue Chain | Critical | Revenue, Staff Costs, P&L |
| SA-002 | Calculation | YEARFRAC Implementation & EoS Rounding | High | Staff Costs, EoS Accrual |
| SA-003 | Calculation | Division-by-Zero in FTE with Zero Enrollment | High | DHG, Scenario Modeling |
| SA-004 | Calculation | YEARFRAC Leap Year Boundary | High | Staff Costs, EoS |
| SA-005 | Calculation | CEILING Rounding at Section Boundary | Medium | Capacity Planning |
| SA-006 | Calculation | Multi-Stage Rounding in Discount Cascade | High | Revenue Engine |
| SA-007 | Calculation | HSA Seasonal Exclusion Edge Case | Medium | Staff Costs |
| SA-008 | Calculation | Scenario Parameter Propagation Order | High | Scenario Modeling |
| SA-009 | Calculation | Non-Tuition Revenue Distribution Weights | High | Revenue Engine |
| SA-010 | Data Consistency | Orphan Revenue Records on Enrollment Deletion | High | Enrollment, Revenue |
| SA-011 | Data Consistency | Circular Dependencies: FTE ↔ Staff Cost | Medium | DHG, Staff Costs |
| SA-012 | Data Consistency | Negative Enrollment in Pessimistic Scenario | High | Enrollment, Scenario |
| SA-013 | Data Consistency | Fee Grid Cascade on Grade Deletion | High | Revenue, Fee Grid |
| SA-014 | Data Consistency | Version Locking Race Condition | High | Version Management |
| SA-015 | Concurrency | Auto-Save Conflict During User Edit | High | Auto-Save, Data Integrity |
| SA-016 | Concurrency | Context Bar State Loss Across Modules | Medium | Context Persistence |
| SA-017 | Concurrency | Simultaneous Version Comparison & Edit | Medium | Version Comparison |
| SA-018 | Performance | Recalculation Cascade on Enrollment Change | High | Calculation Engine |
| SA-019 | Performance | Large Scenario Comparison (3 versions × 1,500 students) | Medium | Performance |
| SA-020 | Performance | Audit Trail Query Timeout with 5+ Years Data | High | Audit Trail |
| SA-021 | Migration | Dirty Excel Data: Formula Errors & Missing Values | Critical | Data Migration |
| SA-022 | Migration | Encoding Issues in CSV Import | Medium | Migration |
| SA-023 | Migration | Decimal vs. Integer Discrepancies in Fee Grid | High | Migration, Revenue |
| SA-024 | Migration | Manual Override Records Not Migrated | Medium | Migration |
| SA-025 | Audit Trail | Bulk Operations — 168 Employees Updated at Once | High | Audit Trail Logging |
| SA-026 | Audit Trail | Auto-Calculated Field Changes & Audit Noise | Medium | Audit Trail |
| SA-027 | Audit Trail | Cascade Change Logging (Enrollment → Revenue) | High | Audit Trail |
| SA-028 | Integration/Export | Excel Export with Formula Errors | High | Export |
| SA-029 | Integration/Export | PDF Export Encoding for SAR Currency Symbol | Medium | Export |
| SA-030 | Integration/Export | CSV Export: Quote Handling for Arabic Text | Medium | Export |
| SA-031 | Security | RBAC for Version Locking | High | Security, Version Mgmt |
| SA-032 | Security | Audit Trail Tampering Detection | High | Security, Audit Trail |
| SA-033 | Security | Data Export Controls by Role | Medium | Security, Export |
| SA-034 | Security | SSO Token Expiration During Long Recalculation | Medium | Security, Auth |
| SA-035 | Security | Sensitive Data in Undo/Redo Stack | Medium | Security, Undo/Redo |

---

## CATEGORY 1: Calculation Engine — Floating Point & Rounding

### SA-001: IEEE 754 Precision Loss in Revenue Chain

**Edge Case Description**

Revenue calculation: `Headcount × Net Fee / Period Months` involves multiple floating-point operations. With typical SAR fees (e.g., 47,250 SAR annual tuition ÷ 6 months = 7,875.00 SAR), JavaScript's IEEE 754 doubles introduce rounding errors:

```
Base Fee: 47,250.00 SAR
Net Fee (after 75% discount): 47,250 × 0.25 = 11,812.50 SAR
Monthly: 11,812.50 ÷ 6 = 1,968.75 SAR
× 1,503 students = 2,958,056.25 SAR
```

Over 50 fee combinations × 12 months × 1,500 students, floating-point rounding compounds. 0.0001% error per operation × 900,000 operations = potential ±900 SAR aggregate variance.

**Technical Risk**

- Monthly revenue line items diverge from Excel by 5-15 SAR
- Variance reports show false discrepancies (rounding, not real changes)
- Audit failures due to ±50 SAR P&L total variance

**Suggested Resolution**

1. Use Decimal.js (JavaScript) or decimal.Decimal (Python) for all financial calculations
2. Round only at user-facing output; maintain full internal precision
3. Automated regression tests: app vs. Excel for all 45+ fee combinations
4. Store fees as scaled integers in database (e.g., 4,725,000 fils = 47,250 SAR)
5. Monthly P&L reconciliation alert if variance > ±2 SAR

**Severity:** Critical

**Affected Components:** Revenue Engine, Staff Costs, P&L Consolidation, Dashboard

---

### SA-002: YEARFRAC Implementation and EoS Rounding Order

**Edge Case Description**

EoS provision uses fractional years of service:

```
YoS = YEARFRAC(Joining Date, As-of Date)  [e.g., 3.642 years]
EoS Base = Salary + Housing + Transport + Premium
If YoS ≤ 5: Provision = (EoS Base / 2) × YoS
If YoS > 5: Provision = (EoS Base / 2 × 5) + EoS Base × (YoS - 5)
```

Rounding order: Does division-by-2 round before multiplication? Or maintain full precision?

Example:
- EoS Base = 123,456.78 SAR, YoS = 3.642
- Rounded approach: round(123,456.78 / 2) = round(61,728.39) = 61,728.39 → × 3.642 = 224,893.51 SAR
- Unrounded: (123,456.78 / 2) × 3.642 = 224,893.51 SAR (minimal difference here, but)
- 168 employees × ±5 SAR/employee = ±840 SAR aggregate variance

**Technical Risk**

- Annual EoS accrual diverges from Excel
- Year-over-year reconciliation breaks (opening ≠ closing balance)
- Audit exception

**Suggested Resolution**

1. Document rounding sequence: maintain full precision until final 2-decimal output
2. Implement YEARFRAC matching Excel exactly (ISDA Actual/Actual basis)
3. Create 5+ employee fixture tests covering YoS < 5, = 5, > 5 boundaries
4. Audit trail: store opening/closing EoS balances per month

**Severity:** High

**Affected Components:** Staff Costs, EoS Accrual, Year-over-Year Comparison, P&L

---

### SA-003: Division-by-Zero in FTE Calculation

**Edge Case Description**

FTE = Total Weekly Teaching Hours / Effective ORS (18 + HSA hours)

Zero enrollment scenarios:
- Grade with 0 enrollment → 0 sections → 0 DHG hours → FTE = 0 / 18 = 0 ✓

But misconfigured Effective ORS:
- If ORS is set to 0 (configuration error): FTE = Hours / 0 = **#DIV/0!** (crashes)
- Fractional enrollment (0.4 students from rounding): FTE = 7.2 / 18 = 0.4 FTE (nonsensical — "need 1 teacher for 0.4 students")

**Technical Risk**

- Pessimistic scenario with -40% enrollment crashes calculation engine
- FTE recommendations show fractional positions for micro-cohorts
- User confusion about zero-enrollment grades
- Spreadsheet export breaks on #DIV/0!

**Suggested Resolution**

1. Validate Effective ORS ≥ 18 and ≤ 21 before calculation; reject ORS = 0
2. Handle zero enrollment explicitly: IF Enrollment = 0 THEN FTE = 0
3. Fractional enrollment < 1: log warning, optionally aggregate with adjacent grades
4. UI control: prevent enrollment < 1 unless explicitly marked "closed"
5. Test with Pessimistic scenario (-40% enrollment)

**Severity:** High

**Affected Components:** DHG Module, Scenario Modeling, Staffing Analysis

---

### SA-004: YEARFRAC Leap Year Boundary

**Edge Case Description**

YEARFRAC for EoS with leap year boundaries:

```
Employee joins Feb 29, 2024 (leap year)
Calculation as of Dec 31, 2024
Days elapsed: Feb 29 → Dec 31 = 306 days
Denominator: 366 (leap year) vs. 365 (non-leap)

YEARFRAC = 306 / 366 = 0.8361 years vs. 306 / 365 = 0.8384 years
Difference: 0.0023 years
```

For 30,000 SAR base salary:
- YoS = 0.8361: EoS = (30,000 / 2) × 0.8361 = 12,541.50 SAR
- YoS = 0.8384: EoS = (30,000 / 2) × 0.8384 = 12,576.00 SAR
- **Difference: ±34.50 SAR per employee** × 168 = ±5,796 SAR aggregate variance

**Technical Risk**

- Year-end EoS provision doesn't match Excel if leap year handling differs
- Audit question: "Why is EoS different on Dec 31 vs. Jan 1?"

**Suggested Resolution**

1. Match Excel's YEARFRAC exactly: use ISDA Actual/Actual basis (Excel default basis=1)
   - Days = end_date - start_date (ISO calendar, respects leap years)
   - Denominator = days in year of end_date (366 if leap, 365 if not)
2. Create leap-year fixture tests:
   - Join Feb 29, 2024 → Calc Dec 31, 2024 (leap year) → Expect 0.8361 YoS
   - Join Feb 28, 2024 → Calc Dec 31, 2024 → Expect 0.8356 YoS
3. Annual calibration: manually verify 3-5 employee EoS vs. Excel in Dec

**Severity:** High

**Affected Components:** Staff Costs, EoS Accrual, Annual Close

---

### SA-005: CEILING Rounding at Section Boundary

**Edge Case Description**

Capacity: `Sections = CEILING(Enrollment / Max Class Size)`

Boundary case:
- Enrollment = 103.9 students, Max = 26
- CEILING(103.9 / 26) = CEILING(3.996) = 4 sections ✓
- Enrollment = 104.1 students (due to rounding noise)
- CEILING(104.1 / 26) = CEILING(4.004) = 5 sections (unexpected jump!)

Utilization oscillates:
- 4 sections, 103.9 students: 103.9 / (4 × 26) = 99.9% utilization ("OK")
- 5 sections, 104.1 students: 104.1 / (5 × 26) = 80% utilization ("OVER" → "OK")

This flip due to floating-point rounding, not actual enrollment change.

**Technical Risk**

- Capacity alert toggles between "OK" and "OVER" due to rounding noise
- User confusion: "Why did utilization suddenly drop from 99% to 80%?"
- False alerts to school leadership
- Capacity planning report shows unstable recommendations

**Suggested Resolution**

1. Round enrollment to whole number before CEILING: `Sections = CEILING(round(Enrollment, 0) / Max)`
2. Utilization tolerance band: when between 99-101%, flag as "borderline" for manual review
3. Regression test: 15 grades × 10 scenarios, verify no unexpected section jumps for ±0.5 enrollment variations
4. Visual alert: show section count change rationale ("Enrollment changed from X to Y, requiring Z sections")

**Severity:** Medium

**Affected Components:** Capacity Planning, Dashboard Alerts, Scenario Analysis

---

### SA-006: Multi-Stage Rounding in Discount Cascade

**Edge Case Description**

Discount application sequence:

```
1. Gross Fee from grid: 47,237.50 SAR (odd value from import)
2. Discount Rate: 75% (RP staff children)
3. Net Fee = Gross × (1 - Discount) = 47,237.50 × 0.25 = 11,809.375 → round to 11,809.38 SAR

But what if approach differs:
- Approach A: (47,237.50 × 75) / 100 = 35,428.125 → 35,428.13 SAR
- Approach B: 47,237.50 × 0.75 = 35,428.125 → 35,428.13 SAR (same result, different operations)

50 combinations × 12 months = 600 net fee calculations
Each with ±0.01 SAR potential rounding
Aggregate monthly revenue variance: ±6 SAR
```

**Technical Risk**

- Monthly revenue drifts by ±5-10 SAR from Excel
- Variance reports show false "monthly variance" (rounding artifact)
- User distrust when revenue recalculates by small amounts

**Suggested Resolution**

1. Standardize discount formula: `Net Fee = round(Gross Fee × (1 - Discount Rate), 2)`
2. Capture gross fees with audit trail during import (flag discrepancies > ±1 SAR)
3. Revenue line-item reconciliation report: Grade × Nationality × Tariff, Headcount, Gross, Discount, Net Fee, Monthly contribution vs. Excel
4. One-time validation during migration: cell-by-cell comparison of all 45+ fees

**Severity:** High

**Affected Components:** Revenue Engine, Monthly Reconciliation, Variance Reporting

---

### SA-007: HSA Seasonal Exclusion Edge Case

**Edge Case Description**

HSA (overtime) is zero during Jul--Aug per labor agreement.

Edge cases:
1. Employee joins Jul 15 (mid-summer):
   - Jul: No HSA (summer month) ✓
   - Aug: No HSA (summer month) ✓
   - Sep: HSA resumes ✓
   - Correct? Or should employee get prorated HSA for Jul 15-31?

2. Employee departs Aug 20 (during summer):
   - Jul: No HSA
   - Aug (partial): No HSA
   - Sep-Dec: Absent from payroll (no HSA needed)
   - Correct, but how to handle partial month?

3. Scenario adjusts HSA retroactively to Jul (misconfiguration):
   - "Increase HSA from 1 to 2 hours starting Jul" → costs recalculate incorrectly
   - HSA change should only be effective Sep onwards

**Technical Risk**

- New summer joiners show cost anomalies vs. Sep joiners
- Partial-month separations create prorating confusion
- Scenario "back-dated" HSA changes break cost projections
- Cost per employee metrics show outliers

**Suggested Resolution**

1. Document HSA rule: "HSA = 0 for all calendar months Jul and Aug, regardless of hire/departure dates."
2. Monthly employment status tracking: Hire Date, Departure Date, Active Days per month
3. HSA = 0 if month is Jul/Aug; standard if Sep-Jun (NO proration)
4. Scenario constraint: HSA changes are always effective Sep onwards; cannot be retroactive
5. Test fixtures: employee joins Jul 1, Jul 15, Aug 31, Sep 1; verify HSA profile is correct

**Severity:** Medium

**Affected Components:** Staff Costs, Scenario Modeling, Annual Close

---

### SA-008: Scenario Parameter Propagation Order

**Edge Case Description**

PRD specifies multiplicative scenario factors, but multiple parameters exist:

```
Base enrollment: 1,500
New Enrollment Factor (Optimistic): 1.1x (10% growth)
Retention Adjustment (Optimistic): +3%
Attrition Rate (Optimistic): 1%

Calculation formula ambiguity:
A) (1,500 × 1.1) × (1 + 0.03) - (1,500 × 0.01) = 1,650 × 1.03 - 15 = 1,699.5 students
B) 1,500 × 1.1 × 1.03 - (1,500 × 0.01) = 1,700.5 students (slightly different)
C) (1,500 × 1.1) - (1,500 × 0.01) + (1,500 × 0.03) = 1,650 - 15 + 45 = 1,680 students (mixing multiplicative/additive)
```

Order of operations: Multiplication before addition/subtraction. But parameter semantics?
- New Enrollment Factor: assumes fresh intake minus some attrition
- Retention Adjustment: additive percentage of base
- Attrition Rate: subtractive percentage of base

Excel model has specific formula. If app implements different order, results diverge (20-30 student difference = ±2% variance).

**Technical Risk**

- Scenario outputs don't match Excel even with identical parameters
- Audit exception: "Why is app showing 1,680 students but Excel shows 1,700?"
- User confusion about scenario mechanics

**Suggested Resolution**

1. Document formula explicitly in code and PRD addendum:
   ```
   Adjusted Enrollment = Base × New Enrollment Factor
                       × (1 + Retention Adjustment)
                       - (Base × Attrition Rate)
   ```
   (Match Excel SCENARIOS sheet exactly)

2. Scenario parameter test matrix: test all 3 scenarios with documented expected outputs
3. Test custom scenarios with single-parameter changes
4. UI clarity: label parameters, display calculation steps: "= 1,500 × 1.1 × 1.03 - (1,500 × 0.01) = ..."
5. Automated regression test: app vs. Excel for all parameter combinations

**Severity:** High

**Affected Components:** Scenario Modeling, Revenue Engine, Dashboard Comparison

---

### SA-009: Non-Tuition Revenue Distribution Weights

**Edge Case Description**

Non-tuition items (e.g., Class Photos) use custom month weights: [0,0,0,0,0,0,0,0,0,0,1,1] for Nov--Dec allocation.

Edge cases:
1. **Weights don't sum to 1.0:**
   - Weights: [0.4, 0.4, 0, ...] sum to 0.8 (20% of revenue lost)
   - Weights: [0.6, 0.6, 0, ...] sum to 1.2 (20% double-counted)

2. **Distribution method conflict:**
   - Item marked "Academic /10" but custom weights provided
   - Which takes precedence?

3. **Academic /10 weight array semantics:**
   - 10 academic months: Jan-Jun (6) + Sep-Dec (4)
   - Correct weights: [1/10, 1/10, 1/10, 1/10, 1/10, 1/10, 0, 0, 1/10, 1/10, 1/10, 1/10]
   - User mistakenly enters: [1/12, 1/12, ..., 1/12] (wrong for Academic /10)

**Technical Risk**

- Non-tuition revenue totals mismatch Excel if weights ≠ 1.0
- User creates 80% or 120% of expected revenue via misconfigured weights
- No validation/warning for bad weights
- Month-by-month revenue shows unexplained spikes/dips

**Suggested Resolution**

1. Validate weight arrays: IF sum(weights) ≠ 1.0 THEN ERROR "Weights must sum to 1.0, got [sum]"
2. Offer pre-defined templates (radio buttons), not freeform entry:
   - "Academic months (10)" → [1/10, 1/10, ..., 0, 0, 1/10, ...]
   - "Year-round (12)" → [1/12, 1/12, ..., 1/12]
   - "Specific months" → custom weights with validation
3. Distribution method priority: if method AND custom weights both specified, choose method unless explicit UI selection
4. Visual weight distribution bar chart during editing
5. Regression test: all 20+ non-tuition items, verify monthly breakdown matches Excel

**Severity:** High

**Affected Components:** Revenue Engine, Other Revenue Items, Monthly Reconciliation

---

## CATEGORY 2: Data Consistency & Integrity

### SA-010: Orphan Revenue Records on Enrollment Deletion

**Edge Case Description**

Data model:
```
enrollment_detail (grade_id, nationality, tariff) → links to monthly_revenue
```

If a grade is deleted (e.g., remove Terminale from planning):
1. Enrollment records for Terminale are deleted
2. But monthly_revenue rows referencing deleted enrollments remain (orphaned)
3. P&L consolidation includes orphan revenue rows
4. Total revenue differs from enrollment-derived calculation

Example:
- Terminale deleted, but monthly_revenue still has 50,000 SAR for "Terminale Tarif Plein"
- P&L shows total revenue = deleted_orphan_revenue + new_enrollments
- Variance report shows discrepancy (orphan is spurious)

**Technical Risk**

- P&L includes ghost revenue from deleted grades
- Audit trail shows revenue calculated for non-existent cohorts
- Version comparison breaks (old version with Terminale vs. new without)

**Suggested Resolution**

1. **Cascade delete with audit:** When enrollment_detail deleted, delete related monthly_revenue rows with audit trail entry: "Deleted 12 revenue rows for Terminale due to enrollment deletion"
2. **Soft delete for versions:** Mark enrollment_detail as inactive rather than hard delete; allow "undelete" for version rollback
3. **Foreign key constraint:** Database enforces referential integrity (DELETE CASCADE or RESTRICT)
4. **Validation query:** Monthly check for orphaned revenue records (revenue without corresponding active enrollment)
5. **UI warning:** "Deleting Terminale enrollment will delete 12 monthly revenue rows. Proceed?"

**Severity:** High

**Affected Components:** Enrollment, Revenue, P&L Consolidation, Audit Trail

---

### SA-011: Circular Dependencies — FTE ↔ Staff Cost

**Edge Case Description**

Data dependency:
```
Enrollment → DHG Sections → FTE → Staff Count
↓
Staff Costs → Salary Budget
↑
But: FTE drives positions, which changes headcount assumption
```

Circular logic:
1. Enrollment → FTE calculated (e.g., 150 FTE)
2. Finance team enters staff cost based on FTE (168 positions)
3. User updates enrollment (e.g., -20 students)
4. FTE recalculates (e.g., 140 FTE, needs 2 fewer positions)
5. Staff cost auto-updates? Or is it locked at 168 positions?

If auto-update: Cost changes without user action (confusing)
If locked: FTE and staff count diverge (inconsistency)

**Technical Risk**

- User doesn't know whether cost will auto-update on enrollment change
- FTE and staff headcount become out-of-sync
- Scenario modeling produces inconsistent snapshots (enrollment vs. cost)
- Audit trail shows unexplained cost changes

**Suggested Resolution**

1. **Explicit dependency documentation:** "Staff cost positions are NOT auto-calculated from FTE. User must manually update staff count when enrollment changes."
2. **FTE-to-Staff reconciliation report:** Show FTE calculation vs. actual staff count; flag significant mismatches
3. **Scenario feature:** "Scenario A: Base enrollment + Base staff cost (168)" vs. "Scenario B: Optimistic enrollment + Optimistic staff cost (170 positions)"
4. **UI affordance:** Separate FTE calculation (read-only) from Staff Count input (editable); make relationship explicit
5. **Audit trail:** Log when staff count is manually edited ("Changed staff count from 168 to 166 due to anticipated departures")

**Severity:** Medium

**Affected Components:** DHG Module, Staff Costs, Scenario Modeling, P&L

---

### SA-012: Negative Enrollment in Pessimistic Scenario

**Edge Case Description**

Scenario parameters can produce negative enrollment:

```
Base enrollment: 100 students
Pessimistic scenario:
  New Enrollment Factor: 0.9 (10% decline)
  Retention Adjustment: -5%
  Attrition Rate: 5%

Adjusted = (100 × 0.9) × (1 - 0.05) - (100 × 0.05)
        = 90 × 0.95 - 5
        = 85.5 - 5
        = 80.5 students ✓

But extreme Pessimistic:
  New Enrollment Factor: 0.8
  Retention Adjustment: -20%
  Attrition Rate: 30%

Adjusted = (100 × 0.8) × (1 - 0.20) - (100 × 0.30)
        = 80 × 0.8 - 30
        = 64 - 30
        = 34 students ✓

But user defines custom "Apocalypse" scenario:
  Factor: 0.5, Retention: -50%, Attrition: 50%

Adjusted = (100 × 0.5) × (1 - 0.50) - (100 × 0.50)
        = 50 × 0.5 - 50
        = 25 - 50
        = -25 students ✗
```

Negative enrollment produces:
- Negative revenue
- Negative DHG hours
- FTE = negative / 18 = negative FTE (nonsensical)

**Technical Risk**

- Scenario calculation produces impossible values (-25 students)
- P&L shows negative revenue (which inverts IFRS classification)
- User interprets negative enrollment as "refund obligation" (incorrect)
- Audit exception: "Why is a scenario showing -25 students and -12M SAR revenue?"

**Suggested Resolution**

1. **Floor constraint:** MIN(Adjusted Enrollment, 0) → if negative, set to 0
   ```
   Adjusted = max(0, (Base × Factor) × (1 + Retention) - (Base × Attrition))
   ```

2. **Scenario validation:** Warn user if scenario produces enrollment < 5% of base: "This scenario results in only X students (5% of base). Reconsider parameters."

3. **Extreme scenario handling:** For user-defined scenarios, validate that all three adjustment parameters produce reasonable ranges:
   - Factor: 0.5 to 1.5 (50%-150% of base)
   - Retention: -10% to +10%
   - Attrition: 0% to 20%
   
   Warn if outside ranges.

4. **Scenario output display:** Show calculated intermediate: "Adjusted = (1,503 × 0.9) × (1 - 0.05) - (1,503 × 0.05) = [result]"

**Severity:** High

**Affected Components:** Enrollment, Scenario Modeling, Revenue Engine, P&L

---

### SA-013: Fee Grid Cascade on Grade Deletion

**Edge Case Description**

Data model:
```
grade_levels (id, code, name)  ← referenced by fee_grids
fee_grids (grade_id, nationality, tariff, amount, period)
```

If a grade is deleted from the system (e.g., remove Terminale):
1. Grade record deleted (hard delete or soft delete?)
2. Fee grid rows for Terminale still exist (orphaned)
3. On next fee grid import/export, orphan rows are unclear
4. Revenue calculation references deleted grade (error)

Example:
- 45 fee combinations exist (3 nationalities × 15 grades × 1 tariff variant)
- Terminale deleted (3 fee rows orphaned)
- New import adds Terminale back (duplicates?)
- Fee grid now has 46 combinations with potential duplicates

**Technical Risk**

- Fee grid becomes inconsistent with enrollment structure
- Revenue calculation fails or produces wrong results for orphaned grades
- Import/export logic assumes grade hierarchy is stable
- Audit trail shows revenue calculated for deleted grades

**Suggested Resolution**

1. **Cascade delete with constraints:** If grade deleted, either:
   - **Option A (Hard delete):** Also delete all fee grid rows for that grade (with audit trail)
   - **Option B (Soft delete):** Mark grade as inactive; keep fee grid for historical reference
   
   Recommend Option B for EFIR (maintain audit trail, allow "undo")

2. **Foreign key enforcement:** Database constraint ensures fee_grid.grade_id references active grade_levels

3. **Grade hierarchy stability:** Restrict deletion of grades if they have:
   - Active enrollments
   - Active fee grid definitions
   - Recent audit trail entries
   
   UI message: "Cannot delete Terminale: 3 students enrolled, 3 fee definitions active"

4. **Fee grid validation report:** Quarterly check for orphaned fee rows or missing fees for active grades

**Severity:** High

**Affected Components:** Master Data, Fee Grid, Revenue Engine, Data Integrity

---

### SA-014: Version Locking Race Condition

**Edge Case Description**

Version management:
```
Version states: Draft → Locked → Published
Budget version is locked when finance team approves
Forecast version remains editable for scenario modeling
```

Race condition:
1. User A is editing Budget version (still Draft)
2. User B publishes Budget version (changes to Locked)
3. User A continues editing (now editing a Locked version)
4. User A attempts to save → Does app allow edit on Locked version? Block with error? Or warn?

If app allows edit:
- User A changes 50 enrollment records
- User A saves
- Locked version is now modified (violates publishing intent)
- Audit trail shows edits to Locked version (confusing)

If app blocks edit:
- User A's edits are lost
- User confusion: "Where did my edits go?"
- Version is locked but User A wasn't notified

**Technical Risk**

- Locked version is modified despite lock (audit/approval failure)
- User loses work without warning (UX failure)
- Concurrent edits to same locked version overwrite each other
- Audit trail shows conflicting lock and edit events

**Suggested Resolution**

1. **Optimistic locking:** Store version_timestamp on each record
   - On save, check if version_timestamp matches database version_timestamp
   - If not, collision detected → block save with message: "Version was locked/modified by another user. Your edits were not saved. Refresh to see latest state."

2. **Pessimistic locking (alternative):** Lock version at database level when edit begins
   - User A begins editing → Version locked for editing by User A
   - User B attempts to edit same version → Blocked: "Version locked by User A (editing since 2 min ago)"
   - On save or abandon, release lock

3. **UI affordance:** Display version lock status prominently:
   - "Budget v1 [LOCKED by CFO at 14:30]" → User cannot edit
   - "Forecast v2 [DRAFT — being edited by You]" → User can edit
   - "Forecast v3 [LOCKED by User X at 12:00]" → User cannot edit, can only view

4. **Conflict resolution:** If collision detected, offer options:
   - "Create new Draft copy of your edits"
   - "Discard your edits and view locked version"
   - "Contact version lock holder to unlock"

**Severity:** High

**Affected Components:** Version Management, Data Integrity, Audit Trail, Concurrency

---

## CATEGORY 3: Concurrency & State Management

### SA-015: Auto-Save Conflict During User Edit

**Edge Case Description**

PRD specifies auto-save every 30 seconds or on field blur. Concurrency issue:

1. User edits Enrollment record (field A), has not yet blurred (auto-save timer running)
2. Auto-save triggers (30s timer), saves field A value
3. Meanwhile, user continues typing in field B (not yet saved)
4. Another user (User B) also edits the same Enrollment record, changes field C
5. User B saves
6. User A's field B value is overwritten by User B's field C change (lost update)

Example:
- User A editing "Total Enrollment for Maternelle"
- Auto-save at 30s: Enrollment = 265
- User A continues typing, enters "266" (but not yet blurred)
- User B edits same record, changes "Nationality breakdown"
- User B saves
- User A blurs field B → Saves Enrollment = 266
- But if User B's save overwrote field B in the meantime, User A's value is lost

**Technical Risk**

- Concurrent edits to same record result in lost updates
- User assumes their edit was saved (visual confirmation), but it was overwritten
- Data integrity: record state is inconsistent with user intent
- Audit trail shows save event, but actual data differs from what user entered

**Suggested Resolution**

1. **Optimistic locking per field:** Store field-level timestamp
   - On save, check if field_timestamp matches database version
   - If conflict detected, show merge dialog: "Field X was modified by User Y at [time]. Your value: [A], database value: [B]. Keep yours? Keep theirs? Merge manually?"

2. **Pessimistic locking per record:** Lock entire record during active editing
   - On first field blur (or edit start), acquire write lock
   - On save or timeout (5 min inactive), release lock
   - UI shows lock status: "Record locked for editing (auto-release at 14:35)"

3. **Auto-save strategy:** Auto-save only if no active edits
   - Track focus state of all input fields
   - If any field has focus, defer auto-save
   - Once all fields blurred, auto-save

4. **Conflict notification:** If conflict detected,don't silently overwrite
   - Show merge dialog with side-by-side diff
   - Let user choose keep/discard/merge

**Severity:** High

**Affected Components:** Auto-Save, Data Integrity, Concurrency Control

---

### SA-016: Context Bar State Loss Across Modules

**Edge Case Description**

PRD requires: "Context bar persists state across all modules" (Fiscal Year, Version, Scenario, Academic Period).

State variables:
- fiscal_year: 2026
- version: "Budget v1" (Actual, Budget, or Forecast)
- scenario: "Base" (user-defined scenarios include Base, Optimistic, Pessimistic, Custom)
- academic_period: "AY1" or "AY2"

Race condition:
1. User selects context: FY 2026, Budget v1, Optimistic, AY1
2. User navigates Enrollment → Revenue → Staffing modules (context persists ✓)
3. User clicks "Refresh" button in one module
4. During refresh, async API call fetches new version list
5. If API response is slow, and user navigates to another module before response completes, context bar may not re-render with new data
6. User is now viewing Staffing module with stale context (FY 2026, Budget v1) but Revenue module sees new context

**Technical Risk**

- Context diverges across modules (user sees Enrollment in FY 2026 context but Staffing in FY 2025)
- Calculations reference different versions across modules (P&L total doesn't equal Revenue + Costs)
- Audit trail shows inconsistent context per event

**Suggested Resolution**

1. **Centralized context store:** Use state management library (Redux, Vuex, Context API) with single source of truth
   - Context changes trigger pub-sub notifications to all modules
   - Modules subscribe to context changes and re-render atomically

2. **Context versioning:** Each calculation result is tagged with (fiscal_year, version, scenario, period)
   - When context changes, all cached results are invalidated
   - Module explicitly checks context tag before displaying cached data

3. **Context lock during fetch:** Lock context mutations while async API calls are in-flight
   - User cannot change context until pending API calls complete
   - UI shows spinner: "Loading versions... Please wait"

4. **Audit trail per context:** Log context changes with timestamp and user
   - Correlate all calculations with their context state

**Severity:** Medium

**Affected Components:** Context Persistence, State Management, Cross-Module Consistency

---

### SA-017: Simultaneous Version Comparison & Edit

**Edge Case Description**

Version comparison feature: "Comparison version is active; show variance columns inline" (SA-8.6).

Race condition:
1. User activates Version Comparison: "Budget v1" vs. "Actual v1"
2. System displays Budget and Actual side-by-side with variance columns
3. User starts editing Actual enrollment (single-user edit, not the comparison baseline)
4. Edit is saved
5. Variance columns are recalculated automatically
6. BUT: If comparison version (Budget) is also modified concurrently by another user, variances become stale or inconsistent

Example:
- Budget v1: Maternelle enrollment = 250
- Actual v1: Maternelle enrollment = 265 (initial)
- Variance displayed: +15 students

- User A (editing Actual): Changes to 270
- User B (editing Budget): Changes to 260
- User A saves first → System recalculates Actual variance (now 270 - 250 = +20)
- But User B hasn't saved yet; system displays variance as 270 - 250 = +20 (outdated vs. User B's budget change)

**Technical Risk**

- Variance calculations reference inconsistent snapshot of comparison version
- User makes decision based on stale variance ("Enroll 5 more students to reach Budget") but Budget was already changed
- Audit trail shows discrepancy between displayed variance and actual data

**Suggested Resolution**

1. **Version comparison snapshot:** When comparison is activated, snapshot both versions at that point in time
   - Display variance relative to snapshot (not live data)
   - If either version is edited, flag as "Comparison snapshot is stale"
   - UI shows: "Comparison outdated. Refresh comparison to see latest variances?"

2. **Read-only comparison version:** When comparison is active, lock the comparison version from editing
   - Only the active (primary) version is editable
   - Prevents simultaneous modification of both versions

3. **Variance cache invalidation:** On any data modification to either version, clear variance cache and trigger recalculation
   - Variance columns show "loading" spinner during recalculation
   - Once complete, display updated variances with timestamp: "Variance calculated at [time]"

**Severity:** Medium

**Affected Components:** Version Comparison, Concurrency, Variance Calculation

---

## CATEGORY 4: Performance Edge Cases

### SA-018: Recalculation Cascade on Enrollment Change

**Edge Case Description**

Calculation dependency chain:
```
Enrollment Change
  → Revenue Engine (50+ fee combinations × 12 months = 600 calculations)
  → DHG Staffing (FTE recalculation for 4 bands × scenarios)
  → Staff Costs (168 employees × 12 months × recalculated FTE)
  → P&L Consolidation (revenue + costs + IFRS mapping)
  → Dashboard KPIs (total enrollment, revenue, utilization)
  → Scenario outputs (3 scenarios × all above)
```

PRD target: <3 seconds full recalculation. But with complex cascades:

- Revenue calculation: 50 combinations × 12 = 600 operations × 5 decimal operations per cell = 3,000 FP ops
- Each FP operation with Decimal.js: ~1 ms (vs. native float: ~0.01 ms)
- Cascade overhead: 600 × 1 ms = 600 ms (Revenue alone)
- + DHG: 200 ms
- + Staff Costs: 800 ms (168 × 12 × FTE lookup)
- + P&L: 200 ms
- + Dashboard: 100 ms
- + Scenarios: 3x multiplier = 2,800 ms

**Total: ~2.8 seconds** (within tolerance, but leaves no margin)

If database queries are slow (e.g., slow connection) or calculations are inefficient, total easily exceeds 3s target.

**Technical Risk**

- User changes one enrollment value, waits 4-5 seconds for recalculation
- Impression of slow application ("Why is this taking so long?")
- Multiple concurrent edits by users create queue of recalculations (exponential slowdown)
- Calculation doesn't complete within 3s target; user refreshes, triggering another recalculation

**Suggested Resolution**

1. **Memoization & incremental calculation:** Cache intermediate results
   - When single enrollment value changes, only recalculate affected fee combinations (not all 50)
   - DHG FTE changes only for affected grade, not all 4 bands
   - Staff cost changes only for affected cost rows

2. **Lazy evaluation:** Don't recalculate scenarios until user requests
   - Base case recalculation first (< 1 second)
   - Scenario calculations deferred (background/on-demand)
   - UI shows "Scenarios updating..." spinner

3. **Database query optimization:**
   - Index on (grade_id, nationality, tariff, period) for fee grid lookup
   - Pre-compute monthly revenue per combination (materialized view)
   - Cache P&L totals, recalculate only affected line items

4. **Asynchronous recalculation:** Trigger calculation in background, update UI progressively
   - User sees "Recalculating: Revenue (complete), DHG (in progress), Staff Costs (pending)..."
   - Page remains responsive

5. **Regression test:** Measure recalculation time with 1,500 students × 50 combinations × 12 months, ensure < 3s on standard hardware

**Severity:** High

**Affected Components:** Calculation Engine, Performance, Dashboard

---

### SA-019: Large Scenario Comparison Report

**Edge Case Description**

Scenario comparison report: 3 scenarios × 1,500 students × 50 fee combinations × 12 months × 5 metrics (enrollment, revenue, cost, variance, percentage).

Data volume:
- 3 scenarios × 50 combinations × 12 months = 1,800 rows
- × 5 metrics per row = 9,000 data points
- × variance calculations (A vs B, B vs C, etc.) = 27,000 calculations

Report generation:
1. Query database for 3 scenario sets
2. Join with fee grid (50 combinations)
3. Pivot to monthly layout (12 columns)
4. Calculate variances (3 × 9,000 = 27,000 ops)
5. Format for display (Excel or PDF export)

PRD target: 5 seconds for version comparison. Scenario comparison is more complex; could approach 10+ seconds.

**Technical Risk**

- Report generation timeout after 5 seconds (user sees blank page)
- Memory spike during report generation (1M+ cell array in memory)
- Export to Excel with 10,000 rows crashes browser (OOM)

**Suggested Resolution**

1. **Pagination for reports:** Display summary (3 scenarios, totals only) immediately; allow drill-down to detail
2. **Streaming export:** For Excel/CSV export, stream rows incrementally (not all in memory at once)
3. **Pre-calculated views:** Materialize scenario comparison results nightly; serve pre-computed snapshot
4. **Asynchronous report generation:** Submit report job to background queue
   - UI shows "Report generating... ETA 30s"
   - Email report link when complete (similar to long-running batch jobs)
5. **Test with load:** Generate scenario comparison report with 1,500 students × 50 combos, measure time and memory usage

**Severity:** Medium

**Affected Components:** Scenario Modeling, Reporting, Performance

---

### SA-020: Audit Trail Query Timeout with 5+ Years Data

**Edge Case Description**

Audit trail specification: "Every data modification is logged" (FR-AUD-001). Retention: 7 years.

Over 7 years of operation (365 days × 7 = 2,555 days) with daily usage:
- Estimated events per day: 50-100 (50 enrollment edits, 100 cost edits, etc.)
- 7-year total: 2,555 × 75 = 191,625 audit events

Audit trail search:
- User queries: "Show all changes to Enrollment module for Terminale in 2024"
- Query: SELECT * FROM audit_log WHERE module = 'Enrollment' AND grade = 'Terminale' AND year(created_at) = 2024
- Without proper indexing: full table scan of 191,625 rows
- Query time: 1-2 seconds

If user requests large range (all changes for all grades for all years):
- SELECT * FROM audit_log (no WHERE clause)
- 191,625 rows returned
- Network transfer: ~20 MB (each row ~100 bytes)
- Browser rendering 191,625 rows: OOM or > 30 second load

**Technical Risk**

- Audit trail searches timeout (> 5 seconds)
- Export audit trail to CSV (>191K rows) crashes browser or takes minutes
- Storage costs for 7+ years: uncontrolled growth

**Suggested Resolution**

1. **Indexing strategy:**
   - Index on (module, resource_id, created_at)
   - Index on (user_id, created_at)
   - Separate historical audit partition (archive old events to separate table)

2. **Pagination & filtering:**
   - Default query shows last 100 events (fast)
   - Offer date range filter: "Show changes between [date] and [date]"
   - Require user to specify at least month/grade/module to query

3. **Archive strategy:**
   - Keep hot audit (current year) in main table
   - Archive older events to historical table (accessible but slower)
   - Enforce retention policy: purge after 7 years

4. **Async export:**
   - "Export audit trail" initiates background job
   - Email download link when ready (not inline in browser)

5. **Audit aggregation:**
   - Instead of 50 enrollment edits in a day, show: "Enrollment changed 50 times on [date]"
   - Drill-down for details

**Severity:** High

**Affected Components:** Audit Trail, Reporting, Database Performance

---

## CATEGORY 5: Data Migration Edge Cases

### SA-021: Dirty Excel Data — Formula Errors & Missing Values

**Edge Case Description**

Excel source file "01_EFIR_Revenue_FY2026_v3.xlsx" contains known issues (per PRD Section 2.1: "Executive Summary sheet already contains a #REF! error").

Dirty data patterns:
1. **Formula errors:** `#REF!` (broken cross-file reference), `#DIV/0!` (division by zero), `#N/A` (lookup failure)
2. **Missing values:** Empty cells in mandatory fields (e.g., fee grid missing value for one nationality/grade combination)
3. **Invalid data types:** Fee grid containing text ("forty-seven thousand") instead of numeric value
4. **Encoding issues:** Arabic text in employee names encoded as mojibake (incorrect character set)
5. **Inconsistent formatting:** Some fees formatted as `47250` (integer), others as `47250.00` (float), others as `47,250` (with comma)

Migration attempt:
- Application tries to import FEE_GRID sheet
- Encounters formula error `#REF!` in one cell
- Parser crashes OR silently ignores error OR imports as string "#REF!"
- If silently ignored: fee grid has gap (one combination missing), revenue calculation produces wrong total

**Technical Risk**

- Migration fails with unclear error message ("Error on row 45")
- Silent import of malformed data creates subtle discrepancies (discovered weeks later during variance checks)
- Manual remediation needed for each data quality issue
- Audit trail doesn't record data cleansing steps

**Suggested Resolution**

1. **Pre-migration validation:**
   - Scan Excel files for formula errors, empty cells, invalid types
   - Generate data quality report: "FEE_GRID has 3 formula errors, 5 missing values, 12 encoding issues"
   - Block migration until issues resolved (or allow override with sign-off)

2. **Data cleansing rules:**
   - Formula errors: Replace with placeholder (0 or NULL) and flag in report
   - Missing values: Prompt user "Fee grid missing value for [grade, nationality, tariff]. Enter value or import will skip this combination"
   - Invalid types: Attempt coercion (text "47250" → numeric 47250); flag if coercion fails
   - Encoding: Auto-detect encoding (UTF-8, Windows-1252) and convert

3. **Reconciliation script:**
   - After import, verify all 45 fee combinations exist
   - Verify no formula errors in imported data
   - Generate before/after diff report: "45 fees imported, 0 skipped"

4. **Manual review audit trail:** Log data cleansing steps (user: "Replaced #REF! in FEE_GRID B45 with value 47500", timestamp, reason)

**Severity:** Critical

**Affected Components:** Data Migration, Data Validation, Import

---

### SA-022: Encoding Issues in CSV Import

**Edge Case Description**

Historical enrollment CSV files (2021-22 through 2025-26) contain grade names in French:

```
level_code, student_count, year
"Petite Section", 60, 2021-22
"Maternelle (PS)", 60, 2021-22
"PS", 60, 2021-22  ← inconsistent coding
```

CSV encoding:
- File may be UTF-8, Windows-1252 (Latin-1), or even MacRoman
- If parser assumes UTF-8 but file is Windows-1252: accents display incorrectly ("Él é mentaire" instead of "Élémentaire")
- Grade level lookup fails: system expects "Élémentaire" but imports "Él é mentaire"
- Enrollment records created with invalid grade names

**Technical Risk**

- Grade names become corrupted (audit trail shows strange characters)
- Revenue calculation fails to match enrollment (enrollment says "Él é mentaire" but revenue grid expects "Élémentaire")
- Variance report shows false discrepancies due to encoding mismatch

**Suggested Resolution**

1. **Auto-detect encoding:**
   - Use chardet (Python) or similar library to detect CSV encoding
   - Attempt UTF-8 first; fall back to Windows-1252 if detection fails
   - Report detected encoding to user: "CSV detected as UTF-8. Proceed?"

2. **Normalize grade names:**
   - Import with detected encoding
   - Compare imported grade name against master list of valid grades (PS, MS, GS, CP, CE1, ...)
   - If mismatch, prompt user: "Imported 'Él é mentaire' doesn't match master grade 'Élémentaire'. Map which grade?"

3. **Normalization rules:**
   - Remove accents, convert to standard ASCII: "Élémentaire" → "Elementaire" for comparison
   - Then map back to correct grade code

4. **Test CSV files with multiple encodings:** Create test fixtures in UTF-8, Windows-1252, and MacRoman; verify import handles all correctly

**Severity:** Medium

**Affected Components:** Data Migration, Import, Grade Master Data

---

### SA-023: Decimal vs. Integer Discrepancies in Fee Grid

**Edge Case Description**

Fee grid values imported from Excel may have precision issues:

```
Excel displays: 47,250.00 SAR
Excel stores: 47250.0 (floating-point)
Application imports as: 47250 (integer)
vs. 47250.00 (decimal with 2 places)
vs. 4725000 (scaled integer — fils)
```

After import, fee calculations:
- Approach A: Net Fee = 47250 × 0.75 = 35437.5 → round to 35437.50
- Approach B: Net Fee = 47250.00 × 0.75 = 35437.50
- Approach C: Net Fee = 4725000 × 75 / 100 / 100 = 35437.50

All three produce same result in this case, but:
- If fee has fractional component: 47,250.25 SAR
- Approach A: 47250.25 × 0.75 = 35437.6875 → round to 35437.69
- Approach C: 4725025 × 75 / 100 / 100 = 35437.6875 → round to 35437.69 ✓

If Excel stored fee as integer (losing fractional cent):
- Excel: 47,250 SAR (displayed), but actual is 47250.0625 (internal precision)
- Application imports as: 47,250 (loses fractional cent)
- Calculation diverges by 0.0469 SAR (rounding the rounding error)

Over 50 combinations × 12 months = 600 line items, ±0.05 SAR × 600 = ±30 SAR aggregate variance.

**Technical Risk**

- Fee import discrepancy from Excel (±30 SAR aggregate)
- Audit questions: "Why doesn't total revenue match Excel?"
- Data migration sign-off delayed due to unresolved ±30 SAR discrepancy

**Suggested Resolution**

1. **Preserve import precision:** Import fees as text/string, parse as Decimal (preserving all decimal places from Excel)
   - Do NOT coerce to integer; preserve fractional cents
   - Decimal("47250.25") maintains full precision

2. **Validate fee precision:** Report on fees with unusual precision:
   - Most fees end in .00 (e.g., 47250.00)
   - Some end in .25, .50, .75 (currency rounding artifacts)
   - Flag any fee with 3+ decimal places as suspicious

3. **Reconciliation:** Post-import, compare total revenue Excel vs. app
   - Target: ±0 SAR match
   - If variance > ±2 SAR, flag for investigation before sign-off

4. **Audit trail:** Log all fees imported with source and precision: "Fee 47250.25 imported from Excel cell B12, preserved precision"

**Severity:** High

**Affected Components:** Data Migration, Fee Grid, Revenue Engine

---

### SA-024: Manual Override Records Not Migrated

**Edge Case Description**

Excel workbook may contain "manual override" records (e.g., user manually changed a fee for a specific student due to scholarship):

```
Excel override_log:
  Date: 2024-01-15
  Grade: Terminale
  Student ID: 1234
  Normal Fee: 47,250 SAR
  Overridden Fee: 35,000 SAR (scholarship applied)
  Reason: "Scholarship award letter received"
```

If application doesn't have override functionality (not in original PRD), these records are:
- Not extracted during migration
- Or extracted but not applied (orphaned)
- Or extracted and applied to all students in cohort (wrong, should be student-specific)

Result:
- Migrated revenue is calculated using standard fees (47,250), not overridden fees (35,000)
- Total revenue in app ≠ Excel actuals (discrepancy of 12,250 SAR per override × 5-10 overrides = 60K-120K SAR variance)

**Technical Risk**

- Actual vs. Budget variance reports show massive discrepancy (not a budget miss, but data migration error)
- Finance team distrust: "App doesn't match Excel actuals"
- Audit exception: "Why is app revenue 150K higher than Excel?"

**Suggested Resolution**

1. **Identify overrides in source Excel:**
   - Scan Excel files for "override" sheets, columns, or comments indicating manual adjustments
   - Document all overrides with student ID, amount, reason

2. **Include override in application data model:**
   - If application doesn't already support student-level fee overrides, add capability before migration
   - OR document overrides separately and apply as manual adjustment in first month close

3. **Migration step:** Import override records with audit trail
   - Create audit log: "Imported student override: ID 1234, fee 47250 → 35000, reason: scholarship"
   - Apply overrides to enrollment detail records

4. **Reconciliation:** Post-migration, calculate revenue with and without overrides
   - Total revenue (with overrides) should match Excel actuals (within ±1 SAR)

**Severity:** Medium

**Affected Components:** Data Migration, Enrollment Detail, Revenue Engine

---

## CATEGORY 6: Audit Trail Edge Cases

### SA-025: Bulk Operations — 168 Employees Updated at Once

**Edge Case Description**

FR-AUD-001 requires: "Every data modification is logged with timestamp, user, field, old value, new value."

Bulk operation example: Finance team applies 3% salary augmentation to all 168 employees.

Naive audit logging:
```
FOR each employee in employees:
    old_salary = employee.salary
    new_salary = old_salary × 1.03
    employee.salary = new_salary
    INSERT INTO audit_log (user, field, old_value, new_value, timestamp)
```

Audit table size:
- 168 employees × 5 salary components (base, housing, transport, premium, HSA) = 840 rows per bulk operation
- Per year: assume 2-3 bulk operations (annual augmentation, summer adjustment, etc.) = 1,680-2,520 audit rows per year
- 7-year retention: 11,760-17,640 audit rows

Issues:
1. **Audit table bloat:** Storage grows rapidly; queries slow
2. **Lost context:** Audit shows 840 individual changes but no indication they were part of single bulk operation
3. **Audit usability:** User searching audit log sees 840 rows for single operation; unclear what happened

**Technical Risk**

- Audit log becomes unwieldy and slow to query
- No way to identify bulk operations vs. individual edits
- Compliance auditors question granularity: "Did user really change 840 fields individually, or is this a bulk operation? If bulk, why no batch_id?"

**Suggested Resolution**

1. **Batch audit concept:** Group related audit entries with batch_id
   ```
   INSERT INTO audit_log WITH RECURSIVE batch (
       user, batch_id, operation, timestamp, details
   ) VALUES (
       'CFO', 'BULK_AUGMENT_20260303', 'Apply 3% salary augmentation', 2026-03-03 14:30:00, '168 employees updated'
   );
   
   THEN INSERT 840 individual audit rows with same batch_id
   ```

2. **Audit query optimization:** Show batch summary by default, drill-down to details
   - "3% salary augmentation (168 employees, 840 fields) applied by CFO on Mar 3, 2026"
   - Expand to see individual employee changes

3. **Configuration:** For system-initiated bulk operations (e.g., nightly closing calculations), consider audit silence or summary logging
   - Nightly P&L consolidation: single audit entry "Monthly P&L calculated" instead of 100+ line-item entries

4. **Audit retention trade-off:** Archive audit entries older than 1 year to separate table (still queryable, but separate)
   - Reduces main audit table size

**Severity:** High

**Affected Components:** Audit Trail, Data Integrity, Reporting

---

### SA-026: Auto-Calculated Field Changes & Audit Noise

**Edge Case Description**

Some fields are auto-calculated; should they be logged as modifications?

Examples:
- Monthly Revenue = SUM(Headcount × Net Fee) — auto-calculated from enrollment
- FTE = Total DHG Hours / ORS — auto-calculated from enrollment sections
- EoS Accrual = Annual Charge / 12 — auto-calculated from employee data

If these are logged every time source data changes:
- User edits Enrollment for Maternelle
- System auto-calculates Revenue, FTE, Staffing
- 12 months × revenue = 12 audit rows
- 4 bands × FTE = 4 audit rows
- 168 employees × EoS = 168 audit rows
- Single enrollment edit generates 184 audit entries

Audit log is flooded with auto-calculated changes; hard to find actual user edits.

**Technical Risk**

- Audit trail becomes noise (mostly auto-calculated field changes)
- Finance team can't distinguish user edits from calculated recalculations
- Audit query becomes slow (184 rows per single enrollment edit × 100 edits/day = 18,400 rows/day)
- Compliance question: "Was monthly revenue changed by user, or auto-calculated?"

**Suggested Resolution**

1. **Separate audit streams:**
   - **Manual audit log:** Only user-initiated edits (INSERT/UPDATE/DELETE)
   - **Calculation audit log:** Auto-calculated field changes (reference only, not compliance-critical)
   
   UI shows both, but search defaults to manual changes.

2. **Audit entry classification:**
   ```
   audit_log: user, field, old_value, new_value, timestamp, audit_type
   
   audit_type: "USER_CHANGE" | "AUTO_CALCULATED" | "SYSTEM_GENERATED"
   
   User filter: Show only "USER_CHANGE" entries
   ```

3. **Summary logging for calculated fields:** Instead of logging 12 revenue rows per enrollment edit, log once:
   - "Enrollment change triggered revenue recalculation (12 months, 50 combinations)"
   - If user queries detail, join with calculation audit log

4. **Materialized view for audit summary:** Pre-aggregate audit entries by day/user/operation
   - "CFO made 50 enrollment edits on Mar 3, 2026"
   - Drill-down for details

**Severity:** Medium

**Affected Components:** Audit Trail, Logging, Query Performance

---

### SA-027: Cascade Change Logging

**Edge Case Description**

Data dependencies:
```
Enrollment → Revenue → P&L
     ↓
   DHG → Staff Costs → P&L
```

When user changes Enrollment from 1,500 to 1,550:
1. Enrollment record updated → audit log: "Enrollment change: 1,500 → 1,550"
2. Revenue recalculated (50 combinations × 12 months) → 600 audit entries?
3. DHG recalculated (4 bands) → 4 audit entries?
4. Staff Costs recalculated (168 × 12) → 2,016 audit entries?
5. P&L consolidated → 50+ audit entries?

Cascade audit entries: 1 + 600 + 4 + 2,016 + 50 = 2,671 audit entries for single enrollment edit.

Issues:
1. **Audit table bloat:** Primary user edit generates thousands of downstream audit rows
2. **Lost causation:** Audit entries for staff costs don't indicate they were triggered by enrollment change
3. **Audit confusion:** User searches for "who changed staff costs" and finds 2,000 auto-calculated entries from enrollment change

**Technical Risk**

- Audit trail becomes incomprehensible (thousands of rows per user edit)
- Root cause analysis is difficult ("Why did staff costs change on Mar 3? Was it user edit or enrollment change?")
- Compliance audit fails: "System logs too much; we can't find signal in noise"

**Suggested Resolution**

1. **Audit causation chain:**
   ```
   audit_log: parent_audit_id (links cascade edits to original change)
   
   User edits Enrollment:
       audit_entry_1: id=1001, user='CFO', change='Enrollment 1500→1550', parent_id=NULL
       
   System auto-calculates Revenue:
       audit_entry_2: id=1002, user='SYSTEM', change='Revenue recalculated', parent_id=1001
       audit_entry_3: id=1003, user='SYSTEM', change='Monthly revenue 50 combinations', parent_id=1001
       ... (600 entries, all with parent_id=1001)
   ```
   
   User can query: "Show all changes caused by Enrollment edit #1001" and trace cascade.

2. **Audit aggregation:**
   - Instead of 600 revenue audit entries, single aggregated entry: "Revenue recalculated for 50 combinations × 12 months (600 cells)"
   - If user needs detail, expand or export detail to CSV

3. **Audit sampling for non-critical cascades:**
   - User edits: log in full detail
   - Auto-calculated recalculations: sample at 10% (log every 10th cell) or summary only

4. **Audit query UI:**
   - Search by root cause: "Show changes caused by enrollment edits"
   - Timeline view: "Mar 3, 14:30 - CFO edited enrollment → triggered revenue, DHG, cost recalculation (completed in 2.3s)"

**Severity:** High

**Affected Components:** Audit Trail, Cascade Calculation, Change Tracking

---

## CATEGORY 7: Integration & Export Edge Cases

### SA-028: Excel Export with Formula Errors

**Edge Case Description**

Application exports P&L report to Excel.xlsx. User opens in Excel and encounters:

```
Cell B12 contains formula: =SUM(B3:B11)
But calculation produced error: #DIV/0! (from upstream hidden calculation)
```

Or Excel export contains:
- Formula references to sheets that don't exist (app creates dynamic sheet names)
- Formula references like `=REVENUE!B12` but no REVENUE sheet (REVENUE data is in SQL database, not exported sheet)
- Circular formula references: `=SUM(C1:C10)` where C1 references C2, etc.

User opens exported file, sees `#DIV/0!` or `#REF!` errors, assumes data is corrupt.

**Technical Risk**

- User distrust: "Excel export is broken"
- Audit question: "Did finance team rely on corrupted export for month-end close?"
- Export invalidation: exported file is unreliable

**Suggested Resolution**

1. **Export calculated values, not formulas:**
   - Instead of exporting formulas, export cell values (static data)
   - User can recalculate formulas in their own version if desired
   - Eliminates formula errors in export

2. **Validate export before delivery:**
   - Generate Excel file
   - Open file programmatically, check for formula errors
   - If errors found, fall back to value-only export with warning: "Export contains errors. Falling back to values only."

3. **Cell validation in export:**
   - For any cell that should contain numeric value, validate type
   - If cell contains error, replace with 0 or blank with comment: "Cell contained error in source data"

4. **Export metadata:** Include sheet with export info:
   - "Exported from BudFin on Mar 3, 2026 by CFO"
   - "Contains [number] error cells (replaced with 0)"
   - "Formulas exported as values; recalculation in Excel may produce different results"

**Severity:** High

**Affected Components:** Export, Data Integrity, User Experience

---

### SA-029: PDF Export Encoding for SAR Currency Symbol

**Edge Case Description**

PDF export of P&L report. SAR currency symbol (﷼) is Unicode U+FDFC (Arabic Ryal Sign).

In PDF:
- If PDF uses standard Latin-1 encoding: SAR symbol not representable (outside encoding range)
- Possible outputs:
  - Symbol is omitted: "47250" instead of "﷼47250"
  - Symbol is replaced with placeholder: "?47250" or "[?]47250"
  - PDF generation fails with encoding error

**Technical Risk**

- PDF export is missing currency symbols (appears as plain numbers)
- Finance team interprets as "47250 USD" instead of "47250 SAR"
- Audit discrepancy: exported report doesn't match on-screen display

**Suggested Resolution**

1. **Use UTF-8 encoding in PDF:**
   - PDF libraries (pdfkit, iText) support UTF-8; ensure encoding is configured
   - Test with Arabic text and currency symbol in PDF generation

2. **Currency symbol handling:**
   - Store currency separately from amount: amount=47250, currency='SAR'
   - In PDF, display as "47,250 SAR" (text) instead of "﷼47,250" (symbol)
   - Works across all encodings, more readable

3. **Font embedding:** Ensure PDF includes font that supports Arabic/SAR symbol
   - Some fonts don't include currency symbols; fall back to standard fonts

4. **Test PDF generation with Arabic text and currency:**
   - Export P&L with employee names (Arabic), amounts (SAR symbol)
   - Verify in Acrobat Reader

**Severity:** Medium

**Affected Components:** Export (PDF), Internationalization

---

### SA-030: CSV Export — Quote Handling for Arabic Text

**Edge Case Description**

CSV export of staff list containing Arabic employee names.

CSV standard (RFC 4180):
- Fields containing commas, quotes, or newlines must be quoted
- Quote character inside quoted field must be escaped: "Ahmed ""Al-Rashid"" Al-Otaibi" (double quote)

Employee name: "أحمد الراشد" (Ahmed Al-Rashid in Arabic)

CSV export:
```
ID,Name,Department
1,"أحمد الراشد",Elementaire
```

But if system uses wrong quote escaping:
```
ID,Name,Department
1,"أحمد "الراشد",Elementaire  ← Unescaped quote breaks CSV
```

When user opens in Excel or import tool:
- Parser fails or interprets incorrectly
- Name becomes: `أحمد ` (truncated)
- Rest of line is misinterpreted

**Technical Risk**

- CSV export is malformed; cannot be imported back into system or other tools
- Employee records are corrupted in re-import (names are truncated or mangled)

**Suggested Resolution**

1. **Use CSV library with proper escaping:**
   - Use Python csv module (automatic escaping) or JavaScript papaparse
   - Do NOT manually concatenate CSV rows; use library functions

2. **Test with Arabic text:**
   - Create fixture with Arabic names, commas in names, quotes in names
   - Export to CSV, import back into Excel
   - Verify names are preserved correctly

3. **RFC 4180 compliance:** Validate CSV conforms to standard
   - All fields quoted (safest approach)
   - All quote characters escaped (doubling)
   - Correct line endings (CRLF for Windows, LF for Unix)

4. **Alternative export format:** Offer JSON or Excel as alternative to CSV (more robust for non-ASCII)

**Severity:** Medium

**Affected Components:** Export (CSV), Internationalization, Data Integrity

---

## CATEGORY 8: Security Edge Cases

### SA-031: RBAC for Version Locking

**Edge Case Description**

Version management: Budget version is Locked after publication; Forecast remains editable.

RBAC roles:
- Admin: Full access (create, edit, lock, unlock, delete versions)
- Editor: Can edit drafts; cannot lock/publish
- Viewer: Read-only

Edge case:
1. Editor creates Budget draft, edits enrollment data
2. Admin publishes Budget v1 (changes to Locked)
3. Editor attempts to edit Budget v1 (now Locked)
   - Does application block edit? (Correct behavior)
   - Or allow edit with warning?
   - Or allow edit but flag in audit?

If application allows Editor to edit a Locked version (wrong behavior):
- Locked version is modified despite lock
- Audit approval process is broken (Lock should be immutable)
- Finance team approval is circumvented

If application silently blocks edit without clear message:
- Editor is confused: "Where did my edits go?"
- No audit entry explaining why edit was blocked

**Technical Risk**

- Locked version is unintentionally modified (governance failure)
- RBAC not enforced (Editor has more privileges than intended)
- Audit trail shows locked version was modified (inconsistent state)

**Suggested Resolution**

1. **Enforce version lock in backend:**
   - Version.locked = True prevents all UPDATE/DELETE on that version
   - Exception: Admin can UNLOCK version (with audit trail)

2. **Check lock status before any edit:**
   ```
   IF version.locked AND user.role != "Admin":
       RETURN ERROR 403 Forbidden: "Version is locked. Contact Admin to unlock."
   ```

3. **RBAC matrix for version operations:**
   ```
   | Operation | Admin | Editor | Viewer |
   |-----------|-------|--------|--------|
   | Create Draft | Y | Y | N |
   | Edit Draft | Y | Y | N |
   | Lock | Y | N | N |
   | Publish | Y | N | N |
   | Unlock | Y | N | N |
   | View (Draft) | Y | Y | N |
   | View (Locked) | Y | Y | Y |
   ```

4. **Audit trail per RBAC operation:**
   - "Budget v1 locked by CFO at 14:30 (prevents Editor edits)"
   - "Editor [user] attempted to edit Budget v1 at 14:35 (blocked by lock)"

**Severity:** High

**Affected Components:** Security, RBAC, Version Management, Audit Trail

---

### SA-032: Audit Trail Tampering Detection

**Edge Case Description**

Audit trail contains immutable record of all changes. But what if an Administrator (or attacker with database access) modifies audit log directly?

Example:
- User A edits Enrollment from 1,500 to 2,000 students (unauthorized change)
- Audit trail shows: "User A, 2026-03-03 14:30, Enrollment 1500 → 2000"
- Admin (or attacker) deletes or modifies audit entry to hide change
- Audit trail now shows no record of change
- Finance team unaware of unauthorized edit

**Technical Risk**

- Audit trail integrity is compromised (cannot be trusted for compliance)
- Unauthorized data changes are undetectable
- External auditors reject audit trail as evidence: "Audit log may have been tampered with"

**Suggested Resolution**

1. **Immutable audit log:**
   - Audit log records cannot be UPDATED or DELETED (only INSERT)
   - Database constraint: REVOKE UPDATE/DELETE on audit_log from all roles except specific archival process

2. **Audit log signature:**
   - Each audit entry includes hash of previous entry: hash(entry_n) = SHA256(entry_n-1 || user || timestamp || field || old_value || new_value)
   - If any entry is modified, hash chain breaks
   - Weekly integrity check: compute hash chain from audit_log; alert if breaks found

3. **Separate audit database:**
   - Audit log stored in separate, append-only database (or external log service like CloudTrail, Datadog)
   - Main application database is mutable; audit log is immutable

4. **Audit retention guarantee:**
   - Document audit log retention policy in employee handbook / SOX compliance docs
   - External auditors verify audit log integrity annually

5. **Change log auditing:**
   - Separately log any audit table modifications (INSERT/UPDATE/DELETE on audit_log itself)
   - Alert if audit table is modified outside normal append operation

**Severity:** High

**Affected Components:** Security, Audit Trail, Compliance

---

### SA-033: Data Export Controls by Role

**Edge Case Description**

Data export (Excel, PDF, CSV) may contain sensitive information:
- Employee salary details (if HR Finance staff exports via Staff Costs module)
- Student enrollment data (if enrollment is exported)

RBAC control:
- Admin: Can export all data
- Editor: Can export reports (P&L, variance) but NOT employee-level salary data
- Viewer: Can export aggregated reports only

Edge case:
1. Viewer user navigates to Staff Costs module
2. Clicks "Export Staff Cost Budget to Excel"
3. Application generates Excel with all 168 employee salary details (should be blocked)

If application doesn't enforce export controls:
- Viewer downloads sensitive salary data (security breach)
- Audit trail shows download but doesn't capture that it was sensitive
- GDPR/privacy violation

**Technical Risk**

- Viewer exports sensitive employee salary data (data breach)
- No audit of what data was exported (cannot forensically investigate breach)
- Regulatory violation (SOX, GDPR, local privacy laws)

**Suggested Resolution**

1. **Export permission matrix:**
   ```
   | Data | Admin | Editor | Viewer |
   |------|-------|--------|--------|
   | Full P&L (with staff cost detail) | Y | Y | N |
   | P&L summary (by department) | Y | Y | Y |
   | Staff Costs (individual level) | Y | Y | N |
   | Staff Costs (aggregated by dept) | Y | Y | Y |
   | Enrollment (by nationality/tariff) | Y | Y | Y |
   | Enrollment (student-level) | Y | Y | N |
   ```

2. **Export function filtering:**
   ```
   FUNCTION export_staff_costs_to_excel(version, user):
       IF user.role == "Viewer":
           FILTER staff_costs to department-level aggregation only
           EXCLUDE individual employee records
       ELSE:
           Include full detail
   ```

3. **Audit log for exports:**
   - Log every export with: user, data_type, rows_exported, timestamp, file_hash
   - Example: "Viewer [user] exported P&L summary (12 rows) at 14:30"

4. **Masking sensitive fields:**
   - For Viewer exports, mask salary values if present: "XXXX" instead of "47,250"
   - Keep structure intact (so Viewer sees columns but not values)

**Severity:** Medium

**Affected Components:** Security, RBAC, Export, Data Privacy

---

### SA-034: SSO Token Expiration During Long Recalculation

**Edge Case Description**

Application uses SSO for authentication. PRD specifies < 3 second recalculation, but complex scenarios can take 5-10 seconds.

Timeline:
1. User logs in via SSO (session token expires in 30 minutes)
2. User initiates large scenario comparison report (5 second calculation)
3. At 4 seconds, SSO token expires (due to inactivity timeout or scheduled expiration)
4. User's session is no longer valid
5. Application attempts to write recalculation results to database but user is unauthorized (token expired)
6. Result: Calculation completes but cannot be saved; user sees error and loses work

**Technical Risk**

- User loses recalculation results (work loss)
- Unclear error message: "Unauthorized" (user doesn't understand why)
- Frustration and distrust of application

**Suggested Resolution**

1. **Token refresh during long operations:**
   - Before starting long recalculation (>2s), check token expiration
   - If token expires within next 10 seconds, proactively refresh token
   - Example: `Token expires at 14:35. Calculation will finish at 14:34:58. Refresh token now.`

2. **Background task tokens:**
   - For long-running calculations, use service-account token (not user token) to write results
   - User token is only needed for initiating calculation
   - Service account completes calculation and saves results independently

3. **Extend token during calculation:**
   - Each time a recalculation step completes, check token expiration
   - If expiration is within 5 minutes, request token refresh via silent refresh mechanism (OAuth2 refresh token)
   - User sees no interruption

4. **UI affordance:**
   - Show token expiration countdown during long calculations: "Token expires in 2 min. Click to refresh." (preventive)
   - If token expires during calculation, show: "Your session expired. Calculation completed but not saved. Refresh and try again?"

**Severity:** Medium

**Affected Components:** Security (SSO), Performance, User Experience

---

### SA-035: Sensitive Data in Undo/Redo Stack

**Edge Case Description**

Application supports "Undo/Redo" for up to 20 actions (FR-INP). Undo stack stores previous values:

```
undo_stack = [
    { action: "Edit Enrollment", old_value: 250, new_value: 265, timestamp: ... },
    { action: "Edit Salary", old_value: 47250, new_value: 48800, timestamp: ... },
    ...
]
```

Security issue:
1. User edits employee salary (sensitive data)
2. User's session remains active (logged in)
3. If user walks away without logging out, another person can access their computer
4. New person opens application and sees Undo history: "Salary change: 47,250 → 48,800"
5. Sensitive salary data is exposed

Or:
1. Application crashes and attempts to recover by re-loading undo stack from memory
2. If memory dump is captured (for debugging), undo stack is exposed

**Technical Risk**

- Undo stack exposes sensitive data (salary, personal info) if session is left unattended
- Data exposure in memory dumps (debugging/forensics)
- GDPR violation if PII in undo stack is recovered

**Suggested Resolution**

1. **Don't store full values in undo stack:**
   - Instead of storing: `{ old_value: 47250, new_value: 48800 }`
   - Store: `{ operation: "edit_field", field_id: 3, version: 5 }` (pointers to data, not data itself)
   - On undo, re-fetch values from versioned database

2. **Encrypt undo stack in memory:**
   - Undo/redo entries encrypted with session key
   - If memory is dumped, encrypted data is useless without session key

3. **Clear undo stack on logout:**
   - When user logs out, clear undo/redo stack
   - Implement IdleTimeout: if session idle > 5 minutes, clear stack and force logout

4. **Masking for undo preview:**
   - When displaying undo action to user, mask sensitive values: "Salary changed to XXXX"
   - Store full values only for actual undo execution

5. **Audit trail for undo operations:**
   - Log when undo/redo is used: "User [X] undid action [Y] at [time]"
   - Helps detect suspicious undo activity

**Severity:** Medium

**Affected Components:** Security, Data Privacy, Undo/Redo, Session Management

---

## Conclusion & Implementation Recommendations

### Critical Path Mitigations (Must Before Go-Live)

1. **SA-001:** Implement fixed-point decimal arithmetic for all financial calculations
2. **SA-002:** Implement and test YEARFRAC for EoS calculation; validate against Excel baseline
3. **SA-021:** Implement data cleansing and validation for Excel migration; block migration on critical data quality issues
4. **SA-025:** Implement batch audit logging with parent_id for cascade change tracking
5. **SA-031:** Implement version locking enforcement with RBAC validation
6. **SA-032:** Implement immutable audit log with hash chain integrity checking

### High-Priority Before First Close (Month 1-3)

1. **SA-003 through SA-009:** Create comprehensive calculation regression tests for all 35+ edge cases
2. **SA-010 through SA-014:** Implement cascade delete with audit trail; enforce foreign keys
3. **SA-015 through SA-017:** Implement optimistic locking and context versioning
4. **SA-018 through SA-020:** Implement incremental calculation, memoization, and audit indexing
5. **SA-028 through SA-030:** Test export with Arabic text, formulas, currency symbols

### Recommended for Hardening (Roadmap)

1. **SA-022 through SA-024:** Improve encoding handling and override migration
2. **SA-026 through SA-027:** Refine audit aggregation for cascade logging
3. **SA-033 through SA-035:** Implement fine-grained RBAC export controls and secure undo

### Testing Strategy

- **Automated regression tests:** For every calculation (SA-001 through SA-009), create Excel baseline comparison tests; run nightly
- **Data migration validation:** For SA-021 through SA-024, create comprehensive data quality checks; block migration if critical issues found
- **Load testing:** For SA-018 through SA-020, test with 1,500 students × 50 combinations × 3 scenarios; measure performance and memory
- **Concurrency testing:** For SA-015 through SA-017, simulate concurrent edits and version operations; verify no data loss
- **Security testing:** For SA-031 through SA-035, test RBAC enforcement, token expiration, audit integrity

### Measurement Framework

Track success against these metrics:

| Metric | Target | Success Criteria |
|--------|--------|-----------------|
| Calculation Accuracy | ±0 SAR vs. Excel | 100% of revenue and cost line items match Excel within ±1 SAR |
| Data Integrity | Zero orphan records | Monthly audit: 0 broken foreign keys, 0 orphan records |
| Performance | <3s recalculation | 95th percentile recalculation time < 3s for typical scenario |
| Audit Trail Quality | Complete coverage | 100% of user-initiated changes logged; batch operations have parent_id |
| RBAC Enforcement | No privilege escalation | 0 unauthorized access attempts; RBAC matrix validated in UAT |
| Export Quality | No corrupted exports | 100% of exports valid and importable; no encoding/formula errors |

---

**End of Edge Case Analysis**

*For questions or clarifications, contact the Solutions Architect.*

