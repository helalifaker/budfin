# Enrollment planning process vs codebase review

Date: 2026-03-10
Reviewer: GitHub Copilot
Source of truth reviewed: `docs/Process/Enrollment-Page-Process.md`

## Executive summary

The Enrollment module has a solid technical foundation: the route set exists, the core calculation engines are implemented, stale-module propagation is present, and there is test coverage around the backend routes and engines.

However, the current user journey does **not fully behave according to the documented process**. The most important gaps are in the frontend workflow and UX contract:

- the page does not fully enforce the documented Draft-only editing workflow in the UI,
- the cohort grid displays AY2 results using a formula that does not match the backend engine,
- nationality override behavior is incomplete and can create inconsistent override state,
- persisted calculation results are not reloaded on page revisit,
- import permissions do not match the process document,
- some API contracts and grade-code naming in the process doc do not match the current implementation.

## Overall assessment

| Area                           | Status                | Notes                                                                              |
| ------------------------------ | --------------------- | ---------------------------------------------------------------------------------- |
| Route availability             | Partial match         | Main routes exist, but some documented paths differ from actual registered paths   |
| Backend business rules         | Mostly implemented    | Version lock, imported-version guard, stale propagation, audit logging are present |
| Frontend workflow fidelity     | Needs work            | Several UX and behavior mismatches versus process                                  |
| Data model alignment           | Mostly aligned        | Main models exist in Prisma schema                                                 |
| Intuitiveness of planning flow | Not yet strong enough | Too many implicit steps and weak guardrails                                        |

## Critical findings

### 1. Cohort grid shows AY2 totals using logic that does not match the backend engine

**Why this matters**

This is the most important functional mismatch. Users can see one projected AY2 value in the grid, while the backend calculates another when they press `Calculate`.

**Frontend behavior**

- `apps/web/src/components/enrollment/cohort-progression-grid.tsx:84` reads AY1 from the **same grade**.
- `apps/web/src/components/enrollment/cohort-progression-grid.tsx:89` computes non-PS AY2 as `Math.round(ay1 * retRate + lateral)`.

**Backend behavior**

- `apps/api/src/services/cohort-engine.ts:56-57` documents progression from the **prior grade**.
- `apps/api/src/services/cohort-engine.ts:82` uses `priorGrade = GRADE_PROGRESSION[i - 1]`.
- `apps/api/src/services/cohort-engine.ts:90` uses `floor`, not `round`, for retained students.

**Impact**

- Users are shown misleading projections before calculation.
- The screen is not trustworthy as a planning tool.
- The process doc is internally inconsistent here and must be clarified.

**Recommendation**

Make the frontend grid use the exact same progression logic as the backend engine, or fetch a preview from the backend. There should be exactly one source of truth for cohort projection math.

---

### 2. Nationality override workflow is incomplete and can leave inconsistent state

**Why this matters**

The documented process says users can toggle override on/off and manually manage the full nationality distribution. The current implementation only partially supports that flow.

**Evidence**

- `apps/web/src/components/enrollment/nationality-distribution-grid.tsx:52` stores override state in `localOverrides` only.
- `apps/web/src/components/enrollment/nationality-distribution-grid.tsx:125-134` toggles override locally, with no persistence.
- `apps/web/src/components/enrollment/nationality-distribution-grid.tsx:113` sends only the edited nationality row.
- `apps/api/src/routes/enrollment/nationality-breakdown.ts:156` and `:171` only validate sums when exactly 3 nationality rows are submitted.
- `apps/api/src/routes/enrollment/nationality-breakdown.ts:221` and `:226` persist `isOverridden: true`.

**Impact**

- Turning override off is not persisted.
- Partial updates can mark a grade overridden without guaranteeing the three nationality weights sum to 100%.
- Counts can drift from the actual grade total unless the client submits all three rows together.
- The implemented UX is not intuitive and does not match the documented step-by-step process.

**Recommendation**

Redesign override editing so one grade edit submits the full trio:

- `Francais`
- `Nationaux`
- `Autres`

Also add an explicit persisted `override on/off` action, including a way to clear override and return to computed values.

---

### 3. Persisted capacity results are not loaded when reopening the page

**Why this matters**

The backend persists capacity and DHG results, but the enrollment page only shows capacity results from the current in-memory mutation response.

**Evidence**

- `apps/web/src/pages/planning/enrollment.tsx:57` reads KPI capacity data from `calculateMutation.data?.results`.
- `apps/web/src/pages/planning/enrollment.tsx:74` uses `calculateMutation.data?.results?.length`.
- `apps/web/src/pages/planning/enrollment.tsx:152` passes only `calculateMutation.data?.results` into the capacity grid.
- `apps/web/src/components/enrollment/capacity-grid.tsx:129` displays `Press Calculate to generate capacity results.` when mutation data is absent.
- Backend persists DHG/capacity rows in `apps/api/src/routes/enrollment/calculate.ts`.

**Impact**

- Refreshing the page makes the module appear uncalculated even when results exist in the database.
- Users lose confidence because the page state does not reflect persisted planning state.
- This makes the process harder to follow and less intuitive.

**Recommendation**

Add a read endpoint/hook for persisted enrollment calculation results and use it to populate:

- KPI ribbon,
- capacity grid,
- stale/healthy visual state,
- last-calculated metadata.

---

### 4. UI does not enforce Draft-only editing even though backend does

**Why this matters**

The documented process says all edits are blocked unless the version is `Draft`. The backend enforces this correctly, but the UI still exposes editable controls to non-viewers even when the version is locked.

**Evidence**

- `apps/web/src/pages/planning/enrollment.tsx:31` defines read-only state using only `user?.role === 'Viewer'`.
- `apps/web/src/pages/planning/enrollment.tsx:136` and `:144` pass `isReadOnly={isViewer}` only.
- Backend correctly rejects writes on non-draft versions: - `apps/api/src/routes/enrollment/headcount.ts:142` - `apps/api/src/routes/enrollment/detail.ts:105` - `apps/api/src/routes/enrollment/cohort-parameters.ts:127` - `apps/api/src/routes/enrollment/nationality-breakdown.ts:116` - `apps/api/src/routes/enrollment/calculate.ts:52`

**Impact**

- Users are invited to edit data that will then fail on save.
- The workflow feels broken even though the API is technically correct.

**Recommendation**

Compute page editability from both role and version status:

- Viewer => read-only
- non-Draft version => read-only
- Imported version => disable unsupported controls with explicit explanation

Also visually show a banner such as: `This version is Published and cannot be edited.`

## High-priority findings

### 5. Import permissions do not match the documented process

**Process doc says**

- `docs/Process/Enrollment-Page-Process.md:87` says `Editor` cannot import CSV.
- `docs/Process/Enrollment-Page-Process.md:146` says `Import CSV` is for `Admin, BudgetOwner`.
- `docs/Process/Enrollment-Page-Process.md:591` says the historical import endpoint is `Admin, BudgetOwner`.

**Current code says**

- `apps/web/src/pages/planning/enrollment.tsx:116` shows `Import CSV` for every non-viewer.
- `apps/api/src/routes/enrollment/historical.ts:131` allows `Admin`, `BudgetOwner`, and `Editor`.

**Impact**

This is a requirements mismatch. Either the code is too permissive, or the process document is outdated.

**Recommendation**

Pick one rule and align both doc and code. My recommendation: keep import restricted to `Admin` and `BudgetOwner`, because imported historical data changes reference planning context for everyone.

---

### 6. The process document does not match actual API paths for cohort and nationality endpoints

**Documented**

- `docs/Process/Enrollment-Page-Process.md:521` uses `/versions/{versionId}/cohort-parameters`
- `docs/Process/Enrollment-Page-Process.md:547` uses `/versions/{versionId}/nationality-breakdown`

**Actual**

- Routes are mounted under `apps/api/src/index.ts:61` with prefix `/api/v1/versions/:versionId/enrollment`
- Frontend calls: - `apps/web/src/hooks/use-cohort-parameters.ts:18` -> `/versions/${versionId}/enrollment/cohort-parameters` - `apps/web/src/hooks/use-nationality-breakdown.ts:30` -> `/versions/${versionId}/enrollment/nationality-breakdown`

**Impact**

The process doc is not a reliable interface reference for developers or auditors.

**Recommendation**

Update the process doc so the endpoint tables mirror the real mounted routes.

---

### 7. KPI ribbon can be misleading because it loads headcounts only for the currently selected academic period

**Evidence**

- `apps/web/src/pages/planning/enrollment.tsx:37` calls `useHeadcount(versionId, academicPeriod as AcademicPeriod | null)`.
- `apps/web/src/hooks/use-enrollment.ts:58` keys the query by `academicPeriod`.

**Impact**

If the workspace context is set to only `AY1` or only `AY2`, the KPI totals can show incomplete values while the page label implies a full Enrollment & Capacity summary.

**Recommendation**

For the KPI ribbon, fetch both periods explicitly or use a summary endpoint that is not coupled to the context-bar academic period.

---

### 8. Historical chart mapping is hardcoded and disconnected from shared grade constants

**Evidence**

- `apps/web/src/components/enrollment/historical-chart.tsx:39-54` hardcodes `GRADE_BAND_MAP`.
- Shared grade definitions already exist in `packages/types/src/enrollment.ts` and backend constants.

**Impact**

This is brittle. Any change to grade codes or display naming risks desynchronizing the chart.

**Recommendation**

Use shared grade/band metadata rather than a local chart-only map.

## Medium-priority findings

### 9. Grade-code naming in the process document does not match actual code constants

**Documented examples**

- `6eme`, `1ere`, `Terminale`

**Actual code values**

- `packages/types/src/enrollment.ts:22` -> `6EME`
- `packages/types/src/enrollment.ts:28` -> `TERM`

**Impact**

This can cause confusion in CSVs, fixtures, tests, and API usage.

**Recommendation**

Standardize one canonical grade-code list in the process doc and explicitly mention display labels vs stored codes.

---

### 10. Historical response typing is inconsistent in the frontend

**Evidence**

- `apps/web/src/hooks/use-enrollment.ts:35` types `cagrByBand` as `Record<string, string>`.
- `apps/web/src/hooks/use-enrollment.ts:36` types `movingAvgByBand` as `Record<string, number>`.
- Backend returns both as formatted decimal strings in `apps/api/src/routes/enrollment/historical.ts`.

**Impact**

Not the main workflow blocker, but it is a type contract inconsistency that can surface later in charts, formatting, or refactors.

**Recommendation**

Align frontend and backend contracts. Prefer strings if precision/formatting matters, or return numbers consistently from the API.

## Issues encountered during the review

1. **The process document is stronger as a business narrative than as a technical contract.**
   Some sections are accurate at a high level, but several route paths, grade codes, and formulas do not exactly match the implementation.

2. **The frontend currently mixes “live preview” behavior with “persisted result” behavior.**
   That creates a confusing experience where some values are previews, some are persisted, and some disappear after refresh.

3. **Several controls are technically available but not workflow-safe.**
   The nationality override path is the clearest example.

4. **Version-state enforcement is asymmetric.**
   Backend is strict; frontend is permissive.

## Areas for improvement

### Product/process improvements

1. Define one canonical enrollment workflow:
    - select version,
    - confirm version is Draft,
    - enter AY1 headcounts,
    - configure cohort rules,
    - review AY2 preview,
    - manage nationality logic,
    - calculate,
    - review capacity alerts,
    - clear downstream stale states.

2. Clarify the actual business rule for cohort progression:
    - same-grade retention, or
    - prior-grade progression.

    The backend currently implements prior-grade progression.

3. Clarify role rules for historical import and whether imported Actual versions are editable anywhere.

### UX improvements

1. Show a stepper or checklist across the page:
    - Step 1: Enter AY1 headcounts
    - Step 2: Set progression assumptions
    - Step 3: Validate nationality logic
    - Step 4: Calculate enrollment
    - Step 5: Review capacity and downstream impacts

2. Add status callouts:
    - `Draft / Published / Locked / Archived`
    - `Enrollment stale / calculated`
    - `Revenue stale`, `DHG stale`, `Staffing stale`, `PNL stale`

3. Make the page action-oriented:
    - `Save headcounts`
    - `Apply cohort assumptions`
    - `Recalculate enrollment`
    - `Review capacity exceptions`

4. Add explicit validation summaries before calculate:
    - missing AY1 grades,
    - invalid nationality totals,
    - missing lateral weights when lateral entries > 0,
    - no grade-level master data.

### Technical improvements

1. Centralize calculation formulas in shared utilities or API preview endpoints.
2. Add persisted read endpoints for enrollment results.
3. Redesign nationality override API to require full-grade submissions.
4. Introduce frontend version-state read-only gating.
5. Align shared types and docs for grade codes, API paths, and response payloads.

## Recommended “perfect” enrollment planning process

Below is the process I recommend as the target operating model for BudFin. It is designed to be intuitive, auditable, and difficult to misuse.

### Step 1 — Confirm planning context

The page should clearly show:

- selected budget version,
- version status,
- fiscal year,
- selected academic period,
- whether the version is editable.

If the version is not `Draft`, the page should switch to review mode automatically.

### Step 2 — Enter or review AY1 headcounts

Users should edit a single grid with:

- grade,
- AY1 headcount,
- validation state,
- optional notes.

Every save should:

- persist immediately,
- mark downstream modules stale,
- show a success indicator,
- keep the user in context.

### Step 3 — Configure progression assumptions

Users should set, per grade:

- retention rate,
- lateral entry count,
- lateral entry nationality weights.

The UI should show the formula being used and a preview of the computed AY2 impact.

### Step 4 — Review live AY2 preview before calculation

The preview should use the **same backend logic** as the final calculation.
No separate approximate frontend math.

### Step 5 — Manage nationality distribution safely

For each grade, users should either:

- accept computed nationality distribution, or
- enable manual override and edit all three nationality weights in one guided interaction.

The UI must enforce:

$$w_{FR} + w_{NAT} + w_{AUT} = 1.0$$

and:

$$c_{FR} + c_{NAT} + c_{AUT} = \text{grade total}$$

before saving.

### Step 6 — Run enrollment calculation

Calculation should:

- persist AY2 headcounts,
- persist nationality breakdown,
- persist capacity results,
- create audit log entry,
- clear `ENROLLMENT` stale flag,
- leave downstream modules marked stale.

### Step 7 — Review exceptions, not just raw data

The page should highlight:

- over-capacity grades,
- near-capacity grades,
- underutilized grades,
- grades with manual nationality overrides,
- grades missing supporting assumptions.

### Step 8 — Guide the user to the next module

After successful calculation, the page should say something like:

- `Enrollment calculated successfully.`
- `Revenue, DHG, Staffing, and P&L are now stale and should be recalculated in order.`
- Provide links/buttons to the next recommended step.

## Priority implementation backlog

### Must-fix first

1. Align cohort preview formula with backend engine
2. Fix nationality override workflow to save a full grade atomically
3. Load persisted capacity/calculation results on page revisit
4. Enforce Draft-only editing in the UI
5. Align import permissions between process doc and code

### Should-fix next

1. Correct API path documentation
2. Standardize grade-code naming in docs and UI references
3. Decouple KPI ribbon from single-period query state
4. Replace hardcoded historical chart mapping with shared metadata
5. Align historical response typing

## Conclusion

The enrollment module is **partially aligned** with the intended process, but it is not yet clean enough to be considered fully reliable as a planning workflow.

The main backend pieces are there. The main problem is that the **frontend workflow does not yet guide users safely through the process**, and a few core behaviors do not match the backend rules or the process documentation.

If you want, the next best move is for me to convert this review into a concrete fix plan and then start implementing the highest-priority corrections in this order:

1. cohort grid alignment,
2. nationality override redesign,
3. persisted result loading,
4. Draft-state UI gating,
5. process-doc cleanup.
