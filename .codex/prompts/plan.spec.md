---
name: plan:spec
description: Phase 4 - Write a feature spec for a BudFin Epic. Usage - /plan:spec [epic-number] "[feature name]"
argument-hint: '[epic-number] "[feature name]"'
allowed-tools: Read, Edit, Write, Bash, Agent
---

Parse the arguments:

- `epic-number`: integer (1–13), the Epic number being specified
- `feature-name`: the feature name in quotes (e.g., "Enrollment & Capacity")

If any argument is missing, ask the user for it before continuing.

## Step 1: Invoke Skill

Use the Skill tool to invoke: `budfin-workflow`

This confirms phase compliance and loads all technical constraints before proceeding.

## Step 2: Phase Guard

Read `.claude/workflow/STATUS.md`.

Check the `**Phase**:` line.

If the current phase is NOT Phase 4 — SPECIFY, print:

```
Warning: STATUS.md shows Phase [N] — [NAME], not Phase 4 — SPECIFY.
Feature specs are written in Phase 4 only.
Run /workflow:status to see what phase you are in and what is needed next.
```

Then stop.

## Step 3: Confirm the Epic

Fetch the Epic issue from GitHub:

```bash
gh issue list --label "epic" --json number,title
```

Display matching Epic title and number. Ask the user to confirm before continuing.

If `gh` is not authenticated, ask the user to confirm the issue number manually.

## Step 4: Derive the Spec File Path

- Directory: `docs/specs/epic-$EPIC_NUMBER/`
- Filename: lowercase kebab-case of feature-name + `.md`
    - Example: Epic 1, "Enrollment & Capacity" → `docs/specs/epic-1/enrollment-capacity.md`
    - Example: Epic 3, "Staffing (DHG)" → `docs/specs/epic-3/staffing-dhg.md`

Check whether the file already exists:

```bash
ls docs/specs/epic-$EPIC_NUMBER/*.md 2>/dev/null
```

If a spec file already exists for this epic, show its path and ask:
"A spec file already exists at [path]. Open it for editing, or start a new one?"

## Step 4.5: Load UI/UX Context

Determine the relevant UI/UX spec file(s) for this epic:

| Epic | Primary UI/UX Spec                        |
| ---- | ----------------------------------------- |
| 1    | docs/ui-ux-spec/03-enrollment-capacity.md |
| 2    | docs/ui-ux-spec/04-revenue.md             |
| 3    | docs/ui-ux-spec/05-staffing-costs.md      |
| 4    | docs/ui-ux-spec/05-staffing-costs.md      |
| 5    | docs/ui-ux-spec/06-pnl-reporting.md       |
| 6    | docs/ui-ux-spec/07-scenarios.md           |
| 7    | docs/ui-ux-spec/08-master-data.md         |
| 8    | docs/ui-ux-spec/09-admin.md               |
| 9    | docs/ui-ux-spec/01-dashboard.md           |
| 10   | docs/ui-ux-spec/02-version-management.md  |
| 11   | docs/ui-ux-spec/09-admin.md               |
| 12   | (none — backend only)                     |
| 13   | (none — backend only)                     |

Cross-cutting files (always load for epics 1–11):

- `docs/ui-ux-spec/00-global-framework.md`
- `docs/ui-ux-spec/00b-workspace-philosophy.md`
- `docs/ui-ux-spec/10-input-management.md` (if epic uses planning grids: epics 1–6, 9)

**For epics 1–11**: Read the primary UI/UX spec file and the cross-cutting files. Extract:

- Shell type (PlanningShell vs ManagementShell)
- Layout structure (ASCII diagram or section reference)
- Component list with types (shadcn/ui, TanStack Table, custom)
- User flows (Actor -> Trigger -> Screen -> Action -> Outcome)
- Interaction patterns (inline editing, keyboard nav, cell highlighting)
- Accessibility requirements (WCAG AA specifics)

Store these for use in Step 6.

**For epics 12–13**: Skip this step. The UI/UX section will be filled with "N/A — backend-only epic".

## Step 5: Create the Spec File

```bash
mkdir -p docs/specs/epic-$EPIC_NUMBER
cp .claude/workflow/templates/feature-spec.md docs/specs/epic-$EPIC_NUMBER/$FEATURE_SLUG.md
```

Pre-fill the header fields:

- `[Feature Name]` → the feature-name argument
- `#[issue-number]` → the Epic GitHub issue number
- `YYYY-MM-DD` → today's date

## Step 6: Walk Through the Spec Sections

Guide the user through each section in order. For each:

1. Display the section name and its purpose
2. Ask the user for the content
3. Write it into the file
4. Confirm before moving on

Sections:

1. Summary (one paragraph — what this feature does, why, PRD reference)
2. Acceptance Criteria (AC-01, AC-02, ... — Given/When/Then or specific verifiable form)
3. Stories (table: #, Story title, Depends On, GitHub Issue — leave GitHub Issue blank for now)
4. Data Model Changes (SQL DDL or "none")
5. API Endpoints (table: Method, Path, Request, Response, Auth)
6. UI/UX Specification (pre-populated from Step 4.5 context — confirm/modify each sub-section: Shell & Layout, Key Components, User Flows, Interaction Patterns, Accessibility Requirements, Responsive/Viewport. For backend-only epics 12–13, auto-fill "N/A — backend-only epic")
7. Edge Cases Cross-Reference (from `docs/edge-cases/` — list relevant cases by ID)
8. Out of Scope (explicit exclusions)
9. Open Questions (must be empty before gate passes)

After each section, re-display it and ask: "Does this look correct? (yes to continue / no to redo)"

## Step 7: Completeness Gate

Before launching the orchestrator review, verify all 9 sections are non-empty:

- Summary: at least one paragraph
- Acceptance Criteria: at least one AC in Given/When/Then form
- Stories: at least one story in the table
- Data Model Changes: explicit content or "none"
- API Endpoints: explicit content or "none"
- UI/UX Specification: non-empty content OR "N/A — backend-only epic"
- Edge Cases: at least one case ID or "none applicable"
- Out of Scope: at least one explicit exclusion
- Open Questions: must be empty (all resolved)

If any section is missing or Open Questions is non-empty:

```
Gate BLOCKED. [N] section(s) incomplete. Spec is not ready for orchestrator review.
Incomplete sections: [list]
```

Do NOT proceed to Step 8 until all sections are complete.

## Step 8: Orchestrator Agent Review

After all sections complete and gate passes, say:

```
Spec draft complete. Launching workflow-orchestrator agent to review for gate readiness.
```

Use the Agent tool to launch `workflow-orchestrator` against the spec file at
`docs/specs/epic-$EPIC_NUMBER/$FEATURE_SLUG.md`.

## Step 9: Handle Review Result

### If PASS:

Update `.claude/workflow/STATUS.md` — set `**Current Epic**:` to `Epic $EPIC_NUMBER — $FEATURE_NAME`.

Print:

```
Gate PASSED. Spec approved by workflow-orchestrator.

Spec: docs/specs/epic-$EPIC_NUMBER/$FEATURE_SLUG.md

Next step:
  /plan:stories $EPIC_NUMBER

This will read the spec, derive story breakdown, and create all GitHub story issues.
```

### If FAIL:

Print the full review table with FAIL items highlighted and the Required Changes list.

```
Gate FAILED. Resolve the [N] issue(s) above, then re-run:
  /plan:spec $EPIC_NUMBER "$FEATURE_NAME"
```

## Error Handling

If template is missing at `.claude/workflow/templates/feature-spec.md`:
Stop and report: "Template not found at .claude/workflow/templates/feature-spec.md. Cannot create spec."
