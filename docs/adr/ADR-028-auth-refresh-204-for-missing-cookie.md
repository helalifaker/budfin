# ADR-028 — Auth Refresh: 204 No Content for Missing Cookie

**Date**: 2026-03-14
**Status**: Accepted
**Context**: Revenue workspace hardening (PR #196)

## Context

The `POST /api/v1/auth/refresh` endpoint rotates the refresh token family and issues a new access
token. Prior to this change, when the refresh token cookie was absent from the request, the
endpoint returned `401 MISSING_TOKEN`.

The frontend `initialize()` flow calls `/auth/refresh` on every page load to restore a prior
session silently. When no session exists (first visit, post-logout, or cookie expired) the 401
response was treated as an authentication error, causing brief loading states and spurious console
noise that obscured genuine token-theft 401s.

## Decision

When the refresh token cookie is absent, `POST /api/v1/auth/refresh` now returns **204 No
Content** with an empty body.

The `secure` flag on the refresh cookie is now `true` only when `NODE_ENV === 'production'`. In
development (`localhost`) the flag is `false`, allowing the browser to send the cookie over HTTP
without TLS.

## Consequences

**Positive:**

- The frontend `initialize()` flow can treat 204 as "no session" and transition directly to the
  unauthenticated state without error-level logging.
- Genuine token-theft 401s (`REFRESH_TOKEN_REUSE`) remain distinct and unambiguous.
- All other existing 401 codes (`INVALID_TOKEN`, `ACCOUNT_DISABLED`) are preserved and unchanged.
- Local development works without self-signed certificate setup.

**Negative / Risks:**

- API consumers that previously distinguished "no cookie" (401 MISSING_TOKEN) from "invalid token"
  (401 INVALID_TOKEN) must be updated. Within BudFin this is handled in `auth-store.ts`.
- Staging/UAT environments that run with `NODE_ENV !== 'production'` will use an insecure cookie.
  These environments should set `SECURE_COOKIES=true` via environment variable if they run over
  HTTPS (enhancement tracked separately).

## Alternatives Considered

- **Return 401 with a distinct code** (e.g., `NO_SESSION`): rejected because frontend code would
  need to handle a new 401 variant, and the semantics of 401 imply authentication failure rather
  than absence.
- **Return 200 with `{ authenticated: false }`**: rejected because it changes the response shape
  and requires the frontend to inspect the body rather than the status code.
- **Keep 401 MISSING_TOKEN**: rejected because it caused spurious error handling on legitimate
  no-session page loads and made token-theft detection harder to distinguish in logs.
