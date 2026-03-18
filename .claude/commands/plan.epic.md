---
name: plan:epic
description: >
  Create one or more GitHub Epics (+ Stories) from a plan document.
  Analyzes the plan, proposes epic breakdown, creates issues, specs, and stories.
  Works at any phase — the entry point for post-PRD epics (remediations, redesigns, audit findings).
  Usage - /plan:epic [plan-file-path]
argument-hint: '[plan-file-path]'
allowed-tools: Bash, Read, Agent, Write, Edit, AskUserQuestion
---

Parse the argument:

- `plan-file-path`: path to a plan document (e.g., `docs/plans/2026-03-17-dhg-staffing-redesign.md`)

If the argument is missing, ask the user: "What is the path to the plan document?"

## Step 0: Pre-flight Check

Verify GitHub CLI access and repo connectivity before creating any resources:

```bash
gh auth status
gh repo view helalifaker/budfin --json name,url
```

If either command fails, stop and report the error to the user. Do not proceed until authentication is confirmed.

## Step 1: Read & Analyze Plan

Read the full plan file at the given path.

If the file does not exist, stop with:

```text
Plan file not found at [path]. Check the path and try again.
```

Identify the following from the plan:

- Title and objective
- Acceptance criteria
- Implementation sequence / phases
- Data model sections
- API route changes
- Open questions
- Explicit epic groupings (look for "Epic A:", "Epic B:", "Epic C:", or similar section headers)

## Step 2: Propose Epic Breakdown

Use the Agent tool (subagent_type: Explore) to analyze the plan structure:

```text
Analyze the plan file at [plan-path]. Return:
1. Whether the plan has explicit epic groupings (e.g., "Epic A: Foundations", "Epic B: Coverage")
2. If yes: extract each grouping with title, scope summary, plan sections covered, and inter-epic dependencies
3. If no: propose a breakdown based on implementation sequence, domain boundaries, and dependency order
4. For each proposed epic: title, scope summary (2-3 sentences), plan sections covered, dependencies on other proposed epics
5. For each proposed epic: MoSCoW priority (Must Have / Should Have) and Tier (MVP / Target)
```

Present the proposed breakdown as a table:

```text
Proposed Epic Breakdown from: [plan-file-name]

| # | Title | Scope | Plan Sections | Depends On | Priority | Tier |
|---|-------|-------|---------------|------------|----------|------|
| A | ...   | ...   | ...           | none       | ...      | ...  |
| B | ...   | ...   | ...           | Epic A     | ...      | ...  |
```

## Step 3: User Approval

Use `AskUserQuestion` to present the proposed breakdown:

"Here is the proposed epic breakdown from the plan. Does this look correct?"

Options:

- Accept as-is
- Modify (then ask for specific changes and re-propose)
- Re-split (re-analyze with different criteria)

Do not proceed until the user approves the breakdown.

## Step 4: Determine Next Epic Number

Query existing epics to find the next available number:

```bash
gh issue list --repo helalifaker/budfin --label epic --state all --json title --jq '.[].title' | grep -oP 'Epic \K[0-9]+' | sort -n | tail -1
```

Next epic number = max existing + 1. Increment for each additional epic in this batch.

If no epics exist or the command returns empty, start at 1.

## Step 5: Create Epics and Stories

Ensure required labels exist:

```bash
gh label create epic --color "#7057ff" --description "Epic-level feature" 2>/dev/null || true
gh label create story --color "#0075ca" --description "Story-level task linked to an Epic" 2>/dev/null || true
gh label create "must-have" --color "#d93f0b" --description "MoSCoW: Must Have" 2>/dev/null || true
gh label create "should-have" --color "#e4e669" --description "MoSCoW: Should Have" 2>/dev/null || true
```

For each approved epic (in dependency order):

### 5a: Create Epic Issue

Derive the MoSCoW label from the approved priority (`must-have` or `should-have`).

```bash
EPIC_URL=$(gh issue create \
  --repo helalifaker/budfin \
  --title "Epic $EPIC_NUMBER: $EPIC_TITLE" \
  --label "epic,$MOSCOW_LABEL" \
  --body "## Summary

Epic $EPIC_NUMBER delivers [scope extracted from plan — 3-4 sentences. Must start with 'Epic N delivers...'. Must state what EFIR staff can do after it ships.]

## MoSCoW Priority

$MOSCOW_PRIORITY

## Tier

$TIER

## Acceptance Criteria Reference

Spec: \`docs/specs/epic-$EPIC_NUMBER/<slug>.md\`
Source Plan: \`$PLAN_FILE_PATH\`

## Stories

[Will be populated after story creation below]

## Dependencies

| Epic | Feature | Reason |
|------|---------|--------|
| ...  | ...     | Specific reason — not generic |

## Checklist

- [ ] Feature spec written
- [ ] Stories created
- [ ] All stories implemented and reviewed
- [ ] Epic closed")

EPIC_ISSUE_NUMBER=$(echo "$EPIC_URL" | grep -o '[0-9]*$')
```

Add to Projects board if a project number is available:

```bash
gh project item-add [PROJECT_NUMBER] --owner helalifaker --url "$EPIC_URL" 2>/dev/null || true
```

### 5b: Create Spec File

```bash
mkdir -p docs/specs/epic-$EPIC_NUMBER
```

Create `docs/specs/epic-$EPIC_NUMBER/<slug>.md` with sections extracted from the plan:

- `> Source Plan: [plan-file-path]`
- Summary (from the epic's scope in the plan)
- Acceptance Criteria (derived from plan's ACs scoped to this epic, in AC-0N format)
- Data Model Changes (from plan's data model section, scoped to this epic; or "none")
- API Endpoints (from plan's API section, scoped to this epic; or "none")
- Out of Scope (derived from plan context)
- Open Questions (empty — resolved in the plan)

Cross-reference back to the source plan in every spec file.

### 5c: Derive and Create Stories

Analyze the epic's scope from the plan to derive implementation stories:

- Each story covers a logical implementation step
- Stories are ordered by dependency
- Each story has acceptance criteria derived from the epic's ACs

For each story, create a GitHub issue:

```bash
STORY_URL=$(gh issue create \
  --repo helalifaker/budfin \
  --title "Story: $STORY_TITLE" \
  --label "story" \
  --body "## Story: $STORY_TITLE

**Parent Epic**: #$EPIC_ISSUE_NUMBER
**Depends On**: [story title or 'none']

## Acceptance Criteria

- [ ] AC-0N: [criterion from plan]

## Definition of Done

- [ ] Tests written and RED (Phase 5)
- [ ] Tests GREEN, coverage >= 80% (Phase 6)
- [ ] Linter passes — 0 errors, 0 warnings
- [ ] PR open and linked to this issue
- [ ] Reviewer agent: APPROVED
- [ ] QA agent: APPROVED
- [ ] Documentor agent: COMPLETE
- [ ] PR merged, this issue auto-closes

## Notes

[Implementation constraints from plan]")
```

After each story is created, add to the Projects board:

```bash
gh project item-add [PROJECT_NUMBER] --owner helalifaker --url "$STORY_URL" 2>/dev/null || true
```

### 5d: Update Epic Issue with Story List

After all stories for an epic are created, update the epic issue body to replace the Stories
section placeholder with the actual story list:

```bash
gh issue edit $EPIC_ISSUE_NUMBER --body "[updated body with story issue numbers and titles]"
```

Format the Stories section as:

```markdown
## Stories

| # | Story | Issue | Depends On |
|---|-------|-------|------------|
| 1 | [title] | #N | none |
| 2 | [title] | #N | Story 1 |
```

## Step 6: Update STATUS.md

Read `.claude/workflow/STATUS.md` and add new rows to the Feature Progress table for each
created epic:

```markdown
| $EPIC_NUMBER | $EPIC_TITLE | 2 | Epic Created (#$ISSUE_NUMBER) |
```

## Step 7: Quality Gate

Verify each created epic passes these checks:

1. Summary does not contain `[`, `]`, "TBD", "placeholder", or "This feature"
2. Dependency table has at least one row (or explicitly states "None — foundational epic")
3. Issue has both `epic` label and a MoSCoW label (`must-have` or `should-have`)
4. Spec file exists at `docs/specs/epic-$EPIC_NUMBER/`
5. At least one story issue is created and linked

If any epic fails a check, fix it with `gh issue edit` before reporting complete.

## Step 8: Summary Report

Display:

```text
/plan:epic complete — [N] epic(s) created from: [plan-file-name]

| Epic | Title | GitHub Issue | Stories |
|------|-------|-------------|---------|
| $N   | ...   | #$ISSUE     | N stories |

Stories created:

| Epic | # | Story | Issue |
|------|---|-------|-------|
| $N   | 1 | ...   | #$N   |

Specs created:
- docs/specs/epic-$N/<slug>.md

Next steps:
  /plan:spec $EPIC_NUMBER     (refine spec interactively)
  /impl:story [first-story]   (begin implementation)
  /workflow:status             (check current phase)
```

## Error Handling

- If any `gh` command fails, display the error and continue with the next item
- Report all failures at the end so the user can fix them manually
- If the plan file cannot be found or read, stop with a clear error message
- If the plan has no clear implementation structure, ask the user to clarify the epic boundaries
