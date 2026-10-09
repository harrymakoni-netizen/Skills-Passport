# Skills Passport

Skills Passport turns the real work of informally skilled young artisans in Zimbabwe into a verified credential.
Artisans log jobs on WhatsApp (photos and a voice note), clients confirm with one tap, master artisans review quality
on the web, and AI suggests which competency units the evidence shows. The result is a public passport with a QR code
that buyers, employers and lenders can check.

- Product specification: [`docs/SPEC.md`](docs/SPEC.md) (source of truth)
- Build plan and decisions: [`docs/PLAN.md`](docs/PLAN.md)
- Progress, known gaps and next steps: [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Pitch demo script: [`docs/DEMO.md`](docs/DEMO.md)
- Design system: [`docs/DESIGN.md`](docs/DESIGN.md)
- WhatsApp templates to submit to Meta: [`docs/WHATSAPP_TEMPLATES.md`](docs/WHATSAPP_TEMPLATES.md)
- Security controls: [`docs/SECURITY.md`](docs/SECURITY.md)

## What's in the box

```
apps/api      NestJS API — WhatsApp webhook, client confirmation, public passport, staff auth, dashboards' endpoints
apps/worker   BullMQ workers — conversation engine, media pipeline, AI, notifications, reminders, scheduled jobs
apps/web      Next.js — /p/[code] passport, /c/[token] client page, /find, dashboards, /dev/chat simulator, /dev/design
packages/core Pure domain rules (levels, sampling, fraud, competencies, job states), conversation flows, i18n (en/sn/nd)
packages/db   Prisma schema + migrations, application services, seed
packages/adapters  WhatsApp (Cloud API + offline mock), speech-to-text, LLM, storage, crypto, TOTP, image processing
packages/ui   Design tokens and React components
```

Everything runs **offline** by default: the WhatsApp channel, speech-to-text and the LLM are mocks with realistic
fixtures, and `/dev/chat` simulates the artisan's and client's phones.

## Run it locally

Requirements: Node.js 20+, pnpm 10, Docker (for PostgreSQL 16, Redis 7 and MinIO).

```bash
pnpm install
pnpm setup:env            # writes .env with fresh random secrets
docker compose up -d      # postgres, redis, minio (+ buckets sp-private and sp-public)
pnpm db:migrate           # applies the Prisma migrations
pnpm demo:reset           # seeds reference data and the demo artisans, prints demo logins
pnpm dev                  # api :4000, worker :4100, web :3000
```

Then open:

| URL | What |
| --- | --- |
| http://localhost:3000 | Landing page |
| http://localhost:3000/dev/chat | WhatsApp simulator (artisan phone, client phone, live passport) |
| http://localhost:3000/p/SP-HRE-00001 | A Silver passport (seeded) |
| http://localhost:3000/login | Staff and buyer sign-in (demo accounts listed on the page in development) |
| http://localhost:3000/dev/design | Every UI component and state |

Demo password for every seeded account: `passport-demo-2026`. Staff accounts use TOTP; in development the sign-in page
has a "fill the current code" link, and the seed prints each secret so you can add it to an authenticator app.

**No Docker?** Run PostgreSQL 16 and Redis 7 however you like, point `DATABASE_URL`/`REDIS_URL` at them, and use
`pnpm setup:env --fs` (objects are stored under `.data/storage` instead of MinIO).

## Everyday commands

```bash
pnpm lint          # ESLint across all workspaces
pnpm typecheck     # tsc --noEmit everywhere
pnpm test          # Vitest (core rules, adapters, services/integration, API)
pnpm demo:reset    # back to a clean demo state (development only)
pnpm --filter @sp/web screenshots   # 360 px and 1280 px screenshots of every page into docs/screenshots
```

## Switching on real providers

All external services are adapters selected by environment variables (see `.env.example`):

| Variable | Mock (default) | Real |
| --- | --- | --- |
| `MESSAGING_DRIVER` | `mock` (simulator) | `whatsapp` + `WHATSAPP_*` |
| `STT_DRIVER` | `mock` (fixture transcripts) | `whisper` + `STT_BASE_URL`, `STT_MODEL` |
| `LLM_DRIVER` | `mock` (fixture JSON) | `anthropic` + `ANTHROPIC_API_KEY`, `LLM_MODEL` |
| `STORAGE_DRIVER` | `s3` (MinIO) | `s3` (any S3-compatible) or `fs` |

The WhatsApp webhook is `POST /webhooks/whatsapp` on the API (verification handshake on `GET` with
`WHATSAPP_VERIFY_TOKEN`). Signatures are checked with `WHATSAPP_APP_SECRET`.
