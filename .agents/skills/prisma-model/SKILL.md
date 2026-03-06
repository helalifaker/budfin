---
name: prisma-model
description: >
    Add a new Prisma 6 model to the BudFin schema. Generates the model block
    with correct field types, relations, and Prisma 6 breaking-change patterns
    (Uint8Array binary fields, P2025 error handling). Invoke when adding any
    new database entity.
invocations:
    - user: /prisma-model
    - agent: prisma-model
---

# Skill: prisma-model

Adds a Prisma 6 model to `apps/api/prisma/schema.prisma` following BudFin
data architecture conventions and Prisma 6 breaking changes.

## Required inputs

Ask the user for (or infer from context):

1. **Model name** — PascalCase singular, e.g. `BudgetVersion`
2. **Fields** — name, Prisma scalar type, optional/required, default value
3. **Relations** — related models, cardinality (one-to-many, many-to-one)
4. **Encrypted fields** — any salary/confidential fields needing `Bytes` type
5. **Soft-delete needed** — yes/no (adds `deletedAt DateTime?`)

## Output

Append the new model block to `apps/api/prisma/schema.prisma`, then generate
and run a migration:

```bash
pnpm prisma migrate dev --name add_<model_name_snake>
pnpm prisma generate
```

## Prisma 6 critical patterns

### 1. Binary / encrypted fields use `Bytes`, not `String`

Salary fields encrypted with pgcrypto are stored as `bytea` in PostgreSQL.
In Prisma 6 the TypeScript type is `Uint8Array` (not `Buffer`).

```prisma
model Employee {
  id                          Int      @id @default(autoincrement())
  baseSalaryEncrypted         Bytes    // Uint8Array in TS — pgcrypto AES-256
  housingAllowanceEncrypted   Bytes
  transportAllowanceEncrypted Bytes
  responsibilityPremiumEncrypted Bytes
  hsaAmountEncrypted          Bytes
}
```

In application code, never cast `Uint8Array` to `Buffer`. Pass directly to
`pgp_sym_encrypt` / `pgp_sym_decrypt` via Prisma `$queryRaw`.

### 2. Not-found error handling — use P2025, not NotFoundError

`PrismaClientKnownRequestError` with code `P2025` replaces the removed
`NotFoundError`. Always pattern-match on the code:

```typescript
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

async function findOrThrow(id: number) {
    try {
        return await prisma.budgetVersion.findUniqueOrThrow({ where: { id } });
    } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
            throw new NotFoundError(`BudgetVersion ${id} not found`);
        }
        throw err;
    }
}
```

Never catch `PrismaClientKnownRequestError` without checking `err.code`.

### 3. Implicit many-to-many relation naming

Prisma 6 renamed implicit m-n join table `_id` fields. Always use explicit
relation names to avoid ambiguity:

```prisma
model User {
  roles UserRole[]
}

model UserRole {
  userId Int
  roleId Int
  user   User @relation(fields: [userId], references: [id])
  @@id([userId, roleId])
}
```

Prefer explicit junction tables over implicit `@relation` many-to-many for
BudFin models — it prevents the renamed `_id` field issue entirely.

## Model block template

```prisma
model <ModelName> {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime? // include only if soft-delete is needed

  // --- Scalar fields ---
  // <fieldName> <ScalarType> <modifiers>

  // --- Encrypted fields (pgcrypto AES-256, stored as bytea) ---
  // <fieldName>Encrypted Bytes

  // --- Relations ---
  // <relationField> <RelatedModel>  @relation(fields: [...], references: [...])
  // <foreignKey>    Int

  @@map("<snake_case_table_name>")
}
```

## Repository pattern

After adding the model, create a repository file:
`apps/api/src/repositories/<modelName>.repository.ts`

```typescript
import { prisma } from '../lib/prisma.js'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { NotFoundError } from '../errors/not-found.error.js'

export async function find<ModelName>ById(id: number) {
  try {
    return await prisma.<modelName>.findUniqueOrThrow({ where: { id } })
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundError(`<ModelName> ${id} not found`)
    }
    throw err
  }
}

export async function create<ModelName>(data: Prisma.<ModelName>CreateInput) {
  return prisma.<modelName>.create({ data })
}

export async function update<ModelName>(
  id: number,
  data: Prisma.<ModelName>UpdateInput,
) {
  try {
    return await prisma.<modelName>.update({ where: { id }, data })
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundError(`<ModelName> ${id} not found`)
    }
    throw err
  }
}
```

## Steps to execute

1. Ask user for required inputs listed above (or infer from context).
2. Append the model block to `apps/api/prisma/schema.prisma`.
3. Use `Bytes` for any encrypted/binary fields (never `String`).
4. Create the repository file using the template above.
5. Run `pnpm prisma migrate dev --name add_<model_name>`.
6. Run `pnpm prisma generate`.
7. Run `pnpm eslint --fix` on the new repository file.
8. Report what was added and remind user to update `@budfin/types` if the
   model's shape is needed on the frontend.
