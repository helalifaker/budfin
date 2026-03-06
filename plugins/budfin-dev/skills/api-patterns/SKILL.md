---
name: api-patterns
description: Fastify 5 API patterns for BudFin. Use when writing route handlers, Fastify plugins, Zod schemas, middleware, authentication, RBAC, error handling, logging, or any backend API work. Encodes correct package names, middleware order, error format, security requirements, and rate limiting conventions.
invocations:
    - agent: api-patterns
---

# BudFin API Patterns (Fastify 5 + Zod 4)

## Package Name Warning

```typescript
// CORRECT package name
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'

// WRONG — this is a different package, do NOT use
import { ... } from '@fastify/type-provider-zod'
```

Use `fastify-type-provider-zod` (NOT `@fastify/type-provider-zod`).

## Route Schemas — Every Route Must Have One

```typescript
import { z } from 'zod';
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

const plugin: FastifyPluginAsyncZod = async (fastify) => {
    fastify.post('/budget-versions', {
        schema: {
            body: z.object({
                name: z.string().min(1).max(100),
                fiscalYear: z.number().int().min(2020).max(2100),
            }),
            response: {
                201: z.object({
                    id: z.string().uuid(),
                    name: z.string(),
                    status: z.enum(['Draft', 'Published', 'Locked', 'Archived']),
                }),
            },
        },
        preHandler: [requirePermission('budget:create')],
        handler: async (request, reply) => {
            // handler logic
        },
    });
};
```

## Middleware Order (Must Follow Exactly)

1. `@fastify/jwt` — JWT validation
2. `@fastify/rate-limit` — Rate limiting
3. `requirePermission()` — RBAC check

Never reorder these. RBAC check must come after auth.

## RBAC — Every Mutating Endpoint

```typescript
// ALL POST, PUT, PATCH, DELETE routes must have this preHandler
preHandler: [requirePermission('resource:action')];

// Common permissions
('budget:read'); // GET budget data
('budget:create'); // POST new budget
('budget:edit'); // PUT/PATCH budget
('budget:publish'); // Transition to Published
('budget:lock'); // Transition to Locked
('calculation:run'); // Trigger calculation engine
('user:manage'); // User administration
('audit:read'); // Read audit logs
```

## Error Response Format

Always return errors in this exact shape:

```typescript
// Every error response
{
  code: 'BUDGET_NOT_FOUND',       // Screaming snake case, specific
  message: 'Budget version not found',  // Human-readable
  requestId: 'uuid-v4-correlation-id'  // Always include
}
```

Never return raw Prisma errors or stack traces to the client.

## Monetary Values in JSON Responses

```typescript
// CORRECT — monetary values as strings
{ amount: '12345.6700', rate: '0.031500' }

// WRONG — monetary values as numbers lose precision
{ amount: 12345.67, rate: 0.0315 }
```

Monetary values MUST be serialized as strings to preserve TC-001 precision.

## Authentication Tokens

- **Access token**: Authorization header only (`Bearer <token>`)
- **Refresh token**: HTTP-only cookie ONLY
- **NEVER**: store access token in localStorage or sessionStorage
- **NEVER**: send refresh token in request body or URL params

## Account Lockout

- 5 failed login attempts → 30-minute account lock
- Locked account: return `401` with `code: 'ACCOUNT_LOCKED'` and unlock time
- Admin force-unlock: requires `auditNote` field in request body (non-empty string)
- Track failed attempts in DB; reset counter on successful login

## Rate Limiting

- Applied at the route level, not globally
- Default limits are configurable via environment variables
- Auth endpoints (login, token refresh) get stricter limits

```typescript
fastify.post('/auth/login', {
    config: {
        rateLimit: {
            max: 10,
            timeWindow: '1 minute',
        },
    },
    // ...
});
```

## Logging — Always Include requestId

```typescript
// Correct — structured log with requestId
fastify.log.info({ requestId: request.id, userId, action }, 'Budget version created');

// Wrong — no context
console.log('Budget version created');
```

- Use `fastify.log` (Winston-backed) — never `console.log` in production code
- Include `requestId` in every log entry
- Log at `info` for successful operations, `warn` for recoverable issues, `error` for failures

## Correlation ID

- UUID v4 generated per request
- Attached to all log entries for that request
- Included in all error responses as `requestId`
- Available as `request.id` in Fastify handlers

## Fastify Plugin Structure

```typescript
import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import fp from 'fastify-plugin';

const myPlugin: FastifyPluginAsyncZod = async (fastify, opts) => {
    // register routes or decorate fastify
};

// Export with fp() to share fastify scope (decorators, etc.)
export default fp(myPlugin, { name: 'my-plugin' });
```
