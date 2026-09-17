# 2026-09-17 — the complete pass (event, contest, digital hub)

The owner, the night before: "do another pass of this complete thing, event,
contest and digital hub, as a system leveraged to promote my new album. Flag
anything that needs fixing or is otherwise unfinished or unnecessary. I want
the digital aspect of this whole campaign complete in terms of work tonight."

Seven commits on `main`, each one group, each deployed as it landed:
`238251c` guest breaks · `7935ee2` cover flow · `3d54d8d` record page ·
`b8ea15b` words · `e0e5a49` print facts · `bd988dc` admin · `585fdb6` removals.
No migrations. Net: about 1,000 lines added, 2,300 removed.

## What was broken for a guest, now fixed
- Two "get a pass" links (the record page, the live gate) went to a bare
  Shopify checkout that never takes the address the ticket goes to. Both now
  open the pass sheet. Sale #1 had come through such a link with no email.
- A holder tapping "Hear the rest of it live" got nothing (the pass sheet is
  hidden for holders). The Single now says "The rest of it is yours".
- Your ticket / Your record were gated on "the doors are open", so on the
  night a stranger saw an empty ticket sheet and a holder on the live page
  had neither. Both gate on a ticket on this phone; the in-room page carries
  them.
- "In The Room" counted door scans, so an open-doors night read 0 all night.
  `roomHeads()` counts entered passes when the doors are open, scans when
  not; `GET /api/loop/room` is polled every 20 s. The label is "Here tonight".
- The share card said "Volume 1 · Come Dance" with no date, from a mock. It
  now reads the event live: An album by Mani Odubo · Sat Oct 10 · Scott's
  Inn, Kamloops · 19+ · $5.
- "Get Loop Soul on your home screen" could not install on Android: SVG icon
  only. PNG icons at 192/512, apple-touch-icon, honest manifest description.
- The sold-out path promised a waitlist that did not exist. `POST
  /api/loop/pass/waitlist` joins the consent list with source "waitlist";
  the sheet takes one field; the guest CSV carries the source.
- A ticket's QR encoded the admin door, so a guest scanning their own ticket
  met the admin login. It encodes `/loop/d?c=` now: the host's phone goes to
  the door, a guest to Enter your pass with the code filled in.
- The store's pass sheet read a different date format and no programme.
- The archived front door rendered sand on sand (no VaultMode).
- StoreOrchestrator's closed wrapper was a viewport-tall empty block under
  `<body>` on every page; `/loop/album` scrolled off the record into a blank
  gradient. Zero-height while closed. (The memory said this was fixed on
  2026-09-11; the fix was not on main.)

## The cover flow, finished
Post → "On the Wall ✦" → "See it on the Wall" closes onto a Wall that already
holds the shot. Make this my cover closes the viewer, says "That's your cover
now", refreshes. The first post from a phone needs a name (the $50 goes to a
person). One gallery-code function (`loopGalleryCode`); `wallCode` was a copy.

## The record page
AlbumPlayer reads its palette from the surface (vault tokens on /loop/album,
odubo fallbacks on the music page); six hexes were typed in. The stem field
is off inside a guest's record. The draw says how many were dealt; the final
act has one exit. "Your record · Out now" once released.

## Words
Nav phase labels from one helper (The Gathering / Tonight / Legacy); no
Legacy before the night. Enter your pass, not Find your code. No "room" to
a guest. The declared cover is shown on Legacy and as the Journal's cover
(`getCoverWinner` had no callers). Programme seed 10:00. No brand intro over
the door scanner. A sharer opening their own gift link is not a reach.

## Print
`lib/loop/poster/volumes.ts` is the one block of printed facts, read by the
kit, the living poster and the studio (which typed DOORS 9PM on its own).
19+ prints on every piece. WITH AMEN THE DJ prints from the studio. The
living poster carries the price. The kit renders the flyer and the Facebook
cover by default.

## Admin
Numbers panel (six counts, real sales only) + `GET /api/loop/admin/numbers`.
Simulate a ticket purchase exists. OS- ticket numbers under each code,
searchable. Marketing-list CSV (`?format=csv&list=consent`) for a Resend
Broadcast.

## Removed (all reversible in git; no table dropped)
Promoter Playbook + notes thread + API · the six-digit OTP and its email ·
ClaimRow + The Single's fourth screen + `/api/loop/me` · `/api/loop/redeem`,
`/api/loop/anthem/redeem`, `redeem()` · `/loop/pose` + PoseStudioShell · the
tournament poster family, `poster/copy.ts` and their tests.

## Not tonight, named
A campaign email sender with unsubscribe (build with the first campaign; the
reminder is a Resend Broadcast from the consent export). `?p=` placement
attribution and GA events. A merch `return_to` after Shopify checkout. The
three-covers-held rule. Background scroll lock in modals (CLAUDE.md says no).
The doors-open "Voting is for ticketed guests" variant in BallotSheet (the
API does not distinguish it; the link to Enter your pass stands).

## Gates at close
`tsc --noEmit` 850 / 10 TS2307 (baseline, zero new). `npm test` 317 passing
+ the same 2 pre-existing failures (down from 356 because the OTP, tournament
and copy-helper suites went with their code). Walked locally in pre, live and
archived with `LOOP_FORCE_PHASE`; kit render inspected; studio checked in a
browser; the ledger left at the owner's two passes and two links.
