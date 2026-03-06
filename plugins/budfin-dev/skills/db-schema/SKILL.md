---
name: db-schema
description: Prisma 6 + PostgreSQL 16 database schema patterns for BudFin. Use when modifying the Prisma schema, writing migrations, implementing repository patterns, or working with audit logging, encryption, or database constraints. References the existing prisma-model skill for scaffolding new models.
invocations:
  - agent: db-schema
---

# BudFin Database Schema Patterns (Prisma 6 + PostgreSQL 16)

## New Models — Use the prisma-model Skill

When adding a new database entity, invoke the `prisma-model` skill first:

- It generates the correct Prisma 6 model block with fields, relations, and breaking-change patterns
- It handles `Bytes`/`Uint8Array` binary fields correctly
- It applies named constraints and audit trigger patterns

## Prisma 6 Breaking Changes (Must Know)

| Old (Prisma 5)                                    | New (Prisma 6)                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `Buffer` for binary fields                        | `Uint8Array` (`@db.Bytea` maps to `Bytes` type)                      |
| `prisma.x.findUnique({ rejectOnNotFound: true })` | Use `findUniqueOrThrow()`                                            |
| `NotFoundError` import                            | Use `PrismaClientKnownRequestError` + check `error.code === 'P2025'` |
| Implicit m-n `_PostToTag` ID field                | Renamed — check traceability matrix                                  |

```typescript
// Prisma 6: handle not found
import { Prisma } from '@prisma/client';

try {
    const version = await prisma.budgetVersion.findUniqueOrThrow({
        where: { id },
    });
} catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError('Budget version not found');
    }
    throw error;
}
```

## Monetary Field Precision

```prisma
model StaffCostResult {
  id            String  @id @default(uuid())
  salaryAmount  Decimal @db.Decimal(15, 4)  // TC-003: amounts
  occupancyRate Decimal @db.Decimal(7, 6)   // TC-003: rates
  costShare     Decimal @db.Decimal(5, 4)   // TC-003: percentages
  yearsService  Decimal @db.Decimal(7, 4)   // TC-003: years/fractions
}
```

NEVER use `Float` or `Double` for monetary fields.

## Audit Logging — Automatic via Prisma Middleware

```typescript
// In prisma client setup
prisma.$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const result = await query(args);
                if (['create', 'update', 'delete'].includes(operation)) {
                    await prisma.auditEntry.create({
                        data: {
                            model,
                            operation,
                            recordId: result?.id,
                            changedBy: context.userId,
                            changedAt: new Date(),
                            payload: JSON.stringify(args),
                        },
                    });
                }
                return result;
            },
        },
    },
});
```

**Never write manual audit log inserts** — the middleware handles all audit logging automatically.

## audit_entries Table — APPEND ONLY

The `audit_entries` table is immutable:

- Application role has `INSERT` only — no `UPDATE` or `DELETE`
- Enforced by PostgreSQL `REVOKE` statement AND trigger
- Never bypass this for any reason (PDPL compliance requirement)

## Salary Field Encryption (PDPL)

AES-256 via pgcrypto is mandatory for salary fields:

```prisma
model StaffMember {
  id              String @id @default(uuid())
  // Salary stored encrypted — pgcrypto AES-256
  salaryEncrypted Bytes  @db.Bytea  // Prisma 6: Uint8Array, not Buffer
}
```

```typescript
// Encrypt before write
const encrypted = await prisma.$queryRaw`
  SELECT pgp_sym_encrypt(${salary}::text, ${key}) as encrypted
`;

// Decrypt on read
const decrypted = await prisma.$queryRaw`
  SELECT pgp_sym_decrypt(${encryptedValue}, ${key}) as salary
`;
```

## Schema Conventions

```prisma
model BudgetVersion {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Named constraint (for targeted diffs)
  @@unique([fiscalYear, name], name: "budget_version_fiscal_year_name_unique")
  // Named index with purpose comment
  @@index([status, fiscalYear], name: "idx_budget_version_status_fiscal_year")
  // ^ Serves: list versions by status for a given fiscal year
}
```

- All tables have `createdAt`/`updatedAt`
- `updatedAt` uses the `update_updated_at_column()` trigger
- Named constraints preferred over anonymous ones
- Named indexes with `@@index` — add a comment in migration SQL explaining which query they serve

## Connection Pool & Batch Writes

```typescript
// Use createMany() for batch inserts — never per-row inserts in loops
await prisma.staffCostResult.createMany({
    data: results, // Array of hundreds/thousands of records
    skipDuplicates: false,
});

// Default connection pool: 10 connections
// Adjust in DATABASE_URL: ?connection_limit=10
```
