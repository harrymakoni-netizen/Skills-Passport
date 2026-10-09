# One image definition for all three services. Build a service with:
#   docker build --target api -t skills-passport-api .
#   docker build --target worker -t skills-passport-worker .
#   docker build --target web -t skills-passport-web .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

FROM deps AS web-build
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL NODE_ENV=production
RUN pnpm --filter @sp/web build

FROM deps AS api
ENV NODE_ENV=production
EXPOSE 4000
# Migrations run on start so every deploy upgrades the schema first.
CMD ["sh", "-c", "pnpm --filter @sp/db exec prisma migrate deploy && pnpm --filter @sp/api start"]

FROM deps AS worker
ENV NODE_ENV=production
EXPOSE 4100
CMD ["pnpm", "--filter", "@sp/worker", "start"]

FROM web-build AS web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@sp/web", "start"]
