# 2026-08-14 — Come Dance: the slogan, the one poster engine, the tournament family

The epiphany: **"Come Dance" is the slogan.** "What we dancin' to" is the Soul
Anthem's phrase — demoted to anthem surfaces and secondary merch. That word
split unravelled into the poster consolidation the owner had already noticed
("why does this page have different posters?") and resolved the orphaned arc
design: **the arc asks; straight type states** — so the arc belongs to the
tournament family, whose whole subject is a question being answered.

## Shipped (four PRs, all merged to main)

- **#34 — Stage 0, the words.** Brand doc rewritten (slogan/anthem-phrase
  split, where-each-may-appear table, arc rule, artwork colour exception,
  Jost). Live bugs fixed: AnthemBracket phrasings, the OG image (the link
  preview every shared /loop URL renders).
- **#35 — Stages 1+2, one engine.** `src/lib/loop/brand.ts` (single brand
  source + committed per-char advance table); Jost 500/700 statics committed
  (instanced from google/fonts variable TTF — upstream statics have broken
  family names); `src/lib/loop/poster/layout.ts` (pure display-list engine:
  event poster, ticket, pass card, `withBleed`); two dumb renderers — canvas
  and sharp, the latter drawing text as opentype.js glyph outlines because
  sharp/macOS resolves fonts via CoreText and ignores fontconfig entirely.
  `poster-kit.mjs` → `poster-kit.ts` on the shared engine.
- **#36 — Stages 3+4, tournament + full studio.** `layoutTournament` (grid /
  seed wall / pairs / hero bands in quoted album artwork, 1px ink keylines,
  arc carrying the anthem phrase) + `tournamentSpec` mapper (gate gates
  suggesting never voting; print absolute dates, story/feed relative; 0–0 →
  neutral hairline; "" artwork → keylined text tile; artUrl 600→1500 for
  print). PosterStudio: piece switch (Event · Tournament · Ticket · Pass
  card), crowd figure, slogan select, triad toggle, session-only detail
  overrides (marked + resettable, never persisted), live-anthem tournament
  piece, error state keeps last good preview, SecurityError by name.
- **#37 — Stage 5, kit parity.** `--pieces=tournament` (fetches the live
  anthem from the deployment; offline skips loudly); merch kit ported to
  Jost outlines (`npm run loop:merch`); anthem-phrase.png/-stacked.png added
  so printer files named slogan.png don't silently change meaning.

## Bugs the new test suite caught on its first run

1. **Slogan caps dug 10px into the hero band** — baseline placed without cap
   height. Invisible to the eye (figure PNGs have sparse bottom pixels).
2. **Feed (4:5) could not lay out at all** with full details — the kit had
   only ever rendered print+story. Fixed with the air squeeze: six inter-row
   gaps shaved by one exactly-computed factor; print/story unchanged (air=1).

## The war story (preserved in code comments)

opentype.js 2.0's lazy glyph parser emits **nondeterministic NaN coordinates**
— same inputs clean in isolation, corrupt in a real run — and librsvg answers
an invalid path token by silently discarding the rest of the path. That is how
a poster once rendered as a giant "Co" with eight letters missing. Fixes:
pinned opentype.js@1.3.4 AND `glyphPathData` NaN-validates every glyph
permanently. `assertFontResolves()` also fails loudly if the committed metrics
table drifts >1% from the shipped fonts.

## Regenerated asset folders (outside the repo)

- `~/Documents/Loop-soul-the-entertainment-room/tapstitch-2026-08/` — eleven
  files × two colourways in Jost, README updated (ceilings, mixed-case slogan
  rule, anthem-phrase punctuation rule).
- `~/Documents/Loop-soul-the-entertainment-room/print-2026-08/` — 3 figures ×
  3 sizes + print bleeds, ticket + its first-ever bleed file, pass card,
  anthem piece at all sizes from the live production state.

## Verified in production

- OG image serves Jost "Come Dance" (public).
- `/api/loop/anthem` live (stage nominating, gate open) — feeds the app and
  both tournament renderers.
- Admin studio exercised locally against production D1 data (all four pieces);
  prod admin itself is behind LOOP_ADMIN_PASSWORD.

## Next steps / open threads

- Tap Stitch merch → upload from the regenerated pack; create the loop-soul
  Shopify collection when garments exist.
- Scott's to confirm capacity 60 (poster "60 PASSES" reads from live capacity).
- Cloudflare Pages GitHub check still failing on every PR — owner intends to
  disconnect the integration in the CF dashboard ("dont need pages").
- Wall: camera originals upload (2nd asset per row) still pending from the
  moments consolidation thread.
- Anthem needs nominations — the tournament poster currently (honestly) reads
  THE FLOOR IS OPEN.
