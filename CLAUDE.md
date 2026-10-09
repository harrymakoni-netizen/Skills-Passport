# Skills Passport — project instructions for Claude Code

Skills Passport turns the real work of informally skilled young artisans in Zimbabwe into a verified credential.
Artisans log jobs on WhatsApp (photos + voice note), clients confirm on WhatsApp with one tap, master artisans review
quality on the web, and AI maps the evidence to trade competency units. The full specification is in `docs/SPEC.md`.
**Read `docs/SPEC.md` before starting any milestone, and treat it as the source of truth.**

## Channel scope: WhatsApp only (for now)

- WhatsApp is the **only** messaging channel in this build, for artisans and clients.
- **Do not build SMS or USSD** — no SMS gateway, no USSD menus, no SMS simulator. They come in a later phase.
- Design for that later phase: all flow logic talks to a channel-agnostic `MessagingChannel` interface and channel-neutral
  message objects (text, list, buttons, media). Adding SMS or USSD later must mean writing a new adapter, not rewriting flows.
- The web app is for verifiers, field agents, buyers, admins, the public passport page and the client rating page.

## How to work

- Work one milestone at a time, in the order given in `docs/PROMPTS.md`. Do not build features from later milestones.
- Before writing code for a milestone, post a short plan: files you will create or change, data model changes, and open questions. Then build.
- If the spec is ambiguous or two rules conflict, stop and ask. Do not invent product rules.
- At the end of every milestone: run `pnpm lint`, `pnpm typecheck` and `pnpm test`, fix failures, then update `docs/PROGRESS.md` (what was built, how to run it, known gaps, next steps).
- Make small, focused commits with clear messages.
- Keep `README.md` setup instructions accurate: a new developer must be able to run everything locally with `docker compose up -d` and `pnpm dev`.

## Architecture (fixed decisions)

Monorepo with pnpm workspaces and Turborepo:

```
apps/
  api/        NestJS REST API + WhatsApp webhook
  worker/     BullMQ workers: media pipeline, AI, notifications, scheduled jobs
  web/        Next.js (App Router): public passport /p/[code], client rating page /c/[token],
              dashboards /verifier /agent /buyer /admin, and the dev WhatsApp simulator /dev/chat
packages/
  core/       Pure TypeScript domain logic: job state machine, passport levels, review sampling,
              fraud rules, competency status, i18n message catalogue. NO I/O, NO framework imports.
  db/         Prisma schema, migrations, seed script
  adapters/   Interfaces + implementations for every external service (see below)
  ui/         Design tokens and shared React components (see "Design standard")
  config/     Shared tsconfig, eslint, env validation (zod)
docs/         SPEC.md, PROMPTS.md, PLAN.md, PROGRESS.md, DESIGN.md, DEMO.md
```

- Language: TypeScript (strict) everywhere. Node.js 20+.
- Database: PostgreSQL 16 via Prisma. Queues/cache/session state: Redis 7 with BullMQ.
- Object storage: S3 API (MinIO locally). Private bucket for originals, public bucket for compressed copies.
- Images: `sharp` for resize/compress/metadata; a perceptual hash (pHash/dHash) stored per image.
- Tests: Vitest; Playwright for end-to-end and visual checks. `packages/core` must have table-driven tests for every rule in SPEC sections 5 and 6.
- Local infra: `docker-compose.yml` with postgres, redis and minio.

## External services: always behind adapters

Every external call goes through an interface in `packages/adapters`. Each interface has a **mock implementation
that works offline** and is the default in development and tests. Real implementations are selected by env vars.

| Interface | Mock (default) | Real implementation |
| --- | --- | --- |
| `MessagingChannel` | In-memory + WhatsApp simulator at `/dev/chat` (several phones side by side: artisan and client) | Meta WhatsApp Cloud API |
| `SpeechToText` | Returns fixture transcripts | OpenAI-compatible Whisper endpoint (configurable base URL) |
| `LlmProvider` | Deterministic fixture JSON | Anthropic Messages API; model name from `LLM_MODEL` env var |
| `ObjectStorage` | MinIO via S3 SDK | Any S3-compatible service |
| `Clock` | Controllable clock for tests | System clock |

Never call a provider SDK directly from apps. Never hard-code provider credentials, model names or URLs.

## Design standard: premium, not generic

The web platform must look and feel like a **trusted credential issued by a serious institution** — closer to a
well-made passport, bank or Stripe/Linear-quality product than a template. It must not look AI-generated.

**Concept.** The passport is a document of record. Borrow from security printing and official documents, done with restraint:
warm paper-white surfaces, deep ink colour, a fine engraved-line (guilloche-style) pattern used sparingly on the passport
header, a serial-number feel for passport codes (monospace, letter-spaced), and a crisp "verified" seal for endorsements.
The artisans' own work photos are the hero imagery — never stock photos or illustrations of people.

**Visual system** (define as tokens in `packages/ui` and document in `docs/DESIGN.md`):
- Colour: one deep ink primary (e.g. ink green `#163F33`), warm paper background (e.g. `#F7F4EE`), near-black text
  (`#141414`), one restrained metallic accent for seals and level badges (e.g. ochre/bronze `#A8692E`), and muted
  status colours. Bronze/Silver/Gold levels use refined metallic tones, never bright yellow or rainbow badges.
- Type: a distinctive serif for display headings (e.g. Fraunces or Instrument Serif), a precise sans for UI and body
  (e.g. Inter Tight, Geist or IBM Plex Sans), and a monospace for codes and numbers (e.g. IBM Plex Mono). Self-host with
  `next/font`, subset to Latin, at most 3 families. Use tabular figures for counts and ratings.
- Layout: strong grid, generous whitespace, left-aligned editorial hierarchy, clear typographic scale (no more than 6 sizes).
  Design at 360 px first, then scale up.
- Detail: 1 px hairline borders, small radii (4–8 px), soft or no shadows, consistent 4/8 px spacing scale.
- Motion: quiet and purposeful (150–200 ms ease-out); respect `prefers-reduced-motion`.
- Icons: one consistent line icon set, used only where it aids scanning.

**Avoid (the "AI slop" checklist — none of these may ship):**
- Purple/blue gradients, glassmorphism, glowing blobs, neon, or gradient text.
- Generic hero copy ("Empower your future", "Unlock your potential", "Revolutionising…"), exclamation marks, emoji in UI.
- Sparkle/magic-wand "AI" icons or labels like "AI-powered" in the interface. AI is invisible infrastructure here.
- Rows of identical rounded cards with an icon on top, centred everything, oversized drop shadows, default Tailwind look.
- Stock illustrations, 3D characters, placeholder lorem ipsum, fake testimonials or fake statistics.
- Inconsistent spacing, more than one accent colour, or random font sizes.

**Copy:** plain, specific and human, written for Zimbabwean artisans and buyers. Short sentences. Real labels
("Verified jobs", "Clients served", "Endorsed by"), not marketing language.

**Product quality:**
- Every screen has designed empty, loading (skeleton) and error states with a clear next action.
- Dashboards are calm and dense like a professional tool: tables with sorting and filters, keyboard shortcuts for the
  verifier queue (J/K to move, 1/2/3 to rate), fast image viewer with zoom.
- Accessibility: WCAG 2.2 AA contrast, visible focus states, labelled form fields, 44 px touch targets.
- Performance: public passport page under 200 KB before photos (fonts included), fast on 3G; lazy-load and size images.

**Self-review before finishing any UI work:** capture Playwright screenshots of every changed page at 360 px and 1280 px,
inspect them, check them against the avoid-list and the visual system above, fix what falls short, and note the result
in `docs/PROGRESS.md`.

## Non-negotiable rules

- **Privacy:** names, phone numbers and trusted contacts are encrypted at application level (AES-256-GCM, key from
  `PII_ENCRYPTION_KEY`). Phone lookups use `HMAC-SHA256(phone, PHONE_HASH_PEPPER)`. Phone numbers never appear on
  public pages, in logs, in analytics events, or in prompts sent to AI providers.
- **Logging:** use a structured logger with a redaction list (phone, name, token, authorization). Never log message bodies
  in production log level.
- **Seed and test data:** only fictional people. Use phone numbers in the range `+26377000xxxx`.
- **AI is advisory:** AI output is stored as suggestions with `model_version` and `prompt_version`. AI never verifies a
  competency, endorses an artisan, rejects a job or changes a passport level on its own.
- **Configurable rules:** level thresholds, sampling rates and fraud thresholds live in a versioned `configs` table,
  seeded with the defaults in SPEC sections 5–6. No magic numbers in code.
- **Money and time:** amounts as integer cents (USD); timestamps stored in UTC; display in `Africa/Harare`.
- **Webhooks:** verify signatures, deduplicate by provider message ID, respond 200 quickly and process on a queue.
- **WhatsApp rules:** messages to someone who has not messaged in the last 24 hours (e.g. clients) must use approved
  template messages; keep a registry of templates in code with their names, languages and parameters.
- **Client rating links:** random 128-bit tokens, store only a hash, single use, expire after 7 days.
- **Age:** artisans must be 18–35 at onboarding.
- **Languages:** every user-facing message comes from the i18n catalogue in `packages/core` with `en`, `sn` (chiShona) and
  `nd` (isiNdebele). Write English yourself; add draft `sn`/`nd` strings marked `needsReview: true` for a native speaker
  to check. Never inline user-facing strings in handlers or components.
- **No official claims:** never describe the passport as an official certificate or trade-test result.

## Definition of done (every milestone)

1. Lint, typecheck and tests pass.
2. New domain rules have tests, including edge cases.
3. Works fully offline with mock adapters and the WhatsApp simulator.
4. Any UI work passed the design self-review above.
5. `docs/PROGRESS.md` updated; `README.md` still accurate.
6. No secrets, real phone numbers or personal data committed.
