# BudFin Functional Audit Report

**Date:** 2026-03-10
**Auditor:** Claude Sonnet 4.6 (browser + code + DB inspection)
**Scope:** Full planning pipeline — Enrollment → Revenue → P&L — against Excel reference dataset
**Versions tested:** Migration FY2026 (v14, Draft, IMPORTED) · Actual FY2026 (v19, Locked, IMPORTED)

---

## Executive Summary

The application cannot produce revenue or P&L output at all. One architectural decision — setting `data_source = 'IMPORTED'` on the migrated budget version — blocks every calculation. All underlying data is correctly migrated into the database (214/270/3/21 rows match expectations), so fixing this single blocker will ungate the calculation pipeline. A second structural issue (zero term-amount splits in the fee grid) will then surface as incorrect monthly distribution. Three further UI/routing bugs and one data quality gap complete the list of issues.

**Revenue calculation result vs Excel target:** Cannot be compared — calculation blocked.
**Expected annual total revenue (Excel):** SAR 68,506,365
**Expected net profit (Excel):** SAR 167,581

---

## Findings

### F-001 — CRITICAL BLOCKER: Revenue Calculation Refused on Imported Version

**Layer:** API / Business Logic
**File:** `apps/api/src/routes/revenue/calculate.ts:44-49`

```typescript
if (version.dataSource === 'IMPORTED') {
    return reply.status(409).send({
        code: 'IMPORTED_VERSION',
        message: 'Cannot calculate on imported versions',
    });
}
```

**What happens:** Clicking "Calculate Revenue" on "Migration FY2026 (Draft)" triggers a POST to the revenue calculate endpoint. The API returns 409 because `budget_versions.data_source = 'IMPORTED'` for version 14. The frontend catches the error and shows: _"Calculation failed. Ensure fee grid and enrollment data are configured."_

**Why this is wrong:** The guard was intended to protect locked actual-data versions from being overwritten. "Migration FY2026" is the primary planning/budget version — all revenue inputs (fee grid, discounts, enrollment detail, other revenue) were migrated into it specifically so it could be calculated. The restriction is too broad: it prevents the one version that has all the inputs from ever running.

**DB confirmation:**

```
id=14  name="Migration FY2026"  status=Draft  data_source=IMPORTED
  enrollment_detail=214  fee_grids=270  discount_policies=3  other_revenue_items=21
```

**Fix (two options — choose one):**

1. In `importers/budget-versions.ts`, set `dataSource: 'MANUAL'` (or `'CALCULATED'`) for the "Migration FY2026" version instead of `'IMPORTED'`. Re-run migration.
2. Alternatively, update the API guard to allow Draft versions regardless of dataSource — only block Locked IMPORTED versions:
    ```typescript
    if (version.dataSource === 'IMPORTED' && version.status === 'Locked') { ... }
    ```

---

### F-002 — CRITICAL: Fee Grid Term Splits Are All Zero — Monthly Revenue Will Be Zero

**Layer:** Data Migration / Revenue Engine
**File:** `apps/api/src/migration/importers/revenue.ts:103-140`
**DB column:** `fee_grids.term1_amount`, `fee_grids.term2_amount`, `fee_grids.term3_amount` — all default `0`

**What happens:** The revenue engine distributes annual tuition across months using term splits. All 270 fee grid rows have `term1_amount = term2_amount = term3_amount = 0.0000`. This is confirmed visually in the UI (TERM 1 / TERM 2 / TERM 3 columns show 0.0000 for every row) and structurally: the `importRevenue` importer does not read or write term amounts from the fixture.

**Impact:** Even after fixing F-001, the revenue engine will not know how to split tuition by month/term. Every monthly tuition line will resolve to SAR 0. The expected monthly breakdown (e.g. SAR 5,820,906 tuition in Jan per the consolidated fixture) cannot be reproduced.

**Root cause:** `fy2026-fee-grid.json` does not include term split data, and the importer has no mapping for those columns. The fee grid fixture needs three additional fields per row (`term1Amount`, `term2Amount`, `term3Amount`) derived from the Excel workbook.

**Fix:**

1. Extract term-split data from `data/budgets/01_EFIR_Revenue_FY2026_v3.xlsx` for each grade/period.
2. Add the three fields to `fy2026-fee-grid.json`.
3. Update `importers/revenue.ts` lines 120-125 and 132-137 to read and write `term1Amount`, `term2Amount`, `term3Amount`.
4. Re-run migration.

---

### F-003 — HIGH: AY2 Headcounts Zero for College and Lycée (Both Versions)

**Layer:** Enrollment / Data
**Page:** Enrollment & Capacity → Cohort Progression

**What happens:** All College grades (Sixième, Cinquième, Quatrième, Troisième) and all Lycée grades (Seconde, Première, Terminale) show AY2 TOT = 0 in both versions. The Ret% and Lat.Ent columns are empty for these grades. This means approximately 520 students (out of 1,753 AY1 total) have no AY2 counterpart.

**Version 14 details:**

```
Sixième   AY1=131, Ret%=—, AY2=0
Cinquième AY1=134, Ret%=—, AY2=0
...
Seconde   AY1=125, Ret%=—, AY2=0
Première  AY1=120, Ret%=—, AY2=0
Terminale AY1=78,  Ret%=—, AY2=0
```

**Version 19 (Actual FY2026) same pattern:**

```
Sixième   AY1=128, AY2=0 ... Terminale AY1=115, AY2=0
```

**Impact:** Total AY2 for version 14 = 1,665 (only Maternelle + Elementaire contribute). The fee grid and enrollment_detail DO have AY2 entries for these grades (97 AY2 rows in enrollment_detail), so the revenue engine will compute AY2 revenue correctly from enrollment_detail. However, the Enrollment UI is misleading — it shows zero when data exists in enrollment_detail.

**Likely cause:** The cohort_parameters table (retention rates) has no entries for College/Lycée grades. The AY2 HDC column in the UI is derived from `cohort_parameters.retentionRate × AY1 + lateralEntry`, but for College/Lycée those parameters are null.

**Fix:** Populate cohort_parameters for College and Lycée grades. Alternatively, if AY2 for those grades is driven directly by enrollment_detail (not cohort progression), the UI should read from enrollment_detail instead of cohort_parameters for those grades.

---

### F-004 — HIGH: Nationality Distribution Shows All Zeros (UI Table vs DB Table Mismatch)

**Layer:** Enrollment UI / Data model
**Page:** Enrollment & Capacity → Nationality Distribution section

**What happens:** The Nationality Distribution grid shows FRANCAIS CNT = 0, NATIONAUX CNT = 0, AUTRES CNT = 0 for every grade in both versions.

**DB check:**

```sql
SELECT COUNT(*) FROM nationality_breakdown WHERE version_id = 14;  -- returns 0
SELECT COUNT(*) FROM enrollment_detail WHERE version_id = 14;       -- returns 214
```

**Root cause:** The Nationality Distribution UI reads from the `nationality_breakdown` table, which has 0 rows for version 14. The migration populates `enrollment_detail` (214 rows with full FR/NAT/AUT × PLEIN/RP/R3P breakdowns) but does NOT populate `nationality_breakdown`.

**Note:** The Revenue Engine reads from `enrollment_detail` directly (not `nationality_breakdown`), so this does NOT block revenue calculation. However, the Enrollment page is showing misleading zeros, and any feature that relies on `nationality_breakdown` will also be broken.

**Fix:** Either (a) the migration should also populate `nationality_breakdown` by aggregating enrollment_detail by grade+nationality, or (b) the Nationality Distribution UI should query enrollment_detail instead of nationality_breakdown and derive the weighted percentages dynamically.

---

### F-005 — HIGH: URL Version Parameter Ignored by Application State

**Layer:** Frontend / Routing
**Pages:** Revenue, Enrollment, P&L

**What happens:** Navigating directly to `http://localhost:3000/planning/revenue?fy=2026&version=14` loads version 19 ("Actual FY2026") instead of version 14, whenever the app's Zustand store already has version 19 selected. The URL `?version=` param is only respected on a cold page load; subsequent navigations within the same session ignore it.

**Evidence:**

- Tab opened at `?version=14` → shows "Migration FY2026 (Draft)" ✓
- From that tab, navigate to `revenue?fy=2026&version=14` → shows "Actual FY2026 (Locked)" ✗
- Selecting "Migration FY2026" via the version dropdown → URL updates to `?version=14` ✓

**Impact:** Shareable deep-links for specific versions do not work. Cross-page navigation within the app loses the intended version context. Users who bookmark a specific version URL may see a different version.

**Root cause:** The planning context store (Zustand) initialises `versionId` from the URL on mount but does not react to URL changes (no `useEffect` or router listener re-syncing the store when `searchParams` changes).

**Fix:** Add a `useEffect` in the planning context provider that watches `searchParams.get('version')` and updates the Zustand store when it changes:

```typescript
useEffect(() => {
    const v = searchParams.get('version');
    if (v && Number(v) !== versionId) setVersionId(Number(v));
}, [searchParams]);
```

---

### F-006 — MEDIUM: RP Discount Policy Exists in DB but Not Rendered in UI

**Layer:** Frontend / Revenue
**Page:** Revenue → Discounts section

**What happens:** The DB has 3 discount policies for version 14 (PLEIN 0%, RP 25%, R3P 10%). The UI discount matrix only renders 2 rows (PLEIN and R3P). RP is invisible.

**DB confirmation:**

```
tariff | nationality | discount_rate
-------+-------------+--------------
PLEIN  |             | 0.000000
R3P    |             | 0.100000
RP     |             | 0.250000
```

**Likely cause:** The frontend may be sorting or deduplicating discount policies in a way that drops RP, or there is a filter that excludes it (e.g. checking tariff against a hardcoded list that is missing 'RP'). Alternatively, there is a rendering bug in the discount matrix table component.

**Secondary cause — migration importer inconsistency:** In `importers/revenue.ts:149-152`, the upsert WHERE clause uses `nationality: d.nationality ?? ''` while the CREATE block uses `nationality: d.nationality` (the raw null). This means on first run, the WHERE finds no '' record → creates a null-nationality record; on re-run, the WHERE again finds no '' → attempts another insert. For version 14 the RP policy was stored as nationality='' (empty string) confirming the ?? '' coercion also applied to CREATE (likely Prisma/Postgres coercion of null varchar to ''). Fix the importer to be consistent.

**Fix:**

1. Audit the discount matrix React component for filtering logic on tariff or nationality.
2. In `importers/revenue.ts`, make the upsert consistent: use `nationality: d.nationality ?? null` in both WHERE and CREATE (Prisma handles nullable unique index correctly with explicit null).

---

### F-007 — MEDIUM: P&L Page Shows Empty State — Not a Bug, Consequence of F-001

**Layer:** Frontend / P&L
**Page:** `/planning/pnl`

**What happens:** P&L page renders an empty state with "P&L Reporting / Profit & loss statements and financial reporting" and no financial data.

**Root cause:** P&L data depends on revenue being calculated first. Since F-001 prevents any revenue calculation, P&L has no data to display. This is expected behaviour given the upstream blocker.

**Action:** Resolve F-001 and F-002 first. Re-test P&L after revenue calculates successfully. If P&L remains empty after successful revenue calculation, investigate separately.

---

### F-008 — LOW: `fy2026-expected-revenue.json` Fixture Data Appears Malformed

**Layer:** Data / Test Fixtures
**File:** `data/fixtures/fy2026-expected-revenue.json`

**What happens:** The fixture has structurally inconsistent data:

- Month 1: `tuitionFees = "56638541.0217"` (appears to be the annual total, not a monthly figure)
- Month 2: `tuitionFees = "0.8310"` (appears to be a ratio/percentage, not SAR)
- Months 3–6, 9, 11: `tuitionFees = "0.0000"`
- Month 8 onwards: mixed pattern with non-zero `registrationFees`

This does not match the expected monthly pattern from `fy2026-expected-consolidated.json` (which shows consistent monthly tuition of SAR 5,820,906 for Jan–Dec except Jul/Aug).

**Impact:** This fixture cannot be used as a reliable test oracle for revenue validation. The validation suite (`runValidationSuite`) uses revenue totals for cross-checking and may produce false passes or false failures.

**Fix:** Regenerate `fy2026-expected-revenue.json` from the authoritative Excel workbook (`01_EFIR_Revenue_FY2026_v3.xlsx`) with correct monthly SAR values per line item.

---

### F-009 — LOW: Actual FY2026 (v19) Has No Revenue Inputs — Structurally Incomplete

**Layer:** Data / Architecture
**Version:** Actual FY2026 (id=19, Locked, IMPORTED)

**What happens:** Version 19 has enrollment headcounts (from historical CSVs) but zero fee grids, discounts, other revenue items, and enrollment_detail rows. It is locked, so calculation is also blocked. This version can never produce revenue or P&L output.

**Design question:** The "Actual FY2026" locked version appears to serve as a historical enrollment reference only. If downstream features (comparison views, P&L actuals) expect revenue data from this version, they will always show zeros. This should be explicitly documented or the version should be populated with actuals post-close.

**Action:** Confirm with stakeholders whether "Actual FY2026" is meant to be an enrollment-only snapshot or a full P&L actuals version. Update the version's purpose in the UI/docs accordingly.

---

## Summary Table

| ID    | Severity | Category           | Title                                            | Blocks Calculation |
| ----- | -------- | ------------------ | ------------------------------------------------ | ------------------ |
| F-001 | CRITICAL | API / Architecture | Revenue calculation blocked by IMPORTED flag     | YES                |
| F-002 | CRITICAL | Data Migration     | Fee grid term splits all zero                    | YES (monthly data) |
| F-003 | HIGH     | Data / Enrollment  | AY2 = 0 for College and Lycée grades             | Partial            |
| F-004 | HIGH     | Data / UI          | Nationality distribution all zeros (wrong table) | NO (misleading)    |
| F-005 | HIGH     | Frontend / Routing | URL version param ignored by Zustand state       | NO (UX broken)     |
| F-006 | MEDIUM   | Frontend / Data    | RP discount not rendered in UI (exists in DB)    | NO                 |
| F-007 | MEDIUM   | Frontend / P&L     | P&L empty (consequence of F-001)                 | N/A                |
| F-008 | LOW      | Data / Fixtures    | fy2026-expected-revenue.json malformed           | NO (test only)     |
| F-009 | LOW      | Architecture       | Actual FY2026 structurally incomplete            | N/A                |

---

## Recommended Fix Order

1. **F-001** — Change `dataSource` for "Migration FY2026" from `IMPORTED` to `MANUAL` in the budget-versions importer (or update the API guard). This is a one-line fix that unblocks everything.
2. **F-002** — Extract term splits from the Excel workbook, update `fy2026-fee-grid.json`, update the importer to write `term1_amount`/`term2_amount`/`term3_amount`. Re-run migration. Required for correct monthly revenue distribution.
3. **F-005** — Fix Zustand URL sync so deep-links to specific versions work.
4. **F-006** — Fix RP discount rendering in the discount matrix component.
5. **F-004** — Populate `nationality_breakdown` from `enrollment_detail` during migration, or redirect the UI query.
6. **F-003** — Populate cohort_parameters for College/Lycée retention rates.
7. **F-008** — Regenerate the expected-revenue fixture from the authoritative Excel.
8. **F-009** — Stakeholder decision; no code change required immediately.

---

## Console / Network Observations

- **No JavaScript errors** logged to the browser console on any page load (Vite dev server messages only).
- **Revenue calculation error** is a 409 HTTP response from the API, caught by TanStack Query's `onError` handler and displayed as a toast/banner. It does NOT appear in the browser console — error handling is correct.
- **No uncaught exceptions** observed across Enrollment, Revenue, and P&L pages.

---

## Data Comparison: App vs Excel (Blocked)

The revenue calculation cannot run due to F-001. Once F-001 and F-002 are resolved, the following reconciliation is required against `fy2026-expected-consolidated.json`:

| Metric                | Excel Target (SAR) | App Output | Delta |
| --------------------- | ------------------ | ---------- | ----- |
| Annual Total Revenue  | 68,506,365         | N/A        | N/A   |
| Jan Tuition Fees      | 5,820,906.53       | N/A        | N/A   |
| Jun Registration Fees | 7,620,291.00       | N/A        | N/A   |
| Sep Registration Fees | 942,250.00         | N/A        | N/A   |
| Annual Net Profit     | 167,581.31         | N/A        | N/A   |

This table must be completed after F-001 + F-002 are fixed and "Calculate Revenue" succeeds.
