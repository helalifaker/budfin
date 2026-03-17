# DHG & Staffing Module Redesign — Review-Driven Target Design

**Date:** 2026-03-17  
**Status:** Review complete, target design ready for implementation planning  
**Scope:** `/planning/staffing` module, DHG demand model, teaching/support staffing workflow, staff cost integration  
**Supersedes:** Earlier draft in this file that proposed a uniform subject-first single-grid redesign

## 1. Executive Summary

The redesign direction is correct in one important respect: DHG and staffing should be treated as one connected planning workflow, not as four disconnected blocks. The earlier draft, however, still carried several structural weaknesses that would make the module hard to explain, hard to reconcile, and fragile under real-world data.

The review of the source document, current application code, and source workbooks leads to five core conclusions:

1. **The core planning object should be a requirement line, not a universal subject row.**  
   Secondary planning is naturally subject-based, but Maternelle and Elementaire are not. The module needs one unified teaching workspace with multiple row types, not one forced subject grid.
2. **A demand-to-supply assignment model is mandatory.**  
   Matching employees to DHG lines by free-text discipline is not auditable and will break as soon as teachers cover multiple grades, subjects, or bands.
3. **HSA must be modeled as both a planning lever and a cost policy, not a single scalar.**  
   The DHG workbook treats HSA as scenario leverage; the payroll workbook carries person-level HSA amounts. The product must separate those concepts while keeping them reconcilable.
4. **Current spreadsheet assumptions are inconsistent and cannot be copied into the app unchallenged.**  
   The source files contain internal contradictions, omitted costs, name mismatches, hidden-sheet dependencies, and taxonomy drift.
5. **The premium UX is one module with two coordinated workspaces.**  
   Teaching demand/coverage should be the default workspace. Support/admin planning should live in the same module but not in the same default teaching grid.

## 2. Source Evidence Snapshot

The review used the current planning draft, current app implementation, and four source workbooks:

| Source                                                | What it showed                                                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/plans/2026-03-17-dhg-staffing-redesign.md`      | Strong intent to modernize the module, but too solution-first and under-specified in business logic, assignments, data governance, and auditability                 |
| `data/budgets/02_EFIR_DHG_FY2026_v1.xlsx`             | 1,753 projected students, 74 sections, 47 unique subjects, explicit host-country and autonomy hours, subject-level secondary model, summary-level primary model     |
| `data/budgets/EFIR_Staff_Costs_Budget_FY2026_V3.xlsx` | 168 supply records, Sep step-up for 6 new positions, individualized HSA amounts, GOSI/Ajeer/EoS detail, additional recharge costs, internal summary inconsistencies |
| `data/DHG/Copy of Effectifs prévisionnels EFIR.xlsx`  | Legacy multi-year staffing model with hidden sheets, extrapolation tables, `#N/A` dependencies, manual reference tables, and detached/resident recharge logic       |
| `data/DHG/Copy of HSA EFIR 25-26.xlsx`                | Person-level HSA workload and cost calculations for primary and secondary, showing that HSA is operationally more granular than the current app model               |

Important evidence points from the workbooks:

- The DHG workbook produces **secondary total DHG of 1,258.38 h/week** in the optimization sheet.
- The same workbook shows **subject-level rounding inflation**: secondary subject lines sum to **57.41 raw FTE** but **63 rounded positions**, proving that naive per-line rounding materially overstates need.
- The staff cost workbook carries **168 headcount** at year-end: **162 existing + 6 new starting September**, with **166 Ajeer / 2 Saudi**.
- The staff cost workbook carries **57,424 SAR monthly HSA** in the staff master file, while the standalone HSA workbook totals **60,024 SAR/month**, indicating unresolved mapping/reconciliation issues.
- The staff cost monthly budget includes **837,000 SAR pension contribution**, but the analysis summary omits it from the annual total, proving that at least one source workbook is internally inconsistent.

## 3. Current-State Diagnosis

### 3.1 Current app behavior

The current application is still on the simpler implementation from Epic 3:

- DHG is calculated **per grade**, not per subject or requirement line.
- The engine uses a single **18-hour divisor**.
- The staffing page is still a **WorkspaceBoard / WorkspaceBlock** composition with separate roster, DHG, grille, and cost sections.
- There is **no assignment layer** between staffing demand and staffing supply.
- The cost engine works at **employee x month** grain and is already strong on GOSI, Ajeer, EoS, and YEARFRAC.

### 3.2 Current planning reality in the spreadsheets

The spreadsheets do not represent one single planning model. They represent a hybrid of at least four distinct ideas:

1. **Primary staffing is role-based.**  
   Maternelle and Elementaire are planned mainly as one class teacher per section, plus ASEM and host-country support where applicable.
2. **Secondary staffing is subject-based.**  
   College and Lycée are planned from DHG hours by discipline, plus autonomy and specialty assumptions.
3. **Payroll is person-based.**  
   Costs are stored and controlled at named employee or pseudo-position level, with effective dates and monthly phasing.
4. **Additional costs are partly fixed-budget and partly policy-driven.**  
   Resident/recharge lines, replacement budgets, and training levies are not consistently modeled as formulas.

### 3.3 Why the prior redesign draft was not yet implementation-ready

The earlier draft improved layout and modernized terminology, but it still had seven major weaknesses:

1. It assumed **one subject-first grid** works equally well for primary, secondary, and non-teaching.
2. It left **`DhgGrilleConfig` structurally unchanged**, even though the workbook clearly requires richer rule metadata.
3. It used **free-text employee discipline matching** instead of an assignment model.
4. It reduced HSA to **one settings-driven average** without preserving payroll reconciliation.
5. It treated additional costs as **default rates** not fully supported by workbook evidence.
6. It implied **direct cost rollup onto subject rows** without a defensible allocation method.
7. It did not separate **inputs, overrides, derived lines, and audit/explain artifacts** strongly enough.

## 4. Design Principles

1. **One module, two workspaces.**  
   DHG is not a standalone product area. It is the teaching-demand engine inside Staffing. The module should expose `Teaching` and `Support & Admin` workspaces under one route.
2. **Read from left to right: drivers -> need -> coverage -> cost -> risk.**
3. **Users edit assumptions, assignments, vacancies, and exceptions.**  
   They should not have to type derived DHG numbers into cells.
4. **Every important number must be explainable.**  
   Each grid row needs a deterministic provenance chain back to enrollment, rules, assumptions, assignments, or cost inputs.
5. **Do not force one row grain across fundamentally different pedagogical models.**
6. **Round only where the business actually hires whole units.**  
   Raw FTE and recommended positions are not the same number and must not be conflated.
7. **Separate planning policy from payroll detail.**  
   HSA, resident recharge, and training/replacement budgets must be configurable, traceable, and reconcilable.
8. **Preserve the best patterns from the enrollment redesign.**  
   Fixed-viewport workspace, KPI ribbon, status strip, filtered master grid, right-panel inspector, settings sheet, guide content.

## 5. Explicit Answers to the Core Design Questions

### 5.1 What is the cleanest conceptual model?

**Answer:** A hybrid model with:

- **teaching demand** derived from enrollment + curriculum rules + staffing assumptions
- **staffing supply** represented by employees and vacancies/position lines
- **coverage assignments** linking supply to demand
- **costs** calculated on supply lines and optionally allocated back to demand lines

DHG is therefore the **teaching-demand layer**, not the staffing module itself.

### 5.2 What is the core planning object?

**Answer:** `RequirementLine`

This is the row object planners should reason about in the teaching workspace. It can represent:

- primary homeroom demand
- ASEM demand
- host-country language/religion demand
- secondary subject demand
- shared autonomy pool demand

### 5.3 What is the ideal planning granularity?

**Answer:** The granularity should follow the pedagogical model:

| Area          | Recommended row grain                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Maternelle    | grade x role line (`PS Homeroom`, `PS ASEM`, `PS Arabic`, `PS Islamic`)                        |
| Elementaire   | grade x role line for homeroom; specialist lines where teaching is actually specialist-covered |
| College       | level or grade-grouped subject line with grade detail in inspector                             |
| Lycée         | subject/track/group line with specialty-group assumptions persisted separately                 |
| Support/Admin | position line by department and role, not mixed into the teaching demand grid by default       |

### 5.4 What should users edit directly vs system-calculate?

**Users edit directly:**

- version staffing settings
- service obligation / HSA policy overrides
- specialty group assumptions
- staffing supply records
- vacancy/new position records
- coverage assignments
- explicit demand overrides with reason codes
- support/admin position plans
- cost assumption modes and values

**System calculates:**

- sections/divisions
- weekly teaching hours
- requirement source rows
- raw FTE demand
- planned FTE demand after policy assumptions
- covered hours/FTE and gaps
- monthly payroll cost
- recharge/additional cost rollups
- explained deltas, warnings, and reconciliation views

### 5.5 How should assumptions, overrides, and derived values be separated?

**Answer:** They must be stored in different tables and rendered differently in the UI:

- **master data:** statutory rules and catalogs
- **version inputs:** settings and scenario assumptions
- **overrides:** intentional exceptions with user + timestamp + reason
- **derived outputs:** calculation results
- **explain artifacts:** audit/log/diff rows used for tracing

### 5.6 What spreadsheet logic should be preserved, simplified, redesigned, or eliminated?

| Action    | Items                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve  | section rounding, 36 weeks, Sep salary step-up, Jul-Aug HSA exclusion, GOSI, Ajeer, YEARFRAC, host-country lines, resident recharge concept                    |
| Simplify  | H/E benchmark as diagnostic only, HSA scenario sliders into governed service-profile policies, version-wide settings entry                                     |
| Redesign  | teacher matching, primary specialist coverage, resident cost mode, subject rounding behavior, vacancy handling, additional cost assumptions                    |
| Eliminate | pseudo-employees named `NEW POSITION`, hidden-sheet dependencies, `#N/A`-driven formulas, manual workbook link placeholders, free-text taxonomy as system keys |

## 6. Target Module Boundary and Navigation

### 6.1 Recommended module boundary

Keep a single module route: `/planning/staffing`

Within it, use two workspace modes:

1. **Teaching Demand & Coverage**  
   Default mode. This is where DHG, coverage, gaps, and teaching cost impacts are planned.
2. **Support & Admin Positions**  
   Separate but adjacent workspace for non-teaching supply and cost planning.

This keeps the product unified without forcing unrelated rows into the same mental model.

### 6.2 Recommended top-level controls

- workspace toggle: `Teaching` | `Support & Admin`
- band filter
- exception filter
- view preset: `Need`, `Coverage`, `Cost`
- export
- settings
- calculate

### 6.3 Recommended right panel tabs

Use the existing right panel shell. For staffing, register detail content with sub-sections:

- `Overview`
- `Drivers`
- `Coverage`
- `Cost`
- `Explain`

The global panel tabs remain `Details`, `Activity`, `Audit`, `Guide`.

## 7. Target Operating Model

### 7.1 Teaching workspace flow

1. Review enrollment-driven sections and rule assumptions.
2. Review requirement lines and highlighted gaps.
3. Add or edit supply records and vacancies.
4. Assign supply lines to requirement lines.
5. Review cost effect and unresolved exceptions.
6. Export or compare versions.

### 7.2 Support & Admin workspace flow

1. Review existing support/admin roster by department.
2. Add/remove/phase positions.
3. Apply cost assumptions and effective dates.
4. Review annual and monthly budget impact.

### 7.3 Required planner mental model

The planner should always be able to answer:

- What demand is the system deriving?
- What supply do I currently have?
- What is covered, uncovered, or over-covered?
- What assumption caused this number?
- What is direct payroll vs allocated overhead?

## 8. Teaching Business Logic Model

### 8.1 Demand model

Demand calculation must happen in two layers:

1. **Requirement source rows** at the most granular rule-execution grain
2. **Requirement lines** aggregated to the row grain users plan against

#### Requirement source rows

Examples:

- `PS / PRIMARY_HOMEROOM / sections=3 / hours=72`
- `PS / ARABIC / sections=3 / hours=6`
- `6EME / FRANCAIS / sections=6 / hours=27`
- `1ERE / SPECIALITE_MATHS / groups=3 / hours=12`

#### Requirement lines

Examples:

- `PS Homeroom Teachers`
- `PS ASEM`
- `CP English Specialist`
- `College French`
- `Lycée Mathematics`
- `Lycée Shared Autonomy Pool`

### 8.2 Coverage model

Coverage must not be inferred from discipline string matching. It must be explicit.

Introduce a `StaffingAssignment` layer:

- one supply line can cover multiple requirement lines
- one requirement line can be covered by multiple supply lines
- assignments are stored as **hours/week** and/or **FTE share**
- total assignment on a supply line cannot exceed its available FTE
- assignment provenance is `manual`, `auto-suggested`, or `imported`

### 8.3 Gap model

Each requirement line should show:

- `requiredHoursWeekly`
- `requiredFteRaw`
- `requiredFtePlanned`
- `coveredHoursWeekly`
- `coveredFte`
- `gapHoursWeekly`
- `gapFte`
- `coverageStatus`

### 8.4 Rounding policy

The module must explicitly separate:

- **raw FTE** for accurate total demand
- **recommended hireable units** for staffing actions

Do not sum per-line rounded subject positions to derive total FTE. The workbook evidence shows that this inflates demand materially.

### 8.5 HSA model

HSA must be represented in two different ways:

1. **Planning HSA policy**  
   Used to model effective coverage capacity by service profile or staffing category.
2. **Payroll HSA amount**  
   Used to calculate cost on specific supply lines when actual or planned HSA distribution is known.

Recommended rule:

- calculate and store `requiredFteAtBaseOrs`
- calculate and store `requiredFteAtPlannedPolicy`
- calculate `hsaReliefFte = baseOrsFte - plannedPolicyFte`
- default payroll HSA cost from service-profile policy
- allow line-level or supply-level override only with reason and audit trail

### 8.6 Primary vs secondary treatment

Do not force the same logic across all bands.

Recommended treatment:

- **Maternelle:** homeroom + ASEM + host-country specialists; underlying domain hours visible only in driver breakdown
- **Elementaire:** homeroom line remains explicit; specialist-covered subjects become explicit requirement lines only where staffing is actually specialist-covered
- **College/Lycée:** subject-based requirement lines

### 8.7 Academic-period and fiscal-year timing

This must be made explicit in the design and UI:

- the **teaching demand workspace** defaults to **AY2 demand** because AY2 drives September hiring decisions inside the fiscal year
- the **cost engine** remains **Jan-Dec fiscal**
- new positions and assignments use effective dates so Sep-Dec cost phasing stays accurate
- future-proof the data model for `AY1` and `AY2` demand snapshots, even if the first release only renders AY2 as the primary planning surface

## 9. Cost Model

### 9.1 Supply cost modes

Every supply line must declare a cost mode:

- `LOCAL_PAYROLL`
- `AEFE_RECHARGE`
- `NO_LOCAL_COST`

This is cleaner and more future-proof than relying only on `LOCAL` vs `RESIDENT`.

### 9.2 Local payroll

Preserve the existing strengths of the current cost engine:

- monthly employee cost at `employee x month`
- Sep step-change
- Jul-Aug HSA exclusion
- GOSI
- Ajeer
- EoS via YEARFRAC 30/360

### 9.3 Recharge and additional cost categories

Do not assume all workbook categories are stable percentages.

The source workbook shows:

- resident salary recharge
- resident pension contribution
- resident housing / travel recharge
- replacement budget
- training levy

Recommended modeling:

- introduce `VersionStaffingCostAssumption`
- each category has `calculationMode`

Supported modes:

- `FLAT_ANNUAL_AMOUNT`
- `PERCENT_OF_LOCAL_PAYROLL`
- `AMOUNT_PER_FTE`

This supports FY2026 migration while avoiding future lock-in to brittle defaults.

### 9.4 Cost attribution in the teaching grid

Show three separate values when relevant:

- `directAssignedCostAnnual`
- `allocatedOverheadAnnual`
- `totalLoadedCostAnnual`

Do not silently mix directly assigned payroll with top-down recharge allocations.

## 10. Target UX Structure

### 10.1 Teaching workspace layout

Follow the enrollment redesign shell:

```text
PageTransition
  flex h-full flex-col overflow-hidden
    conditional banners
    toolbar
    KPI ribbon
    status strip
    main grid zone
    settings sheet
    supply record form / vacancy form
```

### 10.2 Teaching master grid

Pinned columns:

- band
- row label
- row type

Column groups:

- `Drivers` -> sections, groups, weekly hours
- `Need` -> raw FTE, planned FTE, gap
- `Coverage` -> covered FTE, assigned staff count, vacancy count
- `Cost` -> direct, allocated, loaded annual cost
- `Risk` -> validation state, override flags, explanation state

### 10.3 Support & Admin grid

Separate grid with rows = position lines or employees, grouped by department and role.

Columns:

- role
- department
- status / vacancy
- FTE
- effective dates
- monthly cost
- annual cost
- notes / exception flags

### 10.4 Right-panel detail requirements

For a teaching requirement line, the inspector must show:

1. driver breakdown by grade/rule
2. assignments and coverage
3. supply lines contributing to the row
4. cost split
5. explanation of last change
6. validation warnings

### 10.5 Settings sheet structure

Recommended tabs:

1. `Service Profiles & HSA`
2. `Curriculum / DHG Rules`
3. `Lycee Group Assumptions`
4. `Additional Cost Assumptions`
5. `Calculation & Validation`

### 10.6 Validation-first workflow

The planner should be able to filter the grid by:

- uncovered demand
- over-assigned staff
- missing mapping
- missing specialist assumptions
- expired overrides
- unresolved payroll reconciliation

## 11. Target Data Model

### 11.1 Master data

| Entity                     | Role                                                                       |
| -------------------------- | -------------------------------------------------------------------------- |
| `ServiceObligationProfile` | Governs weekly service obligation, HSA eligibility, default cost treatment |
| `Discipline`               | Controlled subject taxonomy                                                |
| `DisciplineAlias`          | Import/migration normalization                                             |
| `StaffingRole`             | Controlled role taxonomy for teaching and support                          |
| `DhgRule`                  | Effective-dated curriculum / demand rule catalog                           |

### 11.2 Version-scoped input data

| Entity                          | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `VersionStaffingSettings`       | Header settings and calculation switches                      |
| `VersionServiceProfileOverride` | Override service obligations / HSA policy by profile          |
| `VersionStaffingCostAssumption` | Replacement, training, recharge assumptions with mode + value |
| `VersionLyceeGroupAssumption`   | Group counts for specialties, shared pools, autonomy          |
| `DemandOverride`                | Explicit user-entered override to derived need                |

### 11.3 Supply and assignment data

| Entity                                     | Purpose                           |
| ------------------------------------------ | --------------------------------- |
| `Employee` (extended)                      | Existing named staff records      |
| `Vacancy` or `Employee.recordType=VACANCY` | Planned but unnamed supply        |
| `StaffingAssignment`                       | Links supply to requirement lines |

### 11.4 Derived output data

| Entity                       | Purpose                                             |
| ---------------------------- | --------------------------------------------------- |
| `TeachingRequirementSource`  | Traceable line-source execution rows                |
| `TeachingRequirementLine`    | Aggregated teaching demand lines for grid rendering |
| `RequirementCoverageSummary` | Covered / uncovered rollups                         |
| `LineCostSummary`            | Cost rollups per grid row                           |

### 11.5 Recommended evolution of existing tables

#### `DhgGrilleConfig`

Do **not** keep it unchanged.

It should evolve into a richer rule catalog, either by renaming to `DhgRule` or by adding the following fields:

- `ruleCode`
- `band`
- `lineType`
- `driverType`
- `serviceProfileCode`
- `disciplineCode`
- `languageCode`
- `groupingKey`
- `effectiveToYear`

#### `Employee`

Recommended additions:

- `recordType` (`EMPLOYEE`, `VACANCY`)
- `planningCategory` (`TEACHING`, `SUPPORT`)
- `costMode`
- `disciplineCode`
- `serviceProfileCode`
- `homeBand`
- `fteAvailable`

Use controlled codes, not free-text strings, for mapping-critical fields.

#### New `StaffingAssignment`

Minimum fields:

- `versionId`
- `employeeId`
- `requirementLineId`
- `hoursPerWeek`
- `fteShare`
- `source`
- `note`
- `createdAt`, `updatedAt`, `updatedBy`

## 12. Calculation Engine Design

### 12.1 Demand engine

Recommended pipeline:

1. load enrollment and capacity results
2. resolve active DHG rules for the version
3. resolve version service-profile and group assumptions
4. create `TeachingRequirementSource` rows
5. aggregate to `TeachingRequirementLine`
6. calculate raw and planned FTE metrics
7. apply overrides
8. persist output and audit snapshot

### 12.2 Coverage engine

1. load supply lines and assignments
2. validate assignment limits
3. aggregate coverage to requirement lines
4. compute gaps and surpluses
5. persist summaries and warnings

### 12.3 Cost engine

1. calculate local payroll monthly outputs
2. calculate additional/recharge categories by configured mode
3. allocate direct supply costs to requirement lines by assignment share
4. allocate optional overheads to lines using an explicit allocation policy
5. persist annual and monthly read models

### 12.4 Calculation formulas

Core formulas:

- `sectionsNeeded = CEIL(headcount / maxClassSize)`
- `weeklyHours = driverUnits * hoursPerUnit`
- `requiredFteAtBaseOrs = weeklyHours / baseServiceHours`
- `requiredFteAtPlannedPolicy = weeklyHours / plannedEffectiveServiceHours`
- `gapFte = coveredFte - requiredFteAtPlannedPolicy`
- `gapHours = coveredHours - weeklyHours`

### 12.5 Benchmarks and diagnostics

Keep these as diagnostics, not primary drivers:

- H/E benchmark
- AEFE estimated FTE
- average students per division
- YoY version deltas

## 13. Validation, Controls, and Auditability

Mandatory validations:

1. every teaching supply line has a valid service profile
2. every mapping-critical code resolves through master data or alias map
3. no supply line is assigned above 100% available FTE
4. no requirement line has negative covered hours unless explicitly overridden
5. specialty/group assumptions exist where rules require them
6. recharge categories have a valid calculation mode
7. overrides always carry reason, user, and timestamp
8. stale-state warnings identify whether demand, coverage, or cost is outdated

Mandatory auditability requirements:

- persist calculation run header in `calculation_audit_log`
- persist input summary, warning summary, and output summary
- expose explanation metadata to the UI
- show the last calculation timestamp in the status strip

## 14. Performance and Scalability

### 14.1 Read performance

The main teaching grid must not build its row model by joining raw employee, assignment, and decrypted salary data on every load.

Use precomputed read models:

- `TeachingRequirementLine`
- `RequirementCoverageSummary`
- `LineCostSummary`

### 14.2 Write / calculate performance

- keep the calculate pipeline transactional
- recalculate derived outputs in the backend, not in the browser
- only decrypt salary fields when calculating or rendering privileged detail views
- do not embed large employee arrays in every summary row response

### 14.3 Future scale requirements

The design must accommodate:

- more than one campus/entity
- changing DHG policies
- more staffing categories
- scenario comparison
- approval workflow
- payroll/downstream integration

## 15. Data Quality and Migration Strategy

### 15.1 Migration realities from the source files

The source workbooks are not migration-ready as-is. They contain:

- inconsistent names and aliases
- trailing spaces and typos in role names
- manually entered flat amounts with no formula provenance
- hidden sheets and reference tables
- `#N/A` dependencies in the legacy AEFE workbook
- pseudo-employees used to represent vacancies
- mixed summary rows and input rows in the same sheets

### 15.2 Required migration controls

Create import normalization layers for:

- discipline aliases
- role aliases
- department aliases
- married-name / accented-name employee matching
- new-position templates vs named employees

### 15.3 Recommended migration phases

1. **Catalog phase**  
   Build controlled taxonomies and alias tables from the source files.
2. **Demand-rule phase**  
   Convert workbook rules into governed `DhgRule` records.
3. **Supply phase**  
   Import employees and vacancies into structured supply records.
4. **Assignment phase**  
   Seed or manually create coverage assignments where needed.
5. **Reconciliation phase**  
   Validate HSA totals, recharge totals, and annual cost totals against workbook baselines.

## 16. Open Questions Requiring Confirmation

These items are material and should not be silently guessed:

1. **Primary English coverage model**  
   The source staffing data shows primary language specialists, but the DHG summary logic does not explicitly model them.
2. **Arabic/Islamic service profile by band**  
   Source files imply both 24h and 26h-style assumptions in different places.
3. **Resident recharge mode**  
   Should resident costs remain flat annual amounts or become per-FTE profiles?
4. **AY2-only demand in release 1**  
   Confirm whether AY2 remains the only displayed teaching demand snapshot or whether AY1/AY2 switching is needed.
5. **Coverage auto-assignment scope**  
   Confirm whether the system should auto-suggest assignments only within home band/discipline or across College/Lycée by default.

## 17. Recommended Implementation Sequence

### Phase 1 — Foundations

- evolve DHG rule catalog
- add service profiles and cost assumption tables
- extend employee supply model
- build taxonomy + alias normalization

### Phase 2 — Demand and coverage

- implement requirement source and line outputs
- implement assignments and coverage summary
- add validations and explanation metadata

### Phase 3 — Cost integration

- wire local payroll cost to supply lines
- introduce recharge/additional cost assumption modes
- produce line-cost summaries and reconciliation views

### Phase 4 — Workspace UX

- teaching workspace
- support/admin workspace
- settings sheet
- inspector and explain panels
- exports and comparison support

## 18. Acceptance Criteria

The redesign should not be considered complete until all of the following are true:

1. Teaching demand is represented as governed requirement lines with persisted source-row provenance.
2. The grid supports primary and secondary planning without forcing a single subject-only row model.
3. Coverage is based on explicit assignments, not discipline text matching.
4. Raw FTE and recommended hireable units are shown separately.
5. HSA planning policy and HSA payroll cost are modeled separately and can be reconciled.
6. Additional staff cost categories support flat amount, percent-of-payroll, and per-FTE modes.
7. The status strip clearly identifies stale demand, stale coverage, and stale cost conditions.
8. Every override is auditable with user, timestamp, and reason.
9. The teaching workspace supports summary review, drill-in, exception filtering, and explanation of changes.
10. Support/admin staffing can be planned in the same module without cluttering the teaching grid.
11. Source workbook reconciliation exposes and resolves the known pension and HSA inconsistencies before sign-off.
12. API and read-model design avoid loading raw decrypted salary data for the main workspace.
13. The design remains compatible with future scenarios, campuses, and approval workflow.

## 19. Final Recommendation

Proceed with a **review-driven redesign**, not a direct implementation of the earlier draft.

The earlier draft had the right ambition but the wrong simplifying assumptions in three places that matter most: planning grain, assignment logic, and HSA/cost reconciliation. The target design in this document keeps the premium workspace direction while grounding the module in a cleaner conceptual model:

- demand lines instead of universal subject rows
- explicit assignments instead of inferred matching
- governed rules and profiles instead of free-text logic
- auditable policy-vs-payroll separation for HSA and recharge costs

That is the minimum standard required for this module to be logically sound, user-centric, implementation-ready, scalable, auditable, and resilient to future complexity.
