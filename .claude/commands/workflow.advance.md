---
name: workflow:advance
description: Gate-check the current phase and advance STATUS.md to the next phase if all criteria are met.
allowed-tools: Read, Edit, Bash
---

Read `.claude/workflow/STATUS.md` to determine the current phase number and name.
Read `.claude/workflow/WORKFLOW.md` to get the checklist and gate requirement for the current phase.

## Gate Check

Count every checklist item for the current phase in WORKFLOW.md.

If any item is `[ ]` (unchecked):

- List all unchecked items
- Say: "Gate check FAILED. The following items must be completed before advancing:"
- Do NOT modify STATUS.md
- Stop

If all items are `[x]` (checked):

- Say: "Gate check PASSED. All [N] items complete."
- Determine the next phase number and name from WORKFLOW.md
- Update `.claude/workflow/STATUS.md`:
  - Change the `**Phase**:` line to the new phase
  - Update Phase History table: mark current phase ✅ Complete with today's date
  - Add new phase row as 🔄 In Progress
- Say: "STATUS.md updated. Now in Phase [N] — [NAME]."
- Display the first checklist item for the new phase

## Phase Transitions

| From | To |
|------|----|
| Phase 1 — DOCUMENT | Phase 2 — DECOMPOSE |
| Phase 2 — DECOMPOSE | Phase 3 — SETUP |
| Phase 3 — SETUP | Phase 4 — SPECIFY (first Epic) |
| Phase 4 — SPECIFY | Phase 5 — TDD RED |
| Phase 5 — TDD RED | Phase 6 — IMPLEMENT |
| Phase 6 — IMPLEMENT | Phase 7 — REVIEW |
| Phase 7 — REVIEW | Phase 4 — SPECIFY (next Epic) |

When transitioning from Phase 7 back to Phase 4, prompt: "Epic complete. Which Epic should we work on next? Run `/workflow:status` to see remaining Epics."

## On Gate FAIL — Suggest Fix Commands

When gate check fails, for each unmet criterion, suggest the appropriate fix command:

| Unmet criterion | Suggested fix |
|-----------------|---------------|
| Tests not passing | `/fix:tests` |
| Linter errors | `/fix:lint` |
| TypeScript errors | `/fix:types` |
| Coverage below 80% | `/fix:tests` |
| Security issues | `/fix:security` |
| Financial precision issues | `/fix:precision` |
| Spec not written | `/plan:spec [epic-N]` |
| Stories not created | `/plan:stories [epic-N]` |
| Blocker issues in PR review | Run the relevant `/fix:*` command |

Output gate fail as:
```
Gate check FAILED. [N] items must be completed:

  [ ] [item description]
      Suggested: [fix command]

  [ ] [item description]
      Suggested: [fix command]

Fix the above, then re-run: /workflow:advance
```

## After Successful Advance — Show Entry Command

After advancing, show the first command to run in the new phase:

```
STATUS.md updated. Now in Phase [N] — [NAME].

Entry command for Phase [N]:
  [command to run immediately — e.g., /plan:spec for Phase 4,
   /impl:story [#] for Phase 5, /workflow:advance for Phase 7]
```
