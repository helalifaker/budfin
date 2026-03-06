# 10 · Input Management

> **Document Version:** 1.0
> **Date:** March 5, 2026
> **Status:** Draft
> **Parent:** [00-global-framework.md](./00-global-framework.md)
> **PRD References:** FR-INP-001, FR-INP-002, FR-INP-003

---

## 1. Overview

### 1.1 Purpose

The Input Management module provides a centralized control surface for managing data entry across all planning modules. It addresses three concerns:

1. **Input Control Panel (FR-INP-001):** A dashboard-like panel showing all editable inputs across modules — total count, sheets with inputs, critical inputs, and largest input blocks. Admin, BudgetOwner, and Editor roles can toggle which budget cells accept input, locking or unlocking rows or sections of the budget table.
2. **Visual Highlighting (FR-INP-002):** Visual indicators that distinguish editable cells from read-only cells, highlight modified-but-unsaved cells, and mark cells with attached guidance notes. All visual differentiation meets WCAG AA contrast requirements.
3. **Input Guidance Notes (FR-INP-003):** Per-cell tooltip/popover system for attaching contextual guidance text to configurable parameters. Admin, BudgetOwner, and Editor roles can create and edit guidance notes; all roles can view them.

This module does not have its own sidebar navigation entry. The Input Control Panel is accessed via the module toolbar "More" menu on planning modules, or via a dedicated keyboard shortcut. Visual highlighting and guidance notes are rendered inline within each planning module's data grid.

### 1.2 User Stories

| ID        | Persona        | Story                                                                                                                            | Acceptance Criteria                                                                                                                                     |
| --------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-INP-01 | Admin          | As an Admin, I want to see a summary of all editable inputs across modules so I can understand the scope of data entry required. | Input Control Panel renders with total input count, per-module breakdown, critical inputs list, and largest input blocks (FR-INP-001).                  |
| US-INP-02 | Budget Owner   | As a Budget Owner, I want to lock specific rows or sections of the budget table so that editors cannot modify finalized figures. | Toggling a row/section lock in the Input Control Panel disables editing on the corresponding cells across modules (FR-INP-001).                         |
| US-INP-03 | Editor         | As an Editor, I want to clearly see which cells I can edit so I do not waste time clicking on read-only cells.                   | Editable cells have a distinct yellow background (`--cell-editable-bg`); read-only cells have a neutral background (`--cell-readonly-bg`) (FR-INP-002). |
| US-INP-04 | Budget Analyst | As a Budget Analyst, I want to see which cells have been modified but not yet saved so I can track pending changes.              | Modified-but-unsaved cells show an amber left border and subtle background tint (FR-INP-002).                                                           |
| US-INP-05 | Admin          | As an Admin, I want to add guidance notes to specific input cells so editors know what values are expected.                      | Admin can click the "Add note" action on any editable cell, enter guidance text, and save. An info icon appears in the cell (FR-INP-003).               |
| US-INP-06 | Editor         | As an Editor, I want to read guidance notes on input cells so I understand the expected value or methodology.                    | Clicking or hovering the info icon on a cell with a guidance note opens a popover with the note text and author attribution (FR-INP-003).               |
| US-INP-07 | Viewer         | As a Viewer, I want to see guidance notes on cells so I can understand the data without needing to ask the team.                 | Viewer role can view guidance note popovers but cannot create or edit them (FR-INP-003).                                                                |

### 1.3 Personas

| Persona      | Input Control Panel | Toggle Cell Editability | Add/Edit Guidance Notes | View Guidance Notes | View Highlighting |
| ------------ | ------------------- | ----------------------- | ----------------------- | ------------------- | ----------------- |
| Admin        | View                | Yes                     | Yes                     | Yes                 | Yes               |
| Budget Owner | View                | Yes                     | Yes                     | Yes                 | Yes               |
| Editor       | View (read-only)    | No                      | Yes                     | Yes                 | Yes               |
| Viewer       | Hidden              | No                      | No                      | Yes                 | Yes               |

_**Persona note:** "Budget Analyst" and "HR/Payroll Coordinator" are persona display names that both map to the **Editor** RBAC role. They share identical permissions in this module. If future versions require capability differentiation between these personas, a new RBAC role must be defined in TDD §4.2 PERMISSION_MAP and reviewed by the CAO (Constitution §III amendment procedure)._

---

## 2. Layout

### 2.1 Input Control Panel Placement

The Input Control Panel renders as a side panel (480px width, per Global Framework Section 4.4) triggered from the module toolbar "More" menu item "Input Map" or via `Ctrl+I` shortcut.

**Shell context:** The Input Control Panel renders as an overlay side panel (Global Framework Section 4.4.1) within PlanningShell. It does not use the docked right panel -- it overlays content independently, consistent with its role as a cross-module utility panel.

```
+--------+--------------------------------------------+-----------+
|        |  Context Bar (56px)                        |           |
|        +--------------------------------------------+           |
|        |  Module Toolbar (48px)           [More ▾]  |           |
| Side-  +--------------------------------------------+  Input   |
| bar    |                                            |  Control |
|        |  Module Content                            |  Panel   |
|        |  (Data Grid with highlighting              |  (480px) |
|        |   and guidance note icons)                 |           |
|        |                                            |           |
+--------+--------------------------------------------+-----------+
```

### 2.2 Visual Highlighting Placement

Cell highlighting is rendered inline within every data grid across all planning modules (Enrollment, Revenue, Staffing, P&L). No separate layout area is required. The highlighting tokens are defined in `00-global-framework.md` Section 1.1 (Editable Cell Highlight).

### 2.3 Guidance Note Popover Placement

The guidance note popover renders as a floating element anchored to the cell's info icon. It uses the shadcn/ui `<Popover>` component positioned above or below the cell (auto-flip to stay within viewport).

---

## 3. Components

### 3.1 Input Control Panel

A side panel component that provides a map of all editable inputs across the active version.

**Component:** `<InputControlPanel>`

**Trigger:** "More" menu > "Input Map" or `Ctrl+I` keyboard shortcut.

#### 3.1.1 Panel Header

| Property     | Value                              |
| ------------ | ---------------------------------- |
| Title        | "Input Map"                        |
| Subtitle     | Version name from context bar      |
| Close button | Standard side panel close (X icon) |

#### 3.1.2 Summary Cards Row

A row of 3 summary cards at the top of the panel.

| #   | Label         | Value Source                                | Icon         |
| --- | ------------- | ------------------------------------------- | ------------ |
| 1   | Total Inputs  | Count of all editable cells across modules  | `Edit3`      |
| 2   | Locked Inputs | Count of cells with input lock active       | `Lock`       |
| 3   | Guided Inputs | Count of cells with guidance notes attached | `HelpCircle` |

**Card visual spec:**

| Property      | Value                                                    |
| ------------- | -------------------------------------------------------- |
| Background    | `--workspace-bg-subtle`                                  |
| Border        | 1px solid `--workspace-border`                           |
| Border radius | `--radius-md` (6px)                                      |
| Padding       | `--space-3`                                              |
| Layout        | `grid-cols-3`, gap `--space-3`                           |
| Label         | `--text-xs`, `--text-secondary`, uppercase               |
| Value         | `--text-lg`, `--text-primary`, `--font-mono`, weight 700 |

#### 3.1.3 Module Breakdown List

Below the summary cards, a scrollable list grouped by module.

**Component:** Collapsible `<Accordion>` (shadcn/ui) with one item per module.

| Module                 | Sections Listed                                 |
| ---------------------- | ----------------------------------------------- |
| Enrollment & Capacity  | Enrollment by grade, Capacity settings          |
| Revenue                | Fee grids, Discount policies, Other revenue     |
| Staffing & Staff Costs | DHG grilles, Employee roster, Salary components |
| P&L & Reporting        | Manual adjustments, IFRS overrides              |

Each module accordion item shows:

```
+----------------------------------------------------------+
| ▼ Revenue                                   42 inputs    |
|   +-------------------------------------------------+    |
|   | Section           | Inputs | Locked | Status    |    |
|   |-------------------|--------|--------|-----------|    |
|   | Fee Grids         |     24 |      0 | Editable  |    |
|   | Discount Policies |     12 |     12 | Locked    |    |
|   | Other Revenue     |      6 |      0 | Editable  |    |
|   +-------------------------------------------------+    |
+----------------------------------------------------------+
```

| Column  | Description                             | Style                                     |
| ------- | --------------------------------------- | ----------------------------------------- |
| Section | Section name within the module          | `--text-sm`, left-aligned                 |
| Inputs  | Count of editable cells in this section | `--text-sm`, `--font-mono`, right-aligned |
| Locked  | Count of locked cells                   | `--text-sm`, `--font-mono`, right-aligned |
| Status  | "Editable", "Locked", or "Partial"      | `<Badge>` — green/violet/amber            |

#### 3.1.4 Lock Toggle (Admin/BudgetOwner Only)

When the user has Admin or BudgetOwner role, each section row in the module breakdown gains a lock toggle.

| Property  | Value                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| Component | `<Switch>` (shadcn/ui)                                                                       |
| Position  | Right side of section row                                                                    |
| Label     | `aria-label="Toggle lock for [Section Name]"`                                                |
| Default   | Off (unlocked)                                                                               |
| On toggle | Sends `PATCH /api/v1/versions/:versionId/input-locks` with section identifier and lock state |

**Visual feedback on toggle:**

- Lock ON: switch active, section status badge changes to "Locked" (violet), lock count increments
- Lock OFF: switch inactive, section status badge changes to "Editable" (green), lock count decrements

For Editor role: lock toggle is hidden; section status is displayed as read-only text.

### 3.2 Cell Highlighting System

Inline visual indicators applied to every data grid cell across planning modules (FR-INP-002).

**Component:** No separate component. Highlighting is applied via conditional CSS classes on `<td>` elements within the shared data grid component (Global Framework Section 4.1).

#### 3.2.1 Cell State Visual Spec

| State                      | Background                                  | Border                                        | Cursor              | Additional Indicator                                          |
| -------------------------- | ------------------------------------------- | --------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| Editable (default)         | `--cell-editable-bg` (`#FEFCE8`, yellow-50) | none                                          | `cell` (crosshair)  | none                                                          |
| Editable (focused)         | `--cell-editable-bg`                        | 2px solid `--cell-editable-focus` (`#2563EB`) | `text`              | none                                                          |
| Read-only                  | `--cell-readonly-bg` (`#F8FAFC`, slate-50)  | none                                          | `default`           | none                                                          |
| Locked (via Input Control) | `--workspace-bg-muted` (`#F1F5F9`)          | none                                          | `not-allowed`       | Lucide `Lock` icon (12px, `--text-muted`) in cell corner      |
| Modified (unsaved)         | `#FEF3C7` (amber-100)                       | 2px left solid `--color-warning` (`#D97706`)  | `cell`              | none                                                          |
| Validation error           | `--workspace-bg`                            | 2px solid `--cell-error-border` (`#DC2626`)   | `cell`              | Error tooltip below cell                                      |
| Has guidance note          | Inherits from editable/read-only state      | none                                          | `cell` or `default` | Lucide `Info` icon (12px, `--color-info`) in top-right corner |

#### 3.2.2 Color Independence (WCAG AA)

All cell states are distinguishable without relying on color alone:

| State             | Non-Color Indicator                                             |
| ----------------- | --------------------------------------------------------------- |
| Editable          | Crosshair cursor on hover; yellow tint is supplementary         |
| Read-only         | Default cursor; no edit activation on double-click              |
| Locked            | Lock icon visible in cell; `not-allowed` cursor                 |
| Modified          | Left border (structural indicator); amber tint is supplementary |
| Validation error  | Error icon + tooltip text; red border is supplementary          |
| Has guidance note | Info icon visible in cell corner                                |

#### 3.2.3 Contrast Ratios

| Element                         | Foreground            | Background            | Contrast Ratio | Passes AA                        |
| ------------------------------- | --------------------- | --------------------- | -------------- | -------------------------------- |
| Text on editable cell           | `#0F172A` (slate-900) | `#FEFCE8` (yellow-50) | 15.2:1         | Yes                              |
| Text on read-only cell          | `#0F172A` (slate-900) | `#F8FAFC` (slate-50)  | 16.8:1         | Yes                              |
| Text on locked cell             | `#0F172A` (slate-900) | `#F1F5F9` (slate-100) | 15.1:1         | Yes                              |
| Text on modified cell           | `#0F172A` (slate-900) | `#FEF3C7` (amber-100) | 14.5:1         | Yes                              |
| Lock icon on locked cell        | `#94A3B8` (slate-400) | `#F1F5F9` (slate-100) | 3.1:1          | Yes (UI component, 3:1 required) |
| Info icon on cell               | `#2563EB` (blue-600)  | `#FEFCE8` / `#F8FAFC` | 4.9:1 / 5.3:1  | Yes                              |
| Warning border on modified cell | `#D97706` (amber-600) | adjacent cell bg      | 3.4:1          | Yes (UI component)               |

### 3.3 Guidance Note Popover

A popover component for displaying and editing per-cell guidance notes (FR-INP-003).

**Component:** `<GuidanceNotePopover>` wrapping shadcn/ui `<Popover>`

#### 3.3.1 Trigger

| Property                | Value                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| Trigger element         | Lucide `Info` icon (12px) in the top-right corner of cells with attached notes |
| Trigger for empty cells | Right-click context menu > "Add Guidance Note" (Admin/BudgetOwner/Editor only) |
| Activation              | Click on info icon (touch/mouse); focus + Enter (keyboard)                     |
| Hover behavior          | Tooltip preview showing first 60 characters of note text after 500ms delay     |

#### 3.3.2 Popover Content (View Mode)

```
+--------------------------------------------+
| Guidance Note                          [X]  |
|--------------------------------------------|
| "Enter the approved fee amount from the    |
|  Board resolution dated DD/MM/YYYY.        |
|  Reference: Board Minutes #2026-03"        |
|--------------------------------------------|
| Added by: Ahmed K. · 2 days ago       [Edit] |
+--------------------------------------------+
```

| Property      | Value                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Width         | 320px                                                                           |
| Max height    | 240px (scrollable if overflow)                                                  |
| Background    | `--workspace-bg`                                                                |
| Border        | 1px solid `--workspace-border`                                                  |
| Border radius | `--radius-md` (6px)                                                             |
| Shadow        | `--shadow-md`                                                                   |
| Title         | "Guidance Note" — `--text-sm`, weight 600                                       |
| Note text     | `--text-sm`, `--text-primary`, line-height 20px                                 |
| Attribution   | `--text-xs`, `--text-muted` — "Added by: [name] · [relative time]"              |
| Edit button   | `<Button variant="ghost" size="sm">` — visible to Admin/BudgetOwner/Editor only |
| Close button  | `<Button variant="ghost" size="icon">` — Lucide `X`, 16px                       |

#### 3.3.3 Popover Content (Edit Mode)

When the Edit button is clicked, the popover transitions to edit mode:

```
+--------------------------------------------+
| Edit Guidance Note                     [X]  |
|--------------------------------------------|
| +----------------------------------------+ |
| | Enter the approved fee amount from the | |
| | Board resolution dated DD/MM/YYYY.     | |
| | Reference: Board Minutes #2026-03      | |
| +----------------------------------------+ |
|--------------------------------------------|
| 280/500 chars              [Cancel] [Save]  |
+--------------------------------------------+
```

| Property          | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| Input             | `<Textarea>` (shadcn/ui), 4 rows, auto-resize up to 8 rows |
| Max length        | 500 characters                                             |
| Character counter | `--text-xs`, `--text-muted`, right-aligned below textarea  |
| Cancel button     | `<Button variant="outline" size="sm">`                     |
| Save button       | `<Button variant="default" size="sm">`                     |

#### 3.3.4 Delete Guidance Note

Available to Admin and BudgetOwner only. Accessed via the "More" menu (three-dot icon) in the popover header:

| Action      | Confirmation                                                                                       | Endpoint                                                    |
| ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Delete note | Inline confirmation: "Remove this guidance note?" with "Remove" (destructive) and "Cancel" buttons | `DELETE /api/v1/versions/:versionId/guidance-notes/:noteId` |

---

## 4. Interaction Patterns

### 4.1 Input Control Panel Interactions

| Interaction             | Behavior                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Open Input Map          | Side panel slides in from right (200ms ease-in-out). Focus moves to first accordion item.                                       |
| Expand module accordion | Reveals section breakdown table with input counts and lock toggles.                                                             |
| Toggle section lock     | Optimistic update: immediately toggles UI state. PATCH request sent in background. On failure: revert toggle, show toast error. |
| Click section row       | Navigates to the corresponding module and scrolls to the section. Side panel remains open.                                      |
| Close Input Map         | Side panel slides out. Focus returns to the "More" menu trigger.                                                                |

### 4.2 Cell Highlighting Interactions

| Interaction              | Behavior                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Hover on editable cell   | Cursor changes to `cell` (crosshair). Subtle background shift to slightly darker yellow.                                           |
| Hover on locked cell     | Cursor changes to `not-allowed`. Tooltip: "This section is locked by [Admin name]".                                                |
| Double-click locked cell | No action. Toast: "This cell is locked. Contact your administrator to unlock."                                                     |
| Cell value modified      | Background transitions to modified state (`#FEF3C7`) with amber left border. Returns to editable state after successful auto-save. |

### 4.3 Guidance Note Interactions

| Interaction                         | Behavior                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Click info icon                     | Opens guidance note popover anchored to the cell.                                                                            |
| Right-click editable cell (no note) | Context menu includes "Add Guidance Note" for Admin/BudgetOwner/Editor roles.                                                |
| Edit note                           | Popover transitions to edit mode. Save triggers `PUT /api/v1/versions/:versionId/guidance-notes/:noteId`.                    |
| Add new note                        | Creates note via `POST /api/v1/versions/:versionId/guidance-notes` with `cell_reference` (module + row + column identifier). |
| Delete note                         | Removes info icon from cell. Popover closes.                                                                                 |
| Hover on info icon                  | After 500ms delay, shows tooltip preview of first 60 characters.                                                             |

---

## 5. States

### 5.1 Loading State

| Element                 | Loading Behavior                                                      |
| ----------------------- | --------------------------------------------------------------------- |
| Input Control Panel     | 3 skeleton summary cards + 4 skeleton accordion items with shimmer    |
| Guidance note popover   | Small skeleton block (120px x 60px) with shimmer inside popover frame |
| Duration before showing | 200ms delay (per Global Framework Section 4.9)                        |

### 5.2 Empty States

#### Input Control Panel — No Inputs

| Property    | Value                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Icon        | Lucide `Edit3`, 48px, `--text-muted`                                                                                                 |
| Heading     | "No editable inputs" — `--text-lg`, `--text-secondary`                                                                               |
| Description | "This version has no editable cells. Enter data in the planning modules to see input statistics here." — `--text-sm`, `--text-muted` |

#### Guidance Note — No Note on Cell

No visual indicator. The info icon is only shown on cells that have an attached note. Cells without notes show no guidance icon.

### 5.3 Error States

| Error                           | UI Behavior                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Input Control Panel API failure | Inline error in side panel: "Failed to load input map" with retry button. Module content remains unaffected. |
| Lock toggle failure             | Toast: "Failed to update lock state. Please try again." Toggle reverts to previous state.                    |
| Guidance note save failure      | Toast: "Failed to save guidance note." Popover remains in edit mode with unsaved content preserved.          |

### 5.4 Locked Version State

When the active version is Locked or Archived:

| Element             | Behavior                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Input Control Panel | Lock toggles hidden for all roles. Status column shows "Locked" for all sections. Summary shows full count as locked. |
| Cell highlighting   | All cells render with `--cell-readonly-bg`. No editable highlights.                                                   |
| Guidance notes      | Viewable but not editable. Edit/Add/Delete actions hidden for all roles.                                              |
| Read-only banner    | Standard banner per Global Framework Section 4.10 is displayed.                                                       |

---

## 6. RBAC Behavior

### 6.1 Role-Based UI Modifications

| UI Element               | Admin               | BudgetOwner         | Editor              | Viewer                     |
| ------------------------ | ------------------- | ------------------- | ------------------- | -------------------------- |
| Input Map (side panel)   | Visible             | Visible             | Visible (read-only) | Hidden                     |
| Summary cards            | View                | View                | View                | Hidden                     |
| Module breakdown         | View + lock toggles | View + lock toggles | View (no toggles)   | Hidden                     |
| Section lock toggle      | Yes                 | Yes                 | Hidden              | Hidden                     |
| Cell editable highlight  | Yes                 | Yes                 | Yes                 | No (all read-only styling) |
| Modified cell highlight  | Yes                 | Yes                 | Yes                 | N/A                        |
| Guidance note — view     | Yes                 | Yes                 | Yes                 | Yes                        |
| Guidance note — add/edit | Yes                 | Yes                 | Yes                 | No                         |
| Guidance note — delete   | Yes                 | Yes                 | No                  | No                         |

### 6.2 Viewer Role Specifics

- Input Map menu item hidden from "More" menu
- All cells render with `--cell-readonly-bg` (no editable highlight)
- Guidance note info icons remain visible; clicking opens view-only popover without Edit or Delete actions
- `Ctrl+I` shortcut is disabled

---

## 7. API Endpoints

### 7.1 Input Map Summary

**`GET /api/v1/versions/:versionId/input-map`**

| Property   | Value                                   |
| ---------- | --------------------------------------- |
| Method     | GET                                     |
| Auth       | Admin, BudgetOwner, Editor (JWT Bearer) |
| Path param | `versionId` — integer, required         |
| Response   | 200 OK                                  |

**Response schema:**

```json
{
	"total_inputs": 342,
	"locked_inputs": 48,
	"guided_inputs": 15,
	"modules": [
		{
			"module": "enrollment",
			"label": "Enrollment & Capacity",
			"total_inputs": 96,
			"sections": [
				{
					"section_id": "enrollment_by_grade",
					"label": "Enrollment by Grade",
					"input_count": 72,
					"locked_count": 0,
					"is_locked": false
				}
			]
		}
	]
}
```

### 7.2 Input Lock Management

**`PATCH /api/v1/versions/:versionId/input-locks`**

| Property     | Value                                              |
| ------------ | -------------------------------------------------- |
| Method       | PATCH                                              |
| Auth         | Admin, BudgetOwner only (JWT Bearer)               |
| Path param   | `versionId` — integer, required                    |
| Request body | `{ "section_id": "string", "is_locked": boolean }` |
| Response     | 200 OK with updated section state                  |

**Error responses:**

| Status | Code              | Condition                              |
| ------ | ----------------- | -------------------------------------- |
| 403    | FORBIDDEN         | User role is not Admin or BudgetOwner  |
| 404    | VERSION_NOT_FOUND | Version does not exist                 |
| 409    | VERSION_LOCKED    | Version is in Locked or Archived state |

### 7.3 Guidance Notes

**`GET /api/v1/versions/:versionId/guidance-notes`**

| Property     | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| Method       | GET                                                        |
| Auth         | All authenticated                                          |
| Query params | `module` (optional filter), `section_id` (optional filter) |
| Response     | 200 OK — array of guidance notes                           |

**Response schema:**

```json
{
	"notes": [
		{
			"id": "string (UUID)",
			"cell_reference": {
				"module": "revenue",
				"section_id": "fee_grids",
				"row_id": "string",
				"column_id": "string"
			},
			"content": "string (max 500 chars)",
			"created_by": {
				"id": "string",
				"display_name": "string"
			},
			"created_at": "ISO 8601",
			"updated_at": "ISO 8601"
		}
	]
}
```

**`POST /api/v1/versions/:versionId/guidance-notes`**

| Property     | Value                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Method       | POST                                                                                                                                   |
| Auth         | Admin, BudgetOwner, Editor (JWT Bearer)                                                                                                |
| Request body | `{ "cell_reference": { "module": "string", "section_id": "string", "row_id": "string", "column_id": "string" }, "content": "string" }` |
| Response     | 201 Created                                                                                                                            |

**`PUT /api/v1/versions/:versionId/guidance-notes/:noteId`**

| Property     | Value                                   |
| ------------ | --------------------------------------- |
| Method       | PUT                                     |
| Auth         | Admin, BudgetOwner, Editor (JWT Bearer) |
| Request body | `{ "content": "string" }`               |
| Response     | 200 OK                                  |

**`DELETE /api/v1/versions/:versionId/guidance-notes/:noteId`**

| Property | Value                   |
| -------- | ----------------------- |
| Method   | DELETE                  |
| Auth     | Admin, BudgetOwner only |
| Response | 204 No Content          |

**Common error responses for guidance note endpoints:**

| Status | Code             | Condition                                                   |
| ------ | ---------------- | ----------------------------------------------------------- |
| 403    | FORBIDDEN        | User role lacks required permission                         |
| 404    | NOTE_NOT_FOUND   | Note ID does not exist                                      |
| 409    | VERSION_LOCKED   | Version is in Locked or Archived state                      |
| 422    | VALIDATION_ERROR | Content exceeds 500 characters or cell_reference is invalid |

---

## 8. Accessibility

### 8.1 Landmark Structure

Input management features are embedded within existing module pages. No separate landmark is required for highlighting or guidance notes. The Input Control Panel side panel uses the standard side panel landmark:

```html
<aside aria-label="Input Map" role="complementary">
	<section aria-label="Input Summary">
		<!-- Summary cards -->
	</section>
	<section aria-label="Module Breakdown">
		<!-- Accordion with module sections -->
	</section>
</aside>
```

### 8.2 Cell Highlighting Accessibility

| Requirement        | Implementation                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Editable state     | `aria-readonly="false"` on editable cells                                                   |
| Read-only state    | `aria-readonly="true"` on read-only and locked cells                                        |
| Locked cell        | `aria-disabled="true"` + `aria-label` includes "Locked" suffix (e.g., "Fee Amount, Locked") |
| Modified cell      | `aria-label` includes "Modified, unsaved" suffix                                            |
| Color independence | All states communicated via cursor, icon, and ARIA attributes — not color alone             |

### 8.3 Guidance Note Accessibility

| Requirement         | Implementation                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Info icon           | `aria-label="View guidance note"` on clickable icon; `role="button"`                                         |
| Popover             | `role="dialog"`, `aria-label="Guidance note for [cell label]"`                                               |
| Focus management    | On open: focus moves to note text (view mode) or textarea (edit mode). On close: focus returns to info icon. |
| Keyboard activation | `Enter` or `Space` on info icon opens popover                                                                |
| Escape key          | Closes popover, returns focus to info icon                                                                   |
| Screen reader       | Note content is the first focusable element; attribution is announced as secondary text                      |

### 8.4 Input Control Panel Accessibility

| Requirement       | Implementation                                                             |
| ----------------- | -------------------------------------------------------------------------- |
| Panel role        | `role="complementary"` with `aria-label="Input Map"`                       |
| Accordion         | Standard shadcn/ui `<Accordion>` ARIA: `aria-expanded`, `aria-controls`    |
| Lock toggle       | `<Switch>` with `aria-label="Toggle lock for [Section Name]"`              |
| Summary cards     | `role="region"` with `aria-label` set to card label (e.g., "Total Inputs") |
| Lock state change | `aria-live="polite"` on lock count value to announce updates               |

### 8.5 Keyboard Navigation

| Key               | Context                           | Action                                                                           |
| ----------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `Ctrl+I`          | Any planning module               | Opens/closes Input Control Panel side panel                                      |
| `Tab`             | Input Control Panel               | Moves focus through summary cards, accordion headers, section rows, lock toggles |
| `Enter` / `Space` | Accordion header                  | Expands/collapses module section                                                 |
| `Enter` / `Space` | Lock toggle                       | Toggles section lock state                                                       |
| `Enter` / `Space` | Info icon in cell                 | Opens guidance note popover                                                      |
| `Escape`          | Guidance note popover             | Closes popover                                                                   |
| `Escape`          | Input Control Panel               | Closes side panel                                                                |
| `Tab`             | Guidance note popover (edit mode) | Moves between textarea, Cancel, and Save buttons                                 |

---

## 9. Context Bar Integration

Input management features respond to context bar selections as follows:

| Context Bar Element  | Behavior                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version selector     | Input Control Panel re-fetches input map for new version. Guidance notes re-fetched. Cell highlighting re-evaluated based on new version lock states. |
| Fiscal Year selector | Triggers version reload, which cascades to input management data refresh.                                                                             |
| Comparison toggle    | No direct effect on input management features. Highlighting and guidance notes are shown for the primary version only.                                |
| Period toggle        | No effect on input management features. Lock state and guidance notes are version-level, not period-specific.                                         |

**Query key patterns (TanStack Query):**

```typescript
['input-map', versionId][('input-locks', versionId)][
	('guidance-notes', versionId, { module, section_id })
];
```

**Stale time:** 30 seconds (matches global auto-save interval from Global Framework Section 11.1).

---

## Appendix A: Design Token Quick Reference

Tokens referenced in this spec (from `00-global-framework.md`):

| Token                   | Value                            | Used In                              |
| ----------------------- | -------------------------------- | ------------------------------------ |
| `--cell-editable-bg`    | `#FEFCE8` (yellow-50)            | Editable cell background             |
| `--cell-editable-focus` | `#2563EB` (blue-600)             | Focused editable cell border         |
| `--cell-readonly-bg`    | `#F8FAFC` (slate-50)             | Read-only cell background            |
| `--cell-error-border`   | `#DC2626` (red-600)              | Validation error cell border         |
| `--workspace-bg`        | `#FFFFFF`                        | Popover background, panel background |
| `--workspace-bg-subtle` | `#F8FAFC`                        | Summary card background              |
| `--workspace-bg-muted`  | `#F1F5F9`                        | Locked cell background               |
| `--workspace-border`    | `#E2E8F0`                        | Popover border, panel borders        |
| `--color-info`          | `#2563EB`                        | Info icon, guidance note indicator   |
| `--color-warning`       | `#D97706`                        | Modified cell border                 |
| `--text-primary`        | `#0F172A`                        | Note text, cell values               |
| `--text-secondary`      | `#475569`                        | Labels, card titles                  |
| `--text-muted`          | `#94A3B8`                        | Attribution text, lock icon          |
| `--shadow-md`           | `0 4px 6px -1px rgba(0,0,0,0.1)` | Guidance note popover                |
| `--radius-md`           | 6px                              | Popover, summary cards               |

---

## Appendix B: Traceability

| FR ID      | Requirement                                                          | Sections Covering                 |
| ---------- | -------------------------------------------------------------------- | --------------------------------- |
| FR-INP-001 | Input control panel / map showing all editable inputs across modules | 3.1, 4.1, 5.1, 5.2, 7.1, 7.2, 8.4 |
| FR-INP-002 | Visual highlighting of editable cells                                | 3.2, 4.2, 5.4, 8.2                |
| FR-INP-003 | Input guidance notes for each configurable parameter                 | 3.3, 4.3, 5.3, 7.3, 8.3           |
