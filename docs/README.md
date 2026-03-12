# BudFin Documentation Map

This file is the operational map for BudFin documentation. Use it to classify documents, decide
what stays live, and determine what can be archived.

## Authority

For conflict resolution and source-of-truth rules, defer to
`docs/tdd/00_document_governance.md`.

## Live documentation areas

| Path                   | Purpose                                                   | Archive by default?  |
| ---------------------- | --------------------------------------------------------- | -------------------- |
| `docs/prd/`            | Product requirements and business rules                   | No                   |
| `docs/tdd/`            | Technical design, governance, and engineering constraints | No                   |
| `docs/adr/`            | Architectural decisions                                   | No                   |
| `docs/specs/epic-*/`   | Feature specs grouped by epic                             | No                   |
| `docs/ui-ux-spec/`     | Enduring UI and UX guidance                               | No                   |
| `docs/Process/`        | Process definitions for pages and workflows               | Usually no           |
| `docs/plans/`          | Working implementation and redesign plans                 | Yes, when superseded |
| `docs/reviews/`        | Review findings and audit outputs                         | Yes, when historical |
| `docs/analysis/`       | Research and exploratory analysis                         | Yes, when historical |
| `docs/reconciliation/` | Alignment and reconciliation artifacts                    | Yes, when historical |
| `docs/edge-cases/`     | Edge-case studies and adversarial analysis                | Case by case         |

## Archive layout

Archive working documents under:

```text
docs/archive/<category>/<year>/<original-file-name>
```

Examples:

- `docs/archive/plans/2026/2026-03-08-360-audit-report.md`
- `docs/archive/reviews/2026/2026-03-05-uiux-spec-review.md`

## Naming rules

- New stable docs should use lowercase kebab-case names.
- New working docs should use `YYYY-MM-DD-topic.md`.
- Keep root-level docs for repo-wide entry points only.
- Legacy folders with spaces or uppercase letters are tolerated for now and should be migrated in a dedicated cleanup pass, not casually.

## Maintenance workflow

Use the repo-local command:

```text
/docs:sync [--audit] [--deep] [path]
```

Suggested usage:

- `/docs:sync --audit` for a read-only documentation health check
- `/docs:sync docs/plans` for a scoped cleanup
- `/docs:sync --deep docs` when duplicate detection needs more review
