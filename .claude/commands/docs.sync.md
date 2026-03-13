---
name: docs:sync
description: >-
    Audit and maintain BudFin documentation using the repo-local docs-governance
    skill. Inventories docs, classifies misplaced files, flags duplicates,
    archives clearly superseded working docs, and updates links or indexes as
    needed. Use `--audit` for a read-only pass or omit it to apply only safe
    cleanup changes. Usage - /docs:sync [--audit] [--deep] [path]
argument-hint: "[--audit] [--deep] [path]"
allowed-tools: Read, Edit, Bash, Grep, Glob
---

Load `.claude/skills/docs-governance/SKILL.md` and follow it.

Parse the arguments:

- `--audit`: inventory and recommendations only; do not modify files
- `--deep`: spend extra time reading candidate duplicates before deciding
- `path`: optional scope, defaults to `docs`

If no path is provided, use `docs`.

## Step 1: Build inventory

Run:

```bash
python3 .claude/skills/docs-governance/scripts/inventory_docs.py --root . --scope [path]
```

If `--audit` is present, stop after reporting findings and recommendations.

## Step 2: Confirm the policy inputs

Read:

1. `docs/README.md`
2. `docs/tdd/00_document_governance.md`
3. `.claude/skills/docs-governance/references/doc-taxonomy.md`

Then read only the candidate files needed to confirm:

- archive candidates
- misclassified documents
- exact or similar duplicates
- broken or stale links caused by moves

If `--deep` is present, inspect every duplicate group before applying changes.

## Step 3: Apply only safe cleanup changes

Allowed changes:

- move a clearly misplaced document into the correct live folder
- move a clearly superseded working document to `docs/archive/<category>/<year>/`
- update links or indexes that break because of a move
- update `docs/README.md` if examples or taxonomy notes need to stay accurate

Do not:

- delete documentation files
- archive `docs/prd/`, `docs/tdd/`, `docs/adr/`, `docs/specs/`, or `docs/ui-ux-spec/` unless the user explicitly asks
- merge ambiguous duplicates without confirming which document is authoritative

## Step 4: Re-run the inventory

Run the inventory again for the same scope and confirm the cleanup improved the result.

## Step 5: Report

Always report:

1. inventory summary
2. files moved or archived
3. duplicate groups left unresolved
4. any legacy naming or taxonomy issues that should be handled later
