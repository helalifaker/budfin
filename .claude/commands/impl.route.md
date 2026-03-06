---
name: impl:route
description: >
  Scaffold a Fastify 5 route for BudFin using the fastify-route skill. Generates route file with
  Zod schema, fastify-type-provider-zod integration, RBAC preHandler, and paired Vitest test file.
  Usage - /impl:route "[resource]" "[method]"
argument-hint: '"[resource]" "[method]"'
allowed-tools: Bash, Read, Write, Edit, Skill
---

> **Internal scaffolding command.** Called by story-orchestrator agents during /impl:story.
> Not intended for direct user invocation.

Parse the arguments:

- `resource`: the resource name in lowercase (e.g., "enrollment", "staff", "budget")
- `method`: HTTP method in uppercase (e.g., "GET", "POST", "PUT", "DELETE", "PATCH")

If either argument is missing, ask the user for it before proceeding.

## Step 1 — Invoke Skill

Use the Skill tool to invoke: `fastify-route`

This skill handles all route scaffolding with correct BudFin patterns. Follow the skill exactly.

## Step 2 — Post-Scaffold Actions

After the skill creates the route and test files:

1. Verify files were created:
   - Route: `apps/api/src/routes/$RESOURCE/$METHOD.ts` (or similar)
   - Test: `apps/api/src/routes/$RESOURCE/$METHOD.test.ts`

2. Remind the user:
   ```
   Route scaffolded. Before implementing:

   1. Add your AC-specific request/response Zod schemas
   2. Add AC-specific assertions to the test file
   3. The test file currently has a placeholder test — replace with real AC tests
   4. Run pnpm test to confirm the placeholder tests are RED (failing)
   ```

## Step 3 — Run Tests

```bash
pnpm --filter @budfin/api exec vitest run src/routes/$RESOURCE/
```

Confirm the new test file runs (even if tests fail — they should fail at this stage).

If the test runner errors (import errors, syntax errors):
- Show the error
- Fix it immediately
- Re-run to confirm it FAILS correctly (not errors)

## Step 4 — Output

```
Route scaffolded:
  apps/api/src/routes/$RESOURCE/$METHOD.ts
  apps/api/src/routes/$RESOURCE/$METHOD.test.ts

Next: Add your acceptance criteria assertions to the test file,
      then implement the handler to make them pass.

Or run: /impl:story [story-number] to use the full TDD swarm.
```
