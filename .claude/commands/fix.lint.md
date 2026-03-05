---
name: fix:lint
description: >
  Fix all ESLint, Prettier, and markdownlint errors in the BudFin project. Runs auto-fixers
  first, then applies targeted manual fixes for any remaining errors. Final run confirms zero
  errors across all linters. Available in any phase.
allowed-tools: Bash, Read, Edit
---

Fix all linting errors across the BudFin monorepo. Always run to completion — do not stop
until all three linters report zero errors.

## Step 1 — Run Auto-Fixers (First Pass)

```bash
pnpm eslint . --fix 2>&1 | tee /tmp/eslint-output.txt
pnpm prettier --write . 2>&1 | tee /tmp/prettier-output.txt
pnpm markdownlint --fix "**/*.md" --ignore node_modules --ignore .git 2>&1 | tee /tmp/markdown-output.txt
```

## Step 2 — Run Again to Catch Remaining Errors

Auto-fixers sometimes miss errors that become fixable after the first pass:

```bash
pnpm eslint . 2>&1 | tee /tmp/eslint-remaining.txt
pnpm markdownlint "**/*.md" --ignore node_modules --ignore .git 2>&1 | tee /tmp/markdown-remaining.txt
```

## Step 3 — Manual Fix for Remaining Errors

For each remaining unfixable error, read the file and apply a targeted fix:

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

## Step 4 — Final Verification Run

```bash
pnpm eslint . && echo "ESLint: CLEAN"
pnpm prettier --check . && echo "Prettier: CLEAN"
pnpm markdownlint "**/*.md" --ignore node_modules --ignore .git && echo "Markdown: CLEAN"
```

All three must show their CLEAN message before this command is complete.

## Step 5 — Summary

Output:
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
