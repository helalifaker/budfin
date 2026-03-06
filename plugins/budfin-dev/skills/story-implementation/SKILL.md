---
name: story-implementation
description: Swarm agent workflow for implementing BudFin user stories. Use when asked to implement a story, build a feature, work on a ticket, or start any substantial development task. Defines the 5+ agent minimum, sequencing, role boundaries, and coordination patterns for parallel implementation.
---

# BudFin Story Implementation Workflow

## Always Use 5+ Agents Minimum

Per project standards (CLAUDE.md), all non-trivial tasks use a swarm of 5+ agents minimum. Single-agent implementation is not acceptable for user stories.

Use the `/implement-story` command to kick off the full workflow automatically.

## Agent Roles and Sequencing

```
Phase 1 — BLOCKING (must complete first):
  story-orchestrator creates team, assigns Planner

Phase 2 — SEQUENTIAL (Planner first, then Implementers):
  Planner: reads story + docs → task breakdown with dependencies
  ↓ (Planner completes, unblocks implementers)

Phase 3 — PARALLEL (run simultaneously):
  frontend-implementer: React/Vite/Tailwind work
  api-implementer: Fastify routes/Zod/Prisma work
  calculation-implementer: Financial engine work
  (Only spawn the implementers relevant to this story)

Phase 4 — PARALLEL (after all implementers done):
  Code Reviewer: checks against ADRs, TC-001–005, security
  QA Specialist: writes tests ONLY (never touches implementation)

Phase 5 — AFTER review+QA:
  Documentation Specialist: docs, JSDoc comments, CHANGELOG
```

## Planner Output Requirements

The Planner must produce a task list in this format before any implementation begins:

```markdown
## Story: [Story title]

### Tasks (dependency-ordered)

1. [T1] Create Prisma migration for budget_allocations table
    - Dependencies: none
    - Owner: api-implementer
    - Files: prisma/schema.prisma, prisma/migrations/...

2. [T2] Implement calculateAllocation() engine function
    - Dependencies: T1
    - Owner: calculation-implementer
    - Files: apps/api/src/engines/allocation.engine.ts

3. [T3] Add POST /budget-versions/:id/allocations route
    - Dependencies: T1
    - Owner: api-implementer
    - Files: apps/api/src/routes/allocation.route.ts

4. [T4] Build AllocationGrid component
    - Dependencies: none (mock data initially)
    - Owner: frontend-implementer
    - Files: apps/web/src/components/AllocationGrid.tsx
```

## Task Tracking

- Planner creates tasks with `TaskCreate` including dependencies via `addBlockedBy`
- Each implementer claims their tasks with `TaskUpdate` (set `owner`, set `status: 'in_progress'`)
- When done, `TaskUpdate` to `status: 'completed'` then check `TaskList` for next unblocked task

## Communication Rules

- Use `SendMessage` for coordination — text output is NOT visible to teammates
- Message the orchestrator when blocked, not when making routine progress
- QA specialist reports failing tests to orchestrator (not directly to implementers)
- Code reviewer sends approval OR list of required changes to orchestrator

## QA Agent Boundary (CRITICAL)

QA specialist writes `*.test.ts` and `*.spec.ts` files ONLY.

- Never modifies implementation files
- If implementation must change for tests to pass → message orchestrator → wait for implementer
- This boundary is enforced by the `hooks.json` PreToolUse hook

## Story Completion Criteria

A story is NOT complete until ALL of the following are true:

1. All tests pass (`pnpm test`)
2. Linters clean (`pnpm lint` — zero errors, zero warnings)
3. Type checking passes (`pnpm typecheck`)
4. Coverage ≥ 80% for new code
5. Code Reviewer has approved (no outstanding required changes)
6. Documentation Specialist has updated relevant docs

## Starting a Story

```
/implement-story "Story description or ticket reference"
```

This invokes `story-orchestrator` which:

1. Creates the team with TeamCreate
2. Assigns Planner to decompose the story
3. Assigns implementers in parallel after plan is ready
4. Coordinates Code Reviewer + QA Specialist
5. Assigns Documentation Specialist last
6. Reports completion and shuts down the team
