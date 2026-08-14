# Loop Soul — brand language

Locked 2026-08-11 · **revised 2026-08-14 (the Come Dance revision).** Use these
exactly; don't paraphrase them.

## The slogan

> **Come Dance**

Two words, **mixed case**, no punctuation. The invitation is the brand.

The casing is a deliberate exception: every other line in the system is caps —
the triad, the credits, the dates. This is the one line that *invites* instead
of *announces*, and being the only non-caps line on a piece is what makes it
read as a voice rather than a heading. Never set it in caps on artwork, and
never let anything else on the piece go mixed case beside it.

## The anthem phrase

> **What we dancin' to**

This was the slogan until 2026-08-14; it is now the **Soul Loop Anthem's**
phrase — the question the tournament exists to answer — and appears only where
the anthem speaks.

No closing punctuation, ever. Said aloud it is also **"what we dance into"** —
so it lands as a question *and* a statement at once, and it means several
things simultaneously: what's playing, what we're moving to, what we're walking
into together. **The ambiguity is the line's whole job** — never "clean it up"
to "What are you dancing to?" or add a question mark.

## Where each line may appear

| Line | Lives on |
|---|---|
| **Come Dance** | Event posters · the ticket · the pass card · the app front door (`/loop`) · the OG share card · primary merch |
| **What we dancin' to** | The Soul Anthem module in the app · tournament promo posters · secondary merch pieces |
| **"That's how we do it."** | Spoken only — the host's line, the end of a post. Never set on artwork |

This table is the locked decision. If a line isn't listed for a surface, it
doesn't go there.

## The arc

> **The arc asks; straight type states.**

- **Straight type** is the event family's device: the slogan on posters, the
  ticket, the pass card, and the app's front door is always set straight.
  (The arc "fought the letterforms at every size and never looked deliberate"
  on the event poster — that finding stands.)
- **The arc** is the tournament family's device: it carries *What we dancin'
  to* on tournament promo posters and on the anthem's in-app screens, where a
  question-shaped line earns a question-shaped setting.

Never arc the slogan. Never straighten the anthem phrase on tournament artwork.

## Album artwork — the colour exception

Loop Soul artwork is two colours: sand field, ink figure. **Album artwork is
the one exception** — it appears in **full colour**, because recognisability is
the entire point of showing it. It is quoted material, and it is always set
inside a **1px ink keyline**. Nothing else in colour, ever.

## The catchphrase

> **"That's how we do it."**

Spoken, not set on artwork. Nike is *Just do it*; Loop Soul is *That's how we
do it*.

## The triad

> **MUSIC · MODE · MOVEMENT**

Set in caps, widely tracked, separated by middots. Appears on posters and the
ticket. Unchanged.

## Typography

**One typographic voice per piece.** The `loop∞Soul` wordmark SVG is the only
script — it *is* the logo.

Artwork (posters, ticket, pass card, OG card) sets in **Jost** — a free,
open-licence Futura interpretation, committed to the repo so print and app
render byte-identically. This is the **interim answer to the doc's Futura
intent**: if a Futura licence is bought later, the swap is a font-file
replacement plus a metrics regeneration, nothing more. App **UI chrome** stays
in Inter. Never Avenir Next — it lived only on one laptop and was never a
decision.

## Credits — always this hierarchy

- **PRESENTED BY** → Odubo
- **IN PARTNERSHIP WITH** → Scott's Inn & Suites, **black mark only** (never
  the colour logo)

Venue *text* ("Scott's Inn, Kamloops") still appears wherever the location is
named; that's information, not branding. Never "VENUE PARTNER" as a credit
label on artwork.

## Palette

Sand `#d9aa7a` field, ink `#2a0f0a` figure and type, sand-bright `#f0d3ad` for
cut highlights. Print artwork is RGB; convert at the shop if they want CMYK.

## Where this lives in code

- Brand constants (colours, both lines, triad, credits, font, the measure):
  `src/lib/loop/brand.ts` — the single source both renderers read.
- The layout engine (every piece, both runtimes): `src/lib/loop/poster/layout.ts`
  — pure display lists; the renderers (`poster/render-canvas.ts`,
  `scripts/loop/poster-render-sharp.ts`) never make a layout decision.
- Print/batch artwork: `npm run loop:posters` (`scripts/loop/poster-kit.ts` —
  posters, ticket, pass card, and the live-anthem tournament piece).
- Merch elements: `npm run loop:merch` (`scripts/loop/merch-kit.ts` — Jost
  outlines, same pipeline as the posters).
- Tournament mapping (anthem state → poster): `src/lib/loop/poster/tournament.ts`.
- In-app Poster Studio: `src/app/loop/admin/posters/PosterStudio.tsx` over
  `src/lib/loop/poster/compose.ts`.
- App poster (front door): `src/components/loop/gathering/GatheringPoster.tsx`.
- The arc device (app): `src/components/loop/brand/ArcedTagline.tsx`.
