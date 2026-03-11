# Implementation Plan: Premium "Smart Workspace" FP&A Experience (Enrollment)

**Date:** 2026-03-10
**Target Area:** Enrollment Planning Module (`apps/web/src/pages/planning/enrollment.tsx`)
**Goal:** Transform the enrollment workflow into a premium, predictive FP&A interface (Pigment/Anaplan style) featuring a continuous board, a reactive Decision-Support Inspector (Sidebar), and zero-cold-start predictive seeding, fully leveraging the existing backend calculation engine.

---

## 1. Architectural Philosophy

1. **Contextual Reactivity (The Inspector):** No more nested tabs. Clicking a row in the main workspace instantly morphs the right sidebar into a "Decision-Support Inspector" displaying 5-year trends, assumptions (capacity/retention), and overrides specific to that exact row.
2. **Zero Cold Start:** Relying on the existing `/historical` API, the frontend will automatically calculate and suggest baseline retention rates (e.g., 3-year moving average) rather than forcing users to start from scratch.
3. **Strict Visual System:** Zero hardcoded `#hex` colors. Complete reliance on CSS variables (`--primary`, `--muted-foreground`) to guarantee native Dark Mode support and premium contrast ratios.
4. **Backend Non-Interference:** The core Prisma database schema, calculation endpoints, and `cohort-engine.ts` are mathematically sound and will **not** be modified.

---

## 2. Phased Execution Steps

### Phase 1: UX Foundation & Selection State

_Objective: Build the underlying state management to support the interactive "click-to-inspect" board._

1. **Design System Audit:**
    - Scan `globals.css` and `tailwind.config.ts`.
    - Purge any stray hardcoded hex colors in charts or grids. Implement safe Radix UI color tokens.
2. **Abstract the Shell State:**
    - Refactor `RightPanelStore` (`apps/web/src/stores/right-panel-store.ts`) from a tabbed string array into a `WorkspaceSelectionStore`.
    - State should track `selectedEntity: { type: 'GRADE', id: string } | null`.
3. **Sidebar Re-architecture:**
    - Update `right-panel.tsx` to remove the tabbed header.
    - Implement smooth slide-in/fade-in transitions triggered by selection changes.

### Phase 2: Predictive "Zero Cold Start" Mapping

_Objective: Intercept empty states and pre-fill them using historical data, saving user time._

1. **Historical Data Integration:**
    - Consume the existing `useHistoricalEnrollment` query in the frontend.
    - Build a utility `calculateBaselineRetention(historicalData, grade)` that derives a 3-year or 5-year moving average for cohort progression.
2. **Auto-Fill Logic:**
    - When a user opens an empty Draft version (where retention rates are missing/default), prompt or automatically seed the grid with these predictive historical baselines.
3. **Save Validation:**
    - Once the user reviews the smart defaults, they save the state to the standard `PUT /api/v1/versions/:versionId/cohort-parameters` endpoint.

### Phase 3: The Board & Inspector UI (Frontend Heavy)

_Objective: Move complex data entry out of the main view and into the side inspector._

1. **The Continuous Board (`enrollment.tsx` & grids):**
    - Refactor `WorkspaceBlock` rows to become `cursor-pointer` interactive elements.
    - Visually highlight the currently selected row (e.g., subtle blue/primary background tint).
    - Display `Nationality Distribution` simply as a **Read-Only Result** in the main grid.
2. **The Decision-Support Inspector (`EnrollmentInspector.tsx` in Right Panel):**
    - **Default View (No selection):** Display the overall Step-by-Step guide/README and high-level KPIs.
    - **Active View (Grade Selected):**
        1. _Historical Trend Chart:_ Render a tailored Recharts line/bar chart displaying the 5-year actuals vs. current projection for the selected grade.
        2. _Assumptions Inputs:_ Expose `Max Class Size`, `Retention Rate %`, and `Lateral Entries` input fields.
        3. _Nationality Overrides:_ Expose the 3 nationality inputs (Français, Nationaux, Autres).
3. **Math & Formula Alignment:**
    - Update `cohort-progression-grid.tsx` preview text to use the exact backend logic: `Math.floor(prior_grade_AY1 * retention) + laterals`. Stop using `same_grade + Math.round`.

### Phase 4: Strict Gating & Integrity Enforcement

_Objective: Guarantee mathematical accuracy and respect version lifecycles._

1. **Atomic Nationality Validation:**
    - In the specific Grade Inspector, the "Save Overrides" button must cleanly disable and show an error if `% FR + % NAT + % AUT !== 100%`.
    - Prevent partial/broken payloads from ever hitting the API.
2. **Draft-Only Read-Only Mode:**
    - Hook into the version state context. If `status !== 'Draft'` or user role is `Viewer`, apply a deep read-only state.
    - Dim the UI inputs, lock the Sidebar fields, and render a prominent "Locked Version" banner at the top of the workspace.

---

## 3. Impacted File Matrix

| Component Area        | File Path                                                              | Nature of Change                                                   |
| :-------------------- | :--------------------------------------------------------------------- | :----------------------------------------------------------------- |
| **State**             | `apps/web/src/stores/right-panel-store.ts`                             | Refactor from 'tabs' to 'selected context'                         |
| **Layout Shell**      | `apps/web/src/components/shell/right-panel.tsx`                        | Remove tabs, add dynamic Inspector content                         |
| **Main Orchestrator** | `apps/web/src/pages/planning/enrollment.tsx`                           | Convert blocks to clickable selectors, enforce locking             |
| **Cohort Grid**       | `apps/web/src/components/enrollment/cohort-progression-grid.tsx`       | Update preview math to `Math.floor(Prior)`, add selection state    |
| **Nationality Grid**  | `apps/web/src/components/enrollment/nationality-distribution-grid.tsx` | Move input mechanisms cleanly into the Inspector, enforce 100%     |
| **Styling**           | `apps/web/src/index.css` or `globals.css`                              | Audit for hardcoded hex, enforce `--primary` / `--muted` variables |
| **Data Hook**         | `apps/web/src/hooks/use-enrollment.ts`                                 | Add predictive auto-fill wrapper using historical api              |

---

## 4. Verification & Acceptance Criteria (Review Checkpoints)

- [ ] **UI Selection:** Clicking any grade row (e.g., '3EME') strictly highlights the row and populates the Right Panel with that exact grade's data.
- [ ] **Charts:** The Right Panel chart cleanly displays a 5-year history for the chosen grade, conforming strictly to CSS variables (respects Dark Mode).
- [ ] **Calculation Integrity:** Modifying the Retention Rate in the Inspector updates the main board's Projection column using `Math.floor` (no floating decimals).
- [ ] **Atomic Safety:** Attempting to set Nationalities to 50% / 30% / 10% (90% total) disables the Save function visually.
- [ ] **Version Lock:** Viewing a 'Published' or 'Locked' budget version greys out all Inspector inputs globally.
- [ ] **Predictive Baseline:** Newly unconfigured grades offer an initial retention rate reflective of their historical average (where historical data exists).
