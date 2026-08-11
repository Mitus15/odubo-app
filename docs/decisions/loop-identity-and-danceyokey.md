# Attendee identity & Danceyokey — design

**Status:** design for build, 2026-08-11. Companion to
`loop-soul-product-architecture.md` (the why); this is the how.

---

## Part 1 — Attendee identity

### The problem

A guest today is an `ls_voter` cookie plus a redeemed event code. That is enough
to open a door and nothing else. The owner needs to know **who is in the room,
what they've attended, what they shot, and what's theirs** — because credits,
curations, magazine royalties and "share your vault" all hang off it. A cookie
can't carry that: clear Safari data and the person who shot the best photo of
the night becomes a stranger.

### The model

Three layers, deliberately separate:

| Layer | What it is | Lifetime |
|---|---|---|
| **Device** | `ls_voter` cookie (HMAC'd uuid) | This browser, 180 days |
| **Attendee** | A person: display name, optional email, avatar shot | Forever, across volumes |
| **Attendance** | This attendee, at this event, via this code | Per event |

The device cookie is never the identity — it *points* at one. Several devices
can point at the same attendee (phone + laptop), and an attendee survives losing
all of them, because the **email used at checkout is the recovery key** (same key
`/loop/code` already uses).

### Claiming — friction where it belongs

Nobody types a password at a door in a dark room. So:

1. **Redeem a code** → we create an attendance and, if none exists, a shell
   attendee bound to this device. The night works immediately; no forms.
2. **First post to the Wall** asks for a display name (already does).
3. **Claiming** — "this is me" — asks for name + email and binds the attendee to
   that email. Prompted after the night ("your photos are ready"), or any time
   from the profile. Emailing is *not* required: matching the checkout email is
   what proves it, and that's a lookup, not a delivery.
4. **Returning on a new device** — enter your checkout email at `/loop/code`;
   redeeming there re-binds the new device to the same attendee.

No passwords anywhere. The security posture matches the stakes: the worst case
is someone who knows a buyer's exact email seeing that buyer's gallery — the
same exposure the code lookup already accepts, rate-limited the same way.

### Attribution

Every capture records the attendee id at upload time, immutable afterward. It
lives in a **Loop-owned table** (`loop_media_credits`), not as a new column on
moments' `gallery_photos` — moments must never learn Loop Soul exists (the
integrity rule from the merge plan). The join is on the photo's `uid`.

That single row is what later powers: "your shots", profile pages, contributor
credits in an issue, and royalty accounting.

### Regular status

`loop_attendance` rows are the attendance history, so "regular" is derived, not
stored: **volumes attended**. It drives Danceyokey priority (below) and, later,
perks the owner chooses.

---

## Part 2 — Danceyokey

### The social contract (from the owner)

Karaoke at a pub, for dancing. A host keeps a list; you pick a song; when you're
called, **the floor is yours for one song** — dance it or lip-sync it, alone or
with as many people as you want. Few spots a night, so a spot is a prize.

### Selection modes

The host chooses the mode per event (or mixes them). All four exist because
different nights want different energy:

| Mode | How a spot is won | Feels like |
|---|---|---|
| **First come** | Sign-up order, priority to regulars | Fair, rewards showing up early and often |
| **Host picks** | Owner promotes anyone from the list | Curated — the host builds the show |
| **Random draw** | Host draws from the waiting list, weighted | An event in itself; the room watches the draw |
| **Wildcard** | Host awards a spot live, off-list | Rewards the moment — the person who's *going for it* |

**Regular weighting.** In first-come, regulars sort ahead of first-timers within
the same minute of sign-up (not absolutely — a first-timer who signed up an hour
earlier still wins). In random draw, an attendee gets one extra ticket per
previous volume attended, capped at 3, so regulars are favoured without making
newcomers hopeless. This is the perk the owner asked for, applied where it's
felt rather than as a badge.

### Groups

A sign-up is one **act**, not one person: `performers` is a free list of names
(solo, duet, quadruplet, a whole crew). The act holds the spot; the app never
needs to model each dancer as a user.

### Timing

Sign-ups open **before the night** (from the Gathering poster, once you hold a
pass) and stay open **in the room** (from the Portal). Pre-signing is the
promotion play — you've picked your song days early and you're telling friends.

### The host console

The real surface, sized for one hand at the back of a room:

- The **running order** — up next, on now, done, with the act and their song.
- **Promote / reorder / cut** any waiting act; **draw** at random; **wildcard**
  someone in on the spot.
- **Song is data**, shown to the host to cue, and kept for the edit (what to
  overdub) and the magazine (what was danced to).

Guests see: their position, their song, and "you're up next". That's it — a
glance, not a feed.

### Data

- `danceyokey_signups` — one per act: event, attendee, performers, song title +
  artist, note, status (`waiting` | `queued` | `performing` | `done` | `cut`),
  queue position, source (`advance` | `in-room` | `wildcard`), timestamps.
- `danceyokey_settings` (in `loop_settings`) — spots per night, mode, whether
  sign-ups are open.

Status is the whole state machine: `waiting` (on the list) → `queued` (in the
running order, position set) → `performing` (floor is theirs) → `done`.
`cut` is the graceful no-show/decline.

---

## Build order

1. Migration 147: `loop_attendees`, `loop_attendance`, `loop_media_credits`.
2. Identity lib + wire attribution into Wall posts + a profile surface.
3. Migration 148: `danceyokey_signups`.
4. Danceyokey lib + guest sign-up + host console.
5. Filter nuance (independent of both).
