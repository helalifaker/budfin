---
name: impl:component
description: >
    Scaffold a React 19 component + Vitest test file for BudFin. Applies Tailwind v4 CSS-first,
    shadcn/ui primitives, TanStack Table v8 (if data table), React Hook Form v7 +
    @hookform/resolvers v5 (if form), Decimal.js for monetary display, and WCAG AA accessibility.
    Usage - /impl:component "[ComponentName]"
argument-hint: '"[ComponentName]"'
allowed-tools: Bash, Read, Write, Edit, Skill
---

> **Internal command.** Called by `/impl:story` automatically.

> **Internal scaffolding command.** Called by story-orchestrator agents during /impl:story.
> Not intended for direct user invocation.

Parse the argument:

- `ComponentName`: PascalCase component name (e.g., "EnrollmentTable", "StaffForm", "BudgetSummary")

If missing, ask the user: "What is the name of the React component you want to scaffold?"

## Step 1 — Invoke Skill

Use the Skill tool to invoke: `budfin-workflow`

This confirms phase compliance and loads frontend technical constraints (Tailwind v4, shadcn/ui,
WCAG AA, TanStack Table v8, React Hook Form v7, @hookform/resolvers v5, ADR-002, ADR-004).

## Step 2 — Read the Feature Spec

Find the relevant feature spec for context:

```bash
ls docs/specs/
```

If a spec exists for the component's feature, read it to understand:

- What data the component displays
- What interactions are required
- Relevant acceptance criteria

## Step 2.5 — Read UI/UX Spec

Determine the epic from the feature spec header (`> Epic: #N`). Look up the primary UI/UX spec:

| Epic  | Primary UI/UX Spec                        |
| ----- | ----------------------------------------- |
| 1     | docs/ui-ux-spec/03-enrollment-capacity.md |
| 2     | docs/ui-ux-spec/04-revenue.md             |
| 3-4   | docs/ui-ux-spec/05-staffing-costs.md      |
| 5     | docs/ui-ux-spec/06-pnl-reporting.md       |
| 6     | docs/ui-ux-spec/07-scenarios.md           |
| 7     | docs/ui-ux-spec/08-master-data.md         |
| 8,11  | docs/ui-ux-spec/09-admin.md               |
| 9     | docs/ui-ux-spec/01-dashboard.md           |
| 10    | docs/ui-ux-spec/02-version-management.md  |
| 12-13 | N/A (backend only — skip)                 |

For epics 1-11:

1. Read the primary UI/UX spec file
2. Read `docs/ui-ux-spec/00-global-framework.md`
3. Find the component in the spec — extract its type, source section, and notes
4. Extract shell type and relevant interaction patterns

## Step 3 — Determine Component Type

Based on the ComponentName and spec:

- Contains "Table" or "Grid" → TanStack Table v8 component
- Contains "Form" or "Edit" or "Create" → React Hook Form component
- Contains "Summary" or "Card" or "Dashboard" → display component
- Contains "Page" → route-level page (lazy-loaded)

## Step 4 — Scaffold Component File

Create `apps/web/src/components/$ComponentName.tsx`:

Patterns to apply:

- Named export (not default)
- TypeScript props interface
- Tailwind v4 utility classes (no inline styles)
- shadcn/ui components from `src/components/ui/` where applicable
- Shell type: PlanningShell components may use context bar; ManagementShell uses overlay panels
- Design tokens: use CSS custom properties from `00-global-framework.md` — never hardcode colors
- Cell highlighting: editable cells get `--cell-editable-bg`, read-only get `--cell-readonly-bg`
- If data table: TanStack Table v8 + useMemo for column definitions + manualPagination: true
- If form: React Hook Form v7 + zodResolver from @hookform/resolvers v5 + Zod 4 schema
- Decimal.js for any monetary display: `new Decimal(value).toFixed(2)` (TC-001 display layer)
- WCAG AA:
    - Semantic HTML (`<table>`, `<form>`, `<button>`, not `<div onClick>`)
    - `<label>` for every form input
    - `aria-label` for icon-only buttons
    - Keyboard navigation (Tab, Enter, Space, Escape)

## Step 5 — Scaffold Test File

Create `apps/web/src/components/$ComponentName.test.tsx`:

- Use Vitest + @testing-library/react
- Test: renders without error
- Test: displays provided data correctly
- Test: form submission (if form component)
- Test: keyboard accessibility for interactive elements
- Test: loading state (if async)

## Step 6 — Run Tests

```bash
pnpm --filter @budfin/web exec vitest run src/components/$ComponentName
```

Confirm tests run (they should FAIL at this point — expected for TDD workflow).

If tests error (import errors, setup errors):

- Show the error
- Fix it
- Re-run to confirm tests FAIL correctly (not error)

## Step 7 — Output

```
Component scaffolded:
  apps/web/src/components/$ComponentName.tsx
  apps/web/src/components/$ComponentName.test.tsx

Applied patterns:
  [✓] Tailwind v4 CSS-first classes
  [✓] Named export
  [✓] TypeScript props interface
  [✓] [shadcn/ui Table / React Hook Form / Display] pattern
  [✓] WCAG AA: semantic HTML, keyboard accessible
  [✓] Decimal.js for monetary display (TC-001)

Tests: [N] tests written, currently RED (expected at TDD RED phase)
  [check] UI/UX spec: matches spec component type
  [check] Shell type: [PlanningShell / ManagementShell]
  [check] Design tokens applied (no hardcoded colors)

Next: Implement the component logic to make tests pass,
      or use /impl:story [story-number] to drive the full TDD swarm.
```

## Tailwind v4 Reminder

Do NOT use `tailwind.config.js`. Tailwind v4 is CSS-first. All theme customizations go in
`apps/web/src/styles/global.css` under `@theme { ... }`. Use standard utility classes directly.
