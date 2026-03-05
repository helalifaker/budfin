---
name: fix:all
description: >
  Run all BudFin fixers in sequence: lint → types → tests → security → precision. Final
  verification confirms pnpm test && pnpm typecheck both pass. Outputs a summary of issues
  found and fixed by each fixer. Available in any phase.
allowed-tools: Bash, Read, Edit, Agent, Skill
---

Run all BudFin fixers in sequence. Each fixer must complete cleanly before the next starts.

If a specific symptom was passed as an argument, start with `/fix:debug "[symptom]"` first.

## Step 0 — Debug (only if symptom provided)

If an argument was provided (e.g., `"enrollment POST returns 500"`):

Run the `fix:debug` workflow first to identify and fix the root cause before running all fixers.

## Step 1 — Fix Lint

Run the `fix:lint` workflow:

1. `pnpm eslint . --fix`
2. `pnpm prettier --write .`
3. `pnpm markdownlint --fix "**/*.md" --ignore node_modules --ignore .git`
4. Second pass to confirm zero errors
5. Manual fixes for remaining unfixable errors

Record results: `ESLint: N fixed, Prettier: N fixed, Markdown: N fixed`

Must complete with zero remaining errors before proceeding.

## Step 2 — Fix Types

Run the `fix:types` workflow:

1. `pnpm typecheck` — capture all errors
2. Group by category (implicit any, Prisma 6 breaking changes, missing imports, etc.)
3. Apply targeted fixes by category
4. Re-run until `pnpm typecheck` returns zero errors

Record results: `TypeScript: N errors fixed`

Must complete with zero type errors before proceeding.

## Step 3 — Fix Tests

Run the `fix:tests` workflow:

1. `pnpm test` — capture all failures
2. Diagnose each failure type (assertion, import, mock, isolation, infrastructure)
3. Fix implementation (never weaken tests)
4. Re-run until all tests pass
5. `pnpm test --coverage` — confirm ≥ 80% for new files

Record results: `Tests: N failures fixed, coverage: [summary]`

Must complete with all tests passing before proceeding.

## Step 4 — Fix Security

Run the `fix:security` workflow:

1. Use Agent to launch `security-reviewer` on changed files
2. Fix all BLOCKING findings (JWT, RBAC, SQL injection, audit log)
3. Fix all WARNING findings
4. Re-run until `VERDICT: PASS`

Record results: `Security: N blockers fixed, N warnings fixed`

## Step 5 — Fix Precision

Run the `fix:precision` workflow:

1. Use Agent to launch `financial-precision-reviewer` on changed files
2. Fix all BLOCKING violations (TC-001 native arithmetic, JSON serialization, Uint8Array)
3. Fix all WARNING violations (rounding consistency)
4. Re-run until `VERDICT: PASS`
5. `pnpm test` — confirm no regressions from precision fixes

Record results: `Precision: N violations fixed`

## Step 6 — Final Verification

```bash
pnpm test && pnpm typecheck && echo "ALL CLEAN"
```

Must show ALL CLEAN before this command is complete.

If any failure:
- Do not report as complete
- Re-run the specific fixer for the failing area
- Repeat until ALL CLEAN

## Step 7 — Summary Report

Output:
```
/fix:all complete.

┌─────────────┬──────────────────────────────────┐
│ Fixer       │ Result                           │
├─────────────┼──────────────────────────────────┤
│ /fix:lint   │ N issues fixed, 0 remaining      │
│ /fix:types  │ N errors fixed, 0 remaining      │
│ /fix:tests  │ N failures fixed, N/N passing    │
│ /fix:security│ N blockers, N warnings fixed    │
│ /fix:precision│ N violations fixed             │
└─────────────┴──────────────────────────────────┘

Final: pnpm test — ALL PASSING
       pnpm typecheck — CLEAN

Status: READY FOR REVIEW
```
