# BudFin Code Review Checklist

> Used by: `workflow-reviewer` agent in Phase 7
> Severity: **Blocker** (must fix before merge) | **Warning** (should fix, justify if not) | **Nit** (optional)

---

## UI/UX Spec Compliance

> Severity: **Blocker** on all items. No story may merge with any of these failing.

- **Blocker** — Sidebar uses CSS token `var(--sidebar-bg)` (#0F172A) — NOT `bg-white` or `bg-gray-*`
- **Blocker** — All `<button>` elements use `<Button>` from `components/ui/button`
- **Blocker** — All `<input>` elements use `<Input>` from `components/ui/input`
- **Blocker** — All `<select>` elements use `<Select>` from `components/ui/select`
- **Blocker** — Dropdown menus use `<DropdownMenu>` from `components/ui/dropdown-menu`
- **Blocker** — Confirmation modals use `<AlertDialog>` from `components/ui/alert-dialog`
- **Blocker** — Form modals use `<Dialog>` from `components/ui/dialog`
- **Blocker** — Mutation feedback uses `toast.success()` / `toast.error()` from `components/ui/toast-state`
- **Blocker** — Loading states use `<TableSkeleton>` or `<Skeleton>` from `components/ui/skeleton`
- **Blocker** — Data tables: `role="table"`, cells: `role="cell"` (NOT `role="grid"` / `role="gridcell"` unless cells are editable)
- **Blocker** — Colors reference CSS custom properties from `index.css :root` or matching Tailwind values
- **Blocker** — Lucide icons used for all icon needs (no inline SVG except in `skeleton.tsx` spinner)
- **Blocker** — Module-specific UI spec consulted: `docs/ui-ux-spec/NN-<module>.md`

---

## Correctness

- **Blocker** — All acceptance criteria from the spec are implemented
- **Blocker** — No test is skipped, commented out, or marked `.only`
- **Blocker** — `pnpm test` passes with coverage ≥ 80% for this story
- **Blocker** — No `TODO`, `FIXME`, or `console.log` in committed code
- **Warning** — Edge cases from `docs/edge-cases/` relevant to this story are tested

## Financial Precision (TC-001)

- **Blocker** — All monetary values use `Decimal.js` — no native `number` arithmetic on currency
- **Blocker** — No IEEE 754 arithmetic on financial values (no `+`, `-`, `*`, `/` on money)
- **Blocker** — `toFixed()` only used for display formatting, never for computation
- **Warning** — Intermediate calculations stay in `Decimal` throughout the chain

## Date Calculations (TC-002)

- **Blocker** — Staff cost proration uses YEARFRAC algorithm, not simple day division
- **Warning** — Date arithmetic uses `date-fns` or explicit UTC handling — no timezone assumptions

## Security

- **Blocker** — No raw SQL string concatenation — parameterized queries only
- **Blocker** — All route handlers verify the authenticated user's school context (no cross-tenant leakage)
- **Blocker** — No secrets, tokens, or credentials in source files
- **Blocker** — Input validated with Zod at all API boundaries
- **Warning** — RBAC checks are at the service layer, not only at the route layer
- **Warning** — Error responses do not leak internal implementation details

## Code Quality

- **Blocker** — ESLint passes with 0 errors and 0 warnings (`pnpm lint`)
- **Blocker** — TypeScript strict mode — no `any` types without explicit justification
- **Warning** — No function longer than 40 lines — extract if longer
- **Warning** — No file longer than 300 lines — split if longer
- **Warning** — Prisma queries use `select` to avoid over-fetching
- **Nit** — Variable and function names are unambiguous and self-documenting

## Database

- **Blocker** — Migrations are reversible (has `down` migration or explicit note why not)
- **Blocker** — No N+1 query patterns — related data loaded with `include` or batch queries
- **Warning** — New queries on large tables have appropriate indexes
- **Warning** — Transactions used for multi-step writes that must be atomic

## API Contract

- **Blocker** — Request/response shapes match the spec exactly
- **Blocker** — HTTP status codes are semantically correct (201 for create, 409 for conflict, etc.)
- **Warning** — Pagination implemented for any list endpoint that could return > 50 rows

## UI/UX Conformance (Frontend Stories Only)

> Skip this section entirely if the story has no frontend files in `apps/web/src/`.

- **Blocker** — Shell type matches UI/UX spec: PlanningShell modules render inside PlanningShell, ManagementShell modules inside ManagementShell
- **Blocker** — All components listed in the feature spec's Key Components table are implemented
- **Blocker** — ARIA roles match the feature spec's Accessibility Requirements subsection exactly
- **Warning** — Design tokens from `00-global-framework.md` used for colors — no hardcoded hex values
- **Warning** — Typography tokens applied correctly (`--text-xs` for grid cells, `--font-mono` for monetary values)
- **Warning** — Editable cells use `--cell-editable-bg` background, read-only cells use `--cell-readonly-bg`
- **Warning** — Keyboard navigation implemented per `00-global-framework.md` Section 8
- **Warning** — Interaction patterns match spec (inline editing, panel behavior, form validation flow)
- **Warning** — Monetary display: 2 decimals, thousands separator, right-aligned, `--font-mono`
- **Nit** — Component names match UI/UX spec exactly
- **Nit** — Layout structure matches the description in the feature spec

## Tests

- **Blocker** — Unit tests cover every acceptance criterion
- **Blocker** — Integration tests hit the actual HTTP layer (not mocked routes)
- **Warning** — Unhappy paths tested: invalid input, auth failure, not-found
- **Warning** — Tests are deterministic — no flaky time-dependent assertions
- **Nit** — Test names follow pattern: `should [expected behavior] when [condition]`

## Documentation

- **Warning** — CHANGELOG updated with user-visible changes
- **Warning** — If a new ADR was needed (architectural decision), it is written
- **Nit** — Complex business logic has inline comments explaining the "why"

---

## PR Process Integrity (Blocker)

- **Blocker** -- All PR review conversations resolved (0 unresolved threads)
- **Blocker** -- PR title matches story title
- **Blocker** -- PR body contains `Fixes #[story-#]` and `Part of Epic #[epic-#]`
- **Blocker** -- CI is green at time of review

## UI/UX Interaction Coverage (Blocker -- frontend stories only)

> Skip if the story has no frontend files in `apps/web/src/`.

- **Blocker** -- Dev server starts and route renders without console errors
- **Blocker** -- Shell type matches UI/UX spec (PlanningShell vs ManagementShell)
- **Blocker** -- Key Components from spec are present in DOM
- **Blocker** -- Keyboard navigation works (Tab order, Enter/Space activation, Escape cancel)
- **Blocker** -- ARIA roles match spec accessibility requirements

---

## Sign-Off Template

Paste this into the PR after review:

```
## Reviewer Agent Sign-Off

- Blockers found: [N] — [all resolved / outstanding: list]
- Warnings found: [N] — [all resolved / accepted with justification: list]
- Nits found: [N] — [addressed / deferred]

Status: APPROVED / CHANGES REQUESTED
```
