# BudFin Technical Design Document v1.0

## Section 7 — Security Architecture

### 7.1 Authentication Design

BudFin uses JWT-based stateless authentication with asymmetric signing to eliminate shared-secret risk.

**Token pair:**

| Token | Format | TTL | Signing | Storage |
| ------- | -------- | ----- | --------- | --------- |
| Access token | JWT (RFC 7519) | 30 minutes | RS256 (asymmetric) | JavaScript memory (never localStorage, never sessionStorage) |
| Refresh token | Cryptographically random 32-byte string | 8 hours | N/A (opaque) | HTTP-only, Secure, SameSite=Strict cookie (path: `/api/v1/auth`) |

**Access token payload:**

```json
{
  "userId": 42,
  "role": "Editor",
  "sessionId": "uuid-v4",
  "iat": 1709452200,
  "exp": 1709454000
}
```

The refresh token is never returned in a response body. It is set exclusively as an HTTP-only cookie, which prevents JavaScript access and mitigates XSS-based token theft. The access token is returned in the response body and held in a JavaScript closure or React context — never persisted to any browser storage API.

Password hashing uses bcrypt with a cost factor of **12**, producing approximately 250ms hash time on modern hardware. This is sufficient for a system serving no more than 20 concurrent users (NFR 11.3.1) and provides strong resistance against offline brute-force attacks.

#### Token Refresh Rotation (Token Family Pattern)

Every time a refresh token is used, the server immediately revokes it and issues a new access/refresh pair. Each refresh token belongs to a `family_id` (UUID v4), which groups all tokens derived from a single login event.

**Theft detection logic:**

1. Client presents refresh token `T1` (family `F1`).
2. Server verifies `T1` exists, is not revoked, and has not expired.
3. Server marks `T1` as revoked and issues new pair `T2` (same family `F1`).
4. If an attacker later replays `T1` (already revoked), the server detects a revoked token from family `F1`.
5. Server immediately revokes **all** tokens in family `F1` and forces re-authentication for the affected user.
6. Event logged to `audit_entries` with operation `TOKEN_FAMILY_REVOKED`.

Family tracking is stored in the `refresh_tokens` table (see Section 5 — Data Architecture).

#### Session Concurrency

- Maximum **2** concurrent active sessions per user (configurable via `system_config` table, key `max_sessions_per_user`).
- A third login attempt automatically revokes the oldest active session (by `created_at`).
- Admin can force-revoke all sessions for any user via `PATCH /api/v1/users/:id` with body `{ "force_session_revoke": true }`.
- Session revocation logged to `audit_entries` with operation `SESSION_FORCE_REVOKED`.

### 7.2 Account Lockout Policy

| Parameter | Value |
| ----------- | ------- |
| Max consecutive failures | 5 |
| Lockout duration | 30 minutes |
| Tracking scope | Per email address |
| Reset on success | `failed_attempts = 0`, `locked_until = NULL` |

**Lockout flow:**

1. Each failed login increments `users.failed_attempts` and logs to `audit_entries` with operation `LOGIN_FAILED`.
2. When `failed_attempts` reaches 5, the server sets `locked_until = NOW() + INTERVAL '30 minutes'`.
3. Lock event logged to `audit_entries` with operation `ACCOUNT_LOCKED`.
4. During lockout, any login attempt for that email returns HTTP 401 with body:

```json
{
  "code": "ACCOUNT_LOCKED",
  "locked_until": "2026-03-03T11:00:00.000Z"
}
```

1. On successful login after lockout expires: `failed_attempts` resets to 0 and `locked_until` is cleared.
2. Admin unlock: `PATCH /api/v1/users/:id` with `{ "unlock_account": true }` — clears `locked_until` and resets `failed_attempts`. Logged to `audit_entries` with operation `ACCOUNT_UNLOCKED`.

### 7.3 RBAC Matrix

BudFin defines four roles with progressively increasing privileges. The role hierarchy is: Viewer < Editor < BudgetOwner < Admin.

| Permission | Admin | BudgetOwner | Editor | Viewer |
| --- | --- | --- | --- | --- |
| View all planning data (read-only) | Y | Y | Y | Y |
| Export reports (xlsx/pdf/csv) | Y | Y | Y | Y |
| Enter/edit planning data | Y | Y | Y | -- |
| Run calculations | Y | Y | Y | -- |
| Import CSV/xlsx data | Y | Y | Y | -- |
| View salary fields | Y | Y | Y | -- |
| Create budget versions | Y | Y | -- | -- |
| Delete draft versions | Y | Y | -- | -- |
| Publish versions (Draft -> Published) | Y | Y | -- | -- |
| Lock versions (Published -> Locked) | Y | Y | -- | -- |
| Archive versions | Y | -- | -- | -- |
| Reverse lifecycle (Locked -> Published) | Y | -- | -- | -- |
| Manage users | Y | -- | -- | -- |
| View audit trail | Y | -- | -- | -- |
| Edit system config | Y | -- | -- | -- |
| Force unlock accounts | Y | -- | -- | -- |

**Enforcement architecture:**

- **Middleware layer:** RBAC middleware runs on every protected route. It reads the `role` field from the verified JWT payload and compares against the required permission for the route. Unauthorized access returns HTTP 403 with `{ "code": "FORBIDDEN", "message": "Insufficient permissions" }`. Every 403 is logged to `audit_entries`.
- **Repository layer:** For users with the Viewer role, all salary-related fields (`base_salary_encrypted`, `housing_allowance_encrypted`, `transport_allowance_encrypted`, `responsibility_premium_encrypted`, `hsa_amount_encrypted`) are filtered to `null` before the response leaves the repository. This prevents salary data from ever reaching the API response serializer for unauthorized roles.
- **Ownership checks:** Version-scoped operations verify that the requesting user's fiscal year scope includes the target version. This is enforced in the repository layer with a `WHERE` clause that joins against `budget_versions` to confirm fiscal year alignment.

### 7.4 PDPL Compliance (KSA Personal Data Protection Law)

#### Classified Data Fields

| Field | Classification | Protection Measure |
| --- | --- | --- |
| `employees.base_salary_encrypted` | Confidential | pgcrypto AES-256 field encryption |
| `employees.housing_allowance_encrypted` | Confidential | pgcrypto AES-256 field encryption |
| `employees.transport_allowance_encrypted` | Confidential | pgcrypto AES-256 field encryption |
| `employees.responsibility_premium_encrypted` | Confidential | pgcrypto AES-256 field encryption |
| `employees.hsa_amount_encrypted` | Confidential | pgcrypto AES-256 field encryption |
| `users.password_hash` | Confidential | bcrypt cost 12 |
| `refresh_tokens.token_hash` | Confidential | bcrypt hashed; HTTP-only cookie transport |
| `employees.name`, `joining_date` | Personal | Access control (authenticated users only) |
| `audit_entries.ip_address` | Personal | Retained 7 years; access restricted to Admin role |

#### Field-Level Encryption Implementation

Salary fields are encrypted at rest using PostgreSQL's `pgcrypto` extension with AES-256 symmetric encryption. The encryption key is never stored in the database.

```sql
-- Encrypt on write (application passes $key from environment variable):
UPDATE employees
SET base_salary_encrypted = pgp_sym_encrypt($salary::text, $key)
WHERE id = $id;

-- Decrypt on read:
SELECT pgp_sym_decrypt(base_salary_encrypted, $key)::DECIMAL(15,4) AS base_salary
FROM employees WHERE id = $id;
```

**Key management:**

- Encryption key stored in the `SALARY_ENCRYPTION_KEY` environment variable, never committed to source control, never stored in the database.
- In production, the key is provided as a Docker secret (`salary_encryption_key`) mounted at `/run/secrets/salary_encryption_key`.
- Key rotation procedure: an application-level script decrypts all encrypted rows with the old key, re-encrypts with the new key, within a single database transaction. If any row fails, the entire transaction rolls back.

#### Salary Field Visibility Enforcement

Salary field visibility is enforced via the `salary:view` permission (see 02_component_design.md §RBAC Permission Matrix). The Viewer role does not hold this permission. Salary columns are masked as `--` in the UI for Viewers, and the encrypted column value is never decrypted for Viewer-role queries at the application layer.

#### PDPL Principles Mapping

| PDPL Principle | BudFin Implementation |
| --- | --- |
| Data minimization | Only fields required for budget calculations are stored; no extraneous PII collected |
| Purpose limitation | Salary data used exclusively for budget calculation; not exported to external systems or shared with third parties |
| Data residency (Art. 29) | Database hosted within KSA per constraint SA-008; no cross-border data transfer |
| Right to erasure | Employee records anonymized (name replaced, salary fields zeroed and re-encrypted) when departed; financial records retained for audit compliance |
| Consent | HR/Payroll Coordinator role responsible for obtaining employee consent before salary data entry |
| Security measures | Field-level AES-256 encryption + TLS 1.3 in transit + role-based access control + append-only audit trail |

### 7.5 Encryption in Transit

| Control | Configuration |
| --------- | --------------- |
| Minimum TLS version | TLS 1.3 (TLS 1.2 permitted for legacy clients, configurable in Nginx) |
| TLS termination | Nginx reverse proxy; internal Docker network traffic is unencrypted (trusted network) |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| HTTP redirect | All HTTP requests receive 308 Permanent Redirect to HTTPS |
| CORS | Single-origin allowlist: `Access-Control-Allow-Origin: https://<frontend-host>` |

### 7.6 API Security Controls

**SQL Injection prevention:** Prisma ORM uses parameterized queries exclusively. No raw SQL with user-supplied input is permitted anywhere in the codebase. This is enforced by code review policy — any use of `$queryRawUnsafe` or string concatenation in SQL is a blocking PR finding.

**Input validation:** Every API endpoint defines a Zod schema for request body, query parameters, and path parameters. Requests failing schema validation receive HTTP 400 with structured error details before any business logic executes.

**Security headers** (via Helmet.js middleware):

| Header | Value |
| -------- | ------- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Content-Security-Policy` | `default-src 'self'` |
| `Referrer-Policy` | `no-referrer` |

**Rate limiting** (via `@fastify/rate-limit`):

| Scope | Limit | Window | Key |
| ------- | ------- | -------- | ----- |
| Authenticated API | 100 requests | 1 minute | JWT `userId` |
| Login endpoint | 10 attempts | 15 minutes | Client IP |

**Request size limit:** 10MB maximum, enforced by Fastify's native `bodyLimit` option. This ceiling accommodates xlsx file imports while preventing abuse.

**IDOR prevention:** Every version-scoped database query includes an ownership check:

```sql
WHERE version_id = $versionId
  AND EXISTS (
    SELECT 1 FROM budget_versions
    WHERE id = $versionId
      AND fiscal_year = $userFiscalYear
  )
```

This is enforced in the repository layer, ensuring that no controller or service can accidentally bypass version ownership validation.

### 7.7 Audit Trail Tamper Protection

The `audit_entries` table is append-only at the database level. The application database user (`app_user`) is granted only `INSERT` and `SELECT` privileges:

```sql
-- Executed as superuser during initial database setup:
REVOKE UPDATE ON audit_entries FROM app_user;
REVOKE DELETE ON audit_entries FROM app_user;
GRANT INSERT, SELECT ON audit_entries TO app_user;
```

Only the PostgreSQL superuser or a dedicated DBA role can modify audit records, and only in documented emergency procedures.

At the application level, the audit logger writes within the same database transaction as the data change it records. If the data change commits, the audit entry commits atomically. If the transaction rolls back, the audit entry rolls back with it. This guarantees that every committed data change has a corresponding audit record, and no orphaned audit entries exist for rolled-back operations.

### 7.8 Threat Model (Top 5 — STRIDE)

| # | Threat | STRIDE Category | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- | --- |
| T-001 | SQL injection via malformed fee grid input | Tampering | Low | Critical | Prisma parameterized queries; Zod input validation on all endpoints |
| T-002 | Broken authentication (stolen or forged JWT) | Spoofing | Medium | High | RS256 asymmetric signing; 30-minute TTL; token family rotation with theft detection |
| T-003 | IDOR — accessing another budget version's data | Information Disclosure | Medium | High | Version ownership check in every repository query; fiscal year scope enforcement |
| T-004 | Privilege escalation (Viewer modifying data) | Elevation of Privilege | Low | High | RBAC middleware on every protected route; 403 on violation; all attempts audit-logged |
| T-005 | Salary PII exposure in database breach | Information Disclosure | Low | Critical | pgcrypto field-level AES-256 encryption; encryption key stored outside database (Docker secret) |

### 7.9 Pre-Go-Live Security Testing

The following security validation activities are required before production deployment (Phase 6 checklist):

1. **OWASP ZAP DAST scan:** Automated dynamic application security testing against the staging environment. All HIGH and CRITICAL findings must be resolved before go-live.
2. **Dependency audit:** `npm audit --audit-level=high` runs in every CI pipeline execution. Any HIGH or CRITICAL CVE fails the build.
3. **RBAC penetration test suite (Vitest):** Automated tests for every protected endpoint verifying that each unauthorized role receives HTTP 403. Test matrix covers all 16 permissions across all 4 roles.
4. **Manual penetration testing by Tech Lead:**
   - Replay attack with a revoked refresh token (must trigger family revocation).
   - IDOR attempt with a mismatched `version_id` (must return 403).
   - JWT with a tampered `role` claim (must fail RS256 signature verification).
   - Attempt to access salary fields as Viewer role (must receive `null` values).
