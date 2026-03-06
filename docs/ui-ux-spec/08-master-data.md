# BudFin UI/UX Specification: Master Data Module

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Module:** Master Data Management
> **Route:** `/master-data/*`
> **Related PRD:** FR-MDM-001 through FR-MDM-008
> **Depends on:** `00-global-framework.md` (design tokens, shared components, layout shell)

---

## 1. Module Overview

The Master Data module manages all reference data that feeds into BudFin planning calculations. It contains four sub-modules, each accessible from the sidebar under the "Master Data" navigation group:

| Sub-module                  | Route                      | Sidebar Label            | PRD Reference                      |
| --------------------------- | -------------------------- | ------------------------ | ---------------------------------- |
| Chart of Accounts & Centers | `/master-data/accounts`    | Chart of Accounts        | FR-MDM-001, FR-MDM-002, FR-MDM-003 |
| Academic Years & Grades     | `/master-data/academic`    | Academic Years & Grades  | FR-MDM-005, FR-MDM-006             |
| Reference Data              | `/master-data/reference`   | Reference Data           | FR-MDM-004, FR-MDM-007             |
| Assumptions & Parameters    | `/master-data/assumptions` | Assumptions & Parameters | FR-MDM-008                         |

**Interaction pattern:** All four sub-modules follow a consistent CRUD table + side panel pattern. The left area (~65% width) holds a searchable, filterable data table. The right area hosts a 480px slide-in side panel for create/edit forms.

**Shell:** Master Data renders inside ManagementShell -- no context bar, no docked right panel. Master data is version-independent. Side panels use the overlay pattern (480px, z-index:30) per Global Framework Section 4.4.1.

---

## 2. Layout Structure

### 2.1 Page Layout

```
+--------+---------------------------------------------------------+
|        | Module Toolbar (48px)                                   |
| Side-  |---------------------------------------------------------|
| bar    | Tab Navigation (if applicable, 40px)                    |
|        |---------------------------------------------------------|
|        |                         |                               |
|        |   Data Table (~65%)     |   Side Panel (480px)          |
|        |                         |   (hidden by default)         |
|        |                         |                               |
+--------+-------------------------+-------------------------------+
```

### 2.2 Module Toolbar

All master data sub-modules share a consistent toolbar layout.

```
+------------------------------------------------------------------+
| [Module Title]  [Search Input (280px)]  [Filters...]  [+ Add New]|
+------------------------------------------------------------------+
```

| Element          | Component                              | Properties                                                                      |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| Module Title     | `<h1>`                                 | `--text-xl`, weight 600, `--text-primary`                                       |
| Search Input     | shadcn/ui `<Input>`                    | 280px width, placeholder "Search...", Lucide `Search` icon left, debounce 300ms |
| Filter Dropdowns | shadcn/ui `<Select>`                   | Module-specific, 140px each                                                     |
| Add New Button   | shadcn/ui `<Button variant="default">` | Lucide `Plus` icon + "Add New" label                                            |

**RBAC on toolbar:**

| Element        | Admin   | BudgetOwner / Editor | Viewer  |
| -------------- | ------- | -------------------- | ------- |
| Search Input   | Visible | Visible              | Visible |
| Filters        | Visible | Visible              | Visible |
| Add New button | Visible | Hidden               | Hidden  |
| Export button  | Visible | Visible              | Visible |

### 2.3 Data Table Shared Behavior

All master data tables use the shared Data Grid component (Global Framework Section 4.1) with the following module-specific defaults:

| Property         | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Row height       | 36px                                                         |
| Virtualization   | Disabled (datasets < 50 rows in all sub-modules)             |
| Sorting          | Click column header; single-column sort                      |
| Row selection    | Single-click selects row, opens side panel in view/edit mode |
| Row hover        | `--workspace-bg-muted` background                            |
| Alternating rows | `--workspace-bg` / `--workspace-bg-subtle`                   |
| Pagination       | None (all records shown; scroll for overflow)                |

**Row action column (rightmost):**

| Action | Icon            | Tooltip  | RBAC                                            |
| ------ | --------------- | -------- | ----------------------------------------------- |
| Edit   | Lucide `Pencil` | "Edit"   | Admin only (BudgetOwner/Editor for Assumptions) |
| Delete | Lucide `Trash2` | "Delete" | Admin only                                      |

Delete triggers the shared Confirmation Dialog (Global Framework Section 4.7). Confirmation text: "Type the name/code to confirm deletion."

---

## 3. Sub-module 1: Chart of Accounts & Centers

**Route:** `/master-data/accounts`
**PRD:** FR-MDM-001, FR-MDM-002, FR-MDM-003

### 3.1 Toolbar Filters

| Filter      | Component        | Options                                 | Default |
| ----------- | ---------------- | --------------------------------------- | ------- |
| Type        | `<Select>` 140px | All, Revenue, Expense, Asset, Liability | All     |
| Center Type | `<Select>` 160px | All, Profit Center, Cost Center         | All     |
| Status      | `<Select>` 120px | All, Active, Inactive                   | Active  |

### 3.2 Table Columns

| #   | Column        | Key            | Type    | Width | Sortable | Notes                                    |
| --- | ------------- | -------------- | ------- | ----- | -------- | ---------------------------------------- |
| 1   | Account Code  | `accountCode`  | text    | 120px | Yes      | `--font-mono`, left-aligned, pinned left |
| 2   | Account Name  | `accountName`  | text    | 240px | Yes      | Primary display column                   |
| 3   | Type          | `type`         | badge   | 120px | Yes      | See badge colors below                   |
| 4   | IFRS Category | `ifrsCategory` | text    | 180px | Yes      | IFRS mapping label                       |
| 5   | Center Type   | `centerType`   | badge   | 140px | Yes      | See badge colors below                   |
| 6   | Status        | `status`       | badge   | 100px | Yes      | Active / Inactive                        |
| 7   | Actions       | —              | actions | 80px  | No       | Edit, Delete icons                       |

**Badge colors:**

| Badge         | Background             | Text                   | Border |
| ------------- | ---------------------- | ---------------------- | ------ |
| Revenue       | `#DCFCE7` (green-100)  | `#16A34A` (green-600)  | none   |
| Expense       | `#FEF2F2` (red-100)    | `#DC2626` (red-600)    | none   |
| Asset         | `#EFF6FF` (blue-100)   | `#2563EB` (blue-600)   | none   |
| Liability     | `#FFF7ED` (orange-100) | `#EA580C` (orange-600) | none   |
| Profit Center | `#F0FDF4` (green-50)   | `#16A34A` (green-600)  | none   |
| Cost Center   | `#FEF2F2` (red-50)     | `#DC2626` (red-600)    | none   |
| Active        | `--color-success-bg`   | `--color-success`      | none   |
| Inactive      | `--workspace-bg-muted` | `--text-muted`         | none   |

### 3.3 Side Panel: Create / Edit Account

**Trigger:** "Add New" button (create) or row click / Edit action (edit).
**Panel title:** "New Account" (create) or "Edit Account" (edit).
**Width:** 480px (Global Framework Section 4.4).

| #   | Field         | Component    | Validation                                | Required            |
| --- | ------------- | ------------ | ----------------------------------------- | ------------------- |
| 1   | Account Code  | `<Input>`    | Pattern: `^[A-Z0-9]{3,10}$`, unique check | Yes                 |
| 2   | Account Name  | `<Input>`    | Max 100 characters                        | Yes                 |
| 3   | Type          | `<Select>`   | Enum: Revenue, Expense, Asset, Liability  | Yes                 |
| 4   | IFRS Category | `<Select>`   | Enum: loaded from IFRS category list      | Yes                 |
| 5   | Center Type   | `<Select>`   | Enum: Profit Center, Cost Center          | Yes                 |
| 6   | Description   | `<Textarea>` | Max 500 characters                        | No                  |
| 7   | Status        | `<Select>`   | Enum: Active, Inactive                    | Yes, default Active |

**Form layout:** Vertical stack with `--space-4` (16px) gap between fields. Labels above inputs, `--text-sm` weight 500, `--text-secondary`.

**Footer actions:**

| Button | Variant                      | Label                             | Behavior                                            |
| ------ | ---------------------------- | --------------------------------- | --------------------------------------------------- |
| Save   | `<Button variant="default">` | "Save" (create) / "Update" (edit) | Validates, calls API, closes panel, refreshes table |
| Cancel | `<Button variant="outline">` | "Cancel"                          | Closes panel, discards changes                      |

**Validation behavior:** Follows Global Framework Section 4.3 inline validation. Errors shown below each field with `--color-error` text. Save button disabled until all required fields are valid.

### 3.4 Empty State

| Property    | Value                                                   |
| ----------- | ------------------------------------------------------- |
| Icon        | Lucide `BookOpen` (48px, `--text-muted`)                |
| Heading     | "No accounts configured"                                |
| Description | "Add your chart of accounts to start building budgets." |
| Action      | `<Button variant="default">` "Add First Account"        |

---

## 4. Sub-module 2: Academic Years & Grades

**Route:** `/master-data/academic`
**PRD:** FR-MDM-005, FR-MDM-006

This sub-module has two sections rendered as vertical panels separated by a horizontal divider.

### 4.1 Section Layout

```
+------------------------------------------------------------------+
| Module Toolbar: "Academic Years & Grades"  [Search] [+ Add Year] |
+------------------------------------------------------------------+
|                                                                  |
|  Section Header: "Academic Years"               [+ Add Year]    |
|  +------------------------------------------------------------+ |
|  | Academic Years Table                                        | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  ── Horizontal Divider (--workspace-border, 1px) ──            |
|                                                                  |
|  Section Header: "Grade Levels"                 [+ Add Grade]   |
|  +------------------------------------------------------------+ |
|  | Grade Levels Table                                          | |
|  +------------------------------------------------------------+ |
|                                                                  |
+------------------------------------------------------------------+
```

Section headers use `--text-lg`, weight 600, `--text-primary`. Each section has its own "Add" button aligned right within the section header bar.

### 4.2 Academic Years Table

| #   | Column         | Key             | Type    | Width | Sortable | Notes                        |
| --- | -------------- | --------------- | ------- | ----- | -------- | ---------------------------- |
| 1   | Fiscal Year    | `fiscalYear`    | text    | 100px | Yes      | e.g., "FY2026", pinned left  |
| 2   | AY1 Start      | `ay1Start`      | date    | 110px | Yes      | `DD/MM/YYYY` format          |
| 3   | AY1 End        | `ay1End`        | date    | 110px | No       | `DD/MM/YYYY` format          |
| 4   | AY2 Start      | `ay2Start`      | date    | 110px | No       | `DD/MM/YYYY` format          |
| 5   | AY2 End        | `ay2End`        | date    | 110px | No       | `DD/MM/YYYY` format          |
| 6   | Summer Start   | `summerStart`   | date    | 110px | No       | `DD/MM/YYYY` format          |
| 7   | Summer End     | `summerEnd`     | date    | 110px | No       | `DD/MM/YYYY` format          |
| 8   | Academic Weeks | `academicWeeks` | integer | 120px | Yes      | `--font-mono`, right-aligned |
| 9   | Actions        | —               | actions | 80px  | No       | Edit, Delete icons           |

### 4.3 Academic Year Side Panel

**Panel title:** "New Academic Year" / "Edit Academic Year"

| #   | Field          | Component               | Validation                           | Required |
| --- | -------------- | ----------------------- | ------------------------------------ | -------- |
| 1   | Fiscal Year    | `<Select>`              | Enum: FY2020-FY2029, unique per year | Yes      |
| 2   | AY1 Start      | `<DatePicker>`          | Valid date, must be before AY1 End   | Yes      |
| 3   | AY1 End        | `<DatePicker>`          | Valid date, must be after AY1 Start  | Yes      |
| 4   | AY2 Start      | `<DatePicker>`          | Valid date, must be after Summer End | Yes      |
| 5   | AY2 End        | `<DatePicker>`          | Valid date, must be after AY2 Start  | Yes      |
| 6   | Summer Start   | `<DatePicker>`          | Valid date, must be after AY1 End    | Yes      |
| 7   | Summer End     | `<DatePicker>`          | Valid date, must be before AY2 Start | Yes      |
| 8   | Academic Weeks | `<Input type="number">` | Integer, 1-52                        | Yes      |

**Cross-field validation:** Dates must be chronologically ordered: AY1 Start < AY1 End <= Summer Start < Summer End <= AY2 Start < AY2 End. Invalid order shows error below the offending field.

### 4.4 Grade Levels Table

The grade levels table displays 15 rows (PS through Terminale). This is a fixed dataset — rows cannot be added or removed, only edited.

| #   | Column         | Key            | Type       | Width | Sortable | Notes                                      |
| --- | -------------- | -------------- | ---------- | ----- | -------- | ------------------------------------------ |
| 1   | Grade Code     | `gradeCode`    | text       | 80px  | No       | e.g., "PS", "MS", pinned left              |
| 2   | Grade Name     | `gradeName`    | text       | 160px | No       | e.g., "Petite Section"                     |
| 3   | Band           | `band`         | badge      | 120px | Yes      | Maternelle / Elementaire / College / Lycee |
| 4   | Max Class Size | `maxClassSize` | integer    | 120px | Yes      | `--font-mono`, right-aligned               |
| 5   | Plancher %     | `plancherPct`  | percentage | 100px | No       | `--font-mono`, right-aligned               |
| 6   | Cible %        | `ciblePct`     | percentage | 100px | No       | `--font-mono`, right-aligned               |
| 7   | Plafond %      | `plafondPct`   | percentage | 100px | No       | `--font-mono`, right-aligned               |
| 8   | Display Order  | `displayOrder` | integer    | 100px | Yes      | `--font-mono`, right-aligned               |
| 9   | Actions        | —              | actions    | 60px  | No       | Edit icon only (no delete)                 |

**Band badge colors:**

| Band        | Background             | Text                   |
| ----------- | ---------------------- | ---------------------- |
| Maternelle  | `#FCE7F3` (pink-100)   | `#DB2777` (pink-600)   |
| Elementaire | `#DBEAFE` (blue-100)   | `#2563EB` (blue-600)   |
| College     | `#FEF3C7` (amber-100)  | `#D97706` (amber-600)  |
| Lycee       | `#E0E7FF` (indigo-100) | `#4F46E5` (indigo-600) |

### 4.5 Grade Level Side Panel

**Panel title:** "Edit Grade Level" (edit only, no create).

| #   | Field          | Component               | Validation                            | Required |
| --- | -------------- | ----------------------- | ------------------------------------- | -------- |
| 1   | Grade Code     | `<Input>` disabled      | Read-only                             | —        |
| 2   | Grade Name     | `<Input>` disabled      | Read-only                             | —        |
| 3   | Band           | `<Select>` disabled     | Read-only                             | —        |
| 4   | Max Class Size | `<Input type="number">` | Integer, 1-50                         | Yes      |
| 5   | Plancher %     | `<PercentInput>`        | 0-100, 1 decimal                      | Yes      |
| 6   | Cible %        | `<PercentInput>`        | 0-100, 1 decimal, must be >= Plancher | Yes      |
| 7   | Plafond %      | `<PercentInput>`        | 0-100, 1 decimal, must be >= Cible    | Yes      |
| 8   | Display Order  | `<Input type="number">` | Integer, 1-20                         | Yes      |

**Cross-field validation:** Plancher <= Cible <= Plafond. If violated, show error below Cible or Plafond field: "Cible must be between Plancher and Plafond values."

### 4.6 Empty State

**Academic Years empty state:**

| Property    | Value                                                    |
| ----------- | -------------------------------------------------------- |
| Icon        | Lucide `Calendar` (48px, `--text-muted`)                 |
| Heading     | "No academic years configured"                           |
| Description | "Define academic year periods for fiscal year planning." |
| Action      | `<Button variant="default">` "Add Academic Year"         |

**Grade Levels:** Always shows 15 rows (pre-seeded). No empty state needed.

---

## 5. Sub-module 3: Reference Data

**Route:** `/master-data/reference`
**PRD:** FR-MDM-004, FR-MDM-007

### 5.1 Tab Navigation

Reference Data uses a horizontal tab bar below the module toolbar to switch between three views.

```
+------------------------------------------------------------------+
| Module Toolbar: "Reference Data"  [Search]  [Filters]  [+ Add]  |
+------------------------------------------------------------------+
| [Nationalities]  [Tariffs]  [Departments]                        |
+------------------------------------------------------------------+
| Active tab content (table)                                       |
+------------------------------------------------------------------+
```

| Property      | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| Component     | shadcn/ui `<Tabs>`                                         |
| Tab height    | 40px                                                       |
| Active tab    | `--text-primary`, bold, `--color-info` bottom border (2px) |
| Inactive tab  | `--text-secondary`, no border                              |
| Background    | `--workspace-bg`                                           |
| Border-bottom | 1px solid `--workspace-border`                             |

The "Add New" button label changes per tab: "Add Nationality", "Add Tariff", "Add Department". Search and filters reset on tab change.

### 5.2 Nationalities Tab

#### Table Columns

| #   | Column     | Key         | Type    | Width | Sortable | Notes                                   |
| --- | ---------- | ----------- | ------- | ----- | -------- | --------------------------------------- |
| 1   | Code       | `code`      | text    | 100px | Yes      | e.g., "FR", "SA", "OT", pinned left     |
| 2   | Label      | `label`     | text    | 240px | Yes      | e.g., "Francais", "Nationaux", "Autres" |
| 3   | VAT Exempt | `vatExempt` | boolean | 120px | Yes      | Centered checkbox (read-only in table)  |
| 4   | Actions    | —           | actions | 80px  | No       | Edit, Delete icons                      |

#### Side Panel: Create / Edit Nationality

| #   | Field      | Component    | Validation                      | Required          |
| --- | ---------- | ------------ | ------------------------------- | ----------------- |
| 1   | Code       | `<Input>`    | Pattern: `^[A-Z]{2,5}$`, unique | Yes               |
| 2   | Label      | `<Input>`    | Max 100 characters              | Yes               |
| 3   | VAT Exempt | `<Checkbox>` | Boolean                         | No, default false |

### 5.3 Tariffs Tab

#### Table Columns

| #   | Column      | Key           | Type    | Width | Sortable | Notes                                   |
| --- | ----------- | ------------- | ------- | ----- | -------- | --------------------------------------- |
| 1   | Code        | `code`        | text    | 100px | Yes      | e.g., "RP", "R3+", "PLEIN", pinned left |
| 2   | Label       | `label`       | text    | 200px | Yes      | e.g., "Rabais Personnel"                |
| 3   | Description | `description` | text    | 360px | No       | Additional detail                       |
| 4   | Actions     | —             | actions | 80px  | No       | Edit, Delete icons                      |

#### Side Panel: Create / Edit Tariff

| #   | Field       | Component    | Validation                           | Required |
| --- | ----------- | ------------ | ------------------------------------ | -------- |
| 1   | Code        | `<Input>`    | Pattern: `^[A-Z0-9+]{2,10}$`, unique | Yes      |
| 2   | Label       | `<Input>`    | Max 100 characters                   | Yes      |
| 3   | Description | `<Textarea>` | Max 500 characters                   | No       |

### 5.4 Departments Tab

#### Table Columns

| #   | Column       | Key           | Type    | Width | Sortable | Notes                                   |
| --- | ------------ | ------------- | ------- | ----- | -------- | --------------------------------------- |
| 1   | Code         | `code`        | text    | 100px | Yes      | e.g., "ADMIN", "FAC", pinned left       |
| 2   | Label        | `label`       | text    | 240px | Yes      | e.g., "Administration", "Facilities"    |
| 3   | Band Mapping | `bandMapping` | badge   | 160px | Yes      | Maps to academic band or "Non-Academic" |
| 4   | Actions      | —             | actions | 80px  | No       | Edit, Delete icons                      |

**Band Mapping badge colors:** Same as Grade Levels band badges (Section 4.4). Non-Academic uses `--workspace-bg-muted` background with `--text-secondary` text.

#### Side Panel: Create / Edit Department

| #   | Field        | Component  | Validation                                                  | Required |
| --- | ------------ | ---------- | ----------------------------------------------------------- | -------- |
| 1   | Code         | `<Input>`  | Pattern: `^[A-Z_]{2,20}$`, unique                           | Yes      |
| 2   | Label        | `<Input>`  | Max 100 characters                                          | Yes      |
| 3   | Band Mapping | `<Select>` | Enum: Maternelle, Elementaire, College, Lycee, Non-Academic | Yes      |

### 5.5 Empty States

Each tab has its own empty state:

| Tab           | Icon               | Heading                       | Description                                                       | Action Label            |
| ------------- | ------------------ | ----------------------------- | ----------------------------------------------------------------- | ----------------------- |
| Nationalities | Lucide `Globe`     | "No nationalities configured" | "Add nationality categories for enrollment and VAT calculations." | "Add First Nationality" |
| Tariffs       | Lucide `Tag`       | "No tariffs configured"       | "Add tariff categories for tuition pricing."                      | "Add First Tariff"      |
| Departments   | Lucide `Building2` | "No departments configured"   | "Add departments for staff assignment and cost allocation."       | "Add First Department"  |

---

## 6. Sub-module 4: Assumptions & Parameters

**Route:** `/master-data/assumptions`
**PRD:** FR-MDM-008

### 6.1 Layout

This sub-module uses a grouped key-value table instead of a standard CRUD table. There is no "Add New" button — the parameter set is fixed. All values are editable inline.

```
+------------------------------------------------------------------+
| Module Toolbar: "Assumptions & Parameters"  [Search]  [Export]   |
+------------------------------------------------------------------+
|                                                                  |
|  [Section: Tax]                                                  |
|  +------------------------------------------------------------+ |
|  | Parameter Name          | Value       | Unit    | Modified | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  [Section: Discounts]                                            |
|  +------------------------------------------------------------+ |
|  | ...                                                         | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  [Section: Social Charges]                                       |
|  +------------------------------------------------------------+ |
|  | ...                                                         | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  [Section: Academic]                                             |
|  +------------------------------------------------------------+ |
|  | ...                                                         | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  [Section: Enrollment]                                           |
|  +------------------------------------------------------------+ |
|  | ...                                                         | |
|  +------------------------------------------------------------+ |
|                                                                  |
+------------------------------------------------------------------+
```

### 6.2 Table Structure

| #   | Column        | Key         | Type   | Width | Notes                                    |
| --- | ------------- | ----------- | ------ | ----- | ---------------------------------------- |
| 1   | Parameter     | `label`     | text   | 280px | Left-aligned, `--text-primary`           |
| 2   | Value         | `value`     | varies | 160px | Editable cell, type depends on parameter |
| 3   | Unit          | `unit`      | text   | 80px  | Read-only, e.g., "%", "SAR", "weeks"     |
| 4   | Last Modified | `updatedAt` | text   | 160px | `--text-muted`, relative timestamp       |

**Section headers** span the full table width as group header rows:

- Background: `--workspace-bg-muted`
- Text: `--text-lg`, weight 600, `--text-primary`
- Height: 40px
- Collapsible: click to toggle section visibility (chevron icon)

### 6.3 Parameter Definitions

#### Tax Section

| Parameter                | Key                      | Cell Type    | Validation              | Default  | Unit |
| ------------------------ | ------------------------ | ------------ | ----------------------- | -------- | ---- |
| VAT Rate                 | `vatRate`                | percentage   | 0-100, 1 decimal        | 15.0     | %    |
| VAT Exempt Nationalities | `vatExemptNationalities` | multi-select | Valid nationality codes | Francais | —    |

The "VAT Exempt Nationalities" field renders as a multi-select badge list in the cell. Clicking opens a popover with checkboxes for each nationality. Selected values shown as inline badges.

#### Discounts Section

| Parameter         | Key                  | Cell Type  | Validation       | Default | Unit |
| ----------------- | -------------------- | ---------- | ---------------- | ------- | ---- |
| RP Discount Rate  | `rpDiscountRate`     | percentage | 0-100, 1 decimal | 25.0    | %    |
| R3+ Discount Rate | `r3PlusDiscountRate` | percentage | 0-100, 1 decimal | 25.0    | %    |

#### Social Charges Section

| Parameter              | Key               | Cell Type  | Validation           | Default  | Unit |
| ---------------------- | ----------------- | ---------- | -------------------- | -------- | ---- |
| GOSI Rate (Total)      | `gosiRateTotal`   | percentage | Read-only (computed) | 11.75    | %    |
| GOSI Pension           | `gosiPension`     | percentage | 0-50, 2 decimals     | 9.75     | %    |
| GOSI SANED             | `gosiSaned`       | percentage | 0-50, 2 decimals     | 1.00     | %    |
| GOSI OHI               | `gosiOhi`         | percentage | 0-50, 2 decimals     | 1.00     | %    |
| Ajeer Nitaqat Rate     | `ajeerNitaqat`    | currency   | >= 0, Decimal(15,2)  | 1,500.00 | SAR  |
| Ajeer Non-Nitaqat Rate | `ajeerNonNitaqat` | currency   | >= 0, Decimal(15,2)  | 9,500.00 | SAR  |
| Ajeer Monthly Fee      | `ajeerMonthlyFee` | currency   | >= 0, Decimal(15,2)  | 160.00   | SAR  |

**GOSI Rate (Total)** is a computed row (read-only). Background: `--cell-readonly-bg`. Value: sum of Pension + SANED + OHI. Updates live as sub-components change. Displayed with a Lucide `Calculator` icon to indicate computed value.

#### Academic Section

| Parameter      | Key            | Cell Type | Validation | Default | Unit   |
| -------------- | -------------- | --------- | ---------- | ------- | ------ |
| Weeks per Year | `weeksPerYear` | integer   | 1-52       | 36      | weeks  |
| AY1 Months     | `ay1Months`    | integer   | 1-12       | 6       | months |
| AY2 Months     | `ay2Months`    | integer   | 1-12       | 4       | months |

#### Enrollment Section

| Parameter            | Key                  | Cell Type | Validation         | Default | Unit |
| -------------------- | -------------------- | --------- | ------------------ | ------- | ---- |
| Lateral Entry Weight | `lateralEntryWeight` | number    | 0.0-1.0, 1 decimal | 0.8     | —    |

### 6.4 Inline Editing Behavior

Assumptions use inline editing directly in the table (no side panel required):

1. **Editable cells** have `--cell-editable-bg` (yellow-50) background
2. **Click** on a value cell activates edit mode (single click, not double-click — different from grid cells because this is a form-like table)
3. **Enter** or **Tab** confirms the value and moves to the next editable cell
4. **Escape** cancels and reverts to previous value
5. **Auto-save** triggers on blur, following Global Framework Section 6.1

**Validation** is inline per Global Framework Section 4.3. The save indicator in the context bar reflects pending/saved state.

### 6.5 Empty State

Not applicable — the parameter table is pre-seeded with default values. If no parameters exist (fresh install), the system seeds defaults from Section 6.3 automatically.

---

## 7. RBAC Behavior

### 7.1 Role Permissions Matrix

| Action                       | Admin | BudgetOwner | Editor | Viewer |
| ---------------------------- | ----- | ----------- | ------ | ------ |
| **Chart of Accounts**        |       |             |        |        |
| View accounts table          | Yes   | Yes         | Yes    | Yes    |
| Create account               | Yes   | No          | No     | No     |
| Edit account                 | Yes   | No          | No     | No     |
| Delete account               | Yes   | No          | No     | No     |
| **Academic Years & Grades**  |       |             |        |        |
| View tables                  | Yes   | Yes         | Yes    | Yes    |
| Create academic year         | Yes   | No          | No     | No     |
| Edit academic year           | Yes   | No          | No     | No     |
| Delete academic year         | Yes   | No          | No     | No     |
| Edit grade level             | Yes   | No          | No     | No     |
| **Reference Data**           |       |             |        |        |
| View all tabs                | Yes   | Yes         | Yes    | Yes    |
| Create/edit/delete entries   | Yes   | No          | No     | No     |
| **Assumptions & Parameters** |       |             |        |        |
| View parameters              | Yes   | Yes         | Yes    | Yes    |
| Edit parameter values        | Yes   | Yes         | Yes    | No     |

### 7.2 UI Modifications by Role

**Admin:**

- Full CRUD on all sub-modules
- All "Add New" buttons visible
- All Edit/Delete row actions visible
- Inline editing enabled on Assumptions

**BudgetOwner / Editor:**

- Read-only on Chart of Accounts, Academic Years & Grades, Reference Data
- Tables render without `--cell-editable-bg` on structural data
- "Add New" buttons hidden
- Edit/Delete row actions hidden
- Inline editing enabled on Assumptions & Parameters only

**Viewer:**

- All tables fully read-only
- No editable cell highlights
- No "Add New" buttons
- No row actions
- No inline editing on Assumptions
- No cursor change on hover

---

## 8. API Integration

### 8.1 Endpoints

All endpoints follow the standard REST pattern. Base path: `/api/v1/master-data`.

#### Chart of Accounts

| Method | Endpoint        | Description        | Request Body                                                                        |
| ------ | --------------- | ------------------ | ----------------------------------------------------------------------------------- |
| GET    | `/accounts`     | List all accounts  | Query: `?type=&centerType=&status=&search=`                                         |
| GET    | `/accounts/:id` | Get single account | —                                                                                   |
| POST   | `/accounts`     | Create account     | `{ accountCode, accountName, type, ifrsCategory, centerType, description, status }` |
| PUT    | `/accounts/:id` | Update account     | Same as POST                                                                        |
| DELETE | `/accounts/:id` | Delete account     | —                                                                                   |

#### Academic Years

| Method | Endpoint              | Description     | Request Body                                                                                |
| ------ | --------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| GET    | `/academic-years`     | List all years  | —                                                                                           |
| GET    | `/academic-years/:id` | Get single year | —                                                                                           |
| POST   | `/academic-years`     | Create year     | `{ fiscalYear, ay1Start, ay1End, ay2Start, ay2End, summerStart, summerEnd, academicWeeks }` |
| PUT    | `/academic-years/:id` | Update year     | Same as POST                                                                                |
| DELETE | `/academic-years/:id` | Delete year     | —                                                                                           |

#### Grade Levels

| Method | Endpoint            | Description     | Request Body                                                        |
| ------ | ------------------- | --------------- | ------------------------------------------------------------------- |
| GET    | `/grade-levels`     | List all grades | —                                                                   |
| PUT    | `/grade-levels/:id` | Update grade    | `{ maxClassSize, plancherPct, ciblePct, plafondPct, displayOrder }` |

#### Reference Data

| Method | Endpoint             | Description            | Request Body                   |
| ------ | -------------------- | ---------------------- | ------------------------------ |
| GET    | `/nationalities`     | List all nationalities | —                              |
| POST   | `/nationalities`     | Create nationality     | `{ code, label, vatExempt }`   |
| PUT    | `/nationalities/:id` | Update nationality     | Same as POST                   |
| DELETE | `/nationalities/:id` | Delete nationality     | —                              |
| GET    | `/tariffs`           | List all tariffs       | —                              |
| POST   | `/tariffs`           | Create tariff          | `{ code, label, description }` |
| PUT    | `/tariffs/:id`       | Update tariff          | Same as POST                   |
| DELETE | `/tariffs/:id`       | Delete tariff          | —                              |
| GET    | `/departments`       | List all departments   | —                              |
| POST   | `/departments`       | Create department      | `{ code, label, bandMapping }` |
| PUT    | `/departments/:id`   | Update department      | Same as POST                   |
| DELETE | `/departments/:id`   | Delete department      | —                              |

#### Assumptions & Parameters

| Method | Endpoint       | Description        | Request Body                             |
| ------ | -------------- | ------------------ | ---------------------------------------- |
| GET    | `/assumptions` | Get all parameters | —                                        |
| PATCH  | `/assumptions` | Update parameters  | `{ [key]: value, ... }` (partial update) |

### 8.2 TanStack Query Configuration

| Query Key Pattern                      | Stale Time | Cache Time | Refetch Strategy |
| -------------------------------------- | ---------- | ---------- | ---------------- |
| `['master-data', 'accounts', filters]` | 60s        | 5min       | On window focus  |
| `['master-data', 'academic-years']`    | 60s        | 5min       | On window focus  |
| `['master-data', 'grade-levels']`      | 60s        | 5min       | On window focus  |
| `['master-data', 'nationalities']`     | 60s        | 5min       | On window focus  |
| `['master-data', 'tariffs']`           | 60s        | 5min       | On window focus  |
| `['master-data', 'departments']`       | 60s        | 5min       | On window focus  |
| `['master-data', 'assumptions']`       | 30s        | 5min       | On window focus  |

Master data has a longer stale time (60s vs 30s default) because reference data changes infrequently. Assumptions use 30s to match the auto-save interval.

### 8.3 Optimistic Updates

- **Create:** Add new row to table immediately, revert on error
- **Update:** Apply change to cell/row immediately, revert on error
- **Delete:** Remove row immediately, revert on error with toast
- **Assumptions PATCH:** Apply value change immediately, revert on error

---

## 9. State Management

### 9.1 Zustand Store: `useMasterDataStore`

```typescript
interface MasterDataState {
	// Active sub-module tab (for Reference Data)
	activeReferenceTab: 'nationalities' | 'tariffs' | 'departments';

	// Table state per sub-module
	accountsGrid: GridState;
	academicYearsGrid: GridState;
	gradeLevelsGrid: GridState;
	nationalitiesGrid: GridState;
	tariffsGrid: GridState;
	departmentsGrid: GridState;

	// Side panel state
	sidePanelOpen: boolean;
	sidePanelMode: 'create' | 'edit' | 'view' | null;
	sidePanelEntity: string | null; // entity type
	sidePanelRecordId: string | null;

	// Assumptions section collapse state
	assumptionSections: Record<string, boolean>; // section key -> collapsed
}

interface GridState {
	sortColumn: string | null;
	sortDirection: 'asc' | 'desc';
	searchQuery: string;
	filters: Record<string, string>;
	selectedRowId: string | null;
}
```

### 9.2 URL State

Master data sub-module routes sync tab and filter state to URL:

| Parameter | Example          | Description               |
| --------- | ---------------- | ------------------------- |
| `tab`     | `?tab=tariffs`   | Active Reference Data tab |
| `search`  | `?search=admin`  | Search query              |
| `type`    | `?type=Expense`  | Accounts type filter      |
| `status`  | `?status=Active` | Accounts status filter    |

---

## 10. Accessibility

### 10.1 ARIA Attributes

All tables follow Global Framework Section 10.2 grid accessibility requirements.

| Element                      | ARIA Attribute                       | Value                             |
| ---------------------------- | ------------------------------------ | --------------------------------- |
| Data table                   | `role="grid"`                        | —                                 |
| Table row                    | `role="row"`                         | —                                 |
| Column header                | `role="columnheader"`                | —                                 |
| Data cell                    | `role="gridcell"`                    | —                                 |
| Editable cell                | `aria-readonly`                      | `false`                           |
| Read-only cell               | `aria-readonly`                      | `true`                            |
| Section header (Assumptions) | `role="heading"`, `aria-level="2"`   | —                                 |
| Collapsible section          | `aria-expanded`                      | `true` / `false`                  |
| Tab list (Reference Data)    | `role="tablist"`                     | —                                 |
| Tab button                   | `role="tab"`, `aria-selected`        | `true` / `false`                  |
| Tab content                  | `role="tabpanel"`, `aria-labelledby` | Tab button ID                     |
| Side panel                   | `role="dialog"`, `aria-modal="true"` | —                                 |
| Side panel title             | `aria-labelledby`                    | Title element ID                  |
| Delete confirmation          | `role="alertdialog"`                 | —                                 |
| Status badges                | `aria-label`                         | Full text, e.g., "Status: Active" |

### 10.2 Keyboard Navigation

| Key                | Context             | Action                                      |
| ------------------ | ------------------- | ------------------------------------------- |
| `Tab`              | Reference Data tabs | Move between tab buttons                    |
| `Enter` / `Space`  | Tab button          | Activate tab                                |
| `Arrow Left/Right` | Tab list            | Move between tabs                           |
| `Arrow Up/Down`    | Table               | Move between rows                           |
| `Enter`            | Table row           | Open side panel for editing                 |
| `Delete`           | Table row (Admin)   | Open delete confirmation                    |
| `Escape`           | Side panel          | Close panel, return focus to triggering row |
| `Tab`              | Side panel form     | Move between form fields                    |

### 10.3 Screen Reader Announcements

| Event            | `aria-live` Region | Announcement                              |
| ---------------- | ------------------ | ----------------------------------------- |
| Record created   | `polite`           | "[Entity] created successfully"           |
| Record updated   | `polite`           | "[Entity] updated successfully"           |
| Record deleted   | `polite`           | "[Entity] deleted"                        |
| Validation error | `assertive`        | "Validation error: [message]"             |
| Tab changed      | `polite`           | "Showing [tab name] tab, [count] records" |

---

## 11. Error Handling & Edge Cases

### 11.1 API Error Handling

Follows Global Framework Section 9.1 with module-specific messaging:

| Scenario                 | HTTP Status | UI Behavior                                                          |
| ------------------------ | ----------- | -------------------------------------------------------------------- |
| Duplicate code           | 409         | Inline error on Code field: "This code already exists"               |
| Referenced record delete | 409         | Toast: "Cannot delete — this record is referenced by [module]"       |
| Validation failure       | 422         | Field-level errors in side panel form                                |
| Permission denied        | 403         | Toast: "You don't have permission to modify master data"             |
| Record not found         | 404         | Toast: "Record not found — it may have been deleted" + refresh table |
| Server error             | 500         | Error toast with retry button                                        |

### 11.2 Referential Integrity

Accounts, grades, nationalities, tariffs, and departments are referenced by planning modules. Deletion is blocked server-side when references exist. The UI handles this as follows:

1. User clicks Delete on a referenced record
2. Confirmation dialog appears as normal
3. User confirms deletion
4. API returns 409 with `REFERENCED_RECORD` error code
5. UI shows toast: "Cannot delete [Name] — it is used in [Enrollment / Revenue / Staffing]. Remove all references first."
6. Record remains in table, no change

### 11.3 Concurrent Editing

Master data uses optimistic locking (Global Framework Section 6.3). If two admins edit the same record:

1. Admin A loads record, sees `updated_at: T1`
2. Admin B loads same record, sees `updated_at: T1`
3. Admin A saves changes — succeeds, `updated_at` becomes T2
4. Admin B saves changes — receives 409 (OPTIMISTIC_LOCK)
5. Conflict dialog shows Admin A's changes vs Admin B's changes
6. Admin B chooses "Keep mine" (force save) or "Use theirs" (discard)

### 11.4 GOSI Total Auto-Calculation

When any GOSI sub-component (Pension, SANED, OHI) is edited:

1. New total is computed client-side: Pension + SANED + OHI
2. GOSI Rate (Total) row updates immediately with new sum
3. The PATCH request sends all three sub-components; server recomputes and returns the total
4. If server total differs from client (rounding), server value takes precedence

### 11.5 Search Behavior

- Search is case-insensitive and matches against Code and Name/Label fields
- Debounce: 300ms after last keystroke
- Empty search shows all records
- No results: show inline message "No results match your search" centered in the table area (not a full empty state)
