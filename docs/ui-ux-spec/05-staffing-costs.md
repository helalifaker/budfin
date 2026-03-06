# BudFin UI/UX Specification: Staffing & Staff Costs

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Scope:** Developer-focused UI specification for the Staffing & Staff Costs module (sidebar: "Staffing & Staff Costs" under Planning group).
> **PRD References:** FR-DHG-001 through FR-DHG-021, FR-STC-001 through FR-STC-025

---

## 1. Module Purpose

The Staffing & Staff Costs module is the central workspace for curriculum-driven staffing requirements and employee cost budgeting. It bridges two concerns:

1. **DHG & Staffing (Section A):** Defines the curriculum grilles (Dotation Horaire Globale) per band, calculates FTE requirements from enrollment-driven section counts, and optimizes teaching load via HSA (Heures Supplementaires Annuelles).
2. **Staff Costs (Section B):** Manages the employee roster with encrypted salary components, computes statutory charges (GOSI, Ajeer, End-of-Service), and produces a 12-month cost budget with September step-change visibility.

**Key workflow:** Enrollment data feeds section counts into the DHG grilles, which produce FTE requirements. Those FTE requirements inform the employee roster, which drives the monthly cost budget.

---

## 2. Information Architecture

This module renders inside PlanningShell. The context bar and docked right panel are managed by the shell (Global Framework Section 12.1).

### 2.1 Tab Structure

The module uses a top-level `<Tabs>` component (shadcn/ui) with three tabs:

| Tab              | Label               | Description                                              |
| ---------------- | ------------------- | -------------------------------------------------------- |
| `dhg`            | DHG & Staffing      | Curriculum grilles, FTE calculations, HSA optimization   |
| `staff-costs`    | Staff Costs         | Employee roster grouped by department, salary components |
| `monthly-budget` | Monthly Cost Budget | 12-month cost grid with category rows                    |

**URL routing:** `/planning/staffing?tab=dhg`, `/planning/staffing?tab=staff-costs`, `/planning/staffing?tab=monthly-budget`

Tab state persists in URL search params. Default tab on first visit: `dhg`.

### 2.2 Data Dependencies

```
Enrollment & Capacity ──> DHG & Staffing ──> Staff Costs ──> Monthly Cost Budget
     (sections)            (FTE needs)       (employees)       (calculated output)
```

If enrollment data is missing, the DHG tab shows an empty state (Section 4.8 of Global Framework) with CTA: "Import enrollment data first" linking to the Enrollment module.

---

## 3. Module Toolbar

Follows the standard module toolbar pattern (Global Framework Section 4.5).

```
+---------------------------------------------------------------------------------+
| Staffing & Staff Costs   [Band: ▾ All]   [Dept: ▾ All]   [Calculate] [Export ▾] [More ▾] |
+---------------------------------------------------------------------------------+
```

### 3.1 Toolbar Elements

| Element           | Component                  | Tab Visibility       | Notes                                                                                         |
| ----------------- | -------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| Module title      | `--text-xl` weight 600     | All tabs             | "Staffing & Staff Costs"                                                                      |
| Band filter       | `<Select>`                 | DHG tab only         | Options: All, Maternelle, Elementaire, College, Lycee                                         |
| Department filter | `<Select>`                 | Staff Costs tab only | Options: All, Maternelle, Elementaire, College, Lycee, Administration, Vie Scolaire & Support |
| Status filter     | `<Select>`                 | Staff Costs tab only | Options: All, Existing, New, Departed                                                         |
| Search            | `<Input>` with search icon | Staff Costs tab only | Searches by employee name or code                                                             |
| Calculate button  | Per Global Framework 4.5   | All tabs             | POST `/versions/:versionId/calculate/staffing`                                                |
| Export button     | Dropdown: xlsx, pdf, csv   | All tabs             | Exports active tab content                                                                    |
| More menu         | Overflow actions           | Staff Costs tab      | Contains: "Import Employees", "Add Employee"                                                  |

### 3.2 Calculate Button Behavior

**Endpoint:** `POST /versions/:versionId/calculate/staffing`

**Prerequisites check before calculation:**

1. Enrollment data must exist for the version (else toast error: "Enrollment data required before calculating staffing")
2. At least one employee record must exist (else toast error: "Add employees before calculating staff costs")

**On success toast:** "Staffing calculated -- Total FTE: 85.5, Annual Staff Cost: 24.3M SAR"

**Stale triggers** (amber pulsing dot appears when any of these change after last calculation):

- Enrollment section counts modified
- Employee record added, edited, or deleted
- DHG grille hours modified
- Assumption parameters changed (ORS, HSA rates, Ajeer rates, GOSI rates)

---

## 4. Tab A: DHG & Staffing

### 4.1 Layout

```
+---------------------------------------------------------------------------------+
| [Sub-tabs: Maternelle | Elementaire | College | Lycee]                          |
+---------------------------------------------------------------------------------+
| DHG Curriculum Grille (data grid)                                               |
|                                                                                 |
| Subject | Hrs/Wk/Section | Sections | Total Hours | Annual Hours | FTE         |
| ...     | ...            | ...      | ...         | ...          | ...         |
+---------------------------------------------------------------------------------+
| Summary Row: Total DHG | Required FTE | Available Staff | Gap                   |
+---------------------------------------------------------------------------------+
| HSA Optimization Panel                                                          |
+---------------------------------------------------------------------------------+
```

### 4.2 Band Sub-Tabs

| Sub-tab     | Band        | Reference Curriculum                                                                                           | Weekly Base |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------- | ----------- |
| Maternelle  | Maternelle  | FR-DHG-005: Mobiliser le langage, Activite physique, Activites artistiques, Premiers outils, Explorer le monde | 24h/wk      |
| Elementaire | Elementaire | FR-DHG-006: Francais, Mathematiques, Langue Vivante, EPS, Sciences, Histoire-Geo-EMC, Arts, EMC                | 24h/wk      |
| College     | College     | FR-DHG-007: 6eme through 3eme with marge d'autonomie                                                           | 27-28h/wk   |
| Lycee       | Lycee       | FR-DHG-008: Tronc commun + Specialites for 2nde, 1ere, Terminale + autonomie                                   | Per arrete  |

Sub-tabs use `<Tabs>` (shadcn/ui) styled as pill-style secondary tabs below the main module tabs. Active sub-tab uses `--version-budget` underline (2px).

### 4.3 DHG Curriculum Grille

Data grid per band following Global Framework Section 4.1. Rows are pre-loaded from the French National Curriculum (FR-DHG-001 through FR-DHG-008).

#### Column Definitions

| Column             | Key                  | Type    | Width | Editable | Pin  | Notes                                                                                                   |
| ------------------ | -------------------- | ------- | ----- | -------- | ---- | ------------------------------------------------------------------------------------------------------- |
| Subject            | `subject`            | text    | 200px | No       | Left | Pre-loaded from curriculum. Includes host-country rows (FR-DHG-003) and complementary rows (FR-DHG-004) |
| Category           | `category`           | text    | 120px | No       | Left | "Structural", "Host Country", "Complementary" -- color-coded badge                                      |
| Hrs/Wk/Section     | `hours_per_week`     | number  | 100px | Yes      | No   | Hours per week per section. Decimal(4,1)                                                                |
| Sections           | `sections`           | integer | 80px  | No       | No   | Auto-populated from enrollment module. Read-only                                                        |
| Total Weekly Hours | `total_weekly_hours` | number  | 120px | No       | No   | Calculated: `hours_per_week x sections`                                                                 |
| Annual Hours       | `annual_hours`       | number  | 120px | No       | No   | Calculated: `total_weekly_hours x 36` (FR-DHG-015)                                                      |
| FTE                | `fte`                | number  | 80px  | No       | No   | Calculated: `total_weekly_hours / effective_ors` (FR-DHG-009)                                           |

**Category badge colors:**

| Category      | Background             | Text               |
| ------------- | ---------------------- | ------------------ |
| Structural    | `--color-info-bg`      | `--color-info`     |
| Host Country  | `--color-warning-bg`   | `--color-warning`  |
| Complementary | `--workspace-bg-muted` | `--text-secondary` |

**Editable cells:** Only `hours_per_week` is editable. Highlighted with `--cell-editable-bg` per Global Framework.

**Read-only cells:** `sections` is auto-populated from enrollment. If enrollment data is missing for this band, the cell shows `--text-muted` "0" with a tooltip: "No enrollment data -- import enrollment first."

### 4.4 Summary Row

Sticky at the bottom of the grille grid. Background: `--workspace-bg-muted`. Font weight: 600.

| Metric          | Calculation                                                                           | Display                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Total DHG Hours | Sum of all `total_weekly_hours` in band (FR-DHG-011)                                  | Right-aligned, 1 decimal                                                                                                               |
| Required FTE    | Sum of all `fte` in band                                                              | Right-aligned, 1 decimal                                                                                                               |
| Available Staff | Count of employees assigned to this band's department with status "Existing" or "New" | Right-aligned, integer                                                                                                                 |
| Gap             | `required_fte - available_staff`                                                      | Right-aligned, 1 decimal. Positive (understaffed): `--color-error`. Negative (overstaffed): `--color-warning`. Zero: `--color-success` |

### 4.5 Staff Summary Sub-Row (FR-DHG-012)

Below the main summary row, a secondary summary shows staff breakdown:

| Label                 | Value | Notes                                                        |
| --------------------- | ----- | ------------------------------------------------------------ |
| FR Teachers           | Count | Teaching FTE for French curriculum subjects                  |
| ASEM / Assistants     | Count | Maternelle only: 1 per class (section). Zero for other bands |
| Arabic Hours Staff    | Count | Teachers covering Arabic language hours                      |
| Islamic Studies Staff | Count | Teachers covering Islamic Studies hours                      |

For non-Maternelle bands, the ASEM row is hidden.

### 4.6 HSA Optimization Panel

Collapsible panel below the grille grid. Default: collapsed. Toggle button: "HSA Optimization" with chevron.

```
+---------------------------------------------------------------------------------+
| HSA Optimization                                                    [Collapse ▾]|
+---------------------------------------------------------------------------------+
| Effective ORS:  [Slider: 18 ──●── 20]  18.0h     Base ORS: 18h (FR-DHG-013)   |
|                                                                                 |
| Preset Scenarios:                                                               |
| [No HSA: 18h] [1 HSA: 19h] [1.5 HSA: 19.5h] [2 HSA: 20h] [Custom]           |
+---------------------------------------------------------------------------------+
| Scenario Comparison Table (FR-DHG-014):                                         |
|                                                                                 |
| Scenario     | Effective ORS | Required FTE | Current FTE | Positions Saved    |
| No HSA       | 18.0h         | 92.3         | 85          | --                 |
| Conservative | 19.0h         | 87.4         | 85          | 4.9                |
| Custom       | 19.5h         | 85.1         | 85          | 7.2                |
| Full HSA     | 20.0h         | 83.1         | 85          | 9.2                |
+---------------------------------------------------------------------------------+
```

#### Slider Component

| Property  | Value                                      |
| --------- | ------------------------------------------ |
| Component | Custom `<Slider>` (shadcn/ui)              |
| Range     | 18.0 to 20.0 (step: 0.5)                   |
| Default   | 18.0 (no HSA)                              |
| Display   | Current value shown to the right of slider |

Changing the slider recalculates all FTE values in the grille in real-time (client-side calculation, no API call).

#### Preset Buttons

| Button  | ORS Value    | Style                                           |
| ------- | ------------ | ----------------------------------------------- |
| No HSA  | 18.0         | `<Button variant="outline" size="sm">`          |
| 1 HSA   | 19.0         | Same                                            |
| 1.5 HSA | 19.5         | Same                                            |
| 2 HSA   | 20.0         | Same                                            |
| Custom  | Slider value | Same, active when slider is at non-preset value |

Active preset button uses `variant="default"` (filled).

#### Scenario Comparison Table

Read-only table (FR-DHG-014). Row for each preset. Columns:

| Column          | Type    | Width | Notes                                                                  |
| --------------- | ------- | ----- | ---------------------------------------------------------------------- |
| Scenario        | text    | 140px | Preset name                                                            |
| Effective ORS   | number  | 100px | Hours                                                                  |
| Required FTE    | number  | 100px | Calculated from current DHG totals                                     |
| Current Staff   | integer | 100px | Available employees                                                    |
| Positions Saved | number  | 120px | Difference vs. No HSA scenario. `--color-success` for positive savings |

---

## 5. Tab B: Staff Costs

### 5.1 Layout

```
+---------------------------------------------------------------------------------+
| [Department filter] [Status filter] [Search]              [+ Add Employee] [Import]|
+---------------------------------------------------------------------------------+
| Two-level expandable grid                                                        |
|                                                                                 |
| ▶ Maternelle (24)        | 24 | 145,200.00 | 1,742,400.00 | 87,120.00 | ...   |
|   ▼ Employee rows when expanded                                                |
| ▶ Elementaire (31)       | 31 | ...        | ...          | ...       | ...   |
| ▶ College (28)           | ...                                                  |
| ▶ Lycee (35)             | ...                                                  |
| ▶ Administration (22)    | ...                                                  |
| ▶ Vie Scolaire (28)     | ...                                                  |
+---------------------------------------------------------------------------------+
| Grand Total              | 168 | ...       | ...          | ...       | ...    |
+---------------------------------------------------------------------------------+
```

### 5.2 Department Summary Row (Level 1)

Expandable group rows. Click chevron or row to expand/collapse. Background: `--workspace-bg-muted`. Font weight: 600.

| Column              | Key                   | Type         | Width | Notes                                            |
| ------------------- | --------------------- | ------------ | ----- | ------------------------------------------------ |
| Expand/Collapse     | —                     | chevron icon | 36px  | `aria-expanded` attribute                        |
| Department          | `department`          | text         | 200px | Department name + headcount badge                |
| Headcount           | `headcount`           | integer      | 80px  | Count of employees in department                 |
| Total Monthly Gross | `total_monthly_gross` | currency     | 140px | Sum of all employee monthly gross                |
| Total Annual Cost   | `total_annual_cost`   | currency     | 140px | 12-month salary total (accounts for step-change) |
| Total EoS           | `total_eos`           | currency     | 120px | Sum of annual EoS accrual                        |
| Total Ajeer         | `total_ajeer`         | currency     | 120px | Sum of annual Ajeer charges                      |
| Total GOSI          | `total_gosi`          | currency     | 120px | Sum of annual GOSI charges                       |
| Department Total    | `department_total`    | currency     | 140px | Annual Cost + EoS + Ajeer + GOSI                 |

Department share percentage shown as a secondary line below the department total: `--text-muted`, `--text-xs` (FR-STC-021).

### 5.3 Employee Detail Row (Level 2)

Displayed when a department row is expanded. Indented 24px from left. Standard row height (36px). No virtual scrolling (ADR-016). All department employee rows render via TanStack Table client-side row model.

#### Column Definitions

| Column         | Key             | Type       | Width | Editable | Notes                                                                                                 |
| -------------- | --------------- | ---------- | ----- | -------- | ----------------------------------------------------------------------------------------------------- |
| Employee Code  | `employee_code` | text       | 100px | No       | Read-only system ID                                                                                   |
| Name           | `name`          | text       | 160px | Yes      |                                                                                                       |
| Function/Role  | `function_role` | text       | 140px | Yes      |                                                                                                       |
| Department     | `department`    | dropdown   | 160px | Yes      | Options: Maternelle, Elementaire, College, Lycee, Administration, Vie Scolaire & Support (FR-STC-003) |
| Status         | `status`        | dropdown   | 100px | Yes      | Options: Existing, New, Departed (FR-STC-002)                                                         |
| Joining Date   | `joining_date`  | date       | 110px | Yes      | DD/MM/YYYY display                                                                                    |
| Hourly %       | `hourly_pct`    | percentage | 80px  | Yes      | 0.01-1.0 stored, display as percentage (FR-STC-008)                                                   |
| Base Salary    | `base_salary`   | currency   | 120px | Yes      | **Encrypted** (FR-STC-004)                                                                            |
| Housing (IL)   | `housing`       | currency   | 110px | Yes      | **Encrypted**                                                                                         |
| Transport (IT) | `transport`     | currency   | 110px | Yes      | **Encrypted**                                                                                         |
| Premium        | `premium`       | currency   | 110px | Yes      | **Encrypted**                                                                                         |
| HSA            | `hsa`           | currency   | 100px | Yes      | **Encrypted**. Excluded Jul-Aug (FR-STC-007)                                                          |
| Augmentation   | `augmentation`  | currency   | 110px | Yes      | Applied from Sep (FR-STC-006)                                                                         |
| Monthly Gross  | `monthly_gross` | currency   | 130px | No       | Calculated (FR-STC-005)                                                                               |
| GOSI           | `gosi`          | currency   | 110px | No       | 11.75% for Saudis only (FR-STC-009)                                                                   |
| Ajeer          | `ajeer`         | currency   | 110px | No       | Non-Saudis only (FR-STC-010)                                                                          |
| EoS Monthly    | `eos_monthly`   | currency   | 110px | No       | Calculated (FR-STC-011)                                                                               |

**Total column width:** ~2,032px. Horizontal scroll required. First 3 columns (Employee Code, Name, Function/Role) pinned left.

#### Status Badge Colors

| Status   | Background             | Text              |
| -------- | ---------------------- | ----------------- |
| Existing | `--color-info-bg`      | `--color-info`    |
| New      | `--color-success-bg`   | `--color-success` |
| Departed | `--workspace-bg-muted` | `--text-muted`    |

**Departed employees:** Row text uses `--text-muted`. Cells are read-only. Row is not included in department totals.

### 5.4 Encrypted Field Masking

Per RBAC rules (Global Framework Section 8.1):

| Role        | Salary Field Display | Behavior                                           |
| ----------- | -------------------- | -------------------------------------------------- |
| Admin       | Actual values        | Full edit access                                   |
| BudgetOwner | Actual values        | Full edit access                                   |
| Editor      | Actual values        | Full edit access                                   |
| Viewer      | `--` (masked)        | No edit, no hover reveal. `--text-muted`, centered |

Encrypted fields are: `base_salary`, `housing`, `transport`, `premium`, `hsa`, `augmentation`, `monthly_gross`, `gosi`, `ajeer`, `eos_monthly`.

Server-side: encrypted fields are decrypted only for authorized roles. The API returns `null` for Viewer role on encrypted fields. The frontend renders `--` for `null` salary values.

### 5.5 Monthly Gross Calculation Display

The `monthly_gross` cell shows a tooltip on hover with the calculation breakdown:

```
Monthly Gross Breakdown:
  Base Salary:    12,000.00
  Housing (IL):    3,000.00
  Transport (IT):  1,500.00
  Premium:         1,000.00
  HSA:               800.00*
  ────────────────────────
  Subtotal:       18,300.00
  x Hourly %:      x 1.00
  ────────────────────────
  Monthly Gross:  18,300.00

  * HSA excluded Jul-Aug
```

**HSA for mid-year hires:** HSA is strictly zeroed for July and August calendar months regardless of join date. For employees with a `joining_date` after September 1st, HSA is included only for months from the joining month through June (excluding Jul-Aug). Example: an employee joining in November receives HSA for November through June (8 months), not the full 10-month period.

### 5.6 Grand Total Row

Sticky at bottom of the grid. Background: `--workspace-bg-muted`. Font weight: 700.

Aggregates all departments (excluding Departed employees):

- Total Headcount
- Total Monthly Gross
- Total Annual Cost
- Total EoS
- Total Ajeer
- Total GOSI
- Grand Total (all charges combined, FR-STC-019)

---

## 6. Side Panel: New/Edit Employee

### 6.1 Trigger

- "Add Employee" button in toolbar More menu or `+` icon
- Double-click on employee code in grid (edit mode)

### 6.2 Panel Layout

Uses the standard side panel (Global Framework Section 4.4). Width: 480px.

```
+------------------------------------------+
| New Employee                         [X] |
+------------------------------------------+
| [Form body - scrollable]                 |
|                                          |
| Employee Code:   [Auto-generated]        |
| Name:            [________________]      |
| Function/Role:   [________________]      |
| Department:      [▾ Select...]           |
| Status:          [▾ Existing]            |
| Joining Date:    [📅 DD/MM/YYYY]         |
|                                          |
| ── Compensation ─────────────────        |
| Hourly %:        [____] %               |
| Base Salary:     [________] SAR          |
| Housing (IL):    [________] SAR          |
| Transport (IT):  [________] SAR          |
| Premium:         [________] SAR          |
| HSA:             [________] SAR          |
| Augmentation:    [________] SAR          |
|                                          |
| ── Calculated (read-only) ───────        |
| Monthly Gross:   18,300.00 SAR           |
| GOSI:            0.00 SAR                |
| Ajeer:           9,660.00 SAR            |
| EoS Monthly:     1,525.00 SAR            |
+------------------------------------------+
| [Cancel]                     [Save]      |
+------------------------------------------+
```

### 6.3 Form Validation (React Hook Form + Zod 4)

| Field         | Validation Rules                          |
| ------------- | ----------------------------------------- |
| Name          | Required, max 100 characters              |
| Function/Role | Required, max 100 characters              |
| Department    | Required, one of 6 enum values            |
| Status        | Required, one of: Existing, New, Departed |
| Joining Date  | Required, valid date, not in the future   |
| Hourly %      | Required, range 0.01 to 1.00 (FR-STC-008) |
| Base Salary   | Required, Decimal(15,4), >= 0             |
| Housing       | Optional, Decimal(15,4), >= 0, default 0  |
| Transport     | Optional, Decimal(15,4), >= 0, default 0  |
| Premium       | Optional, Decimal(15,4), >= 0, default 0  |
| HSA           | Optional, Decimal(15,4), >= 0, default 0  |
| Augmentation  | Optional, Decimal(15,4), >= 0, default 0  |

**On save (new):** `POST /versions/:versionId/employees`
**On save (edit):** `PUT /versions/:versionId/employees/:id`

### 6.4 Calculated Fields in Panel

The "Calculated" section updates in real-time as the user types compensation values (client-side preview). These are informational only; the server recalculates on save.

- **Monthly Gross:** `(base + housing + transport + premium + hsa) x hourly_pct`
- **GOSI:** `monthly_gross x 0.1175` if Saudi, else `0.00`
- **Ajeer:** Annual Ajeer / 12 (approximation for display)
- **EoS Monthly:** Based on years of service from joining date (FR-STC-011)

---

## 7. Tab C: Monthly Cost Budget

### 7.1 Layout

Read-only calculated output grid (FR-STC-012 through FR-STC-019). No editable cells.

```
+---------------------------------------------------------------------------------+
| Category              | Jan    | Feb    | ... | Aug    | Sep*   | ... | Dec    | Annual |
+---------------------------------------------------------------------------------+
| Local Staff Salaries  |        |        |     |        |        |     |        |        |
|   Existing Staff      |        |        |     |        |        |     |        |        |
|   New Staff           |  0.00  |  0.00  |     |  0.00  | 45,000 |     |        |        |
| GOSI                  |        |        |     |        |        |     |        |        |
| Ajeer                 |        |        |     |        |        |     |        |        |
| EoS Accrual           |        |        |     |        |        |     |        |        |
+---------------------------------------------------------------------------------+
| Subtotal Local Staff  |        |        |     |        |        |     |        |        |
+---------------------------------------------------------------------------------+
| Contrats Locaux       |        |        |     |        |        |     |        |        |
|   Remplacements       |        |        |     |        |        |     |        |        |
|   1% Formation        |        |        |     |        |        |     |        |        |
| Residents             |        |        |     |        |        |     |        |        |
|   Salaires            |        |        |     |        |        |     |        |        |
|   Logement & Billets  |        |        |     |        |        |     |        |        |
+---------------------------------------------------------------------------------+
| GRAND TOTAL           |        |        |     |        |        |     |        |        |
+---------------------------------------------------------------------------------+
```

### 7.2 Column Definitions

| Column          | Key                      | Type     | Width      | Notes                                 |
| --------------- | ------------------------ | -------- | ---------- | ------------------------------------- |
| Category        | `category`               | text     | 200px      | Pinned left. Hierarchical with indent |
| Jan through Dec | `month_01` to `month_12` | currency | 110px each | Monthly amounts                       |
| Annual Total    | `annual_total`           | currency | 130px      | Sum of 12 months. Font weight: 600    |

**Total grid width:** ~1,650px. Horizontal scroll enabled. Category column pinned left.

### 7.3 Row Hierarchy

| Level | Row                                   | Indent | Font Weight | Background                                          |
| ----- | ------------------------------------- | ------ | ----------- | --------------------------------------------------- |
| 1     | Local Staff Salaries                  | 0px    | 600         | `--workspace-bg-muted`                              |
| 2     | Existing Staff                        | 24px   | 400         | `--workspace-bg`                                    |
| 2     | New Staff                             | 24px   | 400         | `--workspace-bg`                                    |
| 1     | GOSI                                  | 0px    | 400         | `--workspace-bg`                                    |
| 1     | Ajeer                                 | 0px    | 400         | `--workspace-bg`                                    |
| 1     | EoS Accrual                           | 0px    | 400         | `--workspace-bg`                                    |
| —     | **Subtotal Local Staff**              | 0px    | 700         | `--workspace-bg-muted`, top border 2px              |
| 1     | Contrats Locaux                       | 0px    | 600         | `--workspace-bg-muted`                              |
| 2     | Remplacements (FR-STC-015)            | 24px   | 400         | `--workspace-bg`                                    |
| 2     | 1% Formation Continue (FR-STC-016)    | 24px   | 400         | `--workspace-bg`                                    |
| 1     | Residents                             | 0px    | 600         | `--workspace-bg-muted`                              |
| 2     | Salaires (FR-STC-017)                 | 24px   | 400         | `--workspace-bg`                                    |
| 2     | Logement & Billets Avion (FR-STC-018) | 24px   | 400         | `--workspace-bg`                                    |
| —     | **GRAND TOTAL** (FR-STC-019)          | 0px    | 700         | `--workspace-bg-muted`, top border 2px, `--text-lg` |

### 7.4 September Step-Change Indicator

The September column header includes a visual indicator for the step-change (FR-STC-012):

| Property          | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Header decoration | Small amber triangle icon + tooltip: "New positions start September" |
| Column background | `--color-warning-bg` at 30% opacity for the Sep column               |
| New Staff row     | Values jump from `0.00` (Jan-Aug) to calculated amount (Sep-Dec)     |

### 7.5 Period Filter Interaction

When the Academic Period Toggle (context bar) is set to a sub-period, the monthly budget grid hides non-applicable months:

| Period    | Visible Months | Annual Column  |
| --------- | -------------- | -------------- |
| Full Year | Jan-Dec        | Sum of all 12  |
| AY1       | Jan-Jun        | Sum of Jan-Jun |
| AY2       | Sep-Dec        | Sum of Sep-Dec |
| Summer    | Jul-Aug        | Sum of Jul-Aug |

---

## 8. Bulk Import

### 8.1 Trigger

"Import Employees" in the toolbar More menu. Opens a side panel.

### 8.2 Import Panel Layout

```
+------------------------------------------+
| Import Employees                     [X] |
+------------------------------------------+
| Upload an Excel file (.xlsx) with        |
| employee data.                           |
|                                          |
| [Download Template]                      |
|                                          |
| ┌────────────────────────────────┐       |
| │  Drop .xlsx file here          │       |
| │  or click to browse            │       |
| └────────────────────────────────┘       |
|                                          |
| File: employees_2026.xlsx (142 KB)       |
|                                          |
| Preview (first 5 rows):                  |
| ┌──────┬──────────┬───────┬─────┐       |
| │ Code │ Name     │ Dept  │ ... │       |
| │ E001 │ Ahmad K. │ Admin │ ... │       |
| │ E002 │ Sarah M. │ Elem  │ ... │       |
| └──────┴──────────┴───────┴─────┘       |
|                                          |
| Validation: 142 rows, 0 errors           |
|  ⚠ 3 warnings (click to view)           |
+------------------------------------------+
| [Cancel]                    [Import]     |
+------------------------------------------+
```

### 8.3 Import Workflow

1. User downloads template or uploads their own `.xlsx` file
2. Frontend parses file client-side for preview and basic validation
3. Preview shows first 5 rows in a compact table
4. Validation summary: row count, error count, warning count
5. Errors block import. Warnings allow import with confirmation
6. On "Import": `POST /versions/:versionId/employees/import` with multipart form data
7. Progress indicator during upload and server processing
8. On success: toast "Imported 142 employees successfully", grid refreshes
9. On partial failure: error panel listing failed rows with reasons

### 8.4 Validation Rules

| Rule                           | Severity | Message                                              |
| ------------------------------ | -------- | ---------------------------------------------------- |
| Missing required fields        | Error    | "Row {n}: {field} is required"                       |
| Invalid department             | Error    | "Row {n}: Unknown department '{value}'"              |
| Invalid status                 | Error    | "Row {n}: Status must be Existing, New, or Departed" |
| Duplicate employee code        | Error    | "Row {n}: Employee code '{code}' already exists"     |
| Salary < 0                     | Error    | "Row {n}: {field} cannot be negative"                |
| Hourly % out of range          | Error    | "Row {n}: Hourly % must be between 1% and 100%"      |
| Future joining date            | Warning  | "Row {n}: Joining date is in the future"             |
| Missing optional salary fields | Warning  | "Row {n}: {field} is empty, defaulting to 0"         |

---

## 9. Comparison Mode

When comparison mode is active (Global Framework Section 7):

### 9.1 DHG Tab Comparison

Each numeric column gains variance sub-columns:

| Original Column    | Variance (abs) | Variance (%) |
| ------------------ | -------------- | ------------ |
| Hrs/Wk/Section     | +/- hours      | % change     |
| Total Weekly Hours | +/- hours      | % change     |
| FTE                | +/- FTE        | % change     |

FTE increases (more staff needed) shown in `--color-error`. FTE decreases in `--color-success`.

### 9.2 Staff Costs Tab Comparison

Employee-level comparison (FR-STC-024, FR-STC-025):

- **Continuing employees** (exist in both versions): variance columns for Monthly Gross, Annual Cost, EoS, Ajeer
- **New in primary version:** comparison columns show "N/A" in `--text-muted`
- **Departed in primary version:** comparison columns show prior values, variance shows full decrease in `--color-success`
- **Department totals:** variance columns aggregate across all employees

### 9.3 Monthly Budget Tab Comparison

Each month cell shows:

- Primary value (normal text)
- Comparison value (`--text-secondary`)
- Variance amount (colored per favorable/unfavorable)

**Favorable/unfavorable for expenses:** Lower cost = favorable (`--color-success`). Higher cost = unfavorable (`--color-error`).

---

## 10. State Management

### 10.1 Server State (TanStack Query v5)

| Query Key                           | Endpoint                                           | Stale Time | Notes                            |
| ----------------------------------- | -------------------------------------------------- | ---------- | -------------------------------- |
| `['dhg-grilles', versionId, band]`  | `GET /versions/:versionId/dhg-grilles?band={band}` | 30s        | Pre-loaded curriculum data       |
| `['employees', versionId, filters]` | `GET /versions/:versionId/employees`               | 30s        | Paginated, filterable            |
| `['staff-costs', versionId]`        | `GET /versions/:versionId/staff-costs`             | 30s        | Monthly cost budget output       |
| `['staffing-summary', versionId]`   | `GET /versions/:versionId/staffing-summary`        | 30s        | FTE totals, department summaries |

**Mutations:**

| Mutation           | Endpoint                                       | Optimistic Update | Invalidates                                      |
| ------------------ | ---------------------------------------------- | ----------------- | ------------------------------------------------ |
| Create employee    | `POST /versions/:versionId/employees`          | Add to list       | `employees`, `staffing-summary`                  |
| Update employee    | `PUT /versions/:versionId/employees/:id`       | Update in list    | `employees`, `staffing-summary`                  |
| Delete employee    | `DELETE /versions/:versionId/employees/:id`    | Remove from list  | `employees`, `staffing-summary`                  |
| Import employees   | `POST /versions/:versionId/employees/import`   | None              | `employees`, `staffing-summary`                  |
| Calculate staffing | `POST /versions/:versionId/calculate/staffing` | None              | `staff-costs`, `staffing-summary`, `dhg-grilles` |
| Update DHG hours   | `PUT /versions/:versionId/dhg-grilles/:id`     | Update in grid    | `dhg-grilles`, `staffing-summary`                |

### 10.2 Client State (Zustand)

```typescript
interface StaffingStore {
    // Tab state
    activeTab: 'dhg' | 'staff-costs' | 'monthly-budget';
    activeBand: 'maternelle' | 'elementaire' | 'college' | 'lycee';

    // DHG
    effectiveOrs: number; // 18.0 to 20.0
    hsaPreset: 'none' | 'conservative' | 'custom' | 'full';
    hsaOptimizationExpanded: boolean;

    // Staff Costs grid
    expandedDepartments: Set<string>;
    employeeFilters: {
        department: string | null;
        status: string | null;
        search: string;
    };
    sortState: { column: string; direction: 'asc' | 'desc' } | null;
    columnVisibility: Record<string, boolean>;

    // Actions
    setActiveTab: (tab: string) => void;
    setActiveBand: (band: string) => void;
    setEffectiveOrs: (hours: number) => void;
    toggleDepartment: (department: string) => void;
    setEmployeeFilters: (filters: Partial<EmployeeFilters>) => void;
}
```

### 10.3 URL State

```
/planning/staffing?tab=dhg&band=college&ors=19.0
/planning/staffing?tab=staff-costs&dept=admin&status=new&search=ahmad
/planning/staffing?tab=monthly-budget
```

Combined with context bar params: `&fy=2026&version=42&period=full&scenario=base`

---

## 11. Accessibility

### 11.1 ARIA Attributes

All ARIA requirements from Global Framework Section 10 apply. Additional module-specific attributes:

| Element                 | ARIA                                                                             | Value                                  |
| ----------------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| Main tab group          | `role="tablist"`, `aria-label`                                                   | "Staffing module views"                |
| Band sub-tabs           | `role="tablist"`, `aria-label`                                                   | "Curriculum band selection"            |
| DHG grille              | `role="grid"`, `aria-label`                                                      | "DHG curriculum grille for {band}"     |
| Employee grid           | `role="grid"`, `aria-label`                                                      | "Employee roster"                      |
| Department group row    | `role="row"`, `aria-expanded`                                                    | `true` / `false`                       |
| Employee detail row     | `role="row"`, `aria-level`                                                       | `2`                                    |
| Monthly budget grid     | `role="grid"`, `aria-label`, `aria-readonly`                                     | "Monthly cost budget", `true`          |
| HSA slider              | `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label` | 18, 20, current, "Effective ORS hours" |
| Encrypted masked cell   | `aria-label`                                                                     | "Salary data restricted"               |
| September column header | `aria-description`                                                               | "New positions start in September"     |
| Import drop zone        | `role="button"`, `aria-label`                                                    | "Upload employee spreadsheet"          |

### 11.2 Keyboard Navigation

Standard grid navigation from Global Framework Section 5.1, plus:

| Key                 | Context                  | Action                                             |
| ------------------- | ------------------------ | -------------------------------------------------- |
| `Space` / `Enter`   | Department group row     | Toggle expand/collapse                             |
| `Arrow Right`       | Collapsed department row | Expand department                                  |
| `Arrow Left`        | Expanded department row  | Collapse department                                |
| `Ctrl+Shift+N`      | Staff Costs tab          | Open "Add Employee" side panel                     |
| `Tab` / `Shift+Tab` | Between tabs             | Move between DHG, Staff Costs, Monthly Budget tabs |

### 11.3 Screen Reader Announcements

| Event                                | Announcement (`aria-live="polite"`)                 |
| ------------------------------------ | --------------------------------------------------- |
| Department expanded                  | "{Department} expanded, {count} employees"          |
| Department collapsed                 | "{Department} collapsed"                            |
| FTE calculation updated (HSA slider) | "Required FTE updated to {value}"                   |
| Employee saved                       | "Employee {name} saved successfully"                |
| Import complete                      | "{count} employees imported"                        |
| Calculation complete                 | "Staffing calculation complete. Total FTE: {value}" |
