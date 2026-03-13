---
name: impl:commit
description: >
    Commit story changes, push branch, and open draft PR linked to story/epic.
    Usage - /impl:commit [story-issue-number]
argument-hint: '[story-issue-number]'
allowed-tools: Bash, Read, Glob, Grep, Skill
---

> **Internal command.** Called by `/impl:story` automatically.

Parse the argument:

- `story-#`: the GitHub issue number for the story being committed (required integer)

If the argument is missing, ask the user for the story issue number before proceeding.

## Step 1 — Invoke Skill (COMMIT mode)

Use the Skill tool to invoke: `impl-commit`

Run in **COMMIT mode** for story `[argument]`.

Follow the skill exactly. Do not skip or reorder steps.

## Step 2 — Rules

- Complete all pre-flight gates in the skill before any git operation
- Generate the commit type and scope from the story issue — never invent them
- Create the PR as a **DRAFT** — never open it as ready
- The PR body must include `Fixes #[story-#]` and `Part of Epic #[epic-#]`
- Do not push if pre-flight gates fail; report the failure to the user

## Step 3 — Output

When done, report to the user:

```
Branch:  [branch-name]
Commit:  [hash] [subject]
PR:      [url] (draft)
Story #[N] is now In Review.
```
