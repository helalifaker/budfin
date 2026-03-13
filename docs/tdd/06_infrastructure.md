# BudFin Technical Design Document v1.0

| Field  | Value    |
| ------ | -------- |
| Status | Approved |

## Section 8 — Infrastructure & Deployment

### 8.1 Docker Compose Stack

BudFin deploys as a three-service Docker Compose stack on a single host. This architecture matches the single-school, single-tenant deployment model (SA-006) and keeps operational complexity proportional to the team size. The background worker runs in-process inside the `api` container using pg-boss in-process workers (see ADR-015).

**Services:**

| Service | Image                   | Role                                                 | Port Exposure                       |
| ------- | ----------------------- | ---------------------------------------------------- | ----------------------------------- |
| `nginx` | `nginx:1.25-alpine`     | TLS termination, static file serving, reverse proxy  | 443 (HTTPS), 80 (HTTP redirect)     |
| `api`   | Custom (Node.js 22 LTS) | Fastify REST API server + pg-boss in-process workers | Internal only (3001)                |
| `db`    | `postgres:16-alpine`    | PostgreSQL database                                  | Internal only (not exposed to host) |

```yaml
# docker-compose.prod.yml (production)
services:
    nginx:
        image: nginx:1.25-alpine
        ports:
            - '443:443'
            - '80:80'
        volumes:
            - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
            - ./nginx/ssl:/etc/nginx/ssl:ro
            - ./apps/web/dist:/usr/share/nginx/html:ro
        depends_on:
            api:
                condition: service_healthy
        restart: unless-stopped

    api:
        build:
            context: .
            dockerfile: apps/api/Dockerfile
            target: production
        environment:
            NODE_ENV: production
            DATABASE_URL: postgresql://app_user:${DB_PASSWORD}@db:5432/budfindb
            JWT_PRIVATE_KEY_PATH: /run/secrets/jwt_private_key
            JWT_PUBLIC_KEY_PATH: /run/secrets/jwt_public_key
            SALARY_ENCRYPTION_KEY: /run/secrets/salary_encryption_key
            LOG_LEVEL: info
        secrets:
            - jwt_private_key
            - jwt_public_key
            - salary_encryption_key
        depends_on:
            db:
                condition: service_healthy
        restart: unless-stopped
        healthcheck:
            test:
                [
                    'CMD',
                    'wget',
                    '--no-verbose',
                    '--tries=1',
                    '--spider',
                    'http://localhost:3001/api/v1/health',
                ]
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 10s

    db:
        image: postgres:16-alpine
        environment:
            POSTGRES_DB: budfindb
            POSTGRES_USER: app_user
            POSTGRES_PASSWORD: ${DB_PASSWORD}
        volumes:
            - pgdata:/var/lib/postgresql/data
            - ./db/init:/docker-entrypoint-initdb.d:ro
        restart: unless-stopped
        healthcheck:
            test: ['CMD-SHELL', 'pg_isready -U app_user -d budfindb']
            interval: 10s
            timeout: 5s
            retries: 5

volumes:
    pgdata:
        driver: local

secrets:
    jwt_private_key:
        file: ./secrets/jwt_private_key.pem
    jwt_public_key:
        file: ./secrets/jwt_public_key.pem
    salary_encryption_key:
        file: ./secrets/salary_encryption_key.txt
```

**Design decisions:**

- The `db` service has no port mapping in production. In the development `docker-compose.yml`, port 5432 is exposed to the host to allow local tooling access (e.g., pgAdmin, `psql`). In production (`docker-compose.prod.yml`), the database is accessible only on the internal Docker network, eliminating external attack surface.
- The `api` service depends on `db` with a health check condition, preventing startup before PostgreSQL is ready to accept connections.
- Docker secrets are used for the JWT private key, JWT public key, and salary encryption key. These are mounted as files at `/run/secrets/` inside the container, never passed as environment variable values in the Compose file. The API reads them via `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH`, and `SALARY_ENCRYPTION_KEY` environment variables that point to the secret file paths.
- Production healthchecks use `wget` (not `curl`) because the `node:22-alpine` base image does not include `curl` by default.
- Background job processing (PDF exports, calculation jobs) runs in-process inside the `api` container using `pg-boss` workers registered at server startup (`boss.work('export-job', handler)`). This eliminates a fourth container with no loss of functionality at 20-user scale. See ADR-015.

### 8.1.1 Dockerfile Reference

The `api` service uses a single multi-stage Dockerfile at `apps/api/Dockerfile`. The base image is `node:22-alpine`. There is no separate worker entrypoint — pg-boss workers start inside the Fastify server process.

The Dockerfile has four production stages plus a `development` target:

```dockerfile
# Stage 1: dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --filter @budfin/api

# Stage 2: build
FROM deps AS build
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY packages/types/src packages/types/src
COPY packages/types/tsconfig.json packages/types/
COPY tsconfig.base.json ./
RUN pnpm --filter @budfin/api exec prisma generate
RUN pnpm --filter @budfin/api exec tsc

# Stage 3: production dependencies only
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --filter @budfin/api --prod

# Stage 4: production image
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S budfin && adduser -S budfin -u 1001 -G budfin

COPY --from=build --chown=budfin:budfin /app/apps/api/dist ./dist
COPY --from=build --chown=budfin:budfin /app/apps/api/prisma ./prisma
COPY --from=prod-deps --chown=budfin:budfin /app/node_modules ./node_modules
COPY --from=build --chown=budfin:budfin /app/apps/api/package.json ./package.json

USER budfin
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Key differences from a naive 3-stage build:**

- **Stage 3 (`prod-deps`)** installs only production dependencies (`--prod`), keeping the final image smaller by excluding devDependencies.
- **Stage 4 (`production`)** creates a non-root user `budfin` (UID 1001) and runs the process as that user for defense-in-depth.
- **Prisma client** is generated during the build stage and the `prisma/` directory is copied to production for runtime migration support.

A **`development` target** also exists in the Dockerfile (built from the `deps` stage). The development `docker-compose.yml` uses `target: development` to run the API with `pnpm dev` (tsx watch) and bind-mounted source files for hot reload.

### 8.2 Nginx Configuration

```nginx
upstream api {
    server api:3001;
}

server {
    listen 80;
    server_name _;
    return 308 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name budfinapp.efir.edu.sa;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.3 TLSv1.2;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # SPA entry point - never cache so users always get latest
    location = /index.html {
        root /usr/share/nginx/html;
        add_header Cache-Control "no-cache" always;
    }

    # Static assets (hashed filenames)
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 10m;
    }

    # Metrics endpoint - restricted access
    location /metrics {
        allow 127.0.0.1;
        allow 172.16.0.0/12;
        deny all;
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    gzip on;
    gzip_types application/json application/javascript text/css;
}
```

**Key configuration points:**

- HTTP port 80 returns a 308 Permanent Redirect to HTTPS. No unencrypted traffic is served.
- **Security headers** include `Content-Security-Policy` (restrictive: `default-src 'self'`, no inline scripts), `Referrer-Policy` (`strict-origin-when-cross-origin`), and `Permissions-Policy` (disables camera, microphone, geolocation).
- **Cache-control strategy:** The `location = /index.html` block serves the SPA entry point with `Cache-Control: no-cache` so users always load the latest version. All other static assets use aggressive caching (`expires 1y`, `Cache-Control: public, immutable`) because Vite produces content-hashed filenames. Cache invalidation happens automatically when file hashes change on rebuild.
- The `try_files` directive with `/index.html` fallback supports client-side routing in the React SPA.
- `client_max_body_size 10m` on the API location matches Fastify's native `bodyLimit` setting and permits xlsx file imports.
- `proxy_read_timeout 60s` accommodates long-running calculation and export requests.
- The `/metrics` endpoint is restricted via IP-based access control: only `127.0.0.1` (localhost) and `172.16.0.0/12` (Docker internal network) are allowed. All other requests are denied.

### 8.2.1 Development Web Service

The development `docker-compose.yml` includes a `web` service (not present in production, where nginx serves pre-built static files). This service builds from `apps/web/Dockerfile`, serves the Vite dev server on port 3000, and bind-mounts source files for hot module replacement. It proxies API requests to the `api` service via `API_PROXY_TARGET`.

### 8.3 Environment Matrix

Only two Compose files exist: `docker-compose.yml` (development) and `docker-compose.prod.yml` (production). There is no staging Compose file.

| Component        | Development               | Production                                                               |
| ---------------- | ------------------------- | ------------------------------------------------------------------------ |
| Database         | Docker PostgreSQL (local) | Docker PostgreSQL + daily pg_dump                                        |
| API replicas     | 1 (unless-stopped)        | 1-2 (manual scale)                                                       |
| Backup           | None                      | Daily pg_dump + encrypted offsite copy                                   |
| Log level        | DEBUG                     | INFO (ERROR to email alert)                                              |
| TLS              | Self-signed (mkcert)      | Valid certificate (Let's Encrypt or CA)                                  |
| Monitoring       | None                      | UptimeRobot + Winston email alerts (Grafana deferred to v2; see ADR-017) |
| DB port exposure | 5432 (host-accessible)    | Internal only                                                            |
| JWT TTL          | 30 minutes                | 30 minutes                                                               |
| Rate limiting    | Disabled                  | Enabled                                                                  |
| Swagger UI       | Enabled                   | Disabled                                                                 |

### 8.4 HA/DR Strategy

#### Recovery Objectives

| Metric                         | Target     | Justification                                                                                  |
| ------------------------------ | ---------- | ---------------------------------------------------------------------------------------------- |
| RTO (Recovery Time Objective)  | < 4 hours  | Acceptable for an internal tool with < 20 users; documented restore procedure tested quarterly |
| RPO (Recovery Point Objective) | < 24 hours | Daily automated backups; worst-case data loss is one business day                              |

#### Backup Procedure

Daily automated backup runs via cron at 02:00 AST (off-peak hours):

```bash
# Crontab entry on production host
0 2 * * * pg_dump -Fc budfindb > /backups/budfindb_$(date +\%Y\%m\%d).dump
```

Post-backup encryption:

```bash
gpg --symmetric --cipher-algo AES256 budfindb_20260101.dump
```

Offsite copy: the encrypted dump file is copied to secondary storage (USB drive in a fireproof safe or object storage within KSA, per PDPL data residency requirements).

#### Backup Retention Policy

| Tier              | Retention       | Selection Rule                                            |
| ----------------- | --------------- | --------------------------------------------------------- |
| Daily backups     | 30 days rolling | Every daily backup                                        |
| Monthly snapshots | 12 months       | 1st-of-month backup preserved                             |
| Annual snapshots  | 10 years        | January 1 backup preserved (per NFR 11.7 audit retention) |

#### Restore Procedure

```bash
# Restore from custom-format dump
pg_restore -Fc -d budfindb -U postgres /backups/budfindb_20260303.dump
```

Estimated restore time for a 500MB database: approximately 20 minutes. Total recovery time including human validation: approximately 3.5 hours (within the 4-hour RTO).

#### Active-Passive Failover

- **Primary:** single production server running the full Docker Compose stack.
- **Secondary:** standby server with the latest backup restored and Docker Compose configuration ready.
- **Failover procedure:** manual. Bring up Docker Compose on the secondary server, update DNS to point to the secondary IP.
- No automatic failover is implemented. This is acceptable for an internal tool with fewer than 20 users and a 4-hour RTO.

#### Database Maintenance

- `VACUUM ANALYZE`: scheduled weekly via cron. PostgreSQL autovacuum is also enabled as a safety net.
- `REINDEX`: quarterly for large tables (`audit_entries`, `monthly_revenue`) to maintain index efficiency.

### 8.5 CI/CD Pipeline (GitHub Actions)

The CI pipeline runs quality gates only. There is no automated deployment step — production deploys are manual (see Rollback Procedure below).

```yaml
# .github/workflows/ci.yml (reference)
name: CI
on:
    push:
        branches: [main, 'feat/**', 'feature/**', 'story/**']
    pull_request:
        branches: [main]

concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true

jobs:
    install:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: '22'
                  cache: 'pnpm'
            - run: pnpm install --frozen-lockfile
            # Dependencies cached for downstream jobs

    # Parallel quality gates (all depend on install)
    lint: # pnpm lint
    typecheck: # prisma generate + pnpm typecheck
    test: # prisma generate + pnpm test --coverage
    audit: # pnpm audit --audit-level high
    format: # pnpm format:check
    lint-md: # pnpm lint:md

    build:
        needs: [lint, lint-md, typecheck, test, audit, format]
        # prisma generate + pnpm build
```

#### Build Gates

Every PR and push to `main` must pass all of the following gates before merge:

| Gate                                    | Tool                            | Threshold                              | Behavior on Failure |
| --------------------------------------- | ------------------------------- | -------------------------------------- | ------------------- |
| Linting                                 | ESLint + Prettier               | Zero errors, zero warnings             | Build fails         |
| Markdown linting                        | markdownlint                    | Zero errors                            | Build fails         |
| Formatting                              | Prettier (`format:check`)       | All files formatted                    | Build fails         |
| Type checking                           | `tsc --noEmit`                  | Zero type errors                       | Build fails         |
| Unit test coverage (overall)            | Vitest                          | >= 60%                                 | Build fails         |
| Unit test coverage (calculation engine) | Vitest                          | >= 80%                                 | Build fails         |
| Unit test coverage (RBAC)               | Vitest                          | >= 80%                                 | Build fails         |
| Integration tests                       | Vitest                          | All pass                               | Build fails         |
| Excel regression suite (Phase 2+)       | Custom Vitest suite             | All results within +/- 1 SAR tolerance | Build fails         |
| Dependency audit                        | `pnpm audit --audit-level high` | No HIGH or CRITICAL CVEs               | Build fails         |
| Build                                   | `pnpm build`                    | Clean build succeeds                   | Build fails         |

#### Branching Strategy

- **Trunk-based development** with short-lived feature branches.
- Feature branch naming convention: `feature/FR-REV-011-revenue-engine`.
- Pull requests required for all changes to `main`. Minimum 1 reviewer approval.
- No direct pushes to `main` (branch protection enforced).
- Branch protection rules: require passing CI status checks, require PR approval.

#### Rollback Procedure

```bash
# Emergency rollback to previous version
docker compose down
git checkout <previous-tag>
docker compose build
docker compose up -d

# Verify health
curl https://app/api/v1/health
```

For database rollbacks, restore from the pre-migration backup taken automatically before each Prisma migration:

```bash
pg_restore -Fc -d budfindb -U postgres pre_migration.dump
```

### 8.6 Observability

#### Structured Logging (Winston)

Every log entry is a JSON object written to stdout. This format enables log aggregation, filtering, and alerting through standard tooling.

```json
{
    "timestamp": "2026-03-03T10:30:00.000Z",
    "level": "info",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": 42,
    "module": "RevenueEngine",
    "message": "Revenue calculation completed",
    "duration_ms": 1247,
    "version_id": 3
}
```

**Log levels and routing:**

| Level | Description                                                      | Production Routing          |
| ----- | ---------------------------------------------------------------- | --------------------------- |
| ERROR | Application errors, unhandled exceptions                         | stdout + file + email alert |
| WARN  | Recoverable issues, deprecation notices                          | stdout + file               |
| INFO  | Request lifecycle, business operations, audit events             | stdout + file               |
| DEBUG | Detailed diagnostic data (query parameters, intermediate values) | Disabled in production      |

#### Metrics (prom-client)

Application metrics are exposed at the `/metrics` endpoint in Prometheus exposition format. Nginx restricts access to this endpoint to the monitoring subnet only.

| Metric                       | Type                      | Labels                | Purpose                               |
| ---------------------------- | ------------------------- | --------------------- | ------------------------------------- |
| `http_request_duration_ms`   | Histogram (p50, p95, p99) | endpoint, status_code | API latency tracking                  |
| `calculation_duration_ms`    | Histogram                 | module                | Calculation engine performance        |
| `export_job_duration_ms`     | Histogram                 | format                | Export pipeline performance           |
| `db_pool_connections_active` | Gauge                     | --                    | Connection pool saturation monitoring |
| `auth_failures_total`        | Counter                   | reason                | Security event monitoring             |

#### Alerting

| Condition                  | Alert Name           | Channel                | Response SLA                 |
| -------------------------- | -------------------- | ---------------------- | ---------------------------- |
| ERROR or FATAL log emitted | BudFin API error     | Email to sysadmin      | Within 5 minutes (NFR 11.12) |
| Disk usage > 80%           | Disk space warning   | Email                  | Within 15 minutes            |
| API health check fails     | BudFin down          | Email + SMS (optional) | Within 5 minutes             |
| DB connection refused      | Database unreachable | Email                  | Within 5 minutes             |
| Daily backup failed        | Backup failure       | Email                  | Within 1 hour                |

#### Uptime Monitoring

UptimeRobot (or equivalent service) monitors the health endpoint (`GET /api/v1/health`) every 5 minutes. An alert triggers after 2 consecutive failures (10 minutes of downtime). A monthly uptime report is generated for compliance and stakeholder review.

The health endpoint returns:

```json
{
    "status": "ok",
    "db": "connected",
    "uptime_seconds": 86400,
    "version": "1.0.0"
}
```

The endpoint verifies database connectivity by executing a lightweight query (`SELECT 1`). If the database is unreachable, the endpoint returns HTTP 503 with `"status": "degraded"`.
