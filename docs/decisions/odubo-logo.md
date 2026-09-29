# The Odubo logo

**Decided 2026-09-29 by the owner.** ODUBO, set in Libre Baskerville Bold,
over the danceman. One colour, the house oxblood `#843c2d`.

## Why

The MadisonSquare Incised lockup (the posters' ODUBO since August) had "too
much of its own personality to properly complement the danceman". The brush
ODUBO on the site had the same problem the other way round: a big hand-drawn
word with the dancer as a speck under it. In both, the word was the logo and
the dancer was decoration.

Now the dancer is the logo and the word names him. Libre Baskerville is the
face the owner already works in, so the name reads in the same voice as the
rest of the house type.

## The files

| File | What | When |
|---|---|---|
| `public/brand-logos/odubo-brand/odubo-lockup.svg` | ODUBO over the danceman, 0.87:1 | Anywhere it can be **96px tall or more**, and in credits where the word must be read |
| `public/brand-logos/odubo-brand/odubo-mark.svg` | The danceman alone, 0.79:1 | Headers, modals, icon tiles: anything smaller |

Code never hardcodes these paths: `src/lib/brand/marks.ts` exports
`ODUBO_LOCKUP` and `ODUBO_MARK` (plus their aspect ratios). The poster engine's
`ODUBO_SRC` is `ODUBO_LOCKUP`.

**The size rule.** Most of the lockup's height is the dancer; the word's cap
height is 13% of the whole. Under ~96px tall the word drops under 12px and
stops reading, so the dancer goes alone. He is the house mark on his own (see
the brand architecture: the stickman is the house mark).

Exception, by design: a credit ("presented by") needs the name, so it keeps
the lockup a little smaller than 96px when the type around it is smaller still.
The /loop playbill footer runs it at 64px under 9px type.

**Colour.** Both files ship oxblood with the fill on the root `<svg>`, so the
poster engine recolours them to ink the same way it did the old marks. On a
web surface that is set in another colour (the /loop playbill is ink on sand),
draw it through a CSS mask in `currentColor` rather than making a second file.

## Rebuilding

`python3 scripts/brand/build-odubo-lockup.py` (needs `pip install fonttools`).
The font (v2.005, OFL) is committed beside it in `scripts/brand/fonts/`. Every
number (weight, cap ratio, tracking, gap) is a named constant at the top; change
it there and rerun, never by hand in the SVG. The script reproduces the shipped
files byte for byte in geometry.

The adopted values: weight 700, cap height 17% of the dancer's height, tracking
+170/1000 on top of the font's own kerning (O-D and D-U), baseline to the
dancer's top 0.65 cap heights, dancer centred on his ink centroid (0.6% right of
his box centre).

## Alternatives considered

- **Regular (400).** More Baskerville at large sizes, but thin beside a heavy
  pictogram and spindly under ~90px. Bold carries ink closer to the dancer's.
- **A bigger word (cap 20 to 24% of the dancer).** Reads as a masthead with a
  figure under it, which is the old hierarchy again.
- **Gap 0.5 / 0.8 cap.** 0.5 crowds the right foot into the B; 0.8 lets the two
  drift apart. 0.65 holds them as one mark.
- **A wordmark-only or horizontal lockup for small spaces.** Not made. The
  dancer alone already does that job and is what the house mark is.

## What was retired

- `public/loop/branding/odubo-2026.svg` (MadisonSquare) and
  `public/brand-logos/odubo-brand/odubo.svg` (brush) are no longer referenced.
  They stay on disk as the owner's source artwork.
- `Danceman_Logo_Red.png` keeps every use it had (emails, schema.org, footers,
  admin): it was already the dancer alone at small sizes, which is the rule.
  It must stay on disk forever regardless, because sent emails point at it.
