# Loop Soul — recolouring the poster from electric green to the house palette

**Date:** 2026-08-09
**Scope:** `/loop` (the Loop Soul hub merged in PR #2), `.loop-theme` in `globals.css`

## Decision

The Loop Soul surface shipped with an invented electric-green identity
(`--color-electric: #00e170`) that had no relationship to Odubo's brand. It now
uses the palette of the actual Loops Soul poster, sampled from the mark:

| Was | Now | Role |
| --- | --- | --- |
| `--color-electric` `#00e170` | `--color-sand` `#d9aa7a` | the field (poster mode) / the ink (vault mode) |
| `--color-electric-bright` `#2bff8f` | `--color-sand-bright` `#f0d3ad` | raised surfaces, primary pose action |
| `--color-electric-deep` `#00a854` | `--color-sand-deep` `#9c5f3c` | muted type and tints on the field |
| `--color-ink` `#050505` | `--color-ink` `#2a0f0a` | type, buttons, vault field — now warm oxblood, not neutral black |
| `--color-ink-soft` `#121212` | `--color-ink-soft` `#3d1a12` | secondary ink |
| — | `--color-wine` `#843c2d`, `--color-wine-deep` `#502d26` | house terracotta, available for accents |

Token *names* were renamed too (`electric` → `sand`, 60 utility usages across 26
files). Leaving a token called `electric` holding a sand value is the kind of
debt that misleads the next reader; the rename is mechanical and grep-verifiable.

## Why the field is sand and not wine

The brief asked for "off-wine reddish brown". The field is the one place that
request cannot be honoured literally, and it is worth writing down why.

The poster's whole mechanic is flat black silhouette artwork on a bright field —
pop-art contrast. Electric green held roughly **12:1** against black. Sand holds
about **10:1**, so the poster keeps its punch. A wine field (`#843c2d`) would
land near **2:1**, and the crowd silhouettes — the single most recognisable
asset — would sink into the background and read as mud.

So the reddish brown moves to where it does work: it is the **ink**. Type,
buttons and the Get Pass pill are now warm oxblood, and the vault/Legacy mode
flips to a full oxblood field with sand ink. That is also the arrangement of
the real Loops Soul poster — sand ground, dark wine script, black figure — so
the surface now matches the printed artefact rather than diverging from it.

## Glassmorphism

Added `.loop-glass`, tinted from the field it sits on so one class works in both
modes, with an opaque `@supports` fallback for in-app browsers. Applied to the
things that float — `GetPassModal`, `ModuleSheet`.

Deliberately **not** applied to the poster itself. The poster is a flat print;
blurring it would undo the contrast the whole design rests on. Glass is for
what sits above the print, not the print.

## The artwork had green baked in

Recolouring tokens alone was not enough, and this only showed up on a rendered
screenshot. The crowd artwork is not a flat silhouette — the figures carry
green-tinted shadows and pattern fill, and the five poster prints have the
green field baked into the image. Against a green page these were invisible;
against sand they read as murky green patches.

`scripts/loop-recolour-artwork.js` fixes both, with two different treatments
because they are two different kinds of asset:

- **`public/loop/posters/*`** — duotone, normalised so the brightest tone (the
  field) lands on sand and the darkest (the silhouettes) lands on ink, which
  preserves every tonal relationship in between.
- **`public/loop/figures/*`** — transparent cut-outs that must stay dark, so no
  normalisation. The green channel carries the tone in the source, so it
  becomes red, and the remainder is damped to keep the result warm brown rather
  than magenta.

Side benefit: re-encoding with a palette dropped the eight assets from ~8.9MB
to ~1.1MB, which matters on a page designed to be opened on phones at a venue.

## Not covered

- `/loops-soul` — a separate, older Moments-based episode layer with its own
  brand surface, currently unmerged on `feat/loops-soul-brand`. Two parallel
  Loop Soul implementations now exist in this repo and want reconciling.
- The pose studio's generative prompts and LUT constants were recoloured to
  match, but the stylizer output has not been re-checked on a device.
