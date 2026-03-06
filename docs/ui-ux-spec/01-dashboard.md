# BudFin UI/UX Specification: Dashboard Module

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Parent:** [00-global-framework.md](./00-global-framework.md)
> **PRD References:** FR-DSH-001 through FR-DSH-005
> **API Endpoint:** `GET /api/v1/versions/:versionId/dashboard`

---

## 1. Overview

### 1.1 Purpose

The Dashboard module is the default landing page for all BudFin users. It provides a read-only executive overview of key performance indicators, enrollment trends, revenue breakdown, staffing distribution, and capacity alerts for the currently selected fiscal year and version. The dashboard aggregates data from all planning modules (Enrollment, Revenue, Staffing, P&L) into a single at-a-glance view.

No data entry or calculation is performed in this module. All values are pre-computed by the respective module calculation engines and served via a single aggregation endpoint.

### 1.2 User Stories

| ID        | Persona              | Story                                                                                                                                                  | Acceptance Criteria                                                                        |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| US-DSH-01 | Budget Owner         | As a Budget Owner, I want to see total revenue, enrollment, utilization, and discount KPIs so I can assess the version's financial health at a glance. | Four KPI cards render with correct values from the dashboard API (FR-DSH-001).             |
| US-DSH-02 | Budget Owner         | As a Budget Owner, I want to see P&L summary subtotals so I can quickly review profitability.                                                          | P&L summary section shows Revenue, Expenses, EBITDA, and Net Profit (FR-DSH-002).          |
| US-DSH-03 | School Administrator | As a School Administrator, I want to see enrollment trends over 5 years so I can identify growth or decline patterns.                                  | Line chart renders 5-year historical enrollment, filterable by band (FR-DSH-003).          |
| US-DSH-04 | Budget Analyst       | As a Budget Analyst, I want capacity alerts aggregated across grade levels so I can flag over-capacity situations.                                     | Capacity alerts list shows grades with OVER or NEAR_CAP status, color-coded (FR-DSH-004).  |
| US-DSH-05 | Any User             | As any user, I want to see variance indicators when comparison mode is active so I can compare versions.                                               | KPI cards and P&L summary show absolute and percentage variance, color-coded (FR-DSH-005). |

### 1.3 Personas

All six personas have View access to the Dashboard. No role-specific restrictions apply beyond the global RBAC rules (salary masking for Viewer role does not apply here as salary figures are not displayed individually).

| Persona                | Access Level |
| ---------------------- | ------------ |
| Budget Owner           | View         |
| Budget Analyst         | View         |
| HR/Payroll Coordinator | View         |
| School Administrator   | View         |
| System Administrator   | View         |
| External Auditor       | View         |

---

## 2. Layout

### 2.1 Workspace Structure

The Dashboard renders inside PlanningShell (context bar + docked right panel). It is the default landing page and responds to all context bar elements. See Global Framework Section 2.1 for shell details and Section 12.1 for the module template. The workspace area is divided into a scrollable single-column layout with distinct sections.

```
+--------+------------------------------------------------------------+
|        |  Module Toolbar (48px)                                     |
| Side-  +------------------------------------------------------------+
| bar    |                                                            |
|        |  KPI Cards Row (4 cards, equal width)          Section A   |
|        |                                                            |
|        +------------------------------------------------------------+
|        |  P&L Summary Strip                             Section B   |
|        +------------------------------------------------------------+
|        |                                                            |
|        |  +------------------------+  +------------------------+    |
|        |  | Enrollment Trend Chart |  | Revenue Breakdown      |    |
|        |  | (line chart)           |  | (stacked bar chart)    |    |
|        |  +------------------------+  +------------------------+    |
|        |                                                Section C   |
|        |  +------------------------+  +------------------------+    |
|        |  | Staffing Distribution  |  | Capacity Alerts        |    |
|        |  | (horizontal bar chart) |  | (alert list)           |    |
|        |  +------------------------+  +------------------------+    |
|        |                                                            |
|        +------------------------------------------------------------+
|        |  Comparison Variance Gauges (conditional)      Section D   |
+--------+------------------------------------------------------------+
```

Note: The context bar and right panel are rendered by PlanningShell at the shell level.

### 2.2 Section Grid

| Section             | Content                                    | Grid                           | Min Height    |
| ------------------- | ------------------------------------------ | ------------------------------ | ------------- |
| A — KPI Cards       | 4 KPI cards in a single row                | `grid-cols-4`, gap `--space-6` | 160px         |
| B — P&L Summary     | Horizontal strip with 4 subtotals          | `grid-cols-4`, gap `--space-4` | 80px          |
| C — Charts & Alerts | 2x2 grid of charts and alert panel         | `grid-cols-2`, gap `--space-6` | 360px per row |
| D — Variance Gauges | Budget vs Actual gauge cards (conditional) | `grid-cols-4`, gap `--space-6` | 200px         |

**Workspace padding:** `--space-8` on all sides. Vertical gap between sections: `--space-6`.

### 2.3 Module Toolbar

The Dashboard toolbar is simplified compared to other modules since no Calculate or Import actions exist.

```
+-----------------------------------------------------------------------+
| [Dashboard]                                      [Export] [Refresh]   |
+-----------------------------------------------------------------------+
```

| Element        | Component                                       | Notes                   |
| -------------- | ----------------------------------------------- | ----------------------- |
| Module title   | `<h1>` with `--text-xl` weight 600              | Fixed text: "Dashboard" |
| Export button  | `<Button variant="outline">` with download icon | Dropdown: xlsx, pdf     |
| Refresh button | `<Button variant="ghost">` with refresh icon    | Manual data refresh     |

No Calculate button. No Import button. No filter controls (filtering is done via context bar).

---

## 3. Components

### 3.1 KPI Card

A reusable card component used in Section A. Four instances, one per KPI (FR-DSH-001).

**Component:** `<KPICard>`

| Prop            | Type                                                                                   | Description                                     |
| --------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `title`         | `string`                                                                               | KPI label (e.g., "Total Revenue")               |
| `value`         | `string`                                                                               | Formatted primary value                         |
| `subtitle`      | `string \| null`                                                                       | Secondary info line (e.g., "SAR HT, Full Year") |
| `trend`         | `{ direction: 'up' \| 'down' \| 'flat', percentage: string } \| null`                  | Trend arrow with percentage change              |
| `comparison`    | `{ value: string, variance: string, variancePct: string, favorable: boolean } \| null` | Shown when comparison mode is active            |
| `icon`          | `LucideIcon`                                                                           | Card icon                                       |
| `visualization` | `ReactNode \| null`                                                                    | Optional inline chart (mini bar, gauge)         |

**Visual spec:**

| Property      | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Background    | `--workspace-bg`                                                                       |
| Border        | 1px solid `--workspace-border`                                                         |
| Border radius | `--radius-xl` (12px)                                                                   |
| Shadow        | `--shadow-sm`                                                                          |
| Padding       | `--space-4`                                                                            |
| Min height    | 140px                                                                                  |
| Title         | `--text-sm`, `--text-secondary`, weight 500, uppercase                                 |
| Value         | `--text-2xl`, `--text-primary`, `--font-mono`, weight 700                              |
| Subtitle      | `--text-xs`, `--text-muted`                                                            |
| Trend arrow   | Lucide `TrendingUp` or `TrendingDown`, 16px, colored per direction                     |
| Trend text    | `--text-xs`, `--color-success` (up) or `--color-error` (down) or `--text-muted` (flat) |

**Four KPI card instances:**

| #   | Title              | Value Source                                | Format                                                         | Icon         | Visualization                                           | Trend Source                                               |
| --- | ------------------ | ------------------------------------------- | -------------------------------------------------------------- | ------------ | ------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Total Revenue      | `total_revenue_ht`                          | Currency (SAR), `--font-mono`, 2 decimals, thousands separator | `DollarSign` | None                                                    | YoY percentage from `enrollment_trend` revenue correlation |
| 2   | Total Students     | `total_students_ay1` + `total_students_ay2` | Integer with thousands separator                               | `Users`      | Mini bar chart (AY1 vs AY2 side-by-side, 60px tall)     | YoY from `enrollment_trend`                                |
| 3   | School Utilization | `school_utilization_pct`                    | Percentage, 1 decimal                                          | `Building2`  | Circular gauge (SVG, 64px diameter, target line at 85%) | None (static target)                                       |
| 4   | Discount Rate      | `discount_rate_pct`                         | Percentage, 1 decimal                                          | `Percent`    | None                                                    | YoY comparison if historical data available                |

**Zero-division guard (School Utilization):** If `sections_needed * max_class_size` evaluates to zero (no enrollment data or all headcounts are zero), the utilization KPI card displays "N/A" in `--text-muted` instead of a percentage. The circular gauge renders as an empty ring (0% fill) with a centered "N/A" label. Tooltip: "Utilization unavailable -- no capacity data."

### 3.2 P&L Summary Strip

A horizontal row of 4 key P&L subtotals (FR-DSH-002).

**Component:** `<PLSummaryStrip>`

| Property      | Value                                        |
| ------------- | -------------------------------------------- |
| Background    | `--workspace-bg-subtle`                      |
| Border        | 1px solid `--workspace-border`               |
| Border radius | `--radius-md` (6px)                          |
| Padding       | `--space-3` vertical, `--space-4` horizontal |
| Layout        | `grid-cols-4`, gap `--space-4`               |

**Subtotal items:**

| #   | Label          | Value Source                                                                                      | Format         | Favorable Direction |
| --- | -------------- | ------------------------------------------------------------------------------------------------- | -------------- | ------------------- |
| 1   | Total Revenue  | `total_revenue_ht`                                                                                | Currency (SAR) | Positive = green    |
| 2   | Total Expenses | Derived: `total_revenue_ht` - `ebitda` (approximation until dedicated expense field is available) | Currency (SAR) | Negative = green    |
| 3   | EBITDA         | `ebitda`                                                                                          | Currency (SAR) | Positive = green    |
| 4   | Net Profit     | `net_profit`                                                                                      | Currency (SAR) | Positive = green    |

Each item renders as:

```
+------------------+
| Total Revenue    |  <-- --text-xs, --text-secondary, uppercase
| 42,350,000.00    |  <-- --text-lg, --font-mono, --text-primary
| SAR HT           |  <-- --text-xs, --text-muted
+------------------+
```

When comparison mode is active, each item also shows variance below the value (see Section 6.4).

### 3.3 Enrollment Trend Chart

Line chart showing 5-year historical enrollment (FR-DSH-003).

**Component:** `<EnrollmentTrendChart>` wrapping Recharts `<LineChart>`

| Property      | Value                                        |
| ------------- | -------------------------------------------- |
| Library       | Recharts v3                                  |
| Chart type    | `<LineChart>` with `<Line>` per band         |
| Width         | Fill container (responsive within grid cell) |
| Height        | 320px                                        |
| Background    | `--workspace-bg`                             |
| Border        | 1px solid `--workspace-border`               |
| Border radius | `--radius-xl`                                |
| Padding       | `--space-4`                                  |
| Title         | "Enrollment Trend" — `--text-lg`, weight 600 |

**Data source:** `GET /api/v1/enrollment/historical?years=5`

**Axes:**

| Axis   | Config                                                 |
| ------ | ------------------------------------------------------ |
| X-axis | Academic year labels (e.g., "2021-22", "2022-23")      |
| Y-axis | Student count, integer format with thousands separator |

**Lines (one per band, filterable):**

| Band        | Color                   | Dash               |
| ----------- | ----------------------- | ------------------ |
| Maternelle  | `#8B5CF6` (violet-500)  | Solid              |
| Elementaire | `#3B82F6` (blue-500)    | Solid              |
| College     | `#10B981` (emerald-500) | Solid              |
| Lycee       | `#F59E0B` (amber-500)   | Solid              |
| Total       | `#0F172A` (slate-900)   | Dashed, 2px weight |

**Filter:** Toggle group above the chart to show/hide individual bands. All bands visible by default.

| Property  | Value                                          |
| --------- | ---------------------------------------------- |
| Component | `<ToggleGroup type="multiple">` (shadcn/ui)    |
| Items     | Maternelle, Elementaire, College, Lycee, Total |
| Default   | All selected                                   |
| Position  | Right-aligned above chart area                 |

**Tooltip:** On hover, show vertical crosshair line and tooltip card with all visible bands' values for that year.

### 3.4 Revenue Breakdown Chart

Stacked bar chart showing revenue by IFRS category (FR-DSH-001 supplementary).

**Component:** `<RevenueBreakdownChart>` wrapping Recharts `<BarChart>`

| Property      | Value                                         |
| ------------- | --------------------------------------------- |
| Chart type    | `<BarChart>` with stacked `<Bar>` components  |
| Width         | Fill container                                |
| Height        | 320px                                         |
| Background    | `--workspace-bg`                              |
| Border        | 1px solid `--workspace-border`                |
| Border radius | `--radius-xl`                                 |
| Padding       | `--space-4`                                   |
| Title         | "Revenue Breakdown" — `--text-lg`, weight 600 |

**Stacked segments (IFRS categories):**

| Category          | Color                   |
| ----------------- | ----------------------- |
| Tuition Fees      | `#2563EB` (blue-600)    |
| Registration Fees | `#7C3AED` (violet-600)  |
| Transport Fees    | `#0891B2` (cyan-600)    |
| Activity Fees     | `#059669` (emerald-600) |
| Other Revenue     | `#94A3B8` (slate-400)   |

**X-axis:** Months (Sep through Aug, following academic year order) or "Full Year" single bar when period is Full Year.

**Tooltip:** Shows category breakdown with amounts and percentages of total.

### 3.5 Staffing Distribution Chart

Horizontal bar chart showing headcount or FTE by department (FR-DSH-002 supplementary).

**Component:** `<StaffingDistributionChart>` wrapping Recharts `<BarChart layout="vertical">`

| Property      | Value                                             |
| ------------- | ------------------------------------------------- |
| Chart type    | `<BarChart layout="vertical">`                    |
| Width         | Fill container                                    |
| Height        | 320px                                             |
| Background    | `--workspace-bg`                                  |
| Border        | 1px solid `--workspace-border`                    |
| Border radius | `--radius-xl`                                     |
| Padding       | `--space-4`                                       |
| Title         | "Staffing Distribution" — `--text-lg`, weight 600 |

**Bars:** One per department, sorted by headcount descending. Bar color: `--version-budget` (#2563EB). Label at end of each bar showing count.

**Y-axis:** Department names (truncated to 20 characters with ellipsis if needed).
**X-axis:** Headcount (integer).

### 3.6 Capacity Alerts Panel

Aggregated capacity utilization alerts (FR-DSH-004).

**Component:** `<CapacityAlertsPanel>`

| Property      | Value                                       |
| ------------- | ------------------------------------------- |
| Background    | `--workspace-bg`                            |
| Border        | 1px solid `--workspace-border`              |
| Border radius | `--radius-xl`                               |
| Padding       | `--space-4`                                 |
| Title         | "Capacity Alerts" — `--text-lg`, weight 600 |
| Max height    | 320px (scrollable if overflow)              |

**Alert list item:**

| Property      | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| Layout        | Flex row: status icon + grade label + utilization percentage + status badge |
| Height        | 40px per row                                                                |
| Border bottom | 1px solid `--workspace-border` (except last)                                |

**Status mapping:**

| API Status | Icon            | Icon Color        | Badge Text       | Badge Background       |
| ---------- | --------------- | ----------------- | ---------------- | ---------------------- |
| `OVER`     | `AlertTriangle` | `--color-error`   | "Over Capacity"  | `--color-error-bg`     |
| `NEAR_CAP` | `AlertCircle`   | `--color-warning` | "Near Capacity"  | `--color-warning-bg`   |
| `OK`       | `CheckCircle`   | `--color-success` | "OK"             | `--color-success-bg`   |
| `UNDER`    | `MinusCircle`   | `--text-muted`    | "Under-utilized" | `--workspace-bg-muted` |

**Sorting:** OVER items first, then NEAR_CAP, then UNDER, then OK. This surfaces actionable alerts at the top.

**Empty state:** If `capacity_alerts` is empty, show inline message: "No capacity data available for this version."

### 3.7 Budget vs Actual Variance Gauges (Conditional)

Shown only when comparison mode is active (FR-DSH-005). Renders in Section D.

**Component:** `<VarianceGaugeCard>`

| Property      | Value                          |
| ------------- | ------------------------------ |
| Background    | `--workspace-bg`               |
| Border        | 1px solid `--workspace-border` |
| Border radius | `--radius-xl`                  |
| Padding       | `--space-4`                    |
| Layout        | Centered, vertical stack       |

**Gauge:** Semi-circular SVG gauge (180-degree arc). Center shows variance percentage. Arc color: `--color-success` for favorable, `--color-error` for unfavorable.

Four gauge cards: Revenue Variance, Expense Variance, EBITDA Variance, Net Profit Variance.

---

## 4. Data Grid Spec

**N/A.** The Dashboard module does not contain any data grids. All data is presented through KPI cards, charts, summary strips, and alert lists. No inline editing, sorting, filtering, or virtualization applies.

---

## 5. Interaction Patterns

### 5.1 Chart Interactions

| Interaction                    | Behavior                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Hover on chart data point      | Show tooltip with value details. Vertical crosshair line on line charts. Highlight hovered bar segment on bar charts. |
| Click on enrollment trend line | No drill-down in v1. Future: navigate to Enrollment module filtered to that year/band.                                |
| Click on revenue bar segment   | No drill-down in v1. Future: navigate to Revenue module filtered to that IFRS category.                               |
| Click on capacity alert row    | No drill-down in v1. Future: navigate to Enrollment module filtered to that grade.                                    |

### 5.2 KPI Card Interactions

| Interaction          | Behavior                                                  |
| -------------------- | --------------------------------------------------------- |
| Hover on KPI card    | Subtle shadow increase (`--shadow-md`), cursor: `default` |
| Click on KPI card    | No action in v1. Future: navigate to the relevant module. |
| Hover on trend arrow | Tooltip: "vs previous academic year" with exact values    |

### 5.3 Toolbar Interactions

| Element        | Interaction | Behavior                                                                                                      |
| -------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| Export button  | Click       | Opens dropdown: "Export as Excel", "Export as PDF". Triggers async export job via `POST /api/v1/export/jobs`. |
| Refresh button | Click       | Invalidates TanStack Query cache for dashboard data. Shows brief spinner on button (1-2s).                    |

### 5.4 Band Filter on Enrollment Chart

| Interaction          | Behavior                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Click a band toggle  | Toggles visibility of that line on the chart. Deselected bands show as muted in the toggle group. |
| All bands deselected | Show empty chart with message: "Select at least one band to display."                             |

---

## 6. States

### 6.1 Loading State

On initial load or version change:

| Element                 | Loading Behavior                                                                 |
| ----------------------- | -------------------------------------------------------------------------------- |
| KPI cards               | 4 skeleton cards with shimmer animation, matching card dimensions (140px height) |
| P&L summary strip       | 4 skeleton blocks with shimmer                                                   |
| Charts                  | Skeleton rectangle with shimmer, matching chart dimensions (320px height)        |
| Capacity alerts         | 5 skeleton rows with shimmer                                                     |
| Duration before showing | 200ms delay (per `00-global-framework.md` Section 4.9)                           |

**Implementation:** Use shadcn/ui `<Skeleton>` component. Show skeleton layout that matches the exact dimensions of the final content to prevent layout shift.

### 6.2 Empty State

Shown when the dashboard API returns null or zero values for all fields (e.g., a newly created version with no data).

| Property    | Value                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout      | Centered in workspace                                                                                                                                   |
| Icon        | Lucide `LayoutDashboard`, 48px, `--text-muted`                                                                                                          |
| Heading     | "No dashboard data yet" — `--text-lg`, `--text-secondary`                                                                                               |
| Description | "This version has no calculated data. Enter data in the planning modules and run calculations to populate the dashboard." — `--text-sm`, `--text-muted` |
| Action      | None (dashboard is read-only; users must navigate to planning modules)                                                                                  |

### 6.3 Error State

Shown when the dashboard API returns an error (5xx or network failure).

| Property    | Value                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| Layout      | Centered in workspace                                                                  |
| Icon        | Lucide `AlertTriangle`, 48px, `--color-error`                                          |
| Heading     | "Failed to load dashboard" — `--text-lg`, `--text-secondary`                           |
| Description | "Something went wrong while loading the dashboard data." — `--text-sm`, `--text-muted` |
| Action      | `<Button variant="outline">` — "Retry" (re-fetches dashboard query)                    |

Individual chart errors are handled per-component: if the enrollment historical endpoint fails but the dashboard endpoint succeeds, only the enrollment chart shows an inline error state with a retry button, while the rest of the dashboard renders normally.

### 6.4 Comparison Mode Active

When the comparison toggle is ON in the context bar and a second version is selected:

**KPI cards gain a comparison row:**

```
+-------------------------------+
| TOTAL REVENUE                 |
| 42,350,000.00                 |  <-- Primary value
| SAR HT, Full Year             |
|-------------------------------|
| vs Budget FY2026              |  <-- --text-xs, --text-muted
| 40,100,000.00                 |  <-- --text-sm, --font-mono, --text-secondary
| +2,250,000.00  (+5.6%)        |  <-- --text-sm, --color-success (favorable)
+-------------------------------+
```

**Variance color rules:**

| KPI                | Favorable (green)    | Unfavorable (red)    |
| ------------------ | -------------------- | -------------------- |
| Total Revenue      | Primary > Comparison | Primary < Comparison |
| Total Students     | Primary > Comparison | Primary < Comparison |
| School Utilization | Primary > Comparison | Primary < Comparison |
| Discount Rate      | Primary < Comparison | Primary > Comparison |
| EBITDA             | Primary > Comparison | Primary < Comparison |
| Net Profit         | Primary > Comparison | Primary < Comparison |

**P&L summary strip** shows variance below each subtotal, same color-coding logic.

**Section D (Variance Gauges)** becomes visible with four gauge cards.

### 6.5 Stale Calculation State

When the `stale_modules` indicator in the context bar shows that upstream modules need recalculation:

| Element     | Behavior                                                                                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI values  | Render normally (show last calculated values)                                                                                                                              |
| Banner      | Amber info banner at top of workspace: "Dashboard data may be outdated. Recalculate [module names] for the latest figures." — `--color-warning-bg`, `--color-warning` text |
| Banner icon | Lucide `RefreshCw`, `--color-warning`                                                                                                                                      |

---

## 7. Calculation Workflow

**N/A.** The Dashboard module is a read-only aggregation view. It does not have a Calculate button and does not trigger any calculations. All KPI values are pre-computed by the respective module calculation engines (Revenue, Staffing, P&L) and served via the `GET /api/v1/versions/:versionId/dashboard` endpoint.

The dashboard relies on upstream modules being calculated. If upstream modules have pending changes, the stale calculation indicator (see Section 6.5) alerts the user.

---

## 8. Context Bar Integration

The Dashboard responds to all context bar selections. Every change triggers a data refresh.

| Context Bar Element                      | Dashboard Behavior                                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fiscal Year selector                     | Reloads version list. Resets to first available version. Re-fetches dashboard data.                                                                      |
| Version selector                         | Re-fetches `GET /api/v1/versions/:versionId/dashboard` with new `versionId`. All sections re-render.                                                     |
| Comparison toggle ON                     | Fetches dashboard data for comparison version. Enables comparison display on KPI cards, P&L summary, and shows Section D variance gauges (FR-DSH-005).   |
| Comparison toggle OFF                    | Hides comparison data from KPI cards and P&L summary. Hides Section D.                                                                                   |
| Period toggle (AY1/AY2/Summer/Full Year) | Filters displayed data to the selected academic period. KPI values reflect the selected period's aggregation. Charts filter to the corresponding months. |
| Scenario selector                        | Filters dashboard data to the selected scenario (Base, Optimistic, Pessimistic). Hidden when version type is "Actual".                                   |
| Save indicator                           | Read-only display. Dashboard does not trigger saves.                                                                                                     |
| Stale indicator                          | If `stale_modules` is non-empty, shows amber banner in dashboard (Section 6.5).                                                                          |

**Query key pattern (TanStack Query):**

```typescript
['dashboard', versionId, { period, scenario }][('enrollment-historical', { years: 5 })][
	// Comparison version (conditional):
	('dashboard', comparisonVersionId, { period, scenario })
];
```

**Stale time:** 30 seconds (matches global auto-save interval from `00-global-framework.md` Section 11.1).

---

## 9. RBAC Behavior

The Dashboard is the simplest module from an RBAC perspective. All roles have identical view-only access.

| UI Element           | Admin  | BudgetOwner | BudgetAnalyst | HRPayroll | SchoolAdmin | Auditor |
| -------------------- | ------ | ----------- | ------------- | --------- | ----------- | ------- |
| View KPI cards       | Yes    | Yes         | Yes           | Yes       | Yes         | Yes     |
| View P&L summary     | Yes    | Yes         | Yes           | Yes       | Yes         | Yes     |
| View charts          | Yes    | Yes         | Yes           | Yes       | Yes         | Yes     |
| View capacity alerts | Yes    | Yes         | Yes           | Yes       | Yes         | Yes     |
| Export dashboard     | Yes    | Yes         | Yes           | Yes       | Yes         | Yes     |
| Edit any data        | No     | No          | No            | No        | No          | No      |
| Calculate button     | Hidden | Hidden      | Hidden        | Hidden    | Hidden      | Hidden  |
| Import button        | Hidden | Hidden      | Hidden        | Hidden    | Hidden      | Hidden  |

**Locked/Archived version:** No behavioral change on the Dashboard since it is already read-only. The read-only banner from `00-global-framework.md` Section 4.10 is still displayed for consistency, but it has no functional impact on this module.

**Salary masking (Viewer role):** Does not apply to the Dashboard. Individual salary figures are not displayed. Staffing distribution shows only headcount/FTE totals by department.

---

## 10. API Endpoints

### 10.1 Primary Dashboard Endpoint

**`GET /api/v1/versions/:versionId/dashboard`**

| Property     | Value                                                                                   |
| ------------ | --------------------------------------------------------------------------------------- |
| Method       | GET                                                                                     |
| Auth         | All authenticated (JWT Bearer token)                                                    |
| Path param   | `versionId` — integer, required                                                         |
| Query params | `period` (ay1 \| ay2 \| summer \| full), `scenario` (base \| optimistic \| pessimistic) |
| Response     | 200 OK                                                                                  |

**Response schema:**

```json
{
	"total_revenue_ht": "string (decimal)",
	"total_students_ay1": "number",
	"total_students_ay2": "number",
	"school_utilization_pct": "string (percentage)",
	"discount_rate_pct": "string (percentage)",
	"ebitda": "string (decimal)",
	"net_profit": "string (decimal)",
	"capacity_alerts": [
		{
			"grade_level": "string",
			"status": "OVER | NEAR_CAP | OK | UNDER",
			"utilization_pct": "string (percentage)"
		}
	],
	"enrollment_trend": [
		{
			"academic_year": "string",
			"total_students": "number"
		}
	]
}
```

**Error responses:**

| Status | Code              | Condition                 | UI Behavior                                                 |
| ------ | ----------------- | ------------------------- | ----------------------------------------------------------- |
| 401    | UNAUTHORIZED      | Invalid or expired token  | Redirect to login                                           |
| 404    | VERSION_NOT_FOUND | Version ID does not exist | Toast: "Version not found" + navigate to Version Management |
| 500    | INTERNAL_ERROR    | Server error              | Error state (Section 6.3)                                   |

### 10.2 Enrollment Historical Endpoint

**`GET /api/v1/enrollment/historical`**

Used by the Enrollment Trend Chart (Section 3.3).

| Property     | Value                        |
| ------------ | ---------------------------- |
| Method       | GET                          |
| Auth         | All authenticated            |
| Query params | `years` (integer, default 5) |

**Response schema:**

```json
{
	"data": [
		{
			"academic_year": "string",
			"grade_level": "string",
			"student_count": "number"
		}
	],
	"cagr_by_band": {
		"Maternelle": "string (percentage)",
		"Elementaire": "string (percentage)",
		"College": "string (percentage)",
		"Lycee": "string (percentage)"
	},
	"moving_avg_by_band": {
		"Maternelle": "string",
		"Elementaire": "string",
		"College": "string",
		"Lycee": "string"
	}
}
```

**Frontend aggregation:** The chart component groups `data[]` by band. Grade-to-band mapping:

| Band        | Grade Levels           |
| ----------- | ---------------------- |
| Maternelle  | PS, MS, GS             |
| Elementaire | CP, CE1, CE2, CM1, CM2 |
| College     | 6e, 5e, 4e, 3e         |
| Lycee       | 2nde, 1ere, Terminale  |

The `Total` line sums all bands per academic year.

---

## 11. Accessibility

### 11.1 Landmark Structure

```html
<main aria-label="Dashboard">
	<section aria-label="Key Performance Indicators">
		<!-- KPI cards -->
	</section>
	<section aria-label="Profit and Loss Summary">
		<!-- P&L strip -->
	</section>
	<section aria-label="Charts and Alerts">
		<!-- Charts + alerts panel -->
	</section>
	<section aria-label="Variance Analysis" aria-hidden="true|false">
		<!-- Conditional: comparison gauges -->
	</section>
</main>
```

### 11.2 KPI Card Accessibility

| Requirement         | Implementation                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Card role           | `role="region"` with `aria-label` set to KPI title (e.g., "Total Revenue")                       |
| Value announcement  | `aria-live="polite"` on the value element so screen readers announce updates                     |
| Trend direction     | Trend arrow includes `aria-label`: "Trending up 5.6 percent" or "Trending down 2.1 percent"      |
| Comparison variance | Variance text includes `aria-label`: "Variance: positive 2,250,000 SAR, 5.6 percent favorable"   |
| Color independence  | Trend direction and variance favorability indicated by arrow direction and text, not color alone |

### 11.3 Chart Accessibility

Charts are visual components with limited screen reader support. Accessibility is provided through complementary data.

| Requirement          | Implementation                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Chart role           | `role="img"` with descriptive `aria-label` (e.g., "Enrollment trend line chart showing 5-year history")                    |
| Data table fallback  | Each chart has a visually hidden `<table>` (`sr-only` class) containing the same data in tabular format for screen readers |
| Chart title          | Rendered as a visible heading (`<h2>` or `<h3>`) associated with the chart via `aria-labelledby`                           |
| Keyboard interaction | Band filter toggle group is keyboard accessible (Tab to focus, Space/Enter to toggle)                                      |
| Focus indicator      | 2px solid `--color-info` outline on all interactive chart controls                                                         |

### 11.4 Capacity Alerts Accessibility

| Requirement         | Implementation                                                                         |
| ------------------- | -------------------------------------------------------------------------------------- |
| List role           | `role="list"` on the alert container                                                   |
| Item role           | `role="listitem"` on each alert row                                                    |
| Status announcement | Status icon has `aria-label`: "Over capacity", "Near capacity", "OK", "Under-utilized" |
| Color independence  | Status communicated via badge text label, not color alone                              |
| Utilization value   | Percentage includes `aria-label`: "85.3 percent utilization"                           |

### 11.5 Keyboard Navigation

| Key               | Context              | Action                                                                                                                      |
| ----------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Tab`             | Dashboard workspace  | Moves focus through: toolbar buttons, band filter toggles, chart data table links, alert list items, export/refresh buttons |
| `Space` / `Enter` | Band filter toggle   | Toggles band visibility                                                                                                     |
| `Space` / `Enter` | Export button        | Opens export dropdown                                                                                                       |
| `Escape`          | Export dropdown open | Closes dropdown                                                                                                             |
| `Arrow Up/Down`   | Capacity alerts list | Moves focus between alert items                                                                                             |

### 11.6 Live Regions

| Element                  | ARIA Attribute                 | Trigger                                        |
| ------------------------ | ------------------------------ | ---------------------------------------------- |
| KPI card values          | `aria-live="polite"`           | Version change, period change, scenario change |
| P&L summary values       | `aria-live="polite"`           | Version change                                 |
| Stale calculation banner | `role="alert"`                 | Appears when stale_modules is non-empty        |
| Error state              | `role="alert"`                 | API error occurs                               |
| Loading state            | `aria-busy="true"` on `<main>` | Data is being fetched                          |

---

## Appendix A: Design Token Quick Reference

Tokens referenced in this spec (from `00-global-framework.md`):

| Token                   | Value                        | Used In                             |
| ----------------------- | ---------------------------- | ----------------------------------- |
| `--workspace-bg`        | `#FFFFFF`                    | KPI cards, charts, alerts panel     |
| `--workspace-bg-subtle` | `#F8FAFC`                    | P&L summary strip background        |
| `--workspace-bg-muted`  | `#F1F5F9`                    | Hover states                        |
| `--workspace-border`    | `#E2E8F0`                    | Card borders, section dividers      |
| `--text-primary`        | `#0F172A`                    | KPI values, headings                |
| `--text-secondary`      | `#475569`                    | KPI titles, labels                  |
| `--text-muted`          | `#94A3B8`                    | Subtitles, empty state text         |
| `--font-mono`           | `JetBrains Mono, ...`        | All numeric values                  |
| `--text-2xl`            | 24px / 700                   | KPI card values                     |
| `--text-lg`             | 16px / 600                   | Section headings, chart titles      |
| `--text-sm`             | 13px / 400                   | Labels, comparison values           |
| `--text-xs`             | 11px / 400                   | Subtitles, metadata                 |
| `--radius-xl`           | 12px                         | KPI cards, chart containers         |
| `--shadow-sm`           | `0 1px 2px rgba(0,0,0,0.05)` | KPI cards                           |
| `--space-4`             | 16px                         | Card padding                        |
| `--space-6`             | 24px                         | Section gaps, grid gaps             |
| `--space-8`             | 32px                         | Workspace padding                   |
| `--color-success`       | `#16A34A`                    | Favorable variance                  |
| `--color-error`         | `#DC2626`                    | Unfavorable variance, over-capacity |
| `--color-warning`       | `#D97706`                    | Near-capacity, stale indicator      |
| `--color-warning-bg`    | `#FFFBEB`                    | Stale banner background             |
