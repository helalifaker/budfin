# BudFin Command Reference

This guide tells you exactly which command to use in each situation. 95% of workflow steps
are covered by the commands below — you should rarely need to type a custom prompt.

---

## Decision Tree: Which Command Do I Need?

### I want to plan / create artifacts

| Goal | Command |
|------|---------|
| Create all 13 GitHub Epics (one-time) | `/plan:decompose` |
| Create a spec for an Epic | `/plan:spec [epic-N]` |
| Create stories from a completed spec | `/plan:stories [epic-N]` |
| Create a single story manually | `/plan:stories [epic-N] --single` |
| Record an architectural decision | `/plan:adr "[decision title]"` |
| Create a single Epic issue | `/plan:epic [N] "[name]" [priority] [tier]` |

### I want to implement

| Goal | Command |
|------|---------|
| Implement a single story end-to-end | `/impl:story [story-#]` |
| Implement an entire Epic | `/impl:epic [epic-#]` |
| Scaffold a Fastify route | `/impl:route "[resource]" "[method]"` |
| Scaffold a Prisma model | `/impl:model "[ModelName]"` |
| Scaffold a React component | `/impl:component "[ComponentName]"` |
| Commit, push, and open draft PR linked to story + epic | `/impl:commit [story-#]` |
| Verify CI + reviews, squash-merge, roll up Epic status | `/pr:merge [story-#]` |

### Something is broken

| Symptom | Command |
|---------|---------|
| ESLint / Prettier / markdownlint errors | `/fix:lint` |
| TypeScript type errors | `/fix:types` |
| Vitest test failures | `/fix:tests` |
| Security vulnerabilities or RBAC gaps | `/fix:security` |
| Financial precision violations (TC-001) | `/fix:precision` |
| Unexplained error, need root cause analysis | `/fix:debug "[symptom]"` |
| Run all fixers in sequence | `/fix:all` |

### Workflow management

| Goal | Command |
|------|---------|
| Check current phase and remaining checklist | `/workflow:status` |
| Gate-check and advance to next phase | `/workflow:advance` |
| Drive full Epic lifecycle (spec → stories → implement → review) | `/workflow:run [epic-#]` |

---

## Command Dependency Map

```
/plan:decompose  (Phase 2 — one-time)
       ↓
/workflow:advance  (Phase 2 → 3)
       ↓
[setup work — Phase 3]
       ↓
/workflow:advance  (Phase 3 → 4)
       ↓
/plan:spec [epic-N]  (Phase 4)
       ↓
/plan:stories [epic-N]  (Phase 4)
       ↓
/impl:story [#]  (Phase 5/6 — repeat per story)
       ↓
/workflow:advance  (Phase 7 → next Epic)
```

Or use `/workflow:run [epic-N]` to drive the full Epic lifecycle with one command.

---

## Phase Gate: What's Allowed When

| Command | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Phase 7 |
|---------|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|
| `/plan:decompose` | — | ✓ | — | — | — | — | — |
| `/plan:epic` | — | ✓ | — | — | — | — | — |
| `/plan:spec` | — | — | — | ✓ | — | — | — |
| `/plan:stories` | — | — | — | ✓ | — | — | — |
| `/plan:adr` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/impl:story` | — | — | — | — | ✓ | ✓ | — |
| `/impl:epic` | — | — | — | — | ✓ | ✓ | — |
| `/impl:route` | — | — | — | — | ✓ | ✓ | — |
| `/impl:model` | — | — | — | — | ✓ | ✓ | — |
| `/impl:component` | — | — | — | — | ✓ | ✓ | — |
| `/impl:commit` | — | — | — | — | — | ✓ | ✓ |
| `/pr:merge` | — | — | — | — | — | — | ✓ |
| `/fix:*` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/workflow:status` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/workflow:advance` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/workflow:run` | — | — | — | ✓ | ✓ | ✓ | — |

---

## Command Quick Reference

### Planning Commands

**`/plan:decompose`**
Phase 2 only. Creates all 13 GitHub Epics, labels, and the Projects board. Run once.

**`/plan:epic [N] "[name]" [priority] [tier]`**
Creates a single Epic issue. Priority: must/should/could/wont. Tier: mvp/target/stretch.

**`/plan:spec [epic-N]`**
Phase 4. Walks through the feature spec template interactively, then launches the
workflow-orchestrator agent for gate review. Output: `docs/specs/epic-N/<slug>.md`.

**`/plan:stories [epic-N]`**
Phase 4. Reads the completed spec, derives a dependency-ordered story breakdown via the
workflow-orchestrator, and creates all story GitHub issues linked to the parent Epic.

**`/plan:adr "[decision title]"`**
Any phase. Prompts for context, decision, consequences, and alternatives. Saves to
`docs/adr/ADR-NNN-<slug>.md` and links in `docs/tdd/09_decisions_log.md`.

### Implementation Commands

**`/impl:story [story-#]`**
The main implementation command. Spawns a 5-agent TDD swarm (orchestrator + implementer +
reviewer + QA + documentor). Drives TDD RED → GREEN → parallel Review. Creates draft PR.

**`/impl:epic [epic-#]`**
Implements all stories for an Epic in dependency order. Calls impl:story logic per story.
Pauses on any blocker and waits for resolution before continuing.

**`/impl:route "[resource]" "[method]"`**
Invokes the `fastify-route` skill to scaffold a Fastify 5 route + Vitest test file.
Example: `/impl:route "enrollment" "GET"`

**`/impl:model "[ModelName]"`**
Invokes the `prisma-model` skill to scaffold a Prisma 6 model block. Runs generate + migrate.
Example: `/impl:model "Enrollment"`

**`/impl:component "[ComponentName]"`**
Scaffolds a React 19 component + test file. Applies Tailwind v4, shadcn/ui, WCAG AA rules.
Example: `/impl:component "EnrollmentTable"`

**`/impl:commit [story-#]`**
Phase 6. Runs pre-flight gates (test/lint/typecheck), derives a conventional commit message
from the story issue, stages and pushes the branch, then opens a draft PR with
`Fixes #[story-#]` and `Part of Epic #[epic-#]` linkage. Moves story to "In Review".

**`/pr:merge [story-#]`**
Phase 7. Verifies CI checks green and PR is not a draft, then squash-merges with branch
deletion. Auto-closes the story via `Fixes #N`. Runs Epic rollup: closes the Epic issue and
moves it to Done if all sibling stories are merged.

### Fix Commands

**`/fix:lint`**
Runs eslint --fix, prettier --write, markdownlint --fix. Lists any remaining unfixable errors.

**`/fix:types`**
Runs tsc --noEmit, groups errors by category, applies targeted fixes. Repeats until clean.

**`/fix:tests`**
Runs pnpm test, diagnoses each failure, fixes implementation (never weakens tests). Confirms ≥80% coverage.

**`/fix:security`**
Launches security-reviewer agent on changed files. Fixes all Blockers (JWT, RBAC, SQL injection,
rate limit). Commits with `fix(security): resolve [N] security findings`.

**`/fix:precision`**
Launches financial-precision-reviewer agent. Fixes all TC-001 violations (Decimal.js, string
serialization, Uint8Array). Re-runs to confirm clean.

**`/fix:debug "[symptom]"`**
Root cause analysis via the systematic-debugging skill. Reproduces → isolates → hypothesizes →
confirms → fixes → verifies. Example: `/fix:debug "enrollment POST returns 500"`

**`/fix:all`**
Runs all fixers in sequence: lint → types → tests → security → precision. Final: `pnpm test && pnpm typecheck`.

### Workflow Commands

**`/workflow:status`**
Shows current phase, checklist, valid commands for this phase, and next recommended action.

**`/workflow:advance`**
Gate-checks the current phase. Lists unmet criteria if FAIL. Advances STATUS.md if PASS.

**`/workflow:run [epic-#]`**
Full Epic driver. Runs spec → stories → impl:epic → advance. One command per Epic.

---

## Common Sequences

### Starting a new Epic (in Phase 4)
```
/plan:spec [epic-N]         # write the feature spec
/plan:stories [epic-N]      # create all story issues
/impl:story [first-story-#] # implement first story
/impl:story [next-story-#]  # implement subsequent stories
/workflow:advance            # advance when Epic complete
```

### Something broke mid-implementation
```
/fix:lint       # if ESLint or Prettier errors
/fix:types      # if TypeScript errors
/fix:tests      # if Vitest failures
/fix:debug "symptom description"  # if root cause unclear
```

### Quick Epic (using workflow:run)
```
/workflow:run [epic-#]  # drives everything from spec to done
```
