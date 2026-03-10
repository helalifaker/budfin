# Fiscal Periods Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Fiscal Periods management page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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
10. [Business Rules & Validation](#business-rules--validation)
11. [Audit Trail](#audit-trail)
12. [Error Handling](#error-handling)
13. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Page Name**        | Fiscal Period Management                                                             |
| **URL Route**        | `/management/fiscal-periods`                                                         |
| **Module**           | Epic 10 — Variance Analysis & Reporting                                              |
| **Page File**        | `apps/web/src/pages/management/fiscal-periods.tsx`                                   |
| **Primary Function** | Manage fiscal period locking and assign Locked Actual versions for variance analysis |

### What This Page Does

The Fiscal Periods page is the **control center** for closing fiscal periods and importing actuals data. It allows authorized users to:

1. View all 12 fiscal periods (January–December) for a selected fiscal year
2. Monitor period status (Draft or Locked)
3. Assign **Locked Actual versions** to periods for variance analysis
4. Lock periods to freeze actuals data for reporting
5. Track who locked each period and when

**Critical Business Rule**: Once a fiscal period is locked, it cannot be modified. Locked periods serve as the immutable actuals baseline for comparing against budget and forecast versions in variance reports.

---

## Business Context

### Fiscal Year Structure

EFIR (École Française Internationale de Riyad) operates on a calendar-year fiscal cycle:

| Period | Months             | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| **Q1** | January – March    | First quarter                                    |
| **Q2** | April – June       | Second quarter (includes AY1 end)                |
| **Q3** | July – September   | Third quarter (includes Summer break, AY2 start) |
| **Q4** | October – December | Fourth quarter                                   |

### Budget Version Types

| Type         | Purpose                 | Can Be Assigned to Period |
| ------------ | ----------------------- | ------------------------- |
| **Budget**   | Annual budget planning  | ❌ No                     |
| **Forecast** | Mid-year projections    | ❌ No                     |
| **Actual**   | Historical actuals data | ✅ Yes (must be Locked)   |

### Variance Analysis Context

Fiscal period locking enables the variance analysis workflow:

```
┌─────────────────────────────────────────────────────────────────┐
│  Variance Analysis: Budget vs Actuals                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Budget Version (Draft/Published)                              │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────┐    Compare    ┌─────────────┐                │
│   │   Budget    │ ◄──────────► │   Actuals   │                │
│   │   Values    │   Variance   │  (Locked)   │                │
│   └─────────────┘              └─────────────┘                │
│                                        ▲                       │
│                                        │                       │
│                              Locked Actual Version              │
│                              assigned to Fiscal Period          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Roles & Permissions

| Role            | View Periods | Lock Periods | Assign Actual Version |
| --------------- | ------------ | ------------ | --------------------- |
| **Admin**       | ✅           | ✅           | ✅                    |
| **BudgetOwner** | ✅           | ✅           | ✅                    |
| **Editor**      | ✅           | ❌           | ❌                    |
| **Viewer**      | ✅           | ❌           | ❌                    |

**Lock Permission Rule**: Only users with `Admin` or `BudgetOwner` role can lock fiscal periods and assign actual versions. The lock action button is hidden for other roles.

---

## Pre-Conditions

Before using this page, the following must be configured:

### Required: Locked Actual Version

1. **Actual version** must be created via the Versions management page
2. The version must have **type = 'Actual'**
3. The version must be in **'Locked'** status
4. The version should contain imported actuals data for the relevant period

### Optional: Fiscal Period Auto-Seeding

- When a fiscal year is accessed for the first time, the system automatically creates 12 period records (January–December) with **Draft** status
- No manual setup is required for new fiscal years

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Fiscal Period Management                                     [FY 2025 ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Fiscal year selector dropdown (current year ± 2 years)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Control         | Values                                            | Function                                |
| --------------- | ------------------------------------------------- | --------------------------------------- |
| **Fiscal Year** | FY {year-2}, {year-1}, {year}, {year+1}, {year+2} | Selects which year's periods to display |

### Periods Table

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Periods Table                                                                                │
├──────────┬──────────┬───────────────────┬───────────────────┬───────────────────┬───────────┤
│ Month    │ Status   │ Actual Version    │ Locked At         │ Locked By         │ Actions   │
├──────────┼──────────┼───────────────────┼───────────────────┼───────────────────┼───────────┤
│ January  │ Draft    │ —                 │ —                 │ —                 │ [Lock ▼]  │
│ February │ Draft    │ —                 │ —                 │ —                 │ [Lock ▼]  │
│ March    │ Locked   │ Actuals Q1 (#15)  │ Mar 15, 2025      │ User #3           │ —         │
│ April    │ Draft    │ —                 │ —                 │ —                 │ [Lock ▼]  │
│ ...      │ ...      │ ...               │ ...               │ ...               │ ...       │
└──────────┴──────────┴───────────────────┴───────────────────┴───────────────────┴───────────┘
```

### Table Columns

| Column             | Description                       | Display                 |
| ------------------ | --------------------------------- | ----------------------- |
| **Month**          | Calendar month (January–December) | Full month name         |
| **Status**         | Period state (Draft/Locked)       | Badge with color coding |
| **Actual Version** | Linked Locked Actual version      | Version name + ID       |
| **Locked At**      | Timestamp when period was locked  | Formatted date/time     |
| **Locked By**      | User who locked the period        | User ID reference       |
| **Actions**        | Lock controls (role-restricted)   | Dropdown + Lock button  |

### Status Badge Colors

| Status     | Color     | Description                             |
| ---------- | --------- | --------------------------------------- |
| **Draft**  | Blue/Gray | Period is editable, no actuals assigned |
| **Locked** | Green     | Period is frozen with actuals data      |

### Lock Action Component (Admin/BudgetOwner only)

```
┌─────────────────────────────────────────────────────────────────┐
│ Actions Cell (for Draft periods)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Select version... ▼]  [Lock Period]                           │
│   │                      │                                      │
│   │                      └── Click to initiate lock              │
│   └── Dropdown of available Locked Actual versions              │
│                                                                 │
│  After first click:                                             │
│  [Select version... ▼]  [Confirm Lock]  [Cancel]                │
│                         (destructive style)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Workflow

### Workflow 1: View Fiscal Periods

**Actor**: Any authenticated user

| Step | Action                           | UI Element                                   | API Call                           | Result                      |
| ---- | -------------------------------- | -------------------------------------------- | ---------------------------------- | --------------------------- |
| 1    | Navigate to Fiscal Periods page  | Sidebar menu → Management → Fiscal Periods   | -                                  | Page loads                  |
| 2    | Select fiscal year from dropdown | Fiscal Year selector                         | `GET /fiscal-periods/{fiscalYear}` | 12 periods displayed        |
| 3    | Review period statuses           | Status column                                | -                                  | Draft/Locked badges visible |
| 4    | Review locked period details     | Actual Version, Locked At, Locked By columns | -                                  | Assignment info displayed   |

**Database Query**:

```sql
SELECT * FROM fiscal_periods
WHERE fiscal_year = {year}
ORDER BY month ASC;
```

**Auto-Seeding Behavior**:

- If no periods exist for the selected fiscal year, the system automatically creates 12 records
- All new periods start with `status = 'Draft'` and no actual version assigned

---

### Workflow 2: Lock a Fiscal Period

**Actor**: Admin or BudgetOwner

| Step | Action                             | UI Element                   | API Call                                  | Result                                               |
| ---- | ---------------------------------- | ---------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| 1    | Locate Draft period to lock        | Table row                    | -                                         | Period identified                                    |
| 2    | Click "Select version..." dropdown | Version selector             | `GET /versions?status=Locked&type=Actual` | Locked Actual versions loaded                        |
| 3    | Select Actual version from list    | Dropdown option              | -                                         | Version selected (ID stored)                         |
| 4    | Click "Lock Period" button         | Lock button                  | -                                         | Button changes to "Confirm Lock" (destructive style) |
| 5    | Review confirmation state          | UI change                    | -                                         | Cancel button appears                                |
| 6    | Click "Confirm Lock" button        | Confirm button               | `PATCH /fiscal-periods/{fy}/{month}/lock` | Period locked successfully                           |
| 7    | Observe status update              | Status badge                 | -                                         | Changes from Draft to Locked                         |
| 8    | View lock metadata                 | Locked At, Locked By columns | -                                         | Timestamp and user ID displayed                      |

**Database Changes**:

```sql
UPDATE fiscal_periods
SET status = 'Locked',
    actual_version_id = {version_id},
    locked_at = NOW(),
    locked_by_id = {user_id},
    updated_by_id = {user_id}
WHERE fiscal_year = {year} AND month = {month};
```

**Lock Request Body**:

```json
{
    "actual_version_id": 15
}
```

**Lock Response**:

```json
{
    "id": 24,
    "fiscalYear": 2025,
    "month": 3,
    "status": "Locked",
    "actualVersionId": 15,
    "lockedAt": "2025-03-15T10:30:00Z",
    "lockedById": 3,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-03-15T10:30:00Z"
}
```

---

### Workflow 3: Cancel Lock Operation

**Actor**: Admin or BudgetOwner

| Step | Action                                   | UI Element    | Result                                  |
| ---- | ---------------------------------------- | ------------- | --------------------------------------- |
| 1    | Initiate lock workflow (steps 1-4 above) | Lock controls | Confirm state displayed                 |
| 2    | Click "Cancel" button                    | Cancel button | Lock operation aborted                  |
| 3    | Observe UI reset                         | Button state  | Returns to "Lock Period" (normal style) |

---

## Data Models & Database Schema

### Core Tables

#### 1. fiscal_periods

Stores fiscal period status and actual version assignments.

```sql
Table: fiscal_periods
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ fiscal_year       │ SMALLINT        │ Fiscal year (e.g., 2025)                   │
│ month             │ SMALLINT        │ Month number (1–12)                        │
│ status            │ VARCHAR(10)     │ 'Draft' or 'Locked'                        │
│ actual_version_id │ INTEGER FK      │ → budget_versions.id (nullable)            │
│ locked_at         │ TIMESTAMPTZ     │ When period was locked (nullable)          │
│ locked_by_id      │ INTEGER FK      │ → users.id who locked (nullable)           │
│ updated_by_id     │ INTEGER FK      │ → users.id who last updated (nullable)     │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: (fiscal_year, month) — map: "uq_fiscal_period"
Indexes: fiscal_year, actual_version_id, locked_by_id, updated_by_id
```

**Relationships**:

- `actual_version_id` → `budget_versions.id` (onDelete: SetNull)
- `locked_by_id` → `users.id` (onDelete: SetNull, relation: "FiscalPeriodLocker")
- `updated_by_id` → `users.id` (onDelete: SetNull, relation: "FiscalPeriodUpdater")

#### 2. budget_versions (Reference)

Reference table for version data.

```sql
Table: budget_versions
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ fiscal_year       │ INTEGER         │ Associated fiscal year                     │
│ name              │ VARCHAR(100)    │ Version display name                       │
│ type              │ VARCHAR(20)     │ 'Budget', 'Forecast', or 'Actual'          │
│ status            │ VARCHAR(20)     │ 'Draft', 'Published', 'Locked', 'Archived' │
│ description       │ TEXT            │ Optional description                       │
│ ...               │ ...             │ ...                                        │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

#### 3. audit_entries (Audit Trail)

Tracks all fiscal period operations.

```sql
Table: audit_entries
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ user_id           │ INTEGER FK      │ → users.id                                 │
│ user_email        │ VARCHAR(255)    │ User email at time of action               │
│ operation         │ VARCHAR(50)     │ Operation type (e.g., 'FISCAL_PERIOD_LOCKED')│
│ table_name        │ VARCHAR(50)     │ Target table                               │
│ record_id         │ INTEGER         │ Target record ID                           │
│ ip_address        │ VARCHAR(45)     │ Client IP address                          │
│ old_values        │ JSONB           │ Previous values (for updates)              │
│ new_values        │ JSONB           │ New values                                 │
│ created_at        │ TIMESTAMPTZ     │ Timestamp of operation                     │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

---

## API Endpoints

### Fiscal Period APIs

| Method | Endpoint                                    | Description                       | Auth | Role               |
| ------ | ------------------------------------------- | --------------------------------- | ---- | ------------------ |
| GET    | `/fiscal-periods/{fiscalYear}`              | List all periods for a year       | JWT  | Any                |
| PATCH  | `/fiscal-periods/{fiscalYear}/{month}/lock` | Lock a period with actual version | JWT  | Admin, BudgetOwner |

**GET Response**:

```json
[
    {
        "id": 22,
        "fiscalYear": 2025,
        "month": 1,
        "status": "Draft",
        "actualVersionId": null,
        "lockedAt": null,
        "lockedById": null,
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-01-01T00:00:00Z"
    },
    {
        "id": 24,
        "fiscalYear": 2025,
        "month": 3,
        "status": "Locked",
        "actualVersionId": 15,
        "lockedAt": "2025-03-15T10:30:00Z",
        "lockedById": 3,
        "createdAt": "2025-01-01T00:00:00Z",
        "updatedAt": "2025-03-15T10:30:00Z"
    }
]
```

**PATCH Request Body**:

```json
{
    "actual_version_id": 15
}
```

**PATCH Response** (success - 200 OK):

```json
{
    "id": 24,
    "fiscalYear": 2025,
    "month": 3,
    "status": "Locked",
    "actualVersionId": 15,
    "lockedAt": "2025-03-15T10:30:00Z",
    "lockedById": 3,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-03-15T10:30:00Z"
}
```

### Supporting APIs

| Method | Endpoint                                                | Description                   | Auth | Role |
| ------ | ------------------------------------------------------- | ----------------------------- | ---- | ---- |
| GET    | `/versions?fiscalYear={year}&status=Locked&type=Actual` | List eligible Actual versions | JWT  | Any  |

---

## TypeScript Types

### Fiscal Period Types (`apps/web/src/hooks/use-fiscal-periods.ts`)

```typescript
// Fiscal period entity
export interface FiscalPeriod {
    id: number;
    fiscalYear: number;
    month: number; // 1–12
    status: string; // 'Draft' | 'Locked'
    actualVersionId: number | null;
    lockedAt: string | null; // ISO timestamp
    lockedById: number | null;
    createdAt: string;
    updatedAt: string;
}

// Lock request parameters
interface LockParams {
    fiscalYear: number;
    month: number;
    actual_version_id: number;
}
```

### Budget Version Types (`apps/web/src/hooks/use-versions.ts`)

```typescript
// Budget version entity (relevant fields)
export interface BudgetVersion {
    id: number;
    fiscalYear: number;
    name: string;
    type: 'Budget' | 'Forecast' | 'Actual';
    status: 'Draft' | 'Published' | 'Locked' | 'Archived';
    description: string | null;
    // ... other fields
}
```

---

## Business Rules & Validation

### Lock Validation Rules

| Rule                     | Error Code               | HTTP Status | Description                                       |
| ------------------------ | ------------------------ | ----------- | ------------------------------------------------- |
| **Already Locked**       | `PERIOD_ALREADY_LOCKED`  | 409         | Period is already in Locked status                |
| **Version Not Found**    | `VERSION_NOT_FOUND`      | 404         | Referenced actual_version_id does not exist       |
| **Invalid Version Type** | `INVALID_ACTUAL_VERSION` | 422         | Version must be type='Actual' AND status='Locked' |
| **Unauthorized**         | `FORBIDDEN`              | 403         | User lacks Admin or BudgetOwner role              |

### Validation Logic (Backend)

```typescript
// 1. Check period is not already locked
if (existingPeriod.status === 'Locked') {
    throw { code: 'PERIOD_ALREADY_LOCKED', status: 409 };
}

// 2. Verify version exists
const version = await prisma.budgetVersion.findUnique({
    where: { id: actual_version_id },
});
if (!version) {
    throw { code: 'VERSION_NOT_FOUND', status: 404 };
}

// 3. Verify version is Locked Actual
if (version.type !== 'Actual' || version.status !== 'Locked') {
    throw { code: 'INVALID_ACTUAL_VERSION', status: 422 };
}
```

### Version Eligibility Criteria

For a version to appear in the lock dropdown:

- `type` must be **'Actual'**
- `status` must be **'Locked'**
- `fiscalYear` should match the period's fiscal year (recommended)

---

## Audit Trail

### Operations Logged

| Operation              | Table          | Data Captured                      |
| ---------------------- | -------------- | ---------------------------------- |
| `FISCAL_PERIOD_LOCKED` | fiscal_periods | fiscalYear, month, actualVersionId |

### Audit Entry Example

```json
{
    "userId": 3,
    "userEmail": "admin@efir.edu",
    "operation": "FISCAL_PERIOD_LOCKED",
    "tableName": "fiscal_periods",
    "recordId": 24,
    "ipAddress": "192.168.1.100",
    "oldValues": null,
    "newValues": {
        "fiscalYear": 2025,
        "month": 3,
        "actualVersionId": 15
    },
    "createdAt": "2025-03-15T10:30:00Z"
}
```

---

## Error Handling

### Common Error Codes

| Code                     | HTTP Status | Description                        | User Action                                          |
| ------------------------ | ----------- | ---------------------------------- | ---------------------------------------------------- |
| `PERIOD_ALREADY_LOCKED`  | 409         | Period is already locked           | Select a different period or contact admin to unlock |
| `VERSION_NOT_FOUND`      | 404         | Selected version does not exist    | Refresh page and select again                        |
| `INVALID_ACTUAL_VERSION` | 422         | Version must be Locked Actual type | Select a valid Locked Actual version                 |
| `UNAUTHORIZED`           | 401         | User not authenticated             | Log in                                               |
| `FORBIDDEN`              | 403         | User lacks required role           | Contact administrator for access                     |

### Frontend Error Handling

| Scenario              | Behavior                                |
| --------------------- | --------------------------------------- |
| API error on lock     | Toast error message displayed           |
| Network failure       | Error toast with retry option           |
| Version fetch fails   | Empty dropdown with error state         |
| No versions available | Dropdown disabled with placeholder text |

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Fiscal Periods module.

### High Priority

| ID     | Issue                       | Impact                                             | Proposed Solution                                 |
| ------ | --------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| FP-001 | **No unlock functionality** | Locked periods cannot be corrected if errors found | Add unlock capability for Admins with audit trail |
| FP-002 | **User ID display only**    | Locked By shows "User #3" instead of name          | Join with users table to display email/name       |
| FP-003 | **No bulk lock**            | Must lock periods one-by-one                       | Add multi-select with bulk lock action            |
| FP-004 | **No period notes**         | Cannot document why a period was locked            | Add notes/comment field to lock operation         |

### Medium Priority

| ID     | Issue                         | Impact                                               | Proposed Solution                           |
| ------ | ----------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| FP-005 | **No fiscal year validation** | Can lock period with version from different year     | Add fiscal year match validation            |
| FP-006 | **Limited version filtering** | Dropdown shows all Locked Actuals, not just relevant | Filter by fiscal year and date range        |
| FP-007 | **No lock preview**           | Cannot see what data will be locked                  | Show version summary before confirming lock |
| FP-008 | **No notification on lock**   | Other users unaware when periods are locked          | Add in-app notifications or email alerts    |

### Low Priority / Technical Debt

| ID     | Issue                         | Impact                         | Proposed Solution                   |
| ------ | ----------------------------- | ------------------------------ | ----------------------------------- |
| FP-009 | **Hardcoded month names**     | English only, no i18n support  | Use date-fns locale for month names |
| FP-010 | **No keyboard navigation**    | Must use mouse for all actions | Add Tab/Enter keyboard shortcuts    |
| FP-011 | **Missing integration tests** | Lock workflow not fully tested | Add E2E tests for full lock flow    |
| FP-012 | **No period history view**    | Cannot see lock/unlock history | Add history panel or audit view     |

### Feature Requests

| ID     | Feature                   | Business Value                                    | Complexity |
| ------ | ------------------------- | ------------------------------------------------- | ---------- |
| FP-F01 | **Quarterly lock groups** | Lock all months in a quarter at once              | Low        |
| FP-F02 | **Lock scheduling**       | Schedule automatic locks at period end            | Medium     |
| FP-F03 | **Variance report link**  | Direct link to variance report from locked period | Low        |
| FP-F04 | **Period comparison**     | Compare actuals across multiple periods           | Medium     |
| FP-F05 | **Export lock schedule**  | Export fiscal calendar with lock dates            | Low        |

---

## Appendix A: Month Mapping

```
Month Number → Month Name
─────────────────────────
1  → January
2  → February
3  → March
4  → April
5  → May
6  → June
7  → July
8  → August
9  → September
10 → October
11 → November
12 → December
```

---

## Appendix B: Status Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Fiscal Period Status Lifecycle                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐        Lock (with Actual Version)             │
│   │  Draft  │ ─────────────────────────────────► ┌─────────┐│
│   │  (12)   │                                    │ Locked  ││
│   │         │ ◄───────────────────────────────── │  (0-12) ││
│   └─────────┘        Unlock (future feature)     └─────────┘│
│        ▲                                                    │
│        │                                                    │
│   Auto-created                                              │
│   on first GET                                              │
│   for new year                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
