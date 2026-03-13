---
name: fix:debug
description: >
    Root cause analysis for BudFin errors. Invokes the systematic-debugging skill: reproduce →
    isolate → hypothesize → confirm → fix → verify → regression check. Auto-detects common BudFin
    failure patterns (TC-001, P2025, JWT, ESM/CJS). Usage - /fix:debug "[symptom]"
argument-hint: '"[symptom description]"'
allowed-tools: Bash, Read, Edit, Skill
---

> **Internal command.** Called by `/fix:all` automatically.

Parse the argument:

- `symptom`: description of the error or unexpected behavior in quotes
  Example: `"enrollment POST returns 500"`
  Example: `"pnpm test fails with TypeError in enrollment.test.ts"`
  Example: `"JWT verification fails on authenticated routes"`

If missing, ask the user: "Describe the symptom you're debugging (error message, failing test, unexpected behavior)."

## Step 1 — Invoke Systematic Debugging Skill

Use the Skill tool to invoke: `superpowers:systematic-debugging`

This skill enforces a rigorous RCA process. Follow it exactly — do not skip to a fix
before the root cause is confirmed.

## Step 2 — BudFin-Specific Pattern Detection

While following the debugging skill, auto-check for these common BudFin failure patterns:

### Pattern 1 — TC-001 Violation (Decimal.js/number confusion)

**Symptom signals**: `TypeError: Cannot read property 'plus'`, `NaN`, floating-point result where decimal expected
**Root cause**: Native `number` used where `Decimal` expected, or vice versa
**Check**: `grep -n "const.*= .*+" [file]` — look for `+` operator on monetary vars
**Fix**: Wrap in `new Decimal(x).plus(y)`, ensure API returns `.toFixed(4)` string

### Pattern 2 — Prisma P2025 (record not found)

**Symptom signals**: `PrismaClientKnownRequestError`, `P2025`, 500 on GET/PUT/DELETE
**Root cause**: Record not found in DB — either wrong ID, wrong tenant, or missing seed data
**Check**: Verify the record exists with `prisma.model.findFirst({ where: { id } })`
**Fix**: Add P2025 error handling with 404 response; verify tenant isolation query

### Pattern 3 — JWT Auth Failure

**Symptom signals**: `401 Unauthorized` on protected routes, `JWTInvalid`, `JWTExpired`
**Root cause**: Wrong key, expired token, missing `authenticate` preHandler, wrong preHandler order
**Check**: Verify `preHandler: [fastify.authenticate, fastify.requireRole('...')]` order
**Fix**: Ensure RS256 key loaded, token not expired, preHandler registered correctly

### Pattern 4 — Prisma 6 Buffer/Uint8Array Mismatch

**Symptom signals**: `TypeError: Expected Uint8Array`, `Buffer is not assignable to Uint8Array`
**Root cause**: Prisma 6 `Bytes` fields return `Uint8Array`, not `Buffer`
**Check**: Search for `Buffer.from(` in salary/encryption code
**Fix**: Change type annotation to `Uint8Array`, update any Buffer-specific operations

### Pattern 5 — ESM/CJS Interop Error

**Symptom signals**: `require() of ES Module`, `ERR_REQUIRE_ESM`, `SyntaxError: Cannot use import`
**Root cause**: Module loaded with wrong system — API uses Node16 module resolution
**Check**: Verify `"module": "Node16"` in `apps/api/tsconfig.json`
**Fix**: Add `"type": "module"` to package.json or use `.mjs` extension; check import syntax

### Pattern 6 — Workspace Module Not Found

**Symptom signals**: `Cannot find module '@budfin/types'`, `Module not found: @budfin/api`
**Root cause**: pnpm workspace symlinks broken or package not built
**Check**: `ls node_modules/@budfin/` and `pnpm install`
**Fix**: `pnpm install` from repo root; verify `pnpm-workspace.yaml` includes the package

### Pattern 7 — Vitest Mock Isolation

**Symptom signals**: Tests pass individually but fail in suite, state leaks between tests
**Root cause**: Mock state not reset between tests
**Check**: Look for missing `vi.clearAllMocks()` or `vi.resetAllMocks()` in `beforeEach`
**Fix**: Add `beforeEach(() => { vi.clearAllMocks() })` to the test file

## Step 3 — Systematic Debugging Protocol

Following the `systematic-debugging` skill:

**a. Reproduce** — Run the exact command or test that fails. Document the full error output.

**b. Isolate** — Narrow to the smallest failing unit:

```bash
# For test failures: run single test file
pnpm --filter @budfin/api exec vitest run [specific-test-file]

# For route failures: test with minimal payload
curl -X POST http://localhost:3001/api/v1/[resource] -H "..." -d '{...}'
```

**c. Hypothesize** — List 3 candidate root causes ordered by likelihood (check Pattern list above).

**d. Evidence** — For each hypothesis, gather evidence:

```bash
# Check logs
pnpm dev 2>&1 | grep -E "error|Error|ERROR"

# Check types
pnpm typecheck 2>&1 | grep [filename]

# Check stack trace
# Read the full error output captured in step a
```

**e. Eliminate** — Cross off hypotheses that evidence disproves.

**f. Root Cause** — State the confirmed root cause in one sentence.

**g. Fix** — Apply the minimal targeted fix to the root cause only.

**h. Verify** — Run the exact failing command/test again and confirm it passes.

**i. Regression** — Run full test suite: `pnpm test`

## Step 4 — Output Format

```
## Root Cause Analysis: [symptom]

### Reproduction
Command: [exact command]
Output: [error output]

### Root Cause
[One sentence: confirmed cause with file:line reference]

### Evidence
[Log excerpt, stack trace, or type error that proves the root cause]

### Fix Applied
Files changed:
  [file:line] — [description of change]

### Verification
[Command output confirming the fix]

### Regression Check
pnpm test: [N/N tests passing]
```

## Step 5 — If Root Cause Cannot Be Confirmed

After 3 hypotheses with no confirmation:

```
Root cause not confirmed after 3 hypotheses.

Hypotheses tested:
  1. [Hypothesis] — ELIMINATED (evidence: ...)
  2. [Hypothesis] — ELIMINATED (evidence: ...)
  3. [Hypothesis] — INCONCLUSIVE (needs more information)

To diagnose further, run these commands and share the output:
  [specific diagnostic command 1]
  [specific diagnostic command 2]
```
