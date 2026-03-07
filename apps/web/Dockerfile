FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile --filter @budfin/web
COPY packages/types/ packages/types/
COPY tsconfig.base.json ./
COPY apps/web/ apps/web/
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "dev", "--host"]
