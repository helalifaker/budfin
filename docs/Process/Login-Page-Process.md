# Login Page — Process Workflow

> **Document Purpose**: This document provides a comprehensive, plain-language guide to the Login page authentication flow. It explains the business process, technical implementation, user actions, and security mechanisms. It serves as a reference for auditors, new developers, and security analysts to understand and propose improvements.

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
10. [Security Architecture](#security-architecture)
11. [Audit Trail](#audit-trail)
12. [Error Handling](#error-handling)
13. [Improvements Required](#improvements-required)

---

## Overview

| Attribute            | Value                                                           |
| -------------------- | --------------------------------------------------------------- |
| **Page Name**        | Login                                                           |
| **URL Route**        | `/login`                                                        |
| **Module**           | Authentication & Authorization                                  |
| **Page File**        | `apps/web/src/pages/login.tsx`                                  |
| **Primary Function** | Authenticate users and grant secure access to the BudFin system |

### What This Page Does

The Login page is the **entry gateway** to the BudFin financial planning system. It provides:

1. **User Authentication** — Validates credentials against stored password hashes
2. **Session Management** — Issues JWT access tokens and HTTP-only refresh token cookies
3. **Account Protection** — Implements account lockout after failed attempts
4. **Multi-Tab Synchronization** — Keeps authentication state consistent across browser tabs
5. **Secure Redirects** — Prevents back-button navigation to login after successful auth

**Critical Security Rule**: All authentication uses RS256 asymmetric JWT signing with token rotation and family-based replay detection to prevent token theft and replay attacks.

---

## Business Context

### Authentication Requirements

EFIR (École Française Internationale de Riyad) operates under strict PDPL (Personal Data Protection Law) compliance requirements within KSA:

| Requirement           | Implementation                                                              |
| --------------------- | --------------------------------------------------------------------------- |
| **Data Residency**    | All authentication data stored within KSA                                   |
| **Password Security** | bcrypt hashing with cost factor 12                                          |
| **Session Control**   | Configurable max sessions per user (default: 2)                             |
| **Account Lockout**   | Configurable threshold (default: 5 attempts) and duration (default: 30 min) |
| **Audit Trail**       | All login attempts logged with IP address                                   |

### User Roles

| Role            | Description            | System Access                                |
| --------------- | ---------------------- | -------------------------------------------- |
| **Admin**       | System administrators  | Full system access including user management |
| **BudgetOwner** | Budget planning owners | Create/publish versions, view sensitive data |
| **Editor**      | Data entry staff       | Edit data, run calculations, view reports    |
| **Viewer**      | Read-only users        | View reports and dashboards only             |

### Session Lifecycle

| Phase                   | Duration   | Description                                                      |
| ----------------------- | ---------- | ---------------------------------------------------------------- |
| **Access Token**        | 30 minutes | Short-lived JWT stored in JavaScript memory only                 |
| **Refresh Token**       | 8 hours    | HTTP-only cookie, rotated on each use                            |
| **Idle Timeout**        | None       | No explicit idle timeout (refresh token expiry controls session) |
| **Concurrent Sessions** | 2 max      | Oldest session revoked when limit exceeded                       |

---

## User Roles & Permissions

| Role            | Login | View Own Profile | Manage Users | Configure Security |
| --------------- | ----- | ---------------- | ------------ | ------------------ |
| **Admin**       | ✅    | ✅               | ✅           | ✅                 |
| **BudgetOwner** | ✅    | ✅               | ❌           | ❌                 |
| **Editor**      | ✅    | ✅               | ❌           | ❌                 |
| **Viewer**      | ✅    | ✅               | ❌           | ❌                 |

**Account Lockout Rule**: All login attempts are blocked if the account is locked due to too many failed attempts. Lockout duration is configured via system settings.

---

## Pre-Conditions

Before using this page, the following must be configured:

### Required System Configuration (via Admin → Settings)

1. **Lockout Threshold** (`lockout_threshold`)
    - Number of failed attempts before account lockout (default: 5)
    - Stored in `system_config` table

2. **Lockout Duration** (`lockout_duration_minutes`)
    - Duration of account lockout in minutes (default: 30)
    - Stored in `system_config` table

3. **Max Sessions Per User** (`max_sessions_per_user`)
    - Maximum concurrent active sessions (default: 2)
    - Oldest session is force-revoked when exceeded

### Required User Account

1. **User record** must exist in `users` table with:
    - Valid email address
    - bcrypt-hashed password
    - Assigned role (Admin, BudgetOwner, Editor, or Viewer)
    - `is_active` = true

2. **User must not be locked** (`locked_until` must be null or expired)

---

## Page Layout & UI Elements

### Visual Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│   ░░                                                                  ░░     │
│   ░░   [Animated Gradient Background - Blue/Purple flowing gradient]   ░░     │
│   ░░                                                                  ░░     │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│                                                                             │
│                    ┌─────────────────┐                                      │
│                    │        B        │  BudFin                              │
│                    │   [Logo]        │                                      │
│                    └─────────────────┘                                      │
│                                                                             │
│                    ╔══════════════════════════════════════╗                  │
│                    ║                                    ║                  │
│                    ║   Welcome back                     ║                  │
│                    ║   Sign in to your account          ║                  │
│                    ║                                    ║                  │
│                    ║   ┌────────────────────────────┐   ║                  │
│                    ║   │  Email                     │   ║                  │
│                    ║   │  [you@example.com      ]   │   ║                  │
│                    ║   └────────────────────────────┘   ║                  │
│                    ║                                    ║                  │
│                    ║   ┌────────────────────────────┐   ║                  │
│                    ║   │  Password                  │   ║                  │
│                    ║   │  [••••••••••••••••      ]   │   ║                  │
│                    ║   └────────────────────────────┘   ║                  │
│                    ║                                    ║                  │
│                    ║   ┌────────────────────────────┐   ║                  │
│                    ║   │  ⚠ Invalid credentials     │   ║  [Error Alert]   │
│                    ║   └────────────────────────────┘   ║                  │
│                    ║                                    ║                  │
│                    ║   ┌────────────────────────────┐   ║                  │
│                    ║   │      [  Sign in  ]         │   ║  [Submit Button] │
│                    ║   └────────────────────────────┘   ║                  │
│                    ║                                    ║                  │
│                    ╚══════════════════════════════════════╝                  │
│                                                                             │
│                    [Glassmorphic Card - Frosted glass effect]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Visual Components

| Element               | Description                             | CSS Classes                                    |
| --------------------- | --------------------------------------- | ---------------------------------------------- |
| **Animated Gradient** | Flowing blue/purple background          | `AnimatedGradient` component                   |
| **Glassmorphic Card** | Frosted glass effect container          | `bg-white/10 backdrop-blur-xl border-white/20` |
| **Logo**              | BudFin "B" icon with brand text         | `bg-(--accent-500)` rounded square             |
| **Form Inputs**       | Styled with dark transparent background | `bg-white/10 border-white/20 text-white`       |

### Form Fields

| Field        | Type     | Required | Autocomplete       | Validation             |
| ------------ | -------- | -------- | ------------------ | ---------------------- |
| **Email**    | email    | ✅       | `email`            | HTML5 email validation |
| **Password** | password | ✅       | `current-password` | Required field         |

### Action Elements

| Element            | State   | Behavior                            |
| ------------------ | ------- | ----------------------------------- |
| **Email Input**    | Focus   | Border highlight with accent glow   |
| **Password Input** | Focus   | Border highlight with accent glow   |
| **Error Alert**    | Visible | Shake animation (`animate-shake`)   |
| **Sign In Button** | Loading | Shows spinner, "Signing in..." text |
| **Sign In Button** | Default | "Sign in" text, hover scale effect  |

---

## Step-by-Step Workflow

### Workflow 1: Successful Login

**Actor**: Any user with valid credentials

| Step | Action                   | UI Element           | API Call           | Result                                                     |
| ---- | ------------------------ | -------------------- | ------------------ | ---------------------------------------------------------- |
| 1    | Navigate to `/login`     | URL bar              | -                  | Login page loads with animated gradient                    |
| 2    | Enter email address      | Email input          | -                  | Value displayed, autocomplete suggestions may appear       |
| 3    | Enter password           | Password input       | -                  | Masked characters displayed                                |
| 4    | Click "Sign In" button   | Submit button        | `POST /auth/login` | Request sent with credentials                              |
| 5    | Observe loading state    | Button shows spinner | -                  | "Signing in..." displayed                                  |
| 6    | Receive success response | -                    | 200 OK             | Access token stored in memory, refresh token set as cookie |
| 7    | Redirect to dashboard    | Router navigation    | -                  | `navigate('/', { replace: true })` prevents back-button    |

**Database Changes**:

- Update `users` table: `failedAttempts = 0`, `lockedUntil = null`, `lastLoginAt = now()`
- Insert `refresh_tokens` record with `familyId`, `tokenHash`, `expiresAt`
- Insert `audit_entries` record with operation `LOGIN_SUCCESS`

---

### Workflow 2: Failed Login — Invalid Credentials

**Actor**: Any user with incorrect credentials

| Step | Action                       | UI Element      | API Call           | Result                                     |
| ---- | ---------------------------- | --------------- | ------------------ | ------------------------------------------ |
| 1    | Enter invalid email/password | Form inputs     | -                  | Values entered                             |
| 2    | Submit form                  | Sign In button  | `POST /auth/login` | Request sent                               |
| 3    | Receive error response       | -               | 401 Unauthorized   | Error message extracted from response      |
| 4    | Display error                | Error alert div | -                  | Red alert box with shake animation appears |
| 5    | Increment failed attempts    | -               | -                  | Database updated with `failedAttempts + 1` |

**Security Behavior**:

- Generic error message: "Invalid email or password" (no user enumeration)
- Failed attempts counter incremented
- Audit log entry created with operation `LOGIN_FAILED`

---

### Workflow 3: Failed Login — Account Lockout

**Actor**: User exceeding failed attempt threshold

| Step | Action                           | UI Element       | API Call                    | Result                                           |
| ---- | -------------------------------- | ---------------- | --------------------------- | ------------------------------------------------ |
| 1    | Fail login (threshold - 1) times | Form submissions | Multiple `POST /auth/login` | Each returns 401                                 |
| 2    | Fail login threshold-th time     | Form submission  | `POST /auth/login`          | Account lockout triggered                        |
| 3    | Receive lockout response         | -                | 401 with `ACCOUNT_LOCKED`   | Lockout timestamp returned                       |
| 4    | Display lockout error            | Error alert      | -                           | "Account locked due to too many failed attempts" |
| 5    | Future attempts blocked          | Any submission   | `POST /auth/login`          | Immediate 401 with `ACCOUNT_LOCKED` until expiry |

**Database Changes**:

- Update `users` table: `lockedUntil = now() + durationMinutes`
- Insert `audit_entries` record with operation `ACCOUNT_LOCKED`

---

### Workflow 4: Token Refresh (Background)

**Actor**: Automatic background process

| Step | Action                 | Trigger                   | API Call             | Result                                       |
| ---- | ---------------------- | ------------------------- | -------------------- | -------------------------------------------- |
| 1    | Access token expires   | Time-based (30 min)       | -                    | API calls would start failing with 401       |
| 2    | Refresh triggered      | Before API call or expiry | `POST /auth/refresh` | Cookie automatically sent                    |
| 3    | Validate refresh token | Server-side               | -                    | Token hash looked up, expiry checked         |
| 4    | Rotate token           | Database                  | -                    | New refresh token generated, old marked used |
| 5    | Return new tokens      | Response                  | 200 OK               | New access token + new refresh cookie        |
| 6    | Broadcast to tabs      | `BroadcastChannel`        | -                    | Other tabs receive `TOKEN_REFRESHED` message |

**Security Features**:

- Token rotation: Each refresh generates a new refresh token
- Family tracking: All tokens in a session belong to a family
- Replay detection: Reusing a consumed token revokes the entire family

---

### Workflow 5: Logout

**Actor**: Any authenticated user

| Step | Action               | UI Element         | API Call            | Result                                  |
| ---- | -------------------- | ------------------ | ------------------- | --------------------------------------- |
| 1    | Click "Logout" in UI | Sidebar/Menu       | `POST /auth/logout` | Request sent with bearer token          |
| 2    | Revoke refresh token | Server-side        | -                   | `refresh_tokens.isRevoked = true`       |
| 3    | Clear cookie         | Response header    | -                   | `Set-Cookie` with expired refresh token |
| 4    | Clear memory state   | Auth store         | -                   | `accessToken = null`, `user = null`     |
| 5    | Broadcast logout     | `BroadcastChannel` | -                   | Other tabs receive `LOGOUT` message     |
| 6    | Redirect to login    | Router             | -                   | User sent to `/login`                   |

**Database Changes**:

- Update `refresh_tokens`: `isRevoked = true` for current token
- Insert `audit_entries` record with operation `LOGOUT`

---

## Data Models & Database Schema

### Core Tables

#### 1. users

Stores user account information and authentication state.

```sql
Table: users
┌────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column             │ Type            │ Description                                │
├────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                 │ SERIAL PK       │ Unique identifier                          │
│ email              │ VARCHAR(255)    │ Unique email address                       │
│ password_hash      │ VARCHAR(255)    │ bcrypt hash of password                    │
│ role               │ UserRole ENUM   │ Admin, BudgetOwner, Editor, Viewer         │
│ is_active          │ BOOLEAN         │ Account enabled/disabled                   │
│ failed_attempts    │ INTEGER         │ Consecutive failed login count             │
│ locked_until       │ TIMESTAMPTZ     │ Lockout expiry timestamp (nullable)        │
│ force_password_reset│ BOOLEAN        │ Require password change on next login      │
│ last_login_at      │ TIMESTAMPTZ     │ Last successful login timestamp            │
│ created_at         │ TIMESTAMPTZ     │ Record creation timestamp                  │
│ updated_at         │ TIMESTAMPTZ     │ Last update timestamp                      │
└────────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: email
```

#### 2. refresh_tokens

Stores refresh token hashes for session management.

```sql
Table: refresh_tokens
┌────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column             │ Type            │ Description                                │
├────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                 │ SERIAL PK       │ Unique identifier                          │
│ user_id            │ INTEGER FK      │ → users.id                                 │
│ token_hash         │ VARCHAR(255)    │ SHA-256 hash of refresh token              │
│ family_id          │ UUID            │ Token family identifier                    │
│ is_revoked         │ BOOLEAN         │ Token has been revoked                     │
│ expires_at         │ TIMESTAMPTZ     │ Token expiry timestamp                     │
│ created_at         │ TIMESTAMPTZ     │ Record creation timestamp                  │
└────────────────────┴─────────────────┴────────────────────────────────────────────┘

Unique Constraint: token_hash
Indexes: family_id, (user_id, is_revoked), expires_at
```

#### 3. system_config

Stores configurable system settings.

```sql
Table: system_config
┌────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column             │ Type            │ Description                                │
├────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ key                │ VARCHAR(100) PK │ Setting identifier                         │
│ value              │ TEXT            │ Setting value as string                    │
│ data_type          │ VARCHAR(20)     │ Value type (string, number, boolean)       │
│ description        │ TEXT            │ Human-readable description                 │
│ updated_at         │ TIMESTAMPTZ     │ Last update timestamp                      │
│ updated_by         │ INTEGER FK      │ → users.id (nullable)                      │
└────────────────────┴─────────────────┴────────────────────────────────────────────┘

Authentication-related keys:
- lockout_threshold (default: 5)
- lockout_duration_minutes (default: 30)
- max_sessions_per_user (default: 2)
```

#### 4. audit_entries

Append-only audit log for all authentication events.

```sql
Table: audit_entries
┌────────────────────┬─────────────────┬────────────────────────────────────────────┐
│ Column             │ Type            │ Description                                │
├────────────────────┼─────────────────┼────────────────────────────────────────────┤
│ id                 │ SERIAL PK       │ Unique identifier                          │
│ user_id            │ INTEGER FK      │ → users.id (nullable for failed logins)    │
│ operation          │ VARCHAR(50)     │ Event type (LOGIN_SUCCESS, etc.)           │
│ table_name         │ VARCHAR(100)    │ Affected table                             │
│ record_id          │ INTEGER         │ Affected record ID                         │
│ old_values         │ JSONB           │ Previous values (for updates)              │
│ new_values         │ JSONB           │ New values                                 │
│ ip_address         │ VARCHAR(45)     │ Client IP address                          │
│ user_email         │ VARCHAR(255)    │ Email (for failed login attempts)          │
│ session_id         │ VARCHAR(100)    │ Session/family identifier                  │
│ audit_note         │ TEXT            │ Additional context                         │
│ created_at         │ TIMESTAMPTZ     │ Event timestamp                            │
└────────────────────┴─────────────────┴────────────────────────────────────────────┘

Indexes: created_at, user_id
```

---

## API Endpoints

### Authentication APIs

| Method | Endpoint        | Description          | Auth           | Rate Limit      |
| ------ | --------------- | -------------------- | -------------- | --------------- |
| POST   | `/auth/login`   | Authenticate user    | None           | 10 req / 15 min |
| POST   | `/auth/refresh` | Refresh access token | Refresh cookie | None            |
| POST   | `/auth/logout`  | Revoke session       | Access token   | None            |

---

### POST /auth/login

**Request Body**:

```json
{
    "email": "user@example.com",
    "password": "userpassword123"
}
```

**Success Response (200)**:

```json
{
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "expires_in": 1800,
    "user": {
        "id": 1,
        "email": "user@example.com",
        "role": "Editor"
    }
}
```

**Response Headers**:

```
Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=28800
```

**Error Responses**:

| Status | Code                | Message                                         |
| ------ | ------------------- | ----------------------------------------------- |
| 401    | INVALID_CREDENTIALS | Invalid email or password                       |
| 401    | ACCOUNT_DISABLED    | Account is disabled                             |
| 401    | ACCOUNT_LOCKED      | Account is locked (with locked_until timestamp) |

---

### POST /auth/refresh

**Request**: No body required (uses HTTP-only cookie)

**Success Response (200)**:

```json
{
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "expires_in": 1800,
    "user": {
        "id": 1,
        "email": "user@example.com",
        "role": "Editor"
    }
}
```

**Error Responses**:

| Status | Code                | Description                           |
| ------ | ------------------- | ------------------------------------- |
| 401    | MISSING_TOKEN       | No refresh token cookie provided      |
| 401    | INVALID_TOKEN       | Token hash not found in database      |
| 401    | TOKEN_EXPIRED       | Refresh token has expired             |
| 401    | REFRESH_TOKEN_REUSE | Token reuse detected (family revoked) |
| 401    | ACCOUNT_DISABLED    | User account has been deactivated     |

---

### POST /auth/logout

**Request Headers**:

```
Authorization: Bearer <access_token>
```

**Success Response**: 204 No Content

**Behavior**:

- Revokes refresh token in database
- Clears refresh token cookie
- Creates audit log entry

---

## TypeScript Types

### Auth Store Types (`apps/web/src/stores/auth-store.ts`)

```typescript
interface User {
    id: number;
    email: string;
    role: string;
}

interface AuthState {
    accessToken: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isInitializing: boolean;
    login: (email: string, password: string) => Promise<void>;
    refresh: () => Promise<boolean>;
    logout: () => Promise<void>;
    setAuth: (token: string, user: User) => void;
    clearAuth: () => void;
    initialize: () => Promise<void>;
}
```

### Tab Sync Types (`apps/web/src/lib/tab-sync.ts`)

```typescript
interface AuthUser {
    id: number;
    email: string;
    role: string;
}

type AuthMessage =
    | { type: 'TOKEN_REFRESHED'; accessToken: string; user: AuthUser }
    | { type: 'LOGOUT' };
```

### API Route Types (`apps/api/src/routes/auth.ts`)

```typescript
const loginBodySchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

// JWT Payload
interface AccessTokenPayload {
    sub: number; // User ID
    email: string;
    role: string;
    sessionId: string; // Token family ID
}
```

---

## Security Architecture

### JWT Token Structure

#### Access Token (RS256 Signed)

```json
{
    "header": {
        "alg": "RS256",
        "typ": "JWT"
    },
    "payload": {
        "sub": 1,
        "email": "user@example.com",
        "role": "Editor",
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "iat": 1709876543,
        "exp": 1709878343
    }
}
```

**Storage**: JavaScript memory only (never localStorage/cookies)
**TTL**: 30 minutes
**Signing**: RS256 with private key (server-only)

#### Refresh Token (Opaque)

**Format**: Cryptographically random string (32+ bytes)
**Storage**: HTTP-only, Secure, SameSite=Strict cookie
**TTL**: 8 hours
**Database**: SHA-256 hash stored, plaintext never persisted

### Token Family Rotation

```
Login
  │
  ▼
┌─────────────┐     ┌─────────────┐
│  Token A    │────►│  Token B    │
│  (issued)   │     │  (rotated)  │
└─────────────┘     └──────┬──────┘
     (consumed)            │
                           ▼
                     ┌─────────────┐
                     │  Token C    │
                     │  (rotated)  │
                     └─────────────┘
```

**Replay Detection**: Presenting a consumed Token A triggers family revocation

### Session Management

| Feature                    | Implementation                                        |
| -------------------------- | ----------------------------------------------------- |
| **Max Sessions**           | Configurable (default: 2) per user                    |
| **Session Revocation**     | Oldest session revoked when limit exceeded            |
| **Concurrent Tab Sync**    | `BroadcastChannel` for cross-tab communication        |
| **Token Refresh Debounce** | 2-second window to prevent duplicate refresh requests |

### Rate Limiting

| Endpoint             | Limit       | Window     |
| -------------------- | ----------- | ---------- |
| POST /auth/login     | 10 requests | 15 minutes |
| Other auth endpoints | No limit    | -          |

### Password Security

| Aspect            | Implementation            |
| ----------------- | ------------------------- |
| Hashing Algorithm | bcrypt                    |
| Cost Factor       | 12                        |
| Minimum Length    | Enforced at user creation |
| Storage           | Never stored in plaintext |

---

## Audit Trail

### Operations Logged

| Operation                  | Trigger               | Data Captured       |
| -------------------------- | --------------------- | ------------------- |
| LOGIN_SUCCESS              | Valid credentials     | User ID, email, IP  |
| LOGIN_FAILED               | Invalid password      | User ID, email, IP  |
| LOGIN_FAILED_UNKNOWN_EMAIL | Email not found       | Attempted email, IP |
| ACCOUNT_LOCKED             | Threshold exceeded    | User ID, email, IP  |
| SESSION_FORCE_REVOKED      | Max sessions exceeded | Family ID, reason   |
| LOGOUT                     | User logout           | User ID, IP         |
| REFRESH_TOKEN_REUSE        | Token replay detected | Token hash, IP      |
| REFRESH_REJECTED_INACTIVE  | Inactive user refresh | User ID, email, IP  |

### Audit Entry Example

```json
{
    "userId": 1,
    "userEmail": "user@example.com",
    "operation": "LOGIN_SUCCESS",
    "tableName": "users",
    "recordId": 1,
    "ipAddress": "192.168.1.100",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "oldValues": null,
    "newValues": null,
    "createdAt": "2026-03-10T09:30:00Z"
}
```

---

## Error Handling

### Client-Side Error Codes

| Error Display                 | Trigger           | User Action             |
| ----------------------------- | ----------------- | ----------------------- |
| "Invalid email or password"   | Wrong credentials | Re-enter credentials    |
| "Account is locked"           | Lockout active    | Wait for lockout expiry |
| "Account is disabled"         | is_active = false | Contact administrator   |
| "Unable to sign in right now" | Server error      | Retry later             |

### Server-Side Error Codes

| Code                | HTTP | Description                 | Response Body                     |
| ------------------- | ---- | --------------------------- | --------------------------------- |
| INVALID_CREDENTIALS | 401  | Email or password incorrect | `{ code, message }`               |
| ACCOUNT_DISABLED    | 401  | User account deactivated    | `{ code, message }`               |
| ACCOUNT_LOCKED      | 401  | Account temporarily locked  | `{ code, message, locked_until }` |
| MISSING_TOKEN       | 401  | No refresh token provided   | `{ code, message }`               |
| INVALID_TOKEN       | 401  | Refresh token not found     | `{ code, message }`               |
| TOKEN_EXPIRED       | 401  | Refresh token expired       | `{ code, message }`               |
| REFRESH_TOKEN_REUSE | 401  | Token reuse detected        | `{ code, message }`               |

---

## Improvements Required

This section documents known issues, technical debt, and proposed enhancements for the Login & Authentication module.

### High Priority

| ID       | Issue                                | Impact                                 | Proposed Solution                                            |
| -------- | ------------------------------------ | -------------------------------------- | ------------------------------------------------------------ |
| AUTH-001 | **No password strength indicator**   | Users may choose weak passwords        | Add real-time password strength meter during password change |
| AUTH-002 | **No "Remember Me" explicit option** | Sessions always last 8 hours           | Add explicit remember me checkbox with extended duration     |
| AUTH-003 | **No 2FA/MFA support**               | Single factor only limits security     | Implement TOTP-based 2FA for Admin/BudgetOwner roles         |
| AUTH-004 | **No CAPTCHA on repeated failures**  | Brute force possible within rate limit | Add reCAPTCHA after 3 failed attempts                        |

### Medium Priority

| ID       | Issue                             | Impact                            | Proposed Solution                                         |
| -------- | --------------------------------- | --------------------------------- | --------------------------------------------------------- |
| AUTH-005 | **No device/session listing**     | Users cannot view active sessions | Add "Active Sessions" page with revoke capability         |
| AUTH-006 | **Generic error messages**        | Harder to debug legitimate issues | Log specific errors server-side, keep generic client-side |
| AUTH-007 | **No password expiration policy** | Old passwords may be compromised  | Add configurable password expiration (e.g., 90 days)      |
| AUTH-008 | **No login notification emails**  | Users unaware of account access   | Send email on login from new IP/device                    |

### Low Priority / Technical Debt

| ID       | Issue                                 | Impact                           | Proposed Solution                        |
| -------- | ------------------------------------- | -------------------------------- | ---------------------------------------- |
| AUTH-009 | **No unit tests for edge cases**      | Zero headcounts, rounding errors | Add comprehensive test coverage          |
| AUTH-010 | **Hardcoded config defaults**         | Fallback values in code          | Move all defaults to configuration file  |
| AUTH-011 | **No OAuth/SAML integration**         | Manual user management required  | Add SSO integration for enterprise users |
| AUTH-012 | **BroadcastChannel fallback missing** | Older browsers lack tab sync     | Add `localStorage` polling fallback      |

### Security Enhancements

| ID       | Feature                           | Security Value                         | Complexity |
| -------- | --------------------------------- | -------------------------------------- | ---------- |
| AUTH-S01 | **Hardware security key support** | Phishing-resistant MFA                 | High       |
| AUTH-S02 | **Anomaly detection**             | Detect unusual login patterns          | Medium     |
| AUTH-S03 | **Geo-location restrictions**     | Block logins from unexpected countries | Low        |
| AUTH-S04 | **Session binding**               | Bind to IP/user-agent                  | Medium     |

---

## Appendix A: Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOGIN FLOW                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────┐                    ┌─────────┐                    ┌─────────┐  │
│   │  User   │                    │   API   │                    │ Database│  │
│   └────┬────┘                    └────┬────┘                    └────┬────┘  │
│        │                              │                              │      │
│        │ POST /auth/login             │                              │      │
│        │ {email, password}            │                              │      │
│        │─────────────────────────────>│                              │      │
│        │                              │                              │      │
│        │                              │ SELECT * FROM users          │      │
│        │                              │ WHERE email = ?              │      │
│        │                              │─────────────────────────────>│      │
│        │                              │                              │      │
│        │                              │ User record (or null)        │      │
│        │                              │<─────────────────────────────│      │
│        │                              │                              │      │
│        │                              │ [If not found]               │      │
│        │                              │ Audit: LOGIN_FAILED_UNKNOWN  │      │
│        │ 401 INVALID_CREDENTIALS      │                              │      │
│        │<─────────────────────────────│                              │      │
│        │                              │                              │      │
│        │                              │ [If found]                   │      │
│        │                              │ bcrypt.compare(password)     │      │
│        │                              │                              │      │
│        │                              │ [If invalid]                 │      │
│        │                              │ UPDATE failed_attempts + 1   │      │
│        │                              │                              │      │
│        │ 401 INVALID_CREDENTIALS      │ [If threshold reached]       │      │
│        │<─────────────────────────────│ UPDATE locked_until          │      │
│        │                              │ Audit: ACCOUNT_LOCKED        │      │
│        │                              │                              │      │
│        │                              │ [If valid]                   │      │
│        │                              │ BEGIN TRANSACTION            │      │
│        │                              │ Check max sessions           │      │
│        │                              │ Revoke oldest if exceeded    │      │
│        │                              │ Create refresh token family  │      │
│        │                              │ UPDATE last_login_at         │      │
│        │                              │ COMMIT                       │      │
│        │                              │                              │      │
│        │                              │ Sign JWT (RS256)             │      │
│        │                              │ Audit: LOGIN_SUCCESS         │      │
│        │                              │                              │      │
│        │ 200 OK                       │                              │      │
│        │ {access_token, user}         │                              │      │
│        │ Set-Cookie: refresh_token    │                              │      │
│        │<─────────────────────────────│                              │      │
│        │                              │                              │      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TOKEN REFRESH FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────┐                    ┌─────────┐                    ┌─────────┐  │
│   │  Client │                    │   API   │                    │ Database│  │
│   └────┬────┘                    └────┬────┘                    └────┬────┘  │
│        │                              │                              │      │
│        │ POST /auth/refresh           │                              │      │
│        │ Cookie: refresh_token        │                              │      │
│        │─────────────────────────────>│                              │      │
│        │                              │                              │      │
│        │                              │ SHA256(token)                │      │
│        │                              │ SELECT * FROM refresh_tokens │      │
│        │                              │ WHERE token_hash = ?         │      │
│        │                              │─────────────────────────────>│      │
│        │                              │                              │      │
│        │                              │ Token record                 │      │
│        │                              │<─────────────────────────────│      │
│        │                              │                              │      │
│        │                              │ [If not found]               │      │
│        │ 401 INVALID_TOKEN            │                              │      │
│        │<─────────────────────────────│                              │      │
│        │                              │                              │      │
│        │                              │ [If is_revoked = true]       │      │
│        │                              │ UPDATE all family tokens     │      │
│        │                              │ SET is_revoked = true        │      │
│        │                              │ Audit: REFRESH_TOKEN_REUSE   │      │
│        │ 401 REFRESH_TOKEN_REUSE      │                              │      │
│        │<─────────────────────────────│                              │      │
│        │                              │                              │      │
│        │                              │ [If expired]                 │      │
│        │ 401 TOKEN_EXPIRED            │                              │      │
│        │<─────────────────────────────│                              │      │
│        │                              │                              │      │
│        │                              │ [If valid]                   │      │
│        │                              │ Mark old token as revoked    │      │
│        │                              │ Create new token in family   │      │
│        │                              │ Sign new JWT                 │      │
│        │                              │                              │      │
│        │ 200 OK                       │                              │      │
│        │ {access_token, user}         │                              │      │
│        │ Set-Cookie: refresh_token    │                              │      │
│        │<─────────────────────────────│                              │      │
│        │                              │                              │      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0     | 2026-03-10 | AI Assistant | Initial document creation |

---

_End of Document_
