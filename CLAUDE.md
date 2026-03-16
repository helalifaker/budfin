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
pnpm --filter @budfin/web test
pnpm --filter @budfin/api exec vitest run src/routes/auth.test.ts
pnpm --filter @budfin/web exec vitest run src/components/revenue/revenue-matrix-table.test.tsx

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
- **Layout shells** (ADR-023): Two dedicated shells share the same `RootLayout` and `Sidebar`:
    - `PlanningShell` — budget planning routes (`/enrollment`, `/staff`, `/budget`, `/reports`). Includes `ContextBar` (fiscal year/version/period selectors) and a resizable docked `RightPanel`.
    - `ManagementShell` — master data, admin, and version management routes. Currently minimal (renders `<Outlet />` only; `ModuleToolbar` is planned but not yet implemented). Panels are overlays (side panels, dialogs) within individual pages.
    - New routes must be nested under the correct shell in the router.

### TypeScript config split

- `tsconfig.base.json`: `moduleResolution: "Bundler"` — used by web.
- `apps/api/tsconfig.json`: overrides to `module: "Node16"`, `moduleResolution: "Node16"`.

### API route prefixes

All routes registered in `apps/api/src/index.ts`:

| Prefix                                   | Route group                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `/api/v1`                                | health, context                                                                       |
| `/api/v1/auth`                           | authRoutes (login/logout/refresh)                                                     |
| `/api/v1/users`                          | userRoutes                                                                            |
| `/api/v1/audit`                          | auditRoutes                                                                           |
| `/api/v1/system-config`                  | systemConfigRoutes                                                                    |
| `/api/v1/master-data`                    | masterDataRoutes (accounts, grades, tariffs, nationalities, departments, assumptions) |
| `/api/v1/versions`                       | versionRoutes (CRUD + lifecycle)                                                      |
| `/api/v1/fiscal-periods`                 | fiscalPeriodRoutes                                                                    |
| `/api/v1/enrollment`                     | enrollmentHistoricalRoutes (not version-scoped)                                       |
| `/api/v1/versions/:versionId/enrollment` | enrollmentRoutes                                                                      |
| `/api/v1/versions/:versionId/calculate`  | calculateRoutes + revenueCalculateRoutes + staffingCalculateRoutes                    |
| `/api/v1/versions/:versionId`            | revenueRoutes, staffingRoutes (sub-paths registered internally)                       |

### Calculation engine pattern

Pure-function calculation services live in `apps/api/src/services/` with **no DB dependencies**. Calculate routes call these services, then persist results in transactions. Never add DB calls directly to engine files.

| Engine file                                 | What it computes                                  |
| ------------------------------------------- | ------------------------------------------------- |
| `services/cohort-engine.ts`                 | AY2 headcounts from AY1 via retention rates       |
| `services/capacity-engine.ts`               | Grade capacity against enrollment headcounts      |
| `services/revenue-engine.ts`                | Monthly revenue (gross, discounts, other revenue) |
| `services/revenue-reporting.ts`             | Aggregated revenue report views                   |
| `services/staffing/cost-engine.ts`          | Monthly staff costs per employee                  |
| `services/staffing/dhg-engine.ts`           | DHG grille calculations                           |
| `services/staffing/monthly-gross.ts`        | Monthly gross salary from annual YEARFRAC         |
| `services/staffing/yearfrac.ts`             | Excel-compatible YEARFRAC (TC-002)                |
| `services/staffing/category-cost-engine.ts` | Category-level aggregated staff costs             |

### Stale module propagation

`BudgetVersion.staleModules` (string array) tracks which calculation modules are out-of-date. When enrollment changes, `REVENUE` is marked stale. When revenue changes, `STAFFING` and `PNL` are marked stale. The frontend reads `staleModules` from the version object to display warning indicators.

Chain: **ENROLLMENT → REVENUE → STAFFING → PNL**

### Right panel registry

The docked `RightPanel` in `PlanningShell` uses a module-level registry (`apps/web/src/lib/right-panel-registry.ts`). Pages register their panel content at module load time via `registerPanelContent('page-key', renderer)` and guide content via `registerGuideContent`. Page components set the active key via `useRightPanelStore.setActivePage()`. The panel reads the current renderer from the registry — no prop drilling.

### Frontend data layer

All API calls go through `apps/web/src/lib/api-client.ts` (`apiClient<T>(path, options)`), which injects the Bearer token from `auth-store`. TanStack Query hooks in `apps/web/src/hooks/` wrap `apiClient` — one file per domain (e.g., `use-revenue.ts`, `use-enrollment.ts`, `use-staffing.ts`). Never call `apiClient` directly from components.

### Tab-sync auth

`apps/web/src/lib/tab-sync.ts` uses the Web `BroadcastChannel` API (`budfin-auth` channel) to propagate token refresh and logout events across browser tabs. When one tab refreshes its access token it broadcasts to all other tabs, preventing redundant refresh requests.

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

### RBAC permissions

Roles and their permissions (`apps/api/src/lib/rbac.ts`):

| Permission     | Admin | BudgetOwner | Editor | Viewer |
| -------------- | ----- | ----------- | ------ | ------ |
| `data:view`    | ✓     | ✓           | ✓      | ✓      |
| `data:edit`    | ✓     | ✓           | ✓      |        |
| `salary:view`  | ✓     | ✓           | ✓      |        |
| `salary:edit`  | ✓     | ✓           |        |        |
| `admin:users`  | ✓     |             |        |        |
| `admin:audit`  | ✓     |             |        |        |
| `admin:config` | ✓     |             |        |        |

New routes that expose salary data must check `salary:view`. Routes that mutate data need `data:edit` at minimum.

### Version-scoped API routes

All budget-calculation routes are scoped under a version: `/api/v1/versions/:versionId/`. The three route groups registered at this prefix are `enrollmentRoutes`, `revenueRoutes`, and `staffingRoutes`. Their calculate triggers live under `/api/v1/versions/:versionId/calculate`.

### Frontend workspace context

`workspace-context-store.ts` (Zustand) is the single source of truth for the active fiscal year, versionId, comparison version, and academic period. The `PlanningShell` reads from this store via `useWorkspaceContextStore`. The `GET /api/v1/context` endpoint provides the authenticated user's role and permission list to the frontend on login.

### DataGrid component

`apps/web/src/components/data-grid/data-grid.tsx` is the shared headless-table wrapper used by all planning grids (enrollment, revenue, staffing). It pairs TanStack Table v8 with shadcn/ui `<Table>`. Use `cell-renderers.tsx` for typed cell types (numeric, text, editable). Do not build ad-hoc table layouts — always compose from `DataGrid`.

### Migration tooling

`apps/api/src/migration/` contains one-shot importers for bootstrapping from historical Excel/CSV data (DHG grille, employees, master data). These run outside the normal API lifecycle via `apps/api/src/migration/index.ts`. They are not called by any route; run them directly with `tsx`.

### Money formatting

`apps/web/src/lib/format-money.ts` is the only place that converts `decimal.js` strings to display strings (SAR, compact notation, etc.). Import from here for all monetary display — never call `toLocaleString` directly on amounts.

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
| ADRs (ADR-018 to ADR-027+)                      | `docs/adr/`                       |
| Security architecture                           | `docs/tdd/05_security.md`         |
| Data model                                      | `docs/tdd/02_component_design.md` |
| API contracts                                   | `docs/tdd/04_api_contract.md`     |
| Infrastructure / Docker                         | `docs/tdd/06_infrastructure.md`   |
