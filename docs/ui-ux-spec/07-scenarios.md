# BudFin UI/UX Specification: Scenarios

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Module Route:** `/planning/scenarios`
> **Parent:** [00-global-framework.md](./00-global-framework.md)
> **PRD References:** FR-SCN-001 through FR-SCN-007

---

## 1. Module Purpose

The Scenarios module provides a configurable parameter workspace where users model Base, Optimistic, and Pessimistic financial outcomes and view side-by-side impact comparisons. Parameters adjust enrollment projections, retention, attrition, fee collection, and scholarship allocation. Changes propagate through the calculation engine to produce adjusted enrollment, revenue, and net revenue metrics per scenario.

**Persona access:**

| Persona | Capabilities |
| --- | --- |
| Budget Analyst (Editor) | Create, edit, save scenario parameters; trigger recalculation |
| Budget Owner | Review parameters and comparison output; cannot edit in Locked versions |
| School Admin (Viewer) | View comparison output only; all controls read-only |

---

## 2. Route & URL State

```
/planning/scenarios?fy=2026&version=42&period=full&scenario=base
```

| Param | Source | Notes |
| --- | --- | --- |
| `fy` | Context bar fiscal year selector | Inherited from shell |
| `version` | Context bar version selector | Inherited from shell |
| `period` | Context bar academic period toggle | Filters enrollment/revenue data |
| `scenario` | Context bar scenario selector | Highlights the active scenario tab in left panel |

The context bar scenario selector and the left-panel scenario tabs are synchronized. Selecting a scenario in either location updates both.

---

## 3. Layout Structure

This module renders inside PlanningShell (Global Framework Section 12.1). The context bar is managed by the shell.

**Right panel mode:** In the Scenarios module, the PlanningShell right panel uses **overlay mode** (z-index:30) instead of the default docked mode. This is because the Scenarios module already uses a 40/60 split panel layout that fills the workspace. The right panel auto-switches to overlay mode when navigating to this module and reverts to docked mode when navigating away.

The Scenarios module uses a split-panel layout instead of a full-width data grid.

```
+-----------------------------------------------------------------------+
|  [Module Toolbar]                                                      |
+----------------------------+------------------------------------------+
|                            |                                          |
|  Left Panel (~40%)         |  Right Panel (~60%)                      |
|  Scenario Parameters       |  Impact Preview                         |
|                            |                                          |
|  [Base] [Optimistic]       |  Key Metrics Table                      |
|  [Pessimistic]             |  Delta vs Base Table                    |
|                            |  Net Revenue Chart                      |
|  6x Parameter Sliders      |                                          |
|                            |                                          |
|  [Reset] [Save]            |                                          |
+----------------------------+------------------------------------------+
```

### 3.1 Split Panel Container

| Property | Value |
| --- | --- |
| Layout | Flexbox row, `gap: 0` |
| Left panel width | `40%`, `min-width: 420px` |
| Right panel width | `60%`, `flex: 1` |
| Divider | 1px solid `--workspace-border`, draggable resize handle |
| Divider drag range | Left panel 30%-50% of workspace width |
| Background | Both panels `--workspace-bg` |

The divider is a vertical 1px line with a 4px invisible hit area. On hover, the cursor changes to `col-resize` and the divider line changes to `--workspace-border-strong`.

---

## 4. Module Toolbar

Follows the standard module toolbar from 00-global-framework.md Section 4.5.

```
+-----------------------------------------------------------------------+
| Scenarios          [Calculate] [Export v] [More ...]                   |
+-----------------------------------------------------------------------+
```

| Element | Specification |
| --- | --- |
| Module title | "Scenarios", `--text-xl`, weight 600 |
| Calculate button | Standard Calculate button (see framework Section 4.5). Triggers scenario recalculation for all three scenarios |
| Export button | Dropdown: XLSX, PDF, CSV. Exports the comparison tables |
| More menu | Not applicable for this module (omit or show empty) |

**RBAC modifications:**

| Role | Calculate | Export | Parameter editing |
| --- | --- | --- | --- |
| Admin | Visible | Visible | Enabled |
| BudgetOwner | Visible | Visible | Enabled |
| Editor | Visible | Visible | Enabled |
| Viewer | Hidden | Visible | Disabled (all read-only) |

When the active version is Locked or Archived, the Calculate button is disabled and parameters are read-only regardless of role. The read-only banner from framework Section 4.10 is displayed.

---

## 5. Left Panel: Scenario Parameters

### 5.1 Panel Header

| Property | Value |
| --- | --- |
| Text | "Scenario Parameters" |
| Font | `--text-lg`, weight 600, `--text-primary` |
| Padding | `--space-5` horizontal, `--space-4` vertical |
| Border-bottom | 1px solid `--workspace-border` |

### 5.2 Scenario Tabs

Three horizontal tabs below the panel header select which scenario's parameters are displayed.

| Property | Value |
| --- | --- |
| Component | shadcn/ui `<Tabs>` with `<TabsList>` + `<TabsTrigger>` |
| Layout | Horizontal, full width of left panel |
| Tab labels | "Base", "Optimistic", "Pessimistic" |
| Default active | Matches context bar scenario selector |
| Margin | `--space-4` horizontal, `--space-3` vertical |

**Tab trigger states:**

| State | Background | Text | Border |
| --- | --- | --- | --- |
| Default | transparent | `--text-secondary` | none |
| Hover | `--workspace-bg-muted` | `--text-primary` | none |
| Active | `--workspace-bg` | `--text-primary` | 2px solid `--color-info` bottom |

**Tab color indicators:**

Each tab label is prefixed with a colored dot to distinguish scenarios at a glance:

| Scenario | Dot color | Token |
| --- | --- | --- |
| Base | `#2563EB` (blue-600) | `--version-budget` |
| Optimistic | `#16A34A` (green-600) | `--color-success` |
| Pessimistic | `#DC2626` (red-600) | `--color-error` |

### 5.3 Parameter Controls

Below the tabs, six parameter controls are displayed in a vertical stack for the active scenario. Each control is a labeled row with a slider and a numeric input.

**Parameter control layout (per parameter):**

```
+-------------------------------------------------------+
| Parameter Label                          [?] tooltip   |
| [min] =====[====o=======]======== [max]   [ 1.00  ]   |
+-------------------------------------------------------+
```

| Property | Value |
| --- | --- |
| Container | Vertical stack, `gap: --space-4`, `padding: --space-4` |
| Label | `--text-sm`, weight 500, `--text-primary` |
| Tooltip icon | Lucide `Info` (14px), `--text-muted`, hover shows description |
| Slider | shadcn/ui `<Slider>` |
| Slider track height | 6px, `--workspace-border` background |
| Slider fill | Scenario dot color (Base: blue, Optimistic: green, Pessimistic: red) |
| Slider thumb | 16px circle, white fill, 1px `--workspace-border-strong` border, `--shadow-sm` |
| Min/max labels | `--text-xs`, `--text-muted`, positioned at slider endpoints |
| Numeric input | `<Input type="number">` (shadcn/ui), width 80px, right-aligned, `--font-mono` |
| Input border | 1px solid `--workspace-border`, on focus `--cell-editable-focus` |

**Parameter definitions (FR-SCN-002):**

| Parameter | Key | Type | Base Default | Optimistic Default | Pessimistic Default | Slider Min | Slider Max | Step | Display Format | Tooltip |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| New Enrollment Factor | `new_enrollment_factor` | multiplier | 1.0 | 1.1 | 0.9 | 0.5 | 1.5 | 0.01 | `x.xx` | Multiplier applied to new student enrollment projections. 1.0 = no change. |
| Retention Adjustment | `retention_adjustment` | percentage | +0% | +3% | -5% | -10% | +10% | 0.1% | `+x.x%` / `-x.x%` | Percentage adjustment to student retention rates. |
| Attrition Rate | `attrition_rate` | percentage | 2% | 1% | 5% | 0% | 10% | 0.1% | `x.x%` | Expected student departure rate per academic period. |
| Fee Collection Rate | `fee_collection_rate` | percentage | 95% | 98% | 90% | 80% | 100% | 0.1% | `x.x%` | Percentage of billed fees expected to be collected. |
| Scholarship Allocation | `scholarship_allocation` | percentage | 2% | 1% | 3% | 0% | 5% | 0.1% | `x.x%` | Percentage of gross revenue allocated to scholarships. |
| ORS Hours | `ors_hours` | hours | 18 | 18 | 18 | 15 | 21 | 0.5 | `x.x h` | Weekly teaching service obligation (Obligation Reglementaire de Service). Controls FTE requirement calculation in the DHG engine. Lower ORS = more FTE needed. |

**Slider-input synchronization:**
- Moving the slider updates the numeric input in real-time.
- Typing in the numeric input updates the slider thumb position on blur or Enter.
- Values are clamped to [min, max]. If the user types a value outside the range, it is clamped on blur and a brief amber highlight (`--color-warning-bg`) flashes on the input for 1 second.
- Both controls trigger a debounced (300ms) preview update on the right panel. The preview is not persisted until the user clicks "Save Parameters".

**Input validation:**

| Condition | Behavior |
| --- | --- |
| Value below min | Clamp to min, amber flash |
| Value above max | Clamp to max, amber flash |
| Non-numeric input | Reject keystroke (input type="number" handles this) |
| Empty field on blur | Revert to previous valid value |

### 5.4 Panel Footer Actions

Sticky footer at the bottom of the left panel.

| Property | Value |
| --- | --- |
| Height | 56px |
| Background | `--workspace-bg` |
| Border-top | 1px solid `--workspace-border` |
| Padding | `--space-3` horizontal |
| Layout | Flexbox row, `justify-content: space-between` |

**Buttons:**

| Button | Component | Variant | Behavior |
| --- | --- | --- | --- |
| Reset to Defaults | `<Button variant="outline">` | Outline, `--text-secondary` | Resets the active scenario's 5 parameters to their default values. Confirmation dialog: "Reset [Scenario] parameters to defaults?" |
| Save Parameters | `<Button variant="default">` | Primary (blue) | PUTs parameters to `PUT /versions/:versionId/scenario-parameters`. On success: toast "Parameters saved". On error: field-level validation display. |

**Save button states:**

| State | Appearance |
| --- | --- |
| No changes | Disabled, muted text |
| Unsaved changes | Enabled, primary blue |
| Saving | Disabled, spinner icon |
| Save error | Enabled, red outline, retry text |

---

## 6. Right Panel: Impact Preview

### 6.1 Panel Header

| Property | Value |
| --- | --- |
| Text | "Impact Preview" |
| Font | `--text-lg`, weight 600, `--text-primary` |
| Padding | `--space-5` horizontal, `--space-4` vertical |
| Border-bottom | 1px solid `--workspace-border` |

A `<Badge>` to the right of the header text indicates the data currency:

| State | Badge text | Badge color |
| --- | --- | --- |
| Current | "Calculated" | `--color-success` text on `--color-success-bg` |
| Stale | "Outdated -- Recalculate" | `--color-stale` text on `--color-warning-bg` |
| Preview (unsaved changes) | "Preview (unsaved)" | `--color-info` text on `--color-info-bg` |

### 6.2 Key Metrics Comparison Table (FR-SCN-006)

A static table (not TanStack Table) comparing the three scenarios side-by-side.

```
+----------------------------------------------------------+
| Metric                | Base    | Optimistic | Pessimistic|
+----------------------------------------------------------+
| Adjusted Total Enroll | 1,523   | 1,675      | 1,371     |
| Total Tuition Rev HT  | 42.3M   | 46.5M      | 38.1M     |
| Total All-Stream Rev   | 44.1M   | 48.5M      | 39.7M     |
| Scholarship Deductions | (882K)  | (485K)     | (1.19M)   |
| Net Revenue            | 41.9M   | 47.2M      | 37.4M     |
| Revenue per Student    | 27,530  | 28,180     | 27,280    |
+----------------------------------------------------------+
```

**Table styling:**

| Property | Value |
| --- | --- |
| Component | Plain HTML `<table>` styled with Tailwind |
| Border | 1px solid `--workspace-border` on outer, `--workspace-border` between rows |
| Header row | `--workspace-bg-muted` background, `--text-sm` weight 600, `--text-secondary` |
| Metric column | Left-aligned, `--text-sm`, `--text-primary`, width ~40% |
| Value columns | Right-aligned, `--font-mono`, `--text-sm` |
| Row height | 40px |
| Alternating rows | `--workspace-bg` and `--workspace-bg-subtle` |
| Padding | `--space-2` vertical, `--space-3` horizontal per cell |
| Border-radius | `--radius-md` on table container |

**Column header colors:** Each scenario column header has a colored left-border (3px) matching the scenario dot color (Base: blue, Optimistic: green, Pessimistic: red).

**Metric rows (FR-SCN-006):**

| Row | Metric | Format | Source |
| --- | --- | --- | --- |
| 1 | Adjusted Total Enrollment | Integer, thousands separator | Sum of adjusted enrollment headcount |
| 2 | Total Tuition Revenue HT | Currency (SAR), 2 decimals | Sum of gross_revenue_ht from monthly_revenue |
| 3 | Total All-Stream Revenue | Currency (SAR), 2 decimals | Tuition + other_revenue_items |
| 4 | Scholarship Deductions | Currency (SAR), 2 decimals, parentheses (negative) | Sum of scholarship_deduction |
| 5 | Net Revenue | Currency (SAR), 2 decimals | Sum of net_revenue_ht |
| 6 | Revenue per Student | Currency (SAR), 2 decimals | Net Revenue / Adjusted Total Enrollment |

**Numeric display rules:** Follow framework Section 1.2 numeric display rules. Monetary values use `--font-mono`, right-aligned, thousands separator, 2 decimal places. Negative values in parentheses with `--color-error`.

### 6.3 Delta vs Base Table (FR-SCN-007)

Positioned below the key metrics table with `--space-6` gap.

```
+----------------------------------------------------------+
| Metric              | Optimistic Delta | Pessimistic Delta|
+----------------------------------------------------------+
| Enrollment Delta    | +152 (+10.0%)    | -152 (-10.0%)   |
| Tuition Delta       | +4.2M SAR        | -4.2M SAR       |
| Net Revenue Delta   | +5.3M SAR        | -4.5M SAR       |
| Rev/Student Delta   | +650 SAR         | -250 SAR        |
+----------------------------------------------------------+
```

**Table styling:** Same base styling as the key metrics table, with these differences:

| Property | Value |
| --- | --- |
| Header row | Two columns: "Optimistic Delta" (green header text), "Pessimistic Delta" (red header text) |
| Positive delta cells | `--color-success` text, `--color-success-bg` background |
| Negative delta cells | `--color-error` text, `--color-error-bg` background |
| Zero delta cells | `--text-muted` text, no background tint |

**Delta format:** Each cell shows both absolute and percentage deltas:
- Absolute: `+X` or `-X` with thousands separator and unit (SAR for currency, plain integer for enrollment)
- Percentage: `(+Y.Y%)` or `(-Y.Y%)` in parentheses after the absolute value
- Positive values prefixed with `+`, negative values prefixed with `-`

**Delta metric rows (FR-SCN-007):**

| Row | Metric | Calculation |
| --- | --- | --- |
| 1 | Enrollment Delta | Scenario Enrollment - Base Enrollment |
| 2 | Tuition Delta | Scenario Tuition Revenue HT - Base Tuition Revenue HT |
| 3 | Net Revenue Delta | Scenario Net Revenue - Base Net Revenue |
| 4 | Rev/Student Delta | Scenario Rev/Student - Base Rev/Student |

### 6.4 Net Revenue Bar Chart

Positioned below the delta table with `--space-6` gap.

| Property | Value |
| --- | --- |
| Library | Recharts v3 `<BarChart>` |
| Width | 100% of right panel, max 600px, centered |
| Height | 240px |
| Bars | 3 vertical bars, one per scenario |
| Bar colors | Base: `#2563EB` (blue-600), Optimistic: `#16A34A` (green-600), Pessimistic: `#DC2626` (red-600) |
| Bar width | 60px, `gap: 16px` between bars |
| Bar radius | `--radius-sm` (4px) top corners only |
| X-axis | Scenario names, `--text-xs`, `--text-secondary` |
| Y-axis | Currency values (SAR), `--text-xs`, `--font-mono`, auto-scaled |
| Y-axis format | Abbreviated: "40M", "42M", "44M" (millions) |
| Grid lines | Horizontal only, `--workspace-border` at 0.3 opacity |
| Tooltip | On hover: scenario name + formatted currency value |
| Legend | Hidden (labels are on x-axis) |
| Background | `--workspace-bg` |
| Title | "Net Revenue by Scenario", `--text-sm`, weight 600, `--text-secondary`, centered above chart |

**Tooltip styling:**

| Property | Value |
| --- | --- |
| Background | `--workspace-bg` |
| Border | 1px solid `--workspace-border` |
| Shadow | `--shadow-md` |
| Border-radius | `--radius-md` |
| Padding | `--space-2` |
| Text | `--text-xs`, `--font-mono` for value, `--text-sm` for label |

---

## 7. Data Flow & API Integration

### 7.1 API Endpoints

| Endpoint | Method | Purpose | PRD Reference |
| --- | --- | --- | --- |
| `/api/v1/versions/:versionId/scenarios` | GET | Fetch comparison view with all 3 scenarios' computed metrics and deltas | FR-SCN-004, FR-SCN-006 |
| `/api/v1/versions/:versionId/scenario-parameters` | GET | Fetch current parameter values for all 3 scenarios | FR-SCN-002 |
| `/api/v1/versions/:versionId/scenario-parameters` | PUT | Save updated parameters for a single scenario | FR-SCN-002 |

### 7.2 Query Keys (TanStack Query v5)

```typescript
// Scenario comparison data (right panel)
['scenarios', 'comparison', versionId, period]

// Scenario parameters (left panel)
['scenarios', 'parameters', versionId]
```

### 7.3 GET /versions/:versionId/scenarios Response Shape

```typescript
interface ScenarioComparison {
	base: ScenarioMetrics;
	optimistic: ScenarioMetrics;
	pessimistic: ScenarioMetrics;
	deltas: {
		optimistic_vs_base: ScenarioDeltas;
		pessimistic_vs_base: ScenarioDeltas;
	};
}

interface ScenarioMetrics {
	adjusted_total_enrollment: number;
	total_tuition_revenue_ht: string;   // decimal string
	total_all_stream_revenue: string;
	scholarship_deductions: string;
	net_revenue: string;
	revenue_per_student: string;
}

interface ScenarioDeltas {
	enrollment_delta: number;
	enrollment_delta_pct: string;
	tuition_delta: string;
	tuition_delta_pct: string;
	net_revenue_delta: string;
	net_revenue_delta_pct: string;
	rev_per_student_delta: string;
	rev_per_student_delta_pct: string;
}
```

### 7.4 GET /versions/:versionId/scenario-parameters Response Shape

```typescript
interface ScenarioParametersResponse {
	scenarios: ScenarioParameterSet[];
}

interface ScenarioParameterSet {
	scenario_name: 'Base' | 'Optimistic' | 'Pessimistic';
	new_enrollment_factor: string;     // decimal string, e.g., "1.000000"
	retention_adjustment: string;      // decimal string
	attrition_rate: string;
	fee_collection_rate: string;
	scholarship_allocation: string;
	updated_at: string;                // ISO 8601 timestamp
	updated_by: string | null;         // user email
}
```

### 7.5 PUT /versions/:versionId/scenario-parameters Request Shape

```typescript
interface UpdateScenarioParametersRequest {
	scenario_name: 'Base' | 'Optimistic' | 'Pessimistic';
	new_enrollment_factor: string;
	retention_adjustment: string;
	attrition_rate: string;
	fee_collection_rate: string;
	scholarship_allocation: string;
}
```

**Optimistic locking:** The PUT request includes `If-Match` header with the `updated_at` timestamp from the last GET. On HTTP 409 (OPTIMISTIC_LOCK), the conflict resolution dialog from framework Section 6.3 is displayed.

### 7.6 Data Flow Sequence

1. Module mounts: parallel fetch of `GET /scenario-parameters` (left panel) and `GET /scenarios` (right panel).
2. User adjusts sliders: debounced 300ms preview calculation runs client-side using the parameter values. The right panel shows "Preview (unsaved)" badge. Preview calculations are approximate (multiply base metrics by parameter ratios) since full server-side recalculation requires a Calculate action.
3. User clicks "Save Parameters": `PUT /scenario-parameters` fires. On success, invalidate `['scenarios', 'parameters', versionId]` query. The stale indicator appears on the Calculate button (parameters saved but outputs not yet recalculated).
4. User clicks "Calculate": triggers `POST /versions/:versionId/calculate/revenue` (or full recalculation). On completion, invalidate `['scenarios', 'comparison', versionId, period]` query. Right panel refreshes with server-calculated values. Badge changes to "Calculated".

---

## 8. State Management

### 8.1 Zustand Store

```typescript
interface ScenariosStore {
	// Active scenario tab in left panel
	activeScenarioTab: 'Base' | 'Optimistic' | 'Pessimistic';
	setActiveScenarioTab: (tab: string) => void;

	// Draft parameter values (unsaved edits)
	draftParameters: Record<string, ScenarioParameterSet>;
	setDraftParameter: (scenario: string, key: string, value: number) => void;
	resetDraftToServer: (scenario: string, serverParams: ScenarioParameterSet) => void;
	resetDraftToDefaults: (scenario: string) => void;

	// Dirty tracking
	isDirty: (scenario: string) => boolean;
}
```

### 8.2 State Synchronization

| Source | Target | Trigger |
| --- | --- | --- |
| Context bar scenario selector | Left panel active tab | `useContextBarStore` subscription |
| Left panel tab change | Context bar scenario selector | `useContextBarStore.setScenario()` |
| Server parameters (GET) | Draft parameters | Query `onSuccess` callback |
| Draft parameter change | Right panel preview | Debounced 300ms recalc |
| Save success | Draft parameters reset | Invalidation + refetch |

---

## 9. Loading, Empty & Error States

### 9.1 Loading State

| Area | Skeleton |
| --- | --- |
| Left panel | 3 tab skeletons + 5 slider row skeletons (label + track + input) |
| Right panel | Table skeleton (7 rows x 4 columns) + chart skeleton rectangle |
| Duration before showing | 200ms delay per framework |

### 9.2 Empty State

Shown when no scenario parameters exist for the version (first-time setup).

| Property | Value |
| --- | --- |
| Icon | Lucide `GitBranchPlus`, 48px, `--text-muted` |
| Heading | "No scenario parameters configured" |
| Description | "Set up Base, Optimistic, and Pessimistic parameters to model financial outcomes." |
| Action | `<Button variant="default">` "Initialize Defaults" |

"Initialize Defaults" sends a PUT request creating all three scenarios with their default parameter values.

### 9.3 Error States

| Error | Display |
| --- | --- |
| Parameters fetch failed | Left panel shows inline error with retry: "Failed to load parameters. [Retry]" |
| Comparison fetch failed | Right panel shows inline error with retry: "Failed to load comparison data. [Retry]" |
| Save failed (400/422) | Field-level validation: amber border on affected slider + tooltip with error message |
| Save failed (409) | Conflict resolution dialog per framework Section 6.3 |
| Save failed (500) | Toast: "Save failed -- please try again" with retry |
| Calculate failed | Error panel per framework Calculate button spec (Section 4.5) |

---

## 10. Accessibility

### 10.1 ARIA Attributes

| Element | ARIA | Value |
| --- | --- | --- |
| Left panel | `role="region"`, `aria-label` | "Scenario Parameters" |
| Right panel | `role="region"`, `aria-label` | "Impact Preview" |
| Scenario tabs | `role="tablist"` | Standard shadcn/ui Tabs ARIA |
| Each tab | `role="tab"`, `aria-selected` | `true` / `false` |
| Tab panel | `role="tabpanel"`, `aria-labelledby` | ID of active tab |
| Each slider | `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label` | Parameter name as label |
| Numeric input | `aria-label` | "[Parameter name] value" |
| Key metrics table | `role="table"`, `aria-label` | "Key metrics comparison" |
| Delta table | `role="table"`, `aria-label` | "Delta vs Base comparison" |
| Bar chart | `role="img"`, `aria-label` | "Net revenue comparison bar chart: Base [X] SAR, Optimistic [Y] SAR, Pessimistic [Z] SAR" |
| Data currency badge | `aria-live="polite"` | Announces state changes |

### 10.2 Keyboard Navigation

| Key | Context | Action |
| --- | --- | --- |
| `Tab` | Global | Moves focus through: scenario tabs, parameter sliders, parameter inputs, action buttons, then right panel tables |
| `Arrow Left/Right` | Scenario tabs | Switch between Base, Optimistic, Pessimistic |
| `Arrow Left/Right` | Slider focused | Decrease/increase by step |
| `Home` | Slider focused | Set to minimum |
| `End` | Slider focused | Set to maximum |
| `Enter` | Save button focused | Save parameters |
| `Enter` | Reset button focused | Open reset confirmation dialog |
| `Escape` | Any input focused | Cancel edit, revert to saved value |

### 10.3 Color Independence

- Positive/negative deltas are identified by `+`/`-` prefix and color (not color alone).
- Scenario identification uses both color dots and text labels.
- Chart bars include x-axis text labels in addition to color differentiation.

---

## 11. Future Enhancements

### 11.1 Custom Scenarios (FR-SCN-005 -- COULD)

If implemented, a "New Scenario" button appears after the three default tabs.

**Button:**

| Property | Value |
| --- | --- |
| Component | `<Button variant="outline" size="sm">` |
| Icon | Lucide `Plus`, 14px |
| Label | "New Scenario" |
| Position | Right of the Pessimistic tab, or below the tab row if no space |

**Side panel form (480px, per framework Section 4.4):**

| Field | Component | Validation |
| --- | --- | --- |
| Scenario Name | `<Input>` | Required, 2-50 chars, unique within version |
| Copy From | `<Select>` | Options: Base, Optimistic, Pessimistic, or "Blank" |
| Parameters (5x) | Same slider + input controls as left panel | Same min/max/step rules |

**Behavior:**
- On save, a new tab is added to the scenario tab list.
- The key metrics and delta tables gain additional columns.
- The bar chart adds a new bar with an auto-assigned color from a palette: `#8B5CF6` (violet-500), `#EC4899` (pink-500), `#F59E0B` (amber-500).
- Custom scenarios can be deleted via a trash icon on their tab (confirmation dialog required). Default scenarios cannot be deleted.

**Database consideration:** FR-SCN-005 would require relaxing the `scenario_params_name_check` constraint from `CHECK (scenario_name IN ('Base', 'Optimistic', 'Pessimistic'))` to allow arbitrary names.

### 11.2 Parameter History

A "History" icon button on each parameter row could show a popover with the last 5 changes (timestamp, user, old value, new value) sourced from `audit_entries`.

### 11.3 Scenario Export Comparison PDF

A dedicated "Export Comparison" action that generates a formatted PDF with both tables and the chart, suitable for board presentation.
