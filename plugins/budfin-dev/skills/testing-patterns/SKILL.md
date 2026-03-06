---
name: testing-patterns
description: Vitest 4 testing patterns and QA agent boundary rules for BudFin. Use when creating or editing test files, discussing code coverage, setting up test infrastructure, or working on QA tasks. Encodes the critical QA boundary (test files only), Decimal.js precision testing, Prisma mocking, and test naming conventions.
---

# BudFin Testing Patterns (Vitest 4)

## CRITICAL: QA Agent Boundary

**QA agents and qa-specialist agent write test files ONLY.**

- QA agents may create and edit `*.test.ts` and `*.spec.ts` files
- QA agents may NOT modify any implementation file (source code, schemas, routes, components)
- If a test fails because implementation code needs changing, report it to the story-orchestrator
- Wait for an implementer to make the fix; then re-run tests

This boundary is enforced by the `hooks.json` PreToolUse hook in this plugin.

## Coverage Requirement

- **80% minimum** coverage for all new code
- Measured per file — a new module must hit 80% before the story is complete
- Run `pnpm --filter @budfin/api test:coverage` to check

## Test File Location

Tests are co-located next to source files:

```
src/
├── engines/
│   ├── staff-cost.engine.ts
│   └── staff-cost.engine.test.ts   # co-located
├── routes/
│   ├── budget.route.ts
│   └── budget.route.test.ts        # co-located
```

## Test Naming Convention

Test names describe intent and expected behavior — not implementation:

```typescript
// GOOD — describes behavior
it('returns zero staff cost when no employees are enrolled in the fiscal year');
it('rounds displayed amounts to 2 decimal places using ROUND_HALF_UP');
it('rejects login after 5 failed attempts and returns account locked error');

// BAD — describes implementation
it('calls calculateStaffCost with correct args');
it('sets isLocked to true');
```

## Financial Test Patterns

```typescript
import { Decimal } from 'decimal.js';
import { describe, it, expect } from 'vitest';
import { yearFrac } from '../engines/year-frac';

describe('yearFrac', () => {
    it('matches Excel YEARFRAC(date1, date2, 0) for a full calendar year', () => {
        const start = new Date('2025-01-01');
        const end = new Date('2026-01-01');
        const result = yearFrac(start, end);
        // Known Excel value for US 30/360
        expect(result.toString()).toBe('1.0000');
    });

    it('handles mid-year enrollment with TC-002 US 30/360 precision', () => {
        const start = new Date('2025-09-01');
        const end = new Date('2026-06-30');
        const result = yearFrac(start, end);
        expect(result.toString()).toBe('0.8306'); // validated against reference dataset
    });
});

describe('Decimal.js precision', () => {
    it('does not lose precision in staff cost multiplication', () => {
        const salary = new Decimal('12345.6789');
        const rate = new Decimal('0.031500');
        const result = salary.times(rate);
        // Should not lose digits
        expect(result.dp()).toBeGreaterThanOrEqual(4);
    });
});
```

## Mocking Prisma

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Mock at module level — never hit real DB in unit tests
vi.mock('@prisma/client');

const mockPrisma = {
    budgetVersion: {
        findFirstOrThrow: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    $transaction: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.budgetVersion.findFirstOrThrow.mockResolvedValue({
        id: 'version-uuid',
        name: 'FY2026 Draft',
        status: 'Draft',
    });
});
```

## Integration Tests

- Use a dedicated test database (configured via `DATABASE_URL_TEST` env var)
- Reset schema between test suites: `prisma migrate reset --force` in test setup
- Integration tests in `src/**/*.integration.test.ts`
- Never run integration tests against production or staging DB

## Component Tests

```typescript
import { render, screen, userEvent } from '@testing-library/react'
import { BudgetForm } from './BudgetForm'

it('shows validation error when name is empty and form is submitted', async () => {
  const user = userEvent.setup()
  render(<BudgetForm onSubmit={vi.fn()} />)

  await user.click(screen.getByRole('button', { name: /create/i }))

  expect(screen.getByText('Name is required')).toBeInTheDocument()
})
```

- Use `@testing-library/react` — no Enzyme, no snapshot tests for logic
- Test through user interactions, not internal state
- Query by role, label, or text — not by test IDs or class names

## What To Always Test

1. Happy path (basic functionality works)
2. Error paths (API errors, validation failures, edge inputs)
3. Edge cases (empty arrays, zero values, boundary dates)
4. Financial precision (Decimal.js operations, rounding behavior)
5. Authorization (unauthenticated, wrong role, locked account)
