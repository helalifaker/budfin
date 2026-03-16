# Revenue Page Spec Deep Review — Enrollment Parity Audit

Reviewed spec: `docs/plans/2026-03-14-revenue-enrollment-parity.md`

## 1. Executive Verdict

The spec is materially stronger than the current Revenue implementation and clearly understands the right target: Revenue should inherit Enrollment’s workspace grammar rather than ship another custom surface. It is especially strong on row identity, fee-grid writeback intent, guide architecture intent, and explicit parity invariants.

It still does **not fully ensure** parity on its own.

The remaining risk is not cosmetic. The spec still leaves several system-level guarantees too loose:

- shared primitives stop too early,
- keyboard parity is assumed from `PlanningGrid` without closing the gap in that component,
- the fee grid still risks becoming a second UI system,
- token usage is requested but not governed,
- and the testing plan can still pass while visible parity drifts.

Architecture is directionally sound, but implementation readiness is conditional on tightening the missing contracts below.

- **Parity Confidence Score:** 7/10
- **Architecture Confidence Score:** 7/10
- **Design System Maturity Score:** 6/10
- **Delivery Risk Score:** 6/10
- **Maintainability Score:** 6/10

Bottom line: the spec is good enough to justify the epic direction, but not yet strong enough to guarantee “same product” parity without targeted revisions.

## 2. Overall Assessment

What the spec does well:

- It correctly treats Enrollment as the canonical planning workspace, not merely a visual inspiration.
- It identifies the right parity axes: fixed-height shell, toolbar zoning, panel synchronization, shared token usage, guide-tab population, and trust cues.
- It upgrades the review from “make Revenue prettier” to “make Revenue structurally consistent.” That is the correct level.
- It explicitly recognizes the fee grid as the main place where Revenue can accidentally fork into a second system.
- It introduces better contracts than the current implementation: row identity, grid semantics, writeback rules, readiness normalization, and guide registration.

Where it is unusually robust:

- `INV-1` through `INV-8` are genuinely useful architectural invariants rather than decorative statements.
- The fee schedule writeback section is far better than most redesign specs; it at least acknowledges that aggregation without reverse mapping is dangerous.
- The spec ties export semantics, inspector deep-linking, and row identity together instead of treating them as separate concerns.
- Story `S9` is correctly architectural instead of merely content-focused.

Where it remains vulnerable:

- It still relies on too many Revenue-only component implementations for elements that should become shared primitives.
- Several acceptance criteria are precise about classes but weak on enforcement mechanisms, so drift can re-enter later.
- It assumes `PlanningGrid` can provide the required keyboard/accessibility parity, but current behavior does not meet the spec for read-only grids.
- The fee grid redesign still mixes `PlanningGrid`, plain HTML tables, editable cells, summary rows, and derived rows without enough shared section chrome. That can still feel like a mini-app inside the settings dialog.
- The story plan delays or isolates some cross-cutting architecture work that should be foundational.

Overall, the spec solves parity at a better-than-usual level, but it still stops one layer short of full drift prevention.

## 3. Findings by Category

### 3.1 UI/UX Identity Parity

**Strengths**

- The shell/frame parity is explicit: fixed-height workspace, fixed banners/toolbar/KPI/status, and a scroll-owning grid zone.
- Toolbar zoning is correctly inherited from Enrollment.
- Default vs active inspector modes are explicit instead of implied.
- Trust cues are treated as fixed workspace elements rather than buried content.
- The spec intentionally distinguishes shared grammar from valid Revenue-specific deviations.

**Weaknesses**

- The period control is under-specified. Current Revenue has an AY1/AY2/FY toggle in the toolbar, but the spec does not clearly state whether it stays, moves, or changes interaction semantics.
- Motion parity is mentioned through `animate-kpi-enter` and staggering, but there is no broader motion contract for panel transitions, default-to-active inspector transitions, or settings auto-open behavior.
- Empty-state language is better than before, but still not governed as a shared content system. Revenue can still end up sounding like a different product.
- The spec does not define shared visual structure for summary tables, workflow cards, formula cards, or validation tables. Those are core to the inspector’s identity.

**Contradictions / drift risks**

- The spec says parity with Enrollment should feel like the same product, yet it still allows too much bespoke implementation freedom in the inspector section layouts.
- `SM-01` removes Setup from the toolbar, which is acceptable, but the spec should explicitly codify that the merged settings dialog inherits setup affordances so workflow grammar remains intact.

**Missing safeguards**

- No parity assertion for spacing rhythm across banner/toolbar/KPI/status/grid transitions.
- No invariant for icon treatment consistency across cards, status elements, workflow steps, and validation items.

**Overengineering risk**

- The default inspector can become overstuffed. Nine sections are defensible only if the shared section patterns keep the density disciplined.

### 3.2 Design System / CSS / Tokens

**Strengths**

- The spec correctly prioritizes CSS custom properties over local color constants.
- It identifies missing chart series tokens and nationality tokens.
- It explicitly targets hardcoded font sizes, hardcoded radii, and hardcoded Recharts values.

**Weaknesses**

- `DS-01` only bans hardcoded hex values in `apps/web/src/components/revenue/`. That is too narrow. Drift can still enter through `lib/`, shared components, inline style maps, or new files outside that folder.
- The spec defines token additions but not token governance. There is no lint gate, audit script, or test that enforces token usage.
- It extracts band styles, but not the full semantic styling map for KPI accents, inspector badges, validation states, or section headers.
- Typography parity is partly specified for charts and numeric columns, but not for section headings, badges, table captions, or workflow labels.

**Contradictions / drift risks**

- Several ACs are class-string exact (`rounded-xl`, `border-l-[3px]`, `sm:grid-cols-2 lg:grid-cols-4`) but not abstracted into primitives. That still allows duplicated Tailwind strings to drift later.
- Chart tokenization is mentioned, but no shared chart wrapper is defined. Recharts configuration can still diverge even with tokenized colors.

**Missing safeguards**

- No token for selected-row left accent width/color pairing.
- No shared token strategy for tariff group colors.
- No token governance for icon circle backgrounds and semantic accents.
- No shared section-card variant system for workflow, formula, validation, and assumptions cards.

**Overengineering risk**

- Minimal. The bigger risk is under-systematizing styling and leaving too much local composition.

### 3.3 Shared Components & Reuse

**Strengths**

- `CalculateButton`, `FilterPillMenu`, `GuideSection`, `WorkspaceStatusStrip`, `PlanningGrid`, and band styles are the right first extractions.
- The guide registry architecture is the correct pattern and aligns with the existing details registry.
- Moving selection identity into `revenue-workspace.ts` is correct.

**Weaknesses**

- The spec stops short of extracting the primitives most likely to drift:
    - KPI card shell,
    - inspector section shell,
    - summary table component,
    - workflow status card,
    - formula explanation card,
    - readiness dot/indicator component,
    - chart wrappers.

- `WorkspaceStatusStrip` is defined as a wrapper that accepts `sections[]`, but the spec never defines the actual schema strongly enough to guarantee consistent semantics and rendering.
- `EditableCell` is referenced but not normalized consistently: current code uses both shared and data-grid paths.

**Contradictions / drift risks**

- The spec aims to prevent duplication, but still leaves Revenue to build a custom inspector made of many one-off sections.
- `GuideSection` is extracted, but the rest of the guide content architecture is only generalized for guide rendering, not for inspector rendering, where far more duplication risk exists.

**Missing safeguards**

- No shared chart wrapper that encodes tooltip, axis, font, and color conventions.
- No shared summary table primitive despite multiple inspector tables with very similar structure.
- No shared KPI card primitive despite both pages using the same card grammar.

**Overengineering risk**

- Low. Extracting these primitives would reduce complexity, not add it.

### 3.4 Interaction Model & State Behavior

**Strengths**

- Selection toggling, panel synchronization, and row-type selectability are now explicit.
- View-mode switching clears selection.
- Export is defined relative to visible state.
- Settings deep links are wired into row identity via `settingsTarget`.

**Weaknesses**

- Period switching behavior is not specified even though current Revenue has a period toggle and that materially affects visible data and inspector content.
- Filter changes that hide the selected row are mentioned in story scope but not elevated to acceptance criteria.
- There is no explicit contract for what happens when users are on the Guide tab and then select a row; parity expects Details to become active immediately.
- The first-visit auto-open behavior is specified, but not the dismissal/reopen rules in read-only or imported states beyond a single degenerate case.

**Contradictions / drift risks**

- The spec relies on `PlanningGrid` for keyboard parity, but current `PlanningGrid` only Tab-cycles editable columns and downgrades read-only tables to `role="table"`. That conflicts with `INV-8`, `FG-09`, and the accessibility section.
- The spec treats keyboard parity as solved by migration, when it actually requires shared component enhancement.

**Missing safeguards**

- No AC that selection clears on period change.
- No AC that selecting a row while on another panel tab switches the right panel back to `details`.
- No AC that filtered-to-empty state also clears stale selection and inspector context.

**Overengineering risk**

- None. The risk is incomplete state coherence, not too much architecture.

### 3.5 Fee Grid Redesign

**Strengths**

- The spec recognizes the fee schedule as a finance-facing presentation rather than a storage-facing table.
- It defines editability categories and fan-out rules.
- It handles heterogeneous values explicitly instead of silently flattening them.
- It separates fee-schedule ownership from other operating revenue ownership.

**Weaknesses**

- The fee grid still mixes three rendering systems: compact `PlanningGrid`, simple HTML tables, and inline editable cells. Without shared section shells and table primitives, this can still feel detached from the rest of the workspace.
- `FR-07` says Autres Frais and Abattement use simple HTML tables, but the spec does not define how those tables inherit the same header styling, spacing, sticky behavior, empty states, and read-only affordances.
- The spec claims no backend changes, but some fee-grid ownership assumptions imply storage semantics that may not exist exactly as written.

**Contradictions / drift risks**

- `Fee Grid tab vs Other Revenue tab -- Ownership Split` assumes `FeeGridEntry` can own `autres_frais` row families and that `OtherRevenueDriver` cleanly owns the rest. If those contracts do not already exist end-to-end, the frontend-only claim is false.
- The fee grid may still look like a dense finance sub-application because the settings dialog is allowed to become more complex without a corresponding simplification directive.

**Missing safeguards**

- No AC for shared section chrome across Tuition / Autres Frais / Abattement.
- No AC for consistent sticky headers or scroll behavior inside the settings dialog.
- No AC for consistent visual language between editable-source, editable-fanout, summary-only, mixed-value-warning, and read-only rows.

**Overengineering risk**

- High if every section becomes bespoke. The current spec is directionally right, but it needs stronger anti-bespoke guardrails.

### 3.6 Acceptance Criteria Quality

**Strengths**

- The AC coverage is broad and concrete.
- Many high-risk behaviors are now explicitly testable.
- The spec improves materially by elevating identity, reconciliation, export, and empty-state concerns.

**Weaknesses**

- Some ACs are implementation-detail-heavy rather than outcome-governed, especially in the design-system section.
- Some critical outcomes are still missing enforcement mechanisms, especially token governance and visual parity validation.
- The AC set is large, but still leaves room for non-parity outcomes in shared primitives and interaction edge cases.

**Contradictions / drift risks**

- `DS-02` and `DS-03` assert exact classes, but not shared primitive usage. Engineers can satisfy the classes while still duplicating the styling system.
- `SC-05` creates a shared status strip, but no outcome AC ensures both wrappers remain semantically aligned over time.

**Missing safeguards**

- No AC for shared KPI card primitive usage.
- No AC for shared summary table primitive usage.
- No AC for token linting or parity regression checks.
- No AC for period toggle semantics.

**Overengineering risk**

- Mild. The bigger issue is not too many ACs; it is too many local ACs without enough system-level ACs.

### 3.7 Story Plan / Sequencing / Delivery Risk

**Strengths**

- The high-level dependency order is sensible.
- Grid identity before grid migration is correct.
- Guide architecture is recognized as its own concern.
- Fee grid redesign comes after the grid patterns are established.

**Weaknesses**

- `S9` is marked independent after `S2`, but it changes shared panel infrastructure and should be earlier or at least treated as a cross-cutting enabler.
- `S6` depends only on `S4`, but in practice it also depends on token work and shared component extraction to avoid rework.
- `S7` depends only on `S2`, but KPI/status alignment also depends on `S1` token alignment.
- Parity verification lands too late. Too much can be built before the first true parity gate.

**Contradictions / drift risks**

- The plan allows multiple teams to move in parallel while some shared primitives are still undefined. That increases rework risk.
- The most “same product” work is spread across several stories rather than front-loaded into explicit parity enablers.

**Missing safeguards**

- No early parity gate after `S2/S3/S4` to compare Enrollment vs Revenue structure before heavy inspector and fee-grid work.
- No explicit dependency on upgrading `PlanningGrid` itself before `S5` starts.

**Overengineering risk**

- Low. The risk is optimistic sequencing, not too much process.

### 3.8 Testing & Validation Coverage

**Strengths**

- The spec includes row identity, guide rendering, round-trip writeback, cross-view reconciliation, export, and empty-state tests.
- It correctly recognizes fee-grid round-trip integrity as critical.

**Weaknesses**

- There is no mandated visual regression strategy.
- There is no token-usage enforcement test.
- There is no DOM-structure or class-invariant parity test against Enrollment.
- There is no explicit test category for “same product” parity assertions at the component-shell level.

**Contradictions / drift risks**

- `QA-04` coverage can pass while parity is visibly wrong.
- Visual parity verification is mentioned in `S10`, but not formalized into a required testable artifact.

**Missing safeguards**

- No CSS audit check for hardcoded colors outside the Revenue component folder.
- No snapshot/structure tests for toolbar ordering, KPI card count, status-strip pill rendering, or inspector default/active shells.
- No parity-focused regression checks for shared primitives used by both Enrollment and Revenue.

**Overengineering risk**

- Minimal. The current test plan is not excessive; it is incomplete.

### 3.9 Accessibility & Keyboard Parity

**Strengths**

- The spec explicitly mentions grid roles, `aria-selected`, focus trap, `aria-modal`, and guide `aria-expanded`.
- It treats keyboard parity as part of parity, not a separate concern.

**Weaknesses**

- The keyboard contract is stronger than the current shared grid can deliver.
- The spec does not define focus restoration after closing settings or clearing selection.
- The mixed fee-grid rendering model risks inconsistent keyboard behavior across sections.

**Contradictions / drift risks**

- Current `PlanningGrid` only uses `role="grid"` for editable tables and only handles Tab navigation for editable columns. A read-only Revenue forecast grid will not satisfy the spec unless the shared component changes.
- If Autres Frais and Abattement remain plain HTML tables, keyboard semantics may be materially different from the Tuition section.

**Missing safeguards**

- No AC for focus returning to the previously focused trigger after settings close.
- No AC for focus restoration from inspector back button to the selected grid row.
- No AC ensuring all three fee-grid sections follow the same keyboard grammar.

**Overengineering risk**

- None. Accessibility parity is currently under-specified, not over-specified.

### 3.10 Simplification Opportunities

**Strengths**

- The spec already pushes several smart simplifications: shared buttons, shared status strip, shared filter menu, guide registry.

**Weaknesses**

- It still leaves too many one-off visual compositions inside Revenue.
- It treats some duplicated patterns as content work when they are actually component work.

**Contradictions / drift risks**

- The spec says simplification/reuse matters, but it does not extract the highest-drift pieces.
- The fee grid risks special handling everywhere because the simplification strategy stops at data transformation, not rendering grammar.

**Missing safeguards**

- No central semantic styling maps for KPI accents, group accents, validation states, and inspector badges.
- No config-driven inspector section renderer.

**Overengineering risk**

- The current state is more at risk of under-refactoring than over-refactoring.

## 4. Detailed Issue Register

| ID     | Severity | Category                    | Spec Reference                                                 | Issue                                                                                                                                                                                        | Why It Matters                                                                                                    | Recommendation                                                                                                                                                                                         |
| ------ | -------- | --------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RPA-01 | Critical | Interaction / Accessibility | INV-8, FG-01, FG-09, Accessibility Requirements, S5            | The spec assumes `PlanningGrid` can deliver Revenue keyboard parity, but current `PlanningGrid` downgrades read-only tables to `role="table"` and only Tab-cycles editable columns.          | Revenue can “migrate to PlanningGrid” and still fail parity and WCAG requirements.                                | Add a prerequisite shared-grid enhancement: read-only mode must still support `role="grid"`, active-cell focus management, row selection via Enter, and Tab/Shift+Tab navigation across cells or rows. |
| RPA-02 | Critical | Fee Grid / Architecture     | Fee Grid ownership split, FR-05, FR-07, S8, Data Model Changes | The spec says “no backend changes,” but fee-grid ownership and writeback rules assume storage semantics that may not already exist, especially around fee-schedule `Autres Frais` ownership. | If storage contracts do not match the presentation model, the story is not frontend-only and delivery slips late. | Validate every storage assumption against current contracts and either confirm them explicitly or amend the spec to call out required backend/type work.                                               |
| RPA-03 | High     | Shared Components           | SC-05, SS-01 to SS-03, S7                                      | `WorkspaceStatusStrip` is proposed as shared, but its schema is under-specified and the two modules have different semantics.                                                                | A shallow wrapper with ad hoc section rendering will still drift over time.                                       | Define a strong section schema with supported item types, semantic variants, badges, and priority ordering; add shared tests across Enrollment and Revenue wrappers.                                   |
| RPA-04 | High     | UI Identity                 | Toolbar Features, PL-02, INV-2                                 | The period selector is not explicitly covered in the spec even though current Revenue uses it and it affects visible state, export, and inspector meaning.                                   | Omitting it creates parity ambiguity and state-coherence gaps.                                                    | Add explicit toolbar and state rules for period toggles, including selection reset, export naming, and inspector recalculation behavior.                                                               |
| RPA-05 | High     | Design System               | DS-01, S1                                                      | The hardcoded-color ban only covers `apps/web/src/components/revenue/`.                                                                                                                      | Drift can re-enter via `lib/`, shared components, or inline maps.                                                 | Expand the scope to all new Revenue-related code and add an automated audit or lint/test check.                                                                                                        |
| RPA-06 | High     | Reuse / Maintainability     | SC-01 to SC-05, RD/RA sections, KR section                     | The spec extracts some shared pieces but leaves KPI card shells, summary tables, workflow cards, formula cards, and chart wrappers Revenue-specific.                                         | These are exactly the components most likely to drift and visually fork.                                          | Add shared primitives for KPI cards, inspector section cards, summary tables, workflow cards, formula cards, and chart wrappers.                                                                       |
| RPA-07 | High     | Fee Grid                    | FR-07, FR-08, FR-09, S8                                        | The fee grid still uses mixed rendering systems (`PlanningGrid` plus simple HTML tables) without a shared section-frame contract.                                                            | This is the main path for a second visual system inside Revenue.                                                  | Define shared section card/table primitives for all three fee-grid sections so headers, spacing, empty states, read-only states, and warning states look unified.                                      |
| RPA-08 | High     | Testing                     | QA-01 to QA-05, S10                                            | The test plan lacks required visual regression, DOM-invariant, and token-governance checks.                                                                                                  | All functional tests can pass while parity is still visibly wrong.                                                | Add parity-focused regression checks: visual snapshots, DOM shell invariants, and token/hardcoded-value audits.                                                                                        |
| RPA-09 | High     | Sequencing                  | S9, S5, S6, Parallel Execution Plan                            | Guide architecture is isolated as an independent later story even though it changes shared panel infrastructure.                                                                             | Parallel work may build against temporary behavior and cause refactor churn.                                      | Move the guide registry change earlier, ideally as a foundation task with `S2` or before broad panel-related work.                                                                                     |
| RPA-10 | High     | Interaction                 | GP-01 to GP-06, ID-04, ES-03                                   | The spec covers view-mode clearing, but not period-toggle clearing, filtered-row disappearance, or tab switching back to Details on selection.                                               | State can fall out of sync and the panel can show stale context.                                                  | Add explicit ACs for period changes, filter-to-empty behavior, and auto-switching the right panel to `details` when a row is selected.                                                                 |
| RPA-11 | Medium   | Acceptance Criteria         | DS-02, DS-03, KR-03                                            | Several ACs are class-string exact rather than primitive-driven.                                                                                                                             | Engineers can satisfy the literal class requirements while still duplicating the styling system.                  | Convert repeated exact-class ACs into “must use shared primitive/variant” ACs where appropriate.                                                                                                       |
| RPA-12 | Medium   | Accessibility               | Accessibility Requirements, FR-07                              | The Tuition section is grid-like, but Autres Frais and Abattement may end up with different keyboard and ARIA models.                                                                        | Users will experience inconsistent interaction patterns inside one settings surface.                              | Add fee-grid accessibility ACs that require a coherent keyboard model across all sections, even if rendered differently.                                                                               |
| RPA-13 | Medium   | UI Identity                 | RD-01 to RD-09, RA-01 to RA-14                                 | The inspector content is rich, but there is no shared section-shell contract.                                                                                                                | Revenue can satisfy content ACs while still looking structurally different from Enrollment.                       | Define shared inspector section primitives and a small config-driven composition pattern.                                                                                                              |
| RPA-14 | Medium   | Design System               | DS-06, DS-07, SC-02                                            | The spec adds band and nationality tokens but does not define a full tariff token strategy or shared semantic accent system.                                                                 | Revenue grouping colors can drift or become ad hoc as views expand.                                               | Add `TARIFF_STYLES` token mappings and a centralized semantic accent map in shared styling utilities.                                                                                                  |
| RPA-15 | Medium   | Story Plan                  | S6, S7                                                         | Story dependencies are slightly optimistic: inspector and KPI/status work also depend on token alignment and shared primitive extraction.                                                    | This increases rework risk during parallel delivery.                                                              | Tighten the dependency DAG so `S6` and `S7` explicitly depend on the relevant foundation work.                                                                                                         |
| RPA-16 | Medium   | Drift Prevention            | INV-7, S1, QA section                                          | Tokenization is requested, but no governance rule prevents future copy-paste drift.                                                                                                          | The page can launch aligned and drift six weeks later.                                                            | Add a drift-prevention AC requiring automated checks for forbidden hardcoded values and required shared primitive usage.                                                                               |
| RPA-17 | Medium   | Export / State              | EX-01 to EX-05                                                 | Export respects filters and view mode, but period context is not explicitly included in the semantics section.                                                                               | Exported data can be semantically ambiguous if AY1/AY2/FY handling changes.                                       | Add ACs for period-aware export content and filenames.                                                                                                                                                 |
| RPA-18 | Medium   | Read-only UX                | ES-07, FR section, SM section                                  | Read-only mode is acknowledged, but the spec does not fully define the visual affordance differences across editable-source, editable-fanout, summary-only, and disabled states.             | Mixed editability surfaces can become confusing and error-prone.                                                  | Add explicit affordance rules for cursor, focusability, helper text, and warning-state treatment across editability modes.                                                                             |
| RPA-19 | Low      | Delivery Scope              | Open Questions                                                 | The spec says there are no open questions, but there are still implementation-sensitive assumptions around period controls, `PlanningGrid` upgrades, and storage ownership.                  | Declaring closure too early can hide work from story planning.                                                    | Reopen those specific implementation questions or resolve them in-spec before decomposition.                                                                                                           |
| RPA-20 | Low      | Simplification              | SC section, S2                                                 | Shared component extraction is good, but band/nationality/tariff constants likely belong in a domain constants module rather than a styling-only module.                                     | Styling and domain ordering can become entangled.                                                                 | Separate domain ordering/labels from visual style maps, then compose them in shared UI utilities.                                                                                                      |

## 5. Hidden Risks / Drift Risks

- **PlanningGrid false confidence**: migrating Revenue to the shared grid may look like parity progress while silently failing the keyboard and ARIA contract.
- **Tokenized but unenforced styling**: without a hardcoded-value audit, the spec can be satisfied today and violated incrementally tomorrow.
- **KPI and inspector copy-paste drift**: shared buttons and menus help, but the highest-drift surfaces remain local unless shared card/table/chart primitives are extracted.
- **Guide architecture fixed too late**: if the registry change is not foundational, engineers will keep building against special-case panel behavior.
- **Fee grid becomes a second system**: mixed rendering models, mixed editability states, and dense finance tables can still feel like a bolt-on admin tool instead of part of the same product.
- **Frontend-only assumption hides contract risk**: if fee-schedule ownership does not map cleanly to current data contracts, implementation will discover the gap late.
- **Read-only semantics drift**: imported/viewer/locked/incomplete combinations are acknowledged, but without stronger affordance rules they can become inconsistent across sections.
- **Parity verified too late**: the current plan allows a lot of implementation before any structured “same product” checkpoint.
- **Period semantics drift**: because period behavior is not fully locked, exports, totals, inspector breakdowns, and selection state can diverge subtly.

## 6. What Is Missing from the Spec

- A period-toggle contract covering visibility, selection reset, export semantics, and inspector semantics.
- A required upgrade contract for `PlanningGrid` so the shared grid can actually meet Revenue’s read-only keyboard/accessibility parity needs.
- Shared primitive definitions for KPI cards, inspector section cards, summary tables, workflow status cards, formula cards, and chart wrappers.
- Shared fee-grid section chrome rules so Tuition / Autres Frais / Abattement do not become three different mini-design systems.
- Token governance rules: automated checks for hardcoded values and required shared primitive usage.
- DOM/visual parity validation requirements against Enrollment.
- Focus restoration rules after closing settings, clearing selection, or using the inspector back button.
- Explicit read-only affordance rules across editable-source / editable-fanout / summary-only / mixed-value-warning states.
- A stated parity checkpoint before late-stage integration.

## 7. Simplification / Refactor Opportunities

### Quick wins

- Extract a shared `KpiCard` primitive and make both Enrollment and Revenue ribbons compose it.
- Extract a shared `InspectorSectionCard` shell for all sidebar sections.
- Extract a shared `SummaryTable` component for band/nationality/category/tariff breakdowns.
- Normalize `EditableCell` imports to a single shared path.
- Centralize band, nationality, and tariff style maps plus labels/orderings.

### Medium refactors

- Introduce shared Recharts wrappers for bar, donut, and trend charts with tokenized defaults.
- Add a shared `ReadinessIndicator` primitive for status dots and counts.
- Add a shared `WorkflowStatusCard` and `FormulaCard` component used by both modules.
- Refactor `WorkspaceStatusStrip` into a strongly typed configuration-driven primitive instead of a generic section array with loose semantics.

### Strategic refactors

- Upgrade `PlanningGrid` into a true planning-surface primitive that supports both editable and read-only grid semantics consistently.
- Introduce a config-driven inspector composition model so modules define sections declaratively instead of building bespoke shells repeatedly.
- Create a small parity-governance test layer that compares Revenue and Enrollment shell invariants, shared primitives, and token usage.
- Define a shared planning-workspace visual grammar package: KPI cards, status strips, inspector sections, chart wrappers, and summary tables.

## 8. Recommended Spec Improvements

### Priority 1 — Must Fix Before Implementation

1. **Add an explicit `PlanningGrid` enhancement prerequisite**
    - **Where:** `INV-8`, `FG-01`, `FG-09`, `S5`, Accessibility Requirements
    - **Why:** Without shared-grid upgrades, the migration does not actually enforce keyboard or ARIA parity.

2. **Resolve the “frontend-only” contract around fee-grid ownership and writeback assumptions**
    - **Where:** `Fee Grid Tab vs Other Revenue Tab -- Ownership Split`, `FR-05`, `FR-07`, `S8`, `Data Model Changes`
    - **Why:** If storage semantics are wrong, the implementation plan is structurally misleading.

3. **Add period-toggle semantics**
    - **Where:** Toolbar Features, Grid Metric Semantics, Export Semantics, Interaction Patterns
    - **Why:** Revenue already has period-driven behavior; leaving it implicit invites state and export drift.

4. **Add shared primitive requirements for KPI cards, inspector sections, summary tables, and chart wrappers**
    - **Where:** Shared Components, KPI Ribbon, Revenue Inspector, S2, S6, S7
    - **Why:** These are the highest-drift surfaces and currently remain too local.

### Priority 2 — Should Fix Before Parallel Execution

1. **Move guide registry architecture earlier in the plan**
    - **Where:** `S9`, dependency DAG, parallel execution plan
    - **Why:** It is cross-cutting infrastructure, not optional late polish.

2. **Strengthen token governance**
    - **Where:** `DS-01`, `QA`, `S1`, `S10`
    - **Why:** Token usage needs automated enforcement, not just intent.

3. **Add a parity checkpoint after foundations**
    - **Where:** Stories / Parallel Execution Plan / QA
    - **Why:** Catch shell, toolbar, panel, and grid drift before inspector and fee-grid work compounds it.

4. **Define read-only affordance rules for every editability mode**
    - **Where:** Fee Schedule Writeback Rules, ES-07, FR section
    - **Why:** Mixed editability is a core UX risk in the settings dialog.

### Priority 3 — Nice to Strengthen Before Final Build

1. **Add spacing/icon/motion invariants**
    - **Where:** Parity Invariants, DS section
    - **Why:** These are subtle but important parts of “same product” identity.

2. **Separate domain constants from visual style maps**
    - **Where:** `SC-02`, `lib/band-styles.ts`
    - **Why:** It improves maintainability and avoids conflating labels/order with color treatment.

3. **Add shared content-style guidance for empty states**
    - **Where:** ES section
    - **Why:** Empty-state language strongly affects perceived product unity.

## 9. Proposed Additional Acceptance Criteria

### Design system

- [ ] DS-08: No hardcoded color, radius, font-size, or shadow values appear in any new Revenue code under `components/`, `lib/`, or shared wrappers; automated checks fail the build if violated.
- [ ] DS-09: Revenue and Enrollment KPI ribbons both use the same shared KPI card primitive and variant system.
- [ ] DS-10: Revenue charts use shared chart wrappers that enforce tokenized tooltip, axis, tick, and fill/stroke styling.

### Shared components

- [ ] SC-06: A shared `KpiCard` primitive exists and is used by both enrollment and revenue KPI ribbons.
- [ ] SC-07: A shared `InspectorSectionCard` primitive exists and is used by both enrollment and revenue inspector sections.
- [ ] SC-08: A shared `SummaryTable` primitive exists for sidebar breakdown tables and summary matrices.
- [ ] SC-09: A shared `ReadinessIndicator` primitive exists for status dots, readiness counts, and tab indicators.

### Interaction parity

- [ ] GP-07: Selecting a revenue row always switches the right panel to the `details` tab, even if the user was previously on `guide`, `activity`, or `audit`.
- [ ] GP-08: Changing the revenue period clears selection and closes the panel if the selected row’s underlying dataset changes.
- [ ] GP-09: When a filter change hides the currently selected row, selection is cleared and the panel returns to the default inspector view.

### Inspector parity

- [ ] RA-15: Revenue inspector default and active sections use the shared inspector section primitive; local one-off card shells are not allowed.
- [ ] RD-10: Revenue default inspector preserves the same section spacing, card elevation, and heading hierarchy as enrollment inspector sections.

### Fee grid parity

- [ ] FR-10: Tuition, Autres Frais, and Abattement sections all use the same section-frame styling, header treatment, spacing rhythm, and empty-state component.
- [ ] FR-11: All fee-grid editability modes (`editable-source`, `editable-fanout`, `summary-only`, mixed-value warning, read-only`) have distinct, documented, and visually consistent affordances.
- [ ] FR-12: Closing the settings dialog preserves or restores focus to the triggering control according to the last navigation path.

### Testing / QA

- [ ] QA-06: A parity-focused visual regression suite compares Revenue and Enrollment shell structure, toolbar ordering, KPI shells, status-strip shells, and right-panel shells.
- [ ] QA-07: Automated tests verify no forbidden hardcoded visual values exist in Revenue or shared planning components.
- [ ] QA-08: Snapshot or DOM-structure tests assert Revenue’s banner/toolbar/KPI/status/grid shell matches the Enrollment shell contract.
- [ ] QA-09: Shared primitive tests verify that Enrollment and Revenue use the same KPI card, status strip, guide section, and inspector section primitives.

### Accessibility

- [ ] A11Y-01: Revenue forecast grid uses `role="grid"` and supports keyboard navigation in read-only mode through the shared planning-grid primitive.
- [ ] A11Y-02: Focus returns to the previously focused trigger after closing the Revenue Settings dialog.
- [ ] A11Y-03: Using the inspector back button returns focus to the originating selected grid row.
- [ ] A11Y-04: All fee-grid sections expose a coherent keyboard model and ARIA labeling strategy, regardless of whether they use `PlanningGrid` or semantic tables.

### Drift prevention

- [ ] DP-01: Any future Revenue parity work that changes shared planning primitives must update Enrollment and Revenue parity tests in the same change.
- [ ] DP-02: Shared planning primitives used by both modules are documented in one source file or README and referenced by both workspaces.
- [ ] DP-03: A parity checkpoint review is required after foundation stories complete and before inspector/fee-grid feature work proceeds.

## 10. Final Recommendation

**Approve with targeted revisions**

Why:

- The spec is strong enough to justify the direction and much stronger than the current Revenue implementation.
- It now addresses several historically dangerous gaps: row identity, writeback intent, readiness normalization, export semantics, and guide architecture.
- But it still does not fully guarantee parity because the enforcement layer is incomplete. The biggest misses are shared-grid capability, shared primitive scope, token governance, and parity-focused validation.

If those targeted revisions are added, the spec becomes implementation-ready in a way that is genuinely resilient. Without them, the likely outcome is a substantially improved Revenue page that still feels subtly different from Enrollment in the exact places users notice most: keyboard behavior, sidebar composition, fee-grid cohesion, and long-term visual drift.
