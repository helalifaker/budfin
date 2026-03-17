# DHG & Staffing Redesign Review Findings

**Date:** 2026-03-17  
**Scope reviewed:** current redesign draft, current staffing/enrollment implementation, DHG workbook, staff cost workbook, legacy AEFE DHG workbook, HSA workbook  
**Purpose:** critical findings and direct recommendations for a production-grade redesign

## 1. Overall Assessment

The current redesign draft is directionally strong but not yet safe to implement as written.

The biggest problem is not styling or screen layout. It is structural: the draft jumps straight to a subject-first UI and a few schema additions without first solving the harder questions of planning grain, mapping, assignments, HSA semantics, and source-data inconsistency.

The result would likely look modern while remaining logically brittle.

## 2. Priority Summary

| ID  | Severity | Area                        | Short description                                                            |
| --- | -------- | --------------------------- | ---------------------------------------------------------------------------- |
| F1  | Critical | Business logic / data model | No assignment model between demand and supply                                |
| F2  | Critical | Product design / UX         | Subject-first row model is wrong for primary and support planning            |
| F3  | Critical | Calculation model           | HSA is oversimplified and mixes planning policy with payroll detail          |
| F4  | High     | Data model                  | `DhgGrilleConfig` cannot remain structurally unchanged                       |
| F5  | High     | Calculation integrity       | Subject-level rounding materially inflates staffing need                     |
| F6  | High     | Cost model                  | Additional cost defaults in the draft are not supported by workbook evidence |
| F7  | High     | Reconciliation              | Source payroll workbook omits pension in its own annual summary              |
| F8  | High     | Business logic              | Primary specialist coverage is under-modeled, especially English             |
| F9  | High     | Data quality                | Source taxonomies are too inconsistent for free-text implementation          |
| F10 | High     | UX / module boundary        | Non-teaching rows should not be mixed into the teaching grid by default      |
| F11 | Medium   | Architecture                | `DhgSubjectSummary` / `DhgGradeDetail` keys are insufficient                 |
| F12 | Medium   | Documentation quality       | The original draft is under-specified on controls, audit, and edge cases     |
| F13 | Medium   | Migration                   | Legacy AEFE workbook reveals hidden-sheet and `#N/A` dependencies            |
| F14 | Medium   | Time model                  | AY2 demand vs Jan-Dec cost timing is implicit, not explicit                  |
| F15 | Medium   | Future-proofing             | Residents and recharge costs need a more flexible cost-mode design           |

## 3. Detailed Findings

### F1. No assignment model between demand and supply

**Severity:** Critical  
**Impacted area:** business logic, data model, calculation engine, UX  
**Evidence:** The draft calculates `fteAssigned` by matching employee `discipline` to subject rows. The current app has no persisted assignment object, and the source roster contains staff who can plausibly cover multiple lines, bands, or responsibilities.

**Why it matters:** Without explicit assignments:

- gaps are not auditable
- shared teachers cannot be modeled correctly
- cost rollup to demand lines becomes guesswork
- level/subject matching becomes fragile immediately

**Recommendation:** Introduce a `StaffingAssignment` entity and use it as the only authoritative coverage link between supply and demand.

**Implementation implication:** This is foundational. Do not ship the redesigned workspace without it.

### F2. Subject-first row model is wrong for primary and support planning

**Severity:** Critical  
**Impacted area:** UX, business usability, product architecture  
**Evidence:** The source DHG workbook plans primary mainly via section-based teacher/ASEM logic, while the earlier draft proposed rows = subjects for the entire module.

**Why it matters:** A universal subject grid would:

- make Maternelle and Elementaire less intuitive
- hide the actual planning object for class teachers and ASEM
- force support/admin staffing into an unnatural view

**Recommendation:** Use a unified teaching workspace with multiple row types and a separate support/admin workspace inside the same module.

**Implementation implication:** Replace “subject-first” language with “requirement-line-first”.

### F3. HSA is oversimplified and mixes planning policy with payroll detail

**Severity:** Critical  
**Impacted area:** calculation integrity, finance accuracy, explainability  
**Evidence:** The DHG workbook uses HSA as a scenario lever; the HSA workbook and payroll workbook carry person-level HSA amounts. The draft proposed one average HSA setting pushed uniformly into per-teacher cost.

**Why it matters:** That would be easy to implement but wrong in practice:

- it loses payroll traceability
- it cannot explain individual HSA amounts
- it will not reconcile reliably to the existing source data

**Recommendation:** Separate planning HSA policy from payroll HSA amount. Store both the base-ORS FTE and planned-policy FTE.

**Implementation implication:** HSA must exist in settings, supply cost logic, and explain/reconciliation views.

### F4. `DhgGrilleConfig` cannot remain structurally unchanged

**Severity:** High  
**Impacted area:** data model, future scalability  
**Evidence:** The source DHG workbook distinguishes structural hours, host-country hours, autonomy/shared pools, specialties, and different grouping behaviors. The current migration importer also flattens all rows to `dhgType = Structural`, already losing meaning.

**Why it matters:** The current schema cannot safely represent:

- group-based specialty demand
- service profile selection
- line type
- language/track
- future effective date control

**Recommendation:** Evolve the table into a richer rule catalog with rule code, line type, driver type, service profile, and grouping metadata.

**Implementation implication:** This is a schema redesign, not a small column addition.

### F5. Subject-level rounding materially inflates staffing need

**Severity:** High  
**Impacted area:** finance accuracy, staffing integrity  
**Evidence:** In `Staffing_By_Subject`, secondary rows sum to about **57.41 raw FTE** but **63 rounded positions**. This is an inflation of roughly **5.6 FTE** caused by per-line rounding.

**Why it matters:** If the app naïvely sums rounded line positions, it will overstate hiring need and cost.

**Recommendation:** Keep raw FTE and hireable-unit recommendations as separate concepts. Never use summed rounded line counts as the total demand number.

**Implementation implication:** The UI and API must surface both measures explicitly.

### F6. Additional cost defaults in the draft are not supported by workbook evidence

**Severity:** High  
**Impacted area:** cost model  
**Evidence:** The earlier draft proposed defaults such as `remplacementsRate = 0.02` and `formationRate = 0.01`. The source workbook does not support those exact rates. Its implied ratios are closer to about **1.13%** and **1.27%**, and some lines are entered as flat amounts rather than formulas.

**Why it matters:** Hardcoding unsupported percentages would produce a false sense of precision.

**Recommendation:** Model these categories with an explicit calculation mode: `flat annual`, `percent of payroll`, or `amount per FTE`.

**Implementation implication:** Add a cost-assumption table, not just a few fixed numeric columns.

### F7. Source payroll workbook omits pension in its own annual summary

**Severity:** High  
**Impacted area:** reconciliation, migration risk  
**Evidence:** The monthly budget includes a **Pension Contribution (35% share)** line of **837,000 SAR**, but the analysis summary grand total excludes it. The difference between the two grand totals equals the pension amount.

**Why it matters:** This proves the workbook is not a single internally consistent source of truth.

**Recommendation:** Add reconciliation controls and explicitly resolve pension treatment before workbook baselines are used as acceptance criteria.

**Implementation implication:** Do not declare “Excel parity” complete without a workbook-reconciliation sign-off.

### F8. Primary specialist coverage is under-modeled, especially English

**Severity:** High  
**Impacted area:** business logic  
**Evidence:** The primary grille includes English hours, the source staffing data includes multiple primary foreign-language teachers, and the HSA workbook includes primary English staff. Yet the DHG summary logic does not explicitly carry a primary English staffing line.

**Why it matters:** The model may understate or misclassify a real specialist demand stream.

**Recommendation:** Confirm which primary subjects are specialist-covered vs homeroom-covered, then represent them explicitly in requirement lines.

**Implementation implication:** This is a business-rule confirmation required before finalizing primary demand logic.

### F9. Source taxonomies are too inconsistent for free-text implementation

**Severity:** High  
**Impacted area:** migration, maintainability, auditability  
**Evidence:** The workbooks contain typos, trailing spaces, accented/unaccented variants, married names, and role inconsistencies. Examples include:

- duplicated role labels with spacing differences
- `BibliotheLiquideire`
- married-name vs maiden-name HSA matches
- pseudo-employees named `NEW POSITION`

**Why it matters:** Free-text strings in core joins will produce silent mapping failures.

**Recommendation:** Introduce controlled taxonomies plus alias/normalization tables.

**Implementation implication:** Migration must include normalization and exception queues.

### F10. Non-teaching rows should not be mixed into the teaching grid by default

**Severity:** High  
**Impacted area:** UX, module architecture  
**Evidence:** The earlier draft proposed non-teaching rows at the bottom of the same main grid. These rows do not share DHG drivers, coverage semantics, or planning logic with teaching rows.

**Why it matters:** It increases cognitive load and weakens the teaching workflow.

**Recommendation:** Keep support/admin planning in the same module but in a separate workspace mode.

**Implementation implication:** Shared KPIs and settings can remain global; grids should differ by workspace.

### F11. `DhgSubjectSummary` and `DhgGradeDetail` keys are insufficient

**Severity:** Medium  
**Impacted area:** data model correctness  
**Evidence:** The earlier draft keyed summaries by `(versionId, level, subject)` and details by `(versionId, gradeLevel, subject)`. The source workbook contains cases where subject alone is not enough: tronc commun vs specialty, shared pool lines, language/track distinctions, and potentially primary specialist variants.

**Why it matters:** Distinct requirement lines could collapse into one row.

**Recommendation:** Use structured line identifiers (`ruleCode`, `lineType`, `groupingKey`) rather than subject text alone.

**Implementation implication:** Row identity should be code-based, not label-based.

### F12. The original draft is under-specified on controls, audit, and edge cases

**Severity:** Medium  
**Impacted area:** document quality, implementation readiness  
**Evidence:** The earlier draft was strong on UI direction and file inventory but weak on:

- required validations
- auditability requirements
- control states
- migration risk handling
- explicit open questions from the source data

**Why it matters:** Teams could implement the happy path and still miss the conditions that make planning safe.

**Recommendation:** Treat validation and explainability as first-class design sections, not footnotes.

**Implementation implication:** The revised main document now does this; implementation should keep that scope.

### F13. Legacy AEFE workbook reveals hidden-sheet and `#N/A` dependencies

**Severity:** Medium  
**Impacted area:** migration, historical understanding  
**Evidence:** `Copy of Effectifs prévisionnels EFIR.xlsx` includes hidden sheets, `#N/A` chains, extrapolation tables, and detached/resident cost logic.

**Why it matters:** Some business logic lives in spreadsheet structure rather than explicit data.

**Recommendation:** Use the legacy workbook as evidence of concepts and assumptions, not as an import template.

**Implementation implication:** Create explicit data structures for anything business-critical that currently depends on hidden spreadsheet logic.

### F14. AY2 demand vs Jan-Dec cost timing is implicit

**Severity:** Medium  
**Impacted area:** planning clarity, finance logic  
**Evidence:** The current staffing demand logic is effectively AY2-driven, while the cost workbook is fiscal-year monthly. The earlier draft did not state this clearly.

**Why it matters:** Users need to know whether a DHG gap affects the whole fiscal year or only the Sep-Dec part.

**Recommendation:** Make academic-period vs fiscal-period timing explicit in the UI, design, and APIs.

**Implementation implication:** Add demand snapshot labels and effective-date aware hiring flows.

### F15. Residents and recharge costs need a more flexible cost-mode design

**Severity:** Medium  
**Impacted area:** future-proofing  
**Evidence:** The source material treats resident costs as recharge-style costs, but not consistently as per-person payroll. The earlier draft assumed flat annual resident settings.

**Why it matters:** Flat totals may be acceptable for FY2026 migration but will not scale well to scenario planning, multi-campus use, or count-based changes.

**Recommendation:** Use a cost-mode model that supports flat annual, per-FTE, or future custom recharge logic.

**Implementation implication:** Introduce structured cost assumption modes now, even if only flat annual is used in the first release.

## 4. Cross-Cutting Risks if Implemented Naively

If the module is implemented directly from the earlier draft without the changes above, the most likely failure modes are:

1. teaching demand and employee supply will not reconcile cleanly
2. HSA totals will drift from payroll reality
3. primary staffing logic will be oversimplified
4. future scenario work will require schema rework
5. grid totals will look precise while hiding rounding inflation and allocation assumptions

## 5. Recommended Decisions

These are the recommended decisions from the review:

1. **Adopt requirement lines as the core teaching-planning object.**
2. **Add an explicit assignment model before redesigning the main teaching workspace.**
3. **Use one staffing module with two workspace modes: `Teaching` and `Support & Admin`.**
4. **Evolve `DhgGrilleConfig` into a richer rule catalog.**
5. **Model HSA separately as planning policy and payroll amount.**
6. **Support multiple calculation modes for additional staff cost categories.**
7. **Require master-data-backed taxonomies and alias maps for migration-critical fields.**

## 6. Unresolved Questions Requiring Confirmation

1. Is primary English delivered by homeroom teachers, specialists, or a hybrid?
2. Are Arabic/Islamic service norms truly 24h across all bands, or does primary use a different contractual basis?
3. Should resident recharge be budgeted as flat annual totals or per planned resident FTE?
4. Is AY2 the only required teaching-demand surface for release 1?
5. Should auto-assignment suggestions be limited to home band, or can they span College/Lycée?

## 7. Final Review Verdict

The redesign should move forward, but only after the target model is corrected in the areas above.

The upgraded main design document now gives the right implementation target. The earlier draft did not fail because it was too ambitious; it failed because it simplified the hardest parts too early. The correct redesign keeps the premium workspace ambition and adds the missing operational backbone: governed rules, explicit assignments, controlled taxonomies, differentiated planning grain, and explainable cost logic.
