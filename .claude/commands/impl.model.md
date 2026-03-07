---
name: impl:model
description: >
  Scaffold a Prisma 6 model for BudFin using the prisma-model skill. Generates the model block
  with correct field types, relations, and Prisma 6 patterns (Uint8Array binary fields, P2025).
  Runs prisma generate and prisma migrate dev after scaffolding.
  Usage - /impl:model "[ModelName]"
argument-hint: '"[ModelName]"'
allowed-tools: Bash, Read, Write, Edit, Skill
---

> **Internal command.** Called by `/impl:story` automatically.

> **Internal scaffolding command.** Called by story-orchestrator agents during /impl:story.
> Not intended for direct user invocation.

Parse the argument:

- `ModelName`: PascalCase model name (e.g., "Enrollment", "StaffMember", "FiscalYear")

If missing, ask the user: "What is the name of the Prisma model you want to scaffold?"

## Step 1 — Invoke Skill

Use the Skill tool to invoke: `prisma-model`

This skill handles all model scaffolding with correct BudFin patterns (Uint8Array for binary
fields, DECIMAL(15,4) for monetary fields, P2025 error handling). Follow the skill exactly.

## Step 2 — Verify Schema Updated

After the skill writes to `apps/api/prisma/schema.prisma`:

1. Read the schema file and confirm the new model block exists
2. Verify field types follow BudFin conventions:
   - Monetary fields: `Decimal` (maps to `DECIMAL(15,4)`)
   - Encrypted salary fields: `Bytes` (maps to `Uint8Array` in TypeScript — Prisma 6)
   - IDs: `String @id @default(uuid())`
   - Timestamps: `DateTime @default(now())` / `DateTime @updatedAt`

## Step 3 — Generate and Migrate

```bash
pnpm --filter @budfin/api exec prisma generate
```

Confirm generation succeeds (zero errors).

```bash
pnpm --filter @budfin/api exec prisma migrate dev --name add-$MODEL_SLUG
```

Where `$MODEL_SLUG` is the lowercase kebab-case of the model name.
Example: "StaffMember" → `add-staff-member`

Confirm the migration runs cleanly.

If migration fails:
- Show the error
- Check for conflicting model names, duplicate fields, or missing relations
- Fix and re-run

## Step 4 — Output

```
Model scaffolded: $ModelName

Schema: apps/api/prisma/schema.prisma
Migration: apps/api/prisma/migrations/[timestamp]_add-$MODEL_SLUG/

Prisma client generated — TypeScript types are now available.

Remember:
  - Binary (encrypted) salary fields are Uint8Array in TypeScript, NOT Buffer (Prisma 6)
  - Use P2025 error code when record not found (NotFoundError was removed in Prisma 6)
  - Monetary fields come back as Decimal type — wrap in new Decimal(value) for arithmetic

Next: Add service layer and route, or run /impl:route "[resource]" "[method]"
```
