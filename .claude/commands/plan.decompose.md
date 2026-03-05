---
name: plan:decompose
description: Phase 2 - Bulk-create all 13 BudFin GitHub Epics, required labels, and the GitHub Projects board with Backlog/In Progress/In Review/Done columns.
allowed-tools: Bash, Read, Edit
---

This command executes Phase 2 (DECOMPOSE) of the BudFin workflow in full.

Read `.claude/workflow/STATUS.md` first to confirm we are in Phase 2. If not, warn the user and stop.

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

Save the project number from the output. Then add columns (fields) by creating a single-select Status field with the four options:
Backlog, In Progress, In Review, Done.

Note: GitHub Projects v2 creates a default Status field automatically. Confirm it exists:

```bash
gh project field-list [PROJECT_NUMBER] --owner helalifaker
```

## Step 3: Create All 13 Epics

Create each epic issue in sequence. Use `gh issue create` for each. After creation, add to the Projects board with `gh project item-add`.

The 13 epics with their MoSCoW priority and tier:

| # | Feature | MoSCoW | Tier |
|---|---------|--------|------|
| 1 | Enrollment & Capacity | Must Have | MVP |
| 2 | Revenue | Must Have | MVP |
| 3 | Staffing (DHG) | Must Have | MVP |
| 4 | Staff Costs | Must Have | MVP |
| 5 | P&L Reporting | Must Have | MVP |
| 6 | Scenario Modeling | Should Have | Target |
| 7 | Master Data Management | Must Have | MVP |
| 8 | Audit Trail | Should Have | Target |
| 9 | Dashboard | Should Have | Target |
| 10 | Version Management | Should Have | Target |
| 11 | Authentication & RBAC | Must Have | MVP |
| 12 | Data Migration | Must Have | MVP |
| 13 | Infrastructure & CI/CD | Must Have | MVP |

For each epic, create the issue with:

- Title: `Epic N: Feature Name`
- Labels: `epic` + appropriate MoSCoW label
- Body (use the template from `plan:epic` command)

After creating each issue, add it to the Projects board in the Backlog column.

## Step 4: Update STATUS.md

After all 13 epics are created, update `.claude/workflow/STATUS.md`:

- Update Feature Progress table with the GitHub issue number for each Epic
- Format: `| 1 | Enrollment & Capacity | — | Not Started | #[issue-number] |`

Add a GitHub Issue column to the Feature Progress table in STATUS.md.

## Step 5: Report

Display a summary table:

```
Phase 2 — DECOMPOSE complete

| Epic | Feature | GitHub Issue |
|------|---------|-------------|
| 1    | Enrollment & Capacity | #N |
...

Projects Board: https://github.com/orgs/helalifaker/projects/[N]

Next: /workflow:advance to gate-check Phase 2 and move to Phase 3 (SETUP).
```

## Error Handling

If any `gh` command fails, display the error and continue with the next epic.
Report all failures at the end so the user can fix them manually.
