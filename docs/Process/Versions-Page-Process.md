# Version Management Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Version Management page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

---

## Table of Contents

1. [Overview](#overview)
2. [Business Context](#business-context)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Pre-Conditions](#pre-conditions)
5. [Page Layout & UI Elements](#page-layout--ui-elements)
6. [Step-by-Step Workflow](#step-by-step-workflow)
7. [Data Models & Database Schema](#data-models--database-schema)
8. [API Endpoints](#api-endpoints)
9. [TypeScript Types](#typescript-types)
10. [Version Lifecycle State Machine](#version-lifecycle-state-machine)
11. [Audit Trail](#audit-trail)
12. [Error Handling](#error-handling)
13. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Page Name**        | Version Management                                                                                                     |
| **URL Route**        | `/management/versions`                                                                                                 |
| **Module**           | Epic 10 — Budget Version Management                                                                                    |
| **Page File**        | `apps/web/src/pages/management/versions.tsx`                                                                           |
| **Primary Function** | Manage budget versions throughout their lifecycle: create, clone, publish, lock, archive, revert, and compare versions |

### What This Page Does

The Version Management page is the **central hub** for managing all budget versions in the system. It allows users to:

1. **Create** new budget versions (Budget, Forecast types)
2. **Clone** existing versions as a starting point for new scenarios
3. **Manage version lifecycle** through status transitions (Draft → Published → Locked → Archived)
4. **Revert** Published or Locked versions back to Draft for corrections
5. **Compare** 2-3 versions side-by-side to analyze differences
6. **Filter and search** versions by fiscal year, type, status, or name
7. **Delete** draft versions that are no longer needed

**Critical Business Rule**: Budget versions are immutable snapshots. Once Published, a version cannot be directly edited — it must be reverted to Draft first. This ensures audit trail integrity and prevents accidental changes to approved budgets.

### How This Page Fits Into the Planning Workflow

This page manages the **lifecycle and governance** of versions. It is **not** the page that sets the user's active working version for day-to-day planning.

- The **Version Management page** is used to create, clone, publish, lock, archive, revert, compare, and inspect versions.
- The **Planning context bar** in the planning workspace is used to select the currently active version for Enrollment, Revenue, Staffing, and P&L pages.
- Planning write endpoints enforce **Draft-only editing**. If a version is Published, Locked, or Archived, downstream write operations are rejected by the API.

This distinction is important for auditors and business users: lifecycle control happens here, while operational planning work happens in the planning modules.

---

## Business Context

### Budget Version Types

| Type         | Code | Description          | Use Case                          |
| ------------ | ---- | -------------------- | --------------------------------- |
| **Budget**   | BUD  | Annual budget plan   | Initial yearly budget proposal    |
| **Forecast** | FC   | Updated projections  | Revised estimates during the year |
| **Actual**   | ACT  | Real historical data | Imported actual financial results |

### Data Sources

| Source         | Description                                                     | Immutable                                                                        |
| -------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **CALCULATED** | System-computed from enrollment, revenue, DHG calculations      | Editable only while version is Draft                                             |
| **IMPORTED**   | Data loaded from external files (e.g., actuals from accounting) | Primarily read-only in downstream workflows; status and module rules still apply |

### Fiscal Year

The school's financial year runs **January – December**. Versions are organized by fiscal year (e.g., FY2026). Users can create versions for future years for long-term planning.

### Stale Modules

When underlying data changes, calculation modules become "stale" and require recalculation:

| Module     | Description                                  |
| ---------- | -------------------------------------------- |
| ENROLLMENT | Enrollment headcounts and cohort progression |
| REVENUE    | Tuition fee revenue calculations             |
| DHG        | Teaching hour allocation requirements        |
| STAFFING   | Staff positions and costs                    |
| PNL        | Profit & Loss summary                        |

---

## User Roles & Permissions

### Action Permissions Matrix

| Action               | Admin | BudgetOwner     | Editor | Viewer |
| -------------------- | ----- | --------------- | ------ | ------ |
| **View versions**    | ✅    | ✅              | ✅     | ✅     |
| **Create version**   | ✅    | ✅              | ❌     | ❌     |
| **Clone version**    | ✅    | ✅              | ❌     | ❌     |
| **Publish version**  | ✅    | ✅              | ❌     | ❌     |
| **Lock version**     | ✅    | ❌              | ❌     | ❌     |
| **Archive version**  | ✅    | ❌              | ❌     | ❌     |
| **Revert to Draft**  | ✅    | ❌              | ❌     | ❌     |
| **Delete version**   | ✅    | ✅ (Draft only) | ❌     | ❌     |
| **Compare versions** | ✅    | ✅              | ✅     | ✅     |

### Version Lock Rule

Edit operations on version data (enrollment, revenue, staffing) are blocked if the Budget Version status is not **"Draft"**. Published, Locked, or Archived versions cannot have their underlying data modified.

---

## Pre-Conditions

Before using this page, the following should be configured:

### Required Master Data

1. **Fiscal Periods** (`fiscal_periods` table)
    - Fiscal years must be defined (e.g., 2025, 2026, 2027)
    - Academic periods (AY1, Summer, AY2) with start/end dates

2. **Grade Levels** (`grade_levels` table)
    - Required when cloning enrollment data

3. **System Configuration**
    - Current fiscal year must be set

### For Creating Versions

- User must have Admin or BudgetOwner role
- At least one fiscal year must exist in the system

### For Cloning Versions

- Source version must exist and not be an "Actual" type
- User must have appropriate permissions

---

## Page Layout & UI Elements

### Header Section

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Version Management                                          [Compare]      │
│                                                              [+ Add Version]│
├─────────────────────────────────────────────────────────────────────────────┤
│  Filter Bar                                                                 │
│  [FY ▼]    [Type ▼]    [Status ▼]    [Search...]                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Filter          | Values                                           | Function                                  |
| --------------- | ------------------------------------------------ | ----------------------------------------- |
| **Fiscal Year** | All Years, FY2025, FY2026, ...                   | Filter by fiscal year                     |
| **Type**        | All Types, Budget, Forecast, Actual              | Filter by version type                    |
| **Status**      | All Statuses, Draft, Published, Locked, Archived | Filter by lifecycle status                |
| **Search**      | Free text                                        | Filter by version name (case-insensitive) |

### Action Buttons

| Button          | Icon      | Role Required      | Action                                      |
| --------------- | --------- | ------------------ | ------------------------------------------- |
| **Compare**     | BarChart3 | Any                | Toggles compare mode for selecting versions |
| **Add Version** | Plus      | Admin, BudgetOwner | Opens Create Version panel                  |

### Versions Table

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ [☐]  Name          FY      Type  Status    Source  Created      Stale   Actions   │
├────────────────────────────────────────────────────────────────────────────────────┤
│ [☐]  Budget 2026   FY2026  ● BUD  PUBLISHED  CALC   jdoe / Jan 5   2 stale  [⋯]    │
│ [☐]  Forecast Q2   FY2026  ● FC   DRAFT      CALC   asmith / Mar 2  -       [⋯]    │
│ [☐]  Actuals 2025  FY2025  ● ACT  LOCKED     IMPORT bjones / Feb 1 -       [⋯]    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Table Columns**:

| Column               | Description                             | Clickable               |
| -------------------- | --------------------------------------- | ----------------------- |
| **Compare Checkbox** | Select 2-3 versions for comparison      | Yes (compare mode only) |
| **Name**             | Version name (click to view details)    | Yes                     |
| **Fiscal Year**      | Badge showing FY (e.g., FY2026)         | No                      |
| **Type**             | Colored dot + code (BUD/FC/ACT)         | No                      |
| **Status**           | Badge (Draft/Published/Locked/Archived) | No                      |
| **Data Source**      | CALC (calculated) or IMPORT (imported)  | No                      |
| **Created**          | User email prefix / date                | No                      |
| **Stale**            | Count of stale modules (warning badge)  | Yes (opens details)     |
| **Actions**          | Dropdown menu with available actions    | Yes                     |

### Actions Dropdown Menu

```text
┌─────────────────┐
│ View Details    │
│ Clone           │  ← Disabled for Actual type
│ ────────────────│
│ Publish         │  ← Draft only, Admin/BudgetOwner
│ Lock            │  ← Published only, Admin only
│ Archive         │  ← Locked only, Admin only
│ Revert to Draft │  ← Published/Locked, Admin only
│ ────────────────│
│ Delete          │  ← Draft only, Admin/BudgetOwner
└─────────────────┘
```

### Compare Mode Banner

```text
┌─────────────────────────────────────────────────────────────────┐
│ Select 2-3 versions to compare (2 of 3 selected)   [View Comparison]│
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Workflow

### Workflow 1: Create a New Version

**Actor**: Admin or BudgetOwner

| Step | Action                           | UI Element | API Call         | Result                            |
| ---- | -------------------------------- | ---------- | ---------------- | --------------------------------- |
| 1    | Click "+ Add Version" button     | Button     | -                | Create Version panel opens        |
| 2    | Enter version name               | Text input | -                | Name displayed (required)         |
| 3    | Select version type              | Dropdown   | -                | Type selected (Budget/Forecast)   |
| 4    | Select fiscal year               | Dropdown   | -                | Fiscal year selected              |
| 5    | (Optional) Enter description     | Text area  | -                | Description captured              |
| 6    | (Optional) Select source version | Dropdown   | -                | Clone from existing version       |
| 7    | Click "Create"                   | Button     | `POST /versions` | Version created with Draft status |
| 8    | Observe toast notification       | Toast      | -                | Success message displayed         |
| 9    | New version appears in table     | Table row  | -                | Listed with Draft status          |

**Database Changes**:

- Insert `budget_versions` record with status = 'Draft'
- If source version specified, copy enrollment/revenue data
- Insert `audit_entries` record with operation VERSION_CREATED

---

### Workflow 2: Clone an Existing Version

**Actor**: Admin or BudgetOwner

| Step | Action                         | UI Element       | API Call                    | Result                           |
| ---- | ------------------------------ | ---------------- | --------------------------- | -------------------------------- |
| 1    | Locate source version in table | Table row        | -                           | Version identified               |
| 2    | Click actions menu (⋯)         | Dropdown trigger | -                           | Menu opens                       |
| 3    | Click "Clone"                  | Menu item        | -                           | Clone Version dialog opens       |
| 4    | Enter new version name         | Text input       | -                           | Name captured                    |
| 5    | (Optional) Modify description  | Text area        | -                           | Description updated              |
| 6    | (Optional) Change fiscal year  | Dropdown         | -                           | Fiscal year updated              |
| 7    | Select data to include         | Checkboxes       | -                           | Enrollment/Summaries toggled     |
| 8    | Click "Clone"                  | Button           | `POST /versions/{id}/clone` | Cloning initiated                |
| 9    | Wait for completion            | Spinner          | -                           | Dialog closes, table refreshes   |
| 10   | New cloned version appears     | Table row        | -                           | Copy of source with Draft status |

**Clone Behavior**:

- Source version data is copied to new version
- New version always starts as Draft
- Modification count resets to 0
- Source version ID is tracked for audit

---

### Workflow 3: Publish a Version

**Actor**: Admin or BudgetOwner

| Step | Action                        | UI Element       | API Call                      | Result                                    |
| ---- | ----------------------------- | ---------------- | ----------------------------- | ----------------------------------------- |
| 1    | Locate Draft version in table | Table row        | -                             | Version identified                        |
| 2    | Click actions menu (⋯)        | Dropdown trigger | -                             | Menu opens                                |
| 3    | Click "Publish"               | Menu item        | -                             | Publish confirmation dialog opens         |
| 4    | Review confirmation message   | Dialog text      | -                             | Visibility and confirmation message shown |
| 5    | Click "Publish" to confirm    | Button           | `PATCH /versions/{id}/status` | Version published                         |
| 6    | Observe toast notification    | Toast            | -                             | Success message displayed                 |
| 7    | Status badge updates          | Table cell       | -                             | Changes from Draft → Published            |

**State Transition**:

```text
Draft ──► Published
  ↑         │
  └── Revert─┘
```

**Database Changes**:

- Update `budget_versions.status` = 'Published'
- Set `budget_versions.publishedAt` = current timestamp
- Insert `audit_entries` record with operation VERSION_PUBLISHED

---

### Workflow 4: Lock a Version

**Actor**: Admin only

| Step | Action                     | UI Element       | API Call                      | Result                          |
| ---- | -------------------------- | ---------------- | ----------------------------- | ------------------------------- |
| 1    | Locate Published version   | Table row        | -                             | Version identified              |
| 2    | Click actions menu (⋯)     | Dropdown trigger | -                             | Menu opens                      |
| 3    | Click "Lock"               | Menu item        | -                             | Lock confirmation dialog opens  |
| 4    | Click "Lock" to confirm    | Button           | `PATCH /versions/{id}/status` | Version locked                  |
| 5    | Observe toast notification | Toast            | -                             | Success message displayed       |
| 6    | Status badge updates       | Table cell       | -                             | Changes from Published → Locked |

**State Transition**:

```text
Published ──► Locked
     ↑          │
     └─ Revert──┘
```

**Purpose**: Locking prevents any further changes including reversion to Draft. This is typically done for approved budgets or finalized actuals.

---

### Workflow 5: Archive a Version

**Actor**: Admin only

| Step | Action                     | UI Element       | API Call                      | Result                            |
| ---- | -------------------------- | ---------------- | ----------------------------- | --------------------------------- |
| 1    | Locate Locked version      | Table row        | -                             | Version identified                |
| 2    | Click actions menu (⋯)     | Dropdown trigger | -                             | Menu opens                        |
| 3    | Click "Archive"            | Menu item        | -                             | Archive confirmation dialog opens |
| 4    | Click "Archive" to confirm | Button           | `PATCH /versions/{id}/status` | Version archived                  |
| 5    | Observe toast notification | Toast            | -                             | Success message displayed         |
| 6    | Status badge updates       | Table cell       | -                             | Changes from Locked → Archived    |

**State Transition**:

```text
Locked ──► Archived
```

**Purpose**: Archiving moves completed/obsolete versions to a terminal, read-only state. Archived versions remain in the system for historical reference and are still visible in the list unless filtered out by status.

---

### Workflow 6: Revert to Draft

**Actor**: Admin only

| Step | Action                                             | UI Element       | API Call                      | Result                           |
| ---- | -------------------------------------------------- | ---------------- | ----------------------------- | -------------------------------- |
| 1    | Locate Published or Locked version                 | Table row        | -                             | Version identified               |
| 2    | Click actions menu (⋯)                             | Dropdown trigger | -                             | Menu opens                       |
| 3    | Click "Revert to Draft"                            | Menu item        | -                             | Revert confirmation dialog opens |
| 4    | Enter audit note (required, minimum 10 characters) | Text area        | -                             | Justification captured           |
| 5    | Click "Revert" to confirm                          | Button           | `PATCH /versions/{id}/status` | Version reverted                 |
| 6    | Observe toast notification                         | Toast            | -                             | Success message displayed        |
| 7    | Status badge updates                               | Table cell       | -                             | Changes to Draft                 |

**State Transition**:

```text
Published ──► Draft
Locked ─────► Draft (clears publishedAt and lockedAt)
```

**Important**: Reverting a Locked version clears both `lockedAt` and `publishedAt` timestamps.

---

### Workflow 7: Delete a Version

**Actor**: Admin or BudgetOwner

| Step | Action                     | UI Element       | API Call                | Result                           |
| ---- | -------------------------- | ---------------- | ----------------------- | -------------------------------- |
| 1    | Locate Draft version       | Table row        | -                       | Version identified               |
| 2    | Click actions menu (⋯)     | Dropdown trigger | -                       | Menu opens                       |
| 3    | Click "Delete"             | Menu item        | -                       | Delete confirmation dialog opens |
| 4    | Review warning message     | Dialog text      | -                       | Data loss warning shown          |
| 5    | Click "Delete" to confirm  | Button           | `DELETE /versions/{id}` | Version deleted                  |
| 6    | Observe toast notification | Toast            | -                       | Success message displayed        |
| 7    | Row removed from table     | Table update     | -                       | Version no longer listed         |

**Constraints**:

- Only Draft versions can be deleted
- Deletion cascades to all related data (enrollment, revenue, staffing)
- This action is logged in audit trail but not reversible

---

### Workflow 8: Compare Versions

**Actor**: Any authenticated user

| Step | Action                            | UI Element      | API Call                                | Result                              |
| ---- | --------------------------------- | --------------- | --------------------------------------- | ----------------------------------- |
| 1    | Click "Compare" button            | Button          | -                                       | Compare mode activated              |
| 2    | Observe compare banner appears    | Banner          | -                                       | "Select 2-3 versions" message shown |
| 3    | Click checkbox next to version 1  | Checkbox        | -                                       | Version selected (counter: 1/3)     |
| 4    | Click checkbox next to version 2  | Checkbox        | -                                       | Version selected (counter: 2/3)     |
| 5    | (Optional) Select 3rd version     | Checkbox        | -                                       | Counter shows 3/3                   |
| 6    | Click "View Comparison"           | Button          | `GET /versions/compare-multi?ids=1,2,3` | Comparison panel opens              |
| 7    | Review comparison results         | Comparison view | -                                       | Monthly and annual totals displayed |
| 8    | Click "Close" or "Cancel Compare" | Button          | -                                       | Comparison view closes              |

**Comparison Data Displayed**:

- Monthly revenue, staff costs, net profit for each version
- Variance calculations (absolute and percentage)
- Annual totals summary

---

### Workflow 9: View Version Details

**Actor**: Any authenticated user

| Step | Action                           | UI Element     | API Call                                               | Result                                   |
| ---- | -------------------------------- | -------------- | ------------------------------------------------------ | ---------------------------------------- |
| 1    | Click version name in table      | Link           | -                                                      | Version Detail panel opens               |
| 2    | Review version information       | Panel content  | -                                                      | Name, type, status, dates shown          |
| 3    | Open the **Lifecycle** tab       | Tab            | `GET /audit?table_name=budget_versions&record_id={id}` | Audit entries displayed                  |
| 4    | (Optional) Open the **Data** tab | Tab            | `GET /versions/{id}/import-logs`                       | Import history shown for Actual versions |
| 5    | Click action buttons in panel    | Panel buttons  | Various                                                | Lifecycle dialogs open                   |
| 6    | Click "Close" or outside panel   | Button/overlay | -                                                      | Panel closes                             |

---

## Data Models & Database Schema

### Core Tables

#### 1. budget_versions

Stores all budget versions with their lifecycle state.

```sql
Table: budget_versions
┌─────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column              │ Type            │ Description                                │
├─────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                  │ SERIAL PK       │ Unique identifier                          │
│ fiscal_year         │ INTEGER         │ Fiscal year (e.g., 2026)                   │
│ name                │ VARCHAR(100)    │ Version name                               │
│ type                │ VARCHAR(10)     │ 'Budget', 'Forecast', 'Actual'             │
│ status              │ VARCHAR(10)     │ 'Draft', 'Published', 'Locked', 'Archived' │
│ description         │ TEXT            │ Optional description                       │
│ data_source         │ VARCHAR(10)     │ 'CALCULATED' or 'IMPORTED'                 │
│ source_version_id   │ INTEGER FK      │ → budget_versions.id (for clones)          │
│ modification_count  │ INTEGER         │ Number of data modifications               │
│ stale_modules       │ TEXT[]          │ Array of stale module names                │
│ created_by_id       │ INTEGER FK      │ → users.id                                 │
│ published_at        │ TIMESTAMPTZ     │ When version was published                 │
│ locked_at           │ TIMESTAMPTZ     │ When version was locked                    │
│ archived_at         │ TIMESTAMPTZ     │ When version was archived                  │
│ created_at          │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at          │ TIMESTAMPTZ     │ Last update timestamp                      │
└─────────────────────┴─────────────────┴────────────────────────────────────────────┘

Indexes: fiscal_year, status, type, created_by_id
```

#### 2. audit_entries

Append-only audit log for all version operations.

```sql
Table: audit_entries
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ table_name        │ VARCHAR(50)     │ 'budget_versions'                          │
│ record_id         │ INTEGER         │ Version ID                                 │
│ operation         │ VARCHAR(50)     │ Operation type (see below)                 │
│ old_values        │ JSONB           │ Previous state (for updates)               │
│ new_values        │ JSONB           │ New state                                  │
│ user_id           │ INTEGER FK      │ → users.id                                 │
│ ip_address        │ INET            │ IP address of user                         │
│ created_at        │ TIMESTAMPTZ     │ Timestamp of operation                     │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Operations: VERSION_CREATED, VERSION_CLONED, VERSION_PUBLISHED,
            VERSION_LOCKED, VERSION_ARCHIVED, VERSION_REVERTED, VERSION_DELETED
```

#### 3. import_logs

Tracks data imports for Actual-type versions.

```sql
Table: import_logs
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ version_id        │ INTEGER FK      │ → budget_versions.id                       │
│ module            │ VARCHAR(20)     │ Module imported (e.g., 'ENROLLMENT')       │
│ source_file       │ VARCHAR(255)    │ Original file name                         │
│ validation_status │ VARCHAR(20)     │ 'PENDING', 'VALIDATED', 'FAILED'           │
│ rows_imported     │ INTEGER         │ Number of rows successfully imported       │
│ imported_by_id    │ INTEGER FK      │ → users.id                                 │
│ imported_at       │ TIMESTAMPTZ     │ Import timestamp                           │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

---

## API Endpoints

### Version CRUD APIs

| Method | Endpoint                                | Description                | Auth | Role               |
| ------ | --------------------------------------- | -------------------------- | ---- | ------------------ |
| GET    | `/versions`                             | List versions with filters | JWT  | Any                |
| GET    | `/versions?fiscalYear=2026&type=Budget` | Filtered list              | JWT  | Any                |
| POST   | `/versions`                             | Create new version         | JWT  | Admin, BudgetOwner |
| DELETE | `/versions/{id}`                        | Delete draft version       | JWT  | Admin, BudgetOwner |

**GET Response**:

```json
{
    "data": [
        {
            "id": 1,
            "fiscalYear": 2026,
            "name": "Budget 2026",
            "type": "Budget",
            "status": "Published",
            "description": "Annual budget plan",
            "dataSource": "CALCULATED",
            "sourceVersionId": null,
            "modificationCount": 0,
            "staleModules": [],
            "createdById": 5,
            "createdByEmail": "jdoe@efir.edu",
            "publishedAt": "2025-01-15T10:30:00Z",
            "lockedAt": null,
            "archivedAt": null,
            "createdAt": "2025-01-10T09:00:00Z",
            "updatedAt": "2025-01-15T10:30:00Z"
        }
    ],
    "total": 15,
    "nextCursor": null
}
```

**POST Request Body**:

```json
{
    "name": "Budget 2026 v2",
    "type": "Budget",
    "fiscalYear": 2026,
    "description": "Revised budget with updated enrollment",
    "sourceVersionId": 1
}
```

---

### Clone API

| Method | Endpoint               | Description            | Auth | Role               |
| ------ | ---------------------- | ---------------------- | ---- | ------------------ |
| POST   | `/versions/{id}/clone` | Clone existing version | JWT  | Admin, BudgetOwner |

**Request Body**:

```json
{
    "name": "Forecast Q2 2026",
    "description": "Q2 forecast based on Budget 2026",
    "fiscalYear": 2026,
    "includeEnrollment": true,
    "includeSummaries": true
}
```

---

### Lifecycle Transition API

| Method | Endpoint                | Description           | Auth | Role                 |
| ------ | ----------------------- | --------------------- | ---- | -------------------- |
| PATCH  | `/versions/{id}/status` | Change version status | JWT  | Varies by transition |

**Request Body**:

```json
{
    "new_status": "Published",
    "audit_note": "Approved by finance committee"
}
```

**Valid Transitions**:

- `Draft → Published`: Admin, BudgetOwner
- `Published → Locked`: Admin only
- `Published → Draft`: Admin only (revert)
- `Locked → Archived`: Admin only
- `Locked → Draft`: Admin only (revert)

---

### Compare APIs

| Method | Endpoint                                   | Description          | Auth | Role |
| ------ | ------------------------------------------ | -------------------- | ---- | ---- |
| GET    | `/versions/compare-multi?ids=1,2,3`        | Compare 2-3 versions | JWT  | Any  |
| GET    | `/versions/compare?primary=1&comparison=2` | Detailed comparison  | JWT  | Any  |

**Compare Response**:

```json
{
    "versions": [
        { "id": 1, "name": "Budget 2026", "type": "Budget", "fiscalYear": 2026 },
        { "id": 2, "name": "Forecast Q1", "type": "Forecast", "fiscalYear": 2026 }
    ],
    "monthly": [
        {
            "month": 1,
            "values": [
                {
                    "versionId": 1,
                    "revenueHt": "850000.00",
                    "staffCosts": "520000.00",
                    "netProfit": "330000.00"
                }
            ]
        }
    ],
    "annualTotals": [
        {
            "versionId": 1,
            "revenueHt": "10200000.00",
            "staffCosts": "6240000.00",
            "netProfit": "3960000.00"
        }
    ]
}
```

---

### Import Log API

| Method | Endpoint                     | Description        | Auth | Role |
| ------ | ---------------------------- | ------------------ | ---- | ---- |
| GET    | `/versions/{id}/import-logs` | Get import history | JWT  | Any  |

---

## TypeScript Types

### Core Types (`apps/web/src/hooks/use-versions.ts`)

```typescript
// Version type discriminator
export type VersionType = 'Budget' | 'Forecast' | 'Actual';

// Version status lifecycle states
export type VersionStatus = 'Draft' | 'Published' | 'Locked' | 'Archived';

// Budget version entity
export interface BudgetVersion {
    id: number;
    fiscalYear: number;
    name: string;
    type: VersionType;
    status: VersionStatus;
    description: string | null;
    dataSource: string; // 'CALCULATED' | 'IMPORTED'
    sourceVersionId: number | null;
    modificationCount: number;
    staleModules: string[]; // 'ENROLLMENT' | 'REVENUE' | 'DHG' | 'STAFFING' | 'PNL'
    createdById: number;
    createdByEmail: string | null;
    publishedAt: string | null; // ISO timestamp
    lockedAt: string | null;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// List response with pagination
export interface VersionListResponse {
    data: BudgetVersion[];
    total: number;
    nextCursor: number | null;
}

// Create version input
export interface CreateVersionInput {
    name: string;
    type: 'Budget' | 'Forecast'; // Cannot create 'Actual' directly
    fiscalYear: number;
    description?: string;
    sourceVersionId?: number; // Optional: clone from existing
}

// Clone version input
export interface CloneVersionInput {
    name: string;
    description?: string;
    fiscalYear?: number;
    includeEnrollment?: boolean;
    includeSummaries?: boolean;
}

// Status patch input
export interface PatchStatusInput {
    new_status: VersionStatus;
    audit_note?: string;
}
```

### Audit Trail Types

```typescript
export interface AuditTrailEntry {
    id: number;
    operation: string; // VERSION_CREATED, VERSION_PUBLISHED, etc.
    userId: number | null;
    newValues: Record<string, unknown> | null;
    oldValues: Record<string, unknown> | null;
    ipAddress: string | null;
    createdAt: string;
}
```

### Comparison Types

```typescript
export interface MultiCompareResponse {
    versions: Array<{
        id: number;
        name: string;
        type: string;
        fiscalYear: number;
    }>;
    monthly: Array<{
        month: number;
        values: Array<{
            versionId: number;
            revenueHt: string;
            staffCosts: string;
            netProfit: string;
            variance: CompareVariance | null;
        }>;
    }>;
    annualTotals: Array<{
        versionId: number;
        revenueHt: string;
        staffCosts: string;
        netProfit: string;
        variance: CompareVariance | null;
    }>;
}

interface CompareVariance {
    revenueHt: { abs: string; pct: string | null };
    staffCosts: { abs: string; pct: string | null };
    netProfit: { abs: string; pct: string | null };
}
```

---

## Version Lifecycle State Machine

### State Diagram

```text
                    ┌─────────────────────────────────────────────────────────┐
                    │                                                         │
                    ▼                                                         │
┌────────┐    ┌──────────┐    ┌───────────┐    ┌────────┐    ┌──────────┐   │
│ CREATE │───►│  DRAFT   │───►│ PUBLISHED │───►│ LOCKED │───►│ ARCHIVED │   │
└────────┘    └────┬─────┘    └─────┬─────┘    └───┬────┘    └──────────┘   │
                   │                │              │                         │
                   │                │              │                         │
                   │                └──────────────┘                         │
                   │                       ▲                                  │
                   │                       │                                  │
                   └───────────────────────┘                                  │
                               REVERT (Admin)                                 │
                                                                             │
┌────────┐    ┌────────┐                                                      │
│ CLONE  │◄───┤ SOURCE │                                                      │
└────┬───┘    └────────┘                                                      │
     │                                                                         │
     ▼                                                                         │
┌────────┐                                                                     │
│ DRAFT  │─────────────────────────────────────────────────────────────────────┘
└────────┘                          DELETE
```

### Transition Rules

| From      | To        | Allowed Roles      | Timestamp Set | Timestamp Cleared         |
| --------- | --------- | ------------------ | ------------- | ------------------------- |
| -         | Draft     | Admin, BudgetOwner | -             | -                         |
| Draft     | Published | Admin, BudgetOwner | `publishedAt` | -                         |
| Published | Locked    | Admin              | `lockedAt`    | -                         |
| Published | Draft     | Admin              | -             | `publishedAt`             |
| Locked    | Archived  | Admin              | `archivedAt`  | -                         |
| Locked    | Draft     | Admin              | -             | `lockedAt`, `publishedAt` |

### Permission Matrix by Transition

| Transition         | Admin | BudgetOwner | Editor | Viewer |
| ------------------ | ----- | ----------- | ------ | ------ |
| Create             | ✅    | ✅          | ❌     | ❌     |
| Draft → Published  | ✅    | ✅          | ❌     | ❌     |
| Published → Locked | ✅    | ❌          | ❌     | ❌     |
| Published → Draft  | ✅    | ❌          | ❌     | ❌     |
| Locked → Archived  | ✅    | ❌          | ❌     | ❌     |
| Locked → Draft     | ✅    | ❌          | ❌     | ❌     |
| Delete Draft       | ✅    | ✅          | ❌     | ❌     |

---

## Audit Trail

### Operations Logged

| Operation         | Trigger             | Data Captured                           |
| ----------------- | ------------------- | --------------------------------------- |
| VERSION_CREATED   | New version created | Name, type, fiscal year, source version |
| VERSION_CLONED    | Version cloned      | Source ID, new name, included data      |
| VERSION_PUBLISHED | Published           | Timestamp, user, optional note          |
| VERSION_LOCKED    | Locked              | Timestamp, user                         |
| VERSION_ARCHIVED  | Archived            | Timestamp, user                         |
| VERSION_REVERTED  | Reverted to Draft   | Previous status, revert reason          |
| VERSION_DELETED   | Deleted             | Full version record backup              |

### Audit Entry Schema

```typescript
{
  id: number;
  tableName: 'budget_versions';
  recordId: number;          // Version ID
  operation: string;
  userId: number;
  userEmail: string;
  ipAddress: string;
  oldValues?: Json;          // Previous state
  newValues: Json;           // New state
  createdAt: Date;
}
```

### Example Audit Entry

```json
{
    "id": 42,
    "table_name": "budget_versions",
    "record_id": 5,
    "operation": "VERSION_PUBLISHED",
    "user_id": 3,
    "ip_address": "192.168.1.100",
    "old_values": { "status": "Draft", "published_at": null },
    "new_values": { "status": "Published", "published_at": "2025-01-15T10:30:00Z" },
    "created_at": "2025-01-15T10:30:00Z"
}
```

---

## Error Handling

### Common Error Codes

| Code                                    | HTTP Status | Description                                               | User Action                                  |
| --------------------------------------- | ----------- | --------------------------------------------------------- | -------------------------------------------- |
| VERSION_NOT_FOUND                       | 404         | Version ID does not exist                                 | Check version ID or refresh list             |
| INVALID_TRANSITION                      | 409         | Status change not allowed                                 | Check current status and allowed transitions |
| DUPLICATE_VERSION_NAME                  | 409         | Name already exists for fiscal year                       | Choose a unique name                         |
| ACTUAL_VERSION_CLONE_PROHIBITED         | 409         | Cannot clone Actual type                                  | Select Budget or Forecast source             |
| ACTUAL_VERSION_MANUAL_CREATE_PROHIBITED | 400         | Actual versions cannot be created manually                | Use the import workflow for actual data      |
| ACTUAL_COPY_PROHIBITED                  | 409         | Actual version cannot be used as create-from-source input | Select Budget or Forecast source             |
| SOURCE_NOT_FOUND                        | 404         | Source version for create-from-source not found           | Select valid source version                  |
| VERSION_NOT_DRAFT                       | 409         | Delete attempted on non-Draft version                     | Revert to Draft first if permitted           |
| AUDIT_NOTE_REQUIRED                     | 400         | Reverse transition missing a valid audit note             | Enter at least 10 characters                 |
| UNAUTHORIZED                            | 401         | User not authenticated                                    | Log in                                       |
| FORBIDDEN                               | 403         | User lacks required role                                  | Contact administrator                        |

### UI Error Handling

| Scenario                                 | Behavior                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| API failure on list load                 | Show error toast, display empty state with retry button                                              |
| Transition failure                       | Show error dialog with specific message, keep dialog open                                            |
| Clone failure                            | Show error in clone dialog, allow retry                                                              |
| Network timeout                          | Show retry prompt, preserve user input                                                               |
| Invalid transition or stale server state | Show server error message in the active dialog and require the user to retry from the refreshed list |

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Version Management module.

### High Priority

| ID      | Issue                          | Impact                                              | Proposed Solution                                 |
| ------- | ------------------------------ | --------------------------------------------------- | ------------------------------------------------- |
| VER-001 | **No bulk operations**         | Cannot archive/delete multiple versions at once     | Add multi-select with bulk actions                |
| VER-002 | **No version tags/labels**     | Cannot categorize versions (e.g., "Board Approved") | Add tag system with color coding                  |
| VER-003 | **Limited comparison metrics** | Only revenue/staff costs compared                   | Add enrollment, DHG, and custom metric comparison |
| VER-004 | **No version dependencies**    | Cannot track which versions depend on others        | Add dependency graph visualization                |

### Medium Priority

| ID      | Issue                           | Impact                              | Proposed Solution                                   |
| ------- | ------------------------------- | ----------------------------------- | --------------------------------------------------- |
| VER-005 | **No scheduled status changes** | Manual publish/lock required        | Add scheduled transitions (e.g., auto-lock on date) |
| VER-006 | **No version comments/notes**   | No way to discuss versions          | Add comment thread per version                      |
| VER-007 | **No export functionality**     | Cannot export version list to Excel | Add CSV/Excel export with filters                   |
| VER-008 | **Limited search**              | Only name search available          | Add full-text search across description, creator    |

### Low Priority / Technical Debt

| ID      | Issue                                                                    | Impact                                                                   | Proposed Solution                                                                      |
| ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| VER-009 | **No soft delete**                                                       | Deleted versions unrecoverable                                           | Implement soft delete with trash bin                                                   |
| VER-010 | **Hardcoded fiscal year range**                                          | Years hardcoded in frontend                                              | Fetch from API based on fiscal periods table                                           |
| VER-011 | **No version templates**                                                 | Each version created from scratch                                        | Add template versions for common scenarios                                             |
| VER-012 | **Limited import history**                                               | Import logs not filterable                                               | Add date/module filters to import logs                                                 |
| VER-013 | **Planning pages do not proactively lock the UI for non-Draft versions** | Users may attempt edits that the API later rejects with `VERSION_LOCKED` | Disable editing controls in planning modules when selected version status is not Draft |

### Feature Requests

| ID      | Feature                       | Business Value                                          | Complexity |
| ------- | ----------------------------- | ------------------------------------------------------- | ---------- |
| VER-F01 | **Version approval workflow** | Multi-stage approval before publish                     | High       |
| VER-F02 | **Version notifications**     | Email alerts on status changes                          | Medium     |
| VER-F03 | **Version calendar view**     | Visual timeline of version lifecycle                    | Medium     |
| VER-F04 | **Version impact analysis**   | Show what-if impact before publishing                   | High       |
| VER-F05 | **Version baseline locking**  | Lock specific module data while keeping others editable | High       |

---

## Appendix A: Version Naming Conventions

### Recommended Patterns

| Pattern            | Example                      | Use Case           |
| ------------------ | ---------------------------- | ------------------ |
| **Year + Type**    | "Budget 2026"                | Annual budget      |
| **Year + Quarter** | "Forecast Q1 2026"           | Quarterly forecast |
| **Scenario-based** | "Budget 2026 - Conservative" | Scenario planning  |
| **Revision**       | "Budget 2026 v2"             | Revised budget     |
| **Actual period**  | "Actuals FY2025"             | Historical actuals |

### Naming Constraints

- Maximum 100 characters
- Must be unique within fiscal year
- Case-sensitive
- No leading/trailing whitespace (trimmed automatically)

---

## Appendix B: Stale Module Cascade

When a version's underlying data changes, modules become stale and require recalculation:

```text
┌─────────────────────────────────────────────────────────────┐
│  ENROLLMENT DATA CHANGED                                    │
│        │                                                     │
│        ▼                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   REVENUE   │  │     DHG     │  │  STAFFING   │          │
│  │   (stale)   │  │   (stale)   │  │   (stale)   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                          │                                   │
│                          ▼                                   │
│                    ┌─────────────┐                           │
│                    │     PNL     │                           │
│                    │   (stale)   │                           │
│                    └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

The stale modules indicator shows which calculations need to be re-run to bring the version up to date.

---

## Document History

| Version | Date       | Author       | Changes                                                                                                                              |
| ------- | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1     | 2026-03-10 | AI Assistant | Updated to match implemented lifecycle rules, archive visibility, error codes, detail panel structure, and planning workflow context |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation                                                                                                            |

---

_End of Document_
