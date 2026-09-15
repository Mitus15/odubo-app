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

## The physical door (2026-09-15, evening)

The ticket is a QR that encodes `/loop/admin/door?c=<pass>`; the door is that
page, on the host's phone, scanning and admitting. Admission is recorded in
`event_codes.admitted_at` (migration 162), separate from the app's
`redeemed_by`, because being let in and opening the app are different acts
that happen in either order or not at all. First scan wins; a repeat says so.

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

## The ticket is an object, and the two songs are a draw (2026-09-15, late)

**The ticket.** A code in a paragraph is not a ticket — nobody memorises
`LOOP-K7X2`, and a line of text is not something anyone screenshots. Every pass
email now carries a rendered PNG per pass: the wordmark, ADMIT ONE, the QR the
door scans, the code large enough to read in a dark courtyard, the night, the
dress code. Portrait, phone-shaped, because it lives in a camera roll.

Rendered with **Satori (`next/og`)**, not the sharp poster engine. The poster
engine resolves fonts and artwork from a path derived from the script's own
location, which works on a laptop and vanishes in a serverless bundle. Satori
was already proven in this app's production OG card, needs one TTF, and takes
a size we choose. The face is pinned into the function bundle via
`outputFileTracingIncludes`. **The render is never fatal**: a failure falls
back to the bare QR, and the email always goes. A missing picture is a
disappointment; a missing email is a guest at a door with nothing.

**Several passes on one order.** One code per unit, as before, and now one
numbered ticket per code: *ADMIT ONE · GUEST 2 OF 3*. The buyer forwards one
per guest, each admits once, each is independent at the door. The email says
so. `/api/loop/admin/ticket?c=CODE&n=2&of=3` previews any of it.

**The early tracks are dealt, not listed.** The owner's rule: the single is
free to everyone, and every pass-holder gets **two more at random**, seeded on
their address so the pair follows the person rather than the phone and never
changes. Two kinds are never dealt: the **intro**, and the **interludes** —
Volume 1 has three at thirty-five seconds — because being dealt two of those
instead of music reads as a mistake. Replaces the hand-picked list: the room
now compares notes, and between them they have heard most of the record before
the night. `album_early_enabled` / `album_early_extra` are settings; the admin
states the rule rather than listing tracks.

## The room's size is public; its sales are not (2026-09-15)

> "The order number should be randomised so people don't know exactly how many
> people have bought tickets."

The order number was the wrong suspect. It is never shown to a guest anywhere
in this product — not in the pass email, not at `/loop/code`, not on the album
page. Only Shopify's own receipt carries `#1001`, and only its one buyer sees
it. Shopify numbers orders sequentially and offers a prefix/suffix, never a
random sequence, so there was nothing to change there anyway.

**The leak was ours.** `/api/loop/capacity` returned `{sold, remaining}` to
anyone who curled it, and four guest surfaces printed the exact figure — the
poster read *"248 / 250 passes left"*, which is a live sales report published
to the internet, and early in a campaign it reads as "nobody is coming".

So: **the size of the room is the offer and is said out loud; how many have
bought is nobody's business until the number left is genuinely low**, at which
point it stops being a sales report and becomes a warning the buyer needs.

`src/lib/loop/capacity.ts` is the one rule, pure and tested. `sold` never
leaves the server.

| Remaining | Public state | The line |
|---|---|---|
| > 50 | `open` | **250 in the room** — the cap, no sales |
| ≤ 50 | `filling` | *42 passes left* |
| ≤ 20 | `last` | *12 passes left*, urgent colour |
| 0 | `full` | *Room is full* |

The poster, the pass sheet, the Loop store and the locked Portal all read the
same line from `capacityLine()`, so they can never disagree.

**Inside the room**, `InRoom`'s occupancy now counts `admitted_at` — who
actually walked through the door — instead of who bought. That was the open
question from earlier today: the number was wrong on an open-doors night, and
it was also a sales figure shown to guests. Both fixed by counting the right
thing.

## The buyer should never have to work out their own next step (2026-09-15)

> "As a recipient though, I'm a little confused about the room and the app. I
> got the email and now I have to scavenger hunt my next steps?"

He was right, and reading the sent email proved it. It said *"Show it at the
door, then enter it in the app to open the room"* — naming two things that do
not exist for a stranger: there is no app, and "the room" is our word, not
theirs. It then offered three links for three different jobs without saying
which was for them now, and buried the one immediately exciting thing (music
they can hear this minute) inside a paragraph under the schedule.

Rewritten around **one next step**: a START HERE block naming the songs they
can play right now and the single link that plays them. Then the ticket, then
the night, then what their pass does on the night in plain words — *shoot
through the filter, put shots on the shared gallery, vote on the cover and the
running order, nothing to install* — then recovery and the notice, quiet, at
the bottom.

**Reading it out loud found two live bugs** that would have reached every
buyer, neither of which any test had caught because both were in a *default*:

1. `Number(null)` is `0`, not `NaN`. `album_early_extra` is unset in
   production, so the rule resolved to "deal nobody anything" and every buyer
   would have been offered exactly one song.
2. `freeTrackNumber` fell back to `tracks[0]` when `featured_track` was unset —
   which it is — so that one song was **the intro**, the precise track the
   owner's rule exists to exclude.

Both fixed and pinned with regression tests that name the production
condition. `/api/loop/admin/preview-pass` renders the email without sending
one, linked from the admin, because the email is the only part of the product
the owner cannot inspect by visiting a page.

## The filming notice is one sentence (2026-09-15)

> "The film disclaimer is stupid. Can we just make it simple."

It was three paragraphs that explained the filming, then justified it, then
insisted it was not optional. All true, and all reading as an argument with the
reader rather than a term they were accepting. A release is a term. State it
once, plainly, before money changes hands:

> **By buying a ticket and attending, you agree that you may appear on camera
> and in photographs, and that Odubo Studio and Scott's Inn & Suites may use
> that material for any purpose, including commercial and promotional use.**

`RECORDING_NOTICE` is now `{ short, headline, full }` — `body` and `condition`
are gone. The pass sheet, the pass email and both `/legal` tabs all render
`full` verbatim, so the release a buyer accepts and the release the terms
describe are the same words.

It names **both** parties, because the venue films too. If the venue ever
changes, the sentence changes with it.

The takedown promise survives, one line in the email and a paragraph in
`/legal`: it is keepable, it costs nothing, and it is the part a person
actually wants to know exists.

## The draw is performed, not computed (2026-09-15)

> "The determining of the other two songs should be an experience in the app.
> Once they buy the ticket they should be taken on an experience into the music
> they have now accessed."

The pair was chosen the instant the page loaded, silently, and then listed in a
player like a receipt. The choosing is the interesting part, and it is the
first thing a new pass-holder sees seconds after paying — the only chance the
album gets to introduce itself.

`TheDraw` performs it in four acts: *14 tracks, 3 are yours tonight* → *everybody
gets this one* (the single) → *and 2 drawn for you*, the names moving and
settling one at a time → *yours until the night*, the three on hairline rules,
then **Play**.

Not a slot machine. The house style is typographic and the room is a listening
room, so the titles rise and settle rather than spin and clatter. Nothing is
decided here: the pair is already fixed, seeded on the buyer's address. This
shows a decision already made, which is what every good reveal is.

Plays **once per album per device** (`loop.album.drawn.<albumId>`), written when
the ceremony ends rather than when it starts, so closing the tab halfway does
not spend it. Skippable at every moment. `prefers-reduced-motion` collapses the
timings rather than removing the acts, so the story still reads.

**A flaw worth recording:** `AnimatePresence mode="wait"` plays the exit to
completion before the next act enters, so a symmetric half-second each way left
over a second of empty black between acts — which on a dark screen reads as a
broken page, not a beat. The exit is now a 0.2s blink and the entrance keeps
its weight. Only visible by watching it.

`/loop/admin/preview-draw?as=<email>` performs it for any address, on a loop,
so the host can watch it and confirm two buyers really are dealt different
songs.
