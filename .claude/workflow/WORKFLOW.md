# BudFin Development Workflow

> Version: 3.0 | Updated: 2026-03-05 | Status: Active

## How to Use This Document

1. Open `.claude/workflow/STATUS.md` — it tells you what phase you're on.
2. Find that phase below.
3. Work through the checklist top to bottom.
4. When the checklist is 100% complete, run `/workflow:advance` to gate-check and move to the next phase.

Never skip a phase. Never skip a checklist item.

---

## Command Reference

8 user-facing commands. See `.claude/COMMANDS.md` for the full decision tree.

| # | Command | Phase | Purpose |
|---|---------|-------|---------|
| 1 | `/workflow:run [epic-#]` | 4-7 | Full Epic lifecycle: health check -> spec -> stories -> implement -> review -> visual audit -> merge -> rollup |
| 2 | `/workflow:status` | Any | Phase, checklist, `>>> NEXT:` recommendation |
| 3 | `/fix:all [symptom?]` | Any | Fix everything (or debug a specific symptom) |
| 4 | `/pr:drive [--pr N / --epic #]` | 5-7 | Push PRs to merge autonomously |
| 5 | `/workflow:advance` | Any | Manual phase gate check |
| 6 | `/plan:adr "[title]"` | Any | Record architectural decision |
| 7 | `/plan:spec [epic-#]` | 4 | Write feature spec interactively |
| 8 | `/impl:story [story-#]` | 5-6 | Implement a single story (5-agent TDD swarm) |

### Error Type -> Fix Command

| Error | Fix Command |
|-------|-------------|
| ESLint / Prettier / markdownlint errors | `/fix:all --lint` |
| TypeScript type errors | `/fix:all --types` |
| Vitest test failures | `/fix:all --tests` |
| JWT / RBAC / SQL injection / audit | `/fix:all --security` |
| TC-001 native arithmetic / JSON serialization | `/fix:all --precision` |
| Unexplained error -- need root cause | `/fix:all "[symptom]"` |
| Multiple error types | `/fix:all` |

---

## PROJECT WORKFLOW (run once)

These three phases run once at project start.

---

### Phase 1: DOCUMENT

> Freeze all requirements before writing a single line of code.

- [x] PRD v2.0 reviewed and frozen (`docs/prd/BudFin_PRD_v2.0.md`)
- [x] PRD v2.0 reviewed and frozen (serves as project constitution)
- [x] Technology constraints documented (TC-001 → TC-005)
- [x] Edge cases analyzed — 35 cases, severity rated (`docs/edge-cases/`)
- [x] All scope assumptions confirmed (SA-001 → SA-009)
- [x] 97 NFRs reviewed and prioritized

**Gate**: PRD is frozen. No scope changes after this point without a formal change request.

---

### Phase 2: DECOMPOSE

> Break the PRD into 13 GitHub Epics. This is your next step.

**Pre-requisites**: GitHub repository exists with Issues enabled.

**Commands**: Run `/plan:decompose` to bulk-create all 13 epics and the Projects board automatically.

- [ ] GitHub Projects board created (columns: Backlog / In Progress / In Review / Done)
- [ ] 13 features identified from PRD Feature Decomposition (see Phase 2 above)
- [ ] One GitHub Epic created per feature (`epic` label, MoSCoW priority in description)
- [ ] Each Epic has: summary, acceptance criteria reference, MVP/Target/Stretch tier
- [ ] Dependencies between epics documented in each Epic body
- [ ] All 13 Epics added to the GitHub Projects board (Backlog column)

**Gate**: All 13 Epics on the board. Board shows full project scope.

---

### Phase 3: SETUP

> Build the empty, running project skeleton before any feature work starts.

- [x] Tech stack decided and recorded as `docs/adr/ADR-001-tech-stack.md`
- [x] Repository structure created (`src/`, `tests/`, `migrations/`, `docs/adr/`)
- [x] Docker Compose for local development starts cleanly (`docker compose up`)
- [x] CI/CD pipeline configured (`ci/ci-pipeline.yml` → `.github/workflows/ci.yml`)
- [x] PostgreSQL schema bootstrapped — first migration runs clean
- [x] Test harness running — `pnpm test` passes with zero tests (green baseline)
- [x] First CI run passes green on GitHub Actions

**Gate**: `pnpm test` green, `docker compose up` works, CI green. No feature code yet.

---

## FEATURE WORKFLOW (run once per Epic — 13 times total)

Repeat Phases 4–7 for every Epic. Start with the highest-priority MVP Epic.

Update `.claude/workflow/STATUS.md` when you start each Epic and each Story.

---

### Phase 4: SPECIFY

> Write the feature spec before touching any code.

**Commands**:
- `/plan:spec [epic-N] "[feature name]"` — creates spec interactively, runs `workflow-orchestrator` review
- `/plan:stories [epic-N]` — batch-creates all GitHub Story issues from approved spec

**Agent**: **Orchestrator / Planner** (`.claude/agents/workflow-orchestrator.md`) — launched
automatically by `/plan:spec` to gate-check the completed spec.

**Spec location**: `docs/specs/epic-N/<feature-slug>.md`

- [ ] Epic read in full, acceptance criteria understood
- [ ] Run `/plan:spec [N] "[feature name]"` to create and populate the spec
  - [ ] Summary written (references PRD section)
  - [ ] Acceptance criteria defined — every item is testable and specific (Given/When/Then)
  - [ ] Edge cases from `docs/edge-cases/` cross-referenced by case ID
  - [ ] Data model changes fully specified (table, column, type, constraint, index)
  - [ ] API endpoints listed (method, path, request schema, response schema, auth)
  - [ ] Out of Scope section written — explicit exclusions prevent scope creep
  - [ ] Open Questions section is empty — every question answered
- [ ] Orchestrator agent review: PASS (no open questions, no vague criteria)
- [ ] Run `/plan:stories [N]` — all Story issues created and linked to Epic
- [ ] Stories added to GitHub Projects board (In Progress column: first story)
- [ ] Stories ordered by dependency (no story depends on an unfinished story)

**Gate**: Spec approved by Orchestrator agent. All stories created and on the board.
No tests written yet.

---

### Phase 5: TDD RED

> Write failing tests before writing implementation code.

**Command**: `/impl:story [story-#]` — launches `story-orchestrator` which spawns a 5-agent swarm:
`story-orchestrator` + domain implementer (`api-implementer` / `frontend-implementer` / `calculation-implementer`) + `workflow-reviewer` + `workflow-qa` + `workflow-documentor`.

**TDD RED phase** — orchestrator assigns test-writing to the domain implementer:

- [ ] Spec read at `docs/specs/epic-N/<feature-slug>.md` — all ACs confirmed understood
- [ ] Test files created at correct path (`apps/api/src/routes/…` or `apps/web/src/components/…`)
- [ ] Unit tests written for every acceptance criterion in the spec
- [ ] Integration tests written for each API endpoint
- [ ] Explicit test cases for edge cases from `docs/edge-cases/`
- [ ] `pnpm test` run — all new tests confirmed **RED** (failing, not erroring)
- [ ] Coverage target confirmed: ≥ 80% for this story

**Gate**: All new tests are RED. No implementation code written yet.

---

### Phase 6: IMPLEMENT

> Write code to make the failing tests pass. No more, no less.

**Command**: `/impl:story [story-#]` — continues from RED. `story-orchestrator` assigns GREEN phase to domain implementer.

Use scaffolding shortcuts when needed:
- `/impl:route "[resource]" "[method]"` — Fastify 5 route + test stub
- `/impl:model "[ModelName]"` — Prisma 6 model + migrate
- `/impl:component "[ComponentName]"` — React 19 component + test stub

- [ ] Implementation code written to pass failing tests
- [ ] Refactoring done — SOLID principles, no duplication, tests still green after each step
- [ ] No debug code, no `TODO` comments, no `console.log`
- [ ] Decimal.js used for ALL monetary calculations (TC-001 — never IEEE 754)
- [ ] YEARFRAC algorithm used for date calculations (TC-002)
- [ ] Linter passes — 0 errors, 0 warnings
- [ ] `pnpm test` — all tests **GREEN**, coverage ≥ 80%
- [ ] Feature branch created (not on main)
- [ ] Draft PR opened with `Fixes #[story-#]` in body
- [ ] PR created on GitHub, linked to the Story Issue

**Gate**: All tests green, coverage met, PR open. No review yet.

---

### Phase 7: REVIEW

> PR-driven review: CI fix -> review agents -> conversation resolution -> visual audit -> merge.

**Commands**: `/pr:drive --epic [epic-#]` — autonomous PR driver that loops each PR through CI checks,
auto-fixes, review agents, conversation resolution, and squash-merge. Also: `/pr:drive [story-#]`
for a single story, `/workflow:run [epic-#]` handles Phase 7 automatically.

| Agent | File | Responsibility |
|-------|------|----------------|
| Reviewer | `.claude/agents/workflow-reviewer.md` | Code quality, security, performance, PR process integrity |
| QA | `.claude/agents/workflow-qa.md` | Edge cases, AC coverage, UI/UX interaction coverage, regression risk |
| Documentor | `.claude/agents/workflow-documentor.md` | API docs, CHANGELOG, ADRs, traceability matrix |

- [ ] **CI green** — auto-fixed if failing (stuck detection after 2 identical fingerprints)
- [ ] **Reviewer agent** run — review-checklist.md used (`.claude/workflow/references/review-checklist.md`)
- [ ] **QA agent** run — all 35 edge cases checked, `pnpm test --coverage` >= 80% *(parallel)*
- [ ] **Documentor agent** run — CHANGELOG + traceability matrix updated *(parallel with QA)*
- [ ] All **blocker**-severity issues resolved (no exceptions)
- [ ] Warning-severity issues resolved or explicitly accepted with justification
- [ ] **PR conversations resolved** — 0 unresolved review threads before merge
- [ ] **Visual UI/UX audit** (frontend stories only) — screenshots + accessibility + keyboard navigation
- [ ] Tests still green after review changes applied
- [ ] Draft PR exists and is linked to story issue
- [ ] PR approved (all three agents: PASS)
- [ ] PR squash-merged and branch deleted
- [ ] Story issue auto-closed (or manually closed with PR reference)
- [ ] Epic issue updated with story completion count
- [ ] **Inter-PR health check** — `pnpm test` passes after each merge (catch regressions)

**Gate**: PR merged, issue closed, CHANGELOG updated, traceability matrix updated.

---

## Agent Reference

| Agent | File | Role | Used In |
|-------|------|------|---------|
| Orchestrator / Planner | `.claude/agents/workflow-orchestrator.md` | Spec gate review, story breakdown | Phase 4 |
| Story Orchestrator | `.claude/agents/story-orchestrator.md` | TDD swarm team lead | Phases 5–7 |
| API Implementer | `.claude/agents/api-implementer.md` | Fastify 5 + Prisma 6 routes | Phases 5–6 |
| Frontend Implementer | `.claude/agents/frontend-implementer.md` | React 19 + Tailwind 4 + shadcn/ui | Phases 5–6 |
| Calculation Implementer | `.claude/agents/calculation-implementer.md` | Financial engine (Decimal.js, YEARFRAC) | Phases 5–6 |
| Reviewer | `.claude/agents/workflow-reviewer.md` | Code quality, security, maintainability | Phase 7 |
| QA | `.claude/agents/workflow-qa.md` | Edge cases, AC coverage, coverage ≥ 80% | Phase 7 |
| Documentor | `.claude/agents/workflow-documentor.md` | CHANGELOG, ADRs, traceability matrix | Phase 7 |
| Security Reviewer | `.claude/agents/security-reviewer.md` | JWT, RBAC, SQL injection | `/fix:security` |
| Precision Reviewer | `.claude/agents/financial-precision-reviewer.md` | TC-001 Decimal.js violations | `/fix:precision` |

## Template Reference

| Template | File | Used In |
|----------|------|---------|
| Feature Spec | `.claude/workflow/templates/feature-spec.md` | Phase 4 |
| Design Spec | `.claude/workflow/templates/design-spec.md` | Phase 4 (UI) |
| ADR | `.claude/workflow/templates/adr.md` | Any phase |

## Review Checklist Reference

`.claude/workflow/references/review-checklist.md` — Used by Reviewer agent in Phase 7.
Severity levels: **Blocker** (must fix), **Warning** (should fix), **Nit** (optional).

## Fix Procedures

When something breaks, match the error type to its fix command:

| Error | Fix Command |
|-------|-------------|
| ESLint / Prettier / markdownlint | `/fix:lint` |
| TypeScript type errors | `/fix:types` |
| Vitest test failures | `/fix:tests` |
| JWT / RBAC / SQL injection / rate limit | `/fix:security` |
| TC-001 native arithmetic / monetary JSON | `/fix:precision` |
| Unexplained error — need root cause | `/fix:debug "[symptom]"` |
| Multiple error types at once | `/fix:all` |

## Quick Command Reference

See `.claude/COMMANDS.md` for the full decision-tree user guide.

| # | Command | Purpose |
|---|---------|---------|
| 1 | `/workflow:run [epic-#]` | Full Epic lifecycle (one command to rule them all) |
| 2 | `/workflow:status` | Phase, checklist, `>>> NEXT:` recommendation |
| 3 | `/fix:all [symptom?]` | Fix everything (or debug a specific symptom) |
| 4 | `/pr:drive [--pr N / --epic #]` | Push PRs to merge autonomously |
| 5 | `/workflow:advance` | Manual phase gate check |
| 6 | `/plan:adr "[title]"` | Record architectural decision |
| 7 | `/plan:spec [epic-#]` | Write feature spec interactively |
| 8 | `/impl:story [story-#]` | Implement a single story (5-agent TDD swarm) |

---

## GitHub Best Practices for Epics and Stories

### Epic Issues

- Label: `epic`
- Title format: `Epic N: Feature Name`
- Body includes: Summary, MoSCoW Priority, Tier, Acceptance Criteria reference
  (`docs/specs/epic-N/<slug>.md`), Stories list, Dependencies
- Epics are NOT closed until ALL linked stories are merged
- Add a status comment to the Epic as each story merges:
  "Story #N merged — N of M stories complete"

### Story Issues

- Label: `story`
- Title format: `Story: [story title]`
- Body includes: `**Parent Epic**: #N`, Acceptance Criteria (from spec),
  Definition of Done checklist
- Definition of Done in every story body:
  - Tests written and RED (Phase 5)
  - Tests GREEN, coverage ≥ 80% (Phase 6)
  - Linter passes — 0 errors, 0 warnings
  - PR open and linked to this issue
  - Reviewer agent approved (Phase 7)
  - QA agent approved (Phase 7)
  - Documentor agent complete (Phase 7)
  - PR merged, issue auto-closes

### Pull Requests

- PR title: matches Story title
- PR body: `Fixes #[story-issue-number]` — auto-closes Story when merged
- Link to Epic in PR description: `Part of Epic #[epic-number]`
- Never merge without Reviewer agent sign-off

### GitHub Projects Board

- Columns: Backlog / In Progress / In Review / Done
- Stories move: Backlog → In Progress (Phase 5 starts) → In Review (PR opens) → Done (merged)
- Epics stay in Backlog until all stories are Done
- One Epic "In Progress" at a time

### Commit Messages

- Format: `type(scope): description` (conventional commits)
- Reference Story in PR: `Fixes #N` in PR description (not commit subject line)
- Types: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`
- Example: `feat(enrollment): implement capacity calculation endpoint`
