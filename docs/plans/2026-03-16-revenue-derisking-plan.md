# Revenue Module De-risking Plan (v3 -- Post-Review)

## Context

The revenue module audit (`docs/plans/2026-03-16-revenue-module-audit.md`) identified 10 findings. Three are critical:

1. **Discount is coupled to Plein tariff lookup + dual mode complexity** (F-03): The user wants ONE clean method -- a straight % discount applied to each fee grid row's own tuitionHt.
2. **`grossRevenueHt` stores post-discount effective tuition**, but the reporting layer subtracts the discount again -- **Total Operating Revenue is understated by ~2.3M SAR** (double-subtraction bug).
3. **Evaluation fees double-counted** in both engine totals and reporting matrix (F-06), inflating Registration Fees.

User decisions:

- Discount = `row.tuitionHt * flatDiscountPct` for every fee grid row (no Plein reference)
- Fix grossRevenueHt to store true gross (pre-discount)
- Remove per-tariff discount entirely: drop `discount_policies` table + routes + frontend
- One clean discount approach, no legacy paths

### Non-goals (deferred)

- F-04: VAT rate configurability (keep hardcoded 15%)
- F-05: Delete/reinsert persistence pattern (keep as-is)
- F-07: Concurrency lock on calculate (keep as-is)
- F-10: Client-side filtering scale (keep as-is)

### Breaking change (accepted)

Legacy budget versions with `flatDiscountPct = 0` that previously used per-tariff discounts (RP=25%, R3+=10%) will get **zero discount** on recalculation after this change. Users must manually set `flatDiscountPct` on those versions before recalculating. This is accepted because EFIR has few legacy versions and actively uses flat discount on current ones.

---

## Phase 1: Fix Evaluation Double-Counting

Smallest change, highest confidence. Do first to reduce test churn in later phases.

### 1a. `apps/api/src/services/revenue-engine.ts`

- **Delete** `shouldDoubleCountInExecutiveSummary()` function (lines 274-276)
- **Remove** its call at lines 464-466. The loop becomes:
    ```typescript
    if (executiveCategory !== null) {
        totalExecutiveOtherRevenue = totalExecutiveOtherRevenue.plus(amount);
    }
    ```

### 1b. `apps/api/src/services/revenue-reporting.ts`

- **Change** `mapOtherRevenueLines()` at lines 146-149. From:
    ```typescript
    return ['New Student Fees (Dossier+DPI)', 'Evaluation Tests'];
    ```
    To:
    ```typescript
    return ['Evaluation Tests'];
    ```

### 1c. `apps/api/src/services/revenue-reporting.test.ts`

- **Update** test at line 121-132: evaluation maps to `'Evaluation Tests'` only, `'New Student Fees'` = `'0.0000'`
- **Add** totals regression test: single eval item of 10000 SAR -> registrationTotal = 10000 (not 20000)

### 1d. `apps/api/src/services/revenue-engine.test.ts`

- **Add** test: evaluation item counted once in `totalExecutiveOtherRevenue`

### 1e. `apps/api/src/routes/revenue/results.test.ts` (if exists)

- **Verify** reporting totals tests still pass after evaluation fix

---

## Phase 2: Simplify Discount + Fix grossRevenueHt

### The Core Change

**Before (current broken semantics):**

```
resolveEffectiveTuitionAmounts() returns:
  tuitionFeesPerStudentHt = pleinHt * (1 - flatPct)  // post-discount
  discountPerStudentHt    = pleinHt * flatPct

Main loop:
  grossRevenueHt = headcount * tuitionFeesPerStudentHt  // misleadingly named, is post-discount
  discountAmount = headcount * discountPerStudentHt
  netRevenueHt   = grossRevenueHt - discountAmount      // double-subtracted
  vatAmount      = grossRevenueHt * 0.15                 // VAT on post-discount

Reporting: Total = grossRevenueHt + (-discountAmount) + other
         = (tuition - discount) - discount + other       // WRONG: double-subtraction
```

**After (correct semantics):**

```
resolveEffectiveTuitionAmounts() returns:
  grossTuitionPerStudentHt = fee.tuitionHt              // true gross from fee grid row
  discountPerStudentHt     = fee.tuitionHt * flatPct    // straight % of own fee

Main loop:
  grossRevenueHt = headcount * grossTuitionPerStudentHt  // true gross
  discountAmount = headcount * discountPerStudentHt       // the discount
  netRevenueHt   = grossRevenueHt - discountAmount        // correct single subtraction
  vatAmount      = netRevenueHt * 0.15                    // VAT on what customer pays

Reporting: Total = grossRevenueHt + (-discountAmount) + other
         = tuition - discount + other                     // CORRECT
```

### 2a. `apps/api/src/services/revenue-engine.ts` -- resolveEffectiveTuitionAmounts()

**Rewrite the function.** Remove `feeMap` and `discountPolicies` parameters (no Plein lookup, no per-tariff):

```typescript
function resolveEffectiveTuitionAmounts(
    fee: FeeGridInput,
    nationality: string,
    flatDiscountPct: Decimal
): {
    grossTuitionPerStudentHt: Decimal;
    discountPerStudentHt: Decimal;
    vatRate: Decimal;
} {
    const ownTuitionHt = new Decimal(fee.tuitionHt);
    return {
        grossTuitionPerStudentHt: ownTuitionHt,
        discountPerStudentHt: ownTuitionHt.mul(flatDiscountPct),
        vatRate: nationality === 'Nationaux' ? ZERO : VAT_RATE,
    };
}
```

**Delete** `resolveDiscountRate()` function (lines 157-172).
**Delete** `DiscountPolicyInput` interface (lines 27-30).
**Remove** `discountPolicies` from `RevenueEngineInput` interface (line 46).

### 2b. `apps/api/src/services/revenue-engine.ts` -- Plein fallback decision

**Remove** the Plein fallback at lines 378-382. Currently the main loop does:

```typescript
const fee =
    feeMap.get(feeKey) ??
    feeMap.get(
        makePleinFeeKey(enrollment.academicPeriod, enrollment.gradeLevel, enrollment.nationality)
    );
```

Change to **exact match only**:

```typescript
const fee = feeMap.get(feeKey);
```

Rationale: The new rule is "discount = row's own tuitionHt \* flatPct". If there's no fee grid row for a segment, the engine should skip it (the existing `if (!fee) continue` at line 384 handles this). Falling back to Plein would produce revenue based on the wrong fee and mask data alignment issues. Phase 4 (cross-validation) surfaces these mismatches as warnings.

**Delete** `makePleinFeeKey()` function (lines 196-198) -- no longer used anywhere.

### 2c. `apps/api/src/services/revenue-engine.ts` -- calculateRevenue() main loop

**Update variable names** (lines 388-432):

```typescript
const { grossTuitionPerStudentHt, discountPerStudentHt, vatRate } = resolveEffectiveTuitionAmounts(
    fee,
    enrollment.nationality,
    flatDiscountPct
);

const academicYearGrossTuition = headcount.mul(grossTuitionPerStudentHt);
const academicYearDiscounts = headcount.mul(discountPerStudentHt);
const academicYearNetTuition = academicYearGrossTuition.minus(academicYearDiscounts);
const academicYearVat = academicYearNetTuition.mul(vatRate); // VAT on net (what customer pays)
```

### 2d. `apps/api/src/services/revenue-engine.ts` -- calculateRevenue() signature

Remove `discountPolicies` from the input:

```typescript
export function calculateRevenue(input: RevenueEngineInput): RevenueEngineOutput {
    const flatDiscountPct = input.flatDiscountPct ? new Decimal(input.flatDiscountPct) : ZERO;
    // ...
}
```

### 2e. `apps/api/src/routes/revenue/calculate.ts`

- **Remove** the `discountPolicies` fetch from the parallel query (line 81: `prisma.discountPolicy.findMany`)
- **Remove** `discountPolicies` from the engine input construction (lines 227-229)
- **Remove** `discountPolicies` count from the calculation summary (line 294)

### 2f. Test files to update for Phase 2

| Test file                                            | What to update                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/services/revenue-engine.test.ts`       | Rewrite discount tests (flat % on own fee), update VAT tests (VAT on net), update totals, remove all per-tariff test cases and `DiscountPolicyInput` usage                                                                                                                                               |
| `apps/api/src/routes/revenue/calculate.test.ts`      | Remove `discountPolicy.findMany` mock, update engine input expectations, update summary expectations                                                                                                                                                                                                     |
| `apps/api/src/validation/revenue-validation.test.ts` | Remove `discounts` fixture load + `DiscountPolicyInput` mapping + `discountPolicies` in engine input. Update WORKBOOK_TOTALS (grossRevenueHt is now true gross). Update discount validation tests (lines 241-283) to use flatDiscountPct instead of per-tariff rates. Remove "3 discount policies" test. |

---

## Phase 3: Remove discount_policies (Table + Routes + Frontend + Tooling)

### Backend route cleanup

| File                                            | Action                                                          |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `apps/api/src/routes/revenue/discounts.ts`      | **DELETE**                                                      |
| `apps/api/src/routes/revenue/discounts.test.ts` | **DELETE**                                                      |
| `apps/api/src/routes/revenue/index.ts`          | Remove `discountRoutes` import + `app.register(discountRoutes)` |

### Database

| File                            | Action                                                                                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma` | Delete `DiscountPolicy` model (lines 634-651). Remove `discountPolicies DiscountPolicy[]` from `BudgetVersion` (line 385). Remove `createdDiscounts DiscountPolicy[]` and `updatedDiscounts DiscountPolicy[]` from `User` (lines 84-85). |
| New migration                   | `pnpm --filter @budfin/api exec prisma migrate dev --name remove-discount-policies`                                                                                                                                                      |

### Backend readiness cleanup

| File                                            | Action                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/revenue/readiness.ts`      | Remove `discountPolicies` fetch (line 77). Remove `rpPolicy`/`r3Policy` lookup (lines 141-142). **KEEP** the `discounts` key in the response as `{ flatRate, ready: settingsExist }` (frontend reads it). Change `totalCount` from 3 to 2 in the response. Discounts readiness is always true if settings exist. |
| `apps/api/src/routes/revenue/readiness.test.ts` | Remove `discountPolicy.findMany` mock. Update expectations.                                                                                                                                                                                                                                                      |

### Seed/migration/validation cleanup

| File                                                 | Action                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/migration/importers/revenue.ts`        | Remove section 5 "Insert discount policies" (lines 213-238). Remove `discounts` fixture load (line 24).                              |
| `apps/api/src/migration/lib/types.ts`                | Remove `DiscountFixture` interface (lines 41-44).                                                                                    |
| `apps/api/src/migration/validation/suite.ts`         | Remove `discount_policies: 3` from expected counts (line 60). Remove `discountPolicy.count` validation block (lines 74-81).          |
| `apps/api/src/migration/lib/fixture-loader.test.ts`  | Remove any discount fixture references.                                                                                              |
| `apps/api/src/validation/parse-revenue-excel.ts`     | Remove `parseDiscounts()` function and its call. Remove `DiscountEntry` interface. Remove fixture write for `fy2026-discounts.json`. |
| `apps/api/src/validation/revenue-validation.test.ts` | Already handled in Phase 2f, but also remove any remaining `DiscountFixture` / `DiscountPolicyInput` types.                          |
| `apps/api/src/lib/seed-data.ts`                      | Remove `discountRate` assumption entry (line 179).                                                                                   |
| `data/fixtures/fy2026-discounts.json`                | **DELETE** fixture file.                                                                                                             |

### Frontend cleanup

| File                                                | Action                                                                                                                                                                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/revenue/discounts-tab.tsx` | **DELETE**                                                                                                                                                                                                                                                             |
| `apps/web/src/hooks/use-revenue.ts`                 | Delete `useDiscounts()` (lines 59-65) and `usePutDiscounts()` (lines 67-78). Remove imports.                                                                                                                                                                           |
| `packages/types/src/revenue.ts`                     | Remove `'discounts'` from `RevenueSettingsTab` union (line 36). Remove `DiscountEntry` interface (lines 51-54). Change `RevenueReadinessResponse.totalCount` from literal `3` to `2` (line 158). Keep `DiscountReadiness` interface (still used for flatRate display). |
| `packages/types/src/index.ts`                       | Remove `DiscountEntry` re-export (line 59). Keep `DiscountReadiness` re-export (still used).                                                                                                                                                                           |

### Frontend settings dialog + flat discount relocation

| File                                                               | Action                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/revenue/revenue-settings-dialog.tsx`      | Remove `discounts` from TAB_CONFIG (line 21). Remove `<DiscountsTab />` rendering (line 291-293). Remove import.                                                                                                                                                                                                                                                                                                |
| `apps/web/src/components/revenue/revenue-settings-dialog.test.tsx` | Remove discount tab test expectations.                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/web/src/components/revenue/fee-grid-tab.tsx`                 | **Add explicit flatDiscountPct editing UI.** Currently `PER_STUDENT_FEE_FIELDS` explicitly excludes `flatDiscountPct` via `Omit<RevenueSettings, 'flatDiscountPct'>` (line 49). Add a "Discount" section above or below the per-student fees section with a single input for `flatDiscountPct` (displayed as 0-100%, stored as 0.0-1.0 decimal). Wire it through the existing `usePutRevenueSettings` mutation. |

### Frontend readiness/inspector/checklist cleanup

| File                                                       | Action                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/revenue-readiness.ts`                    | Remove `'discounts'` from `RevenueReadinessArea.key` union (line 4). Remove the discounts entry from `getRevenueReadinessAreas()` return array (lines 20-25). This reduces from 3 areas to 2 (Fee Grid + Other Revenue).                                                                                                                                        |
| `apps/web/src/components/revenue/setup-checklist.tsx`      | Remove `{ key: 'discounts', label: 'Discounts', tab: 'discounts' }` from AREA_CONFIG (line 21). Update `Pick<>` type to remove `'discounts'` (line 16).                                                                                                                                                                                                         |
| `apps/web/src/components/revenue/setup-checklist.test.tsx` | Update test expectations for 2 areas instead of 3.                                                                                                                                                                                                                                                                                                              |
| `apps/web/src/lib/revenue-workspace.ts`                    | Change `resolveCategorySettingsTarget()` at line 219-220: map `'Discount Impact'` -> `'feeGrid'` instead of `'discounts'` (discounts are now configured in the fee grid tab).                                                                                                                                                                                   |
| `apps/web/src/components/revenue/revenue-inspector.tsx`    | Line 94-95: Change `getCategoryTab()` mapping for `'Discount Impact'` from `'discounts'` to `'feeGrid'`. Line 331: Change formula text from `'Discount = (RP headcount x RP rate + R3+ headcount x R3+ rate) x fee'` to `'Discount = grossRevenue x flatDiscountPct'`. Lines 432-437: Update discount policy status to reference flatDiscountPct from settings. |

### Frontend page-level cleanup

| File                                                       | Action                                                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/pages/planning/revenue.tsx`                  | Verify no direct discount references (discount display comes through the matrix and inspector, which are already updated above). |
| `apps/web/src/pages/planning/revenue.test.tsx` (if exists) | Update any discount tab interaction tests.                                                                                       |

---

## Phase 4: Add Enrollment/Fee-Grid Cross-Validation (F-01)

### 4a. `apps/api/src/routes/revenue/readiness.ts`

Add enrollment fetch to the `Promise.all`. Cross-check each enrollment segment key against fee grid entries:

```typescript
enrollmentFeeGridAlignment: {
    totalSegments: number;
    matchedSegments: number;
    unmatchedSegments: Array<{
        academicPeriod: string;
        gradeLevel: string;
        nationality: string;
        tariff: string;
        headcount: number;
    }>;
}
```

**Non-blocking**: `overallReady` does NOT depend on this. The UI can display a warning.

Note: Since Phase 2b removed the Plein fallback, unmatched segments now produce zero revenue (engine skips them). This cross-validation surfaces those mismatches to the user BEFORE they calculate.

### 4b. `packages/types/src/revenue.ts`

Add `enrollmentFeeGridAlignment` to `RevenueReadinessResponse`.

### 4c. `apps/api/src/routes/revenue/readiness.test.ts`

Add tests: matched enrollment returns empty unmatched, unmatched enrollment surfaces correct warning.

---

## Phase 5: Documentation (F-02 + F-08)

### 5a. `apps/api/prisma/schema.prisma`

Add comment above `scholarshipDeduction`:

```
/// Reserved for v2 scholarship model. Currently always 0.0000.
```

### 5b. `apps/api/src/services/revenue-engine.ts`

Add comment in `FeeGridInput`:

```typescript
// NOTE: term1Amount, term2Amount, term3Amount from fee_grids are payment-schedule
// fields (installment breakdown), not revenue-recognition inputs.
```

---

## Complete File Inventory

### Files to DELETE (4)

| File                                                | Reason                    |
| --------------------------------------------------- | ------------------------- |
| `apps/api/src/routes/revenue/discounts.ts`          | Per-tariff route removed  |
| `apps/api/src/routes/revenue/discounts.test.ts`     | Test for deleted route    |
| `apps/web/src/components/revenue/discounts-tab.tsx` | Per-tariff UI removed     |
| `data/fixtures/fy2026-discounts.json`               | Fixture for deleted model |

### Files to MODIFY -- Backend Services + Routes (14)

| File                                                | Phase | Change                                                                                                                                                       |
| --------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/services/revenue-engine.ts`           | 1,2,5 | Delete double-count, rewrite discount to straight %, remove Plein fallback + makePleinFeeKey, delete resolveDiscountRate + DiscountPolicyInput, add comments |
| `apps/api/src/services/revenue-engine.test.ts`      | 1,2   | Rewrite discount + eval tests, remove DiscountPolicyInput, add VAT-on-net test, add flatDiscountPct=1 edge case, add mixed-tariff test                       |
| `apps/api/src/services/revenue-reporting.ts`        | 1     | Single-line fix in mapOtherRevenueLines                                                                                                                      |
| `apps/api/src/services/revenue-reporting.test.ts`   | 1     | Update eval test, add totals regression                                                                                                                      |
| `apps/api/src/routes/revenue/calculate.ts`          | 2     | Remove discountPolicies fetch + engine input                                                                                                                 |
| `apps/api/src/routes/revenue/calculate.test.ts`     | 2     | Remove discount mock, update expectations, update grossRevenueHt assertions                                                                                  |
| `apps/api/src/routes/revenue/index.ts`              | 3     | Remove discountRoutes registration                                                                                                                           |
| `apps/api/src/routes/revenue/readiness.ts`          | 3,4   | Remove discount_policies refs, keep discounts in response with flatRate+ready, change totalCount to 2, add enrollment cross-check                            |
| `apps/api/src/routes/revenue/readiness.test.ts`     | 3,4   | Remove discountPolicy mock, update totalCount expectations, add alignment tests                                                                              |
| `apps/api/prisma/schema.prisma`                     | 3,5   | Delete DiscountPolicy model + User relations + BudgetVersion relation, add scholarship comment                                                               |
| `apps/api/src/migration/importers/revenue.ts`       | 3     | Remove discount insert section + fixture load                                                                                                                |
| `apps/api/src/migration/lib/types.ts`               | 3     | Remove DiscountFixture                                                                                                                                       |
| `apps/api/src/migration/validation/suite.ts`        | 3     | Remove discount_policies count validation                                                                                                                    |
| `apps/api/src/migration/lib/fixture-loader.test.ts` | 3     | Remove discount fixture refs                                                                                                                                 |

### Files to MODIFY -- Validation/Seed (4)

| File                                                 | Phase | Change                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/validation/revenue-validation.test.ts` | 2,3   | Remove discount fixtures/policies, recompute WORKBOOK_TOTALS (grossRevenueHt is now true gross -- run engine against fixtures to capture new values), rewrite discount tests for flat %                                                           |
| `apps/api/src/validation/parse-revenue-excel.ts`     | 3     | Remove parseDiscounts(), DiscountEntry, fixture write                                                                                                                                                                                             |
| `apps/api/src/validation/seed-fy2026.ts`             | 2,3   | Remove `DiscountPolicyInput` import, remove `DiscountFixture` interface, remove `fy2026-discounts.json` load, remove `prisma.discountPolicy.create()` section, remove discount count log. Update engine input to remove `discountPolicies` array. |
| `apps/api/src/lib/seed-data.ts`                      | 3     | Remove discountRate assumption entry (line 179)                                                                                                                                                                                                   |

### Files to MODIFY -- Types (2)

| File                            | Phase | Change                                                                                                                                                                                                   |
| ------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/types/src/revenue.ts` | 3,4   | Remove `'discounts'` from `RevenueSettingsTab`. Remove `DiscountEntry`. Change `totalCount: 3` to `totalCount: 2`. Add `enrollmentFeeGridAlignment`. Keep `DiscountReadiness` (still used for flatRate). |
| `packages/types/src/index.ts`   | 3     | Remove `DiscountEntry` re-export. Keep `DiscountReadiness` re-export.                                                                                                                                    |

### Files to MODIFY -- Frontend (15)

| File                                                               | Phase | Change                                                                                                                                                       |
| ------------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/hooks/use-revenue.ts`                                | 3     | Delete useDiscounts + usePutDiscounts                                                                                                                        |
| `apps/web/src/components/revenue/revenue-settings-dialog.tsx`      | 3     | Remove Discounts tab from TAB_CONFIG + TabsContent render                                                                                                    |
| `apps/web/src/components/revenue/revenue-settings-dialog.test.tsx` | 3     | Remove discount tab tests, update readiness mocks (totalCount: 2)                                                                                            |
| `apps/web/src/components/revenue/fee-grid-tab.tsx`                 | 3     | **Add flatDiscountPct input UI** (currently excluded via `Omit` at line 49). Add "Discount" section with 0-100% input, wire through `usePutRevenueSettings`. |
| `apps/web/src/lib/revenue-readiness.ts`                            | 3     | Remove `'discounts'` from key union and from readiness areas array (3 -> 2)                                                                                  |
| `apps/web/src/components/revenue/setup-checklist.tsx`              | 3     | Remove discounts from AREA_CONFIG, update Pick type                                                                                                          |
| `apps/web/src/components/revenue/setup-checklist.test.tsx`         | 3     | Update for 2 areas, update readiness mocks                                                                                                                   |
| `apps/web/src/lib/revenue-workspace.ts`                            | 3     | Map 'Discount Impact' -> 'feeGrid' in resolveCategorySettingsTarget                                                                                          |
| `apps/web/src/components/revenue/revenue-inspector.tsx`            | 3     | Update getCategoryTab mapping, update formula text, update discount status display                                                                           |
| `apps/web/src/components/revenue/revenue-inspector.test.tsx`       | 3     | Update readiness mocks (totalCount: 2), update getCategoryTab expectations                                                                                   |
| `apps/web/src/components/revenue/revenue-status-strip.test.tsx`    | 3     | Update readiness mocks (totalCount: 2)                                                                                                                       |
| `apps/web/src/components/revenue/revenue-guide-content.tsx`        | 3     | Update "3 areas" text to "2 areas"                                                                                                                           |
| `apps/web/src/components/revenue/kpi-ribbon.test.tsx`              | 2     | Update mock grossRevenueHt values (now true gross, higher numbers)                                                                                           |
| `apps/web/src/pages/planning/revenue.test.tsx`                     | 3     | Update readiness mocks (totalCount: 2), discount tab refs                                                                                                    |
| `apps/web/src/pages/planning/revenue.tsx`                          | 3     | Verify no direct discount references (likely no changes)                                                                                                     |

**Total: 4 deleted + 35 modified = 39 files**

---

## Required Edge Case Tests

These must be explicitly covered in `revenue-engine.test.ts` after Phase 2:

| Edge Case                                             | Expected Behavior                                      |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `flatDiscountPct = 0`                                 | Zero discount, grossRevenueHt = netRevenueHt           |
| `flatDiscountPct = 0.05` on Plein row                 | discount = tuitionHt \* 0.05, VAT on net               |
| `flatDiscountPct = 0.05` on RP row with different fee | discount = rpTuitionHt \* 0.05 (NOT pleinTuitionHt)    |
| `flatDiscountPct = 1` (100% discount)                 | net = 0, VAT = 0, no division-by-zero                  |
| VAT on net with discount active                       | `vatAmount = (grossRevenueHt - discountAmount) * 0.15` |
| Nationaux with discount                               | vatRate = 0, discount still applied                    |
| Missing fee grid row (no exact match)                 | Segment skipped, produces zero revenue                 |
| Zero headcount segment                                | Segment skipped (existing behavior)                    |

---

## WORKBOOK_TOTALS Recalculation Strategy

`revenue-validation.test.ts` has hardcoded `WORKBOOK_TOTALS` (tuitionFees, discountImpact, netTuition, totalOperatingRevenue). After grossRevenueHt becomes true gross, these values change.

**Strategy:** After implementing Phase 2, temporarily run the engine against the fixture data with `flatDiscountPct = '0.000000'` (zero discount). With zero discount, grossRevenueHt = netRevenueHt = the sum of all segment tuitionHt \* headcount. Capture the actual output and update WORKBOOK_TOTALS. Then add a separate test with a non-zero flatDiscountPct to validate the discount formula.

---

## Verification

```bash
# After Phase 1 (eval fix):
pnpm --filter @budfin/api exec vitest run src/services/revenue-engine.test.ts
pnpm --filter @budfin/api exec vitest run src/services/revenue-reporting.test.ts

# After Phase 2 (discount + grossRevenueHt fix):
pnpm --filter @budfin/api exec vitest run src/services/revenue-engine.test.ts
pnpm --filter @budfin/api exec vitest run src/routes/revenue/calculate.test.ts
pnpm --filter @budfin/api exec vitest run src/validation/revenue-validation.test.ts

# After Phase 3 (full removal):
pnpm --filter @budfin/api exec prisma generate
pnpm --filter @budfin/api exec prisma migrate dev --name remove-discount-policies
pnpm --filter @budfin/api test
pnpm --filter @budfin/web test

# After Phase 4 (cross-validation):
pnpm --filter @budfin/api exec vitest run src/routes/revenue/readiness.test.ts

# Full suite:
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

### Manual checks after all phases

1. Calculate revenue for a version with `flatDiscountPct = 0.05` (5%)
2. Verify: `grossRevenueHt` = true gross (tuitionHt \* headcount, distributed across months)
3. Verify: `discountAmount` = grossRevenueHt \* 0.05
4. Verify: `netRevenueHt` = grossRevenueHt - discountAmount
5. Verify: `vatAmount` = netRevenueHt \* 0.15 (for non-Nationaux)
6. Verify: Total Operating Revenue = net tuition + other revenue (no double-subtraction)
7. Verify: Evaluation fees counted once in Registration Fees total
8. Verify: Settings dialog has 2 tabs (Fee Grid + Other Revenue), flat discount input visible in Fee Grid tab
9. Verify: Readiness shows 2 areas (Fee Grid + Other Revenue), totalCount = 2
10. Verify: Inspector routes 'Discount Impact' to Fee Grid tab, formula text updated
11. Verify: `flatDiscountPct = 0` produces zero discount (backward compat)
12. Verify: `flatDiscountPct = 1` produces zero net revenue without errors
