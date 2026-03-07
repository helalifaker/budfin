---
name: fix:types
description: >
  Fix all TypeScript type errors in the BudFin monorepo. Groups errors by category, applies
  targeted fixes, and repeats until pnpm typecheck reports zero errors. Handles Prisma 6
  breaking changes (Buffer→Uint8Array) as a special category. Available in any phase.
allowed-tools: Bash, Read, Edit
---

> **Internal command.** Called by `/fix:all` automatically.

Fix all TypeScript errors across the BudFin monorepo. Repeat until `pnpm typecheck` reports
zero errors.

## Step 1 — Run Typecheck and Capture All Errors

```bash
pnpm typecheck 2>&1 | tee /tmp/typecheck-output.txt
```

Count the errors. If zero — output "TypeScript: CLEAN" and stop.

## Step 2 — Group Errors by Category

Read `/tmp/typecheck-output.txt` and categorize each error:

**Category A — Missing types / `any` inference**
- `Type 'any' is not assignable to...`
- `Parameter 'x' implicitly has an 'any' type`

**Category B — Incompatible assignments**
- `Type 'Buffer' is not assignable to type 'Uint8Array'` → Prisma 6 breaking change
- `Type 'string' is not assignable to type 'Decimal'`
- `Type 'number' is not assignable to type 'string'` (monetary field — should be string)

**Category C — Missing imports / module not found**
- `Cannot find module '@budfin/...'`
- `Module '"..."' has no exported member '...'`

**Category D — Property does not exist**
- `Property 'x' does not exist on type 'Y'`

**Category E — Other**
- Everything that doesn't fit A-D

## Step 3 — Fix by Category

### Category A — Add explicit types

Read the file and infer the correct type from context. Add explicit annotation:
```typescript
// Before (implicit any)
function process(data) { ... }

// After (explicit type from context)
function process(data: StaffRecord) { ... }
```

### Category B — Prisma 6 Buffer→Uint8Array

This is the most common Prisma 6 breaking change in BudFin:
```typescript
// WRONG (Prisma 5 pattern)
const key: Buffer = employee.baseSalaryEncrypted

// CORRECT (Prisma 6 — Bytes fields are Uint8Array)
const key: Uint8Array = employee.baseSalaryEncrypted
```

For monetary type mismatches:
```typescript
// Ensure monetary values are strings in API responses
return { total: result.toFixed(4) }  // string, not Decimal or number
```

### Category C — Fix imports

For `@budfin/*` workspace packages:
```bash
# Verify workspace symlink exists
ls node_modules/@budfin/
# If missing, reinstall
pnpm install
```

For named import mismatches, check the actual exports:
```bash
grep -n "export" [file-path]
```

### Category D — Fix property access

Check if property was renamed in a recent change or if the type definition needs updating.
Read both the type definition and the usage site.

### Category E — Fix individually

Read each error, understand the context, apply the minimal correct fix.

## Step 4 — Re-Run After Each Batch

After fixing each category:
```bash
pnpm typecheck 2>&1 | grep "error TS"
```

Count remaining errors. Continue until zero.

## Step 5 — Final Verification

```bash
pnpm typecheck && echo "TypeScript: CLEAN"
```

Must show "TypeScript: CLEAN" before this command is complete.

## Step 6 — Summary

Output:
```
TypeScript fix complete.

Errors fixed:
  Category A (implicit any): N
  Category B (Prisma 6 / type mismatch): N
  Category C (missing imports): N
  Category D (missing properties): N
  Category E (other): N

Total: N errors fixed, 0 remaining

TypeScript: CLEAN
```
