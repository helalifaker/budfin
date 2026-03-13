---
name: docs-governance
description: Audit, classify, deduplicate, sync, and archive BudFin repository documentation. Use when asked to tidy docs, sync documentation with the current repo state, reduce duplicate or superseded documents, classify misplaced files, maintain documentation indexes, or move stale working docs into the archive safely.
---

# Docs Governance

Use this skill for recurring documentation maintenance in BudFin. The goal is to keep the repo's
documentation discoverable, low-duplication, and safely archived without disturbing authoritative
records.

## Read first

1. `docs/README.md`
2. `docs/tdd/00_document_governance.md`
3. `.claude/skills/docs-governance/references/doc-taxonomy.md`

Then load only the files needed for the current cleanup scope.

## Quick start

1. Build an inventory first:

    ```bash
    python3 .claude/skills/docs-governance/scripts/inventory_docs.py --root .
    ```

2. If the request is scoped, limit the scan:

    ```bash
    python3 .claude/skills/docs-governance/scripts/inventory_docs.py --root . --scope docs/plans
    ```

3. Use the inventory plus the taxonomy reference to decide:
    - which docs are authoritative and must stay where they are
    - which docs are working material and can be archived when superseded
    - which docs are misplaced and should move into a clearer category
    - which docs are duplicates, revisions, or near-duplicates that need consolidation

## Core rules

1. Preserve authority. If two docs disagree, keep the higher-authority source and treat the other doc as needing alignment or archival.
2. Prefer archiving over deleting. Do not remove historical work products unless the user explicitly asks for deletion.
3. Keep stable docs stable. Do not archive `docs/prd/`, `docs/tdd/`, `docs/adr/`, `docs/specs/`, or `docs/ui-ux-spec/` by default.
4. Only make automatic moves when classification is clear from path, title, and document purpose. If intent is ambiguous, stop and report the decision needed.
5. Update references after any move. Search for inbound links before and after renaming or archiving a file.
6. Keep archive paths predictable: `docs/archive/<category>/<year>/filename`.
7. Use lowercase kebab-case for new file and folder names. Existing legacy folders with spaces or uppercase letters may remain until an intentional migration is performed.

## Safe sync workflow

1. Run the inventory script and review:
    - exact duplicates
    - similar-title groups
    - naming anomalies
    - archive candidates
2. Read the candidate docs only as needed to confirm the report.
3. Decide the canonical location using the taxonomy reference.
4. Apply only safe changes:
    - move a misplaced doc into the right category
    - archive an older dated working doc when a newer replacement is clearly present
    - update `docs/README.md` if the taxonomy or examples need to stay current
    - fix links that break because of a move
5. Re-run the inventory to verify the result and summarize any unresolved duplicates.

## Dedupe guidance

- Treat exact content matches as duplicates; keep the authoritative or better-located copy.
- Treat dated working docs with the same normalized topic as a version chain; keep the newest live doc unless an older one is still the canonical reference.
- Treat `v2`, `final`, `draft`, and similarly suffixed filenames as review signals, not authority signals. Confirm which revision is current before archiving the rest.
- When two documents cover different scopes despite similar titles, keep both and record the distinction in the summary instead of forcing a merge.

## Archive guidance

- Archive working material such as plans, audits, reconciliation notes, analyses, and superseded process drafts.
- Preserve filenames when archiving so git history and references remain understandable.
- If an archived document is still useful, leave it in place under `docs/archive/...`; do not rewrite its contents unless a link or short archive note is needed.

## Verification

- `python3 .claude/skills/docs-governance/scripts/inventory_docs.py --root . [--scope ...]`
- `pnpm lint:md` if the cleanup touched multiple Markdown files or changed links broadly

## Deliverable

Always finish with:

1. what was reclassified, archived, or left unchanged
2. exact duplicate or superseded groups that still need human judgment
3. any taxonomy or naming issues that should be handled in a later pass
