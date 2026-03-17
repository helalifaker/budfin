# DHG & Staffing Redesign — Pre-Implementation Verification Report

**Date:** 2026-03-17
**Reviewer role:** Principal Staff Engineer + Product Architect + QA/Controls Lead + Finance Systems Auditor
**Documents reviewed:**

- `2026-03-17-dhg-staffing-redesign.md` (Elevated Design Spec — 2,278 lines)
- `2026-03-17-dhg-staffing-redesign-review-findings.md` (V1 Review Findings — 15 findings)
- `2026-03-17-dhg-staffing-redesign-v2.md` (Review-Driven Target Design — 780 lines)
- `2026-03-17-dhg-staffing-redesign-review-findings-v2.md` (7-Persona Review Synthesis — 78 findings)
- Current codebase: `schema.prisma`, `cost-engine.ts`, `dhg-engine.ts`, `monthly-gross.ts`, `category-cost-engine.ts`

---

## 1. Executive Verdict

**Verdict:** `SAFE WITH CONDITIONS`
**Confidence:** 72/100

The elevated design spec is architecturally sound and represents a significant improvement over both the original draft and the current application. The five critical weaknesses identified in the V1 review — planning grain, assignment model, HSA semantics, taxonomy governance, and cost model flexibility — are all addressed with defensible solutions.

However, implementation is NOT safe until 14 specific conditions are met. Seven are blocking issues that will produce wrong numbers, broken queries, or silent data loss if not resolved. Seven are high-risk ambiguities that will cause implementation divergence between engineers.

The spec's greatest strength is its calculation engine design — the demand/coverage/cost pipeline is well-specified with explicit formulas and algorithm pseudocode. Its greatest weakness is scope: at 12 new models, ~35 endpoints, and 3 epics, the probability of delivering all of this without rework is low. The 7-persona review's recommendation to phase into v1.0/v1.1/v1.2 is sound but requires explicit design cuts — not just scope deferrals.

---

## 2. Traceability Matrix

### V1 Findings → Elevated Spec Resolution

| Finding | Risk Summary                                            | Spec Section(s)                              | Resolution  | Comments                                                                                                                                                                                                                                                                                         |
| ------- | ------------------------------------------------------- | -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1      | No assignment model between demand and supply           | 6.10, 7.2, 8.1 (assignment CRUD)             | **FULL**    | StaffingAssignment introduced as FK-enforced entity with (band, disciplineId) stable key. Coverage engine joins by code at calc time. Design explicitly decouples user-created assignments from recalculated demand lines.                                                                       |
| F2      | Subject-first row model wrong for primary/support       | D8, 6.12, 7.1 (band mapping)                 | **FULL**    | Requirement lines with variable grain per band: section-driven for Maternelle/Elementaire homeroom, hours-driven for secondary subjects, group-driven for Lycee specialties. Support/admin in separate workspace.                                                                                |
| F3      | HSA oversimplified — mixes planning policy with payroll | D5, 6.5, 7.3, 7.1 (effectiveORS)             | **FULL**    | Dual model: planning HSA policy adjusts effectiveORS for demand FTE; payroll HSA engine computes per-employee cost amount. Both preserved. Eligibility governed by ServiceObligationProfile.hsaEligible.                                                                                         |
| F4      | DhgGrilleConfig structurally insufficient               | D3, 6.4 (DhgRule)                            | **FULL**    | DhgRule replaces DhgGrilleConfig with lineType, driverType, serviceProfileId, disciplineId, languageCode, groupingKey, effectiveYear range. Global scope (not version-scoped) with clear rationale.                                                                                              |
| F5      | Subject-level rounding inflates staffing need           | D9, 7.1 (algorithm), Appendix D              | **FULL**    | Raw FTE and recommendedPositions explicitly separated. Grid totals sum raw FTE, not rounded positions. Formula: `recommendedPositions = CEIL(requiredFteRaw)` per line only.                                                                                                                     |
| F6      | Additional cost defaults unsupported by workbook        | D10, 6.7 (cost assumptions)                  | **FULL**    | Three calculation modes (FLAT_ANNUAL, PERCENT_OF_PAYROLL, AMOUNT_PER_FTE). Rates corrected to workbook evidence (1.13%, 1.27%). No hardcoded defaults.                                                                                                                                           |
| F7      | Source workbook omits pension in annual summary         | 6.7 (RESIDENT_PENSION), 6.13                 | **PARTIAL** | RESIDENT_PENSION added as 5th category with FLAT_ANNUAL                                                                                                                                                                                                                                          | 837000. But no explicit reconciliation view, no UI component for cross-referencing the pension gap between workbook summary sheets, and no acceptance criterion for pension reconciliation sign-off. |
| F8      | Primary specialist coverage under-modeled               | D8, Q1 (resolved), Q7 (resolved)             | **PARTIAL** | Decision taken: English/Arabic/Islamic are specialist-covered in Maternelle and Elementaire. DhgRule seed includes these. But exact hours per grade for English are listed as "implementation confirmation #2" — still unresolved. Maternelle English appears in mockup but fixture has no data. |
| F9      | Source taxonomies too inconsistent for free-text        | D4, 6.2, 6.3 (Discipline/Alias)              | **FULL**    | Controlled Discipline taxonomy with alias normalization table. Migration strategy includes alias mapping phase. All mapping-critical fields use FK-enforced codes.                                                                                                                               |
| F10     | Non-teaching mixed into teaching grid                   | D6, 9.1 (workspace toggle), 9.4              | **FULL**    | Two workspace modes: Teaching and Support & Admin. Separate grids with different row semantics. Shared KPI ribbon and settings.                                                                                                                                                                  |
| F11     | DhgSubjectSummary / DhgGradeDetail keys insufficient    | 6.12 (TeachingRequirementLine unique key)    | **FULL**    | Unique key: (versionId, band, disciplineCode, lineType). Structured identifiers, not subject text alone.                                                                                                                                                                                         |
| F12     | Under-specified on controls, audit, edge cases          | 13.1, 13.2, 13.3                             | **FULL**    | 9 mandatory validations, 6 warning conditions, 4 audit requirements. Calculation run headers, assignment CRUD logging, settings change logging.                                                                                                                                                  |
| F13     | Legacy AEFE workbook hidden-sheet dependencies          | 5.6 (preserve/eliminate table), 15.1         | **PARTIAL** | Design principle eliminates hidden-sheet dependencies. But no explicit migration error handling for `#N/A` formula chains — no exception queue, no review process for unresolvable legacy references.                                                                                            |
| F14     | AY2 demand vs Jan-Dec cost timing implicit              | Target design 8.7, Q4 (AY2 only for v1)      | **PARTIAL** | Decision: AY2 only for v1. Status strip shows enrollment source timestamp. But no explicit UI indicator showing "This demand is for Academic Year 2 (Sep-Jun)" — the user must infer this from context.                                                                                          |
| F15     | Residents and recharge costs need flexible cost-mode    | 6.9 (costMode field), 6.7 (assumption modes) | **FULL**    | Three employee cost modes (LOCAL_PAYROLL, AEFE_RECHARGE, NO_LOCAL_COST). Category cost assumptions with configurable calculation modes.                                                                                                                                                          |

### V2 (7-Persona) Findings — Status in Elevated Spec

| Finding | Summary                                          | Status in Elevated Spec | Comments                                                                                                                                                                                                                             |
| ------- | ------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1      | RESIDENT_PENSION 10x error                       | **ALREADY FIXED**       | Section 6.7 seed table correctly shows `FLAT_ANNUAL \| 837000.0000` with explicit note explaining why PERCENT_OF_PAYROLL cannot be used.                                                                                             |
| C2      | Gap uses planned FTE, understates hiring need    | **ALREADY FIXED**       | Section 7.2 algorithm explicitly states `gapFte = coveredFte - line.requiredFteRaw` with comment "Use RAW FTE (curriculum need), not planned (HSA-adjusted)".                                                                        |
| C3      | SECTION driver hoursPerUnit computed but ignored | **NOT FIXED**           | No validation rule preventing `driverType = SECTION` + `hoursPerUnit > 0`. The spec computes totalWeeklyHours but ignores it for FTE. Confusing and error-prone.                                                                     |
| C4      | Mockup section counts wrong                      | **NOT FIXED**           | Cosmetic but misleading. PS should be 3, MS should be 4, GS should be 6 per fixture data. ASEM should be 13, not 9.                                                                                                                  |
| C5      | Auto-suggest UI missing                          | **FIXED**               | Section 12.3 provides full dialog specification with table, per-row accept/reject, confirm button.                                                                                                                                   |
| C6      | Phantom recordType field                         | **NOT APPLICABLE**      | The elevated spec consistently uses `recordType` on Employee (section 6.9). C6 appears to reference a different draft version that introduced a separate Vacancy model. The elevated spec uses the `recordType` approach throughout. |
| D1      | Vacancy model debate                             | **RESOLVED**            | Elevated spec uses Employee with `recordType` field. Consistent approach.                                                                                                                                                            |
| D2      | DhgRule scope debate                             | **RESOLVED**            | Global with effectiveFromYear. Rationale is sound.                                                                                                                                                                                   |
| D3      | Assignment timing debate                         | **DESIGN CHOICE**       | Full assignment model included in spec. Whether to phase is a scope decision, not a correctness issue.                                                                                                                               |
| D4      | Full scope vs phased                             | **SCOPE DECISION**      | 7-persona MVP recommendation is sound but not reflected in the spec.                                                                                                                                                                 |

---

## 3. Missing Requirements

### MR-01: DemandOverride Cannot Target LineType

**Severity:** High
**Area:** Data model, calculation engine
**Issue:** `DemandOverride` is uniquely keyed by `(versionId, band, disciplineId)`. But `TeachingRequirementLine` is uniquely keyed by `(versionId, band, disciplineCode, lineType)`. If a discipline has two lines with different lineTypes in the same band (e.g., Arabic with both STRUCTURAL and HOST_COUNTRY rows), the override cannot distinguish between them. The override applies to "Arabic in College" but there could be two Arabic lines in College.
**Why it matters:** An override intended for one line would incorrectly apply to or conflict with another. The engine behavior is undefined.
**Recommendation:** Add `lineType` to the DemandOverride unique key: `(versionId, band, disciplineId, lineType)`. Alternatively, if lineType overlap per (band, discipline) is architecturally prevented, document this constraint explicitly and add a validation rule.

### MR-02: StaffingAssignment Cannot Target LineType

**Severity:** Medium
**Area:** Data model, coverage engine
**Issue:** `StaffingAssignment` is keyed by `(versionId, employeeId, band, disciplineId)`. The coverage engine matches assignments to requirement lines by `(band, disciplineCode)`. If two requirement lines exist for the same discipline in the same band with different lineTypes, assignments cannot be directed to a specific line — they cover both indiscriminately.
**Why it matters:** For subjects like Arabic that could theoretically appear as both STRUCTURAL and HOST_COUNTRY, assignment coverage becomes ambiguous.
**Recommendation:** Confirm whether any (band, discipline) pair can have multiple lineTypes. If yes, add `lineType` to the assignment key. If no (which is likely the case), add a DhgRule validation: at most one lineType per (gradeLevel, disciplineId, band).

### MR-03: Version Clone Logic Unspecified

**Severity:** High
**Area:** Data model, API
**Issue:** The spec adds 10+ new version-scoped entities but does not specify version clone behavior. When a BudgetVersion is cloned, which of the following are copied?

- VersionStaffingSettings (likely yes)
- VersionServiceProfileOverride (likely yes)
- VersionStaffingCostAssumption (likely yes)
- VersionLyceeGroupAssumption (likely yes)
- StaffingAssignment (likely yes — user input)
- DemandOverride (likely yes — user input)
- TeachingRequirementSource (likely no — derived)
- TeachingRequirementLine (likely no — derived)
- Employee records (existing clone logic)
  **Why it matters:** Missing clone logic for any user-input table means cloned versions start empty, forcing re-entry. Missing clone logic for derived tables is correct but should be explicit (mark STAFFING stale on clone).
  **Recommendation:** Add a "Version Clone" section specifying exactly which tables are copied, which are marked stale, and the clone transaction sequence. Add to the file inventory.

### MR-04: SECTION Driver Validation Missing

**Severity:** Medium
**Area:** Calculation engine, DhgRule integrity
**Issue:** When `driverType = SECTION`, the engine sets `requiredFteRaw = totalDriverUnits` (ignoring hours and ORS). But `hoursPerUnit` is still populated and `totalWeeklyHours` is still computed. If a future admin creates a rule with `driverType = SECTION` and `hoursPerUnit = 3`, the computed hours are discarded — misleading and potentially wrong.
**Why it matters:** A misconfigured rule silently produces FTE that ignores hours/ORS entirely. There is no guard or warning.
**Recommendation:** Add a validation rule on DhgRule creation/update: when `driverType = SECTION`, `hoursPerUnit` must be 0 (or is stored but explicitly documented as "informational only, not used for FTE"). Alternatively, for SECTION driver, do not compute `totalWeeklyHours` at all.

### MR-05: AMOUNT_PER_FTE Mode — Which FTE?

**Severity:** Medium
**Area:** Calculation engine, cost model
**Issue:** The category cost formula for `AMOUNT_PER_FTE` is `monthlyAmount = (value × totalTeachingFte) / 12`. The input `totalTeachingFte` is not defined as raw or planned. Raw and planned FTE differ by 5-8% (e.g., 89.63 raw vs 85.12 planned in the mockup).
**Why it matters:** A 5-8% difference in the FTE basis produces a proportional cost difference. For a 100K SAR/FTE category, this is ~4,500 SAR/year.
**Recommendation:** Explicitly specify that `totalTeachingFte` uses `requiredFteRaw` (curriculum demand) not `requiredFtePlanned` (HSA-adjusted). Document this in section 7.5 and in the formula appendix.

### MR-06: No Reconciliation View for Known Workbook Inconsistencies

**Severity:** Medium
**Area:** UX, auditability, acceptance criteria
**Issue:** Finding F7 identified that the source payroll workbook omits pension from its own annual summary (837K SAR gap). Finding F3 in the V1 review identified HSA total discrepancies (57,424 SAR vs 60,024 SAR between workbooks). The spec acknowledges these but provides no UI reconciliation view.
**Why it matters:** Without an explicit reconciliation comparison, the team cannot validate workbook parity claims. Acceptance criterion #11 says "Source workbook reconciliation exposes and resolves the known pension and HSA inconsistencies" but no component, endpoint, or data structure supports this.
**Recommendation:** Add a reconciliation section to the settings sheet or inspector. Minimum: a table comparing (a) app-computed annual totals by category vs (b) baseline workbook totals, with delta and explanation columns. Define the workbook baseline values as seed data or configuration.

### MR-07: No Migration Exception Queue

**Severity:** Medium
**Area:** Migration, data quality
**Issue:** Phase 3 migration populates `serviceProfileId` from department/role heuristics and `disciplineId` from alias tables. But the spec provides no mechanism for handling records that don't match any heuristic or alias.
**Why it matters:** Unmatched records will either fail silently (null FK) or hard-fail the migration. Either outcome is unacceptable without a review process.
**Recommendation:** Add a migration exception queue: records that cannot be auto-mapped are collected into a review table/log with source values, attempted match, and reason for failure. After migration, the operator reviews and manually resolves exceptions before marking migration complete.

### MR-08: AGREGE vs CERTIFIE Distinction in Migration

**Severity:** Medium
**Area:** Migration, data quality
**Issue:** Phase 3 migration uses heuristics to assign service profiles. The catch-all for teaching staff is `isTeaching = true → CERTIFIE`. But AGREGE teachers (15h ORS) exist in French schools and have different ORS. No heuristic exists to distinguish them.
**Why it matters:** If AGREGE teachers are assigned the CERTIFIE profile (18h ORS), their FTE demand and HSA calculations will be wrong by 16.7%.
**Recommendation:** Add a migration mapping rule that identifies AGREGE teachers. Options: (a) use a department/role keyword match, (b) use a manual override list, or (c) default to CERTIFIE and flag for post-migration review. Document which approach is used.

### MR-09: Support/Admin Demand Model Unspecified

**Severity:** Low (for v1)
**Area:** Business logic, UX
**Issue:** The teaching workspace has a full demand-coverage-cost pipeline. The support/admin workspace has only an employee list grouped by department. There is no demand model for support staff — no target headcount, no FTE budget, no gap analysis.
**Why it matters:** Planners cannot identify whether support/admin staffing is over or under target without a demand baseline. This is acceptable for v1 but should be acknowledged as a known gap.
**Recommendation:** Document this as an explicit v2 scope item. For v1, the support/admin workspace is a cost visibility tool, not a demand planning tool. Add a note in the guide content.

### MR-10: Vacancy Cost Estimation Missing

**Severity:** Medium
**Area:** Cost model, UX
**Issue:** Vacancies have `recordType = VACANCY` and nullable salary fields. The cost engine skips employees with no salary data. But vacancies represent planned hires — their cost impact should be estimable.
**Why it matters:** Without vacancy cost estimation, the total staff cost underestimates the actual budget need. A planner adds 5 vacancies but sees no cost impact.
**Recommendation:** Either (a) allow estimated salary on vacancies (Zod schema accepts optional salary for VACANCY records), or (b) use average cost by service profile as a vacancy cost proxy, or (c) document vacancies as "unfunded positions" and add a warning indicator.

### MR-11: Orphaned Assignment Cleanup Undefined

**Severity:** Low
**Area:** Data integrity
**Issue:** When DhgRules change or enrollment drops to zero for a grade, requirement lines may disappear. Assignments referencing `(band, disciplineId)` combinations that no longer have requirement lines become orphaned. The spec warns about this but doesn't define cleanup behavior.
**Why it matters:** Orphaned assignments consume employee FTE that is no longer counted toward any demand line. Over time, this corrupts coverage metrics.
**Recommendation:** Add explicit behavior: orphaned assignments are flagged as warnings (already done) AND are excluded from the coverage total for that employee. Alternatively, soft-delete orphaned assignments after 2 consecutive calculations with no matching demand line.

---

## 4. Regression Risk Register

| Risk ID | Area                                  | Description                                                                                                                    | Probability | Impact                                                          | Detection                                                                                  | Mitigation                                                                                        | Blocker? |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------- |
| R-01    | Cost engine                           | `costMode` branching skips real employees if field is incorrectly populated during migration                                   | Medium      | Critical — zero cost for affected employees                     | Unit test: employee with costMode=LOCAL_PAYROLL must produce non-zero cost                 | Migration verification query: count employees by costMode, validate against expected distribution | Yes      |
| R-02    | Category cost engine                  | Migration from `system_config` to `VersionStaffingCostAssumption` produces wrong values (rate vs amount confusion)             | Medium      | High — 10x category cost error possible                         | Integration test: compare category cost totals before/after migration for the same version | Pre/post migration reconciliation check                                                           | Yes      |
| R-03    | Stale module propagation              | 'DHG' stale module removed, merged into 'STAFFING'. Code still referencing 'DHG' will silently fail                            | High        | Medium — stale warnings not shown                               | `grep -r "'DHG'" apps/` — find all references                                              | Comprehensive code search and replacement before merge                                            | Yes      |
| R-04    | Employee import                       | New required fields (disciplineId, serviceProfileId, homeBand) may break existing import templates                             | Medium      | Medium — import fails for all users until template updated      | Integration test: import existing template format, verify graceful handling                | Backward-compatible import: new fields optional, resolved via alias table if missing              | No       |
| R-05    | DhgRequirement deprecation            | Any code reading from deprecated `DhgRequirement` during transition gets stale data                                            | Medium      | Medium — UI shows old per-grade FTE instead of new per-line FTE | Grep for all `DhgRequirement` references                                                   | Add deprecation warning to model. Remove all read references in the same PR.                      | No       |
| R-06    | Employee form changes                 | New conditional visibility rules may hide required fields or show wrong sections                                               | Low         | Medium — data entry errors                                      | UI test matrix: all combinations of recordType × costMode × isTeaching                     | Test each form variant in Vitest + manual QA                                                      | No       |
| R-07    | Calculation pipeline atomicity        | New pipeline is 10 steps in one transaction. Partial failure leaves version in inconsistent state                              | Low         | Critical — corrupted calculation output                         | Integration test: inject failure at each step, verify rollback                             | Wrap in `$transaction` (already specified). Add explicit verification query post-commit.          | No       |
| R-08    | HSA amount computation                | `hsaAmount` field changes from user-entered to computed. If the computation path is wrong, all HSA costs are wrong             | Medium      | High — incorrect payroll for all HSA-eligible staff             | Unit test: HSA engine output matches manual calculation for known inputs                   | Compare HSA totals against workbook baseline (57,424 SAR/month)                                   | Yes      |
| R-09    | MonthlyBudgetSummary (P&L)            | Staffing cost total may change due to pension addition and cost assumption changes. P&L downstream may break if format changes | Low         | Medium — P&L summary incorrect                                  | Integration test: calculate staffing + verify P&L summary reflects new totals              | Mark PNL stale after staffing recalculation (already specified)                                   | No       |
| R-10    | Existing enrollment-to-staffing chain | Enrollment changes mark STAFFING stale (new). If this trigger is not implemented, staffing data becomes silently stale         | Medium      | High — planning decisions based on stale data                   | Integration test: change enrollment headcount, verify STAFFING appears in staleModules     | Implement stale trigger in same PR as demand engine                                               | Yes      |

---

## 5. Data Accuracy & Calculation Integrity Review

### 5.1 Demand Model

**Correct:**

- Section-driven demand for primary homeroom (FTE = sections, 1:1 staffing) — matches source workbook
- Hours-driven demand for secondary subjects (FTE = totalHours / ORS) — matches DHG methodology
- Group-driven demand for Lycee specialties — correctly defers to VersionLyceeGroupAssumption
- Requirement source rows preserve per-grade granularity; requirement lines aggregate to planning grain
- Band mapping from grade codes is complete (15 grades → 4 bands)

**Risky:**

- SECTION driver computes `totalWeeklyHours` but ignores it for FTE. This is architecturally correct for homeroom/ASEM but creates a silent discard path if misused for other line types. **Risk: Medium.**
- Elementaire specialist demand uses `driverType = HOURS` with PE service profile (24h ORS). English specialist with 8h/week across 14 sections = 112h/week → 112/24 = 4.67 FTE. But the mockup shows 0.33 FTE for English (8h/24h). This implies `hoursPerUnit = 8` means 8h total, not per section. The formula `totalWeeklyHours = driverUnits × hoursPerUnit` where `driverUnits = sectionsNeeded` would give 8 × 14 = 112h. The mockup is wrong OR `driverUnits` for specialists should not be sections. **Risk: High — potential 10x FTE error for primary specialists.**

**Missing:**

- Explicit definition of `hoursPerUnit` for primary specialist rules: is it per section or per band/grade? The DHG workbook likely specifies total band hours for primary specialists, not per-section hours. If so, `driverType` should be `HOURS` but `driverUnits` should be 1 (the band), not sections. This needs DhgRule configuration clarity.
- No zero-demand suppression threshold. If a rule produces 0.01 FTE, it creates a requirement line. Should there be a minimum FTE threshold below which lines are suppressed from the grid?

**Must be tested:**

- Verify primary homeroom FTE = sections for all Maternelle/Elementaire grades
- Verify secondary subject FTE matches DHG workbook per-subject totals
- Verify total raw FTE matches workbook's 57.41 (secondary only) or ~89.63 (all teaching)
- Verify ASEM demand = Maternelle sections only, not Elementaire
- Verify specialist demand in primary uses correct interpretation of hoursPerUnit

### 5.2 Coverage Model

**Correct:**

- Assignment-based coverage eliminates free-text discipline matching
- Coverage gap uses `requiredFteRaw` (curriculum need), not planned FTE — correctly follows the V2 fix
- Over-assignment validation prevents assigning more than 100% of an employee's availability
- Orphaned assignment detection catches demand-line removal

**Risky:**

- Coverage matching by `(band, disciplineCode)` ignores `lineType`. If Arabic in College has both STRUCTURAL (e.g., Arabic language) and HOST_COUNTRY (e.g., Arabic regulatory) lines, an assignment to "Arabic, COLLEGE" covers both indiscriminately. Coverage FTE would be split how? **Risk: Medium — depends on whether this case actually occurs.**
- `coveredFte = SUM(fteShare)` from assignments. But `fteShare` is user-entered (Decimal). If a user enters `fteShare = 1.0` for a part-time teacher (hourlyPercentage = 0.5), the over-assignment validation catches it. But if `fteShare` is 0.5 and the teacher has another 0.5 assignment to a different line, both show as partially covered. The semantics of `fteShare` need clearer documentation: is it relative to the employee's total capacity or absolute?

**Missing:**

- No coverage for AEFE_RECHARGE employees. They have `costMode = AEFE_RECHARGE` and are skipped by the cost engine, but can they have assignments? The spec says "only employees with `isTeaching = true` can be assigned." AEFE_RECHARGE teachers are teaching staff with no local salary — they should be assignable. Confirm this is the case and that coverage correctly counts them even though cost is zero.
- No handling for departing employees. `status = 'Departed'` employees are excluded from cost engine (existing behavior). But are they excluded from coverage? If not, a departed teacher's assignments still count as coverage, inflating covered FTE.

**Must be tested:**

- Assignment to a line that has SECTION driver: verify coveredFte is computed correctly (FTE share, not hours)
- Multi-line assignment for a single teacher: verify total FTE across assignments ≤ hourlyPercentage
- Departed employee exclusion from coverage totals
- AEFE_RECHARGE employee assignment and coverage counting

### 5.3 HSA Model

**Correct:**

- Dual model: planning HSA policy (effectiveORS) separated from payroll HSA cost (per-employee amount)
- HSA eligibility by service profile: PE and ARABIC_ISLAMIC excluded, CERTIFIE/AGREGE/EPS included — matches source data
- HSA cost formula: `firstHourRate + max(0, hsaTarget - 1) × additionalRate` — structurally sound
- Jul-Aug exclusion preserved in existing monthly-gross.ts (months 7-8)
- HSA months default = 10 (12 - 2 summer months)

**Risky:**

- The HSA engine computes a **uniform** cost per eligible teacher based on the planning policy. But the source HSA workbook shows **person-level** HSA amounts that vary. The spec says `hsaCostPerMonth` is written to the employee's `hsaAmount` encrypted field. This overwrites any previously stored person-level amount. **Risk: Medium — acceptable for planning but loses historical payroll data if employee records were imported with actual HSA amounts.**
- HSA cost per teacher is `500 + max(0, 0.5) × 400 = 700 SAR/month`. For 10 months = 7,000 SAR/year. The mockup shows 158K total HSA for ~89 FTE teaching. At 7,000/teacher, this implies ~22.6 eligible teachers. But if CERTIFIE + AGREGE + EPS teachers are ~57 FTE (secondary only), this doesn't reconcile. **Risk: Low — mockup numbers may be illustrative, not calculated.**

**Missing:**

- No per-employee HSA override. The spec says HSA amount is computed-only (section 6.9: "the POST/PUT employee Zod request schemas must strip hsaAmount"). But the V1 review (F3) explicitly recommended allowing "line-level or supply-level override only with reason and audit trail." The elevated spec omits this override capability.
- No HSA reconciliation view showing app-computed HSA totals vs workbook HSA totals (57,424 or 60,024 SAR/month).

**Must be tested:**

- HSA cost for PE teacher = 0 (not eligible)
- HSA cost for CERTIFIE teacher = 700 SAR/month (with default settings)
- HSA amount in months 7-8 = 0 for teaching staff
- Total HSA budget reconciles to expected range (57K-60K SAR/month)
- Changing hsaTargetHours setting changes both effectiveORS (demand) and per-teacher cost

### 5.4 Cost Model

**Correct:**

- Existing cost engine preserved: GOSI (11.75% Saudi), Ajeer, EoS (YEARFRAC 30/360), augmentation (Sep+), Jul-Aug HSA exclusion
- costMode branching: LOCAL_PAYROLL → full calculation, AEFE_RECHARGE → zero-cost rows, NO_LOCAL_COST → skip entirely
- Category cost engine supports three configurable modes with explicit formulas
- RESIDENT_PENSION correctly set to FLAT_ANNUAL (not PERCENT_OF_PAYROLL — C1 already fixed)
- Direct cost attribution to requirement lines via assignment FTE share

**Risky:**

- Cost attribution formula: `directCostAnnual = SUM(monthlyStaffCost.totalCost × assignment.fteShare)`. This splits ALL cost components (including Ajeer and EoS, which are per-person, not per-hour) by FTE share. A teacher with 0.5 FTE assignment to line A and 0.5 to line B would split their Ajeer levy 50/50 — this is mathematically acceptable but not strictly accurate since Ajeer is a per-person fee regardless of hours taught. **Risk: Low — accepted approximation.**
- The `subtotalGross` basis for PERCENT_OF_PAYROLL mode: the current `category-cost-engine.ts` uses `monthlySubtotals` = Map<month, Decimal> of `adjusted_gross`. After the redesign, this must include ONLY LOCAL_PAYROLL employees (AEFE_RECHARGE employees are skipped). If the calculation orchestration passes all employees' gross into the subtotal, recharge categories will be inflated. **Risk: Medium.**

**Missing:**

- No `PERCENT_OF_CATEGORY` calculation mode. The pension is 35% of resident salary recharge. Currently handled as FLAT_ANNUAL (acceptable for v1). But if resident salary amounts change, pension doesn't auto-adjust. Document this as a known limitation.
- Vacancy cost estimation (see MR-10).

**Must be tested:**

- End-to-end cost: known employee inputs → verify monthly cost matches existing engine output (regression)
- AEFE_RECHARGE employee produces zero MonthlyStaffCost rows
- NO_LOCAL_COST employee produces no output at all
- Category cost with FLAT_ANNUAL: 837000 / 12 = 69,750 SAR/month
- Category cost with PERCENT_OF_PAYROLL: verify subtotalGross excludes AEFE_RECHARGE employees
- Total annual staff cost matches expected range from workbook

### 5.5 Reconciliation Model

**Correct:**

- Pension treatment acknowledged as workbook inconsistency
- HSA discrepancy (57,424 vs 60,024 SAR) acknowledged in source evidence

**Risky:**

- No structured reconciliation process. Acceptance criterion #11 requires reconciliation but no tooling supports it.

**Missing:**

- Workbook baseline values not stored in the system. There is no table or configuration holding the "expected" workbook totals to compare against.
- No reconciliation report endpoint or UI component.
- No tolerance definition for "acceptable parity" — is ±1% acceptable? ±5%?

**Must be tested:**

- Define 5 reconciliation checkpoints with expected values before implementation starts
- After implementation, run reconciliation and document all deltas

### 5.6 Rounding Model

**Correct:**

- Raw FTE and recommendedPositions are separate fields on TeachingRequirementLine
- Formula: `recommendedPositions = CEIL(requiredFteRaw)` per line
- Grid totals sum raw FTE, not rounded positions
- Design explicitly warns against summing rounded positions (F5 finding fully addressed)

**Risky:**

- The mockup (Appendix A) shows a "Pos" column in the total row with value "94". This appears to be `SUM(CEIL(rawFTE per line))` — i.e., the sum of rounded positions. This contradicts principle 5. **Risk: Low — mockup is illustrative, but it sets wrong expectations for QA.**

**Must be tested:**

- Verify: `SUM(requiredFteRaw)` ≠ `SUM(recommendedPositions)` for secondary subjects (57.41 raw vs 63 rounded per workbook evidence)
- Verify total row shows `totalFteRaw` not `SUM(recommendedPositions)`

### 5.7 Timing Model

**Correct:**

- AY2-only demand for v1 (decision Q4)
- Cost engine remains fiscal-year (Jan-Dec) monthly
- New employees with `status = 'New'` correctly apply Sep+ augmentation and Sep+ Ajeer
- HSA Jul-Aug exclusion preserved

**Risky:**

- No explicit linkage between "when a vacancy is needed" and "which months incur cost." A vacancy with `status = New` and no `joiningDate` implies Sep start. But the spec doesn't clarify the default joiningDate for vacancies.

**Missing:**

- No UI indicator showing "AY2 demand surface" to the planner
- No data model support for AY1 demand snapshot (documented as v2 but no schema placeholder)

---

## 6. Schema & Architecture Review

### 6.1 Entity Design

| Entity                        | Assessment            | Notes                                                                                                                                                              |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ServiceObligationProfile      | **Solid**             | Well-designed master data. Seed data covers all known profiles. 7 profiles including DOCUMENTALISTE (added after V2 review).                                       |
| Discipline                    | **Solid**             | Controlled taxonomy with three categories (SUBJECT, ROLE, POOL). Covers 18 seed entries. May need expansion for niche subjects.                                    |
| DisciplineAlias               | **Solid**             | Clean normalization layer. Alias → disciplineId mapping. Unique alias constraint prevents collisions.                                                              |
| DhgRule                       | **Solid**             | Rich rule catalog replacing DhgGrilleConfig. Effective year range for temporal validity. Global scope is correct. Unique key covers all dimensions.                |
| VersionStaffingSettings       | **Solid**             | 1:1 with BudgetVersion. HSA policy + calendar + Ajeer defaults. Well-scoped.                                                                                       |
| VersionServiceProfileOverride | **Solid**             | Partial override support (null = use master value). Clean design.                                                                                                  |
| VersionStaffingCostAssumption | **Solid**             | Category + mode + value. Supports all three calculation modes. Unique by (versionId, category).                                                                    |
| VersionLyceeGroupAssumption   | **Solid**             | Version-scoped group counts for specialty demand. Correctly scoped.                                                                                                |
| DemandOverride                | **Fragile**           | Unique key `(versionId, band, disciplineId)` cannot target specific lineType. See MR-01. Also, `reasonCode` is a VarChar(30) not an enum — no DB-level validation. |
| StaffingAssignment            | **Solid with caveat** | FK-enforced references. Stable (band, disciplineId) key survives demand recalculation. Caveat: no lineType targeting (MR-02).                                      |
| TeachingRequirementSource     | **Solid**             | Granular per-grade output. Proper unique key.                                                                                                                      |
| TeachingRequirementLine       | **Solid**             | Aggregated grid output. Uses `disciplineCode` (String) instead of `disciplineId` (FK) — intentional, as this is a derived read model.                              |
| Employee (extended)           | **Solid**             | 6 new fields, all nullable or with defaults. Backward-compatible migration. `recordType` handles vacancy without separate model.                                   |

### 6.2 Key Stability

- **DhgRule:** Global, keyed by `(gradeLevel, disciplineId, lineType, languageCode, effectiveFromYear)`. Stable across versions. **Solid.**
- **StaffingAssignment:** Keyed by `(versionId, employeeId, band, disciplineId)`. Survives demand recalculation because it references business keys, not derived output IDs. **Solid.**
- **TeachingRequirementLine:** Keyed by `(versionId, band, disciplineCode, lineType)`. Regenerated on each calculation. Not referenced by user-input entities. **Solid.**
- **DemandOverride:** Keyed by `(versionId, band, disciplineId)`. Does not include `lineType`. **Fragile — see MR-01.**

### 6.3 FK Integrity

| FK                                      | Enforcement                 | Risk                             |
| --------------------------------------- | --------------------------- | -------------------------------- |
| DhgRule → Discipline                    | DB-enforced                 | **Safe**                         |
| DhgRule → ServiceObligationProfile      | DB-enforced                 | **Safe**                         |
| StaffingAssignment → Employee           | DB-enforced, CASCADE delete | **Safe**                         |
| StaffingAssignment → Discipline         | DB-enforced                 | **Safe**                         |
| StaffingAssignment → BudgetVersion      | DB-enforced, CASCADE delete | **Safe**                         |
| DemandOverride → Discipline             | DB-enforced                 | **Safe**                         |
| Employee → Discipline                   | Optional FK (nullable)      | **Safe** — null for non-teaching |
| Employee → ServiceObligationProfile     | Optional FK (nullable)      | **Safe** — null for non-teaching |
| TeachingRequirementLine → BudgetVersion | DB-enforced, CASCADE delete | **Safe**                         |
| TeachingRequirementSource → Discipline  | DB-enforced                 | **Safe**                         |

### 6.4 Override Model

**Solid.** Three-layer override architecture:

1. Master data (ServiceObligationProfile, DhgRule) — system-wide defaults
2. Version overrides (VersionServiceProfileOverride, VersionLyceeGroupAssumption) — scenario-specific adjustments
3. Demand overrides (DemandOverride) — explicit user corrections with reason codes

The merge rule is clearly specified: check version override first, fall back to master data.

### 6.5 Master Data vs Derived Output Boundaries

**Solid.** Clear separation:

- Master data: ServiceObligationProfile, Discipline, DhgRule — global, not version-scoped
- Version inputs: Settings, overrides, assumptions — user-edited, version-scoped
- Supply: Employee, StaffingAssignment — user-managed, version-scoped
- Derived outputs: TeachingRequirementSource, TeachingRequirementLine — system-calculated, deleted/recreated each calculation cycle

No derived object is used as a business anchor. Assignments reference `(band, disciplineId)`, not `requirementLineId`.

### 6.6 API Safety

**Solid with caveats:**

- Teaching requirements endpoint returns 409 if stale — prevents stale data display
- Assignment CRUD marks STAFFING stale — triggers recalculation
- Settings changes mark STAFFING stale — consistent
- Employee endpoints accept new fields — backward-compatible

**Caveats:**

- 35 endpoints for one module is heavy. The 7-persona review recommended merging 4 settings endpoints into 1 composite `GET/PUT /staffing-config`. This is a valid optimization but not a blocking issue.
- N+1 query risk on `GET /teaching-requirements` (joins assignments + employees per line). The spec mentions this but doesn't specify the query strategy. Recommendation: 3-query batch (lines, assignments with employees, aggregate).

### 6.7 Stale Propagation

**Solid.** Extended chain is correct:

- ENROLLMENT → STAFFING (new) + REVENUE (existing)
- STAFFING → PNL
- DHG stale module merged into STAFFING

**Risk:** 12+ files reference the old `'DHG'` stale module string. All must be updated. This is a mechanical task but easy to miss. Recommendation: add a grep-based CI check or a unit test that fails if any code references `'DHG'` as a stale module.

### 6.8 Performance

**Solid.** Data volume estimates are well within limits:

- ~200 source rows, ~60 requirement lines, ~170 assignments, ~2,000 monthly costs
- Precomputed read models avoid salary decryption on grid load
- Single transaction for calculation pipeline

**No performance hotspots identified** at the current data scale. The design correctly defers virtual scrolling (ADR-016).

---

## 7. Business Rule Confirmations Required Before Coding

| #     | Rule                                                                    | Current State                                                                                                                            | Why Confirmation Matters                                                                                                                        | Source          |
| ----- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| BR-01 | Primary English hours per grade (PS, MS, GS, CP-CM2)                    | Listed as "implementation confirmation #2" — no values in spec                                                                           | DhgRule seed data cannot be created without these values. Wrong hours → wrong FTE.                                                              | F8, Q1, Q7      |
| BR-02 | FY2026 resident recharge amounts (RESIDENT_SALAIRES, RESIDENT_LOGEMENT) | Listed as "implementation confirmation #1" — TBD in seed table                                                                           | Category cost seed data cannot be created. These are likely in the 100K+ SAR/year range.                                                        | Section 6.7     |
| BR-03 | Arabic/Islamic ORS by band: is 24h universal?                           | Q2 resolved as "24h everywhere" but V2 domain correction #5 says "confirm with EFIR HR"                                                  | If secondary Arabic uses 18h ORS (like CERTIFIE), FTE calculation changes by 33%.                                                               | Q2, V2 #5       |
| BR-04 | DOCUMENTALISTE: teaching or support/admin?                              | Added to service profiles (ORS=30h) after V2 review. But no DhgRule or demand line defined.                                              | If teaching, needs DhgRule + requirement line. If support, needs to be excluded from teaching demand.                                           | V2 #3           |
| BR-05 | Maternelle English: does it exist?                                      | Mockup includes it. Fixture has no Maternelle English data. V2 domain correction #4 says "confirm hours with EFIR."                      | If yes, need DhgRule. If no, mockup is misleading and should be removed.                                                                        | V2 #4, C4       |
| BR-06 | Lycee autonomy hours interpretation                                     | V2 domain correction #2 asks "student hours or teacher DHG margin?"                                                                      | Affects whether autonomy creates a demand line with FTE or is a planning diagnostic.                                                            | V2 #2           |
| BR-07 | Elementaire specialist coverage beyond English/Arabic/Islamic           | Q7 resolved as "three specialist-covered subjects." But do any Elementaire grades have additional specialist subjects (e.g., EPS, Arts)? | If yes, additional DhgRule entries needed. If no, homeroom teachers cover these.                                                                | Q7              |
| BR-08 | Cost attribution: is Ajeer/EoS split by FTE share acceptable?           | V2 financial accuracy fix #4 raises this as a potential issue                                                                            | Per-person costs split by hour-share is an approximation. If finance team requires exact per-person cost attribution, the formula needs rework. | V2 Part 6, #4   |
| BR-09 | HSA per-employee override capability                                    | V1 review (F3) recommended line-level override. Elevated spec removed it.                                                                | If person-level HSA amounts differ significantly from the policy-derived amount, the uniform HSA cost will not reconcile to payroll.            | F3, section 6.9 |

---

## 8. Mandatory Test Suite Before Implementation Approval

### 8.1 Unit Tests — Demand Engine

| Test ID | Objective                                  | Preconditions                                        | Expected Result                                           | Blocker? |
| ------- | ------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------- | -------- |
| UT-D01  | Maternelle homeroom FTE = sections         | 3 grades, SECTION driver, 65/77/124 students, 24 max | PS=3, MS=4, GS=6 FTE (13 total)                           | Yes      |
| UT-D02  | Secondary subject FTE = hours / baseORS    | 6EME French, 6 sections, 4.5h/section, ORS=18        | 27h/week ÷ 18 = 1.50 FTE                                  | Yes      |
| UT-D03  | HSA-eligible effectiveORS                  | CERTIFIE, baseORS=18, hsaTarget=1.5                  | effectiveORS = 19.5, plannedFTE < rawFTE                  | Yes      |
| UT-D04  | Non-HSA-eligible profiles                  | PE (24h, not eligible)                               | effectiveORS = baseORS = 24, plannedFTE = rawFTE          | Yes      |
| UT-D05  | GROUP driver with Lycee assumption         | SPECIALITE_MATHS, 3 groups, 4h/group                 | 12h/week ÷ 18 = 0.67 FTE                                  | Yes      |
| UT-D06  | GROUP driver without assumption (fallback) | Rule has hoursPerUnit=4, no assumption entry         | driverUnits=0 (no assumption), FTE=0                      | Yes      |
| UT-D07  | Zero enrollment grade skipped              | Grade with 0 headcount                               | No requirement source rows for that grade                 | Yes      |
| UT-D08  | Zero ORS guard                             | ASEM profile (ORS=0) with HOURS driver               | CalculationError thrown, not division by zero             | Yes      |
| UT-D09  | Raw FTE vs rounded positions               | 57.41 raw FTE across subjects                        | recommendedPositions sum > rawFTE sum                     | Yes      |
| UT-D10  | Demand override replaces planned FTE       | Override FTE = 5.0 on line with calculated 4.67      | requiredFtePlanned = 5.0, requiredFteCalculated preserved | Yes      |

### 8.2 Unit Tests — Coverage Engine

| Test ID | Objective                   | Preconditions                                                         | Expected Result                       | Blocker? |
| ------- | --------------------------- | --------------------------------------------------------------------- | ------------------------------------- | -------- |
| UT-C01  | Basic coverage match        | 1 teacher, 1 assignment, fteShare=1.0                                 | coveredFte=1.0, gap=coveredFte-rawFTE | Yes      |
| UT-C02  | Multi-teacher coverage      | 3 assignments to same line, total 2.5 FTE                             | coveredFte=2.5                        | Yes      |
| UT-C03  | Over-assignment warning     | Employee with hourlyPercentage=1.0, total fteShare=1.2                | Warning: OVER_ASSIGNED                | Yes      |
| UT-C04  | Orphaned assignment         | Assignment references (band, disciplineCode) with no requirement line | Warning: ORPHANED_ASSIGNMENT          | Yes      |
| UT-C05  | UNCOVERED status            | Requirement line with 0 assignments                                   | coverageStatus = 'UNCOVERED'          | Yes      |
| UT-C06  | Coverage gap thresholds     | gap=-0.25 → COVERED, gap=-0.26 → DEFICIT, gap=+0.26 → SURPLUS         | Correct status per threshold          | Yes      |
| UT-C07  | Departed employee exclusion | Employee with status='Departed' and active assignment                 | Should NOT count toward coverage      | Yes      |

### 8.3 Unit Tests — HSA Engine

| Test ID | Objective          | Preconditions                            | Expected Result               | Blocker? |
| ------- | ------------------ | ---------------------------------------- | ----------------------------- | -------- |
| UT-H01  | Standard HSA cost  | hsaTarget=1.5, first=500, additional=400 | 500 + 0.5×400 = 700 SAR/month | Yes      |
| UT-H02  | HSA 0 target       | hsaTarget=0                              | 0 SAR/month                   | Yes      |
| UT-H03  | HSA 1 hour exactly | hsaTarget=1.0                            | 500 SAR/month (no additional) | Yes      |
| UT-H04  | Annual HSA         | 700 SAR/month × 10 months                | 7,000 SAR/year                | Yes      |

### 8.4 Unit Tests — Cost Engine Modifications

| Test ID | Objective                        | Preconditions                                        | Expected Result                                         | Blocker? |
| ------- | -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | -------- |
| UT-CE01 | LOCAL_PAYROLL cost unchanged     | Existing employee, same inputs as before redesign    | Same monthly cost output as current engine              | Yes      |
| UT-CE02 | AEFE_RECHARGE produces zero cost | Employee with costMode=AEFE_RECHARGE                 | All 12 monthly totalCost = 0                            | Yes      |
| UT-CE03 | NO_LOCAL_COST produces no rows   | Employee with costMode=NO_LOCAL_COST                 | Empty output array                                      | Yes      |
| UT-CE04 | HSA from demand engine           | Employee receives computed hsaAmount from HSA engine | Monthly gross uses new HSA amount, not old stored value | Yes      |

### 8.5 Unit Tests — Category Cost Engine

| Test ID | Objective                       | Preconditions                      | Expected Result                     | Blocker? |
| ------- | ------------------------------- | ---------------------------------- | ----------------------------------- | -------- |
| UT-CC01 | FLAT_ANNUAL mode                | RESIDENT_PENSION, 837000           | 69,750 SAR/month                    | Yes      |
| UT-CC02 | PERCENT_OF_PAYROLL mode         | REMPLACEMENTS, 0.0113, subtotal=2M | 22,600 SAR/month                    | Yes      |
| UT-CC03 | AMOUNT_PER_FTE mode             | Value=10000, totalFTE=90           | 900,000/12 = 75,000 SAR/month       | Yes      |
| UT-CC04 | 5 categories × 12 months        | All categories configured          | 60 output rows                      | Yes      |
| UT-CC05 | Subtotal excludes AEFE_RECHARGE | 3 local + 2 recharge employees     | subtotalGross includes only 3 local | Yes      |

### 8.6 Integration Tests

| Test ID | Objective                             | Preconditions                                       | Expected Result                                     | Blocker? |
| ------- | ------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | -------- |
| IT-01   | Full pipeline end-to-end              | Seed: 168 employees, 15 grades, DHG rules, settings | Pipeline completes, all tables populated, no errors | Yes      |
| IT-02   | Stale module propagation              | Change enrollment headcount                         | STAFFING appears in staleModules                    | Yes      |
| IT-03   | Settings change marks stale           | PUT staffing settings                               | STAFFING appears in staleModules                    | Yes      |
| IT-04   | Calculate removes stale               | POST calculate/staffing                             | STAFFING removed, PNL added to staleModules         | Yes      |
| IT-05   | GET teaching-requirements when stale  | STAFFING in staleModules                            | Returns 409 Conflict                                | Yes      |
| IT-06   | Assignment CRUD                       | Create, read, update, delete assignment             | All operations succeed, audit logged                | Yes      |
| IT-07   | Employee import with alias resolution | Import CSV with "Mathematiques" (no accent)         | Resolves to MATHEMATIQUES discipline                | Yes      |

### 8.7 Migration Tests

| Test ID | Objective                                     | Preconditions                          | Expected Result                                                     | Blocker? |
| ------- | --------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- | -------- |
| MT-01   | DhgGrilleConfig → DhgRule migration           | Existing grille config rows            | All rows migrated with correct lineType, driverType, disciplineId   | Yes      |
| MT-02   | Employee field population                     | 168 existing employees                 | All employees have recordType, costMode, serviceProfileId populated | Yes      |
| MT-03   | Migration exception handling                  | Employee with unmatchable functionRole | Record logged to exception queue, migration continues               | Yes      |
| MT-04   | system_config → VersionStaffingCostAssumption | Existing config values                 | Correctly converted to mode + value format                          | Yes      |
| MT-05   | Post-migration verification                   | Migration complete                     | Count queries match expected distributions by field                 | Yes      |

### 8.8 Regression Tests

| Test ID | Objective                         | Preconditions                      | Expected Result                                   | Blocker? |
| ------- | --------------------------------- | ---------------------------------- | ------------------------------------------------- | -------- |
| RT-01   | Existing employee cost unchanged  | Same employee, same salary inputs  | MonthlyStaffCost identical to pre-redesign values | Yes      |
| RT-02   | Existing category cost unchanged  | Same config values, same employees | CategoryMonthlyCost totals match pre-redesign     | Yes      |
| RT-03   | Enrollment calculation unaffected | Run enrollment calculation         | Same results, no schema errors                    | Yes      |
| RT-04   | Revenue calculation unaffected    | Run revenue calculation            | Same results, no schema errors                    | Yes      |
| RT-05   | Version clone includes new tables | Clone a version with staffing data | All user-input tables copied to new version       | Yes      |
| RT-06   | No 'DHG' stale module references  | Full application startup           | No code references 'DHG' as stale module          | Yes      |

### 8.9 Reconciliation Tests

| Test ID | Objective               | Preconditions                | Expected Result                                                     | Blocker? |
| ------- | ----------------------- | ---------------------------- | ------------------------------------------------------------------- | -------- |
| RC-01   | Secondary total raw FTE | Calculated from fixture data | ~57.41 FTE (matches workbook DHG_Optimization)                      | Yes      |
| RC-02   | Total teaching raw FTE  | All bands calculated         | ~89-96 FTE range (workbook varies)                                  | No       |
| RC-03   | Monthly HSA total       | All HSA-eligible teachers    | 57,424-60,024 SAR/month range                                       | Yes      |
| RC-04   | Annual pension          | FLAT_ANNUAL mode             | 837,000 SAR/year (69,750/month)                                     | Yes      |
| RC-05   | Total annual staff cost | Full pipeline                | Within 5% of workbook grand total (acknowledge pension discrepancy) | No       |

---

## 9. Implementation Approval Checklist

### Design Sign-Off

- [ ] DemandOverride unique key includes `lineType` (MR-01 resolved)
- [ ] StaffingAssignment lineType targeting clarified (MR-02 resolved)
- [ ] SECTION driver validation rule documented (MR-04 resolved)
- [ ] AMOUNT_PER_FTE mode specifies which FTE basis (MR-05 resolved)
- [ ] Mockup section counts corrected (Appendix A)
- [ ] Primary specialist `hoursPerUnit` semantics clarified (per-section or per-band)
- [ ] Vacancy cost estimation approach decided (MR-10)
- [ ] Version clone logic specified for all new tables (MR-03)

### Business-Rule Sign-Off

- [ ] Primary English hours per grade confirmed with school (BR-01)
- [ ] FY2026 resident recharge amounts confirmed from workbook (BR-02)
- [ ] Arabic/Islamic 24h ORS confirmed for all bands (BR-03)
- [ ] DOCUMENTALISTE classification confirmed: teaching or support (BR-04)
- [ ] Maternelle English existence confirmed (BR-05)
- [ ] Lycee autonomy hours interpretation confirmed (BR-06)
- [ ] Ajeer/EoS cost split by FTE share accepted by finance (BR-08)
- [ ] HSA per-employee override: explicitly deferred or included (BR-09)

### Schema Readiness

- [ ] All 12 new/modified models compile in Prisma
- [ ] Prisma migration generates clean SQL
- [ ] Migration can be applied to existing database without data loss
- [ ] Rollback migration exists and is tested
- [ ] No orphaned FK references after migration

### Seed/Master-Data Readiness

- [ ] ServiceObligationProfile seed data complete (7 profiles)
- [ ] Discipline seed data complete (18+ entries)
- [ ] DisciplineAlias seed data covers known workbook variants
- [ ] DhgRule seed data matches workbook DHG structure (including confirmed primary hours)
- [ ] VersionStaffingCostAssumption defaults match workbook evidence

### Migration Readiness

- [ ] Employee field population heuristics validated against actual data (confirmation #3)
- [ ] Migration exception queue implemented
- [ ] AGREGE vs CERTIFIE distinction addressed
- [ ] Post-migration verification queries defined
- [ ] Migration tested on production-equivalent data set

### Test Readiness

- [ ] All UT-D (demand engine) tests passing
- [ ] All UT-C (coverage engine) tests passing
- [ ] All UT-H (HSA engine) tests passing
- [ ] All UT-CE (cost engine modification) tests passing
- [ ] All UT-CC (category cost engine) tests passing
- [ ] All IT (integration) tests passing
- [ ] All MT (migration) tests passing
- [ ] All RT (regression) tests passing
- [ ] RC-01 and RC-03 reconciliation tests within expected range

### Regression Safeguards

- [ ] No code references 'DHG' as stale module (grep verified)
- [ ] Existing employee cost engine produces identical output for LOCAL_PAYROLL employees
- [ ] Existing category cost engine produces identical output when given same config values
- [ ] Enrollment and revenue calculations unaffected by schema changes
- [ ] Version clone includes all new version-scoped tables
- [ ] Employee import handles both old and new template formats

### Reconciliation Baseline Readiness

- [ ] Workbook baseline values documented for 5 reconciliation checkpoints
- [ ] Acceptable tolerance defined (e.g., ±1% for FTE, ±5% for cost)
- [ ] Known discrepancies (pension omission, HSA delta) documented as accepted variances

---

## 10. Final Recommendation

**Proceed only after specific fixes.**

The elevated design spec is architecturally strong and resolves the critical V1 findings. However, the following 14 gating actions must be completed before any engineer writes production code:

### Priority 1 — Blocking Design Fixes (must resolve before schema migration)

1. **Add `lineType` to `DemandOverride` unique key** (MR-01) — prevents override ambiguity for disciplines with multiple line types in the same band
2. **Clarify primary specialist `hoursPerUnit` semantics** — is it per-section or per-band total? The current formula would produce 10x FTE error if misinterpreted
3. **Specify version clone logic** (MR-03) — which of the 10+ new tables are copied on version clone? Without this, cloned versions are empty
4. **Confirm primary English hours per grade** (BR-01) — DhgRule seed data cannot be created without these values
5. **Confirm FY2026 resident recharge amounts** (BR-02) — category cost seed data cannot be created

### Priority 2 — Blocking Specification Clarifications (must resolve before engine implementation)

6. **Define `AMOUNT_PER_FTE` FTE basis** (MR-05) — raw or planned? 5-8% cost difference
7. **Add SECTION driver validation** (MR-04) — prevent misuse of SECTION driver with non-zero hoursPerUnit
8. **Define departed employee exclusion from coverage** — are departed employees' assignments excluded from coveredFte?
9. **Define AEFE_RECHARGE employee assignment behavior** — can they have assignments? Do they count toward coverage?

### Priority 3 — High-Risk Clarifications (should resolve before frontend implementation)

10. **Design reconciliation view** (MR-06) — acceptance criterion #11 has no supporting UI
11. **Design migration exception queue** (MR-07) — no process for handling unmatchable records
12. **Decide vacancy cost estimation approach** (MR-10) — vacancies with no cost impact confuse planners
13. **Confirm Arabic/Islamic ORS** (BR-03) — 33% FTE error if secondary uses 18h not 24h
14. **Correct mockup section counts** — PS=3 correct, MS should be 4, GS should be 6

### Scope Recommendation

The 7-persona review's phased approach is sound. If the team has capacity constraints, the recommended phasing is:

- **v1.0 (4-5 weeks):** Foundations + demand engine + settings + teaching grid (no assignments, no coverage, no auto-suggest)
- **v1.1 (2-3 weeks):** Assignment model + coverage engine + gap analysis
- **v1.2 (2-3 weeks):** Demand overrides, vacancy handling, auto-suggest, support/admin workspace

This phasing does NOT reduce the need for the 14 gating actions above — they apply to v1.0 scope.

---

_End of Pre-Implementation Verification Report._
