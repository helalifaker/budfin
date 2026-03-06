# BudFin UI/UX Specification: P&L & Reporting

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Parent:** [00-global-framework.md](./00-global-framework.md)
> **PRD Trace:** FR-PNL-001 through FR-PNL-018
> **Route:** `/planning/pnl`

---

## 1. Purpose & Personas

### 1.1 Module Purpose

The P&L & Reporting module presents a consolidated IFRS Income Statement built from upstream Revenue and Staffing calculations. It is a **read-only reporting view** -- there are no inline-editable cells. All data originates from the calculation engine via `POST /versions/:versionId/calculate/pnl`.

### 1.2 Target Personas

| Persona          | Primary Actions                                                       | Notes                                    |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Budget Owner     | Review consolidated P&L, compare versions, approve/reject, export     | Full access to all views and exports     |
| Budget Analyst   | Trigger P&L calculation, review results, prepare exports for review   | Cannot publish/lock versions             |
| External Auditor | Read-only inspection of P&L figures, export for external verification | All cells read-only; no Calculate button |

### 1.3 Key Interactions

- Triggering P&L consolidation (Calculate button)
- Expanding/collapsing IFRS row groups
- Activating comparison mode for variance analysis
- Switching between summary/detailed/IFRS format views
- Exporting to xlsx, pdf, or csv

---

## 2. Layout & Structure

### 2.1 Page Layout

The module renders inside PlanningShell and follows the PlanningShell Module Template (Global Framework Section 12.1). The context bar and docked right panel are managed by the shell.

```
+--------+--------------------------------------------------------------+
|        | Module Toolbar (48px)                                        |
|        | [P&L & Reporting]  [Format Toggle]  [Calculate] [Export] [...] |
| Side-  +--------------------------------------------------------------+
| bar    | KPI Summary Strip (optional, 80px)                           |
|        +--------------------------------------------------------------+
|        |                                                              |
|        |              IFRS Income Statement Grid                      |
|        |          (TanStack Table v8 — no virtual scrolling, ADR-016) |
|        |                                                              |
|        |   Row Label | Jan | Feb | ... | Dec | Annual Total          |
|        |                                                              |
+--------+--------------------------------------------------------------+
```

**Auto-close panel on comparison:** When comparison mode is toggled ON in the context bar, the docked right panel auto-closes to maximize horizontal viewport for the variance columns. The user can manually re-open the panel if desired.

### 2.2 Module Toolbar

Extends the standard toolbar (Global Framework Section 4.5) with P&L-specific controls.

| Position | Element          | Component                           | Behavior                                              |
| -------- | ---------------- | ----------------------------------- | ----------------------------------------------------- |
| Left     | Module title     | `<h1>` `--text-xl` weight 600       | Static text: "P&L & Reporting"                        |
| Center   | Format toggle    | `<ToggleGroup>` (shadcn/ui, single) | Options: Summary, Detailed, IFRS. Default: IFRS       |
| Right    | Calculate button | `<CalculateButton>`                 | Triggers `POST /versions/:versionId/calculate/pnl`    |
| Right    | Export dropdown  | `<DropdownMenu>` (shadcn/ui)        | Options: Export as xlsx, Export as pdf, Export as csv |
| Right    | More menu        | `<DropdownMenu>` (shadcn/ui)        | Overflow: Print preview                               |

**Format toggle detail:**

| Option   | API `format` param | Row depth                       | Description                                             |
| -------- | ------------------ | ------------------------------- | ------------------------------------------------------- |
| Summary  | `summary`          | Top-level subtotals only        | Total Revenue, EBITDA, Operating Profit, Net Profit     |
| Detailed | `detailed`         | Intermediate groups + subtotals | Revenue by category, expense by category, all subtotals |
| IFRS     | `ifrs`             | Full hierarchy with leaf rows   | All line items including tuition by grade x tariff      |

### 2.3 KPI Summary Strip

Displayed above the grid when data is loaded. Background: `--workspace-bg-muted`. Height: 80px. Padding: `--space-4`.

```
+-----------------------------------------------------------------------+
| Total Revenue HT    |  EBITDA        |  EBITDA Margin  |  Net Profit  |
| SAR 42,350,000.00   |  8,750,000.00  |  20.7%          |  6,125,000.00|
| [version-type badge] |  [sparkline]   |  [color coded]  |  [color]     |
+-----------------------------------------------------------------------+
```

| KPI Card         | Source Field                               | Format                                       | Color Logic                                                                      |
| ---------------- | ------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------- |
| Total Revenue HT | `annual_totals.total_revenue_ht`           | `--font-mono`, `--text-2xl`, 2 decimals      | `--text-primary` always                                                          |
| EBITDA           | `annual_totals.ebitda`                     | `--font-mono`, `--text-2xl`, 2 decimals      | `--color-success` if positive, `--color-error` if negative                       |
| EBITDA Margin    | Derived: `ebitda / total_revenue_ht * 100` | `--font-mono`, `--text-2xl`, 1 decimal + "%" | `--color-success` if >= 15%, `--color-warning` if 5-15%, `--color-error` if < 5% |
| Net Profit       | `annual_totals.net_profit`                 | `--font-mono`, `--text-2xl`, 2 decimals      | `--color-success` if positive, `--color-error` if negative                       |

When comparison mode is active, each KPI card shows a delta badge below the value:

- Badge format: `+1,250,000.00 (+3.2%)` or `(1,250,000.00) (-3.2%)`
- Badge color: `--color-success` for favorable, `--color-error` for unfavorable

---

## 3. IFRS Income Statement Grid

### 3.1 Grid Technology

| Property       | Value                                                                            |
| -------------- | -------------------------------------------------------------------------------- |
| Library        | `@tanstack/react-table` v8 (headless)                                            |
| Virtualization | None — native DOM rendering (ADR-016); P&L row count bounded to ≤ 300 rows in v1 |
| Row model      | Expanding row model for hierarchical groups                                      |
| Column pinning | First column (Row Label) pinned left                                             |
| Editing        | None -- all cells are read-only (`aria-readonly="true"`)                         |

### 3.2 Row Hierarchy

The grid uses a hierarchical row structure with three depth levels. Rows use `aria-level` for accessibility and `aria-expanded` for expandable group rows.

#### Level 1: Top-Level Groups

| Row Label                                       | Row Type                  | Style                                                                                                              |
| ----------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Revenue from Contracts with Customers (IFRS 15) | Group header (expandable) | `--text-sm` weight 600, `--workspace-bg-muted` background                                                          |
| Rental Income                                   | Leaf row                  | `--text-sm` weight 400                                                                                             |
| **Total Revenue (HT)**                          | **Subtotal**              | **`--text-sm` weight 700, `--workspace-bg-muted` background, top border 2px `--workspace-border-strong`**          |
| Operating Expenses                              | Group header (expandable) | `--text-sm` weight 600, `--workspace-bg-muted` background                                                          |
| **EBITDA**                                      | **Subtotal**              | **`--text-sm` weight 700, `--workspace-bg-muted` background, top border 2px `--workspace-border-strong`**          |
| **Operating Profit**                            | **Subtotal**              | **`--text-sm` weight 700, `--workspace-bg-muted` background**                                                      |
| Finance Income                                  | Leaf row                  | `--text-sm` weight 400                                                                                             |
| Finance Costs                                   | Leaf row                  | `--text-sm` weight 400                                                                                             |
| **Net Finance Income / (Cost)**                 | **Subtotal**              | **`--text-sm` weight 700, `--workspace-bg-muted` background**                                                      |
| **Profit / (Loss) Before Zakat**                | **Subtotal**              | **`--text-sm` weight 700, `--workspace-bg-muted` background, top border 2px `--workspace-border-strong`**          |
| Estimated Zakat (2.5%)                          | Leaf row                  | `--text-sm` weight 400, `--text-secondary` color                                                                   |
| **Net Profit / (Loss)**                         | **Grand total**           | **`--text-sm` weight 700, `--workspace-bg-muted` background, top + bottom border 2px `--workspace-border-strong`** |

#### Level 2: Category Groups (inside expandable Level 1)

Inside "Revenue from Contracts with Customers":

| Row Label                           | Row Type                  | FR Trace   |
| ----------------------------------- | ------------------------- | ---------- |
| Tuition Fees                        | Group header (expandable) | FR-PNL-007 |
| Registration & Re-registration Fees | Leaf row                  | FR-PNL-007 |
| Activities & Services               | Leaf row                  | FR-PNL-007 |
| Examination Fees                    | Leaf row                  | FR-PNL-007 |
| **Revenue from Contracts Subtotal** | **Category subtotal**     | FR-PNL-008 |

Inside "Operating Expenses":

| Row Label                   | Row Type | FR Trace   |
| --------------------------- | -------- | ---------- |
| Staff Costs                 | Leaf row | FR-PNL-010 |
| Other Operating Expenses    | Leaf row | FR-PNL-010 |
| Depreciation & Amortization | Leaf row | FR-PNL-010 |
| Impairment (IFRS 9 ECL)     | Leaf row | FR-PNL-010 |

#### Level 3: Leaf Detail (inside Tuition Fees)

Tuition fee rows are broken down by grade level x tariff category (FR-PNL-017):

| Row Label                   | Notes                           |
| --------------------------- | ------------------------------- |
| Maternelle -- Tarif Reduit  | Grade band + tariff combination |
| Maternelle -- Tarif Plein   |                                 |
| Elementaire -- Tarif Reduit |                                 |
| Elementaire -- Tarif Plein  |                                 |
| College -- Tarif Reduit     |                                 |
| College -- Tarif Plein      |                                 |
| Lycee -- Tarif Reduit       |                                 |
| Lycee -- Tarif Plein        |                                 |

These leaf rows are only visible in **IFRS** format mode. In **Detailed** mode, only the "Tuition Fees" subtotal row is shown. In **Summary** mode, only "Total Revenue (HT)" is shown.

### 3.3 Column Structure

#### Standard Mode (No Comparison)

| Column           | Width                  | Alignment | Font                                   | Pinned     | Description                    |
| ---------------- | ---------------------- | --------- | -------------------------------------- | ---------- | ------------------------------ |
| Row Label        | 320px (min), resizable | Left      | `--font-family`, `--text-xs`           | Yes (left) | Row name with indent per level |
| Jan              | 110px                  | Right     | `--font-mono`, `--text-xs`             | No         | January value                  |
| Feb              | 110px                  | Right     | `--font-mono`, `--text-xs`             | No         | February value                 |
| ...              | 110px each             | Right     | `--font-mono`, `--text-xs`             | No         | Mar through Nov                |
| Dec              | 110px                  | Right     | `--font-mono`, `--text-xs`             | No         | December value                 |
| **Annual Total** | 130px                  | Right     | `--font-mono`, `--text-xs`, weight 600 | No         | Sum of 12 months               |

**Row label indentation:** 0px for level 1, 20px for level 2, 40px for level 3. Chevron icon (Lucide `ChevronRight` / `ChevronDown`) shown for expandable rows, positioned before the indent.

#### Comparison Mode (Variance Columns)

When comparison mode is active (Context Bar toggle ON + comparison version selected), each month column expands into three sub-columns:

| Sub-column     | Width | Content                  | Style                                     |
| -------------- | ----- | ------------------------ | ----------------------------------------- | ----- | ---------------------------------------------------------- |
| Primary Value  | 110px | Current version value    | Normal text color                         |
| Variance (Abs) | 90px  | Primary - Comparison     | `--font-mono`, colored per variance logic |
| Variance (%)   | 70px  | (Primary - Comparison) / | Comparison                                | x 100 | `--font-mono`, colored per variance logic, 1 decimal + "%" |

**Variance color logic** (per Global Framework Section 7.1):

| Row Category  | Positive Delta                                                                                   | Negative Delta                | Zero           |
| ------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- | -------------- |
| Revenue rows  | `--color-success` (favorable)                                                                    | `--color-error` (unfavorable) | `--text-muted` |
| Expense rows  | `--color-error` (unfavorable)                                                                    | `--color-success` (favorable) | `--text-muted` |
| Subtotal rows | Inherit from category (revenue subtotals use revenue logic, expense subtotals use expense logic) |                               |                |
| Net Profit    | `--color-success` (favorable)                                                                    | `--color-error` (unfavorable) | `--text-muted` |

**Comparison version column header:** Shows version name in `--text-secondary` with the version type badge color as a 3px top border on variance sub-columns.

### 3.4 Cell Formatting Rules

All values in SAR HT (FR-PNL-018). Follows Global Framework numeric display rules (Section 1.2):

| Rule                  | Format                                         | Example             |
| --------------------- | ---------------------------------------------- | ------------------- |
| Positive values       | Right-aligned, thousands separator, 2 decimals | `1,250,000.00`      |
| Negative values       | Parentheses, `--color-error`                   | `(125,000.00)`      |
| Zero values           | Display as `0.00`                              | `0.00`              |
| Null / not applicable | Display as `--` in `--text-muted`              | `--`                |
| Subtotal cells        | Weight 600                                     | `**42,350,000.00**` |
| Grand total cells     | Weight 700                                     | `**42,350,000.00**` |

### 3.5 Row Styling

| Row Type                  | Background              | Font Weight | Borders                                       | Height |
| ------------------------- | ----------------------- | ----------- | --------------------------------------------- | ------ |
| Group header (expandable) | `--workspace-bg-muted`  | 600         | Bottom: 1px `--workspace-border`              | 36px   |
| Leaf row (odd)            | `--workspace-bg`        | 400         | Bottom: 1px `--workspace-border`              | 36px   |
| Leaf row (even)           | `--workspace-bg-subtle` | 400         | Bottom: 1px `--workspace-border`              | 36px   |
| Subtotal row              | `--workspace-bg-muted`  | 700         | Top: 2px `--workspace-border-strong`          | 36px   |
| Grand total row           | `--workspace-bg-muted`  | 700         | Top + Bottom: 2px `--workspace-border-strong` | 40px   |
| Separator (visual only)   | Transparent             | --          | Top: 1px dashed `--workspace-border`          | 8px    |

Separator rows appear above Total Revenue, EBITDA, Operating Profit, Net Finance Income/(Cost), Profit Before Zakat, and Net Profit to visually delineate sections.

---

## 4. Calculate Workflow

### 4.1 Calculate Button

Follows the standard Calculate Button states from Global Framework Section 4.5.

| State   | Appearance                                                                   | Behavior                        |
| ------- | ---------------------------------------------------------------------------- | ------------------------------- |
| Default | `<Button variant="default">` with calculator icon + "Calculate P&L" label    | Clickable                       |
| Stale   | Amber pulsing dot on button; tooltip: "Revenue or Staffing data has changed" | Draws attention                 |
| Running | `<Button disabled>` with spinner + "Calculating..."                          | Blocks interaction              |
| Success | Green check flash (2s) + toast                                               | Auto-resets to Default          |
| Error   | Red badge + "Failed" label                                                   | Clickable to show error details |

**RBAC:** Hidden for Viewer role. Disabled (with tooltip "Version is locked") for Locked/Archived versions.

### 4.2 Prerequisite Check

Before executing `POST /versions/:versionId/calculate/pnl`, the UI checks `GET /versions/:versionId/stale-flags`.

**If prerequisites are stale (REVENUE or STAFFING is `true`):**

1. API returns `422 STALE_PREREQUISITES` with `stale_modules` array
2. UI shows a **blocking dialog**:

```
+----------------------------------------------------+
|  Prerequisites Outdated                             |
|                                                     |
|  The following modules need recalculation before    |
|  P&L can be consolidated:                           |
|                                                     |
|  [!] Revenue -- last calculated 2 hours ago         |
|  [!] Staffing -- last calculated 1 day ago          |
|                                                     |
|  Navigate to each module and click Calculate to     |
|  update their results first.                        |
|                                                     |
|  [Go to Revenue]  [Go to Staffing]  [Dismiss]       |
+----------------------------------------------------+
```

| Property           | Value                                                          |
| ------------------ | -------------------------------------------------------------- |
| Component          | shadcn/ui `<AlertDialog>`                                      |
| Width              | 480px                                                          |
| Icon               | Lucide `AlertTriangle`, `--color-warning`                      |
| Navigation buttons | `<Button variant="outline">` that navigate to the stale module |
| Dismiss            | `<Button variant="ghost">` closes dialog without action        |

### 4.3 Successful Calculation

On `200` response from `POST /versions/:versionId/calculate/pnl`:

1. Calculate button shows green check flash (2 seconds)
2. Toast notification (success variant):
    - Title: "P&L Calculated"
    - Description: "Total Revenue: [total_revenue_ht] SAR | Net Profit: [net_profit] SAR | EBITDA Margin: [ebitda_margin_pct]%"
3. Grid data auto-refreshes via TanStack Query invalidation of key `['pnl', versionId]`
4. KPI strip updates with new values
5. Stale indicator in Context Bar clears for PNL module

### 4.4 Calculation Error

On error response:

| Error                     | UI Response                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 422 `STALE_PREREQUISITES` | Prerequisite dialog (Section 4.2)                                                                           |
| 409 `VERSION_LOCKED`      | Banner: "This version is locked" (Global Framework Section 9.1)                                             |
| 500 server error          | Toast (error variant): "P&L calculation failed. Please try again." + Calculate button shows red error badge |

---

## 5. Comparison Mode

Comparison mode is activated via the Context Bar's comparison toggle (Global Framework Section 3.1.3). No P&L-specific toggle is needed.

### 5.1 API Integration

When comparison is active, the grid fetches:

```
GET /versions/:versionId/pnl?format=ifrs&comparison_version_id=<comparisonId>
```

The response includes a `comparison` object with identical structure to the primary data.

### 5.2 Visual Behavior

1. Each month column splits into three sub-columns (Section 3.3)
2. Annual Total column also gains variance sub-columns
3. KPI strip shows delta badges (Section 2.3)
4. Column header row gains a thin colored bar using the comparison version's type color (3px top border)
5. Comparison version name shown in the Annual Total header area in `--text-secondary`

### 5.3 Column Width Management

In comparison mode, the total grid width increases significantly. Horizontal scrolling is expected. The Row Label column remains pinned left. The Annual Total + variance columns can optionally be pinned right for quick reference.

| Mode                            | Total Grid Width (approx.)       | Scroll                     |
| ------------------------------- | -------------------------------- | -------------------------- |
| Standard (13 value columns)     | 320 + (12 x 110) + 130 = 1,770px | Minimal                    |
| Comparison (13 x 3 sub-columns) | 320 + (12 x 270) + 270 = 3,830px | Horizontal scroll required |

**Viewport guidance:** At viewports below 1920px with comparison mode active, the grid may require significant horizontal scrolling. Consider:

- Month headers condense to 3-letter abbreviations (already used)
- Variance (%) sub-column can be hidden via column visibility toggle (reduces width by ~840px)
- A toolbar chip shows: "Comparison mode -- wide view recommended"

---

## 6. Export

### 6.1 Export Dropdown

Located in the module toolbar. Component: shadcn/ui `<DropdownMenu>`.

| Menu Item               | Icon                     | Action                                      |
| ----------------------- | ------------------------ | ------------------------------------------- |
| Export as Excel (.xlsx) | Lucide `FileSpreadsheet` | Triggers async export with `format: "xlsx"` |
| Export as PDF (.pdf)    | Lucide `FileText`        | Triggers async export with `format: "pdf"`  |
| Export as CSV (.csv)    | Lucide `FileDown`        | Triggers async export with `format: "csv"`  |

**Keyboard shortcut:** `Ctrl+E` opens the export dropdown (Global Framework Section 5.2).

### 6.2 Async Export Flow

All exports use the async job pattern (TDD Section 6.3.8).

**Step 1: Create job**

```
POST /api/v1/export/jobs
{
  "version_id": <currentVersionId>,
  "format": "xlsx|pdf|csv",
  "report_type": "PNL_MONTHLY"
}
```

**Step 2: Show progress toast**

On `202` response, show a persistent toast notification:

| Property    | Value                                                       |
| ----------- | ----------------------------------------------------------- |
| Variant     | `info`                                                      |
| Title       | "Exporting P&L..."                                          |
| Description | Progress bar showing `progress_pct` from polling            |
| Duration    | Persistent (no auto-dismiss) until complete or failed       |
| Action      | "Cancel" button (no cancel API -- just dismisses the toast) |

**Step 3: Poll status**

```
GET /api/v1/export/jobs/:id
```

Poll every 2 seconds. Update the progress bar in the toast.

**Step 4: Download ready**

When `status: "done"`:

1. Toast updates to success variant: "P&L export ready"
2. Toast shows "Download" button
3. Clicking Download triggers: `GET /api/v1/export/jobs/:id/download`
4. Browser handles file download via `Content-Disposition: attachment`
5. Toast auto-dismisses 5 seconds after download starts

**Step 5: Export failure**

When `status: "failed"`:

1. Toast updates to error variant: "Export failed: [error_message]"
2. Toast shows "Retry" button that re-triggers Step 1
3. Toast auto-dismisses after 10 seconds or on manual dismiss

### 6.3 PDF Rendering Notes

PDF exports use `@react-pdf/renderer` v4.3 server-side rendering (ADR-014). The exported PDF matches the current grid state:

- Respects the active format mode (summary/detailed/IFRS)
- Includes comparison columns if comparison mode is active
- Header: version name, fiscal year, generation timestamp
- Footer: page numbers, "Generated by BudFin" watermark
- Paper size: A3 landscape (to accommodate 12 month columns)

---

## 7. State Management

### 7.1 Server State (TanStack Query)

| Query Key                                  | Endpoint                                                        | Stale Time   | Notes                                             |
| ------------------------------------------ | --------------------------------------------------------------- | ------------ | ------------------------------------------------- |
| `['pnl', versionId, format]`               | `GET /versions/:versionId/pnl?format=X`                         | 30s          | Primary P&L data                                  |
| `['pnl', versionId, format, comparisonId]` | `GET /versions/:versionId/pnl?format=X&comparison_version_id=Y` | 30s          | Comparison data                                   |
| `['stale-flags', versionId]`               | `GET /versions/:versionId/stale-flags`                          | 10s          | Drives stale indicator and Calculate button state |
| `['export-job', jobId]`                    | `GET /export/jobs/:id`                                          | 2s (polling) | Only active during export                         |

**Invalidation triggers:**

- After successful `POST /calculate/pnl`: invalidate `['pnl', versionId, *]` and `['stale-flags', versionId]`
- On version change in Context Bar: invalidate all `['pnl', *]` queries
- On FY change in Context Bar: invalidate all queries

### 7.2 Client State (Zustand)

```typescript
interface PnlGridStore {
    // Format mode
    format: 'summary' | 'detailed' | 'ifrs';
    setFormat: (format: PnlGridStore['format']) => void;

    // Row expansion state (keyed by row ID)
    expandedRows: Record<string, boolean>;
    toggleRow: (rowId: string) => void;
    expandAll: () => void;
    collapseAll: () => void;

    // Column visibility (used when comparison mode changes layout)
    showVarianceAbsolute: boolean;
    showVariancePercent: boolean;

    // Sort (typically not used in P&L but available)
    sortColumn: string | null;
    sortDirection: 'asc' | 'desc' | null;
}
```

### 7.3 URL State

P&L-specific URL parameters (appended to Context Bar params):

```
/planning/pnl?fy=2026&version=42&compare=38&period=full&scenario=base&format=ifrs
```

| Param    | Values                        | Default | Synced to             |
| -------- | ----------------------------- | ------- | --------------------- |
| `format` | `summary`, `detailed`, `ifrs` | `ifrs`  | `PnlGridStore.format` |

---

## 8. RBAC Behavior

Per Global Framework Section 8 and the role matrix:

| UI Element        | Admin   | BudgetOwner | Editor  | Viewer  |
| ----------------- | ------- | ----------- | ------- | ------- |
| View P&L grid     | Yes     | Yes         | Yes     | Yes     |
| KPI summary strip | Yes     | Yes         | Yes     | Yes     |
| Calculate button  | Visible | Visible     | Visible | Hidden  |
| Export dropdown   | Visible | Visible     | Visible | Visible |
| Format toggle     | Visible | Visible     | Visible | Visible |
| Comparison mode   | Yes     | Yes         | Yes     | Yes     |
| More menu         | Visible | Visible     | Visible | Visible |

**External Auditor note:** External Auditors authenticate as Viewer role. They can view all P&L data in any format, activate comparison mode, and export. They cannot trigger calculations.

**Locked/Archived version:** Calculate button disabled with tooltip "Version is locked". All other read-only interactions remain available.

---

## 9. Empty & Loading States

### 9.1 Empty State

Shown when `GET /versions/:versionId/pnl` returns no data (no calculation has been run yet for this version).

| Property       | Value                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Icon           | Lucide `Calculator`, 48px, `--text-muted`                                                                                       |
| Heading        | "No P&L data yet" (`--text-lg`, `--text-secondary`)                                                                             |
| Description    | "Run the P&L calculation to consolidate revenue and staffing data into an IFRS Income Statement." (`--text-sm`, `--text-muted`) |
| Action         | `<Button variant="default">` "Calculate P&L" (triggers same flow as toolbar Calculate button)                                   |
| Secondary text | "Make sure Revenue and Staffing modules are calculated first." (`--text-xs`, `--text-muted`)                                    |

**RBAC:** For Viewer role, the action button is hidden. Description changes to: "P&L data has not been calculated for this version yet. Contact a Budget Analyst to run the calculation."

### 9.2 Loading State

| State             | Display                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial load      | Skeleton grid: 15 skeleton rows (matching expected P&L row count), 13 skeleton columns. KPI strip shows 4 skeleton cards. 200ms delay before showing. |
| Format switch     | Skeleton overlay on grid area only (KPI strip retains values). Faster transition since data shape changes.                                            |
| Comparison toggle | Skeleton overlay on grid. KPI strip shows skeleton delta badges.                                                                                      |
| Calculate running | Grid retains current data. Calculate button shows spinner. Toast shows progress. Grid refreshes on completion.                                        |

### 9.3 Stale Data Indicator

When `GET /versions/:versionId/stale-flags` returns `PNL: true`:

1. Context Bar stale indicator (Global Framework Section 3.1.7) shows amber warning
2. Calculate button enters "Stale" state (amber pulsing dot)
3. A subtle banner appears above the grid:

| Property   | Value                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| Background | `--color-warning-bg`                                                                     |
| Height     | 32px                                                                                     |
| Icon       | Lucide `AlertTriangle`, `--color-warning`                                                |
| Text       | "P&L data may be outdated. Click Calculate to refresh." (`--text-sm`, `--color-warning`) |
| Dismiss    | X button to dismiss (persists until next calculation or page reload)                     |

---

## 10. Accessibility

### 10.1 Grid ARIA Roles

The IFRS Income Statement grid follows Global Framework Section 10.2 with P&L-specific additions:

| ARIA Attribute        | Element                       | Value                                        |
| --------------------- | ----------------------------- | -------------------------------------------- |
| `role="grid"`         | Table container               | --                                           |
| `role="row"`          | Each row                      | --                                           |
| `role="columnheader"` | Header cells                  | --                                           |
| `role="gridcell"`     | Data cells                    | --                                           |
| `aria-readonly`       | All data cells                | `"true"` (P&L is read-only)                  |
| `aria-level`          | Group header rows (level 1)   | `"1"`                                        |
| `aria-level`          | Category rows (level 2)       | `"2"`                                        |
| `aria-level`          | Detail rows (level 3)         | `"3"`                                        |
| `aria-expanded`       | Expandable group rows         | `"true"` / `"false"`                         |
| `aria-label`          | Grid container                | `"IFRS Income Statement for [version name]"` |
| `aria-live="polite"`  | KPI summary strip             | Announces updated values after calculation   |
| `aria-busy`           | Grid container during loading | `"true"`                                     |

### 10.2 Keyboard Navigation

Standard grid navigation (Global Framework Section 5.1) applies. Additional P&L-specific keys:

| Key                         | Action                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `Space` on group header row | Toggle expand/collapse                                                                          |
| `Ctrl+Shift+E`              | Expand all groups                                                                               |
| `Ctrl+Shift+C`              | Collapse all groups (note: conflicts with comparison shortcut; active only when grid has focus) |
| `Arrow Left/Right`          | Navigate between month columns                                                                  |
| `Home`                      | Jump to Row Label column                                                                        |
| `End`                       | Jump to Annual Total column                                                                     |

### 10.3 Screen Reader Announcements

| Event                | Announcement                                                  |
| -------------------- | ------------------------------------------------------------- |
| Group expanded       | "[Group name] expanded, [N] child rows"                       |
| Group collapsed      | "[Group name] collapsed"                                      |
| Format changed       | "Showing [format] view"                                       |
| Calculation complete | "P&L calculation complete. Net Profit: [value] SAR"           |
| Export started       | "Exporting P&L as [format]. You will be notified when ready." |
| Export complete      | "P&L export ready for download"                               |

---

## 11. FR Traceability Matrix

| FR ID      | Requirement                                                        | UI Element                                                    | Section                                 |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------- |
| FR-PNL-001 | Monthly P&L using IFRS Function of Expense (IAS 1)                 | IFRS Income Statement Grid, 12 month columns + annual total   | 3.1, 3.2, 3.3                           |
| FR-PNL-002 | Revenue section with IFRS 15 classification                        | Revenue from Contracts group rows                             | 3.2 (Level 1, Level 2)                  |
| FR-PNL-003 | Expense section: cost of sales + operating expenses                | Operating Expenses group rows                                 | 3.2 (Level 2 inside Operating Expenses) |
| FR-PNL-004 | Key subtotals: Total Revenue, EBITDA, Operating Profit, Net Result | Subtotal and grand total rows                                 | 3.2 (Level 1 subtotal rows)             |
| FR-PNL-005 | Auto-consolidation from Revenue + Staff Costs                      | Calculate button triggers POST /calculate/pnl                 | 4.1, 4.3                                |
| FR-PNL-006 | Version comparison overlay with variance columns                   | Comparison mode sub-columns                                   | 3.3, 5.1, 5.2                           |
| FR-PNL-007 | Revenue line items by level and tariff                             | Tuition Fees, Registration Fees, Activities, Examination rows | 3.2 (Level 2)                           |
| FR-PNL-008 | Revenue from Contracts subtotal (IFRS 15)                          | Revenue from Contracts Subtotal row                           | 3.2 (Level 2 subtotal)                  |
| FR-PNL-009 | Rental income separated per IAS 1                                  | Rental Income leaf row at Level 1                             | 3.2 (Level 1)                           |
| FR-PNL-010 | Operating Expense line items                                       | Staff Costs, Other OpEx, D&A, Impairment rows                 | 3.2 (Level 2 inside Operating Expenses) |
| FR-PNL-011 | Finance section (income + costs)                                   | Finance Income and Finance Costs leaf rows                    | 3.2 (Level 1)                           |
| FR-PNL-012 | Net Finance Income/(Cost) subtotal                                 | Net Finance Income / (Cost) subtotal row                      | 3.2 (Level 1 subtotal)                  |
| FR-PNL-013 | Profit/(Loss) Before Zakat                                         | Profit / (Loss) Before Zakat subtotal row                     | 3.2 (Level 1 subtotal)                  |
| FR-PNL-014 | Zakat at 2.5% on positive profit                                   | Estimated Zakat (2.5%) leaf row                               | 3.2 (Level 1)                           |
| FR-PNL-015 | Net Profit/(Loss) final line                                       | Net Profit / (Loss) grand total row                           | 3.2 (Level 1 grand total)               |
| FR-PNL-016 | Detailed IFRS reclassification mapping                             | IFRS format mode with full hierarchy                          | 2.2, 3.2                                |
| FR-PNL-017 | Tuition fee detail by level and tariff                             | Level 3 leaf rows (grade x tariff)                            | 3.2 (Level 3)                           |
| FR-PNL-018 | All values in SAR HT (excl. VAT)                                   | Cell formatting: SAR, 2 decimals, HT                          | 3.4                                     |
