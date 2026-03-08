---
name: plan:stories
description: >
    Phase 4 - Read a completed feature spec and batch-create all GitHub Story issues linked to
    the parent Epic. Derives dependency-ordered story breakdown via workflow-orchestrator agent.
    Usage - /plan:stories [epic-issue-number] [--single]
argument-hint: '[epic-issue-number] [--single]'
---

> **Internal command.** Called by `/workflow:run` automatically.

Parse the arguments:

- `epic-issue-number`: the GitHub issue number of the parent Epic (e.g., 5)
- `--single`: optional flag — if present, create only one story interactively

If `epic-issue-number` is missing, ask the user for it.

## Step 1: Phase Guard

Read `.claude/workflow/STATUS.md`. If not Phase 4 — SPECIFY:

```
Warning: /plan:stories is a Phase 4 command. Current phase is [N] — [NAME].
Run /workflow:status to see what actions are available.
```

Then stop.

## Step 2: Find the Feature Spec

1. `gh issue view $EPIC_NUMBER --json number,title,body` — get Epic details
2. Derive the spec file path from the Epic title:
    - Epic title "Epic N: Feature Name" → `docs/specs/epic-N/<feature-slug>.md`
3. Read the spec file entirely

If no spec exists:

```
No spec found at docs/specs/epic-$EPIC_NUMBER/. Run /plan:spec $EPIC_NUMBER first.
```

Then stop.

## Step 2.5: Extract UI/UX Context from Spec

Read the spec's `## UI/UX Specification` section. Extract:

1. **Primary UI/UX spec path**: from the `> Source:` line (e.g., `docs/ui-ux-spec/08-master-data.md`)
2. **Shell type**: PlanningShell or ManagementShell (from `### Shell & Layout`)
3. **Key Components table**: component name, type, and source reference (from `### Key Components`)

If the UI/UX section says "N/A — backend-only epic", set UI/UX context to null and use 'N/A'
for all UI/UX fields in the story template below.

Store these values for use in Step 4.

## Step 3: Derive Story Breakdown (if not --single)

Load `.codex/agents/workflow-orchestrator.md` as the planning brief, then spawn a Codex
sub-agent with the spec file and this instruction:

```
Analyze the feature spec at [spec-path]. Return:
1. A numbered list of stories in dependency order
2. For each story: title, dependency (which story it depends on, if any), and the AC numbers from the spec it covers
3. Flag any AC that does not map to a story (these need to be assigned)
4. For each story: which UI/UX components (from the spec's Key Components table) it involves
```

Wait for orchestrator to return the story breakdown before proceeding.

## Step 4: Create Story Issues

Ensure the `story` label exists:

```bash
gh label create story --color "#0075ca" --description "Story-level task linked to an Epic" 2>/dev/null || true
```

For each story returned by the orchestrator (in dependency order), create a GitHub issue:

```bash
gh issue create \
  --title "Story: $STORY_TITLE" \
  --label "story" \
  --body "## Story: $STORY_TITLE

**Parent Epic**: #$EPIC_NUMBER
**Depends On**: [story title or 'none']

## Acceptance Criteria

[Copy relevant AC from the spec — AC-0N format]

- [ ] AC-0N: [criterion]

## Definition of Done

- [ ] Tests written and RED (Phase 5)
- [ ] Tests GREEN, coverage ≥ 80% (Phase 6)
- [ ] Linter passes — 0 errors, 0 warnings
- [ ] PR open and linked to this issue
- [ ] Reviewer agent: APPROVED
- [ ] QA agent: APPROVED
- [ ] Documentor agent: COMPLETE
- [ ] PR merged, this issue auto-closes

## Notes

[Any implementation constraints or technical notes from the spec relevant to this story]

## UI/UX Context

**Primary UI/UX Spec**: [path from Step 2.5, or 'N/A']
**Shell Type**: [PlanningShell / ManagementShell / N/A]
**Key Components**: [comma-separated list of component names relevant to THIS story, or 'N/A']
**Interaction Patterns**: [relevant patterns from spec for THIS story, or 'N/A']
"
```

After each story is created:

- Display the issue number and URL
- Add to the Projects board if project number is known:
  `gh project item-add [project-number] --owner helalifaker --url [issue-url]`

## Step 5: --single Mode

If `--single` flag was passed, create only one story interactively:

1. Ask user for the story title
2. Ask user which AC from the spec this story covers
3. Create the issue using the template above
4. Display issue number and URL

## Step 6: Summary

After all stories are created, display:

```
Stories created for Epic #$EPIC_NUMBER: [Feature Name]

| # | Story | Issue | Depends On |
|---|-------|-------|------------|
| 1 | [title] | #N | none |
| 2 | [title] | #N | Story 1 |
...

Total: [N] stories created

Next: Implement stories in order.
  /impl:story [first-story-number]
```

Also update `.claude/workflow/STATUS.md` — add story issue numbers to the feature progress table.
