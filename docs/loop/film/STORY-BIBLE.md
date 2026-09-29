# Loop Soul: the story bible

Recoolman's flight through the album, chapter by chapter. This is the album's
book of the Recoolman canon. The canon itself is law and lives in the Game
folder; where the two meet, the canon wins.

- The canon: `~/Documents/Apps/Game/game/docs/CANON.md` (see its section
  "Loop Soul, the album's book", recorded 2026-09-29), `WORLD_BIBLE.md`,
  `docs/story/`, `ART_DIRECTION.md`.
- The living data: D1 `loop_film_chapters`, `loop_film_cards`,
  `loop_film_world` (migration 168), edited at /loop/admin/film. This file is
  the plan; the admin page is the truth once a chapter is approved.

## What is decided

1. **Mitus Young History is Recoolman.** As Jacob is Israel. The name is given,
   after a wrestle.
2. **The badge sits on the heart.** A circumcision of the heart (Deuteronomy
   30:6, Romans 2:29). It comes to no one unless God orchestrates it. It is the
   mantle of the succession.
3. **The Game is his own shadow on the ground.** Adam was taken from the ground
   (Genesis 2:7). The shadow is his earthly self; The Game pulls through it. In
   the film it is a cast shadow at his feet: in step, or lagging.
4. **The album is a flight through life.** Welcome is the incarnation; its end
   is the take-off, where the game Soul Loop begins; Ghost World ends it.
5. **He is never named.** Everyone knows who we mean. Not in the film, the
   cards, the flips, the chapters, the captions or the pages. Enforced in code
   (`src/lib/loop/film/naming.ts`): approval refuses it.
6. **Adventure Time's world-building, kept minimal.** Shown, never explained.
   Each clip is an episode that stands alone; the lore accumulates; the world
   page grows one entry at a time as chapters are revealed.
7. **Stewardship.** Every chapter, card and world entry is faith content.
   Nothing reaches a guest until the owner approves it.

## The chapters

The shape is measured from the masters (`npm run film:listen`,
`data/loop/film/shape.json`): loudness across the song, the estimated tempo
(two readings where the audio cannot tell them apart), and the second where the
song lets go. No lyrics are on file yet; the rows marked "From the lyrics" wait
for the transcription and the owner's corrections.

| # | Song | Shape | BPM | Lets go | Beat |
|---|---|---|---|---|---|
| 1 | Welcome | `▆▇▇▇▇▇▇▇▇▇█▇▇▆▆ ` | 117.5 | 58s | **The incarnation.** He rises from the ground and his shadow: a living soul out of the dust. The badge lands on his heart as the song lets go, and he takes off. Soul Loop begins here. |
| 2 | 1984 | `▆▆▇█▇▇▇▇▇▇▇▇▇▇▇▆` | 80.7 | 263s | Draft: The Game's culture. His shadow lags a beat behind him. |
| 3 | Hallucinogen | `▅▆▇▇▇▇▇▇█▇▇▆▇▇▆▆` | 73.8 | 217s | From the lyrics. |
| 4 | The No End Theory | `▆▇▅▆▆▄▄▇▇▆▇█▇▆▂ ` | 129.2 | 26s | From the lyrics. |
| 5 | In The Court | `▅▆▆▇▇▇▇▆▇█▇▇▇▇▇▆` | 80.7 | 216s | From the lyrics. |
| 6 | News Peak | `▄▆▆▇▇▇▇▇▇█▇▇▇▇▆▆` | 99.4 | 321s | Draft: the highest altitude, and The Game's strongest pull. The shadow lags. |
| 7 | Every Generation | `▇▇▇▆▇▇▇▇▇▆▆█▅▄▂ ` | 83.4 | 25s | Draft: the mantle passes (WORLD_BIBLE Law 8). |
| 8 | Rap | `▄▅▆▇▇▇▇▇▇▇▇▇▇█▇▆` | 89.1 | 207s | From the lyrics. |
| 9 | Makunahea | `▅▅▆▆▆▇▆▇▇█▇█▇▆▅▂` | 117.5 or 89.1 | 142s | From the lyrics. |
| 10 | The Other Side | `▆▇█▇▇█▇▃▅▆▇▇▇▇▇▅` | 99.4 | 301s | Draft: the crossing, at the near silence. |
| 11 | The Mind Pt 1 | `▅▅▆▇▇▇▇▇▇▇█▇▆▆▅▂` | 129.2 | 354s | Draft: the Echo Chamber's Mind layer, the wrestle. The shadow lags. |
| 12 | Midnight Marauders | `▇▇▆▆▇▆▆▇▇▆▆█▆▅▂ ` | 123.0 or 83.4 | 26s | From the lyrics. |
| 13 | The Mind Pt 2 | `▅▅▆▆▆▆▆▇▇▆▆▆▇█▆▅` | 89.1 | 233s | Draft: coming out of the Mind. |
| 14 | Ghost World | `▆▇▇▇▇▇▇▆▆▇▇█▇▇▇▄` | 86.1 or 68.0 | 270s | **Only through Him.** Never named, unmistakable. Draft: the shadow falls back into step with him. |

## The look, per chapter

- A flat field colour per chapter. The default walks the hue wheel once from
  sand (Welcome, the dust) to Ghost World, which lands back beside it: the
  colours close the loop. `src/lib/loop/film/palette.ts`.
- Ink figure always (he is the same person); the highlight cuts are the cover's
  own relationships to the field; the badge is always warm white.
- His shadow: in step (one with the ground), lagging by a beat (The Game
  pulling), or none. Seeded: lagging in 1984, News Peak and The Mind Pt 1.

## How a chapter gets written

1. `npm run film:transcribe` puts the machine's hearing of the words beside the
   chapter in admin. The owner corrects them and saves them to the song.
2. From the corrected words, the canon and the shape, a thread is drafted: a
   line or two, where Recoolman is. Shown, never explained.
3. The owner corrects the thread, sets the emotion words, and picks verses from
   the KJV search (a verse that names Him is never offered). He trims each
   verse to the part that lands and writes his flip.
4. Approve. Reveal when the chapter's clips go out.

## The world page

A sparse map at /recoolman: a name and one line per entry, shown when its
chapter is revealed, a silhouette until then. Seeded drafts: Recoolman, the
badge, the ground, the flight, the shadow, Ghost World.
