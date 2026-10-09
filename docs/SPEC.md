# Skills Passport — Platform development specification

*Functional and technical requirements for building the Skills Passport platform*

Version 1.1  ·  October 2026  ·  Scope: MVP and 12-month pilot

> **Channel scope for the current build: WhatsApp only.** Artisans and clients use WhatsApp. SMS and USSD are a later phase (see section 18). Build every messaging feature behind a channel-agnostic interface so SMS and USSD can be added without changing flow logic.

**Contents:** 1 Product overview · 2 Glossary · 3 Users and roles · 4 Core user journeys · 5 Verification and passport rules · 6 Fraud prevention · 7 Competency framework · 8 Conversation design · 9 System architecture · 10 Technology stack · 11 Data model · 12 API endpoints · 13 AI components · 14 Privacy, safety and compliance · 15 Non-functional requirements · 16 Analytics and reporting · 17 Testing and quality assurance · 18 Build roadmap · 19 Open decisions

## 1. Product overview

Skills Passport turns the real work of informally skilled young artisans (18–35) into a verified credential. After each job, the artisan sends photos and a voice note on WhatsApp. The client confirms the job with one tap, a master artisan reviews the quality, and AI maps the evidence to trade competency standards. The result is a shareable passport that buyers, employers, lenders and trade testing can trust.

**Design principle:** the passport must be useful from the first verified job. It must never depend on government recognition to deliver value.

**Channels:** WhatsApp for artisans and clients (SMS and USSD later); mobile web for verifiers, field agents and buyers; public passport web pages with QR codes.

### MVP scope

| Module | MVP (pilot launch) | Later releases |
| --- | --- | --- |
| Onboarding | WhatsApp sign-up, trade selection, consent, passport code | Self-service profile editing on web |
| Job logging | Photos, short video, voice note, client details; field-agent assisted mode | Offline capture app for field agents |
| Client confirmation | WhatsApp one-tap confirm (template with quick-reply buttons), web rating page, reminders | SMS and USSD confirmation, voice-call confirmation |
| Verification | Verifier review queue with sampling rules, endorsements | Practical demonstration booking |
| AI | Transcription, job structuring, competency suggestions, image checks | Skill-gap voice lessons |
| Passport | Levels, public page, QR code, share link | Downloadable PDF portfolio |
| Buyers | Basic directory search and contact requests | Verified business accounts, subscriptions, hire tracking dashboards |
| Safety | Report and block a client | Trusted-contact location sharing and job check-in/check-out |
| Lenders | - | Consent-based verified work-history reports |
| Trade testing | Readiness indicator | Portfolio pack organised by unit standard |

## 2. Glossary

| Term | Meaning |
| --- | --- |
| Artisan | A young person with a practical trade skill, usually learned informally. |
| Job | One piece of completed work logged by an artisan, with evidence. |
| Evidence | Photos, video and a voice note describing the job, plus automatic time and location data. |
| Client | The person or business the job was done for. Clients confirm jobs; they do not need an account. |
| Verifier | An experienced master artisan registered to review job quality and endorse artisans. |
| Endorsement | A verifier’s statement that the artisan’s work meets the standard for their trade. |
| Competency unit | One skill in a trade’s framework, e.g. “DC wiring and protection” for solar installation. |
| Passport level | Starter, Bronze, Silver or Gold, based on verified jobs, clients, endorsements and competencies. |
| Buyer | A business, NGO or household looking to hire an artisan. |

## 3. Users and roles

| Role | Access channel | Can do | Cannot do |
| --- | --- | --- | --- |
| Artisan | WhatsApp | Create passport, log jobs, see job status, choose which jobs and photos are public, share passport, accept or decline work requests, report a client, grant lender access | Confirm their own jobs or edit confirmed jobs |
| Client | WhatsApp message + web link (no account) | Confirm or dispute a job, rate it, leave a comment, opt out of messages | See the artisan’s other jobs or private data |
| Verifier | Mobile web | Review jobs in their trade, confirm competencies, rate quality, endorse artisans, request a practical demonstration | Review their own apprentices or relatives (declared conflict of interest) |
| Field agent | Mobile web | Enrol artisans, log jobs on an artisan’s behalf (with the artisan present), help with photos and voice notes | Confirm jobs or endorse artisans |
| Buyer | Web | Search the directory, view public passports, send work requests, report the outcome | See artisan phone numbers before the artisan accepts |
| Lender (later) | Web | View a work-history report for an artisan who has granted consent | Access anyone without current consent |
| Admin | Web | Manage trades, competency frameworks, verifiers, field agents, fraud review, configuration, reports | Change job evidence |

**Authentication:** artisans are identified by their WhatsApp number. Staff, verifiers and buyers sign in with phone or email, password and an authenticator-app (TOTP) code. Clients use single-use, signed confirmation links that expire after 7 days.

## 4. Core user journeys

### 4.1 Artisan onboarding

1. Artisan sends “Hi” to the Skills Passport WhatsApp number (or a field agent enrols them).
2. Choose language: English, chiShona or isiNdebele.
3. Age check (18–35) and residency confirmation.
4. Consent: what is collected, what is public, how clients are contacted. Voice-note version available.
5. Profile: first name and surname, trade(s) (up to 2), suburb or area, years of experience, how they learned (apprenticeship, family, self-taught, college).
6. Optional and separately consented: gender and disability, used only for inclusion reporting unless the artisan chooses a public badge (e.g. “Women in Trades”).
7. Optional profile photo.
8. System creates the passport code (format SP-{CITY}-{00000}, e.g. SP-HRE-00123) at level Starter and sends a short guide to logging the first job.

### 4.2 Log a job

1. Artisan chooses “Log a job” and picks the job type from a list for their trade (e.g. “Solar: battery and inverter installation”).
2. Send 1–3 “before” photos (optional for some job types).
3. Send 1–5 “after” photos and/or one video up to 60 seconds.
4. Send a voice note (up to 2 minutes) describing what was done, materials used and any problems solved. The bot prompts with three questions if the artisan prefers.
5. Enter client name and phone number (or share the client’s WhatsApp contact).
6. Confirm job date and area (defaults to today and the artisan’s area). Optionally share location.
7. Optional: amount charged (kept private by default).
8. Review summary and submit. The bot replies with the job reference and says the client will be asked to confirm.

After submission the system runs the media pipeline and AI processing (section 13), applies fraud checks (section 6) and sends the client confirmation request within one minute.

### 4.3 Client confirmation

```
WhatsApp template message to client (utility category, quick-reply buttons):
"Skills Passport: Tendai says they did 'battery and inverter installation'
for you on 12 Nov. Was this work done?"
[ Yes, it was done ]  [ No ]  [ Stop messages ]
Rate the work and see photos: https://<short-domain>/c/8KQ2X
```

- Tapping “Yes, it was done” or confirming on the link confirms the job. The link page shows the photos and asks for a 1–5 star rating and an optional comment or voice note.
- Tapping “No” marks the job disputed. The artisan is told and the job goes to the review queue.
- Reminders at 48 hours and 5 days. No answer after 7 days: status client_expired. Field agents can follow up by phone and record the outcome.
- The client phone number must not belong to the artisan or any other registered artisan (section 6).
- If the client is not on WhatsApp (message undeliverable), the job is flagged for field-agent phone follow-up. SMS fallback comes in the later SMS phase.

### 4.4 Verifier review

- Verifiers see a queue of jobs in their trade selected by the sampling rules (section 5), oldest first, with flagged jobs on top.
- Each item shows photos, video, transcript, AI summary and AI-suggested competency units with confidence.
- The verifier rates quality (meets standard, needs improvement, reject), confirms or removes each suggested competency, adds missing ones, and writes an optional note to the artisan.
- After reviewing at least 3 jobs by the same artisan rated “meets standard”, the verifier can endorse the artisan.
- A verifier can request a practical demonstration if evidence is unclear; the artisan is notified to arrange it.
- Target turnaround: 72 hours. Verifiers are paid per completed review.

### 4.5 Field-agent assisted logging

- For artisans without smartphones or data, a field agent logs the job on the agent’s device in the artisan’s presence.
- The job is marked agent_assisted with the agent’s ID. The artisan receives a WhatsApp message with the job reference to confirm it is theirs.
- The same client confirmation and fraud rules apply.

### 4.6 Passport page

- Public URL (e.g. <short-domain>/p/SP-HRE-00123) and QR code. Server-rendered, under 200 KB, fast on 3G.
- Shows: first name and surname initial (artisan can show full name), trade(s), area at suburb level, level badge, number of verified jobs, average rating, number of distinct clients, competencies evidenced (verified vs. pending), selected job photos, endorsements, member since.
- Never shows: phone number, exact location, amounts charged, client details, disputes.
- Share options: WhatsApp share text, image card for WhatsApp Status, printable QR card.

### 4.7 Buyer search and work requests

1. Buyer searches by trade, area, level and minimum rating; results sorted by level, then rating, then recent activity.
2. Buyer opens a passport and sends a work request with job description, location area, preferred dates and contact details.
3. Artisan receives the request on WhatsApp and accepts or declines. On accept, both sides receive each other’s contact details.
4. After 14 days, both sides are asked whether the job happened. A completed hire can be logged as a job in one tap, with the buyer as the client.

### 4.8 Lender report (later)

- Artisan chooses “Share with a lender” and selects a registered lender, or approves a lender’s request.
- Consent lasts 30 days and can be revoked at any time. The artisan is notified each time the report is viewed.
- Report shows verified jobs per month, distinct clients, ratings, level history and client-confirmed amounts where available. Exported as a signed PDF with a verification code.

### 4.9 Trade-test readiness (later)

- When an artisan reaches Gold, the system generates a portfolio pack: evidence grouped by competency unit, verifier endorsements and a job list.
- Includes guidance on registering for the relevant trade test and any fee support available.

### 4.10 Job status transitions

| From | To | Trigger |
| --- | --- | --- |
| draft | submitted | Artisan confirms the job summary |
| submitted | awaiting_client | Media and AI processing done; confirmation sent to client |
| awaiting_client | client_confirmed | Client replies 1 or confirms on the link |
| awaiting_client | client_disputed | Client replies 2 or disputes on the link |
| awaiting_client | client_expired | No answer after 7 days |
| client_expired | client_confirmed or closed | Field agent follow-up by phone |
| client_confirmed | under_review | Selected by sampling rules or flagged |
| client_disputed | under_review | Always |
| under_review | verified, needs_improvement or rejected | Verifier (or admin for fraud) decision |

A job counts toward the passport when its status is client_confirmed, verified or needs_improvement, and never when it is rejected, disputed, expired or closed.

## 5. Verification and passport rules

### Passport levels (defaults, configurable)

| Level | Requirements | Shown as |
| --- | --- | --- |
| Starter | Profile created | New member |
| Bronze | 3 counted jobs from at least 3 different clients | Verified jobs |
| Silver | 5 counted jobs, at least 4 distinct clients, at least 1 verifier endorsement, average rating 3.5 or higher, no open disputes | Endorsed artisan |
| Gold | 12 counted jobs over at least 3 months, at least 8 distinct clients, endorsements from at least 2 different verifiers, at least 70% of the trade’s competency units verified | Trade-test ready |

- Levels are recalculated after every job status change. Levels can go down (e.g. an endorsement withdrawn or jobs rejected after a fraud review); the artisan is told why.
- Level history is stored for lender reports and analytics.

### Review sampling

| Rule | Default |
| --- | --- |
| First jobs of every artisan | First 3 counted jobs reviewed (100%) |
| Random sample after that | 20% of counted jobs |
| Flagged jobs (fraud or quality signals) | 100% |
| Disputed jobs | 100% |
| Artisan with a dispute in the last 60 days | All new jobs reviewed |
| Before reaching Silver or Gold | At least 1 (Silver) or 3 (Gold) reviewed jobs rated “meets standard” |

### Competency status

- **Verified:** confirmed by a verifier on at least one job.
- **Pending:** suggested by AI with confidence of at least 0.80 on at least 2 client-confirmed jobs, not yet reviewed. Shown on the passport as “pending verification”.
- **Gold** counts verified competencies only.

## 6. Fraud prevention

The credential is only worth something if buyers trust it. Every rule below creates a flag; flags send jobs to review and feed an internal trust score (0–100, never public).

| Rule | Action |
| --- | --- |
| Client phone equals the artisan’s phone, or any registered artisan’s or verifier’s phone | Block submission; ask for a different client |
| Same client phone confirms more than 2 jobs for the same artisan in 30 days | Flag; only 2 count toward the level |
| One client phone confirms jobs for more than 5 different artisans in 30 days | Flag all; possible confirmation ring |
| Duplicate or near-duplicate image (perceptual hash distance below threshold) across any jobs | Flag; exclude duplicate photos |
| Photo metadata shows capture date long before the job date (where metadata is available) | Soft flag |
| Image looks like a screenshot, stock photo or downloaded image (AI check) | Flag |
| Shared location far from the stated job area | Soft flag |
| Confirmation from a phone number registered in the last 24 hours on the platform | Soft flag |
| 2 or more disputed or rejected jobs in 90 days | Freeze level changes; admin review |
| Verifier endorses an artisan they declared a conflict with, or approves at an unusually high rate | Flag verifier for admin review |

> Thresholds are configurable. Review flag rates monthly and tune to keep false positives low.

## 7. Competency framework

Each trade has a list of competency units. The framework is data, not code: admins manage trades and units through the dashboard, and each unit links to the matching national trade-test unit standard once that mapping is confirmed with the testing authority and master artisans.

| Field | Description |
| --- | --- |
| code | Unique code, e.g. SOL-03 |
| title | Short name shown to users and in all three languages |
| description | What a competent artisan can do |
| evidence_guidance | What photos and voice-note content prove it (shown to artisans and to the AI) |
| job_types | Which job types usually evidence this unit |
| class_level | Trade-test class the unit belongs to (to confirm with the testing authority) |
| standard_ref | Reference to the official unit standard |

### Pilot trades and draft units

> Draft starting points only. Finalise each list with at least two master artisans per trade and align with official standards before launch.

| Trade | Draft competency units |
| --- | --- |
| Solar PV installation | SOL-01 Site assessment and load calculation · SOL-02 Panel mounting and safe roof work · SOL-03 DC wiring and protection · SOL-04 Battery installation and safety · SOL-05 Inverter installation and set-up · SOL-06 Earthing and surge protection · SOL-07 Testing and commissioning · SOL-08 Customer handover and maintenance advice |
| Welding and metal fabrication | WLD-01 Reading drawings and measuring · WLD-02 Cutting and preparing metal · WLD-03 Arc welding, flat position · WLD-04 Arc welding, vertical and overhead · WLD-05 Fabricating gates, frames and burglar bars · WLD-06 Grinding, finishing and painting · WLD-07 Workshop safety and PPE |
| Plumbing | PLB-01 Pipe cutting and joining (PVC, copper, galvanised) · PLB-02 Water supply installation · PLB-03 Drainage and waste systems · PLB-04 Sanitary fittings (toilets, basins) · PLB-05 Geyser and solar water heater installation · PLB-06 Leak detection and repair · PLB-07 Pressure testing |
| Motor mechanics | MEC-01 Routine service · MEC-02 Brakes and suspension · MEC-03 Engine diagnosis · MEC-04 Engine repair and overhaul · MEC-05 Electrical systems and batteries · MEC-06 Transmission and clutch · MEC-07 Workshop safety |
| Tailoring | TLR-01 Taking measurements · TLR-02 Pattern drafting · TLR-03 Cutting fabric · TLR-04 Machine sewing and seams · TLR-05 Fitting and alterations · TLR-06 Finishing (hems, buttons, zips) · TLR-07 Garment design for customers |

## 8. Conversation design

### WhatsApp main menu (interactive list)

| Option | Action |
| --- | --- |
| 1. Log a job | Starts the job logging flow (section 4.2) |
| 2. My passport | Level, verified jobs, rating, what is needed for the next level |
| 3. Waiting for clients | Jobs awaiting confirmation; resend reminder; edit client number before confirmation |
| 4. Share my passport | Link, QR image and WhatsApp Status card |
| 5. Work requests | Open requests from buyers; accept or decline |
| 6. Help | FAQ, talk to a field agent, report a client |
| 7. Settings | Language, public profile options, lender access, delete my account |

### Messaging rules

- **Progress nudges:** after each confirmed job, tell the artisan exactly what is left for the next level (e.g. “2 more jobs from new clients to reach Bronze”).
- **WhatsApp templates:** needed for messages outside the 24-hour window: client confirmation (if sent by WhatsApp), work-request alerts, review results, reminders. Use the utility category.
- **Client messages:** short, clearly from Skills Passport, with a “Stop messages” button. Sent by WhatsApp template because the client has not messaged first.
- **Media:** download WhatsApp media immediately after the webhook arrives, because media URLs are short-lived.
- **Guidance:** if a photo is too dark or blurry, ask for a retake straight away, with an example of a good photo for that job type.
- **Voice:** accept voice notes everywhere text is accepted; record key prompts in all three languages.

## 9. System architecture

```text
Users:     Artisan (WhatsApp) | Client (WhatsApp + web link)  | Verifier & field agent (mobile web) | Buyer / lender (web)
              |                        |                                   |                          |
Channels:  WhatsApp Cloud API        (SMS / USSD: later phase)             |                          |
              \________________________/                                   |                          |
Backend:   Webhook gateway -> Conversation engine -> Core API <-------------+--------------------------+
                                                         |-> Rules engine (levels, sampling, fraud)
                                                         |-> Public passport pages + QR (server-rendered)
                                                         |-> PostgreSQL (+ encrypted PII) / Object storage
                                                         '-> Job queue -> Media pipeline | AI worker -> ASR/LLM/vision APIs
                                                                        '-> Notification worker -> WhatsApp (outbound)
```

> Inbound messages flow down through the channel layer to the core API. Outbound messages (dashed line) leave through the notification worker.

| Component | Responsibility |
| --- | --- |
| Webhook gateway | Receives WhatsApp callbacks (SMS and USSD later); verifies signatures; deduplicates by message ID; queues processing |
| Conversation engine | Per-user state machine for onboarding, job logging and menus; session state in Redis with a TTL; resumes interrupted job logging |
| Core API | Business logic; REST API for verifier, field agent, buyer and admin dashboards |
| Rules engine | Passport level calculation, sampling selection, fraud rules; deterministic and unit-tested; thresholds stored as versioned configuration |
| Media pipeline | Downloads media, records metadata, strips metadata from public copies, creates thumbnails and compressed versions, computes perceptual hashes, checks quality |
| AI worker | Transcription, job structuring, competency suggestions, image checks (section 13) |
| Notification worker | Sends client confirmations and reminders by WhatsApp; artisan updates; delivery tracking |
| Public passport site | Server-rendered pages with caching; QR generation; Open Graph previews for WhatsApp sharing |

## 10. Technology stack

| Layer | Recommendation | Notes |
| --- | --- | --- |
| Backend | TypeScript, Node.js 20+, NestJS (or Express) | Shared language with web apps |
| Database | PostgreSQL 16 | Full-text search for the directory; add PostGIS later if location search needs it |
| Queues and cache | Redis with BullMQ | Media processing, AI jobs, reminders |
| Web apps | Next.js and Tailwind CSS | Public passport pages server-rendered; dashboards mobile-first |
| Object storage | S3-compatible bucket, private originals plus public compressed copies through a CDN | Signed URLs for private media |
| Image processing | sharp (resize, compress, metadata), a perceptual-hash library | Run in the media worker |
| WhatsApp | Meta WhatsApp Business Platform (Cloud API) | Verified business account and dedicated number |
| SMS and USSD (later phase) | Zimbabwean aggregator covering Econet, NetOne and Telecel | Not in the current build |
| Speech-to-text | Evaluate Whisper (supports Shona) and specialist African-language ASR providers | Test isiNdebele and trade vocabulary on real samples |
| LLM and vision | Hosted multimodal LLM API with structured (JSON schema) output and a zero-data-retention agreement | Job structuring and competency suggestions |
| QR codes | Server-side QR generation library | Include passport code under the QR |
| Monitoring | Error tracking, uptime checks, structured logs | Alert on media pipeline and WhatsApp delivery failures |

## 11. Data model

| Table | Key fields |
| --- | --- |
| artisans | id, passport_code, display_name, show_full_name, trades[], area_id, level, trust_score, status (active\|frozen\|deleted), language, experience_years, how_learned, gender (optional), disability (optional), public_badges[], joined_at |
| artisan_pii | artisan_id, full_name (enc), phone (enc), phone_hash, trusted_contact (enc, later) |
| areas | id, name (suburb), city, province, lat, lng |
| trades | id, code, name_en, name_sn, name_nd, active |
| job_types | id, trade_id, name, needs_before_photo, competency_unit_ids[] |
| competency_units | id, trade_id, code, title (per language), description, evidence_guidance, class_level, standard_ref, active |
| jobs | id, ref, artisan_id, trade_id, job_type_id, job_date, area_id, lat, lng, amount_charged, client_id, status, agent_assisted, agent_id, ai_summary (jsonb), public (bool), flags[], counted (bool), created_at |
| job_media | id, job_id, kind (photo_before\|photo_after\|video\|voice), original_key, public_key, thumb_key, phash, captured_at, quality_score, public (bool) |
| transcripts | id, job_media_id, language, text, confidence, model_version |
| clients | id, phone_hash, phone (enc), name, confirmations_30d, reports_count, opted_out |
| confirmations | id, job_id, client_id, channel (whatsapp\|agent; sms later), token_hash, sent_at, reminders_sent, response (confirmed\|disputed\|expired), rating, comment, responded_at |
| job_competencies | job_id, unit_id, source (ai\|verifier), confidence, status (suggested\|confirmed\|removed), reviewer_id |
| reviews | id, job_id, verifier_id, quality (meets\|needs_improvement\|reject), note_to_artisan, created_at |
| verifiers | id, name, phone (enc), trade_ids[], area_id, years_experience, conflicts (artisan_ids[]), status, approved_by |
| endorsements | id, artisan_id, verifier_id, trade_id, statement, created_at, withdrawn_at |
| buyers | id, org_name, type (business\|ngo\|household\|government), verified, contact (enc), plan |
| work_requests | id, buyer_id, artisan_id, description, area_id, preferred_dates, status (sent\|accepted\|declined\|expired), outcome (hired\|not_hired\|unknown), job_id |
| client_reports | id, artisan_id, client_id, reason, details, status |
| lender_consents (later) | id, artisan_id, lender_id, granted_at, expires_at, revoked_at; lender_access_log |
| level_history | id, artisan_id, from_level, to_level, reason, at |
| fraud_flags | id, entity (job\|client\|verifier\|artisan), entity_id, rule, severity, status, resolved_by |
| configs | version, params (jsonb: levels, sampling, fraud thresholds), active_from |
| audit_log | id, actor_id, action, entity, entity_id, at, details |

## 12. API endpoints

REST over HTTPS with JSON. Staff and buyers use JWT sessions; clients use signed one-time tokens.

| Method and path | Purpose | Roles |
| --- | --- | --- |
| POST /webhooks/whatsapp | Inbound artisan messages, media and status updates | Meta (signed) |
| GET /c/{token} | Client confirmation page | Client (token) |
| POST /c/{token} | Submit confirmation, dispute, rating, comment | Client (token) |
| GET /p/{passportCode} | Public passport page | Public |
| GET /p/{passportCode}/qr.png | QR code image | Public |
| GET /reviews/queue?trade= | Verifier queue | Verifier |
| POST /jobs/{id}/review | Submit quality rating and competencies | Verifier |
| POST /artisans/{id}/endorse | Endorse an artisan | Verifier |
| POST /agent/artisans | Enrol an artisan | Field agent |
| POST /agent/jobs | Log a job on an artisan’s behalf | Field agent |
| POST /media/upload-url | Signed upload URL (agent-assisted uploads) | Field agent |
| GET /directory?trade=&area=&level=&minRating= | Search artisans | Buyer, public (limited) |
| POST /work-requests | Send a work request | Buyer |
| POST /work-requests/{id}/outcome | Report whether the job happened | Buyer, artisan |
| GET /admin/flags?status= | Fraud review queue | Admin |
| POST /admin/flags/{id}/resolve | Clear or uphold a flag | Admin |
| CRUD /admin/trades, /admin/units, /admin/job-types | Manage competency frameworks | Admin |
| GET/PUT /admin/config | Levels, sampling, fraud thresholds (versioned) | Admin |
| GET /reports/pilot?from=&to= | Aggregate metrics | Admin |

### Example: AI job structuring output stored on the job

```
{
  "job_type": "solar_battery_inverter_install",
  "summary": "Installed a 3 kVA inverter and two 200 Ah batteries, wired DC isolator and breaker, tested output.",
  "tasks": ["mounted inverter", "connected batteries in series", "installed DC isolator", "tested system"],
  "materials": ["3 kVA inverter", "2 x 200 Ah gel batteries", "16 mm2 cable", "DC breaker"],
  "safety_measures": ["isolated supply before wiring"],
  "suggested_units": [
    { "code": "SOL-04", "confidence": 0.86, "evidence": ["photo_after_2", "transcript"] },
    { "code": "SOL-05", "confidence": 0.91, "evidence": ["photo_after_1", "transcript"] },
    { "code": "SOL-07", "confidence": 0.62, "evidence": ["transcript"] }
  ],
  "image_checks": { "quality_ok": true, "looks_like_trade_work": true, "possible_stock_or_screenshot": false },
  "model_version": "llm-x.y / prompt v3"
}
```

## 13. AI components

| Component | Input | Output | Guardrails |
| --- | --- | --- | --- |
| Speech-to-text | Voice note | Transcript, language, confidence | Low confidence: ask artisan to confirm a text summary |
| Job structuring | Transcript, job type, trade vocabulary | Summary, tasks, materials, safety measures (JSON schema) | Schema-validated; artisan sees and can correct the summary |
| Competency suggestion | Structured job, photos, unit evidence guidance | Units from that trade’s framework only, with confidence and evidence references | Suggestions only; never verified without a verifier |
| Image checks | Photos | Quality score, trade-relevance, screenshot or stock-image likelihood | Flags only, never automatic rejection |
| Next-level coach (later) | Passport status, missing units | Plain-language tips and short voice lessons | Reviewed content library, not free generation |

- Store model name, version and prompt version with every AI output.
- Build an evaluation set of at least 50 real jobs per trade, labelled by master artisans. Show AI suggestions to verifiers only once precision is at least 80% on that set.
- Send only job evidence and pseudonymous IDs to AI providers, never names or phone numbers.

## 14. Privacy, safety and compliance

### Privacy

- Artisans control what is public: each job and photo has a public flag (default public for photos without people; private if a person or a house number is visible).
- Phone numbers are never public. Buyers get contact details only after the artisan accepts a request.
- Client phone numbers are used only for job confirmation, stored encrypted with a hash for matching, and clients can opt out at any time.
- Gender and disability are optional, separately consented, and used only for aggregate reporting unless the artisan opts into a public badge.
- Lender access only with explicit, time-limited, revocable consent; every view is logged and notified.
- Artisans can delete their account; public pages go offline immediately and personal data is deleted within 30 days (anonymised statistics kept).
- Strip location metadata from all public images; keep the original metadata only in private storage for fraud checks.

### Artisan safety (especially young women working in clients’ homes)

- MVP: report and block a client; a client with 2 or more reports is blocked from confirming jobs and from work requests.
- Later: before a job, the artisan can share the job location and expected finish time with a trusted contact. If they do not check out by then, the trusted contact gets an alert.
- Buyers must give a name and phone number; verified business accounts are marked.

### Security controls

- TLS everywhere; role-based access enforced in the API; MFA for admin and verifier accounts.
- Signed, single-use, expiring client confirmation tokens; rate limits on confirmation pages and directory search to prevent scraping.
- Webhook signature verification and message-ID deduplication.
- Encrypted backups, audit log for admin actions and access to personal data, secrets in a vault, dependency scanning in CI.
- Security review before public launch of the directory.

### Regulatory checklist

| Requirement | Action |
| --- | --- |
| Cyber and Data Protection Act [Chapter 12:07] | Consent records, purpose limitation, data subject rights (access, correction, deletion) |
| Data controller licensing | Register/licence the operating entity with POTRAZ and appoint a Data Protection Officer |
| Cross-border data transfer | Confirm POTRAZ requirements before hosting outside Zimbabwe |
| Credit information (lender reports) | Before launching lender reports, check whether sharing work-history data with lenders falls under credit-reporting rules |
| Trade testing | Agree with the trade-testing authority how portfolios may be used; never claim official certification |
| Messaging | Opt-out on every client message; follow WhatsApp Business messaging and template policies |

## 15. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Speed | Client confirmation sent within 1 min of submission; AI processing complete within 5 min; WhatsApp replies within 3 s |
| Public pages | Load in under 3 s on 3G; page weight under 200 KB excluding lazy-loaded photos |
| Media | Compress photos to about 200 KB for public display; video capped at 60 s; originals kept privately |
| Data costs | Artisans should spend less than 5 MB of data per logged job |
| Availability | 99.5% monthly; queue and retry if WhatsApp or AI providers are down |
| Languages | Artisan and client content in English, chiShona and isiNdebele |
| Accessibility | Voice-first; field-agent mode for artisans without smartphones; screen-reader friendly web pages |
| Scale | MVP 500 artisans; designed for 50,000 artisans and 1 million jobs without redesign |
| Time zone and currency | Africa/Harare for display, UTC in storage; USD as integer cents |

## 16. Analytics and reporting

| Metric | Definition |
| --- | --- |
| Artisans enrolled | By trade, city, gender and disability (where consented) |
| Jobs logged | Total and per active artisan per month |
| Confirmation rate | Client-confirmed jobs / jobs sent for confirmation |
| Dispute and rejection rate | Disputed or rejected jobs / jobs logged |
| Time to level | Median days from joining to Bronze, Silver and Gold |
| Verifier turnaround | Median hours from job entering the queue to review |
| Flag rate | Flagged jobs / jobs logged, and share upheld after review |
| Work requests | Requests sent, accepted, and reported as hired |
| Income change | Self-reported monthly income at joining and at month 12 (short survey) |
| Trade tests | Artisans who sat and passed a trade test with a portfolio |

Track product events (artisan_joined, job_submitted, client_confirmed, client_disputed, review_completed, level_changed, passport_shared, passport_viewed, work_request_sent, work_request_accepted, hire_reported) with pseudonymous IDs only.

## 17. Testing and quality assurance

- **Rules engine:** table-driven tests for every level rule, level downgrades, sampling selection and each fraud rule, including edge cases (the same client for two artisans, re-confirmation after expiry, deleted accounts).
- **Media pipeline:** test with real WhatsApp photos, videos and voice notes from low-end phones; duplicate detection on resized and cropped copies.
- **Conversation flows:** end-to-end scripts for onboarding, job logging (including interrupted sessions), confirmation and work requests in all three languages.
- **AI:** evaluation set per trade (section 13); re-run on every model or prompt change.
- **User acceptance:** test sessions with 20 artisans and 5 verifiers across the five trades before the soft launch.
- **Security:** test token expiry and reuse, scraping protection, and role permissions.

## 18. Build roadmap

| Stage | Target date | Deliverables |
| --- | --- | --- |
| Setup | Week 1 | Repositories, environments, CI, Meta Business verification and WhatsApp number, database schema, draft competency lists for 5 trades |
| Pitch demo | By 3 Nov 2026 | WhatsApp onboarding; log a job with photos and a voice note; AI summary and competency suggestions; client confirmation on WhatsApp; public passport page with QR code. Test data only |
| MVP | End of pilot month 2 | Verifier queue and endorsements, levels, fraud rules, field-agent mode, basic buyer directory and work requests, report a client, admin tools; soft launch with 30 artisans |
| v1.1 | Months 4–7 | Trusted-contact safety feature, verified buyer accounts, hire tracking, Bulawayo configuration, isiNdebele voice prompts |
| v1.2 | Months 8–10 | Lender consent reports, buyer subscriptions and payments |
| v2.0 | Months 11–12 | Trade-test portfolio pack, next-level coaching content, Pro upgrade for artisans |
| SMS and USSD phase | After MVP (date to set) | SMS and USSD channel adapters for artisans and clients with basic phones; SMS fallback for client confirmation |

## 19. Open decisions

| Decision | Options or next step |
| --- | --- |
| Official unit standards | Obtain trade-test unit standards for the 5 trades and confirm the responsible testing body |
| Level thresholds | Validate defaults with master artisans and 3–5 buyers |
| SMS and USSD phase | Aggregator choice, shortcode, cost, coverage; timing after the pilot launch |
| Hosting region | Depends on POTRAZ cross-border guidance |
| Speech-to-text vendor | Benchmark on real voice notes with trade vocabulary |
| Verifier payment | Rate per review and payout method |
| Public amounts | Keep amounts charged private (default) or allow artisans to show price ranges |
| Short domain | Register a short domain for passport and confirmation links |
| Buyer pricing | Per-hire fee vs. monthly subscription; test with pilot buyers |
