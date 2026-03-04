# Workflow Design Record

**Date**: 2026-03-04
**Status**: Implemented

## Problem

Two fragmented workflow documents existed with no clear relationship:

- `docs/planning/PLANNING_PROCESS.md` — 10-phase project-level workflow
- `Method/workflow/WORKFLOW.md` — 7-phase feature-level workflow (referenced but not yet created)

No single entry point, no "you are here" tracker, no clear path from PRD → epics/stories → code.

## Decision

Replace both with a single master workflow document (`Method/WORKFLOW.md`) that:

1. Covers both project-level phases (1–3) and feature-level phases (4–7) in one place
2. Uses a companion `Method/STATUS.md` as the "you are here" tracker
3. Has explicit gates — phase only advances when 100% of checklist items are done
4. Integrates GitHub Issues/Projects as the canonical tracking layer
5. Makes TDD (Phase 5: RED before Phase 6: IMPLEMENT) non-negotiable
6. Specifies exactly which swarm agents fire at each phase

## Structure

```
Method/
  WORKFLOW.md          # Master 7-phase workflow
  STATUS.md            # Current position tracker
  agents/              # Agent spec files
  templates/           # Feature spec, design spec, ADR templates
  references/          # Review checklist and other reference docs
```

## Phase Map

| Phase | Name | Level | Agent(s) |
|-------|------|-------|----------|
| 1 | DOCUMENT | Project | — |
| 2 | DECOMPOSE | Project | — |
| 3 | SETUP | Project | — |
| 4 | SPECIFY | Feature | Planner |
| 5 | TDD RED | Feature | Implementer |
| 6 | IMPLEMENT | Feature | Implementer |
| 7 | REVIEW | Feature | Reviewer + QA + Documentor (parallel) |

## Current State at Time of Design

- Phase 1 (DOCUMENT): Complete as of 2026-03-03
- Phase 2 (DECOMPOSE): In progress — GitHub epics not yet created
- Phases 3–7: Not started

## Alternatives Considered

**Keep two separate docs** — Rejected. The split between project-level and feature-level workflow was the root cause of confusion. A single document with clearly labeled sections is unambiguous.

**Use a project management tool instead of markdown** — Rejected. GitHub Issues + markdown files keeps everything in the repo, version-controlled, and accessible to both humans and agents.
