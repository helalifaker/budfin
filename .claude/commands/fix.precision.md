---
name: fix:precision
description: >
  Fix financial precision violations in BudFin. Launches financial-precision-reviewer agent on
  changed files, fixes all BLOCKING violations (TC-001 Decimal.js, monetary string serialization,
  Uint8Array salary fields), then re-runs to confirm PASS. Available in any phase.
allowed-tools: Bash, Read, Edit, Agent, Skill
---

Fix all financial precision violations in recently changed files. Launch
financial-precision-reviewer agent, fix every BLOCKING violation, and confirm PASS.

## Step 1 — Invoke Skill

Use the Skill tool to invoke: `budfin-workflow`

This confirms phase and loads TC-001 through TC-005 constraints.

## Step 2 — Identify Changed Files

```bash
git diff --name-only HEAD
git diff --name-only --cached
```

Focus on files containing monetary arithmetic, salary handling, or calculation engine code.
If a specific path was provided as an argument, use that instead.

## Step 3 — Launch Financial Precision Reviewer Agent

Use the Agent tool to launch `financial-precision-reviewer` with:
- The list of changed files (prioritize `apps/api/src/engines/`, `apps/api/src/routes/`,
  `apps/api/src/services/`)
- Instruction to focus on TC-001 through TC-004 compliance

Wait for the agent to return its full report with BLOCKING / WARNING findings.

## Step 4 — Fix Every BLOCKING Violation

### TC-001 — Native arithmetic on monetary values

```typescript
// BLOCKING: any +, -, *, / on monetary values without Decimal.js
const total = baseSalary + housing + transport   // WRONG

// FIX:
import Decimal from 'decimal.js'
const total = new Decimal(baseSalary)
  .plus(new Decimal(housing))
  .plus(new Decimal(transport))
  .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
```

Also fix:
- `parseFloat()` or `Number()` on monetary strings before arithmetic
- `Math.round()`, `Math.floor()`, `Math.ceil()` on monetary values
- `a * b` where either is a currency amount

### TC-001 — Monetary JSON serialization

```typescript
// BLOCKING: returning number or Decimal object in API response
return { total: calculatedTotal }         // WRONG (Decimal object)
return { total: Number(calculatedTotal) } // WRONG (number loses precision)

// FIX: always serialize as string
return { total: calculatedTotal.toFixed(4) }  // "1234.5000" — correct
```

### Prisma 6 Uint8Array salary fields

```typescript
// BLOCKING: treating Bytes field as Buffer
const key: Buffer = employee.baseSalaryEncrypted  // WRONG

// FIX: Bytes fields are Uint8Array in Prisma 6
const key: Uint8Array = employee.baseSalaryEncrypted  // CORRECT
```

### TC-004 — Accumulation errors (round too early)

```typescript
// BLOCKING: rounding each row before summing
const total = rows.map(r => parseFloat(r.salary).toFixed(4)).reduce(...)  // WRONG

// FIX: accumulate full precision, round once at end
const total = rows
  .reduce((acc, r) => acc.plus(new Decimal(r.salary)), new Decimal(0))
  .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
```

## Step 5 — Fix Every WARNING

For each WARNING (rounding mode consistency, mixed rounding strategies):
- Standardize all rounding to `Decimal.ROUND_HALF_UP`
- Use `toDecimalPlaces(4, Decimal.ROUND_HALF_UP)` throughout

## Step 6 — Re-Run Precision Review

Use the Agent tool to re-launch `financial-precision-reviewer` on the same files.

If any BLOCKING findings remain, go back to Step 4.
Continue until the agent reports `VERDICT: PASS`.

## Step 7 — Run Tests

```bash
pnpm test 2>&1 | tail -20
```

Confirm no regressions from the precision fixes.

If any tests fail after the fix:
- The precision fix likely corrected behavior that a test was asserting incorrectly
- Read the failing test carefully before deciding whether to update the test
- If the test was asserting a wrong value (e.g., a floating-point result instead of Decimal),
  update the test to assert the correct value

## Step 8 — Output

```
Precision fix complete.

Violations resolved:
  TC-001 (native arithmetic): N
  TC-001 (JSON serialization): N
  Uint8Array salary fields: N
  TC-004 (accumulation errors): N
  Warnings (rounding): N

Financial precision review: PASS
Tests: all passing
```
