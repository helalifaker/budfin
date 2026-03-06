---
name: calculation-engine
description: Financial calculation patterns for BudFin. Use when writing or reviewing calculation engine code, Revenue/DHG/StaffCost/P&L engines, YEARFRAC computation, salary calculations, or any code that performs arithmetic on monetary values. Enforces TC-001 through TC-005 financial precision requirements.
invocations:
  - agent: calculation-engine
---

# BudFin Calculation Engine Patterns

## TC-001 — Decimal.js for ALL Monetary Operations (MANDATORY)

**This rule has ZERO exceptions.**

```typescript
// CORRECT — always use Decimal.js
import { Decimal } from 'decimal.js';
const result = new Decimal(a).plus(b).times(c);

// FORBIDDEN — native arithmetic on monetary values
const result = a + b; // VIOLATION
const result = a * b; // VIOLATION
const result = (a + b) * c; // VIOLATION
```

ESLint `no-restricted-syntax` enforces this at the linter level. Any linter violation must be fixed before commit — never disable this rule.

**When does this apply?** Any value that represents a monetary amount (SAR, amounts, costs, revenues, salaries). Index values, counts, and IDs are excluded.

## TC-002 — YEARFRAC: US 30/360 Algorithm

- Use the US 30/360 day-count convention — exact match to Excel's `YEARFRAC(date1, date2, 0)`
- Validated against 168 employee records in the reference dataset
- Do NOT use actual/actual (365) or actual/360 — Excel uses 30/360
- Implementation must be a pure function with no side effects

```typescript
function yearFrac(startDate: Date, endDate: Date): Decimal {
    // US 30/360: each month treated as 30 days, year = 360 days
    // Must match Excel YEARFRAC(start, end, 0) exactly
}
```

## TC-003 — Database Precision

| Field type          | Prisma type | PostgreSQL precision |
| ------------------- | ----------- | -------------------- |
| Monetary amounts    | `Decimal`   | `DECIMAL(15,4)`      |
| Rates (multipliers) | `Decimal`   | `DECIMAL(7,6)`       |
| Percentages         | `Decimal`   | `DECIMAL(5,4)`       |
| Years / fractions   | `Decimal`   | `DECIMAL(7,4)`       |

Never use `Float` or `Double` for financial data — only `Decimal`.

## TC-004 — Round Only at Presentation Layer

- Rounding happens ONLY when displaying values to the user
- Method: `ROUND_HALF_UP` (banker's rounding is NOT used)
- Display format: SAR with 2 decimal places → `value.toFixed(2)`
- Never round intermediate calculation values — carry full precision throughout

```typescript
// In a React component (TC-004 compliant)
import { Decimal } from 'decimal.js';
const display = new Decimal(amount).toFixed(2); // display only
```

## TC-005 — Arabia Standard Time (UTC+3)

- All date arithmetic uses Arabia Standard Time (AST, UTC+3)
- Use `@date-fns/tz` with `'Asia/Riyadh'` timezone
- Never use `new Date()` directly for calculation dates — always resolve to AST first
- Fiscal year boundaries, enrollment dates, salary periods — all must be in AST

```typescript
import { toZonedTime } from '@date-fns/tz';
const riyadhDate = toZonedTime(new Date(), 'Asia/Riyadh');
```

## ADR-002 — All Calculations Server-Side

- ZERO arithmetic on monetary values in the browser
- Browser receives pre-computed values as strings (TC-001 precision preserved)
- React components display values only — never compute them

## ADR-004 — Explicit Calculate Button

- No auto-recalculation on input change
- User must explicitly click "Calculate" (or equivalent) to trigger engine
- This prevents accidental partial-state calculations

## Pure Function Pattern

Engine functions must be pure (no side effects):

```typescript
// Input: domain objects loaded from Prisma
// Output: result arrays ready for createMany()
function calculateStaffCost(
    staff: StaffRecord[],
    fiscalYear: FiscalYear,
    rateCard: RateCard
): StaffCostResult[] {
    // Pure computation using Decimal.js throughout
    // No DB calls, no logging, no mutations
}
```

## Caller Pattern (Always Follow)

```typescript
// 1. Load inputs from Prisma
const [staff, rateCard, fiscalYear] = await Promise.all([...])

// 2. Call pure engine function
const results = calculateStaffCost(staff, fiscalYear, rateCard)

// 3. Write outputs in a single transaction
await prisma.$transaction([
  prisma.staffCostResult.createMany({ data: results }),
  prisma.calculationAuditLog.create({ data: auditEntry }),
])
```

## Performance Constraint

- Calculation must complete in < 3 seconds (NFR 11.1)
- No per-row DB roundtrips — load all inputs upfront, write all outputs in one `createMany()`
- Never query DB inside a calculation loop

## Audit Log Requirement

Every calculation run MUST create a `calculation_audit_log` entry containing:

- Which engine ran
- Input parameters (version ID, fiscal year, run timestamp)
- Who triggered it (userId)
- Result summary (rows computed, total amounts)
