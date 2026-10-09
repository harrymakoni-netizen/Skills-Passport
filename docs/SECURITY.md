# Security and privacy controls

Maps to SPEC §14 and the non-negotiable rules in `CLAUDE.md`. "Residual risk" lists what is not done yet.

## Personal data

| Data | Control | Where |
| --- | --- | --- |
| Artisan names and phones, client names and phones, buyer contacts, staff emails and phones, TOTP secrets | AES-256-GCM at application level, random 96-bit IV per value, 1-byte key version for rotation | `packages/adapters/src/crypto.ts`, every `*Enc` column |
| Phone and email lookups | HMAC-SHA256 with `PHONE_HASH_PEPPER`; plaintext never queried | `phoneHash`, `lookupHash` |
| Client rating links | 128-bit random tokens; only SHA-256 stored; single use; 7-day expiry; rotated on each reminder | `services/confirmations.ts` |
| Public passport | Never includes phone, exact location (lat/lng, EXIF GPS), amounts, client names or disputes — enforced by the view model and an integration test | `services/passport.ts`, `test/journey.test.ts` |
| Public photos | Re-encoded with sharp; EXIF/GPS stripped; originals only in the private bucket; signed, expiring URLs for verifiers | `services/media.ts` |
| Voice notes | Private only (may contain the client's name) | `services/media.ts` |
| AI providers | Only job evidence and pseudonymous photo references are sent; phone numbers are redacted from transcripts and notes; no names | `services/ai.ts` (`redactForAi`) |
| Analytics | `product_events.subject_id` is an HMAC pseudonym | `services/artisans.ts` (`event`) |
| Logs | pino with a redaction list (phone, name, client name, token, password, email, text, authorization, cookies); request logs mask confirmation tokens; message bodies are never logged | `packages/adapters/src/logger.ts`, `apps/api/src/app.ts` |
| Deletion | Public page offline immediately; PII, media and notes purged after 30 days by a daily job; anonymised counts kept | `services/artisans.ts` (`deleteArtisan`, `purgeDeleted`) |
| Sensitive demographics | Optional, separately consented, stored only with consent, reported only in aggregate with cells under 5 suppressed | onboarding flow, `services/admin.ts` (`pilotReport`) |
| Consent | Versioned consent records per artisan (core, demographics, public badge) | `consents` table |

## Access control

- Staff, verifiers, agents and buyers: email + argon2id password, then TOTP (required for admin, verifier and agent;
  enrolment forced at first sign-in). Session = HS256 JWT in an `httpOnly`, `SameSite=Strict` cookie (`Secure` in
  production), 12-hour lifetime.
- A global guard requires a session on every route unless explicitly `@Public()`, and `@Roles()` restricts each
  controller. Services re-check scope (verifier trade, declared conflicts, agent ownership of uploads).
- CSRF: every mutating request must carry `x-sp-csrf: 1`, which cross-site forms cannot send, on top of SameSite=Strict.
- Rate limits (Redis, fixed window): login and TOTP (10 / 5 min / IP), client confirmation pages (60 GET, 20 POST /
  10 min / IP), public directory (60 / 5 min / IP), buyer directory and work requests per account.
- Field agents see a client's phone number only on their follow-up list; buyers see an artisan's number only after the
  artisan accepts.
- Audit log: admin actions, sign-ins, endorsements, flag decisions, config versions, agent actions, deletions.

## Webhooks and messaging

- `POST /webhooks/whatsapp` verifies `X-Hub-Signature-256` (HMAC-SHA256 with the app secret, constant-time compare),
  deduplicates by provider message id (`inbound_messages` primary key), queues and returns 200.
- Business-initiated messages use registered utility templates (`packages/core/src/templates.ts`); free-form artisan
  notifications outside the 24-hour window are wrapped in a template automatically.
- Every client message carries a "Stop messages" button; opt-outs are honoured before any send.

## Platform

- `helmet` security headers on the API; `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy` on the
  web app. `/dev/*` routes are removed from the API when `DEV_TOOLS` is off (forced off in production; a test proves
  it) and blocked by web middleware in production.
- Secrets only from environment variables, validated at start-up; `.env` is git-ignored; `pnpm setup:env` generates
  random keys. Production refuses `MESSAGING_DRIVER=mock`.
- Storage keys are validated against path traversal; local signed URLs use HMAC with expiry.
- Background tasks retry with exponential backoff (5 attempts); failed jobs are kept as a dead-letter list and media
  or WhatsApp delivery failures are logged at error level for alerting.

## Residual risks and next steps

1. Key management: `PII_ENCRYPTION_KEY` is an env var. Move to a KMS/vault and add a re-encryption script for rotation
   (the key-version byte is already in every ciphertext).
2. Inbound WhatsApp payloads (which include the sender's number) sit in Redis while queued; keep Redis private and
   encrypted at rest, or encrypt the payload before queueing.
3. No WAF or bot detection in front of the public directory beyond rate limits; add before public launch (SPEC §14
   asks for a security review before the directory goes public).
4. Dependency scanning is in CI (`pnpm audit --prod`, non-blocking); make it blocking once the baseline is clean.
5. Backups: Postgres and object-storage backup/restore scripts are not written yet (Milestone 8).
6. POTRAZ data-controller licensing and the cross-border hosting decision are open (SPEC §19).
