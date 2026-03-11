# Enrollment Wizard Ruleset And Frontend Audit

Date: 2026-03-11
Reviewer: Codex
Scope: enrollment setup wizard, cohort projection rules, wizard/grid parity, frontend guardrails, and related API contracts

## Executive summary

There is **one projection formula** for AY2 cohort math across the wizard preview, the cohort grid, and the backend calculation engine:

- `PS AY2 = direct PS AY2 headcount`
- `non-PS retained = floor(prior grade AY1 × retention rate)`
- `non-PS AY2 = retained + lateral entries`

The part that feels like a "different calculation" is the **recommendation engine** used to seed or suggest retention/lateral values in the wizard. That is a separate historical-default algorithm, not the final AY2 projection formula.

The frontend audit found two categories of issues:

- **Ruleset clarity issues**: the product currently mixes exact retention recommendations in the backend with whole-percent displays in the UI, which can make `99.1%` look like `99%`.
- **Workflow/guardrail issues**: the wizard had several frontend gaps around loading, import rollback, integer validation, and setup-completion detection. Those were corrected in this pass.

## Source of truth map

### Wizard state seeding

The wizard assembles its working state from four sources:

1. `setup baseline`
    - Prior-year Actual AY2 baseline rows come from the setup-baseline endpoint and are loaded in the wizard through `useEnrollmentSetupBaseline`.
    - Frontend seed logic: `apps/web/src/components/enrollment/setup-wizard.tsx:415-477`

2. `persisted headcount`
    - Existing saved AY1 rows and saved `PS AY2` are loaded through `useHeadcount(versionId)`.
    - The wizard prefers persisted AY1 rows over the imported baseline when they exist.
    - Frontend seed logic: `apps/web/src/components/enrollment/setup-wizard.tsx:450-470`

3. `cohort parameters`
    - Saved retention/lateral values plus recommendation metadata come from `GET /cohort-parameters`.
    - Backend merge/default logic: `apps/api/src/routes/enrollment/cohort-parameters.ts:79-136`
    - Frontend seed logic: `apps/web/src/components/enrollment/setup-wizard.tsx:457-467`

4. `AY1 nationality composition`
    - Used only for the read-only nationality preview on the last step.
    - Frontend preview logic: `apps/web/src/components/enrollment/setup-wizard.tsx:547-555`

## The current ruleset

### 1. What the wizard prefilled values actually are

The editable retention/lateral fields in the wizard do **not always mean "historical recommendation."**

The current behavior is:

- If the version already has persisted cohort parameters, the wizard preloads the **saved** `retentionRate` and `lateralEntryCount`.
- The historical recommendation still comes back separately as:
    - `recommendedRetentionRate`
    - `recommendedLateralEntryCount`
    - `recommendationConfidence`
    - `recommendationRule`
- If the version does **not** yet have saved cohort parameters for a grade, the backend defaults the editable field values to the recommendation.

That merge/default behavior lives in:

- `apps/api/src/routes/enrollment/cohort-parameters.ts:85-107`
- `apps/api/src/routes/enrollment/cohort-parameters.ts:110-133`

The wizard then builds a separate `recommendedMap` for the "Suggested" column and the "Apply suggested defaults" action:

- `apps/web/src/components/enrollment/setup-wizard.tsx:500-517`

So the clean audit rule is:

- `wizard field value` = saved value if one exists, otherwise recommended default
- `wizard suggested value` = historical recommendation metadata

### 2. Historical recommendation algorithm for retention/laterals

The historical recommendation engine is in:

- `apps/api/src/services/cohort-recommendations.ts:144-279`

For each non-PS grade:

1. find the prior grade
2. read:
    - `priorAy1Headcount = AY1 of prior grade`
    - `ay2Headcount = AY2 of current grade`
3. compute:
    - `rolloverRatio = ay2Headcount / priorAy1Headcount`

Then the rules are:

```text
if rolloverRatio >= 1.05:
  recommendedRetentionRate = 0.97
  recommendedLateralEntryCount = ay2Headcount - floor(priorAy1Headcount * 0.97)
  rule = "fixed-97-growth"
else:
  recommendedRetentionRate = min(roundUpToFourDecimals(rolloverRatio), 1.0)
  recommendedLateralEntryCount = ay2Headcount - floor(priorAy1Headcount * recommendedRetentionRate)
  rule = "historical-rollover"
```

Special cases:

- `PS` is direct entry:
    - retention = `0`
    - laterals = `0`
    - rule = `direct-entry`
    - source: `apps/api/src/services/cohort-recommendations.ts:233-244`
- if no usable history exists:
    - retention defaults to `0.97`
    - laterals default to `0`
    - rule = `fallback-default`
    - source: `apps/api/src/services/cohort-recommendations.ts:253-263`

Confidence is derived from observation count:

- `3+` usable prior years => `high`
- `2` usable prior years => `medium`
- `1` usable prior year => `low`
- source: `apps/api/src/services/cohort-recommendations.ts:266-277`

### 3. Actual projection formula used by the grid, wizard preview, and backend

This is the important parity statement:

- the **wizard preview**
- the **cohort grid**
- the **backend calculation engine**

all use the same cohort projection rule.

Frontend shared helper:

- `apps/web/src/lib/enrollment-workspace.ts:171-209`

Grid usage:

- `apps/web/src/components/enrollment/cohort-progression-grid.tsx:93-102`

Wizard preview usage:

- `apps/web/src/components/enrollment/setup-wizard.tsx:524-545`

Backend engine:

- `apps/api/src/services/cohort-engine.ts:49-103`

The formula is:

```text
if grade == PS:
  ay2 = psAy2Headcount
else:
  priorGrade = grade progression previous grade
  retained = floor(AY1[priorGrade] * retentionRate[currentGrade])
  ay2 = retained + lateralEntryCount[currentGrade]
```

Important audit notes:

- The projection uses the **prior grade AY1**, not the same grade AY1.
- The retained count uses **floor**, not round.
- `PS` is always handled as a direct-entry override for AY2.

### 4. Nationality preview rule in the wizard

The wizard nationality preview is a frontend estimate, not a separate backend engine run.

Source:

- `apps/web/src/lib/enrollment-workspace.ts:212-318`
- `apps/web/src/components/enrollment/setup-wizard.tsx:547-555`

Current rule:

- retained students inherit the prior-grade AY1 nationality composition
- lateral students use the grade's lateral weight trio:
    - `lateralWeightFr`
    - `lateralWeightNat`
    - `lateralWeightAut`
- counts are reconciled back to the projected AY2 total after rounding

### 5. Setup apply contract

The wizard is not the final source of truth; `POST /setup/apply` is.

Backend contract:

- `apps/api/src/routes/enrollment/setup.ts:24-41`
- `apps/api/src/routes/enrollment/setup.ts:368-520`

The apply route currently requires:

- all AY1 headcounts are integers `>= 0`
- all cohort entries are present
- `psAy2Headcount` is an integer `>= 0`
- if a grade has `lateralEntryCount > 0`, then:
    - `lateralWeightFr + lateralWeightNat + lateralWeightAut` must sum to `1.0`
    - validation lives at `apps/api/src/routes/enrollment/setup.ts:434-463`

After validation the route:

- upserts AY1 headcounts
- upserts `PS AY2`
- upserts cohort parameters
- marks enrollment downstream results stale
- triggers the enrollment workspace calculation in one transaction

## What can make the UI feel inconsistent

### Exact recommendation precision vs displayed percentages

The backend recommendation engine can emit exact rates with four-decimal precision such as `0.991`.

The UI currently displays retention as whole percentages in the main editing surfaces:

- wizard retention inputs/suggested display:
    - `apps/web/src/components/enrollment/setup-wizard.tsx`
- cohort grid retention display:
    - `apps/web/src/components/enrollment/cohort-progression-grid.tsx`
- inspector retention display:
    - `apps/web/src/components/enrollment/inspector-active-view.tsx:360-367`

That means the following can happen:

- engine stores/recommends `0.991`
- user sees `99%`
- actual retained count still uses `0.991`, not `0.99`

This is not a grid-vs-backend formula mismatch. It is a **precision-display mismatch**.

## Wizard audit findings

### Corrected in this pass

| Area                          | Problem                                                                                                      | Status | Main code                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------- |
| Modal positioning             | Wizard was rendered inside the page flow and appeared too low on screen                                      | Fixed  | `apps/web/src/components/enrollment/setup-wizard.tsx`                     |
| Import rollback               | `Keep baseline` did not actually restore the seeded dataset after using imported values                      | Fixed  | `apps/web/src/components/enrollment/setup-wizard.tsx:697-714`             |
| Partial import behavior       | Missing grades from a partial workbook could overwrite staged rows incorrectly                               | Fixed  | `apps/web/src/components/enrollment/setup-wizard.tsx:697-714`             |
| Loading guardrails            | The wizard could advance before state was fully initialized because empty arrays passed `.every(...)` checks | Fixed  | `apps/web/src/components/enrollment/setup-wizard.tsx:567-648`             |
| Integer validation            | AY1, laterals, and `PS AY2` accepted decimal-looking input that only failed at the API boundary              | Fixed  | `apps/web/src/components/enrollment/setup-wizard.tsx:574-595`, `:650-748` |
| Same-file reupload            | Re-selecting the same workbook would not reliably trigger `onChange`                                         | Fixed  | `apps/web/src/components/enrollment/setup-wizard.tsx:716-730`             |
| Setup completion detection    | The page could treat a configured version as incomplete when the global period filter was `AY2`              | Fixed  | `apps/web/src/pages/planning/enrollment.tsx:55-110`                       |
| Stale propagation             | Headcount edits did not mark `ENROLLMENT` stale with the rest of the chain                                   | Fixed  | `apps/api/src/routes/enrollment/headcount.ts:33`, `:183-214`              |
| Setup/apply validation parity | Wizard apply route did not enforce lateral-weight sum the same way cohort parameter save did                 | Fixed  | `apps/api/src/routes/enrollment/setup.ts:434-463`                         |

### Still open after this pass

1. Retention precision is still shown as whole percent in the main UI.
    - This is likely the biggest remaining source of user confusion.
    - Recommended product decision:
        - either display one decimal place everywhere, or
        - constrain the product to integer-percent retention everywhere.

2. Nationality override persistence can still drift from recalculated AY2 totals.
    - The explorer audit found that override rows can become inconsistent with later AY2 recalculation if the full trio is not reconciled carefully.
    - This needs a dedicated API/frontend pass.

3. The API still conceptually allows direct AY2 row writes outside the guided `PS AY2` pattern.
    - The wizard intentionally exposes only `PS AY2` as direct AY2 entry.
    - The broader enrollment write surface should be reviewed to ensure that contract stays coherent.

## Verification run

The following checks passed after the corrections:

- `pnpm --filter @budfin/web exec vitest run src/components/enrollment/setup-wizard.test.tsx src/pages/planning/enrollment.test.tsx`
- `pnpm --filter @budfin/api exec vitest run src/routes/enrollment/setup.test.ts src/routes/enrollment/headcount.test.ts`
- `pnpm --filter @budfin/web typecheck`
- `pnpm --filter @budfin/api typecheck`
- `pnpm exec eslint apps/web/src/components/enrollment/setup-wizard.tsx apps/web/src/components/enrollment/setup-wizard.test.tsx apps/web/src/pages/planning/enrollment.tsx apps/web/src/pages/planning/enrollment.test.tsx apps/api/src/routes/enrollment/setup.ts apps/api/src/routes/enrollment/setup.test.ts apps/api/src/routes/enrollment/headcount.ts apps/api/src/routes/enrollment/headcount.test.ts`

## Recommended next decisions

1. Decide the product rule for retention precision.
    - Recommended: show one decimal place in wizard, grid, and inspector, and make the retained count explicit.

2. Tighten nationality override behavior.
    - Recommended: save and validate the full nationality trio together for a grade, then reconcile counts to the projected AY2 total.

3. Add an end-to-end browser test for the wizard.
    - Suggested coverage:
        - open wizard
        - import optional workbook
        - revert to baseline
        - edit AY1
        - edit cohort assumptions
        - validate and apply
        - confirm inspector/grid state after save

## Bottom line

For audit purposes, the current implementation should be understood as having:

- **one historical recommendation algorithm** for wizard defaults/suggestions
- **one projection algorithm** shared by wizard preview, cohort grid, and backend calculation

The remaining risk is mostly not "multiple formulas." It is the combination of:

- whole-percent UI displays on top of exact recommendation rates, and
- a few secondary override/persistence workflows that still need cleanup.
