# Loop Soul is the album

Decided 2026-08-24. This is the doc the other Loop Soul decisions now hang off.
Where an older doc calls Loop Soul "a recurring event", read it through this one.

## The statement

> **Loop Soul is an album by Mani Odubo. Thirteen tracks.**
> **A volume is that album brought into a room.**

Not an event with music attached. Not a party with a record for sale afterwards.
The music, the night, the app, the filter, the magazine and the merch are all
surfaces of one work.

## Why this had to be written down

The codebase said the opposite. `LoopEvent`, `EventPhase`, `event_codes`, "your
event code" — *event* was the load-bearing noun everywhere, and the word *album*
appeared six times across the entire Loop surface, every one of them meaning
**somebody else's record sleeve** quoted on a tournament poster.

Meanwhile the schema had already agreed. Migration 155 built `release_links`
with `albums.id` as the spine and `loop-event`, `journal-issue`, `poster-kit`
and `shopify-product` among its kinds. The database modelled the album owning
the event, the magazine, the artwork and the store product before anything else
did. It had zero rows: the claim existed in the DDL and nowhere else.

`scripts/loop/assert_album_identity.ts` writes those rows. That is the album
asserting ownership in data rather than in prose.

## The surfaces

| Surface | What it is to the album |
|---|---|
| The record | The music. 13 tracks |
| A volume | The record brought into a room; Volume 1 is the first time it is played anywhere |
| The Journal | The liner notes — one issue per volume |
| The Wall | The album's photography, shot by the people in it |
| The filter | The album's art direction, applied to everyone who walks in |
| The pass | Entry, and standing in the circle |
| The merch | The album's wardrobe |

## Volumes and tracks — a habit, not a rule

Volume 1 is themed "1984", which is track 2, and the live take from that night
becomes its own recording on the release. That is the pattern and it is a good
one. **It is deliberately not a law.** A volume may be themed on something
outside the tracklist when that serves the room better.

Consequence for code: **the layout engine is never taught about the tracklist.**
The poster's album line is `EventDetails.record` — free text, optional, off by
default (`src/lib/loop/poster/layout.ts`). Nothing derives a theme from a track.

## The credit

- The record is by **Mani Odubo**. That is `albums.artist_name`, the DSP
  metadata, and the sleeve.
- **Odubo** remains the presenting studio. The event credit hierarchy is
  unchanged: `PRESENTED BY → Odubo`, `IN PARTNERSHIP WITH → Scott's Inn &
  Suites`.
- **On artwork the line is exactly `AN ALBUM BY MANI ODUBO`** (revised
  2026-08-25). Indefinite article, one line, no "first play". *An* album
  credits; *the* album announces — it sits on the poster the way a credit sits
  on a sleeve, and it cannot be edited to "the album" later without changing
  what it claims.
- It takes the **big line under the header**. **Volume and theme are not on the
  event poster or the app's front door at all** (removed 2026-08-25): leading
  with an edition number made the night read as an instalment of something you
  had missed the start of. The album is the identity. The theme still does its
  work where it is an instruction rather than a label — the **dress code** line,
  and the programme behind the QR. The door ticket and pass card still carry
  volume/theme, because those identify *which* night a code belongs to.

## The audience is closed

Loop Soul is not a public release. Its audience is the people who showed up.

- Membership is earned by **registering and attending**. Entry is free.
- **Registration closes at the event and never reopens.** No later sign-up.
- Members, and only members, can enter the album cover contest and post to the
  community gallery, see the winners, listen to the record, and vote on the
  tracklist.

The urgency in every piece of marketing comes from that door, not from a price:
*register by the night, or be permanently outside this record.* It is true, so
it is the only claim the campaign needs to make.

Most of the machinery already exists — `hasRoomAccess()` in `src/lib/loop/doors`
is the "was in the room" primitive, `loop_attendees` / `loop_attendance` /
`loop_media_credits` are the membership records, and the Wall is already gated.
The gap is a **member-facing way to hear the record**: `/music/albums/[albumId]`
is the public platform, so the record needs a listening surface behind
`hasRoomAccess()` inside `/loop`. That surface is the same thing as the
"stem player / bypasses Spotify" app — one build, not three.

## The anthem's next job

The Soul Loop Anthem is **parked for Volume 1** (`ANTHEM_ENABLED` in
`src/lib/loop/content.ts`). Picking a cover song competed with the album for
meaning. It returns after the event pointed at a better question: **the room
votes on the album's tracklist.** The audience shapes the record's running
order, having already made its cover. Same mechanism, no code thrown away.

## Recoolman is on-brand

The masked figure handing out flyers is exactly what
[the faceless](loop-soul-the-faceless.md) describes — *everyone comes out a
figure, ink on sand, no faces.* Recoolman on campus is the poster walking
around. Treat that as deliberate, not coincidence.

## Where this lives in code

- Album identity in data: `scripts/loop/assert_album_identity.ts`
- The optional album line on artwork: `EventDetails.record` in
  `src/lib/loop/poster/layout.ts`
- The anthem switch: `ANTHEM_ENABLED` in `src/lib/loop/content.ts`
- Brand vocabulary: [loop-soul-brand-language.md](loop-soul-brand-language.md)

Related: [the show](loop-soul-show-flow.md) ·
[the faceless](loop-soul-the-faceless.md) ·
[Volume 1 worklist](loop-soul-volume-1-worklist.md)
