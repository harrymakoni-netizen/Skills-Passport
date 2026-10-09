# Skills Passport — build plan (Milestone 0)

Status: **approved** — the owner asked to proceed with every proposed default in section 7 (see section 8). Source of truth: `docs/SPEC.md` (v1.1, WhatsApp only).
`docs/reference/Skills_Passport_Specification_v1.0.pdf` is the earlier v1.0 (SMS-era) version and is kept for reference only.
Where they differ, v1.1 wins.

---

## 1. Product in five lines

1. Young informally trained artisans (18–35) in Zimbabwe log each finished job on WhatsApp: photos, an optional short video and a voice note.
2. The client confirms the job with one tap on a WhatsApp template message (and can rate it on a web link); they never need an account.
3. Master artisans (verifiers) review a sample of jobs on mobile web, rate quality, confirm competency units and endorse artisans; AI only suggests.
4. Counted jobs, distinct clients, endorsements and verified competencies move the artisan from Starter to Bronze, Silver and Gold, with fraud rules guarding every step.
5. The result is a public passport page with a QR code that buyers, employers and later lenders and trade testing can trust; it never claims to be an official certificate.

---

## 2. Monorepo layout

```
apps/
  api/        NestJS REST API: WhatsApp webhook (GET handshake + signed POST), client token endpoints,
              verifier / agent / buyer / admin endpoints, staff auth (argon2 + TOTP + JWT cookie), role guards.
  worker/     BullMQ workers: inbound message processing (conversation engine), media pipeline, AI,
              notifications (outbound WhatsApp + templates), scheduled jobs (reminders, expiry, deletion, 14-day hire follow-up).
  web/        Next.js App Router: /p/[code] public passport, /c/[token] client rating page, dashboards
              /verifier /agent /buyer /admin, /login, and dev-only /dev/chat (WhatsApp simulator) and /dev/design.
packages/
  core/       Pure TypeScript domain logic, no I/O: job state machine, "counts" rule, level calculation +
              next-level checklist, review sampling, competency status, every fraud rule, trust score,
              conversation flow definitions (state → channel-neutral messages), i18n catalogue (en/sn/nd).
  db/         Prisma schema, migrations, seed (trades, units, job types, areas, default config, fictional users),
              demo reset script, repository helpers that encrypt/decrypt PII at the boundary.
  adapters/   Interfaces + mock (default) and real implementations: MessagingChannel (mock + WhatsApp Cloud API),
              SpeechToText (fixtures + OpenAI-compatible Whisper), LlmProvider (fixtures + Anthropic Messages API),
              ObjectStorage (S3 SDK → MinIO/any S3), Clock (controllable + system). PII crypto and phone helpers.
  ui/         Design tokens (CSS variables + Tailwind preset), self-hosted font setup, shared React components
              (buttons, inputs, badges, level badges, seal, table, tabs, dialog, toast, skeleton, empty state,
              page header, passport header with fine-line pattern).
  config/     Shared tsconfig bases, ESLint + Prettier config, zod environment schema and loader.
docs/         SPEC.md, PROMPTS.md, PLAN.md, PROGRESS.md, DESIGN.md, DEMO.md, brand/ (logo), reference/ (v1.0 PDF).
fixtures/     Sample photos, voice notes, transcripts and LLM outputs per trade (for mocks, simulator, tests); later eval/.
```

Conversation engine placement: the **flow logic** (pure: given state + inbound message → new state + outbound
messages + side-effect commands) lives in `packages/core`; the **runner** (Redis session, DB writes, queueing) lives in
`apps/worker` and is called by both the real webhook and the mock channel through the same queue.

---

## 3. Data model (Prisma)

Conventions: `cuid` ids; `snake_case` table/column names via `@@map`/`@map`; all timestamps `DateTime` stored UTC;
money as `Int` cents (USD). Encrypted columns are `Bytes` holding AES-256-GCM `iv|ciphertext|tag` (suffix `Enc`).
Hashed lookups are HMAC-SHA256 with `PHONE_HASH_PEPPER` (suffix `Hash`, `Bytes`, unique where noted).

Deviations from SPEC §11 (all for referential integrity or gaps found):
- Array foreign keys (`artisans.trades[]`, `job_types.competency_unit_ids[]`, `verifiers.trade_ids[]`, `verifiers.conflicts[]`)
  become join tables.
- Added: `users` (staff/buyer logins — SPEC has no table for them), `field_agents`, `consents` (CDPA consent records),
  `passport_sequences`, `inbound_messages` (webhook dedupe), `outbound_messages` (delivery tracking), `product_events`,
  `media_upload_requests`, `demonstration_requests`.
- `jobs.flags[]` is kept as a denormalised `flagRules String[]` for fast queue sorting; the source of truth is `fraud_flags`.
- AI output is kept in `jobs.aiSummary` (raw, as produced) **and** `jobs.artisanSummary` (artisan-corrected), never overwritten.

### Enums

```prisma
enum Language            { en sn nd }
enum Level               { starter bronze silver gold }
enum ArtisanStatus       { onboarding active frozen deleted }
enum HowLearned          { apprenticeship family self_taught college other }
enum UserRole            { admin verifier agent buyer }
enum JobStatus           { draft submitted awaiting_client client_confirmed client_disputed client_expired
                           under_review verified needs_improvement rejected closed }
enum MediaKind           { photo_before photo_after video voice }
enum ConfirmationChannel { whatsapp agent }          // sms later
enum ConfirmationResponse{ confirmed disputed expired }
enum CompetencySource    { ai verifier }
enum JobCompetencyStatus { suggested confirmed removed }
enum ReviewQuality       { meets needs_improvement reject }
enum VerifierStatus      { pending active suspended }
enum BuyerType           { business ngo household government }
enum WorkRequestStatus   { sent accepted declined expired }
enum WorkRequestOutcome  { hired not_hired unknown }
enum ReportStatus        { open upheld dismissed }
enum FlagEntity          { job client verifier artisan }
enum FlagSeverity        { soft standard high }      // "block" rules never create a row; they stop the input
enum FlagStatus          { open upheld cleared }
enum ConsentKind         { core sensitive_demographics public_badge lender }
enum DeliveryStatus      { queued sent delivered read failed undeliverable }
```

### Models

```prisma
model Area {
  id        String  @id @default(cuid())
  name      String                       // suburb
  city      String                       // "Harare"
  cityCode  String                       // "HRE", "BYO" — used in passport codes
  province  String
  lat       Float?
  lng       Float?
  active    Boolean @default(true)
  @@unique([city, name])
}

model PassportSequence { cityCode String @id  next Int @default(1) }   // SP-{cityCode}-{00000}, row-locked increment

model Trade {
  id String @id @default(cuid())
  code String @unique                    // "SOL", "WLD", "PLB", "MEC", "TLR"
  nameEn String  nameSn String  nameNd String
  active Boolean @default(true)
}

model CompetencyUnit {
  id String @id @default(cuid())
  tradeId String                         // -> Trade
  code String @unique                    // "SOL-03"
  title Json                             // { en, sn, nd }
  description String
  evidenceGuidance String
  classLevel String?
  standardRef String?
  active Boolean @default(true)
  @@index([tradeId])
}

model JobType {
  id String @id @default(cuid())
  tradeId String
  key String @unique                     // "solar_battery_inverter_install" (matches AI output)
  name Json                              // { en, sn, nd }
  needsBeforePhoto Boolean @default(false)
  active Boolean @default(true)
  units JobTypeUnit[]
}
model JobTypeUnit { jobTypeId String  unitId String  @@id([jobTypeId, unitId]) }

model Artisan {
  id String @id @default(cuid())
  passportCode String @unique            // SP-HRE-00123
  displayName String                     // "Tendai M." — public by design, not encrypted
  showFullName Boolean @default(false)
  areaId String
  level Level @default(starter)
  levelFrozen Boolean @default(false)    // fraud rule: 2+ disputes/rejections in 90 days
  trustScore Int @default(70)            // 0–100, never public
  status ArtisanStatus @default(onboarding)
  language Language @default(en)
  birthYear Int?                         // see open question Q5
  experienceYears Int?
  howLearned HowLearned?
  gender String?                         // only with sensitive_demographics consent
  disability String?                     // only with sensitive_demographics consent
  publicBadges String[]
  profilePhotoKey String?
  enrolledByAgentId String?
  joinedAt DateTime @default(now())
  deletedAt DateTime?
  trades ArtisanTrade[]
  @@index([areaId, level])
}
model ArtisanTrade { artisanId String  tradeId String  primary Boolean  @@id([artisanId, tradeId]) }  // max 2, enforced in core

model ArtisanPii {
  artisanId String @id
  fullNameEnc Bytes                      // encrypted
  phoneEnc Bytes                         // encrypted (E.164)
  phoneHash Bytes @unique                // HMAC
  trustedContactEnc Bytes?               // later
}

model Consent {
  id String @id @default(cuid())
  artisanId String
  kind ConsentKind
  textVersion String                     // version of the consent text shown
  language Language
  channel String                         // "whatsapp" | "agent"
  grantedAt DateTime
  revokedAt DateTime?
  @@index([artisanId, kind])
}

model User {                             // anyone who signs in on the web
  id String @id @default(cuid())
  role UserRole
  emailHash Bytes? @unique               // HMAC of lower-cased email (lookup)
  emailEnc Bytes?                        // encrypted
  phoneHash Bytes? @unique
  phoneEnc Bytes?
  passwordHash String                    // argon2id
  totpSecretEnc Bytes?                   // encrypted; required for admin + verifier
  totpEnabledAt DateTime?
  status String @default("active")
  lastLoginAt DateTime?
  createdAt DateTime @default(now())
}

model FieldAgent { id String @id @default(cuid())  userId String @unique  name String  areaId String?  active Boolean @default(true) }

model Verifier {
  id String @id @default(cuid())
  userId String @unique
  name String                            // staff name shown on endorsements (public by design)
  areaId String?
  yearsExperience Int
  status VerifierStatus @default(pending)
  approvedById String?
  trades VerifierTrade[]
  conflicts VerifierConflict[]
}
model VerifierTrade    { verifierId String  tradeId String  @@id([verifierId, tradeId]) }
model VerifierConflict { verifierId String  artisanId String  reason String  declaredAt DateTime @default(now())  @@id([verifierId, artisanId]) }

model Client {
  id String @id @default(cuid())
  phoneHash Bytes @unique
  phoneEnc Bytes
  nameEnc Bytes?                         // encrypted
  firstSeenAt DateTime @default(now())
  optedOut Boolean @default(false)
  optedOutAt DateTime?
  reportsCount Int @default(0)           // denormalised from client_reports (upheld+open, see Q14)
  blocked Boolean @default(false)        // 2+ reports
  // confirmations_30d from SPEC is computed by query, not stored (avoids drift)
}

model Job {
  id String @id @default(cuid())
  ref String @unique                     // short human ref, e.g. "J-7K3Q2"
  artisanId String
  tradeId String
  jobTypeId String
  jobDate DateTime @db.Date
  areaId String
  lat Float?  lng Float?                 // private, never public
  amountChargedCents Int?                // private by default
  clientId String?
  status JobStatus @default(draft)
  agentAssisted Boolean @default(false)
  agentId String?
  artisanConfirmedAt DateTime?           // agent-assisted: artisan confirms "this is my job"
  aiSummary Json?                        // exact SPEC §12 shape, incl. model_version/prompt_version
  artisanSummary Json?                   // corrected by artisan before client is contacted
  aiStatus String @default("pending")    // pending | done | manual_review
  public Boolean @default(true)
  flagRules String[]                     // denormalised open flag rule ids
  counted Boolean @default(false)        // result of core "counts" rule incl. 2-per-client cap
  reviewRequired Boolean @default(false)
  reviewReason String?                   // sampling reason from core
  createdAt DateTime @default(now())
  submittedAt DateTime?
  statusChangedAt DateTime @default(now())
  @@index([artisanId, status])
  @@index([tradeId, status, reviewRequired, createdAt])   // verifier queue
  @@index([clientId, createdAt])
}

model JobMedia {
  id String @id @default(cuid())
  jobId String
  kind MediaKind
  providerMediaId String?                // WhatsApp media id
  originalKey String                     // private bucket
  publicKey String?                      // compressed, metadata-stripped
  thumbKey String?
  mimeType String
  bytes Int
  durationSec Int?
  phash String?                          // 64-bit hex
  capturedAt DateTime?                   // from EXIF where present
  exifLat Float?  exifLng Float?         // private, fraud checks only
  qualityScore Float?                    // 0–1 (blur + darkness)
  imageChecks Json?                      // { quality_ok, looks_like_trade_work, possible_stock_or_screenshot }
  public Boolean @default(true)
  createdAt DateTime @default(now())
  @@index([jobId])
  @@index([phash])
}

model Transcript {
  id String @id @default(cuid())
  jobMediaId String @unique
  language String
  text String
  confidence Float
  modelVersion String
  createdAt DateTime @default(now())
}

model Confirmation {
  id String @id @default(cuid())
  jobId String @unique
  clientId String
  channel ConfirmationChannel
  tokenHash Bytes @unique                // SHA-256 of 128-bit random token
  tokenExpiresAt DateTime
  tokenUsedAt DateTime?
  sentAt DateTime?
  deliveryStatus DeliveryStatus @default(queued)
  remindersSent Int @default(0)
  response ConfirmationResponse?
  rating Int?                            // 1–5
  comment String?
  voiceMediaKey String?
  respondedAt DateTime?
  recordedByAgentId String?              // phone follow-up
  @@index([clientId, respondedAt])
}

model JobCompetency {
  jobId String
  unitId String
  source CompetencySource
  confidence Float?
  evidence String[]
  status JobCompetencyStatus @default(suggested)
  reviewerId String?
  updatedAt DateTime @updatedAt
  @@id([jobId, unitId, source])
}

model Review {
  id String @id @default(cuid())
  jobId String @unique
  verifierId String
  quality ReviewQuality
  noteToArtisan String?
  createdAt DateTime @default(now())
  @@index([verifierId, createdAt])       // monthly review counter for payment
}

model DemonstrationRequest { id String @id @default(cuid())  jobId String  verifierId String  note String?  status String  createdAt DateTime @default(now()) }

model Endorsement {
  id String @id @default(cuid())
  artisanId String
  verifierId String
  tradeId String
  statement String
  createdAt DateTime @default(now())
  withdrawnAt DateTime?
  withdrawnReason String?
  @@index([artisanId])
}

model Buyer {
  id String @id @default(cuid())
  userId String @unique
  orgName String
  type BuyerType
  verified Boolean @default(false)
  contactNameEnc Bytes
  contactPhoneEnc Bytes
  contactPhoneHash Bytes                 // used to block reported clients from sending requests
  plan String?
}

model WorkRequest {
  id String @id @default(cuid())
  buyerId String
  artisanId String
  description String
  areaId String
  preferredDates String
  status WorkRequestStatus @default(sent)
  outcome WorkRequestOutcome @default(unknown)
  jobId String?
  respondedAt DateTime?
  followUpAt DateTime?                   // accepted + 14 days
  createdAt DateTime @default(now())
  @@index([artisanId, status])
}

model ClientReport { id String @id @default(cuid())  artisanId String  clientId String  reason String  details String?  status ReportStatus @default(open)  createdAt DateTime @default(now()) }

model LevelHistory { id String @id @default(cuid())  artisanId String  fromLevel Level  toLevel Level  reason Json  configVersion Int  at DateTime @default(now())  @@index([artisanId, at]) }

model FraudFlag {
  id String @id @default(cuid())
  entity FlagEntity
  entityId String
  rule String                            // e.g. "FR-03-confirmation-ring"
  severity FlagSeverity
  reason String
  evidence Json?
  status FlagStatus @default(open)
  resolvedById String?
  resolvedAt DateTime?
  resolutionNote String?
  createdAt DateTime @default(now())
  @@index([status, severity, createdAt])
  @@index([entity, entityId])
}

model Config {                           // versioned; never edited in place
  version Int @id
  params Json                            // { levels, sampling, fraud, trust, confirmation, media } — zod-validated
  activeFrom DateTime
  createdById String?
  note String?
}

model AuditLog { id String @id @default(cuid())  actorId String?  action String  entity String  entityId String?  at DateTime @default(now())  details Json?  @@index([entity, entityId]) }

model InboundMessage {                   // webhook dedupe + replay
  providerMessageId String @id
  channel String
  fromHash Bytes
  receivedAt DateTime @default(now())
  processedAt DateTime?
}

model OutboundMessage {
  id String @id @default(cuid())
  providerMessageId String? @unique
  toHash Bytes
  templateName String?
  purpose String                         // "client_confirmation", "reminder", ...
  relatedEntity String?  relatedId String?
  status DeliveryStatus @default(queued)
  error String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MediaUploadRequest { id String @id @default(cuid())  agentId String  key String @unique  kind MediaKind  expiresAt DateTime  usedAt DateTime? }

model ProductEvent { id String @id @default(cuid())  name String  subjectId String  props Json?  at DateTime @default(now())  @@index([name, at]) }
                                         // subjectId = HMAC pseudonym, never a raw id or phone
```

### Encrypted vs hashed

| Data | Storage |
| --- | --- |
| Artisan full name, artisan phone, trusted contact (later) | AES-256-GCM (`PII_ENCRYPTION_KEY`) |
| Client phone, client name | AES-256-GCM |
| Staff/buyer email and phone, buyer contact name/phone, TOTP secrets | AES-256-GCM |
| Artisan, client, staff, buyer phone lookups; staff email lookup | HMAC-SHA256 (`PHONE_HASH_PEPPER`) |
| Client confirmation tokens | SHA-256 (token itself is 128-bit random, never stored) |
| Staff passwords | argon2id |
| `displayName`, verifier name, org name | Plain — public by design |
| Product event subject ids | HMAC pseudonym |

Key rotation: ciphertexts carry a 1-byte key-version prefix so a later rotation script can re-encrypt.

---

## 4. Adapter interfaces

```ts
// ---------- Channel-neutral message model (packages/core) ----------
export type Lang = 'en' | 'sn' | 'nd';

export type OutboundMessage =
  | { kind: 'text'; text: string }
  | { kind: 'buttons'; body: string; buttons: { id: string; title: string }[] }            // ≤3
  | { kind: 'list'; body: string; buttonLabel: string;
      sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[] } // ≤10 rows
  | { kind: 'media'; mediaType: 'image' | 'audio' | 'video' | 'document'; storageKey: string; caption?: string }
  | { kind: 'template'; template: TemplateName; lang: Lang; params: Record<string, string>;
      buttons?: { id: string; title: string }[]; url?: string };

export type InboundMessage = {
  providerMessageId: string;
  channel: ChannelId;                       // 'whatsapp' now; 'sms' | 'ussd' later
  from: string;                             // E.164, only ever in memory
  receivedAt: Date;
  content:
    | { kind: 'text'; text: string }
    | { kind: 'choice'; id: string }        // list row OR button OR (later) "1"/"2" SMS digit OR USSD option
    | { kind: 'media'; mediaType: 'image' | 'audio' | 'video'; providerMediaId: string; mimeType: string }
    | { kind: 'contact'; phone: string; name?: string }
    | { kind: 'location'; lat: number; lng: number };
};

export type DeliveryEvent = { providerMessageId: string; status: 'sent' | 'delivered' | 'read' | 'failed' | 'undeliverable'; error?: string; at: Date };

// ---------- packages/adapters ----------
export type ChannelId = 'whatsapp' | 'mock';
export interface ChannelCapabilities { maxButtons: number; maxListRows: number; media: boolean; templatesRequiredOutside24h: boolean; maxTextLength: number }

export interface MessagingChannel {
  readonly id: ChannelId;
  readonly capabilities: ChannelCapabilities;
  send(to: string, message: OutboundMessage): Promise<{ providerMessageId: string }>;
  downloadMedia(providerMediaId: string): Promise<{ data: Buffer; mimeType: string }>;
  /** Parse a raw provider webhook into neutral events (after signature check). */
  parseWebhook(raw: { headers: Record<string, string>; body: Buffer }): { messages: InboundMessage[]; deliveries: DeliveryEvent[] };
  verifySignature(raw: { headers: Record<string, string>; body: Buffer }): boolean;
}

export interface SpeechToText {
  transcribe(input: { audio: Buffer; mimeType: string; languageHint?: Lang }):
    Promise<{ text: string; language: string; confidence: number; modelVersion: string }>;
}

export interface LlmProvider {
  /** Structured output against a JSON schema. Callers validate with zod and retry once. */
  generateJson<T>(req: {
    promptId: string; promptVersion: string;
    system: string; user: string;
    images?: { data: Buffer; mimeType: string; ref: string }[];
    jsonSchema: object;
  }): Promise<{ json: unknown; modelVersion: string; promptVersion: string; raw?: string }>;
}

export interface ObjectStorage {
  put(bucket: Bucket, key: string, data: Buffer, opts?: { contentType?: string; cacheControl?: string }): Promise<void>;
  get(bucket: Bucket, key: string): Promise<Buffer>;
  delete(bucket: Bucket, key: string): Promise<void>;
  signedGetUrl(bucket: Bucket, key: string, ttlSec: number): Promise<string>;
  signedPutUrl(bucket: Bucket, key: string, opts: { contentType: string; maxBytes: number; ttlSec: number }): Promise<string>;
  publicUrl(key: string): string;                     // public bucket via CDN base URL
}
export type Bucket = 'private' | 'public';

export interface Clock { now(): Date }
export class ControllableClock implements Clock { /* set(d), advance(ms) */ }
```

**How SMS/USSD slot in later without touching flows.** Flow code in `packages/core` only ever returns
`OutboundMessage[]` and consumes `InboundMessage` with `choice` ids — it never knows which channel it is talking to.
Each adapter *renders* the neutral message for its medium and *parses* replies back to neutral ids:

- WhatsApp: `buttons` → interactive reply buttons; `list` → interactive list; `template` → approved template.
- SMS (later): `buttons`/`list` → numbered text ("Reply 1 = Yes, 2 = No"); a digit reply is mapped back to the
  same `choice.id` using a short per-conversation option map; `template` → plain text from the same i18n key.
- USSD (later): `list` → a USSD menu page; `media` is dropped with a fallback text key.

Flows declare what they need (e.g. "needs media") and the runner checks `capabilities`, so a flow that requires
photos can tell a USSD user to use WhatsApp or a field agent — again through an i18n key, not channel code.
Templates live in a typed registry (`packages/core/templates.ts`: name, category `utility`, languages, ordered params,
buttons); the WhatsApp adapter uses the registry, SMS later uses the same entries as text.

---

## 5. Design direction

### Concept: the passport is a document of record

A Skills Passport should feel like something an institution *issued* — closer to a passport data page, a bank
statement or a land title than to an app. Warm paper-white surfaces, deep ink, crisp hairline rules, a serial number
set in monospace, and one fine engraved-line (guilloche-style) band across the top of the passport header, drawn as a
lightweight inline SVG (≈3 KB) at low contrast. Endorsements carry a small, precise circular seal (ring of
micro-text + verifier initials), stamped in the metallic accent. The artisans' own work photos are the only imagery.
Everything else is typography, rules and whitespace.

The brand logo (`docs/brand/logo.png`) is a deep green passport with an orange page and hard hat. The tokens below
derive the primary ink and the accent from the logo so the product and the mark belong together.

### Colour tokens

| Token | Hex | Use | Contrast on paper |
| --- | --- | --- | --- |
| `--ink-900` (primary) | `#0E4334` | Brand ink: headings on passport, primary buttons, links, focus ring | 10.2:1 |
| `--ink-700` | `#2F6B4F` | Hover/secondary ink, success state | 5.7:1 |
| `--ink-100` | `#E3ECE7` | Selected rows, subtle fills | — |
| `--paper` | `#F7F4EE` | Page background | — |
| `--paper-raised` | `#FFFFFF` | Cards, tables, inputs | — |
| `--rule` | `#DDD6C8` | 1 px hairlines | — |
| `--text` | `#141414` | Body text | 16.8:1 |
| `--text-muted` | `#5E6660` | Secondary text, labels | 5.4:1 |
| `--accent` (ochre) | `#9A5419` | Seals, level badge rims, small accent text (the only accent) | 5.2:1 |
| `--accent-mark` | `#E16E18` | Logo orange — non-text marks only (seal fill, logo) | 3.0:1 (graphics only) |
| `--level-bronze` | `#8C5A2B` | Bronze badge | 5.6:1 |
| `--level-silver` | `#6B7176` | Silver badge (cool pewter, not grey-blue) | 4.9:1 |
| `--level-gold` | `#8A6A1F` | Gold badge (old gold, never yellow) | 4.6:1 |
| `--status-warning` | `#8A6A1F` / bg `#F4ECD8` | Pending, awaiting client | 4.6:1 |
| `--status-danger` | `#9B2C2C` / bg `#F6E3E1` | Disputed, rejected, errors | 6.9:1 |
| `--status-success` | `#2F6B4F` / bg `#E3ECE7` | Verified, confirmed | 5.7:1 |

Dark mode is not planned for the MVP (paper is the concept); dashboards may get it later.
Level badges are flat fills with a 1 px engraved inner rim and the level name in small caps — no gradients, no shine.

### Typefaces (3 families, self-hosted with `next/font/local`, Latin subset)

| Role | Family | Why |
| --- | --- | --- |
| Display (headings, artisan name on passport, big figures labels) | **Fraunces** (static 600, opsz 72 cut, low "soft") | A serif with the engraved, slightly old-style character of official documents; distinctive without being a cliché wedding serif; one static weight keeps it ≈25 KB. |
| UI and body | **IBM Plex Sans** (400, 600) | Precise, institutional, very legible at 14–16 px on low-end Android screens; good tabular figures; pairs natively with Plex Mono. |
| Codes and numbers | **IBM Plex Mono** (500) | Passport codes (`SP-HRE-00123`, letter-spaced 0.08em), job refs, counts and ratings with tabular figures. |

Font budget ≈ 85 KB total woff2, inside the 200 KB public page budget. `font-display: swap`, preload only Plex Sans 400.

### Type scale (6 sizes, 1.25-ish ratio, mobile-first)

| Token | Size / line height | Use |
| --- | --- | --- |
| `text-xs` | 12 / 16 | Labels, captions, micro-text, table meta |
| `text-sm` | 14 / 20 | Dashboard body, table cells |
| `text-base` | 16 / 24 | Public page body, form inputs (prevents iOS zoom) |
| `text-lg` | 20 / 28 | Section headings (Plex Sans 600) |
| `text-xl` | 28 / 34 | Page titles, key figures (Fraunces / Plex Mono) |
| `text-display` | 40 / 44 → 56 / 60 at ≥1024 px | Artisan name on passport only |

Spacing on a 4/8 scale (4, 8, 12, 16, 24, 32, 48, 64). Radii 4 (inputs, badges), 6 (buttons), 8 (panels).
Shadows: none on surfaces; one soft shadow (`0 8px 24px rgb(20 20 20 / 0.08)`) for dialogs and the image viewer.
Motion 150–200 ms ease-out, disabled under `prefers-reduced-motion`. Icons: Lucide, 1.5 px stroke, only where they aid scanning.

### Public passport page `/p/[code]` (360 px first)

1. **Passport header** on `--ink-900` with the guilloche band in a slightly lighter ink: small caps label
   "SKILLS PASSPORT", the artisan's name in Fraunces display, trade(s) and suburb in Plex Sans, the level badge on the
   right, and the passport code in Plex Mono along the bottom edge like a document number. Member since sits beside it.
2. **Figures row** on paper: three figures in Plex Mono tabular numerals with plain labels —
   "Verified jobs", "Clients served", "Average rating" — separated by hairlines, left-aligned.
3. **Work** — a gallery of the artisan's own public photos (lazy-loaded, sized `srcset`, 2 columns mobile / 4 desktop),
   each captioned with job type and month. Tap opens a quiet full-screen viewer.
4. **Competencies** — a ruled list per trade: unit code (mono) + title, status at right: "Verified" (ink, check) or
   "Pending verification" (muted). Progress line "6 of 8 units verified".
5. **Endorsed by** — each endorsement as a short statement with the ochre seal, verifier name and date.
6. **Footer** — "How this passport is checked" (two sentences, no official-certificate claim), QR code, share actions.
No phone numbers, exact locations, amounts or disputes ever appear. Empty states read as a new document, e.g.
"No verified jobs yet. Jobs appear here once a client confirms them."

### Verifier queue `/verifier` (calm, dense tool)

- **Mobile:** a single list of queue items (flagged first, then oldest): job ref (mono), trade + job type, artisan
  display name, age in the queue ("2 d"), flag chip if any. Tapping opens the review screen: photo strip at top
  (swipe, pinch-zoom), transcript and summary collapsed below, suggested units as a checklist with confidence
  shown as a plain percentage, then a sticky bottom bar with the three ratings and a note field.
- **Desktop (≥1024 px):** three panes — queue table (left, sortable, filter by trade/flagged), evidence viewer
  (centre, large image with zoom, video and voice player, transcript), decision panel (right: rating, units, note,
  "Request demonstration"). Keyboard: `J`/`K` next/previous, `1`/`2`/`3` rate, `E` endorse when eligible,
  `?` shows shortcuts. Monthly "Reviews completed" counter in the top bar.

The full token set and component specs will be written to `docs/DESIGN.md` in Milestone 1.

---

## 6. Milestones

| # | Milestone | Delivers |
| --- | --- | --- |
| 0 | Plan | This document; answers to the questions in section 7. |
| 1 | Foundations | pnpm + Turborepo monorepo, strict TS/ESLint/Prettier/Vitest; docker-compose (postgres 16, redis 7, minio + buckets); zod env + `.env.example`; full Prisma schema, migration and seed (5 trades, units, job types, 6 areas, default config, fictional users); adapters with mocks + PII crypto/phone helpers; NestJS API with health, redacting logger, validation, errors, request ids, staff auth (argon2, TOTP, JWT cookie, role guard); worker bootstrap; `packages/ui` tokens + base components + `/dev/design`; web login + dashboard shell; README; design self-review. |
| 2 | Domain rules | `packages/core`: job state machine + "counts", level calculation + next-level checklist (with downgrades), review sampling (injectable randomness), competency status, every fraud rule as a pure function, trust score, i18n catalogue (en + draft sn/nd) — table-driven tests, ~100% branch coverage. |
| 3 | Conversation engine | WhatsApp webhook (GET handshake, signed POST, dedupe, queue); Redis-backed resumable per-phone state machine; onboarding, main menu, job logging, "My passport" flows; `/dev/chat` multi-phone WhatsApp simulator; integration tests. |
| 4 | Media pipeline and AI | Download → private original → stripped public copy + thumbnail → pHash → quality score → retake request; duplicate detection; STT, job structuring and competency suggestions (zod-validated, retry once, trade-restricted, no PII), image checks as flags; versioned prompts; realistic per-trade mock fixtures; real Anthropic + Whisper adapters behind env vars; artisan can correct the summary. |
| 5 | Client confirmation + public passport (pitch demo) | Token + WhatsApp template with buttons + `/c/[token]` rating page; reminders/expiry via delayed jobs; undeliverable → agent follow-up; level recalculation + level history + artisan notifications; flagship `/p/[code]` page with OG image; QR endpoint and share flow (link, QR, Status card); `docs/DEMO.md` and `pnpm demo:reset`. |
| 6 | Verifier and field agent tools | Verifier queue + review screen with shortcuts and image viewer, conflicts enforced, demonstrations, endorsements (with withdrawal), artisan notifications; agent enrolment and assisted job logging with signed uploads, artisan ownership confirmation, phone follow-up outcomes; per-verifier monthly review counter; permission tests. |
| 7 | Admin, fraud, buyers, safety (pilot MVP) | Admin CRUD for trades/units/job types, verifiers/agents, versioned config, audit viewer, freeze/unfreeze; fraud review queue; buyer directory with rate limits + work requests + 14-day follow-up + one-tap job logging; report a client; account deletion with 30-day purge; pilot report (min cell size 5) and product events; spec gap review; design consistency pass with screenshots. |
| 8 | Hardening | Security review + `docs/SECURITY.md`; retries, backoff, dead-letter queues, idempotency; performance + caching + indexes; observability and alerts; backup/restore script; Playwright E2E suite; launch-readiness checklist. |
| 9 | Real providers and deploy | Full WhatsApp Cloud API adapter + delivery webhooks + `docs/WHATSAPP_TEMPLATES.md`; AI evaluation harness (`fixtures/eval`); Dockerfiles, staging/production config, migrate-on-deploy, `docs/DEPLOY.md`; `/dev/*` disabled in production with a test. |
| 10 | SMS and USSD (later, not started) | SMS/USSD adapters behind the same channel model, SMS confirmation fallback, USSD menus, simulators. |

---

## 7. Questions and contradictions

Each has a **proposed default** I will use unless you say otherwise.

**Product rules**

1. **Artisan reviews the AI summary vs. "client contacted within 1 minute".** PROMPTS M4 step 6 says the artisan sees
   and can correct the AI summary *before* the client is contacted; SPEC §4.2/§15 say the client request goes out within
   1 minute of submission, and AI can take up to 5 minutes. *Proposal:* the client message does not depend on the AI
   summary (it only names the job type and date), so send it within 1 minute; the artisan can correct the summary in
   parallel and the corrected version is what the client sees on `/c/[token]` and the verifier sees in the queue.
2. **Levels with two trades.** Artisans can have 2 trades, but `artisans.level` is a single value, Gold needs "70% of
   *the trade's* units", and endorsements are per trade. *Proposal:* one level per artisan; job/client counts across
   all trades; endorsements count toward any trade; the Gold 70% rule is met if **any one** of their trades reaches 70%.
   The passport shows units per trade.
3. **Disputed jobs that a verifier later rates "meets standard".** SPEC 4.10 lets `client_disputed → under_review →
   verified`, and verified jobs count. A verifier judges *quality*, not whether the client agrees the work was done.
   *Proposal:* a job whose client disputed it **never counts** unless an admin resolves the dispute in the artisan's
   favour (e.g. after field-agent follow-up); verifiers can still review its quality and confirm competencies.
4. **"No open disputes" (Silver).** *Proposal:* "open" = a disputed job not yet resolved by a review/admin decision.
5. **Age check.** No date-of-birth field in SPEC §11. *Proposal:* ask year and month of birth, store only `birthYear`
   (and month transiently), reject outside 18–35 at onboarding; never re-check later.
6. **Residency.** *Proposal:* "I live and work in Zimbabwe" yes/no, recorded in the core consent record. Is that right,
   or should residency be limited to the pilot cities (Harare, Bulawayo)?
7. **Areas.** Seed has 6 suburbs. *Proposal:* artisans pick from a list filtered by city, plus "My area isn't listed" →
   stored as pending and assigned by an admin/agent. Passport city code comes from the area (`HRE`, `BYO`).
8. **Passport code numbering.** *Proposal:* a sequence per city (`SP-HRE-00001`, `SP-BYO-00001`), 5 digits, never reused.
9. **Gold "12 counted jobs over at least 3 months".** *Proposal:* at least 90 days between the earliest and the latest
   counted job date.
10. **Average rating ≥ 3.5 when ratings are optional.** Tapping "Yes, it was done" gives no rating. *Proposal:* average
    over rated jobs only, and require at least 3 ratings before the Silver rating rule can be met. Is a minimum OK?
11. **Silver needs 1 endorsement, but an endorsement needs 3 "meets standard" reviews by that verifier**, and Gold needs
    endorsements from 2 different verifiers (≥6 reviewed jobs), while sampling after the first 3 jobs is only 20%.
    *Proposal:* once an artisan meets every other requirement for the next level, their new counted jobs are always
    sampled ("pre-level review") and, for Gold, routed to a verifier who has not yet endorsed them. Confirm.
12. **"Confirmation from a phone number registered in the last 24 hours".** Almost every new client is first seen when
    the job is submitted, so this would soft-flag nearly every first job. *Proposal:* interpret as "the client phone
    first appeared on the platform less than 24 h **before the job was submitted** by a *different* artisan, or was
    registered as an artisan/staff in the last 24 h". Please confirm the intent.
13. **Same client > 2 jobs per artisan in 30 days.** *Proposal:* rolling 30 days on the confirmation time; the 3rd+
    job stays visible but `counted = false` and is flagged.
14. **Client reports.** *Proposal:* the block at 2+ reports counts **distinct artisans** reporting (so one artisan
    cannot block a client alone) and open + upheld reports; admins can dismiss. Confirm.
15. **Client message language.** Clients have no language preference. *Proposal:* send the template in the artisan's
    language, with a language switch on `/c/[token]`.
16. **Rating link after a button tap.** Tokens are single-use, but the template invites the client to tap "Yes" *and*
    open the link to rate. *Proposal:* the token is consumed by the web form submission (one rating/comment), not by the
    button tap; after a button tap the page opens in "add a rating" mode. The token still expires at 7 days.
17. **Agent-assisted jobs.** *Proposal:* the client request is sent only after the artisan confirms "this is my job" on
    WhatsApp (or 24 h passes, then the job waits for the agent). Confirm.
18. **Client opted out / blocked.** *Proposal:* the job goes straight to field-agent phone follow-up; the artisan is told
    to use a different client only if the client is blocked.
19. **Authentication.** CLAUDE.md says email + password + TOTP for everyone; SPEC §14 requires MFA only for admin and
    verifiers; SPEC §3 allows phone *or* email. *Proposal:* email or phone + password for all; TOTP required for admin,
    verifier and field agent, optional for buyers (households would struggle with an authenticator app).

**Design**

20. **Brand colours vs. the CLAUDE.md palette.** The logo uses green `#024433` and orange `#E16E18`. I aligned the ink
    to the logo (`#0E4334`) and use a darker ochre `#9A5419` as the single UI accent, keeping the logo orange for the
    logo and seal fill only (it fails text contrast on paper at 3.0:1). OK, or do you want the brighter orange more visible?
21. **Logo use.** The logo includes a hard-hat figure — fine as the brand mark, but per the design standard I will not
    use illustrations of people anywhere else. Do you have an SVG version, and a horizontal lock-up for the top bar?

**Delivery**

22. **Spec versions.** The PDF is v1.0 (SMS-era); `SPEC.md` v1.1 is the source of truth. I've kept the PDF under
    `docs/reference/`. OK?
23. **Library versions.** Node 20 LTS, pnpm 9, Turborepo 2, NestJS 11, Next.js 15 (App Router), Prisma 6, BullMQ 5,
    Tailwind CSS 4, Vitest 2/3, Playwright. Any constraints (e.g. hosting that fixes a Node version)?
24. **Branching.** I'm working on `claude/new-session-play15`. Do you want one branch/PR per milestone, or keep
    building on this branch?

---

## 8. Decisions (adopted)

The owner asked to proceed with the proposed defaults for every question in section 7. They are now product rules and are
implemented in `packages/core` and the default config:

- Client request goes out within a minute; the AI summary is corrected in parallel (Q1).
- One level per artisan; counts across trades; Gold's 70% rule is met by any one trade (Q2).
- A disputed job never counts unless an admin resolves the dispute for the artisan (Q3); "open dispute" = unresolved (Q4).
- Birth year + month asked, only `birthYear` stored (Q5); Zimbabwe residency yes/no in the consent record (Q6).
- Area list per city plus "not listed" (Q7); passport numbering per city (Q8).
- Gold span = 90 days between first and last counted job dates (Q9); Silver rating rule needs at least 3 ratings (Q10).
- "Pre-level review": when every other requirement for the next level is met, new counted jobs are always sampled (Q11).
- "Recently registered" soft flag interpreted as in Q12; same-client cap on rolling 30 days of confirmation time (Q13).
- Client block counts distinct reporting artisans (Q14); client language = artisan language (Q15).
- Rating token consumed by the web form, not the button tap (Q16); agent-assisted jobs wait for the artisan's "this is mine" (Q17).
- Opted-out / blocked clients → field-agent follow-up (Q18); TOTP required for admin, verifier and agent, optional for buyers (Q19).
- Colours as proposed (Q20); logo used as the brand mark only (Q21); v1.0 PDF kept as reference (Q22).
- Library versions: Node 20+, pnpm 10, Turborepo 2, NestJS 11, Next.js 15, Prisma 6, BullMQ 5, Tailwind 4, Vitest 3 (Q23).
- Work continues on the `claude/new-session-play15` branch (Q24).

Environment note: when Docker is not available (e.g. a cloud dev container), `STORAGE_DRIVER=fs` stores objects on local
disk behind the same `ObjectStorage` interface; MinIO remains the default in `docker-compose.yml`.
