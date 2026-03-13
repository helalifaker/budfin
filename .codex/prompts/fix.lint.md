---
name: fix:lint
description: >
    Fix all ESLint, Prettier, and markdownlint errors in the BudFin project. Verifies first — if
    already clean, exits immediately. Only runs auto-fixers if Step 1 finds issues. Final run
    confirms zero errors across all linters. Available in any phase.
allowed-tools: Bash, Read, Edit
---

> **Internal command.** Called by `/fix:all` automatically.

Fix all linting errors across the BudFin monorepo. Verify first — only fix if dirty.

## Step 1 — Verify (read-only, no mutations)

```bash
pnpm lint:all 2>&1
```

- If exits 0 → print "All linters: CLEAN" and **stop here**.
- If fails → report what was found and proceed to Step 2.

## Step 2 — Auto-Fix (only reached if Step 1 found issues)

```bash
pnpm eslint . --fix 2>&1 | tee /tmp/eslint-output.txt
pnpm prettier --write . 2>&1 | tee /tmp/prettier-output.txt
pnpm markdownlint --fix "**/*.md" --ignore node_modules --ignore .git 2>&1 | tee /tmp/markdown-output.txt
```

## Step 3 — Re-Verify (confirm zero remaining after auto-fix)

```bash
pnpm lint:all 2>&1
```

If this fails, proceed to Step 4 for manual fixes.

## Step 4 — Manual Fix for Unfixable Residual Errors

**ESLint 9 flat config (eslint.config.ts)**:

- Rule `@typescript-eslint/no-explicit-any`: Replace `any` with proper type or `unknown`
- Rule `@typescript-eslint/no-unused-vars`: Remove unused variable or prefix with `_`
- Rule `import/no-unresolved`: Fix import path — check `@budfin/*` workspace aliases
- Rule `no-console`: Replace `console.log` with `fastify.log` or remove

**Prettier**:

- Any remaining formatting issues: manually apply the file and re-run `pnpm prettier --write [file]`

**Markdownlint**:

- MD040 (fenced code block missing language): Add language identifier after opening ```
- MD032 (list surrounded by blank lines): Add blank line before and after list
- MD022 (heading surrounded by blank lines): Add blank line before and after heading
- Do NOT auto-fix `.markdownlintignore`d files (check `docs/edge-cases/` — pre-existing issues)

## Step 5 — Summary

If Step 1 passed:

```
All linters: CLEAN
```

If fixes were needed:

```
Lint fix complete.

ESLint:      [N] auto-fixed, [N] manual-fixed, 0 remaining
Prettier:    [N] files reformatted, 0 remaining
Markdownlint:[N] auto-fixed, [N] manual-fixed, 0 remaining

All linters: CLEAN
```

## Pre-Existing Issues (Do Not Touch)

The following are pre-existing lint issues that are intentionally not fixed:

- `CLAUDE.md:5` — MD040 (pre-existing, tracked separately)
- `docs/edge-cases/` files — MD032/MD022 errors (pre-existing, do not modify)
- `docs/tdd/04_api_contract.md:1751` — pre-existing MD032

If asked to fix these, explain they are pre-existing and excluded from auto-fix.
