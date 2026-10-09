#!/usr/bin/env bash
# Vercel build (RUNTIME=serverless): apply migrations, seed reference data (and the fictional demo data on an empty
# database), then build the web app. Migrations and the seed use the direct (unpooled) connection when available.
set -euo pipefail
cd "$(dirname "$0")/.."

DIRECT_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL:-}}}"
if [ -z "$DIRECT_URL" ]; then
  echo "DATABASE_URL is not set. Connect a Postgres database to the Vercel project (Storage tab)." >&2
  exit 1
fi

DATABASE_URL="$DIRECT_URL" pnpm --filter @sp/db exec prisma migrate deploy
DATABASE_URL="$DIRECT_URL" pnpm --filter @sp/db exec tsx src/seed.ts
pnpm --filter @sp/web build
