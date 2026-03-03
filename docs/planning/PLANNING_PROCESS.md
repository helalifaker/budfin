# BudFin Planning Process

## Master Workflow: From PRD to Production

**Project**: BudFin -- School Financial Planning Workspace (EFIR)
**PRD Reference**: `BudFin_PRD_v1.0.md`
**Created**: 2026-03-03
**Status**: Active

---

## Table of Contents

1. [Phase Overview](#phase-overview)
2. [Phase 1: PRD Review & Finalization](#phase-1-prd-review--finalization)
3. [Phase 2: Project Constitution](#phase-2-project-constitution)
4. [Phase 3: Tech Stack & Architecture](#phase-3-tech-stack--architecture)
5. [Phase 4: Feature Decomposition](#phase-4-feature-decomposition)
6. [Phase 5: Project Infrastructure Setup](#phase-5-project-infrastructure-setup)
7. [Phase 6: Per-Feature Spec Cycle](#phase-6-per-feature-spec-cycle)
8. [Phase 7: Cross-Feature Integration](#phase-7-cross-feature-integration)
9. [Phase 8: Data Migration](#phase-8-data-migration)
10. [Phase 9: Verification & QA](#phase-9-verification--qa)
11. [Phase 10: Go-Live Readiness](#phase-10-go-live-readiness)
12. [Appendix A: Feature Decomposition & FR Traceability](#appendix-a-feature-decomposition--fr-traceability)
13. [Appendix B: Feature Dependency DAG](#appendix-b-feature-dependency-dag)
14. [Appendix C: SpecKit Command Reference](#appendix-c-speckit-command-reference)
15. [Appendix D: Cross-Reference Matrix](#appendix-d-cross-reference-matrix)

---

## Phase Overview

| Phase | Name | SpecKit Command | Key Output |
|-------|------|-----------------|------------|
| 1 | PRD Review & Finalization | None | Finalized PRD v2.0, Decision Log |
| 2 | Project Constitution | `/speckit.constitution` | Filled constitution with BudFin principles |
| 3 | Tech Stack & Architecture | None | ADRs, Tech Stack doc, Data Architecture |
| 4 | Feature Decomposition | None | Feature list, dependency graph, FR traceability |
| 5 | Project Infrastructure Setup | None | Repo structure, CI/CD, test harness |
| 6 | Per-Feature Spec Cycle (x13) | All SpecKit commands | spec/plan/tasks/analysis per feature |
| 7 | Cross-Feature Integration | None | Integration test suite, E2E validation |
| 8 | Data Migration | None | Migration scripts, validation report |
| 9 | Verification & QA | None | UAT results, acceptance criteria pass |
| 10 | Go-Live Readiness | None | Deployment guide, training materials |

### Critical Path Diagram

```
Phase 1 ──> Phase 2 ──> Phase 3 ──> Phase 4 ──> Phase 5
                                        │
                                        v
                            ┌───────────────────────┐
                            │  Phase 6: Per-Feature  │
                            │  Spec Cycle (x13)      │
                            │  Wave 1 ──> Wave 2     │
                            │  ──> ... ──> Wave 8    │
                            └───────────┬───────────┘
                                        │
                            ┌───────────v───────────┐
                            │  Phase 7: Integration  │
                            │  Phase 8: Migration    │
                            │  (parallel start)      │
                            └───────────┬───────────┘
                                        │
                            ┌───────────v───────────┐
                            │  Phase 9: QA & UAT     │
                            └───────────┬───────────┘
                                        │
                            ┌───────────v───────────┐
                            │  Phase 10: Go-Live     │
                            └───────────────────────┘
```

Phases 1-5 are strictly sequential. Phase 6 features follow the Wave order
defined in [Appendix B](#appendix-b-feature-dependency-dag). Phases 7 and 8
can overlap once enough features are complete. Phases 9 and 10 are sequential
after 7+8.

---

## Phase 1: PRD Review & Finalization

**Purpose**: Ensure the PRD is complete, internally consistent, and
unambiguous before any design work begins. The PRD v1.0 is a 931-line draft
with an 18-section addendum. This phase resolves open questions and produces
a frozen baseline.

**Inputs**:
- `BudFin_PRD_v1.0.md` (current draft)
- Stakeholder access (Chief Accounting Officer, Finance Team)
- Source Excel workbooks for cross-referencing

**Steps**:

1. **Completeness audit** -- Walk through every FR-* identifier and confirm
   each has a testable acceptance criterion. The addendum (Section 18,
   FR-ADD-001 through FR-ADD-032) must be reconciled with the main body:
   - FR-ADD-001 duplicates FR-REV-006 (VAT exemption) -- merge
   - FR-ADD-002 duplicates FR-REV-005 (separate AY fee grids) -- merge
   - FR-ADD-003 overlaps FR-SCN-002 (scenario parameters) -- merge
   - FR-ADD-004 overlaps FR-SCN-006/007 (scenario output metrics) -- merge
   - FR-ADD-025 overlaps FR-DHG-013/014 (HSA scenarios) -- merge into F08
   - FR-ADD-026 through FR-ADD-029 overlap existing DHG FRs (positions
     saved, AEFE benchmarks, staff summary) -- merge into F08
   - FR-ADD-030 duplicates FR-CAP-007 (Near Cap alert) -- merge into F07
   - FR-ADD-031 overlaps FR-DSH-001 (KPI widgets) -- merge into F12
   - FR-ADD-032 overlaps FR-INP-001 (input control panel) -- merge into F12
   Remaining FR-ADD items that are genuinely net-new must be renumbered
   into their parent module's sequence.

2. **Ambiguity resolution** -- Identify and resolve:
   - Undefined terms (e.g., "marge d'autonomie" in FR-DHG-007 -- define hours)
   - Missing boundary conditions (e.g., what happens when enrollment is 0
     for a grade in a given AY period?)
   - Calculation edge cases (e.g., YEARFRAC behavior for employees with
     joining date on Feb 29)
   - NFR specifics (e.g., "SSO integration or secure login" -- which one?)

3. **Stakeholder sign-off** -- Present reconciled FR list to the Chief
   Accounting Officer. Confirm calculation formulas in Section 10 match
   the actual Excel logic (cell-by-cell spot checks on 5 representative
   employees and 5 revenue line items).

4. **Version bump** -- Produce `BudFin_PRD_v2.0.md` with:
   - Merged addendum FRs into main sections
   - All ambiguities resolved or explicitly deferred to Phase 3
   - A Decision Log section documenting each resolution

**Outputs**:
- `BudFin_PRD_v2.0.md` (frozen baseline)
- `docs/decisions/phase-1-decision-log.md`

**Quality Gate**:
- [ ] Every FR has a unique, non-duplicate ID
- [ ] Every FR has at least one testable acceptance criterion
- [ ] Zero unresolved ambiguities in calculation formulas (Section 10)
- [ ] Stakeholder sign-off recorded in decision log
- [ ] Addendum section is empty (all items merged or rejected)

**SpecKit Command**: None (pre-SpecKit phase)

---

## Phase 2: Project Constitution

**Purpose**: Establish the non-negotiable principles, constraints, and
governance rules that guide all subsequent design and implementation
decisions. The constitution is the authority that SpecKit commands validate
against.

**Inputs**:
- `BudFin_PRD_v2.0.md` (frozen)
- `.specify/memory/constitution.md` (template with placeholders)
- `.specify/templates/constitution-template.md` (structure reference)

**Steps**:

1. **Derive principles from PRD** -- Extract the core constraints:
   - **Financial Accuracy**: All calculations must match Excel baselines
     within +/-1 SAR tolerance (PRD Section 16.1, items 1-3).
   - **IFRS Compliance**: Revenue recognition per IFRS 15, expense
     classification per IAS 1, ECL per IFRS 9 (PRD Section 8.6).
   - **Saudi Regulatory Compliance**: GOSI rates, Ajeer program, ZATCA
     Zakat rules, Saudi labor law EoS (PRD Sections 8.5.3, 8.6.1).
   - **Workspace Continuity**: Context bar state must persist across all
     module navigation with zero loss (PRD Section 6.1, NFR).
   - **Auditability**: Every data modification logged with full attribution
     (PRD Section 8.9).
   - **Version Isolation**: Each budget/forecast version carries its own
     snapshot of all data -- no cross-version contamination (PRD Section 7).

2. **Define governance** -- Amendment procedure, versioning policy
   (MAJOR.MINOR.PATCH), compliance review cadence.

3. **Fill the constitution** -- Replace all `[PLACEHOLDER]` tokens in
   `.specify/memory/constitution.md` with concrete BudFin values.

4. **Propagation check** -- Verify templates are consistent with the
   new constitution (plan-template, spec-template, tasks-template).

**Outputs**:
- `.specify/memory/constitution.md` (filled, version 1.0.0)
- Sync Impact Report (embedded as HTML comment in constitution)

**Quality Gate**:
- [ ] Zero remaining `[PLACEHOLDER]` tokens in constitution
- [ ] Each principle is declarative and testable (no vague "should" language)
- [ ] Governance section defines amendment procedure
- [ ] All dependent templates verified consistent

**SpecKit Command**: `/speckit.constitution`

Run with input describing the 6 principles above. The command will:
1. Load `.specify/memory/constitution.md`
2. Fill all placeholder tokens
3. Validate consistency with dependent templates
4. Produce a Sync Impact Report

---

## Phase 3: Tech Stack & Architecture

**Purpose**: Make and document the foundational technology decisions that
shape all subsequent feature implementation. These decisions are recorded
as Architecture Decision Records (ADRs) so the rationale is preserved.

**Inputs**:
- `BudFin_PRD_v2.0.md` (frozen)
- `.specify/memory/constitution.md` (filled)
- PRD NFRs (Section 11) and UI/UX principles (Section 12)

**Steps**:

1. **Tech stack selection** -- Decide and document:
   - Frontend framework (must support dense data grids with Excel-like
     keyboard navigation per PRD Section 12)
   - Backend framework/language
   - Database (must support the 5-domain relational schema in PRD Section 9)
   - Authentication approach (resolve "SSO or secure login" from NFRs)
   - Hosting/deployment target
   - Testing frameworks (unit, integration, E2E)
   - Package manager, build tools, linting

2. **Data architecture** -- Design based on PRD Section 9:
   - Normalize the 5-domain schema (Enrollment, Revenue, Staffing,
     Staff Costs, Budget & Reporting)
   - Define version isolation strategy (how budget versions snapshot data)
   - Plan audit trail storage (append-only log vs. event sourcing)
   - Design calculation engine architecture (where formulas from Section 10
     execute -- client, server, or hybrid)

3. **Architecture Decision Records** -- One ADR per major decision:
   - ADR-001: Frontend framework selection
   - ADR-002: Backend framework selection
   - ADR-003: Database selection
   - ADR-004: Authentication strategy
   - ADR-005: Calculation engine architecture
   - ADR-006: Version isolation strategy
   - ADR-007: Deployment architecture

4. **API design approach** -- REST vs. GraphQL, pagination strategy for
   large data grids, real-time update mechanism (for auto-save per NFR).

**Outputs**:
- `docs/architecture/tech-stack.md`
- `docs/architecture/data-architecture.md`
- `docs/architecture/adr/ADR-001.md` through `ADR-007.md`

**Quality Gate**:
- [ ] Every ADR has: context, decision, rationale, alternatives considered
- [ ] Tech stack addresses every NFR from PRD Section 11
- [ ] Data architecture covers all 5 domains from PRD Section 9
- [ ] Calculation engine design handles all formulas from PRD Section 10
- [ ] Version isolation strategy prevents cross-version data contamination
- [ ] Constitution principles are not violated by any decision

**SpecKit Command**: None (pre-SpecKit phase, but constitution is referenced)

---

## Phase 4: Feature Decomposition

**Purpose**: Break the PRD into implementable features with clear boundaries,
explicit FR traceability, and a dependency ordering that enables the
per-feature SpecKit cycle in Phase 6.

**Inputs**:
- `BudFin_PRD_v2.0.md` (frozen)
- ADRs from Phase 3
- Constitution from Phase 2

**Steps**:

1. **Decompose into 13 features** -- See [Appendix A](#appendix-a-feature-decomposition--fr-traceability)
   for the full breakdown with FR traceability. Each feature maps to one or
   more PRD modules and has a well-defined boundary.

2. **Build dependency graph** -- See [Appendix B](#appendix-b-feature-dependency-dag)
   for the full DAG organized into 8 implementation waves.

3. **Validate completeness** -- Confirm every FR-* ID from the PRD is
   assigned to exactly one feature. No orphaned requirements.

4. **Estimate relative sizing** -- T-shirt size each feature (S/M/L/XL)
   based on FR count and complexity. This informs team allocation.

5. **Identify parallelization opportunities** -- Within each wave, mark
   which features can be developed concurrently by independent teams.

**Outputs**:
- `docs/features/feature-decomposition.md` (feature list with FR mapping)
- `docs/features/dependency-graph.md` (DAG with waves)
- `docs/features/sizing-estimates.md`

**Quality Gate**:
- [ ] All 136 unique FRs assigned to exactly one feature
- [ ] Dependency graph has no circular dependencies
- [ ] Every feature has a clear input boundary and output boundary
- [ ] At least 2 features per wave can run in parallel (except Wave 1)
- [ ] Feature naming is consistent and descriptive

**SpecKit Command**: None (pre-SpecKit phase)

---

## Phase 5: Project Infrastructure Setup

**Purpose**: Create the repository structure, CI/CD pipeline, and developer
tooling so that Phase 6 feature work can begin immediately without
infrastructure blockers.

**Inputs**:
- Tech stack decisions from Phase 3
- Feature decomposition from Phase 4
- Constitution from Phase 2

**Steps**:

1. **Repository structure** -- Initialize the monorepo (or polyrepo per ADR)
   with the directory layout defined in Phase 3. Create placeholder
   directories for all 13 features.

2. **Dependency installation** -- Set up package manager, lock files, and
   dependency resolution. Pin major versions.

3. **Linting & formatting** -- Configure code quality tools per tech stack.
   Enforce via pre-commit hooks.

4. **Testing harness** -- Set up unit, integration, and E2E test runners.
   Create a `tests/` structure matching the source layout. Configure
   coverage reporting with 80% minimum threshold.

5. **CI/CD pipeline** -- Configure:
   - Lint + type check on every push
   - Unit tests on every push
   - Integration tests on PR to main
   - Build + deploy on merge to main
   - Coverage enforcement (fail below 80%)

6. **Database setup** -- Initialize migration framework, create initial
   schema migration for master data tables (from Phase 3 data architecture).

7. **Environment configuration** -- Set up `.env.example`, secrets
   management, and environment-specific configs (dev, staging, production).

8. **Developer documentation** -- `CONTRIBUTING.md` with setup instructions,
   coding standards (from constitution), and PR workflow.

**Outputs**:
- Working repository with CI/CD passing on empty project
- Database migration framework with initial master data schema
- Developer setup documented and tested

**Quality Gate**:
- [ ] `pnpm install` (or equivalent) succeeds with zero warnings
- [ ] Linter runs clean on empty project
- [ ] Test runner executes with zero tests, zero failures
- [ ] CI pipeline passes end-to-end on an empty commit
- [ ] Database migrations run forward and backward cleanly
- [ ] A new developer can set up the project by following CONTRIBUTING.md

**SpecKit Command**: None (infrastructure phase)

---

## Phase 6: Per-Feature Spec Cycle

**Purpose**: For each of the 13 features, run the full SpecKit workflow to
produce a specification, implementation plan, task breakdown, quality
analysis, and finally the implementation itself. This is the core
development loop.

**Inputs**:
- Feature decomposition from Phase 4 (feature name + FR list)
- Constitution from Phase 2
- Tech stack + ADRs from Phase 3
- Working infrastructure from Phase 5

### 6.1 Per-Feature Workflow

For each feature, execute these steps in order. The SpecKit commands are
listed with their purpose and what they produce.

```
Feature Description
       │
       v
┌─────────────────────┐
│ /speckit.specify     │ ──> spec.md (what + why)
└──────────┬──────────┘
           v
┌─────────────────────┐
│ /speckit.clarify     │ ──> Updated spec.md (ambiguities resolved)
└──────────┬──────────┘
           v
┌─────────────────────┐
│ /speckit.checklist   │ ──> checklists/requirements.md (spec quality)
└──────────┬──────────┘
           v
┌─────────────────────┐
│ /speckit.plan        │ ──> plan.md + research.md + data-model.md
└──────────┬──────────┘      + contracts/ + quickstart.md
           v
┌─────────────────────┐
│ /speckit.tasks       │ ──> tasks.md (ordered, dependency-aware)
└──────────┬──────────┘
           v
┌─────────────────────┐
│ /speckit.analyze     │ ──> Analysis report (consistency check)
└──────────┬──────────┘
           v
┌─────────────────────┐
│ /speckit.checklist   │ ──> checklists/implementation.md (impl quality)
└──────────┬──────────┘
           v
┌─────────────────────┐
│ /speckit.implement   │ ──> Working code, tests passing
└──────────┬──────────┘
           v
┌─────────────────────┐
│ /speckit.taskstoissues│ ──> GitHub issues (if using GitHub)
└─────────────────────┘
```

### 6.2 Step-by-Step Detail

**Step 1: Specify** (`/speckit.specify`)

- **Input**: Natural language feature description including the FR-* IDs
  from the decomposition.
- **Action**: Creates a feature branch (`N-feature-name`) and generates
  `specs/N-feature-name/spec.md` with user stories (prioritized P1-P3+),
  functional requirements, acceptance scenarios, and success criteria.
- **Output**: `spec.md` in the feature's spec directory.
- **Validation**: Spec Quality Checklist auto-generated and checked. Maximum
  3 `[NEEDS CLARIFICATION]` markers allowed.

**Step 2: Clarify** (`/speckit.clarify`)

- **Input**: The spec.md from Step 1.
- **Action**: Scans for ambiguities across 10 taxonomy categories (functional
  scope, domain model, UX flow, NFRs, integrations, edge cases, constraints,
  terminology, completion signals, placeholders). Asks up to 5 sequential
  questions with recommendations. Encodes answers directly into spec.md.
- **Output**: Updated `spec.md` with clarifications section and resolved
  ambiguities.
- **Validation**: Coverage summary table showing all categories as
  Clear/Resolved. Zero outstanding critical ambiguities.

**Step 3: Checklist -- Requirements Quality** (`/speckit.checklist`)

- **Input**: spec.md + clarification context.
- **Action**: Generates a requirements quality checklist (not implementation
  verification -- these are "unit tests for English"). Validates requirement
  completeness, clarity, consistency, measurability, and coverage.
- **Output**: `checklists/requirements.md` with CHK001+ items.
- **Validation**: All checklist items pass before proceeding to planning.

**Step 4: Plan** (`/speckit.plan`)

- **Input**: spec.md (clarified), constitution.
- **Action**: Executes the planning workflow:
  - Phase 0: Research unknowns, produce `research.md`
  - Phase 1: Design data model (`data-model.md`), define contracts
    (`contracts/`), create quickstart scenarios (`quickstart.md`)
  - Constitution Check: validate design against principles
- **Output**: `plan.md`, `research.md`, `data-model.md`, `contracts/`,
  `quickstart.md`.
- **Validation**: All NEEDS CLARIFICATION resolved. Constitution gates pass.

**Step 5: Tasks** (`/speckit.tasks`)

- **Input**: plan.md, spec.md, data-model.md, contracts/.
- **Action**: Generates dependency-ordered task list organized by user story.
  Each task has: checkbox, ID (T001+), parallel marker [P], story label
  [US1+], description with exact file path.
- **Output**: `tasks.md` with phased structure (Setup > Foundational >
  User Stories > Polish).
- **Validation**: Every user story has all needed tasks. Format passes
  strict checklist validation.

**Step 6: Analyze** (`/speckit.analyze`)

- **Input**: spec.md, plan.md, tasks.md, constitution.
- **Action**: Read-only cross-artifact consistency analysis. Detects
  duplications, ambiguities, underspecification, constitution violations,
  coverage gaps, and terminology drift. Produces severity-rated findings
  (CRITICAL/HIGH/MEDIUM/LOW).
- **Output**: Analysis report with findings table, coverage summary,
  and next actions.
- **Validation**: Zero CRITICAL issues. All requirements have >= 1
  associated task. Coverage >= 90%.
- **Remediation if CRITICAL issues found**: Do not proceed to Step 7.
  Instead, trace each CRITICAL finding back to its source artifact
  (spec.md, plan.md, or tasks.md), fix the artifact directly, then
  re-run `/speckit.analyze`. If the issue is a constitution violation,
  the artifact must be changed -- not the constitution (constitution
  changes require a separate `/speckit.constitution` invocation).
  Repeat until zero CRITICAL issues remain.

**Step 7: Checklist -- Implementation Quality** (`/speckit.checklist`)

- **Input**: Domain-specific request (e.g., "calculation accuracy",
  "IFRS compliance", "data grid UX").
- **Action**: Generates implementation-focused requirements quality
  checklist for the specific domain.
- **Output**: `checklists/<domain>.md`.
- **Validation**: All items reviewed and passing before implementation.

**Step 8: Implement** (`/speckit.implement`)

- **Input**: tasks.md, plan.md, all design artifacts.
- **Action**: Executes tasks phase-by-phase. Respects dependency ordering.
  Marks tasks complete in tasks.md as they finish. Validates checklists
  before starting. Creates ignore files per tech stack.
- **Output**: Working code with tests passing.
- **Validation**: All tasks marked [X]. Tests pass. Coverage >= 80%.

**Step 9: Tasks to Issues** (`/speckit.taskstoissues`) -- Optional

- **Input**: tasks.md, git remote.
- **Action**: Creates GitHub issues for each task with dependency ordering.
- **Output**: GitHub issues linked to the feature branch.
- **Validation**: Issues created only in the correct repository.

### 6.3 Feature Execution Order

Features must be implemented in Wave order per the dependency DAG
([Appendix B](#appendix-b-feature-dependency-dag)). Within each wave,
features marked with `[parallel]` can be developed concurrently.

| Wave | Features | Parallelizable |
|------|----------|----------------|
| 1 | F01: Master Data Foundation, F02: Auth & Workspace Shell | Yes (independent) |
| 2 | F03: Version Management | No (depends on Wave 1) |
| 3 | F04: Enrollment Module | No (depends on Wave 2) |
| 4 | F05: Fee Grid & Discounts, F07: Capacity Planning | Yes (both depend on Wave 3) |
| 5 | F06: Revenue Calculation Engine, F08: Staffing (DHG) | Yes (Revenue depends on Wave 4; DHG on Wave 3) |
| 6 | F09: Staff Costs | No (depends on Wave 5 DHG for FTE link) |
| 7 | F10: P&L & IFRS, F11: Scenario Modeling | Yes (both depend on Waves 5+6) |
| 8 | F12: Dashboard & Analytics, F13: Audit Trail | Yes (Dashboard depends on all; Audit is cross-cutting) |

**Outputs**:
- Per feature: `specs/N-feature-name/` containing spec.md, plan.md,
  tasks.md, research.md, data-model.md, contracts/, quickstart.md,
  checklists/
- Working, tested code per feature

**Quality Gate** (per feature):
- [ ] `/speckit.analyze` returns zero CRITICAL issues
- [ ] All tasks in tasks.md marked [X]
- [ ] Tests pass with >= 80% coverage for new code
- [ ] Checklists complete (all items checked)
- [ ] Constitution principles verified (accuracy, IFRS, audit)

**SpecKit Commands**: All 9 commands used in sequence per feature.

---

## Phase 7: Cross-Feature Integration

**Purpose**: Validate that features work correctly together. Individual
feature tests confirm isolation; integration tests confirm the data flows
across module boundaries produce correct end-to-end results.

**Inputs**:
- All 13 features implemented and individually tested
- PRD calculation formulas (Section 10)
- Source Excel workbooks (for baseline comparison)

**Steps**:

1. **Enrollment-to-Revenue pipeline** -- Verify the complete flow:
   enrollment headcount (F04) x fee grid (F05) = revenue (F06), with
   discount engine and VAT exemption applied correctly. Compare monthly
   revenue output against `REVENUE_ENGINE` sheet totals.

2. **Enrollment-to-Staffing pipeline** -- Verify: enrollment sections (F04)
   drive DHG hours (F08), FTE calculation feeds into staff cost positions
   (F09).

3. **Revenue + Staff Costs to P&L** -- Verify: revenue from F06 and staff
   costs from F09 consolidate into P&L (F10) with correct IFRS
   classification. Compare against `IFRS Income Statement` sheet.

4. **Scenario propagation** -- Verify: changing scenario parameters (F11)
   correctly ripples through enrollment, revenue, and staff cost
   calculations. Compare against `SCENARIOS` sheet outputs.

5. **Version isolation** -- Create two budget versions, modify data in one,
   confirm the other is unaffected. Run version comparison and verify
   variance calculations.

6. **Context bar persistence** -- Navigate across all modules with a
   specific context (fiscal year, version, scenario, AY period). Confirm
   zero context loss per NFR.

7. **Audit trail completeness** -- Make modifications across all modules.
   Verify every change is captured in the audit log (F13) with correct
   timestamp, user, field, old/new values.

8. **Dashboard aggregation** -- Verify KPIs (F12) correctly pull from
   enrollment, revenue, capacity, and P&L modules.

**Outputs**:
- `tests/integration/` -- Cross-feature integration test suite
- `docs/validation/integration-report.md` -- Results summary

**Quality Gate**:
- [ ] Enrollment-to-Revenue pipeline matches Excel within +/-1 SAR per line
- [ ] P&L totals match IFRS Income Statement within +/-1 SAR
- [ ] Scenario changes propagate correctly to all dependent calculations
- [ ] Version isolation confirmed (zero cross-contamination)
- [ ] Context bar maintains state across 100% of module transitions
- [ ] Audit trail captures 100% of modifications made during testing

**SpecKit Command**: None (cross-feature validation)

---

## Phase 8: Data Migration

**Purpose**: Import all existing data from the 4 Excel workbooks and 5 CSV
files into the new application, then validate every migrated value against
the source.

**Inputs**:
- Source files per PRD Section 13.1:
  - `enrollment_2021-22.csv` through `enrollment_2025-26.csv`
  - `01_EFIR_Revenue_FY2026_v3.xlsx` (12 sheets)
  - `02_EFIR_DHG_FY2026_v1.xlsx` (9 sheets)
  - `EFIR_Staff_Costs_Budget_FY2026_V3.xlsx` (8 sheets)
  - `EFIR_Consolidated_Monthly_Budget_FY2026.xlsx` (2 sheets)
- Sheet-level mapping from PRD Section 13.2
- Working application from Phase 6

**Steps**:

1. **Build migration scripts** -- One script per source file, following the
   sheet-level mapping in PRD Section 13.2. Each script must:
   - Parse the source file format (CSV or XLSX)
   - Map source columns to application data model
   - Handle data type conversions and null values
   - Log every imported record with source reference

2. **Dry-run migration** -- Execute scripts against a staging environment.
   Capture import logs and error reports.

3. **Validation per PRD Section 13.3**:
   - Reconcile total enrollment counts per grade and per year against CSV
   - Verify fee grid values for all 45+ combinations
   - Confirm revenue engine output matches REVENUE_ENGINE sheet totals
     (annual and monthly) within 1 SAR tolerance
   - Validate all 168 employee records with correct salary components
   - Confirm EoS provisions match for each employee within 1 SAR
   - Verify consolidated P&L matches IFRS Income Statement totals

4. **Fix discrepancies** -- For any value outside tolerance, trace back to
   the source cell, identify the mapping error, fix the script, and re-run.

5. **Production migration** -- Execute validated scripts against production
   database. Re-run validation suite.

**Outputs**:
- `scripts/migration/` -- Migration scripts per source file
- `docs/validation/migration-report.md` -- Cell-by-cell validation results
- Migration audit log (who ran, when, record counts)

**Quality Gate**:
- [ ] All 168 employee records imported with correct salary components
- [ ] Fee grid: 45+ combinations verified against source
- [ ] Revenue output within +/-1 SAR per line item per month
- [ ] EoS provisions within +/-1 SAR per employee
- [ ] P&L totals match consolidated budget workbook
- [ ] Zero data loss (source record count = imported record count per table)

**SpecKit Command**: None (data migration phase)

---

## Phase 9: Verification & QA

**Purpose**: Formal user acceptance testing and comprehensive verification
that the application meets all acceptance criteria defined in PRD
Section 16.

**Inputs**:
- Working application with migrated data
- PRD Section 16 acceptance criteria
- Finance team users (testers)
- Source Excel workbooks (parallel-run reference)

**Steps**:

1. **Parallel-run validation** -- Finance team uses both the application
   and Excel workbooks simultaneously for a defined period. Compare outputs
   at every checkpoint:
   - Monthly revenue figures
   - Monthly staff cost figures
   - P&L line items
   - Scenario comparison outputs

2. **Go-Live acceptance criteria verification** (PRD Section 16.1):
   - [ ] Revenue calculations match Excel within +/-1 SAR per line per month
   - [ ] Staff cost calculations match within +/-1 SAR per employee per month
   - [ ] EoS provisions match for all 168 employees within +/-1 SAR
   - [ ] Version comparison produces correct variance at P&L summary and
     line-item level
   - [ ] Context bar maintains state across all module navigations
   - [ ] All data modifications recorded in audit trail
   - [ ] IFRS Income Statement matches consolidated budget structure/totals
   - [ ] Application load time < 1 second for all modules

3. **NFR verification** (PRD Section 11):
   - Performance: page load < 1s, full recalculation < 3s, version
     comparison < 5s
   - Reliability: auto-save every 30s, zero calculation discrepancies
   - Security: RBAC with Admin/Editor/Viewer roles, encryption at rest
     and in transit
   - Usability: keyboard navigation, undo/redo 20+ deep, context persistence
   - Data: export to Excel/PDF/CSV for all reports

4. **Edge case testing**:
   - Zero enrollment for a grade in AY2
   - Employee with exactly 5 years of service (EoS boundary)
   - 100% capacity utilization (Plafond boundary)
   - Scenario with 0% fee collection rate
   - Version comparison with no changes (zero variance)

5. **Accessibility audit** -- Verify WCAG AA compliance for all interactive
   elements, keyboard navigation for data grids, and sufficient color
   contrast.

**Outputs**:
- `docs/validation/uat-report.md` -- Test results per acceptance criterion
- `docs/validation/nfr-report.md` -- NFR verification results
- Defect log with severity ratings

**Quality Gate**:
- [ ] All 8 go-live acceptance criteria pass
- [ ] All NFR targets met
- [ ] Zero Critical or High severity defects open
- [ ] Finance team signs off on parallel-run results
- [ ] Accessibility audit passes WCAG AA

**SpecKit Command**: None (QA phase)

---

## Phase 10: Go-Live Readiness

**Purpose**: Prepare everything needed for production deployment and ongoing
operations. Ensure the finance team can use the application independently.

**Inputs**:
- Verified application from Phase 9
- UAT sign-off
- Deployment architecture from ADR-007

**Steps**:

1. **Deployment guide** -- Document the production deployment process:
   - Infrastructure provisioning
   - Database migration execution
   - Application deployment steps
   - Environment variable configuration
   - SSL/TLS certificate setup
   - Backup configuration (RPO < 24 hours per NFR)

2. **Rollback plan** -- Define rollback procedures for:
   - Failed deployment
   - Data corruption
   - Critical bug discovered post-deploy

3. **Training materials** -- Create for each user role:
   - Admin: system configuration, user management, version lifecycle
   - Editor: data entry workflows, enrollment planning, staff cost updates
   - Viewer: report navigation, export, dashboard interpretation

4. **Operations runbook** -- Document:
   - Monitoring and alerting (99.9% uptime target)
   - Backup and recovery procedures
   - Audit log management (7-year retention per NFR)
   - Performance baseline metrics

5. **Go-live checklist**:
   - [ ] Production environment provisioned and tested
   - [ ] Database migrations run cleanly
   - [ ] Data migration validated in production
   - [ ] SSL certificates installed
   - [ ] Backup schedule configured and tested
   - [ ] Monitoring alerts configured
   - [ ] User accounts created with correct roles
   - [ ] Training completed for all users
   - [ ] Rollback plan tested
   - [ ] UAT sign-off documented

6. **Post-launch monitoring plan** -- Define the 6-month success metrics
   from PRD Section 16.2:
   - Budget preparation cycle < 2 weeks (vs. 4-6 weeks baseline)
   - Zero external Excel files for monthly reporting
   - 100% budget changes tracked with audit attribution
   - Finance team satisfaction >= 4/5

**Outputs**:
- `docs/deployment/deployment-guide.md`
- `docs/deployment/rollback-plan.md`
- `docs/training/` -- Per-role training materials
- `docs/operations/runbook.md`
- `docs/deployment/go-live-checklist.md`

**Quality Gate**:
- [ ] Deployment guide tested by someone other than the author
- [ ] Rollback plan tested in staging
- [ ] All users trained and confirmed ready
- [ ] Go-live checklist 100% complete
- [ ] Post-launch monitoring dashboards configured

**SpecKit Command**: None (operational readiness phase)

---

## Appendix A: Feature Decomposition & FR Traceability

### 13 Features with PRD FR Mapping

**F01: Master Data Foundation**
- PRD Sections: 8.8, 9
- FRs: FR-MDM-001 through FR-MDM-008
- Size: M (8 FRs)
- Scope: Chart of accounts, profit centers, cost centers, departments,
  academic years, grade levels, nationality/tariff reference data,
  assumption parameters.

**F02: Authentication & Workspace Shell**
- PRD Sections: 6.1, 6.2, 11 (Security), 12
- FRs: NFR-Security (Auth, RBAC, Encryption), FR-related to Context Bar
  and Navigation
- Size: M
- Scope: SSO/login, role-based access (Admin/Editor/Viewer), context bar
  (fiscal year, version, scenario, AY period), navigation module structure.

**F03: Version Management**
- PRD Sections: 7.1, 7.2, 7.3
- FRs: Version Types (Budget/Actual/Forecast), Version Lifecycle
  (Draft/Published/Locked), Comparison Engine
- Size: M
- Scope: Version CRUD, lifecycle state machine, snapshot isolation,
  comparison engine with variance calculation, color-coded overlays.

**F04: Enrollment Module**
- PRD Sections: 8.1.1, 8.1.2
- FRs: FR-ENR-001 through FR-ENR-013. Note: FR-ADD-001 (VAT exemption)
  and FR-ADD-002 (separate AY fee grids) are revenue-side items that
  merge into F05/F06, not F04.
- Size: L (13 FRs)
- Scope: Historical enrollment import (5-year CSV), enrollment planning
  (two-stage entry), nationality/tariff breakdown, cohort progression
  modeling, lateral entry weights, AY1/AY2 split.

**F05: Fee Grid & Discounts**
- PRD Sections: 8.2.1, 8.2.2
- FRs: FR-REV-001 through FR-REV-010, FR-ADD-001 (merges into FR-REV-006),
  FR-ADD-002 (merges into FR-REV-005)
- Size: M (10 FRs + 2 addendum overlaps)
- Scope: Fee grid (Grade x Nationality x Tariff), fee components
  (DAI, Tuition TTC/HT, Terms), auto HT calculation, VAT exemption
  for Nationaux, discount policies (RP, R3+), discount impact analysis.

**F06: Revenue Calculation Engine**
- PRD Sections: 8.2.3, 8.2.4, 8.2.5, 10.1, 10.6
- FRs: FR-REV-011 through FR-REV-021, FR-ADD-005 through FR-ADD-007
- Size: XL (14 FRs, 3 net-new from addendum)
- Scope: Monthly revenue calculation with AY calendar, IFRS 15
  classification, non-tuition revenue (15+ categories), custom month
  distribution, examination fees, scholarship allocation, fee collection
  rate, scenario adjustment factors.

**F07: Capacity Planning**
- PRD Sections: 8.3, 10.4
- FRs: FR-CAP-001 through FR-CAP-007, FR-ADD-030 (merges into FR-CAP-007)
- Size: S (7 FRs + 1 addendum overlap)
- Scope: Sections needed calculation, three-tier utilization thresholds,
  traffic-light alerts, recruitment slot calculation, Near Cap warning.

**F08: Staffing (DHG)**
- PRD Sections: 8.4.1 through 8.4.4, 10.5
- FRs: FR-DHG-001 through FR-DHG-021, FR-ADD-025 through FR-ADD-029
  (addendum items merge into existing DHG FRs after Phase 1 dedup)
- Size: XL (21 FRs + 5 addendum overlaps)
- Scope: Curriculum grilles (4 bands), FTE calculation engine, HSA
  optimization (4 scenarios), subject-level staffing, AEFE benchmark
  comparison, ASEM requirements, host-country hours.

**F09: Staff Costs**
- PRD Sections: 8.5.1 through 8.5.6, 10.2, 10.3
- FRs: FR-STC-001 through FR-STC-025, FR-ADD-008 through FR-ADD-017
- Size: XL (35 FRs)
- Scope: Employee master data (168 records, 18+ fields), 5 salary
  components, statutory costs (GOSI, Ajeer, EoS), monthly cost budget,
  additional cost lines, department/function analytics, YoY comparison.

**F10: P&L & IFRS Reporting**
- PRD Sections: 8.6, 8.6.1, 8.6.2
- FRs: FR-PNL-001 through FR-PNL-018, FR-ADD-018 through FR-ADD-024
- Size: L (25 FRs)
- Scope: Monthly P&L (IFRS Function of Expense), IFRS 15 revenue detail,
  expense classification, key subtotals (EBITDA, Operating Profit, Net
  Result), IFRS mapping, finance income/costs, Zakat calculation,
  version comparison overlay.

**F11: Scenario Modeling**
- PRD Sections: 8.7, 10.6
- FRs: FR-SCN-001 through FR-SCN-007, FR-ADD-003 (merges into FR-SCN-002),
  FR-ADD-004 (merges into FR-SCN-006/007)
- Size: M (7 FRs + 2 addendum overlaps)
- Scope: Three pre-defined scenarios (Base/Optimistic/Pessimistic),
  5 configurable parameters, scenario propagation through all calculations,
  side-by-side comparison, custom scenarios, output metrics with deltas.

**F12: Dashboard & Analytics**
- PRD Sections: 8.10, 8.11
- FRs: FR-DSH-001 through FR-DSH-005, FR-INP-001 through FR-INP-003,
  FR-ADD-031 (merges into FR-DSH-001), FR-ADD-032 (merges into FR-INP-001)
- Size: M (8 FRs + 2 addendum overlaps)
- Scope: Executive KPI widgets (revenue, students, utilization, discount
  rate), P&L summary, enrollment trends, capacity alerts, variance
  indicators, input control panel/map.

**F13: Audit Trail & Change History**
- PRD Sections: 8.9
- FRs: FR-AUD-001 through FR-AUD-004
- Size: S (4 FRs)
- Scope: Full modification logging (timestamp, user, field, old/new value),
  version-level audit events, searchable audit viewer, CSV export.

### FR Count Summary

| Feature | Core FRs | Addendum Overlaps | PRD Module(s) |
|---------|----------|-------------------|---------------|
| F01: Master Data | 8 | 0 | 8.8, 9 |
| F02: Auth & Shell | ~6 | 0 | 6.1, 6.2, 11, 12 |
| F03: Version Mgmt | ~8 | 0 | 7.1-7.3 |
| F04: Enrollment | 13 | 0 | 8.1 |
| F05: Fee Grid | 10 | 2 (ADD-001, ADD-002) | 8.2.1-8.2.2 |
| F06: Revenue Engine | 11 | 3 (ADD-005-007) | 8.2.3-8.2.5, 10.1, 10.6 |
| F07: Capacity | 7 | 1 (ADD-030) | 8.3, 10.4 |
| F08: Staffing | 21 | 5 (ADD-025-029) | 8.4, 10.5 |
| F09: Staff Costs | 25 | 10 (ADD-008-017) | 8.5, 10.2, 10.3 |
| F10: P&L/IFRS | 18 | 7 (ADD-018-024) | 8.6 |
| F11: Scenarios | 7 | 2 (ADD-003, ADD-004) | 8.7, 10.6 |
| F12: Dashboard | 8 | 2 (ADD-031, ADD-032) | 8.10, 8.11 |
| F13: Audit Trail | 4 | 0 | 8.9 |
| **Total** | **~146** | **32** | |

Note: The 32 addendum items (FR-ADD-001 through FR-ADD-032) are all
assigned. Most overlap with existing core FRs and will be merged during
Phase 1 deduplication. After merging, the unique FR count will be
approximately 146 (net-new addendum items added to their parent modules).

---

## Appendix B: Feature Dependency DAG

### Dependency Graph

```
Wave 1:  F01 Master Data ─────────────────────────────────────┐
         F02 Auth & Shell ─────────────────────────────────────┤
                                                               │
Wave 2:  F03 Version Management ──(depends: F01, F02)─────────┤
                                                               │
Wave 3:  F04 Enrollment ──(depends: F01, F03)──────────────────┤
                                                               │
Wave 4:  F05 Fee Grid & Discounts ──(depends: F01, F04)───┐   │
         F07 Capacity Planning ──(depends: F04)────────┐   │   │
                                                       │   │   │
Wave 5:  F06 Revenue Engine ──(depends: F04, F05)──┐   │   │   │
         F08 Staffing/DHG ──(depends: F01, F04)──┐ │   │   │   │
                                                 │ │   │   │   │
Wave 6:  F09 Staff Costs ──(depends: F08)────┐   │ │   │   │   │
                                             │   │ │   │   │   │
Wave 7:  F10 P&L/IFRS ──(depends: F06,F09)──┤   │ │   │   │   │
         F11 Scenarios ──(depends: F04,F06)──┤   │ │   │   │   │
                                             │   │ │   │   │   │
Wave 8:  F12 Dashboard ──(depends: all)──────┘   │ │   │   │   │
         F13 Audit Trail ──(cross-cutting)───────┘─┘───┘───┘───┘
```

### Dependency Details

| Feature | Depends On | Reason |
|---------|-----------|--------|
| F01 | None | Foundation -- grade levels, departments, academic years |
| F02 | None | Auth and shell are infrastructure |
| F03 | F01, F02 | Versions need master data entities; shell hosts version picker |
| F04 | F01, F03 | Enrollment references grade levels, academic years; versioned |
| F05 | F01, F04 | Fee grid uses grade/nationality/tariff dimensions from master data; links to enrollment for revenue |
| F06 | F04, F05 | Revenue = enrollment x fee grid; needs both inputs |
| F07 | F04 | Capacity = f(enrollment, max class size) |
| F08 | F01, F04 | DHG driven by enrollment sections; references grade bands |
| F09 | F08 | Staff costs link to FTE positions from DHG |
| F10 | F06, F09 | P&L consolidates revenue + staff costs |
| F11 | F04, F06 | Scenarios adjust enrollment and revenue parameters |
| F12 | F04, F06, F07, F09, F10 | Dashboard aggregates KPIs from all modules |
| F13 | None (cross-cutting) | Audit trail hooks into all modules; implement last to cover all |

### Parallelization Opportunities

| Wave | Features | Can Parallel | Notes |
|------|----------|-------------|-------|
| 1 | F01, F02 | Yes | No shared data model dependencies |
| 2 | F03 | No | Single feature |
| 3 | F04 | No | Single feature |
| 4 | F05, F07 | Yes | F05 uses enrollment data; F07 uses enrollment data; no mutual dependency |
| 5 | F06, F08 | Yes | Revenue uses fee grid path; DHG uses enrollment path; independent |
| 6 | F09 | No | Single feature (depends on F08 FTE) |
| 7 | F10, F11 | Yes | P&L uses rev+costs; Scenarios adjust parameters; independent |
| 8 | F12, F13 | Yes | Dashboard reads data; Audit writes logs; independent |

---

## Appendix C: SpecKit Command Reference

### Command Summary (BudFin Context)

| Command | Purpose | When to Use | Key Output |
|---------|---------|-------------|------------|
| `/speckit.constitution` | Define project principles | Phase 2 (once) | `.specify/memory/constitution.md` |
| `/speckit.specify` | Create feature spec | Phase 6, Step 1 (per feature) | `specs/N-feature/spec.md` |
| `/speckit.clarify` | Resolve spec ambiguities | Phase 6, Step 2 (per feature) | Updated `spec.md` |
| `/speckit.checklist` | Requirements quality check | Phase 6, Steps 3 & 7 (per feature) | `checklists/*.md` |
| `/speckit.plan` | Create implementation plan | Phase 6, Step 4 (per feature) | `plan.md`, `research.md`, `data-model.md` |
| `/speckit.tasks` | Generate task breakdown | Phase 6, Step 5 (per feature) | `tasks.md` |
| `/speckit.analyze` | Cross-artifact consistency | Phase 6, Step 6 (per feature) | Analysis report (stdout) |
| `/speckit.implement` | Execute implementation | Phase 6, Step 8 (per feature) | Working code |
| `/speckit.taskstoissues` | Create GitHub issues | Phase 6, Step 9 (optional) | GitHub issues |

### Command Chain (Per Feature)

```
/speckit.specify "Feature description with FR-IDs"
    |
    v  (handoff: "Clarify Spec Requirements")
/speckit.clarify
    |
    v  (manual: validate requirements quality)
/speckit.checklist "requirements quality for [domain]"
    |
    v  (handoff: "Build Technical Plan")
/speckit.plan "I am building with [tech stack from Phase 3]"
    |
    v  (handoff: "Create Tasks")
/speckit.tasks
    |
    v  (handoff: "Analyze For Consistency")
/speckit.analyze
    |
    v  (manual: domain-specific quality check)
/speckit.checklist "[domain] implementation quality"
    |
    v  (handoff: "Implement Project")
/speckit.implement
    |
    v  (optional)
/speckit.taskstoissues
```

### Handoff Connections

Some SpecKit commands have built-in handoff prompts that suggest the next
command. These are:

- `speckit.specify` -> `speckit.plan` ("Build Technical Plan") or
  `speckit.clarify` ("Clarify Spec Requirements")
- `speckit.clarify` -> `speckit.plan` ("Build Technical Plan")
- `speckit.plan` -> `speckit.tasks` ("Create Tasks") or
  `speckit.checklist` ("Create Checklist")
- `speckit.tasks` -> `speckit.analyze` ("Analyze For Consistency") or
  `speckit.implement` ("Implement Project")

---

## Appendix D: Cross-Reference Matrix

### Phases vs. Risks

| Risk (PRD Section 15) | Mitigating Phases | How |
|------------------------|-------------------|-----|
| Calculation discrepancies vs. Excel | Phase 7, 8, 9 | Integration tests, cell-by-cell migration validation, parallel-run UAT |
| Academic calendar edge cases | Phase 6 (F04, F06), Phase 9 | Clarify AY1/AY2/summer transitions during specify; edge case UAT |
| User resistance to moving off Excel | Phase 3, 6 (F02), 10 | ADR on Excel-like UX; workspace shell with keyboard nav; training |
| Scope creep | Phase 1, 4 | PRD freeze in Phase 1; strict feature boundaries in Phase 4 |
| Data migration integrity | Phase 8, 9 | Automated reconciliation scripts; sign-off checkpoint |

### Phases vs. NFRs

| NFR Category | Addressed In Phase | Verification |
|--------------|-------------------|-------------|
| Performance (< 1s page load) | Phase 3 (ADR), Phase 6 | NFR tests in Phase 9 |
| Performance (< 3s recalculation) | Phase 3 (calc engine ADR), Phase 6 | Load testing in Phase 9 |
| Reliability (99.9% uptime) | Phase 5 (CI/CD), Phase 10 | Monitoring in operations runbook |
| Reliability (data integrity) | Phase 7 (integration tests), Phase 8 | Parallel-run in Phase 9 |
| Security (Auth, RBAC, Encryption) | Phase 3 (ADR-004), Phase 6 (F02) | Security audit in Phase 9 |
| Usability (keyboard nav, undo/redo) | Phase 3 (ADR-001), Phase 6 (F02) | Usability testing in Phase 9 |
| Data (audit retention, backup) | Phase 6 (F13), Phase 10 | Backup test in Phase 10 |
| Data (export formats) | Phase 6 (F12) | Export validation in Phase 9 |

### Phases vs. Dependencies

| Phase | Blocked By | Blocks |
|-------|-----------|--------|
| Phase 1 | Nothing | Everything |
| Phase 2 | Phase 1 | Phases 3-10 (constitution authority) |
| Phase 3 | Phase 2 | Phases 5-10 (tech decisions) |
| Phase 4 | Phase 1, 3 | Phase 6 (feature list) |
| Phase 5 | Phase 3, 4 | Phase 6 (infrastructure) |
| Phase 6 | Phase 5 | Phases 7-10 (features) |
| Phase 7 | Phase 6 (sufficient features) | Phase 9 |
| Phase 8 | Phase 6 (all features) | Phase 9 |
| Phase 9 | Phases 7, 8 | Phase 10 |
| Phase 10 | Phase 9 | Go-live |

---

*This document is the single source of truth for the BudFin planning
workflow. Update it as decisions are made and phases are completed.*
