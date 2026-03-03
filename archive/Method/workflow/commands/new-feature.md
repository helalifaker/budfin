# Command: /new-feature <name>

## Purpose

Start the full 7-phase workflow for a new feature. Creates tracking files,
determines if an interview is needed, and kicks off the pipeline.

## Trigger

User says: "new feature <name>", "add <name>", "implement <name>", "/new-feature <name>"

## Protocol

### Step 1: Create Branch

```bash
git checkout -b feature/<name>
```

### Step 2: Create Status File

Create `status/<name>.md`:

```markdown
# Feature: <name>

## Current Phase: INTAKE
## Status: IN_PROGRESS

### Phase Log

| Phase | Status | Agent | Started | Completed | Notes |
|-------|--------|-------|---------|-----------|-------|
| INTAKE | IN_PROGRESS | Architect | <date> | — | — |
```

### Step 3: Evaluate Complexity

Read the user's description and determine if the interview protocol is needed.

**Interview triggers** (any one is sufficient):
- New data model or schema change
- New third-party integration
- Architecture decision required
- UX flow affecting multiple screens
- Security-sensitive functionality

**If interview needed:** Run `/interview <name>`
**If simple task:** Generate a minimal spec from the user's description and proceed

### Step 4: Generate Feature Spec

Write `specs/<name>.md` using `templates/feature-spec.md`.

### Step 5: Advance to Design Phase

If the feature has UI components, advance to Phase 2 (Design).
If backend-only, generate an API contract and skip to Phase 3 (Contract/TDD Red).

### Step 6: Run Remaining Phases

The Orchestrator takes over from here, advancing through each phase
automatically until the feature is complete or a gate fails.

## Output

- Feature branch created
- Status tracking file created
- Feature spec written
- Workflow initiated
