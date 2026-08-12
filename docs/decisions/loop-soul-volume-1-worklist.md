# Volume 1 — the worklist

**The single place to check "where are we and what's next."** Updated
2026-08-11. Companion to `loop-soul-volume-1-plan.md` (the strategy) — this is
the running state.

---

## The dates

| | |
|---|---|
| **Working date** | **Saturday 12 September 2026**, doors 9pm, Scott's Inn, Kamloops |
| **Hard cap** | **Saturday 3 October 2026** |
| Why | Rocky Mountaineer stops staying at Scott's **Tue 13 Oct**. The Saturday before that is **10 Oct**; a week earlier is **3 Oct**. |
| Slack | Sept 12 leaves **three spare weekends** — Sept 19, Sept 26, Oct 3 |

*(This supersedes the "on or before Sept 29" in the plan doc, which was
estimated before the day-of-week was checked.)*

Work to **Sept 12**. The slack exists so a slip doesn't kill the volume, not as
schedule to spend.

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
