# Enrollment Workspace Refactoring Plan & Best-In-Class Comparative Analysis

## 1. Executive Summary

The current "Enrollment & Capacity" page in BudFin suffers from domain entanglement (specifically, overlapping with Revenue by managing Tariff inputs) and a basic "tabbed" UI that lacks the density and workflow of professional FP&A software. This document analyzes the existing implementation against the provided Excel target (`01_EFIR_Revenue_FY2026_v3.xlsx` - Sheets: `ENROLLMENT_HEADCOUNT`, `CLASS_CAPACITY`) and proposes a complete refactor.

The goal is to elevate the UI to a seamless, frictionless "Workspace" experience that strictly handles Headcount and Class Capacity, moving all Tariff/Revenue logic to the Revenue module. Importantly, this redesign explicitly respects the existing visual shell (Main Left Nav, Top Context Bar, Right Context Panel) and adopts a "Continuous Planning Board" approach rather than introducing conflicting UI paradigms like nested sidebars.

---

## 2. Functional Requirements (FR) Analysis

### 2.1 FR Referenced in PRD & Excel Baseline

- **FR-ENR-005 [MUST]:** Two-stage enrollment entry: Stage 1 (total headcount by grade), Stage 2 (breakdown by nationality). _(Note: Previously included Tariff, which is now explicitly moved to Revenue per stakeholder directive)._
- **FR-ENR-008 [MUST]:** Automatic delta calculation vs. prior year with visual flagging.
- **FR-ENR-010 [COULD/MUST]:** Cohort progression modeling (AY1 → AY2 retention and lateral entry logic shown in `ENROLLMENT_HEADCOUNT` Section B).
- **FR-CAP-001 to FR-CAP-005 [MUST]:** Capacity Planning (Sections needed, 70/85/100% thresholds, Utilization %, and possible recruitments).

### 2.2 FR Implemented (AS-IS)

- Enters headcount via simple grids (`ByGradeGrid`, `ByNationalityGrid`).
- Inappropriately handles Tariff distributions (`ByTariffGrid`), forcing financial/revenue logic into the enrollment planner's scope.
- A basic `CalculateButton` triggers backend computations.
- Tabbed interface hides data context (e.g., viewing historical trends obscures capacity data).

### 2.3 FR Missing or Functionally Broken (UX perspective)

- **Domain Bleed:** Tariff/Pricing structures are incorrectly nested in the Enrollment page, disrupting the mental model of a pure "Demographics & Capacity" planner.
- **Lack of Workspace Density:** The current implementation uses full-page tabs. FP&A users need to see Headcount changes and the _immediate_ impact on Class Capacity (Sections/Utilization) side-by-side or top-to-bottom.
- **Missing "AY1 → AY2" Cohort UX:** The Excel explicitly models moving from AY1 to AY2 via "Retention Rate" and "Lateral Entry". The current UI does not make this progression intuitive, treating AY1 and AY2 as separate toggles.
- **Hidden KPIs:** Total Enrollment, Overall Capacity Utilization, and Risk Alerts are not surfaced globally at the top of the view.

### 2.4 Best-in-Class FP&A Principles (Pigment / Anaplan)

- **Continuous Boards:** Instead of hiding data behind tabs, high-performance FP&A grids are stacked vertically on a single rolling canvas (Board). Drivers (Headcount) are placed above Outputs (Capacity/Utilization).
- **Domain Strictness:** "Operational" planning (Students, Classes) is strictly separate from "Financial" planning (Tariffs, Revenue).
- **Excel-fidelity Grids:** Yellow background for editable assumptions, instant visual calculate (without having to click 'Save' and wait for a full page refresh).

---

## 3. How Current Enrollment Works vs. Best in Class

| Feature             | BudFin (Current AS IS)                                   | Best in Class & Excel Target                                       |
| :------------------ | :------------------------------------------------------- | :----------------------------------------------------------------- |
| **Tariff Logic**    | Handled in Enrollment (`ByTariffGrid`).                  | Strictly in Revenue. Enrollment is pure demographics.              |
| **Page Layout**     | Flat Tabs (By Grade, By Nationality, By Tariff).         | Seamless Stacked Board (Headcount Drivers + Capacity Impact).      |
| **AY1 vs AY2**      | Managed via a global context toggle overriding the view. | Modeled side-by-side (Cohort progression: AY1 \* Retention = AY2). |
| **Capacity Alerts** | Hidden behind calculation results in the grid.           | Surfaced as top-level KPIs (e.g., "3 Grades Over Capacity").       |

---

## 4. UI/UX Mockups (ASCII)

### 4.1 TO-BE: Integrated Unified Workspace Board

_Note: This layout strictly respects the existing App Shell (Left Nav, Top Context, Right Panel)._

```text
====================================================================================================
[ MAIN LEFT ]    [ GLOBAL CONTEXT BAR: FY2026 | Budget V1 | Period... ]          [ RIGHT PANEL ]
[    NAV    ]    ======================================================          [ (Audit,     ]
|           |    [ KPI: Total AY1 | Total AY2 | Util % | 🔴 2 Alerts  ]          |  Prop.. )   |
| Dashboard |    ------------------------------------------------------          |             |
| Planning  |    [ Module Switch: (o) Cohort Headcount  ( ) Nationality ]        |             |
|   Enroll  |                                                                    |             |
|   Revenue |    +--- BLOCK A: HEADCOUNT & COHORT PROGRESSION (AY1 -> AY2) ----+ |             |
|   Staff   |    | Grade | Hist N-1 | AY1 Entry | Ret. % | Lat. Entry | Total  | |             |
| Master D. |    |-------+----------+-----------+--------+------------+--------| |             |
| Admin     |    | PS    | 65       | [   65  ] |   --   |    --      |   65   | |             |
|           |    | MS    | 71       | [   77  ] | [ 97%] | [   16   ] |   77   | |             |
|           |    +-------------------------------------------------------------+ |             |
|           |                                                                    |             |
|           |    +--- BLOCK B: CAPACITY PLANNING (Live Preview) ---------------+ |             |
|           |    | Grade | AY2 Total | Max Size | Sections | Util. % | Alert   | |             |
|           |    |-------+-----------+----------+----------+---------+---------| |             |
|           |    | PS    | 65        | [ 24 ]   |    3     |   90%   | 🟢 OK   | |             |
|           |    | CP    | 126       | [ 26 ]   |    5     |   97%   | 🔴 CAP  | |             |
|           |    +-------------------------------------------------------------+ |             |
====================================================================================================
```

---

## 5. Detailed Recommendations (FR & NFR)

### 5.1 Restructuring Enrollment Domain

1.  **Remove `ByTariffGrid`:** Delete its references from `apps/web/src/pages/planning/enrollment.tsx`. Move tariff breakdown entirely to `revenue.tsx`.
2.  **Continuous Cohort Grid:** Create a unified editable grid that mirrors `ENROLLMENT_HEADCOUNT` Sector B. The grid should clearly display the flow: `AY1 Headcount → Retention % → Retained + Lateral Entry = AY2 Headcount`.
3.  **Stacked Capacity Output:** Place the Capacity calculations directly on the same canvas (below the Headcount input). Entering an extra student in Block A should immediately flag if `Utilization > 100%` in Block B.

### 5.2 UI/UX Engineering (The "Continuous Board" Layout)

1.  **Sticky KPI Header Ribbon:** Introduce a top KPI ribbon showing global metrics (`Total Enrollment`, `Average Capacity Utilization`, `Critical Alerts`). This remains sticky below the main Context Bar as the user scrolls.
2.  **Spreadsheet Fluidity:** Ensure editable cells are indicated with a distinct background (e.g., standard FP&A yellow `#FFFCE0` or blue outline). Support seamless tab/arrow navigation across inputs.
3.  **Auto-Calculation/Debounce:** Replace the manual `[Calculate]` button with debounced state save. When a user alters "Lateral Entry" for MS, the "AY2 Total" and "Capacity Utilization" should update instantly optimistically, while saving to backend in the background.
