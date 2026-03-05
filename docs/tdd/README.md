# BudFin Technical Design Document v1.0 — Navigation Index

| Field | Value |
| ------------------ | ------------------------ |
| Document Version | 1.0 |
| Date | March 3, 2026 |
| Status | Draft |
| Related PRD | BudFin PRD v2.0 |

## Purpose

This document set is the complete Technical Design Document (TDD) and Software Architecture Document (SAD) for BudFin, the school financial planning application built for EFIR (École Française Internationale de Riyad). The TDD translates every functional requirement from the PRD v2.0 into concrete technical design decisions, data models, API contracts, and implementation plans.

The documentation is split across 12 files (this README, a pinned stack-versions manifest, and 10 numbered content files) to keep each section focused and navigable. Together they provide a single source of truth for architecture, component design, data architecture, API contracts, security, infrastructure, testing, implementation roadmap, decision records, and full requirements traceability.

## Table of Contents

| # | File | Sections | Description |
| --- | ------ | ---------- | ------------- |
| — | [`stack-versions.md`](stack-versions.md) | — | Pinned runtime and dependency version manifest |
| 1 | [`01_overview.md`](01_overview.md) | 0–3 | Document Control, Executive Summary, System Context, Architecture Overview |
| 2 | [`02_component_design.md`](02_component_design.md) | 4 | Detailed Component Design (8 components) |
| 3 | [`03_data_architecture.md`](03_data_architecture.md) | 5 | Data Architecture, Full SQL DDL, Data Flows, Migration |
| 4 | [`04_api_contract.md`](04_api_contract.md) | 6 | REST API Endpoint Catalog and Request/Response Schemas |
| 5 | [`05_security.md`](05_security.md) | 7 | Security Architecture, RBAC, Encryption, Threat Model |
| 6 | [`06_infrastructure.md`](06_infrastructure.md) | 8 | Infrastructure, Docker, CI/CD, Observability |
| 7 | [`07_nfr_and_testing.md`](07_nfr_and_testing.md) | 9–10 | NFR Design and Testing Strategy |
| 8 | [`08_implementation_roadmap.md`](08_implementation_roadmap.md) | 11 | 6-Phase Implementation Roadmap (30 Weeks) |
| 9 | [`09_decisions_log.md`](09_decisions_log.md) | 12 | Open Questions, Assumptions, and ADRs |
| 10 | [`10_traceability_matrix.md`](10_traceability_matrix.md) | Appendix A | FR Traceability Matrix (130+ requirements) |

## How to Use This Document Set

Different readers have different entry points. Use the guide below to find the most relevant reading order for your role.

### Tech Lead

Read in order: `01_overview.md` (full architecture context) → `02_component_design.md` (component responsibilities and interfaces) → `03_data_architecture.md` (schema and data flows) → `09_decisions_log.md` (ADRs and open questions) → `08_implementation_roadmap.md` (delivery phases). Refer to `05_security.md` and `06_infrastructure.md` for deployment and compliance review.

### Developers

Start with `01_overview.md` Sections 1 and 3 (tech decisions and layer architecture). Then read `02_component_design.md` for the component you are assigned. Use `04_api_contract.md` as the API reference during implementation. Consult `03_data_architecture.md` for schema details. Check `07_nfr_and_testing.md` for testing expectations before writing tests.

### DBA

Begin with `03_data_architecture.md` (full DDL, indexes, constraints, migration plan). Then review `05_security.md` Section 7.3 for field-level encryption (pgcrypto) and `06_infrastructure.md` for backup/recovery strategy.

### QA

Start with `07_nfr_and_testing.md` (test strategy, coverage targets, test data). Cross-reference `10_traceability_matrix.md` to verify every FR has test coverage. Use `04_api_contract.md` for API-level test design.

### Finance SME / CAO

Read `01_overview.md` Section 1 (executive summary and key decisions). Review `08_implementation_roadmap.md` for delivery timeline. Consult `10_traceability_matrix.md` to confirm all business requirements are addressed. Use `09_decisions_log.md` to review assumptions that need business validation.

## Architecture at a Glance

- **Monolithic SPA + REST API** deployed as a single Docker Compose stack — appropriate for a single-school, single-tenant system with fewer than 20 concurrent users.
- **Decimal.js for all monetary computation** — IEEE 754 floating-point is never used for financial values. PostgreSQL `DECIMAL(15,4)` stores monetary data at full precision.
- **Version-isolated budget snapshots** — each budget version is a self-contained copy of all financial data, ensuring historical integrity and conflict-free parallel editing.
- **PDPL-compliant security** — field-level pgcrypto encryption for PII, JWT authentication with bcrypt-12, RBAC with four trust levels, and full append-only audit trail.

## Key Constraints

These technical constraints (from PRD v2.0) are non-negotiable and govern every design decision in this document set:

| ID | Constraint | Summary |
| ---- | ----------- | --------- |
| TC-001 | Fixed-Point Decimal | All monetary computations use Decimal.js; native JavaScript `Number` is prohibited for financial values |
| TC-002 | YEARFRAC Algorithm | Custom US 30/360 implementation; validated against 168 employee records from EFIR payroll |
| TC-003 | Database Decimal Precision | `DECIMAL(15,4)` for monetary, `DECIMAL(7,6)` for rates, `DECIMAL(5,4)` for hourly percentages, `DECIMAL(7,4)` for years of service |
| TC-004 | Rounding Policy | Round-half-up at presentation layer only; full precision retained in database |
| TC-005 | Date Arithmetic | Gregorian calendar, AST (UTC+3), academic year split: AY1 Jan–Jun, Summer Jul–Aug, AY2 Sep–Dec, 36 academic weeks |
