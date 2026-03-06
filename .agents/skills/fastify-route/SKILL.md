---
name: fastify-route
description: >
    Scaffold a Fastify 5 route for BudFin. Generates the route file with Zod
    schema, fastify-type-provider-zod integration, handler, and a paired
    Vitest test file. Invoke when adding any new API endpoint.
invocations:
    - user: /fastify-route
    - agent: fastify-route
---

# Skill: fastify-route

Scaffolds a complete, production-ready Fastify 5 route following BudFin API
conventions from `docs/tdd/04_api_contract.md`.

## Required inputs

Ask the user for (or infer from context):

1. **Route name** — e.g. `budget-versions` (kebab-case, becomes the URL segment)
2. **HTTP method** — GET / POST / PATCH / DELETE
3. **URL path** — e.g. `/api/v1/budget-versions/:id`
4. **Auth required** — yes/no (default yes)
5. **Minimum role** — Viewer / Editor / BudgetOwner / Admin (default Editor)
6. **Request body fields** — for POST/PATCH (name, Zod type, required?)
7. **Response shape** — top-level fields returned on success

## Output files

| File         | Location                                                |
| ------------ | ------------------------------------------------------- |
| Route module | `apps/api/src/routes/<resource>/<method>.route.ts`      |
| Vitest test  | `apps/api/src/routes/<resource>/<method>.route.test.ts` |

Register the new route in `apps/api/src/app.ts` by importing and calling
`fastify.register(route, { prefix: '/api/v1' })`.

## Route file template

```typescript
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

// --- Zod schemas ---------------------------------------------------------

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const bodySchema = z.object({
  // TODO: replace with actual fields
  name: z.string().min(1).max(200),
})

const responseSchema = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.string(), // ISO-8601 string; monetary values as strings too
})

// --- Route plugin --------------------------------------------------------

export const <routeName>Route: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/<resource>',
    {
      schema: {
        tags: ['<Resource>'],
        summary: '<Human-readable summary>',
        body: bodySchema,
        params: paramsSchema,
        response: {
          201: responseSchema,
          400: z.object({ code: z.string(), message: z.string() }),
          403: z.object({ code: z.string(), message: z.string() }),
        },
      },
      // Auth: attach the preHandler registered in app.ts
      preHandler: [fastify.authenticate, fastify.requireRole('Editor')],
    },
    async (request, reply) => {
      const { id } = request.params
      const { name } = request.body

      // Call service layer — never write DB logic directly in route handlers
      const result = await fastify.services.<resource>.create({ id, name })

      return reply.status(201).send(result)
    },
  )
}
```

## Key BudFin conventions

- **Monetary values** — always return as `string` (e.g. `"47250.0000"`) to
  prevent JSON floating-point precision loss (TC-001).
- **Error format** — all non-2xx responses must match:
    ```json
    { "code": "SCREAMING_SNAKE_CASE", "message": "...", "field_errors": [...] }
    ```
    `field_errors` is present only on 400/422; omit otherwise.
- **Status codes** — 200 read/update, 201 create, 204 delete, 400 malformed,
  401 unauth, 403 forbidden, 404 not found, 409 conflict, 422 semantic error.
- **Auth middleware** — `fastify.authenticate` verifies RS256 JWT and attaches
  `request.user` (`{ userId, role, sessionId }`). `fastify.requireRole(role)`
  enforces RBAC and logs every 403 to `audit_entries`.
- **No raw SQL** — all DB access goes through Prisma repository functions.
  Never use `$queryRawUnsafe` or string-concatenated SQL.

## Vitest test file template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { signTestToken } from '../../test/helpers/auth.js';

describe('<METHOD> /<resource>', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    beforeAll(async () => {
        app = await buildApp({ logger: false });
        await app.ready();
    });

    afterAll(() => app.close());

    it('returns 201 for valid Editor request', async () => {
        const token = signTestToken({ userId: 1, role: 'Editor' });
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/<resource>',
            headers: { authorization: `Bearer ${token}` },
            payload: { name: 'Test' },
        });
        expect(res.statusCode).toBe(201);
        expect(res.json()).toMatchObject({ name: 'Test' });
    });

    it('returns 403 for Viewer role', async () => {
        const token = signTestToken({ userId: 2, role: 'Viewer' });
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/<resource>',
            headers: { authorization: `Bearer ${token}` },
            payload: { name: 'Test' },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().code).toBe('FORBIDDEN');
    });

    it('returns 400 for missing required body field', async () => {
        const token = signTestToken({ userId: 1, role: 'Editor' });
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/<resource>',
            headers: { authorization: `Bearer ${token}` },
            payload: {},
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().code).toBe('VALIDATION_ERROR');
    });
});
```

## Steps to execute

1. Ask user for the required inputs listed above (or infer from context).
2. Create the route file at the correct path using the template above.
3. Create the test file at the correct path using the template above.
4. Replace all `<placeholder>` values with the actual resource name, method,
   and fields provided by the user.
5. Register the route in `apps/api/src/app.ts`.
6. Run `pnpm eslint --fix` on both new files.
7. Run `pnpm vitest run apps/api/src/routes/<resource>/` to confirm tests pass.
8. Report what was created and any follow-up steps needed.
