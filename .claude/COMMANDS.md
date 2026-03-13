# BudFin Command Reference

10 user-facing commands. Everything else is internal and called automatically.

---

## Decision Tree: What Do I Run?

```
What do I want to do?
  |
  +-- Drive a full Epic (spec -> implement -> merge)
  |     /workflow:run [epic-#]
  |
  +-- Check where I am
  |     /workflow:status
  |
  +-- Tidy and sync documentation
  |     /docs:sync --audit         (read-only doc health check)
  |     /docs:sync docs/plans      (scoped cleanup for active plans)
  |     /docs:sync --deep docs     (full duplicate review before changes)
  |
  +-- Something is broken
  |     /fix:all                    (run all fixers)
  |     /fix:all "symptom"          (root cause analysis first)
  |     /fix:all --lint             (just lint)
  |     /fix:all --types            (just types)
  |     /fix:all --tests            (just tests)
  |
  +-- Push PRs to merge
  |     /pr:drive [story-#]         (single story PR)
  |     /pr:drive --pr 64 65        (specific PRs)
  |     /pr:drive --epic [epic-#]   (all PRs for Epic)
  |
  +-- Manual phase gate
  |     /workflow:advance
  |
  +-- Record a decision
  |     /plan:adr "[title]"
  |
  +-- Write a spec interactively
  |     /plan:spec [epic-#]
  |
  +-- Implement a single story
  |     /impl:story [story-#]
  |
  +-- Audit implementation quality
        /audit:360 --all             (all completed epics)
        /audit:360 --epic 1 2 10     (specific epics)
        /audit:360 --all --quick     (fast mode, skip runtime)
        /audit:360 --all --layer 1 2 (specific layers only)
```

---

## The 10 Commands

### 1. `/workflow:run [epic-#]`

Full Epic lifecycle driver. One command, zero prompts.

**Flow**: health check -> spec -> stories -> implement -> review -> visual audit -> merge -> rollup

- Runs health checks at entry, between stories, and between PR merges
- Uses `pr:drive` loop logic in Phase 7 (auto-fix, stuck detection)
- Checks PR conversation resolution before merge (0 unresolved threads)
- Runs visual UI/UX audit for frontend stories via Chrome automation
- Produces post-epic report with metrics

**Phase gate**: 4 or later.

### 2. `/workflow:status`

Shows current phase, progress, and the single most useful next command.

```
=== BudFin Workflow ===

>>> NEXT: /workflow:run 2    (Epic 2: Revenue -- ready for spec)

Phase: 4 -- SPECIFY | Epics: 5/13 done
Current Epic: Epic 2 -- Revenue (#6)
```

### 3. `/docs:sync [--audit] [--deep] [path]`

Documentation governance and cleanup. Uses the repo-local `docs-governance` skill to inventory
docs, classify misplaced files, flag duplicates, and archive clearly superseded working docs.

**Modes**:
- `/docs:sync --audit` -- read-only inventory and recommendations
- `/docs:sync docs/plans` -- scoped cleanup of one documentation area
- `/docs:sync --deep docs` -- inspect duplicate groups more thoroughly before any move

**Safety**: never deletes docs, never archives authoritative sets by default, and stops when
authority or classification is ambiguous.

**Phase gate**: any phase.

### 4. `/fix:all [symptom?] [--flag?]`

Unified fixer. Runs all fixers or a specific one.

| Usage | What It Does |
|-------|-------------|
| `/fix:all` | lint -> types -> tests -> security -> precision |
| `/fix:all "500 on POST"` | Root cause analysis first, then all fixers |
| `/fix:all --lint` | Just ESLint + Prettier + markdownlint |
| `/fix:all --types` | Just TypeScript type errors |
| `/fix:all --tests` | Just Vitest failures |
| `/fix:all --security` | Just security review |
| `/fix:all --precision` | Just financial precision |

**Phase gate**: any phase.

### 5. `/pr:drive [story-# | --pr N... | --epic #]`

Autonomous PR driver. Loops until merged or stuck.

**Modes**:
- Story mode: `/pr:drive [story-#]` -- finds PR, enforces phase gate
- PR mode: `/pr:drive --pr 64 65` -- direct PR numbers, no phase gate
- Epic mode: `/pr:drive --epic [epic-#]` -- all PRs in dependency order

**Loop**: CI check -> fix -> review agents -> conversation resolution -> merge -> rollup

**Safety**: stuck detection (2 identical failure fingerprints), new commits only, never `--no-verify`.

### 6. `/workflow:advance`

Manual phase gate check. Lists unmet criteria if FAIL. Advances STATUS.md if PASS.

### 7. `/plan:adr "[title]"`

Record an architectural decision. Saves to `docs/adr/ADR-NNN-<slug>.md`.

**Phase gate**: any phase.

### 8. `/plan:spec [epic-#]`

Write a feature spec interactively. Runs orchestrator review. Output: `docs/specs/epic-N/<slug>.md`.

**Phase gate**: Phase 4.

### 9. `/impl:story [story-#]`

Implement a single story end-to-end. Spawns 5-agent TDD swarm (orchestrator + implementer + reviewer + QA + documentor). Drives TDD RED -> GREEN -> parallel Review. Creates draft PR.

**Phase gate**: Phase 5-6.

### 10. `/audit:360 [--epic N... | --all] [--layer L...] [--quick]`

360-degree implementation audit. Read-only diagnostic across 8 layers.

**Layers**: spec compliance, API contract, data model, frontend conformance, engine integrity, cross-epic consistency, test coverage, dependency readiness.

**Modes**:
- `--all` — audit all completed epics
- `--epic 1 2 10` — audit specific epics
- `--layer 1 2 4` — run specific layers only (1-8)
- `--quick` — fast mode: layers 1-4 + 6 only (skip runtime checks)

**Output**: structured report with severity-tagged findings (Blocker/Warning/Info) and file:line references. Spawns 5 audit agents in parallel for static analysis.

**Phase gate**: any phase (read-only).

---

## Internal Commands (called automatically)

These commands are invoked by the 10 user-facing commands above. You should not need to run them directly.

### Called by `/workflow:run`

| Command | Purpose |
|---------|---------|
| `plan:decompose` | Bulk-create all 13 GitHub Epics (Phase 2, one-time) |
| `plan:stories` | Batch-create story issues from a spec |
| `impl:epic` | Implement all stories in dependency order |

### Called by `/impl:story`

| Command | Purpose |
|---------|---------|
| `impl:commit` | Commit + push + open draft PR |
| `impl:route` | Scaffold a Fastify 5 route |
| `impl:model` | Scaffold a Prisma 6 model |
| `impl:component` | Scaffold a React 19 component |

### Called by `/fix:all`

| Command | Purpose |
|---------|---------|
| `fix:lint` | Fix ESLint + Prettier + markdownlint |
| `fix:types` | Fix TypeScript type errors |
| `fix:tests` | Fix Vitest failures + confirm >= 80% coverage |
| `fix:security` | Fix JWT, RBAC, SQL injection issues |
| `fix:precision` | Fix TC-001 Decimal.js violations |
| `fix:debug` | Root cause analysis |

---

## Phase Gate Summary

| Command | Phase 1-3 | Phase 4 | Phase 5-6 | Phase 7 |
|---------|:---------:|:-------:|:---------:|:-------:|
| `/workflow:run` | -- | Y | Y | Y |
| `/workflow:status` | Y | Y | Y | Y |
| `/docs:sync` | Y | Y | Y | Y |
| `/fix:all` | Y | Y | Y | Y |
| `/pr:drive` | -- | -- | Y | Y |
| `/workflow:advance` | Y | Y | Y | Y |
| `/plan:adr` | Y | Y | Y | Y |
| `/plan:spec` | -- | Y | -- | -- |
| `/impl:story` | -- | -- | Y | -- |
| `/audit:360` | Y | Y | Y | Y |
