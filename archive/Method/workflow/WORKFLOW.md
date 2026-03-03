# Application Development Workflow

## Philosophy

This workflow follows a **Parallel with Quality Gates** agent swarm model,
**Strict TDD (Red-Green-Refactor)**, and **mandatory UI/UX design phases** for
every user-facing feature. All documentation lives in markdown. No Word, no PDF.

The workflow is tech-stack agnostic. Stack decisions are made per-project through
the interview protocol and recorded in `PROJECT.md`.

---

## Workflow Phases

Every feature moves through seven phases. A feature cannot advance until the
gate at the end of each phase passes.

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  1. INTAKE   │───▶│  2. DESIGN   │───▶│ 3. CONTRACT  │───▶│ 4. IMPLEMENT│
│  (Interview) │    │  (UI/UX)     │    │ (TDD Red)    │    │ (TDD Green) │
└─────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                                                                  │
┌─────────────┐    ┌─────────────┐    ┌──────────────┐           │
│  7. RELEASE  │◀──│  6. DOCS     │◀──│  5. REVIEW   │◀──────────┘
│  (CI/CD)     │    │  (Update)    │    │  (QA + CR)   │
└─────────────┘    └─────────────┘    └──────────────┘
```

---

## Phase 1 — INTAKE (Interview Protocol)

**Owner:** Architect Agent
**Gate:** Approved feature spec in `specs/<feature-name>.md`

The agent interviews the human for **major decisions only**. Small tasks
proceed autonomously. The interview triggers when any of these conditions apply:

- New data model or schema change
- New third-party integration
- Architecture pattern decision (e.g., SSR vs CSR, REST vs GraphQL)
- UX flow affecting multiple screens
- Security-sensitive functionality

### Interview Template

The Architect Agent asks structured questions using the `AskUserQuestion` tool:

1. **Problem statement** — What user problem does this solve?
2. **Acceptance criteria** — How do we know it is done? (list testable criteria)
3. **Data model impact** — Does this add/change entities or relationships?
4. **API surface** — What endpoints or mutations are needed?
5. **UX scope** — Which screens/components are affected?
6. **Dependencies** — External services, libraries, or infrastructure?
7. **Risk flags** — Security, performance, compliance concerns?

Output: `specs/<feature-name>.md` using the template in `templates/feature-spec.md`.

---

## Phase 2 — DESIGN (UI/UX)

**Owner:** Designer Agent
**Gate:** Approved design spec in `specs/<feature-name>-design.md` + HTML prototype

Every user-facing feature requires:

1. **Component inventory** — List of new and modified components
2. **Wireframe** — ASCII wireframe in markdown or interactive HTML prototype
3. **Interaction spec** — State transitions, loading states, error states, empty states
4. **Accessibility checklist** — WCAG 2.1 AA compliance notes
5. **Responsive breakpoints** — Mobile, tablet, desktop behavior

Backend-only features skip this phase but require an API contract document.

Output: `specs/<feature-name>-design.md` using `templates/design-spec.md`.
Optional: `prototypes/<feature-name>.html` for interactive prototype.

---

## Phase 3 — CONTRACT (TDD Red Phase)

**Owner:** Implementer Agent
**Gate:** All tests written and **failing** (red state confirmed)

Before writing any implementation code, the Implementer writes:

1. **Unit tests** for every public function/method
2. **Integration tests** for API endpoints and data flows
3. **E2E tests** for critical user journeys (from design spec)
4. **Contract tests** for external API integrations

Tests must be runnable and **all must fail**. This confirms the tests are
meaningful and not accidentally passing.

```
# Verify red state
run-tests --expect-fail
# Exit code 0 = all tests failed as expected
# Exit code 1 = some tests passed (test is broken, fix before proceeding)
```

Output: Test files in the project's test directory. Red-state confirmation log.

---

## Phase 4 — IMPLEMENT (TDD Green Phase)

**Owner:** Implementer Agent
**Gate:** All tests pass (green state) + lint clean + type check clean

Write the **minimum code** to make all tests pass. Then refactor.

### TDD Cycle (per test)

```
1. Pick one failing test
2. Write minimum code to pass it
3. Run full suite — only that test should flip green
4. Refactor if needed (tests must stay green)
5. Repeat until all tests pass
```

### Quality Checks Before Advancing

```
run-tests                    # All green
run-lint                     # Zero warnings
run-typecheck                # Zero errors
run-coverage                 # >= 90% (strict TDD target)
```

---

## Phase 5 — REVIEW (Code Review + QA)

**Owner:** Reviewer Agent + QA Agent (parallel)
**Gate:** Both agents approve

### Code Reviewer Agent

Evaluates against this checklist (saved in `references/review-checklist.md`):

- [ ] Follows project architecture patterns
- [ ] No security vulnerabilities (injection, XSS, CSRF, auth bypass)
- [ ] No performance anti-patterns (N+1, unbounded queries, memory leaks)
- [ ] Error handling is comprehensive (no swallowed errors)
- [ ] Types are correct and complete (no `any` escapes without justification)
- [ ] Tests are meaningful (not just coverage padding)
- [ ] Code is readable (clear names, small functions, single responsibility)
- [ ] No dead code or commented-out blocks
- [ ] Environment variables used for config (no hardcoded secrets)
- [ ] Backward compatible (or migration plan documented)

Output: `reviews/<feature-name>-cr.md` — findings with severity (blocker / warning / nit).

### QA Agent

Runs independently and in parallel with Code Review:

- Executes the full test suite in a clean environment
- Runs E2E tests against a preview deployment
- Tests edge cases from the design spec (error states, empty states, permissions)
- Performs basic accessibility audit (keyboard nav, screen reader, contrast)
- Tests responsive behavior at specified breakpoints

Output: `reviews/<feature-name>-qa.md` — pass/fail with reproduction steps for failures.

### Gate Logic

```
if cr.blockers == 0 AND qa.failures == 0:
    advance to Phase 6
elif cr.blockers > 0:
    return to Phase 4 (Implementer fixes blockers)
elif qa.failures > 0:
    return to Phase 4 (Implementer fixes failures, then re-run QA)
```

---

## Phase 6 — DOCUMENTATION

**Owner:** Documentation Agent
**Gate:** All docs updated and pass linting

The Documentation Agent updates:

1. **API docs** — New/changed endpoints documented in `docs/api/`
2. **Component docs** — Props, usage examples in `docs/components/`
3. **Architecture Decision Records** — If Phase 1 involved architecture decisions → `docs/adr/`
4. **CHANGELOG.md** — Entry under `[Unreleased]` following Keep a Changelog format
5. **README.md** — Updated if setup steps, env vars, or commands changed
6. **Migration guide** — If breaking changes exist → `docs/migrations/`

All docs are markdown. No exceptions.

Output: Updated markdown files. Doc lint clean (`markdownlint`).

---

## Phase 7 — RELEASE (CI/CD)

**Owner:** Automated pipeline (GitHub Actions)
**Gate:** All CI checks green + human approval for production

See `ci/` directory for full pipeline configs. Summary:

```
On Pull Request:
  ├── Lint + Type Check
  ├── Unit + Integration Tests
  ├── Coverage Check (>= 90%)
  ├── Build
  ├── E2E Tests (against preview)
  ├── Doc Lint
  └── Security Scan

On Merge to Main:
  ├── All of the above
  ├── Deploy to Staging
  ├── Smoke Tests on Staging
  └── Await manual approval → Deploy to Production
```

---

## Agent Swarm Architecture

See `agents/` directory for full role definitions. Summary:

| Agent | Responsibility | Phases Active |
|-------|---------------|---------------|
| **Architect** | Interview, specs, major decisions | 1 |
| **Designer** | UI/UX specs, prototypes, accessibility | 2 |
| **Implementer** | TDD tests + implementation code | 3, 4 |
| **Reviewer** | Code review against checklist | 5 |
| **QA** | Test execution, edge cases, accessibility | 5 |
| **Documentor** | Docs, ADRs, changelog, README | 6 |
| **Orchestrator** | Coordinates agents, enforces gates | All |

The **Orchestrator** is the master agent. It:

- Reads the current feature state from `status/<feature-name>.md`
- Determines which phase is active
- Spawns the appropriate agent(s) via the Task tool
- Enforces quality gates before allowing phase transitions
- Escalates to the human when the interview protocol triggers

---

## Custom Commands

All commands are defined in `commands/`. Each is a reusable skill that any
agent can invoke. See the individual command files for full specifications.

| Command | Purpose |
|---------|---------|
| `/init-project` | Bootstrap project structure, install deps, configure CI |
| `/new-feature <name>` | Start the full workflow for a new feature |
| `/interview <feature>` | Run the interview protocol for a feature |
| `/design <feature>` | Generate UI/UX design spec and prototype |
| `/tdd-red <feature>` | Write failing tests from spec |
| `/tdd-green <feature>` | Implement to pass all tests |
| `/review <feature>` | Run code review + QA in parallel |
| `/update-docs <feature>` | Update all documentation |
| `/release <feature>` | Trigger CI/CD pipeline |
| `/status` | Show current state of all features |

---

## File Structure

```
project-root/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD
├── specs/                   # Feature specs and design specs (md)
├── prototypes/              # HTML interactive prototypes
├── reviews/                 # Code review and QA reports (md)
├── status/                  # Feature tracking files (md)
├── docs/
│   ├── api/                 # API documentation (md)
│   ├── components/          # Component documentation (md)
│   ├── adr/                 # Architecture Decision Records (md)
│   └── migrations/          # Migration guides (md)
├── CHANGELOG.md
├── README.md
├── PROJECT.md               # Stack decisions, config, team norms
└── src/                     # Application source code
    └── (structure depends on chosen stack)
```

---

## Getting Started

1. Run `/init-project` to bootstrap
2. The Orchestrator will interview you for project-level decisions (stack, auth, DB, hosting)
3. Answers are recorded in `PROJECT.md`
4. Run `/new-feature <name>` to begin your first feature
5. The workflow guides you through all seven phases automatically

---

## Principles

1. **All documentation is markdown.** Code-readable, version-controlled, diffable.
2. **Tests before code.** No implementation without a failing test first.
3. **Parallel where safe, sequential where critical.** Speed without sacrificing quality.
4. **Agents are specialized.** Each agent has a single responsibility.
5. **Gates are non-negotiable.** No phase skip. No manual override without human approval.
6. **The human decides architecture.** The agent decides implementation details.
7. **Coverage is a floor, not a ceiling.** 90% minimum. 100% for critical paths.
8. **Every decision is recorded.** ADRs for architecture. Specs for features. Changelogs for releases.
