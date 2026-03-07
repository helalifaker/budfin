---
name: audit:360
description: >
  360-degree implementation audit. Read-only diagnostic that audits cross-epic consistency,
  verifies all acceptance criteria are implemented, and validates alignment across all layers
  (spec, API, DB, frontend, engines, tests). Produces a structured report with severity-tagged
  findings and file:line references.
  Usage - /audit:360 [--epic N [N...] | --all] [--layer L [L...]] [--quick]
argument-hint: '[--epic N... | --all] [--layer L...] [--quick]'
allowed-tools: Bash, Read, Glob, Grep, Agent, TeamCreate, TaskCreate, TaskUpdate, TaskList, SendMessage
---

Parse arguments:

- `--epic N [N...]`: audit specific epics only (e.g., `--epic 1 2 10`)
- `--all`: audit all epics marked DONE in STATUS.md
- `--layer L [L...]`: run only specific layers 1-8 (e.g., `--layer 1 2 4`)
- `--quick`: skip expensive runtime checks (layers 5, 7, 8); run layers 1-4 + 6 only
- No arguments: prompt user to choose

If no arguments provided, ask:
```
Which epics should I audit?
  --all       Audit all completed epics
  --epic N    Audit specific epics (e.g., --epic 1 2 10)

Options:
  --layer L   Run specific layers only (1-8)
  --quick     Skip runtime checks (fast mode: layers 1-4 + 6)
```

**Phase gate**: Any phase (read-only command — never modifies files).

---

## 8 AUDIT LAYERS

| Layer | Name | Agent | Phase | Speed |
|-------|------|-------|-------|-------|
| 1 | Spec Compliance | `spec-compliance-auditor` | B -- Static | Fast |
| 2 | API Contract | `api-contract-auditor` | B -- Static | Fast |
| 3 | Data Model | `data-model-auditor` | B -- Static | Fast |
| 4 | Frontend Conformance | `frontend-conformance-auditor` | B -- Static | Fast |
| 5 | Engine Integrity | `financial-precision-reviewer` (existing) | C -- Runtime | Slow |
| 6 | Cross-Epic Consistency | `cross-epic-auditor` | B -- Static | Fast |
| 7 | Test Coverage | `workflow-qa` (existing, adapted) | C -- Runtime | Slow |
| 8 | Dependency & Readiness | Inline (no agent) | C -- Runtime | Fast |

---

## PHASE A: PREFLIGHT (30s)

1. Run `pnpm typecheck 2>&1` -- capture output, do NOT fix
2. Run `pnpm lint 2>&1` -- capture output, do NOT fix
3. Read `.claude/workflow/STATUS.md` -- determine which epics are DONE
4. Validate requested epic numbers exist and have specs at `docs/specs/epic-N/`
5. Build epic-to-spec-file mapping:
   ```bash
   ls docs/specs/epic-*/
   ```
6. Build epic-to-UI/UX-spec mapping:
   - Epic 1 -> `docs/ui-ux-spec/03-enrollment-capacity.md`
   - Epic 2 -> `docs/ui-ux-spec/04-revenue.md`
   - Epic 7 -> `docs/ui-ux-spec/08-master-data.md`
   - Epic 10 -> `docs/ui-ux-spec/02-version-management.md`
   - Epic 11 -> `docs/ui-ux-spec/09-admin.md`
   - Epic 13 -> N/A (infrastructure)
   - Epic 15 -> `docs/ui-ux-spec/00-global-framework.md`
7. Output preflight summary:

```
============================================================
           BudFin 360-Degree Implementation Audit
           Date: YYYY-MM-DD
           Epics: [N, N, N]
           Mode: full / quick
           Layers: [1, 2, 3, 4, 5, 6, 7, 8] / [subset]
============================================================

=== PREFLIGHT ===

TypeScript: N errors (captured, not fixed)
ESLint: N warnings, N errors (captured, not fixed)
Epics DONE: [list]
Epics to audit: [list]
Spec files found: [list]

Proceeding to static analysis...
```

---

## PHASE B: STATIC ANALYSIS (2-5 min)

Determine which layers to run based on `--layer` flag and `--quick` flag.
Default layers for Phase B: 1, 2, 3, 4, 6.

Spawn up to 5 agents **in parallel** via `TeamCreate` (team name: `audit-360-static`):

1. **spec-compliance-auditor** -- Layer 1
2. **api-contract-auditor** -- Layer 2
3. **data-model-auditor** -- Layer 3
4. **frontend-conformance-auditor** -- Layer 4
5. **cross-epic-auditor** -- Layer 6

Context packet for all agents:
- Epic numbers being audited
- Paths to spec files (from preflight mapping)
- TDD doc paths: `docs/tdd/03_data_architecture.md`, `docs/tdd/04_api_contract.md`,
  `docs/tdd/05_security.md`, `docs/tdd/10_traceability_matrix.md`
- UI/UX spec paths (from preflight mapping)
- Source file lists:
  ```bash
  find apps/api/src -name "*.ts" -not -name "*.test.ts" | sort
  find apps/web/src -name "*.ts" -o -name "*.tsx" | sort
  find packages/types/src -name "*.ts" | sort
  ```

**Wait for all agents to complete before Phase C.**

If any agent takes > 5 minutes, mark its layer as `TIMEOUT` and continue.

---

## PHASE C: RUNTIME ANALYSIS (3-10 min)

**Skipped entirely if `--quick` flag is set.** Also skipped for layers not in `--layer` list.

### Layer 5 -- Engine Integrity

If Layer 5 is requested:

1. Build file list of all files with monetary operations:
   ```bash
   grep -rl "Decimal\|toFixed\|parseFloat\|Math\.round" apps/api/src/ --include="*.ts"
   grep -rl "Decimal\|toFixed" apps/web/src/ --include="*.ts" --include="*.tsx"
   ```
2. Spawn `financial-precision-reviewer` agent with the file list
3. Additional audit-specific checks the agent must perform:
   - Flag native arithmetic (`+`, `-`, `*`, `/`) on variables named salary/amount/cost/revenue/fee/discount/total
   - Flag `Number()` or `parseFloat()` on API response monetary values

### Layer 7 -- Test Coverage

If Layer 7 is requested:

1. Run `pnpm test --coverage 2>&1` -- capture full output
2. Parse per-file coverage percentages from output
3. Build AC-to-test mapping for each audited epic
4. Spawn `workflow-qa` agent with:
   - Coverage output
   - AC list per epic (from Layer 1 results if available)
   - Edge cases from `docs/edge-cases/budfin_edge_case_analysis.md`
5. Agent checks: untested ACs, uncovered edge cases, files below 80% coverage

### Layer 8 -- Dependency & Readiness

If Layer 8 is requested (inline, no agent):

Epic dependency graph:
```
Epic 13 (Infra) -> foundation
Epic 11 (Auth) -> all API epics
Epic 7 (Master Data) -> 1, 2, 3, 4
Epic 10 (Version) -> 1, 2, 3, 4, 5
Epic 1 (Enrollment) -> 2, 3, 5
Epic 2 (Revenue) -> 4, 5
Epic 3 (Staffing) -> 4, 5
Epic 4 (Staff Costs) -> 5
```

Actions:
1. For each non-DONE epic, check if all prerequisites are DONE -> report READY or BLOCKED
2. Grep for `TODO`, `FIXME`, `PLACEHOLDER`, `STUB`, `not implemented` in source:
   ```bash
   grep -rn "TODO\|FIXME\|PLACEHOLDER\|STUB\|not implemented" apps/ packages/ --include="*.ts" --include="*.tsx"
   ```
   Classify each by which epic it relates to
3. Check for forward references to unimplemented epic types/routes

Layers 5 and 8 run in parallel. Layer 7 runs sequentially (test execution first, then analysis).

---

## PHASE D: REPORT ASSEMBLY (10s)

Aggregate all findings from all layers into the final report:

```
============================================================
           BudFin 360-Degree Implementation Audit
           Date: YYYY-MM-DD
           Epics Audited: [1, 2, 7, 10, 11]
           Mode: full / quick
============================================================

=== EXECUTIVE SUMMARY ===

| Layer | Description              | Blockers | Warnings | Info | Verdict   |
|-------|--------------------------|----------|----------|------|-----------|
| 1     | Spec Compliance          | N        | N        | N    | PASS/FAIL |
| 2     | API Contract             | N        | N        | N    | PASS/FAIL |
| 3     | Data Model               | N        | N        | N    | PASS/FAIL |
| 4     | Frontend Conformance     | N        | N        | N    | PASS/FAIL |
| 5     | Engine Integrity         | N        | N        | N    | PASS/FAIL |
| 6     | Cross-Epic Consistency   | N        | N        | N    | PASS/FAIL |
| 7     | Test Coverage            | N        | N        | N    | PASS/FAIL |
| 8     | Dependency & Readiness   | N        | N        | N    | PASS/FAIL |
|       | TOTAL                    | N        | N        | N    | PASS/FAIL |

Overall Verdict: PASS (0 blockers) / FAIL (N blockers)

=== LAYER N: [NAME] ===

[Per-layer output from each agent -- paste verbatim]

=== RECOMMENDED FIX PRIORITY ===

Priority 1 (Blockers):
  1. [Layer N] file:line -- description -- suggested command: /fix:all --[flag]

Priority 2 (Warnings):
  ...

Priority 3 (Info):
  ...

=== DEFERRED FEATURES ===

| Feature | From Epic | Blocked By | Unblocks When |
|---------|-----------|------------|---------------|
| ...     | ...       | ...        | ...           |

=== EPIC READINESS ===

| Epic | Name           | Status  | Prerequisites         | Ready           |
|------|----------------|---------|----------------------|-----------------|
| 3    | Staffing       | Planned | 1, 7, 10, 11 (DONE) | YES             |
| 4    | Staff Costs    | Planned | 2, 3 (3 not DONE)   | NO -- blocked   |

=== END OF AUDIT ===
```

---

## ERROR HANDLING

| Error | Action |
|-------|--------|
| Agent timeout (> 5 min) | Mark layer as `TIMEOUT`, continue |
| Missing spec file for epic | Skip Layer 1 for that epic, note `No spec found` |
| No UI/UX spec mapping (e.g., Epic 13) | Skip Layer 4 for that epic, note `N/A -- infrastructure epic` |
| Test infrastructure failure | Skip Layer 7 coverage data, note `Test execution failed` |
| Pre-existing lint/type errors | Noted in preflight, NOT counted as audit findings |

---

## INTEGRATION WITH FIX COMMANDS

`/audit:360` is **read-only** -- it never modifies files, commits, or creates PRs.

After running, findings can be addressed via:

| Finding Source | Fix Command |
|---------------|-------------|
| Layer 5 blockers (financial precision) | `/fix:all --precision` |
| Layer 2 security blockers (missing RBAC) | `/fix:all --security` |
| Layer 7 test failures | `/fix:all --tests` |
| Layer 1 missing AC | `/impl:story [story-#]` |
| Layer 4 frontend issues | Manual fix or `/impl:story` for the relevant story |
| Layer 3 data model gaps | `/impl:model "[ModelName]"` |

---

## RULES

- **Read-only**: Never modify any files. Never commit. Never create PRs. Never run formatters or fixers.
- **Deterministic**: Same inputs produce the same report structure.
- **File references**: Every finding MUST include file:line reference.
- **Fix guidance**: Every Blocker and Warning MUST include a concrete fix instruction.
- **Agent isolation**: Each agent runs independently. Do not share state between agents during Phase B.
- **No false positives**: When in doubt, classify as Info rather than Warning or Blocker.
