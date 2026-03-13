# BudFin Document Governance and Authority Hierarchy

| Field   | Value      |
| ------- | ---------- |
| Status  | Approved   |
| Date    | 2026-03-07 |
| Version | 1.0        |

---

## 1. Purpose

This document establishes the authority hierarchy and governance rules for the BudFin documentation set. It defines which document is the authoritative source for each category of information and how conflicts between documents are resolved.

## 2. Authority Hierarchy

The BudFin documentation set follows a layered authority model. When documents conflict, the higher-authority source prevails within its designated scope.

| Level | Document                                          | Scope of Authority                                                                                                                                                                                           |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | PRD v2.1 (`docs/prd/BudFin_PRD_v2.1.md`)          | Product requirements, business rules, functional specifications, and logical data model                                                                                                                      |
| 2     | TDD v1.1 (`docs/tdd/`)                            | Technical architecture, physical schema, component design, API contracts, and security implementation                                                                                                        |
| 3     | `stack-versions.md`                               | Pinned runtime versions, dependency versions, and toolchain configuration                                                                                                                                    |
| 4     | Traceability Matrix (`10_traceability_matrix.md`) | Requirement-to-implementation mapping and test coverage index                                                                                                                                                |
| —     | ADRs (Architectural Decision Records)             | Located in `docs/adr/` with an index in `docs/tdd/09_decisions_log.md`. Each ADR should include a Status field with one of: Accepted, Rejected, Superseded (with reference to superseding ADR), or Deferred. |

## 3. Data Model Authority

- **PRD Section 9** presents the **logical/conceptual data model** — entity relationships, business attributes, and domain semantics.
- **TDD Section 3** (`03_data_architecture.md`) is the **authoritative physical schema** — column types, constraints, indexes, SQL DDL, and migration scripts.

When the PRD data model and TDD schema diverge, the TDD physical schema reflects the implemented reality and takes precedence for development purposes. The PRD should be updated to align during the next documentation cycle.

## 4. Conflict Resolution

| Conflict Type                                                        | Resolution Rule                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Business requirement vs technical design                             | PRD takes precedence; TDD must be updated to comply               |
| Technical implementation detail (API shape, schema type, error code) | TDD takes precedence; PRD should be updated to align              |
| Runtime or dependency version                                        | `stack-versions.md` is the single source of truth                 |
| Implementation status or delivery phase                              | Roadmap annotations and traceability matrix reflect actual status |

## 5. ADR Supersession Rule

When an ADR supersedes a previous ADR, both the new ADR and the decisions log must reference the supersession. The superseded ADR retains its content for historical reference but is marked with Status: Superseded.

## 6. Document Status Definitions

| Status          | Meaning                                                        |
| --------------- | -------------------------------------------------------------- |
| Draft           | Initial authoring; not yet reviewed or approved                |
| Approved        | Reviewed, approved, and baselined for implementation           |
| As-Built        | Updated post-implementation to reflect actual delivered system |
| Living Document | Continuously updated as the system evolves; no fixed baseline  |
