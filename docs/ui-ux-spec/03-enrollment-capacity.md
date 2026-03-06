# BudFin UI/UX Specification: Enrollment & Capacity

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Module:** Enrollment & Capacity
> **Route:** `/planning/enrollment`
> **Sidebar Item:** Planning > Enrollment & Capacity
> **PRD References:** FR-ENR-001 through FR-ENR-013, FR-CAP-001 through FR-CAP-007
> **Parent:** [00-global-framework.md](./00-global-framework.md)

---

## 1. Module Purpose

The Enrollment & Capacity module is the primary data-entry point for student headcount planning. It provides three interrelated views for entering, breaking down, and analyzing enrollment data across the school's 15 grade levels (PS through Terminale). Capacity utilization alerts surface over- and under-enrolled grades. Historical trend charts inform projection decisions.

**Key workflows:**

- Enter AY1/AY2 headcount by grade (Stage 1)
- Break down headcount by nationality and tariff (Stage 2)
- Review capacity utilization with traffic-light alerts
- Analyze 5-year historical enrollment trends
- Run the enrollment calculation engine to compute sections and utilization
- Import historical enrollment data from CSV

---

## 2. Personas and Permissions

| Capability                     | Admin | Budget Owner | Budget Analyst (Editor) | Viewer |
| ------------------------------ | ----- | ------------ | ----------------------- | ------ |
| View all tabs and data         | Yes   | Yes          | Yes                     | Yes    |
| Edit headcount cells (Stage 1) | Yes   | Yes          | Yes                     | No     |
| Edit detail cells (Stage 2)    | Yes   | Yes          | Yes                     | No     |
| Run Calculate                  | Yes   | Yes          | Yes                     | No     |
| Import historical CSV          | Yes   | Yes          | Yes                     | No     |
| Export (XLSX/CSV/PDF)          | Yes   | Yes          | Yes                     | Yes    |
| View historical chart          | Yes   | Yes          | Yes                     | Yes    |

**Viewer behavior:** All grids render without `--cell-editable-bg`. No edit cursor on hover. Double-click is a no-op. Calculate and Import buttons are hidden from the toolbar.

**Locked/Archived version behavior:** All cells become read-only regardless of role. Calculate button disabled with tooltip "Version is locked". Import button disabled. Read-only banner displayed per Section 4.10 of 00-global-framework.md.

---

## 3. Page Layout

The module renders inside PlanningShell and follows the PlanningShell Module Template (Global Framework Section 12.1). The context bar and docked right panel are managed by the shell.

```
+-----------------------------------------------------------------------+
|                        Context Bar (shell-level)                      |
+-----------------------------------------------------------------------+
| Module Toolbar                                                        |
| [Enrollment & Capacity]  [Grade Band Filter]  [Calculate] [Export] [+]|
+-----------------------------------------------------------------------+
| Tab Bar                                                               |
| [ By Grade ]  [ By Nationality ]  [ By Tariff ]                      |
+-----------------------------------------------------------------------+
|                                                                       |
|  Active Tab Content                                                   |
|  (Data grid + capacity indicators)                                    |
|                                                                       |
+-----------------------------------------------------------------------+
|  Historical Enrollment Chart (collapsible)                            |
+-----------------------------------------------------------------------+
```

### 3.1 Module Toolbar

Follows the shared toolbar pattern (Section 4.5, 00-global-framework.md).

| Element           | Position | Component                   | Details                                                                                                                        |
| ----------------- | -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Module title      | Left     | `<ModuleTitle>`             | "Enrollment & Capacity", `--text-xl` weight 600                                                                                |
| Grade band filter | Center   | `<ToggleGroup>` (shadcn/ui) | Options: All, Maternelle, Elementaire, College, Lycee. Default: All. Filters grid rows.                                        |
| Calculate button  | Right    | `<CalculateButton>`         | Triggers `POST /api/v1/versions/:versionId/calculate/enrollment`. States per Section 4.5 of framework. Hidden for Viewer role. |
| Export button     | Right    | `<ExportButton>`            | Dropdown: XLSX, CSV, PDF. Exports visible tab data.                                                                            |
| More menu         | Right    | `<MoreMenu>`                | Items: "Import Historical CSV" (hidden for Viewer), "Capacity Settings" (Admin only)                                           |

**Comparison mode:** When the context bar comparison toggle is activated, enrollment grids gain variance columns per 00-global-framework.md Section 7. The right panel auto-closes per the auto-collapse rules in 00-global-framework.md Section 2.1.

### 3.2 Tab Bar

| Property          | Value                                     |
| ----------------- | ----------------------------------------- |
| Component         | shadcn/ui `<Tabs>`                        |
| Variant           | Underline style (border-bottom indicator) |
| Active indicator  | 2px solid `--color-info` underline        |
| Tab text          | `--text-base`, weight 500                 |
| Active tab text   | `--text-primary`, weight 600              |
| Inactive tab text | `--text-secondary`                        |

| Tab | Label          | Stage          | Default              |
| --- | -------------- | -------------- | -------------------- |
| 1   | By Grade       | Stage 1        | Yes (default active) |
| 2   | By Nationality | Stage 2        | No                   |
| 3   | By Tariff      | Stage 2 detail | No                   |

Tab state persists within the session. Switching tabs does not trigger a data refetch if data is already cached (TanStack Query handles this via query key scoping).

---

## 4. Tab 1: By Grade (Stage 1)

### 4.1 Grid Structure

The grid displays 15 grade rows grouped into 4 collapsible bands. Each band has a summary row showing aggregated totals.

**Column definition:**

| #   | Column              | Width | Type       | Editable        | Pinned     | Alignment | Font            |
| --- | ------------------- | ----- | ---------- | --------------- | ---------- | --------- | --------------- |
| 1   | Grade               | 100px | text       | No              | Yes (left) | Left      | `--font-family` |
| 2   | Band                | 120px | text       | No              | Yes (left) | Left      | `--font-family` |
| 3   | AY1 Headcount       | 120px | integer    | Yes             | No         | Right     | `--font-mono`   |
| 4   | AY2 Headcount       | 120px | integer    | Yes             | No         | Right     | `--font-mono`   |
| 5   | Delta vs Prior Year | 100px | percentage | No (calculated) | No         | Right     | `--font-mono`   |
| 6   | Historical (N-2)    | 80px  | integer    | No              | No         | Right     | `--font-mono`   |
| 7   | Historical (N-1)    | 80px  | integer    | No              | No         | Right     | `--font-mono`   |
| 8   | Sections Needed     | 100px | integer    | No (calculated) | No         | Right     | `--font-mono`   |
| 9   | Max Class Size      | 100px | integer    | No (reference)  | No         | Right     | `--font-mono`   |
| 10  | Utilization %       | 100px | percentage | No (calculated) | No         | Right     | `--font-mono`   |
| 11  | Alert               | 80px  | status     | No (calculated) | No         | Center    | —               |

**Total grid width:** ~1,100px (fits within 1280px minimum viewport with sidebar collapsed at 64px).

### 4.2 Row Grouping

Rows are grouped by `grade_band` from `class_capacity_config`:

| Band        | Grades                 | Default Max Class Size |
| ----------- | ---------------------- | ---------------------- |
| Maternelle  | PS, MS, GS             | 24                     |
| Elementaire | CP, CE1, CE2, CM1, CM2 | 26                     |
| College     | 6eme, 5eme, 4eme, 3eme | 30                     |
| Lycee       | 2nde, 1ere, Terminale  | 30                     |

**Group row behavior:**

- Expandable/collapsible via chevron icon in the Grade column
- Group summary row shows: band name, sum of AY1 headcount, sum of AY2 headcount, weighted average utilization %, worst-case alert status
- `aria-expanded="true|false"` on group rows
- `aria-level="1"` for group rows, `aria-level="2"` for grade rows
- All groups expanded by default on page load

**Grand total row:**

- Sticky at grid bottom
- Background: `--workspace-bg-muted`
- Font weight: 700
- Shows: "Total", sum of AY1, sum of AY2, overall delta %, total sections needed, blank for max class size, overall utilization %, worst alert

### 4.3 Editable Cell Behavior

Headcount cells (AY1, AY2) follow the shared cell editor pattern (Section 4.2, 00-global-framework.md):

| Property              | Value                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| Cell type             | `integer`                                                                      |
| Background (editable) | `--cell-editable-bg` (#FEFCE8)                                                 |
| Background (focused)  | White with `--cell-editable-focus` border (2px solid blue-600)                 |
| Validation            | Integer >= 0. No fractional students. Max value: 9999.                         |
| Error display         | `--cell-error-border` with tooltip: "Headcount must be a non-negative integer" |
| Display format        | Right-aligned, `--font-mono`, thousands separator (e.g., `1,523`)              |
| Edit activation       | Double-click or Enter on focused cell                                          |
| Confirm               | Enter (move down) or Tab (move right)                                          |
| Cancel                | Escape (revert to previous value)                                              |

**On value change:**

1. Inline validation runs immediately
2. If valid, cell value updates optimistically in the UI
3. Auto-save batches the change (blur trigger or 30-second interval)
4. PUT `/api/v1/versions/:versionId/enrollment/headcount` sends the updated entry
5. On success: stale indicator appears in context bar for downstream modules (Revenue, DHG, Staffing, P&L)
6. On error: cell reverts, error toast shown

### 4.4 Delta vs Prior Year Column

Calculated client-side as: `((current - prior) / prior) * 100`.

| Condition                   | Display    | Color                                          |
| --------------------------- | ---------- | ---------------------------------------------- |
| Delta > +10%                | "+XX.X%"   | `--color-error` (red-600) with up arrow icon   |
| Delta < -10%                | "-XX.X%"   | `--color-error` (red-600) with down arrow icon |
| Delta between -10% and +10% | "+/-XX.X%" | `--text-secondary` (slate-600)                 |
| Prior year is 0             | "New"      | `--color-info` (blue-600) badge                |
| Current is 0, prior > 0     | "-100.0%"  | `--color-error` (red-600)                      |

The "+/-10%" threshold for flagging comes from FR-ENR-008. Color-coded values use icon + text (not color alone) for accessibility.

### 4.5 Historical Context Columns (N-2, N-1)

Displays the headcount from two and one academic years prior to the current version's fiscal year.

| Property    | Value                                             |
| ----------- | ------------------------------------------------- |
| Data source | `GET /api/v1/enrollment/historical?years=3`       |
| Text style  | `--text-muted` (slate-400), `--text-xs` (11px)    |
| Font        | `--font-mono`                                     |
| Empty state | "--" when no historical data exists for that year |
| Tooltip     | "2023-24: 142 students" (full label on hover)     |

These columns are read-only reference data. They are hidden by default on narrow viewports (below 1440px) and toggled visible via a column visibility dropdown in the More menu.

### 4.6 Capacity Columns

Capacity data is populated after running the Calculate workflow. Before calculation, these columns show "--" with `--text-muted` styling.

#### Sections Needed

Computed server-side: `CEILING(headcount / max_class_size)` per FR-CAP-001.

| Property    | Value                                 |
| ----------- | ------------------------------------- |
| Display     | Integer, right-aligned, `--font-mono` |
| Empty state | "--" (pre-calculation)                |

#### Max Class Size

Read-only reference from `class_capacity_config`. Not editable in this grid (managed in Master Data > Reference Data).

#### Utilization %

Computed server-side: `(headcount / (sections_needed * max_class_size)) * 100` per FR-CAP-003.

| Property | Value                                                  |
| -------- | ------------------------------------------------------ |
| Display  | Percentage with 1 decimal: "85.3%"                     |
| Font     | `--font-mono`, right-aligned                           |
| Visual   | Inline colored progress bar behind the percentage text |

**Utilization progress bar:**

| Property      | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| Height        | 4px, positioned at cell bottom                               |
| Width         | Proportional to utilization % (capped at 100% of cell width) |
| Border radius | `--radius-sm` (4px)                                          |
| Color         | Matches alert tier (green/amber/red)                         |

#### Alert Column (Traffic Light)

Per FR-CAP-004 and FR-CAP-007:

| Status   | Condition                     | Icon                     | Color             | Background           | Tooltip                                 |
| -------- | ----------------------------- | ------------------------ | ----------------- | -------------------- | --------------------------------------- |
| OVER     | Utilization > 100% (plafond)  | `AlertTriangle` (Lucide) | `--color-error`   | `--color-error-bg`   | "Over capacity: XX.X% (max 100%)"       |
| NEAR_CAP | Utilization > 95% and <= 100% | `AlertCircle` (Lucide)   | `--color-warning` | `--color-warning-bg` | "Near capacity: XX.X% (warning at 95%)" |
| UNDER    | Utilization < 70% (plancher)  | `ArrowDown` (Lucide)     | `--color-warning` | `--color-warning-bg` | "Under-enrolled: XX.X% (floor at 70%)"  |
| OK       | Utilization >= 70% and <= 95% | `CheckCircle` (Lucide)   | `--color-success` | `--color-success-bg` | "OK: XX.X%"                             |
| —        | Pre-calculation               | `Minus` (Lucide)         | `--text-muted`    | none                 | "Run Calculate to see capacity alerts"  |

Alert cells display icon + abbreviated text label (e.g., "OVER", "OK") for accessibility (not color alone, per WCAG).

---

## 5. Tab 2: By Nationality (Stage 2)

### 5.1 Grid Structure

Rows represent the cross-product of Grade x Nationality. For 15 grades and 3 nationalities, this produces 45 data rows (plus group summary rows).

**Column definition:**

| #   | Column            | Width | Type    | Editable        | Pinned     | Alignment | Font            |
| --- | ----------------- | ----- | ------- | --------------- | ---------- | --------- | --------------- |
| 1   | Grade             | 100px | text    | No              | Yes (left) | Left      | `--font-family` |
| 2   | Nationality       | 120px | text    | No              | Yes (left) | Left      | `--font-family` |
| 3   | AY1 Headcount     | 120px | integer | Yes             | No         | Right     | `--font-mono`   |
| 4   | AY2 Headcount     | 120px | integer | Yes             | No         | Right     | `--font-mono`   |
| 5   | Grade Total (AY1) | 110px | integer | No (calculated) | No         | Right     | `--font-mono`   |
| 6   | Grade Total (AY2) | 110px | integer | No (calculated) | No         | Right     | `--font-mono`   |
| 7   | Match Status      | 80px  | status  | No (calculated) | No         | Center    | —               |

### 5.2 Row Grouping

Rows are grouped by grade level. Each grade group contains exactly 3 rows (Francais, Nationaux, Autres).

**Group header row:** Grade name + Stage 1 total for reference.

**Row order within each grade group:**

1. Francais
2. Nationaux
3. Autres

### 5.3 Grade Total and Match Validation

Columns 5-6 show the sum of the 3 nationality rows for the current grade. This sum is validated against the Stage 1 total from Tab 1.

**Match Status column:**

| Status     | Condition                                  | Icon            | Color             | Tooltip                                                                                 |
| ---------- | ------------------------------------------ | --------------- | ----------------- | --------------------------------------------------------------------------------------- |
| Match      | Sum equals Stage 1 total                   | `CheckCircle`   | `--color-success` | "Total matches Stage 1: XX"                                                             |
| Mismatch   | Sum does not equal Stage 1 total           | `AlertTriangle` | `--color-error`   | "Mismatch: nationality total (XX) does not equal Stage 1 total (YY). Difference: +/-ZZ" |
| Incomplete | One or more cells empty (0 or not entered) | `Clock`         | `--color-warning` | "Incomplete: enter all nationality breakdowns"                                          |

**Mismatch row styling:**

- The grade total cells (columns 5-6) display in `--color-error` when mismatched
- The group header row gains a `--color-error-bg` background tint
- A small badge on the tab label shows the count of mismatched grades: "By Nationality (3)" in `--color-error`

### 5.4 Editable Cell Behavior

Same as Tab 1 headcount cells (Section 4.3) with one additional validation:

| Property           | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| API endpoint       | `PUT /api/v1/versions/:versionId/enrollment/detail`                  |
| Server validation  | Sum per grade/period must equal Stage 1 total                        |
| Server error (422) | `STAGE2_TOTAL_MISMATCH` -- highlighted inline on affected grade rows |

The client performs real-time sum validation as the user types, but server-side validation is authoritative. A mismatch warning is shown client-side immediately but does not block saving individual cells. The server rejects the batch save if totals do not match when all cells for a grade are filled.

---

## 6. Tab 3: By Tariff (Stage 2 Detail)

### 6.1 Grid Structure

Rows represent the cross-product of Grade x Nationality x Tariff. For 15 grades, 3 nationalities, and 3 tariffs, this produces 135 data rows (plus group summary rows).

**Column definition:**

| #   | Column                  | Width | Type    | Editable        | Pinned     | Alignment | Font            |
| --- | ----------------------- | ----- | ------- | --------------- | ---------- | --------- | --------------- |
| 1   | Grade                   | 100px | text    | No              | Yes (left) | Left      | `--font-family` |
| 2   | Nationality             | 120px | text    | No              | Yes (left) | Left      | `--font-family` |
| 3   | Tariff                  | 80px  | text    | No              | No         | Left      | `--font-family` |
| 4   | AY1 Headcount           | 120px | integer | Yes             | No         | Right     | `--font-mono`   |
| 5   | AY2 Headcount           | 120px | integer | Yes             | No         | Right     | `--font-mono`   |
| 6   | Nationality Total (AY1) | 110px | integer | No (calculated) | No         | Right     | `--font-mono`   |
| 7   | Nationality Total (AY2) | 110px | integer | No (calculated) | No         | Right     | `--font-mono`   |
| 8   | Match Status            | 80px  | status  | No (calculated) | No         | Center    | —               |

### 6.2 Row Grouping (Two Levels)

**Level 1:** Grade (15 groups)
**Level 2:** Nationality within each grade (3 sub-groups per grade)

Each nationality sub-group contains exactly 3 tariff rows: RP, R3+, Plein.

```
v PS (Maternelle)                    [Grade Total: 72]
  v Francais                         [Nationality Total: 30]
      RP        |  5  |  6  |
      R3+       |  3  |  4  |
      Plein     | 22  | 20  |       [Sum: 30] [Match: OK]
  v Nationaux                        [Nationality Total: 25]
      RP        |  2  |  2  |
      R3+       |  1  |  1  |
      Plein     | 22  | 22  |       [Sum: 25] [Match: OK]
  v Autres                           [Nationality Total: 17]
      RP        |  0  |  0  |
      R3+       |  0  |  0  |
      Plein     | 17  | 17  |       [Sum: 17] [Match: OK]
```

### 6.3 Validation

Two levels of sum validation:

1. **Tariff -> Nationality:** Sum of 3 tariff rows per (grade, nationality) must equal the corresponding Tab 2 (By Nationality) headcount.
2. **Nationality -> Grade:** Sum of all 9 rows per grade must equal the Tab 1 (By Grade) Stage 1 headcount.

Match status column uses the same indicators as Tab 2 (Section 5.3), but validates against the nationality-level total from Tab 2.

### 6.4 Virtual Scrolling

With 135+ data rows, the enrollment grid uses TanStack Table v8 client-side rendering. No virtual scrolling (ADR-016 — see global framework §4.1). All rows render without windowing; this is within acceptable performance bounds for EFIR's dataset size.

### 6.5 Tariff Display Labels

| Code    | Display Label         | Description             |
| ------- | --------------------- | ----------------------- |
| `RP`    | RP (Reduit Personnel) | Staff children discount |
| `R3+`   | R3+ (Reduit 3+)       | 3+ siblings discount    |
| `Plein` | Plein (Plein Tarif)   | Full price              |

Tooltip on tariff cell shows the full description.

---

## 7. Historical Enrollment Chart

### 7.1 Placement

Located below the active tab's grid in a collapsible section.

| Property          | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| Component         | Collapsible `<Collapsible>` (shadcn/ui)               |
| Default state     | Collapsed                                             |
| Toggle label      | "Historical Enrollment Trends (5 years)" with chevron |
| Height (expanded) | 360px                                                 |
| Background        | `--workspace-bg`                                      |
| Border-top        | 1px solid `--workspace-border`                        |
| Padding           | `--space-6` (24px)                                    |

### 7.2 Chart Specification

| Property    | Value                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| Library     | Recharts v3                                                               |
| Chart type  | Multi-line chart (`<LineChart>`)                                          |
| X-axis      | Academic year labels (e.g., "2021-22", "2022-23", ..., "2025-26")         |
| Y-axis      | Student count (integer)                                                   |
| Lines       | One line per grade band (Maternelle, Elementaire, College, Lycee) + Total |
| Data source | `GET /api/v1/enrollment/historical?years=5`                               |

**Line styling:**

| Line        | Color                      | Stroke | Dash   |
| ----------- | -------------------------- | ------ | ------ |
| Maternelle  | `#8B5CF6` (violet-500)     | 2px    | Solid  |
| Elementaire | `#3B82F6` (blue-500)       | 2px    | Solid  |
| College     | `#10B981` (emerald-500)    | 2px    | Solid  |
| Lycee       | `#F59E0B` (amber-500)      | 2px    | Solid  |
| Total       | `--text-primary` (#0F172A) | 3px    | Dashed |

**Chart features:**

- Tooltip on hover: shows year, band name, student count
- Legend: horizontal, positioned below chart, interactive (click to toggle line visibility)
- Grid lines: horizontal only, `--workspace-border` color, 0.5 opacity
- Responsive: chart fills available width minus padding

### 7.3 Annotations

| Annotation            | Position                                     | Style                                                                 |
| --------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| CAGR per band         | Right of last data point, inline with line   | `--text-xs`, `--text-secondary`, format: "CAGR: +2.3%"                |
| 3-year moving average | Faint dotted line overlaid on each band line | Same color as band line, 1px stroke, dotted dash pattern, 30% opacity |

CAGR and moving average values come from the `cagr_by_band` and `moving_avg_by_band` fields of the `GET /api/v1/enrollment/historical` response.

### 7.4 Empty State

When no historical data exists:

| Property    | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Icon        | `BarChart3` (Lucide), 48px, `--text-muted`                                            |
| Heading     | "No historical enrollment data"                                                       |
| Description | "Import CSV files to see 5-year enrollment trends."                                   |
| Action      | `<Button variant="outline">` "Import Historical Data" -- triggers the CSV import flow |

---

## 8. Calculate Workflow

### 8.1 Trigger

The Calculate button in the module toolbar triggers the enrollment capacity calculation.

**Pre-conditions checked client-side:**

1. Stage 1 headcount must have at least one non-zero entry
2. No pending unsaved changes (auto-save completes first)

If pre-conditions fail, show a toast: "Save your changes before calculating" (warning variant).

### 8.2 API Call

```
POST /api/v1/versions/:versionId/calculate/enrollment
```

### 8.3 Button State Transitions

| Phase                         | Button State                          | Duration                    |
| ----------------------------- | ------------------------------------- | --------------------------- |
| Idle                          | Default (clickable)                   | —                           |
| Stale (upstream data changed) | Amber pulsing dot                     | Until calculate runs        |
| Saving pending changes        | Spinner + "Saving..."                 | ~1s                         |
| Calculating                   | Disabled + spinner + "Calculating..." | ~1-3s                       |
| Success                       | Green check flash                     | 2s, then returns to default |
| Error                         | Red badge                             | Until user acknowledges     |

### 8.4 Success Response

On 200 response:

1. Capacity columns (Sections Needed, Utilization %, Alert) update in the grid
2. Toast notification (success variant): "Enrollment calculated -- X total students, Y over-capacity grades"
3. Stale indicator clears for the Enrollment module
4. Downstream modules (Revenue, DHG, Staffing, P&L) marked stale in context bar

### 8.5 Error Handling

| Error                     | UI Response                                                                     |
| ------------------------- | ------------------------------------------------------------------------------- |
| 409 VERSION_LOCKED        | Toast (error): "Cannot calculate -- version is locked"                          |
| 422 MISSING_PREREQUISITES | Toast (warning): "Enter enrollment headcount before calculating"                |
| 500 Server Error          | Toast (error): "Calculation failed -- please try again" + retry button in toast |

---

## 9. CSV Import Flow

### 9.1 Entry Point

More menu > "Import Historical CSV" (visible to Admin, BudgetOwner, Editor).

### 9.2 Import Side Panel

Opens a side panel (480px, per Section 4.4 of the framework).

**Panel structure:**

```
+----------------------------------+
| Import Historical Enrollment  [X] |
+----------------------------------+
|                                  |
| Academic Year: [Select v]        |
|   2021-22, 2022-23, ..., 2025-26|
|                                  |
| [Drag & Drop Zone]              |
|  Drop CSV file here or [Browse]  |
|  Accepted: .csv (max 1MB)       |
|                                  |
| Format: grade_level, student_count|
| Example:                         |
|   PS,72                          |
|   MS,68                          |
|                                  |
+----------------------------------+
| [Validate]  [Cancel]            |
+----------------------------------+
```

### 9.3 Two-Phase Workflow

**Phase 1: Validate (dry run)**

`POST /api/v1/enrollment/historical/import` with `mode=validate`

| Result         | Display                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| All valid      | Green summary: "15 grades found, all valid. Ready to import." + preview table  |
| Partial errors | Warning: "12 valid, 3 errors" + error table showing row number, field, message |
| All invalid    | Error: "No valid rows found" + error details                                   |

Preview table shows: Grade, Student Count, Status (valid/error icon).

**Phase 2: Commit**

Button changes from "Validate" to "Import" after successful validation. User clicks "Import" to persist.

`POST /api/v1/enrollment/historical/import` with `mode=commit`

| Result         | Display                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Success        | Toast (success): "Imported enrollment data for 2023-24 (15 grades)". Panel closes. Historical chart refreshes.                               |
| Duplicate year | Confirmation dialog: "Enrollment data for 2023-24 already exists. Replace existing data?" with "Replace" (destructive) and "Cancel" buttons. |
| Error          | Toast (error): error message from API. Panel stays open for retry.                                                                           |

---

## 10. State Management

### 10.1 Server State (TanStack Query v5)

| Query Key                                | Endpoint                                         | Stale Time   | Notes                                  |
| ---------------------------------------- | ------------------------------------------------ | ------------ | -------------------------------------- |
| `['enrollment', 'headcount', versionId]` | `GET /versions/:versionId/enrollment/headcount`  | 30s          | Stage 1 data                           |
| `['enrollment', 'detail', versionId]`    | `GET /versions/:versionId/enrollment/detail`     | 30s          | Stage 2 data                           |
| `['enrollment', 'historical']`           | `GET /enrollment/historical`                     | 5min         | Historical trends (less volatile)      |
| `['enrollment', 'calculate', versionId]` | `POST /versions/:versionId/calculate/enrollment` | 0 (mutation) | Invalidates headcount query on success |

**Optimistic updates:** When a headcount cell is edited, the query cache is updated optimistically. On PUT failure, the cache reverts to the previous value and an error toast is shown.

**Invalidation cascades:**

- After Stage 1 save: invalidate `['enrollment', 'detail', versionId]` (to refresh match status)
- After Calculate: invalidate `['enrollment', 'headcount', versionId]` (capacity columns update)
- After historical import: invalidate `['enrollment', 'historical']`

### 10.2 Client State (Zustand)

```typescript
interface EnrollmentGridStore {
	activeTab: 'by-grade' | 'by-nationality' | 'by-tariff';
	gradeBandFilter: 'All' | 'Maternelle' | 'Elementaire' | 'College' | 'Lycee';
	expandedGroups: Set<string>;
	columnVisibility: Record<string, boolean>;
	sortState: { columnId: string; direction: 'asc' | 'desc' } | null;
	historicalChartExpanded: boolean;
	pendingEdits: Map<string, number>; // cellKey -> value (for optimistic batching)
}
```

### 10.3 URL State

Tab selection syncs to URL: `/planning/enrollment?tab=by-grade&band=All`

| Param  | Values                                                 | Default    |
| ------ | ------------------------------------------------------ | ---------- |
| `tab`  | `by-grade`, `by-nationality`, `by-tariff`              | `by-grade` |
| `band` | `All`, `Maternelle`, `Elementaire`, `College`, `Lycee` | `All`      |

---

## 11. Accessibility

### 11.1 Grid ARIA

All three tab grids follow the ARIA grid pattern from Section 10.2 of 00-global-framework.md.

| Attribute              | Element                      | Value                                                           |
| ---------------------- | ---------------------------- | --------------------------------------------------------------- |
| `role="grid"`          | Table container              | Per tab                                                         |
| `role="rowgroup"`      | Band/grade group             | Collapsible groups                                              |
| `role="row"`           | Each data row                | —                                                               |
| `role="columnheader"`  | Header cells                 | With `aria-sort` where applicable                               |
| `role="gridcell"`      | Data cells                   | —                                                               |
| `aria-readonly="true"` | Non-editable cells           | Calculated, reference, and status cells                         |
| `aria-expanded`        | Group header rows            | `true` / `false`                                                |
| `aria-level`           | Grouped rows                 | 1 for band/grade groups, 2 for data rows, 3 for tariff sub-rows |
| `aria-invalid="true"`  | Cells with validation errors | Paired with `aria-describedby` pointing to error tooltip        |
| `aria-label`           | Alert status cells           | Full status text (e.g., "Over capacity at 105.2%")              |

### 11.2 Chart Accessibility

| Property      | Implementation                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `role="img"`  | On chart container                                                                                                             |
| `aria-label`  | "Historical enrollment trends chart showing 5-year data by grade band"                                                         |
| Keyboard      | Tab to chart, arrow keys to move between data points                                                                           |
| Screen reader | `<desc>` element with text summary: "Enrollment trends from 2021-22 to 2025-26. Total students: 1,523 (2025-26). CAGR: +2.1%." |

### 11.3 Focus Management

- On tab switch: focus moves to first editable cell in the new tab's grid
- On Calculate completion: focus returns to Calculate button
- On CSV import panel open: focus moves to Academic Year selector
- On CSV import panel close: focus returns to More menu trigger

### 11.4 Color Independence

All status indicators (delta flags, match status, capacity alerts) use icon + text label in addition to color. Traffic light alerts use distinct shapes (triangle, circle, arrow, checkmark) not just color.

---

## 12. Error Scenarios

### 12.1 API Errors

Standard error handling per Section 9 of 00-global-framework.md applies. Module-specific errors:

| Error                             | Status | Code                    | UI Response                                                                                                |
| --------------------------------- | ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Negative headcount                | 422    | `NEGATIVE_HEADCOUNT`    | Inline cell error: "Headcount must be >= 0"                                                                |
| Stage 2 mismatch                  | 422    | `STAGE2_TOTAL_MISMATCH` | Inline group error on affected grades + toast: "Nationality totals do not match grade totals for X grades" |
| Version locked                    | 409    | `VERSION_LOCKED`        | Read-only banner + toast: "Version is locked"                                                              |
| Missing prerequisites (calculate) | 422    | `MISSING_PREREQUISITES` | Toast: "Enter enrollment data before running capacity calculation"                                         |
| Optimistic lock conflict          | 409    | `OPTIMISTIC_LOCK`       | Conflict resolution dialog per Section 6.3 of framework                                                    |

### 12.2 Client-Side Validation

| Rule                 | Trigger                  | Message                                                  |
| -------------------- | ------------------------ | -------------------------------------------------------- |
| Non-negative integer | On cell blur             | "Headcount must be a non-negative integer"               |
| Max value 9999       | On cell blur             | "Headcount cannot exceed 9,999"                          |
| Stage 2 sum mismatch | On cell blur (real-time) | "Nationality total (XX) does not match grade total (YY)" |
| Empty required field | On Calculate attempt     | "Enter headcount for all grades before calculating"      |

### 12.3 Empty States

| Scenario                   | Display                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New version, no enrollment | Empty state (Section 4.8 of framework): icon `Users` (Lucide), heading "No enrollment data yet", description "Enter student headcounts by grade to begin planning.", action "Start Entering Data" (focuses first editable cell) |
| No historical data         | Chart empty state (Section 7.4 above)                                                                                                                                                                                           |
| Calculate not yet run      | Capacity columns show "--" with muted text and tooltip "Run Calculate to see capacity data"                                                                                                                                     |

---

## 13. Cross-References

### 13.1 PRD Traceability

| FR         | Section       | Implementation                                                                                    |
| ---------- | ------------- | ------------------------------------------------------------------------------------------------- |
| FR-ENR-001 | 7.0, 7.2      | 5-year historical chart with line per band                                                        |
| FR-ENR-002 | 9.0           | CSV import via side panel, two-phase validate/commit                                              |
| FR-ENR-003 | 7.2           | Line chart with year-over-year comparison                                                         |
| FR-ENR-004 | 7.3           | CAGR and moving average annotations on chart                                                      |
| FR-ENR-005 | 4.0, 5.0, 6.0 | Three-tab layout: Stage 1 (By Grade), Stage 2 (By Nationality, By Tariff)                         |
| FR-ENR-006 | 5.0           | Nationality segments: Francais, Nationaux, Autres                                                 |
| FR-ENR-007 | 6.0           | Tariff categories: RP, R3+, Plein                                                                 |
| FR-ENR-008 | 4.4           | Delta vs Prior Year with +/-10% flagging                                                          |
| FR-ENR-009 | 4.1           | AY1 and AY2 columns in all grids                                                                  |
| FR-ENR-010 | —             | COULD: Cohort progression modeling (deferred, not in initial spec)                                |
| FR-ENR-011 | —             | COULD: Lateral entry weight parameter (deferred)                                                  |
| FR-ENR-012 | —             | COULD: Manual PS intake for AY2 (deferred)                                                        |
| FR-ENR-013 | 4.5           | Historical context columns (N-2, N-1) alongside headcount                                         |
| FR-CAP-001 | 4.6           | Sections Needed = CEILING(headcount / max_class_size)                                             |
| FR-CAP-002 | 4.6           | Three-tier thresholds: Plancher 70%, Cible 85%, Plafond 100%                                      |
| FR-CAP-003 | 4.6           | Utilization % column with inline progress bar                                                     |
| FR-CAP-004 | 4.6           | Traffic-light alerts: OVER (red), OK (green), UNDER (amber)                                       |
| FR-CAP-005 | —             | Recruitment slot calculation (derived from Plafond - Current; shown in tooltip on capacity cells) |
| FR-CAP-006 | 4.2           | Max class size per band: Maternelle 24, Elementaire 26, College/Lycee 30                          |
| FR-CAP-007 | 4.6           | NEAR_CAP warning at >95% utilization                                                              |

### 13.2 API Endpoints Used

| Endpoint                                    | Method | Section  | Purpose                             |
| ------------------------------------------- | ------ | -------- | ----------------------------------- |
| `/versions/:versionId/enrollment/headcount` | GET    | 4.0      | Load Stage 1 data                   |
| `/versions/:versionId/enrollment/headcount` | PUT    | 4.3      | Save Stage 1 edits                  |
| `/versions/:versionId/enrollment/detail`    | GET    | 5.0, 6.0 | Load Stage 2 data                   |
| `/versions/:versionId/enrollment/detail`    | PUT    | 5.4, 6.0 | Save Stage 2 edits                  |
| `/enrollment/historical`                    | GET    | 7.2, 4.5 | Historical trends + N-2/N-1 context |
| `/enrollment/historical/import`             | POST   | 9.0      | CSV import (validate + commit)      |
| `/versions/:versionId/calculate/enrollment` | POST   | 8.0      | Run capacity calculation            |

### 13.3 Design Token References

All tokens reference 00-global-framework.md Section 1:

| Usage                    | Token                   | Value                        |
| ------------------------ | ----------------------- | ---------------------------- |
| Editable cell background | `--cell-editable-bg`    | #FEFCE8 (yellow-50)          |
| Focused cell border      | `--cell-editable-focus` | #2563EB (blue-600)           |
| Error cell border        | `--cell-error-border`   | #DC2626 (red-600)            |
| Success status           | `--color-success`       | #16A34A (green-600)          |
| Warning status           | `--color-warning`       | #D97706 (amber-600)          |
| Error status             | `--color-error`         | #DC2626 (red-600)            |
| Muted text               | `--text-muted`          | #94A3B8 (slate-400)          |
| Monospace font           | `--font-mono`           | JetBrains Mono, ui-monospace |
| Grid row height          | —                       | 36px                         |
| Grid alternating rows    | `--workspace-bg-subtle` | #F8FAFC (slate-50)           |
| Stale indicator          | `--color-stale`         | #F59E0B (amber-500)          |

### 13.4 Shared Components Used

| Component                     | Framework Section | Module Usage                           |
| ----------------------------- | ----------------- | -------------------------------------- |
| Data Grid (TanStack Table v8) | 4.1               | All three tab grids                    |
| Cell Editors (integer type)   | 4.2               | Headcount input cells                  |
| Inline Validation             | 4.3               | Cell-level error display               |
| Side Panel                    | 4.4               | CSV import panel                       |
| Module Toolbar                | 4.5               | Calculate, Export, More menu           |
| Toast Notifications           | 4.6               | Save, calculate, import feedback       |
| Confirmation Dialog           | 4.7               | Duplicate year import confirmation     |
| Empty State                   | 4.8               | No enrollment data, no historical data |
| Loading State                 | 4.9               | Skeleton grid during data fetch        |
| Read-Only Indicator           | 4.10              | Locked/Archived version banner         |
