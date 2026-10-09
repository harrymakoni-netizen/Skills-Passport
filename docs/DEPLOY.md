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

## Before go-live checklist

- [ ] WhatsApp Business verification, number and approved templates (en, sn, nd)
- [ ] Native-speaker review of `docs/translations-review.csv` imported
- [ ] Competency units reviewed by two master artisans per trade; unit standards mapped
- [ ] AI evaluation set (50 jobs per trade) at ≥ 80% precision before suggestions are shown (`fixtures/eval`)
- [ ] Security review of the public directory (SPEC §14); backups tested
- [ ] POTRAZ licensing and hosting region decided
