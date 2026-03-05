---
name: BudFin Workflow
description: Applies the BudFin 7-phase development workflow to all coding and planning tasks for the BudFin project. Use when working on any BudFin development task, writing specs, running tests, implementing features, reviewing code, or checking project status. Activates automatically on any BudFin task.
version: 1.0.0
---

You are working on BudFin — a school financial planning system for EFIR (École Française Internationale de Riyad).

Before doing anything, read `.claude/workflow/STATUS.md` to confirm the current phase.

## The 7-Phase Workflow

The project follows a strict sequential workflow. Never skip phases or checklist items.

| Phase | Name | When |
|-------|------|------|
| 1 | DOCUMENT | Once — requirements freeze |
| 2 | DECOMPOSE | Once — 13 GitHub Epics created |
| 3 | SETUP | Once — project skeleton built |
| 4 | SPECIFY | Per Epic — feature spec written |
| 5 | TDD RED | Per Story — failing tests written |
| 6 | IMPLEMENT | Per Story — code written to pass tests |
| 7 | REVIEW | Per Story — 3 agents review in parallel |

Full workflow: `.claude/workflow/WORKFLOW.md`

## Phase Rules (non-negotiable)

### Phase 4 — SPECIFY

- No tests, no code before spec is complete
- Run `/workflow:specify [epic-number] "[feature name]"` to create the spec interactively
- Spec output path: `docs/specs/epic-N/<feature-slug>.md`
- The command launches `workflow-orchestrator` automatically for gate review
- Template used: `.claude/workflow/templates/feature-spec.md`
- Gate: Orchestrator agent returns PASS — all ACs testable, no open questions

### Phase 5 — TDD RED

- Write tests only — no implementation code
- Tests must be RED (failing), not erroring
- Use `/impl:story [#]` — spawns `story-orchestrator` + appropriate implementer
- Gate: `pnpm test` shows all new tests failing

### Phase 6 — IMPLEMENT

- Write code only to pass existing failing tests — nothing extra
- Use `/impl:story [#]` — continues from RED via story-orchestrator
- Gate: `pnpm test` green, `pnpm lint` 0 errors, `pnpm typecheck` clean, coverage ≥ 80%

### Phase 7 — REVIEW

- `workflow-reviewer`, `workflow-qa`, `workflow-documentor` run in parallel (via story-orchestrator)
- No merge until all Blockers are resolved
- Gate: PR merged, CHANGELOG updated, traceability matrix updated

## BudFin Technical Constraints

These are absolute — never violate them:

**TC-001 — Financial Precision**: Use `Decimal.js` for ALL monetary arithmetic.

```typescript
// ALWAYS
import Decimal from 'decimal.js'
const result = new Decimal(a).plus(new Decimal(b))

// NEVER
const result = a + b  // violates TC-001
```

**TC-002 — Date Calculations**: Use YEARFRAC algorithm for prorating staff costs — not simple day division.

**Stack** (Node.js 22 LTS, TypeScript 5.9.3 pinned, Fastify 5, Prisma 6, Zod 4, Vitest 4):

```typescript
// Prisma 6: binary fields are Uint8Array (not Buffer)
// Prisma 6: use P2025 error code (NotFoundError removed)
// Zod 4: validate at all API boundaries
```

## Current Project State

- Phase: 2 — DECOMPOSE (check STATUS.md for latest)
- Repo: `helalifaker/budfin` (GitHub Issues enabled)
- Package manager: pnpm

## Workflow Commands

| Command | Use When |
|---------|---------|
| `/workflow:status` | Check current phase, valid commands, and next action |
| `/workflow:advance` | Gate-check and move to next phase |
| `/workflow:run [epic-#]` | Full Epic driver: spec → stories → implement → advance |
| `/plan:decompose` | Phase 2: create all 13 GitHub Epics + Projects board |
| `/plan:epic [n] "[name]" [priority] [tier]` | Create single Epic issue |
| `/plan:spec [epic-N]` | Phase 4: create spec interactively, run orchestrator review |
| `/plan:stories [epic-N]` | Phase 4: derive story breakdown, create all GitHub story issues |
| `/plan:adr "[decision title]"` | Record architectural decision (any phase) |
| `/impl:story [story-#]` | Implement single story with 5-agent TDD swarm |
| `/impl:epic [epic-#]` | Implement all stories for an Epic in dependency order |
| `/impl:route "[resource]" "[method]"` | Scaffold Fastify 5 route + test file |
| `/impl:model "[ModelName]"` | Scaffold Prisma 6 model + run generate/migrate |
| `/impl:component "[ComponentName]"` | Scaffold React 19 component + test file |
| `/fix:lint` | Fix all ESLint/Prettier/markdownlint errors |
| `/fix:types` | Fix all TypeScript type errors |
| `/fix:tests` | Fix all failing Vitest tests |
| `/fix:security` | Fix security vulnerabilities |
| `/fix:precision` | Fix financial precision violations (TC-001) |
| `/fix:debug "[symptom]"` | Root cause analysis for any error |
| `/fix:all` | Run all fixers in sequence |

## Command Suggestions by Phase

When a task is in a specific phase, suggest the appropriate commands:

**Phase 2 (DECOMPOSE)**:
- Primary: `/plan:decompose`
- Single Epic: `/plan:epic [N] "[name]" [priority] [tier]`
- Done: `/workflow:advance`

**Phase 4 (SPECIFY)**:
- Primary: `/plan:spec [epic-N]` (creates spec interactively)
- After spec: `/plan:stories [epic-N]` (creates all story issues)
- Record decisions: `/plan:adr "[decision title]"`
- Done: `/workflow:advance`

**Phase 5 (TDD RED)**:
- Primary: `/impl:story [#]` (runs full TDD swarm)
- Or: `/impl:epic [#]` (all stories for an Epic)
- Scaffolding: `/impl:route`, `/impl:model`, `/impl:component`

**Phase 6 (IMPLEMENT)**:
- Primary: `/impl:story [#]` (continues from RED)
- Fix issues: `/fix:lint`, `/fix:types`, `/fix:tests`
- Done: `/workflow:advance`

**Phase 7 (REVIEW)**:
- Merge PRs in dependency order
- Done: `/workflow:advance`

## Fix Command Reference

When you encounter specific errors, always suggest the appropriate fix command:

| Error type | Fix command |
|-----------|-------------|
| Lint errors (ESLint, Prettier, Markdown) | `/fix:lint` |
| TypeScript type errors | `/fix:types` |
| Vitest test failures | `/fix:tests` |
| Security vulnerabilities (JWT, RBAC, SQL) | `/fix:security` |
| Financial precision (TC-001 violations) | `/fix:precision` |
| Unexplained error / need RCA | `/fix:debug "[symptom]"` |
| Multiple error types | `/fix:all` |

## Proactive Behavior

When asked to work on a BudFin task, always:

1. Check the current phase in STATUS.md
2. Confirm the task is appropriate for the current phase
3. If the task is out of phase (e.g., asked to write code when in Phase 4), explain what phase we are in and what should happen first
4. Apply the relevant phase rules automatically — do not wait to be asked

When you see code that violates TC-001 (money arithmetic without Decimal.js), flag it immediately as a Blocker regardless of context.
