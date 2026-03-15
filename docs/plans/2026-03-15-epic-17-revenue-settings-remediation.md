# Revenue Settings Remediation — Hardened Delivery Plan

> **Status: IMPLEMENTED** (2026-03-16)
> Implementation complete on branch `codex/epic-17-revenue-remediation`.
> See augmented plan: `.claude/plans/humble-toasting-book.md`
> Validation report: `docs/plans/2026-03-15-epic-17-validation-report.md`

## Objective

Modernize Revenue Settings into a simpler, state-of-the-art planning workflow that matches
EFIR's real operating model while preserving calculation correctness, backward compatibility,
and auditability.

This remediation must achieve four outcomes simultaneously:

- simplify the user experience to the approved 3-tab model
- align fee editing with band-level school pricing rather than per-grade tariff grids
- support prior-year comparison from actuals data
- avoid regressions in revenue readiness, calculation, derived revenue, and existing versions

## Target outcome

After remediation, Revenue Settings should behave as follows:

- users edit tuition at band level only
- users configure one flat discount percentage instead of tariff matrices
- users manage only custom fixed-amount other revenue lines
- prior-year comparison is shown inline when actuals exist
- system-calculated engine internals are not exposed as editable business inputs
- all calculations remain accurate, reproducible, and version-safe

## Scope boundaries

### In scope

- 3-tab Revenue Settings experience:
    - `Fee Grid`
    - `Discounts`
    - `Other Revenue`
- band-level fee editing for current-year tuition
- inline prior-year comparison using actuals
- flat discount model
- simplified other-revenue editing surface
- workbook-driven fee correction
- readiness model updates
- compatibility handling for existing versions and data

### Out of scope unless explicitly added later

- full redesign of enrollment tariff storage
- removal of tariff from all historical reporting and analysis
- removal of all backend-derived other-revenue machinery in the same change
- master-data tariff removal across the system
- replacing all version revenue settings persistence with a new model

## Current problems to remediate

The current Revenue Settings experience has structural issues that do not reflect the school's
real operating model:

- Fee Grid stores fees per-grade, tariff, and nationality when the school charges at band level.
- Tariff Assignment forces manual distribution across `RP` / `R3+` / `Plein`, which the business
  no longer wants to manage as a planning input.
- Other Revenue exposes locked engine internals instead of only business-editable lines.
- Per-student fee rates are split across multiple places, which makes the setup feel fragmented.
- Term amounts are displayed like editable source fields even though they are deterministic.
- Prior-year comparison is missing.
- Current fee data must be reconciled with the official workbook.

## Key architecture decisions

These decisions must be finalized before implementation starts because they unblock most of the
design and test scope.

### 1. Fee-grid persistence ownership

The remediation must choose exactly one owner for band-to-grade fan-out.

**Recommended decision:**

- preserve the current per-grade API contract
- keep band-to-grade fan-out in `apps/web/src/lib/fee-schedule-writeback.ts`

**Why this is recommended:**

- this is already the existing responsibility boundary
- it minimizes backend contract churn
- it reduces migration risk

If the project prefers server-owned fan-out instead, the plan must explicitly:

- remove client fan-out
- redefine the `PUT /fee-grid` contract
- update validation and tests accordingly

The implementation must not assign fan-out to both frontend and backend.

### 2. Per-student revenue settings remain a runtime dependency

The 7 per-student revenue rates are still required by the current backend calculation flow through
`VersionRevenueSettings`.

**Affected runtime paths:**

- `apps/api/src/routes/revenue/settings.ts`
- `apps/api/src/routes/revenue/calculate.ts`

**Decision:**

- keep `VersionRevenueSettings`
- move their editing surface into the `Fee Grid` tab
- do not remove this persistence dependency in this remediation

This means “Derived Revenue Rates” disappears as a user-facing section, but not as a backend
requirement.

### 3. Canonical dynamic other-revenue rows are hidden first, not deleted outright

Current backend behavior still relies on canonical dynamic rows for validation and calculation.

**Affected paths:**

- `apps/api/src/routes/revenue/other-revenue.ts`
- `apps/api/src/routes/revenue/readiness.ts`
- `apps/api/src/routes/revenue/calculate.ts`
- `apps/api/src/services/revenue-config.ts`

**Recommended decision:**

- remove these rows from the user-facing `Other Revenue` tab
- keep them server-controlled unless a broader engine redesign is approved

This distinguishes UX simplification from persistence and calculation redesign.

### 4. Tariff remains a reporting dimension unless explicitly deprecated

Removing `Tariff Assignment` from setup does not automatically remove tariff-based reporting
elsewhere.

**Affected paths:**

- `apps/web/src/pages/planning/revenue.tsx`
- `apps/web/src/lib/revenue-workspace.ts`

**Decision:**

- retain tariff as a reporting dimension for compatibility and historical analysis
- remove only the user-facing setup step for tariff assignment

## Approved product design

### Revenue Settings dialog

Final tab structure:

- `Fee Grid`
- `Discounts`
- `Other Revenue`

The dialog must:

- preserve viewer/read-only behavior
- preserve dirty-state handling
- preserve readiness and auto-routing behavior, updated to the new model
- remain accessible and keyboard-friendly

## Tab-by-tab design

### Fee Grid

#### User experience

The `Fee Grid` tab becomes the primary revenue configuration surface.

It contains two blocks:

- Tuition block
- Per-student fee block

#### Tuition block

Display 5 bands × 3 nationalities.

**Columns:**

- Band
- DAI
- Tuition TTC
- Prior Year
- Increase (%)
- Total TTC

**Behavior:**

- DAI editable
- Tuition TTC editable
- Prior Year read-only
- Increase (%) derived
- Total TTC derived
- no tariff dimension
- no term entry columns
- no expand/collapse for grades
- no mixed-value warnings exposed to users

#### Per-student fee block

Show all 7 editable rates sourced from `VersionRevenueSettings`:

- DPI
- Dossier
- BAC
- DNB
- EAF
- Evaluation Primaire
- Evaluation Secondaire

These remain persisted outside fee-grid rows, but are surfaced inside this tab.

#### Behind the scenes

Recommended persistence model:

- UI edits operate at band level
- writeback fans out to per-grade `FeeGridEntry` rows
- tariff stored as `Plein`
- terms derived automatically
- HT derived from TTC using VAT rules

#### Required derivations

- `totalTtc = dai + tuitionTtc`
- `term1 = tuitionTtc * 0.40`
- `term2 = tuitionTtc * 0.30`
- `term3 = tuitionTtc * 0.30`
- `tuitionHt = tuitionTtc / (1 + vatRate)`

**VAT rules:**

- `Francais` → 15%
- `Autres` → 15%
- `Nationaux` → 0%

### Discounts

#### User experience

Replace tariff discount grids with one flat discount percentage input.

**Display:**

- one primary percentage input
- an “Effect” card
- preview KPIs:
    - Gross Tuition
    - Discount Amount
    - Net Tuition

#### Behind the scenes

The plan must explicitly define how flat discount is stored.

**Recommended requirement:**

- introduce one canonical flat-discount representation
- avoid leaving compatibility ambiguous

The implementation must choose one of:

- explicit new flat-discount shape
- compatibility mapping to an existing stored slot

This must be specified before implementation begins.

#### Calculation rule

Change from tariff-based discount application to flat discount application over total gross tuition.

This must be reflected in:

- engine logic
- route validation
- shared types
- readiness logic
- migration compatibility for existing discount rows

### Other Revenue

#### User experience

The `Other Revenue` tab becomes a clean editor for user-managed custom lines only.

**Columns:**

- Line Item
- Annual Amount
- Distribution
- Category
- Delete

**Behavior:**

- supports add/remove custom lines
- no derived revenue rates section
- no system-internal canonical rows shown to the user
- clear message that system-calculated lines are handled automatically

#### Behind the scenes

Recommended compatibility behavior:

- dynamic canonical rows remain server-controlled
- static custom rows remain user-editable
- readiness and calculation continue to function while the UI stays clean

This separation must be explicit in the implementation.

## Prior-year comparison

### Source of truth

Prior-year comparison should come from the actuals version linked through
`FiscalPeriod.actualVersionId`.

This is already aligned with the data model and is preferable to inventing a new comparison
mechanism.

### Behavior

If actuals version exists:

- show prior-year values per band and nationality
- show increase percentage

If actuals version does not exist:

- show `—`
- do not block editing
- do not crash readiness or calculations

### Formula

`increasePct = ((current - prior) / prior) * 100`

**Edge cases that must be handled explicitly:**

- prior year missing
- prior year equals zero
- current equals prior
- malformed data must fail safely, not break rendering

## Data import and migration

### Current-year data correction

The implementation must define a reproducible import or update path for 2026–2027 fee data from
the official workbook.

This must not remain a vague manual seed step.

The implementation should explicitly state whether the team will:

- reuse and update `apps/api/src/validation/parse-revenue-excel.ts`
- build a dedicated migration or import script
- or create a one-time validated loader

**Recommended:**

- use a deterministic import path with validation output
- keep workbook-to-database mapping auditable

### Prior-year actuals setup

The implementation must explicitly define:

- whether the prior-year actuals version already exists
- who creates it if missing
- how it gets linked to `FiscalPeriod.actualVersionId`
- how fee data is loaded into it

### Legacy compatibility

The implementation must cover existing stored data:

- existing `RP` / `R3+` discount rows
- existing tariff-based enrollment detail records
- cloned versions created before remediation
- versions already partially configured

Compatibility strategy must be documented before delivery.

## Readiness and workflow updates

The current readiness model spans more than the dialog component, so the remediation must update
all direct consumers.

### New readiness intent

Recommended readiness areas after remediation:

- `feeGrid`
- `discounts`
- `otherRevenue`

With one important nuance:

- the per-student `VersionRevenueSettings` requirement still exists and should be represented as
  part of `feeGrid` readiness, not silently removed

### Affected frontend consumers

The implementation must explicitly include:

- `apps/web/src/components/revenue/revenue-settings-dialog.tsx`
- `apps/web/src/lib/revenue-readiness.ts`
- `apps/web/src/components/revenue/setup-checklist.tsx`
- `apps/web/src/lib/revenue-workspace.ts`
- `apps/web/src/components/revenue/revenue-inspector.tsx`
- `apps/web/src/pages/planning/revenue.tsx`
- `apps/web/src/stores/revenue-settings-dialog-store.ts`

### Affected shared contract

The implementation must explicitly include:

- `packages/types/src/revenue.ts`

### Affected backend readiness contract

The implementation must explicitly include:

- `apps/api/src/routes/revenue/readiness.ts`

## Implementation workstreams

### Phase 1 — Contract and decision alignment

Finalize:

- fan-out ownership
- flat discount storage contract
- dynamic other-revenue compatibility model
- tariff reporting behavior
- actuals sourcing path

No implementation should start before these are fixed.

### Phase 2 — Fee Grid modernization

Update:

- `apps/web/src/lib/fee-schedule-builder.ts`
- `apps/web/src/lib/fee-schedule-writeback.ts`
- `apps/web/src/components/revenue/fee-grid-tab.tsx`
- related tests

Deliver:

- band-level tuition editing
- prior-year columns
- integrated per-student settings block
- derived term behavior
- no tariff user editing

### Phase 3 — Discounts simplification

Update:

- `apps/web/src/components/revenue/discounts-tab.tsx`
- `apps/api/src/routes/revenue/discounts.ts`
- `apps/api/src/services/revenue-engine.ts`
- `packages/types/src/revenue.ts`
- related tests

Deliver:

- one flat discount input
- flat discount persistence
- flat discount calculation
- compatibility strategy for existing discount rows

### Phase 4 — Other Revenue simplification

Update:

- `apps/web/src/components/revenue/other-revenue-tab.tsx`
- `apps/api/src/routes/revenue/other-revenue.ts` only if contract changes are needed
- readiness and calculation flows only if the backend treatment changes
- related tests

Deliver:

- custom fixed-amount lines only in UI
- no engine internals exposed
- server-controlled rows preserved unless explicitly redesigned

### Phase 5 — Prior-year actuals and workbook data alignment

Update:

- import and migration path
- prior-year actuals linkage
- validation logic

Deliver:

- accurate current-year values
- accurate prior-year comparison
- reproducible workbook alignment

### Phase 6 — Readiness, routing, and shell cleanup

Update:

- dialog tabs
- checklist
- inspector settings targets
- auto-route behavior
- any references to `tariffAssignment` and `derivedRevenueSettings`

Deliver:

- no dead tab references
- no broken readiness counts
- no stale routing assumptions

### Phase 7 — Regression hardening and rollout

Deliver:

- full automated verification
- manual verification checklist
- rollout and fallback instructions for partially migrated data

## Full impacted files

### Frontend

- `apps/web/src/components/revenue/revenue-settings-dialog.tsx`
- `apps/web/src/components/revenue/fee-grid-tab.tsx`
- `apps/web/src/components/revenue/discounts-tab.tsx`
- `apps/web/src/components/revenue/other-revenue-tab.tsx`
- `apps/web/src/components/revenue/revenue-inspector.tsx`
- `apps/web/src/components/revenue/setup-checklist.tsx`
- `apps/web/src/pages/planning/revenue.tsx`
- `apps/web/src/lib/fee-schedule-builder.ts`
- `apps/web/src/lib/fee-schedule-writeback.ts`
- `apps/web/src/lib/revenue-readiness.ts`
- `apps/web/src/lib/revenue-workspace.ts`
- `apps/web/src/hooks/use-revenue.ts`
- `apps/web/src/stores/revenue-settings-dialog-store.ts`

### Shared types

- `packages/types/src/revenue.ts`

### Backend

- `apps/api/src/routes/revenue/fee-grid.ts`
- `apps/api/src/routes/revenue/discounts.ts`
- `apps/api/src/routes/revenue/other-revenue.ts`
- `apps/api/src/routes/revenue/readiness.ts`
- `apps/api/src/routes/revenue/settings.ts`
- `apps/api/src/routes/revenue/calculate.ts`
- `apps/api/src/services/revenue-engine.ts`
- `apps/api/src/validation/parse-revenue-excel.ts`

### Tests that must be updated or added

- `apps/web/src/components/revenue/revenue-settings-dialog.test.tsx`
- `apps/web/src/components/revenue/setup-checklist.test.tsx`
- `apps/web/src/components/revenue/revenue-inspector.test.tsx`
- `apps/web/src/components/revenue/revenue-status-strip.test.tsx`
- `apps/web/src/pages/planning/revenue.test.tsx`
- `apps/web/src/lib/fee-schedule-builder.test.ts`
- `apps/api/src/routes/revenue/fee-grid.test.ts`
- `apps/api/src/routes/revenue/discounts.test.ts`
- `apps/api/src/routes/revenue/other-revenue.test.ts`
- `apps/api/src/routes/revenue/readiness.test.ts`
- `apps/api/src/routes/revenue/settings.test.ts`
- `apps/api/src/routes/revenue/calculate.test.ts`
- `apps/api/src/services/revenue-engine.test.ts`

## Regression risks and mitigations

### Risk: fee-grid writeback corrupts per-grade rows

**Mitigation:**

- test fan-out by band
- verify all underlying grades update correctly
- verify no duplicate or missing rows
- verify terms and HT are derived consistently

### Risk: flat discount breaks calculation totals

**Mitigation:**

- add engine-level tests for flat discount application
- add route-level tests
- compare totals before and after for controlled scenarios

### Risk: removing UI sections accidentally removes backend-required data

**Mitigation:**

- preserve `VersionRevenueSettings`
- preserve canonical dynamic rows unless backend redesign is explicit
- update readiness model carefully

### Risk: prior-year comparison fails when actuals are absent

**Mitigation:**

- specify null behavior in the implementation
- add UI and hook tests for fallback display

### Risk: dead references to removed tabs remain

**Mitigation:**

- update all consumers of `RevenueSettingsTab`
- search and test all `tariffAssignment` / `derivedRevenueSettings` references
- update checklist, inspector, workspace, page, and tests together

### Risk: legacy versions behave inconsistently

**Mitigation:**

- define compatibility handling for old discount rows and tariff-based data
- test cloned versions and partially configured versions

## Verification

### Automated verification

The implementation must require:

- type-check across all workspaces
- lint across all workspaces
- targeted frontend tests for dialog, checklist, inspector, page, and fee-grid logic
- targeted backend tests for fee-grid, discounts, settings, other-revenue, readiness, calculate,
  and engine logic
- workbook exact-match validation for current-year and prior-year values
- compatibility tests for legacy discount and tariff data where retained

### Manual verification

The implementation must require browser verification for:

- 3-tab dialog only
- band-level fee editing
- prior-year values visible when actuals exist
- `—` fallback when actuals do not exist
- correct increase percentage display
- zero discount accepted
- other-revenue tab shows only custom lines
- viewer and read-only behavior
- locked version behavior
- imported version behavior
- calculation still succeeds after edits

## Rollout and fallback

The implementation must explicitly define:

- how legacy versions continue to work
- how old `RP` / `R3+` discount data is handled
- whether rollout is one-step or staged
- what happens if prior-year actuals are not ready yet
- what fallback exists if data import is only partially completed

**Recommended rollout posture:**

- keep calculations operational during migration
- prefer compatibility shims over destructive cleanup in the first delivery
- remove old paths only after data and tests prove stability

## Additional omitted issues to add explicitly

Yes — there are important issues omitted from the original remediation document.

### Omitted issue 1

`VersionRevenueSettings` is still required by calculation and readiness, even if its UI moves into
`Fee Grid`.

### Omitted issue 2

Canonical dynamic other-revenue rows are still required by current backend validation and
calculation paths and cannot be removed casually.

### Omitted issue 3

The original plan duplicated fee-grid fan-out ownership across frontend and backend.

### Omitted issue 4

Several readiness and routing consumers still reference removed concepts:

- `setup-checklist`
- `revenue-workspace`
- `revenue-inspector`
- page-level tab opening logic
- multiple tests

### Omitted issue 5

Tariff reporting still exists outside the settings dialog and needs an explicit decision.

### Omitted issue 6

Legacy data compatibility is underspecified:

- old discount rows
- existing tariff-based enrollment details
- cloned versions
- partially configured versions

### Omitted issue 7

The prior-year actuals creation and linking path is not fully specified.

### Omitted issue 8

The workbook import path is not concretely defined or reconciled with the existing parser and
import flow.

### Omitted issue 9

There is no explicit rollout or fallback strategy.

### Omitted issue 10

Edge-case validation was incomplete:

- prior year missing
- prior year zero
- zero discount
- divide-by-zero in percentage calculation
- partial migration states

## Source-of-truth workbook appendix

**File:** `data/Schooling fees/EFIR - Droits de scolarite - Annee scolaire 2026-2027.xlsx`

**Sheet:** `Droits de scolarite 2026-20 v2`

### Current year fee data (2026-2027, all values TTC)

#### Francais (VAT 15%)

| Band        | DAI   | Tuition TTC | Total TTC |
| ----------- | ----- | ----------- | --------- |
| PS          | 5,000 | 30,000      | 35,000    |
| MS+GS       | 5,000 | 35,500      | 40,500    |
| Elementaire | 5,000 | 36,000      | 41,000    |
| College     | 5,000 | 36,500      | 41,500    |
| Lycee       | 5,000 | 40,800      | 45,800    |

#### Nationaux KSA (VAT 0% — TTC = HT)

| Band        | DAI   | Tuition TTC | Total TTC |
| ----------- | ----- | ----------- | --------- |
| PS          | 4,350 | 34,783      | 39,133    |
| MS+GS       | 4,350 | 36,650      | 41,000    |
| Elementaire | 4,350 | 36,650      | 41,000    |
| College     | 4,350 | 36,650      | 41,000    |
| Lycee       | 4,350 | 41,000      | 45,350    |

#### Autres Nationalites (VAT 15%)

| Band        | DAI   | Tuition TTC | Total TTC |
| ----------- | ----- | ----------- | --------- |
| PS          | 5,000 | 40,000      | 45,000    |
| MS+GS       | 5,000 | 42,000      | 47,000    |
| Elementaire | 5,000 | 42,000      | 47,000    |
| College     | 5,000 | 42,500      | 47,500    |
| Lycee       | 5,000 | 47,500      | 52,500    |

### Prior year fee data (2025-2026, for actuals)

#### Francais

| Band        | DAI   | Tuition TTC | Total TTC |
| ----------- | ----- | ----------- | --------- |
| PS          | 5,000 | 30,000      | 35,000    |
| MS+GS       | 5,000 | 34,500      | 39,500    |
| Elementaire | 5,000 | 34,500      | 39,500    |
| College     | 5,000 | 34,500      | 39,500    |
| Lycee       | 5,000 | 38,500      | 43,500    |

#### Nationaux KSA

| Band        | DAI   | Tuition TTC | Total TTC |
| ----------- | ----- | ----------- | --------- |
| PS          | 4,350 | 34,783      | 39,133    |
| MS+GS       | 4,350 | 35,650      | 40,000    |
| Elementaire | 4,350 | 35,650      | 40,000    |
| College     | 4,350 | 35,650      | 40,000    |
| Lycee       | 4,350 | 40,000      | 44,350    |

#### Autres Nationalites

| Band        | DAI   | Tuition TTC | Total TTC |
| ----------- | ----- | ----------- | --------- |
| PS          | 5,000 | 40,000      | 45,000    |
| MS+GS       | 5,000 | 41,000      | 46,000    |
| Elementaire | 5,000 | 41,000      | 46,000    |
| College     | 5,000 | 41,000      | 46,000    |
| Lycee       | 5,000 | 46,000      | 51,000    |

### Term split

Term amounts are not user inputs.

They are always derived as:

- Term 1 = 40% of annual tuition TTC
- Term 2 = 30% of annual tuition TTC
- Term 3 = 30% of annual tuition TTC
