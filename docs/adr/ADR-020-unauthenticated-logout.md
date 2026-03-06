# ADR-020: Allow Logout Without Valid Access Token

> Date: 2026-03-06 | Status: Accepted | Deciders: Engineering team

## Context

The `POST /api/v1/auth/logout` endpoint previously required a valid access token via the `fastify.authenticate` preHandler. This created a usability problem: when a user's access token expired and the refresh also failed (or the user simply closed the browser and returned later), clicking "Logout" returned a 401 error. The user was effectively stuck in a limbo state -- unable to use the app (expired session) and unable to cleanly log out (authentication required).

This is a well-known anti-pattern in session management. The purpose of logout is to clear client-side session state and revoke server-side tokens. Requiring a valid session to destroy a session is circular.

## Decision

Remove the `fastify.authenticate` preHandler from the logout route. The endpoint now operates without requiring a valid access token.

Session identification and revocation rely on the `refresh_token` HTTP-only cookie, which is always sent by the browser regardless of access token state. If an `Authorization` header is present, the server performs a best-effort extraction of `userId` from the access token for the audit trail; if the token is expired or absent, the audit entry records `userId: null`.

## Consequences

### Positive

- Users can always log out, regardless of token expiration state
- Eliminates the "stuck session" UX problem where expired users cannot cleanly sign out
- Aligns with OWASP session management best practices (logout must always succeed)
- Audit trail still captures userId when the access token is valid

### Negative

- Audit entries for logout may have `userId: null` when the access token has expired -- mitigated by the fact that the refresh token hash still links to the user's session in the database
- The logout endpoint is now unauthenticated, which increases its attack surface -- mitigated because the only action it performs is cookie clearing and token revocation, neither of which is harmful to invoke without a valid session

### Neutral

- No change to the refresh token revocation logic itself; the cookie-based lookup is unchanged

## Alternatives Considered

| Option                                           | Why Rejected                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Auto-refresh before logout                       | Adds complexity; if refresh also fails the problem remains                                 |
| Client-side-only logout (just clear cookies)     | Leaves server-side refresh token unrevoked, violating security requirements                |
| Keep authenticated but return 200 instead of 401 | Contradicts Fastify's authenticate decorator behavior; would require custom error handling |

## References

- OWASP Session Management Cheat Sheet: logout must always succeed
- PR #73: fix(epic-11): logout without auth, context schoolYear from config
- Related issue: #4 (Epic 11 — Authentication & RBAC)
