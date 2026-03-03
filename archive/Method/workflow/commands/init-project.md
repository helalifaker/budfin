# Command: /init-project

## Purpose

Bootstrap a new project with the full workflow structure, chosen tech stack,
and CI/CD pipeline. This is the first command run on any new project.

## Trigger

User says: "init project", "start new project", "bootstrap", "/init-project"

## Protocol

### Step 1: Interview for Project Decisions

Use `AskUserQuestion` to gather:

1. **Application type** — What are you building? (SaaS, internal tool, API, etc.)
2. **Tech stack** — Frontend framework, backend framework, database, ORM
3. **Authentication** — Strategy (JWT, session, OAuth, magic link)
4. **Deployment target** — Vercel, AWS, Docker, etc.
5. **Package manager** — npm, pnpm, yarn, bun
6. **Monorepo** — Single repo or monorepo? If mono, which tool? (turborepo, nx)

### Step 2: Create Directory Structure

```bash
mkdir -p specs prototypes reviews status docs/{api,components,adr,migrations}
mkdir -p .github/workflows
```

### Step 3: Generate PROJECT.md

Record all decisions from Step 1:

```markdown
# PROJECT.md

## Stack
- Frontend: [chosen]
- Backend: [chosen]
- Database: [chosen]
- ORM: [chosen]
- Auth: [chosen]
- Package Manager: [chosen]

## Commands
- `run-tests`: [actual command, e.g., "npx vitest run"]
- `run-lint`: [actual command, e.g., "npx eslint ."]
- `run-typecheck`: [actual command, e.g., "npx tsc --noEmit"]
- `run-coverage`: [actual command, e.g., "npx vitest run --coverage"]
- `run-e2e`: [actual command, e.g., "npx playwright test"]
- `run-build`: [actual command, e.g., "npm run build"]
- `run-dev`: [actual command, e.g., "npm run dev"]

## Conventions
- Test files: [location and naming pattern]
- Branch naming: feature/<name>, fix/<name>, docs/<name>
- Commit messages: Conventional Commits (feat:, fix:, docs:, etc.)

## Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | Database connection string | yes |
| (etc.) | | |
```

### Step 4: Initialize Project

```bash
# Initialize the project with the chosen stack
# This is stack-specific — examples:
npx create-next-app@latest . --typescript --tailwind --app
# or
uv init && uv add fastapi uvicorn
# etc.
```

### Step 5: Configure Testing

Install and configure the testing framework:

- Unit/Integration: vitest, jest, pytest, etc.
- E2E: playwright, cypress, etc.
- Coverage: built-in to test runner

### Step 6: Configure Linting and Formatting

- ESLint / Ruff / etc.
- Prettier / Black / etc.
- Husky + lint-staged for pre-commit hooks

### Step 7: Set Up CI/CD

Copy and customize the GitHub Actions workflow from `ci/ci-pipeline.yml`.

### Step 8: Initial Commit

```bash
git init
git add .
git commit -m "feat: initial project setup with workflow infrastructure"
```

## Output

- Fully bootstrapped project with all tooling configured
- `PROJECT.md` with all decisions recorded
- CI/CD pipeline ready
- First commit on main branch
