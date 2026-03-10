# System Settings Admin Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the System Settings administration page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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
10. [Configuration Reference](#configuration-reference)
11. [Audit Trail](#audit-trail)
12. [Error Handling](#error-handling)
13. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Page Name**        | System Settings                                                                                                            |
| **URL Route**        | `/admin/settings`                                                                                                          |
| **Module**           | Admin — System Configuration                                                                                               |
| **Page File**        | `apps/web/src/pages/admin/settings.tsx`                                                                                    |
| **Primary Function** | Configure system-wide settings and parameters that control application behavior, security policies, and session management |

### What This Page Does

The System Settings page provides a **centralized configuration interface** for administrators to manage application-wide parameters. It allows users to:

1. Configure **session management** settings (max concurrent sessions, timeout duration)
2. Set **account security** policies (failed login lockout threshold and duration)
3. Define **application behavior** (fiscal year configuration, autosave intervals)
4. View **change tracking** with visual indicators for modified values
5. Save changes in **bulk** with validation and error feedback

**Critical Business Rule**: Changes to system configuration take effect immediately upon save and impact all users of the system. Session and security settings particularly affect the authentication flow and user experience.

---

## Business Context

### Configuration Categories

| Category        | Purpose                        | Settings                            |
| --------------- | ------------------------------ | ----------------------------------- |
| **Session**     | Control user session lifecycle | Max sessions, timeout duration      |
| **Security**    | Account protection policies    | Lockout threshold, lockout duration |
| **Application** | Core application behavior      | Fiscal year, autosave interval      |

### Session Management

Session settings control how users interact with the system:

| Setting                   | Description                                    | Impact                                                                  |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| **Max Sessions per User** | Maximum concurrent active sessions per account | Prevents session sharing; forces logout of oldest session when exceeded |
| **Session Timeout**       | Minutes of inactivity before automatic logout  | Balances security with user convenience                                 |

### Security Policies

Account lockout settings protect against brute-force attacks:

| Setting               | Description                                  | Typical Value |
| --------------------- | -------------------------------------------- | ------------- |
| **Lockout Threshold** | Failed login attempts before account lockout | 5 attempts    |
| **Lockout Duration**  | Minutes an account remains locked            | 30 minutes    |

### Fiscal Year Configuration

EFIR (École Française Internationale de Riyad) operates on a calendar year fiscal cycle:

| Setting                     | Description                                        | Default            |
| --------------------------- | -------------------------------------------------- | ------------------ |
| **Fiscal Year Start Month** | Month number (1–12) when fiscal year begins        | 1 (January)        |
| **Fiscal Year Range**       | Display format for fiscal year (e.g., "2025/2026") | Current year range |
| **Autosave Interval**       | Seconds between automatic draft saves              | 30 seconds         |

---

## User Roles & Permissions

| Role            | View Settings | Edit Settings | Access Route      |
| --------------- | ------------- | ------------- | ----------------- |
| **Admin**       | ✅            | ✅            | `/admin/settings` |
| **BudgetOwner** | ❌            | ❌            | N/A (no access)   |
| **Editor**      | ❌            | ❌            | N/A (no access)   |
| **Viewer**      | ❌            | ❌            | N/A (no access)   |

**Access Control Rule**: This page is strictly restricted to **Admin** role only. The API endpoints enforce this at both the route level and middleware level via `app.requireRole('Admin')`.

---

## Pre-Conditions

Before using this page, the following must be configured:

### Required System Setup

1. **Database Seeding** (`system_config` table)
    - All configuration keys must exist in the database
    - Default values should be populated via seed script
    - Required keys: `max_sessions_per_user`, `session_timeout_minutes`, `lockout_threshold`, `lockout_duration_minutes`, `fiscal_year_start_month`, `fiscal_year_range`, `autosave_interval_seconds`

2. **Authentication Requirements**
    - User must be logged in with valid JWT access token
    - User must have Admin role assigned
    - Session must not be expired

### Default Configuration Values

| Key                         | Default Value | Data Type | Description                          |
| --------------------------- | ------------- | --------- | ------------------------------------ |
| `max_sessions_per_user`     | `3`           | number    | Maximum concurrent sessions per user |
| `session_timeout_minutes`   | `480`         | number    | Session timeout (8 hours)            |
| `lockout_threshold`         | `5`           | number    | Failed attempts before lockout       |
| `lockout_duration_minutes`  | `30`          | number    | Lockout duration in minutes          |
| `fiscal_year_start_month`   | `1`           | number    | January start                        |
| `fiscal_year_range`         | `"2025/2026"` | string    | Current fiscal year display          |
| `autosave_interval_seconds` | `30`          | number    | Autosave frequency                   |

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  System Settings                                              [Save Changes]│
├─────────────────────────────────────────────────────────────────────────────┤
```

### Action Buttons

| Button           | Icon | Role Required | State                       | Action                         |
| ---------------- | ---- | ------------- | --------------------------- | ------------------------------ |
| **Save Changes** | Save | Admin         | Disabled until changes made | Persists all modified settings |

**Button States**:

- **Disabled**: No changes detected (`hasChanges = false`)
- **Enabled**: One or more fields modified (`hasChanges = true`)
- **Loading**: Save in progress (`saveMutation.isPending = true`)
- **Label Changes**: "Save Changes" → "Saving..." during submission

### Settings Cards (Main Content)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Session                                    Security            Application │
│  Session management settings                Account security    General app │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐          │
│  │ Session                     │  │ Security                    │          │
│  │ Session management settings │  │ Account security settings   │          │
│  │                             │  │                             │          │
│  │ Max Sessions per User    [3]│  │ Lockout Threshold        [5]│          │
│  │ Session Timeout (min)  [480]│  │ Lockout Duration (min)  [30]│          │
│  └─────────────────────────────┘  └─────────────────────────────┘          │
│                                                                             │
│  ┌─────────────────────────────┐                                            │
│  │ Application                 │                                            │
│  │ General application settings│                                            │
│  │                             │                                            │
│  │ Fiscal Year Start (mo)   [1]│                                            │
│  │ Fiscal Year Range  [2025/26]│                                            │
│  │ Autosave Interval (sec) [30]│                                            │
│  └─────────────────────────────┘                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Card Layout

**Responsive Grid**:

- Desktop (xl): 3 columns
- Desktop (lg): 2 columns
- Tablet/Mobile: 1 column

### Field Visual States

| State         | Visual Indicator                               | Meaning                        |
| ------------- | ---------------------------------------------- | ------------------------------ |
| **Unchanged** | No border highlight                            | Value matches saved state      |
| **Modified**  | Orange left border (`border-l-(--accent-500)`) | Value differs from saved state |
| **Invalid**   | (Future: red border)                           | Value fails validation         |

### Skeleton Loading State

When data is loading, the page displays:

- Header skeleton (title + button placeholder)
- 3 card skeletons with:
    - Title placeholder
    - Description placeholder
    - 2 input field placeholders per card

---

## Step-by-Step Workflow

### Workflow 1: View Current Settings

**Actor**: Admin

| Step | Action                       | UI Element     | API Call             | Result               |
| ---- | ---------------------------- | -------------- | -------------------- | -------------------- |
| 1    | Navigate to Admin → Settings | Sidebar menu   | -                    | Page loads           |
| 2    | Wait for data fetch          | Skeleton state | `GET /system-config` | Settings loaded      |
| 3    | Review current values        | Settings cards | -                    | All values displayed |

**Database Query**:

```sql
SELECT key, value, data_type, description, updated_at, updated_by
FROM system_config
ORDER BY key ASC;
```

---

### Workflow 2: Modify and Save Settings

**Actor**: Admin

| Step | Action                                        | UI Element         | API Call             | Result                        |
| ---- | --------------------------------------------- | ------------------ | -------------------- | ----------------------------- |
| 1    | Click into a setting input field              | Number input       | -                    | Field focused                 |
| 2    | Enter new value (e.g., change timeout to 240) | Keyboard input     | -                    | Value updated in local state  |
| 3    | Observe field highlighting                    | Orange left border | -                    | Field marked as changed       |
| 4    | Observe Save button state                     | Button enabled     | -                    | Save button becomes active    |
| 5    | Click "Save Changes" button                   | Button             | `PUT /system-config` | Save initiated                |
| 6    | Wait for completion                           | Loading spinner    | -                    | Settings persisted            |
| 7    | View success feedback                         | Toast notification | -                    | "Settings saved successfully" |
| 8    | Observe field reset                           | Borders cleared    | -                    | All fields show as unchanged  |

**PUT Request Body**:

```json
{
    "updates": [
        {
            "key": "session_timeout_minutes",
            "value": "240"
        }
    ]
}
```

**PUT Response**:

```json
{
    "updated": 1
}
```

**Database Operations**:

1. Update `system_config` table:

    ```sql
    UPDATE system_config
    SET value = '240', updated_by = 1, updated_at = NOW()
    WHERE key = 'session_timeout_minutes';
    ```

2. Insert audit entry:
    ```sql
    INSERT INTO audit_entries
    (user_id, operation, table_name, ip_address, user_email, old_values, new_values)
    VALUES (1, 'CONFIG_UPDATED', 'system_config', '192.168.1.1', 'admin@efir.edu.sa',
            '{"key": "session_timeout_minutes", "value": "480"}',
            '{"key": "session_timeout_minutes", "value": "240"}');
    ```

---

### Workflow 3: Bulk Settings Update

**Actor**: Admin

| Step | Action                              | UI Element     | API Call             | Result                                  |
| ---- | ----------------------------------- | -------------- | -------------------- | --------------------------------------- |
| 1    | Modify multiple fields across cards | Various inputs | -                    | Multiple fields changed                 |
| 2    | Review all highlighted fields       | Orange borders | -                    | Visual confirmation of changes          |
| 3    | Click "Save Changes"                | Button         | `PUT /system-config` | All changes saved in single transaction |
| 4    | Review success notification         | Toast          | -                    | Confirmation of bulk save               |

**Note**: All changes are saved atomically. If one value fails validation, the entire save operation fails.

---

## Data Models & Database Schema

### Core Tables

#### 1. system_config

Stores all system-wide configuration parameters as key-value pairs with type information.

```sql
Table: system_config
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ key               │ VARCHAR(100) PK │ Unique configuration key                   │
│ value             │ TEXT            │ Configuration value (as string)            │
│ data_type         │ VARCHAR(20)     │ Value type: 'string', 'number', 'boolean'  │
│ description       │ TEXT            │ Human-readable description (optional)      │
│ updated_at        │ TIMESTAMPTZ     │ Last update timestamp                      │
│ updated_by        │ INTEGER FK      │ → users.id (nullable)                      │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Primary Key: key
Foreign Key: updated_by → users.id
```

#### 2. audit_entries

Tracks all configuration changes for compliance and troubleshooting.

```sql
Table: audit_entries
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ user_id           │ INTEGER FK      │ → users.id                                 │
│ operation         │ VARCHAR(50)     │ Operation type (e.g., 'CONFIG_UPDATED')    │
│ table_name        │ VARCHAR(100)    │ Target table ('system_config')             │
│ record_id         │ INTEGER         │ Record identifier (null for config)        │
│ old_values        │ JSONB           │ Previous values (JSON)                     │
│ new_values        │ JSONB           │ New values (JSON)                          │
│ ip_address        │ VARCHAR(45)     │ Client IP address                          │
│ user_email        │ VARCHAR(255)    │ User email for audit trail                 │
│ session_id        │ VARCHAR(100)    │ Session identifier                         │
│ audit_note        │ TEXT            │ Additional notes                           │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Indexes: created_at, user_id, table_name+record_id, operation
```

---

## API Endpoints

### System Configuration APIs

| Method | Endpoint         | Description                      | Auth | Role  |
| ------ | ---------------- | -------------------------------- | ---- | ----- |
| GET    | `/system-config` | List all configuration values    | JWT  | Admin |
| PUT    | `/system-config` | Bulk update configuration values | JWT  | Admin |

#### GET /system-config

**Response**:

```json
{
    "config": [
        {
            "key": "max_sessions_per_user",
            "value": "3",
            "description": "Maximum concurrent sessions per user",
            "data_type": "number"
        },
        {
            "key": "session_timeout_minutes",
            "value": "480",
            "description": "Session timeout in minutes",
            "data_type": "number"
        }
    ]
}
```

#### PUT /system-config

**Request Body**:

```json
{
    "updates": [
        {
            "key": "session_timeout_minutes",
            "value": "240"
        },
        {
            "key": "lockout_threshold",
            "value": "3"
        }
    ]
}
```

**Success Response**:

```json
{
    "updated": 2
}
```

**Error Response (Invalid Value)**:

```json
{
    "code": "INVALID_CONFIG_VALUE",
    "message": "Invalid value for \"session_timeout_minutes\": expected a number"
}
```

---

## TypeScript Types

### Frontend Types (`apps/web/src/pages/admin/settings.tsx`)

```typescript
// Configuration item from API
interface ConfigItem {
    key: string;
    value: string;
    description: string | null;
    data_type: string;
}

// API response structure
interface ConfigResponse {
    config: ConfigItem[];
}

// Settings group definition
interface SettingGroup {
    title: string;
    description: string;
    keys: { key: string; label: string }[];
}

// Setting field for card component
interface SettingField {
    key: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    changed: boolean;
}
```

### Component Props (`apps/web/src/components/admin/settings-card.tsx`)

```typescript
interface SettingsCardProps {
    title: string;
    description: string;
    fields: SettingField[];
}
```

### API Validation Schema (`apps/api/src/routes/system-config.ts`)

```typescript
const updateBodySchema = z.object({
    updates: z.array(
        z.object({
            key: z.string(),
            value: z.string(),
        })
    ),
});
```

---

## Configuration Reference

### Session Group

| Key                       | Label                     | Type   | Default | Min | Max  | Description                                         |
| ------------------------- | ------------------------- | ------ | ------- | --- | ---- | --------------------------------------------------- |
| `max_sessions_per_user`   | Max Sessions per User     | number | 3       | 1   | 10   | Maximum concurrent active sessions per user account |
| `session_timeout_minutes` | Session Timeout (minutes) | number | 480     | 15  | 1440 | Minutes of inactivity before automatic logout       |

### Security Group

| Key                        | Label                        | Type   | Default | Min | Max  | Description                                               |
| -------------------------- | ---------------------------- | ------ | ------- | --- | ---- | --------------------------------------------------------- |
| `lockout_threshold`        | Lockout Threshold (attempts) | number | 5       | 1   | 10   | Failed login attempts before account lockout              |
| `lockout_duration_minutes` | Lockout Duration (minutes)   | number | 30      | 5   | 1440 | Minutes an account remains locked after threshold reached |

### Application Group

| Key                         | Label                       | Type   | Default     | Constraints | Description                                           |
| --------------------------- | --------------------------- | ------ | ----------- | ----------- | ----------------------------------------------------- |
| `fiscal_year_start_month`   | Fiscal Year Start (month)   | number | 1           | 1–12        | Month number when fiscal year begins (1=January)      |
| `fiscal_year_range`         | Fiscal Year Range           | string | "2025/2026" | Free text   | Display format for current fiscal year                |
| `autosave_interval_seconds` | Autosave Interval (seconds) | number | 30          | 5–300       | Seconds between automatic draft saves in budget forms |

---

## Audit Trail

### Operations Logged

| Operation      | Table         | Data Captured             |
| -------------- | ------------- | ------------------------- |
| CONFIG_UPDATED | system_config | Key, old value, new value |

### Audit Entry Example

```typescript
{
  userId: 1,
  userEmail: "admin@efir.edu.sa",
  operation: "CONFIG_UPDATED",
  tableName: "system_config",
  recordId: null,
  ipAddress: "192.168.1.1",
  oldValues: { key: "session_timeout_minutes", value: "480" },
  newValues: { key: "session_timeout_minutes", value: "240" },
  createdAt: "2026-03-10T10:30:00Z"
}
```

### Audit Query Examples

**View all configuration changes**:

```sql
SELECT * FROM audit_entries
WHERE table_name = 'system_config'
ORDER BY created_at DESC;
```

**View changes by specific user**:

```sql
SELECT * FROM audit_entries
WHERE operation = 'CONFIG_UPDATED'
AND user_email = 'admin@efir.edu.sa'
ORDER BY created_at DESC;
```

**View changes to specific setting**:

```sql
SELECT * FROM audit_entries
WHERE new_values->>'key' = 'session_timeout_minutes'
ORDER BY created_at DESC;
```

---

## Error Handling

### Common Error Codes

| Code                 | HTTP Status | Description                             | User Action                       |
| -------------------- | ----------- | --------------------------------------- | --------------------------------- |
| UNAUTHORIZED         | 401         | User not authenticated or token expired | Log in again                      |
| FORBIDDEN            | 403         | User lacks Admin role                   | Contact system administrator      |
| INVALID_CONFIG_VALUE | 400         | Value doesn't match expected data type  | Enter valid number/string/boolean |
| CONFIG_KEY_NOT_FOUND | 400         | Attempted to update non-existent key    | Refresh page to get current keys  |

### Validation Rules

| Data Type | Validation                                   | Error Message                                           |
| --------- | -------------------------------------------- | ------------------------------------------------------- |
| `number`  | Must be parseable as JavaScript Number       | `Invalid value for "{key}": expected a number`          |
| `boolean` | Must be "true" or "false" (case-insensitive) | `Invalid value for "{key}": expected "true" or "false"` |
| `string`  | No validation (any text accepted)            | N/A                                                     |

### Frontend Error Handling

| Scenario          | UI Feedback                          |
| ----------------- | ------------------------------------ |
| API network error | Toast: "Failed to save settings"     |
| Validation error  | Toast: Error message from API        |
| Success           | Toast: "Settings saved successfully" |
| Query error       | Page error state (not implemented)   |

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the System Settings module.

### High Priority

| ID      | Issue                            | Impact                                                           | Proposed Solution                             |
| ------- | -------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| SET-001 | **No client-side validation**    | Users can submit invalid values, only caught by API              | Add Zod validation matching API schema        |
| SET-002 | **No range validation feedback** | Users can enter values outside sensible bounds                   | Add min/max validation with visual indicators |
| SET-003 | **No settings history/rollback** | Cannot revert to previous configuration values                   | Add version history with restore capability   |
| SET-004 | **No settings dependencies**     | Changing fiscal year start doesn't validate against open budgets | Add dependency checks before allowing changes |

### Medium Priority

| ID      | Issue                             | Impact                                              | Proposed Solution                                |
| ------- | --------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| SET-005 | **No settings categories filter** | All settings visible at once, could become unwieldy | Add search/filter by category or keyword         |
| SET-006 | **No bulk reset to defaults**     | Must manually revert each changed field             | Add "Reset to Defaults" button with confirmation |
| SET-007 | **Limited data type support**     | Only string/number/boolean; no arrays/objects       | Extend type system for complex configurations    |
| SET-008 | **No settings import/export**     | Cannot backup or migrate configuration              | Add JSON import/export functionality             |

### Low Priority / Technical Debt

| ID      | Issue                           | Impact                                    | Proposed Solution                           |
| ------- | ------------------------------- | ----------------------------------------- | ------------------------------------------- |
| SET-009 | **Sequential database updates** | Each config key updates in separate query | Use batch/transaction for bulk updates      |
| SET-010 | **No optimistic UI updates**    | Save button spinner blocks interaction    | Apply optimistic updates, rollback on error |
| SET-011 | **No keyboard navigation**      | Cannot tab between cards efficiently      | Implement logical tab order                 |
| SET-012 | **Hardcoded setting groups**    | GROUPS array in component                 | Move to configuration or database           |

### Feature Requests

| ID      | Feature                           | Business Value                                    | Complexity |
| ------- | --------------------------------- | ------------------------------------------------- | ---------- |
| SET-F01 | **Environment-specific settings** | Different configs for dev/staging/prod            | Medium     |
| SET-F02 | **Settings change notifications** | Alert users when session/security settings change | Low        |
| SET-F03 | **Configuration templates**       | Predefined setting profiles (strict/relaxed)      | Medium     |
| SET-F04 | **Scheduled setting changes**     | Apply settings at future date/time                | High       |
| SET-F05 | **Setting descriptions in UI**    | Show help text explaining each setting            | Low        |

---

## Appendix A: Settings Key Reference

### Complete Key Listing

```
system_config table keys:

┌───────────────────────────────┬─────────────┬──────────────────────────────────────┐
│ Key                           │ Type        │ Used By                              │
├───────────────────────────────┼─────────────┼──────────────────────────────────────┤
│ max_sessions_per_user         │ number      │ Authentication middleware            │
│ session_timeout_minutes       │ number      │ JWT token expiration, session mgmt   │
│ lockout_threshold             │ number      │ Login rate limiter                   │
│ lockout_duration_minutes      │ number      │ Account lockout service              │
│ fiscal_year_start_month       │ number      │ Fiscal period calculations           │
│ fiscal_year_range             │ string      │ UI display, report headers           │
│ autosave_interval_seconds     │ number      │ Budget form auto-save timer          │
└───────────────────────────────┴─────────────┴──────────────────────────────────────┘
```

### Key Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│  SYSTEM SETTINGS                                              │
│        │                                                      │
│        ├──► max_sessions_per_user ──► Session management      │
│        ├──► session_timeout_minutes ──► JWT expiration        │
│        │                                                      │
│        ├──► lockout_threshold ──► Login rate limiting         │
│        ├──► lockout_duration_minutes ──► Account lockout      │
│        │                                                      │
│        ├──► fiscal_year_start_month ──► Budget calculations   │
│        ├──► fiscal_year_range ──► Reports & UI                │
│        │                                                      │
│        └──► autosave_interval_seconds ──► Form auto-save      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Security Considerations

### Sensitive Settings

The following settings directly impact system security:

| Setting                    | Security Impact                   | Recommendation                         |
| -------------------------- | --------------------------------- | -------------------------------------- |
| `max_sessions_per_user`    | Session hijacking prevention      | Keep low (2–3) for admin users         |
| `session_timeout_minutes`  | Exposure window if session stolen | Balance UX with security (240–480 min) |
| `lockout_threshold`        | Brute-force protection            | 3–5 attempts recommended               |
| `lockout_duration_minutes` | Attack mitigation duration        | 15–60 minutes recommended              |

### Audit Requirements

Per PDPL (KSA Data Protection Law) and internal compliance:

1. All configuration changes must be logged with user identification
2. Old and new values must be preserved
3. IP address and timestamp must be recorded
4. Audit logs must be retained for minimum 2 years
5. Access to audit logs restricted to Admin role

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
