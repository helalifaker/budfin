---
name: workflow:status
description: Show the current BudFin workflow phase, checklist progress, and next gate requirement.
allowed-tools: Read, Bash
---

Read `.claude/workflow/STATUS.md` and `.claude/workflow/WORKFLOW.md`.

Display the current state in this format:

```
=== BudFin Workflow Status ===

Phase: [N] — [NAME]
Current Epic: [name or "none"]
Current Story: [name or "none"]

Checklist for Phase [N]:
  [x] Completed item
  [ ] Remaining item

Gate: [Gate requirement text from WORKFLOW.md]

Next action: [One specific thing to do next]
```

After displaying status, check if all checklist items for the current phase are marked `[x]`.
If yes, say: "All items complete. Run `/workflow:advance` to gate-check and move to the next phase."
If no, count how many items remain and name the first incomplete one.

If `.claude/workflow/STATUS.md` does not exist, say:
"STATUS.md not found at `.claude/workflow/STATUS.md`. The workflow has not been initialized."

## Valid Commands for Current Phase

After displaying status, show which commands are valid right now and which are blocked:

```
Valid commands for Phase [N]:
  [list commands valid in this phase — see COMMANDS.md phase gate table]

Blocked commands (not available in Phase [N]):
  [list blocked commands and why]

Recommended next command:
  [single most appropriate command to run next, with any required arguments]
```

Phase-to-command mapping:
- Phase 2: `/plan:decompose` (primary), `/plan:epic`, `/workflow:advance`
- Phase 3: setup work (no slash command), `/workflow:advance`
- Phase 4: `/plan:spec [epic-N]`, `/plan:stories [epic-N]`, `/plan:adr`, `/workflow:advance`
- Phase 5/6: `/impl:story [#]`, `/impl:epic [#]`, `/fix:*` (any), `/workflow:advance`
- Phase 7: review and merge PRs, `/workflow:advance`
- Any phase: `/workflow:status`, `/workflow:advance`, `/fix:*`, `/plan:adr`
