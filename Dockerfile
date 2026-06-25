# OwlCode API server — built for Fleet deployment.
# Runtime env (DATABASE_URL, API keys, PORT, etc.) is injected by Fleet at deploy time.
FROM oven/bun:1.2 AS build

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock tsconfig.base.json ./
COPY packages/server/package.json packages/server/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/cli/package.json packages/cli/

RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/server packages/server
COPY packages/database packages/database
COPY packages/shared packages/shared

# Prisma generate reads DATABASE_URL from config; placeholder only — not used at runtime.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    bun run --cwd packages/database db:generate

RUN bun run --cwd packages/server build

FROM oven/bun:1.2-slim AS runtime

WORKDIR /app/packages/server

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/packages/server/dist ./dist

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
