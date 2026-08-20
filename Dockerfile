# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.3.14

FROM oven/bun:${BUN_VERSION} AS workspace
WORKDIR /app

# Native TLS support is required by Prisma/PostgreSQL during generation and use.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace metadata first so dependency installation remains cacheable.
# The CLI manifest is needed for the root workspace/lockfile, but its source is
# not copied and its dependencies are excluded by the server workspace filter.
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/server/package.json packages/server/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/cli/package.json packages/cli/package.json

FROM workspace AS build
RUN bun install --frozen-lockfile --ignore-scripts --filter @owlcode/server

COPY packages/server packages/server
COPY packages/database packages/database
COPY packages/shared packages/shared

# Prisma configuration requires DATABASE_URL while generating, but does not
# connect to the database. This non-secret placeholder exists only in this layer.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    bun run --cwd packages/database db:generate

# Validate that the server can be compiled during image construction.
RUN bun run --cwd packages/server build

FROM workspace AS production-dependencies
RUN bun install --production --frozen-lockfile --ignore-scripts --filter @owlcode/server

FROM oven/bun:${BUN_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/bun.lock /app/tsconfig.base.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/packages/server ./packages/server
COPY --from=build /app/packages/database ./packages/database
COPY --from=build /app/packages/shared ./packages/shared

WORKDIR /app/packages/server
USER bun

# Metadata for the local fallback. The runtime PORT variable controls the
# actual listening port and may be overridden by AWS App Runner.
EXPOSE 3000

CMD ["bun", "run", "start"]
