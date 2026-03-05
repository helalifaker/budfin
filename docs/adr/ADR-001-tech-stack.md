# ADR-001: Tech Stack Selection

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Tech Lead, CAO

## Context

BudFin is a single-tenant school financial planning application for EFIR (Ecole Francaise Internationale de Riyad). It manages staff positions, salary structures, and annual budget forecasting for approximately 20 concurrent users. The application is deployed as an on-premise Docker Compose stack within KSA (Kingdom of Saudi Arabia), subject to PDPL data residency requirements.

Key constraints:

- **Scale:** Single school, at most 20 concurrent users, approximately 700 employees
- **Deployment:** On-premise in KSA, no cloud dependency
- **Compliance:** PDPL data residency (SA-008), field-level salary encryption
- **Team:** 3 engineers with stronger TypeScript/frontend skills
- **Financial precision:** All monetary calculations require fixed-point decimal arithmetic (TC-001)

## Decision

Full-stack TypeScript monolith with the following stack:

| Layer | Technology | Version |
| --- | --- | --- |
| Runtime | Node.js | 22 LTS |
| Language | TypeScript | 5.9.3 (pinned) |
| Backend framework | Fastify | 5.7.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 16 |
| Validation | Zod | 4.x |
| Authentication | jose (via @fastify/jwt) | 5.x |
| Financial math | Decimal.js | 10.6.x |
| Background jobs | pg-boss | 10.x (in-process workers) |
| PDF export | @react-pdf/renderer | 4.3.x |
| Frontend framework | React | 19 |
| Build tool | Vite | 7 |
| CSS | Tailwind CSS | 4.2 |
| UI primitives | shadcn/ui + Radix UI | latest |
| Data tables | TanStack Table | v8 |
| Server state | TanStack Query | v5 |
| Client state | Zustand | 5.x |
| Forms | React Hook Form + @hookform/resolvers v5 | 7.x / 5.x |
| Package manager | pnpm | 10.x |
| Testing | Vitest | 4.x |
| Linting | ESLint 9 (flat config) + Prettier 3.8 | 9.x / 3.8.x |
| Infrastructure | Docker Compose (3 containers: nginx, api, db) | v2 |

## Rationale

### Full-stack TypeScript

A single language across frontend and backend reduces context switching for a 3-person team. TypeScript provides compile-time type safety, which is critical for financial calculations where silent type coercion could introduce precision errors.

### Fastify over Express

Fastify 5 provides schema-first validation via `fastify-type-provider-zod`, validating request/response at the framework level. Express requires manual Zod calls in each handler. Fastify also ships with native TypeScript support. See **ADR-008**.

### Prisma over raw SQL

Prisma 6 maps PostgreSQL `DECIMAL(15,4)` to Decimal.js natively, generates a type-safe client, and manages migrations as version-controlled files. See **ADR-007**.

### PostgreSQL over MySQL

PostgreSQL provides the pgcrypto extension for field-level AES-256 encryption of salary fields (PDPL compliance). JSONB support is superior for audit log columns. See **A-TDD-002**.

### Monolith over microservices

The calculation chain (enrollment -> revenue -> DHG -> staff costs -> P&L) is tightly coupled. At 20 users, microservices add distributed transaction complexity with no throughput benefit. A single PostgreSQL transaction ensures atomicity. See **ADR-001** (decisions log).

### In-process workers over separate container

pg-boss workers run inside the Fastify process. At most 5 concurrent export jobs for 20 users is well within a single Node.js event loop. This reduces the Docker stack from 4 to 3 containers. See **ADR-015**.

### @react-pdf/renderer over Puppeteer

Puppeteer spawns headless Chromium (300-500 MB RAM per export). @react-pdf/renderer uses less than 50 MB per job with no Chrome dependency. BudFin's exports are tabular financial data, which react-pdf handles natively. See **ADR-014**.

## Alternatives Rejected

### Python + FastAPI

Strong decimal support via `decimal.Decimal` and good Excel libraries (openpyxl). However, a split-language stack (Python backend + TypeScript frontend) increases cognitive overhead for a 3-person team with stronger TypeScript skills.

### Java + Spring Boot

Mature BigDecimal support and strong type system. Highest setup complexity and slowest development cycle for a small team. No Prisma equivalent for TypeScript cross-cutting concerns.

### Microservices architecture

Would introduce distributed transactions (saga or 2PC) for the tightly-coupled calculation chain. Network latency between services provides no benefit at 20-user scale. A single calculation run would require 4 inter-service calls instead of 4 in-process function calls.

## Consequences

- All developers must use Decimal.js methods (`.plus()`, `.times()`, `.dividedBy()`) instead of arithmetic operators for monetary values
- Prisma 6 breaking changes must be observed: `Uint8Array` (not `Buffer`) for binary fields, `PrismaClientKnownRequestError` with code `P2025` (not `NotFoundError`)
- TypeScript is pinned at 5.9.3 until TS 6 reaches a stable npm release (see ADR-013)
- ESLint uses flat config (`eslint.config.ts`) exclusively; no `.eslintrc` files
- All dates must handle Arabia Standard Time (UTC+3) via `@date-fns/tz`

## References

- `docs/tdd/stack-versions.md` -- Canonical pinned version manifest (v1.2)
- `docs/tdd/09_decisions_log.md` -- ADR-001 through ADR-017
- `docs/tdd/01_overview.md` -- Architecture overview
- `docs/tdd/06_infrastructure.md` -- Docker Compose reference
- `docs/tdd/05_security.md` -- Security architecture
