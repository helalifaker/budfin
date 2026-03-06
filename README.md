# BudFin

School financial planning application for EFIR (École Française Internationale de Riyad).
Manages staff positions, salary structures, and annual budget forecasting.

## Architecture

Monolithic SPA + REST API deployed as a Docker Compose stack on-premise.

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 (`apps/web`)
- **Backend**: Fastify 5 + Prisma 6 + PostgreSQL 16 (`apps/api`)
- **Shared types**: `packages/types`

See `docs/tdd/` for the full Technical Design Document (12 files, ~350 KB).

## Requirements

- Node.js 22 LTS
- pnpm 10+
- PostgreSQL 16 (via Docker Compose in production)

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment file and fill in values
cp .env.example apps/api/.env

# Generate Prisma client
pnpm --filter @budfin/api exec prisma generate

# Start development servers (API on :3001, web on :5173)
pnpm dev
```

## Development Commands

```bash
pnpm dev          # Start all apps in watch mode
pnpm build        # Build all packages
pnpm typecheck    # Type-check all packages
pnpm lint         # Lint all packages
pnpm test         # Run all tests
pnpm lint:md      # Lint Markdown documentation
```

## Documentation

| Document                      | Location                       |
| ----------------------------- | ------------------------------ |
| Technical Design Document     | `docs/tdd/`                    |
| Product Requirements          | `docs/prd/`                    |
| Edge Case Analysis            | `docs/edge-cases/`             |
| Architecture Decision Records | `docs/tdd/09_decisions_log.md` |
| Stack version manifest        | `docs/tdd/stack-versions.md`   |
| Implementation plans          | `plans/`                       |

## Project Layout

```text
apps/api/        Fastify REST API
apps/web/        React SPA
packages/types/  Shared TypeScript types
data/budgets/    EFIR FY2026 reference XLSX files
data/enrollment/ Enrollment CSV data (2021–2026)
docs/            Architecture and product documentation
```
