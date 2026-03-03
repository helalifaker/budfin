# BudFin Development Workflow

> Version: 2.0 | Updated: 2026-03-04 | Status: Active

## How to Use This Document

1. Open `Method/STATUS.md` — it tells you what phase you're on.
2. Find that phase below.
3. Work through the checklist top to bottom.
4. When the checklist is 100% complete, update `STATUS.md` and move to the next phase.

Never skip a phase. Never skip a checklist item.

---

## PROJECT WORKFLOW (run once)

These three phases set up the whole project. You are currently in Phase 2.

---

### Phase 1: DOCUMENT
> Freeze all requirements before writing a single line of code.

- [x] PRD v2.0 reviewed and frozen (`docs/prd/BudFin_PRD_v2.0.md`)
- [x] Project constitution written (`Method/agents/constitution.md`)
- [x] Technology constraints documented (TC-001 → TC-005)
- [x] Edge cases analyzed — 35 cases, severity rated (`docs/edge-cases/`)
- [x] All scope assumptions confirmed (SA-001 → SA-009)
- [x] 97 NFRs reviewed and prioritized

**Gate**: PRD is frozen. No scope changes after this point without a formal change request.

---

### Phase 2: DECOMPOSE
> Break the PRD into 13 GitHub Epics. This is your next step.

**Pre-requisites**: GitHub repository exists with Issues enabled.

- [ ] GitHub Projects board created (columns: Backlog / In Progress / In Review / Done)
- [ ] 13 features identified from PRD Feature Decomposition (see `docs/planning/PLANNING_PROCESS.md`)
- [ ] One GitHub Epic created per feature (`epic` label, MoSCoW priority in description)
- [ ] Each Epic has: summary, acceptance criteria reference, MVP/Target/Stretch tier
- [ ] Dependencies between epics documented in each Epic body
- [ ] All 13 Epics added to the GitHub Projects board (Backlog column)

**Gate**: All 13 Epics on the board. Board shows full project scope.

---

### Phase 3: SETUP
> Build the empty, running project skeleton before any feature work starts.

- [ ] Tech stack decided and recorded as `docs/adr/ADR-001-tech-stack.md`
- [ ] Repository structure created (`src/`, `tests/`, `migrations/`, `docs/adr/`)
- [ ] Docker Compose for local development starts cleanly (`docker compose up`)
- [ ] CI/CD pipeline configured (`ci/ci-pipeline.yml` → `.github/workflows/ci.yml`)
- [ ] PostgreSQL schema bootstrapped — first migration runs clean
- [ ] Test harness running — `npm test` passes with zero tests (green baseline)
- [ ] First CI run passes green on GitHub Actions

**Gate**: `npm test` green, `docker compose up` works, CI green. No feature code yet.

---

## FEATURE WORKFLOW (run once per Epic — 13 times total)

Repeat Phases 4–7 for every Epic. Start with the highest-priority MVP Epic.

Update `STATUS.md` when you start each Epic and each Story.

---

### Phase 4: SPECIFY
> Write the feature spec before touching any code.

**Agent**: Launch **Planner agent** (`Method/agents/orchestrator.md`) to review the spec.

- [ ] Epic read in full, acceptance criteria understood
- [ ] Feature spec written to `specs/<feature-name>.md` (use `Method/templates/feature-spec.md`)
  - [ ] Acceptance criteria defined for every story (testable, specific)
  - [ ] Edge cases from `docs/edge-cases/` cross-referenced
  - [ ] Data model changes listed (new tables, columns, constraints)
  - [ ] API endpoints listed (method, path, request/response shape)
- [ ] Planner agent reviews spec — no open questions, no ambiguities
- [ ] Epic broken into GitHub Story Issues (labeled `story`, linked to parent Epic)
- [ ] Stories ordered by dependency (no story depends on an unfinished story)

**Gate**: Spec approved, stories on board (In Progress: first story). No tests written yet.

---

### Phase 5: TDD RED
> Write failing tests before writing implementation code.

**Agent**: Launch **Implementer agent** (`Method/agents/implementer.md`) in test-writing mode.

- [ ] Test file created at `tests/<module>/<story>.test.ts`
- [ ] Unit tests written for every acceptance criterion in the spec
- [ ] Integration tests written for each API endpoint
- [ ] Explicit test cases for edge cases from `docs/edge-cases/`
- [ ] Implementer agent reviews test quality and completeness
- [ ] `npm test` run — all new tests confirmed **RED** (failing, not erroring)
- [ ] Coverage target confirmed: ≥ 80% for this story

**Gate**: All new tests are RED. No implementation code written yet.

---

### Phase 6: IMPLEMENT
> Write code to make the failing tests pass. No more, no less.

**Agent**: Launch **Implementer agent** (`Method/agents/implementer.md`) for coding.
For large stories (>3 independent modules), launch a second Implementer agent in parallel.

- [ ] Implementation code written to pass failing tests
- [ ] Refactoring done — SOLID principles, no duplication, tests still green after each step
- [ ] No debug code, no `TODO` comments, no `console.log`
- [ ] Decimal.js used for ALL monetary calculations (TC-001 — never IEEE 754)
- [ ] YEARFRAC algorithm used for date calculations (TC-002)
- [ ] Linter passes — 0 errors, 0 warnings
- [ ] `npm test` — all tests **GREEN**, coverage ≥ 80%
- [ ] PR created on GitHub, linked to the Story Issue

**Gate**: All tests green, coverage met, PR open. No review yet.

---

### Phase 7: REVIEW
> Three agents review in parallel before merging.

**Launch all three agents simultaneously** (one swarm call):

| Agent | File | Responsibility |
|-------|------|----------------|
| Reviewer | `Method/agents/reviewer.md` | Code quality, security, performance, maintainability |
| QA | `Method/agents/qa.md` | Edge cases, acceptance criteria, regression risk |
| Documentor | `Method/agents/documentor.md` | API docs, CHANGELOG, ADRs if decisions changed |

- [ ] **Reviewer agent** run — review-checklist.md used (`Method/references/review-checklist.md`)
- [ ] **QA agent** run — all 35 edge cases checked for relevance *(parallel)*
- [ ] **Documentor agent** run — docs updated *(parallel with QA)*
- [ ] All **blocker**-severity issues resolved (no exceptions)
- [ ] Warning-severity issues resolved or explicitly accepted with justification
- [ ] Tests still green after review changes applied
- [ ] PR approved (at least: Reviewer agent sign-off)
- [ ] PR merged → Story Issue auto-closes → Epic progress updated

**Gate**: PR merged, issue closed, CHANGELOG updated.

---

## Agent Reference

| Agent | File | Used In |
|-------|------|---------|
| Orchestrator / Planner | `Method/agents/orchestrator.md` | Phase 4 |
| Implementer | `Method/agents/implementer.md` | Phases 5, 6 |
| Reviewer | `Method/agents/reviewer.md` | Phase 7 |
| QA | `Method/agents/qa.md` | Phase 7 |
| Documentor | `Method/agents/documentor.md` | Phase 7 |
| Designer | `Method/agents/designer.md` | Phase 4 (UI features only) |

## Template Reference

| Template | File | Used In |
|----------|------|---------|
| Feature Spec | `Method/templates/feature-spec.md` | Phase 4 |
| Design Spec | `Method/templates/design-spec.md` | Phase 4 (UI) |
| ADR | `Method/templates/adr.md` | Phase 3 |

## Review Checklist Reference

`Method/references/review-checklist.md` — Used by Reviewer agent in Phase 7.
Severity levels: **Blocker** (must fix), **Warning** (should fix), **Nit** (optional).
