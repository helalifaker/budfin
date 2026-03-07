---
name: workflow:status
description: Show the current BudFin workflow phase, checklist progress, and next gate requirement.
allowed-tools: Read, Bash
---

Read `.claude/workflow/STATUS.md` and `.claude/workflow/WORKFLOW.md`.

Display the current state in this format:

```
=== BudFin Workflow ===

>>> NEXT: /workflow:run [N]    (Epic N: [Name] -- [ready for spec | stories needed | implementation | review])

Phase: [N] -- [NAME] | Epics: [done]/13 done
Current Epic: Epic [N] -- [Name] (#[issue-number])

Checklist for Phase [N]:
  [x] Completed item
  [ ] Remaining item

Gate: [Gate requirement text from WORKFLOW.md]

Valid: /workflow:run [N], /plan:spec [N], /fix:all, /plan:adr, /workflow:status, /workflow:advance
```

The `>>> NEXT:` line must always appear at the top of the output, prominently showing the single most useful command to run next.

## Determining >>> NEXT

- Phase 4 with no spec: `/plan:spec [epic-N]`
- Phase 4 with spec but no stories: `/plan:stories [epic-N]`
- Phase 4 with spec and stories: `/workflow:run [epic-N]`
- Phase 5/6: `/workflow:run [epic-N]` (continues implementation)
- Phase 7 with open PRs: `/pr:drive --epic [epic-N]`
- Phase 7 with all PRs merged: `/workflow:advance`
- Between Epics: `/workflow:run [next-epic-N]`

## Valid Commands

After displaying status, show which commands are valid right now:

Phase-to-command mapping:
- Phase 4: `/workflow:run [epic-N]`, `/plan:spec [epic-N]`, `/plan:adr`, `/workflow:advance`
- Phase 5/6: `/workflow:run [epic-N]`, `/impl:story [#]`, `/fix:all`, `/workflow:advance`
- Phase 7: `/pr:drive --epic [epic-N]`, `/pr:drive [story-#]`, `/fix:all`, `/workflow:advance`
- Any phase: `/workflow:status`, `/workflow:advance`, `/fix:all`, `/plan:adr`

## Edge Cases

After displaying status, check if all checklist items for the current phase are marked `[x]`.
If yes, say: "All items complete. Run `/workflow:advance` to gate-check and move to the next phase."
If no, count how many items remain and name the first incomplete one.

If `.claude/workflow/STATUS.md` does not exist, say:
"STATUS.md not found at `.claude/workflow/STATUS.md`. The workflow has not been initialized."
