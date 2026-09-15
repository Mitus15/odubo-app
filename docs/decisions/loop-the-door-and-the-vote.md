# The door, the vote, and 3,520 lines that were never reachable

**2026-09-15.** Owner-directed. Started as "what is 'the room' in Loop Soul?"
and turned into the more useful question: *why do codes exist, does the night
require them, and has this been overcomplicated?*

---

## "The room" needed nothing built

It is the product's core metaphor, not a feature, and it was already
implemented twice over:

- `hasRoomAccess()` in `src/lib/loop/doors/index.ts` is the one question every
  gated surface asks.
- `InRoom.tsx` is the screen, filed under `portal/`.
- "In The Room" is the occupancy counter.

There is no `/loop/room` route and there does not need to be.

## What a code actually buys

Four jobs. Three are redundant:

| Job | Who really does it |
|---|---|
| Door ticket | A human at the door with a list |
| Room key in the app | Deleted by one `doors_open` toggle |
| Sales ledger | Shopify already counts passes |
| **One person, one vote** | **Only the code** |

The last one is load-bearing and stays. The two ballots decide the vinyl's
**cover** and **running order**; the cover carries $50 and a royalty. A code is
single-use, so a fake vote costs a real pass. Nothing else provides that:
`ls_voter` is unforgeable but freely clearable, so any cookie-keyed vote is
stuffable by an incognito window.

## The decision: trust runs the door, gate only the vote

Doors open on the night. Nobody types a code to use the gallery, the camera,
the Wall or Pose. The two ballots keep asking, because the vinyl result has to
be defensible afterwards.

That combination exposed a real defect. On an open-doors night a guest is let
**in** by `hasRoomAccess`, reaches `InRoom`, and was then told *"Voting is for
the room"* while standing in it — and pointed at an event code with no way to
reach one. Nothing crashed; the buttons were correctly disabled. It was a wall
with no door in it, which is worse than an error because it looks finished.

Now: **"Standings only. Voting is for pass-holders."** plus a **Find your code**
row to `/loop/code`, which already proves a checkout email and binds the pass to
the phone.

## What was deleted

3,520 lines behind two hardcoded `false` flags.

**Danceyokey** (1,107): panel, 352-line host console, two API routes, lib layer,
admin section. Volume 1's floor moment is the Loop Soul Line, which needs no
sign-up.

**The anthem tournament** (2,413): a four-round bracket, a 778-line UI, five
public API routes, an admin console, a simulator, an iTunes client, a poster
adapter. Superseded by the tracklist vote, which has a different shape entirely
(14 ordered tracks, a vote budget, no rounds or seeds) — so the machinery was
never coming back as written.

### What survived, and why it looked like the anthem but wasn't

- **`currentVoterId()`** — identity for all of `/loop`, imported by 20 files. It
  lived in `anthem-server.ts`, which made a parked tournament the root of the
  whole product's identity. Now `identity/voter.ts`.
- **`anthem-identity.ts`** — mints the `ls_voter` cookie for middleware.
- **The redemption route** — the front door, filed at
  `/api/loop/anthem/redeem`. Moved to `/api/loop/redeem`, old path kept as a
  re-export for one release because a silent break there is a locked door.
- **`ANTHEM_PHRASE`** ("What we dancin' to") — a brand line on merch and the
  poster arc's default.
- **The entire tournament poster family** in `poster/layout.ts` and
  `compose.ts`. It is pure geometry with no idea what it is drawing; its ~30
  tests pass untouched. Only the anthem-shaped *adapter* died. Its two reusable
  helpers (`artUrl`, `closesLine`) moved to `poster/copy.ts`.

## Rules learned here

**`npm run build` cannot verify a deletion in this repo.** `next.config.ts`
sets `typescript: { ignoreBuildErrors: true }` and the script runs `--no-lint`,
so a dangling import builds green. Use `npx tsc --noEmit` compared against a
baseline (855 errors / 10 `TS2307` at the time of writing) plus `npm test`
(253 passing, 3 suites failing for unrelated pre-existing reasons).

**Do not drop the tables.** Migration 142's naming is a trap: the table called
`ballots` is the *anthem's* and is now unused, while the live Volume 1
tracklist and cover votes live in **`candidate_upvotes`** under synthetic ids
(`vol-1#tracklist`, `vol-1#cover`). Dropping the wrong one destroys real votes.
`danceyokey_signups` is likewise left in place. There is no down-migration
convention here and an empty table costs nothing.

## The Wall opens when the pass is bought (2026-09-15, later the same day)

The gate above was written assuming the Wall was a during-the-night surface.
The owner's stated journey puts the camera and the Wall BEFORE the night: buy
a pass, shoot a cover, put it up. So `gallery/post` no longer requires
`phase === "live"`; it requires `hasRoomAccess` in any phase but archived. The
doors-open toggle still overrides on the night, exactly as before. See
`docs/sessions/2026-09-15-the-journey.md`.

## Still open

- **The capacity counter lies with the doors open.** `getPassCapacity` counts
  `event_codes` rows carrying a real `order_id`, so walk-ups sell nothing and
  the public "In The Room" number stays flat while the room fills. Decide
  before the night whether to hide it, relabel it, or leave it.
- **The redeem compatibility shim** at `/api/loop/anthem/redeem` should be
  deleted next release.
- `ANTHEM_VOTE_SECRET` keeps its name because it is set in the deployment
  environment; renaming it would be a production change for cosmetics.

## Note on the same-day vocabulary pass

A parallel session rewrote Loop's pass vocabulary ("your pass", not "your event
code") on the same day. Where the two overlapped, the merge kept whichever
solved more: their `PortalGate` rewrite superseded this branch's narrower fix,
and this branch's ballot wording superseded theirs, because theirs still told a
guest standing in the room that voting was "for the room".
