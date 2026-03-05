# Feature Spec: [Feature Name]

> Epic: #[issue-number] | Phase: 4 — SPECIFY | Status: Draft | Date: YYYY-MM-DD

## Summary

[One paragraph describing what this feature does and why it exists. Reference the PRD section.]

## Acceptance Criteria

Each criterion must be testable and specific. Use "Given / When / Then" or plain language.

- [ ] AC-01: [Given context, when action, then outcome]
- [ ] AC-02:
- [ ] AC-03:

## Stories

| # | Story | Depends On | GitHub Issue |
|---|-------|------------|--------------|
| 1 | [Story title] | — | #[issue] |
| 2 | [Story title] | Story 1 | #[issue] |

## Data Model Changes

List every new table, column, constraint, or index. Leave blank if none.

```sql
-- Example:
-- ALTER TABLE budget_cycles ADD COLUMN locked_at TIMESTAMPTZ;
-- CREATE INDEX idx_budget_cycles_locked ON budget_cycles(locked_at) WHERE locked_at IS NOT NULL;
```

## API Endpoints

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| POST | /api/... | `{ field: type }` | `{ field: type }` | Bearer |

## Edge Cases Cross-Reference

From `docs/edge-cases/` — list all relevant cases for this feature.

| Case ID | Description | Handling |
|---------|-------------|---------|
| EC-001 | | |

## Out of Scope

List explicitly what this spec does NOT cover (prevents scope creep).

- [Item intentionally excluded]

## Open Questions

Track any unresolved ambiguities. Must be empty before gate passes.

- [ ] Q: [Question] → A: [Answer or "TBD by YYYY-MM-DD"]

## Planner Agent Sign-Off

- [ ] No open questions
- [ ] Acceptance criteria are testable
- [ ] Edge cases cross-referenced
- [ ] Data model complete
- [ ] API contract complete
