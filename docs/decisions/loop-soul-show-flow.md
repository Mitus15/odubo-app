# Loop Soul — the show: running order, spirit, and what the app must support

**Captured 2026-08-11** from the owner's dictated walkthrough. This is the
*spirit* of the program — the thing the run of show in the app should express,
and the shape the episode edit follows. Living document.

---

## The arc, as the owner described it

**1. Reception.** Doors open. The DJ plays. People arrive, get a drink, find
each other. Nothing announced, no performance — the room fills and warms.

**2. The cold open.** The guitarist cuts in — a wild solo, unannounced. The
room turns. This is the moment the *night* becomes a *show*.

**3. The welcome.** The host (Mani) comes in over the guitar:

> "Welcome everybody to Loop Soul — where we **sew** Loop **Soul**."
> *(sow/sew/so — the pun is the point: we stitch it together, and we plant it.)*
> "My name's Mani, I'm your host tonight, and we've got a show curated for you."

Then he sets the table: who's performing (e.g. Caleb, Berlin), that there's a
**Danceyokey** section, that everyone who signed up is on the list, and that
the picks come by **raffle** — and that everyone's on a **team**.

**4. First artist.** Caleb performs. Real set, real music.

**5. Open floor / Soul Train.** "Everybody come down to the floor, show us your
moves — the cameras are on." The whole room dances; camera hunts for the best
movers. This *warms the room up before anyone is asked to perform solo* — by
the time the raffle happens, everyone is already dancing and already filmed.

**6. Danceyokey + the raffle.** The host draws from the teams. Whoever's drawn
gets the floor: their song, their choice — dance it, lip-sync it, put on a
show. The lighting operator works it like a performance. **Three dancers, one
from each team.** (If only one person from a team signed up, they're in — the
raffle is a spectacle, not a filter.)

**7. Second artist.** Berlin performs.

**8. The full band.** The best performance is saved for the end.

**9. The Loop Soul Line.** The finale: a conga line that becomes a **circle**.
The line dances; **two people at a time break into the middle**, do their
thing, and fall back into the line. Then the next two. Filmed as well as
possible — this is the closing image of the episode and the visual signature of
the whole series.

**10. After.** Photos, poses, the fashion areas. The room empties slowly.

---

## Why this order works (my read)

- **The cold open is the strongest idea here.** Reception → guitar cutting in
  is exactly how a taping should start: it converts a bar into an audience in
  about four seconds, and it gives the edit its opening shot.
- **Open floor before solo spots is the right psychology.** Nobody wants to be
  the first person dancing alone. By the time the raffle lands, everyone's
  already moving and already on camera, so being picked feels like a promotion
  rather than an exposure.
- **The raffle is theatre, not admin** — do it live, out loud, with the room
  watching. It's a beat in the show, so it belongs *after* the floor is warm.
- **Band before the Line is correct.** Peak performance, then everybody in.

### Two refinements worth considering

1. **Put a short host beat between each artist and the next thing.** The order
   above already does this; keep it deliberate — the host's returns are what
   makes it a *show* rather than a series of sets. Three or four lines each
   time is enough.
2. **Consider splitting Danceyokey into two passes** if energy allows: one
   round after the open floor (2 dancers) and one just before the band (1
   dancer + wildcard). It gives the middle of the night a second spike and
   spreads the app moments out instead of clustering them.

### One risk to plan around

The night has **three "everybody" moments** — open floor, Danceyokey, the Line.
If they run too close together the room tires. The artists and host beats
between them are the rest; protect them in the timing.

---

## New systems this implies (not yet built)

### Teams
- Guests are **assigned a team on arrival** (randomly), and can **opt in to
  keeping the same team across volumes** — that's the returning-character
  element of the series.
- **Points** for being picked and performing well. A team wins the night;
  bragging rights, announced from the stage.
- The **raffle draws per team** — three dancers, one from each — which is a
  different draw than today's single random draw across everyone.
- App impact: a `team` on the attendance record; team assignment at code
  redemption; points ledger; a standings surface for the host and a small one
  for guests. Danceyokey's draw needs a per-team mode.

### Fashion showcase
- A **dedicated fashion gallery per event** — not the general Wall, a separate
  curated surface where people post their outfit, tagged.
- Reads like an **online magazine page** people can browse.
- Ties directly into the magazine/issue model already documented.
- App impact: a tag/section on captures (`fashion`), a gallery view filtered to
  it, and a place for it in Legacy.

### Paid photo utilities (idea stage)
- Guests **pay to keep/store their photos**, or to share/download originals.
- Needs care: the free path (get your own shots) should stay free, or it sours
  the room. The paid thing should be *more* — the magazine, prints, the
  high-res set, long-term storage of every volume.

---

## What this means for the app's run of show

The run of show in the app should read as **acts**, matching the above:

| Time | Act | Note |
|---|---|---|
| Doors | Reception — DJ | Arrivals, drinks, teams assigned |
| +45m | Cold open — guitar | Unannounced |
| — | Welcome — the host | Sets the show, the teams, the raffle |
| — | Artist 1 | |
| — | Open floor (Soul Train) | Whole room, cameras hunting |
| — | Danceyokey + raffle | 3 dancers, one per team |
| — | Artist 2 | |
| — | The band | Peak |
| — | The Loop Soul Line | Conga → circle, two in the middle |
| Close | Photos & fashion | |

Times get filled in once doors and set lengths are fixed; the app's Run of Show
editor holds it, and the same list drives the "On now" line in the Portal.
