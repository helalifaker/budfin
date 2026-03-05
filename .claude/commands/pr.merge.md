---
name: pr:merge
description: >
  Verify CI + review approval, squash-merge a story PR, and roll up Epic status if all
  stories are complete. Usage - /pr:merge [story-issue-number]
argument-hint: "[story-issue-number]"
allowed-tools: Bash, Read, Skill
---

Parse the argument:

- `story-#`: the GitHub issue number for the story whose PR is being merged (required integer)

If the argument is missing, ask the user for the story issue number before proceeding.

## Step 1 — Invoke Skill (MERGE mode)

Use the Skill tool to invoke: `impl-commit`

Run in **MERGE mode** for story `[argument]`.

Follow the skill exactly. Do not skip or reorder steps.

## Step 2 — Rules

- Run all pre-flight gates (test / lint / typecheck) before any merge attempt
- Never merge if CI checks are not green — report the failing check and stop
- Never merge a draft PR — confirm it has been marked ready first
- Squash merge only; no regular or rebase merges
- After merge: always run Epic rollup check per skill instructions

## Step 3 — Output

When done, report to the user:

```
Merged:  PR #[N] → [squash-commit-hash]
Closed:  Story #[story-#]
Epic #[epic-#]: [complete / N stories remaining]
```
