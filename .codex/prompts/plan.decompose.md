---
name: plan:decompose
description: Phase 2 - Bulk-create all 13 BudFin GitHub Epics, required labels, and the GitHub Projects board with Backlog/In Progress/In Review/Done columns.
---

> **Internal command.** Called by `/workflow:run` automatically.

Read and follow `.agents/skills/plan-decompose/SKILL.md` before any steps.

This command executes Phase 2 (DECOMPOSE) of the BudFin workflow in full.

Read `.claude/workflow/STATUS.md` first to confirm we are in Phase 2. If not, warn the user and stop.

## Swarm Agent Requirement

Use Codex sub-agents to spin up a swarm before executing. Minimum 5 agents:

| Agent         | Role                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Planner       | Reads the plan-decompose skill catalog, determines creation order, drafts all 13 issue bodies before any `gh` calls                       |
| Implementer   | Executes `gh issue create` and `gh project item-add` in dependency order (13→11→7→1→2→3→4→8→12→5→6→9→10)                                  |
| Code Reviewer | After each batch of 3 epics, reviews created issue bodies on GitHub to confirm no placeholders, correct labels, correct dependency tables |
| QA            | Runs the Step 6 quality gate across all 13 epics after creation; reports failures with the exact `gh issue edit` fix needed               |
| Documentation | Updates STATUS.md Feature Progress table with real GitHub issue numbers after all epics pass QA                                           |

The Planner must complete its drafts before the Implementer begins. The Code Reviewer and QA run after implementation, in parallel with each other. The Documentation agent runs last.

## Step 0: Pre-flight Check

Verify GitHub CLI access and repo connectivity before creating any resources:

```bash
gh auth status
gh repo view helalifaker/budfin --json name,url
```

If either command fails, stop and report the error to the user. Do not proceed until authentication is confirmed.

## Step 1: Create Required Labels

```bash
gh label create epic --color "#7057ff" --description "Epic-level feature" 2>/dev/null || true
gh label create story --color "#0075ca" --description "Story-level task linked to an Epic" 2>/dev/null || true
gh label create "must-have" --color "#d93f0b" --description "MoSCoW: Must Have" 2>/dev/null || true
gh label create "should-have" --color "#e4e669" --description "MoSCoW: Should Have" 2>/dev/null || true
gh label create "could-have" --color "#0e8a16" --description "MoSCoW: Could Have" 2>/dev/null || true
gh label create blocker --color "#b60205" --description "Blocks other work" 2>/dev/null || true
```

## Step 2: Create GitHub Projects Board

```bash
gh project create --owner helalifaker --title "BudFin Development" --format json
```

Save the project number from the output. Then confirm the Status field exists:

```bash
gh project field-list [PROJECT_NUMBER] --owner helalifaker
```

Note: GitHub Projects v2 creates a default Status field automatically with Backlog, In Progress, In Review, Done options.

## Step 3: Create All 13 Epics

Use the epic catalog from `.agents/skills/plan-decompose/SKILL.md`. Create epics in dependency-respecting order:

**Order**: 13 → 11 → 7 → 1 → 2 → 3 → 4 → 8 → 12 → 5 → 6 → 9 → 10

For each epic, use the full summary and dependency table from the skill. No placeholders — every field must be populated from the canonical catalog before creating the issue.

**Issue creation pattern** (repeat for each epic):

```bash
ISSUE_URL=$(gh issue create \
  --repo helalifaker/budfin \
  --title "Epic N: Feature Name" \
  --label "epic,must-have" \
  --body "## Summary

Epic N delivers [3-4 sentence summary from plan-decompose skill catalog. Must start with 'Epic N delivers...'. Must reference PRD section. Must state what EFIR staff can do after it ships.]

## MoSCoW Priority

Must Have

## Tier

MVP

## Acceptance Criteria Reference

Derived in Phase 4 via \`/plan:spec\` and stored in \`docs/specs/epic-N/\`.

## Stories

Will be created in Phase 4 via \`/plan:stories\`.

## Dependencies

| Epic | Feature | Reason |
|------|---------|--------|
| N    | Name    | Specific reason from skill catalog — not generic |

## Checklist

- [ ] Feature spec written (\`/plan:spec\`)
- [ ] Stories created (\`/plan:stories\`)
- [ ] All stories implemented and reviewed
- [ ] Epic closed")

ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -o '[0-9]*$')

gh project item-add [PROJECT_NUMBER] --owner helalifaker --url "$ISSUE_URL"
```

After creating each issue, record its number before moving to the next.

## Step 4: Update STATUS.md

After all 13 epics are created, update `.claude/workflow/STATUS.md`:

- Add a GitHub Issue column to the Feature Progress table
- Populate each row with the actual issue number created
- Format: `| 1 | Enrollment & Capacity | — | Not Started | #[issue-number] |`

## Step 5: Report

Display a summary table:

```
Phase 2 — DECOMPOSE complete

| Epic | Feature                 | GitHub Issue |
|------|-------------------------|--------------|
| 1    | Enrollment & Capacity   | #N           |
| 2    | Revenue                 | #N           |
| 3    | Staffing (DHG)          | #N           |
| 4    | Staff Costs             | #N           |
| 5    | P&L Reporting           | #N           |
| 6    | Scenario Modeling       | #N           |
| 7    | Master Data Management  | #N           |
| 8    | Audit Trail             | #N           |
| 9    | Dashboard               | #N           |
| 10   | Version Management      | #N           |
| 11   | Authentication & RBAC   | #N           |
| 12   | Data Migration          | #N           |
| 13   | Infrastructure & CI/CD  | #N           |

Projects Board: https://github.com/orgs/helalifaker/projects/[N]

Next: /workflow:advance to gate-check Phase 2 and move to Phase 3 (SETUP).
```

## Step 6: Quality Gate

After all 13 epics are created, verify each one passes these checks:

1. Summary does not contain `[`, `]`, "TBD", "placeholder", or "This feature"
2. Dependency table has at least one row (or explicitly states "None — foundational epic")
3. Issue has both `epic` label and a MoSCoW label (`must-have` or `should-have`)
4. Issue appears on the Projects board

If any epic fails a check, fix it with `gh issue edit #N --body "..."` before reporting complete.

## Error Handling

If any `gh` command fails, display the error and continue with the next epic.
Report all failures at the end so the user can fix them manually.
