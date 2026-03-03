<!--
SYNC IMPACT REPORT
==================
Version Change:    [blank template] → 1.0.0
Bump Type:         MINOR (initial fill — all placeholders replaced with concrete values)
Modified Principles: N/A (first fill, no prior principles to modify)
Added Sections:
  - Core Principles (6 principles: Financial Accuracy, IFRS Compliance,
    Saudi Statutory Compliance, Full Auditability, Version Isolation,
    Workspace Continuity)
  - Technology Constraints (mandatory, derived from PRD TC-001 – TC-005)
  - Development Governance (scope freeze, feature workflow, quality gates,
    amendment procedure, versioning policy, runtime guidance)
Removed Sections: N/A

Templates Updated:
  - .specify/templates/plan-template.md  ✅ Constitution Check gates replaced with 6 concrete gates
  - .specify/templates/spec-template.md  ✅ Verified consistent — no update required
  - .specify/templates/tasks-template.md ✅ BudFin principle-driven task types noted in Phase 2

Deferred Items:
  - TODO(TECH_STACK): Phase 3 will select specific frameworks, database, and hosting.
    plan-template.md Technical Context section should be revisited once ADRs are complete.
  - TODO(RATIFICATION_DATE): Using 2026-03-03 as the ratification date (first fill session).
    Confirm with CAO if a formal adoption date differs.
-->

# BudFin Constitution

## Core Principles

### I. Financial Accuracy (NON-NEGOTIABLE)

All financial calculations MUST produce results that match the validated Excel baselines within
a tolerance of +/-1 SAR per line item per month. This applies to every calculation in the system:
tuition revenue (AY1 and AY2 allocations), salary components (base, housing, transport, premium,
HSA), GOSI contributions, Ajeer fees, End of Service provisions, and consolidated P&L totals.

Fixed-point decimal arithmetic MUST be used throughout the calculation stack. Native IEEE 754
binary floating-point is prohibited for any monetary value (TC-001). All intermediate values MUST
retain full precision (minimum 4 decimal places); rounding MUST follow round-half-up and MUST be
applied only at the presentation layer (TC-004). The YEARFRAC function MUST match Excel's US 30/360
output for all 168 employee joining dates within ≤ 0.001 years (TC-002). Any discrepancy exceeding
the ±1 SAR tolerance boundary is a P1 defect and blocks release.

**Rationale**: EFIR processes over 40 million SAR annually. Floating-point rounding errors
accumulate across 168 employees × 12 months × multiple components and can produce material
misstatements. Exact Excel parity is the go-live acceptance criterion (PRD Section 16.1, items 1–3).

### II. IFRS Compliance

Revenue MUST be recognized per IFRS 15 (performance obligations satisfied over time across each
academic period — AY1, Summer, AY2). Expense classification in all P&L and reporting outputs MUST
conform to IAS 1. Expected Credit Loss provisioning MUST apply IFRS 9 principles wherever
receivable balances appear. No output labeled "Income Statement" or "P&L" may be presented without
confirming the IFRS classification of every line item.

Manual adjustments to produce IFRS-compliant outputs from BudFin data are prohibited — the system
MUST generate IFRS-ready reports natively. Zero manual post-export adjustments is the success
target (PRD Section 3.2).

**Rationale**: EFIR operates under IFRS reporting obligations for board submissions and external
audit. Non-compliant outputs create audit risk and require costly manual rework after every report.

### III. Saudi Statutory Compliance

All Saudi statutory cost rules MUST be implemented exactly as legislated and as modeled in the
validated Excel workbooks:

- **GOSI**: Employee and employer contribution rates applied per Saudi Social Insurance Law.
- **Ajeer**: Program fees applied to all qualifying contract (Ajeer-designated) employees.
- **End of Service (EoS)**: Saudi labor law formula, calculated via YEARFRAC (TC-002), excluding
  HSA from the base. Tiers: YoS ≤ 5 years: `(base/2) × YoS`; YoS > 5 years:
  `(base/2 × 5) + base × (YoS − 5)`.
- **ZATCA Zakat**: Applied per applicable rules for Saudi-registered entities.

Retroactive changes to joining dates, salary components, or statutory rates MUST trigger
full recalculation of all affected provisions and MUST be recorded in the audit trail (Principle IV).

**Rationale**: Incorrect statutory calculations expose EFIR to regulatory penalties and financial
restatements. These are non-negotiable legal constraints, not configurable business rules.

### IV. Full Auditability

Every create, update, delete, lock, publish, or approve operation on any financial data object MUST
generate an immutable audit log entry containing: timestamp (AST, UTC+3), authenticated user
identity, operation type, entity type, entity ID, prior value, and new value. No data modification
path — including retroactive corrections, bulk imports, or system-triggered recalculations — may
bypass the audit log.

The audit trail MUST be append-only; no record may be modified or deleted after creation. Version
lifecycle transitions (Draft → Published → Locked → Archived) MUST each generate a discrete audit
event recording the approving user's identity and timestamp.

**Rationale**: EFIR handles over 40 million SAR and is subject to external IFRS audit. The External
Auditor persona requires 100% attributable data changes (PRD Section 3.2). The audit trail is a
hard go-live acceptance criterion, not an enhancement.

### V. Version Isolation

Each budget version (Actual, Budget, or Forecast) MUST maintain a complete, self-contained snapshot
of all its input data — enrollment projections, fee grids, salary components, statutory rates, and
master data assumptions. No version may read input data from or write input data to another
version's data store under any circumstances.

Changes in a Draft version MUST NOT alter or be visible in a Locked or Published version. The
version comparison engine MUST derive all variance figures from immutable, per-version snapshots —
live cross-version data sharing or reference is prohibited.

**Rationale**: The inability to lock an approved budget while iterating on a forecast is explicitly
identified as a core pain point (PRD Section 2.1). Cross-version contamination would corrupt the
audit trail and make the version comparison feature unreliable.

### VI. Workspace Continuity

The persistent context bar (active fiscal year, active version, active scenario, active user) MUST
survive all in-app navigation events without any state loss. User working context MUST be restored
correctly after a page refresh. No planning module may override or reset context bar state without
an explicit, intentional user action.

Calculate operations MUST provide visual feedback within 200 ms and MUST complete within 3 seconds
(PRD FR-REV-011, FR-REV-012). The application MUST meet WCAG AA accessibility standards for all
interactive elements. The application MUST function correctly in the latest two major versions of
Chrome, Edge, Firefox, and Safari (SA-007).

**Rationale**: Context bar persistence is the primary UX guarantee that distinguishes BudFin from
the fragmented spreadsheet workflow it replaces (PRD Section 6.1). Losing state mid-session
destroys user trust and data integrity without any visible error.

## Technology Constraints (Mandatory)

These constraints are hard requirements derived from PRD Section 9.1. They apply regardless of
which specific frameworks or databases are selected in Phase 3 (Tech Stack & Architecture).

- **TC-001**: All monetary values MUST use fixed-point decimal arithmetic.
  IEEE 754 floating-point is prohibited. (JS/TS: `decimal.js` or equivalent;
  Python: `decimal.Decimal`; Java/Kotlin: `BigDecimal` with `HALF_UP`.)
- **TC-002**: YEARFRAC MUST implement the Excel US 30/360 algorithm exactly.
  Validation: all 168 employee joining dates must match Excel output within ≤ 0.001 years.
- **TC-003**: Database monetary columns MUST use `DECIMAL(15,4)` or equivalent.
  Percentage rate columns MUST use `DECIMAL(7,6)`.
- **TC-004**: Rounding is round-half-up, applied at the presentation layer only.
  Aggregates MUST be summed at full precision before rounding — never summed from pre-rounded values.
- **TC-005**: All date arithmetic uses the Gregorian calendar, AST (UTC+3) timezone.
  Academic periods (AY1 = Jan–Jun, Summer = Jul–Aug, AY2 = Sep–Dec) are hardcoded for v1.

The complete data dictionary for the five core entities is in PRD Section 9.2. The full database
schema is delivered in the Phase 3 Technical Design Document.

## Development Governance

### Scope Freeze

PRD v2.0 is the frozen requirements baseline (PRD Section 4.5). All post-freeze changes to
functional requirements, NFRs, scope assumptions (SA-*), or technology constraints (TC-*) MUST
follow the five-step Change Control Process (PRD Section 4.4). MUST-priority requirements require
CAO approval. SHOULD and COULD requirements require Project Manager approval.

### Feature Development Workflow

All features MUST follow the SpecKit command sequence in order:

1. `/speckit.specify` — Feature specification with user stories and acceptance criteria
2. `/speckit.clarify` — Resolve underspecified areas before planning begins
3. `/speckit.plan` — Implementation plan including Constitution Check gate
4. `/speckit.tasks` — Task list organized by user story for incremental delivery
5. `/speckit.analyze` — Cross-artifact consistency validation before implementation starts

Every feature plan MUST include a Constitution Check section that explicitly verifies compliance
with all six core principles. Any plan that cannot demonstrate compliance with a principle MUST NOT
proceed to implementation until the conflict is resolved.

### Quality Gates

Every feature MUST pass all of the following gates before merging to main:

- [ ] **Financial Accuracy**: Calculation output validated against Excel baselines within ±1 SAR
- [ ] **IFRS Compliance**: All P&L and revenue outputs correctly classified per IFRS 15 and IAS 1
- [ ] **Statutory Compliance**: GOSI, Ajeer, and EoS calculations validated against test dataset
- [ ] **Audit Trail**: All data-modifying operations produce immutable, correctly attributed log entries
- [ ] **Version Isolation**: No cross-version data contamination demonstrable by automated test
- [ ] **Workspace Continuity**: Context bar state verified after module navigation and page refresh
- [ ] **Coverage**: Test coverage ≥ 80% for all new code (unit + integration combined)
- [ ] **Lint**: Zero linter errors or warnings (no disable comments without explicit justification)

### Amendment Procedure

This constitution is amended as follows:

1. Identify the principle or section requiring change and its justification.
2. Classify the version bump type:
   - **MAJOR** — A core principle is removed or fundamentally redefined.
   - **MINOR** — A new principle is added or an existing section is materially expanded.
   - **PATCH** — Wording clarification, typo fix, or non-semantic refinement.
3. Update the constitution content and set `LAST_AMENDED_DATE` to today's date.
4. Run `/speckit.constitution` to propagate changes to all dependent templates.
5. CAO sign-off required for MAJOR amendments; Tech Lead sign-off for MINOR and PATCH amendments.
6. Record the amendment in the Sync Impact Report (HTML comment at the top of this file).

### Versioning Policy

The constitution version follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Removing or fundamentally redefining a core principle
- **MINOR**: Adding a new principle or materially expanding guidance in an existing section
- **PATCH**: Clarifications, wording improvements, or non-semantic refinements

Version numbers are never reused or decremented.

### Runtime Guidance

For the master workflow (phase sequence, wave ordering, SpecKit command reference) see:
`docs/planning/PLANNING_PROCESS.md`

For edge case analysis and calculation boundary conditions see:
`docs/edge-cases/budfin_edge_case_analysis.md`

## Governance

This constitution supersedes all other project practices, informal agreements, and prior conventions.
In any conflict between this constitution and a feature specification, implementation plan, or task
list, the constitution prevails. Dependent artifacts MUST be updated to conform — not the reverse.

All pull requests and code reviews MUST verify compliance with the six core principles. Non-compliant
code MUST be rejected regardless of functional correctness in isolation. Complexity that cannot be
justified against a specific constitutional principle MUST be eliminated or simplified.

This constitution is not aspirational — it is the binding ruleset for every BudFin implementation
decision from this point forward.

**Version**: 1.0.0 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-03-03
