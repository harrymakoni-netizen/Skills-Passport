# Skills Passport — Claude Code build prompts

## How to use these prompts

1. Create an empty project folder (or GitHub repo) called `skills-passport`.
2. Put `CLAUDE.md` in the root, and `SPEC.md` and this file (`PROMPTS.md`) in a `docs/` folder.
3. Open Claude Code in that folder and paste the prompts below **one at a time, in order**.
   Wait for each milestone to finish, check it runs, then paste the next one.
4. Milestones 0–5 produce the **pitch demo** (target: ready by 3 November 2026).
   Milestones 6–8 complete the **pilot MVP**. Milestone 9 connects the real WhatsApp and AI providers.
   Milestone 10 (SMS and USSD) is for later and should not be started until you decide to add those channels.

**Scope:** WhatsApp is the only messaging channel for now, for artisans and clients. The web platform must meet
the premium design standard in `CLAUDE.md`.

Tip: start each new milestone in a fresh Claude Code session (or after `/clear`) so it re-reads `CLAUDE.md` and the spec.

---

## Milestone 0 — Plan (no code)

```
Read CLAUDE.md and docs/SPEC.md in full. Do not write any code yet.

Create docs/PLAN.md containing:
1. A summary of the product in 5 lines, so I can check you understood it.
2. The monorepo layout from CLAUDE.md with one line per app/package describing what goes in it.
3. The complete Prisma data model you intend to build, derived from SPEC section 11 (model names, fields,
   types, relations, indexes, enums). Note which fields are encrypted and which are hashed.
4. The adapter interfaces (TypeScript signatures) for MessagingChannel, SpeechToText, LlmProvider,
   ObjectStorage and Clock. Show how the channel-neutral message model will let SMS and USSD be added later
   without changing flow code (WhatsApp is the only channel we build now).
5. A one-page design direction following the "Design standard" in CLAUDE.md: the passport-as-document concept,
   exact colour tokens, the three font choices with reasons, the type scale, and a short description of how the
   public passport page and the verifier queue will look. I will approve this before any UI is built.
6. The milestone list from docs/PROMPTS.md with what each one delivers.
7. A list of questions or contradictions you found in the spec.

Then stop and wait for my answers.
```

---

## Milestone 1 — Foundations

```
Build Milestone 1: foundations. Follow CLAUDE.md and docs/PLAN.md.

1. Scaffold the pnpm + Turborepo monorepo exactly as in CLAUDE.md, with strict TypeScript, ESLint,
   Prettier and Vitest configured across all workspaces. Root scripts: dev, build, lint, typecheck, test, db:migrate, db:seed.
2. docker-compose.yml with postgres:16, redis:7 and minio (with buckets sp-private and sp-public created on start).
3. packages/config: zod-validated environment loader. Create .env.example with every variable, documented.
4. packages/db: full Prisma schema from docs/PLAN.md, first migration, and a seed script that loads:
   - the 5 pilot trades and their draft competency units from SPEC section 7 (codes, titles, descriptions,
     evidence guidance), and 3-6 job types per trade linked to the right units;
   - areas: Mbare, Glen View, Highfield, Budiriro (Harare) and Makokoba, Nkulumane (Bulawayo);
   - the default config version (levels, sampling, fraud thresholds from SPEC sections 5-6);
   - fictional users: 1 admin, 2 verifiers (solar, welding), 1 field agent, 1 buyer, 3 artisans at different
     stages. Phone numbers only in +26377000xxxx. Print the demo logins at the end of seeding.
5. packages/adapters: the interfaces plus mock implementations and the PII crypto helpers
   (encrypt/decrypt AES-256-GCM, phoneHash HMAC-SHA256, phone normalisation to E.164 for Zimbabwe numbers).
   Unit-test the crypto and phone helpers.
6. apps/api: NestJS app with health check, structured logger with redaction, global validation, error filter,
   request IDs, and staff auth (email + password with argon2, TOTP second factor, JWT in httpOnly cookie,
   role guard for admin | verifier | agent | buyer).
7. apps/worker: BullMQ bootstrap with a sample job and graceful shutdown.
8. packages/ui and docs/DESIGN.md: implement the approved design direction as tokens (colours, type scale,
   spacing, radii, shadows, motion) wired into Tailwind, self-hosted fonts via next/font, and the base
   components: button, input, select, checkbox, badge (including Bronze/Silver/Gold level badges), seal,
   table, tabs, dialog, toast, skeleton, empty state, page header, and the passport header with the fine-line
   pattern. Add a /dev/design page showing every component and state.
9. apps/web: Next.js app with Tailwind using packages/ui, a login page and a role-based dashboard shell
   (sidebar, top bar, page header) that already meet the design standard.
10. README.md with setup steps that work from a clean machine.

Run the design self-review from CLAUDE.md on /dev/design, the login page and the dashboard shell.

Finish with lint, typecheck and tests passing, and update docs/PROGRESS.md.
```

---

## Milestone 2 — Domain rules (packages/core)

```
Build Milestone 2: the pure domain logic in packages/core. No database or framework code in this package.

Implement, with exhaustive table-driven Vitest tests:
1. Job state machine from SPEC 4.10: allowed transitions, the function that says whether a job "counts",
   and rejection of illegal transitions.
2. Passport level calculation from SPEC section 5: input = artisan's jobs, confirmations, reviews,
   endorsements, competency statuses, and config; output = level plus a "next level" checklist
   (what is missing, e.g. "2 more jobs from new clients"). Include downgrade cases.
3. Review sampling from SPEC section 5: given an artisan's history, a job and config, decide whether the
   job goes to review and why. Make randomness injectable so tests are deterministic.
4. Competency status rules (verified / pending / none) from SPEC section 5.
5. Every fraud rule in SPEC section 6 as a separate pure function returning a flag (rule id, severity,
   reason) or null. Rules that need history receive it as input.
6. Trust score (0-100) as a documented, configurable formula combining dispute rate, flag rate and
   verifier quality ratings. Keep it simple and explain it in a code comment.
7. i18n catalogue: typed message keys with en, sn, nd for every message the bot will send in
   Milestones 3-5 (see SPEC sections 4 and 8). sn/nd drafts marked needsReview: true. Add a test that
   fails if any key is missing a language.

All thresholds must come from the config object, never constants. Aim for 100% branch coverage of
packages/core and report the coverage number. Update docs/PROGRESS.md.
```

---

## Milestone 3 — Conversation engine, onboarding and job logging

```
Build Milestone 3: the WhatsApp conversation, running entirely on the mock channel.

1. apps/api webhook endpoints:
   - GET and POST /webhooks/whatsapp in the Meta Cloud API format (GET verification handshake with
     hub.verify_token; POST with X-Hub-Signature-256 verification). Deduplicate by message id and push
     to a queue; respond 200 immediately.
   - The mock channel must feed the same internal pipeline, so the real API can be switched on later
     without changing flow code.
2. Conversation engine: a per-phone state machine with session state in Redis (TTL 24h), resumable if the
   user leaves halfway. Support text, interactive list replies (max 10 rows), reply buttons (max 3),
   images, video and voice notes.
3. Flows from SPEC 4.1 and 4.2, using only i18n messages:
   - Onboarding: language choice, age check (18-35), residency, consent (with the option to receive it as
     a voice note - use a placeholder audio file for now), name, up to 2 trades, area, experience, how
     learned, optional gender/disability with separate consent, passport code generation (SP-HRE-00001 format).
   - Main menu from SPEC section 8.
   - Log a job: job type list for the artisan's trade, before photos (where the job type needs them),
     after photos/video, voice note (or 3 guided questions), client name and phone, date and area,
     optional amount, review summary, submit. Validate the client phone (not the artisan's own number,
     not another registered artisan or verifier - use the fraud rule from packages/core).
   - "My passport" showing level and the next-level checklist from packages/core.
4. WhatsApp simulator at /dev/chat in apps/web (only enabled when NODE_ENV !== production): show two or
   more phones side by side (e.g. artisan and client), each with a fake number; chat with the bot, send sample
   images and audio from a fixtures folder, and see interactive lists, reply buttons and template messages
   rendered faithfully like WhatsApp. This is what we will use in the pitch demo, so make it look polished.
5. Store incoming media references; actual processing comes in Milestone 4 (queue a job for it).

Add integration tests for the onboarding and job logging flows using the mock channel. Update docs/PROGRESS.md.
```

---

## Milestone 4 — Media pipeline and AI

```
Build Milestone 4: the media pipeline and AI worker in apps/worker.

1. Media pipeline job (SPEC section 9): download media (from the mock channel now; from the WhatsApp media
   endpoint later - media URLs are short-lived, so download immediately), store the original in the private
   bucket, record capture metadata where present, make a metadata-stripped compressed public copy
   (~200 KB, max 1280 px) and a thumbnail, compute a perceptual hash, and score quality (blur and darkness).
   If quality is poor, send the artisan a retake request through the conversation engine.
2. Duplicate detection: compare the new hash with existing hashes (Hamming distance threshold from config)
   and raise the fraud flag from packages/core.
3. AI worker:
   - SpeechToText adapter for voice notes -> transcript with language and confidence.
   - LlmProvider adapter for job structuring and competency suggestions, producing exactly the JSON shape in
     SPEC section 12 (validate with zod; retry once on invalid output, then mark for manual review).
     Only units from the artisan's trade framework may be suggested. Send no names or phone numbers.
   - Image checks (quality, looks like trade work, possible screenshot/stock image) as flags only.
   - Store model_version and prompt_version with every output. Keep prompts as versioned files in the repo.
4. Mock adapters return realistic fixture outputs for each of the 5 trades so the demo works offline.
5. Implement the real Anthropic LlmProvider (Messages API, model from LLM_MODEL, image inputs, JSON output)
   and an OpenAI-compatible Whisper SpeechToText, both switched on only by env vars. Do not make real
   calls in tests.
6. After processing, show the artisan the AI summary on WhatsApp and let them correct it before the client
   is contacted.

Add tests for the pipeline using fixture images (including a resized duplicate). Update docs/PROGRESS.md.
```

---

## Milestone 5 — Client confirmation and public passport (pitch demo complete)

```
Build Milestone 5: client confirmation, levels in action, and the public passport. This completes the pitch demo.

1. Client confirmation on WhatsApp (SPEC 4.3): when a job is submitted, create a hashed single-use token
   (7-day expiry) and send the client the WhatsApp template message from SPEC 4.3 with quick-reply buttons
   "Yes, it was done", "No" and "Stop messages", plus the rating link. Handle the button replies through the
   WhatsApp webhook. Build the web page /c/[token] showing the job photos with confirm/dispute, 1-5 star
   rating and optional comment. Reminders at 48 h and 5 days; expiry at 7 days (BullMQ delayed jobs).
   If the message is undeliverable (client not on WhatsApp), flag the job for field-agent follow-up.
   Register every template used in the template registry.
2. In the WhatsApp simulator, show the client's phone receiving the template and let me tap the buttons as the client.
   The /c/[token] page must meet the design standard: it is the first thing many clients see of the product.
3. On every job status change, recalculate the passport level with packages/core, record level_history,
   and send the artisan a WhatsApp message with the new status and next-level checklist.
4. Public passport page /p/[code] (SPEC 4.6): this is the flagship screen and must feel like a premium,
   trustworthy credential (see the design standard). Server-rendered, mobile-first, under 200 KB before
   photos. Passport header with name, trade, area, level badge and monospace passport code; a work gallery
   of the artisan's own photos; verified vs pending competencies; rating, distinct clients and verified jobs
   as clear figures; endorsements shown with the seal; member since. Never show phone, exact location,
   amounts or disputes. Open Graph image and tags so the WhatsApp link preview looks professional.
5. QR code endpoint /p/[code]/qr.png and a "Share my passport" flow that sends the link, the QR image and a
   WhatsApp Status card image.
6. Create docs/DEMO.md: a 4-minute pitch demo script using the simulators and seed data:
   artisan onboards -> logs a solar installation job with photos and a voice note -> AI summary appears ->
   client taps "Yes, it was done" on the second simulated phone -> passport updates -> public passport page
   and QR shown.
   Add a `pnpm demo:reset` script that resets the database to a clean demo state.

Run the full demo yourself end to end with mock adapters and fix anything that breaks. Run the design
self-review on /p/[code], /c/[token] and /dev/chat. Update docs/PROGRESS.md.
```

---

## Milestone 6 — Verifier and field agent tools

```
Build Milestone 6: verifier and field agent dashboards in apps/web (mobile-first) with the API endpoints from SPEC section 12.

1. Verifier queue (SPEC 4.4): jobs in the verifier's trades selected by the sampling rules, flagged jobs first,
   then oldest. Job view with photos, video, transcript, AI summary and suggested units with confidence.
   Actions: quality rating (meets / needs improvement / reject), confirm/remove/add competency units, note to
   artisan, request a practical demonstration. Enforce declared conflicts of interest.
2. Endorsements: available after 3 reviewed jobs by the same artisan rated "meets standard"; withdrawal supported.
3. Notify the artisan on WhatsApp of review results and endorsements; recalculate levels.
4. Field agent tools (SPEC 4.5): enrol an artisan, and log a job on their behalf with uploads from the agent's
   phone browser (signed upload URLs). Mark jobs agent_assisted and send the artisan a WhatsApp message to confirm
   the job is theirs. Field agents can also record the outcome of phone follow-ups on expired confirmations.
5. Verifier review counter per month (for paying verifiers per review) visible to admin.

Add API and component tests for permissions (a verifier cannot review another trade or a conflicted artisan;
an agent cannot confirm or endorse). The verifier queue should feel like a fast professional tool: keyboard
shortcuts, a smooth image viewer, and no wasted clicks. Run the design self-review. Update docs/PROGRESS.md.
```

---

## Milestone 7 — Admin, fraud review, buyers and safety (pilot MVP complete)

```
Build Milestone 7: admin tools, fraud review, the buyer directory and work requests, and client reporting. This completes the pilot MVP.

1. Admin dashboard: manage trades, competency units and job types; verifiers and field agents; view and edit
   config as a new version (never edit in place); audit log viewer; artisan freeze/unfreeze.
2. Fraud review queue: list open flags by severity with evidence; uphold or clear; upheld flags can reject jobs
   or freeze an artisan. Everything written to the audit log.
3. Buyer directory (SPEC 4.7): search by trade, area, level and minimum rating, sorted by level, rating, recent
   activity. Rate-limit and paginate to prevent scraping. Work requests: buyer sends; artisan accepts/declines
   on WhatsApp; on accept, contact details are exchanged; after 14 days both sides are asked about the outcome;
   a completed hire can be logged as a job in one tap with the buyer as client.
4. Report a client (SPEC section 14): from the WhatsApp Help menu; 2+ reports block the client from confirming
   jobs and sending work requests.
5. Account deletion from WhatsApp Settings: public page offline immediately, personal data deleted after
   30 days by a scheduled job, anonymised statistics kept.
6. Pilot report endpoint and admin page with the metrics in SPEC section 16 (aggregate only, minimum cell size 5),
   and product events stored with pseudonymous IDs only.

Then do a full review pass against SPEC sections 1-17: list anything in the MVP column of the scope table that is
missing or only partly done, fix what you can, and record the rest in docs/PROGRESS.md.

Finish with a design consistency pass across every web screen: same tokens, spacing, type scale and components
everywhere; designed empty, loading and error states; nothing from the avoid-list in CLAUDE.md. Capture screenshots
of every page at 360 px and 1280 px into docs/screenshots/ and list what you changed.
```

---

## Milestone 8 — Hardening

```
Build Milestone 8: security, reliability and performance hardening before real users.

1. Security review of the whole codebase against CLAUDE.md and SPEC section 14: authorisation on every endpoint,
   token handling, encryption of all PII fields, log redaction, rate limits, CSRF on dashboard forms, secure
   headers, dependency audit. Fix issues and write docs/SECURITY.md describing controls and residual risks.
2. Reliability: retries with backoff and dead-letter queues for every worker; idempotency on all webhooks and
   write endpoints; graceful handling when WhatsApp, AI or storage are down (queue and resume).
3. Performance: check the public passport page weight and server response time; add caching; add database
   indexes for the directory search and queues. Report the numbers.
4. Observability: health endpoints for api and worker, structured logs, error tracking hook (provider via env),
   queue depth metrics, alerts for media pipeline and WhatsApp delivery failures.
5. Backups: documented Postgres and object storage backup and restore procedure, with a script.
6. End-to-end test suite (Playwright) covering the demo script and the main dashboard flows.

Update docs/PROGRESS.md with a launch-readiness checklist.
```

---

## Milestone 9 — Connect real providers and deploy

```
Build Milestone 9: switch from mocks to real providers and prepare deployment. Ask me for any credentials;
never commit them.

1. WhatsApp Cloud API: finish the real MessagingChannel (send text, interactive lists, buttons, images; download
   media via the media id endpoint; delivery status webhooks; template messages for business-initiated messages
   outside the 24-hour window). Create docs/WHATSAPP_TEMPLATES.md listing every template needed (utility category),
   with the exact wording in en, sn and nd, ready to submit to Meta.
2. Run the AI evaluation harness from SPEC section 13 on the labelled job set in fixtures/eval (create the folder
   structure and a script that reports precision of competency suggestions per trade).
3. Deployment: Dockerfiles for api, worker and web; a production docker-compose or equivalent; environment
   separation (staging, production); database migration on deploy; docs/DEPLOY.md with step-by-step instructions.
   Keep the hosting provider configurable - the region is still to be decided for data-protection reasons.
4. Disable /dev/* routes in production and add a test that proves it.

Update docs/PROGRESS.md.
```

---

## Milestone 10 — SMS and USSD (later phase, do not start yet)

```
Build Milestone 10: add SMS and USSD as channels, for artisans and clients with basic phones.

1. Add SmsGateway and UssdGateway adapters (mock + generic HTTP aggregator for Zimbabwe: Econet, NetOne, Telecel)
   behind the existing channel-neutral MessagingChannel model. Do not change flow logic in packages/core or the
   conversation engine beyond what is needed to render messages for each channel.
2. Client confirmation by SMS ("Reply 1 = Yes, 2 = No", STOP opt-out) as a fallback when WhatsApp is undeliverable.
3. USSD menus for artisans: check passport level, jobs waiting for clients, work requests. Job evidence
   (photos, voice) still needs WhatsApp or a field agent.
4. Webhooks for inbound SMS, USSD sessions and delivery reports; SMS and USSD simulators in /dev.
5. Update docs/SPEC.md sections marked "later phase", tests and docs/PROGRESS.md.
```

---

## Useful follow-up prompts

- **Bug fix:** `This is the error and the steps to reproduce: [paste]. Find the root cause, fix it, add a test that fails without the fix, and explain the cause in two sentences.`
- **Spec change:** `The rule in SPEC section [X] has changed to: [new rule]. Update docs/SPEC.md, the config defaults, packages/core and its tests, then list everything else affected.`
- **Code review:** `Review the changes since the last commit for bugs, security issues and departures from CLAUDE.md. List findings by severity before changing anything.`
- **Translation pass:** `Export every i18n string marked needsReview into docs/translations-review.csv with columns key, en, sn, nd, so a native speaker can correct them. Then write a script that imports the corrected CSV.`
- **Design review:** `Review [page or route] against the design standard in CLAUDE.md. Take screenshots at 360 px and 1280 px, list every way it looks generic or template-like, then fix them and show before/after screenshots.`
- **Progress check:** `Compare the codebase with the MVP column in SPEC section 1 and tell me, item by item, what is done, partial or missing.`
