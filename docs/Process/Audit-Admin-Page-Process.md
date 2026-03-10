# Audit Trail Admin Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Audit Trail admin page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, security officers, new developers, and business analysts to understand and propose improvements.

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
10. [Audit Trail](#audit-trail)
11. [Error Handling](#error-handling)
12. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Page Name**        | Audit Trail                                                                                |
| **URL Route**        | `/admin/audit`                                                                             |
| **Module**           | Epic 5 — Admin & Security                                                                  |
| **Page File**        | `apps/web/src/pages/admin/audit.tsx`                                                       |
| **Primary Function** | View and filter system audit logs for compliance, troubleshooting, and security monitoring |

### What This Page Does

The Audit Trail page is the **central compliance and security monitoring interface** for the BudFin system. It allows authorized administrators to:

1. **View** all system audit logs in a chronological, paginated table
2. **Filter** audit entries by date range, user, operation type, and entity
3. **Monitor** user activity for security and compliance purposes
4. **Troubleshoot** data changes by examining before/after values
5. **Investigate** security incidents with IP address and session tracking

**Critical Business Rule**: The audit log is **append-only** — no user, including administrators, can modify or delete audit entries. This ensures compliance with PDPL (KSA Data Protection Law) and provides an immutable record of all system activities.

---

## Business Context

### Audit Logging Scope

EFIR (École Française Internationale de Riyad) operates in a regulated environment requiring comprehensive audit trails for:

| Requirement                     | Description                                                   |
| ------------------------------- | ------------------------------------------------------------- |
| **PDPL Compliance**             | KSA Personal Data Protection Law requires data access logging |
| **Financial Audit**             | Budget changes must be traceable to individual users          |
| **Security Monitoring**         | Authentication and authorization events must be recorded      |
| **Operational Troubleshooting** | Data changes must be reversible through audit history         |

### Audit Retention Policy

| Period        | Action                                                 |
| ------------- | ------------------------------------------------------ |
| **0–1 year**  | Full online access via Audit Trail page                |
| **1–7 years** | Archived (planned for future implementation)           |
| **7+ years**  | Compliance archive (planned for future implementation) |

### Audit Entry Categories

| Category               | Operations                                                  | Business Purpose               |
| ---------------------- | ----------------------------------------------------------- | ------------------------------ |
| **Authentication**     | LOGIN_SUCCESS, LOGIN_FAILURE, ACCOUNT_LOCKED                | Security monitoring            |
| **User Management**    | USER_CREATED, USER_UPDATED                                  | Access control audit           |
| **Session Management** | TOKEN_FAMILY_CREATED, TOKEN_ROTATION, SESSION_FORCE_REVOKED | Security incident response     |
| **Configuration**      | CONFIG_UPDATED                                              | System change tracking         |
| **Authorization**      | AUTHORIZATION_FAILED                                        | Permission violation detection |

---

## User Roles & Permissions

| Role            | View Audit Logs | Filter/Sort | Export Data  |
| --------------- | --------------- | ----------- | ------------ |
| **Admin**       | ✅              | ✅          | ❌ (planned) |
| **BudgetOwner** | ❌              | ❌          | ❌           |
| **Editor**      | ❌              | ❌          | ❌           |
| **Viewer**      | ❌              | ❌          | ❌           |

**Access Control Rule**: The Audit Trail page is **Admin-only**. All API endpoints enforce `requireRole('Admin')` middleware.

---

## Pre-Conditions

Before using this page, the following must be in place:

### System Requirements

1. **Audit Logging Enabled** — The audit system must be active (default in production)
2. **Database Connectivity** — PostgreSQL with `audit_entries` table populated
3. **Authentication Service** — User must be logged in with valid JWT

### User Requirements

1. **Admin Role** — User must have `role = 'Admin'` in the `users` table
2. **Active Session** — User must have a valid, non-expired access token

### Data Requirements

The `audit_entries` table must contain data. Common sources of audit entries:

| Source                | Typical Volume | Retention Impact |
| --------------------- | -------------- | ---------------- |
| User logins           | 50–100/day     | Low              |
| Failed login attempts | 10–20/day      | Low              |
| Budget data changes   | 200–500/day    | Medium           |
| Configuration changes | 5–10/day       | Low              |

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Audit Trail                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔍 Filter Controls                                                          │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────────┐ ┌─────────────┐ │
│  │ From     │ │ To       │ │ User ID │ │ Action [▼]       │ │ Entity [▼]  │ │
│  │ [date ▼] │ │ [date ▼] │ │ [___]   │ │ All              │ │ All         │ │
│  └──────────┘ └──────────┘ └─────────┘ └──────────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Control     | Type         | Options/Format      | Function                                   |
| ----------- | ------------ | ------------------- | ------------------------------------------ |
| **From**    | Date picker  | YYYY-MM-DD          | Filter entries from this date (inclusive)  |
| **To**      | Date picker  | YYYY-MM-DD          | Filter entries up to this date (inclusive) |
| **User ID** | Number input | Integer             | Filter by specific user ID                 |
| **Action**  | Dropdown     | All + 11 operations | Filter by operation type                   |
| **Entity**  | Dropdown     | All + 3 entities    | Filter by table/entity name                |

### Action/Operation Filter Options

```
All
├── LOGIN_SUCCESS
├── LOGIN_FAILURE
├── ACCOUNT_LOCKED
├── ACCOUNT_UNLOCKED
├── USER_CREATED
├── USER_UPDATED
├── SESSION_FORCE_REVOKED
├── AUTHORIZATION_FAILED
├── CONFIG_UPDATED
├── TOKEN_FAMILY_CREATED
├── TOKEN_FAMILY_REVOKED
└── TOKEN_ROTATION
```

### Entity Filter Options

```
All
├── users
├── refresh_tokens
└── system_config
```

### Audit Entries Table

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Audit Entries                                                                  [N]  │
├──────────────────────┬──────┬──────────────────────┬────────────┬──────────┬────────┤
│ Timestamp            │ User │ Action               │ Entity     │ Record   │ Details│
├──────────────────────┼──────┼──────────────────────┼────────────┼──────────┼────────┤
│ 01 Mar 2026, 10:00:00│ 2    │ [LOGIN_SUCCESS]      │ users      │ -        │ -      │
│ 01 Mar 2026, 09:45:32│ 5    │ [USER_UPDATED]       │ users      │ 5        │ {...}  │
│ 01 Mar 2026, 09:30:15│ -    │ [LOGIN_FAILURE]      │ -          │ -        │ -      │
│ ...                  │ ...  │ ...                  │ ...        │ ...      │ ...    │
└──────────────────────┴──────┴──────────────────────┴────────────┴──────────┴────────┘
```

**Column Definitions**:

| Column        | Description                                           | Format                      |
| ------------- | ----------------------------------------------------- | --------------------------- |
| **Timestamp** | When the action occurred                              | DD MMM YYYY, HH:MM:SS (AST) |
| **User**      | User ID who performed the action, or '-' if anonymous | Integer or '-'              |
| **Action**    | Operation performed                                   | Badge-styled monospace text |
| **Entity**    | Database table or entity affected                     | Table name or '-'           |
| **Record ID** | Specific record affected                              | Integer or '-'              |
| **Details**   | JSON preview of `new_values`                          | Truncated JSON string       |

### Pagination Controls

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [N] total entries              [Previous]  Page X of Y  [Next]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Element            | Description                                  |
| ------------------ | -------------------------------------------- |
| **Total count**    | "{N} total entries" — total matching entries |
| **Previous**       | Disabled when on page 1                      |
| **Page indicator** | "Page X of Y" — current page and total pages |
| **Next**           | Disabled when on last page                   |
| **Page size**      | Fixed at 50 entries per page                 |

---

## Step-by-Step Workflow

### Workflow 1: View Recent Audit Activity

**Actor**: Administrator

| Step | Action                          | UI Element       | API Call                         | Result                           |
| ---- | ------------------------------- | ---------------- | -------------------------------- | -------------------------------- |
| 1    | Log in as Admin                 | Login page       | `POST /auth/login`               | Authenticated, JWT issued        |
| 2    | Navigate to Admin → Audit Trail | Sidebar menu     | -                                | Page loads                       |
| 3    | Observe audit table             | Data grid        | `GET /audit?page=1&page_size=50` | Most recent 50 entries displayed |
| 4    | Review timestamps               | Timestamp column | -                                | Times shown in AST (UTC+3)       |
| 5    | Scroll through entries          | Table rows       | -                                | View operation details           |

**Database Query**:

```sql
SELECT * FROM audit_entries
ORDER BY created_at DESC
LIMIT 50 OFFSET 0;
```

---

### Workflow 2: Filter by Date Range

**Actor**: Administrator

| Step | Action                   | UI Element | API Call                         | Result                         |
| ---- | ------------------------ | ---------- | -------------------------------- | ------------------------------ |
| 1    | Click "From" date picker | Date input | -                                | Calendar opens                 |
| 2    | Select start date        | Calendar   | -                                | Date populated                 |
| 3    | Click "To" date picker   | Date input | -                                | Calendar opens                 |
| 4    | Select end date          | Calendar   | `GET /audit?from={iso}&to={iso}` | Entries filtered by date range |
| 5    | Observe page reset       | Pagination | -                                | Returns to page 1              |

**Filter Behavior**:

- Filters apply with 300ms debounce (automatic, no submit button)
- Both dates are inclusive: `created_at >= from AND created_at <= to`
- Dates converted to ISO 8601 format for API: `YYYY-MM-DDTHH:mm:ss.sssZ`

---

### Workflow 3: Filter by Specific User

**Actor**: Administrator

| Step | Action                    | UI Element   | API Call               | Result                       |
| ---- | ------------------------- | ------------ | ---------------------- | ---------------------------- |
| 1    | Click into User ID field  | Number input | -                      | Field focused                |
| 2    | Enter user ID (e.g., "5") | Keyboard     | -                      | Value displayed              |
| 3    | Wait 300ms                | Debounce     | `GET /audit?user_id=5` | Entries filtered to user 5   |
| 4    | Review filtered results   | Table        | -                      | Only user 5's activity shown |

**Use Case**: Investigate what actions a specific user performed, or verify compliance training completion.

---

### Workflow 4: Filter by Operation Type

**Actor**: Administrator

| Step | Action                 | UI Element   | API Call                             | Result                     |
| ---- | ---------------------- | ------------ | ------------------------------------ | -------------------------- |
| 1    | Click Action dropdown  | Select       | -                                    | Dropdown opens             |
| 2    | Select "LOGIN_FAILURE" | SelectItem   | `GET /audit?operation=LOGIN_FAILURE` | Failed logins displayed    |
| 3    | Review results         | Table        | -                                    | Security incidents visible |
| 4    | Clear filter           | Select "All" | `GET /audit`                         | All entries restored       |

**Use Case**: Security monitoring — detect brute force attacks or unauthorized access attempts.

---

### Workflow 5: Investigate a Specific Record Change

**Actor**: Administrator

| Step | Action                             | UI Element      | API Call                            | Result                       |
| ---- | ---------------------------------- | --------------- | ----------------------------------- | ---------------------------- |
| 1    | Filter by operation "USER_UPDATED" | Action dropdown | `GET /audit?operation=USER_UPDATED` | User changes shown           |
| 2    | Locate specific entry              | Table row       | -                                   | Row identified               |
| 3    | Review Details column              | JSON preview    | -                                   | `new_values` displayed       |
| 4    | Hover/expand for full JSON         | Details cell    | -                                   | Complete change data visible |

**JSON Preview Format**:

```json
{ "role": "Editor", "is_active": true, "department_id": 3 }
```

**Note**: Full `old_values` and `new_values` are available in the API response; the UI shows a truncated preview.

---

### Workflow 6: Paginate Through Large Result Sets

**Actor**: Administrator

| Step | Action                                 | UI Element | API Call                      | Result                        |
| ---- | -------------------------------------- | ---------- | ----------------------------- | ----------------------------- |
| 1    | Apply filters that return many results | Filters    | `GET /audit?{filters}`        | Page 1 displayed (50 entries) |
| 2    | Click "Next" button                    | Pagination | `GET /audit?{filters}&page=2` | Page 2 loaded                 |
| 3    | Continue to page 3, 4, etc.            | Pagination | -                             | Navigate through history      |
| 4    | Click "Previous" to go back            | Pagination | -                             | Return to prior page          |

**Pagination Logic**:

- Total pages = `ceil(total / page_size)`
- "Previous" disabled on page 1
- "Next" disabled on last page
- Page size is fixed at 50 entries

---

## Data Models & Database Schema

### Core Table: audit_entries

Stores all audit log entries in an append-only fashion.

```sql
Table: audit_entries
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ user_id           │ INTEGER FK      │ → users.id (nullable for anonymous)        │
│ operation         │ VARCHAR(50)     │ Action performed (e.g., LOGIN_SUCCESS)     │
│ table_name        │ VARCHAR(50)     │ Affected table/entity (nullable)           │
│ record_id         │ INTEGER         │ Affected record ID (nullable)              │
│ old_values        │ JSONB           │ Previous values (for updates)              │
│ new_values        │ JSONB           │ New values (for creates/updates)           │
│ ip_address        │ VARCHAR(45)     │ IPv4 or IPv6 address                       │
│ user_email        │ VARCHAR(255)    │ User's email at time of action             │
│ session_id        │ VARCHAR(255)    │ Session identifier                         │
│ audit_note        │ VARCHAR(255)    │ Optional annotation                        │
│ created_at        │ TIMESTAMPTZ     │ Action timestamp (AST)                     │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Indexes:
  - created_at DESC (for pagination)
  - user_id (for user filtering)
  - operation (for operation filtering)
  - table_name (for entity filtering)
```

### Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            audit_entries                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  user_id ───────────────► users.id (optional, nullable)                     │
│                                                                             │
│  References:                                                                │
│  - user_id may reference users.id but is not enforced by FK                 │
│  - record_id references table_name.id dynamically                           │
│                                                                             │
│  No cascade delete — audit entries persist even if user deleted             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Operation Types Reference

| Operation             | Category       | When Logged                            |
| --------------------- | -------------- | -------------------------------------- |
| LOGIN_SUCCESS         | Authentication | After successful credential validation |
| LOGIN_FAILURE         | Authentication | After failed credential validation     |
| ACCOUNT_LOCKED        | Security       | After max failed attempts reached      |
| ACCOUNT_UNLOCKED      | Security       | After admin/manual unlock              |
| USER_CREATED          | User Mgmt      | After new user record inserted         |
| USER_UPDATED          | User Mgmt      | After user record modified             |
| SESSION_FORCE_REVOKED | Security       | After admin revokes session            |
| AUTHORIZATION_FAILED  | Security       | After permission check fails           |
| CONFIG_UPDATED        | Config         | After system_config changed            |
| TOKEN_FAMILY_CREATED  | Session        | On new refresh token family            |
| TOKEN_FAMILY_REVOKED  | Session        | On family revocation (theft detection) |
| TOKEN_ROTATION        | Session        | On refresh token rotation              |
| ALL_SESSIONS_REVOKED  | Session        | On global logout                       |

---

## API Endpoints

### Audit Log Query API

| Method | Endpoint | Description                       | Auth | Role  |
| ------ | -------- | --------------------------------- | ---- | ----- |
| GET    | `/audit` | List audit entries with filtering | JWT  | Admin |

**Query Parameters**:

| Parameter    | Type     | Default | Max | Description              |
| ------------ | -------- | ------- | --- | ------------------------ |
| `page`       | integer  | 1       | -   | Page number (1-based)    |
| `page_size`  | integer  | 50      | 200 | Entries per page         |
| `from`       | datetime | -       | -   | Start date (ISO 8601)    |
| `to`         | datetime | -       | -   | End date (ISO 8601)      |
| `user_id`    | integer  | -       | -   | Filter by user ID        |
| `operation`  | string   | -       | -   | Filter by operation type |
| `table_name` | string   | -       | -   | Filter by entity/table   |

**Example Request**:

```http
GET /api/v1/audit?from=2026-03-01T00:00:00Z&to=2026-03-10T00:00:00Z&operation=LOGIN_FAILURE&page=1&page_size=50
Authorization: Bearer {access_token}
```

**Example Response**:

```json
{
    "entries": [
        {
            "id": 1523,
            "user_id": null,
            "operation": "LOGIN_FAILURE",
            "table_name": null,
            "record_id": null,
            "old_values": null,
            "new_values": { "email": "attacker@example.com", "reason": "invalid_credentials" },
            "ip_address": "192.168.1.100",
            "created_at": "2026-03-09T14:30:00.000Z"
        },
        {
            "id": 1522,
            "user_id": 5,
            "operation": "USER_UPDATED",
            "table_name": "users",
            "record_id": 5,
            "old_values": { "role": "Viewer" },
            "new_values": { "role": "Editor" },
            "ip_address": "10.0.0.50",
            "created_at": "2026-03-09T10:15:00.000Z"
        }
    ],
    "total": 245,
    "page": 1,
    "page_size": 50
}
```

---

## TypeScript Types

### Core Types (`apps/web/src/pages/admin/audit.tsx`)

```typescript
// Audit entry as returned by API
interface AuditEntry {
    id: number;
    user_id: number | null; // null for anonymous actions
    operation: string; // e.g., 'LOGIN_SUCCESS'
    table_name: string | null; // affected entity
    record_id: number | null; // affected record
    old_values: unknown; // previous state (JSON)
    new_values: unknown; // new state (JSON)
    ip_address: string | null; // client IP
    created_at: string; // ISO 8601 timestamp
}

// API response structure
interface AuditResponse {
    entries: AuditEntry[];
    total: number; // total matching entries
    page: number; // current page
    page_size: number; // entries per page
}
```

### Filter Types (`apps/web/src/components/admin/audit-filters.tsx`)

```typescript
// Filter form values
interface AuditFilterValues {
    from?: string; // date string (YYYY-MM-DD)
    to?: string; // date string (YYYY-MM-DD)
    user_id?: string; // user ID as string
    operation?: string; // selected operation
    table_name?: string; // selected entity
}

// Available operations for dropdown
const OPERATIONS = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
    'USER_CREATED',
    'USER_UPDATED',
    'SESSION_FORCE_REVOKED',
    'AUTHORIZATION_FAILED',
    'CONFIG_UPDATED',
    'TOKEN_FAMILY_CREATED',
    'TOKEN_FAMILY_REVOKED',
    'TOKEN_ROTATION',
    'ALL_SESSIONS_REVOKED',
];

// Available entities for dropdown
const ENTITIES = ['users', 'refresh_tokens', 'system_config'];
```

---

## Audit Trail

### What Gets Audited

The Audit Trail page itself is a **read-only consumer** of audit data. The following system operations generate audit entries:

| System Component   | Operations                                                  | Audit Table   |
| ------------------ | ----------------------------------------------------------- | ------------- |
| Authentication     | LOGIN_SUCCESS, LOGIN_FAILURE, ACCOUNT_LOCKED                | audit_entries |
| User Management    | USER_CREATED, USER_UPDATED                                  | audit_entries |
| Session Management | TOKEN_FAMILY_CREATED, TOKEN_ROTATION, SESSION_FORCE_REVOKED | audit_entries |
| Authorization      | AUTHORIZATION_FAILED                                        | audit_entries |
| System Config      | CONFIG_UPDATED                                              | audit_entries |
| Enrollment         | HEADCOUNT_UPDATED, COHORT_PARAMS_UPDATED                    | audit_entries |
| Budget Versions    | VERSION_CREATED, VERSION_PUBLISHED, VERSION_LOCKED          | audit_entries |

### Viewing Audit Entries

| Action           | Visible to Admin | Immutable                |
| ---------------- | ---------------- | ------------------------ |
| View audit list  | ✅               | N/A (read-only)          |
| Filter/search    | ✅               | N/A                      |
| Export (planned) | ✅               | N/A                      |
| Delete entry     | ❌               | ✅ entries are permanent |
| Modify entry     | ❌               | ✅ entries are permanent |

### Security Considerations

1. **No User Modification**: Even administrators cannot alter audit entries
2. **Database-level Protection**: `UPDATE` and `DELETE` revoked from application user
3. **Append-only Design**: New entries only; no modification history
4. **IP Tracking**: Source IP captured for security investigations
5. **Session Correlation**: `session_id` enables tracing user sessions

---

## Error Handling

### Common Error Codes

| Code               | HTTP Status | Description                     | User Action                    |
| ------------------ | ----------- | ------------------------------- | ------------------------------ |
| UNAUTHORIZED       | 401         | Access token expired or invalid | Re-login to obtain fresh token |
| FORBIDDEN          | 403         | User is not an Admin            | Contact system administrator   |
| INVALID_DATE_RANGE | 400         | From date is after To date      | Adjust date range              |
| INVALID_PAGE_SIZE  | 400         | Page size exceeds maximum (200) | Use page_size ≤ 200            |
| DATABASE_ERROR     | 500         | Database connection failure     | Retry or contact support       |

### UI Error States

| State                | Display                    | Recovery                             |
| -------------------- | -------------------------- | ------------------------------------ |
| Loading              | Skeleton table rows        | Wait for response                    |
| Empty (no filters)   | "No audit entries found"   | Normal — system may have no activity |
| Empty (with filters) | "No entries match filters" | Clear filters to see all entries     |
| API Error            | Error message banner       | Retry or refresh page                |
| Forbidden            | Redirect to 403 page       | Log in as Admin                      |

---

## Improvements Required

This section documents known limitations, technical debt, and proposed enhancements for the Audit Trail module.

### High Priority

| ID      | Issue                           | Impact                                                         | Proposed Solution                                          |
| ------- | ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| AUD-001 | **No export functionality**     | Cannot extract audit data for external analysis                | Add "Export to CSV/Excel" button with date range selection |
| AUD-002 | **Limited operation types**     | Business operations (HEADCOUNT_UPDATED, etc.) not in dropdown  | Add comprehensive operation list from all modules          |
| AUD-003 | **No entity expansion**         | Only 3 entities in dropdown; missing enrollment, revenue, etc. | Dynamically populate entity list from database             |
| AUD-004 | **JSON details not expandable** | Cannot view full old_values/new_values                         | Add modal/expand for full JSON detail view                 |

### Medium Priority

| ID      | Issue                          | Impact                                          | Proposed Solution                              |
| ------- | ------------------------------ | ----------------------------------------------- | ---------------------------------------------- |
| AUD-005 | **No real-time updates**       | Must refresh to see new entries                 | Add WebSocket or polling for live audit stream |
| AUD-006 | **Limited date presets**       | No quick filters (Today, This Week, This Month) | Add preset date range buttons                  |
| AUD-007 | **User ID not human-readable** | Must know user IDs; no name search              | Add user email/name autocomplete search        |
| AUD-008 | **No aggregation views**       | Cannot see statistics (logins per day, etc.)    | Add dashboard charts for audit analytics       |

### Low Priority / Technical Debt

| ID      | Issue                           | Impact                                 | Proposed Solution                              |
| ------- | ------------------------------- | -------------------------------------- | ---------------------------------------------- |
| AUD-009 | **No data retention UI**        | Cannot configure retention policies    | Add admin settings for retention configuration |
| AUD-010 | **Hardcoded filter options**    | OPERATIONS and ENTITIES arrays in code | Move to API-driven configuration               |
| AUD-011 | **Client-side pagination only** | Large datasets may impact performance  | Consider server-side virtualization            |
| AUD-012 | **No saved filter presets**     | Must reconfigure filters each visit    | Add "Save Filter" functionality                |

### Feature Requests

| ID      | Feature                          | Business Value                                               | Complexity |
| ------- | -------------------------------- | ------------------------------------------------------------ | ---------- |
| AUD-F01 | **Audit alert rules**            | Notify admins of suspicious patterns (e.g., 5 failed logins) | Medium     |
| AUD-F02 | **Data retention automation**    | Auto-archive entries older than 1 year                       | Low        |
| AUD-F03 | **Audit integrity verification** | Cryptographic verification of audit chain                    | High       |
| AUD-F04 | **Geolocation tracking**         | Show country/city for IP addresses                           | Medium     |
| AUD-F05 | **Audit comparison**             | Compare two time periods for activity trends                 | Medium     |

---

## Appendix A: Timezone Handling

All timestamps are stored and displayed in **Arabia Standard Time (AST, UTC+3)**.

### Storage

- Database stores timestamps in UTC (`TIMESTAMPTZ`)
- API returns ISO 8601 format with 'Z' suffix (UTC)

### Display

- Frontend converts UTC to AST using `Intl.DateTimeFormat` with `timeZone: 'Asia/Riyadh'`
- Example: `2026-03-09T14:30:00.000Z` displays as `09 Mar 2026, 17:30:00`

### Filter Input

- Date pickers accept local dates
- Frontend converts to UTC ISO strings for API

---

## Appendix B: Audit Entry Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Audit Entry Lifecycle                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. GENERATION                                                               │
│     ├── User performs action (login, update, etc.)                          │
│     ├── Application creates audit entry via Prisma                         │
│     └── Entry inserted into audit_entries table                            │
│                                                                              │
│  2. STORAGE (Immediate)                                                      │
│     ├── Entry persisted to PostgreSQL                                       │
│     ├── Immutable — no updates permitted                                    │
│     └── Indexed for query performance                                       │
│                                                                              │
│  3. QUERY (On-demand)                                                        │
│     ├── Admin visits Audit Trail page                                       │
│     ├── API queries with filters                                            │
│     └── Results paginated and returned                                      │
│                                                                              │
│  4. DISPLAY                                                                  │
│     ├── Frontend formats timestamps (UTC → AST)                             │
│     ├── JSON values truncated for preview                                   │
│     └── Rendered in table with badges/styling                               │
│                                                                              │
│  5. RETENTION (Future)                                                       │
│     ├── Online: 0–1 year (queryable in UI)                                  │
│     ├── Archive: 1–7 years (cold storage, queryable on request)             │
│     └── Compliance: 7+ years (offline backup)                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
