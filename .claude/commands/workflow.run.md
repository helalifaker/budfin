---
name: workflow:run
description: >
  Full Epic driver. Drives the complete lifecycle for a single BudFin Epic: spec → stories →
  implement all stories → advance phase. One command to rule them all for a single Epic.
  Requires Phase 4 or later. Usage - /workflow:run [epic-issue-number]
argument-hint: '[epic-issue-number]'
allowed-tools: Bash, Read, Edit, Agent, TeamCreate, TaskCreate, TaskUpdate, TaskList, SendMessage, Skill
---

Parse the argument:

- `epic-issue-number`: GitHub issue number of the Epic to implement (e.g., 5)

If missing, ask the user: "Which Epic issue number should I run? (Check /workflow:status for available Epics)"

## Step 1 — Read Current Phase

Read `.claude/workflow/STATUS.md` to determine current phase.

## Step 2 — Phase Routing

### If Phase 3 (SETUP) or earlier:
```
Error: /workflow:run requires Phase 4 (SPECIFY) or later.
Current phase is [N] — [NAME].

Complete Phase 3 setup work first, then run /workflow:advance.
Once in Phase 4, re-run: /workflow:run $EPIC_NUMBER
```
Stop.

### If Phase 4 (SPECIFY):
Execute in sequence:

**4a. Check if spec exists**:
```bash
ls docs/specs/epic-$EPIC_NUMBER/ 2>/dev/null
```

If no spec: run the full `plan:spec` workflow for this Epic interactively.

**4b. Check if stories exist**:
```bash
gh issue list --label "story" --json number,title,body --state open 2>/dev/null | \
  grep "Parent Epic.*#$EPIC_NUMBER"
```

If no stories: run the full `plan:stories` workflow to create all story issues.

**4c. Advance to Phase 5**:
Run `workflow:advance` logic — gate-check Phase 4, advance STATUS.md to Phase 5.

**4d. Fall through to Phase 5 logic below.**

### If Phase 5 or 6 (TDD RED / IMPLEMENT):
Run the full `impl:epic` workflow:
1. Load all open stories for this Epic in dependency order
2. Implement each story using the `impl:story` swarm
3. Pause on any Blocker and wait for resolution
4. Continue until all stories have approved PRs

### If Phase 7 (REVIEW):
```
This Epic is in the REVIEW phase. All PRs are open.

Action needed:
1. Review and merge each PR in dependency order
2. After all PRs merged: /workflow:advance

PRs to review:
```
```bash
gh pr list --json number,title,headRefName | grep "epic-$EPIC_NUMBER"
```
Stop.

## Step 3 — Epic Completion (after all stories implemented and approved)

After all stories have approved draft PRs:

1. Display PR list for user to merge in dependency order:
   ```
   All stories approved. Merge PRs in this order:
   1. PR #N — [story title] (no dependencies)
   2. PR #N — [story title] (after PR #N)
   ...
   ```

2. Ask: "Would you like to advance to the next phase now? (yes/no)"
   - If yes: run `workflow:advance` logic

3. Output:
   ```
   Epic #$EPIC_NUMBER — [Feature Name] complete.

   Stories implemented: N
   PRs approved: N
   Phase advanced to: [next phase]

   Next Epic:
     /workflow:status (to see which Epic to tackle next)
     /workflow:run [next-epic-number]
   ```

## Error Handling

If `gh` is not authenticated:
- Display the error
- Guide the user to run `gh auth login`
- Stop

If no Epic found with issue number `$EPIC_NUMBER`:
```
No Epic found with issue number #$EPIC_NUMBER.
Run /workflow:status to see all Epics and their issue numbers.
```
