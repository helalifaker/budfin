---
name: review:run
description: >
  Phase 7 review orchestrator. Checks CI status on story PRs, re-runs review
  agents if needed, merges approved PRs, and performs epic rollup. Operates on
  a single story or all stories in the current epic.
  Usage - /review:run [story-issue-number|--all]
argument-hint: '[story-issue-number or --all]'
allowed-tools: Bash, Read, Edit, Agent, TeamCreate, Skill
---

Parse the argument:

- `story-issue-number`: GitHub issue number of a single story to review
- `--all`: Review all open PRs for the current Epic

If missing, default to `--all`.

## Step 1 -- Phase Gate

Read `.claude/workflow/STATUS.md` to determine current phase.

- If Phase 7 (REVIEW): proceed
- If Phase 6 (IMPLEMENT) with open draft PRs: proceed (early review is OK)
- Otherwise: stop with error:
  ```
  Error: /review:run requires Phase 7 (REVIEW) or Phase 6 with open draft PRs.
  Current phase is [N] -- [NAME].
  ```

## Step 2 -- Load PRs

### If `--all` or no argument:

Read STATUS.md to find the current Epic number.

```bash
gh pr list --search "Part of Epic #$EPIC_NUMBER" --json number,title,headRefName,isDraft,state --state open
```

Sort PRs by dependency order (parse story dependencies from issue bodies).

### If story number given:

```bash
gh pr list --search "Fixes #$STORY_NUMBER" --json number,title,headRefName,isDraft,state --state open
```

If no PR found:
```
No open PR found for story #$STORY_NUMBER.
Run /impl:commit [$STORY_NUMBER] to create one.
```
Stop.

## Step 3 -- Process Each PR

For each PR in dependency order:

### 3a. Check CI

```bash
gh pr checks $PR_NUMBER
```

### 3b. If CI fails:

Diagnose failures and auto-fix:

| CI Job | Fix Action |
|--------|-----------|
| lint | Run `pnpm eslint . --fix && pnpm prettier --write .` |
| typecheck | Run `pnpm typecheck`, diagnose errors, apply fixes |
| test | Run `pnpm test`, diagnose failures, fix implementation |
| format | Run `pnpm prettier --write .` |
| lint-md | Run `pnpm markdownlint --fix "**/*.md"` |
| audit | Run `pnpm audit --fix` + manual review |
| build | Run all above (build depends on all others) |

After fixes:
```bash
git add -A && git commit -m "fix(ci): resolve [job] failures" && git push
```

Re-check:
```bash
gh pr checks $PR_NUMBER --watch
```

If CI still fails after fix attempt, report and pause:
```
CI still failing on PR #$PR_NUMBER after auto-fix attempt.
Failing jobs: [list]
Manual intervention needed. Run /ci:check [$STORY_NUMBER] for detailed diagnosis.
```

### 3c. If CI green + PR still draft:

Spawn 3 review agents in parallel:

1. `workflow-reviewer` -- code quality, security, financial precision
2. `workflow-qa` -- AC coverage, edge cases, regression risk, coverage >= 80%
3. `workflow-documentor` -- CHANGELOG, ADR if applicable, STATUS.md update

Provide each agent with:
- The story issue number
- The feature spec path
- The list of files changed
- The PR diff

Wait for ALL THREE agents to return results.

### 3d. If review PASS (all three agents approve):

```bash
gh pr ready $PR_NUMBER
gh pr merge $PR_NUMBER --squash --delete-branch
```

Confirm story auto-closed:
```bash
gh issue view $STORY_NUMBER --json state
```

If not closed:
```bash
gh issue close $STORY_NUMBER --comment "Closed by merge of PR #$PR_NUMBER."
```

### 3e. If review FAIL (blockers found):

List blockers with fix commands and pause:
```
PR #$PR_NUMBER has [N] blockers:

BLOCKERS:
[agent] -- [file:line] -- [description]
  Suggested: [fix command]

Resolve blockers, then re-run: /review:run [$STORY_NUMBER]
```

Do NOT continue to next PR if this one has blockers (dependency chain).

## Step 4 -- Epic Rollup

After all PRs for the Epic are merged:

1. Comment on the Epic issue:
   ```bash
   gh issue comment $EPIC_NUMBER --body "All stories merged -- Epic #$EPIC_NUMBER complete."
   ```

2. Close the Epic:
   ```bash
   gh issue close $EPIC_NUMBER --comment "All stories merged."
   ```

3. Move Epic to Done:
   ```bash
   gh issue edit $EPIC_NUMBER --add-label "done"
   ```

4. Update `.claude/workflow/STATUS.md`:
   - Mark current Epic as complete in Feature Progress table
   - Advance phase to Phase 4 for next Epic

## Step 5 -- Auto-Advance

After epic rollup, auto-select the next Epic by dependency order + MoSCoW priority:

1. Read the plan-decompose skill catalog for remaining Epics
2. Filter out DONE Epics
3. Respect dependency order (all dependencies must be DONE)
4. Among eligible Epics, pick highest MoSCoW priority (Must > Should > Could)

Update STATUS.md with the new Current Epic.

Output:
```
Epic #$EPIC_NUMBER complete.

Stories merged: [N]
PRs merged: [N]

Next Epic: #$NEXT_EPIC -- [Feature Name]
Run: /workflow:run [$NEXT_EPIC]
```

## Error Handling

If `gh` is not authenticated:
- Display the error
- Guide the user to run `gh auth login`
- Stop

If no Epic found in STATUS.md:
```
No current Epic set in STATUS.md.
Run /workflow:status to see Epics and set the current one.
```
