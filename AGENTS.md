# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

**BudFin** is a school financial planning application for EFIR (École Française Internationale de Riyad). It manages staff positions, salary structures, enrollment forecasting, and annual budget planning. The system is deployed as a Docker Compose stack on-premise within KSA to comply with PDPL data residency requirements.

### Key Domain Concepts

- **Budget Version**: A self-contained snapshot of all budget data (enrollment, fee grids, employees, calculations). Versions have a lifecycle: Draft → Published → Locked → Archived.
- **Fiscal Year**: The school's financial year running January–December.
- **Academic Periods**: AY1 (Jan–Jun), Summer (Jul–Aug), AY2 (Sep–Dec) — 36 instructional weeks total.
- **DHG (Dotation Horaire Globale)**: Teaching hour allocation computation based on enrollment and class sizes.
- **YEARFRAC**: US 30/360 day-count convention used for End-of-Service calculations — must match Excel exactly.

### Architecture Style

Monolithic SPA + REST API (not microservices). The calculation chain (enrollment → revenue → DHG → staff costs → P&L) is tightly coupled and runs in a single PostgreSQL transaction for atomicity.

---

## Technology Stack

### Runtime Requirements

| Component  | Version        | Notes                       |
| ---------- | -------------- | --------------------------- |
| Node.js    | 22 LTS (v22.x) | v20 EOL April 2026          |
| pnpm       | >=10.0.0       | Workspace-based monorepo    |
| TypeScript | 5.9.3 (pinned) | See ADR-013                 |
| PostgreSQL | 16             | pgcrypto extension required |

### Backend (`apps/api`)

| Package                            | Purpose                                  |
| ---------------------------------- | ---------------------------------------- |
| `fastify` ^5.7.0                   | HTTP framework with Zod validation       |
| `fastify-type-provider-zod` ^6.0.0 | Schema-first type validation             |
| `prisma` ^6.0.0                    | ORM with native Decimal support          |
| `decimal.js` ^10.6.0               | Fixed-point arithmetic (TC-001)          |
| `jose` ^5.0.0                      | JWT signing/verification (RS256)         |
| `bcryptjs` ^3.0.0                  | Password hashing (cost factor 12)        |
| `pg-boss` ^10.0.0                  | PostgreSQL-backed job queue              |
| `@react-pdf/renderer` ^4.3.0       | Server-side PDF generation (no Chromium) |
| `exceljs` ^4.4.0                   | Excel export                             |
| `winston` ^3.19.0                  | Structured JSON logging                  |
| `prom-client` ^15.1.0              | Prometheus metrics                       |
| `zod` ^4.0.0                       | Runtime schema validation                |

### Frontend (`apps/web`)

| Package                                   | Purpose                                                 |
| ----------------------------------------- | ------------------------------------------------------- |
| `react` ^19.0.0                           | UI framework                                            |
| `react-router` ^7.13.1                    | Client-side routing                                     |
| `@tanstack/react-query` ^5.0.0            | Server-state management                                 |
| `@tanstack/react-table` ^8.0.0            | Headless table logic (no virtual scrolling per ADR-016) |
| `react-hook-form` ^7.0.0                  | Form state management                                   |
| `@hookform/resolvers` ^5.0.0              | Zod resolver (v5 required for Zod 4)                    |
| `zustand` ^5.0.0                          | Client-side UI state                                    |
| `recharts` ^3.0.0                         | Charts                                                  |
| `radix-ui` ^1.4.0                         | Accessible UI primitives                                |
| `tailwindcss` ^4.2.0                      | CSS-first styling (Oxide engine)                        |
| `decimal.js` ^10.6.0                      | Display formatting only (never calculations)            |
| `date-fns` ^4.0.0 + `@date-fns/tz` ^1.0.0 | AST (UTC+3) timezone handling                           |

---

## Build and Development Commands

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

# Prisma commands
pnpm --filter @budfin/api exec prisma generate
pnpm --filter @budfin/api exec prisma migrate dev
pnpm --filter @budfin/api exec prisma migrate deploy
pnpm --filter @budfin/api exec prisma seed      # Runs prisma/seed.ts
```

### Development Server Notes

- API dev server uses `tsx watch` (not `ts-node`). No compilation step needed during development.
- Web dev server uses Vite with proxy to API at `:3001`.

---

## Environment Setup

1. Copy `.env.example` to `apps/api/.env` before first run
2. Generate JWT keys:

    ```bash
    mkdir -p secrets
    openssl genrsa -out secrets/jwt_private_key.pem 2048
    openssl rsa -in secrets/jwt_private_key.pem -pubout -out secrets/jwt_public_key.pem
    ```

3. Generate salary encryption key:

    ```bash
    openssl rand -base64 32 > secrets/salary_encryption_key.txt
    ```

4. Start PostgreSQL:

    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up db -d
    ```

### Required Environment Variables

| Variable                | Description                  |
| ----------------------- | ---------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string |
| `JWT_PRIVATE_KEY_PATH`  | Path to RSA private key PEM  |
| `JWT_PUBLIC_KEY_PATH`   | Path to RSA public key PEM   |
| `SALARY_ENCRYPTION_KEY` | Path to AES-256 key file     |
| `NODE_ENV`              | development / production     |
| `LOG_LEVEL`             | debug / info / warn / error  |

---

## Code Style Guidelines

### TypeScript Configuration

- **Base config**: `tsconfig.base.json` with `moduleResolution: "Bundler"`
- **API override**: `module: "Node16"`, `moduleResolution: "Node16"` (required for Prisma)
- **Web override**: `jsx: "react-jsx"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`
- Strict mode enabled: `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`

### ESLint (Flat Config)

- Config file: `eslint.config.ts` (not `.eslintrc.*`)
- Global rules:
    - `no-console`: `error` — use Winston logger or prefix with `_` to suppress
    - `@typescript-eslint/no-unused-vars`: ignores `^_` pattern
- Seed files exception: `no-console: off` for `prisma/seed.ts`
- React-specific rules in `apps/web/`

### Prettier Configuration

```javascript
{
  useTabs: true,
  tabWidth: 2,
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'es5',
  overrides: [{ files: '**/*.md', options: { useTabs: false, tabWidth: 4 } }]
}
```

### Code Organization

```text
apps/api/src/
  index.ts           # Fastify app builder + server start
  lib/               # Shared utilities (logger, prisma, rbac)
  plugins/           # Fastify plugins (auth, logging, metrics)
  routes/            # Route handlers by domain
    master-data/     # Reference data endpoints
  services/          # Business logic (password, token, token-family)
  prisma/
    schema.prisma    # Database schema
    seed.ts          # Development seed data

apps/web/src/
  components/        # React components (ui/, admin/, versions/, etc.)
  hooks/             # TanStack Query custom hooks
  layouts/           # Shell layouts
  lib/               # Utilities (api-client, cn)
  pages/             # Route components
  stores/            # Zustand stores (auth-store.ts)
  router.tsx         # React Router configuration
```

### Naming Conventions

- **Files**: kebab-case for everything (`auth-refresh.test.ts`, `user-side-panel.tsx`)
- **Components**: PascalCase (`VersionDetailPanel`, `AuditFilters`)
- **Functions/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Database columns**: snake_case (mapped via Prisma `@map`)
- **API routes**: kebab-case (`/fiscal-periods`, `/system-config`)

### Import Order (Conventional)

1. External dependencies
2. Internal shared packages (`@budfin/types`)
3. Internal relative imports
4. Type-only imports last

---

## Testing Strategy

### Test Framework: Vitest

- Co-located tests: `*.test.ts` alongside source files
- API tests use real Prisma client with test database
- Web tests use `jsdom` environment with `@testing-library/react`

### Test Commands

```bash
pnpm test                    # Run all tests
pnpm --filter @budfin/api test
pnpm --filter @budfin/web test
```

### Coverage Targets

| Module             | Line Coverage | Branch Coverage |
| ------------------ | ------------- | --------------- |
| Calculation engine | >= 80%        | >= 90%          |
| RBAC middleware    | >= 80%        | >= 90%          |
| API routes         | >= 60%        | N/A             |
| Overall            | >= 60%        | N/A             |

### Critical Test Areas

1. **YEARFRAC implementation** — must match Excel US 30/360 exactly
2. **Decimal.js arithmetic** — no floating-point errors in financial calculations
3. **RBAC middleware** — every protected endpoint with every role
4. **Token family rotation** — theft detection on refresh token replay
5. **Version lifecycle** — state machine transitions

### Test Database

Integration tests use a dedicated PostgreSQL database. Schema is applied via `prisma migrate deploy` in CI.

---

## Security Considerations

### Authentication

- **JWT**: RS256 asymmetric signing (private key server-only)
- **Access token**: 30-minute TTL, held in JavaScript memory only (never localStorage)
- **Refresh token**: 8-hour TTL, HTTP-only `SameSite=Strict` cookie scoped to `/api/v1/auth`
- **Token rotation**: Every refresh revokes the presented token and issues a new pair
- **Token families**: Replay of revoked refresh token revokes entire family

### Authorization

| Role        | Key Permissions                                |
| ----------- | ---------------------------------------------- |
| Admin       | Full system access                             |
| BudgetOwner | versions:create, versions:publish, salary:view |
| Editor      | data:edit, calculations:run, salary:view       |
| Viewer      | data:view, data:export only                    |

### PDPL Compliance (KSA Data Protection)

- **Data residency**: Database hosted within KSA
- **Field-level encryption**: 5 salary fields encrypted via pgcrypto AES-256
- **Encryption key**: Docker secret at `/run/secrets/salary_encryption_key` (never in DB)
- **Audit trail**: Append-only `audit_entries` table — `UPDATE`/`DELETE` revoked from app user

### Security Headers

- TLS 1.3 minimum (1.2 permitted for legacy)
- HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff
- CORS: single-origin allowlist
- Rate limiting: 100 req/min authenticated, 10 login attempts per 15 min per IP

### Input Validation

- Every endpoint uses Zod schemas via `fastify-type-provider-zod`
- Prisma ORM uses parameterized queries exclusively
- No raw SQL with user input permitted (blocking PR finding)

---

## Key Technical Constraints

### TC-001: Fixed-Point Decimal Arithmetic

**CRITICAL**: All monetary values use `Decimal.js`. Never use native `Number` for money.

```typescript
import Decimal from 'decimal.js';
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Correct
const total = price.mul(quantity).add(tax);

// INCORRECT - Never do this
const total = price * quantity + tax; // Floating-point errors!
```

### TC-002: YEARFRAC US 30/360

Custom implementation must match Excel `YEARFRAC(start, end, 0)` exactly. Validated against 168 employee records.

### TC-003: Database Decimal Precision

- `DECIMAL(15,4)` — monetary amounts (salaries, fees, totals)
- `DECIMAL(7,6)` — rates (percentages, tax rates)
- `DECIMAL(5,4)` — hourly allocations
- `DECIMAL(7,4)` — YEARFRAC output

### TC-004: Rounding Policy

Store full precision in DB. Round to 2 decimal places (SAR) only at presentation layer.

### TC-005: Timezone

All dates in **Arabia Standard Time (UTC+3)**. Use `@date-fns/tz`, never `new Date()` for display.

---

## Database Patterns

### Prisma 6 Breaking Changes

- Binary fields use `Uint8Array`, not `Buffer`
- `NotFoundError` removed — use `PrismaClientKnownRequestError` with code `P2025`
- Implicit many-to-many `_id` fields renamed

### Schema Patterns

```prisma
model Example {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  @@map("examples")
}
```

### Audit Logging

Automatic via Prisma `$extends` middleware. Captures old/new values on all mutations.

---

## Deployment

### Docker Compose Stack

| Service | Image              | Port            | Purpose                       |
| ------- | ------------------ | --------------- | ----------------------------- |
| nginx   | nginx:1.25-alpine  | 80, 443         | TLS termination, static files |
| api     | node:22-alpine     | 3001 (internal) | Fastify API + pg-boss workers |
| db      | postgres:16-alpine | internal only   | PostgreSQL                    |

### Build Targets

```bash
# Production
docker compose -f docker-compose.yml up -d --build

# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Secrets (Production)

- `jwt_private_key` → `/run/secrets/jwt_private_key`
- `salary_encryption_key` → `/run/secrets/salary_encryption_key`

---

## Reference Documents

| Purpose                       | Location                        |
| ----------------------------- | ------------------------------- |
| Full Technical Design         | `docs/tdd/` (12 files)          |
| Product Requirements          | `docs/prd/BudFin_PRD_v2.0.md`   |
| Architecture Decisions (ADRs) | `docs/tdd/09_decisions_log.md`  |
| Pinned Stack Versions         | `docs/tdd/stack-versions.md`    |
| API Contracts                 | `docs/tdd/04_api_contract.md`   |
| Security Architecture         | `docs/tdd/05_security.md`       |
| Infrastructure                | `docs/tdd/06_infrastructure.md` |
| Implementation Plans          | `docs/plans/`                   |

---

## Workflow Commands

See `.claude/COMMANDS.md` for full command reference:

- `/workflow:status` — show current phase and checklist
- `/workflow:advance` — gate-check and move to next phase
- `/workflow:run [epic-N]` — drive full Epic lifecycle
- `/plan:spec [epic-N]` — write a feature spec
- `/plan:stories [epic-N]` — create story issues from spec
- `/impl:story [#]` — implement a single story
- `/impl:commit [#]` — commit, push branch, open draft PR
- `/fix:lint` / `/fix:types` / `/fix:tests` — targeted fixers

---

## Common Gotchas

1. **Package name**: The Zod type provider is `fastify-type-provider-zod` (not `@fastify/type-provider-zod`)
2. **React Hook Form resolver**: Must use `@hookform/resolvers` v5 for Zod 4 compatibility (v3 only works with Zod 3)
3. **Prisma error handling**: Check for `P2025` code, not `NotFoundError`
4. **Console logging**: `no-console` is set to `error` globally — use Winston or prefix with `_`
5. **Tailwind v4**: CSS-first config, no `tailwind.config.js` file
6. **Timezone**: Always use `@date-fns/tz` for AST (UTC+3), never assume local timezone
7. **Decimal.js in frontend**: For display formatting ONLY — never for calculations
