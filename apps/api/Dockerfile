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

# Stage 3: production
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
