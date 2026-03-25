# ADR-033: PDPL Compliance Deferral

**Status:** Accepted
**Date:** 2026-03-25

## Context

The TDD data architecture spec (Tables 24-25) defines `pdpl_consent_records` and `pdpl_data_requests` models for PDPL (Personal Data Protection Law) Article 11-14 compliance. These tables track employee consent for data processing and data subject access/correction/deletion requests.

BudFin currently stores encrypted salary data (5 fields via pgcrypto pgp_sym_encrypt) and employee PII. PDPL compliance requires documented consent and request-handling workflows.

## Decision

Defer PDPL consent and data request tracking to a post-v1 compliance sprint.

**Rationale:**

1. BudFin is an internal school budgeting tool — not public-facing. PDPL risk is lower.
2. The system already encrypts salary data at rest (pgcrypto) and in transit (TLS).
3. RBAC restricts salary access to Admin and BudgetOwner roles only.
4. Consent tracking requires a UI workflow (consent forms, request dashboards) that is outside the scope of the current budget planning feature set.
5. The school's existing HR system likely handles PDPL consent for employee data.

## Consequences

- Tables 24-25 from the TDD spec will NOT be implemented in v1.
- A compliance review should be scheduled before any public-facing deployment.
- When implemented, models should follow the spec definitions in `docs/tdd/03_data_architecture.md`.
