---
name: pr:drive
description: >
  Autonomous PR driver. Takes one or more PRs and loops each until merged:
  CI check -> fix -> review agents -> conversation resolution -> fix blockers -> retry.
  Stuck detection stops after 2 consecutive identical error fingerprints.
  Supports --epic flag to drive all PRs for an Epic in dependency order.
  Usage - /pr:drive [story-#] or /pr:drive --pr N [N...] or /pr:drive --epic [epic-#]
argument-hint: '[story-# or --pr N [N...] or --epic [epic-#]]'
allowed-tools: Bash, Read, Edit, Agent, TeamCreate, Skill
---

Parse the argument:

Three modes:

- **Story mode**: `/pr:drive [story-issue-number]` -- finds PR via `Fixes #N` search, enforces phase gate
- **PR mode**: `/pr:drive --pr N [N...]` -- drives one or more PRs by number directly, no phase gate
- **Epic mode**: `/pr:drive --epic [epic-#]` -- drives ALL open PRs for an Epic in dependency order

If none match, ask: "Provide a story number, use --pr N [N...] for direct PR numbers, or --epic N for all Epic PRs."

---

## Step 0 -- Initialize

### 0a. Verify gh auth

```bash
gh auth status
```

If not authenticated, guide user to `gh auth login` and stop.

### 0b. Build PR queue

**Story mode:**

1. Phase gate: read `.claude/workflow/STATUS.md`
   - Phase 6 (IMPLEMENT) with an existing draft PR: proceed
   - Phase 7 (REVIEW): proceed
   - Otherwise: stop with error:
     ```
     Error: /pr:drive requires Phase 6 (with a draft PR) or Phase 7.
     Current phase is [N] -- [NAME].
     ```

2. Find PR:
   ```bash
   gh pr list --search "Fixes #$STORY_NUMBER" --json number,url,headRefName,isDraft --state open
   ```
   If no PR found:
   ```
   No open PR found for story #$STORY_NUMBER.
   Run /impl:commit [$STORY_NUMBER] to create one first.
   ```
   Stop.

3. PR queue = single PR found above.

**PR mode (--pr N [N...]):**

1. No phase gate -- proceed regardless of current phase.

2. Fetch metadata for each PR number:
   ```bash
   gh pr view $PR_NUMBER --json number,url,headRefName,isDraft,title,body
   ```
   If any PR not found, report and skip it.

3. PR queue = all valid PRs in the order given.

**Epic mode (--epic N):**

1. No phase gate -- proceed regardless of current phase.

2. Find all open PRs for this Epic:
   ```bash
   gh pr list --search "Part of Epic #$EPIC_NUMBER" --json number,url,headRefName,isDraft,title,body --state open
   ```

3. Sort PRs by story dependency order (parse story dependencies from PR bodies and linked issue bodies).

4. PR queue = all PRs in dependency order.

### 0c. Extract metadata per PR

For each PR in the queue, extract from PR body:
- `STORY_NUMBER`: parse `Fixes #N` if present (may be absent in PR mode)
- `EPIC_NUMBER`: parse `Part of Epic #N` if present (may be absent in PR mode)

These are optional in PR mode -- steps that reference them become no-ops when absent.

### 0d. Process queue

For each PR in the queue, run **Steps 1-8** below sequentially.
Before each PR:

1. Checkout + pull:
   ```bash
   git checkout $BRANCH_NAME && git pull origin $BRANCH_NAME
   ```

2. Initialize loop state:
   ```
   CYCLE = 0
   LAST_CI_FINGERPRINT = ""
   LAST_REVIEW_FINGERPRINT = ""
   FIX_LOG = []
   ```

3. Report: `=== Driving PR #$PR_NUMBER: $PR_TITLE (${QUEUE_INDEX}/${QUEUE_SIZE}) ===`

---

## Step 1 -- CI Check (top of loop)

Increment: `CYCLE = CYCLE + 1`

Report: `--- Cycle $CYCLE: Checking CI ---`

```bash
gh pr checks $PR_NUMBER --watch
```

Parse the output. If ALL checks pass -> jump to **Step 3** (Review).

If checks are failing:
1. Build CI fingerprint: sort failing job names alphabetically, join with `|`
   Example: `lint|test|typecheck`
2. Compare to `LAST_CI_FINGERPRINT`
   - If identical -> jump to **Step 7** (STUCK)
   - If different -> set `LAST_CI_FINGERPRINT = new fingerprint`, proceed to **Step 2**

---

## Step 2 -- CI Fix

Apply fixes in priority order. For each failing job:

| CI Job | Fix Action |
|--------|-----------|
| format | `pnpm prettier --write .` |
| lint | `pnpm eslint . --fix && pnpm prettier --write .` |
| lint-md | `pnpm markdownlint --fix "**/*.md"` |
| typecheck | `pnpm typecheck` to see errors, then apply targeted fixes |
| test | `pnpm test` to see failures, diagnose each, fix implementation (NEVER weaken tests) |
| audit | `pnpm audit --fix` then manually review remaining |
| build | Run all above first (build depends on all others), then `pnpm build` |

Execute in this order: format -> lint -> lint-md -> typecheck -> test -> audit -> build.

### 2a. Pre-flight verification

After all fixes applied, run:
```bash
pnpm test && pnpm lint && pnpm typecheck
```

If pre-flight fails, apply additional fixes until clean.

### 2b. Commit and push

```bash
git add -A && git commit -m "fix(ci): resolve CI failures for PR #$PR_NUMBER (cycle $CYCLE)" && git push
```

Append to `FIX_LOG`: `"Cycle $CYCLE: CI fix -- [list of jobs fixed]"`

### 2c. Wait for CI

```bash
gh pr checks $PR_NUMBER --watch
```

Loop back to **Step 1**.

---

## Step 3 -- Review

Report: `--- Cycle $CYCLE: CI green. Running review ---`

### 3a. Check for unresolved conversations

```bash
gh api repos/{owner}/{repo}/pulls/$PR_NUMBER/comments --jq '[.[] | select(.in_reply_to_id == null)] | length'
```

### 3b. Get PR diff

```bash
gh pr diff $PR_NUMBER
```

### 3c. Spawn 3 review agents in parallel

Use Agent tool to spawn three agents simultaneously:

1. **workflow-reviewer** -- code quality, security, financial precision, OWASP top 10
2. **workflow-qa** -- acceptance criteria coverage, edge cases, regression risk, coverage >= 80%
3. **workflow-documentor** -- CHANGELOG, ADR if applicable, STATUS.md consistency

Provide each agent with:
- PR number and title
- Story issue number and Epic number (if available)
- The PR diff
- List of changed files

Wait for ALL THREE agents to return results.

### 3d. Evaluate results

If all three agents return APPROVED -> jump to **Step 3.5** (Conversation Resolution).

If any agent returns blockers:
1. Build review fingerprint: sort blockers as `agent:file:description-hash`, join with `|`
2. Compare to `LAST_REVIEW_FINGERPRINT`
   - If identical -> jump to **Step 7** (STUCK)
   - If different -> set `LAST_REVIEW_FINGERPRINT = new fingerprint`, proceed to fix

### 3e. Fix review blockers

For each blocker:
- Read the file referenced
- Apply the fix described by the review agent
- NEVER weaken tests or bypass checks

After all blockers fixed:

```bash
pnpm test && pnpm lint && pnpm typecheck
```

```bash
git add -A && git commit -m "fix(review): resolve review blockers for PR #$PR_NUMBER (cycle $CYCLE)" && git push
```

Append to `FIX_LOG`: `"Cycle $CYCLE: Review fix -- [N] blockers resolved"`

Loop back to **Step 1** (CI first, since code changed).

---

## Step 3.5 -- Conversation Resolution

Report: `--- Checking PR conversations ---`

### 3.5a. Check for CHANGES_REQUESTED reviews

```bash
gh api repos/{owner}/{repo}/pulls/$PR_NUMBER/reviews --jq '[.[] | select(.state == "CHANGES_REQUESTED")] | length'
```

### 3.5b. Check for unresolved comment threads

```bash
gh api repos/{owner}/{repo}/pulls/$PR_NUMBER/comments --jq '[.[] | select(.in_reply_to_id == null)] | length'
```

### 3.5c. Resolution

If unresolved threads or CHANGES_REQUESTED reviews exist:
1. List each thread with context
2. Attempt to address each finding (fix code or respond to comment)
3. If code changes needed: fix, commit, push, loop back to **Step 1**
4. Request re-review if CHANGES_REQUESTED was present

Gate: 0 unresolved conversations, no CHANGES_REQUESTED reviews pending.

If clean -> proceed to **Step 4** (PR Clean).

---

## Step 4 -- PR Clean

Report: `--- All reviews approved. Cleaning PR ---`

### 4a. Verify PR title (story mode only)

If `STORY_NUMBER` is available:

Fetch story title:
```bash
gh issue view $STORY_NUMBER --json title --jq '.title'
```

Compare to PR title. If mismatched:
```bash
gh pr edit $PR_NUMBER --title "$STORY_TITLE"
```

### 4b. Verify PR body (story mode only)

If `STORY_NUMBER` is available, PR body must contain:
- `Fixes #$STORY_NUMBER`
- `Part of Epic #$EPIC_NUMBER` (if `EPIC_NUMBER` available)
- A summary section
- A test plan section

If any missing, update:
```bash
gh pr edit $PR_NUMBER --body "$UPDATED_BODY"
```

In PR mode (no story), skip body validation.

### 4c. Verify labels (story mode only)

If `STORY_NUMBER` is available:
```bash
gh issue edit $STORY_NUMBER --add-label "in-review"
```

### 4d. Mark PR ready

```bash
gh pr ready $PR_NUMBER
```

---

## Step 5 -- Merge

Report: `--- Merging PR #$PR_NUMBER ---`

### 5a. Final pre-flight

```bash
pnpm test && pnpm lint && pnpm typecheck
```

If fails, fix and commit (loop back to **Step 1**).

### 5b. Final CI check

```bash
gh pr checks $PR_NUMBER
```

If any check failing, loop back to **Step 1**.

### 5c. Squash merge

```bash
gh pr merge $PR_NUMBER --squash --delete-branch
```

If merge conflict:
```bash
git fetch origin main && git rebase origin/main
```

If rebase conflicts arise, resolve them, then:
```bash
git push --force-with-lease
```

Append to `FIX_LOG`: `"Cycle $CYCLE: Resolved merge conflict via rebase"`

Loop back to **Step 1**.

### 5d. Confirm story closed (story mode only)

If `STORY_NUMBER` is available:

```bash
gh issue view $STORY_NUMBER --json state --jq '.state'
```

If not CLOSED:
```bash
gh issue close $STORY_NUMBER --comment "Closed by merge of PR #$PR_NUMBER."
```

If no `STORY_NUMBER` (PR mode), skip this step.

---

## Step 6 -- Epic Rollup (story mode only)

Skip this entire step if `EPIC_NUMBER` is not available (PR mode without epic metadata).

### 6a. Check all stories

```bash
gh issue list --label "story" --search "Part of Epic #$EPIC_NUMBER" --json number,state --state all
```

Count open vs closed stories.

### 6b. If all stories closed

```bash
gh issue comment $EPIC_NUMBER --body "All stories merged -- Epic #$EPIC_NUMBER complete."
gh issue close $EPIC_NUMBER
gh issue edit $EPIC_NUMBER --add-label "done"
```

Update `.claude/workflow/STATUS.md`:
- Mark current Epic as DONE in Feature Progress table
- Advance phase to Phase 4 for next Epic

### 6c. Auto-select next Epic

Read Feature Progress table from STATUS.md. Filter out DONE Epics.
Respect dependency order (all dependencies must be DONE).
Among eligible, pick highest MoSCoW priority (Must > Should > Could).

Report next Epic recommendation.

Jump to **Step 8** (DONE).

---

## Step 7 -- STUCK (terminal)

```
STUCK on PR #$PR_NUMBER after $CYCLE cycles.

Repeated failure fingerprint:
  CI:     $LAST_CI_FINGERPRINT
  Review: $LAST_REVIEW_FINGERPRINT

Fix log:
  [full FIX_LOG entries]

Suggested next steps:
  1. /fix:debug "[description of repeating failure]"
  2. Manual investigation of the failing area
  3. Re-run after manual fix: /pr:drive --pr $PR_NUMBER
```

If processing a multi-PR queue, stop the entire queue (do not continue to next PR).

Stop.

---

## Step 8 -- DONE (terminal)

For each merged PR, report:
```
PR #$PR_NUMBER merged successfully.

Merge commit: [hash]
Story #$STORY_NUMBER: CLOSED  (or "N/A -- PR mode" if no story)
Epic #$EPIC_NUMBER: [DONE / N stories remaining]  (or "N/A" if no epic)

Cycles: $CYCLE
Fix log:
  [full FIX_LOG entries, or "No fixes needed" if empty]
```

After all PRs in the queue are merged, report summary:
```
All $QUEUE_SIZE PR(s) merged successfully.

  [list each PR # and merge commit]

Next:
  [If Epic done: "Epic complete. Next Epic: #N -- [Name]. Run /workflow:run [N]"]
  [If Epic not done / PR mode: "Done. No further action needed."]
```

---

## Rules (non-negotiable)

1. **Never weaken tests** -- fix implementation to match tests, never modify test expectations
2. **Never `--no-verify`** -- fix the underlying issue instead of bypassing pre-commit hooks
3. **New commits only** -- never amend in the loop; each fix cycle gets its own commit
4. **Force-with-lease only** -- for rebase conflicts, never bare `--force`
5. **No retry limit** -- loop until merged or stuck; stuck detection is the safety valve
6. **CI after review fixes** -- always restart from Step 1 after any code change
7. **Never `--no-gpg-sign`** -- respect signing config
8. **Conversations resolved** -- never merge with unresolved PR review threads
