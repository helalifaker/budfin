# Versions Page Refactoring Plan & Best-In-Class Comparative Analysis

## 1. Executive Summary

The current "Versions" management functionality in BudFin suffers from a fragmented UI/UX and a structural over-coupling between the "Time" dimension (Fiscal Year) and the "Scenario" dimension (Version). This document analyzes the existing implementation against the PRD and best-in-class FP&A tools (Pigment, Anaplan, SAP Analytics Cloud), identifies critical UX gaps (such as version drop-off on year change and implicit assignments during creation), and provides a clear, actionable roadmap for refactoring.

---

## 2. Functional Requirements (FR) Analysis

### 2.1 FR Referenced in PRD

Based on `docs/prd/BudFin_PRD_v2.1.md` Section 7:

- **FR-VER-001 [MUST]:** Create new version (name, type, optional base copy). Starts in Draft.
- **FR-VER-002 [MUST]:** Delete draft versions (Published/Locked/Archived immutable).
- **FR-VER-003 [MUST]:** Lifecycle transitions (Draft → Published → Locked → Archived) with audit logs.
- **FR-VER-004 [MUST]:** Version comparison with variance columns.
- **FR-VER-005 [MUST]:** Clone an existing version as the starting point.
- **FR-VER-006 [MUST]:** Version metadata display (creation date, author, status, etc.).

### 2.2 FR Implemented

- Create, Delete, Clone, and Lifecycle transitions are functionally present in the API (`versions.ts`) and basic UI components (`create-version-panel.tsx`, `versions.tsx`).
- Global Context Bar is implemented but rigidly linked, forcing `fiscalYear` to act as the master filter for `versions`.
- Data separation (Calculated vs. Imported) is managed at the API layer.

### 2.3 FR Missing or Functionally Broken (UX perspective)

- **Broken Context Continuity:** Changing the Fiscal Year in the Context Bar immediately dumps the selected Version to `null`. This breaks the fundamental FP&A user experience of browsing standard scenarios (like "Actuals" or "Working Budget") across different time horizons.
- **Implicit Variable Assignment:** When creating a version, the UI does not prompt the user for the Fiscal Year. It silently inherits the year from the Context Bar, leading to user confusion ("when I create a version, there is no year allocated to it").
- **Lack of Native "Actuals" Unification:** Actuals are treated as discrete versions per year, requiring continuous mental context switching versus having a smooth rolling Actuals baseline.

### 2.4 FR in Best-in-Class FP&A Tools (Not Implemented Here)

- **Independent Dimensions:** In Pigment/Anaplan, "Time" (Year/Month) and "Scenario/Version" (Actuals, Budget V1) are strictly orthogonal. Changing the Time dimension simply moves the viewport over the data; it does not clear the Scenario dimension.
- **Global Standard Categories:** "Actuals" is typically a global system category rather than a user-created 'Version'. It spans all years.
- **Spillage / Rolling Forecasts:** Best-in-class tools allow "Version = Forecast 9+3", automatically displaying locked Actuals for the first 9 months and Budget/Forecast for the remaining 3 without requiring the user to stitch them together manually.

---

## 3. How Current Versions Work vs. Best in Class

| Feature               | BudFin (Current AS IS)                                                   | Best in Class (Pigment, SAC, Anaplan)                        |
| :-------------------- | :----------------------------------------------------------------------- | :----------------------------------------------------------- |
| **Version Scope**     | Bound strictly to a single `fiscalYear` at DB level.                     | Global dimension spanning all time periods.                  |
| **Context Switching** | Changing Year resets the Version to `null` (`use-workspace-context.ts`). | Changing Year retains Version; shows empty cells if no data. |
| **Creation UX**       | Inherits Year implicitly from background Global Context.                 | Explicitly defines Scope/Year upon creation.                 |
| **Actuals Tracking**  | Actuals are separate `BudgetVersion` objects per year.                   | Actuals is a continuous global dataset baseline.             |

---

## 4. UI/UX Mockups (ASCII)

### 4.1 AS-IS: The Broken Experience (Current State)

```text
[ Context Bar ]  FY: [ 2025 ▼]   Version: [ Budget V1 ▼]  Compare: [ None ▼]
--------------------------------------------------------------------------------
(If user clicks FY and changes to 2024 -> Version dropdown violently clears itself to empty)

[ Versions Management Page ]
+-----------------------------------------------------+
| [ + Create Version ]  (Modal opens without FY input)|
|                                                     |
| Name            Type      Status      Modify Count  |
| Budget V1       Budget    Draft       12            |
| Actuals Q1      Actual    Locked      0             |
+-----------------------------------------------------+
```

_Issue: The user is looking at FY 2025 versions but isn't explicitly reminded of it in the table. Creating a version silently makes it a '2025' version._

### 4.2 TO-BE: Functional & Decoupled Layout

```text
[ Context Bar (Redesigned) ]
Time Scope: [ FY 2025 ▼]   Active Scenario/Version: [ Budget V1 ▼]  [ Compare... ]
* Note: If user changes Time Scope to 2024, "Budget V1" remains selected. If Budget V1 doesn't exist in 2024, it shows "[ Budget V1 (No Data in 2024) ▼]" instead of clearing data.*

[ Versions Management Admin Page ]
Filter by Year: [ All Years ▼ ]   Search: [         ]    [ + Create New Version ]

+--------------------------------------------------------------------------------+
| Fiscal Year | Version Name | Type    | Status    | Data Source | Actions       |
+-------------|--------------|---------|-----------|-------------|---------------+
| 2025        | Budget V1    | Budget  | Draft     | Calculated  | [View] [...]  |
| 2025        | Actuals      | Actual  | Locked    | Imported    | [View] [...]  |
| 2024        | Final Budget | Budget  | Published | Calculated  | [View] [...]  |
| 2024        | Actuals      | Actual  | Locked    | Imported    | [View] [...]  |
+--------------------------------------------------------------------------------+

[ + Create New Version Modal ]
-----------------------------------------
| Target Fiscal Year: [ 2025 ▼ ]        | <-- EXPLICIT SELECTION
| Version Name:       [            ]    |
| Version Type:       (o) Budget        |
|                     ( ) Forecast      |
|                                       |
| Base Data (Clone):  [ None ▼ ]        |
|                                       |
|                           [ Create ]  |
-----------------------------------------
```

---

## 5. Detailed Recommendations (FR & NFR)

### 5.1 Functional Requirements (To Be Adjusted)

1.  **Explicit Year Assignment:** The "Create Version" form MUST explicitly include a dropdown for `fiscalYear`. It can default to the currently selected year, but the user must see and be able to change it.
2.  **Context Continuity:** The `setFiscalYear` action in `use-workspace-context.ts` MUST NOT set the version to `null`. It must retain the currently selected version ID.
3.  **Cross-Year Version Matching (Optional but recommended):** If a user is on `Budget V1` (FY25) and changes the year to `2024`, the system should attempt to find a version named `Budget V1` in 2024 and auto-stitch the context. If none exists, retain the name in UI but render the data as blank.
4.  **Global Table View:** The Versions Management table must show the `Fiscal Year` as a primary column and allow grouping/sorting by it, so users understand they are looking at a multi-year repository.

### 5.2 Non-Functional Requirements

1.  **Avoid Overengineering:** Do not alter the Prisma schema for `BudgetVersion` to detach `fiscalYear`. This would require migrating millions of rows of calculation data (`MonthlyBudgetSummary`, etc.) to include `year`. Instead, solve the dimension decoupling at the **UX/Frontend state layer**.
2.  **Robust Invalidation:** The React Query cache invalidation must be smart enough to refetch correctly when the Context Bar configuration updates, without dropping the user's scenario.

---

## 6. Impact on Other Pages Dependencies

| Component/Page                           | Impact Level | Description of Impact                                                                                                                                                                                                                 |
| :--------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`use-workspace-context.ts`**           | High         | Removing the rigid `setVersion(null)` hard-reset when `fy` changes. Requires modifying how the store handles invalid/out-of-year version IDs.                                                                                         |
| **`context-bar.tsx`**                    | High         | Will need to cleanly display out-of-scope versions (e.g., if a user selects a 2025 version but browses to 2024, show an indicator rather than crashing or returning an empty screen).                                                 |
| **Data Viewing Pages (P&L, Enrollment)** | Medium       | If the user forces a combination of (FY=24, Version=ID belonging to FY25), API calls will return empty arrays instead of failing. The UI must handle empty states gracefully indicating "No data for this time/version intersection". |
| **`create-version-panel.tsx`**           | Medium       | Adding exactly one new explicit Zod field mapping (`fiscalYear`) visually.                                                                                                                                                            |
| **`versions.tsx` (Mgmt Page)**           | Medium       | Updating TanStack columns to include `fiscalYear`. Ensure API fetch doesn't hard-require an FY if we want to show "All Years", or default to fetching all and grouping them.                                                          |

---

## 7. Actionable Implementation Plan (Clear Path)

### Phase 1: Context Bar & State Stabilization (Frontend)

- **Target:** `apps/web/src/hooks/use-workspace-context.ts`
- **Action:** Remove `setVersion(null)` and `setComparisonVersion(null)` from `handleFiscalYearChange`.
- **Action:** In `context-bar.tsx`, if the current `versionId` belongs to a different `fiscalYear` than the one selected (requires fetching version metadata globally or matching against current selection), display a visual warning: _"Version data exists in a different Fiscal Year"_, rather than destroying the selection.

### Phase 2: Create Version Explicit UX (Frontend)

- **Target:** `apps/web/src/components/versions/create-version-panel.tsx`
- **Action:** Add a `<Select>` input for `fiscalYear`.
- **Action:** Pre-fill this field with `workspaceContext.fiscalYear`, but make it visible and mutable by the user.

### Phase 3: Versions Directory Table Upgrade (API & Frontend)

- **Target API:** `apps/api/src/routes/versions.ts` -> `listQuerySchema`
- **Action:** Make `fiscalYear` **optional** in the `fastify.get` list route. If omitted, return versions across all years (ordered by year descending, then by creation date).
- **Target UI:** `apps/web/src/pages/versions/versions.tsx`
- **Action:** Update `useVersions` hook to allow fetching without a `fiscalYear` param.
- **Action:** Add the "Fiscal Year" column to the `columnHelper` to render clearly in the data table.
- **Action:** Add a local table filter (dropdown) to allow the user to easily filter the table by Year.

### Phase 4: Better "Actuals" Handling (UX Refinement)

- **Action:** In the Context Bar, visually separate "Planning Versions" (Budgets/Forecasts) from "Actuals". Even though both are technically `BudgetVersion` models, group them under an `<optgroup>` in the Select. This mimics the standard FP&A paradigm where Actuals are distinct base categories.

---

_End of Document_
