---
name: impl:story
description: >
  Implement a single GitHub Story using a 5-agent TDD swarm (story-orchestrator + domain
  implementer + workflow-reviewer + workflow-qa + workflow-documentor). Drives TDD RED → GREEN
  → parallel Review. Creates draft PR on GREEN. Usage - /impl:story [story-issue-number]
argument-hint: '[story-issue-number]'
allowed-tools: Bash, Read, Agent, TeamCreate, TaskCreate, TaskUpdate, TaskList, SendMessage
---

Parse the argument:

- `story-issue-number`: integer GitHub issue number (e.g., 42)

If missing, ask the user: "Which story issue number should I implement?"

## Step 1 — Phase Gate Check

Read `.claude/workflow/STATUS.md`.

If Phase < 5:
```
Error: /impl:story requires Phase 5 (TDD RED) or Phase 6 (IMPLEMENT).
Current phase is [N] — [NAME].

If you haven't written the spec yet: /plan:spec [epic-N]
If you haven't created stories yet: /plan:stories [epic-N]
If you haven't advanced past setup: /workflow:advance
```
Then stop.

## Step 2 — Context Gathering

Read all context before spawning any agent:

1. `gh issue view $STORY_NUMBER --json number,title,body,labels`
   — Read story title, acceptance criteria (AC-01, AC-02 ...), DoD checklist, parent Epic number

2. Extract Epic number from story body line `**Parent Epic**: #N`

3. `gh issue view $EPIC_NUMBER --json number,title,body`
   — Read Epic context and summary

4. Derive spec file path from Epic title:
   - "Epic N: Feature Name" → `docs/specs/epic-N/<feature-slug>.md`
   - Read the spec file entirely

5. Determine story type from acceptance criteria:
   - API endpoint (GET, POST, PUT, DELETE) → `api-implementer`
   - React component, page, form, or table → `frontend-implementer`
   - Revenue, DHG, Staff Cost, P&L, YEARFRAC calculation → `calculation-implementer`
   - Multiple types → spawn multiple implementers

Display determined story type before proceeding.

## Step 3 — Invoke Skill

Use the Skill tool to invoke: `budfin-workflow`

This confirms phase compliance and loads all technical constraints (TC-001, TC-002, Prisma 6
patterns, Zod 4 validation, Tailwind v4 CSS-first, etc.).

## Step 4 — Spawn the Swarm

Use TeamCreate to create a team named `story-$STORY_NUMBER`.

Spawn the `story-orchestrator` agent as team lead with these instructions:

```
Story issue number: $STORY_NUMBER
Epic number: $EPIC_NUMBER
Feature spec path: docs/specs/epic-N/<slug>.md
Story type: [api|frontend|calculation]
Story title: [title]
Acceptance criteria: [list all AC from the issue]

Your task:
1. Set up team with the correct implementer type
2. Drive TDD RED phase (failing tests only)
3. Gate-check all tests are RED before proceeding
4. Drive TDD GREEN phase (make all tests pass)
5. Gate-check all tests PASS + typecheck clean + lint clean
6. Create draft PR: gh pr create --draft --title "feat(epic-N): [story title]" --body "Fixes #$STORY_NUMBER\n\nPart of Epic #$EPIC_NUMBER"
7. Launch workflow-reviewer + workflow-qa + workflow-documentor in parallel
8. Collect results and report PASS or FAIL with blocker list
```

## Step 5 — TDD RED Phase Detail

The story-orchestrator will direct the implementer to:

- Write failing Vitest tests for ALL acceptance criteria
- Test file locations:
  - API story: `apps/api/src/routes/<resource>/<method>.test.ts`
  - Frontend story: `apps/web/src/components/<Component>.test.tsx`
  - Calculation story: `apps/api/src/engines/<engine>.test.ts`
- Tests must FAIL (not error) when run — syntax errors are not acceptable RED
- Run `pnpm test` to confirm all new tests are RED
- No implementation code in this phase

Phase 5 gate (enforced by orchestrator):
- `pnpm test` shows all NEW tests failing
- No new tests are green or erroring

## Step 6 — TDD GREEN Phase Detail

The story-orchestrator will direct the implementer to:

- Write minimum code to make all failing tests pass
- Use `fastify-route` skill for API routes (Skill tool invocation)
- Use `prisma-model` skill for new DB models (Skill tool invocation)
- Apply TC-001: ALL monetary arithmetic via `Decimal.js` — zero exceptions
- Apply TC-002: YEARFRAC algorithm for all date proration
- Apply Prisma 6 patterns: `Uint8Array` for binary, `P2025` for not-found
- Run `pnpm test` after every file — never let tests regress
- Final gate: `pnpm test` all GREEN + `pnpm typecheck` zero errors + `pnpm lint` zero errors

Phase 6 gate (enforced by orchestrator):
- All tests GREEN
- `pnpm typecheck` zero errors
- `pnpm lint` zero errors, zero warnings
- Coverage ≥ 80% for new files

## Step 7 — Parallel Review Phase

Once GREEN gate passes, orchestrator creates draft PR then launches simultaneously:
- `workflow-reviewer`: code quality, security, TC-001 compliance, Blocker/Warning/Nit report
- `workflow-qa`: AC coverage, all 35 edge cases evaluated, coverage ≥ 80% confirmed
- `workflow-documentor`: CHANGELOG updated, ADR if needed, traceability matrix updated

## Step 8 — Outcome

### PASS (all three agents: APPROVED / APPROVED / COMPLETE)

```bash
gh pr ready [pr-number]
```

Output:
```
Story #$STORY_NUMBER implementation complete.

PR: [url]
Reviewer: APPROVED (N blockers resolved, N warnings noted)
QA: APPROVED (N/N AC covered, N/N edge cases evaluated)
Documentor: COMPLETE (CHANGELOG updated, ADR: [written|not needed])

Next steps:
  /impl:story [next-story-number]   — implement the next story
  /workflow:advance                  — if this was the last story in the Epic
```

### FAIL (any Blocker found)

Do NOT mark PR as ready. List all blockers:

```
Story #$STORY_NUMBER has [N] blockers. Resolve before PR can be approved.

BLOCKERS:
  [workflow-reviewer] apps/api/src/routes/...:42 — TC-001: native + operator on salary field → /fix:precision
  [workflow-qa] — AC-03 has no corresponding test → /fix:tests
  [workflow-reviewer] apps/api/src/routes/...:18 — missing authenticate preHandler → /fix:security
  ...

Suggested fix commands:
  Lint errors     → /fix:lint
  Type errors     → /fix:types
  Test failures   → /fix:tests
  Security issues → /fix:security
  Precision issues→ /fix:precision

After resolving blockers, re-run: /impl:story $STORY_NUMBER
```
