---
name: fix:tests
description: >
  Fix all failing Vitest tests in the BudFin monorepo. Diagnoses each failure, fixes
  implementation (never weakens tests), and confirms ≥80% coverage maintained. Repeats until
  all tests pass. Available in any phase.
allowed-tools: Bash, Read, Edit
---

> **Internal command.** Called by `/fix:all` automatically.

Fix all failing Vitest tests. Fix implementation code to match what tests expect — never modify
tests to pass (weakening tests is not allowed).

## Step 1 — Run All Tests and Capture Failures

```bash
pnpm test 2>&1 | tee /tmp/test-output.txt
```

Count failing tests. If zero failures — run coverage check and stop:
```bash
pnpm test --coverage 2>&1 | grep -E "Coverage|Uncovered"
```

## Step 2 — For Each Failing Test, Diagnose the Failure Type

Read the test output and the failing test file. Categorize each failure:

**Type A — Assertion failure (wrong value returned)**
- The implementation returns a different value than expected
- Fix: update the implementation to return the correct value
- Do NOT change the expected value in the test

**Type B — Missing or wrong import**
- `Cannot find module '...'`
- `Module '"..."' has no exported member '...'`
- Fix: correct the import path or add the missing export

**Type C — Mock setup error**
- `mockFn is not a function`
- `Cannot read property '...' of undefined` in setup code
- Fix: correct the mock configuration in `beforeEach`/`vi.mock`

**Type D — Test isolation failure**
- State from one test leaks into another
- Tests pass individually but fail when run together
- Fix: add proper teardown in `afterEach`, ensure `beforeEach` resets all mocks

**Type E — Database/network error**
- `Cannot connect to database` in integration tests
- Fix: check test database configuration, ensure test uses in-memory or mocked DB

**Type F — TypeScript error in test file**
- Fix: resolve type error (see /fix:types logic) — this is a test infrastructure issue

## Step 3 — Apply Fixes (Implementation Only)

For each failure:

1. Read the failing test to understand what behavior is expected
2. Read the implementation file being tested
3. Apply the minimal fix to the implementation to satisfy the test
4. NEVER modify the test expectation to match wrong implementation behavior

Critical rule: if a test expects `total = "1234.5000"` and the implementation returns
`total = 1234.5`, fix the implementation to return a string — do not change the test.

## Step 4 — Financial Test Patterns

For Decimal.js-related test failures:
```typescript
// Tests use string comparison for monetary values — this is correct
expect(result.total).toBe('1234.5000')  // string from .toFixed(4)

// NOT: expect(result.total).toBe(1234.5)  — numbers lose precision
```

For Prisma 6 mock failures with Uint8Array:
```typescript
// Mock must use Uint8Array, not Buffer
vi.mocked(prisma.staff.findFirst).mockResolvedValue({
  baseSalaryEncrypted: new Uint8Array([...]),  // Prisma 6
})
```

## Step 5 — Re-Run After Each Fix Batch

After fixing each category:
```bash
pnpm test 2>&1 | grep -E "FAIL|PASS|Tests:"
```

Continue until all tests pass.

## Step 6 — Coverage Check

After all tests pass, verify coverage is maintained:
```bash
pnpm test --coverage 2>&1 | tee /tmp/coverage-output.txt
```

For any NEW file with coverage below 80%, flag it:
```
Coverage gap: apps/api/src/routes/enrollment/post.ts — 62% (below 80% threshold)
```

Do not add trivial tests to inflate coverage. Instead, identify which meaningful paths are
not tested and suggest the appropriate test cases.

## Step 7 — Final Verification

```bash
pnpm test && echo "Tests: ALL PASSING"
```

## Step 8 — Summary

Output:
```
Test fix complete.

Failures fixed:
  Type A (assertion failures): N
  Type B (import errors): N
  Type C (mock setup errors): N
  Type D (isolation failures): N
  Type E (infrastructure errors): N

Tests: N/N passing
Coverage: [list any files below 80%]

All tests: PASSING
```
