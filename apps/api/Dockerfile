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

# Development target (used by docker-compose.dev.yml)
FROM deps AS development
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/prisma apps/api/prisma
COPY packages/types/src packages/types/src
COPY packages/types/tsconfig.json packages/types/
COPY tsconfig.base.json ./
RUN pnpm --filter @budfin/api exec prisma generate
WORKDIR /app/apps/api
CMD ["pnpm", "dev"]
