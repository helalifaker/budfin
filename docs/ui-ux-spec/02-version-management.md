# BudFin UI/UX Specification: Version Management

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Module:** Version Management (Planning group)
> **PRD Reference:** Section 7 (FR-VER-001 through FR-VER-006)
> **Global Framework:** `00-global-framework.md`

---

## 1. Module Purpose

The Version Management module provides full lifecycle management for budget versions: create, clone, publish, lock, archive, compare, and delete. It is the dedicated workspace for managing version metadata and lifecycle transitions, distinct from the context bar's version selector which merely sets the active working version for data display.

**Key workflows:**

- Create new Budget or Forecast versions (FR-VER-001)
- Clone existing versions as starting points for new iterations (FR-VER-005)
- Transition versions through the lifecycle: Draft -> Published -> Locked -> Archived (FR-VER-003)
- Delete draft versions (FR-VER-002)
- View and manage version metadata (FR-VER-006)
- Launch version comparison (FR-VER-004)

**Navigation path:** Sidebar > Planning > Version Management
**Route:** `/planning/version-management`

---

## 2. Personas & Permissions

| Capability                           | Admin | BudgetOwner | Editor | Viewer |
| ------------------------------------ | ----- | ----------- | ------ | ------ |
| View version list                    | Yes   | Yes         | Yes    | Yes    |
| View version details (side panel)    | Yes   | Yes         | Yes    | Yes    |
| Create new version                   | Yes   | Yes         | No     | No     |
| Clone version                        | Yes   | Yes         | No     | No     |
| Publish (Draft -> Published)         | Yes   | Yes         | No     | No     |
| Lock (Published -> Locked)           | Yes   | Yes         | No     | No     |
| Archive (Locked -> Archived)         | Yes   | No          | No     | No     |
| Revert to Draft (reverse transition) | Yes   | No          | No     | No     |
| Delete draft version                 | Yes   | Yes         | No     | No     |
| Compare versions                     | Yes   | Yes         | Yes    | Yes    |

**RBAC enforcement:** The API enforces role checks on all mutation endpoints. The UI hides or disables controls for unauthorized actions per the table above. Editor and Viewer roles see a read-only version list with only "View Details" in the row action menu.

---

## 3. Layout Structure

The module renders inside ManagementShell -- no context bar, no docked right panel. It follows the ManagementShell Module Template (Global Framework Section 12.2).

```
+--------+--------------------------------------------------------------+
|        | Module Toolbar (48px)                                        |
| Side-  |  [Version Management] [FY: v] [Type Filter] [Status Filter] |
| bar    |  [Search]                            [Compare] [+ New Version]|
|        +--------------------------------------------------------------+
|        |                                                              |
|        |                    Version Table                             |
|        |                                                              |
|        |  Name | Type | Status | Source | Created By | Created At ... |
|        |  ─────────────────────────────────────────────────────────── |
|        |  FY2026 Budget v1  | BUD | Published | ...                   |
|        |  FY2026 Forecast 1 | FC  | Draft     | ...                   |
|        |  FY2026 Actuals    | ACT | Locked    | ...                   |
|        |                                                              |
+--------+--------------------------------------------------------------+
```

**Workspace dimensions:**

- Full width of main workspace area (sidebar to right edge)
- Table fills available height with standard overflow scrolling (no virtual scrolling — ADR-016)
- Module toolbar is sticky at top

---

## 4. Module Toolbar

| Element            | Position           | Component                                                         | Behavior                                                                                                                       |
| ------------------ | ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Fiscal Year filter | Left (after title) | `<Select>` (shadcn/ui), width 120px                               | Options: FY2020-FY2029. Default: current FY. Reloads version list on change. Replaces context bar FY selector for this module. |
| Module title       | Left               | `<h1>` with `--text-xl`, weight 600                               | Static text: "Version Management"                                                                                              |
| Type filter        | Center-left        | `<Select>` (shadcn/ui), width 140px                               | Options: All Types, Actual, Budget, Forecast. Filters table rows client-side. Default: "All Types"                             |
| Status filter      | Center             | `<Select>` (shadcn/ui), width 160px                               | Options: All Statuses, Draft, Published, Locked, Archived. Filters table rows client-side. Default: "All Statuses"             |
| Search             | Center-right       | `<Input>` (shadcn/ui) with search icon, width 200px               | Filters by version name (client-side, debounced 300ms)                                                                         |
| Compare button     | Right              | `<Button variant="outline">` with columns icon (Lucide `Columns`) | Opens comparison dialog. Visible to all roles                                                                                  |
| New Version button | Far right          | `<Button variant="default">` with plus icon (Lucide `Plus`)       | Opens create side panel. Hidden for Editor and Viewer roles                                                                    |

**Toolbar styling:**

- Height: 48px
- Background: `--workspace-bg`
- Border-bottom: 1px solid `--workspace-border`
- Padding: 0 `--space-4`
- Layout: flexbox row, `align-items: center`, `gap: --space-3`

---

## 5. Version Table

### 5.1 Table Configuration

| Property         | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Library          | TanStack Table v8 (headless) + shadcn/ui `<Table>`                           |
| Virtualization   | None (no virtual scrolling — ADR-016). Server-side pagination for >500 rows. |
| Row height       | 36px                                                                         |
| Alternating rows | `--workspace-bg` / `--workspace-bg-subtle`                                   |
| Hover            | `--workspace-bg-muted`                                                       |
| Default sort     | `created_at` descending (newest first)                                       |
| Pagination       | Server-side via TanStack Query manualPagination (audit log only)             |

### 5.2 Column Definitions

| Column       | Field                | Width                        | Type    | Sortable | Alignment | Notes                                                                                 |
| ------------ | -------------------- | ---------------------------- | ------- | -------- | --------- | ------------------------------------------------------------------------------------- |
| Name         | `name`               | 200px (min 120px, resizable) | text    | Yes      | Left      | Version name, `--text-sm`, `--text-primary`, weight 500                               |
| Type         | `type`               | 100px                        | badge   | Yes      | Left      | Color dot + abbreviated label (see 5.3)                                               |
| Status       | `status`             | 120px                        | badge   | Yes      | Left      | Status badge with color (see 5.4)                                                     |
| Data Source  | `data_source`        | 110px                        | text    | No       | Left      | "CALCULATED" or "IMPORTED", `--text-xs`, `--text-secondary`, uppercase, `--font-mono` |
| Created By   | `created_by_email`   | 180px (min 120px, resizable) | text    | Yes      | Left      | Email address, `--text-sm`, `--text-secondary`, truncated with ellipsis               |
| Created At   | `created_at`         | 130px                        | date    | Yes      | Left      | ISO 8601 formatted as `DD/MM/YYYY HH:mm`, `--text-xs`, `--text-secondary`             |
| Published At | `published_at`       | 130px                        | date    | Yes      | Left      | Same format as Created At. Shows "--" if null                                         |
| Locked At    | `locked_at`          | 130px                        | date    | Yes      | Left      | Same format as Created At. Shows "--" if null                                         |
| Mod Count    | `modification_count` | 80px                         | number  | No       | Right     | `--font-mono`, `--text-xs`                                                            |
| Actions      | —                    | 48px                         | buttons | No       | Center    | Overflow menu trigger (Lucide `MoreHorizontal`)                                       |

### 5.3 Version Type Badge

Each type badge displays a colored dot (8px diameter, `border-radius: 50%`) followed by an abbreviated label.

| Type     | Dot Color                      | Label | Text Color           |
| -------- | ------------------------------ | ----- | -------------------- |
| Actual   | `--version-actual` (#16A34A)   | ACT   | `--version-actual`   |
| Budget   | `--version-budget` (#2563EB)   | BUD   | `--version-budget`   |
| Forecast | `--version-forecast` (#EA580C) | FC    | `--version-forecast` |

**Badge styling:** Inline flex, `align-items: center`, `gap: --space-1`. Background: transparent. Font: `--text-xs`, weight 600, uppercase.

### 5.4 Version Status Badge

Status badges use a filled pill shape with background tint and text color.

| Status    | Background             | Text Color                     | Border |
| --------- | ---------------------- | ------------------------------ | ------ |
| Draft     | `#F3F4F6` (gray-100)   | `--status-draft` (#4B5563)     | none   |
| Published | `#DBEAFE` (blue-100)   | `--status-published` (#2563EB) | none   |
| Locked    | `#EDE9FE` (violet-100) | `--status-locked` (#7C3AED)    | none   |
| Archived  | `#F3F4F6` (gray-100)   | `--status-archived` (#6B7280)  | none   |

**Badge styling:** `padding: 2px 8px`, `border-radius: --radius-sm` (4px), `font-size: --text-xs` (11px), weight 500.

### 5.5 Row Actions Dropdown

Triggered by clicking the `MoreHorizontal` icon in the Actions column. Uses shadcn/ui `<DropdownMenu>`.

| Action          | Icon        | Condition                                         | Destructive | Separator     |
| --------------- | ----------- | ------------------------------------------------- | ----------- | ------------- |
| View Details    | `Eye`       | Always visible                                    | No          | —             |
| Clone           | `Copy`      | Type != Actual AND role is Admin/BudgetOwner      | No          | —             |
| Publish         | `Send`      | Status == Draft AND role is Admin/BudgetOwner     | No          | Top separator |
| Lock            | `Lock`      | Status == Published AND role is Admin/BudgetOwner | No          | —             |
| Archive         | `Archive`   | Status == Locked AND role is Admin                | No          | —             |
| Revert to Draft | `RotateCcw` | Status in (Published, Locked) AND role is Admin   | No          | Top separator |
| Delete          | `Trash2`    | Status == Draft AND role is Admin/BudgetOwner     | Yes         | Top separator |

**Disabled states:**

- Clone button on Actual-type rows: shown but disabled with tooltip "Actual versions cannot be cloned" (FR-VER-005 restriction)
- Actions unavailable due to role: hidden entirely (not shown as disabled)

**Destructive item styling:** Delete action uses `--color-error` text and hover background `--color-error-bg`.

---

## 6. Create Version (Side Panel)

Triggered by the "New Version" toolbar button. Opens the standard side panel (Global Framework Section 4.4) sliding in from the right.

### 6.1 Side Panel Layout

| Property       | Value                                   |
| -------------- | --------------------------------------- |
| Width          | 480px                                   |
| Header title   | "Create New Version"                    |
| Footer actions | "Create" (primary) + "Cancel" (outline) |

### 6.2 Form Fields

| Field          | Component                        | Required | Validation                                                     | Notes                                                                                                                                                      |
| -------------- | -------------------------------- | -------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name           | `<Input>` (shadcn/ui)            | Yes      | 1-100 characters; unique per fiscal year                       | Label: "Version Name". Placeholder: "e.g., Budget v2"                                                                                                      |
| Type           | `<Select>` (shadcn/ui)           | Yes      | Budget or Forecast only                                        | Label: "Version Type". Options: Budget, Forecast. Actual cannot be created manually                                                                        |
| Description    | `<Textarea>` (shadcn/ui), 3 rows | No       | Max 500 characters                                             | Label: "Description". Placeholder: "Optional notes about this version"                                                                                     |
| Source Version | `<Select>` (shadcn/ui)           | No       | Must reference an existing version for the current fiscal year | Label: "Copy Data From". Placeholder: "None (start empty)". Options: all versions for current FY, grouped by type. Actual versions excluded from this list |

**Form behavior:**

- Fiscal year is inherited from the toolbar FY filter (not editable in form, shown as read-only label above the form: "Fiscal Year: FY2026")
- On submit: `POST /api/v1/versions` with `fiscal_year`, `name`, `type`, `description`, `source_version_id`
- Success: close panel, add new row to table with highlight animation (brief `--color-info-bg` flash), show success toast: "Version '[name]' created"
- Error (409 DUPLICATE_VERSION_NAME): inline error on Name field: "A version with this name already exists for FY2026"
- Error (404 SOURCE_VERSION_NOT_FOUND): inline error on Source Version field: "Source version no longer exists"
- Loading: "Create" button shows spinner, form fields disabled during submission

### 6.3 Form Validation (Client-Side)

| Rule       | Field       | Message                                       |
| ---------- | ----------- | --------------------------------------------- |
| Required   | Name        | "Version name is required"                    |
| Max length | Name        | "Name must be 100 characters or fewer"        |
| Required   | Type        | "Select a version type"                       |
| Max length | Description | "Description must be 500 characters or fewer" |

---

## 7. Row Action Dialogs

### 7.1 Clone Version Dialog

Triggered by "Clone" from the row action menu. Uses shadcn/ui `<Dialog>` (not side panel).

| Property  | Value                                                            |
| --------- | ---------------------------------------------------------------- |
| Component | `<Dialog>` (shadcn/ui)                                           |
| Width     | 480px max                                                        |
| Title     | "Clone Version"                                                  |
| Subtitle  | "Create a copy of '[source version name]'" in `--text-secondary` |

**Form fields:**

| Field       | Component            | Required | Validation                               |
| ----------- | -------------------- | -------- | ---------------------------------------- |
| New Name    | `<Input>`            | Yes      | 1-100 characters; unique per fiscal year |
| Description | `<Textarea>`, 3 rows | No       | Max 500 characters                       |

**Actions:** "Clone" (primary) + "Cancel" (outline)

**Behavior:**

- On submit: `POST /api/v1/versions/:id/clone` with `name` and `description`
- During clone: "Clone" button shows spinner with text "Cloning...". A progress indicator (indeterminate progress bar) displays below the form: "Copying version data..." (FR-VER-005)
- Success: close dialog, insert new row in table, success toast: "Version '[name]' cloned from '[source name]'"
- Error (409 DUPLICATE_VERSION_NAME): inline error on Name field
- Error (409 ACTUAL_VERSION_CLONE_PROHIBITED): should not occur (button is disabled for Actual versions); if received, show error toast: "Actual versions cannot be cloned"

### 7.2 Publish Confirmation Dialog

Transitions from Draft to Published (FR-VER-003).

| Property       | Value                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Component      | `<AlertDialog>` (shadcn/ui)                                                                       |
| Title          | "Publish Version"                                                                                 |
| Description    | "Are you sure you want to publish '[version name]'? Published versions are visible to all users." |
| Confirm button | "Publish" (`<Button variant="default">`)                                                          |
| Cancel button  | "Cancel"                                                                                          |

**Behavior:**

- On confirm: `PATCH /api/v1/versions/:id/status` with `{ "new_status": "Published" }`
- Success: update row status badge, success toast: "Version '[name]' published"
- Error (409 INVALID_TRANSITION): error toast: "Cannot publish this version. It may have been modified."

### 7.3 Lock Confirmation Dialog

Transitions from Published to Locked (FR-VER-003). Admin and BudgetOwner only.

| Property       | Value                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Component      | `<AlertDialog>` (shadcn/ui)                                                                      |
| Title          | "Lock Version"                                                                                   |
| Description    | "Locking '[version name]' will prevent all modifications. Only an Admin can revert this action." |
| Confirm button | "Lock Version" (`<Button variant="default">`) with Lucide `Lock` icon                            |
| Cancel button  | "Cancel"                                                                                         |

**Behavior:**

- On confirm: `PATCH /api/v1/versions/:id/status` with `{ "new_status": "Locked" }`
- Success: update row status badge and `locked_at` column, success toast: "Version '[name]' locked"
- Error (403): error toast: "You don't have permission to lock this version"

### 7.4 Archive Confirmation Dialog

Transitions from Locked to Archived (FR-VER-003). Admin only.

| Property       | Value                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Component      | `<AlertDialog>` (shadcn/ui)                                                                                |
| Title          | "Archive Version"                                                                                          |
| Description    | "Archiving '[version name]' will move it to historical storage. It will remain visible in read-only mode." |
| Confirm button | "Archive" (`<Button variant="default">`)                                                                   |
| Cancel button  | "Cancel"                                                                                                   |

**Behavior:**

- On confirm: `PATCH /api/v1/versions/:id/status` with `{ "new_status": "Archived" }`
- Success: update row status badge, success toast: "Version '[name]' archived"

### 7.5 Revert to Draft Dialog

Reverse transition requiring audit note (FR-VER-003). Admin only.

| Property    | Value                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| Component   | `<Dialog>` (shadcn/ui)                                                                                               |
| Width       | 480px max                                                                                                            |
| Title       | "Revert to Draft"                                                                                                    |
| Description | "This will revert '[version name]' from [current status] to Draft. An audit note is required." in `--text-secondary` |

**Form fields:**

| Field      | Component            | Required | Validation        |
| ---------- | -------------------- | -------- | ----------------- |
| Audit Note | `<Textarea>`, 4 rows | Yes      | 10-500 characters |

**Audit note label:** "Reason for reverting" with helper text: "This note will be recorded in the audit trail."

**Actions:** "Revert to Draft" (primary, amber-tinted: `--color-warning` text on hover) + "Cancel"

**Behavior:**

- On confirm: `PATCH /api/v1/versions/:id/status` with `{ "new_status": "Draft", "audit_note": "..." }`
- Success: update row status badge, success toast: "Version '[name]' reverted to Draft"
- Error (400 AUDIT_NOTE_REQUIRED): inline error: "An audit note is required to revert this version"
- Error (403): error toast: "Only administrators can revert versions"

### 7.6 Delete Confirmation Dialog

Destructive action for Draft versions only (FR-VER-002).

| Property           | Value                                                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component          | `<AlertDialog>` (shadcn/ui)                                                                                                                                                               |
| Title              | "Delete Version"                                                                                                                                                                          |
| Description        | "This action cannot be undone. This will permanently delete '[version name]' and all associated data (enrollment, fee grids, employees, and calculated results)." in `--color-error` text |
| Confirmation input | `<Input>` with label: "Type the version name to confirm"                                                                                                                                  |
| Confirm button     | "Delete Version" (`<Button variant="destructive">`) -- disabled until input matches version name exactly                                                                                  |
| Cancel button      | "Cancel"                                                                                                                                                                                  |

**Behavior:**

- Confirm button stays disabled until the text input value matches the version name exactly (case-sensitive)
- On confirm: `DELETE /api/v1/versions/:id`
- Success: remove row from table with fade-out animation (200ms), success toast: "Version '[name]' deleted"
- Error (409 VERSION_NOT_DRAFT): error toast: "Only draft versions can be deleted"
- Error (409 VERSION_IN_USE): error toast: "This version is referenced by an active export job. Please wait and try again."

---

## 8. Version Detail Side Panel

Triggered by "View Details" from the row action menu or by clicking the version name in the table. Uses the standard side panel (Global Framework Section 4.4).

### 8.1 Panel Layout

| Property | Value                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Width    | 480px                                                                                                      |
| Header   | Version name + type badge + status badge                                                                   |
| Footer   | "Close" button (outline). If role permits edits, also show lifecycle action buttons matching current state |

### 8.2 Detail Sections

The panel body is a scrollable area divided into sections with `--space-6` gap.

#### Section: Overview

| Field        | Display                         | Notes                                                                      |
| ------------ | ------------------------------- | -------------------------------------------------------------------------- |
| Version Name | `--text-lg`, weight 600         | Primary heading                                                            |
| Version Type | Type badge (same as table)      | Inline with name                                                           |
| Status       | Status badge (same as table)    | Inline with name                                                           |
| Description  | `--text-sm`, `--text-secondary` | Full text, not truncated. Shows "No description" in `--text-muted` if null |

#### Section: Metadata (FR-VER-006)

Displayed as a vertical key-value list with labels in `--text-xs`, `--text-muted` (uppercase) and values in `--text-sm`, `--text-primary`.

| Field              | Label         | Format                                     |
| ------------------ | ------------- | ------------------------------------------ |
| Created By         | CREATED BY    | Email address                              |
| Created At         | CREATED AT    | `DD/MM/YYYY HH:mm` (AST, UTC+3)            |
| Published At       | PUBLISHED AT  | `DD/MM/YYYY HH:mm` or "--"                 |
| Locked At          | LOCKED AT     | `DD/MM/YYYY HH:mm` or "--"                 |
| Last Modified      | LAST MODIFIED | `DD/MM/YYYY HH:mm`                         |
| Modification Count | MODIFICATIONS | Integer with thousands separator           |
| Data Source        | DATA SOURCE   | "CALCULATED" or "IMPORTED"                 |
| Source Version     | CLONED FROM   | Source version name (linked) or "Original" |

#### Section: Stale Modules

Only visible when `stale_modules` array from `GET /api/v1/versions/:id` is non-empty.

| Property | Value                                                           |
| -------- | --------------------------------------------------------------- |
| Header   | "Outdated Calculations" with `--color-stale` amber warning icon |
| Content  | List of stale module names as amber-tinted chips                |
| Action   | "Recalculate" link per module (navigates to the module)         |

#### Section: Lifecycle History

A compact timeline showing status transitions, loaded from audit trail data.

| Property     | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Layout       | Vertical timeline with dots and connecting lines             |
| Dot color    | Matches the status color token for each state                |
| Entry format | "[Status] by [email] on [DD/MM/YYYY HH:mm]"                  |
| Audit notes  | Shown below the entry in `--text-xs`, `--text-muted`, italic |
| Order        | Most recent first                                            |

### 8.3 Panel Footer Actions

Footer actions change based on the version's current status and user role. These mirror the row action menu but are presented as full buttons for better discoverability.

| Current Status | Role: Admin              | Role: BudgetOwner | Role: Editor/Viewer |
| -------------- | ------------------------ | ----------------- | ------------------- |
| Draft          | Publish, Delete          | Publish, Delete   | Close only          |
| Published      | Lock, Revert to Draft    | Lock              | Close only          |
| Locked         | Archive, Revert to Draft | —                 | Close only          |
| Archived       | —                        | —                 | Close only          |

Buttons use the same confirmation dialogs described in Section 7.

---

## 9. Comparison Workflow

Triggered by the "Compare" toolbar button. This launches a comparison selection dialog, then navigates the user into comparison mode via the context bar.

### 9.1 Comparison Selection Dialog

| Property  | Value                  |
| --------- | ---------------------- |
| Component | `<Dialog>` (shadcn/ui) |
| Width     | 520px max              |
| Title     | "Compare Versions"     |

**Form fields:**

| Field              | Component                          | Required | Notes                                                                |
| ------------------ | ---------------------------------- | -------- | -------------------------------------------------------------------- |
| Primary Version    | `<Select>` with version type badge | Yes      | All versions for current FY. Defaults to current context bar version |
| Comparison Version | `<Select>` with version type badge | Yes      | All versions for current FY, excluding the primary selection         |

**Version select display:** Each option renders as `[TypeDot] Version Name (Status)` matching the context bar version selector format (Global Framework Section 3.1.2).

**Actions:** "Compare" (primary) + "Cancel"

**Behavior:**

- On confirm: navigates to `/planning?fy=X&version=Y&compare=Z` (Dashboard in PlanningShell) where comparison mode is active via the context bar
- Navigates to: `/planning?fy=2026&version=[primary]&compare=[comparison]&period=full&scenario=base`
- The comparison data is also available via `GET /api/v1/versions/compare?primary=X&comparison=Y` for the annual summary view within this module

### 9.2 Inline Comparison Summary (Optional)

When comparison mode is active (context bar comparison toggle is ON), the Version Management table can optionally display a comparison summary banner above the table.

| Property   | Value                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| Background | `--color-info-bg`                                                               |
| Height     | 40px                                                                            |
| Content    | "Comparing: [Primary Name] vs [Comparison Name]" with version type badges       |
| Action     | "View Full Comparison" link (navigates to Dashboard) + "Exit Comparison" button |

---

## 10. Empty State & Loading

### 10.1 Empty State

Shown when no versions exist for the selected fiscal year.

| Property    | Value                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------- |
| Icon        | Lucide `Layers` (48px, `--text-muted`)                                                       |
| Heading     | "No versions for FY[year]" (`--text-lg`, `--text-secondary`)                                 |
| Description | "Create your first budget or forecast version to get started." (`--text-sm`, `--text-muted`) |
| Action      | "Create Version" primary button (hidden for Editor/Viewer)                                   |

### 10.2 Loading State

| State                  | Display                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Initial load           | Skeleton table: 10 rows x all columns, shimmer animation (Global Framework Section 4.9). 200ms delay before showing |
| Row action in progress | Row dims to 50% opacity, spinner replaces action icon                                                               |
| Clone in progress      | Clone dialog shows indeterminate progress bar below form                                                            |
| Delete in progress     | Delete button shows spinner, disabled state                                                                         |

### 10.3 Error State

| State             | Display                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| API failure (500) | Full workspace error: disconnected cloud icon + "Unable to load versions" + retry button |
| Network error     | Network error overlay (Global Framework Section 9.2)                                     |

---

## 11. API Integration & State Management

### 11.1 Query Keys (TanStack Query v5)

| Query Key                                      | Endpoint                                              | Stale Time | Notes                                                  |
| ---------------------------------------------- | ----------------------------------------------------- | ---------- | ------------------------------------------------------ |
| `['versions', fiscalYear]`                     | `GET /api/v1/versions?fiscalYear=X`                   | 30s        | Main table data. Refetch on window focus               |
| `['versions', id]`                             | `GET /api/v1/versions/:id`                            | 30s        | Detail panel data. Includes `stale_modules`            |
| `['versions', 'compare', primary, comparison]` | `GET /api/v1/versions/compare?primary=X&comparison=Y` | 60s        | Comparison summary. Longer stale time (read-only data) |

### 11.2 Mutations

| Action          | Method | Endpoint                      | Optimistic Update                     | Invalidates                                    |
| --------------- | ------ | ----------------------------- | ------------------------------------- | ---------------------------------------------- |
| Create          | POST   | `/api/v1/versions`            | No (wait for server response)         | `['versions', fiscalYear]`                     |
| Clone           | POST   | `/api/v1/versions/:id/clone`  | No (wait for server response)         | `['versions', fiscalYear]`                     |
| Publish         | PATCH  | `/api/v1/versions/:id/status` | Yes (update status badge immediately) | `['versions', fiscalYear]`, `['versions', id]` |
| Lock            | PATCH  | `/api/v1/versions/:id/status` | Yes (update status badge immediately) | `['versions', fiscalYear]`, `['versions', id]` |
| Archive         | PATCH  | `/api/v1/versions/:id/status` | Yes (update status badge immediately) | `['versions', fiscalYear]`, `['versions', id]` |
| Revert to Draft | PATCH  | `/api/v1/versions/:id/status` | Yes (update status badge immediately) | `['versions', fiscalYear]`, `['versions', id]` |
| Delete          | DELETE | `/api/v1/versions/:id`        | Yes (remove row immediately)          | `['versions', fiscalYear]`                     |

**Optimistic update rollback:** On mutation error, revert the optimistic change and show an error toast with the API error message. The query cache is invalidated to refetch the correct server state.

### 11.3 Client State (Zustand)

```typescript
interface VersionManagementStore {
	// Toolbar filters (client-side, not sent to API)
	typeFilter: 'all' | 'Actual' | 'Budget' | 'Forecast';
	statusFilter: 'all' | 'Draft' | 'Published' | 'Locked' | 'Archived';
	searchQuery: string;

	// Table state
	sortColumn: string;
	sortDirection: 'asc' | 'desc';
	columnVisibility: Record<string, boolean>;

	// Panel state
	detailPanelVersionId: number | null;

	// Actions
	setTypeFilter: (filter: string) => void;
	setStatusFilter: (filter: string) => void;
	setSearchQuery: (query: string) => void;
	setSortColumn: (column: string, direction: 'asc' | 'desc') => void;
	openDetailPanel: (versionId: number) => void;
	closeDetailPanel: () => void;
}
```

### 11.4 URL State

The module uses only `?fy=2026` as URL state (synced from the toolbar FY filter). Context bar params (`version`, `compare`, `period`, `scenario`) do not apply -- this module renders in ManagementShell without a context bar. The detail panel state is client-only (opening the detail panel does not change the URL).

### 11.5 Error Handling

| HTTP Status                           | UI Behavior                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 400 (VALIDATION_ERROR)                | Inline field errors on the relevant form                                                            |
| 400 (AUDIT_NOTE_REQUIRED)             | Inline error on audit note textarea                                                                 |
| 403 (INSUFFICIENT_ROLE)               | Toast: "You don't have permission to perform this action"                                           |
| 404 (VERSION_NOT_FOUND)               | Toast: "Version not found" + close detail panel if open                                             |
| 409 (DUPLICATE_VERSION_NAME)          | Inline error on name field: "A version with this name already exists"                               |
| 409 (INVALID_TRANSITION)              | Toast: "This status transition is not allowed. The version may have been modified by another user." |
| 409 (VERSION_NOT_DRAFT)               | Toast: "Only draft versions can be deleted"                                                         |
| 409 (VERSION_IN_USE)                  | Toast: "Version is in use by an active export. Try again later."                                    |
| 409 (ACTUAL_VERSION_CLONE_PROHIBITED) | Toast: "Actual versions cannot be cloned"                                                           |
| 500                                   | Error state with retry button (Section 10.3)                                                        |

### 11.6 Keyboard Shortcuts

| Key             | Action                                                       | Scope  |
| --------------- | ------------------------------------------------------------ | ------ |
| `Ctrl+Shift+N`  | Open create version panel (if permitted)                     | Module |
| `Enter`         | Open detail panel for selected/focused row                   | Table  |
| `Delete`        | Open delete dialog for selected row (if Draft and permitted) | Table  |
| `Escape`        | Close detail panel or active dialog                          | Module |
| `Arrow Up/Down` | Navigate table rows                                          | Table  |

### 11.7 Accessibility

| Requirement     | Implementation                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Table semantics | `role="table"`, `role="row"`, `role="columnheader"`, `role="cell"` (standard table, not grid -- no inline editing) |
| Sort indicators | `aria-sort="ascending"` / `"descending"` / `"none"` on column headers                                              |
| Action menu     | `aria-haspopup="menu"` on trigger button, `aria-label="Actions for [version name]"`                                |
| Status badges   | `aria-label` includes full status text (e.g., `aria-label="Status: Published"`)                                    |
| Type badges     | `aria-label` includes full type text (e.g., `aria-label="Type: Budget"`)                                           |
| Side panel      | `role="complementary"`, `aria-label="Version details"`, focus trap on open                                         |
| Dialogs         | `role="alertdialog"` for confirmations, `role="dialog"` for forms, focus trap                                      |
| Live regions    | `aria-live="polite"` on toast container and table row count summary                                                |
| Filter controls | Each filter has associated `<label>` or `aria-label`                                                               |
