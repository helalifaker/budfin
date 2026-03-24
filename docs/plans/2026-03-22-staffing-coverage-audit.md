# Staffing Coverage Deep Audit — 2026-03-22

## Executive Summary

After running Calculate with auto-assignments, the Coverage tab reveals **systemic data and display issues**. The root causes fall into 3 categories:

1. **Frontend display bug** — SECTION-driven lines (ASEM, PRIMARY_HOMEROOM) show FTE NEEDED = 0.00 and wrong GAP values
2. **Missing DHG rules** — No English rules for GS (Maternelle) or Lycee grades
3. **Incorrect `homeBand` mappings** — Arabic, Physics, SVT, SES, and English teachers concentrated in wrong bands

---

## CRITICAL — Frontend Display Bug (SECTION-driven lines)

**File**: `apps/web/src/lib/staffing-workspace.ts:396-402`

```typescript
const fte = ors.isZero() ? new Decimal(0) : totalHours.div(ors);
```

For SECTION-driven lines (`driverType = 'SECTION'`), `totalWeeklyHours` is always 0.00 because these roles are assigned per section, not per teaching hour. The frontend computes FTE as `0 / ORS = 0`, which is wrong.

**Should use**: `requiredFteRaw` directly for SECTION driver types, which equals the number of sections.

### Affected lines

| Band | Discipline       | FTE NEEDED (displayed) | FTE NEEDED (actual) | COVERED | GAP (displayed) | GAP (actual) |
| ---- | ---------------- | ---------------------- | ------------------- | ------- | --------------- | ------------ |
| Mat  | ASEM             | 0.00                   | **13.00**           | 12.00   | +12.00          | **-1.00**    |
| Mat  | PRIMARY_HOMEROOM | 0.00                   | **13.00**           | 12.00   | +12.00          | **-1.00**    |
| Elem | PRIMARY_HOMEROOM | 0.00                   | **27.00**           | 27.00   | +27.00          | **0.00**     |

The right-side detail panel shows correct values because it reads `requiredFteRaw` directly.

---

## CRITICAL — Missing DHG Rules

### 1. GS ANGLAIS_LV1 (Maternelle English)

No DHG rule exists for `GS | ANGLAIS_LV1`. The seed script (`seed-staffing-from-excel.ts:302-316`) has code to create this rule, but it is absent from the database.

**Impact**: No MATERNELLE ANGLAIS_LV1 requirement line is generated. The 4 English teachers with `homeBand = MATERNELLE` create orphaned assignments.

**Fix**: Add DHG rule: `GS | ANGLAIS_LV1 | HOURS | 1.00 | PE | STRUCTURAL`

### 2. Lycee ANGLAIS_LV1

No DHG rules exist for `2NDE | ANGLAIS_LV1`, `1ERE | ANGLAIS_LV1`, or `TERM | ANGLAIS_LV1`. English is taught at Lycee but the Lycee worksheet parsing didn't pick up the English rows (likely different row label format, e.g., "LVA — Anglais" vs what's in the Excel).

**Impact**: 2 English teachers with `homeBand = LYCEE` (GOUDEZEUNE Stephane, HAFIDI Malika) have orphaned assignments.

**Fix**: Add DHG rules for 2NDE/1ERE/TERM ANGLAIS_LV1 with correct hours.

### 3. College ALLEMAND

No DHG rule for any College grade with ALLEMAND discipline. SAKR Sally teaches German at College but there's no demand line.

**Fix**: Determine if German is actually taught at College (curriculum-dependent). If yes, add rules.

---

## HIGH — Incorrect `homeBand` Mappings in Fixture Data

### Arabic Teachers (ARABE)

All 7 Arabic teachers mapped to MATERNELLE but Arabic is needed across ALL primary bands.

| Band        | Teachers                                                      | FTE Needed | Covered FTE | Gap       |
| ----------- | ------------------------------------------------------------- | ---------- | ----------- | --------- |
| MATERNELLE  | 7 (AL JUNDI, BACHOUR, BADR, HUSSEIN, SABRA, SALIBA, ZOUBIANE) | 1.30       | 7.00        | **+5.70** |
| ELEMENTAIRE | 0                                                             | 2.70       | 0.00        | **-2.70** |
| COLLEGE     | 5 (BALLAN, BASBOUS, MAKSOUD, NAGHAM, YAKHLEF)                 | 1.88       | 5.00        | **+3.13** |

**Root cause**: The fixture `fy2026-staff-costs.json` assigns all primary Arabic teachers to MATERNELLE. In reality, Arabic teachers cover both Maternelle AND Elementaire. Some should have `homeBand = ELEMENTAIRE`.

**Recommendation**: Redistribute Arabic teachers. Example allocation:

- MATERNELLE: 2 teachers (covers 1.30 FTE)
- ELEMENTAIRE: 5 teachers (covers 2.70 FTE)
- COLLEGE: Keep 2-3 (covers 1.88 FTE); move 2-3 to appropriate bands

### Physics Teachers (PHYSIQUE_CHIMIE)

6 in College for 1.75 FTE needed. Meanwhile Lycee desperately needs them.

| Band               | Teachers                                                 | FTE Needed | Covered FTE | Gap       |
| ------------------ | -------------------------------------------------------- | ---------- | ----------- | --------- |
| COLLEGE            | 6 (BOUHJAR, CHAIEB, MESSAOUDI, RIGBOU, TEDJANI, ZARROUR) | 1.75       | 6.00        | **+4.25** |
| LYCEE (structural) | 1 (EDOUJ)                                                | 0.83       | 1.00        | +0.17     |
| LYCEE (specialty)  | 0                                                        | 2.44       | 0.00        | **-2.44** |

**Recommendation**: Move 3-4 Physics teachers from COLLEGE to LYCEE homeBand.

### SVT Teachers

Same pattern as Physics — all concentrated in College.

| Band               | Teachers                                        | FTE Needed | Covered FTE | Gap       |
| ------------------ | ----------------------------------------------- | ---------- | ----------- | --------- |
| COLLEGE            | 6 (BELLILA, JEMAA, MASSIN, SAAB, SALHI, SEMAAN) | 1.75       | 6.00        | **+4.25** |
| LYCEE (structural) | 0                                               | 0.42       | 0.00        | -0.42     |
| LYCEE (specialty)  | 0                                               | 2.44       | 0.00        | **-2.44** |

**Recommendation**: Move 3-4 SVT teachers from COLLEGE to LYCEE homeBand.

### SES Teachers

2 SES teachers mapped to COLLEGE, but SES is a Lycee-only subject.

| Employee          | Current Band | Should Be |
| ----------------- | ------------ | --------- |
| BEN OTHMAN Noelle | COLLEGE      | **LYCEE** |
| MEKNI Mehdi       | COLLEGE      | **LYCEE** |

SES DHG rules only exist for 2NDE/1ERE/TERM. No COLLEGE SES requirement line exists.

### English Teachers in Maternelle

4 English teachers mapped to MATERNELLE with no matching requirement line.

| Employee       | Current Band | Likely Band                                      |
| -------------- | ------------ | ------------------------------------------------ |
| EL GHAZAL Lina | MATERNELLE   | MATERNELLE (if GS DHG rule added) or ELEMENTAIRE |
| HAMMOUD Noura  | MATERNELLE   | MATERNELLE or ELEMENTAIRE                        |
| KABBANI Farah  | MATERNELLE   | MATERNELLE or ELEMENTAIRE                        |
| SHAWBAH Myriam | MATERNELLE   | MATERNELLE or ELEMENTAIRE                        |

These teachers likely teach GS English AND Elementaire English. Need GS DHG rule first, then decide if they stay MATERNELLE or move to ELEMENTAIRE.

---

## MEDIUM — Orphaned Assignments (11 total)

Employees auto-assigned to a (band, discipline) combination with no matching requirement line.

| Band        | Discipline         | Count | Employees                            | Reason                                         |
| ----------- | ------------------ | ----- | ------------------------------------ | ---------------------------------------------- |
| MATERNELLE  | ANGLAIS_LV1        | 4     | EL GHAZAL, HAMMOUD, KABBANI, SHAWBAH | Missing GS DHG rule                            |
| LYCEE       | ANGLAIS_LV1        | 2     | GOUDEZEUNE, HAFIDI                   | Missing Lycee English DHG rules                |
| COLLEGE     | SES                | 2     | BEN OTHMAN, MEKNI                    | Wrong homeBand (should be LYCEE)               |
| COLLEGE     | ALLEMAND           | 1     | SAKR                                 | No College German DHG rule                     |
| ELEMENTAIRE | EDUCATION_MUSICALE | 1     | HOFFMAN                              | No Elem Music DHG rule (Music is College-only) |
| ELEMENTAIRE | FLE                | 1     | CHOUT                                | No FLE DHG rule anywhere                       |

---

## MEDIUM — Unassigned Teaching Employees (19 with NULL discipline_id)

These employees have `is_teaching = true` but no `discipline_id`, so no auto-assignment was created.

### COLLEGE — 14 unassigned

| Employee             | Subject        | Function Role                  | Notes                                                |
| -------------------- | -------------- | ------------------------------ | ---------------------------------------------------- |
| ASSEKOUR Soufiane    | TBD            | Enseignant second degre        | Needs subject assignment                             |
| BEN HIBA Nesrine     | TBD            | Enseignant second degre        | Needs subject assignment                             |
| BOUGATFA Rim         | TBD            | Enseignant second degre        | Needs subject assignment                             |
| DESBARRES Chloe      | TBD            | Enseignant de langue etrangere | Needs subject assignment                             |
| EL OUAFI Hassan      | TBD            | Enseignant second degre        | Needs subject assignment                             |
| HARBI Emna           | TBD            | Enseignant second degre        | Needs subject assignment                             |
| MERHABI Jinane       | TBD            | Enseignant de langue etrangere | Needs subject assignment                             |
| MOURI Fares          | TBD            | Enseignant second degre        | Needs subject assignment                             |
| POPULUS Nathalie     | TBD            | Enseignant second degre        | Needs subject assignment                             |
| QUESNEL Guillaume    | TBD            | Enseignant second degre        | Needs subject assignment                             |
| RIFFI Siham          | TBD            | Enseignant second degre        | Needs subject assignment                             |
| BOULMANE Lala-Malika | Inclusion      | Coordinatrice inclusion        | No discipline match                                  |
| EL BOUFRAHI NAJLAA   | Sante scolaire | Infirmiere                     | Not a teaching role — `isTeaching` should be `false` |
| NASSAR Maya          | Sante scolaire | Infirmiere                     | Not a teaching role — `isTeaching` should be `false` |

### ELEMENTAIRE — 5 unassigned

| Employee                | Subject             | Function Role                             | Notes                                                |
| ----------------------- | ------------------- | ----------------------------------------- | ---------------------------------------------------- |
| FOUAL Kenza             | Remplacement        | AED / Assistante APS                      | Float teacher — no fixed discipline                  |
| TEMAGOULT Myriam        | Remplacement        | AED primaire avec mission de remplacement | Float teacher — no fixed discipline                  |
| GRATEAU Michele         | Bibliotheque        | Bibliothecaire                            | Not a teaching role — `isTeaching` should be `false` |
| SOUKIASSIAN Lisa        | Documentation / CDI | Documentaliste                            | Has DOCUMENTALISTE profile but no discipline         |
| PIERRU Claire (College) | Documentation / CDI | Documentaliste                            | Has DOCUMENTALISTE profile but no discipline         |

---

## MEDIUM — Education Islamique Gap (zero coverage, zero teachers)

EDUCATION_ISLAMIQUE has DHG rules for ALL grades (PS through TERM) but **zero employees** in the fixture teach this subject.

| Band        | FTE Needed | Covered | Gap   |
| ----------- | ---------- | ------- | ----- |
| MATERNELLE  | 0.65       | 0.00    | -0.65 |
| ELEMENTAIRE | 1.35       | 0.00    | -1.35 |
| COLLEGE     | 1.05       | 0.00    | -1.05 |

Total: 3.05 FTE unfilled. This may be correct if Ed. Islamique teachers are externally hired or if these positions are vacant, but it contributes significantly to the -15.00 FTE GAP shown in the KPI.

---

## LOW — ASEM Departed Employee

NEGHNAGH Anissa is the 13th ASEM in the fixture but has `status = Departed`. This is correctly excluded from auto-assignment. The ASEM line shows 12 covered / 13 needed = -1.00 gap. **No action needed** — this accurately reflects a vacant ASEM position.

---

## LOW — `isTeaching` Flag Misclassifications

Several employees are flagged `isTeaching = true` but have non-teaching roles:

| Employee           | Subject        | Function Role  | Should be            |
| ------------------ | -------------- | -------------- | -------------------- |
| EL BOUFRAHI NAJLAA | Sante scolaire | Infirmiere     | `isTeaching = false` |
| NASSAR Maya        | Sante scolaire | Infirmiere     | `isTeaching = false` |
| GRATEAU Michele    | Bibliotheque   | Bibliothecaire | `isTeaching = false` |

These generate UNASSIGNED_TEACHER warnings and inflate the "unassigned" count.

---

## Summary: Coverage Accuracy by Band

### MATERNELLE (13 sections: PS=3, MS=4, GS=6)

| Discipline          | FTE Needed | Covered         | Gap   | Issue                               |
| ------------------- | ---------- | --------------- | ----- | ----------------------------------- |
| ARABE               | 1.30       | 7.00            | +5.70 | 5 teachers should be in ELEMENTAIRE |
| ASEM                | 13.00      | 12.00           | -1.00 | 1 departed ASEM (correct gap)       |
| EDUCATION_ISLAMIQUE | 0.65       | 0.00            | -0.65 | No teachers hired                   |
| PRIMARY_HOMEROOM    | 13.00      | 12.00           | -1.00 | 1 section uncovered                 |
| ANGLAIS_LV1         | ???        | 4.00 (orphaned) | ???   | **Missing GS DHG rule**             |

### ELEMENTAIRE (24 sections: CP=5, CE1=4, CE2=5, CM1=5, CM2=5)

| Discipline          | FTE Needed | Covered         | Gap   | Issue                                       |
| ------------------- | ---------- | --------------- | ----- | ------------------------------------------- |
| ANGLAIS_LV1         | 2.03       | 0.00            | -2.03 | English teachers in wrong band (MATERNELLE) |
| ARABE               | 2.70       | 0.00            | -2.70 | Arabic teachers in wrong band (MATERNELLE)  |
| EDUCATION_ISLAMIQUE | 1.35       | 0.00            | -1.35 | No teachers hired                           |
| PRIMARY_HOMEROOM    | 27.00      | 27.00           | 0.00  | Correct                                     |
| EDUCATION_MUSICALE  | N/A        | 1.00 (orphaned) | N/A   | No Elem Music DHG rule                      |
| FLE                 | N/A        | 1.00 (orphaned) | N/A   | No FLE DHG rule                             |

### COLLEGE (19 sections: 6EME=6, 5EME=5, 4EME=4, 3EME=4)

| Discipline      | FTE Needed | Covered         | Gap       | Issue                                     |
| --------------- | ---------- | --------------- | --------- | ----------------------------------------- |
| ANGLAIS_LV1     | 3.83       | 3.00            | -0.83     | Slight deficit (OK)                       |
| ARABE           | 1.88       | 5.00            | +3.13     | 3 teachers should be elsewhere            |
| FRANCAIS        | 5.14       | 5.00            | -0.14     | Nearly covered (OK)                       |
| MATHEMATIQUES   | 4.42       | 5.92            | +1.50     | Slight surplus (OK)                       |
| PHYSIQUE_CHIMIE | 1.75       | 6.00            | **+4.25** | 4 teachers should be LYCEE                |
| SVT             | 1.75       | 6.00            | **+4.25** | 4 teachers should be LYCEE                |
| SES             | N/A        | 2.00 (orphaned) | N/A       | Wrong band (should be LYCEE)              |
| AUTONOMY        | 3.50       | 0.00            | -3.50     | Hour pool — no direct coverage (expected) |

### LYCEE (12 sections: 2NDE=4, 1ERE=4, TERM=4)

| Discipline      | FTE Needed | Covered         | Gap       | Issue                                     |
| --------------- | ---------- | --------------- | --------- | ----------------------------------------- |
| ANGLAIS_LV1     | N/A        | 2.00 (orphaned) | N/A       | **Missing Lycee English DHG rules**       |
| FRANCAIS        | 2.22       | 3.00            | +0.78     | OK                                        |
| HISTOIRE_GEO    | 2.33       | 2.00            | -0.33     | Slight deficit (OK)                       |
| MATHEMATIQUES   | 3.56       | 4.00            | +0.44     | OK                                        |
| PHYSIQUE_CHIMIE | 3.28       | 2.00            | -1.28     | Need 2 more from College                  |
| SES             | 2.86       | 2.00            | -0.86     | 2 SES teachers in wrong band (College)    |
| SVT             | 2.86       | 0.00            | **-2.86** | All SVT in College                        |
| AUTONOMY        | 3.33       | 0.00            | -3.33     | Hour pool — no direct coverage (expected) |

---

## Recommended Fix Priority

| #   | Issue                                      | Type         | Impact                                | Fix                                                                          |
| --- | ------------------------------------------ | ------------ | ------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | SECTION-driven FTE display                 | Frontend bug | 3 lines show 0.00 FTE + wrong GAP     | Fix `buildDisciplineSummaryRows()` to use `requiredFteRaw` for SECTION lines |
| 2   | Missing GS ANGLAIS_LV1 DHG rule            | Data gap     | 4 orphaned English assignments        | Insert DHG rule: GS, ANGLAIS_LV1, HOURS, 1.00, PE, STRUCTURAL                |
| 3   | Missing Lycee English DHG rules            | Data gap     | 2 orphaned English assignments        | Insert DHG rules for 2NDE/1ERE/TERM ANGLAIS_LV1 from Excel                   |
| 4   | Arabic teachers concentrated in MATERNELLE | Fixture data | 5.70 surplus Mat, -2.70 gap Elem      | Move ~5 Arabic teachers to `homeBand = ELEMENTAIRE`                          |
| 5   | Physics/SVT in COLLEGE only                | Fixture data | +4.25 surplus Col, -2.86 gap Lyc each | Move 3-4 Physics + 3-4 SVT to `homeBand = LYCEE`                             |
| 6   | SES teachers in COLLEGE                    | Fixture data | Orphaned assignments                  | Change homeBand to LYCEE                                                     |
| 7   | `isTeaching` misclassifications            | Fixture data | False UNASSIGNED warnings             | Set `isTeaching = false` for nurses + librarian                              |
| 8   | 11 TBD teachers                            | Data gap     | 11 unassigned teachers                | Assign subjects when known                                                   |
