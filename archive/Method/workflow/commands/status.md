# Command: /status

## Purpose

Show the current state of all features in the pipeline.

## Trigger

User says: "status", "what's the status", "where are we", "/status"

## Protocol

### Step 1: Scan Status Directory

Read all files in `status/` directory.

### Step 2: Build Summary

```markdown
# Project Status

| Feature | Phase | Status | Blockers |
|---------|-------|--------|----------|
| user-auth | IMPLEMENT | IN_PROGRESS (8/12 tests green) | None |
| product-crud | REVIEW | WAITING | QA found 2 failures |
| dashboard | INTAKE | INTERVIEW | Awaiting architecture decision |

## Active Agents

| Agent | Feature | Task | Duration |
|-------|---------|------|----------|
| Implementer | user-auth | TDD Green — passing tests | 12 min |
| QA | product-crud | Edge case testing | 5 min |

## Recent Completions

| Feature | Completed | Duration |
|---------|-----------|----------|
| landing-page | 2026-03-02 | 3h 22m |
```

### Step 3: Present to User

Display the summary in the conversation. Highlight any blockers that need
human attention (interview decisions, failed gates).
