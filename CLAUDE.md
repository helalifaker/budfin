# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## BudFin Project Instructions

School financial planning app for EFIR (École Française Internationale de Riyad). Manages staff positions, salary structures, and annual budget forecasting. Deployed as a Docker Compose stack on-premise in KSA.

## Development Commands

```bash
# Install dependencies
pnpm install

# Start all apps in parallel watch mode (API :3001, web :3000)
pnpm dev

# Run across all workspaces
pnpm build         # Build all packages
pnpm typecheck     # Type-check all packages
pnpm lint          # ESLint all packages
pnpm test          # Run all tests
pnpm lint:md       # Lint Markdown files
pnpm format        # Prettier write (all files)
pnpm format:check  # Prettier check (CI)
pnpm lint:all      # lint + lint:md + format:check

# Run for a single workspace
pnpm --filter @budfin/api test
pnpm --filter @budfin/api exec vitest run src/routes/auth.test.ts

# Prisma
pnpm --filter @budfin/api exec prisma generate
pnpm --filter @budfin/api exec prisma migrate dev
```

API dev server uses `tsx watch` (not `ts-node`). No compilation step needed during development.

Husky pre-commit hooks run `lint-staged`: prettier + eslint --fix on TS/JS files; prettier + markdownlint --fix on MD files.

### Environment setup

Copy `.env.example` to `apps/api/.env` before first run. The API requires a `DATABASE_URL` (PostgreSQL)
and `SALARY_ENCRYPTION_KEY` (salary field encryption). In Docker Compose, the key is mounted as
a Docker secret at `/run/secrets/salary_encryption_key`.

For local development, start PostgreSQL via Docker:

```bash
docker compose up db -d
```

The API auto-applies Prisma migrations and seeds default data on startup (`pnpm dev`).

## Architecture

### Monorepo structure

```text
apps/api/          Fastify 5 REST API (@budfin/api)
apps/web/          React 19 + Vite 7 SPA (@budfin/web)
packages/types/    Shared TypeScript types (@budfin/types)
```

### Backend (`apps/api`)

- **Routing**: Fastify 5 with `fastify-type-provider-zod` for schema validation. Every route uses Zod schemas for request/response types — not manual type assertions.
- **ORM**: Prisma 6 with PostgreSQL 16. Schema at `apps/api/prisma/schema.prisma`.
- **Auth**: RS256-signed JWTs (via `jose`). Access tokens in memory only (never localStorage). Refresh tokens in HTTP-only `SameSite=Strict` cookies scoped to `/api/v1/auth`. Token family rotation pattern for theft detection.
- **Encryption**: pgcrypto `pgp_sym_encrypt`/`pgp_sym_decrypt` for 5 salary fields. Key delivered via Docker secret.
- **Financial math**: All monetary calculations use `decimal.js` with `ROUND_HALF_UP`. PostgreSQL stores salaries as `DECIMAL(15,4)`. Frontend uses `decimal.js` for display rounding only — never for calculations.
- **Jobs**: `pg-boss` (PostgreSQL-backed queue, no Redis). In-process workers.
- **PDF export**: `@react-pdf/renderer` (server-side, no Chromium dependency — replaces Puppeteer per ADR-014).

### Frontend (`apps/web`)

- **State**: TanStack Query for server state; Zustand for UI state.
- **Tables**: TanStack Table v8 (headless) + shadcn/ui `<Table>` components. No virtual scrolling (< 300 rows in v1 per ADR-016).
- **Forms**: React Hook Form + `@hookform/resolvers` v5 (v5 required for Zod 4 compatibility — v3 does not work).
- **Styling**: Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`). UI primitives from `radix-ui` (unified Feb 2026 package).

### TypeScript config split

- `tsconfig.base.json`: `moduleResolution: "Bundler"` — used by web.
- `apps/api/tsconfig.json`: overrides to `module: "Node16"`, `moduleResolution: "Node16"`.

## Key Patterns and Gotchas

### Prisma 6 breaking changes

- Binary fields use `Uint8Array`, not `Buffer`.
- `NotFoundError` is removed — use `PrismaClientKnownRequestError` with code `P2025`.
- Implicit many-to-many `_id` fields are renamed.

### Package name gotcha

The Zod type provider is `fastify-type-provider-zod` (not `@fastify/type-provider-zod`).

### Timezone

All dates must handle Arabia Standard Time (UTC+3) via `@date-fns/tz`. Use `date-fns` v4 throughout; never use `new Date()` for display formatting without timezone context.

### ESLint

Flat config only (`eslint.config.ts`). No `.eslintrc` files. All plugins must support ESLint 9 flat config.
`no-console` is set to `error` globally — use a logger or prefix with `_`. Exception: `prisma/seed.ts` files.

## Workflow

All development follows the 7-phase BudFin workflow defined in `.claude/workflow/WORKFLOW.md`. Current phase is tracked in `.claude/workflow/STATUS.md`.

See `.claude/COMMANDS.md` for the full command reference. 10 user-facing commands:

| #   | Command                         | Purpose                                                                                                        |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `/workflow:run [epic-#]`        | Full Epic lifecycle: health check -> spec -> stories -> implement -> review -> visual audit -> merge -> rollup |
| 2   | `/workflow:status`              | Phase, checklist, `>>> NEXT:` recommendation                                                                   |
| 3   | `/docs:sync [--audit] [path]`   | Inventory, classify, deduplicate, and archive docs safely                                                      |
| 4   | `/fix:all [symptom?]`           | Fix everything (or debug a specific symptom with root cause analysis)                                          |
| 5   | `/pr:drive [--pr N / --epic #]` | Push PRs to merge autonomously                                                                                 |
| 6   | `/workflow:advance`             | Manual phase gate check                                                                                        |
| 7   | `/plan:adr "[title]"`           | Record architectural decision                                                                                  |
| 8   | `/plan:spec [epic-#]`           | Write feature spec interactively                                                                               |
| 9   | `/impl:story [story-#]`         | Implement a single story                                                                                       |
| 10  | `/audit:360 [--epic N / --all]` | 360-degree implementation audit (read-only, 8 layers)                                                          |

## File Output Rules

- Plans → `./docs/plans/` — ALWAYS write implementation plans as files here (format: `YYYY-MM-DD-<feature-name>.md`). Never keep plans only in the conversation.
- Specs → `./docs/specs/epic-N/` (e.g., `docs/specs/epic-1/enrollment-capacity.md`)
- Data files (budgets, enrollment) → `./data/`
- Tasks → tracked as GitHub Issues (Epics → Stories)

## Reference Documents

| Purpose                                         | Location                          |
| ----------------------------------------------- | --------------------------------- |
| Full command reference (plan/impl/fix/workflow) | `.claude/COMMANDS.md`             |
| Canonical pinned versions                       | `docs/tdd/stack-versions.md`      |
| Architecture overview                           | `docs/tdd/01_overview.md`         |
| ADRs (ADR-001 to ADR-017)                       | `docs/tdd/09_decisions_log.md`    |
| ADRs (ADR-018+)                                 | `docs/adr/`                       |
| Security architecture                           | `docs/tdd/05_security.md`         |
| Data model                                      | `docs/tdd/02_component_design.md` |
| API contracts                                   | `docs/tdd/04_api_contract.md`     |
| Infrastructure / Docker                         | `docs/tdd/06_infrastructure.md`   |
