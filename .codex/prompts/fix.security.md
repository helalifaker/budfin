---
name: fix:security
description: >
    Fix security vulnerabilities in BudFin. Launches security-reviewer agent on changed files,
    fixes all Blockers (JWT, RBAC, SQL injection, rate limit, audit log), then re-runs to confirm
    clean. Commits with fix(security) message. Available in any phase.
---

> **Internal command.** Called by `/fix:all` automatically.

Fix all security vulnerabilities in recently changed files. Launch security-reviewer agent,
fix every Blocker, and confirm clean before committing.

## Step 1 — Invoke Skill

Read and follow `.agents/skills/budfin-workflow/SKILL.md` before proceeding.

This confirms phase and loads security constraints from `docs/tdd/05_security.md`.

## Step 2 — Identify Changed Files

```bash
git diff --name-only HEAD
git diff --name-only --cached
```

If no argument was provided, use these changed files as the review scope.
If a specific path was provided as an argument, use that instead.

## Step 3 — Launch Security Reviewer Agent

Load `.codex/agents/security-reviewer.md` as the review brief, then spawn a Codex sub-agent with:

- The list of changed files to review
- Instruction to read `docs/tdd/05_security.md` as the authoritative security spec

Wait for the agent to return its full report with BLOCKING / WARNING / INFO findings.

## Step 4 — Fix Every Blocker

For each BLOCKING finding from the security-reviewer:

### JWT Issues (Section 7.1)

- Access token not RS256 → update key type and `SignJWT` call
- Access token in cookie → move to response body only
- Refresh token in body → move to HTTP-only cookie only
- Missing cookie attributes → add `httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth'`
- Wrong algorithm (HS256) → change to RS256 and use asymmetric key pair
- Token TTL > 30 min → set `setExpirationTime('30m')`

### Token Family Rotation (Section 7.2)

- Refresh not revoked on use → add revocation logic before issuing new token
- Revoked token replay allowed → add family-wide revocation on replay detection
- Missing audit log on revocation → add `audit_entries` INSERT in same transaction

### RBAC Gaps (Section 7.3)

- Missing `authenticate` preHandler → add to route `preHandler` array
- Missing `requireRole` preHandler → add after `authenticate`
- RBAC in handler instead of preHandler → extract to preHandler
- Viewer can see salary fields → add null masking for Viewer role response

### SQL Injection (Section 7.4)

- `$queryRaw` with string concatenation → convert to tagged template literal:

    ```typescript
    // WRONG
    await prisma.$queryRaw(`SELECT ... WHERE id = '${id}'`);

    // CORRECT
    await prisma.$queryRaw`SELECT ... WHERE id = ${id}`;
    ```

### Audit Log (Section 7.7)

- Mutation without audit entry → wrap in transaction with `audit_entries` INSERT
- UPDATE/DELETE on audit_entries → change to INSERT only (table is append-only)

### Password / Lockout (Section 7.1-7.2)

- bcrypt cost < 12 → increase to 12
- Lockout not at 5 failures → fix threshold
- Lockout not 30 min → fix duration
- Not resetting on success → add `failed_attempts: 0` on successful login

## Step 5 — Fix Every Warning

For each WARNING finding, apply the fix with a brief explanation of the tradeoff.
All warnings should be resolved unless there is a documented reason not to.

## Step 6 — Re-Run Security Review

Re-run the security reviewer using `.codex/agents/security-reviewer.md` on the same files.

If any BLOCKING findings remain, go back to Step 4.
If only INFO findings remain, proceed to Step 7.

## Step 7 — Commit

```bash
git add [changed-files]
git commit -m "fix(security): resolve [N] security findings

- [brief description of each BLOCKING fix]
"
```

## Step 8 — Output

```
Security fix complete.

Findings resolved:
  BLOCKING: N fixed
  WARNING: N fixed
  INFO: N (informational only)

Security review: PASS
Committed: fix(security): resolve [N] security findings
```
