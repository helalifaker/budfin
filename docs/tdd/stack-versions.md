# BudFin — Pinned Stack Version Manifest

**Document Version:** 1.3
**Date:** March 13, 2026
**Status:** Adopted — supersedes TDD v1.0 version table

This file is the canonical source of truth for all package versions used in BudFin. All `package.json` files, Docker images, and CI configuration must align with the versions listed here.

---

## Runtime & Language

| Package    | Version            | Notes                                                                                                                                    |
| ---------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js    | **22 LTS (v22.x)** | v20 EOL April 2026; v22 LTS supported to April 2027; required by Vite 7                                                                  |
| TypeScript | **5.9.3** (pinned) | Latest stable release as of March 2026; confirmed via Context7 (no TS 6 stable exists yet). TS 6 is planned but unreleased; see ADR-013. |
| pnpm       | **>=10.0.0**       | Workspace-based monorepo manager                                                                                                         |

---

## Backend (`apps/api`)

| Package                   | Version | Notes                                                                                                     |
| ------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| fastify                   | ^5.7.0  | v4 EOL June 2025; schema-first, native TS; replaces deferred Express/Fastify decision                     |
| @fastify/jwt              | ^9.0.0  | JWT plugin for Fastify 5                                                                                  |
| @fastify/cookie           | ^11.0.0 | Cookie plugin for Fastify 5                                                                               |
| @fastify/cors             | ^10.0.0 | CORS plugin for Fastify 5                                                                                 |
| @fastify/multipart        | ^9.4.0  | Multipart form data handling for file uploads                                                             |
| @fastify/rate-limit       | ^10.0.0 | Rate limiting for Fastify 5                                                                               |
| fastify-plugin            | ^5.0.0  | Fastify plugin utility for encapsulation control                                                          |
| fastify-type-provider-zod | ^6.0.0  | Zod integration for Fastify schema validation                                                             |
| prisma                    | ^6.0.0  | **Breaking from v5:** `Buffer` → `Uint8Array`; `NotFoundError` removed; implicit m-n `_id` fields renamed |
| @prisma/client            | ^6.0.0  | Generated Prisma client                                                                                   |
| decimal.js                | ^10.6.0 | No breaking changes from 10.x                                                                             |
| zod                       | ^4.0.0  | Stable since July 2025; mandatory for Fastify schema validation                                           |
| jose                      | ^5.0.0  | Replaces `jsonwebtoken`; ESM-native, standards-compliant, tree-shakeable                                  |
| bcryptjs                  | ^3.0.0  | Pure JS, TS-friendly; preferred over native `bcrypt`                                                      |
| winston                   | ^3.19.0 | Structured JSON logging                                                                                   |
| prom-client               | ^15.1.0 | Prometheus metrics; audit for security — aging but stable                                                 |
| exceljs                   | ^4.4.0  | Server-side xlsx; aging (2yr no update) but stable; monitor for security                                  |
| @react-pdf/renderer       | ^4.3.0  | Server-side PDF generation; replaces Puppeteer (see ADR-014); no Chrome dependency, < 50 MB RAM per job   |
| fast-csv                  | ^5.0.0  | CSV import/export                                                                                         |
| papaparse                 | ^5.5.3  | CSV parsing for enrollment/staff data import                                                              |
| pg-boss                   | ^10.0.0 | PostgreSQL-backed job queue (no Redis dependency)                                                         |
| date-fns                  | ^4.0.0  | Timezone support via `@date-fns/tz`; critical for AST (UTC+3) handling                                    |
| @date-fns/tz              | ^1.0.0  | Arabia Standard Time (UTC+3) support                                                                      |

### Backend DevDependencies

| Package             | Version | Notes                             |
| ------------------- | ------- | --------------------------------- |
| vitest              | ^4.0.0  | Browser Mode stable in v4         |
| @vitest/coverage-v8 | ^4.0.0  | V8-based code coverage provider   |
| tsx                 | latest  | TypeScript execute for dev server |
| @types/bcryptjs     | latest  | Type definitions                  |
| @types/node         | ^22.0.0 | Node.js v22 type definitions      |

---

## Frontend (`apps/web`)

| Package                                | Version  | Notes                                                                           |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| react                                  | ^19.0.0  | Stable since Dec 2024; new hooks API, Actions, Server Components support        |
| react-dom                              | ^19.0.0  | React DOM renderer                                                              |
| react-hook-form                        | ^7.0.0   | Performant form state; pairs with Zod                                           |
| @hookform/resolvers                    | ^5.0.0   | Zod resolver for React Hook Form; **v5 required for Zod 4** (v3 is Zod 3 only)  |
| zod                                    | ^4.0.0   | Shared with backend; form + API validation                                      |
| @tanstack/react-table                  | ^8.0.0   | **Replaces AG Grid Community**; headless table logic                            |
| @tanstack/react-query                  | ^5.0.0   | Server-state management; caching, background sync, pagination                   |
| recharts                               | ^3.0.0   | Charts; React 19 compatible                                                     |
| zustand                                | ^5.0.0   | Client-side UI state; minimal API; React 19 compatible                          |
| decimal.js                             | ^10.6.0  | Presentation-layer rounding only (TC-004); no calculations                      |
| date-fns                               | ^4.0.0   | Date formatting and parsing                                                     |
| @date-fns/tz                           | ^1.0.0   | AST (UTC+3) display formatting                                                  |
| @fontsource-variable/dm-sans           | ^5.2.8   | DM Sans variable font                                                           |
| @fontsource-variable/plus-jakarta-sans | ^5.2.8   | Plus Jakarta Sans variable font                                                 |
| @fontsource/geist-mono                 | ^5.2.7   | Geist Mono font for code/monospace                                              |
| radix-ui                               | ^1.4.0   | Unified `radix-ui` package (Feb 2026); headless accessible primitives (WCAG AA) |
| @radix-ui/react-tabs                   | ^1.1.13  | Radix UI tabs primitive (explicit version alongside unified radix-ui package)   |
| class-variance-authority               | ^0.7.0   | Variant-based class generation for shadcn/ui components                         |
| clsx                                   | ^2.1.0   | Conditional className utility                                                   |
| tailwind-merge                         | ^3.5.0   | Merge Tailwind classes without conflicts                                        |
| lucide-react                           | ^0.576.0 | Icon library used by shadcn/ui                                                  |
| react-router                           | ^7.13.0  | Client-side routing for SPA                                                     |

### Frontend DevDependencies

| Package                | Version | Notes                                                               |
| ---------------------- | ------- | ------------------------------------------------------------------- |
| vite                   | ^7.3.0  | Requires Node.js 20.19+ or 22.12+                                   |
| @vitejs/plugin-react   | ^5.1.0  | Vite React plugin                                                   |
| @tailwindcss/vite      | ^4.2.0  | Tailwind v4 Vite plugin (replaces PostCSS integration)              |
| tailwindcss            | ^4.2.0  | CSS-first config; Oxide engine (5x faster); no `tailwind.config.js` |
| vitest                 | ^4.0.0  | Shared test framework                                               |
| @testing-library/react | ^16.3.0 | React component testing                                             |
| jsdom                  | ^28.1.0 | DOM environment for Vitest                                          |
| @types/react           | ^19.0.0 | React 19 type definitions                                           |
| @types/react-dom       | ^19.0.0 | React DOM type definitions                                          |

---

## Root (Shared DevDependencies)

| Package                     | Version        | Notes                                                                                              |
| --------------------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| typescript                  | 5.9.3 (pinned) | Shared compiler across all workspaces; see ADR-013                                                 |
| prettier                    | ^3.8.0         | No breaking changes                                                                                |
| eslint                      | ^9.0.0         | **Flat config** (`eslint.config.ts`) — breaking from `.eslintrc`; v9 chosen for stability over v10 |
| @eslint/js                  | ^9.39.0        | ESLint core rules package                                                                          |
| typescript-eslint           | ^8.56.0        | TypeScript ESLint integration (flat config)                                                        |
| eslint-plugin-react-hooks   | ^7.0.0         | React Hooks linting rules                                                                          |
| eslint-plugin-react-refresh | ^0.5.2         | React Refresh validation for Vite HMR                                                              |
| globals                     | ^17.4.0        | Global variable definitions for ESLint                                                             |
| markdownlint-cli            | ^0.48.0        | Markdown linting                                                                                   |
| husky                       | ^9.1.0         | Git hooks manager (pre-commit)                                                                     |
| lint-staged                 | ^15.5.0        | Run linters on staged files only                                                                   |

---

## Infrastructure (Docker)

| Component          | Image                | Notes                         |
| ------------------ | -------------------- | ----------------------------- |
| PostgreSQL         | `postgres:16-alpine` | Unchanged                     |
| nginx              | `nginx:1.25-alpine`  | Unchanged                     |
| Node.js base image | `node:22-alpine`     | Updated from `node:20-alpine` |
| Docker Compose     | v2                   | Unchanged                     |

---

## Key Migration Notes

### Prisma 6 Breaking Changes (from v5)

- `Buffer` → `Uint8Array` for binary fields — affects pgcrypto-encrypted salary fields; update all `Buffer` usages in repository layer
- `NotFoundError` removed — replace with `PrismaClientKnownRequestError` + code `P2025`
- Implicit m-n `_id` fields renamed — verify against traceability matrix in `10_traceability_matrix.md`

### jose vs jsonwebtoken

`jose` replaces `jsonwebtoken` for JWT operations. It is ESM-native, standards-compliant (IETF JWT/JWS/JWE), tree-shakeable, and supports modern algorithms (EdDSA, RSA-PSS). The `@fastify/jwt` plugin wraps `jose` internally.

### TanStack Table (no virtual scrolling)

`@tanstack/react-table` v8 is headless — provides sorting, filtering, pagination, and row selection logic with no UI. Combine with:

- shadcn/ui `<Table>` components for rendering
- Tailwind v4 for layout and styling

`@tanstack/react-virtual` is **not included** (see ADR-016). Maximum table size in v1 is ~300 rows (staff costs); modern browsers render 300 DOM rows trivially without virtualization. Re-evaluate in v2 if an audit log UI with 10,000+ rows is required.

### TypeScript Version

TypeScript is pinned at **5.9.3** (latest stable as of March 2026). There is no TypeScript 6.0 stable release on npm. TS 6 exists only as a pre-release. See ADR-013 for rationale. Re-evaluate when TS 6 reaches a stable npm tag.

### ESLint 9 Flat Config

ESLint 9 uses flat config (`eslint.config.ts` instead of `.eslintrc.*`). This is a breaking change. v9 is chosen over v10 for stability. All ESLint plugins used must support flat config.
