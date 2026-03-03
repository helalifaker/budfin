# Data Migration Enhancements

> Supplements PRD Section 13 (Data Migration Strategy) with detailed operational
> procedures for data cleansing, rollback, transformation, parallel-run validation,
> error handling, and historical data scoping.

---

## 1. Data Cleansing Strategy (G-043)

### 1.1 Pre-Migration Audit Procedure

Before any data is migrated, all four Excel workbooks and five enrollment CSVs must
undergo a systematic quality audit. The audit produces a **Source Data Quality Report**
that serves as the authoritative record of all issues found and their dispositions.

**Audit Scope:**

| Source File | Sheets to Audit | Record Count |
| --- | --- | --- |
| 01_EFIR_Revenue_FY2026_v3.xlsx | 12 sheets | ~694 input cells, 45+ fee combinations |
| 02_EFIR_DHG_FY2026_v1.xlsx | 9 sheets | Curriculum grilles, FTE parameters |
| EFIR_Staff_Costs_Budget_FY2026_V3.xlsx | 8 sheets | 168 employee records x 18 fields |
| EFIR_Consolidated_Monthly_Budget_FY2026.xlsx | 2 sheets | IFRS mapping + Income Statement |
| enrollment_2021-22.csv through enrollment_2025-26.csv | 5 files | Grade-level headcounts x 5 years |

### 1.2 Error Categories

Each cell or record flagged during the audit is classified into one of the following
error categories:

| Category | Code | Description | Examples |
| --- | --- | --- | --- |
| Formula Error | FE | Excel formula returns an error value | `#REF!`, `#N/A`, `#VALUE!`, `#DIV/0!`, `#NAME?`, `#NULL!` |
| Circular Reference | CR | Cell participates in a circular dependency chain | A1 references B1 which references A1 |
| Hardcoded Override | HO | A literal value exists where a formula is expected | Fee cell contains `45000` instead of `=FEE_GRID!B12` |
| Type Mismatch | TM | Cell contains text where a number is expected, or vice versa | Grade enrollment stored as text `"25"` instead of number `25` |
| Format Inconsistency | FI | Data formatting varies within a column or across related cells | Mixed date formats (DD/MM/YYYY and MM/DD/YYYY) in the same column |
| Missing Value | MV | Required cell is blank or contains only whitespace | Employee joining_date is empty |
| Out-of-Range Value | OR | Value falls outside expected domain boundaries | Discount percentage > 100%, negative enrollment count |
| Encoding Issue | EI | Character encoding problems in CSV files | Malformed UTF-8 in names with accents (e.g., French diacritics) |

### 1.3 Decision Framework

For every flagged issue, the migration team applies this three-option decision
framework. The chosen disposition is recorded in the Source Data Quality Report
alongside the issue details.

**Option A -- Fix in Source Before Migration**

- **When to use:** The error is clearly a mistake in the original workbook that the
  Finance team confirms should be corrected, AND the correction does not change any
  approved budget figures.
- **Process:** Finance team corrects the source workbook. The corrected file is
  re-versioned (e.g., v3 becomes v3.1). The audit re-runs on the corrected file to
  confirm the fix.
- **Example:** A `#NAME?` error caused by a typo in a function name that produces no
  downstream impact on totals.

**Option B -- Flag and Exclude from Validation Baseline**

- **When to use:** The error exists in the source but does not affect the data being
  migrated (e.g., it is on a summary sheet or presentation-only cell), AND fixing it
  would change approved numbers or require re-approval.
- **Process:** The cell is documented as a known issue. The validation baseline
  explicitly excludes this cell from reconciliation checks. The Source Data Quality
  Report records the cell reference, error type, and justification for exclusion.
- **Example:** The `#REF!` error on the Executive Summary sheet (noted in PRD
  Section 2.1) -- this is a display-layer issue that does not affect underlying
  data sheets.

**Option C -- Correct in Target System with Documentation**

- **When to use:** The source data is technically incorrect or inconsistent, but the
  correct value can be determined from context, AND the Finance team approves the
  corrected value for use in BudFin.
- **Process:** The migration script applies the correction during import. A migration
  log entry records: original value, corrected value, correction rule applied, and
  approver. The corrected value becomes the BudFin baseline. The audit trail captures
  this as a "Migration Correction" event.
- **Example:** An employee nationality stored as free text "Saudi" in some rows and
  "KSA" in others -- both are mapped to the `SAUDI` enum value, with the mapping
  documented.

### 1.4 Known Issues Register

The following issues have already been identified during PRD analysis and must be
addressed during the cleansing phase:

| # | Source | Location | Issue | Category | Recommended Disposition |
| --- | --- | --- | --- | --- | --- |
| KI-001 | 01_EFIR_Revenue_FY2026_v3.xlsx | EXECUTIVE_SUMMARY sheet | `#REF!` error in summary cell | FE | Option B -- exclude from validation baseline |
| KI-002 | All workbooks | File naming | Inconsistent version suffixes (v1, v3, V3) | FI | Option C -- normalize to v1.0 in import metadata |
| KI-003 | enrollment CSVs | All files | French diacritics in level names (e.g., "6ème") | EI | Option C -- map to ASCII enum values (e.g., `6eme`) |
| KI-004 | EFIR_Staff_Costs_Budget_FY2026_V3.xlsx | Staff Master Data | Potential hardcoded values in salary cells | HO | Audit required -- apply Option A or C based on findings |

### 1.5 Source Data Quality Report Template

The report must contain, at minimum:

1. **Audit metadata:** Date, auditor, source file version, tool used
2. **Summary statistics:** Total cells scanned, total issues found, issues by category
3. **Issue detail table:** Row per issue with: cell reference, sheet, category code,
   description, severity, recommended disposition, approver, resolution status
4. **Sign-off section:** Finance Manager and Technical Lead must both sign off before
   migration proceeds

---

## 2. Rollback Plan (G-044)

### 2.1 Pre-Migration Backup

| Backup Item | Method | Retention | Storage |
| --- | --- | --- | --- |
| Database (full) | pg_dump or equivalent full database export | 90 days minimum | Encrypted off-site backup + local copy |
| Source Excel workbooks | Bit-for-bit copy of all 4 workbooks | Permanent (project archive) | Version-controlled repository or secure file store |
| Source CSV files | Bit-for-bit copy of all 5 CSVs | Permanent (project archive) | Version-controlled repository or secure file store |
| Application configuration | Export of all system settings, enums, master data | 90 days minimum | Alongside database backup |
| Migration scripts | Tagged release of all migration code | Permanent | Source control (tagged commit) |

**Backup verification:** After each backup, perform a checksum validation (SHA-256) and
a test restore to a disposable environment to confirm backup integrity.

### 2.2 Staging-First Approach

Migration follows a mandatory two-environment execution model:

```
Step 1: Execute full migration on STAGING environment
Step 2: Run complete validation protocol (Section 5) on STAGING
Step 3: Finance team reviews and signs off STAGING results
Step 4: Only after STAGING sign-off, execute migration on PRODUCTION
Step 5: Run complete validation protocol on PRODUCTION
Step 6: Finance team confirms PRODUCTION results
```

**Gate rule:** Production migration MUST NOT begin until staging validation achieves
a PASS status on all six validation protocol steps (see Section 5).

### 2.3 Rollback Window and Procedure

| Parameter | Value |
| --- | --- |
| Maximum rollback window | 2 hours from migration start |
| Rollback decision authority | Finance Manager + Technical Lead (either can trigger) |
| Rollback trigger conditions | Any Blocker-severity validation failure; or Finance Manager determines data is unacceptable |

**Rollback Procedure:**

1. **STOP** all migration processes immediately.
2. **NOTIFY** all stakeholders (Finance team, Technical Lead, Project Manager) via
   the agreed communication channel.
3. **RESTORE** the database from the pre-migration backup. Verify restoration via
   checksum comparison and spot-check of 10 representative records.
4. **VERIFY** that the application is functional and serving pre-migration data
   correctly. Run a smoke test of each module (Enrollment, Revenue, Staffing, P&L).
5. **DOCUMENT** the rollback event: timestamp, trigger condition, who authorized,
   restoration verification results.
6. **INVESTIGATE** root cause of the migration failure. Document findings in an
   incident report.
7. **RE-PLAN** the migration with fixes applied. A new staging-first cycle is required
   before the next production attempt.

### 2.4 Fallback Procedure

If migration cannot be successfully completed within the Phase 6 timeline (3 weeks),
the following fallback applies:

- The Finance team continues operating with the existing Excel workbooks as the
  primary budgeting tool.
- BudFin deployment is delayed until migration issues are resolved.
- No partial migration is acceptable -- either all four workbooks and enrollment data
  are fully migrated and validated, or the system operates without migrated data.
- The Technical Lead produces a remediation plan with a revised migration timeline
  within 5 business days of the fallback decision.
- BudFin may be used in parallel as a "read-only preview" if the data loaded during
  the failed attempt is directionally correct (Finance Manager discretion), but it
  is NOT the system of record until full migration and validation are complete.

---

## 3. Data Transformation Rules (G-045)

### 3.1 Level Code Mapping

Enrollment CSVs and workbook sheets use varying text representations for grade levels.
All are mapped to a canonical `grade_level` enum during import.

| Source Variations | Target Enum | Display Label | Division |
| --- | --- | --- | --- |
| `PS`, `ps`, `Petite Section`, `petite_section` | `PS` | Petite Section | Maternelle |
| `MS`, `ms`, `Moyenne Section`, `moyenne_section` | `MS` | Moyenne Section | Maternelle |
| `GS`, `gs`, `Grande Section`, `grande_section` | `GS` | Grande Section | Maternelle |
| `CP`, `cp`, `Cours Préparatoire`, `cours_prep` | `CP` | CP | Élémentaire |
| `CE1`, `ce1`, `Cours Élémentaire 1` | `CE1` | CE1 | Élémentaire |
| `CE2`, `ce2`, `Cours Élémentaire 2` | `CE2` | CE2 | Élémentaire |
| `CM1`, `cm1`, `Cours Moyen 1` | `CM1` | CM1 | Élémentaire |
| `CM2`, `cm2`, `Cours Moyen 2` | `CM2` | CM2 | Élémentaire |
| `6eme`, `6ème`, `6e`, `Sixième` | `6EME` | 6ème | Collège |
| `5eme`, `5ème`, `5e`, `Cinquième` | `5EME` | 5ème | Collège |
| `4eme`, `4ème`, `4e`, `Quatrième` | `4EME` | 4ème | Collège |
| `3eme`, `3ème`, `3e`, `Troisième` | `3EME` | 3ème | Collège |
| `2nde`, `2NDE`, `Seconde`, `seconde` | `2NDE` | 2nde | Lycée |
| `1ere`, `1ère`, `1ERE`, `Première`, `premiere` | `1ERE` | 1ère | Lycée |
| `Tle`, `TLE`, `Terminale`, `terminale` | `TLE` | Terminale | Lycée |

**Unmapped values:** If a level code in the source does not match any known variation,
the migration script logs a Blocker-severity error and halts. The value must be added
to the mapping table and the migration re-run.

### 3.2 Date Format Transformations

| Source Format | Context | Transformation Rule |
| --- | --- | --- |
| Excel serial date (e.g., `46023`) | Joining dates, contract dates in Staff Costs | Convert via Excel epoch (1900-01-01, adjusting for the Lotus 1-2-3 leap year bug) to ISO 8601: `YYYY-MM-DD` |
| `DD/MM/YYYY` | Some manually entered dates in workbooks | Parse as day-first, convert to `YYYY-MM-DD` |
| `MM/DD/YYYY` | Possible in CSV files if opened/saved on US-locale systems | Detect via heuristic (day value > 12 disambiguates); if ambiguous, flag as Warning and default to `DD/MM/YYYY` interpretation (French locale convention) |
| `YYYY-MM-DD` | Already ISO 8601 | Pass through unchanged |
| Empty/blank | Optional date fields (e.g., end_date for open-ended contracts) | Store as `NULL` in the database |

**Validation:** After transformation, all dates must satisfy:
- Year is within `[2000, 2030]` (reasonable range for this dataset)
- Month is within `[1, 12]`
- Day is valid for the given month and year
- Any date failing these checks raises a Warning-severity error

### 3.3 Currency Rounding Rules

| Rule | Specification |
| --- | --- |
| Currency | Saudi Riyal (SAR) |
| Precision | 2 decimal places |
| Rounding method | Banker's rounding (round half to even) to match financial convention |
| Application point | All monetary values are rounded at the point of import into the database |
| Tolerance | Rounding differences of up to 0.01 SAR per value are acceptable and do not constitute validation failures |
| Annual totals | Rounded monthly values are summed; the annual total is NOT independently rounded from the source annual total. Any difference between the sum of rounded months and the source annual total is documented as a rounding variance. |

**Example:**
- Source monthly values: `14,583.333...` SAR x 12 months
- After rounding: `14,583.33` SAR x 12 = `174,999.96` SAR
- Source annual total: `175,000.00` SAR
- Rounding variance: `0.04` SAR -- documented, not a validation failure

### 3.4 Employee Status Inference

Employee records in the Staff Costs workbook do not carry an explicit status field.
Status is inferred during migration based on the joining date relative to the fiscal
year:

| Condition | Inferred Status | Notes |
| --- | --- | --- |
| `joining_date` < fiscal year start (2026-01-01) | `EXISTING` | Employee was on payroll before FY2026 |
| `joining_date` >= fiscal year start (2026-01-01) | `NEW` | Employee joined during FY2026 |
| `joining_date` is NULL or blank | `EXISTING` | Default assumption; logged as Info-severity note |
| `end_date` is present AND `end_date` <= current date | `DEPARTED` | Employee has left; retained for historical records |

**Step-change handling:** Employees with status `NEW` who have a `joining_date` after
the academic year break (September 1) trigger the September step-change logic in the
monthly cost budget. The migration script sets the `step_change_month` field to the
month of `joining_date`.

### 3.5 Nationality Mapping

Free-text nationality values in the source data are mapped to a controlled enum:

| Source Variations | Target Enum | Nationality Group |
| --- | --- | --- |
| `Saudi`, `KSA`, `Saudi Arabian`, `سعودي` | `SAUDI` | Saudi |
| `French`, `FRA`, `France`, `français` | `FRENCH` | Non-Saudi |
| `Tunisian`, `TUN`, `Tunisia` | `TUNISIAN` | Non-Saudi |
| `Moroccan`, `MAR`, `Morocco` | `MOROCCAN` | Non-Saudi |
| `Lebanese`, `LBN`, `Lebanon` | `LEBANESE` | Non-Saudi |
| `Algerian`, `DZA`, `Algeria` | `ALGERIAN` | Non-Saudi |
| *(other nationalities)* | Mapped on a case-by-case basis | Non-Saudi |

**Unmapped values:** If a nationality string does not match any known variation, the
migration script logs a Warning-severity error. The record is imported with
`nationality = NULL` and a manual review task is created.

**Nationality group:** For fee-grid and discount purposes, all nationalities map to one
of three groups: `FRENCH`, `SAUDI`, or `OTHER`. This grouping is stored as a separate
`nationality_group` field derived from the `nationality` enum.

### 3.6 Percentage Storage

| Rule | Specification |
| --- | --- |
| Source representation | Percentages in Excel are stored as either display values (e.g., `11.75`) or decimal fractions (e.g., `0.1175`) depending on cell formatting |
| Target representation | All percentages are stored as decimal fractions in the database (e.g., `11.75%` is stored as `0.1175`) |
| Detection heuristic | If the source value is > 1.0 AND the column is known to contain percentages, divide by 100 before storing |
| Known percentage fields | GOSI rate, Ajeer rate, discount rates, VAT rate, exam pass rates, enrollment growth percentages |
| Validation | After conversion, all percentage values must be within `[0.0, 1.0]` unless explicitly documented as a valid exception (no known exceptions in the current dataset) |

---

## 4. Parallel-Run Specification (G-046)

### 4.1 Overview

The parallel run is a controlled validation period during which the Finance team
operates in both systems simultaneously. Its purpose is to confirm that BudFin
produces results identical to the Excel workbooks under real operating conditions.

| Parameter | Value |
| --- | --- |
| Duration | 2 weeks during Phase 6 |
| Timing | Aligned with a month-end close cycle |
| Participants | Finance Manager, Budget Analyst, Technical Lead |
| Primary system of record | Excel (until parallel run passes) |

### 4.2 Process

**Week 1: Setup and First Pass**

1. Finance team performs the month-end close process in Excel as usual.
2. Finance team enters the same data into BudFin (enrollment updates, assumption
   changes, manual adjustments).
3. At the end of Week 1, both systems produce month-end reports.
4. The automated comparison tool runs and generates the variance report.

**Week 2: Second Pass and Resolution**

5. Any variances identified in Week 1 are investigated and root-caused.
6. Fixes are applied to BudFin (code fixes, configuration corrections, or data
   corrections as appropriate).
7. The Finance team repeats the close process for any corrected areas.
8. The final comparison report is generated.
9. Pass/fail determination is made.

### 4.3 Comparison Method

An automated comparison report is generated that performs line-by-line comparison
between BudFin outputs and Excel outputs:

| Comparison Area | BudFin Source | Excel Source | Comparison Granularity |
| --- | --- | --- | --- |
| Enrollment headcount | Enrollment module, by grade, by month | ENROLLMENT_HEADCOUNT sheet | Per grade, per academic year period |
| Revenue | Revenue module, by IFRS category, by month | REVENUE_ENGINE sheet | Per line item, per month |
| Staff costs | Staff Costs module, by employee, by month | FY2026 Monthly Budget sheet | Per employee, per month, per cost component |
| EoS provisions | EoS module, per employee | End of Service sheet | Per employee, opening/closing balance |
| GOSI/Ajeer | Statutory costs module, per employee | GOSI and Ajeer Costs sheets | Per employee, per month |
| P&L totals | P&L module, by IFRS line item, by month | IFRS Income Statement sheet | Per IFRS line item, per month |

### 4.4 Tolerance

| Metric | Tolerance |
| --- | --- |
| Revenue per line item per month | +/- 1 SAR |
| Staff cost per employee per month | +/- 1 SAR |
| EoS provision per employee | +/- 1 SAR |
| GOSI/Ajeer per employee per month | +/- 1 SAR |
| P&L total per IFRS line item per month | +/- 1 SAR |
| Enrollment headcount per grade | Exact match (0 tolerance) |

The 1 SAR tolerance accounts for legitimate rounding differences between Excel's
floating-point arithmetic and BudFin's decimal-precision calculations.

### 4.5 Pass/Fail Criteria

**PASS -- All of the following must be true:**

- 100% of revenue line items are within tolerance for every month
- 100% of staff cost line items are within tolerance for every employee for every month
- 100% of EoS provisions are within tolerance for every employee
- 100% of GOSI and Ajeer calculations are within tolerance
- P&L totals at every IFRS line-item level are within tolerance for every month
- Enrollment headcounts match exactly for all grades and periods
- No unresolved Blocker-severity issues remain open

**FAIL -- Any of the following triggers a fail:**

- Any single revenue line item exceeds tolerance in any month
- Any single employee cost exceeds tolerance in any month
- Any enrollment headcount discrepancy exists
- Any P&L total exceeds tolerance at any line-item level
- Any unresolved Blocker-severity issue exists

### 4.6 Fail Handling

If the parallel run fails:

1. **Document** every variance in the comparison report with: BudFin value, Excel
   value, difference, affected module, affected time period.
2. **Trace** each variance to its root cause. Classify as: calculation logic error,
   data transformation error, configuration error, or source data discrepancy.
3. **Fix** the root cause. Each fix must be reviewed by the Technical Lead and tested
   in the staging environment before deploying to the parallel-run environment.
4. **Re-run** the comparison for all affected areas (not just the fixed items, to
   guard against regression).
5. **Extend** the parallel run by up to 1 additional week if needed. If the parallel
   run cannot pass within 3 weeks total, escalate to the Fallback Procedure
   (Section 2.4).

---

## 5. Validation Error Handling (G-047)

### 5.1 Validation Protocol Steps -- Pass/Fail Definitions

The six validation steps defined in PRD Section 13.3 are expanded below with explicit
pass/fail criteria.

**Step 1: Enrollment Reconciliation**

> *Reconcile total enrollment counts per grade and per year against CSV source data.*

| Criterion | Definition |
| --- | --- |
| PASS | Every grade-level headcount for every academic year (2021-22 through 2025-26) in BudFin exactly matches the corresponding CSV value. Zero discrepancies. |
| FAIL | Any single grade-year combination has a different headcount value. |
| Scope | 15 grades x 5 years = 75 data points minimum |

**Step 2: Fee Grid Verification**

> *Verify fee grid values match source workbook for all 45+ combinations.*

| Criterion | Definition |
| --- | --- |
| PASS | Every fee value in BudFin for every combination of nationality (3) x grade (15) x tariff (3) matches the FEE_GRID sheet value within 0.01 SAR. Both AY1 and AY2 fee grids are verified. |
| FAIL | Any single fee combination differs by more than 0.01 SAR. |
| Scope | 3 nationalities x 15 grades x 3 tariffs x 2 academic year periods = 270 data points |

**Step 3: Revenue Engine Reconciliation**

> *Confirm revenue engine output matches REVENUE_ENGINE sheet totals (annual and monthly) within 1 SAR tolerance.*

| Criterion | Definition |
| --- | --- |
| PASS | Every IFRS revenue category total in BudFin matches the REVENUE_ENGINE sheet for every month AND the annual total, within +/- 1 SAR per line item per month. |
| FAIL | Any single line item in any month exceeds 1 SAR variance. |
| Scope | All revenue line items x 12 months + annual totals |

**Step 4: Employee Record Validation**

> *Validate all 168 employee records imported with correct salary components.*

| Criterion | Definition |
| --- | --- |
| PASS | All 168 employee records exist in BudFin. For each employee: name, nationality, department, grade, joining date, base salary, housing allowance, transportation allowance, and all other salary components match the source workbook within 0.01 SAR for monetary values and exact match for text/date fields. |
| FAIL | Any missing employee record, OR any field mismatch beyond tolerance. |
| Scope | 168 employees x 18 fields = 3,024 data points |

**Step 5: End of Service Reconciliation**

> *Confirm EoS provisions match source for each employee within 1 SAR tolerance.*

| Criterion | Definition |
| --- | --- |
| PASS | For every employee, the EoS opening balance, monthly provision, and closing balance in BudFin match the End of Service sheet within +/- 1 SAR per employee. |
| FAIL | Any single employee EoS value exceeds 1 SAR variance. |
| Scope | 168 employees x 3 EoS values = 504 data points |

**Step 6: P&L Reconciliation**

> *Verify consolidated P&L matches IFRS Income Statement totals.*

| Criterion | Definition |
| --- | --- |
| PASS | Every IFRS Income Statement line item in BudFin matches the IFRS Income Statement sheet for every month AND the annual total, within +/- 1 SAR per line item per month. This includes Revenue, Operating Expenses, Finance Costs, and Zakat totals. |
| FAIL | Any single line item in any month exceeds 1 SAR variance. |
| Scope | All IFRS line items x 12 months + annual totals |

### 5.2 Error Severity Levels

| Severity | Label | Definition | Impact on Migration |
| --- | --- | --- | --- |
| S1 | **Blocker** | Data integrity is compromised; migrated data would be incorrect or incomplete | Migration STOPS. Must be resolved before migration can proceed. |
| S2 | **Warning** | Data is importable but has a quality concern that should be reviewed | Migration proceeds. Issue is documented in the Source Data Quality Report. Finance team must review and approve within 5 business days post-migration. |
| S3 | **Info** | Minor note; no data quality impact | Migration proceeds. Issue is logged for reference only. |

**Examples by severity:**

| Severity | Example |
| --- | --- |
| S1 Blocker | Fee grid value mismatch > 1 SAR; missing employee record; unmapped grade level code |
| S2 Warning | Ambiguous date format requiring locale assumption; nationality text not in mapping table; minor rounding variance in a non-critical summary cell |
| S3 Info | Trailing whitespace in a text field (auto-trimmed); empty optional field defaulting to system default |

### 5.3 Error Resolution Workflow

```
┌─────────────────┐
│  Error Detected  │
│  by Migration    │
│  Script          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Classify by     │
│  Severity        │
│  (S1/S2/S3)      │
└────────┬────────┘
         │
    ┌────┴────────────────┐
    │                     │
    ▼                     ▼
┌─────────┐         ┌──────────┐
│ S1      │         │ S2 / S3  │
│ Blocker │         │ Warning  │
│         │         │ or Info  │
└────┬────┘         └────┬─────┘
     │                   │
     ▼                   ▼
┌──────────────┐   ┌──────────────┐
│ HALT         │   │ LOG error    │
│ migration    │   │ Continue     │
│ Log error    │   │ migration    │
└────┬─────────┘   └────┬─────────┘
     │                   │
     ▼                   ▼
┌──────────────┐   ┌──────────────┐
│ Technical    │   │ Post-migration│
│ Lead         │   │ review by     │
│ investigates │   │ Finance team  │
└────┬─────────┘   └──────────────┘
     │
     ▼
┌──────────────┐
│ Fix applied  │
│ and reviewed │
│ by Tech Lead │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Finance Mgr  │
│ approves fix │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Re-run       │
│ migration    │
│ from start   │
└──────────────┘
```

**Roles and Responsibilities:**

| Role | Responsibility |
| --- | --- |
| Migration Script | Detects and classifies errors automatically based on predefined rules |
| Technical Lead | Investigates all S1 Blockers; proposes fixes; reviews all code changes |
| Finance Manager | Approves all S1 fixes before re-run; reviews S2 Warnings post-migration; has final authority on data correctness |
| Budget Analyst | Assists Finance Manager with data verification; provides domain knowledge for edge cases |
| Project Manager | Tracks error resolution progress; escalates if resolution exceeds 2 business days per Blocker |

### 5.4 Error Documentation

Every error, regardless of severity, is recorded in a structured migration log with
the following fields:

| Field | Description |
| --- | --- |
| `error_id` | Auto-generated unique identifier (e.g., `MIG-E-001`) |
| `timestamp` | When the error was detected (ISO 8601) |
| `severity` | S1, S2, or S3 |
| `validation_step` | Which of the 6 validation steps detected it (1-6) |
| `source_file` | Which source file the error relates to |
| `source_location` | Sheet name, cell reference, or record identifier |
| `description` | Human-readable description of the error |
| `expected_value` | What the migration expected |
| `actual_value` | What was found in the source |
| `resolution` | How the error was resolved (or "pending") |
| `resolved_by` | Who resolved it |
| `approved_by` | Who approved the resolution (for S1 only) |

---

## 6. Historical Data Scope (G-048)

### 6.1 Data That IS Imported

| Data Set | Source | Import Mode | Purpose in BudFin |
| --- | --- | --- | --- |
| Enrollment headcounts (2021-22 through 2025-26) | 5 enrollment CSV files | Read-only historical reference | Trend analysis on Dashboard; historical context in Enrollment module; enrollment growth calculations |
| FY2026 budget -- Revenue | 01_EFIR_Revenue_FY2026_v3.xlsx | Initial Budget version (editable) | Baseline Budget version for Revenue module; fee grids, discounts, enrollment planning, revenue engine |
| FY2026 budget -- DHG Staffing | 02_EFIR_DHG_FY2026_v1.xlsx | Initial Budget version (editable) | Curriculum grilles, FTE parameters, DHG optimization data |
| FY2026 budget -- Staff Costs | EFIR_Staff_Costs_Budget_FY2026_V3.xlsx | Initial Budget version (editable) | 168 employee records, salary components, EoS, GOSI, Ajeer |
| FY2026 budget -- Consolidated P&L | EFIR_Consolidated_Monthly_Budget_FY2026.xlsx | Initial Budget version (editable) | IFRS mapping structure, Income Statement template |

### 6.2 Data That IS NOT Imported

| Data Set | Reason for Exclusion | Impact |
| --- | --- | --- |
| Prior fiscal year budgets (FY2025 and earlier) | Not available as structured source files; prior year data only exists in superseded Excel versions with unknown integrity | Year-over-year budget comparison is not available in v1. The YoY Comparison sheet in Staff Costs is imported as static reference data, not as a live prior-year budget. |
| Actuals data for FY2026 | Actuals originate from the accounting/ERP system, which is out of scope for v1 migration | Budget vs. Actual variance analysis requires manual entry of actuals or a future integration with the accounting system. The Version Management System supports an "Actual" version type but it will be empty at go-live. |
| Student-level detail | Enrollment data is grade-level aggregate only; no individual student records exist in the source CSVs | BudFin cannot drill down below grade-level enrollment counts. Per-student fee tracking is not supported. |
| Teacher-level timetable detail | DHG workbook contains aggregate hours by subject and level, not individual teacher schedules | BudFin calculates FTE at the subject/level level, not per-teacher. Individual teacher assignments are managed outside BudFin. |
| Non-FY2026 scenario outputs | The SCENARIOS sheet in the Revenue workbook contains scenario outputs for illustration only | BudFin's Scenario Modeling module starts fresh; historical scenario outputs are not imported. Users create new scenarios using BudFin's scenario engine. |
| Excel formatting and presentation | Charts, conditional formatting, cell colors, column widths, print areas | BudFin has its own UI; Excel visual formatting is not replicated. |

### 6.3 Limitations and Constraints

1. **Historical enrollment is read-only.** The five imported enrollment CSVs cannot be
   edited within BudFin. They serve as reference data only. If historical enrollment
   data needs correction, the source CSV must be corrected and re-imported.

2. **No historical comparison for budget data.** Because prior fiscal year budgets are
   not imported, BudFin cannot produce year-over-year budget comparison reports in v1.
   Historical comparison is limited to enrollment trend analysis.

3. **Single fiscal year scope.** BudFin v1 operates exclusively on FY2026 data. There
   is no multi-year budget planning or rolling forecast capability. Multi-year
   functionality is deferred to v2.

4. **No automated actuals feed.** Actual financial results must be entered manually
   into BudFin (or imported via a future integration). Until actuals are loaded, the
   Budget vs. Actual comparison features of the Version Management System are
   non-functional.

5. **Enrollment data granularity ceiling.** Enrollment is tracked at the
   grade x nationality x tariff level. There is no student-level or section-level
   granularity in the migrated data (though the Capacity Planning module does track
   section counts).

6. **One-time migration, not sync.** The migration is a one-time data load. After
   migration, the Excel workbooks and BudFin are independent. Changes made in Excel
   after migration are NOT reflected in BudFin and vice versa. The parallel-run period
   (Section 4) is the only window where both systems are maintained in sync.

---

## Appendix A: Migration Checklist

This checklist summarizes the end-to-end migration process for operational use:

- [ ] **A1.** Complete Source Data Quality Report for all 4 workbooks and 5 CSVs
- [ ] **A2.** Resolve all Blocker-severity issues found in the audit
- [ ] **A3.** Obtain Finance Manager sign-off on the Source Data Quality Report
- [ ] **A4.** Create pre-migration database backup (with checksum verification)
- [ ] **A5.** Archive source files (with checksum verification)
- [ ] **A6.** Tag migration scripts in source control
- [ ] **A7.** Execute migration on STAGING environment
- [ ] **A8.** Run all 6 validation steps on STAGING
- [ ] **A9.** Generate STAGING comparison report
- [ ] **A10.** Obtain Finance Manager sign-off on STAGING results
- [ ] **A11.** Execute migration on PRODUCTION environment
- [ ] **A12.** Run all 6 validation steps on PRODUCTION
- [ ] **A13.** Generate PRODUCTION comparison report
- [ ] **A14.** Obtain Finance Manager sign-off on PRODUCTION results
- [ ] **A15.** Begin 2-week parallel-run period
- [ ] **A16.** Generate Week 1 parallel-run comparison report
- [ ] **A17.** Resolve any variances found in Week 1
- [ ] **A18.** Generate final parallel-run comparison report
- [ ] **A19.** Obtain Finance Manager sign-off on parallel-run results
- [ ] **A20.** Declare BudFin as system of record (go-live)
