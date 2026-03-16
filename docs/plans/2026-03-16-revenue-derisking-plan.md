# Revenue Module De-risking Plan

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

**Delete** `resolveDiscountRate()` function (lines 157-172) -- no longer needed.
**Delete** `DiscountPolicyInput` interface (lines 27-30).
**Remove** `discountPolicies` from `RevenueEngineInput` interface (line 46).

### 2b. `apps/api/src/services/revenue-engine.ts` -- calculateRevenue() main loop

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

The fee lookup fallback at lines 378-382 still uses `makePleinFeeKey()` as a fallback when no exact match exists. This is about finding ANY fee for the segment, not about discount calculation -- keep it.

### 2c. `apps/api/src/services/revenue-engine.ts` -- calculateRevenue() signature

Remove `discountPolicies` from the input:

```typescript
export function calculateRevenue(input: RevenueEngineInput): RevenueEngineOutput {
    // input.discountPolicies removed
    const flatDiscountPct = input.flatDiscountPct ? new Decimal(input.flatDiscountPct) : ZERO;
    // ...
}
```

### 2d. `apps/api/src/routes/revenue/calculate.ts`

- **Remove** the `discountPolicies` fetch from the parallel query (line 81)
- **Remove** `discountPolicies` from the engine input construction (lines 227-229)
- **Remove** `discountPolicies` count from the calculation summary (line 294)

### 2e. `apps/api/src/services/revenue-engine.test.ts`

- **Rewrite discount tests** to validate new semantics:
    - `flatDiscountPct = 0.15` on Plein row: `grossRevenueHt = fee.tuitionHt * headcount`, `discountAmount = gross * 0.15`
    - `flatDiscountPct = 0.15` on RP row with different fee: `grossRevenueHt = rpFee * headcount` (NOT pleinFee)
    - `flatDiscountPct = 0`: zero discount, `grossRevenueHt = fee.tuitionHt * headcount`
- **Update VAT tests**: `vatAmount = netRevenueHt * 0.15` (VAT on net, not gross)
- **Update totals tests**: `totalOperatingRevenue = totalNetTuitionHt + totalExecutiveOtherRevenue`
- **Remove** all per-tariff discount test cases (resolveDiscountRate, DiscountPolicy inputs)

---

## Phase 3: Remove discount_policies (Table + Routes + Frontend)

### 3a. `apps/api/prisma/schema.prisma`

- **Delete** the `DiscountPolicy` model (lines 634-651)
- **Remove** `discountPolicies DiscountPolicy[]` from `BudgetVersion` model (line 385)
- **Remove** `createdDiscounts DiscountPolicy[]` and `updatedDiscounts DiscountPolicy[]` from `User` model (lines 84-85)

### 3b. Prisma migration

```bash
pnpm --filter @budfin/api exec prisma migrate dev --name remove-discount-policies
```

This drops the `discount_policies` table. Destructive but user explicitly requested it.

### 3c. `apps/api/src/routes/revenue/discounts.ts` -- DELETE file

### 3d. `apps/api/src/routes/revenue/discounts.test.ts` -- DELETE file

### 3e. `apps/api/src/routes/revenue/index.ts`

- **Remove** `import { discountRoutes } from './discounts.js'`
- **Remove** `await app.register(discountRoutes)`

### 3f. `apps/api/src/routes/revenue/readiness.ts`

- **Remove** the `discountPolicies` fetch (line 77) from the parallel query
- **Remove** the `rpPolicy`/`r3Policy` lookup logic (lines 141-142)
- **Simplify** the discounts readiness section: always ready if VersionRevenueSettings exists (flatDiscountPct is part of settings). This is already close to current behavior but remove the DiscountPolicy references.

### 3g. `apps/api/src/routes/revenue/readiness.test.ts`

- **Remove** mock for `discountPolicy.findMany`
- **Update** test expectations

### 3h. `apps/web/src/hooks/use-revenue.ts`

- **Delete** `useDiscounts()` hook (lines 59-65)
- **Delete** `usePutDiscounts()` hook (lines 67-78)
- **Remove** related types/imports

### 3i. `apps/web/src/components/revenue/discounts-tab.tsx` -- DELETE file

This component shows the per-tariff discount grid (RP/R3+ rates). It is removed entirely.

### 3j. `apps/web/src/components/revenue/revenue-settings-dialog.tsx`

- **Remove** the "Discounts" tab that renders `<DiscountsTab />`
- The flat discount % (`flatDiscountPct`) is already part of `VersionRevenueSettings` -- it should be displayed in the Fee Grid tab or as a simple input in the remaining settings UI
- **If** the flat discount input is already in the Fee Grid tab (via settings route), no further UI work needed
- **If** not, add a simple "Flat Discount %" input field to the Fee Grid tab

### 3k. `apps/web/src/components/revenue/revenue-settings-dialog.test.tsx`

- **Remove** discount tab test expectations

### 3l. `packages/types/src/revenue.ts`

- **Remove** `DiscountEntry` type and `DiscountsResponse` type (if they exist)

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

### 4b. `packages/types/src/revenue.ts`

Add `enrollmentFeeGridAlignment` to `RevenueReadinessResponse`.

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

| File                                                               | Phase | Action                                                    |
| ------------------------------------------------------------------ | ----- | --------------------------------------------------------- |
| `apps/api/src/services/revenue-engine.ts`                          | 1,2,5 | Rewrite discount logic, delete double-count, add comments |
| `apps/api/src/services/revenue-engine.test.ts`                     | 1,2   | Rewrite discount tests, add eval test                     |
| `apps/api/src/services/revenue-reporting.ts`                       | 1     | Single-line fix in mapOtherRevenueLines                   |
| `apps/api/src/services/revenue-reporting.test.ts`                  | 1     | Update eval test, add totals regression                   |
| `apps/api/src/routes/revenue/calculate.ts`                         | 2     | Remove discountPolicies fetch + engine input              |
| `apps/api/src/routes/revenue/calculate.test.ts`                    | 2     | Update mock/expectations                                  |
| `apps/api/src/routes/revenue/discounts.ts`                         | 3     | **DELETE**                                                |
| `apps/api/src/routes/revenue/discounts.test.ts`                    | 3     | **DELETE**                                                |
| `apps/api/src/routes/revenue/index.ts`                             | 3     | Remove discountRoutes import + register                   |
| `apps/api/src/routes/revenue/readiness.ts`                         | 3,4   | Remove discount_policies refs, add enrollment cross-check |
| `apps/api/src/routes/revenue/readiness.test.ts`                    | 3,4   | Update mocks + expectations                               |
| `apps/api/prisma/schema.prisma`                                    | 3,5   | Delete DiscountPolicy model, add scholarship comment      |
| `apps/web/src/hooks/use-revenue.ts`                                | 3     | Delete useDiscounts + usePutDiscounts                     |
| `apps/web/src/components/revenue/discounts-tab.tsx`                | 3     | **DELETE**                                                |
| `apps/web/src/components/revenue/revenue-settings-dialog.tsx`      | 3     | Remove Discounts tab                                      |
| `apps/web/src/components/revenue/revenue-settings-dialog.test.tsx` | 3     | Remove discount tab tests                                 |
| `packages/types/src/revenue.ts`                                    | 3,4   | Remove DiscountEntry, add enrollmentFeeGridAlignment      |

---

## Verification

```bash
# After each phase:
pnpm --filter @budfin/api exec vitest run src/services/revenue-engine.test.ts
pnpm --filter @budfin/api exec vitest run src/services/revenue-reporting.test.ts
pnpm --filter @budfin/api test
pnpm typecheck
pnpm lint

# After Phase 3 (migration):
pnpm --filter @budfin/api exec prisma generate
pnpm --filter @budfin/api exec prisma migrate dev --name remove-discount-policies

# Full suite:
pnpm test
pnpm build
```

### Manual checks after all phases

1. Calculate revenue for a version with `flatDiscountPct = 0.05` (5%)
2. Verify: `grossRevenueHt` = true gross (tuitionHt _ headcount / 10 _ months)
3. Verify: `discountAmount` = grossRevenueHt \* 0.05
4. Verify: `netRevenueHt` = grossRevenueHt - discountAmount
5. Verify: Total Operating Revenue = net tuition + other revenue (no double-subtraction)
6. Verify: Evaluation fees counted once in Registration Fees total
