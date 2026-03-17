# DHG & Staffing Redesign — Remediation Plan (72% → 100%)

**Date:** 2026-03-17
**Purpose:** Close every open item from the Pre-Implementation Verification Report so the elevated design spec reaches 100% implementation-readiness confidence.
**Input:** `2026-03-17-dhg-staffing-verification-report.md` (14 gating actions, 11 missing requirements, 10 regression risks, 9 business rule confirmations)

---

## Remediation Structure

The 28-point confidence gap decomposes into four categories:

| Category              | Points | Description                                                                                 |
| --------------------- | ------ | ------------------------------------------------------------------------------------------- |
| A. Spec Fixes         | 10     | Amend the elevated design spec to resolve ambiguities, contradictions, and missing sections |
| B. Business Decisions | 8      | Confirm rules with the school/finance that no amount of analysis can resolve                |
| C. Data Validation    | 5      | Extract and verify values from source workbooks to populate seed data                       |
| D. Proof Artifacts    | 5      | Pre-implementation test scaffolds, reconciliation baselines, and migration dry-run          |

Each remediation item is a concrete deliverable with:

- **What** to do
- **Where** to change (exact file + section)
- **Acceptance test** (how you know it is done)
- **Owner** (you, the school, or the finance team)
- **Dependency** (if any)

---

## A. Spec Fixes — Amend the Elevated Design Spec

These are changes to `docs/plans/2026-03-17-dhg-staffing-redesign.md`. Each produces a diff to the spec document. No code is written. After all A-items are applied, the spec has zero ambiguities that could cause two engineers to implement the same requirement differently.

---

### A1. Add `lineType` to DemandOverride Unique Key

**Closes:** MR-01 (High), Checklist item "DemandOverride unique key includes lineType"

**Problem:** `DemandOverride` is keyed by `(versionId, band, disciplineId)`. `TeachingRequirementLine` is keyed by `(versionId, band, disciplineCode, lineType)`. If Arabic in College has both STRUCTURAL and HOST_COUNTRY lines, the override targets both — undefined behavior.

**Fix:** In section 6.8b, change the Prisma schema and unique constraint:

```prisma
model DemandOverride {
  // ... existing fields ...
  lineType         String  @map("line_type") @db.VarChar(20)  // ADD THIS FIELD
  // ...

  @@unique([versionId, band, disciplineId, lineType], map: "uq_demand_override")  // ADD lineType
}
```

Update section 7.1 (demand engine algorithm, override lookup) to match on `(band, disciplineId, lineType)`.

Update section 8.1 (PUT /demand-overrides) request schema to require `lineType`.

**Acceptance test:** Spec search for `uq_demand_override` shows 4-column key including `lineType`. Demand engine override lookup includes `lineType` in the match. API schema requires `lineType`.

**Owner:** You (spec author)
**Dependency:** None

---

### A2. Add `lineType` to StaffingAssignment + DhgRule Validation

**Closes:** MR-02 (Medium), Checklist item "StaffingAssignment lineType targeting clarified"

**Problem:** `StaffingAssignment` matches to requirement lines by `(band, disciplineCode)`, ignoring `lineType`. If two lines exist for the same discipline in the same band with different lineTypes, assignments cover both indiscriminately.

**Fix — two-part:**

**Part 1 — DhgRule constraint:** Add a validation rule to section 6.4: "At most one lineType per `(gradeLevel, disciplineId)` combination is permitted. If a discipline appears at a grade level, it appears with exactly one lineType. This constraint is enforced at DhgRule creation/update time."

Justification: In practice, Arabic at a given grade is either STRUCTURAL or HOST_COUNTRY, never both. The discipline taxonomy is the disambiguator — use `ARABE` (code for Arabic language, HOST_COUNTRY) vs a hypothetical `ARABE_LV2` (STRUCTURAL, if it existed). The V2 domain correction #7 confirmed there is no LV2 Arabic at EFIR.

**Part 2 — No change to StaffingAssignment:** Since the DhgRule constraint guarantees at most one lineType per (grade, discipline), and grades aggregate to bands, each (band, disciplineCode) produces at most one lineType. The assignment key `(band, disciplineId)` is therefore sufficient.

Add a comment in section 6.10: "This key is sufficient because the DhgRule uniqueness constraint (Part 1) guarantees at most one lineType per (gradeLevel, disciplineId). Since a band is an aggregation of grades, no (band, disciplineCode) can map to multiple lineTypes."

**Acceptance test:** Section 6.4 includes the new validation rule. Section 6.10 includes the sufficiency rationale. No ambiguity remains about how assignments map to multi-lineType scenarios — the scenario is architecturally prevented.

**Owner:** You (spec author)
**Dependency:** None

---

### A3. Define Primary Specialist `hoursPerUnit` Semantics

**Closes:** Verification report section 5.1 "Risky" item, Checklist item "Primary specialist hoursPerUnit semantics clarified", Gating action #2

**Problem:** The demand engine formula is `totalWeeklyHours = driverUnits × hoursPerUnit`. For secondary subjects, `driverUnits = sections` and `hoursPerUnit = per-section hours`. This is clear. For primary specialists (English, Arabic, Islamic in Maternelle/Elementaire), the interpretation is ambiguous.

The fixture data shows Elementaire English at `1.5 h/wk` per grade. If this means 1.5h per section and Elementaire has 26 sections across 5 grades, then total = 1.5 × 26 = 39h → FTE = 39/24 = 1.625 — far more than the mockup's 0.33 for "Elementaire English Specialist." Clearly the mockup used a different interpretation.

**Root cause:** Primary curriculum hours in the fixture are **student-facing hours per week** — every student gets 1.5h of English. But primary specialists do NOT teach each section independently the way secondary subject teachers do. A primary English specialist may cover multiple sections simultaneously (grouped) or visit each section for a shorter slot. The `hoursPerUnit` in DhgRule for primary specialists should represent **teacher DHG hours per section**, which may differ from student-facing hours.

**Fix:** In section 6.4, add a clarification subsection:

> **Primary specialist DhgRule configuration:**
>
> For primary specialist lines (English, Arabic, Islamic in Maternelle/Elementaire), `hoursPerUnit` represents the **teacher's weekly teaching load per section**, NOT the student-facing curriculum hours. These values must be confirmed with the school (see BR-01).
>
> Example: If a Maternelle English specialist visits each section for 1 hour per week, `hoursPerUnit = 1.0`. With PS=3, MS=4, GS=6 sections, `totalWeeklyHours = 1.0 × 13 = 13h`. FTE = 13/24(PE) = 0.54.
>
> The fixture data field `hoursPerWeek` for primary subjects represents student curriculum hours, not DhgRule `hoursPerUnit`. The DhgRule seed data must use teacher-facing hours from school confirmation, not raw fixture values.

In section 7.1, add a note under STEP 1: "For primary specialist rules, `hoursPerUnit` is the teacher's per-section weekly load, not the student curriculum hours. See section 6.4."

Update Appendix A (mockup) to include a footnote explaining the hoursPerUnit basis for primary specialist rows.

**Acceptance test:** The spec unambiguously distinguishes student-facing hours (fixture) from teacher-facing hours (DhgRule). The demand engine section cross-references this distinction. No engineer can confuse the two.

**Owner:** You (spec author)
**Dependency:** BR-01 (school confirmation) provides the actual numeric values

---

### A4. Specify Version Clone Logic

**Closes:** MR-03 (High), Checklist item "Version clone logic specified for all new tables"

**Problem:** The spec adds 10+ version-scoped entities with no clone specification. Version cloning is a critical workflow (scenario comparison).

**Fix:** Add a new section **6.14 Version Clone Behavior** to the elevated spec:

```markdown
## 6.14 Version Clone Behavior

When a BudgetVersion is cloned (POST /versions/:id/clone), the following tables
are handled:

### Copied (user-input data)

| Table                         | Notes                                                 |
| ----------------------------- | ----------------------------------------------------- |
| VersionStaffingSettings       | Deep copy, new versionId                              |
| VersionServiceProfileOverride | Deep copy                                             |
| VersionStaffingCostAssumption | Deep copy                                             |
| VersionLyceeGroupAssumption   | Deep copy                                             |
| StaffingAssignment            | Deep copy, preserving (band, disciplineId) references |
| DemandOverride                | Deep copy                                             |
| Employee (existing)           | Already handled by existing clone logic               |

### NOT Copied (derived outputs — regenerated on calculate)

| Table                     | Post-clone behavior                         |
| ------------------------- | ------------------------------------------- |
| TeachingRequirementSource | Not copied. STAFFING added to staleModules. |
| TeachingRequirementLine   | Not copied. STAFFING added to staleModules. |
| MonthlyStaffCost          | Already handled by existing clone logic.    |
| EosProvision              | Already handled by existing clone logic.    |
| CategoryMonthlyCost       | Already handled by existing clone logic.    |

### Clone transaction sequence (additions to existing clone logic)

1. After existing employee copy: copy VersionStaffingSettings
2. Copy VersionServiceProfileOverride rows
3. Copy VersionStaffingCostAssumption rows
4. Copy VersionLyceeGroupAssumption rows
5. Copy StaffingAssignment rows (remap employeeId to cloned employee IDs)
6. Copy DemandOverride rows
7. Add 'STAFFING' to cloned version's staleModules

**Critical:** StaffingAssignment.employeeId must be remapped to the cloned
Employee records. The clone transaction must build an oldEmployeeId → newEmployeeId
map from step 1 (employee copy) and apply it to assignments in step 5.
```

Add `apps/api/src/routes/versions/clone.ts` to the Modified Files table in section 20 with change description: "Add cloning logic for 6 new version-scoped staffing tables."

**Acceptance test:** Section 6.14 exists. Every version-scoped table has explicit copy/skip behavior. Assignment employee ID remapping is called out. File inventory includes clone.ts.

**Owner:** You (spec author)
**Dependency:** None

---

### A5. Define `AMOUNT_PER_FTE` FTE Basis

**Closes:** MR-05 (Medium), Gating action #6

**Problem:** `monthlyAmount = (value × totalTeachingFte) / 12` — which FTE? Raw or planned?

**Fix:** In section 7.5, update the `AMOUNT_PER_FTE` formula:

```
case 'AMOUNT_PER_FTE':
  // Uses requiredFteRaw (curriculum demand), not planned (HSA-adjusted)
  return assumption.value.times(totalTeachingFteRaw).div(12);
```

In the `CategoryCostInput` interface:

```typescript
totalTeachingFteRaw: Decimal; // SUM(requiredFteRaw) from all requirement lines
```

In Appendix D, update the formula row:

```
categoryCost_FTE = (value × totalFteRaw) / 12    // AMOUNT_PER_FTE mode — uses raw FTE
```

**Acceptance test:** All three locations (engine code, interface, appendix) consistently say `requiredFteRaw`. No ambiguity.

**Owner:** You (spec author)
**Dependency:** None

---

### A6. Add SECTION Driver Validation Rule

**Closes:** MR-04 (Medium), C3, Gating action #7

**Problem:** `driverType = SECTION` computes `totalWeeklyHours` but ignores it for FTE. No guard prevents confusion.

**Fix:** In section 6.4, add to the DhgRule validation rules:

```
DhgRule validation rules (enforced on create/update):
1. When driverType = SECTION, hoursPerUnit MUST be 0.
   Rationale: SECTION driver means FTE = sections (1:1 staffing). Hours are
   irrelevant. Setting hoursPerUnit > 0 is a misconfiguration.
   Exception: If hours need to be tracked informationally for the source-row
   audit trail, use a separate driverType (HOURS) with the actual per-section hours.
2. When driverType = HOURS or GROUP, hoursPerUnit MUST be > 0.
3. When driverType = GROUP, a matching VersionLyceeGroupAssumption SHOULD exist
   (warning, not blocking — fallback is 0 groups = 0 FTE).
```

In section 7.1, update STEP 1 SECTION case:

```
CASE 'SECTION':
  driverUnits = sectionsNeeded
  totalWeeklyHours = Decimal(0)  // Always 0 for SECTION driver (hoursPerUnit validated as 0)
```

**Acceptance test:** Section 6.4 includes 3 validation rules. SECTION driver no longer computes misleading hours. Test UT-D08 covers the zero-ORS guard. A new rule prevents SECTION + hoursPerUnit > 0.

**Owner:** You (spec author)
**Dependency:** None

---

### A7. Define Departed Employee and AEFE_RECHARGE Coverage Behavior

**Closes:** Gating actions #8 and #9, Verification report section 5.2 "Missing" items

**Problem:** Two edge cases are undefined:

1. Can departed employees' assignments count toward coverage?
2. Can AEFE_RECHARGE employees have assignments and count toward coverage?

**Fix:** In section 7.2 (Coverage Engine), add to the algorithm:

```
// Pre-filter: exclude departed employees from coverage
assignments = assignments.filter(a =>
  a.employeeStatus !== 'Departed'
)

// AEFE_RECHARGE employees CAN have assignments and DO count toward coverage.
// They provide teaching hours but their cost is zero (handled by recharge categories).
// No cost-mode filter on coverage — only departed status is excluded.
```

Add two new coverage warning types:

```
'DEPARTED_WITH_ASSIGNMENTS'  // Departed employee still has active assignments (data cleanup needed)
'RECHARGE_COVERAGE'          // Line covered by AEFE_RECHARGE employee (no direct cost impact)
```

**Acceptance test:** Coverage engine explicitly excludes departed employees. AEFE_RECHARGE teachers are explicitly included. Both decisions are documented with rationale. Two new warning types added.

**Owner:** You (spec author)
**Dependency:** None

---

### A8. Design Reconciliation View (Minimal)

**Closes:** MR-06 (Medium), Gating action #10, Acceptance criterion #11

**Problem:** AC-11 says "Source workbook reconciliation exposes and resolves the known pension and HSA inconsistencies" but no UI component exists.

**Fix:** Add a new subsection **10.6 Reconciliation Tab** to the Settings Sheet (section 10):

```markdown
### Tab 6: Reconciliation (Read-Only)

Displays a comparison table of app-computed annual totals vs workbook baseline values.
Baselines are stored in VersionStaffingSettings as a JSON field.

| Metric                           | App-Computed         | Workbook Baseline | Delta  | Status |
| -------------------------------- | -------------------- | ----------------- | ------ | ------ |
| Secondary Raw FTE                | (from lines)         | 57.41             | ±N.NN  | ✓/⚠    |
| Total Teaching Raw FTE           | (from lines)         | (from baseline)   | ±N.NN  | ✓/⚠    |
| Monthly HSA Total                | (from cost engine)   | 57,424 SAR        | ±N SAR | ✓/⚠    |
| Annual Pension                   | (from category cost) | 837,000 SAR       | ±N SAR | ✓/⚠    |
| Annual Staff Cost (excl pension) | (from cost engine)   | (from baseline)   | ±N SAR | ✓/⚠    |

Status: ✓ if within tolerance (±1% for FTE, ±5% for cost), ⚠ otherwise.

Known accepted variances (shown as footnotes):

- HSA: app uses uniform policy rate; workbook has person-level amounts (±2,600 SAR/month expected)
- Pension: app includes pension in grand total; workbook summary omits it (837K SAR/year expected)
```

Add a JSON field to `VersionStaffingSettings`:

```prisma
reconciliationBaseline Json? @map("reconciliation_baseline") @db.JsonB
```

Seed the baseline values from workbook evidence. The reconciliation tab is read-only — it shows the comparison after each calculation run.

This is minimal — no new endpoint needed. The tab reads from `VersionStaffingSettings.reconciliationBaseline` (static) and the teaching requirements + cost summary responses (dynamic).

**Acceptance test:** Section 10 has 6 tabs (not 5). Reconciliation tab shows 5 comparison rows. Tolerance is defined. Known variances are documented. Schema includes baseline field.

**Owner:** You (spec author)
**Dependency:** C1 (workbook baseline values extracted — see section C)

---

### A9. Design Migration Exception Queue

**Closes:** MR-07 (Medium), MR-08 (Medium), Gating action #11

**Problem:** Phase 3 migration uses heuristics to populate `serviceProfileId` and `disciplineId` on existing employees. No mechanism for handling unmatched records. No AGREGE vs CERTIFIE distinction.

**Fix:** In section 15 (Migration Strategy), replace Phase 3 with:

```markdown
### Phase 3 — Data Migration (Script)

File: `apps/api/src/migration/scripts/staffing-data-migration.ts`

**Step 1: Populate defaults**

- recordType = 'EMPLOYEE' for all existing employees
- costMode = 'LOCAL_PAYROLL' for all existing employees

**Step 2: Service profile assignment**
Heuristic rules (applied in order, first match wins):

1. department ILIKE '%maternelle%' OR department ILIKE '%elementaire%' → PE
2. functionRole ILIKE '%agrege%' OR functionRole ILIKE '%agrégé%' → AGREGE
3. functionRole ILIKE '%EPS%' OR department ILIKE '%sport%' → EPS
4. functionRole ILIKE '%arabe%' OR functionRole ILIKE '%islamic%'
   OR department ILIKE '%arabic%' → ARABIC_ISLAMIC
5. functionRole ILIKE '%documentaliste%' → DOCUMENTALISTE
6. isTeaching = true → CERTIFIE (catch-all for unresolved teaching staff)
7. isTeaching = false → null (non-teaching, no service profile)

**Step 3: Discipline assignment**

- Resolve through DisciplineAlias lookup on functionRole
- For each employee where alias lookup fails: log to exception queue

**Step 4: Home band assignment**

- Resolve from department through grade-to-band mapping
- For each employee where department doesn't map: log to exception queue

**Step 5: Exception queue**
Table: `staffing_migration_exceptions` (temporary, not a Prisma model)

| Column             | Type    | Purpose                                                       |
| ------------------ | ------- | ------------------------------------------------------------- |
| employeeId         | Int     | FK to employee                                                |
| employeeName       | String  | For human review                                              |
| field              | String  | Which field failed (serviceProfileId, disciplineId, homeBand) |
| sourceValue        | String  | The department/functionRole value that didn't match           |
| attemptedHeuristic | String  | Which rule was tried                                          |
| suggestedMatch     | String? | Best-guess if available                                       |
| resolved           | Boolean | Operator marks resolved after manual fix                      |

**Step 6: Verification**
After migration, run verification queries:

- Count employees by serviceProfileId — compare to expected distribution
- Count employees by costMode — all should be LOCAL_PAYROLL
- Count unresolved exceptions — must be 0 before migration is marked complete
- Count null disciplineId where isTeaching = true — these are the exceptions

**Rollback:** Entire Phase 3 runs in a single transaction. If any step fails,
all changes are rolled back. The exception queue is populated outside the
transaction (so exceptions are visible even on failure).
```

**Acceptance test:** Phase 3 has 6 steps. AGREGE is rule #2 (before CERTIFIE catch-all). Exception queue table is defined. Verification queries are specified. Transaction rollback is explicit.

**Owner:** You (spec author)
**Dependency:** None

---

### A10. Correct Mockup and Specify Remaining Edge Cases

**Closes:** C4, MR-10, MR-11, Gating action #14, V2 UX fixes

**Problem:** Multiple cosmetic and edge-case issues that individually are minor but collectively create specification noise.

**Fix — bundle of 5 sub-items:**

**A10a. Fix Appendix A mockup section counts:**

- PS: 3 sections (correct — 65/24=2.71, CEIL=3)
- MS: 4 sections (was 3 — 77/24=3.21, CEIL=4)
- GS: 6 sections (was 3 — 124/24=5.17, CEIL=6)
- ASEM: 13 (3+4+6), not 9
- Update all FTE and cost values accordingly
- Add footnote: "Mockup values are illustrative. Exact values depend on confirmed DhgRule seed data."

**A10b. Vacancy cost estimation:**
Add to section 6.9: "Vacancies with `costMode = LOCAL_PAYROLL` may optionally include estimated salary values in the encrypted salary fields. If salary fields are null, the cost engine produces zero cost. The KPI ribbon shows a count of unfunded vacancies (vacancies with null salary) as an informational indicator."

This is the simplest approach — no proxy logic, no average-cost estimation. Just allow optional salary on vacancies and show the gap.

**A10c. Orphaned assignment behavior:**
Add to section 7.2: "Orphaned assignments (assignments where no matching requirement line exists after demand recalculation) are excluded from the employee's coverage total. They are flagged with WARNING: ORPHANED_ASSIGNMENT. They are NOT auto-deleted — they persist for the user to review and manually remove or reassign. If an orphaned assignment persists for 2 consecutive calculation runs, it is additionally flagged with WARNING: STALE_ORPHAN."

**A10d. AY2 demand indicator:**
Add to section 11.2 (Status Strip): "Source indicator includes academic period label: 'Demand: Academic Year 2 (Sep 2026 – Jun 2027) | Enrollment AY2 headcounts (calculated Mar 15, 2026)'."

**A10e. `fteShare` semantics:**
Add to section 6.10: "`fteShare` represents the fraction of the employee's total available FTE (`hourlyPercentage`) allocated to this requirement line. It is absolute, not relative. Example: an employee with `hourlyPercentage = 1.0` assigned with `fteShare = 0.5` to line A and `fteShare = 0.5` to line B is fully assigned. Validation: `SUM(fteShare) <= hourlyPercentage` across all assignments for one employee."

**Acceptance test:** Mockup shows correct sections. Vacancy cost is explicit. Orphan behavior is explicit. AY2 label is in the status strip. fteShare semantics are defined.

**Owner:** You (spec author)
**Dependency:** None

---

## B. Business Decisions — Require School/Finance Confirmation

These cannot be resolved by analyzing documents or code. They require a human with domain authority to confirm. Each item includes a proposed default that can be used if confirmation is delayed, with the risk of using that default.

---

### B1. Primary English Hours Per Grade (Teacher-Facing)

**Closes:** BR-01, Gating action #4, F8 (PARTIAL → FULL)

**Question to school:** "For each grade (PS, MS, GS, CP, CE1, CE2, CM1, CM2), how many hours per week does the English specialist teach per section? Not the student curriculum hours (we have those in the fixture), but the actual teacher contact hours per section."

**Fixture reference:** Elementaire English is 1.5h/wk student curriculum per grade. Maternelle has no English entry in the fixture.

**Proposed default if no confirmation:**

- Maternelle: 0h (no English specialist — remove from mockup)
- Elementaire: 1.5h/section/week (same as student curriculum — may overstate if teacher groups sections)

**Risk of default:** If the school groups sections (e.g., 2 sections together = 0.75h per section), FTE will be overstated by 2x. If Maternelle actually has English, we miss a demand line entirely.

**Deliverable:** Confirmed hours table → DhgRule seed data for English specialist rows.

**Owner:** School administration (you ask the question)

---

### B2. FY2026 Resident Recharge Amounts

**Closes:** BR-02, Gating action #5

**Question to finance:** "What are the annual amounts for resident salary recharge and resident housing/travel recharge for FY2026?"

**Source hint:** These values are likely in `EFIR_Staff_Costs_Budget_FY2026_V3.xlsx` in the resident cost section. The elevated spec already extracted 837K SAR/year for pension. The salary and housing amounts should be adjacent.

**Proposed default if no confirmation:**

- RESIDENT_SALAIRES: extract from workbook (estimated range: 2-4M SAR/year based on pension being 35% of salary)
- RESIDENT_LOGEMENT: extract from workbook

**Risk of default:** If manually estimated, category costs could be off by ±30%.

**Deliverable:** Two confirmed annual SAR amounts → VersionStaffingCostAssumption seed data.

**Owner:** Finance team or workbook owner (you can also extract from the Excel file directly)

---

### B3. Arabic/Islamic ORS Confirmation

**Closes:** BR-03, Gating action #13

**Question to school:** "Do Arabic and Islamic Studies teachers at the secondary level (College, Lycee) have a 24h/week service obligation like primary teachers, or 18h/week like Certifie teachers?"

**Fixture reference:** The fixture says `"Arabic/Islamic Studies Teacher" value: 24, notes: "Estimated — adjust per EFIR contract"`. The word "Estimated" means this is NOT confirmed.

**Proposed default:** 24h for all bands (matching spec decision Q2). This is conservative — if the actual ORS is lower, the app will understate FTE demand (safe direction for budget).

**Risk of default:** If secondary Arabic teachers actually have 18h ORS, their demand FTE is overstated by 33% (24/18). This means the coverage gap will show as artificially smaller than reality.

Wait — lower ORS means HIGHER FTE demand (more hours needed per teacher). So if actual ORS is 18h and we use 24h, we UNDERSTATE demand by 33%. This is the WRONG direction for budget safety.

**Revised risk:** If secondary Arabic ORS is actually 18h and we assume 24h, we understate demand by 33%. This is the dangerous direction. **This confirmation is blocking.**

**Deliverable:** Confirmed ORS value for ARABIC_ISLAMIC profile, or confirmation that 24h is correct for all bands.

**Owner:** School HR / administration

---

### B4. DOCUMENTALISTE Classification

**Closes:** BR-04

**Question to school:** "Is the CDI documentaliste considered a teaching position (with DHG demand line and requirement-line planning) or a support/admin position (appearing in the support/admin workspace only)?"

**Proposed default:** Support/admin. Rationale: Documentaliste ORS is 30h, which is not comparable to classroom teaching ORS. Their "teaching" is qualitatively different (CDI hours, not curriculum delivery). They do not generate DHG demand lines.

**Risk of default:** If the school considers the documentaliste a teaching position, one demand line (~1 FTE) will be missing from the teaching workspace.

**Deliverable:** Classification decision → either add DhgRule for DOCUMENTALISTE or document as support/admin.

**Owner:** School administration

---

### B5. Maternelle English Confirmation

**Closes:** BR-05, V2 domain correction #4

**Question to school:** "Does EFIR have English language instruction in Maternelle (PS, MS, GS)? If yes, how many hours per section per week?"

**Fixture evidence:** The fixture has no Maternelle English entry. The mockup includes "English (Specialist)" under Maternelle.

**Proposed default:** No Maternelle English. Remove from mockup.

**Risk of default:** If Maternelle English exists, one demand line will be missing.

**Deliverable:** Confirmation → either add DhgRule + fixture data for Maternelle English or remove from mockup.

**Owner:** School administration

---

### B6. Lycee Autonomy Hours Interpretation

**Closes:** BR-06, V2 domain correction #2

**Question to school:** "The Lycee DHG includes 'Heures d'autonomie' at 12h/division. Are these teacher allocation hours (counted in DHG demand) or a planning margin (diagnostic only, not generating a demand line)?"

**Proposed default:** Planning diagnostic only. The autonomy pool creates a `POOL` discipline requirement line with `lineType = AUTONOMY` but is shown as a separate informational row, not summed into teaching FTE demand.

**Risk of default:** If autonomy hours should generate real FTE demand, total Lycee demand will be understated.

**Deliverable:** Confirmed interpretation → DhgRule configuration for AUTONOMY discipline.

**Owner:** School administration / academic director

---

### B7. Ajeer/EoS Cost Split Acceptance

**Closes:** BR-08

**Question to finance:** "The cost attribution formula splits ALL employee costs (including per-person Ajeer fees and EoS accruals) proportionally by FTE share across assigned requirement lines. This is an approximation — Ajeer is a per-person fee regardless of teaching hours. Is this acceptable, or should Ajeer and EoS be attributed entirely to the employee's primary assignment line?"

**Proposed default:** Accept the approximation. Rationale: The per-line cost attribution is informational (inspector view), not used for payroll or accounting. The KPI and grand total are exact.

**Risk of default:** None for budget accuracy. Minor for per-line cost explainability.

**Deliverable:** Written acceptance from finance stakeholder (email or meeting note).

**Owner:** Finance team

---

### B8. HSA Per-Employee Override Decision

**Closes:** BR-09

**Question:** "Should the system allow per-employee HSA overrides (a manual hsaAmount different from the policy-computed amount, with reason code and audit trail), or is the uniform policy-derived HSA acceptable for v1?"

**Context:** The V1 review (F3) recommended per-employee override. The elevated spec explicitly removed it. The workbook shows person-level HSA amounts that vary.

**Proposed default:** Defer to v1.1. The uniform policy HSA is sufficient for budget planning. Reconciliation to individual payroll amounts is a v1.1 concern.

**Risk of default:** HSA reconciliation to the payroll workbook will show variance (~2,600 SAR/month based on the 57,424 vs 60,024 discrepancy). This is within the reconciliation tab's "known accepted variance" threshold.

**Deliverable:** Explicit decision: "deferred to v1.1" documented in section 19 (Open Questions → Resolved Decisions Summary).

**Owner:** You (product decision)

---

## C. Data Validation — Extract Values from Source Workbooks

These are concrete data extraction tasks from the Excel workbooks already in the repo. They produce seed data values that go into the spec.

---

### C1. Extract Resident Recharge Amounts from Staff Cost Workbook

**Source:** `data/budgets/EFIR_Staff_Costs_Budget_FY2026_V3.xlsx`

**Task:** Open the workbook. Find the resident cost section. Extract:

1. Annual resident salary recharge total (RESIDENT_SALAIRES)
2. Annual resident housing/travel recharge total (RESIDENT_LOGEMENT)
3. Verify the 837,000 SAR pension amount is annual, not monthly

**Deliverable:** Update section 6.7 seed values table — replace `(TBD)` with confirmed amounts.

**Also extract:** Workbook baseline values for the reconciliation tab (A8):

- Total annual local payroll (excluding recharges and pension)
- Total monthly HSA from the staff master sheet

**Owner:** You (can open the xlsx directly)

---

### C2. Verify Secondary Raw FTE Total from DHG Workbook

**Source:** `data/budgets/02_EFIR_DHG_FY2026_v1.xlsx`, DHG_Optimization sheet

**Task:** Verify that the secondary total raw FTE is 57.41 as claimed in the spec. This becomes reconciliation checkpoint RC-01.

**Also extract:** Per-subject FTE breakdown for 3-5 representative subjects (French, Maths, English, EPS, Arabic) to serve as unit test expected values.

**Owner:** You (can open the xlsx directly)

---

### C3. Validate Employee Distribution for Migration Heuristics

**Source:** `data/budgets/EFIR_Staff_Costs_Budget_FY2026_V3.xlsx`, staff master sheet

**Task:** Count employees by department and functionRole to validate migration heuristics:

1. How many employees match "maternelle" or "elementaire" in department? (→ PE)
2. How many have "agrege" or "agrégé" in functionRole? (→ AGREGE)
3. How many have "EPS" or "sport"? (→ EPS)
4. How many have "arabe" or "islamic"? (→ ARABIC_ISLAMIC)
5. How many teaching staff don't match any heuristic? (→ CERTIFIE catch-all)
6. How many have department/role values that are ambiguous or could match multiple rules?

**Deliverable:** Migration heuristic confidence assessment. If >5% of teaching staff are ambiguous, revise heuristics or expand the exception queue.

**Owner:** You (can open the xlsx directly)

---

## D. Proof Artifacts — Pre-Implementation Scaffolds

These are not code implementations — they are test scaffolds, baselines, and dry-run scripts that PROVE the spec is implementable before the first line of production code is written.

---

### D1. Reconciliation Baseline Document

**Deliverable:** A markdown file `docs/plans/2026-03-17-dhg-staffing-reconciliation-baseline.md` containing:

1. **FTE baselines** (from C2):
    - Secondary total raw FTE: X.XX
    - Per-subject FTE for 5 representative subjects
    - Primary homeroom FTE by grade (verify CEIL(headcount/maxClassSize))

2. **Cost baselines** (from C1):
    - Monthly HSA total: XX,XXX SAR
    - Annual pension: 837,000 SAR
    - Annual resident salary recharge: XX,XXX SAR
    - Annual resident housing recharge: XX,XXX SAR
    - Grand total annual staff cost: XX,XXX,XXX SAR

3. **Tolerance definitions:**
    - FTE: ±0.05 per line, ±0.5 total
    - Cost: ±1% per category, ±5% grand total
    - Known accepted variances: HSA (±2,600 SAR/month), pension (included vs excluded)

**Owner:** You (after C1 and C2 are complete)
**Dependency:** C1, C2

---

### D2. Demand Engine Golden Test Data

**Deliverable:** A JSON file `apps/api/src/services/staffing/demand-engine.test.fixtures.json` containing:

1. Input: 15 enrollment entries (from fixture), 10 representative DhgRules, service profiles, settings
2. Expected output: TeachingRequirementSource rows and TeachingRequirementLine rows with exact FTE values
3. This becomes the reference data for UT-D01 through UT-D10

Compute the expected values by hand (or in a spreadsheet) BEFORE the engine is coded. This is the "red" in TDD.

**Owner:** You (after A3 and B1 are resolved — you need confirmed specialist hours)
**Dependency:** A3, B1

---

### D3. Migration Dry-Run Script

**Deliverable:** A one-shot script `apps/api/src/migration/scripts/staffing-migration-dryrun.ts` that:

1. Reads all Employee records from a version
2. Applies the heuristic rules (A9 Phase 3)
3. Outputs a report (NOT writing to DB) showing:
    - Employee name | department | functionRole | → serviceProfileCode | → disciplineCode | → homeBand | status (matched/exception)
4. Counts: matched, exceptions, ambiguous

Run this BEFORE the actual migration to validate the heuristics on real data. Fix any heuristic rules that produce bad matches.

**Owner:** You (after A9 and C3 are complete)
**Dependency:** A9, C3

---

### D4. Stale Module Reference Audit

**Deliverable:** Run `grep -rn "'DHG'" apps/ packages/` and `grep -rn '"DHG"' apps/ packages/`. Document every file that references the old `DHG` stale module string. This list becomes the migration checklist for R-03.

Add a CI test to `apps/api/src/services/staffing/demand-engine.test.ts`:

```typescript
it('no code references DHG as a stale module', () => {
    // This test exists to catch regressions after the DHG → STAFFING merge
    const result = execSync(
        'grep -rn "DHG" apps/api/src/ apps/web/src/ --include="*.ts" --include="*.tsx" | grep -i stale || true'
    );
    expect(result.toString().trim()).toBe('');
});
```

**Owner:** You
**Dependency:** None

---

### D5. DhgRule Seed Data Validation Spreadsheet

**Deliverable:** A spreadsheet (or markdown table) showing every DhgRule that will be seeded, with:

| gradeLevel | discipline       | lineType     | driverType | hoursPerUnit | serviceProfile | source                    |
| ---------- | ---------------- | ------------ | ---------- | ------------ | -------------- | ------------------------- |
| PS         | PRIMARY_HOMEROOM | STRUCTURAL   | SECTION    | 0            | PE             | Fixture: 1 PE per section |
| PS         | ARABE            | HOST_COUNTRY | HOURS      | 2.0          | ARABIC_ISLAMIC | Fixture: 2h/wk PS Arabic  |
| 6EME       | FRANCAIS         | STRUCTURAL   | HOURS      | 4.5          | CERTIFIE       | Fixture: 4.5h/section     |
| ...        | ...              | ...          | ...        | ...          | ...            | ...                       |

Cross-reference every row against the fixture data and workbook evidence. Flag any row where the source is "estimated" or "assumed."

This spreadsheet becomes the acceptance test for MT-01 (DhgGrilleConfig → DhgRule migration).

**Owner:** You (after B1, B3, B4, B5, B6 are resolved)
**Dependency:** All B-items

---

## Execution Sequence

The remediation items have dependencies. Here is the optimal execution order:

```
PHASE 1 — Parallel (no dependencies)
├── A1  DemandOverride lineType fix
├── A2  StaffingAssignment + DhgRule validation
├── A4  Version clone logic
├── A5  AMOUNT_PER_FTE FTE basis
├── A6  SECTION driver validation
├── A7  Departed/AEFE coverage behavior
├── A10 Mockup + edge cases bundle
├── D4  Stale module reference audit
└── B1-B8 Send all business questions simultaneously

PHASE 2 — After Phase 1 (depends on A-items)
├── A3  Primary specialist hoursPerUnit (depends on conceptual clarity, not B1 values)
├── A9  Migration exception queue
├── C1  Extract workbook amounts
├── C2  Verify secondary FTE
└── C3  Validate employee distribution

PHASE 3 — After Phase 2 + B-item confirmations
├── A8  Reconciliation view (depends on C1 baseline values)
├── D1  Reconciliation baseline document (depends on C1, C2)
├── D3  Migration dry-run (depends on A9, C3)
└── D5  DhgRule seed validation (depends on B1-B6)

PHASE 4 — After Phase 3
└── D2  Demand engine golden test data (depends on A3, B1, D5)
```

**Timeline estimate:**

- Phase 1: 1-2 days (spec changes are document edits; business questions are emails)
- Phase 2: 1-2 days (workbook extraction + migration heuristic review)
- Phase 3: 1-2 days (reconciliation baseline + dry-run)
- Phase 4: 1 day (golden test fixture)
- Business confirmations (B1-B8): 1-5 business days (external dependency)

**Total:** 4-7 working days if business confirmations come within 3 days. All spec fixes (A-items) can be completed in 1-2 days regardless of B-item timing.

---

## Completion Criteria

The elevated design spec is at **100% implementation-readiness** when ALL of the following are true:

1. All A-items are applied to the spec document (0 ambiguities)
2. All B-items have documented decisions (0 unconfirmed business rules)
3. All C-items have extracted values populated in the spec (0 TBD seed values)
4. All D-items produce their artifacts (0 untested assumptions)
5. The verification report checklist (Section 9) has all boxes checked
6. The reconciliation baseline document exists with 5 checkpoints and defined tolerances
7. The demand engine golden test fixtures exist with hand-computed expected values
8. The migration dry-run script produces 0 exceptions on the current employee data (or all exceptions have documented resolution paths)

At that point, the verdict upgrades from `SAFE WITH CONDITIONS` to `SAFE TO IMPLEMENT`.

---

_End of Remediation Plan._
