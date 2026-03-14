# Revenue Engine: Static-to-Dynamic Analysis

## Purpose

This document maps every "other revenue" item in the BudFin revenue engine from its current static implementation to a proposed dynamic formula driven by enrollment data. For each item it shows:

- **Before**: How it works today (manual input)
- **After**: The proposed dynamic formula
- **Data dependencies**: What inputs the formula needs and where they live
- **Missing data**: What doesn't exist yet in the system
- **Verification**: The expected output based on the FY2026 Excel workbook

---

## Reference Numbers (FY2026 Excel Workbook)

| Metric                            | Value                  |
| --------------------------------- | ---------------------- |
| AY1 Total Enrollment              | 1,753 students         |
| AY2 Total Enrollment              | 1,753 students         |
| AY1 Francais / Nationaux / Autres | 590 / 41 / 1,122       |
| AY2 Francais / Nationaux / Autres | 596 / 43 / 1,114       |
| Estimated New Students (Total)    | 312                    |
| New Students FR / NAT / AUT       | 106 / 8 / 198          |
| VAT Rate                          | 15% (Nationaux exempt) |
| Total Operating Revenue           | 68,156,191 SAR         |

---

## 1. DAI (Droit Annuel d'Inscription / Re-registration Fee)

### What It Is

An annual re-registration fee charged to **every student** enrolling for the next academic year (AY2). All students pay it, not just new ones. The fee varies by nationality because Nationaux are VAT-exempt.

### Before (Current: Static Input)

The user manually enters 3 line items in the "Other Revenue" settings:

| Line Item       | Amount (SAR)  | How It Was Computed                                |
| --------------- | ------------- | -------------------------------------------------- |
| DAI - Francais  | 2,980,000     | User calculated externally: 596 students x 5,000   |
| DAI - Nationaux | 187,050       | User calculated externally: 43 students x 4,350    |
| DAI - Autres    | 5,570,000     | User calculated externally: 1,114 students x 5,000 |
| **Total DAI**   | **8,737,050** |                                                    |

Distribution: SPECIFIC_PERIOD months [5, 6] (May-Jun, registration season).

Problems:

- If enrollment changes, the user must manually recalculate and re-enter
- No traceability of how the number was derived
- No link between enrollment planning and revenue

### After (Proposed: Dynamic)

**Formula per nationality:**

```text
DAI_by_nationality = SUM over all grades of (
    AY2_enrollment_detail[grade, nationality, all tariffs].headcount
    x fee_grid[AY2, grade, nationality, Plein].dai
)
```

Produces 3 line items: `DAI - Francais`, `DAI - Nationaux`, `DAI - Autres`

**Concrete example (Francais):**

| Grade     | AY2 Headcount (FR) | DAI Fee (TTC) | Subtotal      |
| --------- | ------------------ | ------------- | ------------- |
| PS        | 24                 | 5,000         | 120,000       |
| MS        | 28                 | 5,000         | 140,000       |
| GS        | 44                 | 5,000         | 220,000       |
| CP        | 43                 | 5,000         | 215,000       |
| CE1       | 41                 | 5,000         | 205,000       |
| CE2       | 46                 | 5,000         | 230,000       |
| CM1       | 42                 | 5,000         | 210,000       |
| CM2       | 42                 | 5,000         | 210,000       |
| 6EME      | 52                 | 5,000         | 260,000       |
| 5EME      | 47                 | 5,000         | 235,000       |
| 4EME      | 40                 | 5,000         | 200,000       |
| 3EME      | 33                 | 5,000         | 165,000       |
| 2NDE      | 41                 | 5,000         | 205,000       |
| 1ERE      | 38                 | 5,000         | 190,000       |
| TERM      | 35                 | 5,000         | 175,000       |
| **Total** | **596**            |               | **2,980,000** |

**VAT note**: The fee grid stores TTC values. For Francais/Autres, DAI = 5,000 TTC (HT = 4,347.83). For Nationaux, DAI = 4,350 TTC = HT (VAT exempt). The calculation uses TTC values directly because the school budgets registration revenue at the price families pay, matching how the Excel workbook computes it.

### Data Dependencies

| Data                                          | Source                                | Exists Today?                           |
| --------------------------------------------- | ------------------------------------- | --------------------------------------- |
| AY2 enrollment headcount by grade/nationality | `enrollment_details` table (AY2 rows) | YES                                     |
| DAI fee per grade/nationality                 | `fee_grids.dai` field                 | YES (stored but unused in calculations) |

### Missing Data

**None.** All required data already exists in the database. The `dai` field in `fee_grids` is populated but never consumed by the revenue engine. This change activates it.

### Verification

| Line Item       | Formula Output            | Excel Expected | Match?  |
| --------------- | ------------------------- | -------------- | ------- |
| DAI - Francais  | 596 x 5,000 = 2,980,000   | 2,980,000      | YES     |
| DAI - Nationaux | 43 x 4,350 = 187,050      | 187,050        | YES     |
| DAI - Autres    | 1,114 x 5,000 = 5,570,000 | 5,570,000      | YES     |
| **Total**       | **8,737,050**             | **8,737,050**  | **YES** |

---

## 2. DPI (Droit de Premiere Inscription / New Student Registration Fee)

### What It Is

A one-time registration fee charged only to **new students** enrolling for the first time. The HT rate is the same for all nationalities (2,000 SAR HT). The TTC differs: 2,300 for FR/AUT (with 15% VAT), 2,000 for NAT (exempt).

### Before (Current: Static Input)

| Line Item       | Amount (SAR) | How It Was Computed             |
| --------------- | ------------ | ------------------------------- |
| DPI - Francais  | 212,000      | 106 new FR students x 2,000 HT  |
| DPI - Nationaux | 16,000       | 8 new NAT students x 2,000 HT   |
| DPI - Autres    | 396,000      | 198 new AUT students x 2,000 HT |
| **Total DPI**   | **624,000**  |                                 |

Distribution: SPECIFIC_PERIOD months [5, 6].

Problems:

- "New student count by nationality" is manually entered — not derived from enrollment
- Changes to enrollment/retention don't flow through

### After (Proposed: Dynamic)

**Step 1 — Derive total new students per grade:**

```text
For PS (entry grade):
    new_students[PS] = AY2_headcount[PS]     (all PS students are new)

For all other grades (MS through TERM):
    prior_grade = grade that feeds into this one (e.g., PS feeds MS, MS feeds GS, etc.)
    retained[grade] = floor( AY1_headcount[prior_grade] x retention_rate[grade] )
    new_students[grade] = AY2_headcount[grade] - retained[grade]
```

**Step 2 — Split new students by nationality:**

```text
For each grade:
    total_new = new_students[grade]
    For each nationality (FR, NAT, AUT):
        ay2_nat_count = enrollment_detail[AY2, grade, nationality, all tariffs].headcount
        ay2_total = enrollment_headcount[AY2, grade]
        nationality_pct = ay2_nat_count / ay2_total
        new_by_nat[grade, nationality] = round(total_new x nationality_pct)

    // Rounding correction: adjust largest nationality to ensure sum = total_new
```

**Step 3 — Compute DPI per nationality:**

```text
DPI_francais  = SUM(new_by_nat[all grades, Francais]) x dpiPerStudentHt
DPI_nationaux = SUM(new_by_nat[all grades, Nationaux]) x dpiPerStudentHt
DPI_autres    = SUM(new_by_nat[all grades, Autres])    x dpiPerStudentHt
```

Where `dpiPerStudentHt = 2,000 SAR` (stored in Assumptions table).

**Note on the HT rate**: The HT rate (2,000 SAR) is the same for all nationalities. The TTC differs (2,300 FR/AUT vs 2,000 NAT) because of VAT, but since this is an HT-based P&L line, the amounts are equal per student. The nationality split matters for line-item reporting, not for the rate.

### Data Dependencies

| Data                          | Source                             | Exists Today?               |
| ----------------------------- | ---------------------------------- | --------------------------- |
| AY1 headcount per grade       | `enrollment_headcounts` (AY1 rows) | YES                         |
| AY2 headcount per grade       | `enrollment_headcounts` (AY2 rows) | YES                         |
| Retention rate per grade      | `cohort_parameters.retentionRate`  | YES                         |
| AY2 enrollment by nationality | `enrollment_details` (AY2 rows)    | YES                         |
| DPI rate per student (HT)     | Assumptions table                  | **NO — needs to be seeded** |

### Missing Data

| What                         | Proposed Solution                                                          |
| ---------------------------- | -------------------------------------------------------------------------- |
| `dpiPerStudentHt` assumption | Seed value: 2,000.0000 SAR in the `assumptions` table (section: "revenue") |

### Verification

|                 | New Students | x Rate  | = Amount    |
| --------------- | ------------ | ------- | ----------- |
| DPI - Francais  | 106          | x 2,000 | 212,000     |
| DPI - Nationaux | 8            | x 2,000 | 16,000      |
| DPI - Autres    | 198          | x 2,000 | 396,000     |
| **Total**       | **312**      |         | **624,000** |

---

## 3. Frais de Dossier (Application/Dossier Fee for New Students)

### What It Is

An application processing fee charged to **new students** only. Like DPI, the HT rate is uniform (1,000 SAR) across nationalities.

### Before (Current: Static Input)

| Line Item                    | Amount (SAR) | How It Was Computed    |
| ---------------------------- | ------------ | ---------------------- |
| Frais de Dossier - Francais  | 106,000      | 106 new FR x 1,000 HT  |
| Frais de Dossier - Nationaux | 8,000        | 8 new NAT x 1,000 HT   |
| Frais de Dossier - Autres    | 198,000      | 198 new AUT x 1,000 HT |
| **Total**                    | **312,000**  |                        |

Distribution: SPECIFIC_PERIOD months [5, 6].

### After (Proposed: Dynamic)

**Identical logic to DPI** — uses the same new-student-by-nationality derivation:

```text
Dossier_francais  = SUM(new_by_nat[all grades, Francais]) x dossierPerStudentHt
Dossier_nationaux = SUM(new_by_nat[all grades, Nationaux]) x dossierPerStudentHt
Dossier_autres    = SUM(new_by_nat[all grades, Autres])    x dossierPerStudentHt
```

Where `dossierPerStudentHt = 1,000 SAR` (stored in Assumptions table).

### Data Dependencies

Same as DPI (shares the new-student derivation), plus:

| Data                          | Source            | Exists Today?               |
| ----------------------------- | ----------------- | --------------------------- |
| Dossier rate per student (HT) | Assumptions table | **NO — needs to be seeded** |

### Missing Data

| What                             | Proposed Solution          |
| -------------------------------- | -------------------------- |
| `dossierPerStudentHt` assumption | Seed value: 1,000.0000 SAR |

### Verification

|                     | New Students | x Rate  | = Amount    |
| ------------------- | ------------ | ------- | ----------- |
| Dossier - Francais  | 106          | x 1,000 | 106,000     |
| Dossier - Nationaux | 8            | x 1,000 | 8,000       |
| Dossier - Autres    | 198          | x 1,000 | 198,000     |
| **Total**           | **312**      |         | **312,000** |

---

## 4. BAC Examination Fee

### What It Is

A French Baccalaureat exam fee charged to all students in Terminale (TERM grade) during AY1. The fee is set by AEFE zone rules.

### Before (Current: Static Input)

| Line Item | Amount (SAR) |
| --------- | ------------ |
| BAC       | 222,000      |

User calculated: 111 TERM students x 2,000 SAR/student. Distribution: SPECIFIC_PERIOD months [4, 5].

### After (Proposed: Dynamic)

```text
BAC_fee = enrollment_headcount[AY1, TERM] x examBacPerStudent
```

Where `examBacPerStudent = 2,000 SAR` (stored in Assumptions table).

### Data Dependencies

| Data               | Source                              | Exists Today?               |
| ------------------ | ----------------------------------- | --------------------------- |
| AY1 TERM headcount | `enrollment_headcounts` (AY1, TERM) | YES                         |
| BAC zone rate      | Assumptions table                   | **NO — needs to be seeded** |

### Missing Data

| What                           | Proposed Solution          |
| ------------------------------ | -------------------------- |
| `examBacPerStudent` assumption | Seed value: 2,000.0000 SAR |

### Verification

111 TERM students x 2,000 = **222,000 SAR** (matches Excel)

---

## 5. DNB Examination Fee (Diplome National du Brevet)

### What It Is

A middle school diploma exam fee for all 3EME students during AY1.

### Before (Current: Static Input)

| Line Item | Amount (SAR) |
| --------- | ------------ |
| DNB       | 61,800       |

User calculated: 103 students x 600 SAR. Distribution: SPECIFIC_PERIOD months [4, 5].

### After (Proposed: Dynamic)

```text
DNB_fee = enrollment_headcount[AY1, 3EME] x examDnbPerStudent
```

Where `examDnbPerStudent = 600 SAR`.

### Data Dependencies

| Data               | Source                              | Exists Today?               |
| ------------------ | ----------------------------------- | --------------------------- |
| AY1 3EME headcount | `enrollment_headcounts` (AY1, 3EME) | YES                         |
| DNB zone rate      | Assumptions table                   | **NO — needs to be seeded** |

### Missing Data

| What                           | Proposed Solution        |
| ------------------------------ | ------------------------ |
| `examDnbPerStudent` assumption | Seed value: 600.0000 SAR |

### Verification

103 x 600 = **61,800 SAR** (matches Excel)

---

## 6. EAF Examination Fee (Epreuves Anticipees du Francais)

### What It Is

French language anticipatory exam for all 1ERE students during AY1.

### Before (Current: Static Input)

| Line Item | Amount (SAR) |
| --------- | ------------ |
| EAF       | 96,000       |

User calculated: 120 students x 800 SAR. Distribution: SPECIFIC_PERIOD months [4, 5].

### After (Proposed: Dynamic)

```text
EAF_fee = enrollment_headcount[AY1, 1ERE] x examEafPerStudent
```

Where `examEafPerStudent = 800 SAR`.

### Data Dependencies

| Data               | Source                              | Exists Today?               |
| ------------------ | ----------------------------------- | --------------------------- |
| AY1 1ERE headcount | `enrollment_headcounts` (AY1, 1ERE) | YES                         |
| EAF zone rate      | Assumptions table                   | **NO — needs to be seeded** |

### Missing Data

| What                           | Proposed Solution        |
| ------------------------------ | ------------------------ |
| `examEafPerStudent` assumption | Seed value: 800.0000 SAR |

### Verification

120 x 800 = **96,000 SAR** (matches Excel)

---

## 7. Evaluation - Primaire (New Student Evaluation Tests)

### What It Is

An evaluation/placement test fee for new students entering Primaire grades (CP through CM2). Maternelle students (PS, MS, GS) do NOT take evaluation tests. The fee is per new student.

### Before (Current: Static Input)

| Line Item             | Amount (SAR) |
| --------------------- | ------------ |
| Evaluation - Primaire | 22,000       |

User calculated: 110 new primaire students x 200 SAR. Distribution: SPECIFIC_PERIOD months [10, 11].

### After (Proposed: Dynamic)

```text
new_primaire_students = SUM over grades CP, CE1, CE2, CM1, CM2 of (new_students[grade])
Eval_Primaire = new_primaire_students x evalPrimairePerStudent
```

Where `evalPrimairePerStudent = 200 SAR` and `new_students[grade]` uses the same derivation as DPI (see Section 2, Step 1).

### Data Dependencies

| Data                   | Source                                          | Exists Today?               |
| ---------------------- | ----------------------------------------------- | --------------------------- |
| New students per grade | Derived from AY1/AY2 headcounts + cohort params | YES (derivable)             |
| Eval Primaire rate     | Assumptions table                               | **NO — needs to be seeded** |

### Missing Data

| What                                | Proposed Solution        |
| ----------------------------------- | ------------------------ |
| `evalPrimairePerStudent` assumption | Seed value: 200.0000 SAR |

### Verification

110 new Primaire students x 200 = **22,000 SAR** (matches Excel)

---

## 8. Evaluation - College+Lycee (New Student Evaluation Tests)

### What It Is

Evaluation/placement test for new students entering College (6EME-3EME) or Lycee (2NDE-TERM). Higher fee than Primaire due to more complex testing.

### Before (Current: Static Input)

| Line Item                  | Amount (SAR) |
| -------------------------- | ------------ |
| Evaluation - College+Lycee | 46,500       |

User calculated: 155 new secondaire students x 300 SAR. Distribution: SPECIFIC_PERIOD months [10, 11].

### After (Proposed: Dynamic)

```text
new_secondaire_students = SUM over grades 6EME..TERM of (new_students[grade])
Eval_Secondaire = new_secondaire_students x evalSecondairePerStudent
```

Where `evalSecondairePerStudent = 300 SAR`.

### Data Dependencies

| Data                   | Source                                          | Exists Today?               |
| ---------------------- | ----------------------------------------------- | --------------------------- |
| New students per grade | Derived from AY1/AY2 headcounts + cohort params | YES (derivable)             |
| Eval Secondaire rate   | Assumptions table                               | **NO — needs to be seeded** |

### Missing Data

| What                                  | Proposed Solution        |
| ------------------------------------- | ------------------------ |
| `evalSecondairePerStudent` assumption | Seed value: 300.0000 SAR |

### Verification

155 new College+Lycee students x 300 = **46,500 SAR** (matches Excel)

---

## Items That Remain Static (No Formula Change Needed)

These items are NOT enrollment-driven. They are fixed contractual or policy amounts.

| Item                       | Amount (SAR) | Why Static                                                  | Distribution             |
| -------------------------- | ------------ | ----------------------------------------------------------- | ------------------------ |
| APS (After-School Program) | 1,230,000    | Fixed monthly program fee (123,000/mo x 10 academic months) | ACADEMIC_10              |
| Garderie (Daycare)         | 30,000       | Fixed monthly fee (3,000/mo x 10)                           | ACADEMIC_10              |
| Class Photos               | 52,800       | Annual contract with photographer                           | SPECIFIC_PERIOD [11, 12] |
| PSG Academy Rental         | 51,230       | Annual facility rental contract                             | YEAR_ROUND_12            |
| SIELE Exam                 | 15,000       | Fixed annual Spanish certification exam                     | SPECIFIC_PERIOD [10, 11] |
| Bourses AEFE               | -151,906     | Scholarship policy (AEFE-funded aid)                        | ACADEMIC_10              |
| Bourses AESH               | -177,600     | Scholarship policy (AESH-funded aid)                        | ACADEMIC_10              |

**Note on Bourses**: These are NEGATIVE amounts (scholarship deductions). They reduce total revenue. They remain manual because they are policy decisions from AEFE/AESH, not enrollment-derived.

---

## Summary: All Missing Data Points

The following items need to be added to the `assumptions` table before dynamic computation can work:

| #   | Assumption Key             | Value | Unit | Description                                                |
| --- | -------------------------- | ----- | ---- | ---------------------------------------------------------- |
| 1   | `dpiPerStudentHt`          | 2,000 | SAR  | DPI fee per new student (HT, uniform across nationalities) |
| 2   | `dossierPerStudentHt`      | 1,000 | SAR  | Application fee per new student (HT, uniform)              |
| 3   | `examBacPerStudent`        | 2,000 | SAR  | BAC exam zone rate per TERM student                        |
| 4   | `examDnbPerStudent`        | 600   | SAR  | DNB exam zone rate per 3EME student                        |
| 5   | `examEafPerStudent`        | 800   | SAR  | EAF exam zone rate per 1ERE student                        |
| 6   | `evalPrimairePerStudent`   | 200   | SAR  | Evaluation test fee per new Primaire student               |
| 7   | `evalSecondairePerStudent` | 300   | SAR  | Evaluation test fee per new College/Lycee student          |

Additionally, the `OtherRevenueItem` table needs a new field:

- `computeMethod` (nullable string) — marks which items are auto-computed vs manual

**No new tables are needed.** All enrollment data already exists. The DAI fee already exists in the fee grid.

---

## Computation Dependency Chain

```text
                    ENROLLMENT MODULE (must run first)
                              |
         +--------------------+--------------------+
         |                    |                    |
   AY1 Headcounts      AY2 Headcounts      Cohort Params
   (per grade)          (per grade)          (retention rates)
         |                    |                    |
         +--------------------+--------------------+
                              |
                    Derive New Students
                    (per grade, per nationality)
                              |
         +--------+-----------+----------+---------+
         |        |           |          |         |
       DAI      DPI       Dossier     Exams    Evals
    (all AY2)  (new only) (new only) (AY1 hd) (new only)
         |        |           |          |         |
         +--------+-----------+----------+---------+
                              |
                    OtherRevenueInput[]
                              |
                    Revenue Engine (unchanged)
                              |
                    Monthly Distribution
```

---

## Complete Before/After Revenue Summary

### Before: 21 Static Line Items (All Manual)

| #   | Line Item                    | Amount    | Category     |
| --- | ---------------------------- | --------- | ------------ |
| 1   | DAI - Francais               | 2,980,000 | Registration |
| 2   | DAI - Nationaux              | 187,050   | Registration |
| 3   | DAI - Autres                 | 5,570,000 | Registration |
| 4   | DPI - Francais               | 212,000   | Registration |
| 5   | DPI - Nationaux              | 16,000    | Registration |
| 6   | DPI - Autres                 | 396,000   | Registration |
| 7   | Frais de Dossier - Francais  | 106,000   | Registration |
| 8   | Frais de Dossier - Nationaux | 8,000     | Registration |
| 9   | Frais de Dossier - Autres    | 198,000   | Registration |
| 10  | Evaluation - Primaire        | 22,000    | Registration |
| 11  | Evaluation - College+Lycee   | 46,500    | Registration |
| 12  | BAC                          | 222,000   | Examination  |
| 13  | DNB                          | 61,800    | Examination  |
| 14  | EAF                          | 96,000    | Examination  |
| 15  | SIELE                        | 15,000    | Examination  |
| 16  | APS                          | 1,230,000 | Activities   |
| 17  | Garderie                     | 30,000    | Activities   |
| 18  | Class Photos                 | 52,800    | Activities   |
| 19  | PSG Academy Rental           | 51,230    | Activities   |
| 20  | Bourses AEFE                 | -151,906  | Other        |
| 21  | Bourses AESH                 | -177,600  | Other        |

**Total Other Revenue: 11,170,874 SAR** (of which 11,517,650 counts toward operating revenue)

### After: 14 Dynamic + 7 Static = 21 Line Items

| #   | Line Item                    | Type    | Formula                   | Amount    |
| --- | ---------------------------- | ------- | ------------------------- | --------- |
| 1   | DAI - Francais               | DYNAMIC | 596 AY2 FR x 5,000 dai    | 2,980,000 |
| 2   | DAI - Nationaux              | DYNAMIC | 43 AY2 NAT x 4,350 dai    | 187,050   |
| 3   | DAI - Autres                 | DYNAMIC | 1,114 AY2 AUT x 5,000 dai | 5,570,000 |
| 4   | DPI - Francais               | DYNAMIC | 106 new FR x 2,000 HT     | 212,000   |
| 5   | DPI - Nationaux              | DYNAMIC | 8 new NAT x 2,000 HT      | 16,000    |
| 6   | DPI - Autres                 | DYNAMIC | 198 new AUT x 2,000 HT    | 396,000   |
| 7   | Frais de Dossier - Francais  | DYNAMIC | 106 new FR x 1,000 HT     | 106,000   |
| 8   | Frais de Dossier - Nationaux | DYNAMIC | 8 new NAT x 1,000 HT      | 8,000     |
| 9   | Frais de Dossier - Autres    | DYNAMIC | 198 new AUT x 1,000 HT    | 198,000   |
| 10  | Evaluation - Primaire        | DYNAMIC | 110 new Prim x 200        | 22,000    |
| 11  | Evaluation - College+Lycee   | DYNAMIC | 155 new Sec x 300         | 46,500    |
| 12  | BAC                          | DYNAMIC | 111 TERM(AY1) x 2,000     | 222,000   |
| 13  | DNB                          | DYNAMIC | 103 3EME(AY1) x 600       | 61,800    |
| 14  | EAF                          | DYNAMIC | 120 1ERE(AY1) x 800       | 96,000    |
| 15  | SIELE                        | STATIC  | Fixed annual              | 15,000    |
| 16  | APS                          | STATIC  | Fixed monthly x 10        | 1,230,000 |
| 17  | Garderie                     | STATIC  | Fixed monthly x 10        | 30,000    |
| 18  | Class Photos                 | STATIC  | Fixed annual              | 52,800    |
| 19  | PSG Academy Rental           | STATIC  | Fixed annual              | 51,230    |
| 20  | Bourses AEFE                 | STATIC  | Policy                    | -151,906  |
| 21  | Bourses AESH                 | STATIC  | Policy                    | -177,600  |

**Total: Same 11,170,874 SAR** — amounts unchanged, but 14 of 21 items now auto-compute from enrollment.

### What Changes When Enrollment Changes

If a planner adds 50 more AY2 students (say 30 FR, 20 AUT), the following would AUTO-UPDATE on the next revenue calculation:

| Item                 | Old Amount                   | New Amount              | Delta    |
| -------------------- | ---------------------------- | ----------------------- | -------- |
| DAI - Francais       | 2,980,000                    | 3,130,000 (+30 x 5,000) | +150,000 |
| DAI - Autres         | 5,570,000                    | 5,670,000 (+20 x 5,000) | +100,000 |
| DPI, Dossier, Evals  | (depends on new vs retained) | auto-adjusted           | varies   |
| **All static items** | **unchanged**                | **unchanged**           | **0**    |

This is the key benefit: revenue projections update automatically with enrollment planning.

---

## Grade Progression Reference (for New Student Derivation)

```text
PS → MS → GS → CP → CE1 → CE2 → CM1 → CM2 → 6EME → 5EME → 4EME → 3EME → 2NDE → 1ERE → TERM
```

| Grade | Prior Grade    | Band        | Retention Source                            |
| ----- | -------------- | ----------- | ------------------------------------------- |
| PS    | (none — entry) | MATERNELLE  | All AY2 PS students are new                 |
| MS    | PS             | MATERNELLE  | retained = floor(AY1_PS x retention_MS)     |
| GS    | MS             | MATERNELLE  | retained = floor(AY1_MS x retention_GS)     |
| CP    | GS             | ELEMENTAIRE | retained = floor(AY1_GS x retention_CP)     |
| CE1   | CP             | ELEMENTAIRE | retained = floor(AY1_CP x retention_CE1)    |
| CE2   | CE1            | ELEMENTAIRE | retained = floor(AY1_CE1 x retention_CE2)   |
| CM1   | CE2            | ELEMENTAIRE | retained = floor(AY1_CE2 x retention_CM1)   |
| CM2   | CM1            | ELEMENTAIRE | retained = floor(AY1_CM1 x retention_CM2)   |
| 6EME  | CM2            | COLLEGE     | retained = floor(AY1_CM2 x retention_6EME)  |
| 5EME  | 6EME           | COLLEGE     | retained = floor(AY1_6EME x retention_5EME) |
| 4EME  | 5EME           | COLLEGE     | retained = floor(AY1_5EME x retention_4EME) |
| 3EME  | 4EME           | COLLEGE     | retained = floor(AY1_4EME x retention_3EME) |
| 2NDE  | 3EME           | LYCEE       | retained = floor(AY1_3EME x retention_2NDE) |
| 1ERE  | 2NDE           | LYCEE       | retained = floor(AY1_2NDE x retention_1ERE) |
| TERM  | 1ERE           | LYCEE       | retained = floor(AY1_1ERE x retention_TERM) |

**Evaluation test applicability:**

- MATERNELLE (PS, MS, GS): No evaluation test
- ELEMENTAIRE (CP-CM2): Evaluation Primaire (200 SAR/student)
- COLLEGE + LYCEE (6EME-TERM): Evaluation Secondaire (300 SAR/student)
