# User Management Admin Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the User Management admin page. It explains the business process, technical implementation, user actions, and data flow. It serves as a reference for auditors, new developers, and business analysts to understand and propose improvements.

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
10. [Security Features](#security-features)
11. [Audit Trail](#audit-trail)
12. [Error Handling](#error-handling)
13. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| **Page Name**        | User Management                                                                                |
| **URL Route**        | `/admin/users`                                                                                 |
| **Module**           | Admin — User Management                                                                        |
| **Page File**        | `apps/web/src/pages/admin/users.tsx`                                                           |
| **Primary Function** | Manage system users, assign roles, control account security, and monitor authentication status |

### What This Page Does

The User Management page is the **central administration interface** for system access control. It allows administrators to:

1. View **all system users** with their account status and security metrics
2. **Create new users** with email, password, and role assignment
3. **Edit existing users** to change roles or activate/deactivate accounts
4. **Unlock locked accounts** after failed login attempts
5. **Force logout users** by revoking all active sessions
6. Monitor **security metrics** including failed attempts and lockout status

**Critical Security Rule**: Administrators cannot modify their own account through this interface to prevent accidental lockout. Self-actions are disabled in the UI.

---

## Business Context

### User Roles Hierarchy

| Role            | Level      | Description                                                                       |
| --------------- | ---------- | --------------------------------------------------------------------------------- |
| **Admin**       | System     | Full system access — can manage users, configure master data, access all features |
| **BudgetOwner** | Department | Can create budget versions, publish versions, view all data including salaries    |
| **Editor**      | Department | Can edit budget data, run calculations, view salary data                          |
| **Viewer**      | Read-Only  | Read-only access, redacted salary data (hidden values)                            |

### Account Status States

| Status       | Badge    | Description                                                   |
| ------------ | -------- | ------------------------------------------------------------- |
| **Active**   | 🟢 Green | User can log in and access the system based on their role     |
| **Inactive** | ⚪ Gray  | User account disabled — cannot log in, retains data for audit |

### Security Account States

| State                    | Indicator | Description                                             |
| ------------------------ | --------- | ------------------------------------------------------- |
| **Normal**               | —         | Account operating normally, no security concerns        |
| **Locked**               | 🔴 Red    | Account temporarily locked due to failed login attempts |
| **Force Password Reset** | 🟡 Yellow | User must change password on next login                 |

---

## User Roles & Permissions

| Role            | View Users | Create Users | Edit Users | Unlock Accounts | Force Logout |
| --------------- | ---------- | ------------ | ---------- | --------------- | ------------ |
| **Admin**       | ✅         | ✅           | ✅         | ✅              | ✅           |
| **BudgetOwner** | ❌         | ❌           | ❌         | ❌              | ❌           |
| **Editor**      | ❌         | ❌           | ❌         | ❌              | ❌           |
| **Viewer**      | ❌         | ❌           | ❌         | ❌              | ❌           |

**Access Control Rule**: This page is restricted to **Admin role only**. Non-admin users attempting to access this page receive a 403 Forbidden error.

---

## Pre-Conditions

Before using this page, the following must be in place:

### Required System Configuration

1. **Database Schema** (`users` table)
    - All required columns: id, email, password_hash, role, is_active, etc.
    - Proper indexes on email (unique) and role columns

2. **Authentication System**
    - JWT key pairs generated and configured
    - Password hashing configured (bcrypt with cost factor 12)
    - Session management enabled

3. **Authorization Middleware**
    - RBAC (Role-Based Access Control) middleware active
    - Admin-only route protection configured

### Required Permissions

1. **Current User** must have **Admin** role
2. **Session** must be valid and not expired

---

## Page Layout & UI Elements

### Header Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User Management                                                            │
│  Manage system users, roles, and account security                           │
│                                                                             │
│                                    [+ Add User]                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔍 Search: [                                    ]  [Filter by Role ▼]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Filter Controls

| Control           | Type       | Values                                  | Function                       |
| ----------------- | ---------- | --------------------------------------- | ------------------------------ |
| **Search**        | Text input | Any text                                | Filters users by email address |
| **Role Filter**   | Dropdown   | All, Admin, BudgetOwner, Editor, Viewer | Filters users by assigned role |
| **Status Filter** | Dropdown   | All, Active, Inactive                   | Filters by account status      |

### Action Buttons

| Button       | Icon | Role Required | Action                              |
| ------------ | ---- | ------------- | ----------------------------------- |
| **Add User** | Plus | Admin         | Opens side panel to create new user |

### Main Content: Users Table

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Users                                                                               [15 total]│
├──────────────┬──────────────┬──────────┬──────────────┬───────────┬──────────────┬─────────────┤
│ Email        │ Role         │ Status   │ Last Login   │ Failed    │ Locked Until │ Actions     │
│              │              │          │ (AST)        │ Attempts  │ (AST)        │             │
├──────────────┼──────────────┼──────────┼──────────────┼───────────┼──────────────┼─────────────┤
│ admin@efir…  │ Admin        │ 🟢 Active│ 10 Mar 2026  │ 0         │ —            │ [⋯]         │
│              │              │          │ 08:30 AST    │           │              │             │
├──────────────┼──────────────┼──────────┼──────────────┼───────────┼──────────────┼─────────────┤
│ editor@efir… │ Editor       │ 🟢 Active│ 09 Mar 2026  │ 2         │ —            │ [⋯]         │
│              │              │          │ 16:45 AST    │           │              │             │
├──────────────┼──────────────┼──────────┼──────────────┼───────────┼──────────────┼─────────────┤
│ locked@efir… │ Viewer       │ 🔴 Locked│ 05 Mar 2026  │ 5         │ 10 Mar 2026  │ [⋯]         │
│              │              │          │ 14:20 AST    │           │ 09:00 AST    │             │
├──────────────┼──────────────┼──────────┼──────────────┼───────────┼──────────────┼─────────────┤
│ inactive@…   │ BudgetOwner  │ ⚪ Inact.│ Never        │ 0         │ —            │ [⋯]         │
│              │              │          │              │           │              │ (disabled)  │
└──────────────┴──────────────┴──────────┴──────────────┴───────────┴──────────────┴─────────────┘
```

**Table Columns**:

| Column              | Type      | Description                                     |
| ------------------- | --------- | ----------------------------------------------- |
| **Email**           | Text      | User's login email address (unique identifier)  |
| **Role**            | Badge     | User's role: Admin, BudgetOwner, Editor, Viewer |
| **Status**          | Badge     | Active (green) or Inactive (gray)               |
| **Last Login**      | Timestamp | Last successful login in AST timezone           |
| **Failed Attempts** | Number    | Count of consecutive failed login attempts      |
| **Locked Until**    | Timestamp | Account lockout expiry time in AST timezone     |
| **Actions**         | Menu      | Edit, Unlock, Force Logout options              |

### Actions Menu (Per User)

```
┌─────────────┐
│  Edit       │ → Opens edit side panel
├─────────────┤
│  Unlock     │ → Available only if locked
│  Account    │
├─────────────┤
│  Force      │ → Revokes all sessions
│  Logout     │
└─────────────┘
```

**Self-Action Protection**: The actions menu is disabled for the currently logged-in administrator to prevent accidental self-lockout or role changes.

### Side Panel: Create User

```
┌────────────────────────────────────────┐
│  Create User                    [×]    │
├────────────────────────────────────────┤
│                                        │
│  Email *                               │
│  [user@example.com             ]       │
│                                        │
│  Password *                            │
│  [••••••••••••••               ]       │
│  Minimum 12 characters                 │
│                                        │
│  Role *                                │
│  [Select Role ▼                ]       │
│   ├─ Admin                             │
│   ├─ BudgetOwner                       │
│   ├─ Editor                            │
│   └─ Viewer                            │
│                                        │
│           [Cancel]  [Create User]      │
│                                        │
└────────────────────────────────────────┘
```

### Side Panel: Edit User

```
┌────────────────────────────────────────┐
│  Edit User                      [×]    │
├────────────────────────────────────────┤
│                                        │
│  Email (read-only)                     │
│  [user@example.com             ]       │
│                                        │
│  Role                                  │
│  [Editor ▼                     ]       │
│                                        │
│  Status                                │
│  [🟢 Active ▼                  ]       │
│   ├─ Active                            │
│   └─ Inactive                          │
│                                        │
│  ┌────────────────────────────────┐    │
│  │ Security Actions               │    │
│  ├────────────────────────────────┤    │
│  │ [Unlock Account]     (locked)  │    │
│  │ [Force Password Reset]         │    │
│  │ [Force Logout — All Sessions]  │    │
│  └────────────────────────────────┘    │
│                                        │
│           [Cancel]  [Save Changes]     │
│                                        │
└────────────────────────────────────────┘
```

---

## Step-by-Step Workflow

### Workflow 1: View Users List

**Actor**: Admin

| Step | Action                    | UI Element           | API Call                 | Result                                        |
| ---- | ------------------------- | -------------------- | ------------------------ | --------------------------------------------- |
| 1    | Navigate to Admin → Users | Sidebar menu         | -                        | Page loads                                    |
| 2    | Observe users table       | Data table           | `GET /users`             | List of all users displayed                   |
| 3    | Review user information   | Table rows           | -                        | Email, role, status, security metrics visible |
| 4    | (Optional) Apply filters  | Search/Filter inputs | `GET /users?role=Editor` | Filtered results displayed                    |

**Database Query**:

```sql
SELECT id, email, role, is_active, failed_attempts,
       locked_until, last_login_at, created_at
FROM users
ORDER BY created_at DESC;
```

---

### Workflow 2: Create New User

**Actor**: Admin

| Step | Action                    | UI Element         | API Call      | Result                            |
| ---- | ------------------------- | ------------------ | ------------- | --------------------------------- |
| 1    | Click "Add User" button   | Button             | -             | Create side panel opens           |
| 2    | Enter email address       | Text input         | -             | Email validated for uniqueness    |
| 3    | Enter password            | Password input     | -             | Strength validated (min 12 chars) |
| 4    | Select role               | Dropdown           | -             | Role selected from list           |
| 5    | Click "Create User"       | Button             | `POST /users` | User created, panel closes        |
| 6    | Observe confirmation      | Toast notification | -             | "User created successfully"       |
| 7    | New user appears in table | Table row          | -             | User visible in list              |

**API Request**:

```json
POST /users
{
  "email": "newuser@efir.edu.sa",
  "password": "SecureP@ssw0rd123",
  "role": "Editor"
}
```

**Database Changes**:

- Insert into `users` table
- Password hashed with bcrypt (cost factor 12)
- `is_active` set to `true`
- `failed_attempts` set to `0`
- `created_at` timestamp set

---

### Workflow 3: Edit User Role and Status

**Actor**: Admin

| Step | Action                                 | UI Element         | API Call            | Result                               |
| ---- | -------------------------------------- | ------------------ | ------------------- | ------------------------------------ |
| 1    | Click actions menu (⋯) for target user | Menu button        | -                   | Dropdown menu opens                  |
| 2    | Select "Edit" option                   | Menu item          | `GET /users/{id}`   | Edit side panel opens with user data |
| 3    | Change role (optional)                 | Dropdown           | -                   | New role selected                    |
| 4    | Change status (optional)               | Dropdown           | -                   | Active/Inactive selected             |
| 5    | Click "Save Changes"                   | Button             | `PATCH /users/{id}` | Changes saved, panel closes          |
| 6    | Observe confirmation                   | Toast notification | -                   | "User updated successfully"          |
| 7    | Table reflects changes                 | Updated row        | -                   | Role/status updated in UI            |

**API Request**:

```json
PATCH /users/42
{
  "role": "BudgetOwner",
  "isActive": true
}
```

**Self-Action Protection**:

```typescript
// In UI code — disable edit for current user
const isSelf = user.id === currentUser.id;
if (isSelf) {
    // Disable actions menu, show tooltip
    // "You cannot edit your own account"
}
```

---

### Workflow 4: Unlock Locked Account

**Actor**: Admin

| Step | Action                 | UI Element             | API Call            | Result                                   |
| ---- | ---------------------- | ---------------------- | ------------------- | ---------------------------------------- |
| 1    | Identify locked user   | Table row (red status) | -                   | User with failed attempts ≥ 5            |
| 2    | Click actions menu (⋯) | Menu button            | -                   | Dropdown opens                           |
| 3    | Click "Unlock Account" | Menu item (enabled)    | `PATCH /users/{id}` | Account unlocked                         |
| 4    | Observe confirmation   | Toast notification     | -                   | "Account unlocked successfully"          |
| 5    | Table updates          | Updated row            | -                   | Failed attempts reset to 0, lock cleared |

**Unlock Logic**:

```typescript
// Backend clears lockout fields
{
  "failedAttempts": 0,
  "lockedUntil": null
}
```

**Database Changes**:

- `failed_attempts` reset to `0`
- `locked_until` set to `NULL`

---

### Workflow 5: Force Logout User

**Actor**: Admin

| Step | Action                  | UI Element         | API Call                         | Result                 |
| ---- | ----------------------- | ------------------ | -------------------------------- | ---------------------- |
| 1    | Identify user to logout | Table row          | -                                | Target user selected   |
| 2    | Click actions menu (⋯)  | Menu button        | -                                | Dropdown opens         |
| 3    | Click "Force Logout"    | Menu item          | `PATCH /users/{id}`              | All sessions revoked   |
| 4    | Confirm action          | Dialog             | -                                | "Are you sure?" prompt |
| 5    | Confirm                 | Button             | `POST /auth/revoke-all/{userId}` | Sessions revoked       |
| 6    | Observe confirmation    | Toast notification | -                                | "All sessions revoked" |

**Security Impact**:

- All refresh tokens for the user are revoked
- User's next API request returns 401 Unauthorized
- User must log in again

---

## Data Models & Database Schema

### Core Tables

#### 1. users

Stores all system user accounts with security metadata.

```sql
Table: users
┌─────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column              │ Type            │ Description                                │
├─────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                  │ SERIAL PK       │ Unique identifier                          │
│ email               │ VARCHAR(255)    │ Login email (unique, case-insensitive)     │
│ password_hash       │ VARCHAR(255)    │ Bcrypt hashed password                     │
│ role                │ VARCHAR(20)     │ Admin, BudgetOwner, Editor, Viewer         │
│ is_active           │ BOOLEAN         │ Account active status (default: true)      │
│ failed_attempts     │ INTEGER         │ Consecutive failed login count (default: 0)│
│ locked_until        │ TIMESTAMPTZ     │ Account lockout expiry timestamp           │
│ force_password_reset│ BOOLEAN         │ Require password change on login           │
│ last_login_at       │ TIMESTAMPTZ     │ Last successful authentication             │
│ created_at          │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at          │ TIMESTAMPTZ     │ Last update timestamp                      │
└─────────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: email
Index: role (for filtering)
```

#### 2. refresh_tokens

Stores active refresh tokens for session management.

```sql
Table: refresh_tokens
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ SERIAL PK       │ Unique identifier                          │
│ user_id           │ INTEGER FK      │ → users.id                                 │
│ token_hash        │ VARCHAR(255)    │ SHA-256 hash of token (never store raw)    │
│ family            │ UUID            │ Token family for rotation tracking         │
│ expires_at        │ TIMESTAMPTZ     │ Token expiration timestamp                 │
│ revoked_at        │ TIMESTAMPTZ     │ Revocation timestamp (null if active)      │
│ created_at        │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ ip_address        │ VARCHAR(45)     │ Client IP address                          │
│ user_agent        │ TEXT            │ Client user agent string                   │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘

Index: token_hash (for lookup)
Index: user_id (for user session queries)
```

#### 3. audit_entries

Append-only audit log for all user management actions.

```sql
Table: audit_entries
┌───────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column            │ Type            │ Description                                │
├───────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                │ BIGSERIAL PK    │ Unique identifier                          │
│ user_id           │ INTEGER FK      │ → users.id (acting user)                   │
│ target_user_id    │ INTEGER FK      │ → users.id (affected user, if applicable)  │
│ operation         │ VARCHAR(50)     │ Action performed                           │
│ table_name        │ VARCHAR(100)    │ Affected table                             │
│ record_id         │ BIGINT          │ Affected record ID                         │
│ old_values        │ JSONB           │ Previous values (for updates)              │
│ new_values        │ JSONB           │ New values                                 │
│ ip_address        │ INET            │ Client IP address                          │
│ created_at        │ TIMESTAMPTZ     │ Timestamp                                  │
└───────────────────┴─────────────────┴────────────────────────────────────────────┘
```

---

## API Endpoints

### User Management APIs

| Method | Endpoint               | Description      | Auth | Role  |
| ------ | ---------------------- | ---------------- | ---- | ----- |
| GET    | `/users`               | List all users   | JWT  | Admin |
| GET    | `/users?role=Editor`   | Filter by role   | JWT  | Admin |
| GET    | `/users?isActive=true` | Filter by status | JWT  | Admin |
| POST   | `/users`               | Create new user  | JWT  | Admin |
| GET    | `/users/{id}`          | Get user details | JWT  | Admin |
| PATCH  | `/users/{id}`          | Update user      | JWT  | Admin |
| DELETE | `/users/{id}`          | Soft delete user | JWT  | Admin |

### List Users Request/Response

**GET Response**:

```json
[
    {
        "id": 1,
        "email": "admin@efir.edu.sa",
        "role": "Admin",
        "isActive": true,
        "failedAttempts": 0,
        "lockedUntil": null,
        "lastLoginAt": "2026-03-10T05:30:00Z",
        "createdAt": "2025-01-15T08:00:00Z"
    },
    {
        "id": 2,
        "email": "editor@efir.edu.sa",
        "role": "Editor",
        "isActive": true,
        "failedAttempts": 2,
        "lockedUntil": null,
        "lastLoginAt": "2026-03-09T13:45:00Z",
        "createdAt": "2025-02-01T10:30:00Z"
    },
    {
        "id": 3,
        "email": "locked@efir.edu.sa",
        "role": "Viewer",
        "isActive": true,
        "failedAttempts": 5,
        "lockedUntil": "2026-03-10T06:00:00Z",
        "lastLoginAt": "2026-03-05T11:20:00Z",
        "createdAt": "2025-03-10T09:15:00Z"
    }
]
```

### Create User Request/Response

**POST Request**:

```json
{
    "email": "newuser@efir.edu.sa",
    "password": "SecureP@ssw0rd123",
    "role": "Editor"
}
```

**POST Response (201 Created)**:

```json
{
    "id": 4,
    "email": "newuser@efir.edu.sa",
    "role": "Editor",
    "isActive": true,
    "failedAttempts": 0,
    "lockedUntil": null,
    "createdAt": "2026-03-10T09:30:00Z"
}
```

**Validation Errors (422)**:

```json
{
    "error": "VALIDATION_ERROR",
    "message": "Email already exists",
    "field": "email"
}
```

### Update User Request/Response

**PATCH Request**:

```json
{
    "role": "BudgetOwner",
    "isActive": true,
    "unlockAccount": true,
    "forceSessionRevoke": false
}
```

**PATCH Response (200 OK)**:

```json
{
    "id": 2,
    "email": "editor@efir.edu.sa",
    "role": "BudgetOwner",
    "isActive": true,
    "failedAttempts": 0,
    "lockedUntil": null,
    "lastLoginAt": "2026-03-09T13:45:00Z",
    "updatedAt": "2026-03-10T09:35:00Z"
}
```

### Security Actions

| Method | Endpoint                           | Description          | Auth | Role  |
| ------ | ---------------------------------- | -------------------- | ---- | ----- |
| POST   | `/users/{id}/unlock`               | Unlock account       | JWT  | Admin |
| POST   | `/users/{id}/force-logout`         | Revoke all sessions  | JWT  | Admin |
| POST   | `/users/{id}/force-password-reset` | Set force reset flag | JWT  | Admin |

---

## TypeScript Types

### Core Types (`packages/types/src/user.ts`)

```typescript
// User roles
export type UserRole = 'Admin' | 'BudgetOwner' | 'Editor' | 'Viewer';

// User status
export type UserStatus = 'Active' | 'Inactive';

// Account lock status
export type AccountLockStatus = 'Normal' | 'Locked' | 'ForceReset';

// User list item (for table display)
export interface UserListItem {
    id: number;
    email: string;
    role: UserRole;
    isActive: boolean;
    failedAttempts: number;
    lockedUntil: string | null; // ISO 8601 timestamp
    lastLoginAt: string | null; // ISO 8601 timestamp
    createdAt: string; // ISO 8601 timestamp
}

// Create user request
export interface CreateUserRequest {
    email: string;
    password: string;
    role: UserRole;
}

// Update user request
export interface UpdateUserRequest {
    role?: UserRole;
    isActive?: boolean;
    unlockAccount?: boolean;
    forceSessionRevoke?: boolean;
    forcePasswordReset?: boolean;
}

// User response (full)
export interface UserResponse {
    id: number;
    email: string;
    role: UserRole;
    isActive: boolean;
    failedAttempts: number;
    lockedUntil: string | null;
    forcePasswordReset: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
}

// User filters
export interface UserFilters {
    search?: string;
    role?: UserRole;
    isActive?: boolean;
}
```

### Frontend Types (`apps/web/src/types/user.ts`)

```typescript
// Side panel modes
export type UserSidePanelMode = 'create' | 'edit' | null;

// Side panel state
export interface UserSidePanelState {
    mode: UserSidePanelMode;
    userId?: number; // Set when mode is 'edit'
}

// Form data for create
export interface CreateUserFormData {
    email: string;
    password: string;
    role: UserRole;
}

// Form data for edit
export interface EditUserFormData {
    role: UserRole;
    isActive: boolean;
    unlockAccount: boolean;
    forceSessionRevoke: boolean;
}
```

---

## Security Features

### Account Lockout Mechanism

```typescript
// Lockout configuration
const LOCKOUT_CONFIG = {
    maxFailedAttempts: 5, // Lock after 5 failed attempts
    lockoutDurationMinutes: 30, // Lock for 30 minutes
};

// Lockout logic
function checkAccountLockout(user: User): boolean {
    if (user.failedAttempts >= LOCKOUT_CONFIG.maxFailedAttempts) {
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_CONFIG.lockoutDurationMinutes);
        user.lockedUntil = lockoutUntil;
        return true; // Account is now locked
    }
    return false;
}

// Login check
function canLogin(user: User): boolean {
    if (!user.isActive) return false;
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
        return false; // Still locked
    }
    return true;
}
```

### Password Requirements

| Requirement    | Value                             |
| -------------- | --------------------------------- |
| Minimum length | 12 characters                     |
| Complexity     | Upper, lower, number, special     |
| Hashing        | Bcrypt with cost factor 12        |
| History        | Last 5 passwords cannot be reused |
| Expiration     | Optional (configurable)           |

### Session Management

| Setting             | Value                    |
| ------------------- | ------------------------ |
| Access token TTL    | 30 minutes               |
| Refresh token TTL   | 8 hours                  |
| Token rotation      | Every refresh            |
| Family detection    | Replay detection enabled |
| Concurrent sessions | Unlimited (configurable) |

### Self-Action Protection

```typescript
// UI protection against self-modification
function isSelfAction(currentUser: User, targetUserId: number): boolean {
  return currentUser.id === targetUserId;
}

// In component
<ActionsMenu
  disabled={isSelfAction(currentUser, row.userId)}
  tooltip="You cannot modify your own account"
/>
```

---

## Audit Trail

### Operations Logged

| Operation             | Table          | Data Captured                    |
| --------------------- | -------------- | -------------------------------- |
| USER_CREATED          | users          | Email, role, created by          |
| USER_UPDATED          | users          | Role changes, status changes     |
| USER_UNLOCKED         | users          | Admin who unlocked, timestamp    |
| SESSIONS_REVOKED      | refresh_tokens | User ID, count of revoked tokens |
| PASSWORD_RESET_FORCED | users          | Admin who triggered, timestamp   |
| LOGIN_SUCCESS         | users          | IP address, user agent           |
| LOGIN_FAILED          | users          | IP address, failure reason       |
| ACCOUNT_LOCKED        | users          | Lockout timestamp, reason        |

### Audit Entry Schema

```typescript
{
  userId: number;              // Acting user (admin)
  targetUserId: number;        // Affected user
  userEmail: string;           // Acting user email
  operation: string;           // Operation code
  tableName: string;           // 'users' or 'refresh_tokens'
  recordId: number;            // User ID
  ipAddress: string;           // Admin's IP
  oldValues?: {
    role?: string;
    isActive?: boolean;
  };
  newValues: {
    role?: string;
    isActive?: boolean;
    unlocked?: boolean;
  };
  createdAt: Date;
}
```

---

## Error Handling

### Common Error Codes

| Code               | HTTP Status | Description                        | User Action                       |
| ------------------ | ----------- | ---------------------------------- | --------------------------------- |
| UNAUTHORIZED       | 401         | Not authenticated                  | Log in to access this page        |
| FORBIDDEN          | 403         | Not an admin                       | Contact administrator for access  |
| USER_NOT_FOUND     | 404         | User ID does not exist             | Refresh user list                 |
| EMAIL_EXISTS       | 409         | Email already registered           | Use different email address       |
| INVALID_ROLE       | 422         | Role value not recognized          | Select valid role from dropdown   |
| WEAK_PASSWORD      | 422         | Password doesn't meet requirements | Use stronger password (12+ chars) |
| CANNOT_MODIFY_SELF | 422         | Attempted self-modification        | Use profile page for self-changes |
| ACCOUNT_LOCKED     | 423         | Target account is locked           | Unlock account first              |

### Validation Errors

**Email Validation**:

```json
{
    "error": "VALIDATION_ERROR",
    "field": "email",
    "message": "Invalid email format"
}
```

**Password Validation**:

```json
{
    "error": "VALIDATION_ERROR",
    "field": "password",
    "message": "Password must be at least 12 characters"
}
```

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the User Management module.

### High Priority

| ID      | Issue                             | Impact                             | Proposed Solution                                     |
| ------- | --------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| USR-001 | **No bulk user import**           | Adding multiple users is tedious   | Add CSV import for batch user creation                |
| USR-002 | **No password expiration policy** | Stale passwords pose security risk | Add configurable password expiration (e.g., 90 days)  |
| USR-003 | **Limited filtering**             | Cannot combine multiple filters    | Add advanced filter panel with role + status + search |
| USR-004 | **No user activity log**          | Cannot see user's recent actions   | Add activity history view per user                    |

### Medium Priority

| ID      | Issue                       | Impact                               | Proposed Solution                                |
| ------- | --------------------------- | ------------------------------------ | ------------------------------------------------ |
| USR-005 | **No user groups/teams**    | Role-based only, no team structure   | Add user groups for organizational hierarchy     |
| USR-006 | **No session viewing**      | Cannot see active sessions           | Add "View Active Sessions" feature               |
| USR-007 | **No password reset email** | Admin must communicate temp password | Integrate email service for password reset links |
| USR-008 | **No account expiration**   | Temporary accounts remain forever    | Add account expiration dates for contractors     |

### Low Priority / Technical Debt

| ID      | Issue                                 | Impact                                        | Proposed Solution                        |
| ------- | ------------------------------------- | --------------------------------------------- | ---------------------------------------- |
| USR-009 | **Hardcoded role list**               | Roles defined in multiple places              | Centralize role definitions in database  |
| USR-010 | **No API rate limiting on user list** | Large user bases may cause performance issues | Add pagination and cursor-based API      |
| USR-011 | **Client-side timezone conversion**   | AST conversion done in browser                | Return AST-formatted timestamps from API |
| USR-012 | **No user avatar/profile**            | Generic UI for all users                      | Add optional profile photos and details  |

### Feature Requests

| ID      | Feature                       | Business Value                                    | Complexity |
| ------- | ----------------------------- | ------------------------------------------------- | ---------- |
| USR-F01 | **Single Sign-On (SSO)**      | Integrate with school LDAP/Active Directory       | High       |
| USR-F02 | **Two-Factor Authentication** | Enhanced security for admin accounts              | Medium     |
| USR-F03 | **Role Templates**            | Pre-configured permission sets for common roles   | Low        |
| USR-F04 | **User Onboarding Workflow**  | Automated welcome emails and training assignments | Medium     |
| USR-F05 | **Audit Report Export**       | PDF/Excel export of user activity for compliance  | Low        |

---

## Appendix A: Role Permissions Matrix

```
┌─────────────────────┬────────┬─────────────┬────────┬────────┐
│ Feature             │ Admin  │ BudgetOwner │ Editor │ Viewer │
├─────────────────────┼────────┼─────────────┼────────┼────────┤
│ User Management     │   ✅   │     ❌      │   ❌   │   ❌   │
│ Master Data Config  │   ✅   │     ❌      │   ❌   │   ❌   │
│ Create Versions     │   ✅   │     ✅      │   ❌   │   ❌   │
│ Publish Versions    │   ✅   │     ✅      │   ❌   │   ❌   │
│ Edit Budget Data    │   ✅   │     ✅      │   ✅   │   ❌   │
│ Run Calculations    │   ✅   │     ✅      │   ✅   │   ❌   │
│ View Salary Data    │   ✅   │     ✅      │   ✅   │   ❌   │
│ Export Data         │   ✅   │     ✅      │   ✅   │   ✅   │
│ View Reports        │   ✅   │     ✅      │   ✅   │   ✅   │
└─────────────────────┴────────┴─────────────┴────────┴────────┘
```

---

## Appendix B: Account Lockout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Account Lockout State Machine                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐    Failed Login    ┌─────────┐                     │
│   │  NORMAL │ ◄────────────────  │  LOCKED │                     │
│   │  (0-4   │                    │  (5+    │                     │
│   │  fails) │ ────────────────►  │  fails) │                     │
│   └────┬────┘   After 30 min     └────┬────┘                     │
│        │                               │                         │
│        │         Admin Unlock          │                         │
│        │ ◄─────────────────────────────┘                         │
│        │                                                         │
│        │    Successful Login                                     │
│        │    (resets counter to 0)                                │
│        ▼                                                         │
│   ┌─────────┐                                                    │
│   │  LOGIN  │                                                    │
│   │ SUCCESS │                                                    │
│   └─────────┘                                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Lockout Configuration**:

- Max failed attempts: 5
- Lockout duration: 30 minutes
- Counter reset: After successful login or admin unlock

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
