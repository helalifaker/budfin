---
name: workflow:advance
description: Gate-check the current phase and advance STATUS.md to the next phase if all criteria are met.
allowed-tools: Read, Edit, Bash, Agent, Skill
---

Read `.claude/workflow/STATUS.md` to determine the current phase number and name.
Read `.claude/workflow/WORKFLOW.md` to get the checklist and gate requirement for the current phase.

## Gate Check

Verify each criterion for the current phase (listed in WORKFLOW.md) is met by checking actual project state — run commands, read files, or query GitHub as needed. The checklist items in WORKFLOW.md are definitions, not live state.

If any criterion is not yet satisfied:

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

| From                | To                             |
| ------------------- | ------------------------------ |
| Phase 1 — DOCUMENT  | Phase 2 — DECOMPOSE            |
| Phase 2 — DECOMPOSE | Phase 3 — SETUP                |
| Phase 3 — SETUP     | Phase 4 — SPECIFY (first Epic) |
| Phase 4 — SPECIFY   | Phase 5 — TDD RED              |
| Phase 5 — TDD RED   | Phase 6 — IMPLEMENT            |
| Phase 6 — IMPLEMENT | Phase 7 — REVIEW               |
| Phase 7 — REVIEW    | Phase 4 — SPECIFY (next Epic)  |

When transitioning from Phase 7 back to Phase 4, auto-select the next Epic by dependency order + MoSCoW priority (no prompt needed).

## On Gate FAIL — Suggest Fix Commands

When gate check fails, for each unmet criterion, suggest the appropriate fix command:

| Unmet criterion             | Suggested fix                     |
| --------------------------- | --------------------------------- |
| Tests not passing           | `/fix:tests`                      |
| Linter errors               | `/fix:lint`                       |
| TypeScript errors           | `/fix:types`                      |
| Coverage below 80%          | `/fix:tests`                      |
| Security issues             | `/fix:security`                   |
| Financial precision issues  | `/fix:precision`                  |
| Spec not written            | `/plan:spec [epic-N]`             |
| Stories not created         | `/plan:stories [epic-N]`          |
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
   /impl:story [#] for Phase 5, /review:run --all for Phase 7]
```

## Auto-Chain to Next Phase

After advancing, determine and execute the entry action automatically:

| New Phase                   | Auto-Chain Behavior                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 4 (SPECIFY)           | Auto-select next Epic by priority: read plan-decompose catalog, filter out DONE epics, respect dependency order + MoSCoW priority. Set Current Epic in STATUS.md. Print: `/plan:spec [epic-N] "[feature]"` (spec writing stays interactive -- user provides content for each section). |
| Phase 5 (TDD RED)           | Read Current Epic, list stories via `gh issue list --label story --search "Parent Epic: #N" --state open`, print: `/impl:story [first-story-#]` or `/workflow:run [epic-#]`                                                                                                            |
| Phase 6 (IMPLEMENT)         | Skip -- impl:story handles 5->6 internally                                                                                                                                                                                                                                             |
| Phase 7 (REVIEW)            | Print: `/review:run --all` to review and merge all PRs for current epic                                                                                                                                                                                                                |
| Phase 4 (from 7, next Epic) | Auto-select next Epic by dependency order + MoSCoW priority (no prompt). Set Current Epic in STATUS.md. Print: `/workflow:run [next-epic-#]`                                                                                                                                           |
