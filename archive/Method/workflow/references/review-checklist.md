# Code Review Checklist

Quick reference for the Reviewer Agent. Full protocol in `agents/reviewer.md`.

## Blockers (must fix)

- [ ] No SQL injection, XSS, CSRF vulnerabilities
- [ ] Auth/authz checks on all protected routes
- [ ] No secrets in code
- [ ] Input validation on all user data
- [ ] Implementation matches spec
- [ ] All edge cases handled
- [ ] Error handling comprehensive
- [ ] Tests are meaningful and deterministic

## Warnings (should fix)

- [ ] No N+1 queries
- [ ] No unbounded queries
- [ ] No memory leaks
- [ ] Expensive operations cached/memoized
- [ ] Functions have single responsibility
- [ ] No dead code
- [ ] No code duplication
- [ ] Follows project patterns
- [ ] Backward compatible

## Nits (optional)

- [ ] Naming could be clearer
- [ ] Comments could be improved
- [ ] Minor formatting preferences
