# Progress

Status as of 9 October 2026. The pitch demo (Milestones 1–5) is complete and runs fully offline. The verifier, agent,
admin and buyer tools (Milestones 6–7) work end to end. Hardening and deploy work (Milestones 8–9) is partly done; the
gaps are listed below. SMS and USSD (Milestone 10) are not started, by design.

## How to run it

See `README.md`. In short:

```bash
pnpm install && pnpm setup:env && docker compose up -d
pnpm db:migrate && pnpm demo:reset && pnpm dev
```

Then open `http://localhost:3000/dev/chat` and follow `docs/DEMO.md`, a four-minute pitch script.

## What was built

### Milestone 0 — Plan
- `docs/PLAN.md` covers the data model, adapter interfaces, design direction and milestones. Its open questions are
  answered by the adopted defaults in §8. One addition, Q25: a routinely sampled job that is waiting for review counts
  toward a level once the client has confirmed it. A flagged or disputed job does not count.

### Milestone 1 — Foundations
- The monorepo uses pnpm workspaces and Turborepo, with strict TypeScript and ESM throughout. A zod env schema
  (`packages/config`) validates settings, and `pnpm setup:env` writes a `.env` with fresh secrets.
- `docker-compose.yml` runs PostgreSQL 16, Redis 7 and MinIO, plus a job that creates the buckets.
- The Prisma schema and `init` migration are in place. The seed creates 5 trades with their units and job types, 6 areas,
  the versioned default config and fictional demo people with phones in the `+26377000xxxx` range.
- Adapters, each with an offline mock:
  - messaging: in-memory or Redis mock, and the Meta Cloud API
  - speech-to-text: fixtures, and a Whisper-compatible endpoint
  - LLM: fixtures, and the Anthropic Messages API with structured output
  - storage: local filesystem, and S3/MinIO
  - clock
- PII is encrypted with AES-256-GCM, and phones are looked up by HMAC-SHA256.
- The pino logger redacts phone, name, token and authorization fields.
- The NestJS API has health checks, request ids, an error filter and validation. Staff sign in with argon2 passwords
  and TOTP; the session is a JWT in an httpOnly, SameSite=Strict cookie, and requests carry a CSRF header.
- The worker runs one BullMQ worker per queue, with health and metrics on port 4100.
- `packages/ui` holds the design tokens, base components and self-hosted, subset fonts. `/dev/design` shows every
  component and state.

### Milestone 2 — Domain rules (`packages/core`)
- Rules for jobs and passports:
  - the job state machine and what counts toward a level
  - cumulative level calculation, including downgrades, with a next-level checklist
  - review sampling with injectable randomness
  - competency status
  - every fraud rule, FR01–FR11, as a pure function
  - trust score and endorsement rules
- The i18n catalogue has `en`, plus draft `sn` and `nd` strings marked `needsReview`.
- The WhatsApp template registry has names, languages and parameters for each template.
- The table-driven tests cover every rule in SPEC sections 5 and 6, with 100% statement and 98% branch coverage.

### Milestone 3 — Conversation engine
- The WhatsApp webhook:
  - verifies the GET handshake
  - checks the X-Hub-Signature-256 signature
  - de-duplicates by provider message id
  - answers 200 at once and processes the message on a queue
- The flows are pure functions in core behind `FlowPorts`. They cover onboarding (with the 18–35 age check), the menu,
  job logging, My passport, help, settings and work requests. Conversation state can resume per phone.
- `/dev/chat` is a multi-phone WhatsApp simulator showing the artisan, the client and a live passport side by side.

### Milestone 4 — Media pipeline and AI
- Each photo goes through these steps:
  1. The original is saved to private storage.
  2. A public copy is made with EXIF stripped, plus a thumbnail.
  3. A perceptual hash (DCT pHash) and a quality score are computed.
  4. The artisan gets a retake request if the photo is poor, and duplicates are detected.
- AI steps:
  - Voice notes are transcribed, then a versioned prompt (`job-structuring.v1`) structures the job. Its output is
    checked with zod, retried once and restricted to the artisan's trade.
  - The text sent to the AI has PII stripped first.
  - Each suggestion is stored with `model_version` and `prompt_version`, and the artisan can correct the summary.
- The fixtures are realistic, one set per trade.

### Milestone 5 — Client confirmation and public passport (pitch demo)
- Clients get a 128-bit rating token, stored only as a hash. It works once and expires after 7 days.
- Clients are reached with a WhatsApp template with buttons, and can also use the `/c/[token]` rating page.
- Reminders and expiry run as delayed jobs. If a message can't be delivered, a field agent gets a follow-up task.
- Levels are recalculated as evidence changes, with level history and notifications to the artisan.
- The flagship `/p/[code]` page includes an OG image, a QR code (PNG and SVG) and a Status card for sharing.
- `pnpm demo:reset` resets the demo, and `docs/DEMO.md` is the pitch script.

### Milestone 6 — Verifier and field agent tools
- The verifier queue:
  - keyboard shortcuts: J/K to move, 1/2/3 to rate
  - an image viewer with zoom
  - conflict-of-interest rules enforced
  - endorsements, which can be withdrawn
  - review history and a monthly review counter for each verifier
- Field agents can enrol artisans and log jobs on their behalf. The artisan confirms ownership on WhatsApp. Agents also
  record the outcome of phone follow-ups.

### Milestone 7 — Admin, fraud, buyers, safety
- Admin:
  - edit trades, units and job types
  - manage people
  - versioned config
  - an audit log viewer
  - freeze and unfreeze artisans
  - a fraud flag queue
  - a pilot report that hides any cell smaller than 5
- Buyers:
  - a directory, with rate limits
  - work requests, with a 14-day follow-up
  - jobs logged in one tap from a work request
- Safety: artisans can report a client, and deleting an account purges the data after 30 days (a daily scheduled job).

### Milestones 8–9 — Hardening, real providers, deploy (partial)
- Tasks retry 5 times with exponential backoff. Failed tasks stay in BullMQ's failed set, which serves as the dead
  letter queue, and each failure is logged.
- The security review is written up in `docs/SECURITY.md`.
- The real WhatsApp Cloud API adapter is complete. `docs/WHATSAPP_TEMPLATES.md` is generated from the template registry.
- The AI evaluation harness is `fixtures/eval` plus `pnpm --filter @sp/db eval`. Current fixture result: solar
  precision 100%, recall 80%.
- Deployment: a `Dockerfile`, `docker-compose.prod.yml` and `docs/DEPLOY.md` (migrations run on deploy). In production
  the env schema switches off `/dev/*` and refuses the mock messaging channel, and an API test checks this.
- GitHub Actions CI (`.github/workflows/ci.yml`) runs lint, typecheck and test against a Postgres service container.
- Translation review: `docs/translations-review.csv` has 320 rows. Reviewed strings come back through
  `packages/core/src/i18n/reviewed.json`, via the export and import scripts in `packages/core/scripts`.

### Hosting on Vercel (public demo)
- `RUNTIME=serverless` runs the whole platform as one Vercel project that needs only PostgreSQL. The NestJS API runs
  inside the web app (`pages/api/[...path].ts`), and server components call it in-process.
- The queue, key-value store, simulator chats and (with `STORAGE_DRIVER=db`) stored files move to PostgreSQL tables
  (migration `serverless_runtime`). A daily Vercel Cron job runs maintenance.
- `PUBLIC_DEMO=true` keeps the WhatsApp simulator and demo sign-in help on in a production build. Use it with
  fictional data only.
- Checked locally: a production build in this mode against an empty database runs migrations, seeds the demo data,
  serves every page and image route, and passes the full simulator journey (onboarding → job → client confirms →
  progress message).
- Setup is described in `docs/DEPLOY.md`.

## Test results

`pnpm lint`, `pnpm typecheck` and `pnpm test` all pass. There are 375 tests:

| Suite | Tests |
| --- | --- |
| core | 324 |
| adapters | 16 |
| db (integration, real Postgres) | 26 |
| api | 9 |

The production `next build` also succeeds. An end-to-end run through the simulator API covered onboarding, logging a
job, the summary check, the client template and buttons, confirmation, the progress message and the passport update.

## Design self-review

Every page was screenshotted at 360 px and 1280 px into `docs/screenshots/`. Each was checked against the visual system
and the avoid-list in `CLAUDE.md`:
- no gradients, glass effects or emoji
- no "AI" labels
- no stock imagery
- three type families, a single bronze accent and hairline borders

Fixes made during review:
- Drawn text was removed from the fixture photos, because it appeared mirrored in the photo variants.
- The trades grid on the landing page was rebalanced.
- The verifier summary grid was tightened at wide sizes.

## Known gaps

- **Page weight:** the passport page is about 146 KB before photos, plus 64 KB of fonts, so about 210 KB. The target is
  under 200 KB. Most of the rest is the 108 KB Next.js runtime.
- **Languages:** the `sn` and `nd` strings are drafts and need a native speaker to review them. The staff dashboards
  are English only.
- **Hardening not done yet:** there is no backup and restore script, no Playwright E2E suite (only screenshots and an
  API-level E2E script) and no launch-readiness checklist.
- **Fixture photos** are drawn illustrations. They should be replaced with real, consented artisan photos before the pilot.
- **Later releases, as SPEC defines them:** trusted contacts, lender reports, and SMS and USSD.

## Next steps

1. Get a native speaker to review the `sn` and `nd` strings using `docs/translations-review.csv`.
2. Add a Playwright E2E suite covering the demo journey and the verifier queue, and run it in CI.
3. Write a backup and restore script and a launch-readiness checklist.
4. Get the Meta templates approved, then run the real WhatsApp and Anthropic adapters on staging.
5. Get the passport page under 200 KB: trim client components, or render the page statically.
