# DHG / Staffing Redesign — Comprehensive Remediation Plan

**Date:** 2026-03-18
**Author:** Principal Architecture Review (automated remediation dossier)
**Inputs:** Redesign spec (`2026-03-17-dhg-staffing-redesign.md`), fix plan (`2026-03-18-dhg-staffing-fix.md`), full codebase audit
**Prior Verdict:** NOT READY / NO-GO (high confidence)

---

# 1. Executive Recovery Verdict

**Current Status:** NOT READY — confirmed
**Confidence:** Very High (validated against source code, not just prior review)
**Prior NO-GO Verdict:** CONFIRMED and EXPANDED — additional gaps found beyond the 48 originally reported

**Recovery Outlook:** Recoverable with moderate effort (estimated 2-3 focused implementation sessions)

The codebase is architecturally sound. The Prisma schema, route structure, and engine design follow the redesign spec faithfully. The problem is not design quality — it is **incomplete integration**: the schema was written but not migrated, the frontend was scaffolded but not wired, and legacy DHG references were partially but not fully removed.

### Top 10 Reasons for Verdict

1. **11 tables in schema have NO migration SQL** — deployment would fail on any fresh database
2. **8 column additions (Employee, CategoryMonthlyCost) have NO migration SQL** — existing tables would lack required columns
3. **`requiredFteCalculated` missing from schema entirely** — not just un-migrated, absent from the model
4. **Staffing page renders placeholder `<div>` tags** — no real grid, ribbon, or inspector
5. **Frontend hooks use wrong response wrappers** (`{data}` vs `{settings}`, `{profiles}`, `{assignments}`)
6. **Frontend interfaces use wrong field names** (`hsaTargetHoursPerWeek` vs `hsaTargetHours`, `defaultOrs` vs `weeklyServiceHours`)
7. **Legacy DHG literal `'DHG'` in 6 source files + 15+ test assertions** — stale chain includes a non-existent module
8. **`dhg-view.tsx` component still exists** — entire legacy view not addressed by fix plan
9. **IDOR TODO at `employees.ts:264`** — no version-ownership validation
10. **Tests assert placeholder existence** — `staffing.test.tsx:334-339` passes because placeholders exist, creating false confidence

---

# 2. Scope Validation and Review Expansion

## Prior Findings Validation

| ID    | Finding                                                    | Confirmed?             | Severity | Notes                                                                     |
| ----- | ---------------------------------------------------------- | ---------------------- | -------- | ------------------------------------------------------------------------- |
| PF-01 | Schema and migration SQL do not match                      | **YES**                | BLOCKER  | 11 tables + 8 columns missing. Only `staffing_assignments` has SQL.       |
| PF-02 | Staffing page is placeholder shell                         | **YES**                | BLOCKER  | `staffing.tsx:239,246` render `<div>` with `data-testid="*-placeholder"`  |
| PF-03 | Frontend hooks incompatible with backend                   | **YES**                | BLOCKER  | Wrong wrappers (`{data}` vs named), wrong field names                     |
| PF-04 | Legacy DHG paths remain live                               | **YES**                | HIGH     | `'DHG'` in 6 source files. Fix plan covers 4 of 6.                        |
| PF-05 | No persisted `requiredFteCalculated`                       | **YES**                | HIGH     | Field is absent from `schema.prisma` entirely (line 1146 → 1147 skips it) |
| PF-06 | Import accepts manual `hsa_amount`                         | **YES**                | MEDIUM   | `import.ts` OPTIONAL_COLUMNS includes `hsa_amount`                        |
| PF-07 | Stale propagation double-marks PNL                         | **YES**                | MEDIUM   | `settings.ts:84`, `assignments.ts:57` both include `'PNL'`                |
| PF-08 | Tests create false confidence                              | **YES**                | HIGH     | Placeholder assertions, wrong mock shapes, DHG test expectations          |
| PF-09 | IDOR TODO in employees.ts                                  | **YES**                | HIGH     | Line 264 — explicit unresolved security gap                               |
| PF-10 | Summary/totals missing from teaching-requirements response | **NEEDS VERIFICATION** | MEDIUM   | Fix plan says line 792-819 returns `{lines}` only                         |

## New Findings Beyond Prior Review

| ID    | New Finding                                                        | Severity | Area            | Notes                                                         |
| ----- | ------------------------------------------------------------------ | -------- | --------------- | ------------------------------------------------------------- |
| NF-01 | `enrollment-settings.ts:11` still has `'DHG'`                      | HIGH     | Legacy          | NOT in fix plan Task 11                                       |
| NF-02 | `enrollment-workspace.ts:24` still has `'DHG'`                     | HIGH     | Legacy          | NOT in fix plan Task 11                                       |
| NF-03 | `enrollment-status-strip.tsx:8` has `DHG: 'DHG'` label             | MEDIUM   | Frontend Legacy | NOT in fix plan Task 13                                       |
| NF-04 | `dhg-view.tsx` — entire legacy component exists                    | MEDIUM   | Frontend Legacy | NOT in any fix plan task                                      |
| NF-05 | `use-staffing.ts:247` has `// — DHG Hooks —` section header        | LOW      | Frontend Legacy | Cosmetic but confusing                                        |
| NF-06 | 15+ test files contain DHG assertions that will fail after cleanup | HIGH     | Testing         | `headcount.test.ts:292` explicitly asserts `toContain('DHG')` |
| NF-07 | `versions-clone.test.ts:1096,1123` uses `lineType: 'DHG'`          | MEDIUM   | Testing         | Clone test fixture uses DHG lineType                          |
| NF-08 | `staffing-settings-sheet.test.tsx:380-409` tests DHG tab           | MEDIUM   | Testing         | Tab 2 tests reference "DHG Rules"                             |
| NF-09 | `use-master-data.test.ts:89` tests DHG rules hook                  | MEDIUM   | Testing         | Hook test for legacy DHG functionality                        |
| NF-10 | No shared types package (`packages/types/src/staffing.ts`) exists  | HIGH     | Contract        | Fix plan Task 3 creates it, but it doesn't exist yet          |

---

# 3. Root Cause Analysis

## RCA-1: Schema vs Migration Drift

- **Problem:** 11 Prisma models and 8 column additions exist in `schema.prisma` with no corresponding SQL migration files
- **Observed symptom:** `prisma migrate deploy` would fail on production; `prisma migrate dev` would generate a massive catch-up migration
- **Root cause:** Models were added to the schema as part of Epic 18 design work but `prisma migrate dev` was never run to generate the SQL. The development workflow relied on `prisma db push` or the ORM's runtime schema sync instead of proper migration generation.
- **Why it happened:** The Epics were implemented in rapid sequence (18 → 19 → 20) without a migration checkpoint between them. The schema was treated as a design document rather than a deployable artifact.
- **Risk if left unresolved:** Production deployment impossible. Data loss on existing databases. Docker Compose startup failure.
- **Corrective principle:** Migration must be generated and committed before any route or engine code that depends on the new tables. Schema changes require `prisma migrate dev` immediately.

## RCA-2: Frontend-Backend Contract Drift

- **Problem:** Frontend hooks and components use different field names, response wrappers, and enum values than the backend actually returns
- **Observed symptom:** Frontend would receive `{settings: {...}}` but try to access `resp.data`, receiving `undefined`. Field access like `profile.defaultOrs` would be `undefined` when backend sends `weeklyServiceHours`.
- **Root cause:** No shared type contract exists between `@budfin/api` and `@budfin/web`. Each package defined local TypeScript interfaces independently. When the backend was updated during Epic 18/19, the frontend interfaces were not updated in lockstep.
- **Why it happened:** The three-epic split (backend foundation → backend engines → frontend) created a temporal gap. The frontend was scaffolded with assumed API shapes before the backend was finalized.
- **Risk if left unresolved:** Every staffing page interaction would fail at runtime with undefined field errors.
- **Corrective principle:** Create `packages/types/src/staffing.ts` as the shared contract. Frontend imports from `@budfin/types`; backend Zod schemas derive from the same source of truth.

## RCA-3: Placeholder Frontend

- **Problem:** The staffing page renders `<div>Teaching workspace</div>` and `<div>Support & Admin workspace</div>` instead of real grid components
- **Observed symptom:** Navigating to `/planning/staffing` shows empty placeholder text with no data, no interactivity
- **Root cause:** Epic 20 (Frontend Redesign) scaffold was created but the wiring step — connecting `TeachingMasterGrid`, `SupportAdminGrid`, hooks, and inspector — was never completed.
- **Why it happened:** The page layout, toolbar, and mode switching were built first (the shell). The data-binding layer was deferred and never implemented.
- **Risk if left unresolved:** Module is non-functional. Users cannot interact with staffing data.
- **Corrective principle:** Page must import and mount real components with real data hooks. Placeholder `<div>` tags must be replaced entirely.

## RCA-4: Legacy DHG Contamination

- **Problem:** The stale module `'DHG'` still appears in 6 source files and 15+ test assertions despite the redesign folding DHG into STAFFING
- **Observed symptom:** Enrollment mutations mark `'DHG'` as stale, but no calculation pipeline processes `'DHG'` — the module is a phantom.
- **Root cause:** The DHG → STAFFING absorption was specified in the redesign but the cleanup sweep was incomplete. Only the staffing-specific files were updated; enrollment-side references were missed.
- **Why it happened:** The cleanup was scoped to "staffing files" rather than "all files referencing DHG". A grep-based approach was needed.
- **Risk if left unresolved:** Stale module arrays contain a phantom module. Frontend shows DHG badge that can never be cleared. Tests assert DHG presence and would fail if partially cleaned up.
- **Corrective principle:** Global `grep -rn "'DHG'"` across all source and test files. Every reference must be either removed or explicitly documented as deprecated.

## RCA-5: False-Confidence Test Suite

- **Problem:** Tests pass but validate incorrect behavior (placeholder existence, wrong mock shapes, DHG presence)
- **Observed symptom:** CI green despite non-functional page, broken contracts, and phantom modules
- **Root cause:** Tests were written against the scaffolded state (placeholders, assumed API shapes) rather than against the spec's required behavior. Mock data uses frontend-invented field names rather than actual backend response shapes.
- **Why it happened:** Tests were written at the same time as the frontend scaffold, before backend contracts were finalized. They reflect the scaffold's assumptions, not production reality.
- **Risk if left unresolved:** CI provides false assurance. Real integration failures only discovered at runtime.
- **Corrective principle:** Test mocks must match actual backend Zod response schemas. Page tests must assert real component rendering, not placeholder text.

---

# 4. Full Remediation Backlog

## Workstream 1: Data Model & Migration Remediation

| ID    | Issue                                       | Required Change                                                           | Severity | Priority | Dependency | Done Criteria                                                         |
| ----- | ------------------------------------------- | ------------------------------------------------------------------------- | -------- | -------- | ---------- | --------------------------------------------------------------------- |
| R-001 | `requiredFteCalculated` absent from schema  | Add field to `TeachingRequirementLine` in `schema.prisma` after line 1146 | BLOCKER  | P0       | None       | Field exists in schema, Prisma client generated                       |
| R-002 | 11 tables + 8 columns have no migration SQL | Run `prisma migrate dev --name add_staffing_redesign_tables`              | BLOCKER  | P0       | R-001      | Migration SQL file committed with all 11 CREATE TABLE + 8 ALTER TABLE |
| R-003 | Migration file must be verified             | Grep migration SQL for all expected table/column names                    | BLOCKER  | P0       | R-002      | All 11 tables and 8 columns present in SQL                            |

## Workstream 2: Master Data & Seed Remediation

| ID    | Issue                                                  | Required Change                                    | Severity | Priority | Dependency   | Done Criteria                |
| ----- | ------------------------------------------------------ | -------------------------------------------------- | -------- | -------- | ------------ | ---------------------------- |
| R-004 | Discipline seed data incomplete (18 of target 30+)     | Expand `staffing-master-data.ts` disciplines array | MEDIUM   | P1       | R-002        | >= 30 disciplines seeded     |
| R-005 | DisciplineAlias seed data incomplete (7 of target 20+) | Expand aliases array                               | MEDIUM   | P1       | R-004        | >= 20 aliases seeded         |
| R-006 | Seed must run cleanly after migration                  | Verify `prisma db seed` succeeds on fresh DB       | HIGH     | P1       | R-002, R-004 | Seed completes without error |

## Workstream 3: Shared Types Foundation

| ID    | Issue                                 | Required Change                                             | Severity | Priority | Dependency | Done Criteria                                  |
| ----- | ------------------------------------- | ----------------------------------------------------------- | -------- | -------- | ---------- | ---------------------------------------------- |
| R-007 | No shared staffing types exist        | Create `packages/types/src/staffing.ts` with all interfaces | HIGH     | P0       | None       | File exists, exports all staffing interfaces   |
| R-008 | Types not exported from package index | Add re-exports to `packages/types/src/index.ts`             | HIGH     | P0       | R-007      | `pnpm --filter @budfin/types typecheck` passes |

## Workstream 4: Backend Contract & Route Remediation

| ID    | Issue                                                       | Required Change                                                        | Severity | Priority | Dependency | Done Criteria                                                          |
| ----- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | -------- | -------- | ---------- | ---------------------------------------------------------------------- |
| R-009 | `formatEmployee()` returns snake_case                       | Rewrite to camelCase at `employees.ts:108-142`                         | HIGH     | P1       | None       | All fields camelCase in response                                       |
| R-010 | Employee list missing cost derivations                      | Add `monthlyCost`/`annualCost` via cost table join                     | MEDIUM   | P2       | None       | Support grid shows per-employee costs                                  |
| R-011 | Employee list response has `page_size`                      | Change to `pageSize` (camelCase)                                       | MEDIUM   | P1       | R-009      | Response uses `pageSize`                                               |
| R-012 | Stale propagation includes `'PNL'` in mutations             | Change to `['STAFFING']` only in `settings.ts:84`, `assignments.ts:57` | MEDIUM   | P1       | None       | `grep "'PNL'" settings.ts assignments.ts` returns 0 in stale constants |
| R-013 | Import accepts `hsa_amount` column                          | Remove from OPTIONAL_COLUMNS, add warning                              | MEDIUM   | P1       | None       | `hsa_amount` ignored with warning message                              |
| R-014 | Teaching-requirements response missing totals/warnings      | Add aggregation + warning generation                                   | HIGH     | P1       | None       | Response shape: `{lines, totals, warnings}`                            |
| R-015 | `requiredFteCalculated` not persisted in calculate pipeline | Capture pre-override FTE and persist in upsert                         | HIGH     | P1       | R-001      | Override provenance preserved                                          |
| R-016 | HSA not cleared for newly-ineligible employees              | Add clearing pass after HSA update                                     | MEDIUM   | P2       | None       | Ineligible employees get HSA=0                                         |
| R-017 | IDOR TODO at `employees.ts:264`                             | Add version existence check                                            | HIGH     | P1       | None       | TODO comment removed, check in place                                   |

## Workstream 5: Legacy DHG Removal (EXPANDED)

| ID    | Issue                                                      | Required Change                                         | Severity | Priority | Dependency | Done Criteria                               |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------- | -------- | -------- | ---------- | ------------------------------------------- |
| R-018 | `planning-rules.ts:18` has `'DHG'`                         | Remove from array                                       | HIGH     | P1       | None       | `grep "'DHG'" planning-rules.ts` → 0        |
| R-019 | `headcount.ts:33` has `'DHG'`                              | Remove from array                                       | HIGH     | P1       | None       | `grep "'DHG'" headcount.ts` → 0             |
| R-020 | `detail.ts:7` has `'DHG'`                                  | Remove from array                                       | HIGH     | P1       | None       | `grep "'DHG'" detail.ts` → 0                |
| R-021 | `nationality-breakdown.ts:35` has `'DHG'`                  | Remove from array                                       | HIGH     | P1       | None       | `grep "'DHG'" nationality-breakdown.ts` → 0 |
| R-022 | `enrollment-settings.ts:11` has `'DHG'` (**NEW**)          | Remove from array                                       | HIGH     | P1       | None       | `grep "'DHG'" enrollment-settings.ts` → 0   |
| R-023 | `enrollment-workspace.ts:24` has `'DHG'` (**NEW**)         | Remove from array                                       | HIGH     | P1       | None       | `grep "'DHG'" enrollment-workspace.ts` → 0  |
| R-024 | `dhg-grille.ts` route still registered                     | Remove import and registration from `staffing/index.ts` | HIGH     | P1       | None       | Route no longer accessible                  |
| R-025 | `staffing-status-strip.tsx:8` has `DHG: 'DHG'`             | Remove entry                                            | MEDIUM   | P1       | None       | DHG removed from stale labels               |
| R-026 | `version-detail-panel.tsx:24` has `DHG` route              | Remove entry                                            | MEDIUM   | P1       | None       | DHG removed from MODULE_ROUTES              |
| R-027 | `enrollment-status-strip.tsx:8` has `DHG: 'DHG'` (**NEW**) | Remove entry                                            | MEDIUM   | P1       | None       | DHG removed from enrollment labels          |
| R-028 | `dhg-view.tsx` entire component still exists (**NEW**)     | Deprecate or delete file                                | LOW      | P2       | None       | File removed or marked deprecated           |
| R-029 | `use-staffing.ts:247` DHG section header (**NEW**)         | Remove or rename section                                | LOW      | P2       | None       | No DHG references in hooks                  |
| R-030 | `staffing-settings-sheet.tsx:543,548` DHG tab labels       | Rename "DHG Rules" to "Curriculum Rules"                | LOW      | P2       | None       | UI label updated                            |

## Workstream 6: Frontend Contract Alignment

| ID    | Issue                                               | Required Change                                                      | Severity | Priority | Dependency | Done Criteria                     |
| ----- | --------------------------------------------------- | -------------------------------------------------------------------- | -------- | -------- | ---------- | --------------------------------- |
| R-031 | `use-staffing.ts` uses wrong interfaces             | Replace local interfaces with `@budfin/types` imports                | BLOCKER  | P0       | R-007      | All hooks use shared types        |
| R-032 | Employee list hook uses `{data}` wrapper            | Change to `{employees}` from `EmployeeListResponse`                  | BLOCKER  | P0       | R-031      | Correct unwrapping                |
| R-033 | Settings hook uses wrong field names                | `hsaTargetHoursPerWeek` → `hsaTargetHours`, etc.                     | BLOCKER  | P0       | R-031      | Field names match backend         |
| R-034 | Assignment hook uses `requirementLineId`            | Change to `band` + `disciplineId`                                    | BLOCKER  | P0       | R-031      | Stable keys used                  |
| R-035 | Teaching requirements hook uses `{data}` wrapper    | Change to `{lines, totals, warnings}`                                | BLOCKER  | P0       | R-031      | Correct unwrapping                |
| R-036 | `use-master-data.ts` uses wrong profile fields      | `defaultOrs` → `weeklyServiceHours`, `isHsaEligible` → `hsaEligible` | BLOCKER  | P0       | R-007      | Fields match backend              |
| R-037 | Settings sheet uses `PCT_PAYROLL` enum              | Change to `PERCENT_OF_PAYROLL`                                       | HIGH     | P1       | R-031      | Enum values match Prisma defaults |
| R-038 | Settings sheet field names wrong                    | `hsaTargetHoursPerWeek` → `hsaTargetHours`, etc.                     | HIGH     | P1       | R-037      | Field names match backend         |
| R-039 | Inspector hardcodes ORS=24                          | Read `effectiveOrs` from selected line                               | HIGH     | P1       | R-035      | Dynamic ORS per profile           |
| R-040 | Inspector sends `requirementLineId` for assignments | Send `{band, disciplineId}`                                          | HIGH     | P1       | R-034      | Stable compound keys              |
| R-041 | Auto-suggest dialog uses `requirementLineId`        | Send `{band, disciplineId}`                                          | HIGH     | P1       | R-034      | Stable compound keys              |

## Workstream 7: Frontend Integration (Page Wiring)

| ID    | Issue                                  | Required Change                                          | Severity | Priority | Dependency  | Done Criteria                          |
| ----- | -------------------------------------- | -------------------------------------------------------- | -------- | -------- | ----------- | -------------------------------------- |
| R-042 | Staffing page renders placeholder divs | Replace with `TeachingMasterGrid` / `SupportAdminGrid`   | BLOCKER  | P0       | R-031-R-041 | Real components render with real data  |
| R-043 | KPI ribbon not mounted                 | Mount `StaffingKpiRibbon` with totals data               | HIGH     | P1       | R-042       | Ribbon shows FTE, cost, gap metrics    |
| R-044 | Status strip not data-bound            | Bind `StaffingStatusStrip` to version stale state        | MEDIUM   | P1       | R-042       | Strip shows correct stale/fresh status |
| R-045 | Inspector not registered               | Wire `StaffingInspectorContent` via right-panel-registry | HIGH     | P1       | R-042       | Line selection shows inspector detail  |
| R-046 | Toolbar buttons have no handlers       | Wire Import/Add Employee/Auto-Suggest `onClick`          | HIGH     | P1       | R-042       | Buttons open respective dialogs        |

## Workstream 8: Security & Authorization

| ID    | Issue                      | Required Change                          | Severity | Priority | Dependency | Done Criteria              |
| ----- | -------------------------- | ---------------------------------------- | -------- | -------- | ---------- | -------------------------- |
| R-047 | IDOR at `employees.ts:264` | Add version existence check, remove TODO | HIGH     | P1       | None       | No TODO, version validated |

## Workstream 9: Testing & QA Hardening

| ID    | Issue                                              | Required Change                                     | Severity | Priority | Dependency         | Done Criteria                                        |
| ----- | -------------------------------------------------- | --------------------------------------------------- | -------- | -------- | ------------------ | ---------------------------------------------------- |
| R-048 | Migration alignment test covers 0 staffing tables  | Add assertions for all 12 staffing tables + columns | HIGH     | P1       | R-002              | Test passes with all table/column checks             |
| R-049 | Page test asserts placeholder existence            | Replace with real component assertions              | HIGH     | P1       | R-042              | Tests assert `TeachingMasterGrid`/`SupportAdminGrid` |
| R-050 | Hook tests use wrong mock shapes                   | Align mocks to backend response schemas             | HIGH     | P1       | R-031              | Mock shapes match `@budfin/types`                    |
| R-051 | `headcount.test.ts:292` asserts `toContain('DHG')` | Remove DHG from all test expectations               | HIGH     | P1       | R-018-R-023        | No test expects DHG in stale modules                 |
| R-052 | `planning-rules.test.ts` expects DHG               | Update expected arrays                              | HIGH     | P1       | R-018              | Tests pass without DHG                               |
| R-053 | `settings.test.ts` (enrollment) expects DHG        | Update expected arrays                              | HIGH     | P1       | R-022              | Tests pass without DHG                               |
| R-054 | `nationality-breakdown.test.ts` expects DHG        | Update expected arrays                              | HIGH     | P1       | R-021              | Tests pass without DHG                               |
| R-055 | `cohort-parameters.test.ts` expects DHG            | Update expected arrays                              | HIGH     | P1       | R-018              | Tests pass without DHG                               |
| R-056 | `versions-clone.test.ts` uses `lineType: 'DHG'`    | Change to valid lineType                            | MEDIUM   | P1       | None               | Test uses valid lineType                             |
| R-057 | `staffing-settings-sheet.test.tsx` tests DHG tab   | Update to "Curriculum Rules"                        | MEDIUM   | P1       | R-030              | Test labels match renamed tab                        |
| R-058 | `use-master-data.test.ts` tests DHG hook           | Update or remove DHG hook test                      | MEDIUM   | P1       | R-029              | Test reflects current API                            |
| R-059 | Import test missing hsa_amount rejection case      | Add test per fix plan Task 25                       | MEDIUM   | P2       | R-013              | Test verifies warning                                |
| R-060 | No stale-chain regression test exists              | Create `stale-chain.test.ts`                        | MEDIUM   | P2       | R-012, R-018-R-023 | Test verifies no DHG, correct propagation            |
| R-061 | Settings sheet test uses wrong mock field names    | Update mocks                                        | MEDIUM   | P1       | R-037              | Mocks match backend shapes                           |

## Workstream 10: Documentation

| ID    | Issue                                     | Required Change                                | Severity | Priority | Dependency  | Done Criteria                              |
| ----- | ----------------------------------------- | ---------------------------------------------- | -------- | -------- | ----------- | ------------------------------------------ |
| R-062 | Clone logic `disciplineId` not documented | Add comment at `versions.ts:1262,1281,1303`    | LOW      | P3       | None        | Comments explain intentional non-remapping |
| R-063 | No ADR for DHG absorption                 | Create `ADR-031-dhg-to-staffing-absorption.md` | MEDIUM   | P2       | R-018-R-030 | ADR committed                              |

---

# 5. Swarm Agent Execution Model

## Agent A — Data/Migration Architect

- **Mission:** Fix schema, generate migration, expand seeds, verify deployment safety
- **Scope:** R-001 through R-006
- **Files owned:** `schema.prisma`, `migrations/`, `staffing-master-data.ts`
- **Outputs:** Migration SQL committed, seeds expanded, Prisma client regenerated
- **Non-negotiable:** Migration must be verified with grep for all 12 table names + 8 column names
- **Must not change:** Route files, engine files, frontend files

## Agent B — Shared Types & Contract Lead

- **Mission:** Create shared types package, fix backend serialization
- **Scope:** R-007 through R-017
- **Files owned:** `packages/types/src/staffing.ts`, `packages/types/src/index.ts`, `employees.ts` (formatEmployee), `settings.ts` (stale + totals), `assignments.ts` (stale), `import.ts` (hsa_amount), `calculate.ts` (requiredFteCalculated + HSA clearing)
- **Outputs:** Shared types package, corrected backend responses
- **Non-negotiable:** All response wrappers use named keys (not `{data}`). All fields camelCase.
- **Must not change:** Schema, migrations, frontend files

## Agent C — Legacy DHG Cleanup Lead

- **Mission:** Remove ALL `'DHG'` references from source and test files
- **Scope:** R-018 through R-030, R-051 through R-058
- **Files owned:** All files containing `'DHG'` literal (6 source + 15+ test + 5 frontend)
- **Outputs:** Zero `'DHG'` references in codebase (verified by grep)
- **Non-negotiable:** Must update BOTH source files AND their corresponding test files atomically. Cannot remove from source without updating test expectations.
- **Must not change:** Schema, migration files, calculation engines

## Agent D — Frontend Integration Lead

- **Mission:** Wire frontend hooks and components to real backend contracts, replace placeholders
- **Scope:** R-031 through R-046
- **Files owned:** `use-staffing.ts`, `use-master-data.ts`, `staffing-settings-sheet.tsx`, `staffing-inspector-content.tsx`, `auto-suggest-dialog.tsx`, `staffing.tsx`
- **Inputs:** Shared types from Agent B (R-007), corrected backend responses
- **Outputs:** Fully functional staffing page with real data binding
- **Handoffs:** Receives from Agent B (shared types must exist first)
- **Non-negotiable:** All hooks import from `@budfin/types`. No local interface definitions.
- **Must not change:** Backend route files, schema

## Agent E — QA & Release Gate Lead

- **Mission:** Harden test suite, add missing tests, verify all tests pass
- **Scope:** R-048 through R-061
- **Files owned:** All `*.test.ts` and `*.test.tsx` files related to staffing
- **Outputs:** Updated tests that validate real behavior, not scaffolded state
- **Non-negotiable:** Mock shapes must match actual backend Zod schemas. No test may assert placeholder existence.
- **Must not change:** Implementation files (only test files)

## Agent F — Documentation & ADR Lead

- **Mission:** Update documentation to reflect remediated state
- **Scope:** R-062, R-063
- **Files owned:** `docs/adr/ADR-031-*`, `versions.ts` (comments only)
- **Outputs:** ADR committed, code comments added
- **Must not change:** Any implementation logic

## Agent G — Independent Code Reviewer

- **Mission:** Post-implementation review of all agent output
- **Scope:** All changes from Agents A-F
- **Validates:**
    - Architecture consistency with redesign spec
    - No regression in existing enrollment/revenue tests
    - Contract alignment between `@budfin/types`, backend Zod schemas, and frontend hooks
    - Migration safety (fresh DB deploy, existing DB upgrade)
    - Test adequacy (no false-confidence patterns)
    - Release readiness gate criteria
- **Non-negotiable:** Must run `pnpm test`, `pnpm typecheck`, `pnpm lint` and report results
- **Must not change:** Any files (read-only review)

---

# 6. Recommended Sequence of Execution

## Phase 0 — Truth Revalidation (COMPLETE)

**Objective:** Confirm findings and surface hidden gaps
**Status:** Done (this document)
**Deliverables:** This remediation plan
**Exit criteria:** All findings validated against source code

## Phase 1 — Deployment Safety (Agent A)

**Objective:** Fix migration chain so the app can deploy on a fresh database
**Prerequisites:** None
**Why first:** Nothing else matters if the database cannot be created

**Deliverables:**

- [ ] `requiredFteCalculated` added to schema (R-001)
- [ ] Migration SQL generated with all 12 tables + 8 columns (R-002)
- [ ] Migration verified (R-003)
- [ ] Seeds expanded (R-004, R-005)
- [ ] Fresh DB deploy verified (R-006)

**Exit criteria:** `prisma migrate deploy` succeeds on empty database. `prisma db seed` completes.

## Phase 2 — Contract Foundation (Agent B, parallel with Agent C)

**Objective:** Establish shared types and fix backend responses

**Prerequisites:** Phase 1 (schema must be stable)
**Why second:** Frontend alignment requires correct backend contracts

**Deliverables:**

- [ ] `packages/types/src/staffing.ts` created (R-007, R-008)
- [ ] Employee camelCase serialization (R-009, R-010, R-011)
- [ ] Stale propagation fixed (R-012)
- [ ] Import hsa_amount removal (R-013)
- [ ] Teaching-requirements totals/warnings (R-014)
- [ ] requiredFteCalculated persistence (R-015)
- [ ] HSA clearing (R-016)
- [ ] IDOR fix (R-017, R-047)

**Exit criteria:** `pnpm --filter @budfin/api test` passes. Backend responses match shared types.

## Phase 2b — Legacy DHG Cleanup (Agent C, parallel with Phase 2)

**Objective:** Remove all DHG phantom references from source AND test files

**Prerequisites:** None (can run in parallel with Phase 2)
**Why parallel:** DHG cleanup is independent of contract alignment

**Deliverables:**

- [ ] All 6 source files cleaned (R-018 through R-023)
- [ ] Route de-registered (R-024)
- [ ] All 5 frontend DHG references cleaned (R-025 through R-030)
- [ ] All 15+ test DHG assertions updated (R-051 through R-058)

**Exit criteria:** `grep -rn "'DHG'" apps/` returns 0 results. All enrollment tests pass.

## Phase 3 — Frontend Integration (Agent D)

**Objective:** Wire real components with real data to replace placeholders

**Prerequisites:** Phase 2 complete (shared types and corrected backend)
**Why third:** Frontend hooks must import correct types and unwrap correct responses

**Deliverables:**

- [ ] All hooks aligned to shared types (R-031 through R-036)
- [ ] Settings sheet enums and fields fixed (R-037, R-038)
- [ ] Inspector and auto-suggest keys fixed (R-039 through R-041)
- [ ] Staffing page placeholders replaced (R-042 through R-046)

**Exit criteria:** `pnpm --filter @budfin/web typecheck` passes. Page renders real grids.

## Phase 4 — Test Hardening (Agent E)

**Objective:** Replace false-confidence tests with correct assertions

**Prerequisites:** Phase 3 complete (tests must validate implemented state)
**Why fourth:** Cannot write correct tests until implementation is done

**Deliverables:**

- [ ] Migration alignment test expanded (R-048)
- [ ] Page test rewritten (R-049)
- [ ] Hook test mocks corrected (R-050)
- [ ] Import rejection test added (R-059)
- [ ] Stale-chain test created (R-060)
- [ ] Settings sheet test mocks corrected (R-061)

**Exit criteria:** `pnpm test` passes. No test asserts placeholder existence.

## Phase 5 — Documentation & Review (Agent F + Agent G)

**Objective:** Document decisions and perform independent review

**Prerequisites:** Phase 4 complete
**Deliverables:**

- [ ] ADR-031 committed (R-063)
- [ ] Clone comments added (R-062)
- [ ] Independent code review completed
- [ ] All verification gates passed

**Exit criteria:** `pnpm test && pnpm typecheck && pnpm lint` all pass. Reviewer sign-off.

---

# 7. File-by-File Remediation Plan

## `apps/api/prisma/schema.prisma`

- **Why:** Missing `requiredFteCalculated` field
- **Change:** Add `requiredFteCalculated Decimal? @default(0) @map("required_fte_calculated") @db.Decimal(7, 4)` after line 1146 (`requiredFtePlanned`)
- **Type:** Additive
- **Tests:** Migration alignment test (R-048)
- **Migration implication:** Must be included in the generated migration SQL

## `apps/api/prisma/migrations/XXXXXX_add_staffing_redesign_tables/migration.sql`

- **Why:** 11 tables + 8 columns + `requiredFteCalculated` have no SQL
- **Change:** Auto-generated by `prisma migrate dev`
- **Type:** Additive (new file)
- **Tests:** Migration alignment test, fresh DB deploy test
- **Implication:** This is the single most critical file in the remediation

## `apps/api/prisma/seeds/staffing-master-data.ts`

- **Why:** Insufficient discipline and alias coverage
- **Change:** Expand disciplines to 30+, aliases to 20+
- **Type:** Additive
- **Tests:** Seed success verification

## `packages/types/src/staffing.ts`

- **Why:** No shared contract between API and web
- **Change:** Create file with all staffing interfaces (per fix plan Task 3)
- **Type:** New file
- **Tests:** `pnpm --filter @budfin/types typecheck`

## `apps/api/src/routes/staffing/employees.ts`

- **Why:** snake_case serialization (line 108-142), IDOR TODO (line 264)
- **Change:** Rewrite `formatEmployee()` to camelCase, add version check, add cost derivation
- **Type:** Corrective
- **Tests:** Employee endpoint tests

## `apps/api/src/routes/staffing/settings.ts`

- **Why:** Double stale propagation (line 84), missing totals in teaching-requirements response
- **Change:** `STAFFING_STALE_MODULES = ['STAFFING']`, add totals aggregation
- **Type:** Corrective
- **Tests:** Settings test, teaching-requirements test

## `apps/api/src/routes/staffing/assignments.ts`

- **Why:** Double stale propagation (line 57)
- **Change:** `STAFFING_STALE_MODULES = ['STAFFING']`
- **Type:** Corrective
- **Tests:** Assignment tests

## `apps/api/src/routes/staffing/import.ts`

- **Why:** Accepts `hsa_amount` column (line 35)
- **Change:** Remove from OPTIONAL_COLUMNS, add warning
- **Type:** Corrective
- **Tests:** Import test with hsa_amount rejection case

## `apps/api/src/routes/staffing/calculate.ts`

- **Why:** `requiredFteCalculated` not persisted, HSA not cleared for ineligible
- **Change:** Capture pre-override FTE, clear HSA for ineligible employees
- **Type:** Corrective + Additive
- **Tests:** Calculate integration tests

## `apps/api/src/routes/staffing/index.ts`

- **Why:** `dhgGrilleRoutes` still registered
- **Change:** Remove import and registration
- **Type:** Cleanup
- **Tests:** Verify route 404s

## `apps/api/src/services/planning-rules.ts`

- **Why:** `'DHG'` at line 18
- **Change:** Remove `'DHG'` from array
- **Type:** Cleanup
- **Tests:** `planning-rules.test.ts` assertions

## `apps/api/src/services/enrollment-settings.ts`

- **Why:** `'DHG'` at line 11 (**missed by fix plan**)
- **Change:** Remove `'DHG'` from array
- **Type:** Cleanup
- **Tests:** `settings.test.ts` assertions

## `apps/api/src/services/enrollment-workspace.ts`

- **Why:** `'DHG'` at line 24 (**missed by fix plan**)
- **Change:** Remove `'DHG'` from array
- **Type:** Cleanup
- **Tests:** Related enrollment tests

## `apps/api/src/routes/enrollment/headcount.ts`

- **Why:** `'DHG'` at line 33
- **Change:** Remove `'DHG'` from `HEADCOUNT_STALE_MODULES`
- **Type:** Cleanup
- **Tests:** `headcount.test.ts:292` and other DHG assertions

## `apps/api/src/routes/enrollment/detail.ts`

- **Why:** `'DHG'` at line 7
- **Change:** Remove `'DHG'` from `DETAIL_STALE_MODULES`
- **Type:** Cleanup
- **Tests:** Detail endpoint tests

## `apps/api/src/routes/enrollment/nationality-breakdown.ts`

- **Why:** `'DHG'` at line 35
- **Change:** Remove `'DHG'` from `NATIONALITY_STALE_MODULES`
- **Type:** Cleanup
- **Tests:** `nationality-breakdown.test.ts` assertions

## `apps/api/src/routes/versions.ts`

- **Why:** Missing documentation on `disciplineId` non-remapping in clone
- **Change:** Add comments at lines 1262, 1281, 1303
- **Type:** Documentation only
- **Tests:** None required

## `apps/web/src/hooks/use-staffing.ts`

- **Why:** Wrong interfaces, wrappers, field names, DHG section header
- **Change:** Import from `@budfin/types`, fix all unwrapping, remove DHG section
- **Type:** Corrective
- **Tests:** `use-staffing-hooks.test.ts` mock updates

## `apps/web/src/hooks/use-master-data.ts`

- **Why:** Wrong profile field names, wrong auto-suggest keys
- **Change:** Import from `@budfin/types`, fix field access
- **Type:** Corrective
- **Tests:** `use-master-data.test.ts` mock updates

## `apps/web/src/pages/planning/staffing.tsx`

- **Why:** Placeholder divs at lines 239, 246
- **Change:** Replace with real components, mount hooks, bind data
- **Type:** Major corrective
- **Tests:** `staffing.test.tsx` complete rewrite

## `apps/web/src/components/staffing/staffing-settings-sheet.tsx`

- **Why:** Wrong enum (`PCT_PAYROLL`), wrong field names, DHG tab labels
- **Change:** Fix enums, fields, rename DHG labels
- **Type:** Corrective
- **Tests:** `staffing-settings-sheet.test.tsx` mock updates

## `apps/web/src/components/staffing/staffing-inspector-content.tsx`

- **Why:** Hardcoded ORS=24, `requirementLineId` in assignment payload
- **Change:** Read `effectiveOrs` dynamically, use `{band, disciplineId}`
- **Type:** Corrective
- **Tests:** `staffing-inspector-content.test.tsx`

## `apps/web/src/components/staffing/auto-suggest-dialog.tsx`

- **Why:** Uses `requirementLineId` for assignment creation
- **Change:** Use `{band, disciplineId}`
- **Type:** Corrective
- **Tests:** `auto-suggest-dialog.test.tsx`

## `apps/web/src/components/staffing/staffing-status-strip.tsx`

- **Why:** `DHG: 'DHG'` label at line 8
- **Change:** Remove DHG entry
- **Type:** Cleanup

## `apps/web/src/components/enrollment/enrollment-status-strip.tsx`

- **Why:** `DHG: 'DHG'` label at line 8 (**missed by fix plan**)
- **Change:** Remove DHG entry
- **Type:** Cleanup

## `apps/web/src/components/versions/version-detail-panel.tsx`

- **Why:** `DHG` in MODULE_ROUTES at line 24
- **Change:** Remove DHG entry
- **Type:** Cleanup

## `apps/web/src/components/staffing/dhg-view.tsx`

- **Why:** Entire legacy component (**missed by fix plan**)
- **Change:** Delete file or add deprecation marker
- **Type:** Cleanup

## Test Files Requiring Updates

| Test File                             | Change Required                                          | Reason                         |
| ------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| `headcount.test.ts`                   | Remove DHG from 3 assertions                             | DHG no longer in stale modules |
| `nationality-breakdown.test.ts`       | Remove DHG from 2 assertions                             | DHG no longer in stale modules |
| `planning-rules.test.ts`              | Remove DHG from 2 assertions                             | DHG no longer in stale modules |
| `settings.test.ts` (enrollment)       | Remove DHG from 3 assertions                             | DHG no longer in stale modules |
| `cohort-parameters.test.ts`           | Remove DHG from 2 assertions                             | DHG no longer in stale modules |
| `versions-clone.test.ts`              | Change `lineType: 'DHG'` to valid value                  | DHG is not a valid lineType    |
| `staffing.test.tsx`                   | Replace placeholder assertions with component assertions | Placeholders replaced          |
| `use-staffing-hooks.test.ts`          | Update mock shapes to match backend                      | Wrong wrappers and field names |
| `use-master-data.test.ts`             | Update profile mocks, remove DHG hook test               | Wrong field names              |
| `staffing-settings-sheet.test.tsx`    | Update mock field names, rename DHG tab                  | Wrong field names              |
| `staffing-inspector-content.test.tsx` | Update to use `(band, disciplineId)`                     | Was using `requirementLineId`  |
| `auto-suggest-dialog.test.tsx`        | Update to use `(band, disciplineId)`                     | Was using `requirementLineId`  |
| `import.test.ts`                      | Add hsa_amount rejection test case                       | Missing coverage               |
| `migration-alignment.test.ts`         | Add 12 staffing table assertions                         | 0 staffing coverage            |

---

# 8. Contract Alignment Matrix

| Feature                       | Frontend Expectation                   | Actual Backend Behavior                          | Gap                              | Required Fix                               | Owner   |
| ----------------------------- | -------------------------------------- | ------------------------------------------------ | -------------------------------- | ------------------------------------------ | ------- |
| Employee list wrapper         | `{data: Employee[]}`                   | `{employees: Employee[], total, page, pageSize}` | Wrong wrapper key                | Frontend: use `.employees`                 | Agent D |
| Employee field casing         | camelCase                              | snake_case (`function_role`, etc.)               | Casing mismatch                  | Backend: rewrite formatEmployee            | Agent B |
| Employee pagination           | `page_size`                            | Backend sends `page_size`                        | snake_case key                   | Backend: change to `pageSize`              | Agent B |
| Settings wrapper              | `{data: StaffingSettings}`             | `{settings: StaffingSettings}`                   | Wrong wrapper                    | Frontend: use `.settings`                  | Agent D |
| Settings HSA fields           | `hsaTargetHoursPerWeek`                | `hsaTargetHours`                                 | Field name                       | Frontend: rename                           | Agent D |
| Settings HSA rate fields      | `hsaRateFirstHour`                     | `hsaFirstHourRate`                               | Field name                       | Frontend: rename                           | Agent D |
| Profile fields                | `defaultOrs`, `isHsaEligible`, `label` | `weeklyServiceHours`, `hsaEligible`, `name`      | 3 field names                    | Frontend: rename                           | Agent D |
| Profiles wrapper              | `{data: ServiceProfile[]}`             | `{profiles: ServiceProfile[]}`                   | Wrong wrapper                    | Frontend: use `.profiles`                  | Agent D |
| Overrides wrapper             | `{data: Override[]}`                   | `{overrides: Override[]}`                        | Wrong wrapper                    | Frontend: use `.overrides`                 | Agent D |
| Cost assumptions wrapper      | `{data: Assumption[]}`                 | `{assumptions: Assumption[]}`                    | Wrong wrapper                    | Frontend: use `.assumptions`               | Agent D |
| Assignments wrapper           | `{data: Assignment[]}`                 | `{assignments: Assignment[]}`                    | Wrong wrapper                    | Frontend: use `.assignments`               | Agent D |
| Assignment keys               | `requirementLineId`                    | `(band, disciplineId)`                           | Structural mismatch              | Frontend: use compound key                 | Agent D |
| Teaching requirements wrapper | `{data: Line[], totals}`               | `{lines: Line[], totals, warnings}`              | Wrong wrapper + missing warnings | Frontend: use `.lines`, handle `.warnings` | Agent D |
| Cost mode enum                | `PCT_PAYROLL`                          | `PERCENT_OF_PAYROLL`                             | Enum value                       | Frontend: change value                     | Agent D |
| Auto-suggest result           | `requirementLineId`                    | `band`, `disciplineId`, `disciplineCode`         | Structural mismatch              | Frontend: use new fields                   | Agent D |
| Inspector ORS                 | Hardcoded `24`                         | Dynamic per `effectiveOrs` on line               | Wrong value source               | Frontend: read from line                   | Agent D |
| Employee cost fields          | Not present                            | `monthlyCost`, `annualCost` (derived)            | Missing fields                   | Backend: add cost join                     | Agent B |

---

# 9. Migration and Data Safety Plan

## Required Migration Content

The single catch-up migration must contain:

### New Tables (11)

1. `service_obligation_profiles` — 8 columns + PK + unique on code
2. `disciplines` — 6 columns + PK + unique on code
3. `discipline_aliases` — 3 columns + PK + unique on alias + FK to disciplines
4. `dhg_rules` — 12 columns + PK + composite unique + 2 indexes + 2 FKs
5. `version_staffing_settings` — 10 columns + PK + unique on version_id + FK
6. `version_service_profile_overrides` — 6 columns + PK + composite unique + 2 FKs
7. `version_staffing_cost_assumptions` — 6 columns + PK + composite unique + FK
8. `version_lycee_group_assumptions` — 7 columns + PK + composite unique + 2 FKs
9. `demand_overrides` — 10 columns + PK + composite unique + 2 FKs
10. `teaching_requirement_sources` — 11 columns + PK + composite unique + index + 2 FKs
11. `teaching_requirement_lines` — 18 columns (including `required_fte_calculated`) + PK + composite unique + index + FK

### Column Additions (8)

1. `employees.record_type` VARCHAR(10) DEFAULT 'EMPLOYEE'
2. `employees.cost_mode` VARCHAR(20) DEFAULT 'LOCAL_PAYROLL'
3. `employees.discipline_id` INTEGER NULL + FK to disciplines
4. `employees.service_profile_id` INTEGER NULL + FK to service_obligation_profiles
5. `employees.home_band` VARCHAR(15) NULL
6. `employees.contract_end_date` DATE NULL
7. `category_monthly_costs.calculation_mode` VARCHAR(25) DEFAULT 'PERCENT_OF_PAYROLL'
8. `teaching_requirement_lines.required_fte_calculated` DECIMAL(7,4) NULL DEFAULT 0

### Idempotency

- Migration is generated by Prisma and applied via `prisma migrate deploy`
- Prisma tracks applied migrations in `_prisma_migrations` table
- Re-running is safe (already-applied migrations are skipped)

### Empty DB Validation

- After migration: `prisma db seed` must succeed
- Seed creates service profiles, disciplines, aliases
- All FK constraints must be satisfiable from seed data

### Upgrade Path (Existing DB)

- All new columns on `employees` are either nullable or have defaults
- All new columns on `category_monthly_costs` have defaults
- No data loss on existing records
- Existing employee rows get `record_type = 'EMPLOYEE'`, `cost_mode = 'LOCAL_PAYROLL'`

### Rollback

- If migration must be rolled back: `prisma migrate resolve --rolled-back MIGRATION_NAME`
- Manual SQL to drop new tables and columns can be crafted from the migration file
- **Recommendation:** Test on a DB clone before production

### Production Safety Concerns

- Migration adds columns with DEFAULT — safe for large tables
- FK additions reference empty new tables — no constraint violations
- `employees` ALTER TABLE adds nullable columns — no existing row issues

---

# 10. Testing Strategy Reset

## A. Migration Tests

**What:** Verify migration SQL contains all expected tables, columns, indexes, and FKs
**Why existing is insufficient:** `migration-alignment.test.ts` covers 0 staffing tables
**Required fixtures:** Read migration SQL file contents
**Pass criteria:** All 12 tables + 8 columns + key indexes found in SQL

## B. Backend Contract Tests

**What:** Verify response shapes match `@budfin/types` interfaces
**Why existing is insufficient:** Existing tests don't validate response wrapper names or field casing
**Required fixtures:** Real Prisma-backed test DB with seeded data
**Pass criteria:** Every endpoint returns the exact shape defined in shared types

## C. Calculation Integrity Tests

**What:** Verify demand engine, coverage engine, cost engine produce correct outputs
**Why existing is insufficient:** Tests may not cover `requiredFteCalculated` persistence or HSA clearing
**Required fixtures:** Enrolled students, DhgRules, employees with assignments
**Pass criteria:** `requiredFteCalculated` preserved through override, HSA zeroed for ineligible

## D. Frontend Integration Tests

**What:** Verify hooks unwrap correct response wrappers and components render real data
**Why existing is insufficient:** Mock shapes use wrong wrappers (`{data}` vs named)
**Required fixtures:** MSW or vi.mock with shapes matching backend Zod schemas
**Pass criteria:** No mock uses `{data}` wrapper. All fields match `@budfin/types`.

## E. Stale Propagation Tests

**What:** Verify stale chain is ENROLLMENT → REVENUE → STAFFING → PNL with no DHG
**Why existing is insufficient:** Tests explicitly assert `'DHG'` presence
**Required fixtures:** Version with enrollment mutations
**Pass criteria:** No `'DHG'` in any stale module array. STAFFING marked on enrollment change.

## F. Security / Authorization Tests

**What:** Verify version-scoped endpoints validate version existence
**Why existing is insufficient:** IDOR TODO at `employees.ts:264`
**Required fixtures:** Invalid versionId requests
**Pass criteria:** 404 returned for non-existent version, not data leak

## Tests Providing False Confidence (must be rewritten)

| Test                               | False Confidence Pattern                |
| ---------------------------------- | --------------------------------------- |
| `staffing.test.tsx:334`            | Asserts placeholder text exists         |
| `staffing.test.tsx:339`            | Asserts placeholder text exists         |
| `use-staffing-hooks.test.ts`       | Mocks use `{data}` wrapper              |
| `use-master-data.test.ts`          | Mocks use `defaultOrs`, `isHsaEligible` |
| `headcount.test.ts:292`            | Asserts `toContain('DHG')`              |
| All enrollment tests with DHG      | Assert presence of phantom module       |
| `staffing-settings-sheet.test.tsx` | Mocks use wrong HSA field names         |

---

# 11. Documentation Remediation Plan

| Document                                         | Owner   | Purpose                                                    | When              | Evidence Required                          |
| ------------------------------------------------ | ------- | ---------------------------------------------------------- | ----------------- | ------------------------------------------ |
| `docs/adr/ADR-031-dhg-to-staffing-absorption.md` | Agent F | Record DHG → STAFFING absorption decision                  | After Phase 2b    | Stale chain before/after, file changes     |
| `versions.ts` inline comments                    | Agent F | Document intentional `disciplineId` non-remapping in clone | After Phase 2     | Comment at 3 locations                     |
| This remediation plan                            | N/A     | Already produced                                           | Now               | This document                              |
| `docs/plans/2026-03-18-dhg-staffing-fix.md`      | Agent F | Mark gaps identified by this review                        | After remediation | Annotate fix plan with NF-01 through NF-10 |

---

# 12. Release Gate Framework

## Blockers (must close before ANY release candidate)

| Gate                                            | Evidence Required                                          | Validation Owner | Reviewer Sign-off |
| ----------------------------------------------- | ---------------------------------------------------------- | ---------------- | ----------------- |
| Migration deploys on fresh DB                   | `prisma migrate deploy && prisma db seed` succeeds         | Agent A          | Agent G           |
| `requiredFteCalculated` in schema and migration | `grep required_fte_calculated migration.sql` returns match | Agent A          | Agent G           |
| Zero `'DHG'` in source files                    | `grep -rn "'DHG'" apps/api/src apps/web/src` returns 0     | Agent C          | Agent G           |
| Staffing page renders real components           | Manual or automated UI verification                        | Agent D          | Agent G           |
| `pnpm typecheck` passes                         | CI output                                                  | All              | Agent G           |
| `pnpm test` passes                              | CI output                                                  | All              | Agent G           |
| `pnpm lint` passes                              | CI output                                                  | All              | Agent G           |

## Critical Readiness Criteria (must close before business validation)

| Gate                                  | Evidence Required                                                                    | Validation Owner |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ---------------- |
| All hooks import from `@budfin/types` | `grep -rn "from '@budfin/types'" apps/web/src/hooks/use-staffing.ts` returns matches | Agent D          |
| No placeholder text in staffing page  | `grep "placeholder" staffing.tsx` returns 0                                          | Agent D          |
| Teaching grid shows real data         | Visual verification with seeded DB                                                   | Agent D          |
| Toolbar buttons open real dialogs     | Manual click-through verification                                                    | Agent D          |
| Inspector shows line detail           | Select a row and verify panel content                                                | Agent D          |
| KPI ribbon shows totals from API      | Compare ribbon values to API response                                                | Agent D          |

## Final Release Criteria (must close before ship approval)

| Gate                                | Evidence Required                                                        | Validation Owner |
| ----------------------------------- | ------------------------------------------------------------------------ | ---------------- |
| ADR-031 committed                   | File exists in `docs/adr/`                                               | Agent F          |
| No false-confidence tests           | Audit test assertions for placeholder/DHG/wrong-mock patterns            | Agent E          |
| Clone logic preserves staffing data | Clone a version and verify settings, assignments, overrides copied       | Agent E          |
| Stale chain works end-to-end        | Mutate enrollment → verify STAFFING stale → calculate → verify PNL stale | Agent E          |
| Import ignores hsa_amount           | Import CSV with hsa_amount column → verify warning                       | Agent E          |

---

# 13. Final Recommended Plan

## Prioritized Remediation Roadmap

| Phase | Description                          | Agents | Parallel?                | Estimated Scope                |
| ----- | ------------------------------------ | ------ | ------------------------ | ------------------------------ |
| 0     | Truth Revalidation                   | N/A    | N/A                      | DONE                           |
| 1     | Deployment Safety                    | A      | Sequential               | 3 items (R-001-R-003)          |
| 2     | Contract Foundation + Legacy Cleanup | B + C  | YES (parallel)           | 25 items (R-007-R-030)         |
| 3     | Frontend Integration                 | D      | Sequential after Phase 2 | 16 items (R-031-R-046)         |
| 4     | Test Hardening                       | E      | Sequential after Phase 3 | 14 items (R-048-R-061)         |
| 5     | Documentation + Review               | F + G  | YES (parallel)           | 3 items (R-062-R-063) + review |

## Top 15 Implementation Actions

1. Add `requiredFteCalculated` to `schema.prisma` (R-001)
2. Generate migration SQL with `prisma migrate dev` (R-002)
3. Verify migration contains all 12 tables + 8 columns (R-003)
4. Create `packages/types/src/staffing.ts` (R-007)
5. Remove `'DHG'` from ALL 6 source files (R-018 through R-023)
6. Remove `'DHG'` from ALL test expectations (R-051 through R-058)
7. Rewrite `formatEmployee()` to camelCase (R-009)
8. Fix stale propagation to `['STAFFING']` only (R-012)
9. Align `use-staffing.ts` hooks to shared types (R-031 through R-035)
10. Align `use-master-data.ts` to shared types (R-036)
11. Replace staffing page placeholders with real components (R-042)
12. Wire toolbar button handlers (R-046)
13. Mount KPI ribbon and inspector (R-043, R-045)
14. Rewrite page test to assert real components (R-049)
15. Correct all hook test mock shapes (R-050)

## Top 10 Reviewer Checkpoints

1. Migration SQL contains ALL expected tables (count: 12)
2. `grep -rn "'DHG'" apps/` returns zero results
3. `packages/types/src/staffing.ts` interfaces match backend Zod schemas
4. All frontend hooks import from `@budfin/types` (zero local interfaces)
5. No `{data}` wrapper in any frontend hook unwrapping
6. `staffing.tsx` has zero placeholder `<div>` tags
7. `formatEmployee()` returns all camelCase fields
8. `requiredFteCalculated` persisted in calculate pipeline
9. All test mocks use named wrappers matching backend
10. `pnpm test && pnpm typecheck && pnpm lint` all green

## Top 10 QA Checkpoints

1. Fresh database: `prisma migrate deploy && prisma db seed` succeeds
2. GET `/versions/:id/staffing/settings` returns `{settings: {...}}` (not `{data}`)
3. GET `/versions/:id/employees` returns camelCase fields
4. POST enrollment mutation does NOT add `'DHG'` to staleModules
5. GET teaching-requirements returns `{lines, totals, warnings}`
6. Staffing page renders `TeachingMasterGrid` with data rows
7. Import CSV with `hsa_amount` column returns warning
8. Version clone copies `VersionStaffingSettings` and `StaffingAssignment` records
9. ORS in inspector changes based on selected line's service profile
10. All tests pass without any `DHG` assertions

## Final Go/No-Go Recommendation

**Current recommendation:** NO-GO

**Conditions for reconsidering:**

1. ALL Blocker gates in section 12 are closed (verified by Agent G)
2. ALL Critical Readiness gates are closed
3. `pnpm test && pnpm typecheck && pnpm lint` all pass with zero errors
4. Independent reviewer (Agent G) confirms no remaining false-confidence tests
5. Fresh DB deployment verified end-to-end (migrate → seed → API start → staffing page loads)

The remediation is structured, bounded, and recoverable. The fix plan (29 tasks) covers approximately 80% of the work. This remediation plan adds 15 additional items (NF-01 through NF-10 + expanded DHG test cleanup) and provides the execution framework, sequencing, and validation gates needed to reach deployment readiness.

---

_Generated: 2026-03-18_
_Source: Full codebase audit against redesign spec and prior fix plan_
_Total remediation items: 63 (R-001 through R-063)_
_Blocker items: 7 | High items: 32 | Medium items: 19 | Low items: 5_
