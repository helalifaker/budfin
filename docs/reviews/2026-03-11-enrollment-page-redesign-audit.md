# Enrollment Page Redesign Audit

**Date:** 2026-03-11  
**Target plan:** `docs/plans/2026-03-11-enrollment-page-redesign.md`  
**Audited against:** current BudFin codebase on branch `worktree-enrollment-smart-workspace`

## Section 1 — Executive Verdict

**Overall judgment:** The plan is directionally strong but not implementation-ready. It correctly identifies many current-state problems and several code references are accurate, but it overstates delivery safety, understates frontend coupling, and leaves key trust, export, governance, and rollback details unresolved.

**Delivery confidence:** **46%**

**Recommendation:** **Pause and correct the plan**

### Top 5 reasons

1. **Core UI state is not as decoupled as the plan assumes.**  
   `useRightPanelStore`, `useEnrollmentSelectionStore`, and `PlanningShell` actively shape selection, panel state, and layout behavior.

2. **The fixed-viewport/no-scroll strategy is not safely de-risked.**  
   The shell can host it, but the page and grid primitives do not yet provide the vertical scroll ownership and fallback behavior the plan assumes.

3. **The trust model is underspecified and partially unsupported by current APIs.**  
   The plan requires visible saved vs preview vs calculated state, last-calculated metadata, and downstream stale cues, but those are not fully exposed today.

4. **Cross-module/domain dependencies are real and under-sequenced.**  
   `defaultAy2Intake` requires Prisma, master-data API, master-data UI, and clone/history semantics—not just an enrollment page tweak.

5. **Regression safety is weak for the exact surfaces the redesign touches.**  
   The page, right panel, planning grid, inspector views, and enrollment hooks are lightly tested or effectively untested.

---

## Section 2 — Scorecard

| Dimension               | Score /5 | Confidence % | Short rationale                                                                                                                         |
| ----------------------- | -------: | -----------: | --------------------------------------------------------------------------------------------------------------------------------------- |
| Plan Accuracy           |      3/5 |          82% | Many file/path/function claims are correct, but several “unchanged / safe” assumptions are false or too optimistic.                     |
| Plan Quality            |      3/5 |          78% | Good direction; weak on rollback, trust instrumentation, export, and exact state semantics.                                             |
| Architectural Soundness |      2/5 |          84% | Concept is viable, but current shell/store/grid contracts make the proposed architecture riskier than the plan admits.                  |
| Delivery Confidence     |      2/5 |          80% | Possible, but not safely with current sequencing and missing prerequisites.                                                             |
| Risk Coverage           |      2/5 |          86% | The plan names many risks but does not operationalize enough of them.                                                                   |
| UX Readiness            |      3/5 |          76% | Finance-friendly direction, but exception-first workflow, viewport fallback, and saved/preview clarity are not designed tightly enough. |
| Regression Safety       |      1/5 |          88% | Too much change sits on low-test / zero-test surfaces.                                                                                  |
| Finance Auditability    |      2/5 |          79% | Version-scoped rules are good, but override transparency, review sign-off, and export/audit evidence are underbuilt.                    |
| Test Readiness          |      1/5 |          90% | Existing tests mostly protect the old page and old wizard, not the proposed workspace.                                                  |
| Delivery Sequencing     |      2/5 |          85% | Phase 4 and Phase 5 are oversized; rollback/cutover strategy is not credible.                                                           |

---

## Section 3 — Agent-by-Agent Findings

### Agent 1 — Codebase Truth Validator

**Verdict:** Mostly accurate with material gaps.

#### What the plan gets right

- The current enrollment page really is a three-grid vertical workspace.  
  Evidence: `apps/web/src/pages/planning/enrollment.tsx`
- The wizard really is five steps today.  
  Evidence: `apps/web/src/components/enrollment/setup-wizard.tsx`
- The hardcoded recommendation thresholds really are `1.05` / `0.97`.  
  Evidence: `apps/api/src/services/cohort-recommendations.ts`
- `fixed-97-growth` is duplicated across backend, shared types, and wizard-local types.  
  Evidence: `apps/api/src/services/cohort-recommendations.ts`, `packages/types/src/cohort.ts`, `apps/web/src/components/enrollment/setup-wizard.tsx`
- `defaultAy2Intake` does not exist yet in schema/types/routes.  
  Evidence: `apps/api/prisma/schema.prisma`, `apps/api/src/routes/master-data/grade-levels.ts`, `apps/web/src/hooks/use-grade-levels.ts`

#### What is wrong / risky / missing

- The plan says `enrollment-selection-store.ts`, `right-panel-store.ts`, and `planning-shell.tsx` can remain unchanged. That is not true.
- The plan treats comparison-mode behavior as manageable later, but the current enrollment page has no real comparison-specific implementation.
- The plan understates that clone semantics are hand-coded, so new version fields will not copy automatically.

#### Evidence from codebase

- `apps/web/src/stores/right-panel-store.ts`: opening the panel collapses the left sidebar.
- `apps/web/src/stores/enrollment-selection-store.ts`: selecting the same grade closes the panel; selection is panel-coupled.
- `apps/web/src/pages/planning/enrollment.tsx`: when the panel closes, selection is cleared.
- `apps/api/src/routes/versions.ts`: clone payload explicitly enumerates copied version fields and copied enrollment tables.

#### Impact if unaddressed

- The plan will under-scope implementation work.
- The page swap will absorb hidden store/layout fixes late.
- Cloned versions will quietly lose new planning-rule state.

#### Required corrections

- Remove “works as-is” claims for `right-panel-store`, `enrollment-selection-store`, and `planning-shell`.
- Treat clone behavior as a first-class acceptance criterion.
- Treat comparison mode as either explicitly deferred or explicitly designed.

### Agent 2 — Frontend Architecture Auditor

**Verdict:** Architecturally promising, operationally under-specified.

#### What the plan gets right

- One master grid is the correct replacement for three stacked grids.
- Sidebar-first editing is the right direction for a finance-grade planning tool.
- Reusing `PlanningGrid` as a substrate is plausible.
- The shell can support a bounded workspace.

#### What is wrong / risky / missing

- The plan repeatedly calls the action surface a “sidebar,” but in this codebase the real action surface is the **right panel**.
- The fixed viewport strategy assumes `h-full overflow-hidden` is enough; it is not. The page needs an explicit `min-h-0` flex contract and a true internal vertical scroll owner.
- `PlanningGrid` currently owns horizontal overflow, not vertical workspace scrolling.
- The right panel, selection store, and shell auto-open behavior create hidden coupling the plan does not model.

#### Evidence from codebase

- `apps/web/src/layouts/planning-shell.tsx`: `<main>` is `overflow-y-auto`.
- `apps/web/src/components/data-grid/planning-grid.tsx`: root is `overflow-x-auto`; table uses `min-w-[980px]`.
- `apps/web/src/components/shell/right-panel.tsx`: tabs and panel behavior are shell-owned.
- `apps/web/src/stores/right-panel-store.ts`: opening/toggling panel collapses sidebar.
- `apps/web/src/stores/enrollment-selection-store.ts`: row selection opens details tab in right panel.
- `apps/web/src/pages/planning/enrollment.tsx`: page clears selection when panel closes.

#### Impact if unaddressed

- Double-scroll or clipped-scroll failures on smaller laptops.
- Confusing selection/panel state behavior.
- A visually cleaner layout that still feels brittle.

#### Required corrections

- Rename “sidebar” to **right panel / inspector** throughout the plan unless the nav sidebar is truly being repurposed.
- Add a formal flex/overflow contract: page root `flex h-full min-h-0 flex-col overflow-hidden`, grid zone `flex-1 min-h-0 overflow-hidden`, internal grid scroller `overflow-y-auto`.
- Stop pre-approving `PlanningShell` and the stores as unchanged.
- Add explicit behavior for panel close, same-row reselection, and narrow-width interactions.

### Agent 3 — Backend / API / Domain Model Auditor

**Verdict:** Core model placement is good; migration and behavior semantics are not ready.

#### What the plan gets right

- `BudgetVersion` is the correct place for version-scoped planning rules.
- `GradeLevel` is a plausible place for a global admin-configured PS default.
- `cohort-recommendations.ts` is the correct backend seam for parameterizing rule thresholds and cap behavior.
- Extending `GET /master-data/grade-levels` will naturally expose a new Prisma field because the route serializes the whole row shape.

#### What is wrong / risky / missing

- The PS default is not authoritative in current backend flows; server fallback still uses AY1 PS or persisted AY2 PS, not a grade setting.
- The plan says only Draft versions are affected by the rule change, but `GET /cohort-parameters` synthesizes recommendations for all version reads.
- Clone behavior is missing for new `BudgetVersion` fields.
- The plan introduces too many write paths for planning rules: dedicated endpoint, cohort-parameters PUT, and setup/apply payload.
- The plan requires last-calculated trust cues, but current enrollment-facing API surface does not expose that metadata.
- The rule rename is not DB-breaking, but it is wire-contract-affecting.

#### Evidence from codebase

- `apps/api/src/routes/enrollment/setup.ts`: `psAy2Headcount` fallback is request/body or AY1 PS, not grade default.
- `apps/api/src/services/enrollment-workspace.ts`: calculation path also falls back without `defaultAy2Intake`.
- `apps/api/src/routes/enrollment/cohort-parameters.ts`: GET reads `fiscalYear` and always computes synthesized recommendation payloads.
- `apps/api/src/routes/versions.ts`: clone explicitly creates a new version with enumerated copied fields and copies cohort/nationality data, but would not copy new rule columns unless updated.
- `apps/api/src/routes/master-data/grade-levels.ts`: update schema currently lacks `defaultAy2Intake`.
- `apps/api/src/routes/enrollment/capacity-results.ts`: no last-calculated metadata in response.
- `packages/types/src/cohort.ts`: current wire enum still includes `'fixed-97-growth'`.

#### Impact if unaddressed

- Wrong PS default behavior in real calculations.
- Historical/readonly views can drift unexpectedly.
- Cloned versions silently reset rules to defaults.
- API contract ambiguity and duplicated validation logic.
- Trust strip becomes frontend fiction rather than real state.

#### Required corrections

- Make `defaultAy2Intake` authoritative in backend setup/calculation fallback logic, not just a placeholder.
- Update clone semantics explicitly.
- Decide one authoritative write path for planning rules.
- Add or extend an endpoint to expose last-calculated enrollment metadata.
- Reword migration semantics: persisted data may be stable, but read-time recommendation payloads can change for any version missing cohort rows.
- Add a real DB/data migration for PS grade backfill; seed-only is not enough.

### Agent 4 — UX / Product Workflow Auditor

**Verdict:** High-potential workflow, not yet finance-safe.

#### What the plan gets right

- One grid + one inspector + one wizard is the right interaction model.
- Exception-first triage is the correct mental model.
- The 5-step wizard should be collapsed.
- Planning rules in the workflow are useful.
- The plan correctly recognizes export, trust cues, and error recovery as finance-critical.

#### What is wrong / risky / missing

- Trust cues are named but not designed tightly enough.
- The exception-first workflow is still mostly sidebar-oriented; the main page does not yet own exception visibility strongly enough.
- Export is treated as an affordance, not a designed workflow.
- The narrow-viewport fallback is a principle, not a rule.
- Filtered-vs-global totals are acknowledged but not operationalized.
- Undo/reset behavior is too vague for bulk-assumption work.
- Blocking validation CTA paths are not defined.

#### Evidence from codebase

- `apps/web/src/pages/planning/enrollment.tsx` has no export flow and no explicit status strip.
- `apps/web/src/components/enrollment/inspector-default-view.tsx` shows workflow cards + band summary, not an exception-first queue.
- `apps/web/src/components/shell/context-bar.tsx:321` renders `SaveIndicator` with `idle`; `apps/web/src/components/shell/save-indicator.tsx` returns `null` for idle.
- `apps/web/src/components/enrollment/setup-wizard.tsx` is state-heavy and old-flow-oriented.

#### Impact if unaddressed

- Finance users will still ask “what is saved?” and “what do I need to fix first?”
- Review/committee workflows will remain spreadsheet-dependent.
- A polished page will still fail the “defensible in a meeting” test.

#### Required corrections

- Add a concrete `EnrollmentStatusStrip` design with exact state fields and placement.
- Put exception filters and exception counts in the **page header / grid contract**, not just the inspector.
- Specify export outputs and formats.
- Define filtered/global total display rules.
- Define blocking validation CTAs and error recovery.

### Agent 5 — QA / Test Strategy / Regression Auditor

**Verdict:** Regression risk is high and under-covered.

#### What the plan gets right

- It at least names many tests that should exist.
- It correctly identifies invalidation and viewport behavior as risk areas.
- It recognizes the need to rewrite wizard tests.

#### What is wrong / risky / missing

- The current tests mostly protect the old page and old wizard.
- The plan underestimates the need for browser-level testing.
- Critical foundations are effectively untested: right panel, planning grid, inspector views, enrollment hooks.
- Query invalidation and recommendation refresh logic are too central to remain untested.
- Coverage on the exact touched surfaces is poor.

#### Evidence from codebase

- `apps/web/src/pages/planning/enrollment.test.tsx`: one narrow test only.
- `apps/web/src/components/enrollment/setup-wizard.test.tsx`: protects old 5-step behavior, not the new 3-step contract.
- `apps/web/src/components/shell/right-panel.tsx`: no direct tests found.
- `apps/web/src/components/data-grid/planning-grid.tsx`: no direct tests found.
- `apps/web/src/hooks/use-enrollment.ts`, `apps/web/src/hooks/use-cohort-parameters.ts`, `apps/web/src/hooks/use-grade-levels.ts`: no direct tests found.
- `apps/api/src/routes/enrollment/cohort-parameters.test.ts` needs argument-level assertions once rules become version-scoped.

#### Impact if unaddressed

- Silent failures in cache invalidation.
- Broken right-panel registration or selection behavior.
- Scroll/layout bugs that unit tests never catch.
- Drift between client preview and server truth.

#### Required corrections

- Add browser/e2e coverage for scroll ownership, sticky headers, panel open/close, banner stacking, and comparison fallback.
- Rewrite wizard tests around the new workflow.
- Add dedicated tests for `buildMasterGridRows()`.
- Add real query invalidation tests with `QueryClient`.
- Add route tests for planning rules, `defaultAy2Intake`, clone semantics, and last-calculated metadata if introduced.

### Agent 6 — Delivery Confidence & Program Risk Auditor

**Verdict:** Blocked on sequencing and rollback.

#### What the plan gets right

- Splitting master grid work from sidebar work is sane.
- Doing schema/API before UI is correct.
- Reusing existing hooks/services where possible is the right instinct.

#### What is wrong / risky / missing

- No credible rollback or cutover strategy.
- Phase 4 is too large.
- Phase 5 is too large.
- The plan depends on backend/API features that do not yet exist, but it does not gate the UI work hard enough on them.
- Export, trust strip, and client/server recommendation parity are not sequenced as critical-path items.
- The admin/master-data dependency is real but under-promoted in the delivery plan.

#### Evidence from codebase

- `apps/web/src/pages/planning/enrollment.tsx` is the single integration point for current experience.
- `apps/web/src/components/enrollment/setup-wizard.tsx` is already a 1400+ line file.
- `apps/api/src/routes/versions.ts` clone behavior is bespoke.
- `apps/web/src/components/shell/right-panel.tsx` is still simplistic; expanding it during the same cutover increases risk.

#### Impact if unaddressed

- Late-stage discovery during page swap.
- No safe way to ship partially.
- Hard-to-recover regressions in a critical planning surface.

#### Required corrections

- Split Phase 4 into layout shell, then master-grid cutover, then legacy removal.
- Split Phase 5 into state extraction, behavior rewrite, then animation/polish.
- Add a route-level or component-level rollback mechanism: `EnrollmentPageLegacy` vs `EnrollmentPageWorkspace`.
- Make `defaultAy2Intake`, trust-strip data sources, and planning-rule source of truth explicit prerequisites.

### Agent 7 — Finance Controls / Auditability Reviewer

**Verdict:** Finance-friendly direction, audit controls incomplete.

#### What the plan gets right

- Version-scoped rules are the right finance abstraction.
- One master grid is better for reviewability.
- Explicit stale-module awareness is good.
- Exception ordering aligns with real finance triage.
- The plan correctly calls for saved-vs-preview visibility.

#### What is wrong / risky / missing

- Manual overrides are not persistently modeled; proposed `hasManualOverride` row metadata is not an audit trail.
- Export/reportability is not designed.
- No real sign-off or review-gate flow exists.
- Assumption change history is only version-level today, not per-grade/per-field.
- Confidence tagging is not sufficiently auditable or explainable.
- Saved vs staged logic across page/sidebar/wizard is not governed tightly enough.

#### Evidence from codebase

- `apps/api/prisma/schema.prisma`: `AuditEntry` exists and is useful, but there is no enrollment override/audit-specific table.
- `apps/api/src/routes/audit.ts`: audit retrieval exists, but current enrollment writes do not give the granularity finance reviewers would want.
- `apps/api/src/routes/enrollment/setup.ts`: `ENROLLMENT_SETUP_APPLIED` audit is aggregate, not per-grade delta-rich.
- Export job infrastructure exists in docs/contracts, but there is no enrollment-specific export path in current code.
- `apps/api/src/routes/versions.ts`: no `enrollmentReviewedBy` / review-gate semantics.

#### Impact if unaddressed

- Review meetings will still rely on verbal explanations and spreadsheet sidecars.
- Manual assumptions will not be defensible.
- Governance will lag behind UI polish.

#### Required corrections

- Add explicit override tracking and/or richer per-grade audit payloads.
- Define enrollment export/report outputs.
- Add enrollment review/sign-off state or equivalent governance gate.
- Make confidence explanations visible and, where needed, persisted or auditable.
- Clarify saved/staged behavior across inspector vs wizard.

---

## Section 4 — Codebase Validation Matrix

| Plan Claim                                                              | Verified? | Evidence                                                                                                                                                                                                                    | Risk if Wrong                                         | Correction Needed                                                                                            |
| ----------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| The page can become fixed-viewport/no-scroll without shell changes      | Partial   | `apps/web/src/layouts/planning-shell.tsx` can host a bounded page, but `<main>` is `overflow-y-auto`; `apps/web/src/components/data-grid/planning-grid.tsx` does not currently own vertical scrolling                       | Double-scroll, clipped rows, broken laptop experience | Add explicit flex/overflow contract and vertical scroll owner; do not rely on `h-full overflow-hidden` alone |
| The planning shell is compatible with the redesign                      | Yes       | `apps/web/src/layouts/planning-shell.tsx` is shell-bounded and page-routed                                                                                                                                                  | Still risky if treated as “unchanged”                 | Keep shell compatibility claim, but remove “no changes needed” certainty                                     |
| Right panel behavior is already compatible                              | No        | `apps/web/src/stores/right-panel-store.ts`, `apps/web/src/stores/enrollment-selection-store.ts`, `apps/web/src/pages/planning/enrollment.tsx` show tight coupling between panel open/close, selection, and sidebar collapse | Selection loss, inconsistent inspector behavior       | Redefine panel/selection contract explicitly                                                                 |
| Existing hook contracts are straightforward to extend                   | Partial   | `apps/web/src/hooks/use-cohort-parameters.ts`, `apps/web/src/hooks/use-enrollment.ts`, `apps/web/src/hooks/use-grade-levels.ts` are simple, but untested and contract-sensitive                                             | Stale cache, silent mismatches, broken mocks          | Add hook contract and invalidation tests; version response changes carefully                                 |
| Route assumptions for cohort parameters are accurate                    | Yes       | `apps/api/src/routes/enrollment/cohort-parameters.ts` currently returns `{ entries }` and computes recommendations server-side                                                                                              | Client/server drift if changed casually               | Update route, tests, and shared types atomically                                                             |
| Prisma assumptions for new fields are straightforward                   | Partial   | `apps/api/prisma/schema.prisma` lacks all proposed fields; `BudgetVersion` placement is good, but clone/backfill/history semantics are missing                                                                              | Wrong defaults, silent clone resets                   | Add migration + clone support + backfill policy                                                              |
| Recommendation engine can just be parameterized                         | Partial   | `apps/api/src/services/cohort-recommendations.ts` is the right seam, but the plan’s wizard-side approximation is unproven                                                                                                   | Preview differs from server truth                     | Use shared logic or server refresh strategy in wizard                                                        |
| Query invalidation assumptions are sufficient                           | No        | Current invalidations exist in `apps/web/src/hooks/use-enrollment.ts` and `use-cohort-parameters.ts`, but are untested; planning-rules adds more coupling                                                                   | Recommendations or stale pills stay stale silently    | Add invalidation tests with real `QueryClient`                                                               |
| Grade-level serialization will automatically include `defaultAy2Intake` | Yes       | `apps/api/src/routes/master-data/grade-levels.ts` serializes the full row shape                                                                                                                                             | Low                                                   | Still must update schema, update schema validation, hooks, and master-data UI                                |
| Wizard state assumptions are safe to rewrite in place                   | No        | Current wizard is 1400+ lines and old-flow tests protect old behavior                                                                                                                                                       | Regression and state loss                             | Split wizard rewrite into state extraction then behavior rewrite                                             |
| Test coverage assumptions are sufficient                                | No        | `apps/web/src/pages/planning/enrollment.test.tsx` is minimal; `apps/web/src/components/enrollment/setup-wizard.test.tsx` covers old flow; key surfaces lack tests                                                           | Silent regressions                                    | Build real frontend/browser/regression coverage before cutover                                               |
| Grid capability assumptions are fully satisfied by `PlanningGrid`       | Partial   | `apps/web/src/components/data-grid/planning-grid.tsx` supports grouping, selection, pinned columns, keyboard nav; no proof yet for internal viewport ownership                                                              | Layout and keyboard behavior failures                 | Wrap/extend `PlanningGrid` for vertical-scroll workspace behavior                                            |
| `defaultAy2Intake` is just a frontend placeholder concern               | No        | Backend setup/calculation fallback currently ignores grade-level defaults                                                                                                                                                   | Wrong persisted/calculated PS intake                  | Make backend fallback authoritative                                                                          |
| Existing versions are affected only in Draft state                      | No        | `apps/api/src/routes/enrollment/cohort-parameters.ts` synthesizes read-time recommendations for all reads                                                                                                                   | Historical/readonly displays drift                    | Reword policy and/or backfill/snapshot missing cohort rows                                                   |
| Comparison mode can be handled later without blocking the redesign      | Partial   | Enrollment page itself has no real comparison implementation, but shell/context bar support comparison concepts elsewhere                                                                                                   | Major UX gap during comparison                        | Either explicitly defer and exclude from acceptance criteria, or design it now                               |

---

## Section 5 — Missing Items / Blind Spots

### Critical missing items

- **Rollback / cutover strategy**
    - No `EnrollmentPageLegacy` vs new-page switch
    - No feature flag or equivalent safety valve
- **Authoritative trust-strip data sources**
    - No concrete plan for “last calculated”
    - No exact source-of-truth for saved vs preview vs calculated state
- **Panel/selection state contract**
    - What survives panel close?
    - What happens on same-row re-click?
    - What happens on narrow widths?
- **Clone semantics for new version-level rule fields**
- **Authoritative PS default backend behavior**
- **Export workflow specification**
    - formats, scopes, filters, role behavior
- **Client/server recommendation parity strategy**
- **Viewport fallback rule**
    - explicit threshold, not just principle

### Important missing items

- **Comparison-mode behavior**
- **Filtered-vs-global KPI semantics**
- **Blocking validation CTA design**
- **Review/sign-off / governance flow**
- **Override auditability granularity**
- **Concurrency/conflict strategy**
- **Per-grade assumption history**
- **Confidence explanation model**

### Nice-to-have improvements

- Keyboard copy/export shortcuts from master grid
- Multi-select scaffolding for future batch actions
- More explicit tooltip/help content around planning rules
- Relative-time + absolute-time display for last-calculated
- Board-pack oriented export preset

---

## Section 6 — Top Risks Register

| Risk ID | Description                                                                               | Area                 | Probability | Impact | Severity | Detection Difficulty | Mitigation                                                                         | Owner Suggestion     |
| ------- | ----------------------------------------------------------------------------------------- | -------------------- | ----------- | ------ | -------- | -------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| R1      | Scroll model failure: page still scrolls or clips while grid also scrolls                 | Frontend layout      | High        | High   | Critical | Medium               | Add explicit flex/min-h-0 contract; browser tests for viewport heights             | Frontend architect   |
| R2      | Sidebar/right-panel dependency failure breaks inspector workflow                          | Frontend state       | High        | High   | Critical | Medium               | Redefine selection/panel contract; test row select, close, reopen, same-row toggle | Frontend engineer    |
| R3      | Mutation/cache inconsistency after planning-rule edits                                    | Data layer           | High        | High   | Critical | High                 | Add dedicated invalidation tests and one source of truth for rules                 | Frontend + backend   |
| R4      | Rule-change semantic drift between wizard preview and server apply                        | Domain logic         | High        | High   | Critical | High                 | Share logic or do server refresh in wizard; do parity tests                        | Backend/domain owner |
| R5      | Comparison mode breakage or undefined behavior                                            | UX/layout            | Medium      | High   | High     | Medium               | Explicitly defer or specify comparison behavior before implementation              | Product + frontend   |
| R6      | Responsive clipping on narrow-height or zoomed viewports                                  | Frontend UX          | High        | High   | Critical | Medium               | Add threshold-based page-scroll fallback and browser verification                  | Frontend             |
| R7      | Regression from contract changes (`planningRules`, renamed rule enum, `defaultAy2Intake`) | API/types            | High        | Medium | High     | Low                  | Atomic update across schema, API, shared types, UI, tests                          | Backend lead         |
| R8      | Wizard state loss during source switch/back navigation/close                              | Wizard UX            | Medium      | High   | High     | Medium               | Extract reducer/state machine first; add close/navigation persistence tests        | Frontend             |
| R9      | Stale downstream module signaling failure                                                 | Trust / workflow     | Medium      | High   | High     | Medium               | Make stale pills data-driven and tested; define click behavior                     | Backend + UX         |
| R10     | Export/trust gap leaves review workflow spreadsheet-dependent                             | Finance workflow     | High        | Medium | High     | Low                  | Design export outputs and route/format ownership now                               | Product + backend    |
| R11     | Manual override visibility gap                                                            | Finance auditability | High        | Medium | High     | Medium               | Add override tracking/audit payload + visible badges                               | Backend + UX         |
| R12     | Concurrency/conflict handling gap causes silent overwrite                                 | Multi-user behavior  | Medium      | High   | High     | High                 | Add optimistic concurrency or explicit refresh/conflict UX                         | Backend/API          |
| R13     | Clone reset of new planning-rule fields                                                   | Version management   | Medium      | High   | High     | Low                  | Update clone route and tests                                                       | Backend              |
| R14     | Historical/non-Draft recommendation display changes unexpectedly                          | Domain/history       | Medium      | Medium | Medium   | Medium               | Backfill or snapshot missing cohort data; clarify policy                           | Backend/domain       |

---

## Section 7 — Delivery Confidence Assessment

**Overall confidence:** **46%**

The plan is credible as a product direction, but delivery confidence is dragged down by oversized cutover phases, weak regression protection, missing rollback, missing trust/export/governance details, and unresolved backend semantics.

### By workstream

- **Backend/schema:** **68%**
    - Good core model placement, but clone semantics, read-time historical behavior, last-calculated exposure, and authoritative PS fallback are unresolved.

- **Frontend grid/layout:** **42%**
    - Master-grid concept is good, but the scroll contract and right-panel coupling are not de-risked.

- **Sidebar/default view:** **55%**
    - Easier than the page swap, but trust/exception/export behavior is still underspecified.

- **Wizard rewrite:** **31%**
    - Highest-risk stream: large existing file, new state model, mixed staged/save behavior, and unclear recommendation-refresh strategy.

- **Testing/regression:** **24%**
    - Too many touched surfaces have poor or nonexistent protection.

- **UX/finance adoption:** **49%**
    - Finance users will likely prefer the direction, but they will not trust it fully unless state clarity, exports, exceptions, and override visibility are tightened.

### Main confidence reducers

- No rollback strategy for Phase 4 cutover
- Oversized Phase 4 and Phase 5
- Missing browser-level layout verification
- Current panel/store coupling is stronger than the plan acknowledges
- “Last calculated” and saved/preview truth model need new backend/UI support
- Wizard-side approximation of recommendation logic is not trustworthy as currently described
- Export/reportability is called mandatory but not designed

### Main confidence boosters

- The plan correctly identifies the main current UX problems
- Existing recommendation engine seam is clean enough to refactor
- Version-scoped rule placement on `BudgetVersion` is right
- Master-data path for `defaultAy2Intake` is clear, even if under-sequenced
- `PlanningGrid` is a usable substrate
- Right-panel registration pattern already exists

---

## Section 8 — Approval Conditions

### Must fix before implementation

- Replace “works as-is / unchanged” claims for `right-panel-store`, `enrollment-selection-store`, and `planning-shell`.
- Decide the **single source of truth** for planning-rule read/write behavior.
- Add a rollback/cutover strategy: legacy page vs new page, or equivalent.
- Promote `defaultAy2Intake` master-data work to a hard prerequisite for wizard/inspector behaviors that depend on it.
- Define the trust-strip data model: saved vs preview vs calculated, last-calculated source, stale-module source.
- Define the fixed-viewport fallback rule with explicit thresholds.
- Decide clone semantics for new version-level rule fields.

### Must verify during implementation

- Internal scroll belongs to the master-grid region, not the page, at normal laptop heights.
- Right-panel selection behavior remains stable when panel closes/reopens and when the same row is clicked twice.
- Planning-rule edits refresh recommendations correctly and predictably.
- PS default intake behavior is correct in **backend** setup/apply and calculation flows.
- Filtered totals can never be mistaken for global totals.
- Non-Draft and imported-version gating stays consistent between frontend and backend.
- Export behavior respects filters and user permissions if included in scope.

### Must validate before merge

- Browser/e2e tests for scroll ownership, sticky headers, banner stacking, panel interactions, and narrow-height fallback.
- Updated route tests for planning rules, `defaultAy2Intake`, and clone behavior.
- Rewritten wizard tests for the new 3-step contract.
- Query invalidation tests for planning-rules, cohort-parameters, setup/apply.
- Review of manual override visibility/auditability and at least one finance-review workflow test.
- Typecheck, lint, and workspace-local coverage checks passing for changed packages.

---

## Section 9 — Proposed Plan Corrections

### Corrected sequencing

1. **Schema and backend semantics first**
    - Add Prisma fields
    - Add authoritative backend fallback for PS default
    - Add planning-rule source-of-truth route/service
    - Add clone support for new version-level rule fields
    - Add last-calculated metadata path if trust strip remains in scope

2. **Types and hook contracts**
    - Shared types
    - Grade-level type updates
    - Query/mutation hooks
    - Invalidation tests at the same time

3. **Sidebar and rule UX before page swap**
    - Right-panel label/content update
    - Exception queue / trust cues in inspector default view
    - Planning-rule staging semantics
    - Guide content

4. **Master grid delivered behind a safe cutover boundary**
    - Build `EnrollmentMasterGrid`
    - Build `buildMasterGridRows()`
    - Validate grid interactions and viewport behavior without deleting legacy page content yet

5. **Page shell swap split into two subphases**
    - **4a:** new bounded page layout + header + KPI/status strip, still capable of rendering legacy content if needed
    - **4b:** replace legacy grids with master grid
    - **4c:** only after validation, remove old blocks/components

6. **Wizard rewrite last, in subphases**
    - Extract reducer/state model
    - Rebuild 3-step flow
    - Add rule refresh strategy
    - Add animation/polish only after logic stabilizes

### Missing work packages

- Clone semantics for `rolloverThreshold` / `cappedRetention`
- Data migration/backfill for PS `defaultAy2Intake`
- Trust-strip metadata source implementation
- Export/report definition or explicit defer
- Comparison-mode decision
- Override/auditability decision
- Concurrency/conflict handling decision

### Missing validations

- Browser layout validation
- Query invalidation validation
- Client/server recommendation parity validation
- Filtered/global KPI interpretation validation
- Non-Draft/imported read-only enforcement validation
- Panel/selection lifecycle validation

### Missing rollback points

- Legacy/new page switch
- “Do not delete old grids/components until after page swap is validated”
- Separate approval gate after Phase 4a and before Phase 4b
- Separate approval gate before wizard cutover

### Missing acceptance criteria

- “No outer page scroll under normal supported viewport” with explicit viewport definition
- “If viewport height falls below threshold, controlled page-scroll fallback activates”
- “Planning-rule edits never leave recommendations stale after success”
- “Cloned versions preserve planning rules”
- “PS default intake is identical across placeholder, apply payload, and calculation fallback”
- “Filtered totals are explicitly labeled and cannot be confused with global totals”
- “User can tell in under 10 seconds: baseline source, saved/preview state, last calculated, and stale downstream modules”

---

## Section 10 — Final Recommendation

**Pause and correct the plan**

This plan should not be approved in its current form. It is a good strategy document pretending to be an execution-ready implementation plan. The direction is worth keeping; the execution framing is not yet safe enough.

### Final rationale

- Strongest parts: product direction, consolidation logic, version-scoped rules.
- Weakest parts: delivery realism, frontend state/layout assumptions, trust/export/governance definition, and regression safety.

**Recommended stance:** Approve the direction. Do **not** approve this exact implementation plan without correction.
