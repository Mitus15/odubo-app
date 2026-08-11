# Loop Soul — brand language

Locked 2026-08-11. Use these exactly; don't paraphrase them.

## The slogan

> **WHAT WE DANCIN' TO**

No closing punctuation, ever. Said aloud it is also **"what we dance into"** —
so it lands as a question *and* a statement at once, and it means several
things simultaneously: what's playing, what we're moving to, what we're walking
into together. **The ambiguity is the line's whole job** — never "clean it up"
to "What are you dancing to?" or add a question mark.

## The catchphrase

> **"That's how we do it."**

Spoken, not set on artwork. It's the thing the host says all night and the
thing that ends a post. Nike is *Just do it*; Loop Soul is *That's how we do
it*.

## The triad

> **MUSIC · MODE · MOVEMENT**

Replaces the older "Music / Dance / Fashion". Set in caps, widely tracked,
separated by middots. Appears on posters and the ticket.

## Typography

**One typographic voice per piece.** The `loop∞Soul` wordmark SVG is the only
script — it *is* the logo. Everything else is a single geometric grotesque
(print: **Futura**; app: **Inter**), set in caps and tracked for the small
lines. Two competing cursives was the mistake in the early drafts.

## Credits — always this hierarchy

- **PRESENTED BY** → Odubo
- **IN PARTNERSHIP WITH** → Scott's Inn & Suites, **black mark only** (never
  the colour logo)

Venue *text* ("Scott's Inn, Kamloops") still appears wherever the location is
named; that's information, not branding.

## Palette

Sand `#d9aa7a` field, ink `#2a0f0a` figure and type, sand-bright `#f0d3ad` for
cut highlights. Print artwork is RGB; convert at the shop if they want CMYK.

## Where this lives in code

- Print artwork: `scripts/loop/print-artwork.mjs` (regenerates posters + ticket
  from one `EVENT` block — change the date/price/theme there and re-run).
- App poster: `src/components/loop/gathering/GatheringPoster.tsx`.
- Poster Studio default line: `src/app/loop/admin/posters/PosterStudio.tsx`.
