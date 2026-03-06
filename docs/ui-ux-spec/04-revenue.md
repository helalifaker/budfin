# BudFin UI/UX Specification: Revenue Module

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Module Route:** `/planning/revenue`
> **Sidebar Location:** Planning > Revenue
> **Personas:** Budget Analyst (edit), Budget Owner (view + lifecycle), Viewer (read-only)
> **PRD Coverage:** FR-REV-001 through FR-REV-021

---

## 1. Module Purpose

The Revenue module manages the three inputs that drive tuition revenue: the fee grid, discount policies, and non-tuition revenue items. It also exposes the calculated revenue forecast output. The module is organized into three tabs -- Fees, Discounts, and Forecast -- following the natural data-entry-then-review workflow. All inputs are version-scoped (FR-REV-004); switching versions in the context bar reloads the entire module.

---

## 2. Layout Structure

The Revenue module renders inside PlanningShell and follows the PlanningShell Module Template (Global Framework Section 12.1). The context bar and docked right panel are managed by the shell.

```
+-----------------------------------------------------------------------+
| {Context bar + right panel rendered by PlanningShell}                  |
+-----------------------------------------------------------------------+
| Module Toolbar                                                        |
|   [Revenue]  [AY1 | AY2 filter]    [Calculate] [Export] [More]       |
+-----------------------------------------------------------------------+
| Tab Bar: [ Fees | Discounts | Forecast ]                             |
+-----------------------------------------------------------------------+
|                                                                       |
|                     Active Tab Content                                |
|                     (full workspace height)                           |
|                                                                       |
+-----------------------------------------------------------------------+
```

### 2.1 Module Toolbar

| Element                | Position | Component                          | Notes                                                                           |
| ---------------------- | -------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| Module title           | Left     | `--text-xl`, weight 600            | Static text: "Revenue"                                                          |
| Academic period filter | Center   | `<ToggleGroup>` (AY1 / AY2 / Both) | Filters fee grid rows; default "Both". Only visible on Fees tab.                |
| Calculate button       | Right    | `<CalculateButton>`                | Triggers `POST /versions/:versionId/calculate/revenue`. Hidden for Viewer role. |
| Export button          | Right    | `<ExportDropdown>`                 | xlsx / pdf / csv options. `report_type=REVENUE_DETAIL`.                         |
| More menu              | Right    | `<DropdownMenu>`                   | Contains "Import Fee Grid" (future, disabled).                                  |

### 2.2 Tab Bar

| Property     | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Component    | shadcn/ui `<Tabs>`                                               |
| Style        | Underline variant, `--workspace-border` bottom border            |
| Active tab   | `--color-info` underline (2px), `--text-primary` text            |
| Inactive tab | No underline, `--text-secondary` text                            |
| Tab height   | 40px                                                             |
| Tabs         | Fees, Discounts, Forecast                                        |
| URL sync     | `?tab=fees`, `?tab=discounts`, `?tab=forecast` appended to route |
| Default tab  | Fees                                                             |

---

## 3. Fees Tab

### 3.1 Purpose

Displays the editable fee grid scoped to the active version and filtered by academic period. Each row represents a unique Grade x Nationality x Tariff combination. The grid covers ~45 rows per academic period (~90 total when "Both" is selected).

**PRD Coverage:** FR-REV-001, FR-REV-002, FR-REV-003, FR-REV-004, FR-REV-005, FR-REV-006.

### 3.2 Data Source

| Operation | Endpoint                                                                    | Method |
| --------- | --------------------------------------------------------------------------- | ------ |
| Load      | `GET /api/v1/versions/:versionId/fee-grid?academic_period={AY1\|AY2\|both}` | GET    |
| Save      | `PUT /api/v1/versions/:versionId/fee-grid`                                  | PUT    |

### 3.3 Grid Columns

| #   | Column Header | Field             | Width | Type     | Editable | Alignment | Notes                                                                     |
| --- | ------------- | ----------------- | ----- | -------- | -------- | --------- | ------------------------------------------------------------------------- |
| 1   | Period        | `academic_period` | 70px  | dropdown | No       | Left      | "AY1" or "AY2". Pinned left.                                              |
| 2   | Grade         | `grade_level`     | 100px | text     | No       | Left      | PS through Terminale. Pinned left.                                        |
| 3   | Nationality   | `nationality`     | 100px | text     | No       | Left      | Francais / Nationaux / Autres. Pinned left.                               |
| 4   | Tariff        | `tariff`          | 80px  | text     | No       | Left      | RP / R3+ / Plein. Pinned left.                                            |
| 5   | DAI           | `dai`             | 120px | currency | Yes      | Right     | Decimal(15,4). `--font-mono`. `--cell-editable-bg`.                       |
| 6   | Tuition TTC   | `tuition_ttc`     | 130px | currency | Yes      | Right     | Tuition including VAT. `--cell-editable-bg`.                              |
| 7   | Tuition HT    | `tuition_ht`      | 130px | currency | **No**   | Right     | Auto-calculated: `TTC / (1 + VAT_RATE)`. `--cell-readonly-bg`. Gray text. |
| 8   | T1            | `term1_amount`    | 110px | currency | Yes      | Right     | Term 1 installment. `--cell-editable-bg`.                                 |
| 9   | T2            | `term2_amount`    | 110px | currency | Yes      | Right     | Term 2 installment. `--cell-editable-bg`.                                 |
| 10  | T3            | `term3_amount`    | 110px | currency | Yes      | Right     | Term 3 installment. `--cell-editable-bg`.                                 |

**Total grid width:** ~1,060px (fits within 1280px minimum viewport with sidebar collapsed).

### 3.4 Column Behavior

**Pinned columns:** Columns 1-4 are pinned left. They remain visible during horizontal scroll (relevant when comparison mode adds variance columns).

**Sorting:** All columns sortable. Default sort: Period (AY1 first) > Grade (curriculum order) > Nationality (alpha) > Tariff (RP, R3+, Plein).

**Grouping:** Rows grouped by Grade with collapsible group headers. Group header shows grade name and row count badge.

### 3.5 Auto-Calculation: Tuition HT (FR-REV-003, FR-REV-006)

When a user edits the Tuition TTC cell:

1. **Standard rows (Francais, Autres):** `Tuition HT = Tuition TTC / 1.15` (15% VAT).
2. **Nationaux rows (FR-REV-006):** `Tuition HT = Tuition TTC` (0% VAT exemption). The HT cell shows the same value as TTC.
3. **Visual feedback:** HT cell flashes briefly (`150ms` background pulse using `--color-info-bg`) to indicate recalculation.
4. **Precision:** Calculation uses full decimal precision. Display rounds to 2 decimal places.

### 3.6 Term Installment Validation

On blur of T1, T2, or T3, if the absolute difference `|T1 + T2 + T3 - Tuition TTC|` exceeds 0.01 SAR:

- Show a non-blocking amber warning icon in the row (not a red error).
- Tooltip: "Term installments (X SAR) do not equal Tuition TTC (Y SAR). Difference: Z SAR".
- This is a warning, not a hard block -- the user can save regardless.
- Differences within 0.01 SAR are considered matching and do not trigger the warning.

### 3.7 Academic Period Filter

The toolbar `<ToggleGroup>` filters which rows are displayed:

| Selection | Rows Shown                     | Row Count |
| --------- | ------------------------------ | --------- |
| AY1       | `academic_period = 'AY1'` only | ~45 rows  |
| AY2       | `academic_period = 'AY2'` only | ~45 rows  |
| Both      | All rows, AY1 first            | ~90 rows  |

Filter is applied client-side on the loaded dataset. No virtual scrolling (ADR-016).

### 3.8 Empty State

Shown when the fee grid has no entries for the active version.

| Property    | Value                                                          |
| ----------- | -------------------------------------------------------------- |
| Icon        | `Receipt` (Lucide)                                             |
| Heading     | "No fee grid configured"                                       |
| Description | "Add tuition fees for this version to begin revenue planning." |
| Action      | "Initialize Fee Grid" button (copies default template)         |

### 3.9 Comparison Mode

When comparison mode is active (context bar toggle), each currency column (DAI, TTC, HT, T1, T2, T3) gains two sub-columns:

| Sub-column  | Content                          | Style                                                            |
| ----------- | -------------------------------- | ---------------------------------------------------------------- |
| Delta (SAR) | Primary value - Comparison value | `--font-mono`. Green if positive (higher fees), red if negative. |
| Delta (%)   | Percentage change                | `--font-mono`. Same color logic.                                 |

Grid width expands; horizontal scroll is expected. Pinned columns remain fixed.

---

## 4. Discounts Tab

### 4.1 Purpose

Manages discount policies applied to tariff categories. Only RP (staff children) and R3+ (3+ siblings) tariffs receive discounts. Plein tariff has no discount (FR-REV-007, FR-REV-008). Below the rules table, a discount impact summary shows total SAR impact by nationality, grade band, and tariff (FR-REV-010).

### 4.2 Data Source

| Operation | Endpoint                                    | Method |
| --------- | ------------------------------------------- | ------ |
| Load      | `GET /api/v1/versions/:versionId/discounts` | GET    |
| Save      | `PUT /api/v1/versions/:versionId/discounts` | PUT    |

### 4.3 Discount Rules Table

| #   | Column Header  | Field           | Width | Type       | Editable | Alignment | Notes                                                             |
| --- | -------------- | --------------- | ----- | ---------- | -------- | --------- | ----------------------------------------------------------------- |
| 1   | Tariff         | `tariff`        | 120px | text       | No       | Left      | "RP" or "R3+".                                                    |
| 2   | Nationality    | `nationality`   | 140px | text       | No       | Left      | "Francais", "Nationaux", "Autres", or "All".                      |
| 3   | Discount Rate  | `discount_rate` | 140px | percentage | Yes      | Right     | 0.0%-100.0%. `--cell-editable-bg`. `--font-mono`.                 |
| 4   | Effective Rate | computed        | 140px | percentage | No       | Right     | `discount_rate` displayed as "X% of Plein". `--cell-readonly-bg`. |

**Row count:** Typically 6 rows (2 tariffs x 3 nationalities) or fewer if "All" nationality rows are used.

**Default values (FR-REV-008):**

| Tariff | Default Discount                       |
| ------ | -------------------------------------- |
| RP     | 75% of Plein (i.e., 25% discount rate) |
| R3+    | 75% of Plein (i.e., 25% discount rate) |

### 4.4 Validation

| Rule                           | Behavior                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Rate < 0% or > 100%            | Inline error: "Discount rate must be between 0% and 100%". `--cell-error-border`.                   |
| Rate = 0%                      | Allowed (no discount applied).                                                                      |
| Rate = 100%                    | Allowed (full waiver), but shows amber warning: "100% discount means zero tuition for this tariff." |
| Duplicate tariff + nationality | Server returns 422. Toast: "Duplicate discount rule for [Tariff] / [Nationality]."                  |

### 4.5 Mutual Exclusivity Notice (FR-REV-009)

A static info banner appears at the top of the Discounts tab:

| Property   | Value                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component  | `<Alert variant="info">` (shadcn/ui)                                                                                                             |
| Icon       | `Info` (Lucide)                                                                                                                                  |
| Text       | "Students qualify for the highest applicable discount only. If a student matches both RP and R3+ criteria, only the higher discount is applied." |
| Background | `--color-info-bg`                                                                                                                                |

### 4.6 Discount Impact Summary (FR-REV-010)

Below the rules table, a read-only summary section shows the calculated impact of discounts on revenue. This data comes from the last calculation run (stale indicator applies if inputs changed since).

```
+-----------------------------------------------------------------------+
| Discount Impact Summary                                    [Stale?]   |
+-----------------------------------------------------------------------+
| By Nationality          | By Grade Band        | By Tariff           |
| ----------------------- | -------------------- | ------------------- |
| Francais: 1,234,567 SAR | Maternelle: 456K SAR | RP:  2,345,678 SAR  |
| Nationaux:  345,678 SAR | Primaire:   890K SAR | R3+:   567,890 SAR  |
| Autres:     567,890 SAR | College:    234K SAR | Total: 2,913,568 SAR|
| Total:    2,148,135 SAR | Lycee:      568K SAR |                     |
+-----------------------------------------------------------------------+
```

| Property        | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Layout          | 3-column grid, equal width, inside a `--workspace-bg-subtle` card                               |
| Border          | 1px solid `--workspace-border`, `--radius-md`                                                   |
| Padding         | `--space-4`                                                                                     |
| Title           | `--text-lg`, weight 600: "Discount Impact Summary"                                              |
| Values          | `--font-mono`, right-aligned, 2 decimal places, thousands separator                             |
| Stale indicator | Amber `--color-stale` dot + tooltip "Recalculate to update" if `stale_modules` includes REVENUE |

### 4.7 Empty State

| Property    | Value                                                               |
| ----------- | ------------------------------------------------------------------- |
| Icon        | `Percent` (Lucide)                                                  |
| Heading     | "No discount policies configured"                                   |
| Description | "Add discount rules for RP and R3+ tariff categories."              |
| Action      | "Add Default Discounts" button (inserts RP: 25%, R3+: 25% defaults) |

---

## 5. Forecast Tab

### 5.1 Purpose

Displays the read-only calculated revenue output: a monthly revenue grid by IFRS category, a stacked bar chart, and an expandable other revenue section. All data is derived from the last calculation run.

**PRD Coverage:** FR-REV-011, FR-REV-012, FR-REV-013, FR-REV-014, FR-REV-015, FR-REV-016 through FR-REV-021.

### 5.2 Data Source

| Operation           | Endpoint                                                 | Method |
| ------------------- | -------------------------------------------------------- | ------ |
| Revenue results     | `GET /api/v1/versions/:versionId/revenue?group_by=month` | GET    |
| Other revenue items | `GET /api/v1/versions/:versionId/other-revenue`          | GET    |

### 5.3 Stale Data Handling

If the Revenue module is in the `stale_modules` array:

| Element            | Behavior                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Forecast tab badge | Amber dot on the "Forecast" tab label                                                                                                         |
| Grid overlay       | Semi-transparent amber tint over the entire grid                                                                                              |
| Banner             | Sticky banner at top: "Revenue data is outdated. Click Calculate to refresh." with inline Calculate button. Background: `--color-warning-bg`. |
| Chart              | Renders last known data with a dashed-border overlay and "Outdated" watermark                                                                 |

If no calculation has ever been run, the Forecast tab shows the empty state (Section 5.9).

### 5.4 Monthly Revenue Grid

A read-only grid showing revenue broken down by IFRS category across 12 months.

**Columns:**

| #    | Column Header                                                         | Width      | Notes                                                       |
| ---- | --------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| 1    | Category                                                              | 200px      | IFRS category name. Pinned left. `--text-sm`, left-aligned. |
| 2-13 | Jan / Feb / Mar / Apr / May / Jun / Jul / Aug / Sep / Oct / Nov / Dec | 100px each | Monthly amounts. `--font-mono`, right-aligned.              |
| 14   | Annual Total                                                          | 120px      | Row sum. `--font-mono`, right-aligned. **Bold** weight 600. |

**Rows:**

| Row   | Category                         | Notes                                                                                                                                 |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Tuition Fees**                 | Group header, expandable                                                                                                              |
| 1.1   | Tuition -- Maternelle            | Indent level 1                                                                                                                        |
| 1.2   | Tuition -- Primaire              | Indent level 1                                                                                                                        |
| 1.3   | Tuition -- College               | Indent level 1                                                                                                                        |
| 1.4   | Tuition -- Lycee                 | Indent level 1                                                                                                                        |
| 2     | **Registration & Misc**          | Group header, expandable                                                                                                              |
| 2.1   | Frais de Dossier                 | Indent level 1                                                                                                                        |
| 2.2   | DPI                              | Indent level 1                                                                                                                        |
| 2.3   | DAI                              | Indent level 1                                                                                                                        |
| 2.4   | Evaluation Tests                 | Indent level 1                                                                                                                        |
| 3     | **Other Revenue**                | Group header, expandable                                                                                                              |
| 3.1   | Activities (APS, Garderie, etc.) | Indent level 1                                                                                                                        |
| 3.2   | Examination Fees                 | Indent level 1                                                                                                                        |
| 3.3   | Rental Income                    | Indent level 1                                                                                                                        |
| 4     | **Social Aid (Negative)**        | Group header. Values displayed in `--color-error` with parentheses.                                                                   |
| 4.1   | Bourses AEFE                     | Indent level 1                                                                                                                        |
| 4.2   | Bourses AESH                     | Indent level 1                                                                                                                        |
| 5     | **Scholarship Provision**        | Single row. Negative value per FR-REV-020. `--color-error`.                                                                           |
| 6     | **Fee Collection Adj.**          | Single row. Adjustment per FR-REV-021. `--color-error`.                                                                               |
| **T** | **Total Revenue HT**             | **Summary row.** Background: `--workspace-bg-muted`. Font weight 700. `--text-lg`. Top border: 2px solid `--workspace-border-strong`. |

**Row styling:**

| Row Type     | Background                                             | Font Weight | Left Padding           |
| ------------ | ------------------------------------------------------ | ----------- | ---------------------- |
| Group header | `--workspace-bg-muted`                                 | 600         | `--space-2`            |
| Detail row   | alternating `--workspace-bg` / `--workspace-bg-subtle` | 400         | `--space-6` (indented) |
| Total row    | `--workspace-bg-muted`                                 | 700         | `--space-2`            |

**Month columns with zero revenue (Jul, Aug):** Display "0.00" in `--text-muted` for tuition rows (summer months have no tuition per FR-REV-011). Other revenue items may have non-zero amounts if distributed year-round.

### 5.5 Revenue Distribution Chart

Below the grid, a Recharts stacked bar chart visualizes monthly revenue distribution.

| Property  | Value                                                                    |
| --------- | ------------------------------------------------------------------------ |
| Component | `<BarChart>` from Recharts v3                                            |
| Height    | 320px                                                                    |
| Width     | Full workspace width, responsive to container                            |
| X-axis    | Months (Jan-Dec). `--text-xs`.                                           |
| Y-axis    | Revenue in SAR. `--text-xs`, `--font-mono`. Formatted with K/M suffixes. |
| Legend    | Bottom, horizontal. One entry per IFRS category.                         |
| Tooltip   | On hover: month name, category breakdown with amounts, total.            |
| Animation | `animationDuration={300}` on initial load.                               |

**Bar segments (bottom to top):**

| Segment | Color                                 | Category                                   |
| ------- | ------------------------------------- | ------------------------------------------ |
| 1       | `#2563EB` (blue-600)                  | Tuition Fees                               |
| 2       | `#7C3AED` (violet-600)                | Registration & Misc                        |
| 3       | `#0891B2` (cyan-600)                  | Other Revenue                              |
| 4       | `#DC2626` (red-600, negative overlay) | Social Aid + Scholarship + Collection Adj. |

**Comparison mode:** When active, the chart shows paired bars (primary version solid fill, comparison version with diagonal hatch pattern) for each month. Legend includes version labels.

### 5.6 Other Revenue Items Section

Below the chart, an editable section for managing non-tuition revenue line items (FR-REV-014 through FR-REV-019).

#### 5.6.1 Section Header

```
+-----------------------------------------------------------------------+
| Other Revenue Items                                [+ Add Item]       |
+-----------------------------------------------------------------------+
```

| Property   | Value                                                                            |
| ---------- | -------------------------------------------------------------------------------- |
| Title      | `--text-lg`, weight 600: "Other Revenue Items"                                   |
| Add button | `<Button variant="outline" size="sm">` with `Plus` icon. Hidden for Viewer role. |
| Collapse   | Section is collapsible via chevron toggle. Default expanded.                     |

#### 5.6.2 Other Revenue Table

| #   | Column Header | Field                 | Width | Type     | Editable | Alignment | Notes                                                                                |
| --- | ------------- | --------------------- | ----- | -------- | -------- | --------- | ------------------------------------------------------------------------------------ |
| 1   | Expand        | —                     | 36px  | icon     | No       | Center    | Chevron to expand monthly breakdown.                                                 |
| 2   | Line Item     | `line_item_name`      | 200px | text     | Yes      | Left      | `--cell-editable-bg`.                                                                |
| 3   | Annual Amount | `annual_amount`       | 140px | currency | Yes      | Right     | `--font-mono`. `--cell-editable-bg`.                                                 |
| 4   | Distribution  | `distribution_method` | 160px | dropdown | Yes      | Left      | Options: "Academic /10", "Year-round /12", "Custom". `--cell-editable-bg`.           |
| 5   | IFRS Category | `ifrs_category`       | 160px | dropdown | Yes      | Left      | Options: "Registration & Misc", "Other Revenue", "Social Aid". `--cell-editable-bg`. |
| 6   | Actions       | —                     | 60px  | icon     | —        | Center    | Delete icon (`Trash2`), confirmation required.                                       |

**Expanded row (monthly breakdown):**

When a row is expanded, a sub-row appears showing the 12-month distribution:

```
+------+------------------+---------+---------+---------+-----+---------+
|      | Line Item        | Jan     | Feb     | Mar     | ... | Dec     |
+------+------------------+---------+---------+---------+-----+---------+
| [v]  | Frais de Dossier | 0.00    | 0.00    | 0.00    | ... | 0.00    |
|      |   Monthly dist.  | 0.00    | 0.00    | 0.00    | ... | 25,000  |
+------+------------------+---------+---------+---------+-----+---------+
```

- Monthly cells are read-only for "Academic /10" and "Year-round /12" methods (auto-distributed).
- Monthly cells are **editable** (`--cell-editable-bg`) for "Custom" distribution method. Each cell accepts a weight value (0.0-1.0). The row must sum to 1.0 (FR-REV-017).
- Validation: if custom weights do not sum to 1.0 (+/- 0.0001 tolerance), show inline error: "Monthly weights must sum to 1.0 (current: X.XXXX)". `--cell-error-border` on the sub-row.

#### 5.6.3 Default Other Revenue Items (FR-REV-016)

When initializing a new version, the following default items are pre-populated:

| Line Item                        | Default Distribution | IFRS Category       |
| -------------------------------- | -------------------- | ------------------- |
| Frais de Dossier (Francais)      | Custom: May-Jun      | Registration & Misc |
| Frais de Dossier (Nationaux)     | Custom: May-Jun      | Registration & Misc |
| Frais de Dossier (Autres)        | Custom: May-Jun      | Registration & Misc |
| DPI (Francais)                   | Custom: May-Jun      | Registration & Misc |
| DPI (Nationaux)                  | Custom: May-Jun      | Registration & Misc |
| DPI (Autres)                     | Custom: May-Jun      | Registration & Misc |
| Evaluation Tests (Primaire)      | Custom               | Registration & Misc |
| Evaluation Tests (College+Lycee) | Custom               | Registration & Misc |
| DAI (Francais)                   | Custom: May-Jun      | Registration & Misc |
| DAI (Nationaux)                  | Custom: May-Jun      | Registration & Misc |
| DAI (Autres)                     | Custom: May-Jun      | Registration & Misc |
| After-School Activities (APS)    | Academic /10         | Other Revenue       |
| Daycare (Garderie)               | Academic /10         | Other Revenue       |
| Class Photos                     | Custom: Nov-Dec      | Other Revenue       |
| PSG Academy Rental               | Year-round /12       | Other Revenue       |
| BAC Examination                  | Custom: Apr-May      | Other Revenue       |
| DNB Examination                  | Custom: Apr-May      | Other Revenue       |
| EAF Examination                  | Custom: Apr-May      | Other Revenue       |
| SIELE Examination                | Custom: Oct-Nov      | Other Revenue       |
| Bourses AEFE                     | Academic /10         | Social Aid          |
| Bourses AESH                     | Academic /10         | Social Aid          |

### 5.7 Scholarship & Collection Parameters (FR-REV-020, FR-REV-021)

Below the Other Revenue section, a compact parameters card displays scenario-dependent rates.

```
+-----------------------------------------------------------------------+
| Revenue Parameters                                                    |
+----------------------------+------------------------------------------+
| Parameter                  | Base     | Optimistic | Pessimistic      |
+----------------------------+------------------------------------------+
| Scholarship Allocation     | 2.0%     | 1.0%       | 3.0%             |
| Fee Collection Rate        | 95.0%    | 98.0%      | 90.0%            |
+----------------------------+------------------------------------------+
```

| Property        | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Component       | `<Card>` (shadcn/ui) with inner table                                                               |
| Background      | `--workspace-bg-subtle`                                                                             |
| Border          | `--workspace-border`, `--radius-md`                                                                 |
| Cells           | Percentage type, editable (`--cell-editable-bg`). `--font-mono`.                                    |
| Active scenario | The column matching the context bar scenario is highlighted with `--color-info-bg` background.      |
| Note            | Values are linked from Assumptions & Parameters (Master Data). Editing here updates the assumption. |
| Viewer role     | Read-only, no `--cell-editable-bg`.                                                                 |

### 5.8 Comparison Mode (Forecast Tab)

When comparison mode is active:

- The monthly revenue grid gains variance columns after each month column: Delta (SAR) and Delta (%).
- Revenue: positive variance = favorable (green), negative = unfavorable (red). Per Global Framework Section 7.1.
- The chart shows paired bars per month.
- The total row shows absolute and percentage variance for the annual total.

### 5.9 Empty State

Shown when no revenue calculation has ever been run for this version.

| Property    | Value                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Icon        | `TrendingUp` (Lucide)                                                                                 |
| Heading     | "No revenue forecast available"                                                                       |
| Description | "Complete the fee grid and enrollment detail, then click Calculate to generate the revenue forecast." |
| Action      | None (Calculate button is in the toolbar)                                                             |

---

## 6. Calculate Workflow

### 6.1 Trigger

The Calculate button in the module toolbar triggers the revenue calculation engine.

### 6.2 API Call

```
POST /api/v1/versions/:versionId/calculate/revenue
```

### 6.3 Prerequisites (FR-REV-011, FR-REV-012)

Before triggering, the frontend checks (via `GET /versions/:versionId/calculate/status`):

1. **Stage 2 enrollment detail** must be entered (non-empty enrollment detail for the version).
2. **Fee grid** must have at least one entry.
3. **Discount policies** must be configured (can be zero-rate, but entries must exist).

If prerequisites are missing, the Calculate button shows a tooltip listing the missing items:

```
Prerequisites missing:
  - Enrollment detail not entered
  - Fee grid is empty
```

The button remains clickable but the API will return `422 MISSING_PREREQUISITES`.

### 6.4 Progress States

| State      | Duration    | UI                                                         |
| ---------- | ----------- | ---------------------------------------------------------- |
| Click      | Instant     | Button transitions to "Running" state (spinner + disabled) |
| Processing | 1-3 seconds | Spinner continues. No progress bar (operation is atomic).  |
| Success    | Instant     | Button flashes green check (2 seconds). Toast appears.     |
| Error      | Instant     | Button shows red badge. Error panel slides in.             |

### 6.5 Success Response

Toast notification:

| Property | Value                                                                               |
| -------- | ----------------------------------------------------------------------------------- |
| Variant  | `success`                                                                           |
| Title    | "Revenue recalculated"                                                              |
| Body     | "Total Revenue: {total_annual_revenue_ht} SAR" (formatted with thousands separator) |
| Duration | 5 seconds                                                                           |

After success:

- Forecast tab grid and chart refresh automatically (TanStack Query invalidation on key `['revenue', versionId]`).
- Stale indicator for REVENUE clears in the context bar.
- If the user is currently on the Forecast tab, the grid re-renders with new data.
- Discount impact summary on the Discounts tab also refreshes.

### 6.6 Error Handling

| Error Code                     | UI Behavior                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `VERSION_LOCKED`               | Toast (error): "Cannot calculate -- version is locked."                                                                            |
| `MISSING_PREREQUISITES`        | Error panel listing missing data with links to the relevant tabs. E.g., "Fee grid is empty -- go to Fees tab" as a clickable link. |
| `VERSION_DATA_SOURCE_MISMATCH` | Toast (warning): "Calculation is disabled for Actual versions with imported data."                                                 |
| Network error                  | Toast (error): "Calculation failed -- check your connection and retry."                                                            |
| Server 500                     | Toast (error): "Calculation failed unexpectedly. Please try again."                                                                |

---

## 7. API Endpoint Reference

| Endpoint                                 | Method | Tab       | RBAC (Write)               | Description                     |
| ---------------------------------------- | ------ | --------- | -------------------------- | ------------------------------- |
| `/versions/:versionId/fee-grid`          | GET    | Fees      | All                        | Load fee grid entries           |
| `/versions/:versionId/fee-grid`          | PUT    | Fees      | Admin, BudgetOwner, Editor | Update fee grid                 |
| `/versions/:versionId/discounts`         | GET    | Discounts | All                        | Load discount policies          |
| `/versions/:versionId/discounts`         | PUT    | Discounts | Admin, BudgetOwner, Editor | Update discount policies        |
| `/versions/:versionId/other-revenue`     | GET    | Forecast  | All                        | Load other revenue items        |
| `/versions/:versionId/other-revenue`     | PUT    | Forecast  | Admin, BudgetOwner, Editor | Update other revenue items      |
| `/versions/:versionId/calculate/revenue` | POST   | Toolbar   | Admin, BudgetOwner, Editor | Trigger revenue calculation     |
| `/versions/:versionId/revenue`           | GET    | Forecast  | All                        | Load calculated revenue results |

---

## 8. State Management

### 8.1 Server State (TanStack Query v5)

| Query Key                                 | Endpoint                | Stale Time | Notes                            |
| ----------------------------------------- | ----------------------- | ---------- | -------------------------------- |
| `['fee-grid', versionId, academicPeriod]` | `GET /fee-grid`         | 30s        | Invalidated on PUT success       |
| `['discounts', versionId]`                | `GET /discounts`        | 30s        | Invalidated on PUT success       |
| `['other-revenue', versionId]`            | `GET /other-revenue`    | 30s        | Invalidated on PUT success       |
| `['revenue', versionId]`                  | `GET /revenue`          | 60s        | Invalidated on calculate success |
| `['calculate-status', versionId]`         | `GET /calculate/status` | 10s        | Checked before calculate         |

### 8.2 Client State (Zustand)

```typescript
interface RevenueGridStore {
	activeTab: 'fees' | 'discounts' | 'forecast';
	academicPeriodFilter: 'AY1' | 'AY2' | 'both';
	feeGridSort: SortingState;
	feeGridColumnVisibility: VisibilityState;
	feeGridExpandedGroups: Set<string>;
	forecastExpandedCategories: Set<string>;
	otherRevenueExpandedRows: Set<number>;
}
```

### 8.3 Optimistic Updates

- **Fee grid edits:** On cell blur, the local cache updates immediately. PUT request fires in background. On failure, the cell reverts and shows a toast error.
- **Discount edits:** Same pattern as fee grid.
- **Other revenue edits:** Same pattern. Custom weight arrays validated client-side before PUT.

### 8.4 URL State Sync

The following parameters are synced to URL search params:

```
/planning/revenue?tab=fees&period=AY1&fy=2026&version=42
```

| Param    | Store Field            | Default |
| -------- | ---------------------- | ------- |
| `tab`    | `activeTab`            | `fees`  |
| `period` | `academicPeriodFilter` | `both`  |

---

## 9. RBAC Behavior

### 9.1 Role Matrix

| UI Element                  | Admin   | BudgetOwner | Editor  | Viewer    |
| --------------------------- | ------- | ----------- | ------- | --------- |
| Fee grid cells (editable)   | Yes     | Yes         | Yes     | Read-only |
| Discount rate cells         | Yes     | Yes         | Yes     | Read-only |
| Other revenue cells         | Yes     | Yes         | Yes     | Read-only |
| Calculate button            | Visible | Visible     | Visible | Hidden    |
| Export button               | Visible | Visible     | Visible | Visible   |
| Add Item (Other Revenue)    | Visible | Visible     | Visible | Hidden    |
| Delete Item (Other Revenue) | Visible | Visible     | Visible | Hidden    |
| Revenue Parameters (edit)   | Yes     | Yes         | Yes     | Read-only |

### 9.2 Viewer Role Specifics

- All grids render without `--cell-editable-bg` highlight.
- No edit cursor on hover over any cell.
- Double-click on cells does nothing.
- Calculate button is hidden from the toolbar.
- "Add Item" and "Delete" actions are hidden from the Other Revenue section.
- Discount rules table shows rates as plain text (no input affordance).

### 9.3 Locked/Archived Version

When the active version is Locked or Archived (regardless of role):

- Read-only banner appears per Global Framework Section 4.10.
- All editable cells become read-only.
- Calculate button disabled with tooltip: "Version is locked".
- "Add Item" and "Delete" actions hidden.
- Revenue Parameters card cells become read-only.

---

## 10. Accessibility

### 10.1 Grid Accessibility

All three tab grids follow the ARIA grid pattern from Global Framework Section 10.2:

| ARIA Attribute         | Usage in Revenue                                                               |
| ---------------------- | ------------------------------------------------------------------------------ |
| `role="grid"`          | Fee grid, discount table, forecast grid, other revenue table                   |
| `role="row"`           | Each data row                                                                  |
| `role="gridcell"`      | Each cell                                                                      |
| `role="columnheader"`  | Column headers                                                                 |
| `aria-readonly="true"` | Tuition HT cells, all forecast grid cells, all cells for Viewer role           |
| `aria-invalid="true"`  | Cells with validation errors (discount rate out of range, weight sum mismatch) |
| `aria-describedby`     | Links error cells to their error tooltip IDs                                   |
| `aria-expanded`        | Expandable group rows (grade groups, IFRS category groups, other revenue rows) |
| `aria-level`           | Indent level for hierarchical forecast rows (1 for groups, 2 for details)      |
| `aria-sort`            | Applied to sorted column headers in fee grid                                   |

### 10.2 Tab Accessibility

| ARIA Attribute    | Element                              | Value                         |
| ----------------- | ------------------------------------ | ----------------------------- |
| `role="tablist"`  | Tab bar container                    | —                             |
| `role="tab"`      | Each tab (Fees, Discounts, Forecast) | —                             |
| `role="tabpanel"` | Active tab content area              | —                             |
| `aria-selected`   | Active tab                           | `true`                        |
| `aria-controls`   | Each tab                             | ID of corresponding tab panel |
| `aria-labelledby` | Each tab panel                       | ID of corresponding tab       |

### 10.3 Keyboard Navigation

In addition to the standard grid navigation (Global Framework Section 5.1):

| Key      | Context                | Action                               |
| -------- | ---------------------- | ------------------------------------ |
| `Ctrl+1` | Module                 | Switch to Fees tab                   |
| `Ctrl+2` | Module                 | Switch to Discounts tab              |
| `Ctrl+3` | Module                 | Switch to Forecast tab               |
| `Enter`  | Expandable row focused | Toggle expand/collapse               |
| `Space`  | Expandable row focused | Toggle expand/collapse (alternative) |

### 10.4 Screen Reader Announcements

| Event              | `aria-live` Region | Announcement                                  |
| ------------------ | ------------------ | --------------------------------------------- |
| HT auto-calculated | `polite`           | "Tuition HT updated to {value} SAR"           |
| Calculate started  | `polite`           | "Revenue calculation in progress"             |
| Calculate success  | `assertive`        | "Revenue recalculated. Total: {value} SAR"    |
| Calculate error    | `assertive`        | "Revenue calculation failed: {error message}" |
| Tab switch         | `polite`           | "{Tab name} tab selected"                     |

---

## 11. Design Token Usage Summary

| Token                       | Usage in Revenue Module                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `--cell-editable-bg`        | DAI, TTC, T1-T3 cells; discount rate cells; other revenue cells; parameter cells         |
| `--cell-readonly-bg`        | Tuition HT cells; all forecast grid cells                                                |
| `--cell-error-border`       | Invalid discount rates; weight array sum mismatch                                        |
| `--color-info-bg`           | HT recalculation flash; active scenario column highlight; info banner background         |
| `--color-warning-bg`        | Term installment sum mismatch warning; stale forecast banner                             |
| `--color-error`             | Negative revenue values (Social Aid, Scholarship, Collection Adj.); unfavorable variance |
| `--color-success`           | Favorable variance in comparison mode                                                    |
| `--color-stale`             | Stale indicator on discount impact summary; forecast tab badge                           |
| `--workspace-bg-muted`      | Group header rows; total row; section headers                                            |
| `--workspace-bg-subtle`     | Alternating row backgrounds; parameter card; discount impact card                        |
| `--workspace-border`        | Grid borders; tab bar bottom border; card borders                                        |
| `--workspace-border-strong` | Total row top border                                                                     |
| `--font-mono`               | All currency cells; percentage cells; chart axis labels                                  |
| `--text-xl`                 | Module title "Revenue"                                                                   |
| `--text-lg`                 | Section headers (Discount Impact, Other Revenue Items, Revenue Parameters)               |
| `--text-xs`                 | Grid cell values; chart axis labels                                                      |
| `--text-sm`                 | Tab labels; column headers                                                               |
| `--text-muted`              | Zero-value month cells; placeholder text                                                 |
| `--text-secondary`          | Comparison version data; inactive tab text                                               |
| `--radius-md`               | Discount impact card; parameter card                                                     |
| `--shadow-sm`               | Cards                                                                                    |
| `--space-2`                 | Grid cell padding                                                                        |
| `--space-4`                 | Card padding; section padding                                                            |
| `--space-6`                 | Indented detail row left padding; section gaps                                           |
