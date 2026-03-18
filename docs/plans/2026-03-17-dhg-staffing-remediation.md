# DHG / Staffing Redesign Comprehensive Remediation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the DHG/Staffing redesign (Epics 18-20) from NOT READY to fully deployable, validated, end-to-end implementation.

**Architecture:** Fix migration chain, align backend/frontend contracts, wire the placeholder frontend shell to real data, remove legacy DHG contamination, and harden tests to prove correctness.

**Tech Stack:** Prisma 6, Fastify 5, Zod 4, React 19, TanStack Query/Table, Vitest 4, decimal.js

---

# 1. Executive Recovery Verdict

**Current overall status:** NOT READY
**Confidence level:** HIGH (validated by 6-agent parallel codebase audit)
**Prior NO-GO verdict:** CONFIRMED and EXPANDED with 4 additional findings

**Recovery outlook:** RECOVERABLE WITH MODERATE EFFORT

The calculation engines (demand, coverage, HSA, cost, category-cost) are production-quality pure functions with correct decimal.js usage. The transaction orchestration in `calculate.ts` is solid. Version clone logic is mostly correct. These represent ~40% of the redesign scope and are done well. The remaining 60% is blocked by migration gaps, contract mismatches, and an unfinished frontend shell.

**Top 10 reasons for the verdict:**

1. **12+ missing DDL statements** - Prisma schema defines 11 new tables and 7 column additions; only `staffing_assignments` has a checked-in migration. Fresh deploys are broken by construction.
2. **Staffing page is a placeholder shell** - `staffing.tsx` renders `<div>Teaching workspace</div>` instead of `TeachingMasterGrid`, `SupportAdminGrid`, `StaffingKpiRibbon`, `StaffingStatusStrip`.
3. **Systemic frontend/backend contract mismatch** - Backend returns `{ settings: {...} }`, `{ profiles: [...] }`, `{ overrides: [...] }`; frontend expects `{ data: {...} }` everywhere. Field names diverge (`weeklyServiceHours` vs `defaultOrs`, `hsaEligible` vs `isHsaEligible`, `PERCENT_OF_PAYROLL` vs `PCT_PAYROLL`).
4. **No per-line sources endpoint** - The redesign spec requires `GET /teaching-requirements/:id/sources` for inspector detail; this route does not exist.
5. **Missing `requiredFteCalculated` field** - Schema has no separate field to preserve the original calculated FTE when a demand override is applied. Override auditability is broken.
6. **Legacy DHG stale-module contamination** - 4 enrollment route files still include `'DHG'` in stale-module constants. Legacy `dhg-grille.ts` route is still registered.
7. **Import accepts manual `hsa_amount`** - The redesign specifies HSA is computed-only, but the import route still parses and persists `hsa_amount` from CSV input.
8. **Stale propagation marks PNL too early on mutations** - `settings.ts:84` and `assignments.ts:57` define `STAFFING_STALE_MODULES = ['STAFFING', 'PNL']`, but the redesign spec says mutations mark only STAFFING; only recalculation marks PNL.
9. **Tests provide false confidence** - `staffing.test.tsx` asserts placeholder text. `use-staffing-hooks.test.ts` mocks `{ data: [...] }` wrappers the backend doesn't return. `migration-alignment.test.ts` doesn't cover any staffing tables.
10. **Incomplete master-data catalog** - Only 18 disciplines and 7 aliases seeded. No DhgRule backfill from legacy `DhgGrilleConfig`. Seed data insufficient for production mapping quality.

---

# 2. Scope Validation and Review Expansion

| ID   | Finding                                                                                            | Source       | Confirmed?                    | Severity | Area             | Notes                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------- | ------------ | ----------------------------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-01 | Missing staffing DDL in migration chain                                                            | Prior review | YES                           | Critical | Data             | 11 tables + 7 columns missing. Only `staffing_assignments` has DDL.                                                                                                                                                                                                                                                                                                                              |
| F-02 | Main staffing page is placeholder shell                                                            | Prior review | YES                           | Critical | Frontend         | Lines 237-251: renders `<div>Teaching workspace</div>` literal                                                                                                                                                                                                                                                                                                                                   |
| F-03 | Frontend/backend contract mismatch                                                                 | Prior review | YES + EXPANDED                | Critical | Contract         | Prior review identified `{ data }` vs raw. Actual: backend uses named wrappers (`{ settings }`, `{ profiles }`, `{ overrides }`). Also: snake_case vs camelCase for employees, enum value mismatches.                                                                                                                                                                                            |
| F-04 | Legacy DHG runtime paths not removed                                                               | Prior review | YES                           | High     | Backend/Frontend | `'DHG'` in 4 enrollment stale constants. `dhg-grille.ts` still registered.                                                                                                                                                                                                                                                                                                                       |
| F-05 | Override provenance (`requiredFteCalculated`) missing                                              | Prior review | YES                           | High     | Data/Backend     | No field in schema. `calculate.ts:294` overwrites `requiredFtePlanned`.                                                                                                                                                                                                                                                                                                                          |
| F-06 | Import accepts manual `hsa_amount`                                                                 | Prior review | YES                           | High     | Backend          | `import.ts:35` includes `hsa_amount` as accepted column.                                                                                                                                                                                                                                                                                                                                         |
| F-07 | Incomplete master-data / DhgRule migration                                                         | Prior review | YES                           | High     | Data             | No DhgRule backfill checked in. Only 7 aliases seeded.                                                                                                                                                                                                                                                                                                                                           |
| F-08 | Stale propagation marks PNL too early                                                              | Prior review | YES — CONFIRMED as a real bug | High     | Backend          | Both `settings.ts:84` and `assignments.ts:57` define `STAFFING_STALE_MODULES = ['STAFFING', 'PNL']`, marking PNL stale on every mutation. The redesign spec (lines 2000-2009) is unambiguous: mutations mark STAFFING only; only staffing _recalculation_ marks PNL stale. The current code violates the spec.                                                                                   |
| F-09 | Tests provide false confidence                                                                     | Prior review | YES                           | Medium   | QA               | `migration-alignment.test.ts` covers 0 staffing tables. Frontend tests mock wrong contracts.                                                                                                                                                                                                                                                                                                     |
| F-10 | Version-ownership / IDOR TODO                                                                      | Prior review | YES                           | Medium   | Security         | `employees.ts:264` has explicit TODO.                                                                                                                                                                                                                                                                                                                                                            |
| F-11 | **NEW**: Clone disciplineId not remapped in 3 tables                                               | New finding  | N/A                           | Low      | Backend          | `VersionLyceeGroupAssumption`, `DemandOverride`, `StaffingAssignment` copy `disciplineId` verbatim. This is correct because disciplines are global master data (not version-scoped), so IDs are stable across versions. Needs an explicit code comment documenting this assumption.                                                                                                              |
| F-12 | **NEW**: Employee API uses snake_case and is missing derived cost fields                           | New finding  | N/A                           | Critical | Contract         | Employee list returns snake_case payroll inputs (`employee_code`, `function_role`, etc.) while frontend expects camelCase (`employeeCode`, `functionRole`). Additionally, `support-admin-grid.tsx:494,506` accesses `monthlyCost`/`annualCost` but these derived fields do not exist in the employee list response at all — the API only returns raw payroll inputs, not calculated cost totals. |
| F-13 | **NEW**: Service profile field name mismatches (5 fields)                                          | New finding  | N/A                           | Critical | Contract         | Backend: `weeklyServiceHours`, `hsaEligible`. Frontend: `defaultOrs`, `isHsaEligible`. Response key: `profiles` vs `data`.                                                                                                                                                                                                                                                                       |
| F-14 | **NEW**: Cost mode enum mismatch                                                                   | New finding  | N/A                           | Critical | Contract         | Frontend uses `FLAT_ANNUAL`, `PCT_PAYROLL`, `AMOUNT_PER_FTE` (category modes). Backend employee `costMode` uses `LOCAL_PAYROLL`, `AEFE_RECHARGE`, `NO_LOCAL_COST`. These are different domain concepts conflated in the settings sheet.                                                                                                                                                          |
| F-15 | **NEW**: Inspector hardcodes ORS = 24                                                              | New finding  | N/A                           | High     | Frontend         | `staffing-inspector-content.tsx:110`: `fte * 24` instead of reading actual ORS from service profile.                                                                                                                                                                                                                                                                                             |
| F-16 | **NEW**: Support grid depends on `monthlyCost`/`annualCost` fields the employee API doesn't return | New finding  | N/A                           | High     | Contract         | `support-admin-grid.tsx:494,506` accesses derived cost fields; employee list returns payroll inputs only.                                                                                                                                                                                                                                                                                        |
| F-17 | **NEW**: Seed cost assumption values don't match seed-config                                       | New finding  | N/A                           | Low      | Data             | Migration seeds 1.13%/1.27%; `seed-config.ts` defines 2%/1%. No documentation for which is correct.                                                                                                                                                                                                                                                                                              |

---

# 3. Root Cause Analysis

## RCA-1: Schema vs Migration Drift

- **Problem:** 11 tables and 7 columns exist in `schema.prisma` but have no CREATE TABLE/ALTER TABLE in checked-in migrations.
- **Observed symptom:** `prisma migrate deploy` on a fresh database would fail or produce a schema missing required tables.
- **Root cause:** Prisma schema was edited to define the redesign models, but `prisma migrate dev` was either run locally (generating a migration in a local-only `.prisma/migrations/` directory) or never run at all. The resulting migration SQL was never committed.
- **Why it happened:** Development workflow allowed Prisma Client generation (`prisma generate`) to succeed against the updated schema without requiring a committed migration. Tests use mocks, not a real database, so the gap was invisible.
- **Risk if left unresolved:** Any deployment (fresh or upgrade) fails. The entire redesign is non-deployable.
- **Corrective principle:** Run `prisma migrate dev` against a real database, commit the resulting SQL, and add a CI step that validates `prisma migrate status` returns no pending migrations.

## RCA-2: Backend/Frontend Contract Drift

- **Problem:** Frontend hooks expect `{ data: [...] }` wrappers, specific field names (`defaultOrs`, `isHsaEligible`, `requirementLineId`), and camelCase employee fields. Backend returns named wrappers (`{ profiles }`, `{ settings }`, `{ overrides }`), different field names (`weeklyServiceHours`, `hsaEligible`), and snake_case employee fields.
- **Observed symptom:** Every frontend hook and component that consumes staffing data would receive undefined or misstructured responses.
- **Root cause:** Backend and frontend were developed against different informal contracts. No shared type definitions or contract tests exist between the two workspaces.
- **Why it happened:** The monorepo has a `packages/types/` workspace, but no staffing types were added there. Each side coded to its own interpretation of the spec.
- **Risk if left unresolved:** The redesigned UI is non-functional even if the page shell is wired up.
- **Corrective principle:** Define shared Zod response schemas in `packages/types/`, use them in both API route schemas and frontend hooks for runtime validation, and add contract tests that assert backend responses pass `schema.parse()`.

## RCA-3: Placeholder Frontend Integration

- **Problem:** `staffing.tsx` renders placeholder `<div>` elements instead of the actual grid/ribbon/strip/inspector components.
- **Observed symptom:** Users see "Teaching workspace" and "Support & Admin workspace" text instead of functional grids.
- **Root cause:** Components were developed in isolation (each has its own test file), but the page-level integration step was never completed. The PRs for Epic 20 (#234-#239) delivered components individually but didn't update the page entrypoint.
- **Why it happened:** Story decomposition separated component creation from page integration. The final integration story was either deferred or missed.
- **Risk if left unresolved:** Epic 20 is not delivered as a product feature.
- **Corrective principle:** The staffing page must compose all components, pass real hook data, and have an integration test that renders against realistic mock data.

## RCA-4: Legacy DHG Coexistence

- **Problem:** The redesign folds DHG into STAFFING, but `'DHG'` remains in stale-module constants and the legacy `dhg-grille.ts` route is still registered.
- **Observed symptom:** Enrollment changes mark `DHG` stale (a module that no longer exists as a separate concept). Frontend version-detail may show stale indicators for a removed module.
- **Root cause:** The enrollment routes and version-detail UI were not updated as part of the redesign.
- **Why it happened:** Epic scope focused on staffing routes; enrollment routes that reference staffing's stale chain were out of scope.
- **Risk if left unresolved:** Confusing UX, stale-state semantic pollution, potential for stale-chain logic errors if DHG and STAFFING diverge.
- **Corrective principle:** Remove `'DHG'` from all stale-module constants. Either retire `dhg-grille.ts` or mark it deprecated with a comment and exclude from stale propagation.

## RCA-5: False-Positive Testing Strategy

- **Problem:** Tests pass, but they validate mocked contracts that don't match reality and assert placeholder behavior instead of real functionality.
- **Observed symptom:** CI is green while the system is non-functional end-to-end.
- **Root cause:** Frontend tests mock API responses using assumed shapes. Backend tests use mocked Prisma that always succeeds. No integration or contract tests bridge the two.
- **Why it happened:** Standard unit-test approach in isolation without cross-layer validation. No test-time enforcement of shared contracts.
- **Risk if left unresolved:** False confidence in release readiness. Regressions introduced by fixes go undetected.
- **Corrective principle:** Add contract tests using shared Zod schemas (runtime validators, not just TS types) from real backend responses. Replace placeholder page test with integration test using real component rendering.

## RCA-6: Stale Propagation Spec Violation

- **Problem:** `settings.ts:84` and `assignments.ts:57` define `STAFFING_STALE_MODULES = ['STAFFING', 'PNL']`, marking PNL stale on every settings/assignment mutation. The redesign spec (lines 2000-2009) says mutations should mark only `STAFFING`; only staffing _recalculation_ should add `PNL`.
- **Observed symptom:** PNL is marked stale prematurely (on every settings tweak), making stale indicators noisier than intended and potentially triggering unnecessary P&L recalculations.
- **Root cause:** The implementation used a conservative approach of dirtying the entire downstream chain on any input change, rather than the spec's design of limiting cascade to the immediately-affected module.
- **Why it happened:** The redesign spec's stale-chain rules were either misread or intentionally broadened during implementation. No test validates the exact stale-chain behavior against the spec.
- **Risk if left unresolved:** Status indicators and downstream recalculation semantics drift from the agreed chain. Users see "PNL stale" warnings that are premature.
- **Corrective principle:** Change `STAFFING_STALE_MODULES` to `['STAFFING']` in both files. The `calculate.ts:735` route already correctly adds PNL after recalculation. Add a stale-chain regression test that asserts: mutation -> only STAFFING stale; recalculation -> STAFFING cleared, PNL added.

---

# 4. Full Remediation Backlog

## Workstream 1: Data Model & Migration Remediation

| ID    | Issue                                                             | Required Change                                                                                                                                                                                                                                                                                                                                                                    | Severity | Priority | Dependency | Owner   | QA Validation                                        | Done Criteria                                                        |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------- | ------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| DM-01 | 11 missing CREATE TABLE statements                                | Run `prisma migrate dev` to generate migration SQL for all new tables: `service_obligation_profiles`, `disciplines`, `discipline_aliases`, `dhg_rules`, `version_staffing_settings`, `version_service_profile_overrides`, `version_staffing_cost_assumptions`, `version_lycee_group_assumptions`, `demand_overrides`, `teaching_requirement_sources`, `teaching_requirement_lines` | Critical | P0       | None       | Agent A | `prisma migrate deploy` on empty DB succeeds         | All 11 tables exist with correct columns, indexes, FKs               |
| DM-02 | Missing ALTER TABLE for Employee (6 columns)                      | Add `record_type`, `cost_mode`, `discipline_id`, `service_profile_id`, `home_band`, `contract_end_date` to employees table                                                                                                                                                                                                                                                         | Critical | P0       | DM-01      | Agent A | Verify columns exist post-migration                  | Employee table has all 6 new columns with correct types and defaults |
| DM-03 | Missing `calculation_mode` on `category_monthly_costs`            | Add column to existing table                                                                                                                                                                                                                                                                                                                                                       | Critical | P0       | DM-01      | Agent A | Column exists with default `PERCENT_OF_PAYROLL`      | Column present, default correct                                      |
| DM-04 | Missing `required_fte_calculated` on `teaching_requirement_lines` | Add `required_fte_calculated DECIMAL(15,4)` column                                                                                                                                                                                                                                                                                                                                 | High     | P1       | DM-01      | Agent A | Column exists, demand engine persists original value | Override provenance preserved                                        |
| DM-05 | `staffing_assignments` FK to non-existent `disciplines` table     | Migration 20260317 references `disciplines.id` but table not created                                                                                                                                                                                                                                                                                                               | Critical | P0       | DM-01      | Agent A | FK constraint valid after full migration chain       | No orphaned FK references                                            |

## Workstream 2: Master Data & Backfill Remediation

| ID    | Issue                                                     | Required Change                                                                                                                                                  | Severity | Priority | Dependency | Owner   | QA Validation                                         | Done Criteria                                        |
| ----- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------- | ------- | ----------------------------------------------------- | ---------------------------------------------------- |
| MD-01 | DhgRule migration/backfill missing                        | Write idempotent migration from `DhgGrilleConfig` to `DhgRule` with resolved `serviceProfileId`, `disciplineId`, `lineType`, `driverType`                        | Critical | P0       | DM-01      | Agent A | Backfill produces correct rule count, all FKs valid   | DhgRule table populated, matches legacy grille count |
| MD-02 | Only 18 disciplines and 7 aliases seeded                  | Expand to full EFIR catalog: all SUBJECT, ROLE, POOL disciplines with comprehensive alias coverage (abbreviations, French/English variants, common misspellings) | High     | P1       | DM-01      | Agent A | Alias resolution tests pass for common input variants | >= 30 disciplines, >= 20 aliases                     |
| MD-03 | Seed cost assumption values inconsistent with seed-config | Reconcile: either migration uses seed-config values (2%, 1%) or seed-config is updated to match migration (1.13%, 1.27%). Document the source of truth.          | Low      | P3       | None       | Agent G | Values match a single source of truth                 | Single documented source, no contradictions          |

## Workstream 3: Backend Contract & Route Remediation

| ID    | Issue                                                                                              | Required Change                                                                                                                                                                                                                                                                              | Severity | Priority | Dependency | Owner       | QA Validation                                                                                                                   | Done Criteria                                  |
| ----- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| BC-01 | Missing `GET /teaching-requirements/:id/sources` endpoint                                          | Add route in `settings.ts` that returns `TeachingRequirementSource[]` filtered by `teachingRequirementLineId`                                                                                                                                                                                | High     | P1       | DM-01      | Agent B     | Route returns sources for a specific line, 404 for missing                                                                      | Inspector detail works                         |
| BC-02 | Employee list returns snake_case fields                                                            | Add response serialization to camelCase (or define shared types and adjust)                                                                                                                                                                                                                  | Critical | P0       | None       | Agent B     | Response fields are camelCase                                                                                                   | Frontend `Employee` interface matches response |
| BC-03 | Service profile response key is `{ profiles }` but frontend expects `{ data }`                     | Align on contract: either change backend to return `{ data }` or frontend to read `{ profiles }`                                                                                                                                                                                             | Critical | P0       | None       | Agent B + D | Contract test passes                                                                                                            | Single agreed response shape                   |
| BC-04 | Service profile fields diverge: `weeklyServiceHours`/`hsaEligible` vs `defaultOrs`/`isHsaEligible` | Define canonical field names in shared types, align both sides                                                                                                                                                                                                                               | Critical | P0       | None       | Agent B + D | Shared type compiles in both workspaces                                                                                         | No field name mismatches                       |
| BC-05 | `requiredFteCalculated` not persisted by demand engine                                             | In `calculate.ts`, persist original demand FTE as `requiredFteCalculated` before applying overrides to `requiredFtePlanned`                                                                                                                                                                  | High     | P1       | DM-04      | Agent B     | Calculation with override preserves original value                                                                              | Override provenance testable                   |
| BC-06 | Import still accepts `hsa_amount` column                                                           | Remove `hsa_amount` from accepted import columns in `import.ts`. Log warning if column present in CSV.                                                                                                                                                                                       | High     | P1       | None       | Agent B     | Import with `hsa_amount` column ignores it                                                                                      | HSA is computed-only                           |
| BC-07 | Employee list API doesn't return `monthlyCost`/`annualCost` for support grid                       | Either add derived cost fields to employee list response (from latest `MonthlyStaffCost`) or create a dedicated support-staff cost summary endpoint                                                                                                                                          | High     | P1       | None       | Agent B     | Support grid receives cost data                                                                                                 | Non-teaching workspace shows costs             |
| BC-08 | Version-ownership / IDOR TODO in employee routes                                                   | Add version-ownership validation middleware. Verify requesting user has access to the version's fiscal year.                                                                                                                                                                                 | Medium   | P2       | None       | Agent B     | Unauthorized version access returns 403                                                                                         | Security gap closed                            |
| BC-09 | Teaching-requirements response missing `totals` and `warnings`                                     | Backend `settings.ts:792` returns only `{ lines: [...] }`. The redesign spec requires `{ lines, totals, warnings }` with aggregated FTE/cost totals and coverage warnings. Add `totals` and `warnings` fields to the teaching-requirements response.                                         | High     | P1       | None       | Agent B     | Response includes totals (totalFteRaw, totalFteCovered, totalFteGap, totalDirectCost, totalHsaCost, heRatio) and warnings array | KPI ribbon and status strip have data source   |
| BC-10 | Stale propagation marks PNL too early on mutations                                                 | `settings.ts:84` and `assignments.ts:57` define `STAFFING_STALE_MODULES = ['STAFFING', 'PNL']`. Per redesign spec (lines 2000-2009), mutations must mark only STAFFING. Change both constants to `['STAFFING']` only. PNL is already correctly added by `calculate.ts:735` on recalculation. | High     | P1       | None       | Agent B     | Settings/assignment mutations mark only STAFFING stale; PNL only marked after recalculation                                     | Stale chain matches redesign spec              |

## Workstream 4: Calculation Integrity Remediation

| ID    | Issue                                           | Required Change                                                                                                                                                                                                                                                                                                             | Severity | Priority | Dependency | Owner   | QA Validation                                                         | Done Criteria         |
| ----- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------- | ------- | --------------------------------------------------------------------- | --------------------- |
| CI-01 | HSA not cleared for newly-ineligible employees  | In `calculate.ts`, after HSA engine run, set `hsa_amount = 0` for employees where `costMode != LOCAL_PAYROLL` or `serviceProfile.hsaEligible == false`                                                                                                                                                                      | Medium   | P2       | None       | Agent C | Employee switching from eligible to ineligible has hsa_amount cleared | No stale HSA amounts  |
| CI-02 | Clone disciplineId lacks explicit documentation | Disciplines are global master data (not version-scoped), so `disciplineId` does not change between versions and verbatim copy is correct. Add an explicit code comment in the clone logic (`versions.ts:1257`, `:1275`, `:1299`) documenting this assumption so future maintainers know remapping is intentionally skipped. | Low      | P3       | None       | Agent C | Comment added explaining global discipline assumption                 | Assumption documented |

## Workstream 5: Frontend Integration Remediation

| ID    | Issue                                                        | Required Change                                                                                                                                                                                                                                                                                                                                                    | Severity | Priority | Dependency       | Owner   | QA Validation                                                             | Done Criteria                            |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | ---------------- | ------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| FE-01 | Staffing page renders placeholder divs                       | Replace placeholders with real component composition: `TeachingMasterGrid` for teaching mode, `SupportAdminGrid` for support mode. Mount `StaffingKpiRibbon`, `StaffingStatusStrip`, `StaffingSettingsSheet`, `AutoSuggestDialog`, `EmployeeForm`, and `StaffingInspectorContent` (right panel inspector for requirement line detail and support employee detail). | Critical | P0       | BC-01..04, BC-09 | Agent D | Page integration test renders real grids, inspector responds to selection | No placeholder text; inspector mountable |
| FE-02 | Toolbar action buttons are inert                             | Wire Import, Add Employee, Auto-Suggest, Calculate, Settings buttons to their respective dialogs/mutations/hooks                                                                                                                                                                                                                                                   | High     | P1       | FE-01            | Agent D | Click handlers invoke correct hooks/dialogs                               | All buttons functional                   |
| FE-03 | Settings sheet uses wrong enum `PCT_PAYROLL`                 | Replace with `PERCENT_OF_PAYROLL` and align cost assumption mode dropdown values with backend                                                                                                                                                                                                                                                                      | Critical | P0       | BC-04            | Agent D | Settings sheet displays/saves correct mode values                         | No enum mismatch                         |
| FE-04 | Inspector hardcodes ORS = 24                                 | Read actual ORS from the selected requirement line's `effectiveOrs` or `baseOrs` field                                                                                                                                                                                                                                                                             | High     | P1       | BC-01            | Agent D | Hours/week derived from actual ORS                                        | No hardcoded values                      |
| FE-05 | All hooks expect `{ data: [...] }` wrapper                   | Align hook response types with actual backend response shapes (named wrappers or shared types)                                                                                                                                                                                                                                                                     | Critical | P0       | BC-03, BC-04     | Agent D | Hooks correctly deserialize real responses                                | No undefined data access                 |
| FE-06 | `use-master-data.ts` field names wrong                       | Update `ServiceProfile` interface: `defaultOrs` -> `weeklyServiceHours`, `isHsaEligible` -> `hsaEligible`, etc.                                                                                                                                                                                                                                                    | Critical | P0       | BC-04            | Agent D | Master data hooks match backend                                           | No field access errors                   |
| FE-07 | Auto-suggest dialog uses `requirementLineId`                 | Refactor to use stable assignment key `(band, disciplineId)` matching backend contract                                                                                                                                                                                                                                                                             | High     | P1       | FE-01            | Agent D | Auto-suggest creates assignments with correct keys                        | No key mismatch                          |
| FE-08 | Inspector assignment form sends `requirementLineId`          | Replace with `(band, disciplineId)` to match backend `POST /assignments` contract                                                                                                                                                                                                                                                                                  | High     | P1       | FE-01            | Agent D | Assignment creation works end-to-end                                      | Correct payload sent                     |
| FE-09 | Support grid accesses `monthlyCost`/`annualCost` on employee | Update to consume cost data from the correct source (BC-07)                                                                                                                                                                                                                                                                                                        | High     | P1       | BC-07            | Agent D | Support grid shows cost columns                                           | No undefined values                      |

## Workstream 6: Legacy DHG Removal

| ID    | Issue                                                | Required Change                                                                                                                                           | Severity | Priority | Dependency | Owner   | QA Validation                                | Done Criteria          |
| ----- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ---------- | ------- | -------------------------------------------- | ---------------------- |
| LG-01 | `'DHG'` in 4 enrollment stale-module constants       | Remove `'DHG'` from `ENROLLMENT_RULES_STALE_MODULES`, `HEADCOUNT_STALE_MODULES`, `DETAIL_STALE_MODULES`, `NATIONALITY_STALE_MODULES` in enrollment routes | High     | P1       | None       | Agent E | Enrollment mutations don't mark DHG stale    | No DHG in staleModules |
| LG-02 | `dhg-grille.ts` route still registered               | Either remove route registration or add deprecation comment + exclusion from stale propagation                                                            | Medium   | P2       | None       | Agent E | Route either removed or documented as legacy | Clean architecture     |
| LG-03 | Frontend version-detail may show DHG stale indicator | Verify `version-detail-panel.tsx` doesn't display DHG-specific stale warnings                                                                             | Medium   | P2       | LG-01      | Agent E | No DHG label in UI                           | Clean UX               |
| LG-04 | `staffing-status-strip.tsx` stale labels include DHG | Remove DHG from status strip label mapping                                                                                                                | Medium   | P2       | LG-01      | Agent E | Status strip shows only STAFFING/PNL         | Correct labels         |

## Workstream 7: Security & Authorization Remediation

| ID    | Issue                                     | Required Change                                                                          | Severity | Priority | Dependency | Owner   | QA Validation                                 | Done Criteria         |
| ----- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | -------- | -------- | ---------- | ------- | --------------------------------------------- | --------------------- |
| SE-01 | Version-ownership IDOR in employee routes | Add version-ownership check: verify version belongs to a fiscal year the user can access | Medium   | P2       | None       | Agent B | 403 for unauthorized version access           | IDOR closed           |
| SE-02 | Assignment audit trail incomplete         | Ensure assignment CRUD persists `updatedBy` user identity in read models                 | Medium   | P2       | None       | Agent B | Assignment history shows user who made change | Audit requirement met |

## Workstream 8: Testing & QA Hardening

| ID    | Issue                                                  | Required Change                                                                                                                                                                                                                                                                      | Severity | Priority | Dependency   | Owner   | QA Validation                                               | Done Criteria                                   |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | ------------ | ------- | ----------------------------------------------------------- | ----------------------------------------------- |
| QA-01 | `migration-alignment.test.ts` covers 0 staffing tables | Add assertions for all 11 new tables and 7 column additions                                                                                                                                                                                                                          | High     | P1       | DM-01        | Agent F | Test fails if any staffing DDL missing                      | All staffing schema validated                   |
| QA-02 | Frontend hook tests mock wrong contracts               | Rewrite `use-staffing-hooks.test.ts`, `use-master-data.test.ts` mocks to match actual backend response shapes                                                                                                                                                                        | High     | P1       | BC-03, BC-04 | Agent F | Tests use real response fixtures                            | No false-confidence mocks                       |
| QA-03 | `staffing.test.tsx` asserts placeholder text           | Replace with integration test that renders real components with mock data                                                                                                                                                                                                            | High     | P1       | FE-01        | Agent F | Test verifies grid rows, ribbon metrics, strip status       | No placeholder assertions                       |
| QA-04 | No contract tests between backend and frontend         | Add shared Zod schemas in `packages/types/` for all staffing response shapes. Backend route tests assert `schema.parse(response)` succeeds. Frontend hook tests assert mock data passes the same Zod schema. JSON fixtures captured from real backend responses serve as the bridge. | High     | P1       | BC-03, BC-04 | Agent F | Contract drift caught at CI time via runtime Zod validation | Shared Zod schemas validated in both workspaces |
| QA-05 | No fresh-DB migration test                             | Add CI step: start Postgres container, run `prisma migrate deploy`, verify schema matches                                                                                                                                                                                            | High     | P1       | DM-01        | Agent F | CI fails if migrations incomplete                           | Deploy safety proven                            |
| QA-06 | Settings sheet test mocks wrong field names            | Fix `hsaRateFirstHour` -> `hsaFirstHourRate`, `hoursPerWeekPerSection` -> `hoursPerUnit`                                                                                                                                                                                             | Medium   | P2       | FE-03        | Agent F | Test uses correct field names                               | No mock/reality divergence                      |
| QA-07 | Import test doesn't verify hsa_amount rejection        | Add test: CSV with `hsa_amount` column is ignored or warned                                                                                                                                                                                                                          | Medium   | P2       | BC-06        | Agent F | Import ignores computed HSA                                 | Correct import behavior proven                  |

## Workstream 9: Documentation & Architecture Alignment

| ID     | Issue                                                 | Required Change                                                                                              | Severity | Priority | Dependency | Owner   | QA Validation                     | Done Criteria          |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- | -------- | ---------- | ------- | --------------------------------- | ---------------------- |
| DOC-01 | Redesign plan doesn't reflect actual state            | Update `2026-03-17-dhg-staffing-redesign.md` with remediation status, actual deployed state, remaining items | Low      | P3       | All phases | Agent G | Plan matches code                 | No stale documentation |
| DOC-02 | API contract doc doesn't cover new staffing endpoints | Update `docs/tdd/04_api_contract.md` with all staffing route contracts                                       | Medium   | P2       | BC-01..07  | Agent G | All staffing endpoints documented | Contract doc complete  |
| DOC-03 | No ADR for DHG removal decision                       | Write ADR documenting the removal of DHG as a separate module and its absorption into STAFFING               | Low      | P3       | LG-01      | Agent G | ADR exists in `docs/adr/`         | Decision recorded      |
| DOC-04 | Seed value discrepancy undocumented                   | Document whether 1.13%/1.27% or 2%/1% is correct, with source                                                | Low      | P3       | MD-03      | Agent G | Single documented source          | No contradictions      |

---

# 5. Swarm Agent Execution Model

## Agent A - Data / Migration Architect

- **Mission:** Fix the migration chain so the redesign is deployable on fresh and existing databases.
- **Scope:** Prisma schema, SQL migrations, seed data, backfill scripts.
- **Files owned:**
    - `apps/api/prisma/schema.prisma` (add `requiredFteCalculated`)
    - `apps/api/prisma/migrations/` (new migration files)
    - `apps/api/prisma/seeds/staffing-master-data.ts` (expand catalog)
    - `apps/api/src/migration/scripts/staffing-data-migration.ts` (DhgRule backfill)
    - `apps/api/prisma/seed.ts` (if needed)
- **Expected outputs:**
    - Complete migration SQL (11 tables, 7+ columns, all indexes/FKs)
    - DhgRule backfill script
    - Expanded discipline/alias seed
    - `requiredFteCalculated` column
- **Handoffs:** DM-01 completion unblocks Agent B (route alignment) and Agent D (frontend wiring)
- **Non-negotiable checks:**
    - `prisma migrate deploy` succeeds on empty Postgres
    - `prisma migrate deploy` succeeds on snapshot of current production schema
    - All FKs are valid post-migration
    - Backfill is idempotent (safe to re-run)
- **Must not change without coordination:** Any column type, name, or relation that affects route handlers or frontend types

## Agent B - Backend Contract Lead

- **Mission:** Align all backend route response shapes with the redesign contract. Fix security gaps.
- **Scope:** Staffing routes, employee routes, master-data routes, shared types.
- **Files owned:**
    - `apps/api/src/routes/staffing/settings.ts`
    - `apps/api/src/routes/staffing/assignments.ts`
    - `apps/api/src/routes/staffing/employees.ts`
    - `apps/api/src/routes/staffing/import.ts`
    - `apps/api/src/routes/staffing/results.ts`
    - `apps/api/src/routes/staffing/calculate.ts` (requiredFteCalculated persistence)
    - `apps/api/src/routes/master-data/staffing-master-data.ts`
    - `packages/types/` (new shared staffing types)
- **Expected outputs:**
    - Canonical response shapes matching shared types
    - Per-line sources endpoint
    - camelCase employee responses
    - `hsa_amount` removed from import
    - `requiredFteCalculated` persisted in calculate pipeline
    - Version-ownership middleware
    - Support-staff cost endpoint or extended employee response
- **Handoffs:** BC-01..07 completion unblocks Agent D (frontend can bind to real data)
- **Non-negotiable checks:**
    - All routes return shapes matching `packages/types/` definitions
    - `pnpm --filter @budfin/api typecheck` passes
    - All existing backend tests pass (updated where needed)
    - Import rejects `hsa_amount`
- **Must not change without coordination:** Response wrapper convention (must agree with Agent D on `{ data }` vs named wrappers)

## Agent C - Calculation Integrity Reviewer

- **Mission:** Verify and fix calculation correctness: HSA clearing, clone remapping, override provenance.
- **Scope:** Calculation engines, clone logic, HSA persistence.
- **Files owned:**
    - `apps/api/src/routes/staffing/calculate.ts` (HSA clearing)
    - `apps/api/src/routes/versions.ts` (clone discipline remapping)
    - Engine test files
- **Expected outputs:**
    - HSA clearing for ineligible employees
    - Clone remapping fix or documented justification
    - Updated calculation tests
- **Handoffs:** CI-01, CI-02 are independent of other workstreams
- **Non-negotiable checks:**
    - All calculation tests pass
    - Clone produces valid FK references
    - HSA amounts zeroed for non-eligible employees after recalc

## Agent D - Frontend Integration Lead

- **Mission:** Wire the staffing page shell to real components, fix all contract mismatches on the frontend side, make the redesigned UI functional.
- **Scope:** Staffing page, all staffing components, hooks, stores.
- **Files owned:**
    - `apps/web/src/pages/planning/staffing.tsx`
    - `apps/web/src/hooks/use-staffing.ts`
    - `apps/web/src/hooks/use-master-data.ts`
    - `apps/web/src/lib/api-client.ts` (if normalization needed)
    - All `apps/web/src/components/staffing/*.tsx`
    - `apps/web/src/stores/staffing-*.ts`
- **Expected outputs:**
    - Staffing page renders real `TeachingMasterGrid`, `SupportAdminGrid`, `StaffingKpiRibbon`, `StaffingStatusStrip`
    - All hooks aligned with actual backend response shapes
    - All enum values corrected
    - Inspector uses actual ORS, not hardcoded 24
    - Assignment forms use `(band, disciplineId)` not `requirementLineId`
    - Action buttons wired to hooks/dialogs
- **Handoffs:** Depends on BC-01..07 (Agent B) for correct backend contracts
- **Non-negotiable checks:**
    - `pnpm --filter @budfin/web typecheck` passes
    - Page renders grids with mock data (no placeholders)
    - All component tests updated to match real contracts
    - No hardcoded enum values or field names that diverge from shared types

## Agent E - Legacy Cleanup Lead

- **Mission:** Remove DHG contamination from stale-module chains and UI labels.
- **Scope:** Enrollment routes, version-detail panel, status strip, dhg-grille route.
- **Files owned:**
    - `apps/api/src/services/planning-rules.ts`
    - `apps/api/src/routes/enrollment/headcount.ts`
    - `apps/api/src/routes/enrollment/detail.ts`
    - `apps/api/src/routes/enrollment/nationality-breakdown.ts`
    - `apps/api/src/routes/staffing/index.ts` (dhg-grille registration)
    - `apps/web/src/components/staffing/staffing-status-strip.tsx`
    - `apps/web/src/components/version/version-detail-panel.tsx`
- **Expected outputs:**
    - No `'DHG'` in any stale-module constant
    - `dhg-grille.ts` either removed or marked deprecated
    - Status strip and version-detail show only valid module names
- **Handoffs:** Independent of other agents
- **Non-negotiable checks:**
    - Grep for `'DHG'` in stale constants returns 0 hits
    - Enrollment tests still pass
    - No visual reference to DHG in UI

## Agent F - QA & Release Gate Lead

- **Mission:** Rewrite false-confidence tests, add missing test categories, validate release readiness.
- **Scope:** All test files, CI configuration, contract test infrastructure.
- **Files owned:**
    - `apps/api/src/migration-alignment.test.ts`
    - `apps/web/src/pages/planning/staffing.test.tsx`
    - `apps/web/src/hooks/use-staffing-hooks.test.ts`
    - `apps/web/src/hooks/use-master-data.test.ts`
    - `apps/web/src/components/staffing/*.test.tsx`
    - New: `apps/api/src/routes/staffing/contract.test.ts` (contract tests)
    - New: `apps/api/src/migration/scripts/staffing-data-migration.test.ts` (backfill tests)
- **Expected outputs:**
    - Migration alignment test covers all 11 staffing tables
    - Contract tests with shared JSON fixtures
    - Page integration test renders real components
    - Hook tests use real response shapes
    - Import test validates `hsa_amount` rejection
- **Handoffs:** Depends on all other agents completing their work
- **Non-negotiable checks:**
    - `pnpm test` passes with >= 80% coverage on changed files
    - No test asserts placeholder text
    - No test mocks a contract the backend doesn't serve

## Agent G - Documentation / ADR Lead

- **Mission:** Update all documentation to match the remediated codebase.
- **Scope:** Plan docs, API contract docs, ADRs, seed documentation.
- **Files owned:**
    - `docs/plans/2026-03-17-dhg-staffing-redesign.md` (status update)
    - `docs/tdd/04_api_contract.md` (staffing endpoints)
    - `docs/adr/` (DHG removal ADR)
    - `.claude/workflow/STATUS.md`
- **Expected outputs:**
    - Updated plan with remediation outcomes
    - Complete API contract documentation for all staffing endpoints
    - ADR for DHG-to-STAFFING absorption
    - Seed value source-of-truth documentation
- **Handoffs:** Runs after all other agents complete
- **Non-negotiable checks:**
    - `pnpm lint:md` passes on all changed docs
    - Every staffing endpoint has documented request/response shape

## Agent H - Independent Code Reviewer

- **Mission:** Validate all remediation work for architecture consistency, regression risk, contract alignment, migration safety, test adequacy, and release readiness. This agent must NOT implement anything.
- **Scope:** All files modified by Agents A-G.
- **Inputs:** Git diff of all remediation commits.
- **Expected outputs:**
    - Architecture consistency report
    - Regression risk assessment
    - Contract alignment verification
    - Migration safety sign-off
    - Test adequacy verdict
    - Go/no-go recommendation
- **Non-negotiable checks:**
    - All shared types are used consistently in both workspaces
    - No new `{ data }` vs named-wrapper inconsistencies
    - Migration chain is complete and ordered correctly
    - No regression in existing enrollment/revenue/version flows
    - Test coverage >= 80% on all changed files
- **What they must not change:** Any code. Read-only reviewer role.

---

# 6. Recommended Sequence of Execution

## Phase 0 - Truth Revalidation (COMPLETE)

- **Objective:** Confirm prior findings and surface hidden gaps.
- **Status:** Completed by this 6-agent parallel audit.
- **Deliverables:** This remediation plan document.
- **Exit criteria:** Plan reviewed and approved by user.

## Phase 1 - Deployment Safety

- **Objective:** Fix migration/schema/backfill blockers so the redesign can deploy.
- **Why this order matters:** Nothing else works if the database schema doesn't exist. Every other fix depends on tables being present.
- **Prerequisites:** None.
- **Agents:** Agent A (primary), Agent B (schema-aware route prep).
- **Deliverables:**
    - [ ] DM-01: Complete migration SQL for 11 new tables
    - [ ] DM-02: Employee ALTER TABLE for 6 columns
    - [ ] DM-03: CategoryMonthlyCost `calculationMode` column
    - [ ] DM-04: `requiredFteCalculated` column
    - [ ] DM-05: FK consistency verified
    - [ ] MD-01: DhgRule backfill from DhgGrilleConfig
    - [ ] MD-02: Expanded discipline/alias catalog
    - [ ] QA-05: Fresh-DB migration CI test
- **Risks:** Migration ordering errors. Backfill FK resolution failures.
- **Exit criteria:** `prisma migrate deploy` succeeds on empty DB AND upgrade DB. Backfill is idempotent. QA-05 CI step passes.

## Phase 2 - Contract Alignment

- **Objective:** Fix all backend/frontend contract mismatches before wiring UI.
- **Why this order matters:** Wiring the frontend to mismatched contracts would produce a different class of bugs. Fix the contracts first so integration is clean.
- **Prerequisites:** Phase 1 (tables must exist for routes to query).
- **Agents:** Agent B (backend), Agent D (frontend types), coordinating on shared types.
- **Deliverables:**
    - [ ] BC-02: Employee responses camelCase
    - [ ] BC-03: Agree on response wrapper convention
    - [ ] BC-04: Service profile field names aligned
    - [ ] BC-01: Per-line sources endpoint added
    - [ ] BC-05: `requiredFteCalculated` persisted
    - [ ] BC-06: `hsa_amount` removed from import
    - [ ] BC-07: Support staff cost data available
    - [ ] BC-09: Teaching-requirements response includes `totals` and `warnings`
    - [ ] BC-10: Stale propagation fixed (mutations mark STAFFING only, not PNL)
    - [ ] FE-05: Hook response types match backend
    - [ ] FE-06: Master-data hook field names corrected
    - [ ] FE-03: Settings sheet enum corrected
    - [ ] Shared Zod schemas created in `packages/types/`
- **Risks:** Disagreement on wrapper convention. Cascading type changes.
- **Exit criteria:** Both `pnpm --filter @budfin/api typecheck` and `pnpm --filter @budfin/web typecheck` pass. Shared Zod schemas compile and validate in both workspaces.

## Phase 3 - Functional Integration

- **Objective:** Wire the staffing page to real components with real data.
- **Why this order matters:** With correct contracts in place, the frontend can now bind to real API data.
- **Prerequisites:** Phase 2 (contracts aligned).
- **Agents:** Agent D (primary), Agent E (legacy cleanup in parallel).
- **Deliverables:**
    - [ ] FE-01: Page renders real grids, ribbon, strip, inspector, settings sheet, dialogs
    - [ ] FE-02: Action buttons wired
    - [ ] FE-04: Inspector uses actual ORS
    - [ ] FE-07: Auto-suggest uses correct keys
    - [ ] FE-08: Assignment form uses correct keys
    - [ ] FE-09: Support grid shows cost data
    - [ ] LG-01: DHG removed from stale constants
    - [ ] LG-02: dhg-grille deprecated/removed
    - [ ] LG-03: Version-detail DHG cleaned
    - [ ] LG-04: Status strip DHG removed
- **Risks:** Component-level bugs discovered during integration. Missing edge cases in grid rendering.
- **Exit criteria:** Staffing page renders both workspaces with data. No placeholder text. No DHG references in stale chain or UI.

## Phase 4 - Correctness & Auditability

- **Objective:** Fix provenance, HSA clearing, clone integrity, import rules, and security gaps.
- **Why this order matters:** These are correctness fixes that don't block basic functionality but are required for production safety.
- **Prerequisites:** Phase 2 (routes aligned).
- **Agents:** Agent C (calculation), Agent B (security).
- **Deliverables:**
    - [ ] CI-01: HSA cleared for ineligible employees
    - [ ] CI-02: Clone discipline remapping documented/fixed
    - [ ] SE-01: Version-ownership check added
    - [ ] SE-02: Assignment audit trail complete
- **Risks:** HSA clearing may affect existing test fixtures. Version-ownership middleware may need careful scoping.
- **Exit criteria:** All calculation tests pass. Clone produces valid references. Unauthorized version access returns 403.

## Phase 5 - Test Hardening

- **Objective:** Replace false-confidence tests with real validation.
- **Why this order matters:** All code changes must be in place before tests can validate them correctly.
- **Prerequisites:** Phases 1-4 (all code fixes complete).
- **Agents:** Agent F (primary).
- **Deliverables:**
    - [ ] QA-01: Migration alignment covers staffing tables
    - [ ] QA-02: Hook tests use real response shapes
    - [ ] QA-03: Page test renders real components
    - [ ] QA-04: Contract tests with shared fixtures
    - [ ] QA-06: Settings sheet test field names fixed
    - [ ] QA-07: Import test validates hsa_amount rejection
- **Risks:** Test refactoring may uncover additional bugs requiring Phase 3/4 fixes.
- **Exit criteria:** `pnpm test` passes. Coverage >= 80% on changed files. No test mocks a non-existent contract.

## Phase 6 - Documentation & Release Readiness

- **Objective:** Update all documentation. Validate release gates.
- **Why this order matters:** Documentation must reflect the final remediated state.
- **Prerequisites:** Phases 1-5 complete.
- **Agents:** Agent G (docs), Agent H (independent reviewer).
- **Deliverables:**
    - [ ] DOC-01: Redesign plan updated
    - [ ] DOC-02: API contract doc updated
    - [ ] DOC-03: DHG removal ADR written
    - [ ] DOC-04: Seed values documented
    - [ ] Agent H: Independent code review complete
    - [ ] Agent H: Go/no-go recommendation
- **Risks:** Reviewer may identify issues requiring regression to earlier phases.
- **Exit criteria:** All documentation current. Independent reviewer signs off. Release gates clear.

---

# 7. File-by-File Remediation Plan

## `apps/api/prisma/schema.prisma`

- **Why:** Add `requiredFteCalculated` field to `TeachingRequirementLine`.
- **Change type:** Additive.
- **What:** Add `requiredFteCalculated Decimal? @db.Decimal(15,4)` field.
- **Tests:** Migration alignment test must cover new column.
- **Migration:** Included in Phase 1 migration generation.

## `apps/api/prisma/migrations/` (new migration)

- **Why:** 11 tables, 7+ columns have no DDL.
- **Change type:** Additive (new migration file).
- **What:** Run `prisma migrate dev --name add_staffing_redesign_models` to generate comprehensive migration.
- **Tests:** QA-05 fresh-DB test.
- **Implications:** This is the single most critical deliverable.

## `apps/api/prisma/seeds/staffing-master-data.ts`

- **Why:** Insufficient discipline/alias coverage for production mapping.
- **Change type:** Additive.
- **What:** Expand from 18 to 30+ disciplines, from 7 to 20+ aliases. Add common abbreviations, French/English variants.
- **Tests:** Seed idempotency test. Alias resolution tests.

## `apps/api/src/migration/scripts/staffing-data-migration.ts`

- **Why:** Missing DhgRule backfill.
- **Change type:** Additive.
- **What:** Add `migrateGrilleToRules()` function: read `DhgGrilleConfig`, resolve `serviceProfileId`/`disciplineId`, write `DhgRule` with correct `lineType`/`driverType`. Make idempotent.
- **Tests:** Backfill test with mock legacy data.

## `apps/api/src/routes/staffing/settings.ts`

- **Why:** Missing per-line sources endpoint. Teaching-requirements response missing `totals` and `warnings`. Stale propagation marks PNL too early on mutations.
- **Change type:** Additive (new route) + corrective (response shapes, stale propagation).
- **What:** (1) Add `GET /teaching-requirements/:id/sources` route. (2) Add `totals` (aggregated FTE/cost sums) and `warnings` (coverage warnings array) to the teaching-requirements response at line 792. (3) Change `STAFFING_STALE_MODULES` at line 84 from `['STAFFING', 'PNL']` to `['STAFFING']` only — per redesign spec, mutations mark STAFFING only; PNL is marked by recalculation. (4) Verify all response shapes match shared Zod schemas.
- **Tests:** Route test for new endpoint. Contract test for response shapes. Stale-chain test proving mutations mark only STAFFING.

## `apps/api/src/routes/staffing/assignments.ts`

- **Why:** Response shapes may need alignment with shared types. Stale propagation marks PNL too early.
- **Change type:** Corrective.
- **What:** (1) Ensure assignment responses match shared `StaffingAssignment` Zod schema. (2) Change `STAFFING_STALE_MODULES` at line 57 from `['STAFFING', 'PNL']` to `['STAFFING']` only.
- **Tests:** Contract test. Stale-chain test proving assignment mutations mark only STAFFING.

## `apps/api/src/routes/staffing/calculate.ts`

- **Why:** Missing `requiredFteCalculated` persistence. HSA clearing incomplete.
- **Change type:** Corrective.
- **What:** (1) Before applying demand overrides, store original FTE as `requiredFteCalculated`. (2) After HSA engine, clear `hsa_amount` for newly-ineligible employees.
- **Tests:** Calculation test with override verifies both values. HSA clearing test.

## `apps/api/src/routes/staffing/import.ts`

- **Why:** Still accepts `hsa_amount` as input column.
- **Change type:** Corrective.
- **What:** Remove `hsa_amount` from accepted columns array. Log warning if present in CSV header.
- **Tests:** Import test with `hsa_amount` column verifies it's ignored.

## `apps/api/src/routes/staffing/results.ts`

- **Why:** Staffing summary still uses legacy DHG-era model.
- **Change type:** Corrective.
- **What:** Update summary to derive from `TeachingRequirementLine` instead of `DhgRequirement`.
- **Tests:** Results route test with redesign data.

## `apps/api/src/routes/staffing/employees.ts`

- **Why:** Returns snake_case (frontend expects camelCase). Does NOT return derived `monthlyCost`/`annualCost` fields at all (frontend `support-admin-grid.tsx` needs them). IDOR TODO at line 264.
- **Change type:** Corrective.
- **What:** (1) Serialize responses to camelCase (change `formatEmployee` at line 108). (2) Add derived cost summary fields (`monthlyCost`, `annualCost`) by joining against latest `MonthlyStaffCost` aggregation, or create a dedicated support-staff cost summary endpoint. (3) Add version-ownership check.
- **Tests:** Employee list test verifies camelCase. Support cost test verifies derived fields present. Auth test for version-ownership.

## `apps/api/src/routes/versions.ts`

- **Why:** Clone copies `disciplineId` verbatim in 3 tables (`VersionLyceeGroupAssumption`, `DemandOverride`, `StaffingAssignment`). This is correct behavior because disciplines are global master data (not version-scoped), so IDs are stable across versions. However, this assumption is not documented.
- **Change type:** Documentation (add comments only).
- **What:** Add explicit inline comments at lines 1257, 1275, and 1299 documenting that `disciplineId` is intentionally not remapped because disciplines are global master data.
- **Tests:** Clone test verifies discipline references are valid post-clone.

## `apps/api/src/routes/master-data/staffing-master-data.ts`

- **Why:** Response wrapper `{ profiles }` doesn't match frontend expectation.
- **Change type:** Corrective.
- **What:** Align response wrapper with agreed convention from shared types.
- **Tests:** Contract test.

## `apps/web/src/pages/planning/staffing.tsx`

- **Why:** Renders placeholder divs instead of real components.
- **Change type:** Corrective (major rewrite of render body).
- **What:** Replace placeholder divs with `TeachingMasterGrid` (teaching mode) and `SupportAdminGrid` (support mode). Mount `StaffingKpiRibbon`, `StaffingStatusStrip`, `StaffingSettingsSheet`, `AutoSuggestDialog`, `EmployeeForm`. Wire action buttons to hooks.
- **Tests:** Page integration test renders grids with mock data. No placeholder text assertions.

## `apps/web/src/hooks/use-staffing.ts`

- **Why:** All hooks expect `{ data: [...] }` wrappers and wrong field names.
- **Change type:** Corrective.
- **What:** Update all response interfaces to match actual backend shapes. Fix field names. Remove `{ data }` unwrapping.
- **Tests:** Hook tests with real response fixtures.

## `apps/web/src/hooks/use-master-data.ts`

- **Why:** `ServiceProfile` interface has wrong field names. Response wrapper wrong.
- **Change type:** Corrective.
- **What:** `defaultOrs` -> `weeklyServiceHours`, `isHsaEligible` -> `hsaEligible`, `label` -> `name`. Fix response wrapper.
- **Tests:** Master-data hook test with real response shape.

## `apps/web/src/components/staffing/staffing-settings-sheet.tsx`

- **Why:** Uses `PCT_PAYROLL` enum, `{ data }` wrapper, wrong HSA field names.
- **Change type:** Corrective.
- **What:** Replace `PCT_PAYROLL` with `PERCENT_OF_PAYROLL`. Fix response unwrapping. Fix HSA field names (`hsaRateFirstHour` -> `hsaFirstHourRate`, etc.).
- **Tests:** Settings sheet test with corrected field names.

## `apps/web/src/components/staffing/staffing-inspector-content.tsx`

- **Why:** Hardcodes ORS=24. Uses `requirementLineId` for assignments. Wrong cost-mode badges.
- **Change type:** Corrective.
- **What:** Read ORS from requirement line's `effectiveOrs`. Use `(band, disciplineId)` for assignment key. Fix cost-mode badge values.
- **Tests:** Inspector test with corrected data flow.

## `apps/web/src/components/staffing/auto-suggest-dialog.tsx`

- **Why:** Uses `requirementLineId`-based suggestions.
- **Change type:** Corrective.
- **What:** Refactor to use `(band, disciplineId)` matching backend auto-suggest response.
- **Tests:** Auto-suggest test with correct response shape.

## `apps/web/src/components/staffing/employee-form.tsx`

- **Why:** Exposes `hsaAmount` in form state. Client-side vacancy code generator.
- **Change type:** Corrective.
- **What:** Remove `hsaAmount` from form fields (computed-only). Move vacancy code generation to server-side.
- **Tests:** Employee form test.

## `apps/web/src/components/staffing/support-admin-grid.tsx`

- **Why:** Accesses `monthlyCost`/`annualCost` fields that don't exist on employee response.
- **Change type:** Corrective.
- **What:** Update to consume cost data from the correct endpoint/field once BC-07 is complete.
- **Tests:** Support grid test with correct data shape.

## Key tests to add/rewrite:

- `apps/api/src/migration-alignment.test.ts` - cover all staffing tables
- `apps/web/src/pages/planning/staffing.test.tsx` - real component integration
- `apps/web/src/hooks/use-staffing-hooks.test.ts` - real response shapes
- `apps/web/src/hooks/use-master-data.test.ts` - real response shapes
- New: `apps/api/src/routes/staffing/contract.test.ts` - shared fixtures
- New: `apps/api/src/migration/scripts/staffing-data-migration.test.ts` - backfill coverage

---

# 8. Contract Alignment Matrix

| Feature                             | Frontend Expectation                                                  | Actual Backend Behavior                                                              | Gap                                                     | Required Fix                                                          | Owner |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| Response wrapper (settings)         | `{ data: StaffingSettings }`                                          | `{ settings: {...} }`                                                                | Key mismatch                                            | Agree on convention, align both sides                                 | B + D |
| Response wrapper (profiles)         | `{ data: ServiceProfile[] }`                                          | `{ profiles: [...] }`                                                                | Key mismatch                                            | Same convention decision                                              | B + D |
| Response wrapper (overrides)        | `{ data: ServiceProfileOverride[] }`                                  | `{ overrides: [...] }`                                                               | Key mismatch                                            | Same convention decision                                              | B + D |
| Response wrapper (cost assumptions) | `{ data: CostAssumption[] }`                                          | `{ assumptions: [...] }`                                                             | Key mismatch                                            | Same convention decision                                              | B + D |
| Response wrapper (lycee)            | `{ data: LyceeGroupAssumption[] }`                                    | `{ assumptions: [...] }`                                                             | Key mismatch                                            | Same convention decision                                              | B + D |
| Response wrapper (teaching reqs)    | `{ data: TeachingRequirementLine[], totals: {...}, warnings: [...] }` | `{ lines: [...] }` only (no `totals`, no `warnings` — `settings.ts:792`)             | Backend missing `totals` and `warnings` fields entirely | Add totals aggregation and warnings array to backend response (BC-09) | B + D |
| Service profile field: ORS          | `defaultOrs: string`                                                  | `weeklyServiceHours: string`                                                         | Field name                                              | Rename in frontend or backend                                         | B + D |
| Service profile field: HSA          | `isHsaEligible: boolean`                                              | `hsaEligible: boolean`                                                               | Field name                                              | Rename in frontend or backend                                         | B + D |
| Service profile field: name         | `label: string`                                                       | `name: string`                                                                       | Field name                                              | Rename in frontend                                                    | D     |
| Employee response casing            | camelCase (`employeeCode`, `functionRole`)                            | snake_case (`employee_code`, `function_role`)                                        | Case mismatch                                           | Backend serialize to camelCase                                        | B     |
| Employee cost fields                | `monthlyCost`, `annualCost`                                           | Not returned (only payroll inputs)                                                   | Missing fields                                          | Add derived cost or new endpoint                                      | B     |
| Cost assumption mode enum           | `PCT_PAYROLL`                                                         | `PERCENT_OF_PAYROLL`                                                                 | Value mismatch                                          | Frontend uses backend enum                                            | D     |
| Assignment creation key             | `{ requirementLineId, employeeId }`                                   | `{ employeeId, band, disciplineId }`                                                 | Key structure                                           | Frontend uses stable key                                              | D     |
| Assignment list shape               | `{ requirementLineId, hoursPerWeek }`                                 | `{ band, disciplineId, hoursPerWeek }`                                               | Fields differ                                           | Align to backend shape                                                | D     |
| Per-line sources endpoint           | `GET /teaching-requirements/:id/sources`                              | Does not exist                                                                       | Missing endpoint                                        | Add route                                                             | B     |
| Settings HSA field names            | `hsaTargetHoursPerWeek`, `hsaRateFirstHour`                           | `hsaTargetHours`, `hsaFirstHourRate`                                                 | Field name                                              | Frontend aligns to backend                                            | D     |
| Staffing summary shape              | DHG-based FTE                                                         | DHG-era `results.ts` (legacy)                                                        | Stale model                                             | Rewrite to use `TeachingRequirementLine`                              | B     |
| Auto-suggest response               | Suggestions by `requirementLineId`                                    | Suggestions by `(band, disciplineCode)`                                              | Key structure                                           | Frontend uses backend key                                             | D     |
| Inspector ORS derivation            | Hardcoded `fteShare * 24`                                             | ORS varies by service profile (15-30h)                                               | Wrong value                                             | Read from requirement line `baseOrs`                                  | D     |
| Status strip modules                | Shows DHG stale label                                                 | DHG removed in redesign                                                              | Stale UI label                                          | Remove DHG from label map                                             | E     |
| KPI data source                     | From teaching requirements `totals` field                             | Backend does not return `totals` at all (`settings.ts:792` returns only `{ lines }`) | Missing backend data                                    | Implement BC-09 first (add `totals` to response), then wire ribbon    | B + D |

---

# 9. Migration and Data Safety Plan

## Required Migration Files

> **IMPORTANT:** The migration sketch below is derived directly from `schema.prisma` (lines 756-1188).
> Do NOT follow this sketch literally to hand-write SQL — instead run `prisma migrate dev` against the
> real schema and commit the generated SQL. This sketch exists only to document what must be created
> and to validate the output of `prisma migrate dev`.

### Migration 1: Staffing Master Data Tables (Phase 1)

Matches: `ServiceObligationProfile` (schema:756), `Discipline` (schema:779), `DisciplineAlias` (schema:804), `DhgRule` (schema:816)

```sql
-- service_obligation_profiles: id SERIAL PK, code VARCHAR(20) UNIQUE NOT NULL, name VARCHAR(50) NOT NULL,
--   weekly_service_hours DECIMAL(4,1) NOT NULL, hsa_eligible BOOLEAN DEFAULT false,
--   default_cost_mode VARCHAR(20) DEFAULT 'LOCAL_PAYROLL', sort_order INT DEFAULT 0,
--   created_by INT? FK->users, updated_by INT? FK->users,
--   created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ

-- disciplines: id SERIAL PK, code VARCHAR(50) UNIQUE NOT NULL, name VARCHAR(100) NOT NULL,
--   category VARCHAR(20) DEFAULT 'SUBJECT', sort_order INT DEFAULT 0,
--   created_by INT? FK->users, updated_by INT? FK->users,
--   created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ
--   NOTE: NO language_code on this model (languageCode belongs to DhgRule)

-- discipline_aliases: id SERIAL PK, alias VARCHAR(100) UNIQUE NOT NULL,
--   discipline_id INT NOT NULL FK->disciplines, created_at TIMESTAMPTZ DEFAULT now()

-- dhg_rules: id SERIAL PK, grade_level VARCHAR(10) NOT NULL, discipline_id INT NOT NULL FK->disciplines,
--   line_type VARCHAR(20) DEFAULT 'STRUCTURAL', driver_type VARCHAR(10) DEFAULT 'HOURS',
--   hours_per_unit DECIMAL(5,2) NOT NULL, service_profile_id INT NOT NULL FK->service_obligation_profiles,
--   language_code VARCHAR(5)?, grouping_key VARCHAR(50)?,
--   effective_from_year INT NOT NULL, effective_to_year INT?,
--   created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ,
--   UNIQUE(grade_level, discipline_id, line_type, language_code, effective_from_year) [uq_dhg_rule]
--   INDEX(grade_level) [idx_dhg_rule_grade], INDEX(effective_from_year) [idx_dhg_rule_year]
```

### Migration 2: Version-Scoped Staffing Tables (Phase 1)

Matches: `VersionStaffingSettings` (schema:1009), `VersionServiceProfileOverride` (schema:1037), `VersionStaffingCostAssumption` (schema:1054), `VersionLyceeGroupAssumption` (schema:1070), `DemandOverride` (schema:1088)

```sql
-- version_staffing_settings: id SERIAL PK, version_id INT UNIQUE NOT NULL FK->budget_versions ON DELETE CASCADE,
--   hsa_target_hours DECIMAL(4,2) DEFAULT 1.5, hsa_first_hour_rate DECIMAL(10,2) DEFAULT 500,
--   hsa_additional_hour_rate DECIMAL(10,2) DEFAULT 400, hsa_months INT DEFAULT 10,
--   academic_weeks INT DEFAULT 36,
--   ajeer_annual_levy DECIMAL(15,4) DEFAULT 9500, ajeer_monthly_fee DECIMAL(15,4) DEFAULT 160,
--   reconciliation_baseline JSONB?,
--   created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ

-- version_service_profile_overrides: id SERIAL PK, version_id INT NOT NULL FK->budget_versions ON DELETE CASCADE,
--   service_profile_id INT NOT NULL FK->service_obligation_profiles,
--   weekly_service_hours DECIMAL(4,1)?, hsa_eligible BOOLEAN?,
--   created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ,
--   UNIQUE(version_id, service_profile_id) [uq_version_profile_override]

-- version_staffing_cost_assumptions: id SERIAL PK, version_id INT NOT NULL FK->budget_versions ON DELETE CASCADE,
--   category VARCHAR(30) NOT NULL, calculation_mode VARCHAR(25) NOT NULL, value DECIMAL(15,4) NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ,
--   UNIQUE(version_id, category) [uq_version_cost_assumption]

-- version_lycee_group_assumptions: id SERIAL PK, version_id INT NOT NULL FK->budget_versions ON DELETE CASCADE,
--   grade_level VARCHAR(10) NOT NULL, discipline_id INT NOT NULL FK->disciplines,
--   group_count INT NOT NULL, hours_per_group DECIMAL(5,2) NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ,
--   UNIQUE(version_id, grade_level, discipline_id) [uq_lycee_group_assumption]

-- demand_overrides: id SERIAL PK, version_id INT NOT NULL FK->budget_versions ON DELETE CASCADE,
--   band VARCHAR(15) NOT NULL, discipline_id INT NOT NULL FK->disciplines,
--   line_type VARCHAR(20) NOT NULL, override_fte DECIMAL(7,4) NOT NULL,
--   reason_code VARCHAR(30) NOT NULL, note TEXT?,
--   updated_by INT? FK->users,
--   created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ,
--   UNIQUE(version_id, band, discipline_id, line_type) [uq_demand_override]
```

### Migration 3: Derived Output Tables (Phase 1)

Matches: `TeachingRequirementSource` (schema:1110), `TeachingRequirementLine` (schema:1132)

```sql
-- teaching_requirement_sources: id SERIAL PK, version_id INT NOT NULL FK->budget_versions ON DELETE CASCADE,
--   grade_level VARCHAR(10) NOT NULL, discipline_id INT NOT NULL FK->disciplines,
--   line_type VARCHAR(20) NOT NULL, driver_type VARCHAR(10) NOT NULL,
--   headcount INT DEFAULT 0, max_class_size INT NOT NULL,
--   driver_units INT DEFAULT 0, hours_per_unit DECIMAL(5,2) NOT NULL,
--   total_weekly_hours DECIMAL(10,4) DEFAULT 0, calculated_at TIMESTAMPTZ DEFAULT now(),
--   UNIQUE(version_id, grade_level, discipline_id, line_type) [uq_teaching_req_source]
--   INDEX(version_id) [idx_teaching_req_source_version]
--   NOTE: NO teaching_requirement_line_id FK — sources are joined to lines by
--   (version_id, band=gradeToBand(grade_level), discipline_code, line_type) at query time

-- teaching_requirement_lines: id SERIAL PK, version_id INT NOT NULL FK->budget_versions ON DELETE CASCADE,
--   band VARCHAR(15) NOT NULL, discipline_code VARCHAR(50) NOT NULL,
--   line_label VARCHAR(150) NOT NULL, line_type VARCHAR(20) NOT NULL,
--   driver_type VARCHAR(10) NOT NULL, service_profile_code VARCHAR(20) NOT NULL,
--   total_driver_units INT DEFAULT 0, total_weekly_hours DECIMAL(10,4) DEFAULT 0,
--   base_ors DECIMAL(5,2) NOT NULL, effective_ors DECIMAL(5,2) NOT NULL,
--   required_fte_raw DECIMAL(7,4) DEFAULT 0, required_fte_planned DECIMAL(7,4) DEFAULT 0,
--   recommended_positions INT DEFAULT 0,
--   covered_fte DECIMAL(7,4) DEFAULT 0, gap_fte DECIMAL(7,4) DEFAULT 0,
--   coverage_status VARCHAR(10) DEFAULT 'UNCOVERED',
--   assigned_staff_count INT DEFAULT 0, vacancy_count INT DEFAULT 0,
--   direct_cost_annual DECIMAL(15,4) DEFAULT 0, hsa_cost_annual DECIMAL(15,4) DEFAULT 0,
--   calculated_at TIMESTAMPTZ DEFAULT now(),
--   UNIQUE(version_id, band, discipline_code, line_type) [uq_teaching_req_line]
--   INDEX(version_id) [idx_teaching_req_line_version]
```

### Migration 4: Employee Extensions + CategoryMonthlyCost (Phase 1)

Matches: `Employee` new fields (schema:877-883), `CategoryMonthlyCost.calculationMode` (schema:973)

```sql
-- ALTER TABLE employees ADD COLUMN record_type VARCHAR(10) DEFAULT 'EMPLOYEE'
-- ALTER TABLE employees ADD COLUMN cost_mode VARCHAR(20) DEFAULT 'LOCAL_PAYROLL'
-- ALTER TABLE employees ADD COLUMN discipline_id INT REFERENCES disciplines(id)
-- ALTER TABLE employees ADD COLUMN service_profile_id INT REFERENCES service_obligation_profiles(id)
-- ALTER TABLE employees ADD COLUMN home_band VARCHAR(15)
-- ALTER TABLE employees ADD COLUMN contract_end_date DATE
-- ALTER TABLE category_monthly_costs ADD COLUMN calculation_mode VARCHAR(25) DEFAULT 'PERCENT_OF_PAYROLL'
```

## Backfill Strategy

1. **DhgGrilleConfig -> DhgRule:** Idempotent script reads legacy grille config, resolves service profile and discipline by name matching, writes DhgRule rows. Skip if DhgRule already has rows for that year.
2. **Employee field population:** Set `recordType='EMPLOYEE'`, `costMode='LOCAL_PAYROLL'` for all existing. Resolve `serviceProfileId` and `disciplineId` via heuristics. Log exceptions.
3. **VersionStaffingSettings:** Create with defaults for each existing budget version.
4. **VersionStaffingCostAssumption:** Create 5 category rows per version with documented default values.

## Idempotency Requirements

- All backfill operations use upsert or check-before-insert patterns.
- Re-running the migration on a database that already has the data produces no changes.
- Backfill wrapped in a single transaction with rollback on error.

## Validation Checklist

- [ ] `prisma migrate deploy` succeeds on empty PostgreSQL 16 database
- [ ] `prisma migrate deploy` succeeds on snapshot of current production schema
- [ ] All FK constraints are valid (no orphaned references)
- [ ] Backfill produces correct DhgRule count matching legacy grille
- [ ] All employees have `recordType` and `costMode` set
- [ ] VersionStaffingSettings exist for all budget versions
- [ ] `prisma migrate status` shows no pending migrations
- [ ] Seed runs without errors after migration

## Rollback / Recovery

- Migration files are incremental; rollback = apply reverse migration.
- Backfill transaction rolls back entirely on any error.
- For production: take database snapshot before migration, verify migration on staging first.

---

# 10. Testing Strategy Reset

## A. Migration Tests

**What must be tested:** Every new table and column exists with correct types, defaults, indexes, and FK constraints.
**Why existing tests are insufficient:** `migration-alignment.test.ts` only checks 2 audit columns. Zero staffing coverage.
**Required fixtures:** Empty database, migration chain.
**Pass/fail criteria:** `prisma migrate deploy` succeeds. Schema introspection shows all expected tables/columns.

## B. Backend Contract Tests

**What must be tested:** Every staffing endpoint returns a response shape that matches the shared contract definition.
**Why existing tests are insufficient:** Route tests validate behavior but don't assert against shared contracts. Frontend and backend drift independently. TypeScript types alone are insufficient for runtime validation — they are erased at compile time and cannot catch shape mismatches in test assertions.
**Required fixtures:** JSON response fixtures captured from real route handlers. Shared Zod schemas in `packages/types/` that define the contract at runtime. Both backend route tests and frontend hook tests parse fixtures through the same Zod schema.
**Pass/fail criteria:** Response JSON parses successfully against shared Zod schema (`schema.parse(response)` succeeds). All fields present with correct types and values. Frontend hook tests use the same Zod schema to validate their mock data.

## C. Calculation Integrity Tests

**What must be tested:** Demand FTE formulas, coverage thresholds, HSA amounts, cost-mode branching, category cost modes, override provenance.
**Why existing tests are insufficient:** Engine unit tests are reasonable but don't test `requiredFteCalculated` preservation or HSA clearing for ineligible employees.
**Required fixtures:** Realistic employee sets with mixed cost modes, service profiles, HSA eligibility.
**Pass/fail criteria:** Calculated values match expected decimal-precise results. Override provenance preserved. HSA cleared for ineligible.

## D. Frontend Integration Tests

**What must be tested:** Staffing page renders grids, ribbon, strip with realistic mock data. Action buttons invoke correct handlers. Band/coverage filters filter grid rows.
**Why existing tests are insufficient:** Current page test asserts "Teaching workspace" placeholder text. Components never rendered on page.
**Required fixtures:** Mock hook responses matching real backend shapes. Teaching requirement lines, employees, assignments.
**Pass/fail criteria:** Grid renders rows. Ribbon shows metrics. No placeholder text. Filters change visible rows.

## E. E2E Workflow Tests

**What must be tested:** Full workflow: settings -> calculate -> view requirements -> assign teacher -> recalculate -> verify coverage.
**Why existing tests are insufficient:** No E2E tests exist for the redesigned workflow.
**Required fixtures:** Seeded database with enrollment, employees, DHG rules.
**Pass/fail criteria:** End-to-end flow completes without errors. Calculated values match expected.

## F. Security / Authorization Tests

**What must be tested:** Version-ownership check on all version-scoped routes. RBAC enforcement (Viewer can't mutate). Salary data not leaked in list responses.
**Why existing tests are insufficient:** `employees.ts:264` has explicit IDOR TODO. No auth regression tests for new routes.
**Required fixtures:** Multiple users with different roles. Multiple versions with different fiscal years.
**Pass/fail criteria:** Unauthorized access returns 403. Viewer role can't access mutation endpoints.

## G. Regression Tests

**What must be tested:** Enrollment calculation still works. Revenue calculation still works. Version clone still copies all data correctly. Existing staffing cost flows unbroken.
**Why existing tests are insufficient:** DHG removal from stale chain could break enrollment flow assertions.
**Required fixtures:** Full version with enrollment + revenue + staffing data.
**Pass/fail criteria:** All existing test suites pass after remediation. No regression in calculate/clone/summary flows.

### Tests that currently provide false confidence:

1. `staffing.test.tsx:334` - asserts placeholder text
2. `use-staffing-hooks.test.ts:65` - mocks `{ data: [...] }` wrapper
3. `use-master-data.test.ts:57` - mocks wrong field names
4. `staffing-settings-sheet.test.tsx:8` - mocks wrong HSA field names
5. `staffing-inspector-content.test.tsx:40` - mocks `requirementLineId` key
6. `migration-alignment.test.ts:14` - covers 0 staffing tables

### Tests that must be rewritten:

- All 6 files listed above.

### Tests that are missing entirely:

- Fresh-DB migration test
- Backend/frontend contract tests (using shared Zod schemas)
- Page integration test with real components (including inspector)
- Import `hsa_amount` rejection test
- HSA clearing test for ineligible employees
- Version-ownership authorization test
- DhgRule backfill test
- Stale-chain regression test: mutations mark STAFFING only (not PNL); recalculation marks PNL
- Teaching-requirements response `totals`/`warnings` test

---

# 11. Documentation Remediation Plan

| Document                                                        | Owner   | Purpose                                           | When to Update   | Evidence Required                                               |
| --------------------------------------------------------------- | ------- | ------------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| `docs/plans/2026-03-17-dhg-staffing-redesign.md`                | Agent G | Update status from NOT READY to remediated state  | After Phase 5    | List of all remediation items closed                            |
| `docs/tdd/04_api_contract.md`                                   | Agent G | Add all staffing endpoint contracts               | After Phase 2    | Every staffing endpoint documented with request/response shapes |
| `docs/adr/ADR-028-dhg-removal.md` (new)                         | Agent G | Record decision to fold DHG into STAFFING         | After Phase 3    | Context, decision, consequences, alternatives                   |
| `docs/plans/2026-03-17-dhg-staffing-remediation.md` (this file) | Agent G | Update with remediation outcomes                  | After Phase 6    | All backlog items closed with evidence                          |
| `.claude/workflow/STATUS.md`                                    | Agent G | Update phase and checklist                        | After each phase | Phase gate criteria met                                         |
| Seed values documentation (inline or ADR)                       | Agent G | Document source of truth for 1.13%/1.27% vs 2%/1% | After Phase 1    | Single source identified and referenced                         |

---

# 12. Release Gate Framework

## BLOCKERS (must be closed before any release candidate)

| Gate                               | Required Evidence                                      | Validation Owner | Reviewer Sign-off | Manual Validation?         |
| ---------------------------------- | ------------------------------------------------------ | ---------------- | ----------------- | -------------------------- |
| Migration chain complete           | `prisma migrate deploy` succeeds on empty + upgrade DB | Agent A          | Agent H           | YES - run on real Postgres |
| Frontend renders real workspace    | Page integration test passes, no placeholder text      | Agent D          | Agent H           | YES - visual smoke test    |
| Backend/frontend contracts aligned | Contract tests pass with shared fixtures               | Agent B + D      | Agent H           | NO - CI automated          |
| Import rejects `hsa_amount`        | Import test proves column ignored                      | Agent B          | Agent F           | NO - CI automated          |
| All tests pass                     | `pnpm test` green, >= 80% coverage                     | Agent F          | Agent H           | NO - CI automated          |
| Type checking passes               | `pnpm typecheck` green in both workspaces              | All              | Agent H           | NO - CI automated          |

## CRITICAL READINESS CRITERIA (must be closed before business validation)

| Gate                      | Required Evidence                                                                                                                     | Validation Owner | Reviewer Sign-off | Manual Validation?     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------- | ---------------------- |
| Override provenance works | `requiredFteCalculated` persisted and visible in inspector                                                                            | Agent B + D      | Agent C           | YES - verify in UI     |
| HSA clearing correct      | Ineligible employees have zero HSA after recalc                                                                                       | Agent C          | Agent F           | NO - test automated    |
| Legacy DHG removed        | Grep returns 0 hits for DHG in stale constants                                                                                        | Agent E          | Agent H           | NO - grep automated    |
| Security gaps closed      | Version-ownership check in place, auth tests pass                                                                                     | Agent B          | Agent H           | YES - manual auth test |
| Stale chain correct       | Enrollment -> STAFFING (not DHG); settings/assignment mutations -> STAFFING only (not PNL); recalculation -> remove STAFFING, add PNL | Agent B + E      | Agent C           | NO - test automated    |

## FINAL RELEASE CRITERIA (must be closed before ship approval)

| Gate                                | Required Evidence                                               | Validation Owner | Reviewer Sign-off | Manual Validation?   |
| ----------------------------------- | --------------------------------------------------------------- | ---------------- | ----------------- | -------------------- |
| Independent code review passed      | Agent H issues a GO recommendation                              | Agent H          | User              | YES - review report  |
| API contract documentation complete | All staffing endpoints documented                               | Agent G          | Agent H           | YES - doc review     |
| ADR for DHG removal written         | ADR exists in `docs/adr/`                                       | Agent G          | User              | YES - doc review     |
| Full E2E workflow smoke test        | Settings -> Calculate -> View -> Assign -> Recalculate succeeds | Agent F          | User              | YES - manual E2E     |
| No critical/high items open         | All P0/P1 backlog items closed                                  | Agent F          | Agent H           | YES - backlog review |

---

# 13. Final Recommended Plan

## 1. Final Prioritized Remediation Roadmap

| Phase                           | Duration Estimate             | Items                                               | Parallelizable?         |
| ------------------------------- | ----------------------------- | --------------------------------------------------- | ----------------------- |
| Phase 1: Deployment Safety      | First                         | DM-01 to DM-05, MD-01, MD-02, QA-05                 | Agent A solo            |
| Phase 2: Contract Alignment     | Second                        | BC-01 to BC-10, FE-03, FE-05, FE-06                 | Agent B + D in parallel |
| Phase 3: Functional Integration | Third                         | FE-01, FE-02, FE-04, FE-07 to FE-09, LG-01 to LG-04 | Agent D + E in parallel |
| Phase 4: Correctness            | Third (parallel with Phase 3) | CI-01, CI-02, SE-01, SE-02                          | Agent C + B in parallel |
| Phase 5: Test Hardening         | Fourth                        | QA-01 to QA-07                                      | Agent F solo            |
| Phase 6: Documentation + Review | Fifth                         | DOC-01 to DOC-04, Agent H review                    | Agent G + H in parallel |

## 2. Top 15 Implementation Actions

1. Generate and commit complete migration SQL for 11 tables + 7 columns
2. Add `requiredFteCalculated` column to `teaching_requirement_lines`
3. Write DhgRule backfill from DhgGrilleConfig
4. Define shared staffing types in `packages/types/`
5. Align all backend response wrappers with shared Zod schemas in `packages/types/`
6. Serialize employee responses to camelCase and add derived `monthlyCost`/`annualCost` fields
7. Add `GET /teaching-requirements/:id/sources` endpoint
8. Add `totals` and `warnings` to teaching-requirements response (BC-09)
9. Fix stale propagation: mutations mark STAFFING only, not PNL (BC-10)
10. Remove `hsa_amount` from import accepted columns
11. Fix all frontend hook response types to match backend
12. Replace staffing page placeholder divs with real component composition (including inspector)
13. Wire action buttons (Import, Add Employee, Calculate, Auto-Suggest, Settings)
14. Fix inspector ORS hardcode and assignment key from `requirementLineId` to `(band, disciplineId)`
15. Remove DHG from all stale-module constants

## 3. Top 10 Reviewer Checkpoints

1. Migration SQL creates all tables matching `schema.prisma` exactly (run `prisma migrate dev`, do not hand-write)
2. Shared Zod schemas in `packages/types/` used by both API route schemas and frontend hooks for runtime validation
3. No `{ data: [...] }` vs named-wrapper inconsistencies remain
4. Employee API returns camelCase fields and includes derived cost totals
5. Teaching-requirements response includes `lines`, `totals`, and `warnings`
6. Staffing page renders real grids, inspector, ribbon, strip (no placeholder text anywhere)
7. Stale propagation: mutations mark STAFFING only; recalculation marks PNL
8. No `'DHG'` in any stale-module constant
9. `requiredFteCalculated` is persisted separately from `requiredFtePlanned`
10. All tests use real response shapes validated by shared Zod schemas

## 4. Top 10 QA Checkpoints

1. `prisma migrate deploy` succeeds on empty Postgres 16
2. `prisma migrate deploy` succeeds on current production schema snapshot
3. `pnpm test` passes with >= 80% coverage on changed files
4. `pnpm typecheck` passes in both workspaces
5. Contract test fixtures validate via shared Zod schemas in both backend and frontend
6. Staffing page integration test renders grids, inspector, ribbon with data
7. Calculate with demand override preserves `requiredFteCalculated`
8. Settings/assignment mutation marks only STAFFING stale (not PNL); recalculation marks PNL
9. Employee switching eligibility has HSA cleared on recalc
10. Full E2E workflow: settings -> calculate -> view (with totals/warnings) -> assign -> recalculate completes

## 5. Final Go/No-Go Recommendation

**Current recommendation: NO-GO.**

The redesign cannot ship until at minimum:

- All Phase 1 (Deployment Safety) items are complete
- All Phase 2 (Contract Alignment) items are complete
- FE-01 from Phase 3 is complete (page renders real workspaces)
- All Phase 5 tests pass

## 6. Conditions for Release Reconsideration

The redesign can be reconsidered for release ONLY when ALL of the following are true:

1. `prisma migrate deploy` succeeds on both empty and upgrade databases
2. `pnpm test` passes with >= 80% coverage on changed files
3. `pnpm typecheck` passes in both `@budfin/api` and `@budfin/web`
4. Staffing page renders real `TeachingMasterGrid`, `SupportAdminGrid`, inspector, ribbon, strip (no placeholders)
5. Contract tests using shared Zod schemas pass in both workspaces
6. Zero `'DHG'` references in stale-module constants
7. Import ignores `hsa_amount` column
8. `requiredFteCalculated` is persisted for demand override auditability
9. Teaching-requirements response includes `totals` and `warnings` (KPI ribbon and status strip have data)
10. Stale propagation matches redesign spec: mutations mark STAFFING only; recalculation marks PNL
11. Independent code reviewer (Agent H) issues a GO recommendation
12. All BLOCKER gate items in Section 12 are closed with evidence

---

_Plan generated: 2026-03-17_
_Status: Awaiting approval to begin execution_
_Prior review verdict: CONFIRMED and EXPANDED (17 findings, 4 new)_
