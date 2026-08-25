# Volume 1 — the worklist

**The single place to check "where are we and what's next."** Updated
**2026-08-24**. Companion to `loop-soul-volume-1-plan.md` (the strategy) and
[loop-soul-is-the-album.md](loop-soul-is-the-album.md) (what this all is) —
this is the running state.

---

## The dates

| | |
|---|---|
| **The date** | **Saturday 26 September 2026**, doors 9pm, Scott's Inn, Kamloops |
| **Hard cap** | **Saturday 3 October 2026** |
| Why | Rocky Mountaineer stops staying at Scott's **Tue 13 Oct**. The Saturday before that is **10 Oct**; a week earlier is **3 Oct**. |
| Slack | Sept 26 leaves **one spare weekend** — Oct 3 |
| **Promo date** | **Friday 11 September** — TRU Back to School barbecue. Flyers, handed out in the Recoolman mask. A promotional opportunity, not a launch |

**Moved from Sept 12 on 2026-08-24.** At 19 days out: **0 passes sold, 0 RSVPs,
phase still `pre`, nothing printed**, and the "announce week of Aug 18" window
had passed in silence. Sept 26 buys back three weeks and still clears the cap by
a weekend. The premise changed at the same time — see the album doc — because a
$20 party with a band had no reason to exist on one specific Saturday, and the
first play of an unreleased record does.

**Entry is $5** (revised 2026-08-25 — briefly "free"; the $20 pass was never
true either). The offer is the circle, not the ticket: registration closes on
the night and never reopens. Microtransactions come later; the door stays $5.

**The night is early and short:** doors 6:30, the album at 8 in the courtyard,
"1984" live indoors at 9, dance floor, **everybody out by 10:30**. Full table in
[loop-soul-show-flow.md](loop-soul-show-flow.md).

---

## Who does what

**Owner** — everything with an external dependency or a person attached:
the band, team captains, crew hires, the print order, and sitting down to draft
the briefs together.

**Claude** — the app, the artwork generators, the converter, and the drafts.

The split matters because the owner's items have lead times that can't be
compressed, and they're the ones most likely to become the reason a date moves.

---

## Owner's list (lead times — start these first)

- [ ] **Band** — booked, plus **at least one full rehearsal day**
- [ ] **Team captains** — recruit dancers; each films a filter video that
      doubles as promo *and* team recruitment
- [ ] **Crew** — event lead / floor manager, app steward, marketing partner
- [ ] **Print order** — posters are designed and approved; the run isn't ordered
- [ ] **Decisions**: confirm Sept 12 · announcement date · student pricing and
      promoter code batches · who's paid · wristband physical, digital, or both

## Documents to draft together

The owner asked to write these **with** Claude rather than receive them, and to
keep them in one folder that can be sent out as-is. Folder:
`~/Documents/Loop-soul-the-entertainment-room/documents/`.

- [ ] **Scott's venue brief** — most urgent; external party, needs lead time
- [ ] **Performer / promoter / affiliate concept brief**
- [ ] **App tutorials** — guest, host, and door
- [ ] **Budget** — costs and revenue framework
- [ ] **Legal**: filming consent, contributor royalty terms, privacy, age/venue

## Build list

**Blocking the announcement**
- [x] ~~Pre-code preview~~ — **done 2026-08-11**, on the branch, needs deploy
- [ ] Nothing else blocking, once the above ships

**Before the night**
- [ ] **Teams** — assigned on arrival, opt-in persistence, points, per-team
      raffle. Captain recruitment depends on this existing.
- [ ] **Digital pass artifact** — QR, printable, saveable PNG, wallet
- [ ] **Selfie-to-start-your-gallery** onboarding
- [ ] **Door kit rehearsal** — host and door on real phones

**Safely later**
- [ ] Guest photo → poster figure pipeline (vectorize silhouettes)
- [ ] Fashion showcase gallery
- [ ] Magazine issue + contributor royalties (post-event by design)

**Cancelled**
- ~~Face pass for the video converter~~ — see `loop-soul-the-faceless.md`.
  Facelessness is the look now, so there is nothing to fix.

---

## Standing hazards

**Local development runs against the PRODUCTION database.** This bit us once
already: a phase left on `live` meant real visitors to /loop hit a code wall.
Partly fixed 2026-08-11 — `LOOP_FORCE_PHASE` now overrides the phase in dev
builds only, so previewing a phase locally no longer requires flipping the real
one. Everything *else* written locally still goes straight to production data.

**Resend has no verified sending domain.** Pass codes only reach the owner.
`/loop/code` looks codes up by checkout email so entry never depends on
delivery — but every touchpoint should say so until this is fixed.

**Never hardcode a domain.** odubo.studio is lapsed and may not come back.
Share links, QR codes and canonical URLs derive from the request origin.

---

## Open PRs

| | | |
|---|---|---|
| [#4](https://github.com/Mitus15/odubo-app/pull/4) | The Loop Journal | open since Aug 10 |
| [#24](https://github.com/Mitus15/odubo-app/pull/24) | Video converter | opened Aug 11 |
| — | Pre-code preview + `LOOP_FORCE_PHASE` | committed, not yet pushed |

---

# The list (merged 2026-08-24)

The owner's 21-item list, folded in here rather than kept separately — a second
list is how the first one goes stale. Item 22 (revenue) was added mid-session.

**Two clocks:** **Fri Sept 11** (barbecue — flyers must exist) and
**Sat Sept 26** (the night).

## What the album framing collapses

Items 9, 10, 11, 14, 16 and 17 are not six projects. They are one: *the album
shipping through its own channel.* The app is the record's player, the filter
makes its cover, the event is its first play. Sequenced as one thing they share
a deadline; listed as six they compete for the same three weeks.

Item 18 (world-building invite page) is **already half-built** — `/loop` in
`pre` phase *is* a full-bleed invite poster. It needs the 1984 world, not a
second page.

## Team & ops

| # | Item | By | State |
|---|---|---|---|
| 1 | Build the team — contact, meet, assign | Sept 5 | Owner |
| 2 | Budget — what you have vs what it costs | **tomorrow** | Owner. Everything print/sound/lighting hangs off it |
| 3 | **Get a new domain** | **~Sept 1** | Owner. Blocks the flyer print run — see below |
| 4 | Wire the domain (Shopify · Cloudflare · Vercel) | after 3 | Vercel already has `odubo.studio` verified; only DNS is dead. **The Shopify `orders/paid` webhook points at the vercel.app host and must be re-registered** |
| 5 | Shopify maintenance | ✅ **audited 2026-08-24** | Findings below |

**Shopify audit (2026-08-24):** pass product ACTIVE and published, SKU
`LOOP-PASS-VOL1`, has media; `loop-soul` collection resolves correctly through
the Storefront API; Odubo store correctly excludes the pass (11 products);
`ORDERS_PAID` webhook registered. Two things to fix:
- ⚠️ **Shopify inventory is 75, the room is 60.** As configured the store would
  sell 15 more passes than the room holds.
- ⚠️ **The pass still charges $20 in Shopify** while the app now says **$5**.
  `loop_settings.pass_price` is set to 5.00; the live product is deliberately
  untouched because changing real checkout needs the owner's word. **These two
  must move together** — a poster and a checkout that disagree is exactly what
  the single-price-source work exists to prevent.
- The `loop-soul` collection still holds **only the pass**. No merch listed.

## Event production

| # | Item | State |
|---|---|---|
| 6 | Digital aspect of the event | Placeholder — break down later |
| 7 | Lighting | ✅ **Answered, but not as asked.** The album plays in the **courtyard, outdoors, at 8pm** — sunset in Kamloops in late September is ~7pm, so it plays **in the dark**. This is evening outdoor lighting, not daytime visibility |
| 8 | Sound pre-approved | Now covers **two spaces**, one outdoors — which is where venue noise limits usually bite. See the sound note below |
| 8b | **Two-zone sound** | Band indoors (entertainment room), album outdoors (courtyard). **Settle first: are the two zones ever live at the same moment?** Sequential → zone *switching*, cheap. Overlapping → delay alignment, expensive. That answer decides what to buy |

## The album

| # | Item | By | State |
|---|---|---|---|
| 9 | Mix and master (possibly with Micah, one session) | Sept 26 | Owner. The upload path now exists (Release floor) |
| 10 | Finish "1984" | Sept 11 | Owner |
| 11 | Stem player | Sept 11 | **Same build as 14** |
| 17 | Lead single early on the app | — | Depends on 9 |

⚠️ **The album has no audio in this system**: 0/13 tracks have masters, 0 files
uploaded. The pipeline to fix it landed on the Release Control branch on
2026-08-24; only the uploads are missing. The album's `release_date` should stay
unset until masters actually land.

## Fashion

| # | Item | State |
|---|---|---|
| 12 | Finalise the outfit | Owner |
| 13 | List the jacket on Shopify | Needs photos + price + owner confirmation |

## App & product

| # | Item | State |
|---|---|---|
| 14 | Mobile app — stem player, exclusive content, bypasses Spotify | **The gated listening surface.** The record must sit behind `hasRoomAccess()` inside `/loop`, not on the public `/music` page |
| 15 | Early access — free download before the event | Depends on 14 |

⚠️ **The draft album is publicly readable right now.** `/api/albums` lists it and
`/api/albums/[id]` returns all 13 track titles, unauthenticated, in production.
Nothing is *playable* yet because there is no audio — but it becomes playable the
moment masters land. This directly contradicts the closed circle and needs a
decision (it is a deliberate preview feature of the Odubo platform).

## Marketing & engagement

| # | Item | State |
|---|---|---|
| 16 | Album cover contest | ✅ **Live on /loop** as its own sheet — how it works, and what it pays: **$50** for the cover, **$5** for any shot used in the magazine. The capture path (filter + Wall + `loop_media_credits`) already existed |
| 18 | World-building invite page (1984) | Extend `/loop`; don't build a second page |
| 19 | In-app apparel auction | Deferred with 22 |
| 20 | Social push Aug 24 → Sept 11 | **Unblocked** — digital posters regenerate on the new date and need no domain |
| 21 | TRU barbecue booth, Sept 11 | Needs the new **flyer** piece (half-letter) + the Recoolman mask |
| 22 | Free entry + support tiers / packaging | **Parked deliberately.** Recorded, not designed — see below |

## The print lock

Digital and print are on different clocks, and only one is blocked:

- **Digital (feed/story) is not blocked.** Link-in-bio context; regenerate any
  time.
- **Flyers are blocked on the domain.** ~1 week at the shop for Sept 11 means
  the order goes **~Sept 3**, so the domain must exist by **~Sept 1**. A QR
  cannot be corrected once printed — `npm run loop:posters` now **refuses** to
  render without `loop_settings.public_base_url` rather than bake in a host we
  might not own.
- Fallback if the domain slips: a flyer carrying `@loopsoul.ca` and no QR. Never
  goes stale, but loses scan-to-register.

## Item 22 — parked on purpose

Support tiers, the afterparty, merch listing, the jacket auction, the Journal,
and any pricing. Recorded here so it is not lost; **not designed**, to keep the
Volume 1 scope from creeping. The mechanism is ready when it is wanted: price is
already one setting (`pass_price` → `src/lib/loop/priceLabel.ts`), read by both
the app and the print kit, so opening or closing the door is one field.


---

## Magazine & payments (added 2026-08-25)

- **Album cover winner: $50.** Anyone whose shot is used in the magazine: **$5**.
  Both are stated on `/loop` in the Cover Contest sheet — a contest that names
  its payment reads as an offer; one that doesn't reads as free labour.
- **Magazine delivery: digital next week, physical the week after.**
