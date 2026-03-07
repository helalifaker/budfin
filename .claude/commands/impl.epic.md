---
name: impl:epic
description: >
  Implement all stories for a BudFin Epic in dependency order. Runs impl:story logic inline for
  each story, pausing on blockers. Creates an Epic-level summary after all stories complete.
  Usage - /impl:epic [epic-issue-number]
argument-hint: '[epic-issue-number]'
allowed-tools: Bash, Read, Agent, TeamCreate, TaskCreate, TaskUpdate, TaskList, SendMessage
---

> **Internal command.** Called by `/workflow:run` automatically.

Parse the argument:

- `epic-issue-number`: integer GitHub issue number of the parent Epic (e.g., 5)

If missing, ask the user: "Which Epic issue number should I implement?"

## Step 1 — Phase Gate Check

Read `.claude/workflow/STATUS.md`.

If Phase < 5:
```
Error: /impl:epic requires Phase 5 (TDD RED) or Phase 6 (IMPLEMENT).
Current phase is [N] — [NAME].

Run /workflow:advance to gate-check your way to Phase 5.
Or run /plan:spec [epic-N] if the spec hasn't been written yet.
```
Then stop.

## Step 2 — Load All Stories

```bash
gh issue list --label "story" --json number,title,body --state open
```

Filter to stories where the body contains `**Parent Epic**: #$EPIC_NUMBER`.

Sort by dependency order: parse the `**Depends On**:` field in each story body.
Build a dependency graph and topologically sort. Stories with no dependencies come first.

Display the ordered list:
```
Stories for Epic #$EPIC_NUMBER:
  1. Story #N — [title] (no dependencies)
  2. Story #N — [title] (depends on Story #N)
  3. Story #N — [title] (depends on Story #N)
```

Ask: "Ready to implement [N] stories in this order? (yes to start / no to abort)"

## Step 3 — Implement Stories in Order

For each story in the sorted order:

1. Announce:
   ```
   ─────────────────────────────────────────
   Implementing story [X/N]: #[number] — [title]
   ─────────────────────────────────────────
   ```

2. Execute the full `impl:story` workflow inline (not as a slash command call):
   - Context gathering (issue + epic + spec)
   - Skill invocation (`budfin-workflow`)
   - Spawn story-orchestrator swarm
   - TDD RED phase
   - TDD GREEN phase
   - Parallel review phase
   - Outcome determination

3. On PASS:
   - Record: `Story #N PASSED — PR #N created`
   - Immediately continue to next story

4. On FAIL (any Blocker):
   - Output the blocker list with suggested fix commands
   - PAUSE implementation — do NOT continue to the next story automatically
   - Print:
     ```
     Story #$STORY_NUMBER BLOCKED — [N] blockers found.

     Resolve the blockers above, then either:
       /fix:lint / /fix:types / /fix:tests / /fix:security / /fix:precision

     After resolving, resume: /impl:story $STORY_NUMBER
     Then continue with the next story manually or re-run: /impl:epic $EPIC_NUMBER
     ```
   - Stop

## Step 4 — Epic Completion Summary

When all stories pass, output:

```
═══════════════════════════════════════════
Epic #$EPIC_NUMBER Implementation Complete
═══════════════════════════════════════════

Stories merged:
  ✓ Story #N — [title] (PR #N)
  ✓ Story #N — [title] (PR #N)
  ...

All [N] stories complete. All PRs open and approved.

Next steps:
  Review each PR and merge in dependency order.
  Then: /workflow:advance
```

## Error Handling

If no stories are found for this Epic:
```
No open stories found with Parent Epic #$EPIC_NUMBER.

Either stories haven't been created yet (run /plan:stories $EPIC_NUMBER first)
or all stories are already closed (check GitHub Issues).
```
