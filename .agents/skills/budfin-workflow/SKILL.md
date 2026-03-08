---
name: budfin-workflow
description: >
    Use when running BudFin's repo-local workflow commands from `.codex/prompts`
    or `.claude/commands`. Loads the phase gates, workflow files, core technical
    constraints, and the project-specific command/skill handoffs that keep the
    spec -> story -> implementation -> review loop consistent.
invocations:
    - user: /workflow:status
    - user: /workflow:run
    - user: /workflow:advance
    - agent: budfin-workflow
---

# budfin-workflow

Use this skill whenever a task is driven by the BudFin workflow command pack or when
work needs to stay aligned with the repo's phase-based delivery process.

## When to use

- A prompt from `.codex/prompts/` or `.claude/commands/` references `budfin-workflow`
- The task involves workflow phases, epic/story execution, gate checks, or command handoffs
- You need the shared BudFin delivery constraints before implementing, fixing, or reviewing

Do not use this skill for isolated one-off edits that are unrelated to the workflow.

## Read first

1. `.claude/workflow/STATUS.md`
2. `.claude/workflow/WORKFLOW.md`
3. `.claude/COMMANDS.md`

Then load only the additional files needed for the current command:

- Specs: `docs/specs/epic-N/*.md`
- Templates: `.claude/workflow/templates/`
- Review checklist: `.claude/workflow/references/review-checklist.md`
- Agent briefs: `.claude/agents/*.md`

## Core rules

1. Treat `.claude/workflow/STATUS.md` as the live source of truth for the active phase, epic, and story.
2. Keep the workflow project-local. Prefer `.codex/prompts/` for Codex commands and `.agents/skills/` for repo skills.
3. Respect phase gates. If the requested command is out of phase, report that clearly and stop instead of pushing ahead.
4. Reuse the existing project skills when a command needs them:
    - `.agents/skills/fastify-route/SKILL.md`
    - `.agents/skills/prisma-model/SKILL.md`
    - `.agents/skills/impl-commit/SKILL.md`
    - `.agents/skills/plan-decompose/SKILL.md`
5. For multi-agent steps, use Codex sub-agents with narrow scopes instead of inventing new coordination workflows.

## Technical constraints to enforce

- TC-001: All monetary arithmetic uses `Decimal.js`; never native `number`
- TC-002: `YEARFRAC` must match Excel US 30/360 exactly
- TC-003/TC-004: Preserve DB precision and round only at presentation boundaries
- TC-005: Use AST (`UTC+3`) date handling with `@date-fns/tz`
- Prisma 6: `Bytes` map to `Uint8Array`; handle not-found with `P2025`
- API routes: Zod schemas + `fastify-type-provider-zod`; no raw SQL with user input
- Security: RS256 auth, RBAC enforcement, PDPL-safe data handling

## Workflow procedure

1. Read the current phase and determine whether the command is allowed now.
2. Read only the files required for the current command's scope.
3. If the command delegates to another project skill, load that skill before editing.
4. When implementation work is required, keep the change minimal, testable, and phase-appropriate.
5. When review or audit work is required, prioritize blockers, regressions, missing tests, and workflow gate failures.

## Verification

- The command outcome matches the current phase rules in `.claude/workflow/WORKFLOW.md`
- Any files updated in `.claude/workflow/STATUS.md` remain internally consistent
- Any referenced follow-up command actually exists in `.codex/prompts/`
- Any handoff to another project skill points at a real file in `.agents/skills/`
