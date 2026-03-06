# BudFin UI/UX Specification: Admin Module

> **Document Version:** 1.0
> **Date:** March 4, 2026
> **Status:** Draft
> **Parent:** [00-global-framework.md](./00-global-framework.md)
> **PRD References:** US-018, US-020, US-023, FR-AUD-001 through FR-AUD-003
> **TDD References:** Section 7.3 (RBAC Matrix), Section 7.2 (Account Lockout)
> **API Endpoints:** `GET/POST/PATCH /api/v1/users`, `GET /api/v1/audit`, `GET/PUT /api/v1/system-config`

---

## 1. Overview

### 1.1 Purpose

The Admin module provides system administration capabilities: user account management with RBAC role assignment, an append-only audit trail viewer, and system-wide configuration settings. This is the only module restricted entirely to the Admin role. All three sub-modules are accessible via the Admin sidebar group, which is hidden from non-Admin users per the RBAC visibility rules defined in `00-global-framework.md` Section 2.2.

The module does not involve financial data entry or calculations. It is a control plane for user access, compliance review, and operational configuration.

### 1.2 User Stories

| ID     | Persona                      | Story                                                                                                                                                                                        | Acceptance Criteria                                                                                                               |
| ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| US-018 | System Administrator         | As a System Administrator, I want to create, edit, deactivate user accounts and assign RBAC roles, so that only authorized personnel access the system with appropriate permissions.         | CRUD operations on user accounts; four roles assignable (Admin, BudgetOwner, Editor, Viewer); role changes logged in audit trail. |
| US-020 | System Administrator         | As a System Administrator, I want to configure fiscal year settings, academic year boundaries, and system-wide parameters, so that the application reflects the correct operational context. | System settings editable by Admin role only; changes logged in audit trail; validation prevents invalid configurations.           |
| US-023 | External Auditor (via Admin) | As an External Auditor, I want to review the complete audit trail for a given fiscal year and version, so that I can confirm all data changes are properly attributed and timestamped.       | Audit log filterable by date range and version; entries show user, timestamp, field, old/new values; 7-year retention confirmed.  |

### 1.3 Personas

This module is restricted exclusively to the Admin role. No other roles can access any part of the Admin module. The sidebar Admin group is hidden for all non-Admin users (see `00-global-framework.md` Section 2.2, RBAC visibility).

| Persona                      | Access Level                         |
| ---------------------------- | ------------------------------------ |
| System Administrator (Admin) | Full access -- all three sub-modules |
| Budget Owner                 | No access -- sidebar group hidden    |
| Editor                       | No access -- sidebar group hidden    |
| Viewer                       | No access -- sidebar group hidden    |

---

## 2. Layout

### 2.1 Workspace Structure

The Admin module renders inside ManagementShell -- no context bar, no docked right panel. The workspace uses the ManagementShell Module Template (Global Framework Section 12.2). Only the sidebar and module toolbar are present.

The workspace is organized into three sub-modules, navigated via the sidebar nav items under the **Admin** group:

1. **User Settings** -- `/admin/users`
2. **Audit Trail** -- `/admin/audit`
3. **System Settings** -- `/admin/settings`

Each sub-module uses the ManagementShell Module Template from `00-global-framework.md` Section 12.2.

### 2.2 Sub-Module Navigation

The sidebar Admin group contains three nav items:

| Nav Item        | Route             | Icon (Lucide) |
| --------------- | ----------------- | ------------- |
| User Settings   | `/admin/users`    | `Users`       |
| Audit Trail     | `/admin/audit`    | `ScrollText`  |
| System Settings | `/admin/settings` | `Settings`    |

Active item follows the standard sidebar nav item states from `00-global-framework.md` Section 2.2.

---

## 3. Sub-Module 1: User Management

### 3.1 Module Toolbar

```
+-----------------------------------------------------------------------+
| User Settings            [Search input]            [+ Add User]       |
+-----------------------------------------------------------------------+
```

| Element  | Component                    | Details                                                                   |
| -------- | ---------------------------- | ------------------------------------------------------------------------- |
| Title    | Text                         | "User Settings", `--text-xl`, weight 600                                  |
| Search   | `<Input>` (shadcn/ui)        | Placeholder: "Search by email...", width 280px, filters table client-side |
| Add User | `<Button variant="default">` | Label: "+ Add User", opens side panel in create mode                      |

### 3.2 User Table

The user table is a standard data grid (TanStack Table v8) without virtualization (user count expected to be < 50). No inline editing -- all edits happen via the side panel.

#### Column Definitions

| Column          | Field             | Type    | Width       | Sortable | Align  | Notes                                                                                      |
| --------------- | ----------------- | ------- | ----------- | -------- | ------ | ------------------------------------------------------------------------------------------ |
| Email           | `email`           | text    | 240px, flex | Yes      | Left   | Login identifier. `--text-sm`.                                                             |
| Role            | `role`            | badge   | 140px       | Yes      | Left   | Color-coded badge (see 3.3).                                                               |
| Status          | `is_active`       | badge   | 100px       | Yes      | Center | Active/Inactive badge (see 3.3).                                                           |
| Last Login      | `last_login`      | date    | 160px       | Yes      | Left   | Format: `DD/MM/YYYY HH:mm`. Shows "--" if null (never logged in).                          |
| Failed Attempts | `failed_attempts` | number  | 100px       | No       | Center | Integer 0-5. Highlighted if >= 3 (see 3.4).                                                |
| Locked Until    | `locked_until`    | date    | 160px       | No       | Left   | Format: `DD/MM/YYYY HH:mm`. Empty cell if null. Shown in `--color-error` if in the future. |
| Created At      | `created_at`      | date    | 140px       | Yes      | Left   | Format: `DD/MM/YYYY`.                                                                      |
| Actions         | --                | buttons | 200px       | No       | Right  | Action buttons (see 3.5).                                                                  |

Default sort: `email` ascending.

#### Row Styling

- Standard alternating rows: `--workspace-bg` / `--workspace-bg-subtle`.
- Hover: `--workspace-bg-muted`.
- Row height: 44px (slightly taller than standard 36px grid to accommodate action buttons).
- Inactive users: entire row text rendered in `--text-muted` with 60% opacity.
- Locked accounts (locked_until in the future): left border 3px solid `--color-error`.

### 3.3 Role and Status Badges

#### Role Badges

| Role        | Background           | Text Color            | Label          |
| ----------- | -------------------- | --------------------- | -------------- |
| Admin       | `#FEF2F2` (red-50)   | `#DC2626` (red-600)   | "Admin"        |
| BudgetOwner | `#EFF6FF` (blue-50)  | `#2563EB` (blue-600)  | "Budget Owner" |
| Editor      | `#F0FDF4` (green-50) | `#16A34A` (green-600) | "Editor"       |
| Viewer      | `#F8FAFC` (slate-50) | `#64748B` (slate-500) | "Viewer"       |

All badges use `--radius-sm` (4px), `--text-xs` (11px), font-weight 500, padding `2px 8px`.

#### Status Badges

| Status   | Background           | Text Color            | Label      |
| -------- | -------------------- | --------------------- | ---------- |
| Active   | `#F0FDF4` (green-50) | `#16A34A` (green-600) | "Active"   |
| Inactive | `#F8FAFC` (slate-50) | `#94A3B8` (slate-400) | "Inactive" |

### 3.4 Failed Attempts Indicator

| Value | Display   | Style                                          |
| ----- | --------- | ---------------------------------------------- |
| 0     | "0"       | `--text-muted`                                 |
| 1-2   | "1" / "2" | `--text-secondary`                             |
| 3-4   | "3" / "4" | `--color-warning` (amber-600), font-weight 600 |
| 5     | "5"       | `--color-error` (red-600), font-weight 700     |

### 3.5 Row Actions

Each row displays action buttons in the Actions column. Buttons use `<Button variant="ghost" size="sm">` with Lucide icons.

| Action       | Icon        | Label        | Visibility                           | Behavior                                                                                                                              |
| ------------ | ----------- | ------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Edit         | `Pencil`    | "Edit"       | Always                               | Opens side panel in edit mode for this user.                                                                                          |
| Deactivate   | `UserX`     | "Deactivate" | When `is_active = true`              | Opens confirmation dialog (see 3.7).                                                                                                  |
| Activate     | `UserCheck` | "Activate"   | When `is_active = false`             | Opens confirmation dialog.                                                                                                            |
| Unlock       | `Unlock`    | "Unlock"     | When `locked_until` is in the future | Calls `PATCH /api/v1/users/:id` with `{ "unlock_account": true }`. Clears `locked_until`, resets `failed_attempts`. Toast on success. |
| Force Logout | `LogOut`    | "Logout"     | When `is_active = true`              | Opens confirmation dialog. Calls `PATCH /api/v1/users/:id` with `{ "force_session_revoke": true }`. Revokes all active sessions.      |

Buttons that are not applicable to the current row state are hidden (not disabled). This keeps the Actions column clean.

### 3.6 Add/Edit User Side Panel

Opens from the right side of the workspace per `00-global-framework.md` Section 4.4 (480px width, slide-in animation).

#### Panel Header

- **Create mode:** "Add New User"
- **Edit mode:** "Edit User -- {email}"

#### Form Fields

| Field    | Component                 | Required          | Validation                                      | Notes                                                  |
| -------- | ------------------------- | ----------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Email    | `<Input type="email">`    | Yes (create)      | Valid email format, unique                      | Read-only in edit mode (displayed as text).            |
| Role     | `<Select>` (shadcn/ui)    | Yes               | One of: Admin, BudgetOwner, Editor, Viewer      | Dropdown with role badge previews in options.          |
| Active   | `<Switch>` (shadcn/ui)    | --                | --                                              | Toggle. Default: on (active). Label: "Account active". |
| Password | `<Input type="password">` | Yes (create only) | Min 8 chars, at least one uppercase, one number | Visible only in create mode.                           |

#### Edit Mode Additional Controls

- **Reset Password** button (`<Button variant="outline">`): Calls `PATCH /api/v1/users/:id` with `{ "force_password_reset": true }`. Generates a temporary password displayed in a read-only input with a copy button. The temporary password is shown once and cannot be retrieved again.
- **Account Info** section (read-only):
  - Last Login: date or "Never"
  - Failed Attempts: count
  - Locked Until: date or "Not locked"
  - Created At: date

#### Panel Footer

| Button | Component                    | Behavior                                                                                                                                |
| ------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Save   | `<Button variant="default">` | Validates form, calls `POST /api/v1/users` (create) or `PATCH /api/v1/users/:id` (edit). On success: toast, close panel, refresh table. |
| Cancel | `<Button variant="outline">` | Closes panel. If unsaved changes exist, shows confirmation dialog: "Discard unsaved changes?"                                           |

### 3.7 Confirmation Dialogs

All destructive or significant actions require confirmation via `<AlertDialog>` (shadcn/ui) per `00-global-framework.md` Section 4.7.

#### Deactivate User

| Property       | Value                                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title          | "Deactivate User"                                                                                                                                  |
| Description    | "Are you sure you want to deactivate **{email}**? They will no longer be able to log in. This action can be reversed by reactivating the account." |
| Confirm button | "Deactivate" (destructive variant, red)                                                                                                            |
| API call       | `PATCH /api/v1/users/:id` with `{ "is_active": false }`                                                                                            |
| On success     | Toast: "User {email} deactivated". Refresh table.                                                                                                  |

#### Activate User

| Property       | Value                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------- |
| Title          | "Activate User"                                                                              |
| Description    | "Reactivate **{email}**? They will be able to log in again with their existing credentials." |
| Confirm button | "Activate" (default variant)                                                                 |
| API call       | `PATCH /api/v1/users/:id` with `{ "is_active": true }`                                       |
| On success     | Toast: "User {email} activated". Refresh table.                                              |

#### Force Logout

| Property       | Value                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Title          | "Force Logout"                                                                                            |
| Description    | "Revoke all active sessions for **{email}**? They will be logged out immediately and must sign in again." |
| Confirm button | "Force Logout" (destructive variant, red)                                                                 |
| API call       | `PATCH /api/v1/users/:id` with `{ "force_session_revoke": true }`                                         |
| On success     | Toast: "All sessions revoked for {email}".                                                                |

### 3.8 Role Permissions Matrix Panel

When a user row is selected (single-click), a collapsible panel appears below the user table showing the effective permissions for the selected user's role.

| Property   | Value                                         |
| ---------- | --------------------------------------------- |
| Trigger    | Single-click on a user row                    |
| Layout     | Full-width panel below the table, collapsible |
| Background | `--workspace-bg-muted`                        |
| Border     | 1px solid `--workspace-border`, `--radius-md` |
| Padding    | `--space-4`                                   |
| Title      | "Permissions for role: **{role}**"            |

#### Permissions Table

A read-only reference table. The column corresponding to the selected user's role is highlighted with a background tint and bold header.

| Permission            | Admin | BudgetOwner | Editor | Viewer |
| --------------------- | ----- | ----------- | ------ | ------ |
| View planning data    | Y     | Y           | Y      | Y      |
| Export reports        | Y     | Y           | Y      | Y      |
| Edit planning data    | Y     | Y           | Y      | --     |
| Run calculations      | Y     | Y           | Y      | --     |
| View salary fields    | Y     | Y           | Y      | --     |
| Create versions       | Y     | Y           | --     | --     |
| Publish/Lock versions | Y     | Y           | --     | --     |
| Archive versions      | Y     | --          | --     | --     |
| Manage users          | Y     | --          | --     | --     |
| View audit trail      | Y     | --          | --     | --     |
| Edit system config    | Y     | --          | --     | --     |

**Cell styling:**

- "Y" cells: `--color-success` (green-600), font-weight 600.
- "--" cells: `--text-muted` (slate-400).
- Selected role column: background `--color-info-bg` (blue-50), header cell background `--color-info` (blue-600) with white text.

---

## 4. Sub-Module 2: Audit Trail

### 4.1 Module Toolbar

```
+-----------------------------------------------------------------------+
| Audit Trail        [Date From] [Date To] [User] [Action] [Entity]    |
+-----------------------------------------------------------------------+
```

| Element   | Component                  | Details                                                                                                                                                                 |
| --------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title     | Text                       | "Audit Trail", `--text-xl`, weight 600                                                                                                                                  |
| Date From | `<DatePicker>` (shadcn/ui) | Label: "From", default: 30 days ago. ISO date sent to API `from` param.                                                                                                 |
| Date To   | `<DatePicker>` (shadcn/ui) | Label: "To", default: today. ISO date sent to API `to` param.                                                                                                           |
| User      | `<Select>` (shadcn/ui)     | Label: "User", options populated from `GET /api/v1/users` (email list) + "All Users" default. Maps to `user_id` param.                                                  |
| Action    | `<Select>` (shadcn/ui)     | Label: "Action", options: All, INSERT, UPDATE, DELETE, LOGIN, LOGOUT, VERSION_TRANSITION, CALCULATION_RUN, ACCOUNT_LOCKOUT, EXPORT_DOWNLOAD. Maps to `operation` param. |
| Entity    | `<Select>` (shadcn/ui)     | Label: "Entity", options: All + list of table names (budget_versions, employees, enrollment_actuals, etc.). Maps to `table_name` param.                                 |

Filters apply on change (debounced 300ms). The API is called with the combined filter state.

### 4.2 Audit Log Table

#### Column Definitions

| Column     | Field         | Type     | Width | Sortable | Align | Notes                                                               |
| ---------- | ------------- | -------- | ----- | -------- | ----- | ------------------------------------------------------------------- |
| Timestamp  | `occurred_at` | datetime | 180px | No       | Left  | Format: `DD/MM/YYYY HH:mm:ss` (AST, UTC+3).                         |
| User       | `user_email`  | text     | 200px | No       | Left  | Email of the actor. `--text-sm`.                                    |
| Action     | `operation`   | badge    | 160px | No       | Left  | Color-coded badge (see 4.3).                                        |
| Entity     | `table_name`  | text     | 160px | No       | Left  | Table/module affected.                                              |
| Record ID  | `record_id`   | number   | 100px | No       | Right | Primary key of affected record. `--font-mono`.                      |
| Audit Note | `audit_note`  | text     | flex  | No       | Left  | Optional comment. Truncated to 80 chars with tooltip for full text. |

Data is always displayed in reverse chronological order (newest first). Sorting is server-controlled, not client-sortable.

#### Row Styling

- Standard alternating rows: `--workspace-bg` / `--workspace-bg-subtle`.
- Row height: 36px (standard grid height).
- No row selection or click behavior (read-only log).
- Hover: `--workspace-bg-muted` for visual feedback only.

### 4.3 Action Type Badges

| Action             | Background            | Text Color             | Label           |
| ------------------ | --------------------- | ---------------------- | --------------- |
| INSERT             | `#F0FDF4` (green-50)  | `#16A34A` (green-600)  | "Insert"        |
| UPDATE             | `#EFF6FF` (blue-50)   | `#2563EB` (blue-600)   | "Update"        |
| DELETE             | `#FEF2F2` (red-50)    | `#DC2626` (red-600)    | "Delete"        |
| LOGIN              | `#F8FAFC` (slate-50)  | `#64748B` (slate-500)  | "Login"         |
| LOGOUT             | `#F8FAFC` (slate-50)  | `#64748B` (slate-500)  | "Logout"        |
| VERSION_TRANSITION | `#F5F3FF` (violet-50) | `#7C3AED` (violet-600) | "Status Change" |
| CALCULATION_RUN    | `#FFF7ED` (orange-50) | `#EA580C` (orange-600) | "Calculate"     |
| ACCOUNT_LOCKOUT    | `#FFFBEB` (amber-50)  | `#D97706` (amber-600)  | "Lockout"       |
| EXPORT_DOWNLOAD    | `#F8FAFC` (slate-50)  | `#64748B` (slate-500)  | "Export"        |

All badges use `--radius-sm` (4px), `--text-xs` (11px), font-weight 500, padding `2px 8px`.

### 4.4 Pagination

| Property    | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| Component   | Custom pagination bar below the table                             |
| Page size   | 50 rows per page (fixed, not configurable in v1)                  |
| Strategy    | Offset-based (`page` and `page_size` API params)                  |
| Display     | "Showing 1-50 of 1,234 entries"                                   |
| Controls    | Previous / Next buttons + page number input for direct navigation |
| Edge states | Previous disabled on page 1; Next disabled on last page           |

### 4.5 Empty State

Displayed when no audit entries match the current filter criteria.

| Property    | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| Icon        | `ScrollText` (Lucide), 48px, `--text-muted`                |
| Heading     | "No audit entries found"                                   |
| Description | "Try adjusting your date range or filters to see results." |

### 4.6 v1 Scope Limitations

Per PRD v1 scope notes:

- No CSV/Excel export of audit data (FR-AUD-004 deferred to v2).
- No field-level diff view (old_values/new_values JSONB not displayed in v1).
- No advanced search by specific field name or value.
- Basic list view with date, user, action, and entity filtering only.

---

## 5. Sub-Module 3: System Settings

### 5.1 Module Toolbar

```
+-----------------------------------------------------------------------+
| System Settings                                          [Save]       |
+-----------------------------------------------------------------------+
```

| Element | Component                    | Details                                                                                     |
| ------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| Title   | Text                         | "System Settings", `--text-xl`, weight 600                                                  |
| Save    | `<Button variant="default">` | Label: "Save Changes". Disabled when no pending changes. Calls `PUT /api/v1/system-config`. |

### 5.2 Settings Layout

Settings are displayed as grouped key-value pairs in card-style sections. Each group is a `<Card>` (shadcn/ui) with a group header.

```
+-----------------------------------------------------------------------+
| Session Settings                                                      |
| +-----------------------------------------------------------------+   |
| | Max sessions per user          [  2  ]                          |   |
| | Session timeout (minutes)      [ 30  ]                          |   |
| +-----------------------------------------------------------------+   |
|                                                                       |
| Security Settings                                                     |
| +-----------------------------------------------------------------+   |
| | Account lockout threshold      [  5  ]                          |   |
| | Lockout duration (minutes)     [ 30  ]                          |   |
| +-----------------------------------------------------------------+   |
|                                                                       |
| Application Settings                                                  |
| +-----------------------------------------------------------------+   |
| | Fiscal year start month        [ September  v]                  |   |
| | Fiscal year range (years)      [ 10 ]                           |   |
| | Auto-save interval (seconds)   [ 30 ]                           |   |
| +-----------------------------------------------------------------+   |
+-----------------------------------------------------------------------+
```

### 5.3 Settings Fields

#### Session Settings

| Setting                   | Key                       | Component               | Type    | Default | Validation     |
| ------------------------- | ------------------------- | ----------------------- | ------- | ------- | -------------- |
| Max sessions per user     | `max_sessions_per_user`   | `<Input type="number">` | integer | 2       | Min 1, Max 10  |
| Session timeout (minutes) | `session_timeout_minutes` | `<Input type="number">` | integer | 30      | Min 5, Max 480 |

#### Security Settings

| Setting                    | Key                        | Component               | Type    | Default | Validation      |
| -------------------------- | -------------------------- | ----------------------- | ------- | ------- | --------------- |
| Account lockout threshold  | `lockout_threshold`        | `<Input type="number">` | integer | 5       | Min 3, Max 10   |
| Lockout duration (minutes) | `lockout_duration_minutes` | `<Input type="number">` | integer | 30      | Min 5, Max 1440 |

#### Application Settings

| Setting                      | Key                         | Component               | Type     | Default   | Validation              |
| ---------------------------- | --------------------------- | ----------------------- | -------- | --------- | ----------------------- |
| Fiscal year start month      | `fiscal_year_start_month`   | `<Select>`              | dropdown | September | Months January-December |
| Fiscal year range (years)    | `fiscal_year_range`         | `<Input type="number">` | integer  | 10        | Min 5, Max 20           |
| Auto-save interval (seconds) | `autosave_interval_seconds` | `<Input type="number">` | integer  | 30        | Min 10, Max 300         |

### 5.4 Card Styling

| Property        | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| Card background | `--workspace-bg`                                                                  |
| Card border     | 1px solid `--workspace-border`                                                    |
| Card radius     | `--radius-xl` (12px)                                                              |
| Card padding    | `--space-6` (24px)                                                                |
| Card gap        | `--space-6` (24px) between cards                                                  |
| Group header    | `--text-lg`, weight 600, `--text-primary`                                         |
| Field row       | Flexbox row, `justify-content: space-between`, `align-items: center`, height 48px |
| Label           | `--text-sm`, `--text-secondary`                                                   |
| Input width     | 160px (number inputs), 200px (select)                                             |

### 5.5 Change Tracking

- Modified fields are highlighted with a left border of 3px solid `--color-info` (blue-600) on the field row.
- The Save button enables when any field differs from the server value.
- On save success: toast "System settings updated". All field highlights clear. Changes are logged to the audit trail automatically by the API.
- On save error: field-level validation errors displayed inline below each invalid field using the standard inline validation pattern from `00-global-framework.md` Section 4.3.

### 5.6 Confirmation on Navigation

If there are unsaved changes and the user navigates away from System Settings (via sidebar or browser navigation), show a confirmation dialog:

| Property       | Value                                                     |
| -------------- | --------------------------------------------------------- |
| Title          | "Unsaved Changes"                                         |
| Description    | "You have unsaved system settings changes. Discard them?" |
| Confirm button | "Discard" (destructive variant)                           |
| Cancel button  | "Stay on Page"                                            |

---

## 6. Data Grid Specifications

### 6.1 User Management Grid

| Property          | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Library           | TanStack Table v8 (headless)                         |
| Virtualization    | Not required (user count < 50)                       |
| Row height        | 44px                                                 |
| Column resizing   | Enabled, minimum 80px                                |
| Column reordering | Not enabled                                          |
| Filtering         | Client-side search by email only (toolbar input)     |
| Sorting           | Client-side, single column, default: email ascending |
| Selection         | Single-row click to show permissions panel           |
| Pinned columns    | Email (left-pinned)                                  |

### 6.2 Audit Trail Grid

| Property          | Value                                                          |
| ----------------- | -------------------------------------------------------------- |
| Library           | TanStack Table v8 (headless)                                   |
| Virtualization    | Not required (server-side pagination, max 50 rows per page)    |
| Row height        | 36px                                                           |
| Column resizing   | Enabled, minimum 80px                                          |
| Column reordering | Not enabled                                                    |
| Filtering         | Server-side via toolbar filter controls                        |
| Sorting           | Server-controlled (reverse chronological), not client-sortable |
| Selection         | None (read-only log)                                           |
| Pinned columns    | Timestamp (left-pinned)                                        |

---

## 7. Side Panel Specifications

### 7.1 Add/Edit User Panel

| Property       | Value                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| Width          | 480px (standard, per `00-global-framework.md` Section 4.4)                   |
| Trigger        | "+ Add User" button (create) or row Edit button (edit)                       |
| Animation      | Slide in from right, 200ms ease-in-out                                       |
| Close triggers | X button, Escape key                                                         |
| Focus trap     | Yes -- first form field receives focus on open                               |
| Backdrop       | Semi-transparent overlay, click to close (with unsaved changes confirmation) |

### 7.2 Panel Sections (Edit Mode)

1. **User Details** -- email (read-only), role dropdown, active toggle
2. **Password Management** -- "Reset Password" button
3. **Account Info** (read-only) -- last login, failed attempts, locked until, created at

Sections separated by `1px solid --workspace-border` with `--space-4` gap.

---

## 8. State Management

### 8.1 Server State (TanStack Query v5)

| Query         | Key Pattern                                                   | Stale Time | Notes                                        |
| ------------- | ------------------------------------------------------------- | ---------- | -------------------------------------------- |
| User list     | `['users']`                                                   | 30s        | Invalidated on create/edit/deactivate        |
| Single user   | `['users', userId]`                                           | 30s        | Used for edit panel pre-fill                 |
| Audit entries | `['audit', { from, to, userId, operation, tableName, page }]` | 60s        | Longer stale time; audit data is append-only |
| System config | `['system-config']`                                           | 5min       | Rarely changes; long cache acceptable        |

### 8.2 Client State (Zustand)

```typescript
interface AdminStore {
	// User Management
	selectedUserId: number | null;
	userSearchQuery: string;
	showPermissionsPanel: boolean;

	// Audit Trail
	auditFilters: {
		from: string;
		to: string;
		userId: number | null;
		operation: string | null;
		tableName: string | null;
	};
	auditPage: number;

	// System Settings
	pendingConfigChanges: Record<string, string>;
	hasUnsavedSettings: boolean;

	// Side Panel
	activeSidePanel: 'create-user' | 'edit-user' | null;
	editingUserId: number | null;
}
```

### 8.3 URL State

Admin module URL parameters for deep linking:

| Route           | URL Pattern       | Params                                                                 |
| --------------- | ----------------- | ---------------------------------------------------------------------- |
| User Management | `/admin/users`    | `?search={query}`                                                      |
| Audit Trail     | `/admin/audit`    | `?from={date}&to={date}&user={id}&action={op}&entity={table}&page={n}` |
| System Settings | `/admin/settings` | None                                                                   |

---

## 9. API Integration

### 9.1 User Management Endpoints

#### List Users

| Property | Value                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------ |
| Method   | `GET /api/v1/users`                                                                                    |
| RBAC     | Admin only                                                                                             |
| Response | `{ "users": [{ id, email, role, is_active, last_login, failed_attempts, locked_until, created_at }] }` |

Note: The API response includes `failed_attempts` and `locked_until` fields beyond what is documented in the TDD endpoint spec. These fields are present on the `users` table (TDD Section 3) and should be included in the list response for the Admin UI.

#### Create User

| Property | Value                                                     |
| -------- | --------------------------------------------------------- |
| Method   | `POST /api/v1/users`                                      |
| RBAC     | Admin only                                                |
| Request  | `{ "email": string, "password": string, "role": string }` |
| Success  | 201 with created user object                              |
| Errors   | 400 `VALIDATION_ERROR`, 409 `EMAIL_EXISTS`                |

#### Update User

| Property | Value                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Method   | `PATCH /api/v1/users/:id`                                                                                                                    |
| RBAC     | Admin only                                                                                                                                   |
| Request  | `{ "role"?: string, "is_active"?: boolean, "force_password_reset"?: boolean, "unlock_account"?: boolean, "force_session_revoke"?: boolean }` |
| Success  | 200 with updated user object                                                                                                                 |

### 9.2 Audit Trail Endpoint

| Property          | Value                                                                        |
| ----------------- | ---------------------------------------------------------------------------- |
| Method            | `GET /api/v1/audit`                                                          |
| RBAC              | Admin only                                                                   |
| Query params      | `from`, `to`, `user_id`, `table_name`, `operation`, `page`, `page_size`      |
| Response          | `{ "entries": [...], "total": number, "page": number, "page_size": number }` |
| Default page_size | 50                                                                           |
| Max page_size     | 200                                                                          |

### 9.3 System Config Endpoints

#### Read Config

| Property | Value                                                    |
| -------- | -------------------------------------------------------- |
| Method   | `GET /api/v1/system-config`                              |
| RBAC     | Admin only                                               |
| Response | `{ "config": [{ key, value, description, data_type }] }` |

#### Update Config

| Property    | Value                                                 |
| ----------- | ----------------------------------------------------- |
| Method      | `PUT /api/v1/system-config`                           |
| RBAC        | Admin only                                            |
| Request     | `{ "updates": [{ "key": string, "value": string }] }` |
| Success     | 200 with `{ "updated": number }`                      |
| Side effect | Each changed key-value pair logged to audit trail     |

### 9.4 Error Handling

All API errors follow the standard error handling from `00-global-framework.md` Section 9.1.

| Scenario               | HTTP Status | UI Behavior                                                           |
| ---------------------- | ----------- | --------------------------------------------------------------------- |
| Email already exists   | 409         | Inline error on email field: "A user with this email already exists"  |
| Invalid role value     | 400         | Inline error on role field                                            |
| Cannot deactivate self | 400         | Toast: "You cannot deactivate your own account"                       |
| Cannot change own role | 400         | Toast: "You cannot change your own role"                              |
| Unauthorized           | 403         | Toast: "You don't have permission to perform this action"             |
| Network error          | --          | Standard network error overlay (`00-global-framework.md` Section 9.2) |

---

## 10. RBAC Behavior

This section is straightforward: the entire Admin module is restricted to the Admin role.

### 10.1 Access Control

| Rule               | Implementation                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidebar visibility | Admin group (User Settings, Audit Trail, System Settings) hidden for non-Admin roles. Enforced in `useSidebarStore` based on JWT role claim.                                              |
| Route guard        | `/admin/*` routes protected by a route-level guard that checks `role === 'Admin'`. Non-Admin users navigating to `/admin/*` are redirected to `/dashboard` with a toast: "Access denied". |
| API enforcement    | All Admin endpoints return HTTP 403 for non-Admin roles. The UI guard is a convenience; the API is the source of truth.                                                                   |

### 10.2 Self-Protection Rules

Admins cannot perform certain operations on their own account to prevent accidental lockout:

| Operation    | Self-targeting behavior                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Deactivate   | Deactivate button hidden on own row                                                             |
| Change role  | Role dropdown disabled in edit panel when editing self (tooltip: "Cannot change your own role") |
| Force logout | Force Logout button hidden on own row                                                           |

---

## 11. Accessibility

### 11.1 WCAG AA Compliance

All accessibility requirements from `00-global-framework.md` Section 10 apply. Module-specific additions:

| Requirement          | Implementation                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User table           | `role="grid"` with `role="row"` and `role="gridcell"`. Column headers use `role="columnheader"`.                                                                    |
| Role badges          | Text label inside badge (not color-only). Screen readers announce full role name.                                                                                   |
| Status badges        | Text label "Active"/"Inactive" (not color-only). `aria-label` on badge element.                                                                                     |
| Failed attempts      | High values (>= 3) communicated by text, not color alone. `aria-label="3 failed attempts, elevated risk"`.                                                          |
| Locked indicator     | `aria-label="Account locked until {datetime}"` on the locked_until cell.                                                                                            |
| Permissions table    | `role="table"` with `aria-label="Role permissions matrix"`. Selected column announced: `aria-current="true"` on highlighted column header.                          |
| Audit log table      | `role="grid"` with `aria-label="Audit trail entries"`. Pagination state announced: `aria-live="polite"` region with "Page {n} of {total}, showing {count} entries". |
| Settings form        | Each input has an associated `<label>`. Groups use `<fieldset>` with `<legend>`.                                                                                    |
| Confirmation dialogs | Focus trapped inside dialog. Escape key closes. `aria-describedby` links to dialog description. `role="alertdialog"` for destructive actions.                       |

### 11.2 Keyboard Navigation

| Key             | Context             | Action                                                                  |
| --------------- | ------------------- | ----------------------------------------------------------------------- |
| `Tab`           | User table          | Moves focus between rows, then to action buttons within the focused row |
| `Enter`         | User table row      | Opens edit side panel for the focused user                              |
| `Space`         | User table row      | Toggles permissions panel for the focused user                          |
| `Arrow Up/Down` | User table          | Moves focus between rows                                                |
| `Escape`        | Side panel / dialog | Closes the panel or dialog                                              |
| `Tab`           | Audit filters       | Moves between filter controls                                           |
| `Tab`           | Settings form       | Moves between setting inputs                                            |
| `Ctrl+S`        | Settings form       | Saves pending changes (matches global shortcut)                         |

### 11.3 Focus Management

- On sub-module navigation: focus moves to the module toolbar's first interactive element.
- User Management: focus moves to the search input.
- Audit Trail: focus moves to the Date From picker.
- System Settings: focus moves to the first editable input.
- On side panel open: focus moves to the first form field (email on create, role on edit).
- On side panel close: focus returns to the row's Edit button that triggered the panel.
- On confirmation dialog close: focus returns to the button that triggered the dialog.
