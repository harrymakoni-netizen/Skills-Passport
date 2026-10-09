# Design system

Implements the "Design standard" in `CLAUDE.md` and the approved direction in `docs/PLAN.md` §5.
Tokens live in `packages/ui/src/tokens.css` (Tailwind v4 `@theme`); components in `packages/ui/src`. Every
component and state is on `/dev/design`.

## Concept — the passport is a document of record

Warm paper surfaces, deep ink, hairline rules, a serial-number passport code, one fine engraved-line (guilloche) band on
the passport header, and a precise circular seal for endorsements. The only imagery is the artisans' own work photos.
Nothing decorative competes with the evidence.

## Tokens

The Tailwind default palette, type scale, radii and shadows are **cleared** (`--color-*: initial` etc.), so only the
tokens below can be used.

| Group | Tokens |
| --- | --- |
| Ink | `ink-950 #082A20`, `ink-900 #0E4334` (primary), `ink-800`, `ink-700 #2F6B4F`, `ink-300`, `ink-100 #E3ECE7`, `ink-50` |
| Paper | `paper #F7F4EE` (background), `raised #FFFFFF` (surfaces), `sunk #EFEBE2` |
| Lines and text | `rule #DDD6C8`, `rule-strong #C8BFAE`, `text #141414` (16.8:1), `muted #5E6660` (5.4:1), `faint #8A8F8A` (non-essential only) |
| Accent (the only one) | `accent #9A5419` (5.2:1 on paper), `accent-50`; `accent-mark #E16E18` = logo orange, marks only |
| Levels | `bronze #8C5A2B`, `silver #6B7176`, `gold #8A6A1F` + `-50` tints — flat, never shiny or yellow |
| Status | `success #2F6B4F`, `warning #8A6A1F`, `danger #9B2C2C` + `-50` tints |
| Radius | `sm 4px` (inputs, badges), `md 6px` (buttons), `lg 8px` (panels) |
| Shadow | one: `overlay` for dialogs, toasts and the simulator phones. Surfaces use hairlines. |
| Motion | 150–200 ms `ease-out` (`fade`, `rise`); disabled by `prefers-reduced-motion` |

## Type — three families, six sizes

| Family | Use | Why |
| --- | --- | --- |
| Fraunces 600 | Artisan names, page titles, section titles | Engraved, slightly old-style serif with the gravity of an official document |
| IBM Plex Sans 400/600 | UI and body | Precise and institutional; very legible on low-end Android screens |
| IBM Plex Mono 500 | Passport codes, job refs, figures | Serial-number feel, tabular figures |

All self-hosted with `next/font/local`, Latin subset, 84 KB total (`packages/ui/fonts`, OFL).

| Token | Size | Use |
| --- | --- | --- |
| `text-xs` | 12/16 | Labels, small caps, table meta |
| `text-sm` | 14/20 | Dashboard body, table cells |
| `text-base` | 16/24 | Public body, inputs (no iOS zoom) |
| `text-lg` | 20/28 | Section headings |
| `text-xl` | 28/34 | Page titles, key figures |
| `text-display` | clamp(40 → 56) | Artisan name on the passport, landing headline |

Utilities: `.smallcaps` (12 px, 0.14 em tracking, uppercase, 600), `.serial` (mono, 0.08 em, tabular),
`.tabular`.

## Components

`Button` (primary · secondary · ghost · danger; sm 36 · md 44 · lg 48 px), `Field` + `Input` / `Textarea` / `Select` /
`Checkbox` (labelled, hint or error text, `aria-invalid`), `Badge` (neutral · ink · success · warning · danger · accent),
`LevelBadge` (engraved rim, small caps, light and dark variants), `Seal`, `PageHeader`, `Panel`, `Stat`, `Table` / `TH`
(sortable) / `TD`, `Skeleton`, `EmptyState`, `ErrorState`, `PassportHeader`; client components `Tabs`, `Dialog`
(native `<dialog>`: focus trap, Escape), `ToastProvider` / `useToast`.

## Page patterns

- **Passport `/p/[code]`** — ink header with guilloche, name in display serif, level badge, serial code; three figures
  on hairlines; work gallery (first photo large) with a full-screen viewer; competencies ruled list with verified /
  pending status and progress line; endorsements with seal; QR and share; "how this passport is checked".
  Language switch is plain links (no JS). Never shows phone, exact location, amounts, client details or disputes.
- **Client page `/c/[token]`** — single column, one question, two large answer buttons, 1–5 stars as 48 px targets,
  optional comment, clear done state. Works without an account.
- **Dashboards** — calm and dense: sidebar on desktop, disclosure menu on phones, tables with sorting and filters,
  every list with designed loading, empty and error states. Verifier queue has J/K, 1/2/3, Ctrl+Enter, E and `?`.

## Avoid-list check

No gradients except photo caption scrims, no glassmorphism, no emoji in the product UI, no "AI-powered" labels (AI
output is labelled "Draft summary" / "Suggested"), no generic hero copy or exclamation marks (a test fails if the
catalogue's English contains "!"), no rows of identical icon cards, no stock imagery or illustrations of people, one
accent colour, six type sizes.

## Accessibility

WCAG 2.2 AA contrast for all text tokens on paper and raised surfaces; visible `:focus-visible` outline in ink;
labelled fields; 44 px minimum touch targets for primary controls; `aria-pressed`, `aria-current`, `role="radiogroup"`
where relevant; `prefers-reduced-motion` respected.
