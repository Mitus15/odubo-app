# The Loop Soul vinyl: two records, two albums

Decided by the owner 2026-09-30.

## The decision

The album does not fit on one record. At 51:05 it would need 24:40 and 26:49
a side, past what bass-heavy music takes without being cut quiet and thin
(about 18 to 22 minutes a side for this kind of master). Cutting songs was
ruled out: the album is one flight from Welcome to Ghost World, danced in one
take, and the vinyl's cover shows all fourteen songs.

So it is **two records, in album order**, and each record is **its own album:
Loop Soul Vol. 1 and Loop Soul Vol. 2**, bought separately. The owner's
reason: for an artist people are just meeting, two albums are two moments of
attention and a smaller first purchase.

| Record | Side | Songs | Length |
|---|---|---|---|
| **Vol. 1** | A | 01 Welcome, 02 1984, 03 Hallucinogen, 04 The No End Theory, 05 In The Court | 14:46 |
| | B | 06 News Peak, 07 Every Generation, 08 Rap, 09 Makunahea | 12:42 |
| **Vol. 2** | C | 10 The Other Side, 11 The Mind Pt 1 | 14:10 |
| | D | 12 Midnight Marauders, 13 The Mind Pt 2, 14 Ghost World | 9:47 |

Vol. 1 runs 27:28 and Vol. 2 23:57 (lengths include 2 s between tracks). Of
every way to split the album in order into four sides, this one has the
shortest longest side. Side labels run A to D across both records so the
album order stays readable.

## Why the break falls where it does

- **Vol. 1 is the ascent, Vol. 2 the crossing.** Vol. 1 runs from the
  incarnation to Makunahea; Vol. 2 opens on The Other Side (the crossing in
  the story bible) and holds the wrestle (The Mind) and the resolution
  (Ghost World). The break between the records is the story's act break.
- **The last flip lands at the turning point.** The Mind Pt 1 ends side C;
  side D opens on the Midnight Marauders interlude, then The Mind Pt 2
  (coming out of the Mind) and Ghost World.
- **All three singles are on Vol. 1** (1984, News Peak, Makunahea). Vol. 1 is
  the one that goes out with the singles; Vol. 2 has no single yet.

## What it overrides

- The "never Volume 1" copy rule was about the Oct 10 night's name (the night
  is archived). "Vol. 1" now names a record. Internally, D1's `event_id`
  `vol-1` still means the night; it never reaches a guest.
- The tracklist vote (`loop-vinyl-is-the-vote` in memory) has nothing left to
  decide: every song is on a record.
- The vinyl's cover (the Warhol grid, `docs/decisions/loop-film.md`) becomes
  two covers, one per volume. Vol. 1's nine songs make an exact 3 x 3 grid;
  Vol. 2's five need their own layout.

## Settled the same day

- **Streaming is two albums too.** Vol. 1 and Vol. 2 are separate releases
  everywhere, matching the records: two release days, two chances at the
  new-release playlists. Each needs its own streaming cover (the face, marked
  per volume).
- **Vol. 2 comes after Vol. 1.** Vol. 1 goes out with the three singles; Vol. 2
  follows weeks later, opening on The Other Side.

The order of the whole rollout, all dates waiting on the shoot: the film, the
singles (Makunahea, 1984, News Peak), Vol. 1, then Vol. 2.

## The data today (checked 2026-09-30)

One `albums` row, "Loop Soul" (`724666e5-66a8-4229-99ee-d5450076b749`), draft,
14 tracks numbered 1 to 14, a stale release date of 2026-10-03 from the old
plan. One `distribution_releases` draft, "Loop Soul", same date, linked to it.
Two `loop_album_entitlements`, both from the owner's own passes. Nothing is
released and nobody else holds anything, so the split can be done cleanly.
The film's chapters keep their own numbering, 1 to 14 (`loop_film_chapters.number`);
only the releases split.

## Open

- The two vinyl covers. `film:grid --volume=1|2` renders them: Vol. 1 is its
  nine songs on a 3 x 3 grid; Vol. 2's five sit on the same grid as an X (the
  corners and the centre) or a plus (the centre and its sides) with sand in
  the other squares. The plus reads as a cross: a faith choice, the owner's.
- The two streaming covers (the face, marked per volume).
- The price of each record, the pressing plant's quote and template.
  `scripts/shopify/loop-soul-vinyl.ts` still makes ONE product and has never
  been applied (checked: no `loop-soul-vinyl` in Shopify); it becomes two
  before it is run.
