---
name: impl-commit
description: >
    Use when committing story changes and opening a draft PR (COMMIT mode) or merging a
    story PR after CI + review approval (MERGE mode). Triggered by /impl:commit and
    /pr:merge commands. Enforces pre-flight gates (test/lint/typecheck) before any git
    operation and conventional commit format derived from the story issue.
invocations:
    - user: /impl-commit
    - agent: impl-commit
---

# Skill: impl-commit

Handles the final delivery steps for a BudFin story: staging, committing with a
conventional message derived from the story issue, opening a draft PR with required
`Fixes #N / Part of Epic #M` linkage, and squash-merging after CI + review approval.

---

## Modes

This skill has two distinct modes. Read the invoking command to determine which to run.

| Mode   | Triggered by             | Purpose                                |
| ------ | ------------------------ | -------------------------------------- |
| COMMIT | `/impl:commit [story-#]` | Commit + push + open draft PR          |
| MERGE  | `/pr:merge [story-#]`    | Verify CI + squash-merge + Epic rollup |

---

## Pre-flight Gate (both modes)

Run all three before any git or gh operation. Any non-zero exit is a hard blocker — stop
and report the failure to the user. Do not proceed.

```bash
pnpm test          # must exit 0
pnpm lint          # must exit 0, zero warnings
pnpm typecheck     # must exit 0
```

---

## COMMIT Mode

### Step 1 — Guard: must not be on main

```bash
git branch --show-current
```

If output is `main` or `master`, stop immediately:

```
ERROR: Cannot commit on main. Create a feature branch first.
  git checkout -b story/[story-#]-<slug>
```

### Step 1.5 — Quick Lint Pre-Fix

Run auto-fixers on all changed files before the formal pre-flight gate:

```bash
pnpm eslint . --fix
pnpm prettier --write .
```

This prevents the pre-flight gate from failing on auto-fixable issues.

### Step 2 — Run pre-flight gate

See above. Stop on any failure.

### Step 3 — Fetch story metadata

```bash
gh issue view [story-#] --json title,body,labels,number
```

Extract:

- `title` — story title verbatim (used as PR title)
- `body` — parse `**Parent Epic**: #N` to get `epic-#`
- Feature scope — lowercase module keyword from title (e.g. `enrollment`, `auth`, `salary`)

### Step 4 — Derive commit type

| Condition                     | Type    |
| ----------------------------- | ------- |
| New behavior, endpoint, or UI | `feat`  |
| Bug correction                | `fix`   |
| Tests only, no logic change   | `test`  |
| Scaffolding, config, deps     | `chore` |
| Documentation only            | `docs`  |

### Step 5 — Build commit message

Format: `type(scope): ≤60-char description`

Rules:

- Scope = lowercase module name derived from story title
- Description = imperative mood, present tense ("add enrollment API" not "added")
- No issue number in the subject line (linkage is in the PR body)
- Total subject line ≤ 72 characters

Example: `feat(enrollment): add POST /api/v1/enrollment endpoint`

### Step 6 — Stage, commit, and push

```bash
git add -A
git commit -m "type(scope): description"
git push -u origin HEAD
```

After push, verify the remote branch exists:

```bash
git ls-remote --heads origin $(git branch --show-current) | grep -q . || { echo "Push failed — remote branch not found"; exit 1; }
```

### Step 7 — Create draft PR

```bash
gh pr create \
  --title "[story title verbatim]" \
  --body "..." \
  --draft \
  --base main
```

PR body template:

```markdown
## Story

Fixes #[story-#]
Part of Epic #[epic-#]

## Summary

[one-line from the story's first acceptance criterion]

## Changes

[output of: git diff --stat HEAD~1]

## Test Plan

- [x] `pnpm test` green
- [x] `pnpm lint` 0 errors
- [x] Coverage ≥ 80% for new code
- [ ] All ACs from the story verified

## Checklist

- [ ] No `Decimal` bypass (TC-001)
- [ ] No YEARFRAC bypass (TC-002)
- [ ] Zod validation on all new API endpoints
- [ ] CHANGELOG updated
```

### Step 8 — Move story to "In Review"

```bash
gh issue edit [story-#] --add-label "in-review"
```

### Step 9 — Report

Output to user:

```
Committed: [commit hash]
Branch:    [branch name]
PR:        [pr url]
Story #[N] moved to In Review.
```

---

## MERGE Mode

### Step 1 — Run pre-flight gate

See above. Stop on any failure.

### Step 2 — Find the open PR

```bash
gh pr list --search "Fixes #[story-#]" --json number,url,isDraft,title
```

If no PR found: report error and stop.

### Step 3 — Verify PR is not a draft

Check `isDraft` from step 2. If `true`, stop:

```
ERROR: PR is still a draft. Mark it ready for review first:
  gh pr ready [pr-#]
```

### Step 4 — Verify CI green

```bash
gh pr checks [pr-#] --watch
```

If any check fails: report the failing check name and stop. Do not merge.

### Step 5 — Squash merge + delete branch

```bash
gh pr merge [pr-#] --squash --delete-branch --auto
```

### Step 6 — Confirm story closed

```bash
gh issue view [story-#] --json state,stateReason
```

The `Fixes #N` keyword in the PR body auto-closes the issue on merge. If `state` is not
`CLOSED`, add a manual close:

```bash
gh issue close [story-#] --comment "Closed by merge of PR #[pr-#]."
```

### Step 7 — Epic rollup

Fetch parent epic number from story body (same `**Parent Epic**: #N` pattern).

```bash
# List all stories tagged to this epic
gh issue list --label story --search "Parent Epic: #[epic-#]" --state all --json number,state,title
```

Count open vs closed:

- If **any stories are open**: report the remaining count and stop.
- If **all stories are closed**:
    1. Comment on the Epic issue:
        ```bash
        gh issue comment [epic-#] --body "All [N] stories merged — Epic [epic-#] complete."
        ```
    2. Close the Epic:
        ```bash
        gh issue close [epic-#] --comment "All stories merged."
        ```
    3. Move Epic to Done on Projects board:
        ```bash
        gh issue edit [epic-#] --add-label "done"
        ```

### Step 8 — Report

Output to user:

```
Merged: PR #[pr-#] ([squash commit hash])
Story #[story-#]: CLOSED
Epic #[epic-#]: [N]/[total] stories closed — [COMPLETE / N remaining]
```

---

## Common Mistakes

| Mistake                         | Correct behaviour                           |
| ------------------------------- | ------------------------------------------- |
| Skipping pre-flight on merge    | Always run all three gates in both modes    |
| Pushing to main directly        | Guard in Step 1; fail loudly                |
| Opening PR as ready (not draft) | Always use `--draft` in COMMIT mode         |
| Guessing commit scope           | Derive from story title, never invent       |
| Merging a draft PR              | MERGE mode checks `isDraft`; stop if true   |
| Force-pushing                   | Never. Rebase is the user's explicit action |
| Multi-story PRs                 | One PR per story — enforced by workflow     |

---

## Dependencies

- `gh` CLI authenticated: `gh auth status` must succeed before any `gh` commands
- Existing labels: `story`, `in-review`, `done` — created by `/plan:decompose`
- Conventional commits format from `WORKFLOW.md`
- PR template at `.github/PULL_REQUEST_TEMPLATE.md` — PR body mirrors this
