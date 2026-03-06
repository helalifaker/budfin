---
name: ci:check
description: >
  Check CI status for a story PR, diagnose failures, and auto-fix. Maps each
  failing CI job to the appropriate fix command and runs them.
  Usage - /ci:check [story-issue-number]
argument-hint: '[story-issue-number]'
allowed-tools: Bash, Read, Edit, Agent, Skill
---

Parse the argument:

- `story-issue-number`: GitHub issue number of the story whose PR to check

If missing, ask the user: "Which story issue number should I check CI for?"

## Step 1 -- Find PR

```bash
gh pr list --search "Fixes #$STORY_NUMBER" --json number,url,headRefName,isDraft --state open
```

If no PR found:
```
No open PR found for story #$STORY_NUMBER.
Run /impl:commit [$STORY_NUMBER] to create one first.
```
Stop.

## Step 2 -- Check Status

```bash
gh pr checks $PR_NUMBER
```

## Step 3 -- If All Green

```
CI green on PR #$PR_NUMBER.
All checks passed. Ready for review.

Next: /review:run [$STORY_NUMBER]
```
Stop.

## Step 4 -- Diagnose and Auto-Fix Failures

For each failing CI job, map to fix action and execute:

| CI Job | Fix Action |
|--------|-----------|
| lint | Run `pnpm eslint . --fix && pnpm prettier --write .` |
| typecheck | Run `pnpm typecheck` to see errors, then apply targeted fixes |
| test | Run `pnpm test` to see failures, diagnose each, fix implementation (never weaken tests) |
| format | Run `pnpm prettier --write .` |
| lint-md | Run `pnpm markdownlint --fix "**/*.md"` |
| audit | Run `pnpm audit --fix` then manually review any remaining advisories |
| build | Run all above first (build depends on all others), then `pnpm build` |

Execute fixes in this order (each may resolve downstream failures):
1. format (fastest)
2. lint
3. lint-md
4. typecheck
5. test
6. audit
7. build (only if explicitly failing)

## Step 5 -- Commit and Push Fixes

After all fixes applied:

```bash
git add -A && git commit -m "fix(ci): resolve CI failures for story #$STORY_NUMBER" && git push
```

## Step 6 -- Re-Check

```bash
gh pr checks $PR_NUMBER --watch
```

## Step 7 -- Report

### If all green after fixes:
```
CI fixed and green on PR #$PR_NUMBER.

Fixes applied:
  - [list of fix actions taken]

Next: /review:run [$STORY_NUMBER]
```

### If still failing:
```
CI still failing on PR #$PR_NUMBER after auto-fix.

Remaining failures:
  [job]: [error summary]

These failures require manual investigation.
Run /fix:debug "[failing job] error" for root cause analysis.
```

## Error Handling

If `gh` is not authenticated:
- Display the error
- Guide the user to run `gh auth login`
- Stop

If the PR branch cannot be checked out locally:
```
Cannot check out branch for PR #$PR_NUMBER.
Run: git fetch origin && git checkout [branch-name]
```
