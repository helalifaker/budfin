# ADR-026: CLI-Only Data Migration Pipeline

> Date: 2026-03-09 | Status: Accepted | Deciders: BudFin Engineering

## Context

Epic 12 requires importing EFIR's historical and FY2026 planning data (enrollment CSVs, revenue/DHG/employee JSON fixtures, and a Staff Costs XLSX workbook) into PostgreSQL as a one-time go-live gate. The migration touches 4 core data domains (Enrollment, Revenue, DHG Staffing, Staff Costs) across 10+ database tables.

Three approaches were considered for how to structure this migration:

1. Standalone Python scripts with psycopg2 (separate toolchain)
2. REST API endpoints that accept file uploads (reuse existing Fastify server)
3. TypeScript CLI scripts within the existing monorepo using Prisma ORM

Key constraints:

- JSON fixtures already exist from prior Excel parsing work -- only Staff Costs XLSX needs a new parser
- The existing `seed-fy2026.ts` provides a working reference implementation of the exact import pattern
- Salary fields require pgcrypto `pgp_sym_encrypt()` via Prisma `$executeRawUnsafe`
- Migration is a one-time operation, not an ongoing feature
- Validation must enforce zero-tolerance integrity: revenue and staff costs within +/- 1 SAR, enrollment exact match

## Decision

Use TypeScript CLI scripts within the monorepo (`apps/api/src/migration/`) executed via `pnpm --filter @budfin/api migrate`. No API endpoints are exposed for migration. No UI is provided.

The pipeline follows a 10-phase sequential architecture:

1. Pre-migration `pg_dump` backup
2. System user creation (migration@system)
3. Master data seeding (nationalities, tariffs, departments, academic years, chart of accounts)
4. Budget version creation (1 Budget + 5 Actual)
5. Revenue import (fee grids, discounts, enrollment detail)
6. Other revenue import
7. DHG grille config import
8. Historical enrollment CSV import
9. Employee import with pgcrypto encryption
10. 6-step validation suite

All importers use idempotent Prisma `upsert` operations (or delete-and-recreate for budget versions) so the pipeline can be safely re-executed without duplicating data. Monetary values use `decimal.js` exclusively -- no `parseFloat()` for financial data.

## Consequences

### Positive

- Same language, toolchain, and ORM as the rest of the codebase -- no context switching
- Direct access to Prisma client, Zod schemas, and existing utility functions (crypto-helper, decimal.js)
- Idempotent execution allows safe re-runs during testing and go-live rehearsals
- Pre-migration backup provides a rollback path within 5 minutes
- Automated validation suite catches data integrity issues before the migration is considered complete
- No attack surface -- CLI scripts are not exposed via HTTP

### Negative

- Migration code ships inside the API package even though it is never used at runtime -- mitigated by keeping all migration code in a separate `src/migration/` directory that is not imported by any route or plugin
- `pg_dump` dependency requires PostgreSQL client tools on the machine running migration -- mitigated by graceful fallback (backup skipped with warning if pg_dump unavailable)

### Neutral

- The Staff Costs XLSX parser (`parse-staff-costs-excel.ts`) is a standalone script that produces a JSON fixture, decoupling parsing from import
- Migration logging uses a custom `MigrationLogger` class (structured JSON) rather than the application's Winston logger, since migration runs outside the Fastify lifecycle

## Alternatives Considered

| Option                               | Why Rejected                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone Python + psycopg2 scripts | Introduces a second language and toolchain; cannot reuse Prisma schema, Zod types, or decimal.js; requires separate dependency management                                                |
| REST API endpoints for file upload   | Adds unnecessary HTTP overhead and attack surface for a one-time operation; would require auth bypass or special migration tokens; file upload size limits complicate large XLSX imports |
| Prisma seed script (prisma/seed.ts)  | Seed runs on every `prisma migrate dev`; migration data is environment-specific and should only run once intentionally, not on every dev migration                                       |

## References

- Feature spec: `docs/specs/epic-12/data-migration.md`
- Implementation: `apps/api/src/migration/` (21 files, +3177 lines)
- PR #183 (Epic 12)
- Existing reference pattern: `apps/api/src/validation/seed-fy2026.ts`
