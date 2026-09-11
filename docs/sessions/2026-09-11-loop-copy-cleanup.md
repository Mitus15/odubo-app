# 2026-09-11 — /loop copy cleanup (pre phase)

Phone-facing dev server, then a full copy pass over the Gathering poster and
everything one tap behind it. Owner reviewed the audit and directed the rewrite.

## The frame that changed everything

**The cover contest and the tracklist vote are both about the VINYL** (owner).
That is the decision this session turns on. The album is already fourteen tracks
and already carries Mani's cover, so a vote could only overwrite finished work.
The record you can hold is not decided yet, a side of vinyl is shorter than the
album, and the room is who decides what it is.

The 30-minute side limit is the real reason and is deliberately left unsaid
(owner: "I don't want to communicate all that, keep it simple"). "Fourteen won't
fit" carries the constraint without the manufacturing lecture.

Voting happens AFTER the night: people need the album in hand before they can
argue about a running order.

## Copy fixed

| What | Where |
|---|---|
| "The 26th" → the live event date | `GetPassModal` — the night moved to Oct 10 on 2026-09-10 and this string didn't |
| Hardcoded "album live at 8, floor at 9" → read from the live programme | `GetPassModal` + `GatheringPoster` (new `albumTime` prop) |
| `odubostudio.com/loop/code` → `/loop/code` | `GetPassModal` — a visitor already on the site was being sent to a hostname |
| Cover/tracklist → the vinyl frame | `GetPassModal` includes, `CoverContest` (full rewrite) |
| Recording notice → permission, covering the venue | `content.ts` `RECORDING_NOTICE` |
| Magazine rate ($5/shot) removed | `CoverContest` — the magazine is gone, the Wall is where shots live |
| Em dash in the brand voice | `ClaimRow`, `LoopStore` pass-title fallback |
| "Passes drop soon" / `@loopsoul.ca` dead fallback | `GetPassModal` |
| Duplicate "What's included" control | `GatheringPoster` — it opened the identical modal |
| Store header subcopy | `LoopStore` — the footer link already does that job |
| Weekday on the date line ("Sat, Oct 10") | `GatheringHome` |
| `Cover Contest` → `The Vinyl`, `Legacy ↗` → `Legacy` | `GatheringPoster` |
| Opt-out sentence printed twice on one screen | `GetPassModal` action rail now carries `short` only |

## The recording notice is now a consent clause

Rewritten from "coming in means you may appear" (describes a risk, asks for
nothing) to "attending is your permission" (a grant). It names Odubo Studio AND
Scott's Inn, covers promotion/content/product, and states that nothing is owed
to anyone who appears.

**Two things this now commits us to:**
1. It is a consent clause with legal effect. Worth a lawyer's eye before the night.
2. `optOut` promises "a space the cameras do not cover". That room has to exist.

## Capacity

Owner set the room at **150 max**, counter hidden until it's tight.

- `SCARCITY_AT = 40` in `GatheringPoster`: the count only prints below 40 left.
  "150 / 150 passes left" is true and reads as an empty room.
- The live number is `event_overrides.capacity` in D1, currently **0 (unlimited)**
  from the 2026-08-25 "tickets unlimited" call. **Still needs setting to 150 in
  /loop/admin** — it is the venue's number and must not need a deploy.

## Bug found and fixed: the phantom viewport

The owner reported /loop/store not scrolling. Root cause was NOT in the loop
segment. `StoreOrchestrator` renders `<div className="relative h-full">` as a
direct child of `<body>` on **every page in the app**, even with no store view
open. With `<body>` at `overflow: hidden`, that empty div claimed a full extra
viewport of unreachable document height (body scrollHeight 1624 against a
clientHeight of 812).

Fixed by making `h-full` conditional on a view actually being mounted. Body
scrollHeight is now equal to clientHeight on every page.

This is a plausible cause of the "half-scrolls then snaps back" feel on iOS,
but it was not reproducible in the desktop mobile emulation — **needs a retest
on a real phone.**

## Blocked, deliberately not written

**The Wall is attendee-gated and has no pre-phase page.**
`/api/loop/gallery/list` 403s without a redeemed code; `WallGallery` only renders
inside the Portal (live), Legacy (archived) and the Pose studio.

The owner wants the Wall public after the night and wants it in the footer in
place of Legacy. Neither is a copy edit. So:
- `CoverContest` step 2 says what is true today ("everyone who was there"), NOT
  "visible to the public".
- The footer keeps Legacy, arrow dropped.
- **Next build: the public Wall page.** Owner chose this explicitly.

## Deferred by the owner ("don't do that now")

- Shopify checkout branding (no logo, reads as "BAAD by Odubo")
- `account.odubo.studio` broken; sign-in entry point unclear
- Linking the event code to a Shopify account, and the code as a merch discount
- Code as a scannable QR at the door

## Left alone, flagged

The programme's floor row says "come as you'd have come in 1985" while the pass
sheet says "Dress code: 80s". That row is live D1 content edited from /loop/admin,
so changing it in code would not stick. One-line admin edit if it bothers him.
