---
name: ts-standards
description: TypeScript and project-wide coding standards for BudFin. Use when creating or editing any TypeScript file, doing code review, discussing linting, or working on project configuration. Encodes ESLint 9 flat config, TypeScript 5.9.3 pinned version rules, pnpm workspace commands, and monorepo module resolution settings.
---

# BudFin TypeScript & Project Standards

## Indentation & Formatting

- **Tabs** for indentation (not spaces)
- **100 characters** max line length
- **Single quotes** for strings
- **kebab-case** file names (`user-profile.ts`, `api-client.py`)
- **Named exports** — no default exports
- Follow established conventions of each language/framework in the project

## ESLint 9 Flat Config

- Config file: `eslint.config.ts` (NOT `.eslintrc.*` — ESLint 9 uses flat config only)
- No `// eslint-disable` comments without an explicit written justification in a comment immediately above
- Run `pnpm lint` before every commit; fix ALL errors AND warnings — zero exceptions
- `pnpm --filter @budfin/api lint` or `pnpm --filter @budfin/web lint` to lint specific workspace

## TypeScript Version

- **TypeScript 5.9.3 — PINNED** (see ADR-013)
- Do NOT upgrade to TypeScript 6 — no stable npm release exists as of March 2026
- Version is locked in root `package.json` devDependencies; do not change it

## Module Resolution

| Package | `module` | `moduleResolution` |
|---------|----------|--------------------|
| `apps/api` | `Node16` | `Node16` |
| `apps/web` | `ESNext` (inherits base) | `Bundler` (inherits base) |
| `packages/types` | inherits base | inherits base |

- `tsconfig.base.json` sets `"moduleResolution": "Bundler"` for web compatibility
- `apps/api/tsconfig.json` overrides with `"module": "Node16"`, `"moduleResolution": "Node16"`
- Never change `apps/web` to Node16 — Vite requires Bundler resolution

## Monorepo Structure

```
budfin/
├── apps/api/          # Fastify backend (@budfin/api)
├── apps/web/          # React + Vite frontend (@budfin/web)
├── packages/types/    # Shared TS types (@budfin/types)
├── pnpm-workspace.yaml
├── .npmrc             # engine-strict=true, node-linker=hoisted
├── package.json       # Root: scripts + shared devDeps
└── tsconfig.base.json
```

## pnpm Workspace Commands

```bash
# Run script in specific workspace
pnpm --filter @budfin/api <script>
pnpm --filter @budfin/web <script>

# Install package in specific workspace
pnpm --filter @budfin/api add <package>
pnpm --filter @budfin/web add -D <package>

# Run from root (all workspaces)
pnpm -r <script>

# Build all
pnpm build
```

## Pre-Commit Checklist

Before every commit:
1. `pnpm lint` — must pass with zero errors and zero warnings
2. `pnpm typecheck` — must pass with zero errors
3. `pnpm test` — all tests must pass
4. No `console.log` left in production code
5. No commented-out code blocks
6. No TODO/FIXME comments without a linked task

## Code Quality Rules

- Write explicit, clear code — no clever tricks, no implicit behavior
- Minimal abstractions — no over-engineering, no premature optimization
- No placeholders, no incomplete implementations
- Every feature must be fully functional, not "good enough for now"
- Prefer writing 3 similar lines over a premature abstraction
- Only add comments where logic is not self-evident — code should be self-documenting
