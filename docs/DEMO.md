# Pitch demo — 4 minutes

Everything runs offline on one laptop with the mock adapters. Rehearse twice; the script below matches the seed data.

## Before you start (5 minutes ahead)

```bash
docker compose up -d && pnpm dev     # or your own postgres + redis, see README
pnpm demo:reset                      # clean demo state; prints the demo logins
```

Open three browser tabs:

1. **http://localhost:3000/dev/chat** — artisan phone `+263770000201`, client phone `+263770000301`, live passport
   panel on the right. Zoom the browser to 90% on a 1440 px screen so all three columns fit.
2. **http://localhost:3000/p/SP-HRE-00001** — Tendai's Silver passport (the "after a few months" view).
3. **http://localhost:3000/login** — click "Verifier · solar", Continue, "Development: fill the current code", Sign in.

Tip: replace the drawn sample photos in `fixtures/photos` with real (consented) artisan photos before a live pitch.

## Script

**0:00 — The problem (20 s).** "Nyasha installs solar systems in Glen View. She's good, but she has no certificate,
and nothing a buyer or a bank can check. Every job she finishes disappears. Skills Passport turns that work into a
record."

**0:20 — Onboarding on WhatsApp (50 s).** In the artisan phone type **Hi**.
- Tap **English** → type **1999** → **Yes** → **I agree** (mention "Listen instead" plays the consent as a voice note).
- Name: **Nyasha Chirwa** → Menu → **Solar PV installation** → **Continue** → **Harare** → Menu → **Glen View** →
  **3–5 years** → **Apprenticeship** → **Skip** → **Skip**.
- The passport number **SP-HRE-00003** appears, and the passport panel on the right shows the new, empty passport.
  "Starter level. No app, no account, three languages."

**1:10 — Log a job (60 s).** Tap **Log my first job** → Menu → **Battery and inverter installation**.
- Paperclip → **solar-inverter-before** → **Done** → paperclip → **solar-inverter-after** → **Done**.
- Paperclip → **voice-note-solar** (point out: "voice-first — she explains in her own words").
- Client: **Mai Rufaro** → **077 000 0301** → **Today** → **Yes** → **Skip** → **Skip** → **Submit**.
- Within seconds: the artisan sees the draft description ("Installed a 3 kVA inverter and two 200 Ah gel batteries…")
  with **Looks right / Fix it**. "AI is invisible infrastructure: it drafts, people decide."

**2:10 — The client confirms (30 s).** The **client phone** has received the template message with three buttons.
Tap **Yes, it was done**. The client gets a thank-you with a rating link; the artisan gets "Good news… 2 more jobs from
new clients to reach Bronze." The passport panel now shows 1 confirmed job.
Optional: click **Client rating page** above the passport panel to show the 1–5 star page.

**2:40 — Trust (40 s).** Switch to the verifier tab: the review queue (J/K to move, 1/2/3 to rate). Open Rudo's flagged
job: "Duplicate photo — this picture was already used on an earlier job." "Every photo is fingerprinted; a client's
number can't be the artisan's own; one client can only count twice a month. Master artisans review the first jobs of
every artisan and every flagged or disputed job."

**3:20 — The passport (40 s).** Open Tendai's passport (tab 2): ink document header, Silver level, 8 confirmed jobs
from 7 clients, 4.6 rating, the work gallery, competency units verified vs pending, Farai's endorsement with the seal,
the QR code. Switch to **chiShona**. "This link goes on WhatsApp Status, on a printed QR card on the workshop wall, to
a buyer or a lender. It never shows her phone number, where she lives or what she charged. And it's useful from the
very first confirmed job."

**4:00 — Close.** "Five trades, Harare and Bulawayo, 30 artisans in the soft launch. WhatsApp is live-ready: switch the
adapter on and submit the templates in docs/WHATSAPP_TEMPLATES.md."

## If something goes wrong

- Nothing happens when you tap: check `pnpm dev` shows the **worker** running (it processes WhatsApp messages).
- Start again: **Clear chats** in the simulator header, or `pnpm demo:reset` for the whole database.
- Show "client not on WhatsApp": tick **Not on WhatsApp** above the client phone before submitting a job — the artisan
  is told a field agent will call, and a follow-up task appears for agents at `/agent`.
