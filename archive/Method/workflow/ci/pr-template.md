# Pull Request Template

Save this as `.github/pull_request_template.md` in your project.

---

## Summary

Brief description of what this PR does and why.

## Feature Spec

Link: `specs/<feature-name>.md`

## Type

- [ ] Feature (new functionality)
- [ ] Fix (bug fix)
- [ ] Refactor (no behavior change)
- [ ] Docs (documentation only)
- [ ] CI (pipeline changes)

## Checklist

### TDD
- [ ] Tests written BEFORE implementation (Red phase completed)
- [ ] All tests passing (Green phase completed)
- [ ] Coverage >= 90%

### Quality
- [ ] Lint clean (zero warnings)
- [ ] Type check clean (zero errors)
- [ ] No `any` types without justification
- [ ] No hardcoded secrets or config values

### Review
- [ ] Code review completed (`reviews/<feature>-cr.md`)
- [ ] QA testing completed (`reviews/<feature>-qa.md`)
- [ ] Zero blockers in code review
- [ ] Zero failures in QA

### Documentation
- [ ] API docs updated (if applicable)
- [ ] Component docs updated (if applicable)
- [ ] ADR created (if architecture decision made)
- [ ] CHANGELOG.md updated
- [ ] README.md updated (if setup changed)

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader tested
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible

## Screenshots / Recordings

If UI changes, attach before/after screenshots or a recording.

## Deployment Notes

Any special steps needed for deployment (env vars, migrations, etc.).
