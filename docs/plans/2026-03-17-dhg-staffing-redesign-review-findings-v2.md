# DHG & Staffing Redesign — 7-Persona Review Synthesis

**Date:** 2026-03-17
**Input:** Elevated design spec reviewed by 7 specialized personas
**Purpose:** Distill actionable findings into fix-now vs defer decisions

---

## Executive Summary

7 independent reviewers analyzed the 2,304-line elevated design spec. They produced **78 total
findings**: 9 Critical, 32 Major, 18 Minor, 19 Notes. The findings cluster into 5 themes:

1. **Scope is too large** — 12 new models, 35 endpoints, 3 epics. PM and Devil's Advocate
   independently recommend cutting 40-50% for v1.
2. **3 calculation errors** — Pension mode is wrong (10x), HSA-as-capacity misleads coverage,
   SECTION driver semantics are ambiguous.
3. **Separate Vacancy model adds pain** — 4 of 7 reviewers recommend reverting to `recordType`
   on Employee.
4. **Frontend gaps** — Auto-suggest UI, demand override UX, workspace toggle behavior, and
   settings Tab 2 (full CRUD grid) are all under-specified.
5. **Domain data errors** — Mockup section counts wrong, fixture labels wrong, DOCUMENTALISTE
   profile missing.

---

## PART 1: CRITICAL FIXES (Must resolve before any implementation)

### C1: RESIDENT_PENSION Calculation Mode Is Wrong — 10x Error

**Raised by:** Financial Planner (F6)

The spec sets `RESIDENT_PENSION | PERCENT_OF_PAYROLL | 0.35`. But `PERCENT_OF_PAYROLL`
multiplies `subtotalGross` — which is LOCAL payroll (~2M SAR/month). Result: 0.35 × 2M =
700K SAR/MONTH = 8.4M SAR/YEAR. The actual pension is 837K SAR/YEAR.

The pension is 35% of RESIDENT salary, not local payroll. But resident salaries are not in
`subtotalGross` (AEFE_RECHARGE employees are skipped by the cost engine).

**Fix:** Change default to `FLAT_ANNUAL | 837000.0000`. If a percentage mode is needed later,
it must multiply the RESIDENT_SALAIRES category value, not `subtotalGross`. This requires a new
calculation mode (`PERCENT_OF_CATEGORY`) not currently defined.

---

### C2: HSA-as-Capacity Understates Hiring Need by 7.7%

**Raised by:** Financial Planner (F3)

`effectiveOrs = baseOrs + hsaTargetHours` (e.g., 18 + 1.5 = 19.5). This treats HSA as free
capacity: "each teacher covers 19.5h instead of 18h, so we need fewer teachers." But HSA is
EXTRA PAY for EXTRA HOURS — it is cost-increasing, not cost-neutral.

The coverage engine uses `requiredFtePlanned` for gap: `gapFte = coveredFte - planned`. With
5 teachers covering 5.14 raw FTE but only 4.74 planned FTE, coverage shows SURPLUS (+0.26)
when the curriculum actually needs 5.14 FTE worth of hours.

**Fix:** The gap calculation should use `requiredFteRaw` (curriculum demand) as the primary
coverage target, not `requiredFtePlanned` (HSA-adjusted). Show both in the grid:

- `Raw FTE` = curriculum hours / base ORS (actual hiring need)
- `Planned FTE` = curriculum hours / effective ORS (with HSA relief — informational only)
- `Gap` = covered FTE - raw FTE (actual coverage status)

The `requiredFtePlanned` column becomes a "what-if HSA" diagnostic, not the gap driver.

---

### C3: SECTION Driver FTE Semantics Are Ambiguous

**Raised by:** Financial Planner (F1)

For `driverType = SECTION`: `requiredFteRaw = totalDriverUnits` (1 FTE per section). This
is correct for homeroom (1 PE per section) and ASEM (1 assistant per section). But
`hoursPerUnit` is still computed into `totalWeeklyHours` which is then IGNORED for FTE.

If someone adds a specialist subject with `driverType = SECTION` and `hoursPerUnit = 3`, the
engine computes `totalWeeklyHours = 3 × sections` but FTE = sections (not hours/ORS). This
is confusing and error-prone.

**Fix:** Add a validation rule: when `driverType = SECTION`, `hoursPerUnit` must be 0
(or the field is ignored with a documented note). For specialist subjects that have per-section
hours but are NOT 1:1 staffed, use `driverType = HOURS`.

---

### C4: Mockup Section Counts Are Wrong

**Raised by:** School Director (F20)

The ASCII mockup shows PS=3, MS=3, GS=3 sections (total 9). But the fixture data shows:

- PS: 65 students / 24 max = CEIL(2.71) = **3 sections** (correct)
- MS: 77 students / 24 max = CEIL(3.21) = **4 sections** (mockup says 3)
- GS: 124 students / 24 max = CEIL(5.17) = **6 sections** (mockup says 3)

Total should be 13 sections, not 9. ASEM should be 13, not 9. This makes the mockup
misleading for anyone validating engine output.

**Fix:** Update Appendix A with correct section counts from fixture data.

---

### C5: Auto-Suggest UI Is Completely Missing

**Raised by:** Designer (I8), Developer (I6)

The spec defines `POST /staffing-assignments/auto-suggest` and `useAutoSuggestAssignments`
hook, but ZERO frontend specification exists for the review/accept/reject dialog. No component
file, no wireframe, no interaction pattern.

**Fix:** Either (a) design the auto-suggest acceptance dialog (a Sheet with a table of
proposed assignments, per-row accept/reject toggles, and confirm button), or (b) defer
auto-suggest to v1.1.

---

### C6: Phantom `recordType` Field

**Raised by:** Developer (I2)

Section 8.2 references `recordType` in the Employee API response. Section 15 Phase 3 says
"Populate `recordType = 'EMPLOYEE'`." But section 6.9 (Employee model) does NOT include
`recordType` — it was removed when the separate Vacancy model was introduced.

**Fix:** Remove all `recordType` references from sections 8.2, 15, and 7.2. The
employee/vacancy distinction is now by model, not by field.

---

## PART 2: STRUCTURAL DEBATES (Require your decision)

### D1: Separate Vacancy Model vs Employee recordType

| For Separate Model                                               | Against (recordType approach)                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Cleaner semantics — vacancies don't have encrypted salary fields | Doubles query complexity — every supply query must JOIN 2 tables    |
| No irrelevant fields (isSaudi, isAjeer, etc.)                    | XOR constraint on assignments is app-only (no DB enforcement)       |
|                                                                  | Coverage engine, auto-suggest, cost pipeline all need dual handling |
|                                                                  | Every form, hook, and test is doubled                               |

**Reviewers for separate model:** 1 (the decision you already made)
**Reviewers against:** Architect, Developer, Devil's Advocate, Product Manager

**Devil's Advocate's point:** "The Employee model already has 7 nullable fields. Two more is
not architecturally damaging."

**Architect's alternative:** Add `recordType: 'EMPLOYEE' | 'VACANCY'` to Employee. Make salary
fields nullable (they already are via `dbgenerated()`). Use Zod discriminated unions in request
schemas. This halves tables, eliminates XOR constraint, simplifies every query.

**Architect's additional finding:** Vacancy `estimatedSalary` is plain Decimal (not encrypted).
This creates a security inconsistency — anyone with DB access sees vacancy salaries but not
employee salaries.

---

### D2: Version-Scoped DhgRule vs Global with effectiveFromYear

| For Version-Scoped                               | Against (Global)                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Per-version curriculum adjustments for scenarios | 750 rows copied per version clone                                               |
| Can model "what if we add a specialty next year" | Curriculum changes are institutional — they don't vary between budget scenarios |
|                                                  | Clone transaction already 160+ lines, adding 750 more rows                      |
|                                                  | The v2 review document itself said "global is fine for v1"                      |

**Reviewers for version-scoped:** 1 (the decision you already made)
**Reviewers against:** Devil's Advocate, Architect

**Devil's Advocate's point:** "If the school adds a new specialty, it applies to ALL budget
versions for that year. That is what `effectiveFromYear` is for."

**Compromise:** Keep DhgRule global with enriched fields (lineType, driverType, serviceProfile).
If per-version overrides are needed later, add `DhgRuleOverride` — not a full 750-row copy.

---

### D3: Assignment Model Timing — v1 or v1.1?

| Ship in v1                                    | Defer to v1.1                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| The review's #1 critical finding (F1)         | The school has been running without it for years                         |
| Enables auditable coverage analysis           | 168 employees, most teach 1 subject — 1:1 match by discipline covers 90% |
| Foundation for auto-suggest, vacancy planning | Saves ~3 weeks of implementation                                         |

**Reviewers for v1:** Designer (implicitly), School Director (implicitly)
**Reviewers for defer:** Product Manager, Devil's Advocate

**PM's point:** "Ship the demand grid with correct FTE numbers first (P0). Then add
assignments and coverage (P1)."

**Devil's Advocate's alternative:** Match by `(homeBand, disciplineId)` on Employee. For the
5-10 shared teachers, add a `secondaryDisciplineId` field.

---

### D4: Full Scope (3 Epics) vs Phased Release (Ship Grid First)

**Product Manager and Devil's Advocate independently reached the same conclusion:**

> "Ship the demand grid in 3 weeks. Everything else is v2."

**Their proposed v1 (3 weeks):**

1. `DhgRule` (enriched from DhgGrilleConfig)
2. `VersionStaffingSettings` (consolidated settings)
3. `TeachingRequirementLine` (derived output)
4. 5 Employee field additions
5. Demand engine + updated cost engine
6. Teaching grid following enrollment pattern
7. Gap as `fteNeed - employeeCount(discipline, band)` — no assignment model

**The full spec as written:** 3-4 months at current velocity.

---

## PART 3: DOMAIN CORRECTIONS

| #   | Source          | Issue                                                                                   | Fix                                                                  |
| --- | --------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Director F8     | Terminale Arabic/Islamic labeled `[Specialite]` in fixture — should be `[Host-Country]` | Fix `fy2026-dhg-structure.json`                                      |
| 2   | Director F16    | Lycee "Heures d'autonomie" 12h/division — is this student hours or teacher DHG margin?  | Clarify in fixture; likely teacher allocation hours, not per-student |
| 3   | Director F19    | DOCUMENTALISTE (ORS=30h) missing from service profiles                                  | Add DOCUMENTALISTE profile or route to Support & Admin               |
| 4   | Director F10    | English in Maternelle — fixture has no Maternelle English data                          | Confirm hours with EFIR; add to DhgRule seed or remove from mockup   |
| 5   | Director F4     | Arabic/Islamic ORS may differ for secondary (18h vs 24h)                                | Confirm with EFIR HR                                                 |
| 6   | Fin. Planner F4 | 57.41 raw FTE → 63 rounded claim unverifiable from fixture                              | Verify against actual workbook DHG_Optimization sheet                |
| 7   | Director F17    | No LVB Arabe offering — confirm no Arabe LV2 at EFIR                                    | Confirm with school                                                  |

---

## PART 4: UX FIXES NEEDED

| #   | Source       | Issue                                                        | Recommended Fix                                                    |
| --- | ------------ | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | Designer I1  | KPI ribbon 6 cards breaks enrollment's 4-card grid           | Cap at 4 cards; move HSA/Recharge to inspector                     |
| 2   | Designer I2  | Workspace toggle: no panel clearing, KPI scoping, URL state  | Clear selection on switch; scope KPIs per workspace; add URL param |
| 3   | Designer I4  | Inspector 6 cards too dense; 2 variable-height tables        | Make driver breakdown collapsible; merge gap+cost cards            |
| 4   | Designer I5  | Settings Tab 2 is a full CRUD grid (not a settings tab)      | Extract to separate Sheet or page; leave 2 real settings tabs      |
| 5   | Designer I6  | Two supply forms with no decision tree                       | Single "Add Position" action that branches Employee vs Vacancy     |
| 6   | Designer I9  | Demand override has model but no interaction pattern         | Add "Override FTE" action in inspector gap card                    |
| 7   | Designer I10 | Gap status colors fail WCAG AA (color-only, red-green)       | Use text badges + icons instead of colored dots                    |
| 8   | Designer I7  | Coverage filter + Need view preset hides the filtered column | Force coverage column visible when coverage filter is active       |

---

## PART 5: IMPLEMENTATION GAPS

| #   | Source        | Issue                                                           | Fix                                                                                                                                    |
| --- | ------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Developer I1  | Version clone missing 7+ new tables                             | Add `seedVersionStaffingArtifacts()` helper to clone logic                                                                             |
| 2   | Architect I7  | 35 endpoints for one module (enrollment has 16)                 | Merge 4 settings endpoints into 1 composite `GET/PUT /staffing-config`                                                                 |
| 3   | Architect I8  | GET /teaching-requirements has N+1 query risk                   | Document 3-query batch strategy (lines, assignments+employees, group)                                                                  |
| 4   | Architect I12 | Vacancies excluded from cost pipeline entirely                  | Add vacancy cost estimation or document as "unfunded positions"                                                                        |
| 5   | Developer I4  | DHG Rules CRUD tab is a complex grid inside a Sheet             | Break into separate component; add to file inventory                                                                                   |
| 6   | Developer I5  | 14+ hooks in one file                                           | Split into 4-5 hook files                                                                                                              |
| 7   | Developer I7  | DemandOverride orphans when rules deleted                       | Emit ORPHANED_OVERRIDE warning in demand engine                                                                                        |
| 8   | Developer I9  | No test scenario matrix                                         | Create matrix with 10 critical financial test cases                                                                                    |
| 9   | Developer I10 | No migration rollback strategy                                  | Wrap Phase 3 in transaction; add verification queries                                                                                  |
| 10  | Developer I11 | 12 files referencing `'DHG'` stale module not in Modified Files | Add to file inventory                                                                                                                  |
| 11  | Architect I1  | 3 models can be merged or eliminated                            | Merge VersionServiceProfileOverride into settings JSON; fold LyceeGroupAssumption into DhgRule; move DisciplineAlias to migration-only |

---

## PART 6: FINANCIAL ACCURACY FIXES

| #   | Source           | Issue                                                                  | Fix                                                         |
| --- | ---------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | Fin. Planner F6  | RESIDENT_PENSION mode is PERCENT_OF_PAYROLL on wrong base (10x error)  | Change to FLAT_ANNUAL 837000                                |
| 2   | Fin. Planner F3  | Gap uses planned FTE (HSA-adjusted) — understates hiring need          | Use raw FTE for gap calculation                             |
| 3   | Fin. Planner F1  | SECTION driver hoursPerUnit is computed but ignored for FTE            | Add validation: SECTION + hoursPerUnit > 0 is an error      |
| 4   | Fin. Planner F5  | Cost attribution splits Ajeer/EoS (per-person) by FTE share (per-hour) | Document as accepted approximation or split only gross+GOSI |
| 5   | Fin. Planner F8  | Mid-year hires show full FTE coverage but 33% annual cost              | Add "Starts Sep" indicator on mid-year positions            |
| 6   | Fin. Planner F10 | No reconciliation view for known HSA and pension gaps                  | Add reconciliation section to inspector or settings sheet   |

---

## RECOMMENDED ACTION PLAN

### Immediate Fixes (before any implementation starts)

1. Fix pension mode: `FLAT_ANNUAL | 837000` (C1)
2. Fix gap calculation to use raw FTE (C2)
3. Add SECTION driver validation (C3)
4. Fix mockup section counts (C4)
5. Remove phantom `recordType` references (C6)
6. Fix fixture: Terminale Arabic/Islamic labels

### Decisions Needed From You

1. **Vacancy model:** Revert to Employee `recordType` (simpler) or keep separate model?
2. **DhgRule scope:** Revert to global with `effectiveFromYear` or keep version-scoped?
3. **Assignment model:** Ship in v1 or defer to v1.1?
4. **Overall scope:** Ship the full 3-epic spec or cut to demand-grid-first MVP?
5. **DemandOverride:** Keep in v1 or defer?
6. **Auto-suggest:** Design now or defer to v1.1?

### If You Choose the MVP Path (Recommended)

**v1.0 (3 weeks):** Demand grid + settings + cost engine updates

- Models: DhgRule (global), VersionStaffingSettings, TeachingRequirementLine, TeachingRequirementSource + Employee extensions
- Endpoints: ~12 (vs 35)
- Frontend: Teaching grid + KPI + status strip + 2-tab settings
- No assignments, no vacancies, no overrides, no auto-suggest
- Gap computed from `employeeCount(discipline, band)` — simple match

**v1.1 (2 weeks):** Assignment model + coverage engine

- Models: StaffingAssignment + coverage engine
- Gap computed from explicit assignments

**v1.2 (2 weeks):** Vacancy, overrides, auto-suggest, Support & Admin workspace

- Models: remaining deferred models
- Full feature set

---

_This document synthesizes findings from 7 independent persona reviews. Raw findings are
preserved in the individual agent outputs for reference._
