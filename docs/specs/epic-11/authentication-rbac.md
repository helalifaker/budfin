# Feature Spec: Authentication & RBAC

> Epic: #4 | Phase: 4 -- SPECIFY | Status: Draft | Date: 2026-03-06

## Summary

Authentication & RBAC provides the security foundation for BudFin. It implements RS256-signed JWT access tokens (30-minute TTL, held in memory only) paired with opaque refresh tokens (8-hour TTL, HTTP-only SameSite=Strict cookie), token family rotation with replay-based theft detection, bcrypt password hashing (cost 12), a 4-role RBAC permission matrix (Admin > BudgetOwner > Editor > Viewer), account lockout after 5 failed attempts (30-minute window), and a configurable session concurrency limit (default 2). The Admin module provides user account CRUD with role assignment, an append-only audit trail viewer with date/user/action/entity filters, and grouped system configuration settings. Every protected route is gated by RBAC middleware; every authorization failure and auth event is logged to the audit trail. References PRD FR-SEC-01 through FR-SEC-05, US-018, US-020, US-023, NFR 11.3.

## Acceptance Criteria

Each criterion must be testable and specific. Use "Given / When / Then" or plain language.

- [ ] AC-01: Given valid credentials, when a user calls POST /api/v1/auth/login, then the response contains an access_token (JWT, RS256), expires_in: 1800, user object (id, email, role), and a Set-Cookie header with refresh_token (HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth, Max-Age=28800).
- [ ] AC-02: Given invalid credentials, when a user calls POST /api/v1/auth/login, then the response is 401 with code INVALID_CREDENTIALS, and the user's failed_attempts is incremented by 1.
- [ ] AC-03: Given a user with 4 failed attempts, when the 5th failed login occurs, then the user's locked_until is set to NOW() + 30 minutes, the response is 401 with code ACCOUNT_LOCKED and includes locked_until (ISO 8601), and an audit entry with operation ACCOUNT_LOCKED is created.
- [ ] AC-04: Given a locked user, when an Admin calls PATCH /api/v1/users/:id with { "unlock_account": true }, then locked_until is cleared, failed_attempts is reset to 0, and an audit entry with operation ACCOUNT_UNLOCKED is created.
- [ ] AC-05: Given a valid refresh token cookie, when POST /api/v1/auth/refresh is called, then the old refresh token is revoked, a new token pair is issued (same family_id), and the new refresh token is set via Set-Cookie.
- [ ] AC-06: Given a revoked refresh token from family F1, when an attacker replays it, then all tokens in family F1 are revoked, all sessions for the affected user are invalidated, the response is 401 with code REFRESH_TOKEN_REUSE, and an audit entry with operation TOKEN_FAMILY_REVOKED is created.
- [ ] AC-07: Given a user with 2 active sessions (the configured max_sessions_per_user), when a 3rd login occurs, then the oldest session's refresh token is revoked, a new session is created, and an audit entry with operation SESSION_FORCE_REVOKED is created.
- [ ] AC-08: Given an authenticated user with a refresh token cookie, when POST /api/v1/auth/logout is called, then the refresh token is marked as revoked, the Set-Cookie header clears the cookie, and the response is 204.
- [ ] AC-09: Given a valid access token, when GET /api/v1/context is called, then the response contains user (id, email, role), schoolYear, and permissions array matching the RBAC matrix for the user's role.
- [ ] AC-10: Given a user with role Viewer, when they call an endpoint requiring data:edit permission (e.g., POST /api/v1/versions/:id/enrollment), then the response is 403 with code FORBIDDEN and message "Insufficient permissions", and an audit entry is logged.
- [ ] AC-11: Given a user with role Viewer (no salary:view permission), when querying employee data, then all 5 salary-related encrypted fields are returned as null in the API response.
- [ ] AC-12: Given an Admin user, when they call POST /api/v1/users with valid email, password (min 8 chars), and role, then a new user is created with password_hash (bcrypt cost 12), is_active=true, failed_attempts=0, and the response is 201 with the user object.
- [ ] AC-13: Given an Admin user, when they call GET /api/v1/audit with filters (from, to, user_id, operation, table_name, page, page_size), then the response contains matching audit entries with total count, sorted reverse chronologically, with page_size default 50 and max 200.
- [ ] AC-14: Given an Admin user, when they call PUT /api/v1/system-config with updates array, then each key-value pair is updated in the system_config table, the response contains the count of updated keys, and each change is logged to audit_entries.
- [ ] AC-15: Given any auth event (login success, login failure, logout, token rotation, account lockout, account unlock, session revocation, family revocation, user CRUD, config change), then an audit_entries record is created with the correct operation, user_id, ip_address, and timestamp.

## Stories

| # | Story | Depends On | GitHub Issue |
|---|-------|------------|--------------|
| 1 | Prisma schema: users, refresh_tokens, system_config, audit_entries tables + Role enum + indexes + seed admin user | -- | #25 |
| 2 | Password hashing service (bcrypt cost 12, hash + compare) | Story 1 | #26 |
| 3 | JWT token service (RS256 sign/verify via jose, access + refresh pair generation) | Story 1 | #27 |
| 4 | Token family rotation + replay detection (family_id tracking, revoke-on-reuse) | Story 3 | #28 |
| 5 | Login endpoint + account lockout (POST /auth/login, failed_attempts, locked_until) | Stories 2, 3, 4 | #29 |
| 6 | Refresh, logout endpoints + session concurrency enforcement (max 2 sessions, oldest eviction) | Stories 4, 5 | #30 |
| 7 | RBAC middleware (requireRole, requirePermission) + permission map + 403 logging | Story 3 | #31 |
| 8 | User management endpoints (GET/POST/PATCH /users, Admin-only CRUD, unlock, force-logout) | Stories 5, 7 | #32 |
| 9 | Audit trail endpoint + system config endpoints (GET /audit, GET/PUT /system-config) | Stories 7, 8 | #33 |
| 10 | Admin UI: User Management, Audit Trail, System Settings pages (ManagementShell, TanStack Table v8, side panel CRUD) | Stories 8, 9 | #34 |

## Data Model Changes

```sql
-- Role enum
CREATE TYPE user_role AS ENUM ('Admin', 'BudgetOwner', 'Editor', 'Viewer');

-- Users table
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            user_role NOT NULL DEFAULT 'Viewer',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  force_password_reset BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  family_id   UUID NOT NULL,
  is_revoked  BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, is_revoked)
  WHERE is_revoked = FALSE;

-- System config table
CREATE TABLE system_config (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  data_type   VARCHAR(20) NOT NULL DEFAULT 'string',
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  INTEGER REFERENCES users(id)
);

-- Audit entries table (append-only)
CREATE TABLE audit_entries (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  operation   VARCHAR(50) NOT NULL,
  table_name  VARCHAR(100),
  record_id   INTEGER,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entries_created ON audit_entries(created_at);
CREATE INDEX idx_audit_entries_user ON audit_entries(user_id);

-- Append-only enforcement
REVOKE UPDATE, DELETE ON audit_entries FROM app_user;
GRANT INSERT, SELECT ON audit_entries TO app_user;

-- Seed admin user (password: changeme123 -- must be changed on first login)
-- INSERT INTO users (email, password_hash, role, force_password_reset)
-- VALUES ('admin@efir.edu.sa', '<bcrypt hash>', 'Admin', TRUE);

-- Seed system_config defaults
-- INSERT INTO system_config (key, value, data_type, description) VALUES
--   ('max_sessions_per_user', '2', 'number', 'Maximum concurrent sessions per user'),
--   ('session_timeout_minutes', '30', 'number', 'Session timeout in minutes'),
--   ('lockout_threshold', '5', 'number', 'Failed login attempts before lockout'),
--   ('lockout_duration_minutes', '30', 'number', 'Lockout duration in minutes'),
--   ('fiscal_year_start_month', '9', 'number', 'Fiscal year start month (1-12)'),
--   ('fiscal_year_range', '10', 'number', 'Fiscal year range in years'),
--   ('autosave_interval_seconds', '30', 'number', 'Auto-save interval in seconds');
```

## API Endpoints

| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| POST | /api/v1/auth/login | `{ email: string, password: string }` | `{ access_token: string, expires_in: 1800, user: { id, email, role } }` + Set-Cookie | Public |
| POST | /api/v1/auth/refresh | No body (reads refresh_token cookie) | Same shape as login + new Set-Cookie | Public (cookie) |
| POST | /api/v1/auth/logout | No body (reads refresh_token cookie) | 204 No Content + clear cookie | Authenticated |
| GET | /api/v1/context | -- | `{ user: { id, email, role }, schoolYear: {...}, permissions: string[] }` | Authenticated |
| GET | /api/v1/users | -- | `{ users: [{ id, email, role, is_active, last_login, failed_attempts, locked_until, created_at }] }` | Admin |
| POST | /api/v1/users | `{ email: string, password: string, role: string }` | `{ id, email, role }` (201) | Admin |
| PATCH | /api/v1/users/:id | `{ role?, is_active?, force_password_reset?, unlock_account?, force_session_revoke? }` | Updated user object | Admin |
| GET | /api/v1/audit | Query: from, to, user_id, table_name, operation, page, page_size | `{ entries: [...], total, page, page_size }` | Admin |
| GET | /api/v1/system-config | -- | `{ config: [{ key, value, description, data_type }] }` | Admin |
| PUT | /api/v1/system-config | `{ updates: [{ key: string, value: string }] }` | `{ updated: number }` | Admin |

## UI/UX Specification

> Source: `docs/ui-ux-spec/09-admin.md` | Cross-cutting: `00-global-framework.md`, `00b-workspace-philosophy.md`

### Shell & Layout

ManagementShell -- no context bar, no docked right panel. The Admin module is version-independent (per 00b-workspace-philosophy.md). Sidebar contains three nav items under the Admin group: User Settings (/admin/users), Audit Trail (/admin/audit), System Settings (/admin/settings). The entire Admin sidebar group is hidden for non-Admin roles.

### Key Components

| Component | Type | Source | Notes |
|-----------|------|--------|-------|
| User table | TanStack Table v8 | 09-admin.md Section 3.2 | 8 columns (email, role, status, last_login, failed_attempts, locked_until, created_at, actions). Client-side sort/filter. Email left-pinned. 44px row height. |
| Role badges | shadcn/ui Badge (custom) | 09-admin.md Section 3.3 | Color-coded per role: Admin=red, BudgetOwner=blue, Editor=green, Viewer=slate. |
| Status badges | shadcn/ui Badge (custom) | 09-admin.md Section 3.3 | Active=green, Inactive=slate. |
| Add/Edit user side panel | Overlay side panel (480px) | 09-admin.md Section 3.6 | Slide-in from right. Create: email+password+role. Edit: role+active toggle+reset password. Focus trap. |
| Confirmation dialogs | shadcn/ui AlertDialog | 09-admin.md Section 3.7 | Deactivate, activate, force logout. Destructive variant for deactivate/force-logout. |
| Permissions matrix panel | Collapsible panel | 09-admin.md Section 3.8 | Shows on row click. Read-only RBAC matrix with selected role column highlighted. |
| Audit trail table | TanStack Table v8 | 09-admin.md Section 4.2 | 6 columns (timestamp, user, action, entity, record_id, audit_note). Server-side pagination (50/page). Reverse chronological. |
| Audit toolbar filters | shadcn/ui DatePicker + Select | 09-admin.md Section 4.1 | Date range, user, action type, entity. Debounced 300ms. |
| System settings cards | shadcn/ui Card | 09-admin.md Section 5.2 | 3 groups: Session, Security, Application. Number inputs + select. Left-border highlight on change. |
| Save button | shadcn/ui Button | 09-admin.md Section 5.1 | Disabled when no pending changes. Unsaved changes warning on navigation. |

### User Flows

1. **Admin creates user**: Admin -> clicks "+ Add User" -> side panel opens (create mode) -> fills email, password, role -> clicks Save -> POST /api/v1/users -> toast "User created" -> table refreshes -> panel closes.
2. **Admin edits user role**: Admin -> clicks Edit on user row -> side panel opens (edit mode) -> changes role dropdown -> clicks Save -> PATCH /api/v1/users/:id -> toast "User updated" -> table refreshes.
3. **Admin unlocks account**: Admin -> sees locked row (red left border) -> clicks Unlock button -> PATCH /api/v1/users/:id with unlock_account: true -> toast "Account unlocked" -> row updates.
4. **Admin reviews audit trail**: Admin -> navigates to /admin/audit -> sets date range + filters -> GET /api/v1/audit with params -> table renders entries -> navigates pages.
5. **Admin updates system settings**: Admin -> navigates to /admin/settings -> modifies values (fields highlight) -> clicks Save Changes -> PUT /api/v1/system-config -> toast "System settings updated" -> highlights clear.

### Interaction Patterns

- No inline editing in user table -- all edits via side panel.
- Audit trail is read-only with server-side pagination (no client-side sorting).
- System settings use change tracking with left-border highlight on modified fields.
- Unsaved changes warning on navigation away from settings (AlertDialog).
- Self-protection: Admin cannot deactivate, change role, or force-logout their own account.

### Accessibility Requirements

- User table: role="grid" with proper row/gridcell/columnheader roles.
- Badges use text labels (not color-only). Screen readers announce full role/status names.
- Failed attempts >= 3: aria-label="N failed attempts, elevated risk".
- Locked accounts: aria-label="Account locked until {datetime}".
- Permissions matrix: role="table" with aria-label, aria-current on selected column.
- Audit log: role="grid" with aria-label, aria-live="polite" for pagination state.
- Settings: label elements on all inputs, fieldset/legend for groups.
- Dialogs: focus trap, Escape to close, role="alertdialog" for destructive actions.
- Keyboard: Tab/Arrow for table navigation, Enter to edit, Space for permissions panel, Escape to close panels, Ctrl+S to save settings.

### Responsive / Viewport

> BudFin targets desktop (1280px min). The Admin module uses ManagementShell with full-width content area. User table columns have defined minimum widths with column resizing enabled (min 80px). Side panel overlays at 480px width. No mobile layout considerations in v1.

## Edge Cases Cross-Reference

From `docs/edge-cases/` -- list all relevant cases for this feature.

| Case ID | Description | Handling |
|---------|-------------|---------|
| PO-027 | Audit trail retention lifecycle -- after 7 years, archive or delete? | 7-year retention guaranteed. Archive policy TBD before go-live (decision point -- does not block v1 implementation). Audit entries are append-only at DB level. |
| EC-AUTH-01 | Token replay attack (revoked refresh token reused) | Family-based revocation: all tokens in the family are revoked, all user sessions invalidated, logged as TOKEN_FAMILY_REVOKED. |
| EC-AUTH-02 | Concurrent login race condition (two logins at exact same time for same user at session limit) | Use database advisory lock on user_id during session enforcement to serialize concurrent login attempts. |
| EC-AUTH-03 | Clock skew on JWT expiration (server clocks slightly out of sync) | jose library supports clockTolerance option. Set 5-second leeway for JWT verification. |
| EC-AUTH-04 | Role change impact on active sessions | Active sessions inherit the new role on next token refresh. The access token retains the old role until it expires (max 30 minutes). No immediate session invalidation on role change -- acceptable given short TTL. |
| EC-AUTH-05 | Admin deactivates their own account | Self-protection rule: Deactivate button hidden on own row. API also rejects self-deactivation with 400. |
| EC-AUTH-06 | Last Admin account deactivation | API prevents deactivating the last active Admin user (400 with code LAST_ADMIN). |

## Out of Scope

- SSO / OAuth / SAML integration (v2)
- Multi-factor authentication (v2)
- Password complexity rules beyond minimum 8 characters (v2)
- Self-service password reset via email (v2 -- admin resets only in v1)
- User profile editing by non-admins (v2)
- Granular per-resource permissions (v2 -- role-based only in v1)
- Audit trail CSV/Excel export (v2, FR-AUD-004 deferred)
- Audit trail field-level diff view (old_values/new_values display deferred to v2)
- Password expiration / forced rotation policy (v2)

## Open Questions

None -- all design decisions resolved via TDD docs (05_security.md, 02_component_design.md, 04_api_contract.md) and UI/UX spec (09-admin.md).

## Planner Agent Sign-Off

- [ ] No open questions
- [ ] Acceptance criteria are testable
- [ ] Edge cases cross-referenced
- [ ] Data model complete
- [ ] API contract complete
- [ ] UI/UX specification complete (or "N/A -- backend-only epic")
