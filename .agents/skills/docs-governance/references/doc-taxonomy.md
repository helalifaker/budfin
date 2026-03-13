# BudFin Documentation Taxonomy

Use this reference to classify documentation before moving or archiving anything.

## Authority order

1. `docs/prd/`
2. `docs/tdd/`
3. `docs/adr/`
4. `docs/specs/`
5. `docs/ui-ux-spec/`
6. Operational working docs such as plans, reviews, analysis, reconciliation, and process notes

If documents conflict, follow `docs/tdd/00_document_governance.md`.

## Canonical live folders

| Path                   | Purpose                                                      | Archive by default?                   |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------- |
| `docs/prd/`            | Product requirements and business rules                      | No                                    |
| `docs/tdd/`            | Technical design, governance, and implementation constraints | No                                    |
| `docs/adr/`            | Architectural decisions                                      | No                                    |
| `docs/specs/epic-*/`   | Feature specs by epic                                        | No                                    |
| `docs/ui-ux-spec/`     | Enduring UI and UX specification set                         | No                                    |
| `docs/Process/`        | Page or workflow process definitions                         | Usually no, unless clearly superseded |
| `docs/plans/`          | Dated implementation, redesign, or execution plans           | Yes, when superseded or completed     |
| `docs/reviews/`        | Audits, review findings, and review artifacts                | Yes, when historical                  |
| `docs/analysis/`       | Research or exploratory analysis                             | Yes, when historical                  |
| `docs/reconciliation/` | Cross-document alignment outputs                             | Yes, when historical                  |
| `docs/edge-cases/`     | Edge-case studies and adversarial analysis                   | Case by case                          |

## Archive layout

Archive working documents under:

```text
docs/archive/<category>/<year>/<original-file-name>
```

Examples:

- `docs/archive/plans/2026/2026-03-08-360-audit-report.md`
- `docs/archive/reviews/2026/2026-03-05-uiux-spec-review.md`

## Naming rules

- New enduring docs: lowercase kebab-case, stable names.
- New working docs: `YYYY-MM-DD-topic.md`.
- Keep root-level docs limited to repo-wide entry points such as `README.md`, `CHANGELOG.md`, and agent instructions.
- Treat legacy paths containing spaces or uppercase letters as migration candidates, not automatic move targets.

## Safe move rules

- Move only when the destination category is obvious from the document's purpose.
- Before moving, search for inbound references.
- After moving, update links in nearby docs, command files, and indexes.
- If a folder is effectively deprecated but still contains live docs, migrate in a dedicated pass instead of mixing it into routine sync work.
