---
name: plan:epic
description: Create a single GitHub Epic issue for BudFin. Usage - /plan:epic [epic-number] "[feature name]" [must|should|could|wont] [mvp|target|stretch]
argument-hint: '[epic-number] "[feature name]" [must|should|could|wont] [mvp|target|stretch]'
allowed-tools: Bash, Read
---

## Phase Guard

If Phase > 2, output: "All 13 Epics were created in Phase 2. This command is no longer needed.
Use /workflow:status to see Epics." Then stop.

## Arguments

Parse the arguments:

- `epic-number`: integer (1–13)
- `feature-name`: the full feature name in quotes
- `priority`: MoSCoW value — must, should, could, or wont
- `tier`: mvp, target, or stretch

If any argument is missing, ask the user for it before proceeding.

## Create the GitHub Epic Issue

Run the following using the `gh` CLI:

1. Ensure the `epic` label exists (create it if not):

```bash
gh label create epic --color "#7057ff" --description "Epic-level feature" 2>/dev/null || true
```

2. Create the issue:

```bash
gh issue create \
  --title "Epic $EPIC_NUMBER: $FEATURE_NAME" \
  --label "epic" \
  --body "## Epic $EPIC_NUMBER: $FEATURE_NAME

**MoSCoW Priority**: $PRIORITY (capitalize appropriately: Must Have / Should Have / Could Have / Won't Have)
**Tier**: $TIER (MVP / Target / Stretch)

## Summary

[Describe what this epic delivers for EFIR finance staff — 2-3 sentences from the PRD.]

## Acceptance Criteria Reference

See \`docs/specs/epic-$EPIC_NUMBER/<feature-slug>.md\` once written in Phase 4.

## Stories

Stories will be created in Phase 4 (SPECIFY) and linked here.

## Dependencies

| Depends On | Reason |
|------------|--------|
| Epic N: Name | Reason |

## Checklist

- [ ] Spec written (\`docs/specs/epic-$EPIC_NUMBER/<feature-slug>.md\`)
- [ ] Stories created and linked
- [ ] All stories merged
- [ ] Epic closed
"
```

3. After the issue is created, display:
   - The issue number and URL
   - Command to add it to the Projects board: `gh project item-add [project-number] --owner helalifaker --url [issue-url]`

4. Update `.claude/workflow/STATUS.md` Feature Progress table — set this Epic's GitHub issue number.

## Error Handling

If `gh` is not authenticated or the repo is not accessible, show the exact command the user can run manually.
