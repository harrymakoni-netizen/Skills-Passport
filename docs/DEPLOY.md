# Deploying

The hosting provider and region are still open (SPEC §19: POTRAZ cross-border guidance), so the deployment is plain
containers that run anywhere: one image per service from the root `Dockerfile`.

## Services

| Service | Port | Needs |
| --- | --- | --- |
| `api` | 4000 | PostgreSQL 16, Redis 7, S3 bucket pair, all secrets. Runs `prisma migrate deploy` on start. |
| `worker` | 4100 (health/metrics) | Same as api. Scale horizontally; each queue has its own concurrency. |
| `web` | 3000 | `API_INTERNAL_URL` (private address of the api), `PUBLIC_BASE_URL`. |

Put a reverse proxy/CDN in front: `https://<short-domain>` → web; web proxies `/api`, `/media` and the passport image
routes to the api. Serve the public bucket from the CDN and set `PUBLIC_MEDIA_BASE_URL` to it.

## Environments

Create `.env.staging` and `.env.production` from `.env.example`:

- fresh `PII_ENCRYPTION_KEY`, `PHONE_HASH_PEPPER`, `JWT_SECRET` per environment (`pnpm setup:env` shows how);
  **store them in your secret manager — losing the PII key makes encrypted data unreadable**;
- `NODE_ENV=production` (forces `DEV_TOOLS=false` and refuses the mock WhatsApp channel);
- `MESSAGING_DRIVER=whatsapp` and the four `WHATSAPP_*` values; register `https://<api>/webhooks/whatsapp` in Meta with
  `WHATSAPP_VERIFY_TOKEN`; submit the templates in `docs/WHATSAPP_TEMPLATES.md`;
- `LLM_DRIVER=anthropic`, `ANTHROPIC_API_KEY`, `LLM_MODEL`; `STT_DRIVER=whisper`, `STT_BASE_URL`, `STT_MODEL`
  (benchmark first — SPEC §19);
- `STORAGE_DRIVER=s3` with a private and a public bucket.

## Steps

```bash
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d --build
curl https://<api>/health                   # {"status":"ok",...}
docker compose -f docker-compose.prod.yml run --rm api pnpm db:seed   # reference data only on an empty database
```

Create the first admin with `pnpm db:seed` on staging only, or insert one through a one-off script; production should
start without demo data. Then sign in, enrol verifiers and field agents from `/admin/people`.

## Public demo on Vercel (serverless runtime)

For the pitch and for judges, the whole platform runs as **one Vercel project** that needs only a PostgreSQL
database. `RUNTIME=serverless` changes how it runs, not what it does:

| Server runtime (containers) | Serverless runtime (Vercel) |
| --- | --- |
| `apps/api` process behind the web rewrites | The same NestJS app inside `apps/web/pages/api/[...path].ts` |
| BullMQ queues + `apps/worker` | `queued_tasks` table; due tasks run after each API response (`waitUntil`), one drainer at a time so each chat stays in order; retries with backoff, `failed_at` = dead letter |
| Redis key-value (sessions, windows, rate limits, locks) | `kv_entries` table |
| S3 / MinIO buckets | `stored_objects` table (`STORAGE_DRIVER=db`), served through `/media` with signed URLs for private files |
| Repeatable daily purge job | Vercel Cron → `/api/cron/daily` (bearer `CRON_SECRET`) |

Server components call the API in-process (no network hop). Everything else (adapters, flows, rules, pages) is
identical, and the same test suites cover the database-backed stores (`packages/db/test/serverless.test.ts`).

**Project settings** (already set for `skills-passport`): root directory `apps/web`; build and install commands come
from `apps/web/vercel.json`. The build (`scripts/vercel-build.sh`) applies migrations, seeds reference data, seeds the
fictional demo data **only when the database is empty**, then runs `next build`. Function region `fra1` (closest
region to the database; pick Neon's Frankfurt region).

**Environment variables** (Production and Preview): `PII_ENCRYPTION_KEY`, `PHONE_HASH_PEPPER`, `JWT_SECRET`,
`CRON_SECRET` (sensitive), `RUNTIME=serverless`, `STORAGE_DRIVER=db`, `PUBLIC_DEMO=true`, `MESSAGING_DRIVER=mock`,
`STT_DRIVER=mock`, `LLM_DRIVER=mock`. `DATABASE_URL` and `DATABASE_URL_UNPOOLED` come from the Neon integration
(Storage tab → Neon → connect to the project). `PUBLIC_BASE_URL` defaults to the production domain.

**Reset the demo data:** empty the database (Neon console → branch reset, or drop and recreate the `public` schema)
and redeploy; the build seeds it again.

### Connecting the WhatsApp number (hybrid mode)

`MESSAGING_DRIVER=hybrid` turns real WhatsApp on without losing the demo: real numbers use the Cloud API, while the
fictional demo phones (`+26377000xxxx`) and `/dev/chat` keep working. Once real numbers are in the database the login
page stops listing the demo accounts, and `STAFF_PASSWORD` replaces the public demo password on the next build.

1. **Meta app** ([developers.facebook.com](https://developers.facebook.com) → My Apps): a Business app with the
   WhatsApp product, and the number added under WhatsApp → API Setup. Note the **Phone number ID** and the
   **WhatsApp Business Account ID** shown there.
2. **Permanent token:** Business Settings → System users → add an admin system user → assign the app and the
   WhatsApp account (full control) → Generate token with `whatsapp_business_messaging` and
   `whatsapp_business_management`. (The 24-hour token on the API Setup page works for a quick test only.)
3. **App secret:** App settings → Basic → App secret.
4. **Vercel → Settings → Environment Variables** (Production and Preview):
   `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_APP_SECRET` (Sensitive), `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN` (any long random string), `STAFF_PASSWORD`, then
   `MESSAGING_DRIVER=hybrid` last (the app refuses to start in hybrid mode without the WhatsApp credentials), and
   redeploy.
5. **Webhook:** WhatsApp → Configuration → Callback URL `https://<domain>/api/webhooks/whatsapp`, Verify token =
   `WHATSAPP_VERIFY_TOKEN` → Verify and save → under Webhook fields, subscribe to **messages**.
6. **Templates:** sign in as the administrator → **WhatsApp** → *Submit to Meta*. All 21 templates (7 × en/sn/nd) are
   sent for review; the page shows their status. Client confirmations and other first messages fail until the
   relevant template is approved; replies inside a conversation the person started work straight away.
7. **Test:** send "Hi" to the number from your own phone. You should get the language menu within a few seconds.

**For a pilot with real artisans only:** set `MESSAGING_DRIVER=whatsapp` and `PUBLIC_DEMO=false`, and use a fresh
database without demo data. For real pilot volumes, move objects to S3 (`STORAGE_DRIVER=s3`) and consider the
server runtime (Redis + worker), which handles bursts and long AI calls better than per-request draining.

## Before go-live checklist

- [ ] WhatsApp Business verification, number and approved templates (en, sn, nd)
- [ ] Native-speaker review of `docs/translations-review.csv` imported
- [ ] Competency units reviewed by two master artisans per trade; unit standards mapped
- [ ] AI evaluation set (50 jobs per trade) at ≥ 80% precision before suggestions are shown (`fixtures/eval`)
- [ ] Security review of the public directory (SPEC §14); backups tested
- [ ] POTRAZ licensing and hosting region decided
